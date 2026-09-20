/* =========================================================
   NORTHSTAR SOC — ENDPOINT RENDERER
   File: endpoints/EndpointRenderer.js

   REWRITTEN to render real simulation data:
   - Grid view: 18 real hosts, live-derived status/risk badges.
   - Detail view: 7 tabs (System / User / Processes / Network
     / Security / Evidence / Timeline), all reading from real
     events (window.eventEngine) and real alerts
     (window.alertManager) filtered by hostname, instead of
     invented per-host data.
   ========================================================= */

import { NORTHSTAR_PUBLIC_IP, isInternalIp } from "./EndpointStore.js";

export class EndpointRenderer {

    constructor(container, store) {

        this.container = container;
        this.store = store;

        this.unsubscribe = null;

        this.boundClick = this.handleClick.bind(this);
        this.boundInput = this.handleInput.bind(this);
    }


    /* =====================================================
       MOUNT
       ===================================================== */

    mount() {

        if (!this.container) return;

        this.container.classList.add("northstar-endpoints");
        this.container.innerHTML = "";

        this.container.addEventListener("click", this.boundClick);
        this.container.addEventListener("input", this.boundInput);

        this.render();

        this.unsubscribe = this.store.subscribe(() => this.render());
    }

    destroy() {

        if (this.container) {
            this.container.removeEventListener("click", this.boundClick);
            this.container.removeEventListener("input", this.boundInput);
        }

        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }


    /* =====================================================
       ROOT RENDER
       ===================================================== */

    render() {

        if (!this.container) return;

        const selected =
            this.store.getSelectedHost();

        this.container.innerHTML = `
            <div class="ep-shell">
                ${this.renderTopBar()}
                ${selected ? this.renderDetailView(selected) : this.renderGridView()}
            </div>
        `;
    }


    /* =====================================================
       TOP BAR
       ===================================================== */

    renderTopBar() {

        const counts =
            this.store.getCounts();

        return `
            <header class="ep-topbar">

                <div class="ep-title-block">
                    <div class="ep-title">ENDPOINTS</div>
                    <div class="ep-subtitle">NORTHSTAR SECURITY OPERATIONS CENTER</div>
                </div>

                <div class="ep-search">
                    <span class="ep-search-icon">⌕</span>
                    <input
                        class="ep-search-input"
                        type="search"
                        placeholder="Search hostname, IP, user, OS..."
                        value="${this.escapeAttribute(this.store.state.searchQuery)}"
                        autocomplete="off"
                    >
                </div>

                <div class="ep-topbar-right">

                    <div class="ep-counts">
                        <span class="ep-count online">${counts.online} ONLINE</span>
                        <span class="ep-count compromised">${counts.compromised} COMPROMISED</span>
                        <span class="ep-count isolated">${counts.isolated} ISOLATED</span>
                    </div>

                    <div class="ep-org-ip" title="Northstar's public-facing edge IP — anything else is external">
                        <span class="ep-org-ip-label">OUR IP</span>
                        <span class="ep-org-ip-value">${this.escapeHtml(NORTHSTAR_PUBLIC_IP)}</span>
                    </div>

                </div>

            </header>
        `;
    }


    /* =====================================================
       GRID VIEW
       ===================================================== */

    renderGridView() {

        const hosts =
            this.store.getVisibleHosts();

        return `
            <div class="ep-body">

                <div class="ep-filter-bar">
                    ${["ALL", "ONLINE", "COMPROMISED", "ISOLATED"].map(status => `
                        <button
                            class="ep-filter ${this.store.state.statusFilter === status ? "active" : ""}"
                            data-status-filter="${status}"
                        >
                            ${status}
                        </button>
                    `).join("")}
                </div>

                <div class="ep-grid">

                    ${hosts.length
                ? hosts.map(host => this.renderHostCard(host)).join("")
                : `<div class="ep-empty">No endpoints match the current filter.</div>`
            }

                </div>

            </div>
        `;
    }

    renderHostCard(host) {

        const status =
            this.store.computeStatus(host);

        const risk =
            this.store.computeRisk(host);

        const user =
            this.store.getUser(host.assignedUser);

        const statusClass =
            status.toLowerCase();

        const lastActivity =
            this.store.getLastActivity(host);

        return `
            <article class="ep-card ${statusClass}" data-host-id="${this.escapeAttribute(host.id)}">

                <div class="ep-card-top">
                    <span class="ep-status-dot ${statusClass}"></span>
                    <span class="ep-card-hostname">${this.escapeHtml(host.hostname)}</span>
                    <span class="ep-risk-badge ${risk.toLowerCase()}">${risk}</span>
                </div>

                <div class="ep-card-row"><span>IP</span><strong>${this.escapeHtml(host.ip)}</strong></div>
                <div class="ep-card-row"><span>User</span><strong>${this.escapeHtml(user?.displayName || host.assignedUser || "—")}</strong></div>
                <div class="ep-card-row"><span>OS</span><strong>${this.escapeHtml(host.operatingSystem)}</strong></div>

                <div class="ep-card-footer">
                    <span class="ep-status-label ${statusClass}">${status}</span>
                    <span class="ep-last-activity">${lastActivity ? this.formatRelativeTime(lastActivity) : "no activity yet"}</span>
                </div>

            </article>
        `;
    }


    /* =====================================================
       DETAIL VIEW
       ===================================================== */

    renderDetailView(host) {

        const tabs = [
            ["SYSTEM", "System"],
            ["USER", "User"],
            ["PROCESSES", "Processes"],
            ["NETWORK", "Network"],
            ["SECURITY", "Security"],
            ["EVIDENCE", "Evidence"],
            ["TIMELINE", "Timeline"]
        ];

        const status =
            this.store.computeStatus(host);

        const risk =
            this.store.computeRisk(host);

        const statusClass =
            status.toLowerCase();

        return `
            <div class="ep-body ep-detail">

                <div class="ep-detail-header">

                    <button class="ep-back-button" data-action="back-to-grid">‹ All Endpoints</button>

                    <div class="ep-detail-heading">

                        <div class="ep-detail-title-row">
                            <span class="ep-status-dot ${statusClass}"></span>
                            <h1>${this.escapeHtml(host.hostname)}</h1>
                            <span class="ep-risk-badge ${risk.toLowerCase()}">${risk}</span>
                            <span class="ep-status-label ${statusClass}">${status}</span>
                        </div>

                        <div class="ep-detail-sub">
                            ${this.escapeHtml(host.ip)} · ${this.escapeHtml(host.operatingSystem)} · ${this.escapeHtml(host.assignedUser || "no assigned user")}
                        </div>

                    </div>

                    <div class="ep-detail-actions">

                        ${host.isolated
                ? `<button class="ep-action-button primary" data-action="unisolate" data-host-id="${host.id}">Unisolate Endpoint</button>`
                : `<button class="ep-action-button danger" data-action="isolate" data-host-id="${host.id}">Isolate Endpoint</button>`
            }

                    </div>

                </div>

                <div class="ep-tabs">
                    ${tabs.map(([key, label]) => `
                        <button
                            class="ep-tab ${this.store.state.activeTab === key ? "active" : ""}"
                            data-tab="${key}"
                        >
                            ${label}
                        </button>
                    `).join("")}
                </div>

                <div class="ep-tab-content">
                    ${this.renderTabContent(host)}
                </div>

            </div>
        `;
    }

    renderTabContent(host) {

        switch (this.store.state.activeTab) {

            case "USER": return this.renderUserTab(host);
            case "PROCESSES": return this.renderProcessesTab(host);
            case "NETWORK": return this.renderNetworkTab(host);
            case "SECURITY": return this.renderSecurityTab(host);
            case "EVIDENCE": return this.renderEvidenceTab(host);
            case "TIMELINE": return this.renderTimelineTab(host);
            case "SYSTEM":
            default: return this.renderSystemTab(host);
        }
    }


    /* =====================================================
       SYSTEM TAB
       ===================================================== */

    renderSystemTab(host) {

        const status =
            this.store.computeStatus(host);

        const risk =
            this.store.computeRisk(host);

        const lastActivity =
            this.store.getLastActivity(host);

        const disruptedApps =
            this.store.getDisruptedAppsForHost(host.id);

        return `
            <div class="ep-info-grid">
                ${this.infoRow("Hostname", host.hostname)}
                ${this.infoRow("IP Address", host.ip)}
                ${this.infoRow("Type", host.type)}
                ${this.infoRow("Operating System", host.operatingSystem)}
                ${this.infoRow("Assigned User", host.assignedUser || "—")}
                ${this.infoRow("Status", status)}
                ${this.infoRow("Risk Level", risk)}
                ${this.infoRow("Last Activity", lastActivity ? this.formatFullTime(lastActivity) : "No recorded activity yet")}
            </div>

            ${disruptedApps.length
                ? `
                    <div class="ep-section-title">SERVICE IMPACT</div>
                    <div class="ep-alert-list">
                        ${disruptedApps.map(entry => `
                            <div class="ep-alert-card sev-medium">
                                <div class="ep-alert-title">${this.escapeHtml(entry.process)} was terminated</div>
                                <div class="ep-alert-description">${this.escapeHtml(entry.impact)}</div>
                            </div>
                        `).join("")}
                    </div>
                `
                : ""
            }
        `;
    }


    /* =====================================================
       USER TAB
       ===================================================== */

    renderUserTab(host) {

        const user =
            this.store.getUser(host.assignedUser);

        const logins =
            this.store.getLoginEventsForHost(host.hostname);

        return `
            ${user
                ? `
                    <div class="ep-info-grid">
                        ${this.infoRow("Display Name", user.displayName)}
                        ${this.infoRow("Username", user.username)}
                        ${this.infoRow("Role", user.role)}
                        ${this.infoRow("Department", user.department)}
                        ${this.infoRow("Email", user.email)}
                        ${this.infoRow("MFA Enabled", user.mfaEnabled ? "Yes" : "No")}
                        ${this.infoRow("Account Status", user.accountStatus)}
                    </div>
                `
                : `<div class="ep-empty">No assigned user account for this endpoint.</div>`
            }

            <div class="ep-section-title">AUTHENTICATION EVENTS</div>

            ${logins.length
                ? `
                    <div class="ep-table">
                        <div class="ep-table-header ep-login-cols">
                            <span>TYPE</span><span>TIME</span><span>SOURCE IP</span><span>FLAG</span>
                        </div>
                        ${logins.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(login => `
                            <div class="ep-table-row ep-login-cols ${login.eventType === "AUTH_FAILURE" || this.store.isFlaggedEvent(login) ? "suspicious" : ""}">
                                <span>${this.escapeHtml(login.eventType.replace("_", " "))}</span>
                                <span>${this.formatFullTime(login.timestamp)}</span>
                                <span class="ep-mono">${this.escapeHtml(login.sourceIP || "—")}</span>
                                <span>${this.store.isFlaggedEvent(login) ? `<span class="ep-flag">ALERT</span>` : "—"}</span>
                            </div>
                        `).join("")}
                    </div>
                `
                : `<div class="ep-empty">No authentication events recorded for this endpoint yet.</div>`
            }
        `;
    }


    /* =====================================================
       PROCESSES TAB
       ===================================================== */

    renderProcessesTab(host) {

        const processEvents =
            this.store.getProcessEventsForHost(host.hostname);

        if (!processEvents.length) {
            return `<div class="ep-empty">No process activity recorded for this endpoint yet.</div>`;
        }

        return `
            <div class="ep-hint">
                Terminating the malicious process stops the attacker's post-compromise activity on this
                host. But not every process here is malicious — ordinary business software starts up too.
                Terminating the wrong one has a real cost.
            </div>

            <div class="ep-table">
                <div class="ep-table-header ep-process-cols-simple">
                    <span>PROCESS</span><span>ACTOR / DEPT</span><span>TIME</span><span>STATUS</span><span></span>
                </div>
                ${processEvents.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(event => {

            const acknowledged =
                this.store.isProcessAcknowledged(event.id);

            return `
                        <div class="ep-table-row ep-process-cols-simple">
                            <span>${this.escapeHtml(event.process || "unknown process")}</span>
                            <span>${this.escapeHtml(event.actor || event.metadata?.department || "—")}</span>
                            <span>${this.formatFullTime(event.timestamp)}</span>
                            <span>${acknowledged ? "Reviewed" : "Active"}</span>
                            <span>
                                ${!acknowledged
                    ? `<button class="ep-small-button danger" data-action="terminate-process" data-host-id="${host.id}" data-event-id="${this.escapeAttribute(event.id)}">Terminate</button>`
                    : `<span class="ep-terminated-label">Reviewed</span>`
                }
                            </span>
                        </div>
                    `;
        }).join("")}
            </div>
        `;
    }


    /* =====================================================
       NETWORK TAB
       ===================================================== */

    renderNetworkTab(host) {

        const events =
            this.store.getNetworkEventsForHost(host.hostname);

        if (!events.length) {
            return `<div class="ep-empty">No network activity recorded for this endpoint yet.</div>`;
        }

        const hasExternal =
            events.some(e =>
                (e.sourceIP && !isInternalIp(e.sourceIP)) ||
                (e.destinationIP && !isInternalIp(e.destinationIP))
            );

        return `
            <div class="ep-table">
                <div class="ep-table-header ep-network-cols-real">
                    <span>EVENT</span><span>SOURCE IP</span><span>DESTINATION IP</span><span>TIME</span><span>FLAG</span>
                </div>
                ${events.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(event => {

            const external =
                (event.sourceIP && !isInternalIp(event.sourceIP)) ||
                (event.destinationIP && !isInternalIp(event.destinationIP));

            return `
                        <div class="ep-table-row ep-network-cols-real ${external ? "suspicious" : ""}">
                            <span>${this.escapeHtml(event.eventType.replace(/_/g, " "))}</span>
                            <span class="ep-mono">${this.escapeHtml(event.sourceIP || "—")}</span>
                            <span class="ep-mono">${this.escapeHtml(event.destinationIP || "—")}</span>
                            <span>${this.formatFullTime(event.timestamp)}</span>
                            <span>${external ? `<span class="ep-flag">EXTERNAL</span>` : "—"}</span>
                        </div>
                    `;
        }).join("")}
            </div>

            ${hasExternal
                ? `<div class="ep-hint">This endpoint has talked to an external IP. Cross-reference it manually — the Attack Map currently plots a separate, unrelated IP list and doesn't yet reflect live attacker traffic.</div>`
                : ""
            }
        `;
    }


    /* =====================================================
       SECURITY TAB
       ===================================================== */

    renderSecurityTab(host) {

        const alerts =
            this.store.getAlertsForHost(host.hostname);

        if (!alerts.length) {
            return `<div class="ep-empty">No security alerts associated with this endpoint.</div>`;
        }

        return `
            <div class="ep-alert-list">
                ${alerts.slice().sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen)).map(alert => `
                    <div class="ep-alert-card sev-${alert.severity.toLowerCase()}">
                        <div class="ep-alert-top">
                            <span class="ep-alert-severity">${alert.severity} · ${alert.status}</span>
                            <span class="ep-alert-time">${this.formatFullTime(alert.firstSeen)}</span>
                        </div>
                        <div class="ep-alert-title">${this.escapeHtml(alert.title)}</div>
                        <div class="ep-alert-description">${this.escapeHtml(alert.description)}</div>
                        ${alert.eventCount > 1 ? `<div class="ep-alert-description">Correlated across ${alert.eventCount} events.</div>` : ""}
                    </div>
                `).join("")}
            </div>
        `;
    }


    /* =====================================================
       EVIDENCE TAB
       ---------------------------------------------------
       Honest empty state — this simulation doesn't generate
       file-level evidence (hashes, dropped files) yet.
       ===================================================== */

    renderEvidenceTab(host) {

        return `
            <div class="ep-evidence-header">
                <div>File-level evidence isn't simulated yet — this links to File Explorer once that app exists.</div>
                <button class="ep-action-button" data-action="open-file-explorer" data-host-id="${host.id}">
                    Open in File Explorer
                </button>
            </div>

            <div class="ep-empty">No file evidence recorded for this endpoint.</div>
        `;
    }


    /* =====================================================
       TIMELINE TAB
       ===================================================== */

    renderTimelineTab(host) {

        const events =
            this.store.getTimelineEvents(host.id);

        if (!events.length) {
            return `<div class="ep-empty">No timeline events recorded for this endpoint yet.</div>`;
        }

        return `
            <div class="ep-timeline">
                ${events.map(event => {

            /*
             * BUGFIX (giveaway): this used to be
             * event.actorType === "ATTACKER" — the raw
             * ground-truth flag — and the summary line below
             * even appended the attacker's real name and
             * country. Now an event only reads as suspicious
             * once a real correlated alert references it.
             */
            const suspicious =
                this.store.isFlaggedEvent(event);

            const external =
                (event.sourceIP && !isInternalIp(event.sourceIP)) ||
                (event.destinationIP && !isInternalIp(event.destinationIP));

            return `
                        <div class="ep-timeline-item ${suspicious ? "suspicious" : ""} ${external ? "external" : ""}">

                            <div class="ep-timeline-marker">
                                <span class="ep-timeline-dot ${suspicious ? "alert" : ""}"></span>
                            </div>

                            <div class="ep-timeline-body">

                                <div class="ep-timeline-top">
                                    <span class="ep-timeline-type">${event.eventType.replace(/_/g, " ")}</span>
                                    ${external ? `<span class="ep-timeline-tag external">EXTERNAL</span>` : ""}
                                    ${suspicious ? `<span class="ep-timeline-tag suspicious">ALERT</span>` : ""}
                                    <span class="ep-timeline-time">${this.formatFullTime(event.timestamp)}</span>
                                </div>

                                <div class="ep-timeline-summary">
                                    ${this.escapeHtml(event.message || event.eventType)}
                                </div>

                            </div>

                        </div>
                    `;
        }).join("")}
            </div>
        `;
    }


    /* =====================================================
       HELPERS
       ===================================================== */

    infoRow(label, value) {
        return `
            <div class="ep-info-row">
                <span class="ep-info-label">${this.escapeHtml(label)}</span>
                <span class="ep-info-value">${this.escapeHtml(value)}</span>
            </div>
        `;
    }


    /* =====================================================
       CLICK / INPUT HANDLING
       ===================================================== */

    handleClick(event) {

        const hostCard =
            event.target.closest("[data-host-id]:not([data-action])");

        if (hostCard && !event.target.closest("button")) {
            this.store.selectHost(hostCard.dataset.hostId);
            return;
        }

        const statusFilterButton =
            event.target.closest("[data-status-filter]");

        if (statusFilterButton) {
            this.store.setStatusFilter(statusFilterButton.dataset.statusFilter);
            return;
        }

        const tabButton =
            event.target.closest("[data-tab]");

        if (tabButton) {
            this.store.setActiveTab(tabButton.dataset.tab);
            return;
        }

        const actionButton =
            event.target.closest("[data-action]");

        if (actionButton) {
            this.handleAction(actionButton);
            return;
        }
    }

    handleAction(element) {

        const action = element.dataset.action;
        const hostId = element.dataset.hostId;

        switch (action) {

            case "back-to-grid":
                this.store.clearSelection();
                break;

            case "isolate":
                this.store.isolateHost(hostId);
                break;

            case "unisolate":
                this.store.unisolateHost(hostId);
                break;

            case "terminate-process":
                this.store.terminateProcess(hostId, element.dataset.eventId);
                break;

            case "open-file-explorer":
                window.dispatchEvent(
                    new CustomEvent("northstar:endpoints:open-file-explorer", {
                        detail: { hostId }
                    })
                );
                alert("File Explorer isn't built yet — this button is wired and ready for when it is.");
                break;
        }
    }

    handleInput(event) {

        if (event.target.classList.contains("ep-search-input")) {

            /*
             * setSearchQuery() notifies the store, which triggers
             * a full render() (the grid needs to re-filter live as
             * you type). That replaces the <input> DOM node itself,
             * which would otherwise drop focus and reset the
             * cursor to the end after every single keystroke —
             * making it look like typing "didn't work". Capture the
             * cursor position first and restore focus/selection on
             * the fresh input after the re-render.
             */
            const cursorPosition =
                event.target.selectionStart;

            this.store.setSearchQuery(event.target.value);

            const refreshedInput =
                this.container.querySelector(".ep-search-input");

            if (refreshedInput) {

                refreshedInput.focus();

                refreshedInput.setSelectionRange(
                    cursorPosition,
                    cursorPosition
                );

            }
        }
    }


    /* =====================================================
       FORMATTERS
       ===================================================== */

    formatRelativeTime(isoString) {

        if (!isoString) return "—";

        const diffMs = Date.now() - new Date(isoString).getTime();
        const minutes = Math.floor(diffMs / 60000);

        if (minutes < 1) return "just now";
        if (minutes < 60) return `${minutes}m ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;

        return `${Math.floor(hours / 24)}d ago`;
    }

    formatFullTime(isoString) {

        if (!isoString) return "—";

        const date = new Date(isoString);

        if (Number.isNaN(date.getTime())) return String(isoString);

        return date.toLocaleString([], {
            month: "short", day: "numeric",
            hour: "numeric", minute: "2-digit", second: "2-digit"
        });
    }


    /* =====================================================
       SAFETY
       ===================================================== */

    escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    escapeAttribute(value) {
        return this.escapeHtml(value);
    }
}