/* =========================================================
   NORTHSTAR SOC — ENDPOINT STORE
   File: endpoints/EndpointStore.js

   REWRITTEN to run entirely on real simulation data instead
   of an invented parallel roster:

   - Hosts come from ../data/hosts.js (HOSTS) — the SAME array
     reference AttackEngine reads and mutates directly. When
     isolateHost() sets host.isolated = true here, that is the
     literal object AttackEngine.performLateralMovement() checks
     with `!host.isolated` — isolating a host through this UI
     genuinely blocks the live attacker from reaching it.

   - Users come from ../data/users.js (USERS).

   - Alerts come from window.alertManager.getAllAlerts(),
     filtered by alert.sourceEvent.hostname — that's the real
     field DetectionEngine sets when it creates an alert.

   - All other host activity (logins, connections, processes,
     timeline) is derived from window.eventEngine.getAllEvents(),
     filtered by event.hostname / event.sourceIP / event.destinationIP.
     Nothing here is invented — if the simulation hasn't emitted
     an event yet, there's nothing to show, which is honest.

   Status/risk are DERIVED, not stored — a host's risk badge
   now genuinely reflects its live compromised/alert state
   instead of a fixed label that never changes.
   ========================================================= */

import { HOSTS } from "../data/hosts.js";
import { USERS } from "../data/users.js";

/*
 * Northstar's public-facing edge/gateway IP — the reference
 * point for "this is us" vs "this is external." Uses the
 * 203.0.113.0/24 block, reserved by RFC 5737 for
 * documentation/example use. The real simulation doesn't
 * define an org-wide public IP of its own, so this stays a
 * clearly-labeled reference point rather than invented "real"
 * data.
 */
export const NORTHSTAR_PUBLIC_IP = "203.0.113.10";

export function isInternalIp(ip) {
    return String(ip || "").startsWith("10.10.");
}


export const ENDPOINT_STORE_EVENTS = {
    STATE_CHANGED: "endpoint:state-changed",
    HOST_SELECTED: "endpoint:host-selected",
    HOST_ISOLATED: "endpoint:host-isolated",
    HOST_UNISOLATED: "endpoint:host-unisolated"
};


export class EndpointStore {

    constructor() {

        this.state = {
            selectedHostId: null,
            activeTab: "SYSTEM",
            searchQuery: "",
            statusFilter: "ALL"
        };

        this.listeners = new Set();

        /*
         * Tracks which PROCESS_START events the analyst has
         * reviewed, for the UI's "Reviewed" label. The real
         * effect lives on host.processTerminated, mutated
         * directly in terminateProcess() below — AttackEngine
         * checks that flag before Discovery/Lateral Movement.
         */
        this.acknowledgedProcessEventIds = new Set();

        /*
         * Analyst score — rewards correctly targeting a real
         * threat, penalizes acting on a host/process that
         * wasn't actually a problem. See isolateHost() and
         * terminateProcess() below.
         */
        this.score = 0;
        this.scoreLog = [];
        this.disruptedApps = [];
    }


    /* =====================================================
       SUBSCRIPTIONS
       ===================================================== */

    subscribe(listener) {

        if (typeof listener !== "function") {
            throw new TypeError("EndpointStore.subscribe requires a function.");
        }

        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    notify(eventName, payload = {}) {

        const event = { type: eventName, payload };

        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error("[ENDPOINT STORE] Subscriber error:", error);
            }
        });
    }


    /* =====================================================
       LIVE ENGINE ACCESS
       ---------------------------------------------------
       Defensive — Endpoints can be opened before/without the
       rest of the simulation running, so every access here
       degrades to an empty list rather than throwing.
       ===================================================== */

    getAllAlerts() {

        const manager = window.alertManager;

        if (!manager || typeof manager.getAllAlerts !== "function") {
            return [];
        }

        return manager.getAllAlerts();
    }

    getAllEvents() {

        const engine = window.eventEngine;

        if (!engine || typeof engine.getAllEvents !== "function") {
            return [];
        }

        return engine.getAllEvents();
    }


    /* =====================================================
       HOST READ ACCESS
       ===================================================== */

    getHosts() {
        return HOSTS;
    }

    getHost(hostId) {
        return HOSTS.find(host => host.id === hostId) || null;
    }

    getHostByHostname(hostname) {
        return HOSTS.find(
            host => host.hostname.toLowerCase() === String(hostname).toLowerCase()
        ) || null;
    }

    getUser(username) {

        if (!username) {
            return null;
        }

        return USERS.find(user => user.username === username) || null;
    }

    getSelectedHost() {
        if (!this.state.selectedHostId) return null;
        return this.getHost(this.state.selectedHostId);
    }

    getVisibleHosts() {

        const query =
            this.state.searchQuery.trim().toLowerCase();

        const statusFilter =
            this.state.statusFilter;

        return HOSTS.filter(host => {

            const derivedStatus =
                this.computeStatus(host);

            const matchesStatus =
                statusFilter === "ALL" || derivedStatus === statusFilter;

            if (!matchesStatus) {
                return false;
            }

            if (!query) {
                return true;
            }

            const user =
                this.getUser(host.assignedUser);

            const searchable = [
                host.hostname,
                host.ip,
                host.assignedUser,
                host.operatingSystem,
                user?.displayName
            ].join(" ").toLowerCase();

            return searchable.includes(query);
        });
    }

    getCounts() {

        return {
            total: HOSTS.length,
            online: HOSTS.filter(h => this.computeStatus(h) === "ONLINE").length,
            offline: HOSTS.filter(h => this.computeStatus(h) === "OFFLINE").length,
            compromised: HOSTS.filter(h => this.computeStatus(h) === "COMPROMISED").length,
            isolated: HOSTS.filter(h => h.isolated).length
        };
    }


    /* =====================================================
       DERIVED STATUS / RISK
       ---------------------------------------------------
       Computed fresh every call, not cached — so a badge
       genuinely updates the moment the live simulation (or
       an analyst action) changes the underlying host/alerts.
       ===================================================== */

    computeStatus(host) {

        if (host.isolated) return "ISOLATED";

        /*
         * BUGFIX (giveaway): "COMPROMISED" used to come straight
         * from the raw host.compromised ground-truth flag, so
         * the host list, the ALL/ONLINE/COMPROMISED/ISOLATED
         * filter tabs, and the count badge told the player
         * exactly which machine was compromised before they'd
         * looked at a single alert. It now only shows
         * COMPROMISED once real correlated alerts actually earn
         * a CRITICAL risk rating — same discipline as
         * Files/VpnStore use.
         */
        if (this.computeRisk(host) === "CRITICAL") return "COMPROMISED";

        return String(host.status || "online").toUpperCase();
    }

    computeRisk(host) {

        const unresolved =
            this.getAlertsForHost(host.hostname).filter(
                alert => alert.status !== "RESOLVED" && alert.status !== "FALSE_POSITIVE"
            );

        if (unresolved.some(a => a.severity === "CRITICAL")) return "CRITICAL";
        if (unresolved.some(a => a.severity === "HIGH")) return "HIGH";
        if (unresolved.some(a => a.severity === "MEDIUM")) return "MEDIUM";

        return "LOW";
    }

    getLastActivity(host) {

        const events =
            this.getEventsForHost(host.hostname);

        if (!events.length) {
            return null;
        }

        return events.reduce(
            (latest, event) =>
                new Date(event.timestamp) > new Date(latest) ? event.timestamp : latest,
            events[0].timestamp
        );
    }


    /* =====================================================
       PER-HOST EVENT / ALERT ACCESS
       ===================================================== */

    getEventsForHost(hostname) {

        const host =
            this.getHostByHostname(hostname);

        return this.getAllEvents().filter(event =>
            event.hostname === hostname ||
            (host && event.sourceIP === host.ip) ||
            (host && event.destinationIP === host.ip)
        );
    }

    /**
     * BUGFIX (giveaway): the login table and timeline used to
     * flag a row "ATTACKER" straight from event.actorType — the
     * raw ground-truth flag — which named the threat actor (and
     * even their country, in the timeline) before the analyst
     * had looked at a single alert. This flags an individual
     * event only once a real correlated alert actually
     * references it, same discipline as Files/VpnStore.
     */
    isFlaggedEvent(event) {

        if (!event?.id) {
            return false;
        }

        return this.getAllAlerts().some(alert =>
            alert.status !== "RESOLVED" &&
            alert.status !== "FALSE_POSITIVE" &&
            (alert.sourceEvent?.id === event.id || alert.eventIds?.includes(event.id))
        );
    }

    getAlertsForHost(hostname) {

        return this.getAllAlerts().filter(
            alert => alert.sourceEvent?.hostname === hostname
        );
    }

    getLoginEventsForHost(hostname) {

        return this.getEventsForHost(hostname).filter(
            event => ["AUTH_SUCCESS", "AUTH_FAILURE"].includes(event.eventType)
        );
    }

    getProcessEventsForHost(hostname) {

        return this.getEventsForHost(hostname).filter(
            event => event.eventType === "PROCESS_START"
        );
    }

    getNetworkEventsForHost(hostname) {

        return this.getEventsForHost(hostname).filter(
            event => event.sourceIP || event.destinationIP
        );
    }

    getTimelineEvents(hostId) {

        const host =
            this.getHost(hostId);

        if (!host) {
            return [];
        }

        return this.getEventsForHost(host.hostname)
            .slice()
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }


    /* =====================================================
       SELECTION / UI STATE
       ===================================================== */

    selectHost(hostId) {

        const host = this.getHost(hostId);

        if (!host) {
            return false;
        }

        this.state.selectedHostId = hostId;
        this.state.activeTab = "SYSTEM";

        this.notify(ENDPOINT_STORE_EVENTS.HOST_SELECTED, { hostId });

        return true;
    }

    clearSelection() {
        this.state.selectedHostId = null;
        this.notify(ENDPOINT_STORE_EVENTS.STATE_CHANGED);
    }

    setActiveTab(tab) {
        this.state.activeTab = tab;
        this.notify(ENDPOINT_STORE_EVENTS.STATE_CHANGED, { tab });
    }

    setSearchQuery(query) {
        this.state.searchQuery = String(query || "");
        this.notify(ENDPOINT_STORE_EVENTS.STATE_CHANGED);
    }

    setStatusFilter(status) {
        this.state.statusFilter = status;
        this.notify(ENDPOINT_STORE_EVENTS.STATE_CHANGED);
    }


    /* =====================================================
       SCORE
       ===================================================== */

    getScore() {
        return this.score;
    }

    getScoreLog() {
        return this.scoreLog;
    }

    getDisruptedApps() {
        return this.disruptedApps;
    }

    getDisruptedAppsForHost(hostId) {
        return this.disruptedApps.filter(entry => entry.hostId === hostId);
    }

    applyScore(delta, reason) {

        this.score += delta;

        this.scoreLog.push({
            timestamp: new Date().toISOString(),
            delta,
            reason
        });

        this.notify(ENDPOINT_STORE_EVENTS.STATE_CHANGED);
    }

    /**
     * A host is a justified isolation target if it's actually
     * compromised, or has an unresolved HIGH/CRITICAL alert.
     * Isolating anything else has no security benefit — it
     * just cuts off a real employee's access for nothing.
     */
    isIsolationJustified(host) {

        if (host.compromised) {
            return true;
        }

        return this.getAlertsForHost(host.hostname).some(alert =>
            (alert.severity === "HIGH" || alert.severity === "CRITICAL") &&
            alert.status !== "RESOLVED" &&
            alert.status !== "FALSE_POSITIVE"
        );
    }


    /* =====================================================
       ANALYST ACTIONS
       ---------------------------------------------------
       isolateHost/unisolateHost mutate the REAL host object
       from data/hosts.js — the same array AttackEngine reads.
       This is not cosmetic: performLateralMovement() filters
       on `!host.isolated`, so isolating a host here genuinely
       removes it as a target for the live simulated attacker.

       Isolating an unjustified host is still allowed — an
       analyst can always choose to do it — but it costs real
       score. No confirmation prompt: warning the analyst first
       would tip them off that the host isn't actually
       compromised, which is the answer the game is asking them
       to work out for themselves.
       ===================================================== */

    isolateHost(hostId) {

        const host = this.getHost(hostId);

        if (!host || host.isolated) {
            return { success: false };
        }

        const justified =
            this.isIsolationJustified(host);

        /*
         * Deliberately no confirmation prompt here, even for an
         * unjustified isolation — a warning would tip the analyst
         * off that the host isn't actually compromised, handing
         * them the answer instead of letting them make the call.
         * They find out via score/feedback after the fact, same
         * as every other analyst action in this build.
         */
        host.isolated = true;

        this.emitToEventEngine({
            eventType: "HOST_ISOLATED",
            severity: "INFO",
            hostname: host.hostname,
            message: `Analyst isolated ${host.hostname} from the network.`
        });

        /*
         * Scored silently — no live feedback, no confirmation
         * dialog. The analyst decides based on their own read
         * of the evidence, same as a real SOC call, and finds
         * out whether they were right at the end of the
         * session, not in the moment.
         */
        if (justified) {
            this.applyScore(10, `Correctly isolated ${host.hostname}, which was actually compromised.`);
        } else {
            const user = this.getUser(host.assignedUser);
            this.applyScore(
                -15,
                `Isolated ${host.hostname} with no justification — cut off ${user?.displayName || host.assignedUser || "an employee"} for nothing.`
            );
        }

        this.notify(ENDPOINT_STORE_EVENTS.HOST_ISOLATED, { hostId });

        return { success: true, wasJustified: justified };
    }

    unisolateHost(hostId) {

        const host = this.getHost(hostId);

        if (!host || !host.isolated) {
            return { success: false };
        }

        host.isolated = false;

        this.emitToEventEngine({
            eventType: "HOST_UNISOLATED",
            severity: "INFO",
            hostname: host.hostname,
            message: `Analyst restored network access to ${host.hostname}.`
        });

        this.notify(ENDPOINT_STORE_EVENTS.HOST_UNISOLATED, { hostId });

        return { success: true };
    }

    /**
     * Correctly terminating the malicious process (the event's
     * actorType is "ATTACKER") sets host.processTerminated =
     * true on the REAL host object — AttackEngine checks this
     * flag before Discovery/Lateral Movement and abandons the
     * attack if it's set.

     * Terminating an ORDINARY business process (no attacker —
     * see EndpointProcessBridge) has a real downside instead:
     * it costs score and disrupts whatever that app actually
     * did, same spirit as isolating an innocent host.
     */
    terminateProcess(hostId, eventId) {

        const host = this.getHost(hostId);

        if (!host) {
            return { success: false };
        }

        const event =
            this.getAllEvents().find(item => item.id === eventId);

        if (!event) {
            return { success: false };
        }

        this.acknowledgedProcessEventIds.add(eventId);

        const wasMalicious =
            event.actorType === "ATTACKER";

        if (wasMalicious) {

            host.processTerminated = true;

            this.emitToEventEngine({
                eventType: "PROCESS_TERMINATED",
                severity: "INFO",
                hostname: host.hostname,
                message: `Analyst terminated the malicious process on ${host.hostname}.`
            });

            this.applyScore(10, `Correctly terminated the malicious process on ${host.hostname}.`);

        } else {

            const impact =
                event.metadata?.impact ||
                `Terminated a legitimate process (${event.process}) on ${host.hostname}.`;

            this.disruptedApps.push({
                hostId,
                hostname: host.hostname,
                process: event.process,
                department: event.metadata?.department || null,
                impact
            });

            this.applyScore(-15, impact);
        }

        this.notify(ENDPOINT_STORE_EVENTS.STATE_CHANGED, { hostId, eventId });

        return { success: true, wasMalicious, impact: event.metadata?.impact || null };
    }

    isProcessAcknowledged(eventId) {
        return this.acknowledgedProcessEventIds.has(eventId);
    }


    /* =====================================================
       OPTIONAL ENGINE HOOK
       ===================================================== */

    emitToEventEngine(data) {

        if (
            typeof window !== "undefined" &&
            window.eventEngine &&
            typeof window.eventEngine.createEvent === "function"
        ) {

            try {
                window.eventEngine.createEvent(data);
            } catch (error) {
                console.warn("[ENDPOINT STORE] Could not emit to eventEngine:", error);
            }
        }
    }
}