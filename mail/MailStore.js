/* =========================================================
   NORTHSTAR SOC — MAIL STORE
   File: mail/MailStore.js

   CHANGED:
   - emails is now a real mutable array seeded with a small
     benign inbox (buildSeedEmails()), not a shared reference
     to a giant static dataset.
   - Added receiveEmail() so MailEventBridge (or anything
     else) can deliver new mail while the app is running,
     whether or not the Mail window is currently open.
   - Added sendReport() for the Compose → incident-report flow.
   - getEmail/getCurrentFolderEmails/getSearchResults/etc. now
     all read from this.state.emails directly instead of the
     old static import, which never actually reflected store
     mutations.
   ========================================================= */

import {
    MAIL_FOLDERS,
    EMAIL_CATEGORIES,
    AUTH_STATUS,
    findEmailById,
    filterEmailsByFolder,
    searchEmailsIn,
    createEmail,
    isLikelyIncidentReport,
    buildBossWarningEmail,
    buildFollowUpEmail
} from "./data/emails.js";

import {
    isCompanyAddress,
    PLAYER,
    BOSS
} from "./data/company.js";

import {
    SENDER_DOMAIN_POOL
} from "../data/phishingInfrastructure.js";


/* =========================================================
   STORE EVENTS
   ========================================================= */

export const MAIL_STORE_EVENTS = {
    STATE_CHANGED: "mail:state-changed",

    EMAIL_SELECTED: "mail:email-selected",

    EMAIL_RECEIVED: "mail:email-received",

    EMAIL_READ: "mail:email-read",

    EMAIL_UNREAD: "mail:email-unread",

    EMAIL_STARRED: "mail:email-starred",

    EMAIL_UNSTARRED: "mail:email-unstarred",

    EMAIL_FLAGGED: "mail:email-flagged",

    EMAIL_UNFLAGGED: "mail:email-unflagged",

    EMAIL_QUARANTINED: "mail:email-quarantined",

    FOLDER_CHANGED: "mail:folder-changed",

    SEARCH_CHANGED: "mail:search-changed",

    INVESTIGATION_CHANGED: "mail:investigation-changed",

    LABEL_CHANGED: "mail:label-changed",

    REPORT_SENT: "mail:report-sent"
};


/* =========================================================
   DEFAULT STATE
   ========================================================= */

function createInitialState() {

    /*
     * Inbox starts EMPTY. Emails (benign trickle + attacker-
     * driven phishing) only arrive once MailEventBridge is
     * running, in step with the rest of the simulation — the
     * player should never see mail before the scenario has
     * actually sent it.
     */
    const seedEmails = [];

    return {

        emails: seedEmails,

        currentFolder: MAIL_FOLDERS.INBOX,

        selectedEmailId:
            seedEmails.length > 0
                ? seedEmails[0].id
                : null,

        searchQuery: "",

        searchActive: false,

        readState: new Map(
            seedEmails.map(email => [email.id, Boolean(email.read)])
        ),

        starredState: new Map(
            seedEmails.map(email => [email.id, Boolean(email.starred)])
        ),

        importantState: new Map(
            seedEmails.map(email => [email.id, Boolean(email.important)])
        ),

        flaggedState: new Map(),

        quarantinedState: new Map(),

        userLabelState: new Map(),

        archivedState: new Map(),

        deletedState: new Map(),

        investigations: new Map(),

        linkAnalysis: new Map(),

        attachmentAnalysis: new Map(),

        headerViews: new Map(),

        authenticationChecks: new Map(),

        showFullHeaders: false,

        activeInvestigationPanel: null,

        selectedLinkId: null,

        selectedAttachmentId: null,

        composeOpen: false,

        reportsSent: [],

        initialized: false,

        lastUpdated: Date.now()
    };
}


/* =========================================================
   AUTO-RESPONSE TIMING
   ---------------------------------------------------------
   Coworker/boss auto-replies wait a realistic-feeling amount
   of time rather than firing almost instantly — nobody reads
   and answers an email in 4 seconds.
   ========================================================= */

function randomReplyDelay() {

    const minMs = 70 * 1000;
    const maxMs = 180 * 1000;

    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}


/* =========================================================
   MAIL STORE CLASS
   ========================================================= */

export class MailStore {

    constructor() {

        this.state = createInitialState();

        this.listeners = new Set();

        this.eventListeners = new Map();

        this.state.initialized = true;

        /*
         * Analyst score — same pattern as EndpointStore's
         * isolate/terminate scoring. Quarantining an email that
         * is actually malicious (email.simulation.malicious,
         * the same ground-truth flag AttackEngine sets on the
         * real phishing email) is a correct containment call;
         * quarantining an ordinary/benign email has a real
         * downside, same spirit as isolating an innocent host.
         * scoredQuarantineIds prevents farming points by
         * toggling quarantine/release/quarantine on the same
         * email repeatedly.
         */
        this.score = 0;

        this.scoreLog = [];

        this.scoredQuarantineIds = new Set();
    }


    /* =====================================================
       SUBSCRIPTIONS
       ===================================================== */

    subscribe(listener) {

        if (typeof listener !== "function") {
            throw new TypeError("MailStore.subscribe requires a function.");
        }

        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    on(eventName, listener) {

        if (typeof listener !== "function") {
            throw new TypeError("MailStore.on requires a function.");
        }

        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, new Set());
        }

        const listeners = this.eventListeners.get(eventName);

        listeners.add(listener);

        return () => {
            listeners.delete(listener);
            if (listeners.size === 0) {
                this.eventListeners.delete(eventName);
            }
        };
    }

    notify(eventName, payload = {}) {

        this.state.lastUpdated = Date.now();

        const event = {
            type: eventName,
            payload,
            state: this.getSnapshot()
        };

        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error("[MAIL STORE] Subscriber error:", error);
            }
        });

        const eventListeners = this.eventListeners.get(eventName);

        if (!eventListeners) {
            return;
        }

        eventListeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error(`[MAIL STORE] ${eventName} listener error:`, error);
            }
        });
    }


    /* =====================================================
       STATE ACCESS
       ===================================================== */

    getSnapshot() {

        return {
            ...this.state,

            readState: new Map(this.state.readState),
            starredState: new Map(this.state.starredState),
            importantState: new Map(this.state.importantState),
            flaggedState: new Map(this.state.flaggedState),
            quarantinedState: new Map(this.state.quarantinedState),
            userLabelState: new Map(this.state.userLabelState),
            archivedState: new Map(this.state.archivedState),
            deletedState: new Map(this.state.deletedState),
            investigations: new Map(this.state.investigations),
            linkAnalysis: new Map(this.state.linkAnalysis),
            attachmentAnalysis: new Map(this.state.attachmentAnalysis),
            headerViews: new Map(this.state.headerViews),
            authenticationChecks: new Map(this.state.authenticationChecks)
        };
    }

    getSelectedEmail() {

        if (!this.state.selectedEmailId) {
            return null;
        }

        return this.getEmail(this.state.selectedEmailId);
    }

    getEmail(emailId) {

        const email = findEmailById(this.state.emails, emailId);

        if (!email) {
            return null;
        }

        return this.applyStateToEmail(email);
    }

    applyStateToEmail(email) {

        return {
            ...email,

            read:
                this.state.readState.get(email.id) ?? email.read,

            starred:
                this.state.starredState.get(email.id) ?? email.starred,

            important:
                this.state.importantState.get(email.id) ?? email.important,

            flagged:
                this.state.flaggedState.has(email.id),

            quarantined:
                this.state.quarantinedState.has(email.id),

            userLabel:
                this.state.userLabelState.get(email.id) || null,

            archived:
                this.state.archivedState.has(email.id),

            deleted:
                this.state.deletedState.has(email.id)
        };
    }


    /* =====================================================
       RECEIVE A NEW EMAIL (live delivery)
       ---------------------------------------------------
       Called by MailEventBridge (SIEM/attack-driven mail)
       or the benign trickle timer. Works whether or not the
       Mail window is currently open, since the store is a
       singleton owned by SimulationBootstrap.
       ===================================================== */

    receiveEmail(email) {

        if (!email || !email.id) {
            console.warn("[MAIL STORE] receiveEmail() called with an invalid email.");
            return false;
        }

        if (findEmailById(this.state.emails, email.id)) {
            /* Don't double-deliver the same campaign/id. */
            return false;
        }

        this.state.emails.push(email);

        this.state.readState.set(email.id, Boolean(email.read));
        this.state.starredState.set(email.id, Boolean(email.starred));
        this.state.importantState.set(email.id, Boolean(email.important));

        this.notify(MAIL_STORE_EVENTS.EMAIL_RECEIVED, {
            emailId: email.id,
            email: this.getEmail(email.id)
        });

        return true;
    }


    /* =====================================================
       SEND INCIDENT REPORT (Compose flow)
       ---------------------------------------------------
       This does not attempt to grade the report — it records
       it as a sent email and fires REPORT_SENT so scenario /
       scoring code elsewhere can subscribe and evaluate it.
       ===================================================== */

    sendReport({ to, subject, body, attachments = [] }) {

        const recipient =
            String(to || "").trim();

        if (!recipient || !subject || !body) {
            return { success: false, reason: "MISSING_FIELDS" };
        }

        if (!isCompanyAddress(recipient)) {
            return { success: false, reason: "INVALID_RECIPIENT" };
        }

        /*
         * Only enforced once this actually looks like a real
         * incident report (same "incident"/"report" keyword
         * check used below to decide whether Marcus treats it
         * as one at all) — a nonsense test subject still just
         * gets his usual "this doesn't look like a report"
         * reply, it doesn't also get blocked on evidence.
         *
         * Two kinds of required evidence, checked together so
         * the player sees everything still missing in one shot
         * instead of fixing one gate at a time:
         *
         * 1. Each of the 6 Nightfall lure domains (data/
         *    phishingInfrastructure.js's SENDER_DOMAIN_POOL)
         *    needs its own screenshot/recording attached —
         *    tagged automatically by CaptureTool.js while that
         *    domain's page was actually on screen in Malware
         *    Sandbox, not self-reported by the player.
         * 2. Both locked shared-evidence artifacts (credential
         *    vault + finance archive — files/data/ambientFiles.js's
         *    NORTHSTAR_SCENARIO_FILES) need to actually be
         *    cracked in Password Cracker — checked live via
         *    window.fileExplorerStore, the same store File
         *    Explorer itself reads lock state from.
         */
        if (isLikelyIncidentReport(subject)) {

            const attachmentList =
                Array.isArray(attachments) ? attachments : [];

            const capturedDomains =
                new Set(
                    attachmentList
                        .map(attachment => attachment?.nightfallDomain)
                        .filter(Boolean)
                );

            const missingDomains =
                SENDER_DOMAIN_POOL.filter(
                    domain => !capturedDomains.has(domain)
                );

            const sharedFiles =
                window.fileExplorerStore?.getSharedFiles?.() || [];

            const stillLockedFiles =
                sharedFiles
                    .filter(file => file.scenarioArtifact && file.locked)
                    .filter(file => !window.fileExplorerStore.isFileUnlocked(file))
                    .map(file => file.name);

            if (missingDomains.length > 0 || stillLockedFiles.length > 0) {

                return {
                    success: false,
                    reason: "INCOMPLETE_EVIDENCE",
                    missingDomains,
                    stillLockedFiles
                };

            }

        }

        const reportEmail = createEmail({
            id: `MAIL-REPORT-${Date.now()}`,
            folder: MAIL_FOLDERS.SENT,
            timestamp: new Date().toISOString(),
            read: true,
            category: EMAIL_CATEGORIES.REPORT,
            from: { name: `${PLAYER.name} (You)`, address: PLAYER.address },
            to: [recipient],
            subject,
            preview: body.slice(0, 140),
            body: { format: "text", content: body },
            attachments: Array.isArray(attachments) ? attachments : [],
            headers: {
                messageId: `<report-${Date.now()}@northstar.local>`,
                returnPath: `<${PLAYER.address}>`,
                originatingIP: "10.20.4.10",
                authenticationResults: "spf=pass; dkim=pass; dmarc=pass",
                receivedSPF: "pass",
                userAgent: "NORTHSTAR Mail"
            },
            authentication: {
                spf: AUTH_STATUS.PASS,
                dkim: AUTH_STATUS.PASS,
                dmarc: AUTH_STATUS.PASS
            },
            classification: EMAIL_CATEGORIES.REPORT
        });

        this.state.emails.push(reportEmail);

        this.state.readState.set(reportEmail.id, true);

        const record = {
            id: reportEmail.id,
            to: recipient,
            subject,
            body,
            timestamp: reportEmail.timestamp
        };

        /*
         * BUGFIX: only count this as an actual submitted
         * incident report (reportsSent / REPORT_SENT) when it
         * passed the isLikelyIncidentReport() check above. This
         * used to fire unconditionally for ANY successfully
         * sent company-address email, which let a player unlock
         * the Nightfall ending (MalwareSandboxApp.js's
         * getReportsSent().length > 0 gate) by sending a
         * throwaway one-line email to any @northstar.local
         * address — completely bypassing the evidence
         * requirement this same function enforces above.
         */
        if (isLikelyIncidentReport(subject)) {

            this.state.reportsSent.push(record);

            this.notify(MAIL_STORE_EVENTS.REPORT_SENT, record);

        }

        this.state.composeOpen = false;

        /*
         * Grading a real incident report is a future feature.
         * For now: only react when this clearly wasn't one —
         * Marcus sends a short warning back. Slight delay so
         * it doesn't feel instant/robotic.
         */
        if (!isLikelyIncidentReport(subject)) {

            setTimeout(() => {

                const warningEmail =
                    buildBossWarningEmail({ originalSubject: subject });

                this.receiveEmail(warningEmail);

            }, randomReplyDelay());
        }

        return { success: true, email: reportEmail };
    }


    /* =====================================================
       DEV / TEST ONLY — SKIP REPORT GATE
       ---------------------------------------------------
       Sends a fully-valid incident report instantly, bypassing
       both the subject-line check and the evidence-completeness
       gate sendReport() enforces above. Exists purely so the
       Malware Sandbox → Nightfall ending → AI grading pipeline
       can be smoke-tested without grinding through 6 Nightfall
       screenshots and 2 Password Cracker unlocks every single
       time. Not reachable through any normal player flow — only
       from the "DEV: SKIP REPORT GATE" button in Malware
       Sandbox's Investigation Actions panel.
       ===================================================== */

    devSendTestReport() {

        const subject =
            "Incident Report — Credential Theft Campaign (Operation Nightfall) [DEV TEST]";

        const body =
            "Marcus,\n\n" +
            "This is a developer test report used to smoke-test the " +
            "reporting pipeline — evidence gating was intentionally " +
            "skipped for this send. It exists only to verify the " +
            "Nightfall ending and AI grading connect end to end, not " +
            "to represent an actual finished investigation.\n\n" +
            "— John Smith (dev test)";

        const reportEmail = createEmail({
            id: `MAIL-REPORT-${Date.now()}`,
            folder: MAIL_FOLDERS.SENT,
            timestamp: new Date().toISOString(),
            read: true,
            category: EMAIL_CATEGORIES.REPORT,
            from: { name: `${PLAYER.name} (You)`, address: PLAYER.address },
            to: [BOSS.address],
            subject,
            preview: body.slice(0, 140),
            body: { format: "text", content: body },
            attachments: [],
            headers: {
                messageId: `<report-dev-${Date.now()}@northstar.local>`,
                returnPath: `<${PLAYER.address}>`,
                originatingIP: "10.20.4.10",
                authenticationResults: "spf=pass; dkim=pass; dmarc=pass",
                receivedSPF: "pass",
                userAgent: "NORTHSTAR Mail (dev test)"
            },
            authentication: {
                spf: AUTH_STATUS.PASS,
                dkim: AUTH_STATUS.PASS,
                dmarc: AUTH_STATUS.PASS
            },
            classification: EMAIL_CATEGORIES.REPORT
        });

        this.state.emails.push(reportEmail);

        this.state.readState.set(reportEmail.id, true);

        const record = {
            id: reportEmail.id,
            to: BOSS.address,
            subject,
            body,
            timestamp: reportEmail.timestamp
        };

        this.state.reportsSent.push(record);

        this.notify(MAIL_STORE_EVENTS.REPORT_SENT, record);

        return { success: true, email: reportEmail };

    }


    /* =====================================================
       SEND A REGULAR MESSAGE (Reply / general compose)
       ---------------------------------------------------
       Same company-domain restriction as sendReport, but
       filed as a normal message rather than an incident
       report. Used by the Reply flow and any future
       "message a coworker" feature.
       ===================================================== */

    sendEmail({ to, subject, body, cc = [], inReplyToEmailId = null, attachments = [] }) {

        const recipient =
            String(to || "").trim();

        if (!recipient || !subject || !body) {
            return { success: false, reason: "MISSING_FIELDS" };
        }

        if (!isCompanyAddress(recipient)) {
            return { success: false, reason: "INVALID_RECIPIENT" };
        }

        const invalidCc =
            (cc || []).filter(address => !isCompanyAddress(address));

        if (invalidCc.length) {
            return { success: false, reason: "INVALID_RECIPIENT", invalidCc };
        }

        const sentEmail = createEmail({
            id: `MAIL-SENT-${Date.now()}`,
            folder: MAIL_FOLDERS.SENT,
            timestamp: new Date().toISOString(),
            read: true,
            category: EMAIL_CATEGORIES.NORMAL,
            from: { name: `${PLAYER.name} (You)`, address: PLAYER.address },
            to: [recipient],
            cc,
            subject,
            preview: body.slice(0, 140),
            body: { format: "text", content: body },
            attachments: Array.isArray(attachments) ? attachments : [],
            headers: {
                messageId: `<sent-${Date.now()}@northstar.local>`,
                returnPath: `<${PLAYER.address}>`,
                originatingIP: "10.20.4.10",
                authenticationResults: "spf=pass; dkim=pass; dmarc=pass",
                receivedSPF: "pass",
                userAgent: "NORTHSTAR Mail"
            },
            authentication: {
                spf: AUTH_STATUS.PASS,
                dkim: AUTH_STATUS.PASS,
                dmarc: AUTH_STATUS.PASS
            },
            classification: EMAIL_CATEGORIES.NORMAL
        });

        this.state.emails.push(sentEmail);

        this.state.readState.set(sentEmail.id, true);

        this.notify(MAIL_STORE_EVENTS.STATE_CHANGED, {
            action: "EMAIL_SENT",
            emailId: sentEmail.id
        });

        /*
         * If this reply was to a coworker's "can you review
         * this" email, have them respond with a short
         * acknowledgment — makes the thread feel alive.
         */
        if (inReplyToEmailId) {

            const original =
                findEmailById(this.state.emails, inReplyToEmailId);

            if (
                original &&
                original.simulation?.reviewRequest &&
                original.simulation?.followUpKey
            ) {

                setTimeout(() => {

                    const followUp =
                        buildFollowUpEmail(
                            original.simulation.followUpKey,
                            { replyBody: body }
                        );

                    if (followUp) {
                        this.receiveEmail(followUp);
                    }

                }, randomReplyDelay());
            }
        }

        return { success: true, email: sentEmail };
    }

    getReportsSent() {
        return [...this.state.reportsSent];
    }


    /* =====================================================
       COMPOSE UI STATE
       ===================================================== */

    openCompose() {
        this.state.composeOpen = true;
        this.notify(MAIL_STORE_EVENTS.STATE_CHANGED, { action: "COMPOSE_OPEN" });
    }

    closeCompose() {
        this.state.composeOpen = false;
        this.notify(MAIL_STORE_EVENTS.STATE_CHANGED, { action: "COMPOSE_CLOSE" });
    }


    /* =====================================================
       FOLDER MANAGEMENT
       ===================================================== */

    setFolder(folder) {

        const validFolders = Object.values(MAIL_FOLDERS);

        if (!validFolders.includes(folder)) {
            console.warn(`[MAIL STORE] Unknown folder: ${folder}`);
            return false;
        }

        this.state.currentFolder = folder;
        this.state.searchQuery = "";
        this.state.searchActive = false;
        this.state.selectedEmailId = this.getFirstEmailIdInFolder(folder);
        this.state.showFullHeaders = false;
        this.state.activeInvestigationPanel = null;
        this.state.selectedLinkId = null;
        this.state.selectedAttachmentId = null;

        this.notify(MAIL_STORE_EVENTS.FOLDER_CHANGED, { folder });

        return true;
    }

    getCurrentFolderEmails() {

        const folder = this.state.currentFolder;

        let emails;

        if (folder === MAIL_FOLDERS.STARRED) {
            emails = this.state.emails.filter(email => this.state.starredState.get(email.id));
        } else if (folder === MAIL_FOLDERS.QUARANTINE) {
            emails = this.state.emails.filter(email => this.state.quarantinedState.has(email.id));
        } else {
            emails = filterEmailsByFolder(this.state.emails, folder);
        }

        return emails
            .filter(email => !this.state.deletedState.has(email.id))
            .map(email => this.applyStateToEmail(email));
    }

    getFirstEmailIdInFolder(folder) {

        let emails;

        if (folder === MAIL_FOLDERS.STARRED) {
            emails = this.state.emails.filter(email => this.state.starredState.get(email.id));
        } else if (folder === MAIL_FOLDERS.QUARANTINE) {
            emails = this.state.emails.filter(email => this.state.quarantinedState.has(email.id));
        } else {
            emails = filterEmailsByFolder(this.state.emails, folder);
        }

        emails = emails.filter(email => !this.state.deletedState.has(email.id));

        return emails.length > 0 ? emails[0].id : null;
    }


    /* =====================================================
       EMAIL SELECTION
       ===================================================== */

    selectEmail(emailId, options = {}) {

        const email = this.getEmail(emailId);

        if (!email) {
            console.warn(`[MAIL STORE] Cannot select unknown email: ${emailId}`);
            return false;
        }

        this.state.selectedEmailId = emailId;
        this.state.showFullHeaders = false;
        this.state.activeInvestigationPanel = null;
        this.state.selectedLinkId = null;
        this.state.selectedAttachmentId = null;

        if (options.markRead !== false) {
            this.markAsRead(emailId, false);
        }

        this.notify(MAIL_STORE_EVENTS.EMAIL_SELECTED, {
            emailId,
            email: this.getEmail(emailId)
        });

        return true;
    }

    clearSelection() {

        this.state.selectedEmailId = null;
        this.state.showFullHeaders = false;
        this.state.activeInvestigationPanel = null;
        this.state.selectedLinkId = null;
        this.state.selectedAttachmentId = null;

        this.notify(MAIL_STORE_EVENTS.STATE_CHANGED);
    }


    /* =====================================================
       READ / UNREAD
       ===================================================== */

    markAsRead(emailId, notify = true) {

        if (!findEmailById(this.state.emails, emailId)) {
            return false;
        }

        this.state.readState.set(emailId, true);

        if (notify) {
            this.notify(MAIL_STORE_EVENTS.EMAIL_READ, { emailId });
        }

        return true;
    }

    markAsUnread(emailId) {

        if (!findEmailById(this.state.emails, emailId)) {
            return false;
        }

        this.state.readState.set(emailId, false);

        this.notify(MAIL_STORE_EVENTS.EMAIL_UNREAD, { emailId });

        return true;
    }

    toggleRead(emailId) {

        const email = this.getEmail(emailId);

        if (!email) {
            return false;
        }

        if (email.read) {
            return this.markAsUnread(emailId);
        }

        return this.markAsRead(emailId);
    }


    /* =====================================================
       STARRED
       ===================================================== */

    starEmail(emailId) {

        if (!findEmailById(this.state.emails, emailId)) {
            return false;
        }

        this.state.starredState.set(emailId, true);

        this.notify(MAIL_STORE_EVENTS.EMAIL_STARRED, { emailId });

        return true;
    }

    unstarEmail(emailId) {

        if (!findEmailById(this.state.emails, emailId)) {
            return false;
        }

        this.state.starredState.set(emailId, false);

        this.notify(MAIL_STORE_EVENTS.EMAIL_UNSTARRED, { emailId });

        return true;
    }

    toggleStar(emailId) {

        const email = this.getEmail(emailId);

        if (!email) {
            return false;
        }

        if (email.starred) {
            return this.unstarEmail(emailId);
        }

        return this.starEmail(emailId);
    }


    /* =====================================================
       IMPORTANCE
       ===================================================== */

    markImportant(emailId) {

        if (!findEmailById(this.state.emails, emailId)) {
            return false;
        }

        this.state.importantState.set(emailId, true);

        this.notify(MAIL_STORE_EVENTS.STATE_CHANGED, { action: "IMPORTANT", emailId });

        return true;
    }

    removeImportant(emailId) {

        if (!findEmailById(this.state.emails, emailId)) {
            return false;
        }

        this.state.importantState.set(emailId, false);

        this.notify(MAIL_STORE_EVENTS.STATE_CHANGED, { action: "NOT_IMPORTANT", emailId });

        return true;
    }

    toggleImportant(emailId) {

        const email = this.getEmail(emailId);

        if (!email) {
            return false;
        }

        if (email.important) {
            return this.removeImportant(emailId);
        }

        return this.markImportant(emailId);
    }


    /* =====================================================
       FLAGGING
       ===================================================== */

    flagEmail(emailId, reason = null) {

        if (!findEmailById(this.state.emails, emailId)) {
            return false;
        }

        this.state.flaggedState.set(emailId, {
            emailId,
            reason,
            timestamp: Date.now()
        });

        this.notify(MAIL_STORE_EVENTS.EMAIL_FLAGGED, { emailId, reason });

        return true;
    }

    unflagEmail(emailId) {

        if (!this.state.flaggedState.has(emailId)) {
            return false;
        }

        this.state.flaggedState.delete(emailId);

        this.notify(MAIL_STORE_EVENTS.EMAIL_UNFLAGGED, { emailId });

        return true;
    }

    toggleFlag(emailId, reason = null) {

        if (this.state.flaggedState.has(emailId)) {
            return this.unflagEmail(emailId);
        }

        return this.flagEmail(emailId, reason);
    }

    getFlag(emailId) {
        return this.state.flaggedState.get(emailId) || null;
    }


    /* =====================================================
       USER LABELS
       ---------------------------------------------------
       Player-applied identification, e.g. marking an email
       as Phishing after investigating it. This is entirely
       separate from any ground-truth classification the
       email was created with — nothing sets this except the
       player, via MailRenderer's label buttons.
       ===================================================== */

    setUserLabel(emailId, category) {

        if (!findEmailById(this.state.emails, emailId)) {
            return false;
        }

        if (category === null || category === undefined) {
            this.state.userLabelState.delete(emailId);
        } else {
            this.state.userLabelState.set(emailId, category);
        }

        this.notify(MAIL_STORE_EVENTS.LABEL_CHANGED, { emailId, category });

        return true;
    }

    getUserLabel(emailId) {
        return this.state.userLabelState.get(emailId) || null;
    }


    /* =====================================================
       QUARANTINE
       ===================================================== */

    quarantineEmail(emailId, reason = "Analyst quarantine") {

        const email = this.getEmail(emailId);

        if (!email) {
            return false;
        }

        this.state.quarantinedState.set(emailId, {
            emailId,
            reason,
            timestamp: Date.now()
        });

        /*
         * Score once per email, the first time it's ever
         * quarantined. Ground truth is email.simulation.malicious
         * — the same flag the phishing email actually carries —
         * never anything the player could see just by looking at
         * the message (that would defeat the point of having to
         * confirm it in Threat Intel first).
         */
        if (!this.scoredQuarantineIds.has(emailId)) {

            this.scoredQuarantineIds.add(emailId);

            if (email.simulation?.malicious === true) {

                this.applyScore(
                    10,
                    `Correctly quarantined a malicious email ("${email.subject || "Untitled"}").`
                );

            } else {

                this.applyScore(
                    -10,
                    `Quarantined a legitimate email with no justification ("${email.subject || "Untitled"}").`
                );
            }
        }

        this.notify(MAIL_STORE_EVENTS.EMAIL_QUARANTINED, { emailId, reason });

        return true;
    }

    releaseFromQuarantine(emailId) {

        if (!this.state.quarantinedState.has(emailId)) {
            return false;
        }

        this.state.quarantinedState.delete(emailId);

        this.notify(MAIL_STORE_EVENTS.STATE_CHANGED, {
            action: "RELEASE_QUARANTINE",
            emailId
        });

        return true;
    }

    isQuarantined(emailId) {
        return this.state.quarantinedState.has(emailId);
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

    applyScore(delta, reason) {

        this.score += delta;

        this.scoreLog.push({
            timestamp: new Date().toISOString(),
            delta,
            reason
        });

        this.notify(MAIL_STORE_EVENTS.STATE_CHANGED, { action: "SCORE_CHANGED" });
    }


    /* =====================================================
       SEARCH
       ===================================================== */

    setSearchQuery(query) {

        const normalizedQuery = String(query || "");

        this.state.searchQuery = normalizedQuery;
        this.state.searchActive = normalizedQuery.trim().length > 0;

        if (this.state.searchActive) {
            this.state.selectedEmailId = null;
        }

        this.notify(MAIL_STORE_EVENTS.SEARCH_CHANGED, { query: normalizedQuery });
    }

    clearSearch() {

        this.state.searchQuery = "";
        this.state.searchActive = false;
        this.state.selectedEmailId = this.getFirstEmailIdInFolder(this.state.currentFolder);

        this.notify(MAIL_STORE_EVENTS.SEARCH_CHANGED, { query: "" });
    }

    getSearchResults() {

        const query = this.state.searchQuery;

        if (!query.trim()) {
            return [];
        }

        return searchEmailsIn(this.state.emails, query)
            .filter(email => !this.state.deletedState.has(email.id))
            .map(email => this.applyStateToEmail(email));
    }

    getVisibleEmails() {

        if (this.state.searchActive) {
            return this.getSearchResults();
        }

        return this.getCurrentFolderEmails();
    }

    /**
     * Every email, across every folder, with live state
     * (read/starred/flagged/quarantined/userLabel/etc.)
     * actually applied. MailRenderer.getEmails() looks for
     * this method by name — without it, the renderer was
     * silently falling back to the raw internal array,
     * which never reflected flag/quarantine/read/label
     * changes at all.
     */
    getAllEmails() {

        return this.state.emails
            .map(email => this.applyStateToEmail(email));
    }


    /* =====================================================
       HEADER VIEW / INVESTIGATION PANELS
       (unchanged from original)
       ===================================================== */

    toggleFullHeaders() {

        this.state.showFullHeaders = !this.state.showFullHeaders;

        this.notify(MAIL_STORE_EVENTS.INVESTIGATION_CHANGED, {
            panel: "HEADERS",
            open: this.state.showFullHeaders
        });

        return this.state.showFullHeaders;
    }

    setFullHeadersVisible(visible) {

        this.state.showFullHeaders = Boolean(visible);

        this.notify(MAIL_STORE_EVENTS.INVESTIGATION_CHANGED, {
            panel: "HEADERS",
            open: this.state.showFullHeaders
        });
    }

    openInvestigationPanel(panel, options = {}) {

        this.state.activeInvestigationPanel = panel;
        this.state.selectedLinkId = options.linkId || null;
        this.state.selectedAttachmentId = options.attachmentId || null;

        if (panel !== "HEADERS") {
            this.state.showFullHeaders = false;
        }

        this.notify(MAIL_STORE_EVENTS.INVESTIGATION_CHANGED, { panel, ...options });
    }

    closeInvestigationPanel() {

        this.state.activeInvestigationPanel = null;
        this.state.selectedLinkId = null;
        this.state.selectedAttachmentId = null;
        this.state.showFullHeaders = false;

        this.notify(MAIL_STORE_EVENTS.INVESTIGATION_CHANGED, { panel: null });
    }

    setLinkAnalysis(emailId, linkId, result) {

        if (!findEmailById(this.state.emails, emailId)) {
            return false;
        }

        const key = `${emailId}:${linkId}`;

        this.state.linkAnalysis.set(key, { emailId, linkId, result, timestamp: Date.now() });

        this.notify(MAIL_STORE_EVENTS.INVESTIGATION_CHANGED, {
            type: "LINK_ANALYSIS",
            emailId,
            linkId
        });

        return true;
    }

    getLinkAnalysis(emailId, linkId) {

        const key = `${emailId}:${linkId}`;

        return this.state.linkAnalysis.get(key) || null;
    }

    setAttachmentAnalysis(emailId, attachmentId, result) {

        if (!findEmailById(this.state.emails, emailId)) {
            return false;
        }

        const key = `${emailId}:${attachmentId}`;

        this.state.attachmentAnalysis.set(key, {
            emailId,
            attachmentId,
            result,
            timestamp: Date.now()
        });

        this.notify(MAIL_STORE_EVENTS.INVESTIGATION_CHANGED, {
            type: "ATTACHMENT_ANALYSIS",
            emailId,
            attachmentId
        });

        return true;
    }

    getAttachmentAnalysis(emailId, attachmentId) {

        const key = `${emailId}:${attachmentId}`;

        return this.state.attachmentAnalysis.get(key) || null;
    }

    setAuthenticationCheck(emailId, result) {

        if (!findEmailById(this.state.emails, emailId)) {
            return false;
        }

        this.state.authenticationChecks.set(emailId, {
            emailId,
            result,
            timestamp: Date.now()
        });

        this.notify(MAIL_STORE_EVENTS.INVESTIGATION_CHANGED, {
            type: "AUTHENTICATION",
            emailId
        });

        return true;
    }

    getAuthenticationCheck(emailId) {
        return this.state.authenticationChecks.get(emailId) || null;
    }

    setInvestigation(emailId, investigation) {

        if (!findEmailById(this.state.emails, emailId)) {
            return false;
        }

        this.state.investigations.set(emailId, {
            emailId,
            ...investigation,
            lastUpdated: Date.now()
        });

        this.notify(MAIL_STORE_EVENTS.INVESTIGATION_CHANGED, {
            type: "INVESTIGATION",
            emailId
        });

        return true;
    }

    getInvestigation(emailId) {
        return this.state.investigations.get(emailId) || null;
    }

    getAllInvestigations() {
        return Array.from(this.state.investigations.values());
    }


    /* =====================================================
       COUNTS
       ===================================================== */

    getTotalCount() {
        return this.state.emails.length;
    }

    getInboxCount() {
        return filterEmailsByFolder(this.state.emails, MAIL_FOLDERS.INBOX).length;
    }

    getUnreadCount(folder = MAIL_FOLDERS.INBOX) {

        return this.getEmailsByFolder(folder)
            .filter(email => !email.read)
            .length;
    }

    getStarredCount() {

        return this.state.emails.filter(email =>
            this.state.starredState.get(email.id)
        ).length;
    }

    getFlaggedCount() {
        return this.state.flaggedState.size;
    }

    getQuarantineCount() {
        return this.state.quarantinedState.size;
    }

    getEmailsByFolder(folder) {

        if (folder === MAIL_FOLDERS.STARRED) {
            return this.state.emails
                .filter(email => this.state.starredState.get(email.id))
                .map(email => this.applyStateToEmail(email));
        }

        if (folder === MAIL_FOLDERS.QUARANTINE) {
            return this.state.emails
                .filter(email => this.state.quarantinedState.has(email.id))
                .map(email => this.applyStateToEmail(email));
        }

        return filterEmailsByFolder(this.state.emails, folder)
            .map(email => this.applyStateToEmail(email));
    }


    /* =====================================================
       CATEGORY COUNTS
       ===================================================== */

    getCategoryCounts() {

        const counts = {
            NORMAL: 0,
            INTERNAL: 0,
            PHISHING: 0,
            BEC: 0,
            SUSPICIOUS: 0,
            MALWARE: 0,
            REPORT: 0
        };

        this.state.emails.forEach(email => {
            if (Object.prototype.hasOwnProperty.call(counts, email.category)) {
                counts[email.category]++;
            }
        });

        return counts;
    }


    /* =====================================================
       MESSAGE ACTIONS
       ===================================================== */

    archiveEmail(emailId) {

        const email = this.getEmail(emailId);

        if (!email) {
            return false;
        }

        this.state.archivedState.set(emailId, { timestamp: Date.now() });

        if (this.state.selectedEmailId === emailId) {
            this.state.selectedEmailId = this.getFirstEmailIdInFolder(this.state.currentFolder);
        }

        this.notify(MAIL_STORE_EVENTS.STATE_CHANGED, { action: "ARCHIVE", emailId });

        return true;
    }

    deleteEmail(emailId) {

        const email = this.getEmail(emailId);

        if (!email) {
            return false;
        }

        this.state.deletedState.set(emailId, { timestamp: Date.now() });

        if (this.state.selectedEmailId === emailId) {
            this.state.selectedEmailId = null;
        }

        this.notify(MAIL_STORE_EVENTS.STATE_CHANGED, { action: "DELETE", emailId });

        return true;
    }

    restoreEmail(emailId) {

        if (!this.state.deletedState.has(emailId)) {
            return false;
        }

        this.state.deletedState.delete(emailId);

        this.notify(MAIL_STORE_EVENTS.STATE_CHANGED, { action: "RESTORE", emailId });

        return true;
    }


    /* =====================================================
       SPECIAL STATE HELPERS
       ===================================================== */

    isArchived(emailId) {
        return this.state.archivedState.has(emailId);
    }

    isDeleted(emailId) {
        return this.state.deletedState.has(emailId);
    }

    isFlagged(emailId) {
        return this.state.flaggedState.has(emailId);
    }

    isStarred(emailId) {
        return Boolean(this.state.starredState.get(emailId));
    }

    isRead(emailId) {
        return Boolean(this.state.readState.get(emailId));
    }


    /* =====================================================
       RESET
       ===================================================== */

    reset() {

        this.state = createInitialState();

        this.score = 0;

        this.scoreLog = [];

        this.scoredQuarantineIds = new Set();

        this.notify(MAIL_STORE_EVENTS.STATE_CHANGED, { action: "RESET" });
    }


    /* =====================================================
       DEBUG
       ===================================================== */

    debug() {

        console.group("[NORTHSTAR MAIL STORE]");
        console.log("Total emails:", this.state.emails.length);
        console.log("Current folder:", this.state.currentFolder);
        console.log("Selected email:", this.state.selectedEmailId);
        console.log("Search:", this.state.searchQuery);
        console.log("Unread:", this.getUnreadCount());
        console.log("Starred:", this.getStarredCount());
        console.log("Flagged:", this.getFlaggedCount());
        console.log("Quarantined:", this.getQuarantineCount());
        console.log("Reports sent:", this.state.reportsSent.length);
        console.log("Score:", this.getScore());
        console.groupEnd();
    }
}


/* =========================================================
   NOTE ON THE SINGLETON
   ---------------------------------------------------------
   This module intentionally does NOT export a pre-built
   `mailStore` instance anymore. The store now needs to be a
   long-lived singleton owned by SimulationBootstrap (same
   tier as eventEngine/alertManager) so it survives the Mail
   window being closed and reopened. See SimulationBootstrap.js
   and MailApp.js for the wiring.
   ========================================================= */