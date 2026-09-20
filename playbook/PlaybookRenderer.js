/* =========================================================
   NORTHSTAR SOC — PLAYBOOK RENDERER
   File: playbook/PlaybookRenderer.js

   A genuine reading experience, not another dashboard: dark
   chrome + sidebar, but the page itself is a warm paper card
   with serif type — meant to feel like an actual manual,
   distinct from every data-table app in this build.
   ========================================================= */

export class PlaybookRenderer {

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

        this.container.classList.add("northstar-playbook");
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

        const pages =
            this.store.getPages();

        const currentPage =
            this.store.getCurrentPage();

        const currentIndex =
            pages.indexOf(currentPage);

        this.container.innerHTML = `
            <div class="pb-shell">

                <nav class="pb-toc">
                    <div class="pb-toc-heading">Contents</div>
                    ${pages.map((page, index) => `
                        <button
                            class="pb-toc-item ${index === currentIndex ? "active" : ""}"
                            data-page-index="${index}"
                        >
                            ${page.number ? `<span class="pb-toc-number">${page.number}</span>` : ""}
                            ${this.escapeHtml(page.title || (page.kind === "cover" ? "Cover" : "Report"))}
                        </button>
                    `).join("")}
                </nav>

                <div class="pb-reader">

                    <div class="pb-page">
                        ${this.renderPage(currentPage)}
                    </div>

                    <div class="pb-turn-bar">
                        <button class="pb-turn-button" data-action="prev-page" ${this.store.canGoPrevious() ? "" : "disabled"}>‹ Previous</button>
                        <span class="pb-page-indicator">${currentIndex + 1} / ${pages.length}</span>
                        <button class="pb-turn-button" data-action="next-page" ${this.store.canGoNext() ? "" : "disabled"}>Next ›</button>
                    </div>

                </div>

            </div>
        `;
    }


    /* =====================================================
       PAGE CONTENT
       ===================================================== */

    renderPage(page) {

        if (page.kind === "cover") return this.renderCoverPage(page);
        if (page.kind === "section") return this.renderSectionPage(page);
        if (page.kind === "report") return this.renderReportPage(page);

        return "";
    }

    renderCoverPage(page) {

        return `
            <div class="pb-cover">
                <div class="pb-cover-mark">📖</div>
                <h1 class="pb-cover-title">${this.escapeHtml(page.title)}</h1>
                <div class="pb-cover-subtitle">${this.escapeHtml(page.subtitle)}</div>
                <div class="pb-cover-rule"></div>
                ${page.body.map(paragraph => `<p class="pb-body-text">${this.escapeHtml(paragraph)}</p>`).join("")}
            </div>
        `;
    }

    renderSectionPage(page) {

        return `
            <article class="pb-section">

                <div class="pb-section-eyebrow">${page.number ? `Phase ${page.number}` : ""}</div>
                <h1 class="pb-section-title">${this.escapeHtml(page.title)}</h1>

                ${page.body.map(paragraph => `<p class="pb-body-text">${this.escapeHtml(paragraph)}</p>`).join("")}

                ${page.tools ? `
                    <div class="pb-tool-list">
                        ${page.tools.map(tool => `
                            <div class="pb-tool-entry">
                                <div class="pb-tool-name">${this.escapeHtml(tool.app)}</div>
                                <div class="pb-tool-use">${this.escapeHtml(tool.use)}</div>
                            </div>
                        `).join("")}
                    </div>
                ` : ""}

                ${page.checklist ? this.renderChecklist(page.id, page.checklist) : ""}

            </article>
        `;
    }

    /*
     * Shared by section pages' own checklists and the report
     * page's "What Marcus Needs" list — same checkable-item
     * markup, same `${pageId}:${index}` key scheme, so
     * PlaybookStore's generic toggleChecklistItem()/
     * isChecklistItemChecked() work unchanged either way.
     */
    renderChecklist(pageId, items) {

        return `
            <ul class="pb-checklist">
                ${items.map((item, index) => {
            const key = `${pageId}:${index}`;
            const checked = this.store.isChecklistItemChecked(key);
            return `
                        <li class="pb-checklist-item ${checked ? "checked" : ""}" data-checklist-key="${this.escapeAttribute(key)}">
                            <span class="pb-checkbox">${checked ? "✓" : ""}</span>
                            <span class="pb-checklist-text">${this.escapeHtml(item)}</span>
                        </li>
                    `;
        }).join("")}
            </ul>
        `;
    }


    /* =====================================================
       REPORT PAGE — real incident data + the analyst's words
       ===================================================== */

    renderReportPage(page) {

        const incidents =
            this.store.getKnownIncidents();

        const selected =
            this.store.getSelectedIncident();

        const fields =
            this.store.getReportFields();

        const nightfallStatus =
            this.store.getNightfallEvidenceStatus();

        const nightfallCapturedCount =
            nightfallStatus.filter(item => item.captured).length;

        const lockedStatus =
            this.store.getLockedEvidenceStatus();

        const lockedUnlockedCount =
            lockedStatus.filter(item => item.unlocked).length;

        return `
            <article class="pb-section pb-report">

                <div class="pb-section-eyebrow">Final Step</div>
                <h1 class="pb-section-title">Incident Report</h1>

                <p class="pb-body-text">
                    Pick the incident you investigated below — the facts are pulled straight from the SIEM.
                    Everything else is yours to write; nothing here writes the analysis for you.
                </p>

                ${page.checklist ? `
                    <div class="pb-requirements">

                        <div class="pb-requirements-header">
                            <span>What Marcus Needs</span>
                        </div>

                        <p class="pb-body-text pb-requirements-note">
                            Before you send the report, make sure you can actually answer every line below.
                        </p>

                        ${this.renderChecklist(page.id, page.checklist)}

                    </div>
                ` : ""}

                <div class="pb-nightfall-evidence">

                    <div class="pb-nightfall-evidence-header">
                        <span>Case Evidence</span>
                        <span class="pb-nightfall-evidence-count">${nightfallCapturedCount + lockedUnlockedCount}/${nightfallStatus.length + lockedStatus.length}</span>
                    </div>

                    <p class="pb-body-text pb-nightfall-evidence-note">
                        Marcus won't accept the report until every phishing page below has a screenshot or recording attached, and both locked files are cracked in Password Cracker.
                    </p>

                    <div class="pb-nightfall-evidence-subhead">Nightfall pages (Malware Sandbox → 📷/⏺ → attach from Mail's Upload picker)</div>

                    <div class="pb-nightfall-evidence-list">
                        ${nightfallStatus.map(item => `
                            <div class="pb-nightfall-evidence-item ${item.captured ? "done" : ""}">
                                <span class="pb-nightfall-evidence-mark">${item.captured ? "✓" : "○"}</span>
                                <span>${this.escapeHtml(item.domain)}</span>
                            </div>
                        `).join("")}
                    </div>

                    <div class="pb-nightfall-evidence-subhead">Locked files (Password Cracker)</div>

                    <div class="pb-nightfall-evidence-list">
                        ${lockedStatus.map(item => `
                            <div class="pb-nightfall-evidence-item ${item.unlocked ? "done" : ""}">
                                <span class="pb-nightfall-evidence-mark">${item.unlocked ? "✓" : "○"}</span>
                                <span>${this.escapeHtml(item.name)}</span>
                            </div>
                        `).join("")}
                    </div>

                </div>

                ${incidents.length ? `
                    <div class="pb-incident-picker">
                        ${incidents.map(incident => `
                            <button
                                class="pb-incident-chip ${selected?.attackId === incident.attackId ? "active" : ""}"
                                data-attack-id="${this.escapeAttribute(incident.attackId)}"
                            >
                                ${this.escapeHtml(incident.attackId)}
                                <span class="pb-incident-chip-sub">${incident.hostnames.join(", ") || "no host"}</span>
                            </button>
                        `).join("")}
                    </div>
                ` : `<div class="pb-report-empty">No incidents recorded yet in this session.</div>`}

                ${selected ? this.renderIncidentFacts(selected) : ""}

                <div class="pb-report-form">

                    ${this.reportField("summary", "What happened", fields.summary)}
                    ${this.reportField("actionsTaken", "Actions taken", fields.actionsTaken)}
                    ${this.reportField("rootCause", "Root cause", fields.rootCause)}
                    ${this.reportField("recommendations", "Recommendations", fields.recommendations)}

                </div>

            </article>
        `;
    }

    renderIncidentFacts(incident) {

        const alerts =
            this.store.getAlertsForIncident(incident.attackId);

        const timeline =
            this.store.getTimelineForIncident(incident.attackId);

        return `
            <div class="pb-fact-sheet">

                <div class="pb-fact-row"><span>Incident ID</span><span>${this.escapeHtml(incident.attackId)}</span></div>
                <div class="pb-fact-row"><span>First Observed</span><span>${this.formatFullTime(incident.firstSeen)}</span></div>
                <div class="pb-fact-row"><span>Affected Host(s)</span><span>${this.escapeHtml(incident.hostnames.join(", ") || "—")}</span></div>
                <div class="pb-fact-row"><span>Affected User(s)</span><span>${this.escapeHtml(incident.usernames.join(", ") || "—")}</span></div>
                <div class="pb-fact-row"><span>Related Alerts</span><span>${alerts.length}</span></div>
                <div class="pb-fact-row"><span>Timeline Events</span><span>${timeline.length}</span></div>

            </div>
        `;
    }

    reportField(key, label, value) {

        return `
            <label class="pb-field">
                <span class="pb-field-label">${this.escapeHtml(label)}</span>
                <textarea
                    class="pb-field-input"
                    data-report-field="${key}"
                    rows="3"
                    placeholder="Write in your own words..."
                >${this.escapeHtml(value)}</textarea>
            </label>
        `;
    }


    /* =====================================================
       CLICK / INPUT HANDLING
       ===================================================== */

    handleClick(event) {

        const tocItem =
            event.target.closest("[data-page-index]");

        if (tocItem) {
            this.store.goToPage(Number(tocItem.dataset.pageIndex));
            return;
        }

        const prevButton =
            event.target.closest('[data-action="prev-page"]');

        if (prevButton && !prevButton.disabled) {
            this.store.previousPage();
            return;
        }

        const nextButton =
            event.target.closest('[data-action="next-page"]');

        if (nextButton && !nextButton.disabled) {
            this.store.nextPage();
            return;
        }

        const checklistItem =
            event.target.closest("[data-checklist-key]");

        if (checklistItem) {

            const key =
                checklistItem.dataset.checklistKey;

            this.store.toggleChecklistItem(key);
            return;
        }

        const incidentChip =
            event.target.closest("[data-attack-id]");

        if (incidentChip) {
            this.store.selectIncident(incidentChip.dataset.attackId);
            return;
        }
    }

    handleInput(event) {

        const field =
            event.target.closest("[data-report-field]");

        if (field) {
            this.store.setReportField(field.dataset.reportField, field.value);
        }
    }


    /* =====================================================
       FORMATTERS
       ===================================================== */

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