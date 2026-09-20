/* =========================================================
   NORTHSTAR SOC — PROCESS TREE RENDERER
   File: ransomware/ProcessTreeRenderer.js

   Two-pane layout matching NORTHSTAR's existing enterprise
   SOC visual language: a host selector + indented process
   tree on the left, a detail panel on the right (Process
   Details / Parent Process / Child Processes / User / Host /
   Start Time / Command Line / Associated Events / Detection
   Status — per spec section 8).

   Same full-innerHTML-per-render + delegated data-action click
   handling convention as EndpointRenderer.js.
   ========================================================= */

export class ProcessTreeRenderer {

    constructor(container, store) {

        this.container = container;
        this.store = store;

        this.unsubscribe = null;

        this.boundClick = this.handleClick.bind(this);
        this.boundInput = this.handleInput.bind(this);
    }


    /* =====================================================
       MOUNT / DESTROY
       ===================================================== */

    mount() {

        if (!this.container) return;

        this.container.classList.add("northstar-processtree");
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

        /*
         * Deliberately does NOT call this.store.destroy() here —
         * the store is a shared singleton (window.processTreeStore)
         * the same way EndpointStore is, so its state (and its
         * EventEngine subscription) should survive the window
         * being closed and reopened rather than being torn down
         * every time.
         */
    }


    /* =====================================================
       ROOT RENDER
       ===================================================== */

    render() {

        if (!this.container) return;

        const hosts = this.store.getHosts();

        if (!hosts.length) {
            this.container.innerHTML = `
                <div class="pt-shell">
                    ${this.renderTopBar(hosts)}
                    <div class="pt-empty-state">
                        <div class="pt-empty-icon">⌗</div>
                        <div class="pt-empty-title">No process telemetry available</div>
                        <div class="pt-empty-body">
                            Process telemetry appears here automatically once an active
                            incident or investigation generates it — nothing is invented
                            or shown ahead of time.
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        const hostname = this.store.getSelectedHostname();
        const tree = this.store.buildTree(hostname);
        const selected = this.store.getSelectedProcess();

        this.container.innerHTML = `
            <div class="pt-shell">
                ${this.renderTopBar(hosts, hostname)}
                <div class="pt-body">
                    <div class="pt-tree-pane">
                        ${this.renderHostSummary(hostname)}
                        <div class="pt-tree-scroll">
                            ${tree.length
                ? `<ul class="pt-tree-list pt-tree-root">${tree.map(node => this.renderNode(node, selected)).join("")}</ul>`
                : `<div class="pt-tree-empty">No process telemetry recorded for this host yet.</div>`
            }
                        </div>
                    </div>
                    <div class="pt-detail-pane">
                        ${selected ? this.renderDetail(selected) : this.renderDetailEmpty()}
                    </div>
                </div>
            </div>
        `;
    }


    /* =====================================================
       TOP BAR
       ===================================================== */

    renderTopBar(hosts, activeHostname) {

        return `
            <header class="pt-topbar">

                <div class="pt-title-block">
                    <div class="pt-title">PROCESS TREE</div>
                    <div class="pt-subtitle">NORTHSTAR SECURITY OPERATIONS CENTER</div>
                </div>

                ${hosts.length > 1 ? `
                    <div class="pt-host-tabs">
                        ${hosts.map(host => `
                            <button
                                class="pt-host-tab ${host.hostname === activeHostname ? "active" : ""}"
                                data-action="select-host"
                                data-hostname="${this.escapeAttribute(host.hostname)}"
                            >
                                ${this.escapeHtml(host.hostname)}
                                <span class="pt-host-tab-count">${host.total}</span>
                            </button>
                        `).join("")}
                    </div>
                ` : ""}

                <div class="pt-search">
                    <span class="pt-search-icon">⌕</span>
                    <input
                        class="pt-search-input"
                        type="search"
                        placeholder="Search process, PID, command line..."
                        value="${this.escapeAttribute(this.store.state.searchQuery)}"
                        autocomplete="off"
                    >
                </div>

            </header>
        `;
    }

    renderHostSummary(hostname) {

        const host = this.store.getHosts().find(h => h.hostname === hostname);

        if (!host) return "";

        return `
            <div class="pt-host-summary">
                <div class="pt-host-summary-name">${this.escapeHtml(hostname)}</div>
                <div class="pt-host-summary-counts">
                    <span class="pt-count active">${host.active} ACTIVE</span>
                    <span class="pt-count terminated">${host.terminated} TERMINATED</span>
                </div>
            </div>
        `;
    }


    /* =====================================================
       TREE
       ===================================================== */

    renderNode(node, selected, depth = 0) {

        const isSelected = selected?.key === node.key;
        const detection = this.store.getDetectionStatus(node);
        const terminated = node.status === "TERMINATED";

        return `
            <li class="pt-node-item">
                <div
                    class="pt-node ${isSelected ? "selected" : ""} ${terminated ? "terminated" : ""}"
                    data-action="select-process"
                    data-process-key="${this.escapeAttribute(node.key)}"
                >
                    <span class="pt-node-status-dot ${terminated ? "terminated" : "active"}"></span>
                    <span class="pt-node-name">${this.escapeHtml(node.processName)}</span>
                    <span class="pt-node-pid">PID ${node.pid}</span>
                    ${detection.flagged ? `<span class="pt-node-flag" title="Correlated to an alert">⚑</span>` : ""}
                    ${terminated ? `<span class="pt-node-badge terminated">TERMINATED</span>` : ""}
                </div>
                ${node.children.length ? `
                    <ul class="pt-tree-list">
                        ${node.children.map(child => this.renderNode(child, selected, depth + 1)).join("")}
                    </ul>
                ` : ""}
            </li>
        `;
    }


    /* =====================================================
       DETAIL PANEL
       ===================================================== */

    renderDetailEmpty() {
        return `
            <div class="pt-detail-empty">
                <div class="pt-detail-empty-icon">▤</div>
                <div>Select a process to view its details.</div>
            </div>
        `;
    }

    renderDetail(process) {

        const parent = this.store.getParentProcess(process);
        const children = this.store.getChildProcesses(process);
        const events = this.store.getAssociatedEvents(process);
        const detection = this.store.getDetectionStatus(process);
        const terminated = process.status === "TERMINATED";

        return `
            <div class="pt-detail">

                <div class="pt-detail-heading">
                    <span class="pt-node-status-dot ${terminated ? "terminated" : "active"}"></span>
                    <h1>${this.escapeHtml(process.processName)}</h1>
                    <span class="pt-status-label ${terminated ? "terminated" : "active"}">${process.status}</span>
                </div>

                <section class="pt-detail-section">
                    <h2>Process Details</h2>
                    ${this.renderInfoRow("PID", process.pid)}
                    ${this.renderInfoRow("PPID", process.ppid ?? "—")}
                    ${this.renderInfoRow("Integrity Level", process.integrityLevel || "—")}
                    ${this.renderInfoRow("Start Time", this.formatTimestamp(process.startTime))}
                    ${this.renderInfoRow("Host", process.hostname)}
                    ${this.renderInfoRow("User", process.username || "—")}
                </section>

                <section class="pt-detail-section">
                    <h2>Command Line</h2>
                    <div class="pt-commandline">${this.escapeHtml(process.commandLine || "—")}</div>
                </section>

                <section class="pt-detail-section">
                    <h2>Lineage</h2>
                    <div class="pt-lineage-row">
                        <span class="pt-lineage-label">Parent Process</span>
                        ${parent
                ? `<button class="pt-lineage-link" data-action="select-process" data-process-key="${this.escapeAttribute(parent.key)}">${this.escapeHtml(parent.processName)} (PID ${parent.pid})</button>`
                : `<span class="pt-lineage-untracked">${this.escapeHtml(process.parentProcessName || "not tracked")}</span>`
            }
                    </div>
                    <div class="pt-lineage-row">
                        <span class="pt-lineage-label">Child Processes</span>
                        ${children.length
                ? `<div class="pt-lineage-children">${children.map(child => `
                                <button class="pt-lineage-link" data-action="select-process" data-process-key="${this.escapeAttribute(child.key)}">${this.escapeHtml(child.processName)} (PID ${child.pid})</button>
                            `).join("")}</div>`
                : `<span class="pt-lineage-untracked">none observed</span>`
            }
                    </div>
                </section>

                <section class="pt-detail-section">
                    <h2>Detection Status</h2>
                    ${detection.flagged
                ? `<div class="pt-detection flagged">
                            Correlated to alert <strong>${this.escapeHtml(detection.alert.id || "")}</strong> — ${this.escapeHtml(detection.alert.title || detection.alert.severity || "")}
                            <button class="pt-small-button" data-action="open-alerts">Open Alerts</button>
                        </div>`
                : `<div class="pt-detection">No correlated alert yet for this process.</div>`
            }
                </section>

                <section class="pt-detail-section">
                    <h2>Associated Events (${events.length})</h2>
                    ${events.length ? `
                        <div class="pt-events-list">
                            ${events.map(event => `
                                <div class="pt-event-row">
                                    <span class="pt-event-time">${this.formatTimestamp(event.timestamp)}</span>
                                    <span class="pt-event-type">${this.escapeHtml(event.eventType)}</span>
                                    <span class="pt-event-message">${this.escapeHtml(event.message)}</span>
                                </div>
                            `).join("")}
                        </div>
                    ` : `<div class="pt-events-empty">No associated events recorded.</div>`}
                </section>

            </div>
        `;
    }

    renderInfoRow(label, value) {
        return `
            <div class="pt-info-row">
                <span class="pt-info-label">${this.escapeHtml(label)}</span>
                <span class="pt-info-value">${this.escapeHtml(value)}</span>
            </div>
        `;
    }


    /* =====================================================
       CLICK / INPUT HANDLING
       ===================================================== */

    handleClick(event) {

        const actionElement = event.target.closest("[data-action]");

        if (!actionElement) return;

        this.handleAction(actionElement);
    }

    handleAction(element) {

        const action = element.dataset.action;

        switch (action) {

            case "select-host":
                this.store.selectHost(element.dataset.hostname);
                break;

            case "select-process":
                this.store.selectProcess(element.dataset.processKey);
                break;

            case "open-alerts":
                if (typeof window.openApplication === "function") {
                    window.openApplication("alerts");
                }
                break;
        }
    }

    handleInput(event) {

        if (event.target.classList.contains("pt-search-input")) {
            this.store.setSearchQuery(event.target.value);
        }
    }


    /* =====================================================
       HELPERS
       ===================================================== */

    formatTimestamp(value) {

        if (!value) return "—";

        try {
            return new Date(value).toLocaleString();
        } catch {
            return String(value);
        }
    }

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
