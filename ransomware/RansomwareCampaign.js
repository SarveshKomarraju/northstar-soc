/* =========================================================
   NORTHSTAR SOC — RANSOMWARE CAMPAIGN STATE MODEL
   File: ransomware/RansomwareCampaign.js

   The reusable "IncidentState" piece the spec asks for —
   a plain data model + pure derivation helpers, with no
   timers and no DOM. RansomwareEngine.js owns the actual
   ticking/driving; this file owns the SHAPE of the incident
   so it can be reused by a future Worm campaign.
   ========================================================= */

import {
    RANSOMWARE_FAMILY,
    RANSOMWARE_CAMPAIGN_ID,
    BLACKFROST_ACTOR,
    C2_DOMAIN,
    C2_RELAY_DOMAIN,
    getAffectedHost,
    getAffectedUser,
    getBackupHost,
    TARGET_FILES,
    RANSOM_NOTE_FILENAME
} from "./data/ransomwareConfig.js";

/*
 * Explicit stage order per the spec's suggested state
 * machine. Exported as an array (order matters for
 * "have we passed stage X" comparisons) and as a Set for
 * O(1) membership checks.
 */
export const STAGES = [
    "IDLE",
    "INITIAL_ACCESS",
    "EXECUTION",
    "PERSISTENCE",
    "DISCOVERY",
    "FILE_TARGETING",
    "ENCRYPTION",
    "RANSOM_NOTE",
    "C2_COMMUNICATION",
    "IMPACT",
    "DETECTED",
    "CONTAINMENT",
    "ERADICATION",
    "RECOVERY",
    "RESOLVED"
];

export const STAGE_INDEX =
    Object.fromEntries(STAGES.map((stage, index) => [stage, index]));

export function stageAtOrAfter(campaign, stage) {
    return STAGE_INDEX[campaign.stage] >= STAGE_INDEX[stage];
}

/*
 * FILE_STATUS per spec section 11.
 */
export const FILE_STATUS = {
    NORMAL: "NORMAL",
    TARGETED: "TARGETED",
    ENCRYPTING: "ENCRYPTING",
    ENCRYPTED: "ENCRYPTED",
    RECOVERING: "RECOVERING",
    RECOVERED: "RECOVERED"
};

/*
 * Restrained severity ladder per spec section 50 — never
 * "everything is red."
 */
export const SEVERITY_LEVELS = [
    "NORMAL",
    "MONITORING",
    "SUSPICIOUS",
    "HIGH",
    "CRITICAL",
    "CONTAINED",
    "RECOVERING",
    "RESOLVED"
];

let campaignCounter = 0;

/**
 * Builds a brand-new campaign in the IDLE state. Nothing is
 * emitted to EventEngine here — RansomwareEngine.start()
 * does that as it advances the state machine.
 */
export function createCampaign() {

    campaignCounter += 1;

    const host = getAffectedHost();
    const user = getAffectedUser();
    const backupHost = getBackupHost();

    const now = Date.now();

    return {

        /*
         * Unique per run (not just per session) — DetectionEngine,
         * PacketEngine, AlertManager and EvidenceStore all key
         * purely off attackId, so a restarted campaign that reused
         * the exact same id would inherit stale alerts/detections/
         * evidence from the previous attempt. The very first
         * campaign keeps the clean, documented id; every restart
         * after that gets an "-R2", "-R3", ... suffix.
         */
        id: campaignCounter === 1
            ? RANSOMWARE_CAMPAIGN_ID
            : `${RANSOMWARE_CAMPAIGN_ID}-R${campaignCounter}`,
        family: RANSOMWARE_FAMILY,

        actor: {
            name: BLACKFROST_ACTOR.name,
            ip: BLACKFROST_ACTOR.ip,
            country: BLACKFROST_ACTOR.country
        },

        c2Domain: C2_DOMAIN,
        c2RelayDomain: C2_RELAY_DOMAIN,
        c2Blocked: false,
        c2RelayBlocked: false,

        affectedHostId: host?.id || null,
        affectedHostname: host?.hostname || null,
        affectedUsername: user?.username || null,

        backupHostId: backupHost?.id || null,
        backupHostname: backupHost?.hostname || null,
        backupValidated: false,
        backupValidatedAt: null,

        stage: "IDLE",
        previousStage: null,
        stageEnteredAt: now,

        startedAt: now,
        detectedAt: null,
        containedAt: null,
        eradicatedAt: null,
        encryptionStartedAt: null,
        encryptionStoppedAt: null,
        recoveryStartedAt: null,
        recoveredAt: null,
        resolvedAt: null,

        /*
         * Ground truth for containment/eradication actions.
         * Endpoints/EndpointStore already mutates the real
         * HOSTS entry (host.isolated / host.processTerminated)
         * — these mirror that state onto the campaign so
         * IncidentResponse doesn't need to re-derive it from
         * three different stores every render.
         */
        hostIsolated: false,
        processTerminated: false,
        malwareEradicated: false,

        /*
         * Counts each time "Terminate Process" was used against
         * a process that was NOT ground-truth-malicious — a real
         * cost for acting on the wrong Process Tree selection
         * (see RansomwareEngine.terminateProcess()).
         */
        terminationMistakes: 0,

        recoveryStatus: "NOT_STARTED",

        /*
         * Full manifest, each with a live status. Encryption
         * order is randomized once at creation so a restart
         * doesn't always hit the same files first.
         */
        files: shuffle(
            TARGET_FILES.map((file, index) => ({
                id: `bf-file-${index}`,
                name: file.name,
                folder: file.folder,
                size: file.size,
                status: FILE_STATUS.NORMAL
            }))
        ),

        ransomNoteFilename: RANSOM_NOTE_FILENAME,
        ransomNoteCreated: false,

        filesTargetedCount: 0,
        filesEncryptedCount: 0,

        /*
         * Secondary escalation target if the analyst is very
         * slow to respond — kept small per spec section 78.
         */
        secondaryHostname: "FILE-SERVER-01",
        secondaryHostAffected: false,

        /*
         * Response action log — every analyst action gets an
         * audit entry (spec section 51).
         */
        auditLog: [],

        /*
         * PID counter for the synthetic process chain — used
         * by Process Tree.
         */
        processes: [],

        score: 0,
        scoreLog: []
    };
}

function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

/**
 * Derives the incident's current severity from real campaign
 * state rather than a static label — mirrors the discipline
 * EndpointStore/FileExplorerStore use for risk derivation.
 */
export function deriveSeverity(campaign) {

    if (campaign.stage === "RESOLVED") return "RESOLVED";
    if (campaign.recoveryStatus === "RESTORING" || campaign.recoveryStatus === "VERIFICATION") return "RECOVERING";
    if (campaign.hostIsolated && campaign.processTerminated) return "CONTAINED";

    if (stageAtOrAfter(campaign, "DETECTED")) {
        if (campaign.ransomNoteCreated && campaign.c2Blocked === false && !campaign.hostIsolated) {
            return "CRITICAL";
        }
        return "CRITICAL";
    }

    if (stageAtOrAfter(campaign, "ENCRYPTION")) return "HIGH";
    if (stageAtOrAfter(campaign, "DISCOVERY")) return "SUSPICIOUS";
    if (stageAtOrAfter(campaign, "INITIAL_ACCESS")) return "MONITORING";

    return "NORMAL";
}

export function filesRemaining(campaign) {
    return campaign.files.filter(
        file => file.status !== FILE_STATUS.ENCRYPTED &&
            file.status !== FILE_STATUS.RECOVERED &&
            file.status !== FILE_STATUS.RECOVERING
    ).length;
}

export function encryptionRateFilesPerSecond(campaign) {

    if (!campaign.encryptionStartedAt) return 0;

    const stoppedAt = campaign.encryptionStoppedAt || Date.now();
    const elapsedSeconds = Math.max(1, (stoppedAt - campaign.encryptionStartedAt) / 1000);

    return Number((campaign.filesEncryptedCount / elapsedSeconds).toFixed(2));
}

export function elapsedFormatted(campaign, fromKey = "startedAt", toValue = null) {

    const start = campaign[fromKey] || campaign.startedAt;
    const end = toValue || Date.now();

    const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Outcome band used by the post-incident report (spec
 * sections 34/67). Purely a function of how quickly
 * detection/containment happened relative to encryption
 * progress — never a hidden dice roll the player couldn't
 * have influenced.
 */
export function deriveOutcomeBand(campaign) {

    const encryptedAtDetection =
        campaign.filesEncryptedAtDetection ?? campaign.filesEncryptedCount;

    if (encryptedAtDetection <= 5) return "EARLY";
    if (encryptedAtDetection <= 20) return "MID";
    return "LATE";
}
