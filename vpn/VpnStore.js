/* =========================================================
   NORTHSTAR SOC — VPN STORE
   File: vpn/VpnStore.js

   Two halves, same as the renderer:

   - The analyst's OWN VPN client (connect/disconnect, location,
     kill switch, auto-connect, telemetry, trace-risk cycle).
     Pure flavor/OPSEC minigame — nothing here is investigative
     data, so getExposureRisk()/the trace diagram can't leak
     anything about the real incident. Risk only ever depends on
     whether you're connected and whether the VPN exit country
     you picked is NORTHSTAR's own "home turf" (United States
     (East)/(West) — the first two entries in VPN_LOCATIONS) —
     never on the real attacker(s)' location.

   - COMPANY VPN ACTIVITY: read live from window.eventEngine
     (VPN_* events, produced by VpnEventBridge) and
     window.alertManager, exactly like Endpoints/Files/VpnStore
     elsewhere in this codebase. Nothing is invented and nothing
     is pre-labeled "suspicious" — isFlaggedVpnEvent() only ever
     flags a row once a real correlated, unresolved alert
     actually references that event's id (same discipline as
     EndpointStore.isFlaggedEvent / FileExplorerStore risk).
   ========================================================= */

import { VPN_LOCATIONS } from "./data/vpnLocations.js";

/*
 * NORTHSTAR's own home countries — the first two VPN_LOCATIONS
 * entries. Picking one of these still routes your traffic
 * through the same jurisdiction the whole case is already
 * happening in ("routed through the same country as the case —
 * still an easy target"). Anything else counts as clear of
 * home turf. This is about the analyst's own OPSEC choice, not
 * about the real attacker(s) — nothing here is derived from
 * ATTACKERS or any other ground-truth investigative data.
 */
const HOME_TURF_COUNTRIES = [
    VPN_LOCATIONS[0].country,
    VPN_LOCATIONS[1].country
];

/*
 * Shown as a speech-bubble taunt over the attacker icon in the
 * trace diagram the instant an "exposed" incident lands — see
 * VpnRenderer.renderTraceDiagram().
 */
const ATTACKER_TAUNTS = [
    "Got you.",
    "There you are.",
    "That's a real IP.",
    "Nice try with the tunnel.",
    "We see you now.",
    "Traced.",
    "Hello, NORTHSTAR."
];

function randomInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

function pickTaunt() {
    return ATTACKER_TAUNTS[randomInt(0, ATTACKER_TAUNTS.length - 1)];
}


export class VpnStore {

    constructor() {

        this.state = {

            connected: false,
            connectedAt: null,

            selectedLocation: VPN_LOCATIONS[0],

            protocol: "WireGuard",

            latency: 0,
            download: 0,
            upload: 0,

            killSwitch: true,
            autoConnect: false,

            connectionHistory: [],

            logSearchQuery: "",

            lastIncident: null,

            /*
             * Drives the trace-risk diagram's marker animation —
             * see VpnRenderer.renderTraceDiagram().
             */
            cycleStartedAt: null,
            cycleDurationMs: 15000,

            /*
             * Set once, permanently, the first time a trace
             * attempt actually lands without the kill switch
             * catching it. getExposureRisk() then always returns
             * "BREACHED" for the rest of the session — "this
             * already happened once this session — it isn't
             * going to happen again."
             */
            breached: false
        };

        this.listeners = new Set();

        this.telemetryInterval = null;
        this.exposureTimer = null;
        this.safeIncidentTimer = null;

        /*
         * The trace-risk cycle runs for the whole session,
         * independent of whether the VPN window is even open —
         * same as any other background simulation timer in this
         * build (PacketEngine, the various EventBridges). Only
         * the telemetry interval is tied to the window being
         * mounted (see VpnRenderer.mount()/destroy()).
         */
        this.resyncExposureCycle();
    }


    /* =====================================================
       SUBSCRIBE / NOTIFY
       ===================================================== */

    subscribe(callback) {

        if (typeof callback !== "function") {
            return () => { };
        }

        this.listeners.add(callback);

        return () => {
            this.listeners.delete(callback);
        };
    }

    notify() {

        this.listeners.forEach(callback => {

            try {
                callback(this.state);
            } catch (error) {
                console.error("[VPN STORE]", error);
            }
        });
    }


    /* =====================================================
       LIVE ENGINE ACCESS
       ---------------------------------------------------
       Defensive — VPN can be opened before/without the rest
       of the simulation running, so every access here
       degrades to an empty list rather than throwing.
       ===================================================== */

    getAllEvents() {

        const engine = window.eventEngine;

        if (!engine || typeof engine.getAllEvents !== "function") {
            return [];
        }

        return engine.getAllEvents();
    }

    getAllAlerts() {

        const manager = window.alertManager;

        if (!manager || typeof manager.getAllAlerts !== "function") {
            return [];
        }

        return manager.getAllAlerts();
    }


    /* =====================================================
       COMPANY VPN ACTIVITY (real log)
       ===================================================== */

    getVpnEvents() {

        return this.getAllEvents()
            .filter(event =>
                typeof event.eventType === "string" &&
                event.eventType.startsWith("VPN_")
            )
            .slice()
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    getVisibleVpnEvents() {

        const query =
            this.state.logSearchQuery.trim().toLowerCase();

        const events =
            this.getVpnEvents();

        if (!query) {
            return events;
        }

        return events.filter(event => {

            const haystack = [
                event.username,
                event.sourceIP,
                event.sourceCountry,
                event.hostname,
                (event.eventType || "").replace(/_/g, " ")
            ].filter(Boolean).join(" ").toLowerCase();

            return haystack.includes(query);
        });
    }

    /**
     * A VPN log row is only ever "flagged" via a real correlated,
     * unresolved alert that actually references this event's id
     * (VPN-REPEATED-FAILURE, VPN-KNOWN-ATTACKER-IP or
     * VPN-MULTI-ACCOUNT-SAME-IP — see DetectionEngine) — never
     * from a raw ground-truth field like event.actorType. Same
     * discipline as EndpointStore.isFlaggedEvent /
     * FileExplorerStore's alert-driven risk.
     */
    isFlaggedVpnEvent(event) {

        if (!event?.id) {
            return false;
        }

        return this.getAllAlerts().some(alert =>
            alert.status !== "RESOLVED" &&
            alert.status !== "FALSE_POSITIVE" &&
            (alert.sourceEvent?.id === event.id || alert.eventIds?.includes(event.id))
        );
    }

    setLogSearchQuery(value) {

        this.state.logSearchQuery = String(value ?? "");

        this.notify();
    }


    /* =====================================================
       CONNECTION
       ===================================================== */

    toggleConnection() {

        if (this.state.connected) {
            this.disconnect("DISCONNECTED");
        } else {
            this.connect();
        }
    }

    connect() {

        if (this.state.connected) {
            return;
        }

        this.state.connected = true;
        this.state.connectedAt = Date.now();

        this.logHistory("CONNECTED");

        this.startTelemetry();

        this.resyncExposureCycle();

        this.notify();
    }

    disconnect(reason = "DISCONNECTED") {

        if (!this.state.connected) {
            return;
        }

        this.state.connected = false;
        this.state.connectedAt = null;

        this.stopTelemetry();

        this.logHistory(reason);

        this.resyncExposureCycle();

        this.notify();
    }

    getSessionDuration() {

        if (!this.state.connected || !this.state.connectedAt) {
            return 0;
        }

        return Date.now() - this.state.connectedAt;
    }

    setLocation(location) {

        if (!location) {
            return;
        }

        this.state.selectedLocation = location;

        this.logHistory("LOCATION CHANGED");

        this.resyncExposureCycle();

        this.notify();
    }


    /* =====================================================
       FEATURES
       ===================================================== */

    setKillSwitch(enabled) {

        this.state.killSwitch = !!enabled;

        this.logHistory(`KILL SWITCH ${this.state.killSwitch ? "ENABLED" : "DISABLED"}`);

        this.notify();
    }

    setAutoConnect(enabled) {

        this.state.autoConnect = !!enabled;

        this.notify();
    }


    /* =====================================================
       TELEMETRY
       ---------------------------------------------------
       Only runs while the tunnel is "up" and only while the
       VPN window is mounted (see VpnRenderer.mount()/
       destroy()) — the numbers themselves are pure flavor,
       not simulation state anything else reads.
       ===================================================== */

    startTelemetry() {

        this.stopTelemetry();

        this.rollTelemetry();

        this.telemetryInterval = setInterval(() => {

            this.rollTelemetry();

            this.notify();

        }, 4000);
    }

    rollTelemetry() {

        this.state.latency = randomInt(18, 64);
        this.state.download = (Math.random() * 70 + 40).toFixed(1);
        this.state.upload = (Math.random() * 20 + 8).toFixed(1);
    }

    stopTelemetry() {

        if (this.telemetryInterval) {
            clearInterval(this.telemetryInterval);
            this.telemetryInterval = null;
        }
    }


    /* =====================================================
       EXPOSURE RISK / TRACE CYCLE
       ---------------------------------------------------
       LOW/MEDIUM/HIGH/BREACHED, purely a function of the
       analyst's own connection state + chosen exit country —
       see the HOME_TURF_COUNTRIES comment up top. Never
       derived from the real attacker(s) or any other
       investigative ground truth.
       ===================================================== */

    getExposureRisk() {

        if (this.state.breached) {
            return "BREACHED";
        }

        if (!this.state.connected) {
            return "HIGH";
        }

        const location = this.state.selectedLocation;

        if (location && HOME_TURF_COUNTRIES.includes(location.country)) {
            return "MEDIUM";
        }

        return "LOW";
    }

    exposureCycleDuration() {

        switch (this.getExposureRisk()) {

            case "HIGH":
                return randomInt(8000, 12000);

            case "MEDIUM":
                return randomInt(16000, 22000);

            default:
                return randomInt(26000, 34000);
        }
    }

    /**
     * (Re)starts the countdown to the next trace attempt, with a
     * duration matching the CURRENT risk tier. Called on init and
     * any time something could change that tier (connect,
     * disconnect, location change) or after a check resolves.
     * Stops scheduling entirely once BREACHED — there's nothing
     * left to count down to.
     */
    resyncExposureCycle() {

        if (this.exposureTimer) {
            clearTimeout(this.exposureTimer);
            this.exposureTimer = null;
        }

        if (this.state.breached) {
            this.state.cycleStartedAt = null;
            return;
        }

        const duration =
            this.exposureCycleDuration();

        this.state.cycleStartedAt = Date.now();
        this.state.cycleDurationMs = duration;

        this.exposureTimer = setTimeout(() => {

            this.exposureTimer = null;

            this.runExposureCheck();

        }, duration);
    }

    /**
     * One trace attempt against the analyst's own connection.
     * HIGH tier (not connected at all) fails most of the time;
     * MEDIUM/LOW succeed rarely. A success while connected with
     * the kill switch on gets intercepted (tunnel cut, you're
     * disconnected, nothing leaks) instead of counting as a real
     * breach.
     */
    runExposureCheck() {

        const risk =
            this.getExposureRisk();

        if (risk === "BREACHED") {
            return;
        }

        const chance =
            risk === "HIGH" ? 0.55 :
                risk === "MEDIUM" ? 0.22 :
                    0.07;

        if (Math.random() < chance) {

            if (this.state.connected && this.state.killSwitch) {

                this.state.connected = false;
                this.state.connectedAt = null;

                this.stopTelemetry();

                this.logHistory("KILL SWITCH TRIGGERED");

                this.resyncExposureCycle();

                this.setIncident(
                    "blocked",
                    "A trace attempt started landing — the kill switch cut your tunnel before any real traffic could leak. You've been disconnected."
                );

            } else {

                this.state.breached = true;

                this.logHistory("EXPOSURE - COMPROMISED");

                this.resyncExposureCycle();

                this.setIncident(
                    "exposed",
                    "A trace attempt succeeded — your real connection was exposed.",
                    { attackerMessage: pickTaunt() }
                );
            }

        } else {

            this.resyncExposureCycle();

            this.setIncident(
                "safe",
                "A trace attempt was made against your connection and came back empty."
            );
        }
    }


    /* =====================================================
       INCIDENT BANNER
       ===================================================== */

    setIncident(kind, message, extra = {}) {

        if (this.safeIncidentTimer) {
            clearTimeout(this.safeIncidentTimer);
            this.safeIncidentTimer = null;
        }

        const incident = {
            kind,
            message,
            timestamp: Date.now(),
            ...extra
        };

        this.state.lastIncident = incident;

        this.notify();

        /*
         * "safe" is the common case — it auto-dismisses so it
         * doesn't need to be manually cleared every few seconds.
         * "blocked"/"exposed" stick around until the analyst
         * dismisses them.
         */
        if (kind === "safe") {

            this.safeIncidentTimer = setTimeout(() => {

                this.safeIncidentTimer = null;

                if (this.state.lastIncident === incident) {
                    this.dismissIncident();
                }

            }, 4500);
        }
    }

    dismissIncident() {

        this.state.lastIncident = null;

        this.notify();
    }


    /* =====================================================
       CONNECTION HISTORY
       ===================================================== */

    logHistory(type) {

        const location =
            this.state.selectedLocation || VPN_LOCATIONS[0];

        this.state.connectionHistory.unshift({
            type,
            country: location.country,
            ip: location.ip,
            timestamp: Date.now()
        });

        if (this.state.connectionHistory.length > 25) {
            this.state.connectionHistory.length = 25;
        }
    }


    /* =====================================================
       DESTROY
       ---------------------------------------------------
       The store is a singleton (window.vpnStore) that
       outlives any one VPN window — see VpnRenderer.mount()'s
       comment. Only the telemetry interval is torn down here;
       "connected", history, and the exposure cycle all survive
       so reopening the app doesn't reset any of them.
       ===================================================== */

    destroy() {

        this.stopTelemetry();
    }
}
