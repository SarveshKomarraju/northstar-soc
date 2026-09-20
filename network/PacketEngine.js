// =========================================================
// NORTHSTAR SOC
// PACKET ENGINE
//
// Synthetic network capture engine.
//
// IMPORTANT:
// - NEVER touches the real network.
// - All packets are simulated.
// - Corporate hosts come from HOSTS.
// - Corporate infrastructure comes from NETWORK.
// - External destinations are simulation-only.
// - Attack correlation comes through EventEngine telemetry.
// - PacketEngine NEVER imports AttackEngine.
//
// CAPTURE MODEL:
//
// PacketEngine continuously generates synthetic traffic.
// The NetworkStore decides how much packet history is
// retained (currently 5,000 packets).
//
// The simulation continues generating traffic even when
// the analyst has stopped/paused the packet capture UI.
// =========================================================

import { HOSTS } from "../data/hosts.js";
import { NETWORK } from "../data/network.js";
import { getPhishingDomainForAttack } from "../data/phishingInfrastructure.js";


class PacketEngine {

    constructor() {

        this.running = false;
        this.paused = false;

        this.threatLevel = 0;

        this.packetNumber = 0;

        this.timer = null;

        this.subscribers = new Set();

        this.packetsPerSecond = 5;

        this.externalTrafficRate = 0.30;

        this.backgroundStarted = false;

        /*
         * attackId → correlated campaign state
         */
        this.campaigns = new Map();

        this.eventEngine = null;
        this.eventEngineUnsubscribe = null;
        this.eventEngineCheckTimer = null;

        this.connectEventEngine();

        /*
         * Seed the initial capture without starting live traffic.
         *
         * NetworkStore connects shortly after PacketEngine is
         * constructed, so wait briefly before emitting the seed
         * packets. The engine remains stopped/paused afterward.
         */
        setTimeout(
            () => {
                this.seedInitialCapture(2000);
            },
            1000
        );
    }


    randomItem(array) {

        if (!Array.isArray(array) || array.length === 0) {
            return null;
        }

        return array[
            Math.floor(Math.random() * array.length)
        ];
    }


    isExternalIP(ip) {

        if (!ip || typeof ip !== "string") {
            return false;
        }

        const privateRanges = [
            /^10\./,
            /^192\.168\./,
            /^172\.(1[6-9]|2\d|3[0-1])\./
        ];

        return !privateRanges.some(
            range => range.test(ip)
        );
    }


    /*
     * "Corporate" = internal = not external. This is called by
     * processSecurityEvent() below every time any security
     * event arrives (i.e. constantly, for the life of the
     * simulation) — it was previously missing entirely, which
     * meant processSecurityEvent threw on its second check for
     * EVERY event, was caught silently by EventEngine's
     * try/catch, and aborted before ever reaching the switch
     * statement that sets campaign.stage / campaign.compromised.
     *
     * In practice that meant NO campaign ever recorded a stage
     * past its initial creation and NONE were ever marked
     * compromised — the entire correlation chain this file is
     * built around (campaign → host → IP → MAC → hostname →
     * username) silently never activated.
     */
    isCorporateIP(ip) {

        return !this.isExternalIP(
            ip
        );

    }


    randomEphemeralPort() {

        return Math.floor(
            49152 + Math.random() * (65535 - 49152 + 1)
        );
    }


    randomPacketLength(min = 64, max = 1500) {

        return Math.floor(
            min + Math.random() * (max - min + 1)
        );
    }


    randomUint32() {

        return Math.floor(
            Math.random() * 0x100000000
        ) >>> 0;
    }


    chance(probability) {

        return Math.random() < probability;
    }


    // =========================================================
    // SUBSCRIPTIONS
    // =========================================================

    subscribe(callback) {

        if (
            typeof callback !==
            "function"
        ) {
            return () => { };
        }

        this.subscribers.add(
            callback
        );

        return () => {
            this.subscribers.delete(
                callback
            );
        };

    }


    emit(packet) {

        if (!packet) {
            return;
        }

        this.subscribers.forEach(
            callback => {

                try {

                    callback(
                        packet
                    );

                }

                catch (error) {

                    console.error(
                        "[PACKET ENGINE] Subscriber error:",
                        error
                    );

                }

            }
        );

    }


    // =========================================================
    // THREAT LEVEL
    // =========================================================

    setThreatLevel(level) {

        this.threatLevel =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(level) || 0
                )
            );

        console.log(
            `[PACKET ENGINE] Threat level → ${this.threatLevel}`
        );

    }


    getThreatLevel() {

        return this.threatLevel;

    }


    // =========================================================
    // EVENT ENGINE CORRELATION
    // =========================================================

    connectEventEngine() {

        if (
            this.eventEngineUnsubscribe ||
            this.eventEngine
        ) {
            return;
        }

        if (
            window.eventEngine &&
            typeof
            window.eventEngine.subscribe ===
            "function"
        ) {

            this.eventEngine =
                window.eventEngine;

            this.eventEngineUnsubscribe =
                this.eventEngine.subscribe(
                    event => {

                        this.processSecurityEvent(
                            event
                        );

                    }
                );

            console.log(
                "[PACKET ENGINE] EventEngine campaign telemetry connected."
            );

            return;

        }


        if (
            !this.eventEngineCheckTimer
        ) {

            this.eventEngineCheckTimer =
                setInterval(
                    () => {

                        if (
                            this.eventEngineUnsubscribe ||
                            this.eventEngine
                        ) {

                            clearInterval(
                                this.eventEngineCheckTimer
                            );

                            this.eventEngineCheckTimer =
                                null;

                            return;

                        }

                        this.connectEventEngine();

                    },
                    100
                );

        }

    }


    processSecurityEvent(event) {

        if (!event) {
            return;
        }


        const attackId =
            event.attackId ||
            event.metadata?.attackId ||
            null;


        if (!attackId) {
            return;
        }


        let campaign =
            this.campaigns.get(
                attackId
            );


        if (!campaign) {

            campaign = {

                attackId,

                attackerIP:
                    event.sourceIP ||
                    event.metadata?.attackerIP ||
                    null,

                targetIP:
                    event.destinationIP ||
                    event.metadata?.targetIP ||
                    null,

                targetHostname:
                    event.hostname ||
                    event.metadata?.hostname ||
                    null,

                stage:
                    null,

                lastEventType:
                    null,

                active:
                    true,

                compromised:
                    false,

                lastSeen:
                    Date.now()

            };


            this.campaigns.set(
                attackId,
                campaign
            );

        }


        /*
         * External source IPs are attacker infrastructure.
         */
        if (
            event.sourceIP &&
            this.isExternalIP(
                event.sourceIP
            )
        ) {

            campaign.attackerIP =
                event.sourceIP;

        }


        /*
         * Corporate destination IPs identify the
         * currently relevant internal host.
         */
        if (
            event.destinationIP &&
            this.isCorporateIP(
                event.destinationIP
            )
        ) {

            campaign.targetIP =
                event.destinationIP;

        }


        if (
            event.hostname
        ) {

            campaign.targetHostname =
                event.hostname;

        }


        /*
         * Some AttackEngine events may store target
         * information inside metadata rather than at
         * the event root.
         */
        if (
            event.metadata?.targetIP &&
            this.isCorporateIP(
                event.metadata.targetIP
            )
        ) {

            campaign.targetIP =
                event.metadata.targetIP;

        }


        if (
            event.metadata?.hostname
        ) {

            campaign.targetHostname =
                event.metadata.hostname;

        }


        campaign.lastEventType =
            event.eventType ||
            null;

        campaign.lastSeen =
            Date.now();


        switch (
        event.eventType
        ) {

            case "RECONNAISSANCE":

                campaign.stage =
                    "RECONNAISSANCE";

                break;


            case "PHISHING_EMAIL_SENT":

                campaign.stage =
                    "PHISHING";

                break;


            case "EMAIL_OPENED":

                campaign.stage =
                    "USER_INTERACTION";

                break;


            case "AUTH_FAILURE":

                campaign.stage =
                    "CREDENTIAL_ATTACK";

                break;


            case "AUTH_SUCCESS":

                campaign.stage =
                    "COMPROMISED";

                campaign.compromised =
                    true;

                break;


            case "PROCESS_START":

                campaign.stage =
                    "EXECUTION";

                campaign.compromised =
                    true;

                break;


            case "FILE_DROPPED":

                campaign.stage =
                    "PAYLOAD_ACTIVITY";

                campaign.compromised =
                    true;

                break;


            case "HOST_DISCOVERY":

                campaign.stage =
                    "DISCOVERY";

                campaign.compromised =
                    true;

                break;


            case "LATERAL_MOVEMENT_ATTEMPT":

                campaign.stage =
                    "LATERAL_MOVEMENT";

                campaign.compromised =
                    true;

                break;


            case "HOST_COMPROMISED":

                campaign.stage =
                    "LATERAL_COMPROMISE";

                campaign.compromised =
                    true;

                if (
                    event.destinationIP &&
                    this.isCorporateIP(
                        event.destinationIP
                    )
                ) {

                    campaign.targetIP =
                        event.destinationIP;

                }

                break;


            case "ATTACK_ABANDONED":

                campaign.active =
                    false;

                break;


            /* =============================================
               RANSOMWARE (BLACKFROST) — additive only. These
               are the only new eventTypes RansomwareEngine.js
               emits; everything else about campaign tracking
               above (attackerIP/targetIP/targetHostname/
               lastSeen) already works generically for any
               attackId, ransomware included.
               ============================================= */

            case "EMAIL_RECEIVED":

                campaign.stage =
                    "PHISHING";

                break;


            case "USER_INTERACTION":

                campaign.stage =
                    "USER_INTERACTION";

                break;


            case "SUSPICIOUS_ATTACHMENT_OPENED":

                campaign.stage =
                    "PAYLOAD_ACTIVITY";

                campaign.compromised =
                    true;

                break;


            case "CHILD_PROCESS_CREATED":
            case "PAYLOAD_EXECUTION":

                campaign.stage =
                    "EXECUTION";

                campaign.compromised =
                    true;

                break;


            case "PERSISTENCE_ESTABLISHED":

                campaign.stage =
                    "PERSISTENCE";

                campaign.compromised =
                    true;

                break;


            case "PROCESS_DISCOVERY":
            case "FILE_DISCOVERY":

                campaign.stage =
                    "DISCOVERY";

                campaign.compromised =
                    true;

                break;


            case "FILE_ENCRYPTION_SIMULATED":
            case "MASS_FILE_MODIFICATION":

                campaign.stage =
                    "ENCRYPTION";

                campaign.compromised =
                    true;

                break;


            case "RANSOM_NOTE_CREATED":

                campaign.stage =
                    "RANSOM_NOTE";

                campaign.compromised =
                    true;

                break;


            case "C2_CONNECTION":

                campaign.stage =
                    "C2_COMMUNICATION";

                campaign.compromised =
                    true;

                break;


            case "HOST_IMPACTED":

                campaign.stage =
                    "IMPACT";

                campaign.compromised =
                    true;

                break;

        }


        this.pruneCampaigns();

    }


    pruneCampaigns() {

        const cutoff =
            Date.now() -
            (
                1000 *
                60 *
                15
            );


        this.campaigns.forEach(
            (
                campaign,
                attackId
            ) => {

                if (
                    !campaign.active &&
                    campaign.lastSeen <
                    cutoff
                ) {

                    this.campaigns.delete(
                        attackId
                    );

                    return;

                }


                if (
                    campaign.lastSeen <
                    cutoff
                ) {

                    campaign.active =
                        false;

                }

            }
        );

    }


    getActiveCampaigns() {

        this.pruneCampaigns();

        return Array.from(
            this.campaigns.values()
        )
            .filter(
                campaign =>
                    campaign.active
            );

    }


    getCorrelatedCampaign() {

        const campaigns =
            this.getActiveCampaigns();


        if (
            campaigns.length ===
            0
        ) {

            return null;

        }


        const prioritized =
            campaigns.filter(
                campaign =>
                    campaign.compromised ||
                    campaign.stage ===
                    "PHISHING" ||
                    campaign.stage ===
                    "CREDENTIAL_ATTACK"
            );


        const selected =
            this.randomItem(
                prioritized.length
                    ? prioritized
                    : campaigns
            );


        /*
         * Firewall enforcement (spec section 15 — "Block C2").
         * A single centralized check here, rather than one at
         * each of the ~7 call sites below that read
         * campaign.attackerIP, since every one of them already
         * treats a null attackerIP as "no malicious destination
         * available" and degrades to ordinary/benign traffic —
         * exactly the effect blocking C2 should have. This does
         * NOT touch local encryption, which has nothing to do
         * with the network layer (spec: partial, not total,
         * remediation per action).
         */
        if (
            selected &&
            selected.attackerIP &&
            this.isFirewallBlocked(selected.attackerIP)
        ) {

            return {
                ...selected,
                attackerIP: null
            };

        }


        return selected;

    }


    /**
     * True once the analyst has blocked this IP at the firewall
     * (data/network.js NETWORK.firewall.blockedIPs — the same
     * array RansomwareEngine.blockC2()/EndpointStore-style
     * response actions push into).
     */
    isFirewallBlocked(ip) {

        if (!ip) {
            return false;
        }

        const firewall =
            this.getFirewall();

        if (
            !firewall ||
            !Array.isArray(firewall.blockedIPs)
        ) {
            return false;
        }

        return firewall.blockedIPs.includes(ip);

    }


    // =========================================================
    // CAMPAIGN HOST RESOLUTION
    // =========================================================

    /*
     * Resolve a campaign's internal target IP back to the
     * authoritative HOSTS inventory.
     *
     * This is critical for investigation consistency:
     *
     * campaign.targetIP
     *      ↓
     * HOSTS entry
     *      ↓
     * hostname / MAC / assignedUser
     */
    getCampaignTargetHost(
        campaign
    ) {

        if (
            !campaign ||
            !campaign.targetIP
        ) {
            return null;
        }


        return HOSTS.find(
            host =>
                host &&
                host.ip ===
                campaign.targetIP
        ) || null;

    }


    /*
     * Return the actual compromised campaign host when
     * possible. Fall back to a normal workstation only
     * when campaign telemetry does not yet contain a
     * usable internal target.
     */
    selectCampaignSourceHost(
        campaign
    ) {

        const campaignHost =
            this.getCampaignTargetHost(
                campaign
            );


        if (
            campaignHost
        ) {

            return campaignHost;

        }


        return this.selectSourceHost();

    }


    /*
     * Bias source-host selection toward the actual campaign
     * host WITHOUT making it deterministic.
     *
     * A hard "always the compromised host" rule (the previous
     * behavior for TCP/HTTP/TLS) means that, for as long as any
     * campaign is compromised, effectively every packet of that
     * type in the ENTIRE capture comes from one IP — a dead
     * giveaway that defeats the point of investigating traffic
     * at all. A probability keeps the compromised host's
     * activity discoverable and, over the length of a capture,
     * still statistically obvious once an analyst filters on
     * it — without it swallowing every other host's normal
     * traffic in the meantime.
     */
    pickSourceHostForCampaign(
        campaign,
        probability = 0.3
    ) {

        if (
            campaign &&
            campaign.targetIP &&
            this.chance(
                probability
            )
        ) {

            return (
                this.selectCampaignSourceHost(
                    campaign
                ) ||
                this.selectSourceHost()
            );

        }


        return this.selectSourceHost();

    }


    /*
     * The phishing campaign's actual external landing/delivery
     * domain — the exact same domain Mail's lure email uses for
     * this attackId (see data/phishingInfrastructure.js).
     *
     * Kept separate from the post-compromise "raw IP" C2
     * destination below: a phishing lure realistically gets
     * visited by name (DNS + Host header/SNI), while later
     * beaconing to attacker infrastructure realistically often
     * isn't.
     */
    buildPhishingLureDestination(
        campaign
    ) {

        if (
            !campaign ||
            !campaign.attackId ||
            !campaign.attackerIP
        ) {
            return null;
        }


        return {

            ip:
                campaign.attackerIP,

            hostname:
                getPhishingDomainForAttack(
                    campaign.attackId
                ),

            external:
                true,

            destinationType:
                "EXTERNAL",

            reputation:
                "UNKNOWN",

            _securityReputation:
                "MALICIOUS",

            _securityThreatScore:
                94,

            _securityCountry:
                "SIMULATED",

            campaignId:
                campaign.attackId,

            campaignStage:
                campaign.stage,

            campaignCorrelated:
                true,

            destinationMAC:
                null

        };

    }

    // =========================================================
    // INITIAL CAPTURE SEED
    // =========================================================

    seedInitialCapture(count = 2000) {

        if (
            this.packetNumber > 0
        ) {
            return;
        }


        console.log(
            `[PACKET ENGINE] Seeding initial capture: ${count} packets`
        );


        for (
            let i = 0;
            i < count;
            i++
        ) {

            const packet =
                this.generatePacket();


            if (
                packet
            ) {

                /*
                 * Spread the synthetic capture across a short
                 * historical window instead of giving every
                 * packet the exact same timestamp.
                 */
                packet.timestamp =
                    new Date(
                        Date.now() -
                        (
                            (count - i) *
                            1000
                        )
                    ).toISOString();


                this.emit(
                    packet
                );

            }

        }


        /*
         * IMPORTANT:
         * Do NOT start the generation loop here.
         *
         * The analyst should open Network with the seeded
         * capture already present, but live traffic stopped.
         */
        this.running =
            false;

        this.paused =
            true;


        console.log(
            "[PACKET ENGINE] Initial capture ready — live traffic paused."
        );

    }
    // =========================================================
    // BACKGROUND TRAFFIC
    // =========================================================

    startBackgroundTraffic() {

        if (
            this.backgroundStarted
        ) {
            return;
        }


        this.backgroundStarted =
            true;

        this.running =
            true;

        this.paused =
            false;


        console.log(
            "[PACKET ENGINE] BACKGROUND TRAFFIC STARTED"
        );


        this.generateLoop();

    }


    start() {

        if (
            !this.backgroundStarted
        ) {

            this.startBackgroundTraffic();

            return;

        }


        this.paused =
            false;

        this.running =
            true;


        console.log(
            "[PACKET ENGINE] CAPTURE STARTED"
        );

    }


    pause() {

        if (
            !this.running
        ) {
            return;
        }


        this.paused =
            true;


        console.log(
            "[PACKET ENGINE] CAPTURE PAUSED"
        );

    }


    resume() {

        if (
            !this.backgroundStarted
        ) {

            this.startBackgroundTraffic();

            return;

        }


        this.paused =
            false;

        this.running =
            true;


        console.log(
            "[PACKET ENGINE] CAPTURE RESUMED"
        );

    }


    stop() {

        this.running =
            false;

        this.paused =
            false;


        if (
            this.timer
        ) {

            clearTimeout(
                this.timer
            );

            this.timer =
                null;

        }


        console.log(
            "[PACKET ENGINE] CAPTURE STOPPED"
        );

    }


    generateLoop() {

        if (
            !this.backgroundStarted
        ) {
            return;
        }


        if (
            this.running &&
            !this.paused
        ) {

            const packet =
                this.generatePacket();


            this.emit(
                packet
            );

        }


        const interval =
            1000 /
            this.packetsPerSecond;


        this.timer =
            setTimeout(
                () =>
                    this.generateLoop(),
                interval
            );

    }


    // =========================================================
    // PACKET GENERATION
    // =========================================================

    generatePacket() {

        this.packetNumber++;


        const generators = [

            this.generateDNS.bind(this),

            this.generateNBNS.bind(this),

            this.generateKRB5.bind(this),

            this.generateTCP.bind(this),

            this.generateHTTP.bind(this),

            this.generateHTTP.bind(this),

            this.generateHTTP.bind(this),

            this.generateTLS.bind(this),

            this.generateARP.bind(this),

            this.generateICMP.bind(this)

        ];


        const generator =
            this.randomItem(
                generators
            );


        return generator();

    }


    // =========================================================
    // HOST / INFRASTRUCTURE HELPERS
    // =========================================================

    getInternalHosts() {

        return HOSTS.filter(
            host =>
                host &&
                host.ip &&
                host.hostname
        );

    }


    getWorkstations() {

        return HOSTS.filter(
            host =>
                host &&
                (
                    host.type ===
                    "workstation" ||

                    host.type ===
                    "laptop"
                )
        );

    }


    getServers() {

        return HOSTS.filter(
            host =>
                host &&
                (
                    host.type ===
                    "server" ||

                    host.type ===
                    "domain-controller"
                )
        );

    }


    getDomainController() {

        return HOSTS.find(
            host =>
                host &&
                host.type ===
                "domain-controller"
        ) || null;

    }


    getServerByHostname(
        hostname
    ) {

        return HOSTS.find(
            host =>
                host &&
                host.hostname ===
                hostname
        ) || null;

    }


    getDnsServer() {

        if (
            !NETWORK.dns ||
            !NETWORK.dns.ip ||
            !NETWORK.dns.hostname
        ) {

            return null;

        }


        return {

            hostname:
                NETWORK.dns.hostname,

            ip:
                NETWORK.dns.ip,

            mac:
                NETWORK.dns.mac ||
                null,

            type:
                "dns",

            enabled:
                NETWORK.dns.enabled !==
                false

        };

    }


    getRouter() {

        return NETWORK.router ||
            null;

    }


    getFirewall() {

        return NETWORK.firewall ||
            null;

    }


    // =========================================================
    // EXTERNAL DESTINATIONS
    // =========================================================

    getExternalDestinations() {

        /*
         * NAMING PHILOSOPHY:
         *
         * TRUSTED entries are REAL organizations at IPs inside
         * their actual documented/publicly-known ranges (Google's
         * 142.250.0.0/15, GitHub's 140.82.112.0/20, Microsoft's
         * 13.107.0.0/16, Cloudflare's 104.16.0.0/13, Akamai's
         * historic 23.0.0.0/8 allocation, Apple's 17.0.0.0/8,
         * Dropbox's 162.125.0.0/16, Zoom's 170.114.0.0/16,
         * LinkedIn's 108.174.0.0/20, AWS's 52.0.0.0/8) — genuinely
         * mundane, everyday corporate traffic, not invented names.
         * A repeating-digit address like 1.1.1.1 is real too, but
         * so recognizable it doesn't blend in as ordinary noise;
         * the point of this pool is destinations that look and
         * are completely unremarkable.
         *
         * The genuinely bad entries below stay INVENTED on
         * purpose — real attacker infrastructure is never
         * actually hosted at Google's or Microsoft's real IP
         * ranges, so pretending otherwise would be both wrong
         * and a strange thing to fabricate. Their fake names
         * deliberately borrow vocabulary ("relay", "cdn",
         * "update") that also shows up in the genuinely trusted
         * names, so "sounds legit" still isn't proof by itself.
         */

        return [

            {
                ip:
                    "8.8.8.8",

                hostname:
                    "dns.google",

                reputation:
                    "TRUSTED",

                threatScore:
                    5,

                country:
                    "US"
            },

            {
                ip:
                    "1.1.1.1",

                hostname:
                    "one.one.one.one",

                reputation:
                    "TRUSTED",

                threatScore:
                    5,

                country:
                    "US"
            },

            {
                ip:
                    "142.250.72.14",

                hostname:
                    "google.com",

                reputation:
                    "TRUSTED",

                threatScore:
                    10,

                country:
                    "US"
            },

            {
                ip:
                    "140.82.121.4",

                hostname:
                    "github.com",

                reputation:
                    "TRUSTED",

                threatScore:
                    8,

                country:
                    "US"
            },

            {
                ip:
                    "104.18.32.47",

                hostname:
                    "discord.com",

                reputation:
                    "TRUSTED",

                threatScore:
                    12,

                country:
                    "US"
            },

            /*
             * Extra ordinary/trusted noise. The point of a real
             * capture is that most external traffic is boring —
             * the more legitimate-looking destinations there
             * are to sift through, the less the actually
             * malicious ones stand out just by being unfamiliar.
             */
            {
                ip:
                    "13.107.42.14",

                hostname:
                    "portal.office.com",

                reputation:
                    "TRUSTED",

                threatScore:
                    9,

                country:
                    "US"
            },

            {
                ip:
                    "104.16.132.229",

                hostname:
                    "cloudflare.com",

                reputation:
                    "TRUSTED",

                threatScore:
                    14,

                country:
                    "US"
            },

            {
                ip:
                    "17.253.144.10",

                hostname:
                    "apple.com",

                reputation:
                    "TRUSTED",

                threatScore:
                    16,

                country:
                    "US"
            },

            {
                ip:
                    "162.125.66.3",

                hostname:
                    "dropbox.com",

                reputation:
                    "TRUSTED",

                threatScore:
                    18,

                country:
                    "US"
            },

            {
                ip:
                    "170.114.52.2",

                hostname:
                    "zoom.us",

                reputation:
                    "TRUSTED",

                threatScore:
                    11,

                country:
                    "US"
            },

            {
                ip:
                    "108.174.10.10",

                hostname:
                    "linkedin.com",

                reputation:
                    "TRUSTED",

                threatScore:
                    13,

                country:
                    "US"
            },

            {
                ip:
                    "23.62.140.19",

                hostname:
                    "akamai.com",

                reputation:
                    "TRUSTED",

                threatScore:
                    7,

                country:
                    "US"
            },

            {
                ip:
                    "185.199.108.153",

                hostname:
                    "swiftcache-cdn.net",

                reputation:
                    "SUSPICIOUS",

                threatScore:
                    72,

                country:
                    "NL"
            },

            {
                ip:
                    "203.0.113.45",

                hostname:
                    "fern-bridge-update.net",

                reputation:
                    "SUSPICIOUS",

                threatScore:
                    81,

                country:
                    "SIMULATED"
            },

            {
                ip:
                    "198.51.100.77",

                hostname:
                    "outpost-relay-service.io",

                reputation:
                    "MALICIOUS",

                threatScore:
                    96,

                country:
                    "SIMULATED"
            },

            /*
             * A genuine false positive — flagged, unrelated to
             * any real campaign, and meant to stay that way. An
             * analyst who jumps on every SUSPICIOUS hit without
             * checking for actual campaign correlation should
             * end up chasing this one for nothing, same as a
             * real SOC deals with noisy/imperfect detections.
             */
            {
                ip:
                    "170.106.171.20",

                hostname:
                    "legacy-partner-portal.biz",

                reputation:
                    "SUSPICIOUS",

                threatScore:
                    44,

                country:
                    "US"
            }

        ];

    }


    selectExternalDestination() {

        const campaign =
            this.getCorrelatedCampaign();


        /*
         * Campaign infrastructure is intentionally exposed
         * as an ordinary external IP at the packet layer.
         *
         * Security classification stays hidden inside
         * _security so NetworkEventBridge can identify it
         * without making the packet row say "MALICIOUS".
         */
        if (
            campaign &&
            campaign.attackerIP &&
            Math.random() <
            0.65
        ) {

            return {

                ip:
                    campaign.attackerIP,

                hostname:
                    null,

                external:
                    true,

                destinationType:
                    "EXTERNAL",

                reputation:
                    "UNKNOWN",

                threatScore:
                    0,

                country:
                    null,

                campaignId:
                    campaign.attackId,

                campaignStage:
                    campaign.stage,

                campaignCorrelated:
                    true,

                destinationMAC:
                    null,

                _securityReputation:
                    "MALICIOUS",

                _securityThreatScore:
                    97,

                _securityCountry:
                    "SIMULATED"

            };

        }


        const destinations =
            this.getExternalDestinations();


        const benign =
            destinations.filter(
                destination =>
                    destination.reputation ===
                    "TRUSTED"
            );


        const suspicious =
            destinations.filter(
                destination =>
                    destination.reputation !==
                    "TRUSTED"
            );


        let destination;


        const threatBias =
            Math.min(
                0.35,
                this.threatLevel /
                300
            );


        if (
            Math.random() <
            threatBias &&
            suspicious.length
        ) {

            destination =
                this.randomItem(
                    suspicious
                );

        }

        else {

            destination =
                this.randomItem(
                    benign.length
                        ? benign
                        : destinations
                );

        }


        if (
            !destination
        ) {
            return null;
        }


        return {

            ip:
                destination.ip,

            hostname:
                destination.hostname,

            external:
                true,

            destinationType:
                "EXTERNAL",

            reputation:
                "UNKNOWN",

            threatScore:
                0,

            country:
                null,

            campaignId:
                null,

            campaignStage:
                null,

            campaignCorrelated:
                false,

            destinationMAC:
                null,

            /*
             * Hidden security metadata.
             */
            _securityReputation:
                destination.reputation,

            _securityThreatScore:
                destination.threatScore,

            _securityCountry:
                destination.country

        };

    }


    selectDestination() {

        const dynamicExternalRate =
            Math.min(
                0.65,
                this.externalTrafficRate +
                (
                    this.threatLevel /
                    100
                ) * 0.25
            );


        const useExternal =
            Math.random() <
            dynamicExternalRate;


        if (
            useExternal
        ) {

            return this.selectExternalDestination();

        }


        const destination =
            this.selectInternalDestination();


        if (
            !destination
        ) {
            return null;
        }


        return {

            ip:
                destination.ip,

            hostname:
                destination.hostname,

            external:
                false,

            destinationType:
                "INTERNAL",

            reputation:
                "INTERNAL",

            threatScore:
                0,

            country:
                null,

            campaignId:
                null,

            campaignStage:
                null,

            campaignCorrelated:
                false,

            destinationMAC:
                destination.mac ||
                null

        };

    }


    // =========================================================
    // PACKET BASE
    // =========================================================

    basePacket(
        protocol,
        source = null,
        destination = null
    ) {

        source =
            source ||
            this.selectSourceHost();


        destination =
            destination ||
            this.selectDestination();


        if (
            !source ||
            !destination
        ) {

            console.error(
                "[PACKET ENGINE] Unable to construct packet."
            );

            return null;

        }


        const packet = {

            id:
                `PKT-${String(
                    this.packetNumber
                ).padStart(
                    6,
                    "0"
                )}`,

            number:
                this.packetNumber,

            timestamp:
                new Date().toISOString(),

            protocol,

            sourceIP:
                source.ip,

            destinationIP:
                destination.ip,

            sourceHostname:
                source.hostname,

            destinationHostname:
                destination.hostname,

            sourceMAC:
                source.mac ||
                null,

            destinationMAC:
                destination.destinationMAC ||
                destination.mac ||
                null,

            direction:
                destination.external
                    ? "OUTBOUND"
                    : "INTERNAL",

            destinationType:
                destination.destinationType,

            external:
                Boolean(
                    destination.external
                ),

            /*
             * Keep visible packet fields neutral.
             * Security classification lives in _security.
             */
            destinationReputation:
                destination.external
                    ? "UNKNOWN"
                    : "INTERNAL",

            destinationThreatScore:
                0,

            destinationCountry:
                null

        };


        Object.defineProperty(
            packet,
            "_security",
            {

                value: {

                    reputation:
                        destination._securityReputation ||
                        destination.reputation ||
                        (
                            destination.external
                                ? "UNKNOWN"
                                : "INTERNAL"
                        ),

                    threatScore:
                        destination._securityThreatScore ??
                        destination.threatScore ??
                        0,

                    country:
                        destination._securityCountry ||
                        destination.country ||
                        null,

                    campaignId:
                        destination.campaignId ||
                        null,

                    campaignStage:
                        destination.campaignStage ||
                        null,

                    campaignCorrelated:
                        Boolean(
                            destination.campaignCorrelated
                        )

                },

                enumerable:
                    false,

                writable:
                    true,

                configurable:
                    true

            }
        );


        return packet;

    }


    // =========================================================
    // SOURCE HOST SELECTION
    // =========================================================

    selectSourceHost() {

        return this.randomItem(
            this.getWorkstations()
        );

    }


    // =========================================================
    // INTERNAL DESTINATION SELECTION
    // =========================================================

    selectInternalDestination() {

        return this.randomItem(
            this.getServers()
        );

    }


    // =========================================================
    // DNS
    // =========================================================

    generateDNS() {

        const campaign =
            this.getCorrelatedCampaign();

        /*
         * The window where the target user is actually on the
         * phishing page / submitting credentials — NOT the
         * moment the email merely got sent, which is before
         * anyone has done anything.
         */
        const campaignActive =
            campaign &&
            (
                campaign.stage ===
                "USER_INTERACTION" ||

                campaign.stage ===
                "CREDENTIAL_ATTACK"
            );

        /*
         * Decide FIRST whether this packet is going to be the
         * decisive clue (the actual target host looking up the
         * actual phishing domain) — and if so, guarantee the
         * source is that host. Evidence that's only correctly
         * attributed some of the time isn't evidence a player
         * can rely on. Ordinary/noise DNS traffic still uses
         * the old probabilistic mix so the network doesn't feel
         * scripted.
         */
        let source = null;

        let isCampaignHost = false;

        if (
            campaignActive &&
            this.chance(0.35)
        ) {

            const campaignHost =
                this.getCampaignTargetHost(
                    campaign
                );

            if (campaignHost) {

                source = campaignHost;

                isCampaignHost = true;

            }
        }

        if (!source) {

            source =
                campaignActive
                    ? this.pickSourceHostForCampaign(
                        campaign,
                        0.3
                    )
                    : this.selectSourceHost();

            isCampaignHost =
                Boolean(
                    campaign &&
                    campaign.targetIP &&
                    source &&
                    source.ip ===
                    campaign.targetIP
                );
        }

        const dnsServer =
            this.getDnsServer();

        if (
            !source ||
            !dnsServer ||
            dnsServer.enabled === false
        ) {

            return this.generateICMP();

        }


        const domains = [

            "login.microsoftonline.com",
            "www.google.com",
            "www.microsoft.com",
            "updates.example.net",
            "cdn.example.net",
            "intranet.northstar.local",
            "files.northstar.local",
            "mail.northstar.local",
            "support.example.org",
            "time.windows.com",
            "ocsp.example.net",
            "telemetry.example.net"

        ];


        let domain;


        /*
         * The decisive clue: the compromised/target host itself
         * looking up the REAL phishing domain for this campaign
         * — the exact same domain the lure email in Mail uses.
         * A player who has read that email and filters Packet
         * Capture for it will find this.
         */

        if (
            isCampaignHost &&
            campaignActive &&
            this.chance(0.5)
        ) {

            domain =
                getPhishingDomainForAttack(
                    campaign.attackId
                );

        }

        /*
         * Ambient noise: during phishing activity ANYWHERE on
         * the network, occasionally generate lookups that look
         * phishy but are common enough elsewhere (this same
         * list appears in the general `domains` pool above)
         * that they are not, by themselves, decisive evidence.
         *
         * The packet itself does not announce that it is
         * malicious.
         */

        else if (
            campaign &&
            campaign.stage ===
            "PHISHING" &&
            this.chance(0.30)
        ) {

            domain =
                this.randomItem([

                    "login.microsoftonline.com",
                    "accounts.example.net",
                    "support.example.org"

                ]);

        }

        else {

            domain =
                this.randomItem(
                    domains
                );

        }


        const packet =
            this.basePacket(
                "DNS",
                source,
                {

                    ip:
                        dnsServer.ip,

                    hostname:
                        dnsServer.hostname,

                    mac:
                        dnsServer.mac,

                    external:
                        false,

                    destinationType:
                        "INTERNAL",

                    reputation:
                        "INTERNAL",

                    threatScore:
                        0,

                    country:
                        null,

                    destinationMAC:
                        dnsServer.mac

                }
            );


        if (
            !packet
        ) {
            return null;
        }


        packet.transport =
            "UDP";

        packet.sourcePort =
            this.randomEphemeralPort();

        packet.destinationPort =
            53;

        packet.length =
            this.randomPacketLength(
                60,
                180
            );


        packet.dns = {

            transactionId:
                Math.floor(
                    Math.random() *
                    65536
                ),

            flags:
                "0x0100 Standard query",

            queryName:
                domain,

            queryType:
                "A",

            queryClass:
                "IN"

        };


        return packet;

    }


    // =========================================================
    // NBNS
    // =========================================================

    generateNBNS() {

        const source =
            this.selectSourceHost();


        if (
            !source
        ) {
            return this.generateICMP();
        }


        const internalHosts =
            this.getInternalHosts();


        const name =
            this.randomItem(
                internalHosts.map(
                    host =>
                        host.hostname
                )
            );


        if (
            !name
        ) {
            return this.generateICMP();
        }


        const corporateSubnet =
            NETWORK.subnets?.find(
                subnet =>
                    subnet &&
                    subnet.name ===
                    "Corporate"
            );


        let broadcastIP =
            "10.10.10.255";


        if (
            corporateSubnet &&
            corporateSubnet.cidr
        ) {

            const parts =
                corporateSubnet.cidr.split(
                    "/"
                );


            if (
                parts.length === 2 &&
                parts[1] === "24"
            ) {

                const networkParts =
                    parts[0].split(
                        "."
                    );


                if (
                    networkParts.length === 4
                ) {

                    broadcastIP =
                        `${networkParts[0]}.` +
                        `${networkParts[1]}.` +
                        `${networkParts[2]}.255`;

                }

            }

        }


        const packet =
            this.basePacket(
                "NBNS",
                source,
                {

                    ip:
                        broadcastIP,

                    hostname:
                        "BROADCAST",

                    mac:
                        null,

                    external:
                        false,

                    destinationType:
                        "INTERNAL",

                    reputation:
                        "INTERNAL",

                    threatScore:
                        0,

                    country:
                        null,

                    destinationMAC:
                        "ff:ff:ff:ff:ff:ff"

                }
            );


        if (
            !packet
        ) {
            return null;
        }


        packet.transport =
            "UDP";

        packet.sourcePort =
            137;

        packet.destinationPort =
            137;

        packet.length =
            this.randomPacketLength(
                60,
                180
            );


        packet.nbns = {

            transactionId:
                Math.floor(
                    Math.random() *
                    65536
                ),

            flags:
                "0x0000 Name query",

            queryName:
                name,

            suffix:
                "0x00"

        };


        return packet;

    }


    // =========================================================
    // KERBEROS
    // =========================================================

    generateKRB5() {

        const campaign =
            this.getCorrelatedCampaign();


        /*
         * Kerberos AS-REQ traffic is the only place the
         * compromised host's username is directly visible, so
         * bias toward it fairly strongly once a campaign is
         * compromised — otherwise the username clue could
         * stay hidden by pure chance for an unreasonably long
         * time. Still probabilistic, not guaranteed: ordinary
         * Kerberos traffic from every other host keeps flowing.
         */
        const source =
            campaign &&
                campaign.compromised
                ? this.pickSourceHostForCampaign(
                    campaign,
                    0.45
                )
                : this.selectSourceHost();

        const dc =
            this.getDomainController();


        if (
            !source ||
            !dc
        ) {

            return this.generateICMP();

        }


        /*
         * Kerberos provides one of the investigation clues:
         *
         * host → account
         *
         * The username comes directly from the authoritative
         * host record rather than being randomly generated.
         */
        const user =
            source.assignedUser ||
            "unknown";


        const packet =
            this.basePacket(
                "KRB5",
                source,
                {

                    ip:
                        dc.ip,

                    hostname:
                        dc.hostname,

                    mac:
                        dc.mac ||
                        null,

                    external:
                        false,

                    destinationType:
                        "INTERNAL",

                    reputation:
                        "INTERNAL",

                    threatScore:
                        0,

                    country:
                        null,

                    destinationMAC:
                        dc.mac ||
                        null

                }
            );


        if (
            !packet
        ) {
            return null;
        }


        packet.transport =
            "UDP";

        packet.sourcePort =
            this.randomEphemeralPort();

        packet.destinationPort =
            88;

        packet.length =
            this.randomPacketLength(
                180,
                420
            );


        packet.kerberos = {

            messageType:
                "AS-REQ",

            clientName:
                user,

            realm:
                "NORTHSTAR.LOCAL",

            serviceName:
                "krbtgt/NORTHSTAR.LOCAL",

            protocolVersion:
                "5",

            encryptionType:
                "aes256-cts-hmac-sha1-96"

        };


        return packet;

    }


    // =========================================================
    // TCP
    // =========================================================

    generateTCP() {

        const campaign =
            this.getCorrelatedCampaign();


        /*
         * When this packet is associated with an active
         * compromised campaign, use the actual campaign
         * target as the source.
         *
         * This keeps:
         *
         * campaign → host → IP → MAC → hostname
         *
         * internally consistent.
         */
        const source =
            campaign &&
                campaign.compromised
                ? this.pickSourceHostForCampaign(
                    campaign,
                    0.3
                )
                : this.selectSourceHost();


        let destination;


        /*
         * Compromised hosts may communicate with the
         * attacker's external infrastructure.
         */

        if (
            campaign &&
            campaign.attackerIP &&
            campaign.compromised &&
            Math.random() <
            0.45
        ) {

            destination = {

                ip:
                    campaign.attackerIP,

                hostname:
                    null,

                external:
                    true,

                destinationType:
                    "EXTERNAL",

                reputation:
                    "UNKNOWN",

                _securityReputation:
                    "MALICIOUS",

                _securityThreatScore:
                    97,

                _securityCountry:
                    "SIMULATED",

                campaignId:
                    campaign.attackId,

                campaignStage:
                    campaign.stage,

                campaignCorrelated:
                    true,

                destinationMAC:
                    null

            };

        }

        else {

            destination =
                this.selectDestination();

        }


        if (
            !source ||
            !destination
        ) {

            return this.generateICMP();

        }


        const packet =
            this.basePacket(
                "TCP",
                source,
                destination
            );


        if (
            !packet
        ) {
            return null;
        }


        packet.transport =
            "TCP";

        packet.sourcePort =
            this.randomEphemeralPort();


        packet.destinationPort =
            packet.external
                ? this.randomItem([

                    443,
                    443,
                    443,
                    80,
                    8080

                ])
                : 443;


        packet.length =
            this.randomPacketLength(
                64,
                900
            );


        packet.tcp = {

            sequence:
                this.randomUint32(),

            acknowledgement:
                this.randomUint32(),

            flags:
                "ACK",

            windowSize:
                64240

        };


        return packet;

    }


    // =========================================================
    // HTTP
    // =========================================================

    generateHTTP() {

        const campaign =
            this.getCorrelatedCampaign();


        let destination;

        /*
         * Campaign-related HTTP traffic.
         *
         * This intentionally looks like ordinary HTTP traffic
         * to the analyst.
         *
         * USER_INTERACTION stage: the target user has actually
         * opened the phishing email — only now does the lure
         * get visited by name (Host header shows the real
         * phishing domain). Gating this on the email having
         * actually been opened, rather than merely sent, is
         * what makes this evidence mean something.
         *
         * EXECUTION / PAYLOAD_ACTIVITY: later beaconing to the
         * same attacker infrastructure, realistically by raw
         * IP rather than a resolved name.
         */
        if (
            campaign &&
            campaign.attackerIP &&
            campaign.stage ===
            "USER_INTERACTION" &&
            this.chance(0.40)
        ) {

            destination =
                this.buildPhishingLureDestination(
                    campaign
                );

        }

        /*
         * When this packet IS the phishing-lure evidence
         * (recognizable by having a hostname — the later raw-IP
         * beaconing destination below never sets one), the
         * source is guaranteed to be the real target host — an
         * analyst who filters for the lure domain and finds it
         * should always be able to trust who it came from.
         * Every other case keeps the old probabilistic mix so
         * the network doesn't feel scripted.
         */
        const source =
            destination &&
            destination.hostname
                ? (
                    this.getCampaignTargetHost(
                        campaign
                    ) ||
                    this.pickSourceHostForCampaign(
                        campaign,
                        0.3
                    )
                )
                : campaign &&
                    (
                        campaign.stage ===
                        "USER_INTERACTION" ||

                        campaign.stage ===
                        "EXECUTION" ||

                        campaign.stage ===
                        "PAYLOAD_ACTIVITY" ||

                        campaign.compromised
                    )
                    ? this.pickSourceHostForCampaign(
                        campaign,
                        0.3
                    )
                    : this.selectSourceHost();

        if (
            !destination &&
            campaign &&
            campaign.attackerIP &&
            (
                campaign.stage ===
                "EXECUTION" ||

                campaign.stage ===
                "PAYLOAD_ACTIVITY"
            ) &&
            this.chance(0.40)
        ) {

            destination = {

                ip:
                    campaign.attackerIP,

                hostname:
                    null,

                external:
                    true,

                destinationType:
                    "EXTERNAL",

                reputation:
                    "UNKNOWN",

                _securityReputation:
                    "MALICIOUS",

                _securityThreatScore:
                    98,

                _securityCountry:
                    "SIMULATED",

                campaignId:
                    campaign.attackId,

                campaignStage:
                    campaign.stage,

                campaignCorrelated:
                    true,

                destinationMAC:
                    null

            };

        }

        if (!destination) {

            /*
             * Normal HTTP should contain both internal and
             * external traffic. This prevents "external HTTP"
             * from automatically meaning "attacker".
             */
            const useExternal =
                Math.random() <
                0.55;


            if (
                useExternal
            ) {

                destination =
                    this.selectExternalDestination();

            }

            else {

                const webServer =
                    this.getServerByHostname(
                        "WEB-SERVER-01"
                    );


                if (
                    !webServer
                ) {
                    return this.generateTCP();
                }


                destination = {

                    ip:
                        webServer.ip,

                    hostname:
                        webServer.hostname,

                    mac:
                        webServer.mac ||
                        null,

                    external:
                        false,

                    destinationType:
                        "INTERNAL",

                    reputation:
                        "INTERNAL",

                    threatScore:
                        0,

                    country:
                        null,

                    destinationMAC:
                        webServer.mac ||
                        null

                };

            }

        }


        if (
            !source ||
            !destination
        ) {

            return this.generateTCP();

        }


        const paths = [

            "/",

            "/login",

            "/index.html",

            "/api/status",

            "/download/update",

            "/account",

            "/support",

            "/content",

            "/assets/main.js",

            "/api/health"

        ];


        const packet =
            this.basePacket(
                "HTTP",
                source,
                destination
            );


        if (
            !packet
        ) {
            return null;
        }


        packet.transport =
            "TCP";

        packet.sourcePort =
            this.randomEphemeralPort();

        packet.destinationPort =
            80;

        packet.length =
            this.randomPacketLength(
                180,
                1200
            );


        packet.tcp = {

            sequence:
                this.randomUint32(),

            acknowledgement:
                this.randomUint32(),

            flags:
                "PSH, ACK",

            windowSize:
                64240

        };


        packet.http = {

            requestMethod:
                "GET",

            host:
                destination.hostname ||
                destination.ip,

            requestUri:
                this.randomItem(
                    paths
                ),

            version:
                "HTTP/1.1"

        };


        return packet;

    }


    // =========================================================
    // TLS
    // =========================================================

    generateTLS() {

        const campaign =
            this.getCorrelatedCampaign();


        let destination;


        /*
         * USER_INTERACTION stage (the email has actually been
         * opened): TLS Client Hello to the real lure domain
         * (SNI shows it). EXECUTION / PAYLOAD_ACTIVITY /
         * DISCOVERY: later beaconing by raw IP, no SNI name.
         */
        if (
            campaign &&
            campaign.attackerIP &&
            campaign.stage ===
            "USER_INTERACTION" &&
            this.chance(0.50)
        ) {

            destination =
                this.buildPhishingLureDestination(
                    campaign
                );

        }

        /*
         * Same reasoning as generateHTTP(): when this packet IS
         * the phishing-lure evidence (has a hostname — the raw-
         * IP beaconing destination below never sets one), the
         * source is guaranteed to be the real target host.
         * Everything else keeps the old probabilistic mix.
         */
        const source =
            destination &&
            destination.hostname
                ? (
                    this.getCampaignTargetHost(
                        campaign
                    ) ||
                    this.pickSourceHostForCampaign(
                        campaign,
                        0.3
                    )
                )
                : campaign &&
                    (
                        campaign.stage ===
                        "USER_INTERACTION" ||

                        campaign.stage ===
                        "EXECUTION" ||

                        campaign.stage ===
                        "PAYLOAD_ACTIVITY" ||

                        campaign.stage ===
                        "DISCOVERY" ||

                        campaign.compromised
                    )
                    ? this.pickSourceHostForCampaign(
                        campaign,
                        0.3
                    )
                    : this.selectSourceHost();

        if (
            !destination &&
            campaign &&
            campaign.attackerIP &&
            (
                campaign.stage ===
                "EXECUTION" ||

                campaign.stage ===
                "PAYLOAD_ACTIVITY" ||

                campaign.stage ===
                "DISCOVERY"
            ) &&
            this.chance(0.50)
        ) {

            destination = {

                ip:
                    campaign.attackerIP,

                hostname:
                    null,

                external:
                    true,

                destinationType:
                    "EXTERNAL",

                reputation:
                    "UNKNOWN",

                _securityReputation:
                    "MALICIOUS",

                _securityThreatScore:
                    99,

                _securityCountry:
                    "SIMULATED",

                campaignId:
                    campaign.attackId,

                campaignStage:
                    campaign.stage,

                campaignCorrelated:
                    true,

                destinationMAC:
                    null

            };

        }

        if (!destination) {

            const external =
                Math.random() <
                0.55;


            if (
                external
            ) {

                destination =
                    this.selectExternalDestination();

            }

            else {

                const webServer =
                    this.getServerByHostname(
                        "WEB-SERVER-01"
                    );


                if (
                    !webServer
                ) {
                    return this.generateTCP();
                }


                destination = {

                    ip:
                        webServer.ip,

                    hostname:
                        webServer.hostname,

                    mac:
                        webServer.mac ||
                        null,

                    external:
                        false,

                    destinationType:
                        "INTERNAL",

                    reputation:
                        "INTERNAL",

                    threatScore:
                        0,

                    country:
                        null,

                    destinationMAC:
                        webServer.mac ||
                        null

                };

            }

        }


        if (
            !source ||
            !destination
        ) {

            return this.generateTCP();

        }


        const packet =
            this.basePacket(
                "TLS",
                source,
                destination
            );


        if (
            !packet
        ) {
            return null;
        }


        packet.transport =
            "TCP";

        packet.sourcePort =
            this.randomEphemeralPort();

        packet.destinationPort =
            443;

        packet.length =
            this.randomPacketLength(
                220,
                1400
            );


        packet.tcp = {

            sequence:
                this.randomUint32(),

            acknowledgement:
                this.randomUint32(),

            flags:
                "PSH, ACK",

            windowSize:
                64240

        };


        packet.tls = {

            recordType:
                "Handshake",

            handshakeType:
                "Client Hello",

            version:
                "TLS 1.3",

            serverName:
                destination.hostname ||
                null

        };


        return packet;

    }


    // =========================================================
    // ARP
    // =========================================================

    generateARP() {

        const source =
            this.selectSourceHost();

        const target =
            this.selectInternalDestination();


        if (
            !source ||
            !target
        ) {

            return this.generateICMP();

        }


        const packet =
            this.basePacket(
                "ARP",
                source,
                {

                    ip:
                        target.ip,

                    hostname:
                        target.hostname,

                    mac:
                        target.mac ||
                        null,

                    external:
                        false,

                    destinationType:
                        "INTERNAL",

                    reputation:
                        "INTERNAL",

                    threatScore:
                        0,

                    country:
                        null,

                    destinationMAC:
                        "ff:ff:ff:ff:ff:ff"

                }
            );


        if (
            !packet
        ) {
            return null;
        }


        packet.length =
            42;


        packet.arp = {

            hardwareType:
                "Ethernet",

            protocolType:
                "IPv4",

            operation:
                "Who has",

            senderMAC:
                source.mac ||
                null,

            senderIP:
                source.ip,

            targetMAC:
                target.mac ||
                null,

            targetIP:
                target.ip

        };


        return packet;

    }


    // =========================================================
    // ICMP
    // =========================================================

    generateICMP() {

        const source =
            this.selectSourceHost();

        const destination =
            this.selectInternalDestination();


        if (
            !source ||
            !destination
        ) {

            return null;

        }


        const packet =
            this.basePacket(
                "ICMP",
                source,
                {

                    ip:
                        destination.ip,

                    hostname:
                        destination.hostname,

                    mac:
                        destination.mac ||
                        null,

                    external:
                        false,

                    destinationType:
                        "INTERNAL",

                    reputation:
                        "INTERNAL",

                    threatScore:
                        0,

                    country:
                        null,

                    destinationMAC:
                        destination.mac ||
                        null

                }
            );


        if (
            !packet
        ) {
            return null;
        }


        packet.length =
            this.randomPacketLength(
                74,
                98
            );


        packet.icmp = {

            type:
                8,

            typeName:
                "Echo Request",

            code:
                0,

            sequence:
                Math.floor(
                    Math.random() *
                    65536
                )

        };


        return packet;

    }


    // =========================================================
    // STATUS
    // =========================================================

    getStatus() {

        return {

            running:
                this.running,

            paused:
                this.paused,

            backgroundStarted:
                this.backgroundStarted,

            packetNumber:
                this.packetNumber,

            threatLevel:
                this.threatLevel,

            subscribers:
                this.subscribers.size,

            activeCampaigns:
                this.getActiveCampaigns().length,

            eventEngineConnected:
                Boolean(
                    this.eventEngine
                )

        };

    }


    // =========================================================
    // DESTROY
    // =========================================================

    destroy() {

        this.stop();


        this.backgroundStarted =
            false;


        this.subscribers.clear();


        if (
            this.eventEngineUnsubscribe
        ) {

            this.eventEngineUnsubscribe();

            this.eventEngineUnsubscribe =
                null;

        }


        if (
            this.eventEngineCheckTimer
        ) {

            clearInterval(
                this.eventEngineCheckTimer
            );

            this.eventEngineCheckTimer =
                null;

        }


        this.eventEngine =
            null;


        this.campaigns.clear();


        console.log(
            "[PACKET ENGINE] Destroyed."
        );

    }

}


// =========================================================
// GLOBAL INSTANCE
// =========================================================

window.packetEngine =
    new PacketEngine();


console.log(
    "%c[PACKET ENGINE] ONLINE",
    "color:#69d99a;font-weight:bold;"
);


console.log(
    "[PACKET ENGINE] Corporate hosts:",
    HOSTS.length
);


console.log(
    "[PACKET ENGINE] DNS:",
    NETWORK.dns?.hostname,
    NETWORK.dns?.ip
);


console.log(
    "[PACKET ENGINE] MAC inventory:",
    HOSTS.filter(
        host =>
            host?.mac
    ).length,
    "/",
    HOSTS.length
);