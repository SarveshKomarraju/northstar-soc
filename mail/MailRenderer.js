/* =========================================================
   NORTHSTAR SOC — MAIL RENDERER
   File: mail/MailRenderer.js

   Outlook / Gmail-inspired SOC mail interface.

   Responsibilities:
   - Render sidebar
   - Render toolbar
   - Render inbox/message list
   - Render reading pane
   - Render email headers
   - Render authentication results
   - Render links
   - Render attachments
   - Trigger investigation functions
   - Handle search / folders / flags / read state

   This renderer is intentionally defensive so it can work
   with different MailStore / MailInvestigator implementations.
   ========================================================= */

import {
    COMPANY_DOMAIN,
    BOSS,
    PLAYER,
    isCompanyAddress,
    findCoworkerByAddress
} from "./data/company.js";

import { LOCAL_MACHINE } from "../files/data/localMachine.js";

import { isLikelyIncidentReport } from "./data/emails.js";

/**
 * Small deterministic-ish hash — not cryptographic, just enough
 * to give an opened PDF a real-looking, stable fileHash the same
 * way ambientFiles.js's stableHash() / CaptureTool.js's
 * pseudoHash() do for other files that don't have a "real" one
 * to begin with.
 */
function pseudoFileHash(seed) {

    let hash = 0;

    const text = String(seed);

    for (let i = 0; i < text.length; i++) {
        hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
    }

    return (hash >>> 0).toString(16).padStart(8, "0").repeat(8);
}

export class MailRenderer {

    constructor(container, store, investigator) {

        this.container = container;
        this.store = store;
        this.investigator = investigator;

        this.unsubscribe = null;

        this.analyzedEmailIds = new Set();

        this.checkedEmailIds = new Set();

        this.state = {
            sidebarCollapsed: false,
            showHeaders: false,
            activeFolder: "INBOX",
            searchQuery: "",
            selectedEmailId: null,
            selectedEmail: null,
            toast: null
        };

        this.boundClick = this.handleClick.bind(this);
        this.boundInput = this.handleInput.bind(this);
        this.boundKeydown = this.handleKeydown.bind(this);
    }


    /* =====================================================
       MOUNT
       ===================================================== */

    mount() {

        if (!this.container) {
            console.error(
                "[MAIL RENDERER] No container supplied."
            );
            return;
        }

        this.container.classList.add(
            "northstar-mail"
        );

        this.container.innerHTML = "";

        this.container.addEventListener(
            "click",
            this.boundClick
        );

        this.container.addEventListener(
            "input",
            this.boundInput
        );

        this.container.addEventListener(
            "keydown",
            this.boundKeydown
        );

        this.syncFromStore();

        this.render();

        this.subscribeToStore();

        console.log(
            "[MAIL RENDERER] Mounted."
        );
    }


    /* =====================================================
       STORE SUBSCRIPTION
       ===================================================== */

    subscribeToStore() {

        if (!this.store) return;

        const callback = () => {

            this.syncFromStore();

            this.render();
        };

        if (
            typeof this.store.subscribe ===
            "function"
        ) {

            this.unsubscribe =
                this.store.subscribe(callback);

            return;
        }

        if (
            typeof this.store.onChange ===
            "function"
        ) {

            this.unsubscribe =
                this.store.onChange(callback);

            return;
        }
    }


    /* =====================================================
       STORE STATE SYNC
       ===================================================== */

    syncFromStore() {

        if (!this.store) return;

        let selected = null;

        if (
            typeof this.store.getSelectedEmail ===
            "function"
        ) {

            selected =
                this.store.getSelectedEmail();
        }

        else if (
            typeof this.store.getSelected ===
            "function"
        ) {

            selected =
                this.store.getSelected();
        }

        else if (
            this.store.state?.selectedEmail
        ) {

            selected =
                this.store.state.selectedEmail;
        }

        else if (
            this.store.selectedEmail
        ) {

            selected =
                this.store.selectedEmail;
        }

        if (selected) {

            this.state.selectedEmail =
                selected;

            this.state.selectedEmailId =
                selected.id;
        }
    }


    /* =====================================================
       MAIN RENDER
       ===================================================== */

    render() {

        if (!this.container) return;

        const state =
            this.getApplicationState();

        this.container.innerHTML = `

            <div class="mail-shell">

                ${this.renderTopBar(state)}

                <div class="mail-body">

                    ${this.renderSidebar(state)}

                    <section class="mail-center">

                        ${this.renderToolbar(state)}

                        ${this.renderMessageArea(state)}

                    </section>

                </div>

            </div>

            <div
                class="mail-toast-container"
                aria-live="polite"
            ></div>
        `;

        this.renderToast();
    }


    /* =====================================================
       APPLICATION STATE
       ===================================================== */

    getApplicationState() {

        const emails =
            this.getEmails();

        const folder =
            this.getActiveFolder();

        let filtered =
            this.filterEmails(
                emails,
                folder
            );

        const query =
            this.state.searchQuery
                .trim()
                .toLowerCase();

        if (query) {

            filtered =
                filtered.filter(
                    email =>
                        this.emailMatchesSearch(
                            email,
                            query
                        )
                );
        }

        filtered =
            [...filtered].sort(
                (a, b) =>
                    new Date(b.timestamp || 0) -
                    new Date(a.timestamp || 0)
            );

        const selected =
            this.getSelectedEmail(
                emails
            );

        return {

            emails,

            filteredEmails: filtered,

            selectedEmail: selected,

            activeFolder: folder,

            searchQuery:
                this.state.searchQuery,

            unreadCount:
                emails.filter(
                    email =>
                        !this.isRead(email)
                ).length,

            totalCount:
                emails.length
        };
    }


    /* =====================================================
       EMAIL DATA
       ===================================================== */

    getEmails() {

        if (!this.store) {
            return [];
        }

        let emails = null;

        if (
            typeof this.store.getEmails ===
            "function"
        ) {

            emails =
                this.store.getEmails();
        }

        else if (
            typeof this.store.getAllEmails ===
            "function"
        ) {

            emails =
                this.store.getAllEmails();
        }

        else if (
            Array.isArray(this.store.emails)
        ) {

            emails =
                this.store.emails;
        }

        else if (
            Array.isArray(this.store.state?.emails)
        ) {

            emails =
                this.store.state.emails;
        }

        return Array.isArray(emails)
            ? emails
            : [];
    }


    /* =====================================================
       SELECTED EMAIL
       ===================================================== */

    getSelectedEmail(emails = this.getEmails()) {

        if (this.state.selectedEmailId) {

            const found =
                emails.find(
                    email =>
                        email.id ===
                        this.state.selectedEmailId
                );

            if (found) {
                return found;
            }
        }

        if (this.state.selectedEmail) {
            return this.state.selectedEmail;
        }

        if (
            this.store?.state?.selectedEmail
        ) {
            return this.store.state.selectedEmail;
        }

        return null;
    }


    /* =====================================================
       ACTIVE FOLDER
       ===================================================== */

    getActiveFolder() {

        if (
            this.store?.state?.activeFolder
        ) {

            return this.store.state.activeFolder;
        }

        if (
            this.store?.activeFolder
        ) {

            return this.store.activeFolder;
        }

        return this.state.activeFolder;
    }


    /* =====================================================
       TOP BAR
       ===================================================== */

    renderTopBar(state) {

        return `

            <header class="mail-topbar">

                <div class="mail-brand">

                    <button
                        class="mail-icon-button"
                        data-action="toggle-sidebar"
                        title="Toggle navigation"
                    >
                        ☰
                    </button>

                    <div class="mail-logo">
                        <span class="mail-logo-mark">
                            ✉
                        </span>

                        <span class="mail-logo-text">
                            MAIL
                        </span>
                    </div>

                </div>


                <div class="mail-search">

                    <span class="mail-search-icon">
                        ⌕
                    </span>

                    <input
                        class="mail-search-input"
                        type="search"
                        placeholder="Search mail"
                        value="${this.escapeAttribute(
            state.searchQuery
        )}"
                        autocomplete="off"
                    />

                    ${state.searchQuery
                ? `
                                <button
                                    class="mail-search-clear"
                                    data-action="clear-search"
                                >
                                    ×
                                </button>
                            `
                : ""
            }

                </div>


                <div class="mail-top-actions">

                    <button
                        class="mail-top-action"
                        data-action="refresh"
                        title="Refresh"
                    >
                        ↻
                    </button>

                    <button
                        class="mail-top-action"
                        data-action="help"
                        title="Help"
                    >
                        ?
                    </button>

                    <div class="mail-status">

                        <span
                            class="mail-status-dot"
                        ></span>

                        <span>
                            NORTHSTAR
                        </span>

                    </div>

                </div>

            </header>
        `;
    }


    /* =====================================================
       SIDEBAR
       ===================================================== */

    renderSidebar(state) {

        const unread =
            this.getFolderCount(
                "INBOX",
                state.emails
            );

        const flagged =
            this.getFlaggedCount(
                state.emails
            );

        return `

            <aside
                class="
                    mail-sidebar
                    ${this.state.sidebarCollapsed
                ? "collapsed"
                : ""}
                "
            >

                <button
                    class="mail-compose-button"
                    data-action="compose"
                >
                    <span class="compose-icon">
                        ＋
                    </span>

                    <span class="compose-text">
                        Compose
                    </span>
                </button>


                <nav class="mail-nav">

                    ${this.renderFolder(
                    "INBOX",
                    "Inbox",
                    "⌂",
                    unread
                )}

                    ${this.renderFolder(
                    "STARRED",
                    "Starred",
                    "☆",
                    0
                )}

                    ${this.renderFolder(
                    "FLAGGED",
                    "Flagged",
                    "⚑",
                    flagged
                )}

                    ${this.renderFolder(
                    "SENT",
                    "Sent",
                    "↗",
                    0
                )}

                    ${this.renderFolder(
                    "QUARANTINE",
                    "Quarantine",
                    "▣",
                    this.getQuarantinedCount(
                        state.emails
                    )
                )}

                    ${this.renderFolder(
                    "TRASH",
                    "Trash",
                    "♢",
                    this.getTrashCount(
                        state.emails
                    )
                )}

                </nav>


                <div class="mail-sidebar-section">

                    <div class="mail-sidebar-heading">
                        LABELS
                    </div>

                    ${this.renderLabel("NORMAL", "normal", "Normal")}

                    ${this.renderLabel("SUSPICIOUS", "suspicious", "Suspicious")}

                    ${this.renderLabel("PHISHING", "phishing", "Phishing")}

                    ${this.renderLabel("MALWARE", "malware", "Malware")}

                </div>


                <div class="mail-sidebar-footer">

                    <div>
                        <span class="footer-label">
                            STORAGE
                        </span>

                        <span>
                            SIMULATION
                        </span>
                    </div>

                </div>

            </aside>
        `;
    }


    renderFolder(
        id,
        label,
        icon,
        count = 0
    ) {

        const active =
            this.getActiveFolder() === id;

        return `

            <button
                class="
                    mail-nav-item
                    ${active ? "active" : ""}
                "
                data-folder="${id}"
                title="${label}"
            >

                <span class="mail-nav-icon">
                    ${icon}
                </span>

                <span class="mail-nav-label">
                    ${label}
                </span>

                ${count > 0
                ? `
                            <span class="mail-nav-count">
                                ${count}
                            </span>
                        `
                : ""
            }

            </button>
        `;
    }


    renderLabel(
        category,
        dotClass,
        label
    ) {

        const selected =
            this.getSelectedEmail();

        const active =
            !!selected &&
            (selected.userLabel || null) === category;

        return `

            <button
                class="mail-label ${active ? "active" : ""}"
                data-label="${category}"
                title="${selected
                ? (active ? `Remove ${label} label` : `Label this email as ${label}`)
                : `Select an email, then label it as ${label}`
            }"
            >

                <span class="label-dot ${dotClass}"></span>

                ${label}

            </button>
        `;
    }


    /* =====================================================
       TOOLBAR
       ===================================================== */

    renderToolbar(state) {

        const visibleIds =
            state.filteredEmails.map(
                email => email.id
            );

        const checkedCount =
            visibleIds.filter(
                id => this.checkedEmailIds.has(id)
            ).length;

        const allChecked =
            visibleIds.length > 0 &&
            checkedCount === visibleIds.length;

        return `

            <div class="mail-toolbar">

                <div class="mail-toolbar-left">

                    <button
                        class="mail-tool-button ${allChecked ? "active" : ""}"
                        data-action="select-all"
                        title="${allChecked ? "Deselect all" : "Select all"}"
                    >
                        ${allChecked ? "☑" : "□"}
                    </button>

                    <button
                        class="mail-tool-button"
                        data-action="refresh"
                        title="Refresh"
                    >
                        ↻
                    </button>

                    ${checkedCount > 0
                ? `
                                <button
                                    class="mail-tool-button"
                                    data-action="bulk-delete"
                                    title="Delete selected"
                                >
                                    ♢
                                </button>

                                <button
                                    class="mail-tool-button"
                                    data-action="bulk-quarantine"
                                    title="Quarantine selected"
                                >
                                    ▣
                                </button>

                                <button
                                    class="mail-tool-button"
                                    data-action="bulk-flag"
                                    title="Flag selected"
                                >
                                    ⚑
                                </button>
                            `
                : ""
            }

                </div>


                <div class="mail-toolbar-title">

                    <span>
                        ${this.escapeHtml(
                this.getFolderDisplayName(
                    state.activeFolder
                )
            )}
                    </span>

                    <span class="mail-toolbar-count">
                        ${checkedCount > 0
                ? `${checkedCount} selected`
                : `${state.filteredEmails.length} messages`
            }
                    </span>

                </div>


                <div class="mail-toolbar-right">

                    <button
                        class="mail-tool-button"
                        data-action="previous"
                        title="Previous"
                    >
                        ‹
                    </button>

                    <button
                        class="mail-tool-button"
                        data-action="next"
                        title="Next"
                    >
                        ›
                    </button>

                </div>

            </div>
        `;
    }


    /* =====================================================
       MESSAGE AREA
       ===================================================== */

    renderMessageArea(state) {

        return `

            <div class="mail-message-area">

                <section class="mail-message-list">

                    ${this.renderMessageList(
            state
        )}

                </section>


                <section class="mail-reading-pane">

                    ${this.renderReadingPane(
            state.selectedEmail
        )}

                </section>

            </div>
        `;
    }


    /* =====================================================
       MESSAGE LIST
       ===================================================== */

    renderMessageList(state) {

        if (
            !state.filteredEmails.length
        ) {

            return `

                <div class="mail-empty">

                    <div class="mail-empty-icon">
                        ⌕
                    </div>

                    <div class="mail-empty-title">
                        No messages
                    </div>

                    <div class="mail-empty-text">
                        No messages match the current view.
                    </div>

                </div>
            `;
        }

        return state.filteredEmails
            .map(
                email =>
                    this.renderMessageRow(
                        email
                    )
            )
            .join("");
    }


    /* =====================================================
       MESSAGE ROW
       ===================================================== */

    renderMessageRow(email) {

        const selected =
            email.id ===
            this.state.selectedEmailId;

        const read =
            this.isRead(email);

        const category =
            email.userLabel
                ? this.normalizeCategory(email.userLabel)
                : "UNLABELED";

        const sender =
            this.getSenderName(email);

        const address =
            this.getSenderAddress(email);

        const subject =
            email.subject ||
            "(No subject)";

        const preview =
            this.getPreview(email);

        const timestamp =
            this.formatListDate(
                email.timestamp ||
                email.date
            );

        const suspicious =
            this.isSuspicious(email);

        const deleted =
            this.isDeleted(email);

        return `

            <article
                class="
                    mail-row
                    ${selected ? "selected" : ""}
                    ${!read ? "unread" : ""}
                    ${suspicious ? "has-risk" : ""}
                    ${deleted ? "locked" : ""}
                "
                data-email-id="${this.escapeAttribute(
            email.id
        )}"
                tabindex="0"
            >

                <div class="mail-row-checkbox">
                    <input
                        type="checkbox"
                        tabindex="-1"
                        data-row-checkbox="${this.escapeAttribute(
            email.id
        )}"
                        ${this.checkedEmailIds.has(email.id) ? "checked" : ""}
                    >
                </div>


                ${deleted
                ? `
                            <button
                                class="mail-row-star mail-row-restore"
                                data-action="restore-row"
                                data-email-id="${this.escapeAttribute(email.id)}"
                                title="Restore from Trash"
                            >
                                ↺
                            </button>
                        `
                : `
                            <button
                                class="mail-row-star"
                                data-action="star"
                                data-email-id="${this.escapeAttribute(email.id)}"
                                title="Star"
                            >
                                ${this.isFlagged(email)
                    ? "★"
                    : "☆"
                }
                            </button>
                        `
            }


                <div class="mail-row-main">

                    <div class="mail-row-top">

                        <span class="mail-sender">
                            ${this.escapeHtml(
                sender
            )}
                        </span>

                        <span class="mail-time">
                            ${timestamp}
                        </span>

                    </div>


                    <div class="mail-row-subject">

                        ${suspicious
                ? `
                                    <span
                                        class="
                                            mail-risk-marker
                                            ${category.toLowerCase()}
                                        "
                                    >
                                        !
                                    </span>
                                `
                : ""
            }

                        <span>
                            ${this.escapeHtml(
                subject
            )}
                        </span>

                    </div>


                    <div class="mail-row-preview">

                        <span class="mail-address">
                            ${this.escapeHtml(
                address
            )}
                        </span>

                        <span class="mail-preview-separator">
                            —
                        </span>

                        <span>
                            ${this.escapeHtml(
                preview
            )}
                        </span>

                    </div>

                </div>


                <div class="mail-row-category">

                    <span
                        class="
                            mail-category
                            ${category.toLowerCase()}
                        "
                    >
                        ${this.escapeHtml(
                category
            )}
                    </span>

                </div>

            </article>
        `;
    }


    /* =====================================================
       READING PANE
       ===================================================== */

    renderReadingPane(email) {

        if (!email) {

            return `

                <div class="mail-reading-empty">

                    <div class="mail-reading-empty-icon">
                        ✉
                    </div>

                    <div class="mail-reading-empty-title">
                        Select a message
                    </div>

                    <div class="mail-reading-empty-text">
                        Choose an email from your inbox
                        to begin investigation.
                    </div>

                </div>
            `;
        }

        return `

            <div class="mail-reading">

                ${this.renderEmailHeader(email)}

                ${this.renderEmailBody(email)}

            </div>
        `;
    }


    /* =====================================================
       EMAIL HEADER
       ===================================================== */

    renderEmailHeader(email) {

        const sender =
            this.getSenderName(email);

        const address =
            this.getSenderAddress(email);

        const replyTo =
            email.replyTo ||
            email.reply_to ||
            "—";

        const date =
            this.formatFullDate(
                email.timestamp ||
                email.date
            );

        return `

            <div class="mail-reading-header">

                <div class="mail-reading-actions-row">

                    <div class="mail-reading-actions">

                        <button
                            class="mail-reading-action"
                            data-action="reply"
                            title="Reply"
                        >
                            ↩
                        </button>

                        <button
                            class="mail-reading-action"
                            data-action="forward"
                            title="Forward"
                        >
                            ↪
                        </button>

                        <button
                            class="mail-reading-action"
                            data-action="flag"
                            title="Flag"
                        >
                            ${this.isFlagged(email)
                ? "★"
                : "☆"
            }
                        </button>

                        <button
                            class="mail-reading-action ${this.isQuarantined(email) ? "active-quarantine" : ""}"
                            data-action="quarantine"
                            title="${this.isQuarantined(email) ? "Release from quarantine" : "Quarantine this email"}"
                        >
                            ${this.isQuarantined(email)
                ? "⛔"
                : "▣"
            }
                        </button>

                        ${this.isDeleted(email)
                ? `
                                    <button
                                        class="mail-reading-action"
                                        data-action="restore"
                                        title="Restore from Trash"
                                    >
                                        ↺
                                    </button>
                                `
                : ""
            }

                    </div>

                </div>


                <div class="mail-message-card">

                    <div class="mail-message-card-subject-row">

                        <div class="mail-message-card-subject">
                            ${this.escapeHtml(
                email.subject ||
                "(No subject)"
            )}
                        </div>

                        ${email.userLabel
                ? `
                                    <span class="mail-message-card-label-badge ${email.userLabel.toLowerCase()}">
                                        Labeled ${this.escapeHtml(email.userLabel)}
                                    </span>
                                `
                : ""
            }

                    </div>

                    <div class="mail-message-card-meta">

                        <div class="mail-avatar">
                            ${this.getInitials(
                sender
            )}
                        </div>

                        <div class="mail-message-card-meta-text">

                            <div class="mail-sender-name-row">

                                <strong>
                                    ${this.escapeHtml(
                sender
            )}
                                </strong>

                                <span class="mail-angle">
                                    &lt;
                                </span>

                                <span class="mail-sender-address">
                                    ${this.escapeHtml(
                address
            )}
                                </span>

                                <span class="mail-angle">
                                    &gt;
                                </span>

                            </div>


                            <div class="mail-message-card-row">
                                <span class="mail-message-card-label">To</span>
                                <span class="mail-message-card-value">
                                    ${this.escapeHtml(
                this.getRecipients(email)
            )}
                                </span>
                            </div>

                            ${Array.isArray(email.cc) && email.cc.length
                ? `
                                        <div class="mail-message-card-row">
                                            <span class="mail-message-card-label">Cc</span>
                                            <span class="mail-message-card-value">
                                                ${this.escapeHtml(email.cc.join(", "))}
                                            </span>
                                        </div>
                                    `
                : ""
            }

                        </div>


                        <div class="mail-message-date">
                            ${this.escapeHtml(
                date
            )}
                        </div>

                    </div>

                </div>


                <div class="mail-technical-summary">

                    <div>
                        <span>REPLY-TO</span>
                        <strong>
                            ${this.escapeHtml(
                replyTo
            )}
                        </strong>
                    </div>

                    <div>
                        <span>MESSAGE ID</span>
                        <strong>
                            ${this.escapeHtml(
                email.headers?.messageId ||
                email.messageId ||
                "—"
            )}
                        </strong>
                    </div>

                </div>


                <div class="mail-investigation-actions">

                    <button
                        class="mail-investigation-button"
                        data-action="toggle-headers"
                    >
                        ${this.state.showHeaders
                ? "HIDE HEADERS"
                : "VIEW FULL HEADERS"}
                    </button>

                    <button
                        class="mail-investigation-button"
                        data-action="analyze-email"
                    >
                        ANALYZE EMAIL
                    </button>

                </div>


                ${this.state.showHeaders
                ? this.renderFullHeaders(email)
                : ""
            }

            </div>
        `;
    }


    /* =====================================================
       FULL HEADERS
       ===================================================== */

    renderFullHeaders(email) {

        const headers =
            email.headers ||
            {};

        const rows = [

            [
                "Received",
                headers.received ||
                headers.Received ||
                "SIMULATED: Received from external mail server"
            ],

            [
                "Return-Path",
                headers.returnPath ||
                headers["Return-Path"] ||
                email.returnPath ||
                "—"
            ],

            [
                "Message-ID",
                headers.messageId ||
                headers["Message-ID"] ||
                email.messageId ||
                "—"
            ],

            [
                "Authentication-Results",
                headers.authenticationResults ||
                headers["Authentication-Results"] ||
                this.buildAuthenticationHeader(
                    email
                )
            ],

            [
                "DKIM-Signature",
                headers.dkimSignature ||
                headers["DKIM-Signature"] ||
                "SIMULATED DKIM SIGNATURE"
            ],

            [
                "Received-SPF",
                headers.receivedSpf ||
                headers["Received-SPF"] ||
                headers.spf ||
                "—"
            ],

            [
                "X-Originating-IP",
                headers.originatingIP ||
                headers["X-Originating-IP"] ||
                "—"
            ],

            [
                "User-Agent",
                headers.userAgent ||
                headers["User-Agent"] ||
                "NORTHSTAR Mail Simulator"
            ]

        ];

        return `

            <div class="mail-full-headers">

                <div class="mail-panel-heading">

                    <span>
                        RAW MESSAGE HEADERS
                    </span>

                    <span class="mail-panel-label">
                        SIMULATED
                    </span>

                </div>


                <div class="mail-header-table">

                    ${rows.map(
            ([key, value]) => `

                            <div class="mail-header-row">

                                <div class="mail-header-key">
                                    ${this.escapeHtml(
                key
            )}
                                </div>

                                <div class="mail-header-value">
                                    ${this.escapeHtml(
                value
            )}
                                </div>

                            </div>
                        `
        ).join("")}

                </div>

            </div>
        `;
    }


    /* =====================================================
       EMAIL BODY
       ===================================================== */

    renderEmailBody(email) {

        const body =
            email.body?.content ||
            email.body ||
            email.content ||
            "";

        return `

            <div class="mail-reading-body">

                <div class="mail-message-body-card">

                    <div class="mail-body-content">

                        ${this.renderSafeEmailBody(
            body
        )}

                    </div>

                </div>


                ${this.renderLinksPanel(
            email
        )}


                ${this.renderAttachmentsPanel(
            email
        )}

            </div>
        `;
    }


    /* =====================================================
       SAFE BODY
       ===================================================== */

    renderSafeEmailBody(body) {

        /*
         * Email bodies are simulation data.
         * We intentionally do NOT execute arbitrary HTML.
         *
         * A lightweight conversion is used so the simulated
         * email can still look like a real corporate email.
         */

        const text =
            this.stripDangerousMarkup(
                String(body)
            );

        return text
            .split(/\n{2,}/)
            .map(
                paragraph => `
                    <p>
                        ${this.escapeHtml(
                    paragraph
                ).replace(
                    /\n/g,
                    "<br>"
                )}
                    </p>
                `
            )
            .join("");
    }


    /*
     * REMOVED: the passive "EMAIL AUTHENTICATION" panel
     * (SPF/DKIM/DMARC pass-fail, shown as a plain checklist).
     * It told the player "this is phishing" in one glance,
     * which made actually checking the destination in Threat
     * Intel pointless. Confirming a link/domain is malicious
     * is Threat Intel's job now, not a header readout in Mail.
     */


    /* =====================================================
       LINKS
       ===================================================== */

    renderLinksPanel(email) {

        const links =
            Array.isArray(email.links)
                ? email.links
                : [];

        if (!links.length) {
            return "";
        }

        return `

            <section class="mail-investigation-panel">

                <div class="mail-panel-heading">

                    <span>
                        LINKS
                    </span>

                    <span class="mail-panel-label">
                        ${links.length}
                    </span>

                </div>


                <div class="mail-link-list">

                    ${links.map(
            (link, index) =>
                this.renderLink(
                    link,
                    index
                )
        ).join("")}

                </div>

            </section>
        `;
    }


    renderLink(link, index) {

        /*
         * NO reputation/threat-score badge here. Those fields
         * exist on the raw email data for the simulation's own
         * scoring, but showing them in the link list hands the
         * player the answer before they've investigated
         * anything — they should have to actually pull the
         * domain and check it in Threat Intel to know for sure.
         * ANALYZE only surfaces observable structural clues
         * (display/URL mismatch, IP literal, suspicious
         * keywords, missing HTTPS) — never a verdict.
         *
         * BUGFIX: this used to always print link.url — the
         * REAL destination — directly in the inbox, before any
         * analysis. That handed the player the true domain for
         * free, no ANALYZE needed, and made the display/URL
         * mismatch check pointless since there was nothing left
         * to "reveal". Show what the email actually presents
         * (link.visibleUrl, when the lure spoofs one) and let
         * ANALYZE be what surfaces the real destination.
         */

        return `

            <div class="mail-link-item">

                <div class="mail-link-main">

                    <div class="mail-link-text">
                        ${this.escapeHtml(
            link.text ||
            "Link"
        )}
                    </div>

                    <div class="mail-link-url-row">

                        <div class="mail-link-url">
                            ${this.escapeHtml(
            link.visibleUrl ||
            link.url ||
            "—"
        )}
                        </div>

                        ${this.renderCopyButton(
            link.visibleUrl ||
            link.url ||
            ""
        )}

                    </div>

                </div>


                <div class="mail-link-status">

                    <button
                        class="mail-analyze-button"
                        data-action="analyze-link"
                        data-link-index="${index}"
                    >
                        ANALYZE
                    </button>

                </div>

            </div>
        `;
    }


    /* =====================================================
       ATTACHMENTS
       ===================================================== */

    renderAttachmentsPanel(email) {

        const attachments =
            Array.isArray(
                email.attachments
            )
                ? email.attachments
                : [];

        if (!attachments.length) {
            return "";
        }

        return `

            <section class="mail-investigation-panel">

                <div class="mail-panel-heading">

                    <span>
                        ATTACHMENTS
                    </span>

                    <span class="mail-panel-label">
                        ${attachments.length}
                    </span>

                </div>


                <div class="mail-attachment-list">

                    ${attachments.map(
            (attachment, index) =>
                this.renderAttachment(
                    attachment,
                    index
                )
        ).join("")}

                </div>

            </section>
        `;
    }


    renderAttachment(
        attachment,
        index
    ) {

        /*
         * NO declared-risk badge here — same reasoning as
         * renderLink(): attachment.risk is a ground-truth
         * simulation flag, not something visible just by
         * looking at a file. ANALYZE surfaces real structural
         * clues (extension, double-extension, password
         * protection); the hash still has to be checked in
         * Threat Intel for an actual verdict.
         */

        /*
         * Attachments the player added themselves via the
         * Compose "Attach" picker (screenshots/recordings —
         * capture.own === true) aren't investigation evidence,
         * so there's nothing to ANALYZE. Just let them view it.
         */
        const isOwnAttachment =
            attachment.own === true;

        const icon =
            attachment.type?.startsWith("video/")
                ? "▶"
                : attachment.type?.startsWith("image/")
                    ? "▧"
                    : this.getFileIcon(attachment.name);

        return `

            <div class="mail-attachment-item">

                <div class="mail-attachment-icon">
                    ${icon}
                </div>


                <div class="mail-attachment-info">

                    <div class="mail-attachment-name">
                        ${this.escapeHtml(
            attachment.name ||
            "attachment"
        )}
                    </div>

                    <div class="mail-attachment-meta">

                        ${this.formatBytes(
            attachment.size
        )}

                        <span>•</span>

                        ${this.escapeHtml(
            attachment.type ||
            "Unknown type"
        )}

                    </div>

                </div>


                <div class="mail-attachment-actions">

                    ${isOwnAttachment
                ? ""
                : `
                                <button
                                    class="mail-analyze-button"
                                    data-action="analyze-attachment"
                                    data-attachment-index="${index}"
                                >
                                    ANALYZE
                                </button>
                            `
            }

                    <button
                        class="mail-analyze-button secondary"
                        data-action="open-attachment"
                        data-attachment-index="${index}"
                    >
                        ${isOwnAttachment ? "VIEW" : "OPEN"}
                    </button>

                </div>

            </div>
        `;
    }


    /* =====================================================
       INDICATORS
       ===================================================== */

    /*
     * REMOVED: renderIndicatorsPanel() used to render
     * email.indicators directly — a raw ground-truth answer
     * key ("MALICIOUS_LINK", "URGENT_LANGUAGE", "DOMAIN_
     * IMPERSONATION", etc.) baked into the email at creation
     * time, gated only behind clicking ANALYZE EMAIL. That's
     * strictly worse than useless: it's the same category of
     * leak as the reputation/threat-score badges removed
     * elsewhere in Mail, just spelled out as literal tags.
     * The ANALYZE EMAIL report (renderInvestigationReport)
     * already shows the investigator's own real findings —
     * this panel was pure duplication of that, minus the
     * "actually derived from evidence" part.
     */


    /* =====================================================
       CLICK HANDLER
       ===================================================== */

    handleClick(event) {

        const rowCheckbox =
            event.target.closest(
                "[data-row-checkbox]"
            );

        if (rowCheckbox) {

            this.toggleEmailChecked(
                rowCheckbox.dataset.rowCheckbox
            );

            return;
        }


        const folderButton =
            event.target.closest(
                "[data-folder]"
            );

        if (folderButton) {

            this.selectFolder(
                folderButton.dataset.folder
            );

            return;
        }


        const labelButton =
            event.target.closest(
                "[data-label]"
            );

        if (labelButton) {

            this.applyLabelToSelected(
                labelButton.dataset.label
            );

            return;
        }


        const emailRow =
            event.target.closest(
                ".mail-row"
            );

        const actionButton =
            event.target.closest(
                "[data-action]"
            );


        if (actionButton) {

            const action =
                actionButton.dataset.action;

            this.handleAction(
                action,
                actionButton,
                event
            );

            return;
        }


        if (
            emailRow &&
            !event.target.closest(
                "button,input"
            )
        ) {

            if (emailRow.classList.contains("locked")) {

                this.showToast(
                    "This email is in Trash. Restore it to open it."
                );

                return;
            }

            this.selectEmail(
                emailRow.dataset.emailId
            );
        }
    }


    /* =====================================================
       ACTION ROUTER
       ===================================================== */

    handleAction(
        action,
        element,
        event
    ) {

        switch (action) {

            case "toggle-sidebar":
                this.toggleSidebar();
                break;

            case "clear-search":
                this.clearSearch();
                break;

            case "refresh":
                this.refresh();
                break;

            case "toggle-headers":
                this.state.showHeaders =
                    !this.state.showHeaders;

                this.render();
                break;

            case "analyze-email":
                this.analyzeSelectedEmail();
                break;

            case "analyze-link":
                this.analyzeLink(
                    Number(
                        element.dataset.linkIndex
                    )
                );
                break;

            case "analyze-attachment":
                this.analyzeAttachment(
                    Number(
                        element.dataset.attachmentIndex
                    )
                );
                break;

            case "open-attachment":
                this.openAttachment(
                    Number(
                        element.dataset.attachmentIndex
                    )
                );
                break;

            case "star":
            case "flag":
                this.toggleFlag();
                break;

            case "quarantine":
                this.toggleQuarantine();
                break;

            case "restore":
                this.restoreSelected();
                break;

            case "restore-row":
                this.restoreEmailById(
                    element.dataset.emailId
                );
                break;

            case "previous":
                this.navigateEmail(-1);
                break;

            case "next":
                this.navigateEmail(1);
                break;

            case "select-all":
                this.toggleSelectAll();
                break;

            case "archive":
                this.archiveSelected();
                break;

            case "delete":
                this.deleteSelected();
                break;

            case "bulk-delete":
                this.bulkAction("delete");
                break;

            case "bulk-quarantine":
                this.bulkAction("quarantine");
                break;

            case "bulk-flag":
                this.bulkAction("flag");
                break;

            case "compose":
                this.openComposeModal();
                break;

            case "reply":
                this.openReplyModal();
                break;

            case "forward":
                this.showToast(
                    "Forward is disabled in investigation mode."
                );
                break;

            case "help":
                this.showToast(
                    "NORTHSTAR Mail — email investigation workstation."
                );
                break;

            case "copy-value":
                this.copyValueToClipboard(
                    element?.dataset?.copyValue || "",
                    element
                );
                break;

            default:
                console.warn(
                    "[MAIL RENDERER] Unknown action:",
                    action
                );
        }
    }


    /* =====================================================
       SELECT EMAIL
       ===================================================== */

    selectEmail(emailId) {

        const emails =
            this.getEmails();

        const email =
            emails.find(
                item =>
                    item.id === emailId
            );

        if (!email) {
            return;
        }

        this.state.selectedEmailId =
            email.id;

        this.state.selectedEmail =
            email;

        this.state.showHeaders =
            false;

        this.markAsRead(email);

        if (this.store) {

            if (
                typeof this.store.selectEmail ===
                "function"
            ) {

                this.store.selectEmail(
                    email.id
                );
            }

            else if (
                typeof this.store.setSelectedEmail ===
                "function"
            ) {

                this.store.setSelectedEmail(
                    email.id
                );
            }
        }

        this.render();
    }


    /* =====================================================
       SELECT FOLDER
       ===================================================== */

    selectFolder(folder) {

        this.state.activeFolder =
            String(folder).toUpperCase();

        this.state.selectedEmailId =
            null;

        this.state.selectedEmail =
            null;

        this.state.showHeaders =
            false;

        if (this.store) {

            if (
                typeof this.store.setFolder ===
                "function"
            ) {

                this.store.setFolder(
                    this.state.activeFolder
                );
            }

            else if (
                typeof this.store.selectFolder ===
                "function"
            ) {

                this.store.selectFolder(
                    this.state.activeFolder
                );
            }
        }

        this.render();
    }


    /* =====================================================
       LABELS
       ---------------------------------------------------
       Labels are how the PLAYER identifies an email — not
       a pre-set ground-truth tag. Clicking a label applies
       it to whichever email is currently open; clicking the
       same label again removes it. This is what drives the
       category badge/risk marker shown in the inbox list —
       the game never auto-labels mail for the player.
       ===================================================== */

    applyLabelToSelected(category) {

        const email =
            this.getSelectedEmail();

        if (!email) {
            this.showToast("Select an email to label it.");
            return;
        }

        if (!this.store || typeof this.store.setUserLabel !== "function") {
            console.warn("[MAIL RENDERER] Store does not support setUserLabel().");
            return;
        }

        const current =
            typeof this.store.getUserLabel === "function"
                ? this.store.getUserLabel(email.id)
                : email.userLabel;

        const next =
            current === category
                ? null
                : category;

        this.store.setUserLabel(email.id, next);

        this.render();
    }


    /* =====================================================
       SEARCH
       ===================================================== */

    handleInput(event) {

        if (
            event.target.classList.contains(
                "mail-search-input"
            )
        ) {

            this.state.searchQuery =
                event.target.value;

            this.renderMessageAreaOnly();
        }
    }


    handleKeydown(event) {

        if (
            event.target.classList.contains(
                "mail-search-input"
            ) &&
            event.key === "Escape"
        ) {

            this.clearSearch();
        }

        if (
            event.target.closest(
                ".mail-row"
            ) &&
            event.key === "Enter"
        ) {

            const row =
                event.target.closest(
                    ".mail-row"
                );

            this.selectEmail(
                row.dataset.emailId
            );
        }
    }


    clearSearch() {

        this.state.searchQuery = "";

        this.render();
    }


    /* =====================================================
       SIDEBAR
       ===================================================== */

    toggleSidebar() {

        this.state.sidebarCollapsed =
            !this.state.sidebarCollapsed;

        this.render();
    }


    /* =====================================================
       FLAGS
       ===================================================== */

    toggleFlag() {

        const email =
            this.getSelectedEmail();

        if (!email) {
            return;
        }

        if (this.store) {

            if (
                typeof this.store.toggleFlag ===
                "function"
            ) {

                this.store.toggleFlag(
                    email.id
                );
            }

            else if (
                typeof this.store.toggleStar ===
                "function"
            ) {

                this.store.toggleStar(
                    email.id
                );
            }

            else {

                email.flagged =
                    !email.flagged;

                email.starred =
                    email.flagged;
            }
        }

        this.render();
    }


    /* =====================================================
       QUARANTINE
       ===================================================== */

    toggleQuarantine() {

        const email =
            this.getSelectedEmail();

        if (!email) {
            return;
        }

        if (!this.store) {
            return;
        }

        const currentlyQuarantined =
            this.isQuarantined(email);

        if (currentlyQuarantined) {

            if (
                typeof this.store.releaseFromQuarantine ===
                "function"
            ) {
                this.store.releaseFromQuarantine(email.id);
            }

            this.showToast("Email released from quarantine.");

        } else {

            if (
                typeof this.store.quarantineEmail ===
                "function"
            ) {
                this.store.quarantineEmail(
                    email.id,
                    "Analyst quarantine"
                );
            }

            this.showToast("Email quarantined.");
        }

        this.render();
    }


    restoreSelected() {

        const email =
            this.getSelectedEmail();

        if (!email) {
            return;
        }

        if (
            this.store &&
            typeof this.store.restoreEmail === "function"
        ) {
            this.store.restoreEmail(email.id);
        }

        this.showToast("Email restored from Trash.");

        this.render();
    }

    restoreEmailById(emailId) {

        if (!emailId) {
            return;
        }

        if (
            this.store &&
            typeof this.store.restoreEmail === "function"
        ) {
            this.store.restoreEmail(emailId);
        }

        this.showToast("Email restored from Trash.");

        this.render();
    }


    /* =====================================================
       CHECKBOX MULTI-SELECT
       ---------------------------------------------------
       Separate from "the open email" (this.state.selectedEmail,
       used for reading/labeling/analyzing one message at a
       time). Checked emails are what bulk toolbar actions
       (Delete, Quarantine, Flag) operate on — those buttons
       only appear once something is checked.
       ===================================================== */

    toggleEmailChecked(emailId) {

        if (this.checkedEmailIds.has(emailId)) {
            this.checkedEmailIds.delete(emailId);
        } else {
            this.checkedEmailIds.add(emailId);
        }

        this.render();
    }

    toggleSelectAll() {

        const state =
            this.getApplicationState();

        const visibleIds =
            state.filteredEmails.map(
                email => email.id
            );

        const allChecked =
            visibleIds.length > 0 &&
            visibleIds.every(
                id => this.checkedEmailIds.has(id)
            );

        if (allChecked) {

            visibleIds.forEach(
                id => this.checkedEmailIds.delete(id)
            );

        } else {

            visibleIds.forEach(
                id => this.checkedEmailIds.add(id)
            );
        }

        this.render();
    }

    bulkAction(action) {

        if (!this.store || this.checkedEmailIds.size === 0) {
            return;
        }

        const ids =
            Array.from(this.checkedEmailIds);

        let count = 0;

        ids.forEach(id => {

            if (action === "delete") {

                if (typeof this.store.deleteEmail === "function") {
                    this.store.deleteEmail(id);
                    count++;
                }

            } else if (action === "quarantine") {

                if (typeof this.store.quarantineEmail === "function") {
                    this.store.quarantineEmail(id, "Analyst quarantine");
                    count++;
                }

            } else if (action === "flag") {

                if (typeof this.store.toggleFlag === "function") {
                    this.store.toggleFlag(id);
                    count++;
                }
            }

            if (
                action === "delete" &&
                this.state.selectedEmailId === id
            ) {
                this.state.selectedEmailId = null;
                this.state.selectedEmail = null;
            }
        });

        this.checkedEmailIds.clear();

        const actionLabel = {
            delete: "moved to Trash",
            quarantine: "quarantined",
            flag: "flagged"
        }[action] || action;

        this.showToast(
            `${count} email${count === 1 ? "" : "s"} ${actionLabel}.`
        );

        this.render();
    }


    /* =====================================================
       MARK READ
       ===================================================== */

    markAsRead(email) {

        if (!email) return;

        if (this.store) {

            if (
                typeof this.store.markAsRead ===
                "function"
            ) {

                this.store.markAsRead(
                    email.id
                );

                return;
            }

            if (
                typeof this.store.markRead ===
                "function"
            ) {

                this.store.markRead(
                    email.id
                );

                return;
            }
        }

        email.read = true;
        email.unread = false;
    }


    /* =====================================================
       ARCHIVE
       ===================================================== */

    archiveSelected() {

        const email =
            this.getSelectedEmail();

        if (!email) {
            return;
        }

        if (
            typeof this.store?.archiveEmail ===
            "function"
        ) {

            this.store.archiveEmail(
                email.id
            );
        }

        else {

            email.archived = true;

            this.state.selectedEmailId =
                null;

            this.state.selectedEmail =
                null;
        }

        this.showToast(
            "Message archived."
        );

        this.render();
    }


    /* =====================================================
       DELETE
       ===================================================== */

    deleteSelected() {

        const email =
            this.getSelectedEmail();

        if (!email) {
            return;
        }

        if (
            typeof this.store?.deleteEmail ===
            "function"
        ) {

            this.store.deleteEmail(
                email.id
            );
        }

        else {

            email.deleted = true;
        }

        this.state.selectedEmailId =
            null;

        this.state.selectedEmail =
            null;

        this.showToast(
            "Message moved to trash."
        );

        this.render();
    }


    /* =====================================================
       NAVIGATION
       ===================================================== */

    navigateEmail(direction) {

        const state =
            this.getApplicationState();

        const emails =
            state.filteredEmails;

        if (!emails.length) {
            return;
        }

        let index =
            emails.findIndex(
                email =>
                    email.id ===
                    this.state.selectedEmailId
            );

        if (index === -1) {
            index =
                direction > 0
                    ? -1
                    : emails.length;
        }

        const nextIndex =
            index + direction;

        if (
            nextIndex < 0 ||
            nextIndex >= emails.length
        ) {
            return;
        }

        this.selectEmail(
            emails[nextIndex].id
        );
    }


    /* =====================================================
       LINK ANALYSIS
       ===================================================== */

    analyzeLink(index) {

        const email =
            this.getSelectedEmail();

        if (!email) return;

        const links =
            Array.isArray(email.links)
                ? email.links
                : [];

        const link =
            links[index];

        if (!link) return;

        let result = null;

        if (
            typeof this.investigator?.analyzeLink ===
            "function"
        ) {

            /*
             * Support both possible signatures:
             * analyzeLink(email, link)
             * analyzeLink(link)
             */

            try {

                result =
                    this.investigator.analyzeLink(
                        email,
                        link
                    );

            } catch {

                result =
                    this.investigator.analyzeLink(
                        link
                    );
            }
        }

        this.reportSuspiciousLinkToSiem(
            email,
            result
        );

        this.showAnalysisResult(
            "URL ANALYSIS",
            result || link
        );
    }


    /* =====================================================
       REPORT TO SIEM
       ---------------------------------------------------
       When the player's OWN analysis (structural findings,
       never the raw reputation/threat-score ground truth)
       turns up a genuinely risky link, that's worth surfacing
       to the SIEM as a "Suspicious Phishing Link Detected"
       alert — there's a detection rule for exactly this
       (DetectionEngine's SUSPICIOUS_LINK handler) that
       previously had no way to ever fire, since nothing in
       Mail sent it the event. Correlated by attackId so
       re-analyzing the same link doesn't spam duplicate
       alerts — DetectionEngine.createDetection() already
       dedupes on attackId + rule.
       ===================================================== */

    reportSuspiciousLinkToSiem(
        email,
        result
    ) {

        /*
         * Trigger on "found at least one real structural
         * finding" rather than requiring the aggregate risk to
         * reach HIGH — a single finding (e.g. a suspicious
         * keyword in the domain) only scores 10-20 points, and
         * scoreToRisk() doesn't call that HIGH until 55+. With
         * the current finding set, requiring HIGH here would
         * make this essentially unreachable, which defeats the
         * point of wiring it up at all.
         */
        if (
            !result ||
            !Array.isArray(result.findings) ||
            !result.findings.length
        ) {
            return;
        }

        if (
            !window.eventEngine ||
            typeof window.eventEngine.createEvent !==
            "function"
        ) {
            return;
        }

        const attackId =
            email?.simulation?.scenarioId ||
            null;

        const sourceEvent =
            attackId &&
                typeof window.eventEngine.getEventsByAttack ===
                "function"
                ? window.eventEngine
                    .getEventsByAttack(attackId)
                    .find(
                        e =>
                            e.eventType ===
                            "PHISHING_EMAIL_SENT"
                    )
                : null;

        window.eventEngine.createEvent({

            eventType:
                "SUSPICIOUS_LINK",

            severity:
                result.risk ||
                "MEDIUM",

            actor:
                "SOC Analyst",

            actorType:
                "USER",

            hostname:
                sourceEvent?.hostname ||
                null,

            username:
                sourceEvent?.username ||
                null,

            attackId,

            message:
                `Analyst-flagged suspicious link found while investigating a Mail message (${result.domain || "unknown domain"}).`,

            metadata: {

                emailId:
                    email?.id ||
                    null,

                linkUrl:
                    result.url ||
                    null,

                findings:
                    (result.findings || []).map(
                        finding =>
                            finding.code
                    )

            }

        });
    }


    /* =====================================================
       ATTACHMENT ANALYSIS
       ===================================================== */

    analyzeAttachment(index) {

        const email =
            this.getSelectedEmail();

        if (!email) return;

        const attachments =
            Array.isArray(
                email.attachments
            )
                ? email.attachments
                : [];

        const attachment =
            attachments[index];

        if (!attachment) return;

        let result = null;

        if (
            typeof this.investigator?.analyzeAttachment ===
            "function"
        ) {

            try {

                result =
                    this.investigator.analyzeAttachment(
                        email,
                        attachment
                    );

            } catch {

                result =
                    this.investigator.analyzeAttachment(
                        attachment
                    );
            }
        }

        this.showAnalysisResult(
            "ATTACHMENT ANALYSIS",
            result || attachment
        );
    }


    /* =====================================================
       OPEN ATTACHMENT
       ===================================================== */

    openAttachment(index) {

        const email =
            this.getSelectedEmail();

        if (!email) return;

        const attachment =
            email.attachments?.[index];

        if (!attachment) return;

        /*
         * Real, safe PDFs (coworker review requests etc.) get
         * genuinely generated and opened in the browser.
         * Everything else (malware, password-protected
         * archives, unknown risk) stays simulated — dispatched
         * as an event for the eventual File Explorer app,
         * since actually "opening" those isn't something we
         * want to do for real.
         */

        if (
            attachment.type === "application/pdf" &&
            attachment.pdfContent
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "northstar:mail:open-attachment",
                    {
                        detail: {
                            source: "MAIL",
                            emailId: email.id,
                            attachment
                        }
                    }
                )
            );

            this.openPdfViewer(attachment);

            return;
        }

        /*
         * The player's own screenshots/recordings (attached via
         * Compose's Attach picker) are real media sitting right
         * here in memory — no need to fake it through File
         * Explorer, just show it.
         */
        if (attachment.own && attachment.type?.startsWith("image/") && attachment.dataUrl) {

            this.openImageViewer(attachment);

            return;
        }

        if (attachment.own && attachment.type?.startsWith("video/") && (attachment.blobUrl || attachment.dataUrl)) {

            this.openVideoViewer(attachment);

            return;
        }

        window.dispatchEvent(
            new CustomEvent(
                "northstar:mail:open-attachment",
                {
                    detail: {
                        source: "MAIL",
                        emailId: email.id,
                        attachment
                    }
                }
            )
        );

        this.showToast(
            `Opening ${attachment.name} in File Explorer...`
        );
    }


    /* =====================================================
       PDF VIEWER
       ---------------------------------------------------
       Renders the generated PDF inline in an app modal via
       an iframe, instead of window.open(). Popups opened
       after an async dynamic import get silently blocked by
       most browsers since they're no longer considered a
       "direct result of a user click" — this sidesteps that
       entirely by never opening a new window/tab at all.
       ===================================================== */

    openPdfViewer(attachment) {

        const existing =
            document.querySelector(".mail-pdf-overlay");

        if (existing) {
            existing.remove();
        }

        const overlay =
            document.createElement("div");

        overlay.className = "mail-pdf-overlay";

        overlay.innerHTML = `
            <div class="mail-pdf-modal" role="dialog" aria-label="${this.escapeAttribute(attachment.name)}">

                <div class="mail-pdf-header">
                    <div class="mail-pdf-header-title">
                        <div class="mail-pdf-kicker">DOCUMENT</div>
                        <h2>${this.escapeHtml(attachment.name)}</h2>
                    </div>
                    <div class="mail-pdf-header-actions">
                        <button class="mail-pdf-download" data-pdf-download disabled>Download</button>
                        <button class="mail-pdf-close" data-pdf-close>×</button>
                    </div>
                </div>

                <div class="mail-pdf-body">
                    <div class="mail-pdf-loading">
                        <span class="mail-pdf-spinner"></span>
                        Generating document...
                    </div>
                </div>

            </div>
        `;

        document.body.appendChild(overlay);

        const closeAndCleanup = () => {

            const iframe =
                overlay.querySelector("iframe");

            if (iframe?.src) {
                URL.revokeObjectURL(iframe.src);
            }

            overlay.remove();
        };

        overlay.querySelectorAll("[data-pdf-close]").forEach(button => {
            button.addEventListener("click", closeAndCleanup);
        });

        overlay.addEventListener("click", event => {
            if (event.target === overlay) {
                closeAndCleanup();
            }
        });

        import("./PdfGenerator.js")
            .then(module =>
                module.buildReviewPdf(attachment.pdfContent)
            )
            .then(({ blobUrl }) => {

                const body =
                    overlay.querySelector(".mail-pdf-body");

                if (!body) {
                    /* Modal was closed before generation finished. */
                    URL.revokeObjectURL(blobUrl);
                    return;
                }

                body.innerHTML = `<iframe src="${blobUrl}" title="${this.escapeAttribute(attachment.name)}"></iframe>`;

                this.recordPdfOpenedAsFile(attachment);

                const downloadButton =
                    overlay.querySelector("[data-pdf-download]");

                if (downloadButton) {

                    downloadButton.disabled = false;

                    downloadButton.addEventListener("click", () => {

                        const link =
                            document.createElement("a");

                        link.href = blobUrl;
                        link.download = attachment.name;
                        link.click();
                    });
                }
            })
            .catch(error => {

                console.error("[MAIL] Failed to generate PDF:", error);

                const body =
                    overlay.querySelector(".mail-pdf-body");

                if (body) {

                    body.innerHTML = `
                        <div class="mail-pdf-error">
                            Couldn't generate this document. Check your connection and try again.
                        </div>
                    `;
                }
            });
    }


    /* =====================================================
       PDF -> FILE EXPLORER
       ---------------------------------------------------
       Opening a real, safe PDF from Mail is treated the same
       as the player having actually downloaded and opened it
       on their own machine — a real FILE_CREATED event lands
       in Downloads, same pattern CaptureTool.js uses for
       screenshots/recordings (see FileExplorerStore.
       getFileTreeForHost()). That's what makes it show up in
       File Explorer's Recent list without anything there
       needing to know Mail exists.

       Deduped by file path so re-opening the same attachment
       doesn't spawn duplicate entries in Downloads/Recent —
       the event only needs to be created once.
       ===================================================== */

    recordPdfOpenedAsFile(attachment) {

        if (!attachment?.name) {
            return;
        }

        if (!window.eventEngine || typeof window.eventEngine.createEvent !== "function") {
            return;
        }

        const filePath =
            `C:\\Users\\${LOCAL_MACHINE.assignedUser}\\Downloads\\${attachment.name}`;

        const alreadyOpened =
            window.eventEngine.getAllEvents().some(event =>
                event.eventType === "FILE_CREATED" &&
                event.metadata?.filePath === filePath
            );

        if (alreadyOpened) {
            return;
        }

        window.eventEngine.createEvent({

            eventType: "FILE_CREATED",
            severity: "INFO",
            hostname: LOCAL_MACHINE.hostname,
            username: LOCAL_MACHINE.assignedUser,

            message:
                `${attachment.name} was opened from Mail and saved to Downloads on ${LOCAL_MACHINE.hostname}.`,

            metadata: {
                fileName: attachment.name,
                filePath,
                fileHash: pseudoFileHash(filePath),
                fileSize: attachment.size || null,
                simulated: true,
                benign: true
            }

        });
    }


    /* =====================================================
       IMAGE VIEWER
       ---------------------------------------------------
       For screenshots the player attached to a message
       themselves (Compose → Attach). Simple lightbox, no
       generation step needed since the image already exists
       as a data URL.
       ===================================================== */

    openImageViewer(attachment) {

        const existing =
            document.querySelector(".mail-media-overlay");

        if (existing) {
            existing.remove();
        }

        const overlay =
            document.createElement("div");

        overlay.className = "mail-media-overlay";

        overlay.innerHTML = `
            <div class="mail-media-modal" role="dialog" aria-label="${this.escapeAttribute(attachment.name)}">
                <div class="mail-media-header">
                    <h2>${this.escapeHtml(attachment.name)}</h2>
                    <button class="mail-pdf-close" data-media-close>×</button>
                </div>
                <div class="mail-media-body">
                    <img class="mail-media-image" src="${attachment.dataUrl}" alt="${this.escapeAttribute(attachment.name)}">
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const close = () => overlay.remove();

        overlay.querySelector("[data-media-close]")
            ?.addEventListener("click", close);

        overlay.addEventListener("click", event => {
            if (event.target === overlay) {
                close();
            }
        });
    }


    /* =====================================================
       VIDEO VIEWER
       ---------------------------------------------------
       For screen recordings the player attached themselves.
       blobUrl comes straight from CaptureTool's MediaRecorder
       output — nothing to generate.
       ===================================================== */

    openVideoViewer(attachment) {

        const existing =
            document.querySelector(".mail-media-overlay");

        if (existing) {
            existing.remove();
        }

        const overlay =
            document.createElement("div");

        overlay.className = "mail-media-overlay";

        const source =
            attachment.blobUrl || attachment.dataUrl;

        overlay.innerHTML = `
            <div class="mail-media-modal" role="dialog" aria-label="${this.escapeAttribute(attachment.name)}">
                <div class="mail-media-header">
                    <h2>${this.escapeHtml(attachment.name)}</h2>
                    <button class="mail-pdf-close" data-media-close>×</button>
                </div>
                <div class="mail-media-body">
                    <video class="mail-media-video" src="${source}" controls autoplay></video>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const close = () => {

            const video =
                overlay.querySelector("video");

            video?.pause();

            overlay.remove();
        };

        overlay.querySelector("[data-media-close]")
            ?.addEventListener("click", close);

        overlay.addEventListener("click", event => {
            if (event.target === overlay) {
                close();
            }
        });
    }


    /* =====================================================
       EMAIL ANALYSIS
       ===================================================== */

    analyzeSelectedEmail() {

        const email =
            this.getSelectedEmail();

        if (!email) {
            return;
        }

        let result = null;

        if (
            typeof this.investigator?.investigateEmail ===
            "function"
        ) {

            result =
                this.investigator.investigateEmail(
                    email
                );
        }

        else if (
            typeof this.investigator?.calculateRisk ===
            "function"
        ) {

            result =
                this.investigator.calculateRisk(
                    email
                );
        }

        else {

            result = {
                classification:
                    email.classification ||
                    "UNKNOWN",

                indicators: []
            };
        }

        this.analyzedEmailIds.add(email.id);

        this.showAnalysisResult(
            "EMAIL INVESTIGATION",
            result
        );

        this.render();
    }


    /* =====================================================
       ANALYSIS MODAL
       ===================================================== */

    showAnalysisResult(
        title,
        result
    ) {

        const existing =
            document.querySelector(
                ".mail-analysis-overlay"
            );

        if (existing) {
            existing.remove();
        }

        const formatted =
            title === "EMAIL INVESTIGATION" &&
                result &&
                typeof result === "object" &&
                "score" in result
                ? this.renderInvestigationReport(result)
                : this.formatObject(result);

        const overlay =
            document.createElement(
                "div"
            );

        overlay.className =
            "mail-analysis-overlay";

        overlay.innerHTML = `

            <div
                class="mail-analysis-modal"
                role="dialog"
            >

                <div class="mail-analysis-header">

                    <div>

                        <div class="mail-analysis-kicker">
                            NORTHSTAR INVESTIGATION
                        </div>

                        <h2>
                            ${this.escapeHtml(
            title
        )}
                        </h2>

                    </div>

                    <button
                        class="mail-analysis-close"
                        data-analysis-close
                    >
                        ×
                    </button>

                </div>


                <div class="mail-analysis-content">

                    ${formatted}

                </div>


                <div class="mail-analysis-footer">

                    <span>
                        SIMULATED INTELLIGENCE
                    </span>

                    <button
                        class="mail-analysis-button"
                        data-analysis-close
                    >
                        CLOSE
                    </button>

                </div>

            </div>
        `;

        document.body.appendChild(
            overlay
        );

        const closeButtons =
            overlay.querySelectorAll(
                "[data-analysis-close]"
            );

        closeButtons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => overlay.remove()
                );
            }
        );

        overlay.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    overlay
                ) {
                    overlay.remove();
                }
            }
        );

        /*
         * This modal is appended straight to document.body, not
         * to this.container, so it sits outside the delegated
         * [data-action] click handler mount() wires up on the
         * container — copy buttons rendered inside it (IOC list,
         * analysis rows) need their own delegated listener here.
         */
        overlay.addEventListener(
            "click",
            event => {

                const copyButton =
                    event.target.closest(
                        '[data-action="copy-value"]'
                    );

                if (!copyButton) {
                    return;
                }

                this.copyValueToClipboard(
                    copyButton.dataset.copyValue || "",
                    copyButton
                );
            }
        );
    }
    /* =========================================================
   PASTE THIS METHOD INTO THE MailRenderer CLASS
   (e.g. directly below showAnalysisResult(...) { ... })
   ========================================================= */

    /* =====================================================
       COMPOSE — INCIDENT REPORT
       ---------------------------------------------------
       This is the endgame flow: the player writes an
       incident report and sends it, as an email, to their
       boss. Sending calls store.sendReport(), which records
       it as a SENT email and fires MAIL_STORE_EVENTS.REPORT_SENT
       so scenario/scoring code can react to it.
       ===================================================== */

    openComposeModal() {

        this.openMessageModal({
            kicker: "INCIDENT REPORT",
            heading: "New Message",
            toValue: BOSS.address,
            toLabel: `${BOSS.name} — ${BOSS.title}`,
            toReadonly: true,
            subjectPlaceholder: "Incident Report — [Campaign / Summary]",
            bodyPlaceholder: "Summarize what happened, the evidence you found (IOCs, affected hosts/users), and your recommended action...",
            sendLabel: "Send Report",
            hint: "Sent reports appear in your Sent folder.",
            onSend: ({ to, subject, body, attachments }) =>
                this.store?.sendReport?.({ to, subject, body, attachments }),
            successToast: "Incident report sent.",

            /*
             * Only the incident-report Compose flow passes this —
             * Reply doesn't. Marcus's "you're clear, here's what's
             * next" briefing should only ever play once a report
             * has actually been accepted (subject passed the same
             * isLikelyIncidentReport() check sendReport() itself
             * gates evidence-completeness on), not on every
             * successful send through this modal.
             */
            onSuccess: ({ subject }) => {

                if (
                    isLikelyIncidentReport(subject) &&
                    window.NorthstarReportClearanceBriefing
                ) {

                    window.NorthstarReportClearanceBriefing.launch();

                }

            }
        });
    }


    /* =====================================================
       REPLY — actually functional now, restricted to
       coworkers on the company domain (@northstar.local).
       Replying to an external/attacker address is still
       possible to attempt, but sending will be rejected —
       that's the actual enforcement of "you can only
       message people at your company."
       ===================================================== */

    openReplyModal() {

        const email =
            this.getSelectedEmail();

        if (!email) {
            return;
        }

        const originalAddress =
            this.getSenderAddress(email);

        const coworker =
            findCoworkerByAddress(originalAddress);

        const subject =
            /^re:/i.test(email.subject || "")
                ? email.subject
                : `Re: ${email.subject || "(No subject)"}`;

        const quotedDate =
            this.formatFullDate(email.timestamp || email.date);

        const quotedHtml = `
            <div class="mail-compose-quote">
                <div class="mail-compose-quote-meta">
                    On ${this.escapeHtml(quotedDate)}, ${this.escapeHtml(this.getSenderName(email))}
                    &lt;${this.escapeHtml(originalAddress)}&gt; wrote:
                </div>
                <div class="mail-compose-quote-body">
                    ${this.renderSafeEmailBody(
            email.body?.content || email.body || ""
        )}
                </div>
            </div>
        `;

        this.openMessageModal({
            kicker: "REPLY",
            heading: subject,
            toValue: originalAddress,
            toLabel: coworker
                ? `${coworker.name} — ${coworker.title}`
                : originalAddress,
            toReadonly: true,
            subjectValue: subject,
            bodyPlaceholder: "Write your reply...",
            quotedHtml,
            sendLabel: "Send Reply",
            hint: `Only @${COMPANY_DOMAIN} addresses can receive mail from you.`,
            onSend: ({ to, subject: subjectValue, body, attachments }) =>
                this.store?.sendEmail?.({
                    to,
                    subject: subjectValue,
                    body,
                    attachments,
                    inReplyToEmailId: email.id
                }),
            successToast: "Reply sent."
        });
    }


    /* =====================================================
       SHARED MESSAGE MODAL
       ---------------------------------------------------
       Backs both the incident-report Compose flow and Reply.
       `onSend` should call the matching store method and
       return its {success, reason} result.
       ===================================================== */

    openMessageModal({
        kicker,
        heading,
        toValue,
        toLabel,
        toReadonly = false,
        subjectValue = "",
        subjectPlaceholder = "",
        bodyPlaceholder = "",
        quotedHtml = "",
        sendLabel = "Send",
        hint = "",
        onSend,
        successToast = "Message sent.",
        onSuccess
    }) {

        const existing =
            document.querySelector(".mail-compose-overlay");

        if (existing) {
            existing.remove();
        }

        const overlay =
            document.createElement("div");

        overlay.className = "mail-compose-overlay";

        overlay.innerHTML = `
            <div class="mail-compose-modal" role="dialog" aria-label="${this.escapeAttribute(heading)}">

                <div class="mail-compose-header">
                    <div>
                        <div class="mail-compose-kicker">${this.escapeHtml(kicker)}</div>
                        <h2>${this.escapeHtml(heading)}</h2>
                    </div>
                    <button class="mail-compose-close" data-compose-close>×</button>
                </div>

                <div class="mail-compose-fields">

                    <div class="mail-compose-field">
                        <label for="mail-compose-to">To</label>
                        ${toReadonly
                ? `
                                    <div class="mail-compose-to-readonly">
                                        <span class="mail-compose-to-name">${this.escapeHtml(toLabel || toValue)}</span>
                                        <span class="mail-compose-to-address">${this.escapeHtml(toValue)}</span>
                                    </div>
                                    <input type="hidden" id="mail-compose-to" value="${this.escapeAttribute(toValue)}">
                                `
                : `
                                    <input
                                        id="mail-compose-to"
                                        type="text"
                                        value="${this.escapeAttribute(toValue || "")}"
                                        placeholder="name@${COMPANY_DOMAIN}"
                                        autocomplete="off"
                                    >
                                `
            }
                    </div>

                    <div class="mail-compose-field">
                        <label for="mail-compose-subject">Subject</label>
                        <input
                            id="mail-compose-subject"
                            type="text"
                            value="${this.escapeAttribute(subjectValue)}"
                            placeholder="${this.escapeAttribute(subjectPlaceholder)}"
                            autocomplete="off"
                        >
                    </div>

                    <div class="mail-compose-field mail-compose-body-field">
                        <label for="mail-compose-body">Message</label>
                        <textarea
                            id="mail-compose-body"
                            placeholder="${this.escapeAttribute(bodyPlaceholder)}"
                        ></textarea>
                    </div>

                    <div class="mail-compose-field">
                        <label>Attachments</label>
                        <div class="mail-compose-attach-row">
                            <button type="button" class="mail-compose-attach-button" data-compose-attach>
                                <span>📎</span> Upload
                            </button>
                            <span class="mail-compose-attach-hint">Choose a screenshot or recording from File Explorer</span>
                        </div>
                        <div class="mail-compose-attachments" data-compose-attachments></div>
                    </div>

                    ${quotedHtml || ""}

                </div>

                <div class="mail-compose-footer">
                    <span class="mail-compose-hint">${this.escapeHtml(hint)}</span>
                    <div class="mail-compose-footer-actions">
                        <button class="mail-compose-button secondary" data-compose-close>Discard</button>
                        <button class="mail-compose-button primary" data-compose-send>${this.escapeHtml(sendLabel)}</button>
                    </div>
                </div>

            </div>
        `;

        document.body.appendChild(overlay);

        const closeButtons =
            overlay.querySelectorAll("[data-compose-close]");

        closeButtons.forEach(button => {
            button.addEventListener("click", () => overlay.remove());
        });

        overlay.addEventListener("click", event => {
            if (event.target === overlay) {
                overlay.remove();
            }
        });


        /* =================================================
           ATTACHMENTS
           -------------------------------------------------
           Attachments come only from this session's Captures
           (screenshots/recordings taken with Ctrl+Shift+S /
           Ctrl+Shift+R) — there's no arbitrary file upload,
           since the whole point is getting evidence you just
           captured in front of the boss.
           ================================================= */

        let composeAttachments = [];

        const attachmentsContainer =
            overlay.querySelector("[data-compose-attachments]");

        const renderAttachmentChips = () => {

            if (!attachmentsContainer) return;

            if (!composeAttachments.length) {
                attachmentsContainer.innerHTML = "";
                return;
            }

            attachmentsContainer.innerHTML =
                composeAttachments.map(attachment => `
                    <div class="mail-compose-attachment-chip" data-chip-id="${this.escapeAttribute(attachment.id)}">
                        ${attachment.type?.startsWith("image/") && attachment.dataUrl
                        ? `<img class="mail-compose-attachment-chip-thumb" src="${attachment.dataUrl}" alt="">`
                        : `<span class="mail-compose-attachment-chip-thumb mail-compose-attachment-chip-video">🎬</span>`
                    }
                        <div class="mail-compose-attachment-chip-info">
                            <span class="mail-compose-attachment-chip-name">${this.escapeHtml(attachment.name)}</span>
                            <span class="mail-compose-attachment-chip-meta">${this.formatBytes(attachment.size)}${attachment.nightfallDomain ? ` · ☾ ${this.escapeHtml(attachment.nightfallDomain)}` : ""}</span>
                        </div>
                        <button type="button" class="mail-compose-attachment-chip-remove" data-chip-remove="${this.escapeAttribute(attachment.id)}" aria-label="Remove attachment">×</button>
                    </div>
                `).join("");

            attachmentsContainer.querySelectorAll("[data-chip-remove]").forEach(button => {

                button.addEventListener("click", () => {

                    const id = button.dataset.chipRemove;

                    composeAttachments =
                        composeAttachments.filter(item => item.id !== id);

                    renderAttachmentChips();
                });
            });
        };

        const attachButton =
            overlay.querySelector("[data-compose-attach]");

        if (attachButton) {

            attachButton.addEventListener("click", () => {

                this.openAttachPicker(chosen => {

                    chosen.forEach(capture => {

                        if (composeAttachments.some(item => item.id === capture.id)) {
                            return;
                        }

                        composeAttachments.push(
                            this.captureToAttachment(capture)
                        );
                    });

                    renderAttachmentChips();
                });
            });
        }


        const sendButton =
            overlay.querySelector("[data-compose-send]");

        if (sendButton) {

            sendButton.addEventListener("click", () => {

                const to =
                    overlay.querySelector("#mail-compose-to").value.trim();

                const subject =
                    overlay.querySelector("#mail-compose-subject").value.trim();

                const body =
                    overlay.querySelector("#mail-compose-body").value.trim();

                if (!to || !subject || !body) {
                    this.flashComposeError(overlay, "Please fill in the recipient, subject, and message before sending.");
                    return;
                }

                if (!isCompanyAddress(to)) {
                    this.flashComposeError(
                        overlay,
                        `You can only send messages to people at Northstar (an @${COMPANY_DOMAIN} address). "${to}" is outside the company.`
                    );
                    return;
                }

                if (typeof onSend !== "function") {
                    this.flashComposeError(overlay, "Sending isn't wired up yet.");
                    return;
                }

                const result =
                    onSend({ to, subject, body, attachments: composeAttachments });

                if (!result || !result.success) {

                    let message =
                        "Couldn't send that message — check the fields and try again.";

                    if (result?.reason === "INVALID_RECIPIENT") {

                        message =
                            `You can only send messages to people at Northstar (an @${COMPANY_DOMAIN} address).`;

                    } else if (result?.reason === "INCOMPLETE_EVIDENCE") {

                        const missingDomains =
                            result.missingDomains || [];

                        const stillLockedFiles =
                            result.stillLockedFiles || [];

                        const parts = [];

                        if (missingDomains.length > 0) {

                            parts.push(
                                `a screenshot or recording of the Nightfall page for each domain — still missing: ${missingDomains.join(", ")}`
                            );

                        }

                        if (stillLockedFiles.length > 0) {

                            parts.push(
                                `both locked files cracked in Password Cracker — still locked: ${stillLockedFiles.join(", ")}`
                            );

                        }

                        message =
                            `Marcus won't accept this yet — he needs ${parts.join(", and ")}.`;

                    }

                    this.flashComposeError(overlay, message);
                    return;
                }

                overlay.remove();

                this.showToast(successToast);

                this.render();

                if (typeof onSuccess === "function") {
                    onSuccess({ to, subject, body, result });
                }
            });
        }

        const firstInput =
            overlay.querySelector(
                toReadonly ? "#mail-compose-subject" : "#mail-compose-to"
            );

        if (firstInput) {
            firstInput.focus();
        }
    }

    flashComposeError(overlay, message) {

        let errorEl =
            overlay.querySelector(".mail-compose-error");

        if (!errorEl) {

            errorEl = document.createElement("div");
            errorEl.className = "mail-compose-error";

            const footer =
                overlay.querySelector(".mail-compose-footer");

            footer.parentNode.insertBefore(errorEl, footer);
        }

        errorEl.textContent = message;
    }


    /* =====================================================
       ATTACH PICKER ("Upload")
       ---------------------------------------------------
       Lists the player's own screenshots/recordings straight
       out of File Explorer (Pictures\Screenshots, Videos\Captures)
       — a fresh FileExplorerStore reads the exact same event
       log the real File Explorer app does, so this is never
       out of sync with what's actually sitting in those
       folders. Dynamic import since MailRenderer doesn't
       otherwise depend on the files/ module (same pattern as
       openPdfViewer's import("./PdfGenerator.js")).
       ===================================================== */

    async openAttachPicker(onAttach) {

        const existing =
            document.querySelector(".mail-attach-picker-overlay");

        if (existing) {
            existing.remove();
        }

        let captures = [];

        try {

            const { FileExplorerStore } =
                await import("../files/FileExplorerStore.js");

            captures =
                new FileExplorerStore().getCaptureFiles();

        } catch (error) {

            console.error("[MAIL] Couldn't reach File Explorer for the Upload picker:", error);
        }

        const overlay =
            document.createElement("div");

        overlay.className = "mail-attach-picker-overlay";

        const itemsHtml =
            captures.length
                ? captures.map(
                    (capture, index) => this.renderAttachPickerItem(capture, index)
                ).join("")
                : `
                    <div class="mail-attach-picker-empty">
                        No screenshots or recordings yet.<br>
                        Take one from the desktop — <strong>📷 Screenshot</strong> or <strong>⏺ Record</strong>
                        (bottom-left, or Ctrl+Shift+S / Ctrl+Shift+R) — and it'll show up here.
                    </div>
                `;

        overlay.innerHTML = `
            <div class="mail-attach-picker-modal" role="dialog" aria-label="Upload from File Explorer">

                <div class="mail-attach-picker-header">
                    <h3>Upload from File Explorer</h3>
                    <button class="mail-compose-close" data-attach-picker-close>×</button>
                </div>

                <div class="mail-attach-picker-list">
                    ${itemsHtml}
                </div>

                <div class="mail-attach-picker-footer">
                    <span class="mail-attach-picker-count">0 selected</span>
                    <button class="mail-compose-button primary" data-attach-picker-confirm disabled>Attach</button>
                </div>

            </div>
        `;

        document.body.appendChild(overlay);

        const selected = new Set();

        const countEl =
            overlay.querySelector(".mail-attach-picker-count");

        const confirmButton =
            overlay.querySelector("[data-attach-picker-confirm]");

        const updateCount = () => {

            countEl.textContent =
                `${selected.size} selected`;

            confirmButton.disabled = selected.size === 0;
        };

        overlay.querySelectorAll("[data-attach-item]").forEach(item => {

            item.addEventListener("click", () => {

                const index = item.dataset.attachItem;

                if (selected.has(index)) {
                    selected.delete(index);
                    item.classList.remove("selected");
                } else {
                    selected.add(index);
                    item.classList.add("selected");
                }

                updateCount();
            });
        });

        const close = () => overlay.remove();

        overlay.querySelector("[data-attach-picker-close]")
            ?.addEventListener("click", close);

        overlay.addEventListener("click", event => {
            if (event.target === overlay) {
                close();
            }
        });

        confirmButton.addEventListener("click", () => {

            const chosen =
                captures.filter(
                    (capture, index) => selected.has(String(index))
                );

            if (typeof onAttach === "function") {
                onAttach(chosen);
            }

            close();
        });
    }

    renderAttachPickerItem(capture, index) {

        const isImage =
            capture.mimeType?.startsWith("image/");

        const thumb =
            isImage && capture.dataUrl
                ? `<img class="mail-attach-picker-thumb" src="${capture.dataUrl}" alt="">`
                : `<span class="mail-attach-picker-thumb mail-attach-picker-thumb-video">🎬</span>`;

        const meta =
            isImage
                ? `${capture.width || "?"}×${capture.height || "?"} · ${this.formatBytes(capture.size)}`
                : `${this.formatCaptureDuration(capture.durationMs)} · ${this.formatBytes(capture.size)}`;

        const nightfallTag =
            capture.nightfallDomain
                ? `<span class="mail-attach-picker-item-tag">☾ ${this.escapeHtml(capture.nightfallDomain)}</span>`
                : "";

        return `
            <div class="mail-attach-picker-item" data-attach-item="${index}">
                ${thumb}
                <div class="mail-attach-picker-item-info">
                    <span class="mail-attach-picker-item-name">${this.escapeHtml(capture.name)}</span>
                    <span class="mail-attach-picker-item-meta">${this.escapeHtml(meta)}</span>
                    ${nightfallTag}
                </div>
                <span class="mail-attach-picker-check">✓</span>
            </div>
        `;
    }

    /**
     * Converts a File Explorer file-tree node (isCapture: true
     * — a screenshot or recording, see FileExplorerStore.getCaptureFiles())
     * into the same shape the rest of Mail already renders
     * attachments in. Marked `own: true` so renderAttachment()
     * knows to skip the ANALYZE button — these are the player's
     * own screenshots, not investigation evidence.
     */
    captureToAttachment(capture) {

        return {
            id: capture.eventId || capture.path,
            name: capture.name,
            type: capture.mimeType || "application/octet-stream",
            size: capture.size,
            dataUrl: capture.dataUrl || null,
            blobUrl: capture.blobUrl || null,
            width: capture.width || null,
            height: capture.height || null,
            durationMs: capture.durationMs || null,
            nightfallDomain: capture.nightfallDomain || null,
            own: true
        };
    }

    formatCaptureDuration(ms) {

        if (!ms || ms < 0) return "0:00";

        const totalSeconds = Math.floor(ms / 1000);

        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    }


    /* =====================================================
       TOAST
       ===================================================== */

    /* =====================================================
       COPY TO CLIPBOARD
       ---------------------------------------------------
       Small "copy" buttons next to domains/IOCs in the link
       list and the investigation report — so a player doesn't
       have to hand-type/select a domain to paste it into
       Threat Intel, Network, or the malware sandbox. Copies
       the value as-is with no confirmation dialog, just a
       toast, and briefly swaps the button's own icon so
       there's feedback right at the click point too.
       ===================================================== */

    renderCopyButton(value, label = "Copy") {

        const text =
            String(value || "").trim();

        if (!text) {
            return "";
        }

        return `
            <button
                type="button"
                class="mail-copy-button"
                data-action="copy-value"
                data-copy-value="${this.escapeHtml(text)}"
                title="${this.escapeHtml(label)}"
                aria-label="${this.escapeHtml(label)}"
            >⧉</button>
        `;
    }

    copyValueToClipboard(value, buttonElement) {

        const text =
            String(value || "").trim();

        if (!text) {
            return;
        }

        const flashButton = () => {

            if (!buttonElement) {
                return;
            }

            const original =
                buttonElement.innerHTML;

            buttonElement.innerHTML =
                "✓";

            buttonElement.classList.add(
                "copied"
            );

            setTimeout(
                () => {

                    buttonElement.innerHTML =
                        original;

                    buttonElement.classList.remove(
                        "copied"
                    );

                },
                1200
            );
        };

        const fallbackCopy = () => {

            try {

                const textarea =
                    document.createElement(
                        "textarea"
                    );

                textarea.value = text;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";

                document.body.appendChild(
                    textarea
                );

                textarea.select();

                document.execCommand(
                    "copy"
                );

                textarea.remove();

                return true;

            } catch {

                return false;
            }
        };

        if (
            navigator.clipboard &&
            typeof navigator.clipboard.writeText === "function"
        ) {

            navigator.clipboard.writeText(text)
                .then(() => {

                    flashButton();

                    this.showToast(
                        `Copied "${text}" to clipboard.`
                    );

                })
                .catch(() => {

                    if (fallbackCopy()) {

                        flashButton();

                        this.showToast(
                            `Copied "${text}" to clipboard.`
                        );

                    } else {

                        this.showToast(
                            "Couldn't copy — copy it manually."
                        );
                    }
                });

        } else if (fallbackCopy()) {

            flashButton();

            this.showToast(
                `Copied "${text}" to clipboard.`
            );

        } else {

            this.showToast(
                "Couldn't copy — copy it manually."
            );
        }
    }


    showToast(message) {

        this.state.toast =
            String(message);

        this.renderToast();

        setTimeout(
            () => {

                this.state.toast =
                    null;

                this.renderToast();

            },
            3000
        );
    }


    renderToast() {

        const container =
            this.container?.querySelector(
                ".mail-toast-container"
            );

        if (!container) {
            return;
        }

        if (!this.state.toast) {

            container.innerHTML =
                "";

            return;
        }

        container.innerHTML = `

            <div class="mail-toast">

                <span class="mail-toast-dot"></span>

                <span>
                    ${this.escapeHtml(
            this.state.toast
        )}
                </span>

            </div>
        `;
    }


    /* =====================================================
       REFRESH
       ===================================================== */

    refresh() {

        this.syncFromStore();

        this.render();

        this.showToast(
            "Mailbox refreshed."
        );
    }


    /* =====================================================
       MESSAGE AREA ONLY
       ===================================================== */

    renderMessageAreaOnly() {

        const area =
            this.container?.querySelector(
                ".mail-message-area"
            );

        if (!area) {
            this.render();
            return;
        }

        const state =
            this.getApplicationState();

        area.outerHTML = `

            <div class="mail-message-area">

                <section class="mail-message-list">

                    ${this.renderMessageList(
            state
        )}

                </section>

                <section class="mail-reading-pane">

                    ${this.renderReadingPane(
            state.selectedEmail
        )}

                </section>

            </div>
        `;
    }


    /* =====================================================
       FILTERING
       ===================================================== */

    filterEmails(
        emails,
        folder
    ) {

        return emails.filter(
            email => {

                if (
                    folder === "TRASH"
                ) {
                    return this.isDeleted(
                        email
                    );
                }

                if (this.isDeleted(email)) {
                    return false;
                }

                if (
                    folder === "QUARANTINE"
                ) {
                    return this.isQuarantined(
                        email
                    );
                }

                if (this.isQuarantined(email)) {
                    return false;
                }

                if (
                    folder === "STARRED"
                ) {
                    return this.isFlagged(
                        email
                    );
                }

                if (
                    folder === "FLAGGED"
                ) {
                    return this.isFlagged(
                        email
                    );
                }

                if (
                    folder === "SENT"
                ) {
                    return String(
                        email.folder ||
                        ""
                    ).toUpperCase() ===
                        "SENT";
                }

                if (
                    folder === "INBOX"
                ) {

                    return (
                        !email.archived &&
                        String(
                            email.folder ||
                            "INBOX"
                        ).toUpperCase() ===
                        "INBOX"
                    );
                }

                return true;
            }
        );
    }


    emailMatchesSearch(
        email,
        query
    ) {

        const searchable = [

            email.subject,

            email.from?.name,

            email.from?.address,

            email.sender,

            email.to,

            email.replyTo,

            email.body?.content,

            email.body,

            email.userLabel

        ]
            .flat()
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return searchable.includes(
            query
        );
    }


    /* =====================================================
       COUNTS
       ===================================================== */

    getFolderCount(
        folder,
        emails
    ) {

        if (folder === "INBOX") {

            return emails.filter(
                email =>
                    !this.isRead(email) &&
                    !email.archived &&
                    !this.isQuarantined(email) &&
                    !this.isDeleted(email) &&
                    String(
                        email.folder ||
                        "INBOX"
                    ).toUpperCase() ===
                    "INBOX"
            ).length;
        }

        return 0;
    }


    getFlaggedCount(emails) {

        return emails.filter(
            email =>
                this.isFlagged(email)
        ).length;
    }


    getQuarantinedCount(emails) {

        return emails.filter(
            email =>
                this.isQuarantined(email)
        ).length;
    }


    getTrashCount(emails) {

        return emails.filter(
            email =>
                this.isDeleted(email)
        ).length;
    }


    getCategoryCount(
        category,
        emails
    ) {

        return emails.filter(
            email =>
                email.userLabel &&
                this.normalizeCategory(
                    email.userLabel
                ) === category
        ).length;
    }


    /* =====================================================
       EMAIL HELPERS
       ===================================================== */

    getSenderName(email) {

        return (
            email.from?.name ||
            email.sender?.name ||
            email.sender ||
            "Unknown Sender"
        );
    }


    getSenderAddress(email) {

        return (
            email.from?.address ||
            email.sender?.address ||
            email.from ||
            "unknown@unknown"
        );
    }


    getRecipients(email) {

        const recipients =
            email.to || [];

        if (Array.isArray(recipients)) {

            return recipients.join(
                ", "
            );
        }

        return String(
            recipients ||
            "unknown"
        );
    }


    getPreview(email) {

        const body =
            email.body?.content ||
            email.body ||
            email.content ||
            "";

        return this.stripDangerousMarkup(
            String(body)
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim()
            .slice(
                0,
                115
            );
    }


    getInitials(name) {

        const parts =
            String(name)
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (!parts.length) {
            return "?";
        }

        return parts
            .slice(0, 2)
            .map(
                part =>
                    part.charAt(0)
                        .toUpperCase()
            )
            .join("");
    }


    getFileIcon(name = "") {

        const extension =
            String(name)
                .split(".")
                .pop()
                .toLowerCase();

        const icons = {

            zip: "▣",
            rar: "▣",
            "7z": "▣",

            pdf: "▤",

            doc: "▤",
            docx: "▤",

            xls: "▦",
            xlsx: "▦",

            txt: "≡",

            exe: "⚙",
            dll: "⚙",

            js: "⌘",

            png: "▧",
            jpg: "▧",
            jpeg: "▧"

        };

        return icons[extension] || "□";
    }


    /* =====================================================
       CATEGORY / RISK
       ===================================================== */

    normalizeCategory(
        category
    ) {

        const value =
            String(
                category ||
                "NORMAL"
            )
                .trim()
                .toUpperCase();

        const allowed = [

            "NORMAL",
            "PHISHING",
            "BEC",
            "MALWARE",
            "SUSPICIOUS",
            "INTERNAL"

        ];

        return allowed.includes(
            value
        )
            ? value
            : "NORMAL";
    }


    isSuspicious(email) {

        if (!email.userLabel) {
            return false;
        }

        const category =
            this.normalizeCategory(
                email.userLabel
            );

        return [
            "PHISHING",
            "BEC",
            "MALWARE",
            "SUSPICIOUS"
        ].includes(
            category
        );
    }


    isRead(email) {

        return (
            email.read === true ||
            email.isRead === true ||
            email.unread === false
        );
    }


    isFlagged(email) {

        return (
            email.flagged === true ||
            email.starred === true ||
            email.isFlagged === true
        );
    }


    isQuarantined(email) {

        return (
            email.quarantined === true ||
            email.isQuarantined === true
        );
    }


    isDeleted(email) {

        return (
            email.deleted === true ||
            email.isDeleted === true
        );
    }


    /* =====================================================
       AUTH HELPERS
       ---------------------------------------------------
       normalizeAuth()/calculateAuthenticationRisk() were
       removed along with the scored authentication panel —
       nothing calls them anymore. buildAuthenticationHeader()
       stays: it only feeds the raw "VIEW FULL HEADERS" text
       dump, which a player has to open and read for themselves
       (no color-coded PASS/FAIL badge), so it's not a
       ground-truth giveaway the way the panel was.
       ===================================================== */

    buildAuthenticationHeader(
        email
    ) {

        const headers =
            email.headers ||
            {};

        return `
            spf=${headers.spf || "unknown"};
            dkim=${headers.dkim || "unknown"};
            dmarc=${headers.dmarc || "unknown"}
        `;
    }


    /* =====================================================
       FORMATTING
       ===================================================== */

    formatListDate(
        value
    ) {

        if (!value) {
            return "—";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return String(value);
        }

        const now =
            new Date();

        const sameDay =
            date.toDateString() ===
            now.toDateString();

        if (sameDay) {

            return date.toLocaleTimeString(
                [],
                {
                    hour: "numeric",
                    minute: "2-digit"
                }
            );
        }

        return date.toLocaleDateString(
            [],
            {
                month: "short",
                day: "numeric"
            }
        );
    }


    formatFullDate(
        value
    ) {

        if (!value) {
            return "—";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return String(value);
        }

        return date.toLocaleString(
            [],
            {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit"
            }
        );
    }


    formatBytes(
        bytes
    ) {

        const size =
            Number(bytes);

        if (!Number.isFinite(size)) {
            return "Unknown size";
        }

        if (size < 1024) {
            return `${size} B`;
        }

        if (size < 1024 * 1024) {

            return `${(
                size / 1024
            ).toFixed(1)} KB`;
        }

        if (
            size <
            1024 * 1024 * 1024
        ) {

            return `${(
                size /
                (1024 * 1024)
            ).toFixed(1)} MB`;
        }

        return `${(
            size /
            (1024 * 1024 * 1024)
        ).toFixed(1)} GB`;
    }


    getFolderDisplayName(
        folder
    ) {

        const names = {

            INBOX: "Inbox",
            STARRED: "Starred",
            FLAGGED: "Flagged",
            SENT: "Sent",
            PHISHING: "Phishing",
            QUARANTINE: "Quarantine"

        };

        return (
            names[folder] ||
            folder ||
            "Inbox"
        );
    }


    /* =====================================================
       INVESTIGATION REPORT
       ---------------------------------------------------
       Renders MailInvestigator.investigate()'s result as an
       actual readable report: verdict + score meter, plain-
       English summary, a findings list (severity-colored),
       and IOC tags. Replaces the old raw key-value dump for
       the ANALYZE EMAIL modal.

       NOTE: this used to also show SPF/DKIM/DMARC chips here.
       Removed — that was a one-glance "this is phishing" tell
       that made actually checking Threat Intel unnecessary.
       ===================================================== */

    renderInvestigationReport(result) {

        const risk =
            String(result.risk || "LOW").toLowerCase();

        const score =
            Number(result.score) || 0;

        const confidence =
            Number(result.confidence) || 0;

        const findings =
            Array.isArray(result.indicators)
                ? result.indicators
                : [];

        const iocs =
            result.iocs || {};

        const iocTags =
            [
                ...(iocs.domains || []).map(value => ({ type: "DOMAIN", value })),
                ...(iocs.ips || []).map(value => ({ type: "IP", value })),
                ...(iocs.hashes || []).map(value => ({ type: "SHA256", value }))
            ];

        return `

            <div class="mail-report">

                <div class="mail-report-verdict">

                    <div class="mail-report-verdict-left">
                        <div class="mail-report-verdict-label">LIKELY CLASSIFICATION</div>
                        <div class="mail-report-verdict-badge risk-${risk}">
                            ${this.escapeHtml(result.likelyClassification || "UNKNOWN")}
                        </div>
                        <div class="mail-report-verdict-sub">
                            Filed as ${this.escapeHtml(result.originalClassification || "NORMAL")} · now flagged ${risk.toUpperCase()} risk
                        </div>
                    </div>

                    <div class="mail-report-verdict-right">

                        <div class="mail-report-score-row">
                            <span>Risk score</span>
                            <strong>${score}/100</strong>
                        </div>

                        <div class="mail-report-score-track">
                            <div class="mail-report-score-fill risk-${risk}" style="width:${Math.min(100, score)}%"></div>
                        </div>

                        <div class="mail-report-confidence">
                            ${confidence}% confidence
                        </div>

                    </div>

                </div>


                ${result.summary
                ? `<p class="mail-report-summary">${this.escapeHtml(result.summary)}</p>`
                : ""
            }


                ${findings.length
                ? `
                            <div class="mail-report-section">

                                <div class="mail-report-section-title">
                                    FINDINGS
                                    <span class="mail-report-section-count">${findings.length}</span>
                                </div>

                                <div class="mail-report-findings">

                                    ${findings.map(finding => `
                                        <div class="mail-report-finding sev-${String(finding.severity || "LOW").toLowerCase()}">
                                            <span class="mail-report-finding-dot"></span>
                                            <div class="mail-report-finding-body">
                                                <div class="mail-report-finding-message">
                                                    ${this.escapeHtml(finding.message || finding.code || "")}
                                                </div>
                                                <div class="mail-report-finding-code">
                                                    ${this.escapeHtml(finding.code || "")}
                                                </div>
                                            </div>
                                        </div>
                                    `).join("")}

                                </div>

                            </div>
                        `
                : ""
            }


                ${iocTags.length
                ? `
                            <div class="mail-report-section">

                                <div class="mail-report-section-title">
                                    INDICATORS OF COMPROMISE
                                    <span class="mail-report-section-count">${iocTags.length}</span>
                                </div>

                                <div class="mail-report-ioc-list">

                                    ${iocTags.map(ioc => `
                                        <span class="mail-report-ioc">
                                            <b>${this.escapeHtml(ioc.type)}</b>
                                            <span class="mail-report-ioc-value">${this.escapeHtml(ioc.value)}</span>
                                            ${this.renderCopyButton(ioc.value, `Copy ${ioc.type}`)}
                                        </span>
                                    `).join("")}

                                </div>

                            </div>
                        `
                : ""
            }

            </div>
        `;
    }


    /* =====================================================
       OBJECT FORMATTER
       ===================================================== */

    formatObject(
        object
    ) {

        if (
            object === null ||
            object === undefined
        ) {

            return `
                <div class="mail-analysis-empty">
                    No additional analysis returned.
                </div>
            `;
        }

        if (
            typeof object !== "object"
        ) {

            return `
                <div class="mail-analysis-value">
                    ${this.escapeHtml(
                object
            )}
                </div>
            `;
        }

        return `

            <div class="mail-analysis-grid">

                ${Object.entries(
            object
        )
                .map(
                    ([key, value]) => {

                        let display;

                        if (
                            Array.isArray(
                                value
                            )
                        ) {

                            display =
                                value.join(
                                    ", "
                                );
                        }

                        else if (
                            typeof value ===
                            "object" &&
                            value !== null
                        ) {

                            display =
                                JSON.stringify(
                                    value,
                                    null,
                                    2
                                );
                        }

                        else {

                            display =
                                String(
                                    value
                                );
                        }

                        /*
                         * Copy button on identifier-shaped fields
                         * (domain/url/ip/hash/sender/host) so the
                         * player can paste straight into Threat
                         * Intel/Network/the sandbox instead of
                         * hand-typing it. Skip it for booleans,
                         * enums, and multi-line JSON dumps.
                         */

                        const isCopyableKey =
                            /url|domain|ip$|ipaddress|hash|sender|email|host/i
                                .test(key);

                        const isCopyableValue =
                            typeof value === "string" &&
                            value.trim().length > 0 &&
                            !display.includes("\n");

                        return `

                                <div class="mail-analysis-row">

                                    <div class="mail-analysis-key">
                                        ${this.escapeHtml(
                            key
                        )}
                                    </div>

                                    <div class="mail-analysis-value-row">

                                        <div class="mail-analysis-value">
                                            ${this.escapeHtml(
                            display
                        )}
                                        </div>

                                        ${isCopyableKey && isCopyableValue
                                ? this.renderCopyButton(display)
                                : ""
                            }

                                    </div>

                                </div>
                            `;
                    }
                )
                .join("")}

            </div>
        `;
    }


    /* =====================================================
       HTML SAFETY
       ===================================================== */

    stripDangerousMarkup(
        value
    ) {

        return String(value)
            .replace(
                /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                ""
            )
            .replace(
                /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
                ""
            )
            .replace(
                /<br\s*\/?>/gi,
                "\n"
            )
            .replace(
                /<\/(p|div|li|h[1-6]|blockquote)>/gi,
                "\n\n"
            )
            .replace(
                /<[^>]*>/g,
                ""
            )
            .replace(
                /\n{3,}/g,
                "\n\n"
            )
            .trim();
    }


    escapeHtml(
        value
    ) {

        return String(
            value ??
            ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
    }


    escapeAttribute(
        value
    ) {

        return this.escapeHtml(
            value
        );
    }


    /* =====================================================
       CLEANUP
       ===================================================== */

    destroy() {

        if (this.container) {

            this.container.removeEventListener(
                "click",
                this.boundClick
            );

            this.container.removeEventListener(
                "input",
                this.boundInput
            );

            this.container.removeEventListener(
                "keydown",
                this.boundKeydown
            );
        }

        if (
            typeof this.unsubscribe ===
            "function"
        ) {

            this.unsubscribe();
        }

        this.unsubscribe = null;

        console.log(
            "[MAIL RENDERER] Destroyed."
        );
    }
}