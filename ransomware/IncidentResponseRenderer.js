/* =========================================================
   NORTHSTAR SOC — INCIDENT RESPONSE RENDERER
   File: ransomware/IncidentResponseRenderer.js

   Tabs: Overview / Timeline / Response Actions / Recovery /
   Objectives / Evidence / MITRE / Report — per spec sections
   34, 43, 50-53, 67, 74-78.

   Same full-innerHTML-per-render + delegated data-action click
   handling convention as EndpointRenderer.js / ProcessTree.
   ========================================================= */

const SEVERITY_LABEL = {
    NORMAL: "NORMAL",
    MONITORING: "MONITORING",
    SUSPICIOUS: "SUSPICIOUS",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL",
    CONTAINED: "CONTAINED",
    RECOVERING: "RECOVERING",
    RESOLVED: "RESOLVED"
};

const FILE_STATUS_LABEL = {
    NORMAL: "Normal",
    TARGETED: "Targeted",
    ENCRYPTING: "Encrypting…",
    ENCRYPTED: "Encrypted",
    RECOVERING: "Restoring…",
    RECOVERED: "Recovered"
};

const TABS = [
    ["OVERVIEW", "Overview"],
    ["TIMELINE", "Timeline"],
    ["ACTIONS", "Response Actions"],
    ["RECOVERY", "Recovery"],
    ["OBJECTIVES", "Objectives"],
    ["EVIDENCE", "Evidence"],
    ["MITRE", "MITRE ATT&CK"],
    ["REPORT", "Report"]
];

export class IncidentResponseRenderer {

    constructor(container, store) {

        this.container = container;
        this.store = store;

        this.unsubscribe = null;

        this.boundClick = this.handleClick.bind(this);
    }


    /* =====================================================
       MOUNT / DESTROY
       ===================================================== */

    mount() {

        if (!this.container) return;

        this.container.classList.add("northstar-incident");
        this.container.innerHTML = "";

        this.container.addEventListener("click", this.boundClick);

        this.render();

        this.unsubscribe = this.store.subscribe(() => this.render());
    }

    destroy() {

        if (this.container) {
            this.container.removeEventListener("click", this.boundClick);
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

        if (!this.store.hasActiveIncident()) {
            this.container.innerHTML = `
                <div class="ir-shell">
                    <div class="ir-empty-state">
                        <div class="ir-empty-icon">🛡</div>
                        <div class="ir-empty-title">No active incident</div>
                        <div class="ir-empty-body">
                            Incident Response activates automatically once a ransomware
                            campaign is running. Start the Ransomware operation from the
                            main menu to use this application.
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        const campaign = this.store.getCampaign();
        const tab = this.store.state.activeTab;

        this.container.innerHTML = `
            <div class="ir-shell">
                ${this.renderTopBar(campaign)}
                ${this.renderTabs(tab)}
                <div class="ir-body">
                    ${this.renderTabContent(tab, campaign)}
                </div>
            </div>
        `;
    }


    /* =====================================================
       TOP BAR
       ===================================================== */

    renderTopBar(campaign) {

        const severity = this.store.getSeverity();
        const filesEncrypted = campaign.filesEncryptedCount;
        const filesTotal = campaign.files.length;
        const impactPct = filesTotal ? Math.round((filesEncrypted / filesTotal) * 100) : 0;

        return `
            <header class="ir-topbar">

                <div class="ir-title-block">
                    <div class="ir-title">INCIDENT RESPONSE</div>
                    <div class="ir-subtitle">${this.escapeHtml(campaign.id)} · ${this.escapeHtml(campaign.affectedHostname || "—")}</div>
                </div>

                <div class="ir-severity-block">
                    <span class="ir-severity-badge sev-${severity.toLowerCase()}">${SEVERITY_LABEL[severity] || severity}</span>
                    <span class="ir-elapsed">⏱ ${this.store.getElapsed()}</span>
                </div>

                <div class="ir-impact-meter">
                    <div class="ir-impact-label">HOST IMPACT — ${filesEncrypted}/${filesTotal} FILES ENCRYPTED</div>
                    <div class="ir-impact-track">
                        <div class="ir-impact-fill ${this.impactBand(impactPct)}" style="width:${impactPct}%"></div>
                    </div>
                </div>

                <button class="ir-restart-button" data-action="restart" title="Reset this incident and start over">⟲ Restart</button>

            </header>
        `;
    }

    impactBand(pct) {
        if (pct === 0) return "none";
        if (pct < 25) return "low";
        if (pct < 60) return "medium";
        return "high";
    }


    /* =====================================================
       TABS
       ===================================================== */

    renderTabs(activeTab) {

        return `
            <nav class="ir-tabs">
                ${TABS.map(([key, label]) => `
                    <button class="ir-tab ${key === activeTab ? "active" : ""}" data-action="select-tab" data-tab="${key}">
                        ${label}
                    </button>
                `).join("")}
            </nav>
        `;
    }

    renderTabContent(tab, campaign) {

        switch (tab) {
            case "OVERVIEW": return this.renderOverview(campaign);
            case "TIMELINE": return this.renderTimeline(campaign);
            case "ACTIONS": return this.renderActions(campaign);
            case "RECOVERY": return this.renderRecovery(campaign);
            case "OBJECTIVES": return this.renderObjectives(campaign);
            case "EVIDENCE": return this.renderEvidence(campaign);
            case "MITRE": return this.renderMitre(campaign);
            case "REPORT": return this.renderReport(campaign);
            default: return "";
        }
    }


    /* =====================================================
       OVERVIEW
       ===================================================== */

    renderOverview(campaign) {

        const attributionKnown = this.store.isAttributionKnown();
        const objectives = this.store.getObjectives();
        const groups = this.groupObjectives(objectives);

        return `
            <div class="ir-feedback-slot">${this.renderFeedback()}</div>

            <div class="ir-grid ir-grid-2">

                <section class="ir-card">
                    <h2>Incident Summary</h2>
                    ${this.renderInfoRow("Incident Reference", campaign.id)}
                    ${this.renderInfoRow("Affected Host", campaign.affectedHostname || "—")}
                    ${this.renderInfoRow("Affected User", campaign.affectedUsername || "—")}
                    ${this.renderInfoRow("Stage", campaign.stage.replaceAll("_", " "))}
                    ${this.renderInfoRow("Elapsed Time", this.store.getElapsed())}
                    ${attributionKnown ? `
                        ${this.renderInfoRow("Attributed Family", campaign.family)}
                        ${this.renderInfoRow("Attributed Actor", campaign.actor.name)}
                        ${this.renderInfoRow("C2 Infrastructure", campaign.c2Domain)}
                    ` : `
                        <div class="ir-note">Attribution not yet confirmed — malicious activity has not been correlated to a specific actor or family.</div>
                    `}
                </section>

                <section class="ir-card">
                    <h2>Objectives Progress</h2>
                    ${groups.map(group => `
                        <div class="ir-objective-summary-row">
                            <span>${group.label}</span>
                            <span class="ir-objective-summary-count">${group.done}/${group.total}</span>
                        </div>
                        <div class="ir-progress-track">
                            <div class="ir-progress-fill" style="width:${group.total ? (group.done / group.total) * 100 : 0}%"></div>
                        </div>
                    `).join("")}
                    <button class="ir-link-button" data-action="select-tab" data-tab="OBJECTIVES">View full objectives ›</button>
                </section>

            </div>

            <div class="ir-grid ir-grid-3">

                <section class="ir-card">
                    <h2>File Impact</h2>
                    ${this.renderInfoRow("Targeted", campaign.filesTargetedCount)}
                    ${this.renderInfoRow("Encrypted", campaign.filesEncryptedCount)}
                    ${this.renderInfoRow("Remaining", this.store.getFilesRemaining())}
                    ${this.renderInfoRow("Recovered", campaign.files.filter(f => f.status === "RECOVERED").length)}
                    ${this.renderInfoRow("Encryption Rate", `${this.store.getEncryptionRate()} files/sec`)}
                </section>

                <section class="ir-card">
                    <h2>Containment Status</h2>
                    ${this.renderStatusRow("Host Isolated", campaign.hostIsolated)}
                    ${this.renderStatusRow("Process Terminated", campaign.processTerminated)}
                    ${this.renderStatusRow("C2 Blocked", campaign.c2Blocked)}
                    ${this.renderStatusRow("Malware Eradicated", campaign.malwareEradicated)}
                    <button class="ir-link-button" data-action="select-tab" data-tab="ACTIONS">Go to Response Actions ›</button>
                </section>

                <section class="ir-card">
                    <h2>Quick Evidence Collection</h2>
                    ${this.renderQuickEvidenceButton("collect-host-evidence", "Compromised host", "HOST", campaign.affectedHostId)}
                    ${this.renderQuickEvidenceButton("collect-process-evidence", "Malicious process", "PROCESS", "blackfrost-sim")}
                    ${this.renderQuickEvidenceButton("collect-c2-evidence", "C2 infrastructure", "C2", campaign.c2Domain)}
                    ${this.renderQuickEvidenceButton("collect-ransomnote-evidence", "Ransom note", "FILE", campaign.ransomNoteFilename)}
                </section>

            </div>
        `;
    }

    renderQuickEvidenceButton(action, label, refType, refId) {

        const collected = this.store.getEvidence().some(item => item.refType === refType && item.refId === refId);

        return `
            <button class="ir-evidence-quick-button ${collected ? "collected" : ""}" data-action="${action}" ${collected ? "disabled" : ""}>
                <span>${collected ? "✔" : "＋"}</span> ${this.escapeHtml(label)}
            </button>
        `;
    }

    groupObjectives(objectives) {

        return ["INVESTIGATION", "CONTAINMENT", "RECOVERY"].map(group => {

            const items = objectives.filter(o => o.group === group);

            return {
                group,
                label: group,
                total: items.length,
                done: items.filter(i => i.done).length
            };
        });
    }


    /* =====================================================
       TIMELINE
       ===================================================== */

    renderTimeline(campaign) {

        const events = this.store.getTimeline();

        if (!events.length) {
            return `<div class="ir-empty-inline">No timeline events recorded yet.</div>`;
        }

        return `
            <div class="ir-timeline">
                ${events.map(event => `
                    <div class="ir-timeline-row">
                        <div class="ir-timeline-time">${this.formatTimestamp(event.timestamp)}</div>
                        <div class="ir-timeline-dot sev-${(event.severity || "info").toLowerCase()}"></div>
                        <div class="ir-timeline-content">
                            <div class="ir-timeline-type">${this.escapeHtml(event.eventType)}</div>
                            <div class="ir-timeline-message">${this.escapeHtml(event.message)}</div>
                            ${event.hostname ? `<div class="ir-timeline-meta">Host: ${this.escapeHtml(event.hostname)}</div>` : ""}
                        </div>
                    </div>
                `).join("")}
            </div>
        `;
    }


    /* =====================================================
       RESPONSE ACTIONS
       ===================================================== */

    renderActions(campaign) {

        const actions = [
            {
                key: "isolate-host",
                title: "Isolate Host",
                description: "Removes the affected host from the network. Does NOT stop local encryption already in progress, and does NOT remove the malware or block its C2 channel by itself.",
                done: campaign.hostIsolated,
                doneLabel: "Host isolated",
                disabled: campaign.hostIsolated,
                disabledReason: campaign.hostIsolated ? "Already isolated." : null
            },
            {
                key: "terminate-process",
                title: "Terminate Process",
                description: "Acts on whichever process is currently selected in Process Tree. Terminating the actual malicious process stops further encryption; terminating the wrong one fails, does nothing to the real threat, and counts against you. Does NOT isolate the host from the network, and does NOT block C2 communication.",
                done: campaign.processTerminated,
                doneLabel: "Process terminated",
                disabled: campaign.processTerminated,
                disabledReason: campaign.processTerminated ? "Already terminated." : null
            },
            {
                key: "block-c2",
                title: "Block C2",
                description: "Blocks the attacker's command-and-control domain and IP at the firewall. Does NOT stop encryption already running locally on the host.",
                done: campaign.c2Blocked,
                doneLabel: "C2 blocked",
                disabled: campaign.c2Blocked,
                disabledReason: campaign.c2Blocked ? "Already blocked." : null
            },
            {
                key: "quarantine-payload",
                title: "Quarantine Payload",
                description: "Quarantines the ransomware binary on disk so it cannot be re-launched manually. Does not, by itself, remove any scheduled-task persistence mechanism.",
                done: !!campaign.payloadQuarantined,
                doneLabel: "Payload quarantined",
                disabled: !!campaign.payloadQuarantined,
                disabledReason: campaign.payloadQuarantined ? "Already quarantined." : null
            },
            {
                key: "eradicate-malware",
                title: "Eradicate Malware",
                description: "Removes the persistence mechanism and confirms the payload is fully gone. Requires the host to be isolated and the process terminated first.",
                done: campaign.malwareEradicated,
                doneLabel: "Malware eradicated",
                disabled: campaign.malwareEradicated || !campaign.hostIsolated || !campaign.processTerminated,
                disabledReason: campaign.malwareEradicated
                    ? "Already eradicated."
                    : (!campaign.hostIsolated || !campaign.processTerminated) ? "Requires: Isolate Host + Terminate Process." : null
            }
        ];

        return `
            <div class="ir-feedback-slot">${this.renderFeedback()}</div>
            <div class="ir-action-list">
                ${actions.map(action => this.renderActionCard(action)).join("")}
            </div>
            ${this.renderAuditLog(campaign)}
        `;
    }

    renderActionCard(action) {

        return `
            <div class="ir-action-card ${action.done ? "done" : ""}">
                <div class="ir-action-card-main">
                    <div class="ir-action-title-row">
                        <span class="ir-action-title">${this.escapeHtml(action.title)}</span>
                        ${action.done ? `<span class="ir-action-done-badge">✔ ${this.escapeHtml(action.doneLabel)}</span>` : ""}
                    </div>
                    <div class="ir-action-description">${this.escapeHtml(action.description)}</div>
                    ${action.disabledReason ? `<div class="ir-action-reason">${this.escapeHtml(action.disabledReason)}</div>` : ""}
                </div>
                <button
                    class="ir-action-button ${action.done ? "done" : ""}"
                    data-action="${action.key}"
                    ${action.disabled ? "disabled" : ""}
                >
                    ${action.done ? "Done" : "Execute"}
                </button>
            </div>
        `;
    }

    renderAuditLog(campaign) {

        const log = this.store.getAuditLog();

        return `
            <section class="ir-card ir-audit-log">
                <h2>Response Action Log</h2>
                ${log.length ? `
                    <div class="ir-audit-rows">
                        ${log.slice().reverse().map(entry => `
                            <div class="ir-audit-row">
                                <span class="ir-audit-time">${this.formatTimestamp(entry.timestamp)}</span>
                                <span class="ir-audit-action">${this.escapeHtml(entry.action)}</span>
                                <span class="ir-audit-description">${this.escapeHtml(entry.description)}</span>
                            </div>
                        `).join("")}
                    </div>
                ` : `<div class="ir-empty-inline">No response actions taken yet.</div>`}
            </section>
        `;
    }


    /* =====================================================
       RECOVERY
       ===================================================== */

    renderRecovery(campaign) {

        const checklist = this.store.getHostHealthChecklist();
        const allPassed = checklist.every(item => item.passed);
        const encryptedFiles = campaign.files.filter(f => f.status === "ENCRYPTED" || f.status === "RECOVERING" || f.status === "RECOVERED");
        const recoveredCount = campaign.files.filter(f => f.status === "RECOVERED").length;

        return `
            <div class="ir-feedback-slot">${this.renderFeedback()}</div>

            <div class="ir-grid ir-grid-2">

                <section class="ir-card">
                    <h2>Backup Validation</h2>
                    ${this.renderInfoRow("Backup Host", campaign.backupHostname || "—")}
                    ${this.renderStatusRow("Backup Validated", campaign.backupValidated)}
                    <button class="ir-action-button ${campaign.backupValidated ? "done" : ""}" data-action="validate-backup" ${campaign.backupValidated ? "disabled" : ""}>
                        ${campaign.backupValidated ? "Backup Validated" : "Validate Backup"}
                    </button>
                </section>

                <section class="ir-card">
                    <h2>File Restoration</h2>
                    ${this.renderInfoRow("Recovery Status", campaign.recoveryStatus.replaceAll("_", " "))}
                    ${this.renderInfoRow("Files Recovered", `${recoveredCount} / ${encryptedFiles.length || 0}`)}
                    <button
                        class="ir-action-button ${campaign.recoveryStatus !== "NOT_STARTED" ? "done" : ""}"
                        data-action="begin-recovery"
                        ${campaign.recoveryStatus !== "NOT_STARTED" || !campaign.malwareEradicated || !campaign.backupValidated ? "disabled" : ""}
                    >
                        ${campaign.recoveryStatus !== "NOT_STARTED" ? "Recovery Started" : "Begin Recovery"}
                    </button>
                    ${campaign.recoveryStatus === "NOT_STARTED" && (!campaign.malwareEradicated || !campaign.backupValidated)
                ? `<div class="ir-action-reason">Requires: Eradicate Malware + Validate Backup.</div>`
                : ""}
                </section>

            </div>

            <section class="ir-card">
                <h2>Host Health Checklist</h2>
                ${checklist.map(item => `
                    <div class="ir-checklist-row">
                        <span class="${item.passed ? "ir-check-pass" : "ir-check-fail"}">${item.passed ? "✔" : "○"}</span>
                        <span>${this.escapeHtml(item.label)}</span>
                    </div>
                `).join("")}
                <button class="ir-action-button primary" data-action="return-to-service" ${!allPassed || campaign.stage === "RESOLVED" ? "disabled" : ""}>
                    ${campaign.stage === "RESOLVED" ? "Host Returned To Service" : "Return Host To Service"}
                </button>
                ${!allPassed && campaign.stage !== "RESOLVED" ? `<div class="ir-action-reason">All checklist items must pass before the host can be returned to service.</div>` : ""}
            </section>
        `;
    }


    /* =====================================================
       OBJECTIVES
       ===================================================== */

    renderObjectives(campaign) {

        const objectives = this.store.getObjectives();

        return `
            ${["INVESTIGATION", "CONTAINMENT", "RECOVERY"].map(group => `
                <section class="ir-card">
                    <h2>${group}</h2>
                    ${objectives.filter(o => o.group === group).map(o => `
                        <div class="ir-checklist-row">
                            <span class="${o.done ? "ir-check-pass" : "ir-check-fail"}">${o.done ? "✔" : "○"}</span>
                            <span>${this.escapeHtml(o.label)}</span>
                        </div>
                    `).join("")}
                </section>
            `).join("")}
        `;
    }


    /* =====================================================
       EVIDENCE
       ===================================================== */

    renderEvidence(campaign) {

        const evidence = this.store.getEvidence();

        return `
            <section class="ir-card">
                <h2>Collect Evidence</h2>
                <div class="ir-evidence-quick-row">
                    ${this.renderQuickEvidenceButton("collect-host-evidence", "Compromised host", "HOST", campaign.affectedHostId)}
                    ${this.renderQuickEvidenceButton("collect-process-evidence", "Malicious process", "PROCESS", "blackfrost-sim")}
                    ${this.renderQuickEvidenceButton("collect-c2-evidence", "C2 infrastructure", "C2", campaign.c2Domain)}
                    ${this.renderQuickEvidenceButton("collect-ransomnote-evidence", "Ransom note", "FILE", campaign.ransomNoteFilename)}
                    ${this.renderQuickEvidenceButton("collect-filelist-evidence", "Encrypted file list", "FILE_LIST", `${campaign.id}-files`)}
                </div>
            </section>

            <section class="ir-card">
                <h2>Evidence Collected (${evidence.length})</h2>
                ${evidence.length ? `
                    <div class="ir-evidence-rows">
                        ${evidence.map(item => `
                            <div class="ir-evidence-row">
                                <span class="ir-evidence-kind">${this.escapeHtml(item.kind)}</span>
                                <span class="ir-evidence-label">${this.escapeHtml(item.label)}</span>
                                <span class="ir-evidence-desc">${this.escapeHtml(item.description)}</span>
                                <span class="ir-evidence-id">${this.escapeHtml(item.id)}</span>
                            </div>
                        `).join("")}
                    </div>
                ` : `<div class="ir-empty-inline">No evidence collected yet.</div>`}
            </section>
        `;
    }


    /* =====================================================
       MITRE
       ===================================================== */

    renderMitre(campaign) {

        const mapping = this.store.getMitreMapping();

        if (!this.store.isAttributionKnown()) {
            return `<div class="ir-empty-inline">The MITRE ATT&CK mapping becomes available once the activity has been confirmed as a correlated attack.</div>`;
        }

        return `
            <section class="ir-card">
                <h2>MITRE ATT&CK Mapping</h2>
                <div class="ir-mitre-table">
                    ${mapping.map(row => `
                        <div class="ir-mitre-row">
                            <span class="ir-mitre-tactic">${this.escapeHtml(row.tactic)}</span>
                            <span class="ir-mitre-technique">${this.escapeHtml(row.technique)}</span>
                            <span class="ir-mitre-evidence">${this.escapeHtml(row.evidence)}</span>
                        </div>
                    `).join("")}
                </div>
            </section>
        `;
    }


    /* =====================================================
       REPORT
       ===================================================== */

    renderReport(campaign) {

        if (campaign.stage !== "RESOLVED") {
            return `
                <div class="ir-empty-inline">
                    The final incident report becomes available once the host has been
                    returned to service and the incident is resolved.
                </div>
            `;
        }

        const report = this.store.getPerformanceReport();

        if (!report) return "";

        return `
            <section class="ir-card ir-report-card">
                <h2>Post-Incident Report — ${this.escapeHtml(report.incidentId)}</h2>

                <div class="ir-report-rating">
                    <div class="ir-report-score">${report.score}</div>
                    <div class="ir-report-rating-label">${this.escapeHtml(report.rating)}</div>
                </div>

                ${this.renderInfoRow("Ransomware Family", report.family)}
                ${this.renderInfoRow("Detection Time", report.detectionSeconds !== null ? `${report.detectionSeconds}s` : "Not detected before resolution")}
                ${this.renderInfoRow("Outcome Band", report.outcomeBand)}
                ${this.renderInfoRow("Files Targeted", report.filesTargeted)}
                ${this.renderInfoRow("Files Encrypted", report.filesEncrypted)}
                ${this.renderInfoRow("Files Recovered", report.filesRecovered)}
                ${this.renderInfoRow("Hosts Affected", report.hostsAffected)}
                ${this.renderInfoRow("C2 Blocked", report.c2Blocked ? "Yes" : "No")}
                ${this.renderInfoRow("Recovery Successful", report.recoverySuccessful ? "Yes" : "No")}
                ${this.renderInfoRow("Evidence Collected", report.evidenceCollected)}
                ${this.renderInfoRow("Objectives Completed", `${report.objectivesCompleted} / ${report.objectivesTotal}`)}
                ${this.renderInfoRow("Mistaken Terminations", report.terminationMistakes)}
            </section>

            <section class="ir-card">
                <h2>Training Notes</h2>
                <p class="ir-training-note">${this.renderTrainingNotes(report)}</p>
            </section>
        `;
    }

    renderTrainingNotes(report) {

        const notes = [];

        if (report.outcomeBand === "EARLY") {
            notes.push("Detection happened early, before significant encryption occurred — this is the outcome a well-tuned SOC aims for.");
        } else if (report.outcomeBand === "MID") {
            notes.push("Detection happened mid-incident, after some encryption had already occurred. Faster correlation of the initial indicators would have reduced impact.");
        } else {
            notes.push("Detection happened late, after most target files were already encrypted. Consider reviewing which earlier indicators (macro execution, mass file modification) could have triggered a faster response.");
        }

        if (report.c2Blocked) {
            notes.push("C2 communication was blocked, cutting off the attacker's remote channel.");
        } else {
            notes.push("C2 communication was never explicitly blocked — the attacker's channel may have remained reachable.");
        }

        if (report.recoverySuccessful) {
            notes.push("All encrypted files were successfully restored from a validated backup.");
        }

        if (report.hostsAffected > 1) {
            notes.push("The incident spread to a second host before containment — isolating the primary host sooner limits lateral spread.");
        }

        return notes.join(" ");
    }


    /* =====================================================
       SHARED HELPERS
       ===================================================== */

    renderFeedback() {

        const feedback = this.store.state.actionFeedback;

        if (!feedback) return "";

        return `<div class="ir-feedback ${feedback.type}">${this.escapeHtml(feedback.message)}</div>`;
    }

    renderInfoRow(label, value) {
        return `
            <div class="ir-info-row">
                <span class="ir-info-label">${this.escapeHtml(label)}</span>
                <span class="ir-info-value">${this.escapeHtml(value)}</span>
            </div>
        `;
    }

    renderStatusRow(label, done) {
        return `
            <div class="ir-info-row">
                <span class="ir-info-label">${this.escapeHtml(label)}</span>
                <span class="ir-info-value ${done ? "ir-check-pass" : "ir-check-fail"}">${done ? "✔ Yes" : "○ No"}</span>
            </div>
        `;
    }


    /* =====================================================
       CLICK HANDLING
       ===================================================== */

    handleClick(event) {

        const actionElement = event.target.closest("[data-action]");

        if (!actionElement || actionElement.disabled) return;

        this.handleAction(actionElement);
    }

    handleAction(element) {

        const action = element.dataset.action;

        switch (action) {

            case "select-tab":
                this.store.setActiveTab(element.dataset.tab);
                break;

            case "restart":
                this.store.restartCampaign();
                break;

            case "isolate-host": this.store.isolateHost(); break;
            case "terminate-process": this.store.terminateProcess(); break;
            case "block-c2": this.store.blockC2(); break;
            case "quarantine-payload": this.store.quarantinePayload(); break;
            case "eradicate-malware": this.store.eradicateMalware(); break;
            case "validate-backup": this.store.validateBackup(); break;
            case "begin-recovery": this.store.beginRecovery(); break;
            case "return-to-service": this.store.returnHostToService(); break;

            case "collect-host-evidence": this.store.collectHostEvidence(); break;
            case "collect-process-evidence": this.store.collectProcessEvidence(); break;
            case "collect-c2-evidence": this.store.collectC2Evidence(); break;
            case "collect-ransomnote-evidence": this.store.collectRansomNoteEvidence(); break;
            case "collect-filelist-evidence": this.store.collectFileListEvidence(); break;
        }
    }


    /* =====================================================
       FORMAT HELPERS
       ===================================================== */

    formatTimestamp(value) {

        if (!value) return "—";

        try {
            return new Date(value).toLocaleTimeString();
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
}
