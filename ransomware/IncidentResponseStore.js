/* =========================================================
   NORTHSTAR SOC — INCIDENT RESPONSE STORE
   File: ransomware/IncidentResponseStore.js

   Thin, mostly-derived wrapper around window.ransomwareEngine
   (the real ground truth — same pattern EndpointStore uses
   for window.eventEngine/window.alertManager). This store
   owns UI-only state (active tab, transient action feedback,
   evidence-collect helpers); every substantive number comes
   straight from the engine so nothing here can drift out of
   sync with what actually happened in the simulation.

   Anti-giveaway note: attribution (actor name, family name)
   is withheld from renderIfKnown() checks until the campaign
   has actually been detected (campaign.detectedAt set by the
   real "RANSOMWARE ACTIVITY CONFIRMED" correlation in
   DetectionEngine) — same discipline EndpointStore/Files use
   elsewhere. Host name, severity, elapsed time and file counts
   are NOT attribution — an analyst legitimately sees those
   from Endpoints/Files/SIEM regardless, so they're shown from
   the start.
   ========================================================= */

export const INCIDENT_RESPONSE_EVENTS = {
    STATE_CHANGED: "incident:state-changed"
};

const TABS = ["OVERVIEW", "TIMELINE", "ACTIONS", "RECOVERY", "OBJECTIVES", "EVIDENCE", "MITRE", "REPORT"];

export class IncidentResponseStore {

    constructor() {

        this.state = {
            activeTab: "OVERVIEW",
            actionFeedback: null
        };

        this.listeners = new Set();
        this.engineUnsubscribe = null;
        this.connectRetryTimer = null;

        this.connectEngine();
    }


    /* =====================================================
       SUBSCRIPTIONS
       ===================================================== */

    subscribe(listener) {

        if (typeof listener !== "function") {
            return () => { };
        }

        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    }

    notify(eventName = INCIDENT_RESPONSE_EVENTS.STATE_CHANGED, payload = {}) {

        this.listeners.forEach(listener => {
            try { listener({ type: eventName, payload }); }
            catch (error) { console.error("[INCIDENT RESPONSE STORE] Listener error:", error); }
        });
    }


    /* =====================================================
       ENGINE CONNECTION
       ===================================================== */

    connectEngine() {

        const engine = window.ransomwareEngine;

        if (engine && typeof engine.subscribe === "function" && !this.engineUnsubscribe) {

            this.engineUnsubscribe = engine.subscribe(() => this.notify());

            if (this.connectRetryTimer) {
                clearInterval(this.connectRetryTimer);
                this.connectRetryTimer = null;
            }

            this.notify();
            return;
        }

        if (!this.connectRetryTimer) {
            this.connectRetryTimer = setInterval(() => this.connectEngine(), 500);
        }
    }

    destroy() {

        if (this.engineUnsubscribe) {
            this.engineUnsubscribe();
            this.engineUnsubscribe = null;
        }

        if (this.connectRetryTimer) {
            clearInterval(this.connectRetryTimer);
            this.connectRetryTimer = null;
        }
    }

    getEngine() {
        return window.ransomwareEngine || null;
    }

    getCampaign() {
        return this.getEngine()?.getCampaign() || null;
    }

    hasActiveIncident() {
        return !!this.getCampaign();
    }


    /* =====================================================
       DERIVED READ ACCESS (all delegate to the engine —
       nothing duplicated/re-derived here)
       ===================================================== */

    getSeverity() {
        return this.getEngine()?.getSeverity() || "NORMAL";
    }

    getFilesRemaining() {
        return this.getEngine()?.getFilesRemaining() || 0;
    }

    getEncryptionRate() {
        return this.getEngine()?.getEncryptionRate() || 0;
    }

    getElapsed() {
        return this.getEngine()?.getElapsed() || "00:00";
    }

    getObjectives() {
        return this.getEngine()?.getObjectives() || [];
    }

    getMitreMapping() {
        return this.getEngine()?.getMitreMapping() || [];
    }

    getPerformanceReport() {
        return this.getEngine()?.getPerformanceReport() || null;
    }

    getHostHealthChecklist() {
        return this.getEngine()?.getHostHealthChecklist() || [];
    }

    getAuditLog() {
        return this.getCampaign()?.auditLog || [];
    }

    getEvidence() {
        return this.getEngine()?.evidence?.getAll() || [];
    }

    /**
     * Attribution — actor identity / family name — is only
     * considered "known" to the analyst once the campaign has
     * actually been detected. Nothing UI-facing should print
     * campaign.actor.name / campaign.family before this is true.
     */
    isAttributionKnown() {
        return !!this.getCampaign()?.detectedAt;
    }


    /* =====================================================
       LIVE ENGINE ACCESS (SIEM / ALERTS)
       ===================================================== */

    getAllEvents() {
        const engine = window.eventEngine;
        return (engine && typeof engine.getAllEvents === "function") ? engine.getAllEvents() : [];
    }

    getAllAlerts() {
        const manager = window.alertManager;
        return (manager && typeof manager.getAllAlerts === "function") ? manager.getAllAlerts() : [];
    }

    getTimeline() {

        const campaign = this.getCampaign();

        if (!campaign) return [];

        return this.getAllEvents()
            .filter(event => event.attackId === campaign.id)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    getRelatedAlerts() {

        const timelineIds = new Set(this.getTimeline().map(event => event.id));

        if (!timelineIds.size) return [];

        return this.getAllAlerts().filter(alert =>
            timelineIds.has(alert.sourceEvent?.id) ||
            (Array.isArray(alert.eventIds) && alert.eventIds.some(id => timelineIds.has(id)))
        );
    }


    /* =====================================================
       EVIDENCE COLLECTION
       ---------------------------------------------------
       Every collected item references a real object already
       present in the simulation (spec section 43) — nothing
       here invents new data.
       ===================================================== */

    collectHostEvidence() {

        const campaign = this.getCampaign();
        const engine = this.getEngine();

        if (!campaign || !engine) return null;

        return engine.evidence.collect({
            kind: "HOST_TIMELINE",
            label: `Compromised host: ${campaign.affectedHostname}`,
            refType: "HOST",
            refId: campaign.affectedHostId,
            description: `${campaign.affectedHostname} identified as the initial point of compromise.`
        });
    }

    collectProcessEvidence() {

        const campaign = this.getCampaign();
        const engine = this.getEngine();

        if (!campaign || !engine) return null;

        const process = campaign.processes.find(p => p.processName === "svchost32.exe");

        if (!process) return null;

        return engine.evidence.collect({
            kind: "PROCESS",
            label: `Malicious process: ${process.processName} (PID ${process.pid})`,
            refType: "PROCESS",
            refId: "blackfrost-sim",
            description: `${process.processName} (PID ${process.pid}) launched by ${process.parentProcessName}: ${process.commandLine}`
        });
    }

    collectC2Evidence() {

        const campaign = this.getCampaign();
        const engine = this.getEngine();

        if (!campaign || !engine || !campaign.c2Domain) return null;

        if (this.getTimeline().every(event => event.eventType !== "C2_CONNECTION")) {
            return null;
        }

        return engine.evidence.collect({
            kind: "C2_CONNECTION",
            label: `C2 infrastructure: ${campaign.c2Domain}`,
            refType: "C2",
            refId: campaign.c2Domain,
            description: `Outbound connection observed from ${campaign.affectedHostname} to ${campaign.c2Domain} (${campaign.actor.ip}).`
        });
    }

    collectRansomNoteEvidence() {

        const campaign = this.getCampaign();
        const engine = this.getEngine();

        if (!campaign || !engine || !campaign.ransomNoteCreated) return null;

        return engine.evidence.collect({
            kind: "RANSOM_NOTE",
            label: campaign.ransomNoteFilename,
            refType: "FILE",
            refId: campaign.ransomNoteFilename,
            description: `Ransom note ${campaign.ransomNoteFilename} dropped in the Documents folder of ${campaign.affectedHostname}.`
        });
    }

    collectFileListEvidence() {

        const campaign = this.getCampaign();
        const engine = this.getEngine();

        if (!campaign || !engine || !campaign.filesEncryptedCount) return null;

        return engine.evidence.collect({
            kind: "FILE_LIST",
            label: `${campaign.filesEncryptedCount} encrypted files`,
            refType: "FILE_LIST",
            refId: `${campaign.id}-files`,
            description: `${campaign.filesEncryptedCount} of ${campaign.files.length} files were encrypted on ${campaign.affectedHostname} before response.`
        });
    }


    /* =====================================================
       RESPONSE ACTIONS
       ---------------------------------------------------
       All delegate to the engine, which owns every real
       consequence. This store only records the transient
       banner feedback shown in the ACTIONS/RECOVERY tabs.
       ===================================================== */

    runAction(actionName, ...args) {

        const engine = this.getEngine();

        if (!engine || typeof engine[actionName] !== "function") {
            this.state.actionFeedback = { type: "error", message: "No active incident to act on." };
            this.notify();
            return { success: false };
        }

        const result = engine[actionName](...args) || { success: false };

        this.state.actionFeedback = result.success
            ? { type: "success", message: result.message || this.describeActionSuccess(actionName) }
            : { type: "error", message: result.reason || "That action isn't available right now." };

        this.notify();

        return result;
    }

    describeActionSuccess(actionName) {

        const labels = {
            isolateHost: "Host isolated from the network.",
            terminateProcess: "Malicious process terminated.",
            blockC2: "C2 infrastructure blocked at the firewall.",
            quarantinePayload: "Payload quarantined on the affected host.",
            eradicateMalware: "Malware eradicated — persistence mechanism removed.",
            validateBackup: "Backup validated — recovery point confirmed healthy.",
            beginRecovery: "File restoration from backup started.",
            returnHostToService: "Host validated and returned to service."
        };

        return labels[actionName] || "Action completed.";
    }

    isolateHost() { return this.runAction("isolateHost"); }

    /**
     * Containment/investigation link-up: acts on whatever
     * process the analyst has selected in Process Tree
     * (window.processTreeStore), not a hardcoded global target.
     * No selection, or a selection on a different host, fails
     * with clear feedback rather than silently doing nothing —
     * the engine itself decides success/failure once it has a
     * real PID to check against ground truth.
     */
    terminateProcess() {

        const campaign = this.getCampaign();
        const selected = window.processTreeStore?.getSelectedProcess?.() || null;

        if (!selected) {
            this.state.actionFeedback = {
                type: "error",
                message: "Select a process in Process Tree before terminating."
            };
            this.notify();
            return { success: false };
        }

        if (!campaign || selected.hostname !== campaign.affectedHostname) {
            this.state.actionFeedback = {
                type: "error",
                message: "The selected process is not on the affected host."
            };
            this.notify();
            return { success: false };
        }

        return this.runAction("terminateProcess", selected.pid);
    }

    blockC2() { return this.runAction("blockC2"); }
    quarantinePayload() { return this.runAction("quarantinePayload"); }
    eradicateMalware() { return this.runAction("eradicateMalware"); }
    validateBackup() { return this.runAction("validateBackup"); }
    beginRecovery() { return this.runAction("beginRecovery"); }
    returnHostToService() { return this.runAction("returnHostToService"); }

    restartCampaign() {
        this.getEngine()?.restart();
        this.state.actionFeedback = null;
        this.notify();
    }

    clearFeedback() {
        this.state.actionFeedback = null;
        this.notify();
    }


    /* =====================================================
       UI STATE
       ===================================================== */

    setActiveTab(tab) {

        if (!TABS.includes(tab)) return;

        this.state.activeTab = tab;
        this.state.actionFeedback = null;
        this.notify();
    }
}
