/* =========================================================
   NORTHSTAR SOC — RANSOMWARE ENGINE
   File: ransomware/RansomwareEngine.js

   The autonomous driver for the BLACKFROST ransomware
   campaign — the ransomware equivalent of engine/AttackEngine.js.

   Ticks in real time via setTimeout chains (same pattern
   AttackEngine already uses) regardless of which NORTHSTAR
   app the analyst has open. Emits real SIEM events through
   the SAME EventEngine every other system already uses —
   PacketEngine/DetectionEngine/AlertManager all pick this
   campaign up for free once events carry a matching
   `attackId`, exactly like AttackEngine's campaigns do.

   SAFETY: every "process", "command line" and "file" here is
   a plain data object inside NORTHSTAR's own in-memory state.
   Nothing is ever executed, encrypted, renamed, or deleted on
   the real filesystem, and no real network connection is ever
   made.
   ========================================================= */

import { HOSTS } from "../data/hosts.js";
import { USERS } from "../data/users.js";
import { NETWORK } from "../data/network.js";

import {
    createCampaign,
    STAGE_INDEX,
    FILE_STATUS,
    deriveSeverity,
    filesRemaining,
    encryptionRateFilesPerSecond,
    elapsedFormatted,
    deriveOutcomeBand,
    stageAtOrAfter
} from "./RansomwareCampaign.js";

import {
    PROCESS_CHAIN,
    buildRansomNoteContents,
    OBJECTIVE_DEFINITIONS,
    MITRE_MAPPING,
    getBackupHost
} from "./data/ransomwareConfig.js";

import { EvidenceStore } from "./EvidenceStore.js";

export const RANSOMWARE_EVENTS = {
    STATE_CHANGED: "ransomware:state-changed",
    RESOLVED: "ransomware:resolved"
};

/*
 * Real-time pacing. Tuned so an analyst who acts quickly
 * resolves in ~3-5 real minutes (spec section 83) and one who
 * investigates thoroughly still resolves within ~6-10 minutes,
 * while a slow/absent response lets encryption run to
 * completion well before that. All delays include a small
 * random jitter so the timeline never feels scripted.
 */
const TIMING = {
    emailToInteraction: [6000, 12000],
    interactionToAttachment: [3000, 6000],
    attachmentToExecution: [4000, 8000],
    executionToPersistence: [6000, 10000],
    persistenceToDiscovery: [8000, 14000],
    discoveryToTargeting: [10000, 16000],
    targetingToEncryption: [8000, 14000],
    encryptionTickInterval: [2200, 4200],
    encryptionToRansomNote: [9000, 15000],
    ransomNoteToC2: [5000, 9000],
    c2ToImpactConfirm: [4000, 8000],
    secondaryEscalationDelay: [60000, 90000]
};

function randomBetween([min, max]) {
    return Math.floor(min + Math.random() * (max - min));
}

export class RansomwareEngine {

    constructor(eventEngine) {

        this.eventEngine = eventEngine;
        this.campaign = null;
        this.running = false;
        this.timers = [];
        this.encryptionTimer = null;
        this.listeners = new Set();
        this.evidence = new EvidenceStore();
        this.pidCounter = 4180;
        this.processEventsByPid = new Map();

        console.log("[RANSOMWARE ENGINE] Ready.");
    }


    /* =====================================================
       SUBSCRIPTIONS
       ===================================================== */

    subscribe(listener) {
        if (typeof listener !== "function") return () => { };
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify(type = RANSOMWARE_EVENTS.STATE_CHANGED, payload = {}) {
        this.listeners.forEach(listener => {
            try { listener({ type, payload }); }
            catch (error) { console.error("[RANSOMWARE ENGINE] Listener error:", error); }
        });
    }


    /* =====================================================
       START / STOP / RESTART
       ===================================================== */

    start() {

        if (this.running) return;

        if (!this.eventEngine) {
            console.error("[RANSOMWARE ENGINE] EventEngine unavailable.");
            return;
        }

        this.running = true;
        this.campaign = createCampaign();
        this.evidence.clear();
        this.pidCounter = 4180;
        this.processEventsByPid.clear();

        console.log(`[RANSOMWARE ENGINE] Campaign ${this.campaign.id} online.`);

        window.dispatchEvent(
            new CustomEvent("northstar:ransomware-campaign-started", {
                detail: { campaignId: this.campaign.id }
            })
        );

        this.scheduleNoise();
        this.runInitialAccess();

        this.notify();
    }

    stop() {

        this.running = false;

        this.timers.forEach(timer => clearTimeout(timer));
        this.timers = [];

        if (this.encryptionTimer) {
            clearTimeout(this.encryptionTimer);
            this.encryptionTimer = null;
        }

        console.log("[RANSOMWARE ENGINE] Stopped.");
    }

    /**
     * Full reset per spec section 84/36 — restores hosts,
     * files, processes, network, campaign state so the player
     * can retry without reloading the page.
     */
    restart() {

        this.stop();

        const host = HOSTS.find(h => h.hostname === this.campaign?.affectedHostname);

        if (host) {
            host.compromised = false;
            host.isolated = false;
            host.processTerminated = false;
        }

        const secondaryHost = HOSTS.find(h => h.hostname === this.campaign?.secondaryHostname);

        if (secondaryHost) {
            secondaryHost.compromised = false;
        }

        if (Array.isArray(NETWORK.firewall?.blockedIPs)) {
            NETWORK.firewall.blockedIPs =
                NETWORK.firewall.blockedIPs.filter(ip => ip !== this.campaign?.actor?.ip);
        }

        if (Array.isArray(NETWORK.firewall?.blockedDomains)) {
            NETWORK.firewall.blockedDomains =
                NETWORK.firewall.blockedDomains.filter(
                    domain => domain !== this.campaign?.c2Domain && domain !== this.campaign?.c2RelayDomain
                );
        }

        this.start();
    }


    /* =====================================================
       TIMER HELPERS
       ===================================================== */

    after(range, fn) {
        if (!this.running) return;
        const timer = setTimeout(() => { if (this.running) fn(); }, randomBetween(range));
        this.timers.push(timer);
        return timer;
    }

    setStage(stage) {

        this.campaign.previousStage = this.campaign.stage;
        this.campaign.stage = stage;
        this.campaign.stageEnteredAt = Date.now();

        console.log(`[RANSOMWARE ENGINE] Stage → ${stage}`);

        this.notify();
    }

    emit(data) {

        if (!this.eventEngine || !this.campaign) return null;

        return this.eventEngine.createEvent({
            ...data,
            attackId: this.campaign.id
        });
    }


    /* =====================================================
       STAGE 1 — INITIAL ACCESS
       ===================================================== */

    runInitialAccess() {

        this.setStage("INITIAL_ACCESS");

        const host = this.getAffectedHostLive();
        const user = this.getAffectedUserLive();

        if (!host || !user) {
            console.error("[RANSOMWARE ENGINE] Affected host/user not found in HOSTS/USERS.");
            return;
        }

        this.emit({
            eventType: "EMAIL_RECEIVED",
            severity: "LOW",
            actor: this.campaign.actor.name,
            actorType: "ATTACKER",
            sourceIP: this.campaign.actor.ip,
            destinationIP: host.ip,
            hostname: host.hostname,
            username: user.username,
            sourceCountry: this.campaign.actor.country,
            message: `A document was delivered to ${user.username}'s mailbox.`,
            metadata: {
                subject: "Q3 Shipping Invoice — Action Required",
                attachment: "Q3_Shipping_Invoice.docm",
                simulated: true
            }
        });

        this.after(TIMING.emailToInteraction, () => {

            this.emit({
                eventType: "USER_INTERACTION",
                severity: "LOW",
                actor: user.username,
                actorType: "USER",
                hostname: host.hostname,
                username: user.username,
                message: `${user.username} opened the attachment.`,
                metadata: { simulated: true }
            });

            this.after(TIMING.interactionToAttachment, () => {

                this.emit({
                    eventType: "SUSPICIOUS_ATTACHMENT_OPENED",
                    severity: "MEDIUM",
                    actor: user.username,
                    actorType: "USER",
                    hostname: host.hostname,
                    username: user.username,
                    message: "Macro-enabled document executed embedded content.",
                    metadata: { attachment: "Q3_Shipping_Invoice.docm", simulated: true }
                });

                this.after(TIMING.attachmentToExecution, () => this.runExecution());
            });
        });
    }


    /* =====================================================
       STAGE 2 — EXECUTION
       ===================================================== */

    runExecution() {

        this.setStage("EXECUTION");

        const host = this.getAffectedHostLive();
        const user = this.getAffectedUserLive();

        host.compromised = true;

        PROCESS_CHAIN.forEach((step, index) => {

            const pid = this.pidCounter++;
            const parentPid =
                index === 0 ? null : this.processEventsByPid.get(PROCESS_CHAIN[index - 1].processName)?.pid;

            const event = this.emit({
                eventType: index === PROCESS_CHAIN.length - 1 ? "PAYLOAD_EXECUTION" : "CHILD_PROCESS_CREATED",
                severity: step.suspicious ? "HIGH" : "INFO",
                actor: step.suspicious ? this.campaign.actor.name : user.username,
                actorType: step.suspicious ? "ATTACKER" : "USER",
                hostname: host.hostname,
                username: user.username,
                process: step.processName,
                command: step.commandLine,
                message: `${step.processName} started (parent: ${step.parentProcessName}).`,
                metadata: {
                    pid,
                    ppid: parentPid || null,
                    parentProcess: step.parentProcessName,
                    commandLine: step.commandLine,
                    integrityLevel: step.integrityLevel,
                    suspicious: step.suspicious,
                    startTime: new Date().toISOString(),
                    status: "ACTIVE",
                    simulated: true
                }
            });

            this.processEventsByPid.set(step.processName, { pid, eventId: event?.id });

            this.campaign.processes.push({
                pid,
                ppid: parentPid || null,
                processName: step.processName,
                parentProcessName: step.parentProcessName,
                commandLine: step.commandLine,
                integrityLevel: step.integrityLevel,
                suspicious: step.suspicious,
                status: "ACTIVE",
                startTime: new Date().toISOString(),
                eventId: event?.id
            });
        });

        this.notify();

        this.after(TIMING.executionToPersistence, () => this.runPersistence());
    }


    /* =====================================================
       STAGE 3 — PERSISTENCE
       ===================================================== */

    runPersistence() {

        this.setStage("PERSISTENCE");

        const host = this.getAffectedHostLive();

        this.emit({
            eventType: "PERSISTENCE_ESTABLISHED",
            severity: "HIGH",
            actor: this.campaign.actor.name,
            actorType: "ATTACKER",
            hostname: host.hostname,
            username: this.campaign.affectedUsername,
            process: "svchost32.exe",
            message: "A scheduled task was created to relaunch the payload on reboot.",
            metadata: {
                technique: "Scheduled Task",
                taskName: "BlackfrostMaintenanceTask",
                simulated: true
            }
        });

        this.after(TIMING.persistenceToDiscovery, () => this.runDiscovery());
    }


    /* =====================================================
       STAGE 4 — DISCOVERY (+ benign noise, spec 69/71)
       ===================================================== */

    runDiscovery() {

        this.setStage("DISCOVERY");

        const host = this.getAffectedHostLive();

        this.emit({
            eventType: "PROCESS_DISCOVERY",
            severity: "MEDIUM",
            actor: this.campaign.actor.name,
            actorType: "ATTACKER",
            hostname: host.hostname,
            username: this.campaign.affectedUsername,
            process: "svchost32.exe",
            message: "Enumeration of running processes and security tooling was observed.",
            metadata: { technique: "Software Discovery", simulated: true }
        });

        this.after([2000, 5000], () => {

            this.emit({
                eventType: "FILE_DISCOVERY",
                severity: "MEDIUM",
                actor: this.campaign.actor.name,
                actorType: "ATTACKER",
                hostname: host.hostname,
                username: this.campaign.affectedUsername,
                process: "svchost32.exe",
                message: "Rapid enumeration of the Documents folder was observed.",
                metadata: { technique: "File and Directory Discovery", path: `C:\\Users\\${this.campaign.affectedUsername}\\Documents`, simulated: true }
            });
        });

        this.after(TIMING.discoveryToTargeting, () => this.runFileTargeting());
    }


    /* =====================================================
       STAGE 5 — FILE TARGETING
       ===================================================== */

    runFileTargeting() {

        this.setStage("FILE_TARGETING");

        const host = this.getAffectedHostLive();

        this.campaign.files.forEach(file => { file.status = FILE_STATUS.TARGETED; });
        this.campaign.filesTargetedCount = this.campaign.files.length;

        this.emit({
            eventType: "FILE_DISCOVERY",
            severity: "HIGH",
            actor: this.campaign.actor.name,
            actorType: "ATTACKER",
            hostname: host.hostname,
            username: this.campaign.affectedUsername,
            process: "svchost32.exe",
            message: `${this.campaign.files.length} files were flagged for encryption in the Documents, Desktop, Pictures, and Downloads folders.`,
            metadata: { fileCount: this.campaign.files.length, simulated: true }
        });

        this.notify();

        this.after(TIMING.targetingToEncryption, () => this.beginEncryption());
    }


    /* =====================================================
       STAGE 6 — ENCRYPTION (real-time progression)
       ===================================================== */

    beginEncryption() {

        this.setStage("ENCRYPTION");

        this.campaign.encryptionStartedAt = Date.now();

        this.emit({
            eventType: "FILE_ENCRYPTION_SIMULATED",
            severity: "HIGH",
            actor: this.campaign.actor.name,
            actorType: "ATTACKER",
            hostname: this.campaign.affectedHostname,
            username: this.campaign.affectedUsername,
            process: "svchost32.exe",
            message: "Simulated file encryption activity began on the affected host.",
            metadata: { simulated: true }
        });

        this.tickEncryption();

        this.after(TIMING.encryptionToRansomNote, () => this.createRansomNote());
    }

    tickEncryption() {

        if (!this.running || this.campaign.stage === "RESOLVED") return;

        if (this.campaign.processTerminated || this.campaign.malwareEradicated) {
            if (!this.campaign.encryptionStoppedAt) {
                this.campaign.encryptionStoppedAt = Date.now();
                this.notify();
            }
            return;
        }

        const target = this.campaign.files.find(file => file.status === FILE_STATUS.TARGETED);

        if (!target) {
            this.campaign.encryptionStoppedAt = this.campaign.encryptionStoppedAt || Date.now();
            this.notify();
            return;
        }

        target.status = FILE_STATUS.ENCRYPTING;
        this.notify();

        this.encryptionTimer = setTimeout(() => {

            if (!this.running || this.campaign.processTerminated || this.campaign.malwareEradicated) return;

            target.status = FILE_STATUS.ENCRYPTED;
            this.campaign.filesEncryptedCount += 1;

            this.emit({
                eventType: "FILE_ENCRYPTION_SIMULATED",
                severity: "INFO",
                actor: this.campaign.actor.name,
                actorType: "ATTACKER",
                hostname: this.campaign.affectedHostname,
                username: this.campaign.affectedUsername,
                process: "svchost32.exe",
                message: `${target.name} was encrypted and renamed.`,
                metadata: { fileName: target.name, extension: ".blackfrost", simulated: true }
            });

            /*
             * Correlation trigger, spec Detection 2: a burst of
             * modifications in a short interval.
             */
            if (this.campaign.filesEncryptedCount % 6 === 0) {

                this.emit({
                    eventType: "MASS_FILE_MODIFICATION",
                    severity: "CRITICAL",
                    actor: this.campaign.actor.name,
                    actorType: "ATTACKER",
                    hostname: this.campaign.affectedHostname,
                    username: this.campaign.affectedUsername,
                    process: "svchost32.exe",
                    message: `${this.campaign.filesEncryptedCount} files modified on ${this.campaign.affectedHostname} in a short interval.`,
                    metadata: { fileCount: this.campaign.filesEncryptedCount, windowSeconds: 8, simulated: true }
                });
            }

            this.notify();

            this.encryptionTimer = setTimeout(() => this.tickEncryption(), 400);

        }, randomBetween(TIMING.encryptionTickInterval));
    }


    /* =====================================================
       STAGE 7 — RANSOM NOTE
       ===================================================== */

    createRansomNote() {

        if (this.campaign.stage === "RESOLVED") return;

        this.setStage("RANSOM_NOTE");

        this.campaign.ransomNoteCreated = true;

        this.emit({
            eventType: "RANSOM_NOTE_CREATED",
            severity: "CRITICAL",
            actor: this.campaign.actor.name,
            actorType: "ATTACKER",
            hostname: this.campaign.affectedHostname,
            username: this.campaign.affectedUsername,
            process: "svchost32.exe",
            message: `${this.campaign.ransomNoteFilename} was created in the Documents folder.`,
            metadata: { fileName: this.campaign.ransomNoteFilename, simulated: true }
        });

        this.notify();

        this.after(TIMING.ransomNoteToC2, () => this.beginC2());
    }


    /* =====================================================
       STAGE 8 — C2 COMMUNICATION
       ===================================================== */

    beginC2() {

        if (this.campaign.stage === "RESOLVED") return;

        this.setStage("C2_COMMUNICATION");

        this.emit({
            eventType: "C2_CONNECTION",
            severity: "HIGH",
            actor: this.campaign.affectedHostname,
            actorType: "NETWORK_HOST",
            sourceIP: HOSTS.find(h => h.hostname === this.campaign.affectedHostname)?.ip || null,
            destinationIP: this.campaign.actor.ip,
            hostname: this.campaign.affectedHostname,
            username: this.campaign.affectedUsername,
            message: `${this.campaign.affectedHostname} established an outbound connection to ${this.campaign.c2Domain}.`,
            metadata: { domain: this.campaign.c2Domain, simulated: true }
        });

        this.after(TIMING.c2ToImpactConfirm, () => this.confirmImpact());
    }


    /* =====================================================
       STAGE 9 — IMPACT (host-level confirmation)
       ===================================================== */

    confirmImpact() {

        if (this.campaign.stage === "RESOLVED") return;

        this.setStage("IMPACT");

        this.emit({
            eventType: "HOST_IMPACTED",
            severity: "CRITICAL",
            actor: this.campaign.actor.name,
            actorType: "ATTACKER",
            hostname: this.campaign.affectedHostname,
            username: this.campaign.affectedUsername,
            message: `${this.campaign.affectedHostname} is confirmed impacted by simulated ransomware activity.`,
            metadata: { simulated: true }
        });

        /*
         * Secondary escalation if the analyst is very slow to
         * contain — kept small per spec section 78.
         */
        this.after(TIMING.secondaryEscalationDelay, () => this.maybeEscalate());
    }

    maybeEscalate() {

        if (!this.running || this.campaign.stage === "RESOLVED") return;
        if (this.campaign.hostIsolated || this.campaign.secondaryHostAffected) return;

        const secondaryHost = HOSTS.find(h => h.hostname === this.campaign.secondaryHostname);

        if (!secondaryHost || secondaryHost.isolated) return;

        this.campaign.secondaryHostAffected = true;
        secondaryHost.compromised = true;

        this.emit({
            eventType: "LATERAL_MOVEMENT_ATTEMPT",
            severity: "CRITICAL",
            actor: this.campaign.actor.name,
            actorType: "ATTACKER",
            sourceIP: HOSTS.find(h => h.hostname === this.campaign.affectedHostname)?.ip || null,
            destinationIP: secondaryHost.ip,
            hostname: secondaryHost.hostname,
            username: this.campaign.affectedUsername,
            message: `Simulated propagation attempt observed from ${this.campaign.affectedHostname} toward ${secondaryHost.hostname}.`,
            metadata: { simulated: true }
        });

        this.notify();
    }


    /* =====================================================
       BENIGN NOISE (spec 69/71 — false positive)
       ===================================================== */

    scheduleNoise() {

        /*
         * A different, uninvolved host generates ordinary DNS/
         * update traffic — coexists with the malicious feed,
         * never tagged with this campaign's attackId.
         */
        this.after([15000, 30000], () => {

            const ordinaryHost = HOSTS.find(h => h.hostname === "WORKSTATION-02");

            if (!ordinaryHost || !this.eventEngine) return;

            this.eventEngine.createEvent({
                eventType: "PROCESS_START",
                severity: "INFO",
                hostname: ordinaryHost.hostname,
                username: ordinaryHost.assignedUser,
                process: "onedrive-sync.exe",
                message: "onedrive-sync.exe started normally.",
                metadata: { benign: true, simulated: true }
            });
        });

        /*
         * The false positive: BACKUP-SERVER-01's ordinary agent
         * touches a burst of files on the affected host around
         * the same time real encryption starts — legitimate
         * activity that LOOKS like mass file modification if the
         * analyst doesn't check the actor/process.
         */
        this.after([70000, 95000], () => {

            if (!this.running || !this.eventEngine) return;

            const backupHost = getBackupHost();

            this.eventEngine.createEvent({
                eventType: "FILE_MODIFIED",
                severity: "LOW",
                actor: "backup-agent.exe",
                actorType: null,
                hostname: this.campaign?.affectedHostname,
                username: this.campaign?.affectedUsername,
                process: "backup-agent.exe",
                message: `Scheduled backup agent from ${backupHost?.hostname || "BACKUP-SERVER-01"} performed a routine file scan on ${this.campaign?.affectedHostname}.`,
                metadata: {
                    benign: true,
                    simulated: true,
                    fileCount: 9,
                    note: "Legitimate backup activity — not BLACKFROST encryption."
                }
            });
        });
    }


    /* =====================================================
       DETECTION HOOK
       ---------------------------------------------------
       Called by DetectionEngine the moment it raises the
       CRITICAL "RANSOMWARE ACTIVITY CONFIRMED" correlation
       alert, so the campaign's own detectedAt / severity
       reflect the analyst's actual first confirmed detection
       rather than a guess.
       ===================================================== */

    markDetected() {

        if (!this.campaign || this.campaign.detectedAt) return;

        this.campaign.detectedAt = Date.now();
        this.campaign.filesEncryptedAtDetection = this.campaign.filesEncryptedCount;

        if (STAGE_INDEX[this.campaign.stage] < STAGE_INDEX.DETECTED) {
            this.setStage("DETECTED");
        }

        this.notify();
    }


    /* =====================================================
       RESPONSE ACTIONS
       ---------------------------------------------------
       Each action changes ONE piece of real state and logs
       an audit entry. None of them solve the incident by
       themselves (spec section 74) — IncidentResponseStore's
       objective/outcome derivation is what rewards doing all
       of them.
       ===================================================== */

    audit(action, description) {

        this.campaign.auditLog.push({
            id: `AUD-${this.campaign.auditLog.length + 1}`,
            action,
            description,
            timestamp: new Date().toISOString()
        });

        this.emit({
            eventType: action,
            severity: "INFO",
            actor: "analyst",
            actorType: "ANALYST",
            hostname: this.campaign.affectedHostname,
            message: description,
            metadata: { simulated: true }
        });
    }

    isolateHost() {

        if (!this.campaign || this.campaign.hostIsolated) return { success: false };

        const host = this.getAffectedHostLive();

        if (!host) return { success: false };

        host.isolated = true;
        this.campaign.hostIsolated = true;

        this.audit("HOST_ISOLATED", `${host.hostname} was isolated from the network.`);

        if (STAGE_INDEX[this.campaign.stage] < STAGE_INDEX.CONTAINMENT) {
            this.setStage("CONTAINMENT");
        }

        this.notify();

        return { success: true };
    }

    /**
     * Containment now requires the analyst to have actually
     * picked a process in Process Tree (spec gap fix) — `pid`
     * is the PID of whatever ProcessTreeStore.getSelectedProcess()
     * returned at the moment "Terminate Process" was clicked
     * (IncidentResponseStore reads that selection and passes it
     * in), or whatever PID the Terminal's `terminate <process>`
     * command resolved.
     *
     * Terminating the true ground-truth-malicious process(es)
     * (suspicious: true in ransomwareConfig's PROCESS_CHAIN)
     * behaves exactly as before: encryption stops immediately
     * and every suspicious process on the host is marked
     * TERMINATED. Terminating anything else is a real mistake —
     * nothing is killed, encryption keeps running, and the
     * attempt is tracked (campaign.terminationMistakes) and
     * audited so it costs the analyst rather than silently
     * doing nothing.
     */
    terminateProcess(pid) {

        if (!this.campaign) {
            return { success: false, reason: "No active campaign." };
        }

        if (this.campaign.processTerminated) {
            return { success: false, reason: "The malicious process has already been terminated." };
        }

        if (pid === undefined || pid === null) {
            return { success: false, reason: "Select a process in Process Tree before terminating." };
        }

        const process = this.campaign.processes.find(p => p.pid === pid);

        if (!process) {
            return { success: false, reason: "Selected process was not found on the affected host." };
        }

        if (!process.suspicious) {

            this.campaign.terminationMistakes = (this.campaign.terminationMistakes || 0) + 1;

            this.audit(
                "PROCESS_TERMINATION_FAILED",
                `Attempted to terminate ${process.processName} (PID ${process.pid}) — confirmed NOT malicious. No effect; encryption continues.`
            );

            this.notify();

            return {
                success: false,
                reason: `${process.processName} (PID ${process.pid}) is not malicious. Termination had no effect — encryption continues.`
            };
        }

        this.campaign.processTerminated = true;
        this.campaign.encryptionStoppedAt = this.campaign.encryptionStoppedAt || Date.now();

        const host = this.getAffectedHostLive();
        if (host) host.processTerminated = true;

        this.campaign.processes.forEach(candidate => {
            if (candidate.suspicious) candidate.status = "TERMINATED";
        });

        this.audit("PROCESS_TERMINATED", `${process.processName} (PID ${process.pid}) was terminated on the affected host.`);

        if (STAGE_INDEX[this.campaign.stage] < STAGE_INDEX.CONTAINMENT) {
            this.setStage("CONTAINMENT");
        }

        this.notify();

        return {
            success: true,
            message: `${process.processName} (PID ${process.pid}) terminated — encryption stopped.`
        };
    }

    blockC2() {

        if (!this.campaign || this.campaign.c2Blocked) return { success: false };

        NETWORK.firewall.blockedIPs = NETWORK.firewall.blockedIPs || [];
        NETWORK.firewall.blockedDomains = NETWORK.firewall.blockedDomains || [];

        if (!NETWORK.firewall.blockedIPs.includes(this.campaign.actor.ip)) {
            NETWORK.firewall.blockedIPs.push(this.campaign.actor.ip);
        }

        if (!NETWORK.firewall.blockedDomains.includes(this.campaign.c2Domain)) {
            NETWORK.firewall.blockedDomains.push(this.campaign.c2Domain);
        }

        this.campaign.c2Blocked = true;

        this.audit("C2_BLOCKED", `${this.campaign.c2Domain} (${this.campaign.actor.ip}) was blocked at the firewall.`);

        this.notify();

        return { success: true };
    }

    quarantinePayload() {

        if (!this.campaign) return { success: false };

        this.campaign.payloadQuarantined = true;

        this.audit("PAYLOAD_QUARANTINED", "svchost32.exe was quarantined on the affected host.");

        this.notify();

        return { success: true };
    }

    /**
     * Eradication is a distinct, explicit step gated on
     * containment (spec section 52) — quarantining the payload
     * and confirming no persistence indicator remains.
     */
    eradicateMalware() {

        if (!this.campaign) return { success: false, reason: "No active campaign." };

        if (!this.campaign.hostIsolated || !this.campaign.processTerminated) {
            return { success: false, reason: "Isolate the host and terminate the process first." };
        }

        this.campaign.malwareEradicated = true;

        if (this.encryptionTimer) {
            clearTimeout(this.encryptionTimer);
            this.encryptionTimer = null;
        }

        this.audit("MALWARE_ERADICATED", "Persistence mechanism removed and payload confirmed absent.");

        if (STAGE_INDEX[this.campaign.stage] < STAGE_INDEX.ERADICATION) {
            this.setStage("ERADICATION");
        }

        this.notify();

        return { success: true };
    }

    validateBackup() {

        if (!this.campaign || this.campaign.backupValidated) return { success: false };

        this.campaign.backupValidated = true;
        this.campaign.backupValidatedAt = Date.now();

        this.audit("BACKUP_VALIDATED", `${this.campaign.backupHostname} backup validated — recovery point confirmed healthy.`);

        this.notify();

        return { success: true };
    }

    beginRecovery() {

        if (!this.campaign) return { success: false, reason: "No active campaign." };

        if (!this.campaign.malwareEradicated) {
            return { success: false, reason: "Eradicate the malware before starting recovery." };
        }

        if (!this.campaign.backupValidated) {
            return { success: false, reason: "Validate the backup before starting recovery." };
        }

        this.campaign.recoveryStartedAt = Date.now();
        this.campaign.recoveryStatus = "RESTORING";

        this.setStage("RECOVERY");

        this.audit("RECOVERY_STARTED", "File restoration from validated backup began.");

        this.runRecoveryProgress();

        this.notify();

        return { success: true };
    }

    runRecoveryProgress() {

        if (!this.running) return;

        const target = this.campaign.files.find(
            file => file.status === FILE_STATUS.ENCRYPTED
        );

        if (!target) {

            this.campaign.recoveryStatus = "VERIFICATION";
            this.notify();

            this.after([2000, 3500], () => this.finishRecovery());

            return;
        }

        target.status = FILE_STATUS.RECOVERING;
        this.notify();

        this.after([250, 500], () => {

            target.status = FILE_STATUS.RECOVERED;
            this.notify();

            this.after([120, 260], () => this.runRecoveryProgress());
        });
    }

    finishRecovery() {

        this.campaign.recoveryStatus = "RECOVERED";
        this.campaign.recoveredAt = Date.now();

        this.audit("FILES_RESTORED", `${this.campaign.filesEncryptedCount} files restored from backup.`);

        this.notify();
    }

    /**
     * Final validation checklist (spec section 53) before the
     * host can return to service.
     */
    getHostHealthChecklist() {

        return [
            { label: "Malware process absent", passed: !!this.campaign?.processTerminated },
            { label: "C2 connection absent", passed: !!this.campaign?.c2Blocked },
            { label: "File integrity restored", passed: this.campaign?.recoveryStatus === "RECOVERED" },
            { label: "User account restored", passed: this.campaign?.userAccountRestored !== false },
            { label: "Endpoint communications normal", passed: !!this.campaign?.hostIsolated === false ? false : !!this.campaign?.malwareEradicated }
        ];
    }

    returnHostToService() {

        if (!this.campaign) return { success: false, reason: "No active campaign." };

        const checklist = this.getHostHealthChecklist();

        if (checklist.some(item => !item.passed)) {
            return { success: false, reason: "Host health validation has not passed yet.", checklist };
        }

        const host = this.getAffectedHostLive();

        if (host) {
            host.isolated = false;
            host.processTerminated = false;
            host.compromised = false;
        }

        this.campaign.userAccountRestored = true;

        this.audit("HOST_RESTORED", `${this.campaign.affectedHostname} was validated and returned to service.`);

        this.resolve();

        return { success: true };
    }

    resolve() {

        this.campaign.resolvedAt = Date.now();
        this.setStage("RESOLVED");

        this.notify(RANSOMWARE_EVENTS.RESOLVED, { campaign: this.campaign });

        window.dispatchEvent(
            new CustomEvent("northstar:game-complete", { detail: { operation: "ransomware" } })
        );
    }


    /* =====================================================
       DERIVED / READ ACCESS
       ===================================================== */

    getAffectedHostLive() {
        return HOSTS.find(host => host.hostname === this.campaign?.affectedHostname) || null;
    }

    getAffectedUserLive() {
        return USERS.find(user => user.username === this.campaign?.affectedUsername) || null;
    }

    getSecondaryHostLive() {
        return HOSTS.find(host => host.hostname === this.campaign?.secondaryHostname) || null;
    }

    getCampaign() {
        return this.campaign;
    }

    getSeverity() {
        return this.campaign ? deriveSeverity(this.campaign) : "NORMAL";
    }

    getFilesRemaining() {
        return this.campaign ? filesRemaining(this.campaign) : 0;
    }

    getEncryptionRate() {
        return this.campaign ? encryptionRateFilesPerSecond(this.campaign) : 0;
    }

    getElapsed() {
        return this.campaign ? elapsedFormatted(this.campaign) : "00:00";
    }

    getObjectives() {

        if (!this.campaign) return [];

        const c = this.campaign;

        const done = {
            "identify-host": this.evidence.hasCollected("HOST", c.affectedHostId),
            "identify-process": this.evidence.hasCollected("PROCESS", "blackfrost-sim"),
            "identify-timeline": this.evidence.count() >= 3,
            "identify-c2": this.evidence.hasCollected("C2", c.c2Domain),
            "isolate-host": !!c.hostIsolated,
            "terminate-process": !!c.processTerminated,
            "block-c2": !!c.c2Blocked,
            "validate-backup": !!c.backupValidated,
            "restore-files": c.recoveryStatus === "RECOVERED",
            "return-to-service": c.stage === "RESOLVED"
        };

        return OBJECTIVE_DEFINITIONS.map(objective => ({
            ...objective,
            done: !!done[objective.id]
        }));
    }

    getMitreMapping() {
        return MITRE_MAPPING;
    }

    /**
     * Post-incident report + performance rating, computed
     * entirely from the campaign's own timestamps/counters —
     * no dependency on any external grading service.
     */
    getPerformanceReport() {

        const c = this.campaign;

        if (!c) return null;

        const detectionSeconds = c.detectedAt ? Math.round((c.detectedAt - c.startedAt) / 1000) : null;
        const containmentSeconds = c.hostIsolated && c.detectedAt
            ? Math.round((c.stageEnteredAt - c.startedAt) / 1000)
            : null;

        const objectives = this.getObjectives();
        const objectivesDone = objectives.filter(o => o.done).length;

        let points = 0;
        points += c.detectedAt ? 20 : 0;
        points += c.hostIsolated ? 15 : 0;
        points += c.processTerminated ? 15 : 0;
        points += c.c2Blocked ? 10 : 0;
        points += c.malwareEradicated ? 10 : 0;
        points += c.recoveryStatus === "RECOVERED" ? 15 : 0;
        points += Math.max(0, 15 - c.filesEncryptedCount);
        points -= Math.min(15, (c.terminationMistakes || 0) * 5);
        points = Math.max(0, points);

        let rating;
        if (points >= 85) rating = "A — EXCELLENT";
        else if (points >= 65) rating = "B — SOLID";
        else if (points >= 45) rating = "C — ADEQUATE";
        else rating = "D — NEEDS IMPROVEMENT";

        return {
            incidentId: c.id,
            family: c.family,
            outcomeBand: deriveOutcomeBand(c),
            detectionSeconds,
            containmentSeconds,
            filesTargeted: c.filesTargetedCount,
            filesEncrypted: c.filesEncryptedCount,
            filesRecovered: c.files.filter(f => f.status === FILE_STATUS.RECOVERED).length,
            hostsAffected: c.secondaryHostAffected ? 2 : 1,
            hostsContained: c.hostIsolated ? 1 : 0,
            c2Blocked: c.c2Blocked,
            hostIsolated: c.hostIsolated,
            recoverySuccessful: c.recoveryStatus === "RECOVERED",
            evidenceCollected: this.evidence.count(),
            objectivesCompleted: objectivesDone,
            objectivesTotal: objectives.length,
            terminationMistakes: c.terminationMistakes || 0,
            score: points,
            rating
        };
    }
}
