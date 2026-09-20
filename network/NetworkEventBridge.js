// =========================================================
// NORTHSTAR SOC
// NETWORK EVENT BRIDGE
//
// Converts ONLY security-relevant simulated network
// activity into SIEM events.
//
// PacketEngine
//      ↓
// NetworkEventBridge
//      ↓
// SECURITY FILTER
//      ↓
// DEDUPLICATION
//      ↓
// EventEngine
//      ↓
// DetectionEngine
//      ↓
// AlertManager
//
// Normal packet traffic stays in the packet capture.
// Only suspicious / malicious activity enters the SIEM.
//
// IMPORTANT:
// PacketEngine intentionally hides reputation from the
// visible packet object.
//
// Security metadata is available through:
//
//      packet._security
//
// This bridge NEVER touches the real network.
// =========================================================


export class NetworkEventBridge {


    constructor(
        packetEngine,
        eventEngine
    ) {

        this.packetEngine =
            packetEngine;

        this.eventEngine =
            eventEngine;

        this.running =
            false;

        this.unsubscribe =
            null;


        // =================================================
        // EVENT DEDUPLICATION
        // =================================================

        /*
         * PacketEngine generates multiple packets per second.
         *
         * Without deduplication, one malicious campaign could
         * flood the SIEM with identical events.
         *
         * Key:
         *
         * sourceIP
         * destinationIP
         * protocol
         * security classification
         *
         * Value:
         * timestamp of last emitted event
         */

        this.recentEvents =
            new Map();


        this.deduplicationWindow =
            5000;


        // =================================================
        // STATISTICS
        // =================================================

        this.stats = {

            packetsReceived:
                0,

            packetsIgnored:
                0,

            eventsCreated:
                0,

            suspiciousEvents:
                0,

            maliciousEvents:
                0,

            duplicateEvents:
                0

        };


        console.log(
            "[NETWORK BRIDGE] Ready."
        );

    }


    // =====================================================
    // START
    // =====================================================

    start() {

        if (this.running) {

            console.log(
                "[NETWORK BRIDGE] Already running."
            );

            return;

        }


        if (!this.packetEngine) {

            console.error(
                "[NETWORK BRIDGE] PacketEngine unavailable."
            );

            return;

        }


        if (!this.eventEngine) {

            console.error(
                "[NETWORK BRIDGE] EventEngine unavailable."
            );

            return;

        }


        if (
            typeof this.packetEngine.subscribe !==
            "function"
        ) {

            console.error(
                "[NETWORK BRIDGE] PacketEngine.subscribe() unavailable."
            );

            return;

        }


        if (
            typeof this.eventEngine.createEvent !==
            "function"
        ) {

            console.error(
                "[NETWORK BRIDGE] EventEngine.createEvent() unavailable."
            );

            return;

        }


        this.running =
            true;


        this.unsubscribe =
            this.packetEngine.subscribe(
                packet => {

                    this.processPacket(
                        packet
                    );

                }
            );


        console.log(
            "[NETWORK BRIDGE] ONLINE"
        );

    }


    // =====================================================
    // STOP
    // =====================================================

    stop() {

        if (!this.running) {
            return;
        }


        this.running =
            false;


        if (this.unsubscribe) {

            this.unsubscribe();

            this.unsubscribe =
                null;

        }


        this.recentEvents.clear();


        console.log(
            "[NETWORK BRIDGE] STOPPED"
        );

    }


    // =====================================================
    // PROCESS PACKET
    // =====================================================

    processPacket(packet) {

        if (
            !this.running ||
            !packet
        ) {

            return null;

        }


        this.stats.packetsReceived++;


        // =================================================
        // BASIC NETWORK FILTER
        // =================================================

        const isExternal =
            packet.destinationType ===
            "EXTERNAL";


        /*
         * Internal traffic never enters the SIEM through
         * this bridge.
         */

        if (!isExternal) {

            this.stats.packetsIgnored++;

            return null;

        }


        // =================================================
        // SECURITY CONTEXT
        // =================================================

        /*
         * PacketEngine deliberately keeps security
         * classification out of the normal enumerable
         * packet properties.
         *
         * Read it only here.
         */

        const security =
            packet._security ||
            null;


        if (!security) {

            this.stats.packetsIgnored++;

            return null;

        }


        const reputation =
            security.reputation ||
            "UNKNOWN";


        const threatScore =
            Number(
                security.threatScore
            ) || 0;


        const campaignId =
            security.campaignId ||
            null;


        const campaignStage =
            security.campaignStage ||
            null;


        // =================================================
        // SECURITY DECISION
        // =================================================

        /*
         * Trusted external traffic:
         *
         * Keep it inside Packet Capturer.
         */

        if (
            reputation ===
            "TRUSTED"
        ) {

            this.stats.packetsIgnored++;

            return null;

        }


        /*
         * Internal classification should never be emitted
         * as an external security event.
         */

        if (
            reputation ===
            "INTERNAL"
        ) {

            this.stats.packetsIgnored++;

            return null;

        }


        /*
         * Unknown traffic is intentionally NOT enough
         * evidence to create a SIEM event.
         *
         * This is important because the analyst should
         * have to investigate the packet capture rather
         * than receiving every external connection as an
         * alert.
         */

        if (
            reputation !==
            "SUSPICIOUS" &&

            reputation !==
            "MALICIOUS"
        ) {

            this.stats.packetsIgnored++;

            return null;

        }


        // =================================================
        // SEVERITY
        // =================================================

        let severity;


        if (
            reputation ===
            "MALICIOUS"
        ) {

            severity =
                "CRITICAL";

            this.stats.maliciousEvents++;

        }

        else {

            severity =
                "HIGH";

            this.stats.suspiciousEvents++;

        }


        // =================================================
        // DEDUPLICATION
        // =================================================

        const dedupeKey =
            this.buildDedupeKey(
                packet,
                reputation,
                campaignId
            );


        if (
            this.isDuplicate(
                dedupeKey
            )
        ) {

            this.stats.duplicateEvents++;

            this.stats.packetsIgnored++;

            return null;

        }


        this.markEvent(
            dedupeKey
        );


        // =================================================
        // EVENT TYPE
        // =================================================

        let eventType =
            "SUSPICIOUS_EXTERNAL_CONNECTION";


        /*
         * Campaign-correlated traffic gets a more specific
         * event type.
         */

        if (
            campaignId
        ) {

            if (
                campaignStage ===
                "RECONNAISSANCE"
            ) {

                eventType =
                    "EXTERNAL_RECONNAISSANCE";

            }

            else if (
                campaignStage ===
                "PHISHING"
            ) {

                eventType =
                    "PHISHING_INFRASTRUCTURE_CONNECTION";

            }

            else if (
                campaignStage ===
                "CREDENTIAL_ATTACK"
            ) {

                eventType =
                    "CREDENTIAL_ATTACK_INFRASTRUCTURE_CONNECTION";

            }

            else if (
                campaignStage ===
                "EXECUTION"
            ) {

                eventType =
                    "EXTERNAL_EXECUTION_INFRASTRUCTURE";

            }

            else if (
                campaignStage ===
                "PAYLOAD_ACTIVITY"
            ) {

                eventType =
                    "EXTERNAL_PAYLOAD_CONNECTION";

            }

            else if (
                campaignStage ===
                "DISCOVERY"
            ) {

                eventType =
                    "COMPROMISED_HOST_EXTERNAL_CONNECTION";

            }

            else if (
                campaignStage ===
                "LATERAL_MOVEMENT"
            ) {

                eventType =
                    "LATERAL_MOVEMENT_EXTERNAL_CONNECTION";

            }

        }


        // =================================================
        // CREATE SIEM EVENT
        // =================================================

        const event =
            this.eventEngine.createEvent({

                eventType,

                severity,

                actor:
                    packet.sourceHostname ||
                    packet.sourceIP,

                actorType:
                    "NETWORK_HOST",

                sourceIP:
                    packet.sourceIP,

                destinationIP:
                    packet.destinationIP,

                hostname:
                    packet.sourceHostname,

                message:
                    this.buildMessage(
                        packet,
                        reputation,
                        severity,
                        campaignId,
                        campaignStage,
                        threatScore
                    ),

                metadata: {

                    packetId:
                        packet.id,

                    packetNumber:
                        packet.number,

                    protocol:
                        packet.protocol,

                    transport:
                        packet.transport ||
                        null,

                    sourcePort:
                        packet.sourcePort ||
                        null,

                    destinationPort:
                        packet.destinationPort ||
                        null,

                    destinationType:
                        packet.destinationType,

                    destinationHostname:
                        packet.destinationHostname ||
                        null,

                    /*
                     * Security classification is appropriate
                     * for SIEM telemetry.
                     *
                     * It is intentionally NOT present on the
                     * normal visible packet object.
                     */

                    destinationReputation:
                        reputation,

                    destinationThreatScore:
                        threatScore,

                    destinationCountry:
                        security.country ||
                        null,

                    packetLength:
                        packet.length,

                    campaignId:
                        campaignId,

                    campaignStage:
                        campaignStage,

                    campaignCorrelated:
                        Boolean(
                            security.campaignCorrelated
                        )

                }

            });


        if (event) {

            this.stats.eventsCreated++;


            /*
             * Preserve packet ↔ SIEM correlation.
             */

            packet.siemEventId =
                event.id;


            /*
             * Also preserve the event ID inside the
             * security context when possible.
             */

            if (
                packet._security
            ) {

                packet._security.siemEventId =
                    event.id;

            }

        }


        return event;

    }


    // =====================================================
    // DEDUPLICATION KEY
    // =====================================================

    buildDedupeKey(
        packet,
        reputation,
        campaignId
    ) {

        return [

            packet.sourceIP ||
            "UNKNOWN",

            packet.destinationIP ||
            "UNKNOWN",

            packet.protocol ||
            "UNKNOWN",

            reputation,

            campaignId ||
            "NO-CAMPAIGN"

        ].join(
            "|"
        );

    }


    // =====================================================
    // CHECK DUPLICATE
    // =====================================================

    isDuplicate(
        key
    ) {

        const previous =
            this.recentEvents.get(
                key
            );


        if (
            !previous
        ) {

            return false;

        }


        const elapsed =
            Date.now() -
            previous;


        if (
            elapsed <
            this.deduplicationWindow
        ) {

            return true;

        }


        this.recentEvents.delete(
            key
        );


        return false;

    }


    // =====================================================
    // MARK EVENT
    // =====================================================

    markEvent(
        key
    ) {

        this.recentEvents.set(
            key,
            Date.now()
        );


        /*
         * Prevent unbounded growth.
         */

        if (
            this.recentEvents.size >
            500
        ) {

            const oldestKey =
                this.recentEvents.keys()
                    .next()
                    .value;


            if (
                oldestKey
            ) {

                this.recentEvents.delete(
                    oldestKey
                );

            }

        }

    }


    // =====================================================
    // MESSAGE
    // =====================================================

    buildMessage(
        packet,
        reputation,
        severity,
        campaignId,
        campaignStage,
        threatScore
    ) {

        const host =
            packet.sourceHostname ||
            packet.sourceIP ||
            "Unknown host";


        const source =
            packet.sourceIP ||
            "unknown";


        const destination =
            packet.destinationIP ||
            "unknown";


        const protocol =
            packet.protocol ||
            "UNKNOWN";


        // =================================================
        // CAMPAIGN-CORRELATED MALICIOUS ACTIVITY
        // =================================================

        if (
            campaignId &&
            reputation ===
            "MALICIOUS"
        ) {

            return (

                `${severity}: Host ` +

                `${host} (${source}) ` +

                `established simulated ` +

                `${protocol} traffic with external ` +

                `infrastructure at ${destination}. ` +

                `Activity is correlated with ` +

                `active attack campaign ` +

                `${campaignId}` +

                (
                    campaignStage
                        ? ` during ${campaignStage} stage.`
                        : "."
                )

            );

        }


        // =================================================
        // CAMPAIGN-CORRELATED SUSPICIOUS ACTIVITY
        // =================================================

        if (
            campaignId
        ) {

            return (

                `${severity}: Host ` +

                `${host} (${source}) ` +

                `communicated with external ` +

                `${protocol} infrastructure at ` +

                `${destination}. ` +

                `Activity is correlated with ` +

                `campaign ${campaignId}` +

                (
                    campaignStage
                        ? ` (${campaignStage}).`
                        : "."
                )

            );

        }


        // =================================================
        // GENERIC MALICIOUS ACTIVITY
        // =================================================

        if (
            reputation ===
            "MALICIOUS"
        ) {

            return (

                `CRITICAL: Host ` +

                `${host} (${source}) ` +

                `communicated with external ` +

                `${protocol} infrastructure at ` +

                `${destination}. ` +

                `Threat intelligence correlation ` +

                `indicates a high-confidence malicious ` +

                `destination (score ${threatScore}).`

            );

        }


        // =================================================
        // GENERIC SUSPICIOUS ACTIVITY
        // =================================================

        return (

            `HIGH: Host ` +

            `${host} (${source}) ` +

            `communicated with external ` +

            `${protocol} infrastructure at ` +

            `${destination}. ` +

            `Threat intelligence correlation ` +

            `indicates suspicious activity ` +

            `(score ${threatScore}).`

        );

    }


    // =====================================================
    // STATUS
    // =====================================================

    getStatus() {

        return {

            running:
                this.running,

            subscribed:
                Boolean(
                    this.unsubscribe
                ),

            deduplicationWindow:
                this.deduplicationWindow,

            recentEventKeys:
                this.recentEvents.size,

            stats: {

                ...this.stats

            }

        };

    }


    // =====================================================
    // RESET STATISTICS
    // =====================================================

    resetStats() {

        this.stats = {

            packetsReceived:
                0,

            packetsIgnored:
                0,

            eventsCreated:
                0,

            suspiciousEvents:
                0,

            maliciousEvents:
                0,

            duplicateEvents:
                0

        };


        this.recentEvents.clear();


        console.log(
            "[NETWORK BRIDGE] Statistics reset."
        );

    }


    // =====================================================
    // DESTROY
    // =====================================================

    destroy() {

        this.stop();


        this.packetEngine =
            null;


        this.eventEngine =
            null;


        this.recentEvents.clear();


        console.log(
            "[NETWORK BRIDGE] Destroyed."
        );

    }

}