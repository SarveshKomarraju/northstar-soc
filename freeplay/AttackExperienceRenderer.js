/* =========================================================
   NORTHSTAR SOC — EXPERIENCE OTHER ATTACKS
   Attack Experience Renderer (v3 — animation sequencer)
   ---------------------------------------------------------
   Generic, data-driven 2-panel screen (Attacker POV / Victim-
   SOC POV) plus a shared timeline + caption bar, used by EVERY
   attack experience. Built once as a reusable shell; each call
   to .show(id) re-skins it from attackExperienceData.js and
   drives it with a fresh AttackExperienceEngine instance.

   v3 (animation): each panel is ONE continuously-flowing
   column (".nsae-stream"). Everything that happens gets
   APPENDED to that column in chronological order — plain
   event lines AND the "big" interactive widgets (Wi-Fi picker,
   browser window, hash table, node diagram, USB drive,
   credential-capture feed). Because nothing is ever absolutely
   positioned on top of anything else, two things that happen
   close together (e.g. a "Connected to Wi-Fi" success message
   and a follow-up SOC alert) simply stack in order instead of
   visually overlapping.

   A widget, once created, stays mounted and is mutated in
   place by later actions (a network appears in the Wi-Fi list,
   a field gets typed into character by character, a hash row
   flips from masked to revealed, a diagram edge lights up) —
   this is what makes it read as ONE continuous animation
   rather than a series of static snapshots. A small animated
   cursor is created inside a widget the moment something needs
   to click inside it, and moves/clicks using the same
   ported-from-preview mechanics (moveCursorTo + click ripple).

   This file has ZERO attack-specific logic — every action is a
   generic, reusable verb (see the schema comment at the top of
   attackExperienceData.js). Adding an 11th experience means
   adding one more timeline[] to that data file.

   Everything rendered is explicitly synthetic — see the
   comment header in attackExperienceData.js.
   ========================================================= */

(function () {

    "use strict";


    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

    }


    function formatElapsed(ms) {

        const totalSeconds = Math.round(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return (
            "T+" +
            String(minutes).padStart(2, "0") +
            ":" +
            String(seconds).padStart(2, "0")
        );

    }


    function iconFor(tone) {

        if (tone === "alert") return "⚠";
        if (tone === "good") return "✓";
        return "•";

    }


    /* Playback speed multiplier for the JS-driven timing inside
       this renderer (typing cadence, click-ripple delay/cleanup).
       The gaps BETWEEN actions are scaled by
       AttackExperienceEngine's own setSpeed(); this mirrors the
       same multiplier here so the little in-widget animations
       speed up/slow down along with everything else instead of
       looking out of sync at 0.5x/2x. Kept as a plain module
       variable (rather than on Renderer) because the helper
       functions below (typeInto, clickRipple, and a few
       ActionHandlers) are plain functions, not methods. */
    let animSpeed = 1;


    /* =====================================================
       WIDGET MARKUP BUILDERS
       ---------------------------------------------------
       Pure functions returning HTML strings. `data-cur="…"`
       marks anything the animated cursor can click.
       `data-field="…"` marks anything that can be typed into.
       ===================================================== */

    const Widgets = {

        wifiRow(net) {

            const bars = "▂▄▆█".slice(0, Math.max(1, Math.min(4, net.bars || 1)));

            return `
                <div class="nsae-wifi-item ${net.tone === "rogue" ? "nsae-wifi-item-rogue" : ""}"
                     data-cur="net-${escapeHTML(net.id)}" data-net-id="${escapeHTML(net.id)}">
                    <span class="nsae-wifi-bars">${bars}</span>
                    <span class="nsae-wifi-name">${escapeHTML(net.name)}</span>
                    <span class="nsae-wifi-status" data-status></span>
                </div>
            `;

        },


        wifi(props) {

            const networks = props.networks || [];

            return `
                <div class="nsae-widget nsae-wifi">
                    <div class="nsae-wifi-title">Wi-Fi Networks</div>
                    <div class="nsae-wifi-list" data-list>
                        ${networks.map(Widgets.wifiRow).join("")}
                    </div>
                </div>
            `;

        },


        browser(props) {

            return `
                <div class="nsae-widget nsae-browser">
                    <div class="nsae-browser-bar">
                        <span class="nsae-browser-dot"></span>
                        <span class="nsae-browser-dot"></span>
                        <span class="nsae-browser-dot"></span>
                        <span class="nsae-browser-url ${props.secure ? "" : "nsae-browser-url-insecure"}" data-url>
                            ${props.secure ? "🔒" : "⚠"} ${escapeHTML(props.url || "")}
                        </span>
                    </div>
                    <div class="nsae-browser-page" data-page>
                        ${Widgets.page(props.page || {})}
                    </div>
                </div>
            `;

        },


        page(page) {

            if (page.kind === "login") {

                return `
                    <div class="nsae-page-login">
                        <div class="nsae-page-heading">${escapeHTML(page.heading || "Sign In")}</div>
                        ${(page.fields || []).map(field => `
                            <div class="nsae-field">
                                <label>${escapeHTML(field.label)}</label>
                                <div class="nsae-field-value" data-field="${escapeHTML(field.key)}"><span data-typed></span><span class="nsae-caret"></span></div>
                            </div>
                        `).join("")}
                        <div class="nsae-page-btn" data-cur="submit">${escapeHTML(page.buttonLabel || "Sign In")}</div>
                        <div class="nsae-page-status" data-status></div>
                    </div>
                `;

            }

            if (page.kind === "search") {

                return `
                    <div class="nsae-page-search">
                        <div class="nsae-page-searchbar" data-field="query"><span data-typed>${escapeHTML(page.query || "")}</span><span class="nsae-caret"></span></div>
                        <div class="nsae-page-banner" data-banner ${page.banner ? "" : "hidden"}>${escapeHTML(page.banner || "")}</div>
                        <div class="nsae-page-results ${page.leaked ? "nsae-page-results-leaked" : ""}" data-results>
                            ${(page.results || []).map(result => `
                                <div class="nsae-page-result">
                                    <span class="nsae-page-result-title">${escapeHTML(result.title)}</span>
                                    <span class="nsae-page-result-meta">${escapeHTML(result.meta || "")}</span>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                `;

            }

            if (page.kind === "account") {

                return `
                    <div class="nsae-page-account">
                        <div class="nsae-page-heading">${escapeHTML(page.heading || "Account")}</div>
                        <div data-rows>
                            ${(page.rows || []).map(row => `
                                <div class="nsae-page-row">
                                    <span class="nsae-page-row-label">${escapeHTML(row.label)}</span>
                                    <span class="nsae-page-row-value ${row.tone === "alert" ? "nsae-page-row-value-alert" : ""}">${escapeHTML(row.value)}</span>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                `;

            }

            return "";

        },


        capture(props) {

            const title = props.mode === "attempts" ? "Login Attempts" : "Captured Credentials";

            return `
                <div class="nsae-widget nsae-capture">
                    <div class="nsae-capture-title">${escapeHTML(title)}</div>
                    <div class="nsae-capture-rows" data-list></div>
                </div>
            `;

        },


        captureRow(entry) {

            const badge =
                entry.status === "captured" ? "✓ CAPTURED" :
                entry.status === "success" ? "✓ SUCCESS" :
                entry.status === "fail" ? "✕ FAIL" : "";

            return `
                <div class="nsae-capture-row nsae-capture-row-${entry.status || "pending"} nsae-enter">
                    <span class="nsae-capture-primary">${escapeHTML(entry.primary)}</span>
                    <span class="nsae-capture-secondary">${escapeHTML(entry.secondary || "")}</span>
                    <span class="nsae-capture-badge">${badge}</span>
                </div>
            `;

        },


        hashRow(row, index) {

            return `
                <div class="nsae-hashtable-row" data-row="${index}">
                    <span class="nsae-hash">${escapeHTML(row.hash)}</span>
                    <span class="nsae-pass" data-pass>••••••••</span>
                </div>
            `;

        },


        hashTable(props) {

            const rows = props.rows || [];

            return `
                <div class="nsae-widget nsae-hashtable">
                    <div class="nsae-hashtable-head">
                        <span>HASH</span>
                        <span>PASSWORD</span>
                    </div>
                    <div data-list>
                        ${rows.map(Widgets.hashRow).join("")}
                    </div>
                    <div class="nsae-hashtable-scanning" data-scanning hidden>Comparing against rainbow table…</div>
                </div>
            `;

        },


        diagramNode(node) {

            return `
                <div class="nsae-diagram-node nsae-diagram-node-${node.tone || "neutral"}" data-node="${escapeHTML(node.id)}">
                    <div class="nsae-diagram-icon">${escapeHTML(node.icon || "▣")}</div>
                    <div class="nsae-diagram-label">${escapeHTML(node.label)}</div>
                </div>
            `;

        },


        diagram(props) {

            const nodes = props.nodes || [];
            const edges = props.edges || [];

            const edgeBetween = (fromId, toId) =>
                edges.find(edge => edge.from === fromId && edge.to === toId);

            let html = `<div class="nsae-widget nsae-diagram">`;

            nodes.forEach((node, i) => {

                html += Widgets.diagramNode(node);

                const next = nodes[i + 1];

                if (next) {

                    const edge = edgeBetween(node.id, next.id) || {};

                    html += `
                        <div class="nsae-diagram-edge ${edge.animated ? "nsae-diagram-edge-animated" : ""}"
                             data-edge="${escapeHTML(node.id)}-${escapeHTML(next.id)}">
                            ${edge.animated ? '<span class="nsae-diagram-packet"></span>' : ""}
                            <span class="nsae-diagram-edge-label" data-label>${escapeHTML(edge.label || "")}</span>
                        </div>
                    `;

                }

            });

            html += `</div>`;

            return html;

        },


        usb(props) {

            return `
                <div class="nsae-widget nsae-usb">
                    <div class="nsae-usb-icon" data-cur="usb-icon">🔌</div>
                    <div class="nsae-usb-status" data-status>No device connected</div>
                    <div class="nsae-usb-window" data-window hidden>
                        <div class="nsae-usb-window-bar">Removable Disk (E:)</div>
                        <div class="nsae-usb-file" data-cur="usb-file">
                            <span class="nsae-usb-file-icon">📄</span>
                            <span class="nsae-usb-file-name" data-filename></span>
                        </div>
                        <div class="nsae-usb-running" data-running hidden>⟳ Installing…</div>
                    </div>
                </div>
            `;

        }

    };


    const USB_STATUS_LABEL = {
        idle: "No device connected",
        connected: "Removable drive connected",
        "file-visible": "Drive opened — 1 file found",
        opened: "File opened",
        running: "Running…"
    };


    /* =====================================================
       RENDERER
       ===================================================== */

    const Renderer = {

        element: null,
        initialized: false,

        scenario: null,
        engine: null,

        panels: null,      // { attacker: {...}, victim: {...} }
        totalDuration: 0,
        elapsed: 0,

        /* Persists across show()/restart() so a user's chosen
           speed carries over to the next attack they open,
           rather than silently resetting to 1x every time. */
        speedSetting: 1,


        init() {

            if (this.initialized) {
                return true;
            }

            this.buildScreen();
            this.initialized = true;

            console.log("[NORTHSTAR] Attack Experience Renderer ready (v3 animation engine)");

            return true;

        },


        buildScreen() {

            const existing = document.getElementById("northstar-attack-experience-screen");

            if (existing) {
                this.element = existing;
                this.cacheRefs();
                return;
            }

            const screen = document.createElement("div");

            screen.id = "northstar-attack-experience-screen";
            screen.className = "nsae-screen hidden";

            screen.innerHTML = `

                <div class="nsae-inner">

                    <div class="nsae-topbar">

                        <button type="button" class="nsae-back" id="nsae-back">
                            ← BACK TO ATTACKS
                        </button>

                        <div class="nsae-title-block">
                            <div class="nsae-eyebrow">ATTACK SIMULATION</div>
                            <h2 id="nsae-title"></h2>
                        </div>

                        <div class="nsae-meta">
                            <span class="nsae-meta-pill" id="nsae-category"></span>
                            <span class="nsae-meta-pill" id="nsae-difficulty"></span>
                            <span class="nsae-meta-pill nsae-mitre-pill" id="nsae-mitre" title="MITRE ATT&amp;CK (Enterprise) technique"></span>
                        </div>

                    </div>

                    <div class="nsae-timeline-bar" id="nsae-timeline-bar"></div>

                    <div class="nsae-panels">

                        <section class="nsae-panel nsae-panel-attacker">
                            <header>
                                <span class="nsae-panel-dot nsae-panel-dot-attacker"></span>
                                ATTACKER POV
                                <span class="nsae-panel-sub" id="nsae-attacker-label"></span>
                                <span class="nsae-panel-time" id="nsae-attacker-time"></span>
                            </header>
                            <div class="nsae-stream" id="nsae-attacker-stream"></div>
                        </section>

                        <section class="nsae-panel nsae-panel-victim">
                            <header>
                                <span class="nsae-panel-dot nsae-panel-dot-victim"></span>
                                VICTIM / SOC POV
                                <span class="nsae-panel-sub" id="nsae-victim-label"></span>
                                <span class="nsae-panel-time" id="nsae-victim-time"></span>
                            </header>
                            <div class="nsae-stream" id="nsae-victim-stream"></div>
                        </section>

                    </div>

                    <div class="nsae-caption-bar">
                        <div class="nsae-caption-label">WHAT'S HAPPENING</div>
                        <div class="nsae-caption-text" id="nsae-caption-text">
                            Press PLAY to begin the simulation.
                        </div>
                    </div>

                    <div class="nsae-controls">

                        <button type="button" class="nsae-ctrl-btn" id="nsae-restart">
                            ⟲ RESTART
                        </button>

                        <button type="button" class="nsae-ctrl-btn nsae-ctrl-btn-primary" id="nsae-play">
                            ▶ PLAY
                        </button>

                        <div class="nsae-progress" id="nsae-progress">
                            <div class="nsae-progress-fill" id="nsae-progress-fill"></div>
                        </div>

                        <div class="nsae-speed-group" id="nsae-speed-group" role="group" aria-label="Playback speed">
                            <button type="button" class="nsae-speed-btn" data-speed="0.5">0.5×</button>
                            <button type="button" class="nsae-speed-btn nsae-speed-btn-active" data-speed="1">1×</button>
                            <button type="button" class="nsae-speed-btn" data-speed="2">2×</button>
                        </div>

                    </div>

                </div>

                <div class="nsae-complete-overlay hidden" id="nsae-complete-overlay">

                    <div class="nsae-complete-card">

                        <div class="nsae-complete-eyebrow">ATTACK COMPLETE</div>
                        <h2 id="nsae-complete-title"></h2>

                        <div class="nsae-complete-block">
                            <div class="nsae-complete-block-label">WHAT HAPPENED</div>
                            <p id="nsae-complete-happened"></p>
                        </div>

                        <div class="nsae-complete-block">
                            <div class="nsae-complete-block-label">WHAT THE ATTACKER WANTED</div>
                            <p id="nsae-complete-wanted"></p>
                        </div>

                        <div class="nsae-complete-columns">

                            <div class="nsae-complete-block">
                                <div class="nsae-complete-block-label">EVIDENCE DEFENDERS COULD OBSERVE</div>
                                <ul id="nsae-complete-evidence"></ul>
                            </div>

                            <div class="nsae-complete-block">
                                <div class="nsae-complete-block-label">HOW DEFENDERS CAN REDUCE THE RISK</div>
                                <ul id="nsae-complete-defenses"></ul>
                            </div>

                        </div>

                        <div class="nsae-complete-divider"></div>

                        <div class="nsae-complete-stats-label">SIMULATION COMPLETE</div>

                        <div class="nsae-complete-stats" id="nsae-complete-stats"></div>

                        <div class="nsae-complete-actions">

                            <button type="button" class="nsae-ctrl-btn" id="nsae-complete-back">
                                BACK TO ATTACKS
                            </button>

                            <button type="button" class="nsae-ctrl-btn nsae-ctrl-btn-primary" id="nsae-complete-replay">
                                ⟲ REPLAY
                            </button>

                        </div>

                    </div>

                </div>

            `;

            document.body.appendChild(screen);

            this.element = screen;

            this.cacheRefs();
            this.wireControls();

            document.addEventListener("keydown", event => {

                if (
                    event.key === "Escape" &&
                    this.element &&
                    !this.element.classList.contains("hidden")
                ) {

                    this.backToPicker();

                }

            });

        },


        cacheRefs() {

            const byId = id => document.getElementById(id);

            this.refs = {
                back: byId("nsae-back"),
                title: byId("nsae-title"),
                category: byId("nsae-category"),
                difficulty: byId("nsae-difficulty"),
                mitre: byId("nsae-mitre"),
                timelineBar: byId("nsae-timeline-bar"),
                attackerLabel: byId("nsae-attacker-label"),
                attackerTime: byId("nsae-attacker-time"),
                attackerStream: byId("nsae-attacker-stream"),
                victimLabel: byId("nsae-victim-label"),
                victimTime: byId("nsae-victim-time"),
                victimStream: byId("nsae-victim-stream"),
                captionText: byId("nsae-caption-text"),
                restart: byId("nsae-restart"),
                play: byId("nsae-play"),
                progress: byId("nsae-progress"),
                progressFill: byId("nsae-progress-fill"),
                speedGroup: byId("nsae-speed-group"),
                overlay: byId("nsae-complete-overlay"),
                completeTitle: byId("nsae-complete-title"),
                completeHappened: byId("nsae-complete-happened"),
                completeWanted: byId("nsae-complete-wanted"),
                completeEvidence: byId("nsae-complete-evidence"),
                completeDefenses: byId("nsae-complete-defenses"),
                completeStats: byId("nsae-complete-stats"),
                completeBack: byId("nsae-complete-back"),
                completeReplay: byId("nsae-complete-replay")
            };

        },


        wireControls() {

            this.refs.back.addEventListener("click", () => this.backToPicker());
            this.refs.completeBack.addEventListener("click", () => this.backToPicker());

            this.refs.restart.addEventListener("click", () => {

                if (this.engine) {
                    this.engine.restart();
                }

                this.hideComplete();

            });

            this.refs.completeReplay.addEventListener("click", () => {

                if (this.engine) {
                    this.engine.restart();
                }

                this.hideComplete();

            });

            this.refs.play.addEventListener("click", () => {

                if (!this.engine) {
                    return;
                }

                const state = this.engine.getState();

                if (state.running && !state.paused) {
                    this.engine.pause();
                } else {
                    this.engine.play();
                }

            });

            if (this.refs.speedGroup) {

                this.refs.speedGroup.querySelectorAll(".nsae-speed-btn").forEach(btn => {

                    btn.addEventListener("click", () => {

                        const value = parseFloat(btn.dataset.speed) || 1;

                        this.setSpeed(value);

                    });

                });

            }

        },


        /* Applies a new playback speed: updates the engine (so
           the gaps between actions scale immediately, even
           mid-wait), the module-level animSpeed used by the
           typing/click-ripple timing above, and the active
           button's visual state. Persisted on the Renderer so it
           carries over to the next scenario. */
        setSpeed(value) {

            this.speedSetting = value;
            animSpeed = value;

            if (this.engine) {
                this.engine.setSpeed(value);
            }

            if (this.refs.speedGroup) {

                this.refs.speedGroup.querySelectorAll(".nsae-speed-btn").forEach(btn => {

                    const isActive = parseFloat(btn.dataset.speed) === value;
                    btn.classList.toggle("nsae-speed-btn-active", isActive);

                });

            }

        },


        /* =====================================================
           SHOW / HIDE
           ===================================================== */

        show(scenarioId) {

            if (!this.init()) {
                return;
            }

            const scenario = window.getAttackExperience
                ? window.getAttackExperience(scenarioId)
                : null;

            if (!scenario) {

                console.error("[NORTHSTAR] Unknown attack experience id:", scenarioId);
                return;

            }

            this.scenario = scenario;

            this.totalDuration = (scenario.timeline || [])
                .reduce((sum, action) => sum + (action.wait || 0), 0);

            this.renderStaticScenarioInfo(scenario);
            this.hideComplete();
            this.resetPanels();

            if (this.engine) {
                this.engine.destroy();
            }

            this.engine = window.AttackExperienceEngine.create(scenario, {

                onAction: (action, index, total) =>
                    this.handleAction(action, index, total),

                onPlayStateChange: isPlaying =>
                    this.handlePlayStateChange(isPlaying),

                onReset: () =>
                    this.handleReset(),

                onComplete: finishedScenario =>
                    this.handleComplete(finishedScenario)

            });

            this.setSpeed(this.speedSetting || 1);

            this.element.classList.remove("hidden");

        },


        hide() {

            if (this.engine) {
                this.engine.destroy();
                this.engine = null;
            }

            if (this.element) {
                this.element.classList.add("hidden");
            }

        },


        backToPicker() {

            this.hide();

            if (
                window.NorthstarFreePlay &&
                typeof window.NorthstarFreePlay.show === "function"
            ) {

                window.NorthstarFreePlay.show();

            }

        },


        /* =====================================================
           STATIC SCENARIO INFO (title / meta / timeline shell)
           ===================================================== */

        renderStaticScenarioInfo(scenario) {

            this.element.style.setProperty("--nsae-accent", scenario.accent || "#6fb2e0");

            this.refs.title.textContent = scenario.title;
            this.refs.category.textContent = scenario.category;
            this.refs.difficulty.textContent = scenario.difficulty;

            this.refs.mitre.textContent = scenario.mitre
                ? (scenario.mitre.id + " — " + scenario.mitre.name)
                : "";

            this.refs.mitre.hidden = !scenario.mitre;

            this.refs.attackerLabel.textContent = scenario.attackerLabel || "ATTACKER WORKSTATION";
            this.refs.victimLabel.textContent = scenario.victimLabel || "VICTIM / SOC CONSOLE";

            this.refs.captionText.textContent = "Press PLAY to begin the simulation.";

            const stages = scenario.stages || [];

            this.refs.timelineBar.innerHTML = stages.map((stage, i) => `

                <div class="nsae-timeline-stage" data-stage-index="${i}">
                    <div class="nsae-timeline-dot"></div>
                    <div class="nsae-timeline-label">${escapeHTML(stage)}</div>
                </div>

                ${i < stages.length - 1 ? '<div class="nsae-timeline-connector"></div>' : ""}

            `).join("");

        },


        resetPanels() {

            this.refs.attackerStream.innerHTML = "";
            this.refs.victimStream.innerHTML = "";
            this.refs.attackerTime.textContent = "";
            this.refs.victimTime.textContent = "";
            this.refs.progressFill.style.width = "0%";
            this.elapsed = 0;

            this.panels = {
                attacker: { streamEl: this.refs.attackerStream, widgetEl: null },
                victim: { streamEl: this.refs.victimStream, widgetEl: null }
            };

            const stageEls = this.refs.timelineBar.querySelectorAll(".nsae-timeline-stage");
            stageEls.forEach(el => el.classList.remove("nsae-timeline-stage-active", "nsae-timeline-stage-done"));

            const connectors = this.refs.timelineBar.querySelectorAll(".nsae-timeline-connector");
            connectors.forEach(el => el.classList.remove("nsae-timeline-connector-done"));

        },


        handleReset() {

            this.resetPanels();
            this.hideComplete();

        },


        panelFor(side) {

            if (side === "attacker") return this.panels.attacker;
            if (side === "victim") return this.panels.victim;
            return null;

        },


        /* =====================================================
           ACTION DISPATCH — the heart of the sequencer. Every
           action mutates the DOM in place; nothing here ever
           tears down and rebuilds the whole panel, which is
           what lets things like typing and cursor movement
           animate smoothly.
           ===================================================== */

        handleAction(action, index, total) {

            const handler = ActionHandlers[action.type];

            if (typeof handler === "function") {
                handler.call(this, action);
            } else {
                console.warn("[NORTHSTAR] Unknown timeline action type:", action.type);
            }

            this.elapsed += (action.wait || 0);

            const pct = this.totalDuration > 0
                ? Math.min(100, Math.round((this.elapsed / this.totalDuration) * 100))
                : 0;

            this.refs.progressFill.style.width = pct + "%";

            if (action.side === "attacker" || action.side === "both") {
                this.refs.attackerTime.textContent = formatElapsed(this.elapsed);
            }

            if (action.side === "victim" || action.side === "both") {
                this.refs.victimTime.textContent = formatElapsed(this.elapsed);
            }

        },


        handlePlayStateChange(isPlaying) {

            this.refs.play.textContent = isPlaying ? "Ⅱ PAUSE" : "▶ PLAY";
            this.refs.play.classList.toggle("nsae-ctrl-btn-primary", !isPlaying);

        },


        /* =====================================================
           COMPLETE
           ===================================================== */

        handleComplete(scenario) {

            /* Feeds the Main Menu's STATISTICS screen (main-menu/
               StatsTracker.js) — the "progress tracking" idea
               floated earlier, now with a real place to show up.
               Guarded because this renderer has no hard dependency
               on that file existing. */
            if (
                window.NorthstarStats &&
                typeof window.NorthstarStats.recordAttackExperienced === "function"
            ) {

                window.NorthstarStats.recordAttackExperienced(scenario.id);

            }

            const timeline = scenario.timeline || [];

            const totalEvents = timeline.filter(a =>
                ["line", "captureAdd", "wifiAdd", "wifiInit", "browserOpen", "hashInit", "diagramInit", "usbInit"].includes(a.type)
            ).length;

            const totalAlerts = timeline.filter(a => a.type === "line" && a.tone === "alert").length;

            const summary = scenario.summary || {};

            this.refs.completeTitle.textContent = scenario.title + " — Simulation Summary";
            this.refs.completeHappened.textContent = summary.whatHappened || "";
            this.refs.completeWanted.textContent = summary.whatAttackerWanted || "";

            this.refs.completeEvidence.innerHTML = (summary.evidence || [])
                .map(item => `<li>${escapeHTML(item)}</li>`)
                .join("");

            this.refs.completeDefenses.innerHTML = (summary.defenses || [])
                .map(item => `<li>${escapeHTML(item)}</li>`)
                .join("");

            const stats = [
                { label: "ATTACK TYPE", value: scenario.title },
                { label: "TIMELINE DURATION", value: formatElapsed(this.totalDuration) },
                { label: "SIMULATED EVENTS", value: String(totalEvents) },
                { label: "SIMULATED ALERTS", value: String(totalAlerts) },
                { label: "STAGES COMPLETED", value: (scenario.stages || []).length + " / " + (scenario.stages || []).length }
            ];

            this.refs.completeStats.innerHTML = stats.map(stat => `

                <div class="nsae-stat">
                    <div class="nsae-stat-value">${escapeHTML(stat.value)}</div>
                    <div class="nsae-stat-label">${escapeHTML(stat.label)}</div>
                </div>

            `).join("");

            const stageEls = this.refs.timelineBar.querySelectorAll(".nsae-timeline-stage");
            stageEls.forEach(el => el.classList.add("nsae-timeline-stage-done"));

            const connectors = this.refs.timelineBar.querySelectorAll(".nsae-timeline-connector");
            connectors.forEach(el => el.classList.add("nsae-timeline-connector-done"));

            this.refs.overlay.classList.remove("hidden");

        },


        hideComplete() {

            if (this.refs && this.refs.overlay) {
                this.refs.overlay.classList.add("hidden");
            }

        }

    };


    /* =====================================================
       ANIMATION HELPERS (cursor / typing) — ported from the
       approved standalone Evil Twin preview, generalized to
       operate on any widget card via data-cur / data-field.
       ===================================================== */

    function ensureCursor(widgetEl) {

        let cursor = widgetEl.querySelector(":scope > .nsae-cursor");

        if (!cursor) {

            cursor = document.createElement("div");
            cursor.className = "nsae-cursor";
            cursor.innerHTML = "▲";
            widgetEl.appendChild(cursor);

        }

        return cursor;

    }


    function moveCursorTo(widgetEl, targetEl) {

        if (!widgetEl || !targetEl) {
            return null;
        }

        const cursor = ensureCursor(widgetEl);

        const widgetRect = widgetEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        const x = (targetRect.left - widgetRect.left) + (targetRect.width * 0.2);
        const y = (targetRect.top - widgetRect.top) + (targetRect.height * 0.5);

        cursor.classList.add("nsae-cursor-visible");
        cursor.style.transform = `translate(${x}px, ${y}px)`;

        return cursor;

    }


    function clickRipple(widgetEl, targetEl) {

        if (!widgetEl || !targetEl) {
            return;
        }

        const widgetRect = widgetEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        const ring = document.createElement("div");
        ring.className = "nsae-click-ring";
        ring.style.left = ((targetRect.left - widgetRect.left) + targetRect.width * 0.2) + "px";
        ring.style.top = ((targetRect.top - widgetRect.top) + targetRect.height * 0.5) + "px";

        widgetEl.appendChild(ring);

        targetEl.classList.add("nsae-clicked");

        setTimeout(() => {
            ring.remove();
        }, 550 / animSpeed);

    }


    function typeInto(targetEl, text, masked) {

        if (!targetEl) {
            return;
        }

        const typedEl = targetEl.querySelector("[data-typed]") || targetEl;

        typedEl.textContent = "";

        const chars = String(text || "").split("");
        let i = 0;

        (function step() {

            if (i >= chars.length) {
                return;
            }

            typedEl.textContent += masked ? "•" : chars[i];
            i += 1;

            setTimeout(step, (masked ? 70 : 55) / animSpeed);

        })();

    }


    function appendCard(streamEl, html) {

        const wrap = document.createElement("div");
        wrap.innerHTML = html.trim();

        const el = wrap.firstElementChild;

        if (el) {
            el.classList.add("nsae-enter");
            streamEl.appendChild(el);
            streamEl.scrollTop = streamEl.scrollHeight;
        }

        return el;

    }


    /* =====================================================
       ACTION HANDLERS
       ---------------------------------------------------
       `this` is the Renderer inside each handler.
       ===================================================== */

    const ActionHandlers = {

        stage(action) {

            const stages = (this.scenario && this.scenario.stages) || [];
            const stageIndex = stages.indexOf(action.stage);

            const stageEls = this.refs.timelineBar.querySelectorAll(".nsae-timeline-stage");

            stageEls.forEach((el, i) => {

                el.classList.remove("nsae-timeline-stage-active", "nsae-timeline-stage-done");

                if (i < stageIndex) {
                    el.classList.add("nsae-timeline-stage-done");
                } else if (i === stageIndex) {
                    el.classList.add("nsae-timeline-stage-active");
                }

            });

            const connectors = this.refs.timelineBar.querySelectorAll(".nsae-timeline-connector");

            connectors.forEach((el, i) => {
                el.classList.toggle("nsae-timeline-connector-done", i < stageIndex);
            });

        },


        caption(action) {

            this.refs.captionText.textContent = action.text || "";

        },


        line(action) {

            const panel = this.panelFor(action.side);

            if (!panel) return;

            const tone = action.tone || "normal";

            appendCard(panel.streamEl, `
                <div class="nsae-feed-card ${tone === "alert" ? "nsae-feed-card-alert" : ""} ${tone === "good" ? "nsae-feed-card-good" : ""}">
                    <span class="nsae-feed-icon">${escapeHTML(action.icon || iconFor(tone))}</span>
                    <span class="nsae-feed-text">${escapeHTML(action.text || "")}</span>
                </div>
            `);

        },


        wifiInit(action) {

            const panel = this.panelFor(action.side);
            if (!panel) return;

            panel.widgetEl = appendCard(panel.streamEl, Widgets.wifi({ networks: action.networks || [] }));

        },


        wifiAdd(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const list = panel.widgetEl.querySelector("[data-list]");
            if (!list) return;

            const wrap = document.createElement("div");
            wrap.innerHTML = Widgets.wifiRow(action.network).trim();

            const el = wrap.firstElementChild;
            el.classList.add("nsae-enter");
            list.appendChild(el);

            panel.streamEl.scrollTop = panel.streamEl.scrollHeight;

        },


        clickNetwork(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const target = panel.widgetEl.querySelector(`[data-net-id="${action.id}"]`);
            if (!target) return;

            moveCursorTo(panel.widgetEl, target);

            setTimeout(() => {

                clickRipple(panel.widgetEl, target);

                const status = target.querySelector("[data-status]");
                if (status) {
                    status.textContent = action.result === "connected" ? "Connected" : "Connecting…";
                    status.classList.toggle("nsae-wifi-status-ok", action.result === "connected");
                }

                target.classList.add("nsae-wifi-item-active");

            }, 550 / animSpeed);

        },


        browserOpen(action) {

            const panel = this.panelFor(action.side);
            if (!panel) return;

            panel.widgetEl = appendCard(panel.streamEl, Widgets.browser({
                url: action.url,
                secure: action.secure,
                page: action.page || {}
            }));

        },


        browserUrl(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const urlEl = panel.widgetEl.querySelector("[data-url]");
            if (!urlEl) return;

            urlEl.textContent = (action.secure ? "🔒 " : "⚠ ") + (action.url || "");
            urlEl.classList.toggle("nsae-browser-url-insecure", !action.secure);

        },


        pageSwap(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const pageEl = panel.widgetEl.querySelector("[data-page]");
            if (!pageEl) return;

            pageEl.innerHTML = Widgets.page(action.page || {});
            pageEl.classList.remove("nsae-enter");
            void pageEl.offsetWidth;
            pageEl.classList.add("nsae-enter");

        },


        clickField(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const target = panel.widgetEl.querySelector(`[data-field="${action.field}"]`);
            if (!target) return;

            moveCursorTo(panel.widgetEl, target);

        },


        typeField(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const target = panel.widgetEl.querySelector(`[data-field="${action.field}"]`);
            if (!target) return;

            moveCursorTo(panel.widgetEl, target);
            typeInto(target, action.text, false);

        },


        typeMasked(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const target = panel.widgetEl.querySelector(`[data-field="${action.field}"]`);
            if (!target) return;

            moveCursorTo(panel.widgetEl, target);
            typeInto(target, action.text, true);

        },


        pressButton(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const target = panel.widgetEl.querySelector('[data-cur="submit"]');
            if (!target) return;

            moveCursorTo(panel.widgetEl, target);

            setTimeout(() => {
                clickRipple(panel.widgetEl, target);
                target.classList.add("nsae-page-btn-active");
            }, 500 / animSpeed);

        },


        browserStatus(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const status = panel.widgetEl.querySelector("[data-status]");
            if (!status) return;

            status.textContent = action.text || "";
            status.classList.toggle("nsae-page-status-good", action.tone !== "alert");
            status.classList.toggle("nsae-page-status-alert", action.tone === "alert");
            status.classList.add("nsae-enter");

        },


        searchType(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const target = panel.widgetEl.querySelector('[data-field="query"]');
            if (!target) return;

            moveCursorTo(panel.widgetEl, target);
            typeInto(target, action.text, false);

        },


        searchResult(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const pageEl = panel.widgetEl.querySelector("[data-page]");
            if (!pageEl) return;

            if (action.banner !== undefined) {

                const banner = pageEl.querySelector("[data-banner]");

                if (banner) {
                    banner.textContent = action.banner;
                    banner.hidden = !action.banner;
                }

            }

            const results = pageEl.querySelector("[data-results]");

            if (results && action.results) {

                results.className = "nsae-page-results" + (action.leaked ? " nsae-page-results-leaked" : "");
                results.innerHTML = action.results.map(result => `
                    <div class="nsae-page-result nsae-enter">
                        <span class="nsae-page-result-title">${escapeHTML(result.title)}</span>
                        <span class="nsae-page-result-meta">${escapeHTML(result.meta || "")}</span>
                    </div>
                `).join("");

            }

        },


        captureInit(action) {

            const panel = this.panelFor(action.side);
            if (!panel) return;

            panel.widgetEl = appendCard(panel.streamEl, Widgets.capture({ mode: action.mode }));

        },


        captureAdd(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const list = panel.widgetEl.querySelector("[data-list]");
            if (!list) return;

            const wrap = document.createElement("div");
            wrap.innerHTML = Widgets.captureRow(action.entry).trim();
            list.appendChild(wrap.firstElementChild);

            panel.streamEl.scrollTop = panel.streamEl.scrollHeight;

        },


        hashInit(action) {

            const panel = this.panelFor(action.side);
            if (!panel) return;

            panel.widgetEl = appendCard(panel.streamEl, Widgets.hashTable({ rows: action.rows || [] }));

        },


        hashScan(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const scanning = panel.widgetEl.querySelector("[data-scanning]");
            if (!scanning) return;

            scanning.hidden = !action.on;

            const table = panel.widgetEl.querySelector(".nsae-hashtable");
            if (table) {
                table.classList.toggle("nsae-hashtable-scanning-active", !!action.on);
            }

        },


        hashReveal(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const row = panel.widgetEl.querySelector(`[data-row="${action.index}"]`);
            if (!row) return;

            const passEl = row.querySelector("[data-pass]");

            row.classList.add("nsae-hashtable-row-revealed", "nsae-enter");

            if (passEl) {
                passEl.textContent = action.password || "";
            }

        },


        diagramInit(action) {

            const panel = this.panelFor(action.side);
            if (!panel) return;

            panel.widgetEl = appendCard(panel.streamEl, Widgets.diagram({
                nodes: action.nodes || [],
                edges: action.edges || []
            }));

        },


        diagramEdge(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const edge = panel.widgetEl.querySelector(`[data-edge="${action.from}-${action.to}"]`);
            if (!edge) return;

            edge.classList.toggle("nsae-diagram-edge-animated", !!action.animated);

            if (action.animated && !edge.querySelector(".nsae-diagram-packet")) {

                const packet = document.createElement("span");
                packet.className = "nsae-diagram-packet";
                edge.insertBefore(packet, edge.firstChild);

            }

            if (!action.animated) {

                const packet = edge.querySelector(".nsae-diagram-packet");
                if (packet) packet.remove();

            }

            const label = edge.querySelector("[data-label]");

            if (label && action.label !== undefined) {
                label.textContent = action.label;
            }

        },


        usbInit(action) {

            const panel = this.panelFor(action.side);
            if (!panel) return;

            panel.widgetEl = appendCard(panel.streamEl, Widgets.usb({}));

        },


        usbState(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const icon = panel.widgetEl.querySelector('[data-cur="usb-icon"]');
            const status = panel.widgetEl.querySelector("[data-status]");
            const win = panel.widgetEl.querySelector("[data-window]");
            const filename = panel.widgetEl.querySelector("[data-filename]");
            const running = panel.widgetEl.querySelector("[data-running]");

            const state = action.state || "idle";

            if (icon) icon.classList.toggle("nsae-usb-icon-connected", state !== "idle");
            if (status) status.textContent = USB_STATUS_LABEL[state] || "";
            if (win) win.hidden = !["file-visible", "opened", "running"].includes(state);
            if (filename && action.fileName) filename.textContent = action.fileName;
            if (running) running.hidden = state !== "running";

        },


        clickUsbFile(action) {

            const panel = this.panelFor(action.side);
            if (!panel || !panel.widgetEl) return;

            const target = panel.widgetEl.querySelector('[data-cur="usb-file"]');
            if (!target) return;

            moveCursorTo(panel.widgetEl, target);

            setTimeout(() => {
                clickRipple(panel.widgetEl, target);
            }, 500 / animSpeed);

        },


        wait() {
            /* no-op — pure pause, timing handled by action.wait */
        }

    };


    window.AttackExperienceRenderer = Renderer;

})();
