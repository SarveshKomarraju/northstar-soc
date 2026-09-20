/* =========================================================
   SOC COMMAND CENTER
   DETECTION ENGINE
   ---------------------------------------------------------
   Converts EventEngine telemetry into correlated alerts.

   EventEngine
        ↓
   DetectionEngine
        ↓
   AlertManager

   Only security-relevant events create alerts.
   ========================================================= */

import { ATTACKERS } from "../engine/AttackEngine.js";

export class DetectionEngine {

    constructor(eventEngine, alertManager) {

        this.eventEngine = eventEngine;
        this.alertManager = alertManager;

        this.detections = new Map();

        /*
         * VPN cross-account correlation: which usernames have
         * connected (or tried to) from each external IP. This
         * is genuinely new — nothing else in the SIEM does
         * cross-user correlation, since every other rule looks
         * at one attack/user/host at a time.
         */
        this.vpnConnectionsByIP = new Map();

        /*
         * RANSOMWARE (BLACKFROST) behavior correlation: which
         * distinct signal types (malicious execution, mass file
         * modification, ransom note, C2 beacon) have been seen
         * for a given attackId. Escalates to a single CRITICAL
         * "RANSOMWARE ACTIVITY CONFIRMED" alert once 2+ signals
         * accumulate — never from any single trigger — and tells
         * RansomwareEngine the moment that happens so the
         * campaign's own detectedAt reflects the analyst's real
         * first confirmed detection (spec sections 20/33/67).
         */
        this.ransomwareSignalsByAttack = new Map();
        this.ransomwareConfirmedAttackIds = new Set();

        this.running = false;
        this.unsubscribe = null;

        console.log(
            "[DETECTION ENGINE] Ready."
        );
    }


    /* =====================================================
       START
       ===================================================== */

    start() {

        if (this.running) {

            console.log(
                "[DETECTION ENGINE] Already running."
            );

            return;
        }

        if (!this.eventEngine) {

            console.error(
                "[DETECTION ENGINE] EventEngine unavailable."
            );

            return;
        }

        if (!this.alertManager) {

            console.error(
                "[DETECTION ENGINE] AlertManager unavailable."
            );

            return;
        }

        if (
            typeof this.eventEngine.subscribe !==
            "function"
        ) {

            console.error(
                "[DETECTION ENGINE] EventEngine.subscribe() unavailable."
            );

            return;
        }

        this.running = true;


        /*
         * Subscribe BEFORE synchronizing existing events.
         */

        this.unsubscribe =
            this.eventEngine.subscribe(
                event => {

                    console.log(
                        "[DETECTION ENGINE] NEW EVENT:",
                        event.eventType,
                        event.id
                    );

                    this.processEvent(event);

                }
            );


        console.log(
            "[DETECTION ENGINE] ONLINE"
        );


        /*
         * Process events that already existed
         * before DetectionEngine started.
         */

        const existingEvents =
            typeof this.eventEngine.getAllEvents ===
                "function"

                ? this.eventEngine.getAllEvents()

                : [];


        console.log(
            `[DETECTION ENGINE] Synchronizing ${existingEvents.length} existing SIEM events...`
        );


        existingEvents.forEach(
            event => {

                this.processEvent(
                    event
                );

            }
        );


        console.log(
            "[DETECTION ENGINE] Event synchronization complete."
        );
    }


    /* =====================================================
       PROCESS EVENT
       ===================================================== */

    processEvent(event) {

        if (
            !this.running ||
            !event
        ) {

            return;
        }


        /* =================================================
           PHISHING EMAIL
           ================================================= */

        if (
            event.eventType ===
            "PHISHING_EMAIL_SENT"
        ) {

            this.createDetection(
                event,
                {
                    rule:
                        "PHISHING-CAMPAIGN",

                    title:
                        "Targeted Phishing Campaign Detected",

                    description:
                        "A targeted phishing email was delivered as part of a simulated attack campaign.",

                    severity:
                        "HIGH"
                }
            );

            return;
        }


        /* =================================================
           SUSPICIOUS LINK
           ================================================= */

        if (
            event.eventType ===
            "SUSPICIOUS_LINK"
        ) {

            this.createDetection(
                event,
                {
                    rule:
                        "PHISHING-SUSPICIOUS-LINK",

                    title:
                        "Suspicious Phishing Link Detected",

                    description:
                        "A suspicious link was detected during the simulated attack.",

                    severity:
                        "HIGH"
                }
            );

            return;
        }


        /* =================================================
           SUSPICIOUS PROCESS
           ================================================= */

        if (
            event.eventType ===
            "PROCESS_START"
        ) {

            if (
                event.severity === "HIGH" ||
                event.severity === "CRITICAL"
            ) {

                this.createDetection(
                    event,
                    {
                        rule:
                            "SUSPICIOUS-PROCESS",

                        title:
                            "Suspicious Process Execution",

                        description:
                            "High-risk process activity was detected on an endpoint.",

                        severity:
                            "HIGH"
                    }
                );

            }

            return;
        }


        /* =================================================
           SUSPICIOUS FILE DROPPED
           ================================================= */

        if (
            event.eventType ===
            "FILE_DROPPED"
        ) {

            this.createDetection(
                event,
                {
                    rule:
                        "SUSPICIOUS-FILE-DROPPED",

                    title:
                        "Suspicious File Dropped",

                    description:
                        "A file was written to disk as part of simulated post-compromise activity.",

                    severity:
                        "HIGH"
                }
            );

            return;
        }


        /* =================================================
           CREDENTIAL COMPROMISE
           ================================================= */

        if (
            event.eventType ===
            "AUTH_SUCCESS"
        ) {

            this.createDetection(
                event,
                {
                    rule:
                        "CREDENTIAL-COMPROMISE",

                    title:
                        "Potential Credential Compromise",

                    description:
                        "A successful authentication was associated with an active simulated attack.",

                    severity:
                        "CRITICAL"
                }
            );

            return;
        }


        /* =================================================
           FAILED AUTHENTICATION
           ================================================= */

        if (
            event.eventType ===
            "AUTH_FAILURE"
        ) {

            const failureCount =
                event.metadata &&
                    event.metadata.failureCount
                    ? Number(
                        event.metadata.failureCount
                    )
                    : 1;


            if (
                failureCount >= 2
            ) {

                this.createDetection(
                    event,
                    {
                        rule:
                            "AUTHENTICATION-FAILURE",

                        title:
                            "Repeated Authentication Failures",

                        description:
                            "Multiple failed authentication attempts were associated with the same simulated attack.",

                        severity:
                            failureCount >= 3
                                ? "HIGH"
                                : "MEDIUM"
                    }
                );

            }

            return;
        }


        /* =================================================
           VPN — REPEATED FAILED LOGINS
           (mirrors AUTHENTICATION-FAILURE above)
           ================================================= */

        if (
            event.eventType ===
            "VPN_LOGIN_FAILED"
        ) {

            const failureCount =
                event.metadata &&
                    event.metadata.failureCount
                    ? Number(
                        event.metadata.failureCount
                    )
                    : 1;

            if (
                failureCount >= 2
            ) {

                this.createDetection(
                    event,
                    {
                        rule:
                            "VPN-REPEATED-FAILURE",

                        title:
                            "Repeated Failed VPN Logins",

                        description:
                            "Multiple failed VPN authentication attempts were observed for the same account.",

                        severity:
                            failureCount >= 3
                                ? "HIGH"
                                : "MEDIUM"
                    }
                );

            }

            this.trackVpnSourceIP(event);

            return;
        }


        /* =================================================
           VPN — CONNECTION FROM KNOWN ATTACKER IP
           ================================================= */

        if (
            event.eventType ===
            "VPN_CONNECTED"
        ) {

            const isKnownAttackerIP =
                ATTACKERS.some(
                    attacker =>
                        attacker.ip === event.sourceIP
                );

            if (isKnownAttackerIP) {

                this.createDetection(
                    event,
                    {
                        rule:
                            "VPN-KNOWN-ATTACKER-IP",

                        title:
                            "VPN Connection From Known-Malicious IP",

                        description:
                            "A VPN session authenticated from an IP address associated with known threat actor infrastructure.",

                        severity:
                            "CRITICAL"
                    }
                );

            }

            this.trackVpnSourceIP(event);

            return;
        }


        /* =================================================
           VPN — DISCONNECT (no detection, just cleanup)
           ================================================= */

        if (
            event.eventType ===
            "VPN_DISCONNECTED"
        ) {

            return;
        }


        /* =================================================
           SUSPICIOUS LOGIN
           ================================================= */

        if (
            event.eventType ===
            "SUSPICIOUS_LOGIN"
        ) {

            this.createDetection(
                event,
                {
                    rule:
                        "ACCOUNT-COMPROMISE",

                    title:
                        "Suspicious Account Login",

                    description:
                        "A suspicious account login was detected.",

                    severity:
                        "HIGH"
                }
            );

            return;
        }


        /* =================================================
           SUSPICIOUS DNS
           ================================================= */

        if (
            event.eventType ===
            "DNS_QUERY" &&

            (
                event.severity === "HIGH" ||
                event.severity === "CRITICAL"
            )
        ) {

            this.createDetection(
                event,
                {
                    rule:
                        "SUSPICIOUS-DNS",

                    title:
                        "Suspicious DNS Activity",

                    description:
                        "Potentially malicious DNS activity was detected.",

                    severity:
                        "HIGH"
                }
            );

            return;
        }


        /* =================================================
           HOST DISCOVERY
           ================================================= */

        if (
            event.eventType ===
            "HOST_DISCOVERY"
        ) {

            this.createDetection(
                event,
                {
                    rule:
                        "INTERNAL-DISCOVERY",

                    title:
                        "Internal Host Discovery Detected",

                    description:
                        "Internal network discovery activity was detected.",

                    severity:
                        "MEDIUM"
                }
            );

            return;
        }


        /* =================================================
           LATERAL MOVEMENT
           ================================================= */

        if (
            event.eventType ===
            "LATERAL_MOVEMENT_ATTEMPT"
        ) {

            this.createDetection(
                event,
                {
                    rule:
                        "LATERAL-MOVEMENT",

                    title:
                        "Possible Lateral Movement",

                    description:
                        "A threat actor attempted to move between internal systems.",

                    severity:
                        "HIGH"
                }
            );

            return;
        }


        /* =================================================
           HOST COMPROMISE
           ================================================= */

        if (
            event.eventType ===
            "HOST_COMPROMISED"
        ) {

            this.createDetection(
                event,
                {
                    rule:
                        "HOST-COMPROMISE",

                    title:
                        "Host Compromise Detected",

                    description:
                        "A threat actor gained simulated access to another internal system.",

                    severity:
                        "CRITICAL"
                }
            );

            return;
        }


        /* =================================================
           SUSPICIOUS EXTERNAL NETWORK CONNECTION
           ================================================= */

        if (
            event.eventType ===
            "SUSPICIOUS_EXTERNAL_CONNECTION"
        ) {

            const reputation =
                event.metadata?.destinationReputation ||
                "UNKNOWN";

            const threatScore =
                Number(
                    event.metadata?.destinationThreatScore ||
                    0
                );


            /*
             * SUSPICIOUS
             * → HIGH
             */

            if (
                reputation === "SUSPICIOUS" ||
                (
                    threatScore >= 70 &&
                    threatScore < 90
                )
            ) {

                this.createDetection(
                    event,
                    {
                        rule:
                            "SUSPICIOUS-EXTERNAL-CONNECTION",

                        title:
                            "Suspicious External Connection",

                        description:
                            "An internal host communicated with a simulated external destination with a suspicious reputation.",

                        severity:
                            "HIGH"
                    }
                );

                return;
            }


            /*
             * MALICIOUS
             * → CRITICAL
             */

            if (
                reputation === "MALICIOUS" ||
                threatScore >= 90
            ) {

                this.createDetection(
                    event,
                    {
                        rule:
                            "MALICIOUS-EXTERNAL-CONNECTION",

                        title:
                            "Malicious External Connection Detected",

                        description:
                            "An internal host communicated with a simulated external destination associated with a critical threat score.",

                        severity:
                            "CRITICAL"
                    }
                );

                return;
            }


            return;
        }


        /* =================================================
           LEGACY EXTERNAL CONNECTION SUPPORT
           ================================================= */

        if (
            event.eventType ===
            "EXTERNAL_CONNECTION"
        ) {

            const reputation =
                event.metadata?.destinationReputation ||
                "UNKNOWN";

            const threatScore =
                Number(
                    event.metadata?.destinationThreatScore ||
                    0
                );


            if (
                reputation === "TRUSTED"
            ) {

                return;
            }


            if (
                reputation === "SUSPICIOUS" ||
                (
                    threatScore >= 70 &&
                    threatScore < 90
                )
            ) {

                this.createDetection(
                    event,
                    {
                        rule:
                            "SUSPICIOUS-EXTERNAL-CONNECTION",

                        title:
                            "Suspicious External Connection",

                        description:
                            "An internal host communicated with a simulated external destination with a suspicious reputation.",

                        severity:
                            "HIGH"
                    }
                );

                return;
            }


            if (
                reputation === "MALICIOUS" ||
                threatScore >= 90
            ) {

                this.createDetection(
                    event,
                    {
                        rule:
                            "MALICIOUS-EXTERNAL-CONNECTION",

                        title:
                            "Malicious External Connection Detected",

                        description:
                            "An internal host communicated with a simulated external destination associated with a critical threat score.",

                        severity:
                            "CRITICAL"
                    }
                );

                return;
            }

            return;
        }


        /* =================================================
           RANSOMWARE (BLACKFROST) — everything below is
           additive: new event types only RansomwareEngine.js
           emits. Deliberately obscured first alert (spec 65) —
           the macro-execution signal below reads as generic
           malware, not "ransomware," and the CRITICAL
           correlation only fires once multiple signals agree.
           ================================================= */

        if (event.eventType === "SUSPICIOUS_ATTACHMENT_OPENED") {

            this.createDetection(event, {
                rule: "MACRO-DOCUMENT-EXECUTION",
                title: "Macro-Enabled Document Executed",
                description: "A user executed embedded content from a macro-enabled document attachment.",
                severity: "MEDIUM"
            });

            return;
        }

        if (event.eventType === "CHILD_PROCESS_CREATED" || event.eventType === "PAYLOAD_EXECUTION") {

            if (event.severity === "HIGH" || event.severity === "CRITICAL") {

                this.createDetection(event, {
                    rule: "SUSPICIOUS-CHILD-PROCESS",
                    title: "Suspicious Child Process Execution",
                    description: "A process spawned an unexpected child process consistent with malicious script execution.",
                    severity: "HIGH"
                });

                if (event.eventType === "PAYLOAD_EXECUTION") {
                    this.trackRansomwareSignal(event, "execution");
                }
            }

            return;
        }

        if (event.eventType === "PERSISTENCE_ESTABLISHED") {

            this.createDetection(event, {
                rule: "PERSISTENCE-MECHANISM",
                title: "Persistence Mechanism Established",
                description: "A scheduled task (or equivalent mechanism) was created to relaunch a process after reboot.",
                severity: "HIGH"
            });

            this.trackRansomwareSignal(event, "execution");

            return;
        }

        if (event.eventType === "PROCESS_DISCOVERY") {

            this.createDetection(event, {
                rule: "PROCESS-DISCOVERY",
                title: "Process & Security Tooling Discovery",
                description: "Enumeration of running processes and security tooling was observed on an endpoint.",
                severity: "MEDIUM"
            });

            return;
        }

        if (event.eventType === "FILE_DISCOVERY") {

            this.createDetection(event, {
                rule: "FILE-DISCOVERY-ACTIVITY",
                title: "Rapid File System Enumeration",
                description: "Rapid enumeration of a user's document folders was observed, consistent with pre-encryption file discovery.",
                severity: event.severity === "HIGH" ? "HIGH" : "MEDIUM"
            });

            return;
        }

        if (event.eventType === "FILE_ENCRYPTION_SIMULATED") {

            /*
             * Only the "activity began" event (HIGH) alerts —
             * the per-file INFO ticks that follow would otherwise
             * flood the alert queue with dozens of near-duplicate
             * alerts (spec: correlate, don't spam).
             */
            if (event.severity === "HIGH" || event.severity === "CRITICAL") {

                this.createDetection(event, {
                    rule: "FILE-ENCRYPTION-ACTIVITY",
                    title: "File Encryption Activity Detected",
                    description: "Simulated file encryption activity began on an endpoint.",
                    severity: "HIGH"
                });
            }

            return;
        }

        if (event.eventType === "MASS_FILE_MODIFICATION") {

            this.createDetection(event, {
                rule: "MASS-FILE-MODIFICATION",
                title: "Mass File Modification Detected",
                description: "A large number of files were modified on a single host in a short time window.",
                severity: "CRITICAL"
            });

            this.trackRansomwareSignal(event, "massFileMod");

            return;
        }

        if (event.eventType === "RANSOM_NOTE_CREATED") {

            this.createDetection(event, {
                rule: "RANSOM-NOTE-CREATED",
                title: "Ransom Note File Created",
                description: "A ransom note file was created in a user's document folder.",
                severity: "CRITICAL"
            });

            this.trackRansomwareSignal(event, "ransomNote");

            return;
        }

        if (event.eventType === "C2_CONNECTION") {

            this.createDetection(event, {
                rule: "C2-BEACON",
                title: "Outbound Connection To Suspected C2 Infrastructure",
                description: "An endpoint established an outbound connection to infrastructure associated with a known threat actor.",
                severity: "HIGH"
            });

            this.trackRansomwareSignal(event, "c2");

            return;
        }

        if (event.eventType === "HOST_IMPACTED") {

            this.createDetection(event, {
                rule: "HOST-IMPACT-CONFIRMED",
                title: "Host Confirmed Impacted",
                description: "An endpoint is confirmed impacted by destructive or encrypting malware activity.",
                severity: "CRITICAL"
            });

            return;
        }

        /*
         * The plausible false positive (spec 70/71): a burst of
         * ordinary backup-agent file activity. No attackId is
         * ever attached to this event (RansomwareEngine emits it
         * directly, bypassing its own attackId-tagging helper),
         * so it can never feed the correlation above — it can
         * only ever become its own, unrelated, low-severity lead
         * for the analyst to investigate and rule out.
         */
        if (event.eventType === "FILE_MODIFIED") {

            const fileCount = Number(event.metadata?.fileCount || 0);

            if (fileCount >= 5) {

                this.createDetection(event, {
                    rule: "SUSPECTED-MASS-FILE-MODIFICATION",
                    title: "Suspected Mass File Modification",
                    description: "A burst of file modifications was observed on a host. This may indicate ransomware activity or a legitimate scheduled process — verify the responsible process before acting.",
                    severity: "LOW"
                });
            }

            return;
        }

    }


    /* =====================================================
       RANSOMWARE (BLACKFROST) SIGNAL CORRELATION
       ===================================================== */

    /**
     * Escalates to one CRITICAL "RANSOMWARE ACTIVITY CONFIRMED"
     * alert once 2+ distinct signal types have been observed for
     * the same attackId — never from any single trigger. Also
     * tells the live RansomwareEngine the exact moment this
     * happens, so the campaign's own detectedAt/outcome band
     * reflect the analyst's actual first confirmed detection
     * rather than a guess (spec sections 20, 33, 67, 78).
     */
    trackRansomwareSignal(event, signalKey) {

        if (!event.attackId) {
            return;
        }

        if (!this.ransomwareSignalsByAttack.has(event.attackId)) {
            this.ransomwareSignalsByAttack.set(event.attackId, new Set());
        }

        const signals = this.ransomwareSignalsByAttack.get(event.attackId);

        signals.add(signalKey);

        if (signals.size < 2 || this.ransomwareConfirmedAttackIds.has(event.attackId)) {
            return;
        }

        this.ransomwareConfirmedAttackIds.add(event.attackId);

        this.createDetection(
            { ...event, severity: "CRITICAL" },
            {
                rule: "RANSOMWARE-ACTIVITY-CONFIRMED",
                title: "RANSOMWARE ACTIVITY CONFIRMED",
                description: `Multiple correlated indicators (${[...signals].join(", ")}) confirm active ransomware behavior on this host.`,
                severity: "CRITICAL"
            }
        );

        console.log(`[DETECTION ENGINE] RANSOMWARE ACTIVITY CONFIRMED → ${event.attackId}`);

        if (window.ransomwareEngine && typeof window.ransomwareEngine.markDetected === "function") {
            window.ransomwareEngine.markDetected();
        }
    }


    /* =====================================================
       CREATE / CORRELATE DETECTION
       ===================================================== */

    /**
     * Tracks which usernames have connected/attempted from
     * each external source IP. If 2+ DIFFERENT accounts show
     * up from the same IP, that's a strong signal of shared
     * or compromised attacker infrastructure — something no
     * single-host or single-attack view can ever detect,
     * since it only makes sense looking across everything at
     * once. This is the actual reason a standalone VPN app
     * earns its place instead of just being Endpoints' login
     * table under a different name.
     */
    trackVpnSourceIP(event) {

        if (!event.sourceIP || !event.username) {
            return;
        }

        if (!this.vpnConnectionsByIP.has(event.sourceIP)) {
            this.vpnConnectionsByIP.set(event.sourceIP, new Set());
        }

        const usernames =
            this.vpnConnectionsByIP.get(event.sourceIP);

        usernames.add(event.username);

        if (usernames.size >= 2) {

            /*
             * createDetection() lets the raw event's own
             * severity override the rule's suggested one
             * ("SIEM event severity is the source of truth") —
             * correct for most rules, but wrong here: this
             * alert is about the CORRELATION (multiple accounts,
             * one IP), not about whatever severity the single
             * triggering event happened to carry. Force it.
             */
            this.createDetection(
                { ...event, severity: "CRITICAL" },
                {
                    rule:
                        "VPN-MULTI-ACCOUNT-SAME-IP",

                    title:
                        "Multiple Accounts From Same External IP",

                    description:
                        `${usernames.size} different accounts (${[...usernames].join(", ")}) have connected or attempted to connect from the same external IP address — consistent with compromised or shared attacker infrastructure.`,

                    severity:
                        "CRITICAL"
                }
            );

        }
    }

    createDetection(
        event,
        detection
    ) {

        if (!this.alertManager) {

            console.error(
                "[DETECTION ENGINE] AlertManager unavailable."
            );

            return null;
        }


        const attackId =
            event.attackId ||
            `EVENT-${event.id}`;


        const correlationKey =
            `${attackId}:${detection.rule}`;


        /* =================================================
           EXISTING DETECTION
           ================================================= */

        if (
            this.detections.has(
                correlationKey
            )
        ) {

            const existing =
                this.detections.get(
                    correlationKey
                );


            if (
                event.id &&
                !existing.eventIds.includes(
                    event.id
                )
            ) {

                existing.eventIds.push(
                    event.id
                );

            }


            const alert =
                this.alertManager.getAlert(
                    existing.id
                );


            if (alert) {

                if (
                    event.id &&
                    !alert.eventIds.includes(
                        event.id
                    )
                ) {

                    alert.eventIds.push(
                        event.id
                    );

                }


                alert.lastSeen =
                    event.timestamp ||
                    alert.lastSeen;


                alert.eventCount =
                    alert.eventIds.length;


                alert.updatedAt =
                    new Date().toISOString();

            }


            console.log(
                `[DETECTION ENGINE] CORRELATED EVENT → ${existing.id}`
            );


            return existing;
        }


        /* =================================================
           CREATE NEW ALERT
           ================================================= */

        const alert =
            this.alertManager.createAlert({

                title:
                    detection.title,

                description:
                    detection.description,

                /*
                 * SIEM event severity is the source
                 * of truth.
                 */

                severity:
                    event.severity ||
                    detection.severity,

                attackId:
                    event.attackId ||
                    null,

                eventIds:
                    event.id
                        ? [event.id]
                        : [],

                sourceEvent:
                    event,

                firstSeen:
                    event.timestamp ||
                    new Date().toISOString(),

                lastSeen:
                    event.timestamp ||
                    new Date().toISOString(),

                eventCount:
                    1,

                detectionRule:
                    detection.rule

            });


        this.detections.set(
            correlationKey,
            alert
        );


        console.log(
            `[DETECTION ENGINE] NEW ALERT → ${alert.id}`
        );

        console.log(
            `[DETECTION ENGINE] SIEM EVENT → ${event.id}`
        );

        console.log(
            `[DETECTION ENGINE] RULE → ${detection.rule}`
        );


        return alert;
    }


    /* =====================================================
       GET ALL DETECTIONS
       ===================================================== */

    getAllDetections() {

        return Array.from(
            this.detections.values()
        );

    }


    /* =====================================================
       GET DETECTIONS FOR ATTACK
       ===================================================== */

    getDetectionsForAttack(
        attackId
    ) {

        return Array.from(
            this.detections.values()
        ).filter(
            detection =>
                detection.attackId ===
                attackId
        );

    }


    /* =====================================================
       CLEAR
       ===================================================== */

    clear() {

        this.detections.clear();

        console.log(
            "[DETECTION ENGINE] Detections cleared."
        );

    }


    /* =====================================================
       STOP
       ===================================================== */

    stop() {

        if (!this.running) {
            return;
        }


        this.running = false;


        if (this.unsubscribe) {

            this.unsubscribe();

            this.unsubscribe = null;

        }


        console.log(
            "[DETECTION ENGINE] STOPPED"
        );

    }


    /* =====================================================
       STATUS
       ===================================================== */

    getStatus() {

        return {

            running:
                this.running,

            detections:
                this.detections.size,

            subscribed:
                Boolean(
                    this.unsubscribe
                )

        };

    }

}


/* =========================================================
   MODULE LOADED
   ========================================================= */

console.log(
    "[DETECTION ENGINE] Module loaded."
);