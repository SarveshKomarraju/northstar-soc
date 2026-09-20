/* =========================================================
   NORTHSTAR SOC — EXPERIENCE OTHER ATTACKS
   ---------------------------------------------------------
   Full replacement (2026-09-09) of the previous Free Play
   control screen. Free Play is NO LONGER a launcher for
   Credential Theft / Ransomware / Worm — those remain separate,
   full NORTHSTAR attack scenarios reachable from the existing
   Scenario Select screen (main-menu/ScenarioSelect.js), which
   this pass does not touch.

   This screen is now a self-contained EDUCATIONAL feature:
   the user picks one of 10 attack techniques and watches a
   scripted, synchronized replay of it from both the Attacker
   POV and the Victim/SOC POV. Everything shown is a NORTHSTAR
   simulation — fake data, fake systems, fake credentials, fake
   network traffic. Nothing here executes a real attack, touches
   a real network, or reuses the existing NORTHSTAR SOC attack
   engines (EventEngine / DetectionEngine / AlertManager /
   AttackEngine / NetworkStore, etc.) — those keep powering the
   real scenario gameplay untouched.

   Architecture: this file only owns the SELECTION screen — the
   10 attack cards plus one 11th "Compare Attacks" tile. Selecting
   an attack card hands off to AttackExperienceRenderer.js, which
   drives the actual animated attacker/victim replay using
   AttackExperienceEngine.js as its sequencer and
   attackExperienceData.js as the only per-attack content. The
   Compare tile hands off to AttackCompareApp.js, which reads the
   `compare` metadata already present on each attack in
   attackExperienceData.js. Adding an 11th (well, 12th) experience
   means adding one object to attackExperienceData.js — nothing
   here changes.

   Plain script (not a module) — same convention as MainMenu.js /
   TrainingApp.js. Exposes window.NorthstarFreePlay with
   .show() / .hide(), unchanged from before, so MainMenu.js needed
   NO changes: startFreeOperations() already calls
   window.NorthstarFreePlay.show().
   ========================================================= */

(function () {

    "use strict";


    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

    }


    const FreePlay = {

        element: null,
        initialized: false,

        /* Persists across renders (and across leaving/returning
           to this screen) so a chosen filter sticks until the
           user changes it. "ALL" means unfiltered. */
        filters: {
            category: "ALL",
            difficulty: "ALL"
        },


        /* =====================================================
           INIT
           ===================================================== */

        init() {

            if (this.initialized) {
                return true;
            }

            this.buildScreen();

            this.initialized = true;

            console.log(
                "[NORTHSTAR] Experience Other Attacks ready"
            );

            return true;

        },


        /* =====================================================
           SHOW / HIDE
           ===================================================== */

        show() {

            if (!this.init()) {
                return;
            }

            this.renderAttackGrid();

            this.element.classList.remove("hidden");

        },


        hide() {

            if (this.element) {
                this.element.classList.add("hidden");
            }

        },


        backToMenu() {

            this.hide();

            if (
                window.NorthstarMainMenu &&
                typeof window.NorthstarMainMenu.show === "function"
            ) {

                window.NorthstarMainMenu.show();

            }

        },


        /* =====================================================
           BUILD SCREEN (once)
           ===================================================== */

        buildScreen() {

            const existing = document.getElementById(
                "northstar-freeplay-screen"
            );

            if (existing) {
                this.element = existing;
                return;
            }

            const screen = document.createElement("div");

            screen.id = "northstar-freeplay-screen";
            screen.className = "northstar-freeplay-screen hidden";

            screen.innerHTML = `

                <div class="nsfp-inner">

                    <div class="nsfp-header">

                        <div>

                            <div class="nsfp-eyebrow">
                                EXPERIENCE OTHER ATTACKS
                            </div>

                            <h1>
                                EXPERIENCE OTHER ATTACKS
                            </h1>

                            <p class="nsfp-subtitle">
                                Interactive Cybersecurity Attack Simulations — select a
                                technique below to watch a controlled, fully simulated
                                attack unfold from both the Attacker and the Victim/SOC
                                point of view.
                            </p>

                        </div>

                        <button
                            type="button"
                            class="nsfp-close"
                            id="nsfp-close"
                            aria-label="Close experience other attacks"
                        >
                            ×
                        </button>

                    </div>

                    <div class="nsfp-disclaimer">
                        All data below — networks, credentials, hashes, IP
                        addresses, and traffic — is synthetic and generated for this
                        simulation. No real systems are contacted or affected.
                    </div>

                    <div class="nsfp-filter-bar" id="nsfp-filter-bar"></div>

                    <section class="nsfp-section">

                        <div class="nsfp-attack-grid" id="nsfp-attack-grid"></div>

                    </section>

                </div>

            `;

            document.body.appendChild(screen);

            this.element = screen;

            const closeBtn = screen.querySelector("#nsfp-close");

            if (closeBtn) {

                closeBtn.addEventListener(
                    "click",
                    () => this.backToMenu()
                );

            }

            document.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Escape" &&
                        this.element &&
                        !this.element.classList.contains("hidden") &&
                        (
                            !window.AttackExperienceRenderer ||
                            !window.AttackExperienceRenderer.element ||
                            window.AttackExperienceRenderer.element.classList.contains("hidden")
                        )
                    ) {

                        this.backToMenu();

                    }

                }
            );

        },


        /* =====================================================
           ATTACK GRID
           ---------------------------------------------------
           Reads window.ATTACK_EXPERIENCES (attackExperienceData.js)
           — 10 entries, all AVAILABLE. This screen owns none of
           the per-attack content itself.
           ===================================================== */

        renderAttackGrid() {

            const grid = document.getElementById("nsfp-attack-grid");

            if (!grid) {
                return;
            }

            const experiences = window.ATTACK_EXPERIENCES || [];

            if (!experiences.length) {

                grid.innerHTML = `
                    <div class="nsfp-attack-empty">
                        Attack experience data failed to load.
                    </div>
                `;

                return;

            }

            this.renderFilterBar(experiences);

            const filtered = experiences.filter(experience =>
                (this.filters.category === "ALL" || experience.category === this.filters.category) &&
                (this.filters.difficulty === "ALL" || experience.difficulty === this.filters.difficulty)
            );

            grid.innerHTML = "";

            if (!filtered.length) {

                grid.innerHTML = `
                    <div class="nsfp-attack-empty">
                        No attacks match the selected filters.
                    </div>
                `;

            } else {

                filtered.forEach(experience => {

                    grid.appendChild(this.buildAttackCard(experience));

                });

            }

            /* The Compare tile is a reference tool, not an attack —
               always shown regardless of the active category/
               difficulty filter. */
            grid.appendChild(this.buildCompareCard());

        },


        /* =====================================================
           FILTER BAR
           ---------------------------------------------------
           Category/difficulty pills computed dynamically from
           whatever is actually in window.ATTACK_EXPERIENCES —
           nothing hardcoded, so a future 11th/12th attack with a
           new category just shows up as its own pill.
           ===================================================== */

        renderFilterBar(experiences) {

            const bar = document.getElementById("nsfp-filter-bar");

            if (!bar) {
                return;
            }

            const categories = [...new Set(experiences.map(exp => exp.category))];
            const difficulties = [...new Set(experiences.map(exp => exp.difficulty))];

            bar.innerHTML = `

                <div class="nsfp-filter-group" data-filter-group="category">
                    <span class="nsfp-filter-group-label">CATEGORY</span>
                    ${this.buildFilterPills(["ALL", ...categories], this.filters.category)}
                </div>

                <div class="nsfp-filter-group" data-filter-group="difficulty">
                    <span class="nsfp-filter-group-label">DIFFICULTY</span>
                    ${this.buildFilterPills(["ALL", ...difficulties], this.filters.difficulty)}
                </div>

            `;

            bar.querySelectorAll("[data-filter-value]").forEach(btn => {

                btn.addEventListener("click", () => {

                    const group = btn.closest("[data-filter-group]").dataset.filterGroup;

                    this.filters[group] = btn.dataset.filterValue;

                    this.renderAttackGrid();

                });

            });

        },


        buildFilterPills(values, active) {

            return values.map(value => `
                <button
                    type="button"
                    class="nsfp-filter-pill ${value === active ? "nsfp-filter-pill-active" : ""}"
                    data-filter-value="${escapeHTML(value)}"
                >
                    ${escapeHTML(value)}
                </button>
            `).join("");

        },


        buildAttackCard(experience) {

            const card = document.createElement("button");

            card.type = "button";
            card.className = "nsfp-attack-card";

            card.style.setProperty(
                "--nsfp-accent",
                experience.accent || "#6fb2e0"
            );

            card.innerHTML = `

                <div class="nsfp-attack-card-top">

                    <span class="nsfp-attack-number">
                        ${String(experience.number).padStart(2, "0")}
                    </span>

                    <span class="nsfp-attack-status">
                        AVAILABLE
                    </span>

                </div>

                <div class="nsfp-attack-title">
                    ${escapeHTML(experience.title)}
                </div>

                <div class="nsfp-attack-meta">
                    <span class="nsfp-attack-category">
                        ${escapeHTML(experience.category)}
                    </span>
                    <span class="nsfp-attack-difficulty">
                        Difficulty: ${escapeHTML(experience.difficulty)}
                    </span>
                    ${experience.mitre ? `
                        <span class="nsfp-attack-mitre" title="${escapeHTML(experience.mitre.name)}">
                            ${escapeHTML(experience.mitre.id)}
                        </span>
                    ` : ""}
                </div>

                <p class="nsfp-attack-description">
                    ${escapeHTML(experience.description)}
                </p>

                <span class="nsfp-attack-launch">
                    EXPERIENCE →
                </span>

            `;

            card.addEventListener(
                "click",
                () => this.launchExperience(experience.id)
            );

            return card;

        },


        /* =====================================================
           COMPARE ATTACKS — the 11th tile. Hands off entirely to
           AttackCompareApp.js (freeplay/AttackCompareApp.js),
           which reads the `compare` metadata already present on
           every attack in attackExperienceData.js. This screen
           owns none of that content.
           ===================================================== */

        buildCompareCard() {

            const card = document.createElement("button");

            card.type = "button";
            card.className = "nsfp-attack-card nsfp-compare-card";

            card.innerHTML = `

                <div class="nsfp-attack-card-top">

                    <span class="nsfp-attack-number">
                        ⚖
                    </span>

                    <span class="nsfp-attack-status">
                        NEW
                    </span>

                </div>

                <div class="nsfp-attack-title">
                    Compare Attacks
                </div>

                <div class="nsfp-attack-meta">
                    <span class="nsfp-attack-category">
                        Reference Tool
                    </span>
                </div>

                <p class="nsfp-attack-description">
                    Some of these look alike. Pick any two techniques and see
                    exactly what's different — and what really is the same.
                </p>

                <span class="nsfp-attack-launch">
                    COMPARE →
                </span>

            `;

            card.addEventListener(
                "click",
                () => this.launchCompare()
            );

            return card;

        },


        launchCompare() {

            if (
                window.AttackCompareApp &&
                typeof window.AttackCompareApp.show === "function"
            ) {

                this.hide();

                window.AttackCompareApp.show();

            } else {

                console.error(
                    "[NORTHSTAR] AttackCompareApp unavailable — cannot open comparison screen."
                );

            }

        },


        launchExperience(experienceId) {

            if (
                window.AttackExperienceRenderer &&
                typeof window.AttackExperienceRenderer.show === "function"
            ) {

                this.hide();

                window.AttackExperienceRenderer.show(experienceId);

            } else {

                console.error(
                    "[NORTHSTAR] AttackExperienceRenderer unavailable — cannot launch experience."
                );

            }

        }

    };


    window.NorthstarFreePlay =
        FreePlay;

})();
