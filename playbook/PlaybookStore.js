/* =========================================================
   NORTHSTAR SOC — PLAYBOOK STORE
   File: playbook/PlaybookStore.js

   Purpose:
   Page navigation for the playbook itself, plus real
   incident-data lookups for the report page — pulls actual
   attackIds, hosts, and alerts from the live SIEM, same
   discipline as every other app in this build. The written
   fields (what happened, actions taken, etc.) are the
   analyst's own words, not generated.
   ========================================================= */

import { PLAYBOOK_PAGES } from "./data/playbookContent.js";
import { SENDER_DOMAIN_POOL } from "../data/phishingInfrastructure.js";

export const PLAYBOOK_STORE_EVENTS = {
    STATE_CHANGED: "playbook:state-changed"
};


export class PlaybookStore {

    constructor() {

        this.state = {
            currentPageIndex: 0,
            selectedAttackId: null,
            checkedItems: new Set(),
            reportFields: {
                summary: "",
                actionsTaken: "",
                rootCause: "",
                recommendations: ""
            }
        };

        this.listeners = new Set();
    }


    /* =====================================================
       SUBSCRIPTIONS
       ===================================================== */

    subscribe(listener) {

        if (typeof listener !== "function") {
            throw new TypeError("PlaybookStore.subscribe requires a function.");
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
                console.error("[PLAYBOOK STORE] Subscriber error:", error);
            }
        });
    }


    /* =====================================================
       PAGES
       ===================================================== */

    getPages() {
        return PLAYBOOK_PAGES;
    }

    getCurrentPage() {
        return PLAYBOOK_PAGES[this.state.currentPageIndex] || PLAYBOOK_PAGES[0];
    }

    goToPage(index) {

        if (index < 0 || index >= PLAYBOOK_PAGES.length) {
            return;
        }

        this.state.currentPageIndex = index;

        this.notify(PLAYBOOK_STORE_EVENTS.STATE_CHANGED);
    }

    nextPage() {
        this.goToPage(this.state.currentPageIndex + 1);
    }

    previousPage() {
        this.goToPage(this.state.currentPageIndex - 1);
    }

    canGoNext() {
        return this.state.currentPageIndex < PLAYBOOK_PAGES.length - 1;
    }

    canGoPrevious() {
        return this.state.currentPageIndex > 0;
    }


    /* =====================================================
       LIVE ENGINE ACCESS
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
       REAL INCIDENT LOOKUP (for the report page)
       ===================================================== */

    getKnownIncidents() {

        const events =
            this.getAllEvents().filter(event => !!event.attackId);

        const byAttackId = new Map();

        events.forEach(event => {

            if (!byAttackId.has(event.attackId)) {

                byAttackId.set(event.attackId, {
                    attackId: event.attackId,
                    firstSeen: event.timestamp,
                    hostnames: new Set(),
                    usernames: new Set(),
                    actor: event.actor || null,
                    actorType: event.actorType || null,
                    eventCount: 0
                });
            }

            const incident =
                byAttackId.get(event.attackId);

            incident.eventCount += 1;

            if (event.hostname) incident.hostnames.add(event.hostname);
            if (event.username) incident.usernames.add(event.username);

            if (new Date(event.timestamp) < new Date(incident.firstSeen)) {
                incident.firstSeen = event.timestamp;
            }

            if (!incident.actor && event.actor) {
                incident.actor = event.actor;
                incident.actorType = event.actorType;
            }
        });

        return [...byAttackId.values()]
            .map(incident => ({
                ...incident,
                hostnames: [...incident.hostnames],
                usernames: [...incident.usernames]
            }))
            .sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen));
    }

    selectIncident(attackId) {

        this.state.selectedAttackId = attackId;

        this.notify(PLAYBOOK_STORE_EVENTS.STATE_CHANGED);
    }

    getSelectedIncident() {

        if (!this.state.selectedAttackId) {
            return null;
        }

        return this.getKnownIncidents().find(
            incident => incident.attackId === this.state.selectedAttackId
        ) || null;
    }

    getAlertsForIncident(attackId) {

        if (!attackId) {
            return [];
        }

        return this.getAllAlerts().filter(alert => alert.attackId === attackId);
    }

    getTimelineForIncident(attackId) {

        if (!attackId) {
            return [];
        }

        return this.getAllEvents()
            .filter(event => event.attackId === attackId)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }


    /* =====================================================
       NIGHTFALL EVIDENCE STATUS (for the report page)
       ---------------------------------------------------
       Which of the 6 Nightfall lure domains already have a
       screenshot/recording captured — read straight from real
       FILE_CREATED/isCapture events tagged by CaptureTool.js
       while that domain's page was on screen in Malware
       Sandbox (see MalwareSandboxApp.js). Marcus won't accept
       the incident report (MailStore.sendReport()) until all
       6 are covered — this just makes that visible before the
       player tries to send.
       ===================================================== */

    getNightfallEvidenceStatus() {

        const capturedDomains =
            new Set(
                this.getAllEvents()
                    .filter(event =>
                        event.eventType === "FILE_CREATED" &&
                        event.metadata?.isCapture &&
                        event.metadata?.nightfallDomain
                    )
                    .map(event => event.metadata.nightfallDomain)
            );

        return SENDER_DOMAIN_POOL.map(domain => ({
            domain,
            captured: capturedDomains.has(domain)
        }));
    }


    /* =====================================================
       LOCKED EVIDENCE STATUS (for the report page)
       ---------------------------------------------------
       Whether the 2 locked shared-evidence artifacts
       (credential vault + finance archive) have actually been
       cracked in Password Cracker — read live from
       window.fileExplorerStore, the same store File Explorer
       itself uses for lock state. Marcus won't accept the
       incident report until both are unlocked; this just
       makes that visible before the player tries to send.
       ===================================================== */

    getLockedEvidenceStatus() {

        const store =
            window.fileExplorerStore;

        const sharedFiles =
            store?.getSharedFiles?.() || [];

        return sharedFiles
            .filter(file => file.scenarioArtifact && file.locked)
            .map(file => ({
                name: file.name,
                unlocked: !!store?.isFileUnlocked?.(file)
            }));
    }


    /* =====================================================
       CHECKLIST — kept on the store (not the renderer) so it
       survives the app being closed and reopened, same as
       currentPageIndex/reportFields already do via the
       window.playbookStore singleton.
       ===================================================== */

    toggleChecklistItem(key) {

        if (this.state.checkedItems.has(key)) {
            this.state.checkedItems.delete(key);
        } else {
            this.state.checkedItems.add(key);
        }

        this.notify(PLAYBOOK_STORE_EVENTS.STATE_CHANGED);
    }

    isChecklistItemChecked(key) {
        return this.state.checkedItems.has(key);
    }


    /* =====================================================
       REPORT FIELDS — the analyst's own words
       ===================================================== */

    setReportField(field, value) {

        if (!(field in this.state.reportFields)) {
            return;
        }

        this.state.reportFields[field] = value;

        /*
         * Intentionally no notify() here. The textarea the
         * player is typing into already shows the new value —
         * it's their own keystroke. Notifying would trigger a
         * full re-render that replaces the textarea DOM node,
         * killing focus and cursor position on every single
         * keystroke (it looked like typing "didn't work").
         * Other views that read reportFields (e.g. reopening
         * the report page) pick up the change on their next
         * natural render.
         */
    }

    getReportFields() {
        return this.state.reportFields;
    }
}