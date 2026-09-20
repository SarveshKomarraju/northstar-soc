/* =========================================================
   NORTHSTAR SOC — VPN EVENT BRIDGE
   File: vpn/VpnEventBridge.js

   Purpose:
   Generates VPN session activity through the real
   eventEngine, same trickle pattern as MailEventBridge and
   EndpointProcessBridge:

   - Ambient (legitimate) connect/disconnect traffic from the
     real 14 users, from a broad geographic pool.
   - Occasional isolated failed logins (mistyped password,
     no real signal — shouldn't cross the 2-failure alert
     threshold on its own).
   - A rarer, deliberate "credential spray" scenario: several
     different real accounts hit from the same unfamiliar IP
     in quick succession — this is what actually exercises
     the new VPN-MULTI-ACCOUNT-SAME-IP detection rule.
   - Mirrors real AttackEngine credential-stuffing activity
     (AUTH_FAILURE/AUTH_SUCCESS from an actual attacker) as a
     matching VPN event, so the same live incident shows up
     consistently across Endpoints, VPN, and (once wired) the
     Attack Map — instead of three disconnected stories.
   ========================================================= */

import { HOSTS } from "../data/hosts.js";
import { USERS } from "../data/users.js";
import { randomVpnLocation } from "./data/vpnLocations.js";

function randomInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

function generateSessionId() {
    return `VPN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function randomIp() {
    return `${randomInt(20, 209)}.${randomInt(1, 254)}.${randomInt(1, 254)}.${randomInt(1, 254)}`;
}


export class VpnEventBridge {

    constructor(eventEngine, options = {}) {

        this.eventEngine = eventEngine;

        this.running = false;

        this.trickleTimer = null;

        /*
         * A new ambient VPN event (connect, disconnect, or
         * failure) roughly every 15-45s of real time.
         */
        this.trickleRange =
            options.trickleRange || [15000, 45000];

        /*
         * sessionId -> { username, hostname, sourceIP,
         * sourceCountry, connectedAt }. Lets us pair a later
         * disconnect with the session it's ending, and gives
         * VpnStore a live session list to compute status from.
         */
        this.activeSessions = new Map();

        this.unsubscribeAttackEvents = null;

        console.log("[VPN EVENT BRIDGE] Ready.");
    }


    /* =====================================================
       START / STOP
       ===================================================== */

    start() {

        if (this.running) {
            return;
        }

        if (!this.eventEngine) {
            console.error("[VPN EVENT BRIDGE] Missing eventEngine.");
            return;
        }

        this.running = true;

        this.scheduleNextEvent();

        if (typeof this.eventEngine.subscribe === "function") {

            this.unsubscribeAttackEvents =
                this.eventEngine.subscribe(event => this.handleRealAttackEvent(event));
        }

        console.log("[VPN EVENT BRIDGE] Online — generating VPN session activity.");
    }

    stop() {

        this.running = false;

        if (this.trickleTimer) {
            clearTimeout(this.trickleTimer);
            this.trickleTimer = null;
        }

        if (this.unsubscribeAttackEvents) {
            this.unsubscribeAttackEvents();
            this.unsubscribeAttackEvents = null;
        }

        console.log("[VPN EVENT BRIDGE] Stopped.");
    }


    /* =====================================================
       AMBIENT TRICKLE
       ===================================================== */

    scheduleNextEvent() {

        if (!this.running) {
            return;
        }

        const [min, max] = this.trickleRange;

        const delay =
            Math.floor(Math.random() * (max - min + 1)) + min;

        this.trickleTimer = setTimeout(() => {

            this.trickleTimer = null;

            this.emitAmbientEvent();

            this.scheduleNextEvent();

        }, delay);
    }

    emitAmbientEvent() {

        if (!this.running) {
            return;
        }

        const roll = Math.random();

        /*
         * Rare (~6%): a deliberate credential-spray scenario —
         * this is what actually exercises the new
         * cross-account correlation rule during normal play,
         * not just in a test script.
         */
        if (roll < 0.06) {
            this.emitCredentialSprayEvent();
            return;
        }

        /*
         * Occasional (~15%): a single isolated failed login —
         * someone mistyped their password. Deliberately does
         * NOT cross the 2-failure alert threshold, so this is
         * genuine ambiguity, not a hidden tell.
         */
        if (roll < 0.21) {
            this.emitOneOffFailedLogin();
            return;
        }

        /*
         * If there are active sessions, sometimes end one
         * instead of starting a new one.
         */
        if (roll < 0.35 && this.activeSessions.size) {
            this.disconnectRandomSession();
            return;
        }

        this.connectAmbientUser();
    }

    connectAmbientUser() {

        const user =
            USERS[randomInt(0, USERS.length - 1)];

        const host =
            HOSTS.find(h => h.assignedUser === user.username);

        if (!host) {
            /* e.g. "admin" has no assigned host — skip gracefully. */
            return;
        }

        const location =
            randomVpnLocation();

        const sessionId =
            generateSessionId();

        this.activeSessions.set(sessionId, {
            username: user.username,
            hostname: host.hostname,
            sourceIP: location.ip,
            sourceCountry: location.country,
            connectedAt: Date.now()
        });

        this.eventEngine.createEvent({
            eventType: "VPN_CONNECTED",
            severity: "INFO",
            sourceIP: location.ip,
            destinationIP: host.ip,
            hostname: host.hostname,
            username: user.username,
            sourceCountry: location.country,
            message: `${user.username} connected via VPN from ${location.country}.`,
            metadata: {
                sessionId,
                device: host.hostname,
                authStatus: "SUCCESS"
            }
        });
    }

    disconnectRandomSession() {

        const ids =
            [...this.activeSessions.keys()];

        if (!ids.length) {
            return;
        }

        const sessionId =
            ids[randomInt(0, ids.length - 1)];

        const session =
            this.activeSessions.get(sessionId);

        if (!session) {
            return;
        }

        const durationMs =
            Date.now() - session.connectedAt;

        this.eventEngine.createEvent({
            eventType: "VPN_DISCONNECTED",
            severity: "INFO",
            sourceIP: session.sourceIP,
            hostname: session.hostname,
            username: session.username,
            sourceCountry: session.sourceCountry,
            message: `${session.username}'s VPN session ended.`,
            metadata: {
                sessionId,
                durationMs
            }
        });

        this.activeSessions.delete(sessionId);
    }

    emitOneOffFailedLogin() {

        const user =
            USERS[randomInt(0, USERS.length - 1)];

        const location =
            randomVpnLocation();

        this.eventEngine.createEvent({
            eventType: "VPN_LOGIN_FAILED",
            severity: "INFO",
            sourceIP: location.ip,
            username: user.username,
            sourceCountry: location.country,
            message: `${user.username} failed a VPN authentication attempt.`,
            metadata: {
                failureCount: 1
            }
        });
    }

    /**
     * Several different real accounts, same unfamiliar IP,
     * in quick succession — the scenario the new
     * VPN-MULTI-ACCOUNT-SAME-IP rule exists to catch. Not
     * tied to the 3 real attacker IPs on purpose — this is
     * its own independent incident type, so VPN's suspicious
     * activity isn't 100% dependent on the main attack chain
     * happening to be active.
     */
    emitCredentialSprayEvent() {

        const sprayIp =
            randomIp();

        /*
         * Deliberately NOT "Unknown" — that would be its own
         * free tell (every spray row instantly recognizable
         * by a blank-looking location, no investigation
         * needed). Give it an ordinary-looking country like
         * everything else; the only real signal is the same
         * IP showing up under different usernames.
         */
        const sprayCountry =
            randomVpnLocation().country;

        const victimCount =
            randomInt(2, 3);

        const shuffledUsers =
            [...USERS].sort(() => Math.random() - 0.5).slice(0, victimCount);

        shuffledUsers.forEach((user, index) => {

            const isLastAttempt =
                index === shuffledUsers.length - 1;

            const succeeded =
                isLastAttempt && Math.random() < 0.35;

            if (succeeded) {

                const host =
                    HOSTS.find(h => h.assignedUser === user.username);

                this.eventEngine.createEvent({
                    eventType: "VPN_CONNECTED",
                    severity: "HIGH",
                    sourceIP: sprayIp,
                    destinationIP: host?.ip || null,
                    hostname: host?.hostname || null,
                    username: user.username,
                    sourceCountry: sprayCountry,
                    message: `${user.username} authenticated via VPN from an IP that had also been used to target other accounts.`,
                    metadata: {
                        sessionId: generateSessionId(),
                        device: host?.hostname || "UNKNOWN",
                        authStatus: "SUCCESS"
                    }
                });

            } else {

                this.eventEngine.createEvent({
                    eventType: "VPN_LOGIN_FAILED",
                    severity: "MEDIUM",
                    sourceIP: sprayIp,
                    username: user.username,
                    sourceCountry: sprayCountry,
                    message: `${user.username} failed a VPN authentication attempt.`,
                    metadata: {
                        failureCount: 1
                    }
                });
            }
        });
    }


    /* =====================================================
       REAL ATTACK MIRRORING
       ---------------------------------------------------
       When AttackEngine's actual attacker attempts
       credentials against a real host, mirror it as a VPN
       event too — same incident, consistent across apps.
       ===================================================== */

    handleRealAttackEvent(event) {

        if (!event || event.actorType !== "ATTACKER") {
            return;
        }

        if (
            event.eventType !== "AUTH_FAILURE" &&
            event.eventType !== "AUTH_SUCCESS"
        ) {
            return;
        }

        const isFailure =
            event.eventType === "AUTH_FAILURE";

        this.eventEngine.createEvent({
            eventType: isFailure ? "VPN_LOGIN_FAILED" : "VPN_CONNECTED",
            severity: event.severity,
            actor: event.actor,
            actorType: event.actorType,
            sourceIP: event.sourceIP,
            destinationIP: event.destinationIP,
            hostname: event.hostname,
            username: event.username,
            sourceCountry: event.sourceCountry,
            attackId: event.attackId,
            message: isFailure
                ? "Failed VPN authentication attempt associated with an active simulated attack."
                : "VPN session established, associated with an active simulated attack.",
            metadata: isFailure
                ? { failureCount: event.metadata?.failureCount || 1 }
                : { sessionId: generateSessionId(), device: event.hostname, authStatus: "SUCCESS" }
        });
    }
}