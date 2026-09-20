/* =========================================================
   NORTHSTAR SOC — PROCESS TREE STORE
   File: ransomware/ProcessTreeStore.js

   Generic endpoint-process investigation store — NOT
   ransomware-specific, despite living in the ransomware/
   folder for now (spec section 8 asks for this to be reusable
   beyond ransomware, e.g. by a future Worm campaign).

   Reads real PID/PPID telemetry directly off
   window.eventEngine — any event whose metadata carries a
   numeric `pid` becomes a node. RansomwareEngine.runExecution()
   already emits exactly that shape; any future campaign that
   does the same shows up here automatically, with zero
   changes to this file.

   Detection status is derived from window.alertManager, never
   from a raw ground-truth "suspicious" flag — same
   anti-giveaway discipline EndpointStore.isFlaggedEvent() and
   FileExplorerStore already use elsewhere in NORTHSTAR. A
   process's own `status` (ACTIVE/TERMINATED) is legitimate
   telemetry (like `ps` output) and is shown directly; whether
   it was ever actually suspicious is not.
   ========================================================= */

export const PROCESS_TREE_EVENTS = {
    STATE_CHANGED: "processtree:state-changed"
};

export class ProcessTreeStore {

    constructor() {

        this.state = {
            selectedHostname: null,
            selectedProcessKey: null,
            searchQuery: ""
        };

        this.listeners = new Set();
        this.eventEngineUnsubscribe = null;
        this.connectRetryTimer = null;

        this.connectEventEngine();
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

    notify(eventName = PROCESS_TREE_EVENTS.STATE_CHANGED, payload = {}) {

        this.listeners.forEach(listener => {
            try { listener({ type: eventName, payload }); }
            catch (error) { console.error("[PROCESS TREE STORE] Listener error:", error); }
        });
    }


    /* =====================================================
       EVENT ENGINE CONNECTION
       ---------------------------------------------------
       Same connect-and-retry pattern NetworkStore already
       uses for PacketEngine — Process Tree can be opened
       before or after the rest of the simulation has booted.
       ===================================================== */

    connectEventEngine() {

        const engine = window.eventEngine;

        if (engine && typeof engine.subscribe === "function" && !this.eventEngineUnsubscribe) {

            this.eventEngineUnsubscribe = engine.subscribe(event => {

                if (event?.metadata && Number.isFinite(event.metadata.pid)) {
                    this.notify();
                }
            });

            if (this.connectRetryTimer) {
                clearInterval(this.connectRetryTimer);
                this.connectRetryTimer = null;
            }

            return;
        }

        if (!this.connectRetryTimer) {
            this.connectRetryTimer = setInterval(() => this.connectEventEngine(), 500);
        }
    }

    destroy() {

        if (this.eventEngineUnsubscribe) {
            this.eventEngineUnsubscribe();
            this.eventEngineUnsubscribe = null;
        }

        if (this.connectRetryTimer) {
            clearInterval(this.connectRetryTimer);
            this.connectRetryTimer = null;
        }
    }


    /* =====================================================
       LIVE ENGINE ACCESS
       ===================================================== */

    getAllEvents() {

        const engine = window.eventEngine;

        return (engine && typeof engine.getAllEvents === "function")
            ? engine.getAllEvents()
            : [];
    }

    getAllAlerts() {

        const manager = window.alertManager;

        return (manager && typeof manager.getAllAlerts === "function")
            ? manager.getAllAlerts()
            : [];
    }

    /**
     * Optional live status overrides from any running campaign
     * engine that keeps its own process ground-truth (today:
     * RansomwareEngine, whose terminateProcess() flips a
     * process's status to TERMINATED the instant an analyst
     * acts). Defensive — absent for hosts with no such engine,
     * and a future Worm engine slots in the same way with one
     * more line added to `engines` below.
     */
    getCampaignProcessOverrides() {

        const overrides = new Map();

        const engines = [window.ransomwareEngine].filter(Boolean);

        engines.forEach(engineInstance => {

            const campaign =
                typeof engineInstance.getCampaign === "function"
                    ? engineInstance.getCampaign()
                    : null;

            if (!campaign || !Array.isArray(campaign.processes)) {
                return;
            }

            campaign.processes.forEach(process => {
                overrides.set(`${campaign.affectedHostname}:${process.pid}`, process.status);
            });
        });

        return overrides;
    }


    /* =====================================================
       PROCESS DERIVATION
       ===================================================== */

    getProcessEvents() {

        return this.getAllEvents().filter(event =>
            event.hostname && event.metadata && Number.isFinite(event.metadata.pid)
        );
    }

    getHosts() {

        const hostnames = new Set(
            this.getProcessEvents().map(event => event.hostname)
        );

        return [...hostnames].sort().map(hostname => {

            const processes = this.getProcessesForHost(hostname);

            return {
                hostname,
                total: processes.length,
                active: processes.filter(p => p.status === "ACTIVE").length,
                terminated: processes.filter(p => p.status === "TERMINATED").length,
                suspiciousUnresolved: processes.filter(p =>
                    this.getDetectionStatus(p).flagged && p.status === "ACTIVE"
                ).length
            };
        });
    }

    getProcessesForHost(hostname) {

        if (!hostname) return [];

        const overrides = this.getCampaignProcessOverrides();

        const byPid = new Map();

        this.getProcessEvents()
            .filter(event => event.hostname === hostname)
            .forEach(event => {

                const pid = event.metadata.pid;
                const key = `${hostname}:${pid}`;
                const overrideStatus = overrides.get(key);

                byPid.set(key, {
                    key,
                    pid,
                    ppid: Number.isFinite(event.metadata.ppid) ? event.metadata.ppid : null,
                    hostname,
                    username: event.username || null,
                    processName: event.process || "unknown.exe",
                    parentProcessName: event.metadata.parentProcess || null,
                    commandLine: event.metadata.commandLine || event.command || null,
                    integrityLevel: event.metadata.integrityLevel || null,
                    startTime: event.metadata.startTime || event.timestamp,
                    status: overrideStatus || event.metadata.status || "ACTIVE",
                    eventId: event.id,
                    eventType: event.eventType
                });
            });

        return [...byPid.values()].sort((a, b) => a.pid - b.pid);
    }

    /**
     * Builds the tree structure for a host: a process is a
     * root if its ppid is null, OR its ppid doesn't correspond
     * to any process this host has telemetry for (e.g.
     * WINWORD.EXE's real parent is explorer.exe, which never
     * generated its own tracked event — shown as an untracked
     * parent label instead of a clickable node).
     */
    buildTree(hostname) {

        const processes = this.getProcessesForHost(hostname);
        const pidSet = new Set(processes.map(p => p.pid));

        const childrenByBucket = new Map();

        processes.forEach(process => {

            const parentKnown = process.ppid !== null && pidSet.has(process.ppid);
            const bucketKey = parentKnown ? process.ppid : "ROOT";

            if (!childrenByBucket.has(bucketKey)) {
                childrenByBucket.set(bucketKey, []);
            }

            childrenByBucket.get(bucketKey).push(process);
        });

        const attachChildren = process => ({
            ...process,
            children: (childrenByBucket.get(process.pid) || []).map(attachChildren)
        });

        return (childrenByBucket.get("ROOT") || []).map(attachChildren);
    }

    getProcess(hostname, key) {
        return this.getProcessesForHost(hostname).find(p => p.key === key) || null;
    }

    getParentProcess(process) {

        if (!process || process.ppid === null) return null;

        return this.getProcessesForHost(process.hostname)
            .find(p => p.pid === process.ppid) || null;
    }

    getChildProcesses(process) {

        if (!process) return [];

        return this.getProcessesForHost(process.hostname)
            .filter(p => p.ppid === process.pid);
    }

    getAssociatedEvents(process) {

        if (!process) return [];

        return this.getAllEvents()
            .filter(event =>
                event.hostname === process.hostname &&
                (event.id === process.eventId || event.process === process.processName)
            )
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    /**
     * Anti-giveaway: a process only shows as "correlated" once
     * a real, unresolved alert actually references its
     * process-start event — never from a raw suspicious flag.
     * Same discipline as EndpointStore.isFlaggedEvent().
     */
    getDetectionStatus(process) {

        if (!process) return { flagged: false, alert: null };

        const alert = this.getAllAlerts().find(candidate =>
            candidate.status !== "RESOLVED" &&
            candidate.status !== "FALSE_POSITIVE" &&
            (candidate.sourceEvent?.id === process.eventId || candidate.eventIds?.includes(process.eventId))
        );

        return { flagged: !!alert, alert: alert || null };
    }


    /* =====================================================
       SELECTION / UI STATE
       ===================================================== */

    selectHost(hostname) {
        this.state.selectedHostname = hostname;
        this.state.selectedProcessKey = null;
        this.notify();
    }

    selectProcess(key) {
        this.state.selectedProcessKey = key;
        this.notify();
    }

    clearProcessSelection() {
        this.state.selectedProcessKey = null;
        this.notify();
    }

    setSearchQuery(query) {
        this.state.searchQuery = String(query || "");
        this.notify();
    }

    getSelectedHostname() {

        if (this.state.selectedHostname) {
            return this.state.selectedHostname;
        }

        /*
         * Default to the affected host of a running ransomware
         * campaign, if any — otherwise the first host with any
         * process telemetry at all.
         */
        const campaign = window.ransomwareEngine?.getCampaign?.();

        if (campaign?.affectedHostname && this.getProcessesForHost(campaign.affectedHostname).length) {
            return campaign.affectedHostname;
        }

        return this.getHosts()[0]?.hostname || null;
    }

    getVisibleProcesses(hostname) {

        const query = this.state.searchQuery.trim().toLowerCase();
        const processes = this.getProcessesForHost(hostname);

        if (!query) return processes;

        return processes.filter(process => [
            process.processName,
            process.parentProcessName,
            process.commandLine,
            String(process.pid)
        ].join(" ").toLowerCase().includes(query));
    }

    getSelectedProcess() {

        const hostname = this.getSelectedHostname();

        if (!hostname || !this.state.selectedProcessKey) return null;

        return this.getProcess(hostname, this.state.selectedProcessKey);
    }
}
