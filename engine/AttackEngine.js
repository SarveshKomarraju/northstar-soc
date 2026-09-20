/* =========================================================
   SOC COMMAND CENTER
   ATTACK ENGINE
   ---------------------------------------------------------
   Autonomous simulated adversary.

   IMPORTANT:
   - AttackEngine does NOT create EventEngine.
   - SimulationBootstrap creates EventEngine first and
     passes it into AttackEngine.
   - All attacker actions are emitted as telemetry.
   - Some actions fail.
   - Actions are separated by realistic delays.
   - No real network activity occurs.
   ========================================================= */

import { HOSTS } from "../data/hosts.js";
import { USERS } from "../data/users.js";


/*
 * Extracted from the constructor so other apps (the Attack
 * Map) can plot the REAL attacker infrastructure instead of
 * a disconnected, fictional IP list. Same data, same values —
 * this is purely making it importable, not changing it.
 */
export const ATTACKERS = [

    {
        id: "ACTOR-NIGHTFALL",
        name: "NIGHTFALL",
        country: "Germany",
        ip: "185.203.117.42"
    },

    {
        id: "ACTOR-RED-RAVEN",
        name: "RED RAVEN",
        country: "Romania",
        ip: "91.214.124.31"
    },

    {
        id: "ACTOR-GHOST",
        name: "GHOST LANTERN",
        country: "Netherlands",
        ip: "185.220.101.17"
    }

];


/*
 * A small pool of realistic files a compromised host's
 * attacker process might actually drop — used by
 * postCompromise() below, and exported so File Explorer
 * doesn't need to duplicate this list.
 */
export const WINDOWS_DROPPED_FILE_TEMPLATES = [

    {
        fileName: "invoice_update.ps1",
        pathTemplate: "C:\\Users\\{username}\\AppData\\Local\\Temp\\invoice_update.ps1",
        size: 4200
    },

    {
        fileName: "svch0st.exe",
        pathTemplate: "C:\\Users\\{username}\\AppData\\Roaming\\svch0st.exe",
        size: 812000
    },

    {
        fileName: "update_svc.dll",
        pathTemplate: "C:\\Windows\\Temp\\update_svc.dll",
        size: 156000
    },

    {
        fileName: "credential_helper.exe",
        pathTemplate: "C:\\Users\\{username}\\AppData\\Local\\Temp\\credential_helper.exe",
        size: 542000
    },

    {
        fileName: "sys_backup.bat",
        pathTemplate: "C:\\ProgramData\\sys_backup.bat",
        size: 1800
    }

];

/*
 * Same idea, but for the 2 macOS laptops and 2 Ubuntu
 * servers in the real roster — those shouldn't get a
 * Windows-style C:\ path.
 */
export const UNIX_DROPPED_FILE_TEMPLATES = [

    {
        fileName: "update.sh",
        pathTemplate: "/tmp/update.sh",
        size: 2100
    },

    {
        fileName: ".agent_cache",
        pathTemplate: "/home/{username}/.agent_cache",
        size: 690000
    },

    {
        fileName: "cron_helper",
        pathTemplate: "/var/tmp/cron_helper",
        size: 412000
    },

    {
        fileName: "libcache.so",
        pathTemplate: "/usr/lib/libcache.so",
        size: 128000
    },

    {
        fileName: "backup_sync.py",
        pathTemplate: "/opt/scripts/backup_sync.py",
        size: 3400
    }

];

export function getDroppedFileTemplatesForHost(host) {

    const isWindows =
        String(host?.operatingSystem || "").toLowerCase().includes("windows");

    return isWindows
        ? WINDOWS_DROPPED_FILE_TEMPLATES
        : UNIX_DROPPED_FILE_TEMPLATES;
}

/**
 * A cheap, deterministic, plausible-looking hex "hash" for a
 * simulated file — not a real hash function, just needs to
 * look and behave like one (same input always produces the
 * same output).
 */
export function pseudoFileHash(seed) {

    let hash = 0;

    const text = String(seed);

    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }

    const base =
        Math.abs(hash).toString(16).padStart(8, "0");

    return (base + base + base + base + base + base + base + base)
        .slice(0, 64)
        .toUpperCase();
}


export class AttackEngine {

    constructor(eventEngine) {

        this.eventEngine = eventEngine;

        this.running = false;

        this.attackCounter = 0;

        this.activeAttacks = new Map();

        this.maxConcurrentAttacks = 2;

        this.nextAttackTimer = null;

        this.difficulty = 1;

        this.attackers = ATTACKERS;

        this.attackTypes = [
            "PHISHING",
            "BRUTE_FORCE",
            "DISCOVERY"
        ];

        console.log(
            "[ATTACK ENGINE] Autonomous adversary ready."
        );
    }


    /* =====================================================
       START
       ===================================================== */

    start() {

        if (this.running) {
            return;
        }

        if (!this.eventEngine) {

            console.error(
                "[ATTACK ENGINE] Cannot start: EventEngine missing."
            );

            return;
        }

        this.running = true;

        console.log(
            "[ATTACK ENGINE] Autonomous adversary online."
        );

        this.scheduleNextAttack();
    }


    /* =====================================================
       STOP
       ===================================================== */

    stop() {

        this.running = false;

        if (this.nextAttackTimer) {

            clearTimeout(
                this.nextAttackTimer
            );

            this.nextAttackTimer = null;
        }

        for (
            const attack of this.activeAttacks.values()
        ) {

            if (attack.timer) {

                clearTimeout(
                    attack.timer
                );

                attack.timer = null;
            }
        }

        console.log(
            "[ATTACK ENGINE] Stopped."
        );
    }


    /* =====================================================
       DIFFICULTY
       ===================================================== */

    setDifficulty(level) {

        const newLevel =
            Math.max(
                1,
                Math.min(
                    5,
                    Number(level) || 1
                )
            );

        this.difficulty = newLevel;

        console.log(
            `[ATTACK ENGINE] Difficulty → ${this.difficulty}`
        );
    }


    /* =====================================================
       RANDOM HELPERS
       ===================================================== */

    randomItem(array) {

        if (!array || !array.length) {
            return null;
        }

        return array[
            Math.floor(
                Math.random() * array.length
            )
        ];
    }


    randomNumber(min, max) {

        return Math.floor(
            Math.random() *
            (max - min + 1)
        ) + min;
    }


    chance(probability) {

        return Math.random() < probability;
    }


    randomDelay(min, max) {

        return this.randomNumber(
            min,
            max
        );
    }


    /* =====================================================
       ATTACK SCHEDULER
       ===================================================== */

    scheduleNextAttack() {

        if (!this.running) {
            return;
        }

        if (
            this.activeAttacks.size >=
            this.maxConcurrentAttacks
        ) {

            this.nextAttackTimer =
                setTimeout(
                    () => {

                        this.scheduleNextAttack();

                    },
                    10000
                );

            return;
        }


        const ranges = {

            1: [15000, 40000],
            2: [12000, 35000],
            3: [10000, 30000],
            4: [7000, 22000],
            5: [5000, 18000]

        };


        const range =
            ranges[this.difficulty] ||
            ranges[1];


        const delay =
            this.randomDelay(
                range[0],
                range[1]
            );


        console.log(
            `[ATTACK ENGINE] Next attack in ${Math.round(
                delay / 1000
            )}s`
        );


        this.nextAttackTimer =
            setTimeout(
                () => {

                    this.nextAttackTimer = null;

                    this.launchAttack();

                    this.scheduleNextAttack();

                },
                delay
            );
    }


    /* =====================================================
       LAUNCH ATTACK
       ===================================================== */

    launchAttack() {

        if (!this.running) {
            return;
        }

        if (
            this.activeAttacks.size >=
            this.maxConcurrentAttacks
        ) {
            return;
        }


        const attacker =
            this.randomItem(
                this.attackers
            );


        const availableUsers =
            USERS.filter(
                user =>
                    user.accountStatus ===
                    "active"
            );


        const user =
            this.randomItem(
                availableUsers
            );


        if (!user) {
            return;
        }


        const host =
            HOSTS.find(
                host =>
                    host.assignedUser ===
                    user.username
            );


        if (!host) {
            return;
        }


        const type =
            this.randomItem(
                this.attackTypes
            );


        const attack = {

            id:
                `INC-${String(
                    ++this.attackCounter
                ).padStart(4, "0")}`,

            attacker,

            targetUser: user,

            targetHost: host,

            type,

            stage: "RECONNAISSANCE",

            status: "ACTIVE",

            attempts: 0,

            failures: 0,

            successes: 0,

            started:
                Date.now(),

            timer: null
        };


        this.activeAttacks.set(
            attack.id,
            attack
        );


        console.log(
            `[ATTACK ENGINE] ${attack.id} started → ${type}`
        );


        this.emitRecon(
            attack
        );


        this.scheduleAttackStep(
            attack,
            this.randomDelay(
                15000,
                45000
            )
        );
    }


    /* =====================================================
       SCHEDULE ATTACK STEP
       ===================================================== */

    scheduleAttackStep(
        attack,
        delay
    ) {

        if (!this.running) {
            return;
        }

        if (
            !this.activeAttacks.has(
                attack.id
            )
        ) {
            return;
        }


        if (attack.timer) {

            clearTimeout(
                attack.timer
            );
        }


        attack.timer =
            setTimeout(
                () => {

                    attack.timer = null;

                    this.advanceAttack(
                        attack
                    );

                },
                delay
            );
    }


    /* =====================================================
       ADVANCE STATE MACHINE
       ===================================================== */

    advanceAttack(attack) {

        if (!this.running) {
            return;
        }

        if (
            !this.activeAttacks.has(
                attack.id
            )
        ) {
            return;
        }

        if (
            attack.status !==
            "ACTIVE"
        ) {
            return;
        }


        switch (
        attack.stage
        ) {

            case "RECONNAISSANCE":

                this.sendPhishing(
                    attack
                );

                break;


            case "PHISHING_SENT":

                this.handleVictimResponse(
                    attack
                );

                break;


            case "CREDENTIAL_ATTACK":

                this.attemptCredentials(
                    attack
                );

                break;


            case "COMPROMISED":

                this.postCompromise(
                    attack
                );

                break;


            case "DISCOVERY":

                this.performDiscovery(
                    attack
                );

                break;


            case "LATERAL_MOVEMENT":

                this.performLateralMovement(
                    attack
                );

                break;


            default:

                this.abandon(
                    attack,
                    "Attack state machine completed."
                );

        }
    }


    /* =====================================================
       RECONNAISSANCE
       ===================================================== */

    emitRecon(attack) {

        this.emit({

            eventType:
                "RECONNAISSANCE",

            severity:
                "LOW",

            actor:
                attack.attacker.name,

            actorType:
                "ATTACKER",

            sourceIP:
                attack.attacker.ip,

            destinationIP:
                attack.targetHost.ip,

            hostname:
                attack.targetHost.hostname,

            username:
                attack.targetUser.username,

            sourceCountry:
                attack.attacker.country,

            attackId:
                attack.id,

            message:
                "Threat actor performed simulated reconnaissance against a target.",

            metadata: {

                technique:
                    "Target Discovery",

                simulated:
                    true

            }

        });
    }


    /* =====================================================
       PHISHING
       ===================================================== */

    sendPhishing(attack) {

        attack.stage =
            "PHISHING_SENT";


        this.emit({

            eventType:
                "PHISHING_EMAIL_SENT",

            severity:
                "MEDIUM",

            actor:
                attack.attacker.name,

            actorType:
                "ATTACKER",

            sourceIP:
                attack.attacker.ip,

            destinationIP:
                attack.targetHost.ip,

            hostname:
                attack.targetHost.hostname,

            username:
                attack.targetUser.username,

            sourceCountry:
                attack.attacker.country,

            attackId:
                attack.id,

            message:
                "Threat actor delivered a targeted phishing email.",

            metadata: {

                sender:
                    `security-alert@${attack.attacker.name.toLowerCase().replaceAll(" ", "-")}.example`,

                target:
                    attack.targetUser.email,

                campaign:
                    attack.id,

                simulated:
                    true

            }

        });


        /*
         * Victim response takes time.
         */

        this.scheduleAttackStep(
            attack,
            this.randomDelay(
                20000,
                70000
            )
        );
    }


    /* =====================================================
       VICTIM RESPONSE
       ===================================================== */

    handleVictimResponse(attack) {

        /*
         * Phishing does not automatically succeed.
         */

        const responseChance =
            Math.min(
                0.45 +
                this.difficulty * 0.04,
                0.65
            );


        if (
            !this.chance(
                responseChance
            )
        ) {

            this.emit({

                eventType:
                    "PHISHING_NO_RESPONSE",

                severity:
                    "INFO",

                actor:
                    attack.attacker.name,

                actorType:
                    "ATTACKER",

                sourceIP:
                    attack.attacker.ip,

                destinationIP:
                    attack.targetHost.ip,

                hostname:
                    attack.targetHost.hostname,

                username:
                    attack.targetUser.username,

                sourceCountry:
                    attack.attacker.country,

                attackId:
                    attack.id,

                message:
                    "Target did not interact with the phishing campaign.",

                metadata: {

                    simulated:
                        true

                }

            });


            if (
                this.chance(0.35)
            ) {

                this.abandon(
                    attack,
                    "Target did not respond."
                );

                return;
            }


            /*
             * Attacker waits and tries again.
             */

            this.scheduleAttackStep(
                attack,
                this.randomDelay(
                    30000,
                    90000
                )
            );

            return;
        }


        /*
         * IMPORTANT:
         *
         * This is a USER action, not an attacker action.
         *
         * The attacker caused the email to be delivered,
         * but the victim opened it.
         */

        this.emit({

            eventType:
                "EMAIL_OPENED",

            severity:
                "LOW",

            actor:
                attack.targetUser.username,

            actorType:
                "USER",

            sourceIP:
                attack.targetHost.ip,

            destinationIP:
                attack.targetHost.ip,

            hostname:
                attack.targetHost.hostname,

            username:
                attack.targetUser.username,

            attackId:
                attack.id,

            message:
                "Target user opened a phishing email delivered by the threat actor.",

            metadata: {

                relatedCampaign:
                    attack.id,

                simulated:
                    true

            }

        });


        attack.stage =
            "CREDENTIAL_ATTACK";


        this.scheduleAttackStep(
            attack,
            this.randomDelay(
                20000,
                60000
            )
        );
    }


    /* =====================================================
       CREDENTIAL ATTACK
       ===================================================== */

    attemptCredentials(attack) {

        attack.attempts++;


        /*
         * The attacker can fail.
         */

        const successChance =
            Math.min(
                0.20 +
                attack.attempts * 0.08 +
                this.difficulty * 0.03,
                0.60
            );


        if (
            this.chance(
                successChance
            )
        ) {

            attack.successes++;


            this.emit({

                eventType:
                    "AUTH_SUCCESS",

                severity:
                    "HIGH",

                actor:
                    attack.attacker.name,

                actorType:
                    "ATTACKER",

                sourceIP:
                    attack.attacker.ip,

                destinationIP:
                    attack.targetHost.ip,

                hostname:
                    attack.targetHost.hostname,

                username:
                    attack.targetUser.username,

                sourceCountry:
                    attack.attacker.country,

                attackId:
                    attack.id,

                message:
                    "Threat actor obtained a valid authentication session.",

                metadata: {

                    attempt:
                        attack.attempts,

                    simulated:
                        true

                }

            });


            attack.stage =
                "COMPROMISED";


            attack.targetUser.compromised =
                true;

            attack.targetHost.compromised =
                true;


            this.scheduleAttackStep(
                attack,
                this.randomDelay(
                    30000,
                    90000
                )
            );

            return;
        }


        /*
         * Failed attempt.
         */

        attack.failures++;


        this.emit({

            eventType:
                "AUTH_FAILURE",

            severity:
                attack.failures >= 3
                    ? "MEDIUM"
                    : "LOW",

            actor:
                attack.attacker.name,

            actorType:
                "ATTACKER",

            sourceIP:
                attack.attacker.ip,

            destinationIP:
                attack.targetHost.ip,

            hostname:
                attack.targetHost.hostname,

            username:
                attack.targetUser.username,

            sourceCountry:
                attack.attacker.country,

            attackId:
                attack.id,

            message:
                "Threat actor authentication attempt failed.",

            metadata: {

                attempt:
                    attack.attempts,

                failureCount:
                    attack.failures,

                simulated:
                    true

            }

        });


        if (
            attack.failures >= 4 &&
            this.chance(0.45)
        ) {

            this.abandon(
                attack,
                "Repeated authentication failures."
            );

            return;
        }


        /*
         * Wait before trying again.
         */

        this.scheduleAttackStep(
            attack,
            this.randomDelay(
                20000,
                80000
            )
        );
    }


    /* =====================================================
       POST COMPROMISE
       ===================================================== */

    postCompromise(attack) {

        this.emit({

            eventType:
                "PROCESS_START",

            severity:
                "HIGH",

            actor:
                attack.attacker.name,

            actorType:
                "ATTACKER",

            sourceIP:
                attack.attacker.ip,

            destinationIP:
                attack.targetHost.ip,

            hostname:
                attack.targetHost.hostname,

            username:
                attack.targetUser.username,

            process:
                "simulated-agent.exe",

            command:
                "simulated-agent.exe --session",

            attackId:
                attack.id,

            message:
                "Threat actor established simulated post-compromise process activity on the endpoint.",

            metadata: {

                parent:
                    "explorer.exe",

                simulated:
                    true

            }

        });


        /*
         * File Explorer needs something real to show — this
         * is the actual file the attacker's process drops on
         * the compromised host.
         */
        const fileTemplate =
            this.randomItem(getDroppedFileTemplatesForHost(attack.targetHost));

        const filePath =
            fileTemplate.pathTemplate.replace("{username}", attack.targetUser.username);

        const fileHash =
            pseudoFileHash(`${attack.id}:${fileTemplate.fileName}`);

        this.emit({

            eventType:
                "FILE_DROPPED",

            severity:
                "HIGH",

            actor:
                attack.attacker.name,

            actorType:
                "ATTACKER",

            sourceIP:
                attack.attacker.ip,

            destinationIP:
                attack.targetHost.ip,

            hostname:
                attack.targetHost.hostname,

            username:
                attack.targetUser.username,

            attackId:
                attack.id,

            message:
                `A file was dropped on ${attack.targetHost.hostname} as part of simulated post-compromise activity.`,

            metadata: {

                fileName:
                    fileTemplate.fileName,

                filePath,

                fileHash,

                fileSize:
                    fileTemplate.size,

                simulated:
                    true

            }

        });


        attack.stage =
            "DISCOVERY";


        this.scheduleAttackStep(
            attack,
            this.randomDelay(
                30000,
                90000
            )
        );
    }


    /* =====================================================
       DISCOVERY
       ===================================================== */

    performDiscovery(attack) {

        if (attack.targetHost.isolated) {

            this.abandon(
                attack,
                "Compromised host was isolated by an analyst before discovery could proceed."
            );

            return;
        }

        if (attack.targetHost.processTerminated) {

            this.abandon(
                attack,
                "Malicious process was terminated by an analyst before discovery could proceed."
            );

            return;
        }

        this.emit({

            eventType:
                "HOST_DISCOVERY",

            severity:
                "MEDIUM",

            actor:
                attack.attacker.name,

            actorType:
                "ATTACKER",

            sourceIP:
                attack.targetHost.ip,

            destinationIP:
                attack.targetHost.ip,

            hostname:
                attack.targetHost.hostname,

            username:
                attack.targetUser.username,

            sourceCountry:
                attack.attacker.country,

            attackId:
                attack.id,

            message:
                "Threat actor performed simulated internal host discovery.",

            metadata: {

                technique:
                    "Network Discovery",

                simulated:
                    true

            }

        });


        attack.stage =
            "LATERAL_MOVEMENT";


        this.scheduleAttackStep(
            attack,
            this.randomDelay(
                45000,
                120000
            )
        );
    }


    /* =====================================================
       LATERAL MOVEMENT
       ===================================================== */

    performLateralMovement(attack) {

        if (attack.targetHost.isolated) {

            this.abandon(
                attack,
                "Compromised host was isolated by an analyst before lateral movement could proceed."
            );

            return;
        }

        if (attack.targetHost.processTerminated) {

            this.abandon(
                attack,
                "Malicious process was terminated by an analyst before lateral movement could proceed."
            );

            return;
        }

        const candidates =
            HOSTS.filter(
                host =>
                    host.hostname !==
                    attack.targetHost.hostname &&
                    !host.isolated
            );


        if (!candidates.length) {

            this.abandon(
                attack,
                "No reachable simulated targets."
            );

            return;
        }


        const target =
            this.randomItem(
                candidates
            );


        this.emit({

            eventType:
                "LATERAL_MOVEMENT_ATTEMPT",

            severity:
                "HIGH",

            actor:
                attack.attacker.name,

            actorType:
                "ATTACKER",

            sourceIP:
                attack.targetHost.ip,

            destinationIP:
                target.ip,

            hostname:
                target.hostname,

            username:
                attack.targetUser.username,

            sourceCountry:
                attack.attacker.country,

            attackId:
                attack.id,

            message:
                "Threat actor attempted simulated lateral movement.",

            metadata: {

                sourceHost:
                    attack.targetHost.hostname,

                destinationHost:
                    target.hostname,

                simulated:
                    true

            }

        });


        /*
         * Lateral movement can fail.
         */

        const successChance =
            Math.min(
                0.25 +
                this.difficulty * 0.05,
                0.50
            );


        if (
            this.chance(
                successChance
            )
        ) {

            target.compromised =
                true;


            this.emit({

                eventType:
                    "HOST_COMPROMISED",

                severity:
                    "CRITICAL",

                actor:
                    attack.attacker.name,

                actorType:
                    "ATTACKER",

                sourceIP:
                    attack.targetHost.ip,

                destinationIP:
                    target.ip,

                hostname:
                    target.hostname,

                username:
                    attack.targetUser.username,

                sourceCountry:
                    attack.attacker.country,

                attackId:
                    attack.id,

                message:
                    "Threat actor gained simulated access to another internal host.",

                metadata: {

                    simulated:
                        true

                }

            });

        } else {

            this.emit({

                eventType:
                    "LATERAL_MOVEMENT_FAILED",

                severity:
                    "MEDIUM",

                actor:
                    attack.attacker.name,

                actorType:
                    "ATTACKER",

                sourceIP:
                    attack.targetHost.ip,

                destinationIP:
                    target.ip,

                hostname:
                    target.hostname,

                username:
                    attack.targetUser.username,

                sourceCountry:
                    attack.attacker.country,

                attackId:
                    attack.id,

                message:
                    "Threat actor failed to move laterally to the targeted host.",

                metadata: {

                    simulated:
                        true

                }

            });

        }


        /*
         * Continue or eventually abandon.
         */

        if (
            this.chance(0.40)
        ) {

            this.abandon(
                attack,
                "Attack sequence completed."
            );

            return;
        }


        this.scheduleAttackStep(
            attack,
            this.randomDelay(
                60000,
                150000
            )
        );
    }


    /* =====================================================
       ABANDON
       ===================================================== */

    abandon(
        attack,
        reason
    ) {

        attack.status =
            "ABANDONED";


        this.emit({

            eventType:
                "ATTACK_ABANDONED",

            severity:
                "INFO",

            actor:
                attack.attacker.name,

            actorType:
                "ATTACKER",

            sourceIP:
                attack.attacker.ip,

            destinationIP:
                attack.targetHost.ip,

            hostname:
                attack.targetHost.hostname,

            username:
                attack.targetUser.username,

            sourceCountry:
                attack.attacker.country,

            attackId:
                attack.id,

            message:
                `Threat actor abandoned the campaign: ${reason}`,

            metadata: {

                attempts:
                    attack.attempts,

                failures:
                    attack.failures,

                simulated:
                    true

            }

        });


        if (attack.timer) {

            clearTimeout(
                attack.timer
            );

            attack.timer = null;
        }


        this.activeAttacks.delete(
            attack.id
        );
    }


    /* =====================================================
       TELEMETRY
       ===================================================== */

    emit(data) {

        if (
            !this.eventEngine ||
            typeof this.eventEngine.createEvent !==
            "function"
        ) {

            console.error(
                "[ATTACK ENGINE] EventEngine unavailable."
            );

            return null;
        }


        return this.eventEngine.createEvent(
            data
        );
    }


    /* =====================================================
       ACTIVE ATTACKS
       ===================================================== */

    getActiveAttacks() {

        return Array.from(
            this.activeAttacks.values()
        );
    }


    /* =====================================================
       STATUS
       ===================================================== */

    getStatus() {

        return {

            running:
                this.running,

            difficulty:
                this.difficulty,

            activeAttacks:
                this.activeAttacks.size,

            totalAttacks:
                this.attackCounter

        };
    }
}