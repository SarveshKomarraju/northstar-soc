/* =========================================================
   NORTHSTAR SOC — MAIN MENU
   ========================================================= */

(function () {

    "use strict";


    const SETTINGS_KEY = "northstar-settings";


    const DEFAULT_SETTINGS = {
        theme: "dark",
        skipCutscenes: false,
        sound: true,
        confirmNewOperation: true
    };


    /*
     * Crisp vector trash-can icon (Feather-style, stroke-only,
     * currentColor) — used in place of the 🗑 emoji glyph, which
     * renders soft/blurry at the small sizes it's used at here
     * (the save card's delete button, the delete-confirm modal).
     * Trusted, hardcoded markup — safe wherever it's dropped in
     * via innerHTML.
     */
    const TRASH_ICON_SVG = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
    `;


    const MainMenu = {

        element: null,
        initialized: false,
        settingsScreen: null,
        loadSessionScreen: null,
        confirmScreen: null,
        statsScreen: null,
        aboutScreen: null,


        /* =====================================================
           INIT
           ===================================================== */

        init() {

            this.element =
                document.getElementById("main-menu");


            if (!this.element) {

                console.error(
                    "[NORTHSTAR] Main menu not found."
                );

                return false;

            }


            if (this.initialized) {
                return true;
            }


            this.bindEvents();
            this.createSettingsScreen();
            this.createLoadSessionScreen();
            this.createConfirmScreen();
            this.createStatsScreen();
            this.createAboutScreen();
            this.loadSettings();


            this.initialized = true;


            console.log(
                "[NORTHSTAR] Main Menu Ready"
            );


            return true;

        },


        /* =====================================================
           BUTTON EVENTS
           ===================================================== */

        bindEvents() {

            const buttons =
                this.element.querySelectorAll(
                    "[data-menu-action]"
                );


            buttons.forEach(button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();


                        const action =
                            button.dataset.menuAction;


                        console.log(
                            "[NORTHSTAR MENU]",
                            action
                        );


                        this.handleAction(action);

                    }
                );

            });

        },


        /* =====================================================
           ACTIONS
           ===================================================== */

        handleAction(action) {

            switch (action) {

                case "scenarios":

                    this.openScenarioSelect();

                    break;


                case "continue":

                    this.continueOperation();

                    break;


                case "free":

                    this.startFreeOperations();

                    break;


                case "training":

                    this.openTraining();

                    break;


                case "settings":

                    this.openSettings();

                    break;


                case "stats":

                    this.openStats();

                    break;


                case "about":

                    this.openAbout();

                    break;


                default:

                    console.warn(
                        "[NORTHSTAR] Unknown menu action:",
                        action
                    );

            }

        },


        /* =====================================================
           SHOW MAIN MENU
           ===================================================== */

        show() {

            if (!this.init()) {
                return;
            }


            const boot =
                document.getElementById(
                    "boot-screen"
                );


            const desktop =
                document.getElementById(
                    "desktop"
                );


            const scenario =
                document.getElementById(
                    "scenario-select"
                );


            if (boot) {
                boot.classList.add("hidden");
            }


            if (desktop) {
                desktop.classList.remove("visible");
            }


            if (scenario) {
                scenario.classList.add("hidden");
            }


            this.closeSettings(false);


            if (this.loadSessionScreen) {

                this.loadSessionScreen.classList.add(
                    "hidden"
                );

            }


            if (this.statsScreen) {

                this.statsScreen.classList.add(
                    "hidden"
                );

            }


            if (this.aboutScreen) {

                this.aboutScreen.classList.add(
                    "hidden"
                );

            }


            const training =
                document.getElementById(
                    "northstar-training-screen"
                );


            if (training) {

                training.classList.add(
                    "hidden"
                );

            }


            const freePlay =
                document.getElementById(
                    "northstar-freeplay-screen"
                );


            if (freePlay) {

                freePlay.classList.add(
                    "hidden"
                );

            }


            this.element.classList.remove(
                "hidden"
            );


            console.log(
                "[NORTHSTAR] Main Menu Shown"
            );

        },


        /* =====================================================
           HIDE MAIN MENU
           ===================================================== */

        hide() {

            if (!this.element) {
                return;
            }


            this.element.classList.add(
                "hidden"
            );

        },


        /* =====================================================
           SCENARIO SELECT
           ===================================================== */

        openScenarioSelect() {

            console.log(
                "[NORTHSTAR] Opening Scenario Select"
            );


            this.hide();


            const desktop =
                document.getElementById(
                    "desktop"
                );


            if (desktop) {
                desktop.classList.remove("visible");
            }


            if (
                window.NorthstarScenarioSelect &&
                typeof window.NorthstarScenarioSelect.show ===
                "function"
            ) {

                window.NorthstarScenarioSelect.show();

            } else {

                console.error(
                    "[NORTHSTAR] ScenarioSelect.js unavailable."
                );

            }

        },


        /* =====================================================
           CONTINUE
           ---------------------------------------------------
           Used to read "the one remembered scenario" out of
           localStorage and jump straight in. Now opens a real
           picker over up to 3 actual saves (thumbnail + name),
           written by the desktop's account menu ("Save and
           Quit") — see main-menu/SaveSlots.js.
           ===================================================== */

        continueOperation() {

            this.openLoadSession();

        },


        /* =====================================================
           EXPERIENCE OTHER ATTACKS
           ---------------------------------------------------
           Opens window.NorthstarFreePlay — no longer a SOC
           control screen or scenario launcher. It's now a
           self-contained educational feature: pick one of 10
           attack techniques and watch a scripted, synchronized
           replay of it from both the Attacker POV and the
           Victim/SOC POV. See freeplay/FreePlayApp.js and
           freeplay/attackExperienceData.js. No reload, no
           reset, no real scenario/engine state touched at all.
           ===================================================== */

        startFreeOperations() {

            this.hide();


            const scenario =
                document.getElementById(
                    "scenario-select"
                );


            const desktop =
                document.getElementById(
                    "desktop"
                );


            if (scenario) {
                scenario.classList.add("hidden");
            }


            if (desktop) {
                desktop.classList.remove("visible");
            }


            if (this.loadSessionScreen) {

                this.loadSessionScreen.classList.add(
                    "hidden"
                );

            }


            this.closeSettings(false);


            if (
                window.NorthstarFreePlay &&
                typeof window.NorthstarFreePlay.show ===
                "function"
            ) {

                window.NorthstarFreePlay.show();

            } else {

                console.error(
                    "[NORTHSTAR] FreePlayApp.js unavailable."
                );

                this.show();

            }

        },


        /* =====================================================
           BEGIN NEW OPERATION
           ---------------------------------------------------
           Every simulation store (mail, endpoints, files, VPN,
           alerts, playbook, the attack/event engines...) is a
           single JS object created once when the page first
           loads (engine/SimulationBootstrap.js), with no reset
           path of its own. Starting a "new" operation without a
           real reload used to just keep reusing whatever state
           was already sitting in memory from any previous
           session in this tab. A full reload is the only thing
           that guarantees a genuinely clean slate — so this
           stashes the chosen scenario, flags that a new operation
           is pending, and reloads; boot picks the flag back up
           (see script.js's showMainMenu()) and launches straight
           into it once the page — and every store on it — comes
           back fresh.

           Deliberately NOT used by loadSelectedSave() — Continue
           is meant to pick a session back up, not wipe it.

           Gated on the CONFIRM NEW OPERATION setting (on by
           default) — this is a genuinely destructive action now
           that it actually reloads and resets everything, so an
           unsuspecting click shouldn't be able to wipe a session
           with no warning. Uses NORTHSTAR's own styled confirm
           screen (see confirmNewOperation() below) rather than a
           native window.confirm() — this fires from Main Menu /
           Scenario Select, and a bare browser dialog looked out
           of place next to everything else here.
           ===================================================== */

        async beginNewOperation(scenarioId) {

            const confirmFirst =
                window.NorthstarSettings
                    ? window.NorthstarSettings.confirmNewOperation !== false
                    : true;


            if (confirmFirst) {

                const confirmed =
                    await this.confirmNewOperation(
                        "This resets your current session completely — every store, alert, and message starts fresh. Anything you haven't saved will be lost."
                    );


                if (!confirmed) {
                    return;
                }

            }


            localStorage.setItem(
                "northstar-selected-scenario",
                scenarioId
            );


            localStorage.removeItem(
                "northstar-operation-complete"
            );


            localStorage.setItem(
                "northstar-pending-new-operation",
                "1"
            );


            window.location.reload();

        },


        /* =====================================================
           CREATE CONFIRM SCREEN
           ---------------------------------------------------
           Built once, reused for every beginNewOperation() call
           — same pattern as createSettingsScreen()/
           createLoadSessionScreen(). Amber "caution" accent
           rather than the settings screen's blue or the reset
           button's dusty red — this isn't an error state, it's a
           deliberate action asking for one more confirmation.
           ===================================================== */

        createConfirmScreen() {

            const existing =
                document.getElementById(
                    "northstar-confirm-screen"
                );


            if (existing) {

                this.confirmScreen =
                    existing;

                return;

            }


            const screen =
                document.createElement("div");


            screen.id =
                "northstar-confirm-screen";


            screen.className =
                "northstar-confirm-screen hidden";


            screen.innerHTML = `

                <div class="northstar-confirm-panel">

                    <div class="northstar-confirm-icon">
                        ⚠
                    </div>

                    <div class="northstar-confirm-eyebrow">
                        NEW OPERATION
                    </div>

                    <h1 class="northstar-confirm-title">
                        Start a new operation?
                    </h1>

                    <p
                        class="northstar-confirm-body"
                        id="northstar-confirm-body"
                    ></p>

                    <div class="northstar-confirm-actions">

                        <button
                            type="button"
                            id="northstar-confirm-cancel"
                            class="northstar-confirm-cancel"
                        >
                            CANCEL
                        </button>

                        <button
                            type="button"
                            id="northstar-confirm-proceed"
                            class="northstar-confirm-proceed"
                        >
                            START OPERATION
                        </button>

                    </div>

                </div>

            `;


            document.body.appendChild(
                screen
            );


            this.confirmScreen =
                screen;

        },


        /* =====================================================
           CONFIRM NEW OPERATION
           ---------------------------------------------------
           Promise-based rather than window.confirm()'s
           synchronous return — the styled screen needs a real
           button click to resolve, so beginNewOperation() awaits
           this instead of blocking on a native dialog. Resolves
           true (proceed) or false (cancelled — backdrop click,
           Escape, or the CANCEL button all count as "no").
           ===================================================== */

        /**
         * Also used for confirmations unrelated to starting a new
         * operation (e.g. deleting a save) — `options` lets a
         * caller override the icon/eyebrow/title/button labels
         * that otherwise default to the "new operation" wording,
         * so every other call site (just beginNewOperation() today)
         * keeps working unchanged.
         */
        confirmNewOperation(message, options = {}) {

            this.createConfirmScreen();


            const screen =
                this.confirmScreen;


            const body =
                screen.querySelector(
                    "#northstar-confirm-body"
                );

            const icon =
                screen.querySelector(
                    ".northstar-confirm-icon"
                );

            const eyebrow =
                screen.querySelector(
                    ".northstar-confirm-eyebrow"
                );

            const title =
                screen.querySelector(
                    ".northstar-confirm-title"
                );

            const cancelLabelEl =
                screen.querySelector(
                    "#northstar-confirm-cancel"
                );

            const proceedLabelEl =
                screen.querySelector(
                    "#northstar-confirm-proceed"
                );

            const panel =
                screen.querySelector(
                    ".northstar-confirm-panel"
                );


            if (body) {

                body.textContent =
                    message;

            }

            if (icon) {

                /* innerHTML rather than textContent — options.icon
                   is either a plain warning glyph or the trusted,
                   hardcoded TRASH_ICON_SVG constant, never
                   user-supplied text. */
                icon.innerHTML =
                    options.icon || "⚠";

            }

            if (eyebrow) {

                eyebrow.textContent =
                    options.eyebrow || "NEW OPERATION";

            }

            if (title) {

                title.textContent =
                    options.title || "Start a new operation?";

            }

            if (cancelLabelEl) {

                cancelLabelEl.textContent =
                    options.cancelLabel || "CANCEL";

            }

            if (proceedLabelEl) {

                proceedLabelEl.textContent =
                    options.proceedLabel || "START OPERATION";

            }

            if (panel) {

                panel.classList.toggle(
                    "northstar-confirm-panel-danger",
                    Boolean(options.danger)
                );

            }


            return new Promise(resolve => {

                const cancelButton =
                    screen.querySelector(
                        "#northstar-confirm-cancel"
                    );


                const proceedButton =
                    screen.querySelector(
                        "#northstar-confirm-proceed"
                    );


                const cleanup = result => {

                    screen.classList.add(
                        "hidden"
                    );

                    cancelButton.removeEventListener(
                        "click",
                        onCancel
                    );

                    proceedButton.removeEventListener(
                        "click",
                        onProceed
                    );

                    screen.removeEventListener(
                        "click",
                        onBackdrop
                    );

                    document.removeEventListener(
                        "keydown",
                        onKeydown
                    );

                    resolve(result);

                };


                const onCancel =
                    () => cleanup(false);


                const onProceed =
                    () => cleanup(true);


                const onBackdrop = event => {

                    if (event.target === screen) {
                        cleanup(false);
                    }

                };


                const onKeydown = event => {

                    if (event.key === "Escape") {
                        cleanup(false);
                    }

                };


                cancelButton.addEventListener(
                    "click",
                    onCancel
                );

                proceedButton.addEventListener(
                    "click",
                    onProceed
                );

                screen.addEventListener(
                    "click",
                    onBackdrop
                );

                document.addEventListener(
                    "keydown",
                    onKeydown
                );


                screen.classList.remove(
                    "hidden"
                );

            });

        },


        /* =====================================================
           LAUNCH PENDING OPERATION
           ---------------------------------------------------
           Called once, right after a beginNewOperation() reload
           lands, instead of showing the Main Menu — see
           script.js's showMainMenu(). Mirrors what
           ScenarioSelect.js's selectScenario() does once a
           scenario is actually chosen: set the global, tell the
           simulation engine, then the boss's briefing (when one
           exists for this scenario) before the desktop appears.
           ===================================================== */

        launchPendingOperation(scenarioId) {

            /*
             * Normally show() is what calls init() (which in turn
             * calls loadSettings()) before a player can ever reach
             * a scenario — this path skips show() entirely, so
             * without this call window.NorthstarSettings would
             * still be sitting at the hardcoded DEFAULT_SETTINGS
             * shape (e.g. skipCutscenes always false) instead of
             * whatever the player actually saved, silently
             * ignoring their real preference for this launch.
             * init() is idempotent — safe even if it already ran.
             */

            this.init();


            window.NorthstarScenario =
                scenarioId;


            window.dispatchEvent(
                new CustomEvent(
                    "northstar:scenario-selected",
                    {
                        detail: {
                            scenario: scenarioId
                        }
                    }
                )
            );


            if (
                window.NorthstarScenarioBriefing &&
                typeof window.NorthstarScenarioBriefing.launch ===
                "function"
            ) {

                window.NorthstarScenarioBriefing.launch(
                    scenarioId,
                    () => this.launchDesktop()
                );

                return;

            }


            this.launchDesktop();

        },


        /* =====================================================
           TRAINING
           ===================================================== */

        openTraining() {

            this.hide();


            const scenario =
                document.getElementById(
                    "scenario-select"
                );


            const desktop =
                document.getElementById(
                    "desktop"
                );


            if (scenario) {
                scenario.classList.add("hidden");
            }


            if (desktop) {
                desktop.classList.remove("visible");
            }


            if (this.loadSessionScreen) {

                this.loadSessionScreen.classList.add(
                    "hidden"
                );

            }


            this.closeSettings(false);


            if (
                window.NorthstarTraining &&
                typeof window.NorthstarTraining.show ===
                "function"
            ) {

                window.NorthstarTraining.show();

            } else {

                console.error(
                    "[NORTHSTAR] TrainingApp.js unavailable."
                );

                this.show();

            }

        },


        /* =====================================================
           CREATE SETTINGS SCREEN
           ===================================================== */

        createSettingsScreen() {

            const existing =
                document.getElementById(
                    "northstar-settings-screen"
                );


            if (existing) {

                this.settingsScreen =
                    existing;

                return;

            }


            const screen =
                document.createElement("div");


            screen.id =
                "northstar-settings-screen";


            screen.className =
                "northstar-settings-screen hidden";


            screen.innerHTML = `

                <div class="northstar-settings-box">


                    <div class="northstar-settings-top">

                        <div>

                            <div class="northstar-settings-label">
                                NORTHSTAR SOC
                            </div>

                            <h1>
                                SETTINGS
                            </h1>

                            <p>
                                Configure workstation preferences.
                            </p>

                        </div>


                        <button
                            type="button"
                            class="northstar-settings-x"
                            id="northstar-settings-x"
                            aria-label="Close settings"
                        >
                            ×
                        </button>

                    </div>


                    <div class="northstar-settings-content">


                        <!-- INTERFACE THEME -->

                        <div class="northstar-setting">

                            <div>

                                <strong>
                                    INTERFACE THEME
                                </strong>

                                <span>
                                    Menu appearance — dark or light
                                </span>

                            </div>


                            <button
                                type="button"
                                class="ns-toggle"
                                id="ns-theme"
                            >
                                DARK
                            </button>

                        </div>


                        <!-- SKIP CUTSCENES -->

                        <div class="northstar-setting">

                            <div>

                                <strong>
                                    AUTO-SKIP CUTSCENES
                                </strong>

                                <span>
                                    Skip Marcus's briefing and the ending sequence automatically
                                </span>

                            </div>


                            <button
                                type="button"
                                class="ns-toggle"
                                id="ns-skip-cutscenes"
                            >
                                OFF
                            </button>

                        </div>


                        <!--
                            Interface animation effects now live under
                            the desktop's own Display Settings ("Reduce
                            motion") instead of duplicating that toggle
                            here with a second, unsynced switch.
                        -->


                        <!-- SYSTEM SOUND -->

                        <div class="northstar-setting">

                            <div>

                                <strong>
                                    SYSTEM SOUND
                                </strong>

                                <span>
                                    NORTHSTAR interface sounds
                                </span>

                            </div>


                            <button
                                type="button"
                                class="ns-toggle active"
                                id="ns-sound"
                            >
                                ON
                            </button>

                        </div>


                        <!-- CONFIRM NEW OPERATION -->

                        <div class="northstar-setting">

                            <div>

                                <strong>
                                    CONFIRM NEW OPERATION
                                </strong>

                                <span>
                                    Ask before Start Operation wipes your current session
                                </span>

                            </div>


                            <button
                                type="button"
                                class="ns-toggle active"
                                id="ns-confirm-new-operation"
                            >
                                ON
                            </button>

                        </div>


                    </div>


                    <div class="northstar-settings-bottom">

                        <button
                            type="button"
                            id="ns-settings-back"
                            class="ns-settings-back"
                        >
                            BACK
                        </button>


                        <button
                            type="button"
                            id="ns-settings-reset"
                            class="ns-settings-reset"
                        >
                            RESET
                        </button>


                        <button
                            type="button"
                            id="ns-settings-apply"
                            class="ns-settings-apply"
                        >
                            APPLY
                        </button>

                    </div>

                </div>

            `;


            document.body.appendChild(
                screen
            );


            this.settingsScreen =
                screen;


            /* =================================================
               CLOSE BUTTON
               ================================================= */

            document
                .getElementById(
                    "northstar-settings-x"
                )
                .addEventListener(
                    "click",
                    () => this.closeSettings(true)
                );


            /* =================================================
               BACK BUTTON
               ================================================= */

            document
                .getElementById(
                    "ns-settings-back"
                )
                .addEventListener(
                    "click",
                    () => this.closeSettings(true)
                );


            /* =================================================
               APPLY BUTTON
               ================================================= */

            document
                .getElementById(
                    "ns-settings-apply"
                )
                .addEventListener(
                    "click",
                    () => this.applySettings()
                );


            /* =================================================
               RESET BUTTON
               ================================================= */

            document
                .getElementById(
                    "ns-settings-reset"
                )
                .addEventListener(
                    "click",
                    () => this.resetSettings()
                );


            /* =================================================
               INTERFACE THEME
               ---------------------------------------------------
               Custom DARK/LIGHT labels instead of the generic
               ON/OFF every other toggle uses — "enabled" here
               means the light theme is on.
               ================================================= */

            this.bindToggle(
                "ns-theme",
                { on: "LIGHT", off: "DARK" }
            );


            /* =================================================
               SKIP CUTSCENES
               ================================================= */

            this.bindToggle(
                "ns-skip-cutscenes"
            );


            /* =================================================
               SOUND
               ================================================= */

            this.bindToggle(
                "ns-sound"
            );


            /* =================================================
               CONFIRM NEW OPERATION
               ================================================= */

            this.bindToggle(
                "ns-confirm-new-operation"
            );


            /* =================================================
               BACKDROP CLICK
               ================================================= */

            screen.addEventListener(
                "click",
                event => {

                    if (
                        event.target === screen
                    ) {

                        this.closeSettings(true);

                    }

                }
            );

        },


        /* =====================================================
           TOGGLE HELPER
           ===================================================== */

        bindToggle(id, labels) {

            const button =
                document.getElementById(id);


            if (!button) {
                return;
            }


            button.addEventListener(
                "click",
                () => {

                    const enabled =
                        button.dataset.enabled !== "false";


                    this.setToggleState(
                        button,
                        !enabled,
                        labels
                    );

                }
            );

        },


        /* =====================================================
           SET TOGGLE STATE
           ---------------------------------------------------
           `labels` is optional — { on, off } text to show instead
           of the default ON/OFF (used by the theme toggle, which
           reads better as DARK/LIGHT).
           ===================================================== */

        setToggleState(button, enabled, labels) {

            const onLabel =
                labels?.on || "ON";

            const offLabel =
                labels?.off || "OFF";


            button.dataset.enabled =
                String(enabled);


            button.textContent =
                enabled ? onLabel : offLabel;


            button.classList.toggle(
                "active",
                enabled
            );


            button.classList.toggle(
                "inactive",
                !enabled
            );

        },


        /* =====================================================
           OPEN SETTINGS
           ===================================================== */

        openSettings() {

            console.log(
                "[NORTHSTAR] SETTINGS BUTTON CLICKED"
            );


            if (!this.settingsScreen) {

                this.createSettingsScreen();

            }


            if (!this.settingsScreen) {

                console.error(
                    "[NORTHSTAR] Settings screen failed to initialize."
                );

                return;

            }


            this.hide();


            const scenario =
                document.getElementById(
                    "scenario-select"
                );


            const desktop =
                document.getElementById(
                    "desktop"
                );


            if (scenario) {
                scenario.classList.add("hidden");
            }


            if (desktop) {
                desktop.classList.remove("visible");
            }


            if (this.loadSessionScreen) {

                this.loadSessionScreen.classList.add(
                    "hidden"
                );

            }


            this.loadSettings();


            this.settingsScreen.classList.remove(
                "hidden"
            );


            console.log(
                "[NORTHSTAR] SETTINGS OPEN"
            );

        },


        /* =====================================================
           CLOSE SETTINGS
           ===================================================== */

        closeSettings(returnToMenu = false) {

            if (this.settingsScreen) {

                this.settingsScreen.classList.add(
                    "hidden"
                );

            }


            if (returnToMenu) {

                this.element.classList.remove(
                    "hidden"
                );

            }

        },


        /* =====================================================
           LOAD SESSION SCREEN
           ---------------------------------------------------
           What the CONTINUE button opens now — up to 3 real
           saves (main-menu/SaveSlots.js), each with a thumbnail
           taken at "Save and Quit" time, a name the player can
           rename right here, and an OPEN action. Built once and
           re-rendered from the current save list every time it
           opens, same pattern as the settings screen.
           ===================================================== */

        createLoadSessionScreen() {

            const existing =
                document.getElementById(
                    "northstar-load-session"
                );


            if (existing) {

                this.loadSessionScreen =
                    existing;

                return;

            }


            const screen =
                document.createElement("div");


            screen.id =
                "northstar-load-session";


            screen.className =
                "northstar-load-session-screen hidden";


            screen.innerHTML = `

                <div class="northstar-load-session-box">

                    <div class="northstar-settings-top">

                        <div>

                            <div class="northstar-settings-label">
                                NORTHSTAR SOC
                            </div>

                            <h1>
                                LOAD SESSION
                            </h1>

                            <p>
                                Choose a saved session to resume.
                            </p>

                        </div>


                        <button
                            type="button"
                            class="northstar-settings-x"
                            id="northstar-load-session-x"
                            aria-label="Close"
                        >
                            ×
                        </button>

                    </div>


                    <div
                        class="northstar-load-session-grid"
                        id="northstar-load-session-grid"
                    ></div>


                    <div class="northstar-settings-bottom">

                        <button
                            type="button"
                            id="northstar-load-session-back"
                            class="ns-settings-back"
                        >
                            BACK
                        </button>

                    </div>

                </div>

            `;


            document.body.appendChild(
                screen
            );


            this.loadSessionScreen =
                screen;


            document
                .getElementById("northstar-load-session-x")
                .addEventListener(
                    "click",
                    () => this.closeLoadSession()
                );


            document
                .getElementById("northstar-load-session-back")
                .addEventListener(
                    "click",
                    () => this.closeLoadSession()
                );


            screen.addEventListener(
                "click",
                event => {

                    if (event.target === screen) {

                        this.closeLoadSession();

                    }

                }
            );

        },


        openLoadSession() {

            if (!this.loadSessionScreen) {

                this.createLoadSessionScreen();

            }


            if (!this.loadSessionScreen) {
                return;
            }


            this.hide();


            const scenario =
                document.getElementById("scenario-select");

            const desktop =
                document.getElementById("desktop");


            if (scenario) {
                scenario.classList.add("hidden");
            }

            if (desktop) {
                desktop.classList.remove("visible");
            }


            this.renderLoadSessionGrid();


            this.loadSessionScreen.classList.remove(
                "hidden"
            );

        },


        closeLoadSession() {

            if (this.loadSessionScreen) {

                this.loadSessionScreen.classList.add(
                    "hidden"
                );

            }


            this.element.classList.remove(
                "hidden"
            );

        },


        renderLoadSessionGrid() {

            const grid =
                document.getElementById(
                    "northstar-load-session-grid"
                );


            if (!grid) {
                return;
            }


            const saves =
                (
                    window.NorthstarSaveSlots &&
                    typeof window.NorthstarSaveSlots.getAll === "function"
                )
                    ? window.NorthstarSaveSlots.getAll()
                    : [];


            if (!saves.length) {

                grid.innerHTML = `

                    <div class="northstar-load-session-empty">

                        <div class="northstar-load-session-empty-icon">
                            ▢
                        </div>

                        <strong>
                            No saved sessions yet
                        </strong>

                        <p>
                            Use "Save and Quit" from the account menu
                            inside a session to create one — up to 3
                            at a time.
                        </p>

                        <button
                            type="button"
                            id="northstar-load-session-start-new"
                            class="main-menu-button primary"
                        >
                            START OPERATION
                        </button>

                    </div>

                `;


                document
                    .getElementById("northstar-load-session-start-new")
                    .addEventListener(
                        "click",
                        () => this.openScenarioSelect()
                    );


                return;

            }


            grid.innerHTML =
                saves.map(save => `

                    <div
                        class="northstar-save-card"
                        data-save-id="${this.escapeMenuAttr(save.id)}"
                    >

                        <button
                            type="button"
                            class="northstar-save-delete"
                            data-delete-save-id="${this.escapeMenuAttr(save.id)}"
                            aria-label="Delete ${this.escapeMenuAttr(save.name)}"
                            title="Delete this save"
                        >
                            ${TRASH_ICON_SVG}
                        </button>

                        <button
                            type="button"
                            class="northstar-save-thumb"
                            data-open-save-id="${this.escapeMenuAttr(save.id)}"
                            aria-label="Open ${this.escapeMenuAttr(save.name)}"
                            ${save.thumbnail
                        ? `style="background-image:url('${save.thumbnail}')"`
                        : ""
                    }
                        >
                            ${save.thumbnail ? "" : "<span>No preview</span>"}
                        </button>

                        <div class="northstar-save-info">

                            <input
                                type="text"
                                class="northstar-save-name-input"
                                data-rename-save-id="${this.escapeMenuAttr(save.id)}"
                                value="${this.escapeMenuAttr(save.name)}"
                                maxlength="60"
                                aria-label="Save name"
                            >

                            <div class="northstar-save-meta">
                                ${this.escapeMenuText(
                        (window.NorthstarSaveSlots?.scenarioLabel?.(save.scenario)) || "Operation"
                    )} · ${this.escapeMenuText(this.formatSaveDate(save.timestamp))}
                            </div>

                        </div>

                        <button
                            type="button"
                            class="northstar-save-open"
                            data-open-save-id="${this.escapeMenuAttr(save.id)}"
                        >
                            OPEN →
                        </button>

                    </div>

                `).join("");


            grid
                .querySelectorAll("[data-open-save-id]")
                .forEach(element => {

                    element.addEventListener(
                        "click",
                        () =>
                            this.loadSelectedSave(
                                element.dataset.openSaveId
                            )
                    );

                });


            grid
                .querySelectorAll("[data-rename-save-id]")
                .forEach(input => {

                    const commitRename = () => {

                        if (
                            window.NorthstarSaveSlots &&
                            typeof window.NorthstarSaveSlots.renameSave === "function"
                        ) {

                            window.NorthstarSaveSlots.renameSave(
                                input.dataset.renameSaveId,
                                input.value
                            );

                        }

                    };


                    input.addEventListener(
                        "click",
                        event => event.stopPropagation()
                    );


                    input.addEventListener(
                        "blur",
                        commitRename
                    );


                    input.addEventListener(
                        "keydown",
                        event => {

                            if (event.key === "Enter") {

                                event.preventDefault();

                                input.blur();

                            }

                        }
                    );

                });


            grid
                .querySelectorAll("[data-delete-save-id]")
                .forEach(button => {

                    button.addEventListener(
                        "click",
                        event => {

                            /* Don't let this bubble into the card
                               and trigger "open". */
                            event.stopPropagation();

                            this.deleteSelectedSave(
                                button.dataset.deleteSaveId
                            );

                        }
                    );

                });

        },


        /* =====================================================
           CREATE STATS SCREEN
           ---------------------------------------------------
           Replaces the old front-page EXIT button, which just
           showed a "SESSION TERMINATED" screen that looped
           straight back to the main menu and didn't really do
           anything. Real "Quit" still exists — the desktop's
           account menu calls exitOperation() directly
           (DesktopFeatures.js), untouched by this change.

           Same pattern as createSettingsScreen()/
           createLoadSessionScreen(): built once, reused. All
           three sections below are views over data that already
           exists for its own reason elsewhere (window.NorthstarStats
           for attacks/operations, window.NorthstarSaveSlots for
           saved sessions) — nothing on this screen is invented.
           ===================================================== */

        createStatsScreen() {

            const existing =
                document.getElementById(
                    "northstar-stats"
                );


            if (existing) {

                this.statsScreen =
                    existing;

                return;

            }


            const screen =
                document.createElement("div");


            screen.id =
                "northstar-stats";


            screen.className =
                "northstar-stats-screen hidden";


            screen.innerHTML = `

                <div class="northstar-stats-box">

                    <div class="northstar-settings-top">

                        <div>

                            <div class="northstar-settings-label">
                                NORTHSTAR SOC
                            </div>

                            <h1>
                                STATISTICS
                            </h1>

                            <p>
                                Your activity across NorthStar SOC — operations,
                                attack simulations, and saved sessions.
                            </p>

                        </div>


                        <button
                            type="button"
                            class="northstar-settings-x"
                            id="northstar-stats-x"
                            aria-label="Close"
                        >
                            ×
                        </button>

                    </div>


                    <div class="northstar-stats-content">

                        <div
                            class="northstar-stats-totals"
                            id="northstar-stats-totals"
                        ></div>


                        <div class="northstar-stats-section">

                            <div class="northstar-stats-section-label">
                                EXPERIENCE OTHER ATTACKS — PROGRESS
                            </div>

                            <div
                                class="northstar-stats-attack-grid"
                                id="northstar-stats-attack-grid"
                            ></div>

                        </div>


                        <div class="northstar-stats-section">

                            <div class="northstar-stats-section-label">
                                SAVED SESSION HISTORY
                            </div>

                            <div
                                class="northstar-stats-sessions"
                                id="northstar-stats-sessions"
                            ></div>

                        </div>

                    </div>


                    <div class="northstar-settings-bottom">

                        <button
                            type="button"
                            id="northstar-stats-back"
                            class="ns-settings-back"
                        >
                            BACK
                        </button>

                    </div>

                </div>

            `;


            document.body.appendChild(
                screen
            );


            this.statsScreen =
                screen;


            document
                .getElementById("northstar-stats-x")
                .addEventListener(
                    "click",
                    () => this.closeStats()
                );


            document
                .getElementById("northstar-stats-back")
                .addEventListener(
                    "click",
                    () => this.closeStats()
                );


            screen.addEventListener(
                "click",
                event => {

                    if (event.target === screen) {

                        this.closeStats();

                    }

                }
            );

        },


        openStats() {

            if (!this.statsScreen) {

                this.createStatsScreen();

            }


            if (!this.statsScreen) {
                return;
            }


            this.hide();


            const scenario =
                document.getElementById("scenario-select");

            const desktop =
                document.getElementById("desktop");


            if (scenario) {
                scenario.classList.add("hidden");
            }

            if (desktop) {
                desktop.classList.remove("visible");
            }


            if (this.loadSessionScreen) {

                this.loadSessionScreen.classList.add(
                    "hidden"
                );

            }


            if (this.aboutScreen) {

                this.aboutScreen.classList.add(
                    "hidden"
                );

            }


            this.closeSettings(false);


            this.renderStats();


            this.statsScreen.classList.remove(
                "hidden"
            );

        },


        closeStats() {

            if (this.statsScreen) {

                this.statsScreen.classList.add(
                    "hidden"
                );

            }


            this.element.classList.remove(
                "hidden"
            );

        },


        /* =====================================================
           RENDER STATS
           ===================================================== */

        renderStats() {

            this.renderStatsTotals();
            this.renderStatsAttackGrid();
            this.renderStatsSessions();

        },


        renderStatsTotals() {

            const el =
                document.getElementById(
                    "northstar-stats-totals"
                );


            if (!el) {
                return;
            }


            const summary =
                (
                    window.NorthstarStats &&
                    typeof window.NorthstarStats.getSummary === "function"
                )
                    ? window.NorthstarStats.getSummary()
                    : { attacksExperiencedCount: 0, totalAttackPlays: 0, operationsCompletedCount: 0 };


            const totalAttacks =
                (window.ATTACK_EXPERIENCES || []).length;


            const savedCount =
                (
                    window.NorthstarSaveSlots &&
                    typeof window.NorthstarSaveSlots.getAll === "function"
                )
                    ? window.NorthstarSaveSlots.getAll().length
                    : 0;


            const maxSlots =
                (window.NorthstarSaveSlots && window.NorthstarSaveSlots.MAX_SLOTS) || 3;


            const tiles = [

                {
                    value: `${summary.attacksExperiencedCount}${totalAttacks ? " / " + totalAttacks : ""}`,
                    label: "ATTACKS EXPERIENCED"
                },

                {
                    value: String(summary.operationsCompletedCount),
                    label: "OPERATIONS COMPLETED"
                },

                {
                    value: `${savedCount} / ${maxSlots}`,
                    label: "SAVED SESSIONS"
                }

            ];


            el.innerHTML =
                tiles.map(tile => `

                    <div class="northstar-stats-tile">
                        <div class="northstar-stats-tile-value">
                            ${this.escapeMenuText(tile.value)}
                        </div>
                        <div class="northstar-stats-tile-label">
                            ${this.escapeMenuText(tile.label)}
                        </div>
                    </div>

                `).join("");

        },


        renderStatsAttackGrid() {

            const el =
                document.getElementById(
                    "northstar-stats-attack-grid"
                );


            if (!el) {
                return;
            }


            const experiences =
                window.ATTACK_EXPERIENCES || [];


            if (!experiences.length) {

                el.innerHTML = `
                    <div class="northstar-stats-empty">
                        No attack simulation data available.
                    </div>
                `;

                return;

            }


            el.innerHTML =
                experiences.map(exp => {

                    const stats =
                        (
                            window.NorthstarStats &&
                            typeof window.NorthstarStats.getAttackStats === "function"
                        )
                            ? window.NorthstarStats.getAttackStats(exp.id)
                            : null;


                    const done =
                        !!stats;


                    return `

                        <div class="northstar-stats-attack-card ${done ? "northstar-stats-attack-card-done" : ""}">

                            <span class="northstar-stats-attack-mark">
                                ${done ? "✓" : "○"}
                            </span>

                            <div class="northstar-stats-attack-info">

                                <div class="northstar-stats-attack-title">
                                    ${this.escapeMenuText(exp.title)}
                                </div>

                                <div class="northstar-stats-attack-meta">
                                    ${done
                        ? `Experienced ${stats.count}× · last ${this.escapeMenuText(this.formatSaveDate(stats.lastAt))}`
                        : "Not yet experienced"
                    }
                                </div>

                            </div>

                        </div>

                    `;

                }).join("");

        },


        renderStatsSessions() {

            const el =
                document.getElementById(
                    "northstar-stats-sessions"
                );


            if (!el) {
                return;
            }


            const saves =
                (
                    window.NorthstarSaveSlots &&
                    typeof window.NorthstarSaveSlots.getAll === "function"
                )
                    ? window.NorthstarSaveSlots.getAll()
                    : [];


            if (!saves.length) {

                el.innerHTML = `
                    <div class="northstar-stats-empty">
                        No saved sessions yet. Use "Save and Quit" from the
                        account menu inside a session to create one.
                    </div>
                `;

                return;

            }


            el.innerHTML =
                saves.map(save => `

                    <div class="northstar-stats-session-row">

                        <div
                            class="northstar-stats-session-thumb"
                            ${save.thumbnail
                        ? `style="background-image:url('${save.thumbnail}')"`
                        : ""
                    }
                        ></div>

                        <div class="northstar-stats-session-info">

                            <div class="northstar-stats-session-name">
                                ${this.escapeMenuText(save.name)}
                            </div>

                            <div class="northstar-stats-session-meta">
                                ${this.escapeMenuText(
                        (window.NorthstarSaveSlots?.scenarioLabel?.(save.scenario)) || "Operation"
                    )} · ${this.escapeMenuText(this.formatSaveDate(save.timestamp))}
                            </div>

                        </div>

                        <button
                            type="button"
                            class="northstar-stats-session-open"
                            data-open-save-id="${this.escapeMenuAttr(save.id)}"
                        >
                            OPEN →
                        </button>

                    </div>

                `).join("");


            el
                .querySelectorAll("[data-open-save-id]")
                .forEach(button => {

                    button.addEventListener(
                        "click",
                        () => {

                            this.closeStats();

                            this.loadSelectedSave(
                                button.dataset.openSaveId
                            );

                        }
                    );

                });

        },


        /**
         * Confirms, then permanently removes one save and
         * re-renders the grid. A save that no longer exists (e.g.
         * a stale double-click) is a silent no-op.
         */
        async deleteSelectedSave(saveId) {

            if (
                !window.NorthstarSaveSlots ||
                typeof window.NorthstarSaveSlots.getById !== "function" ||
                typeof window.NorthstarSaveSlots.deleteSave !== "function"
            ) {
                return;
            }


            const save =
                window.NorthstarSaveSlots.getById(saveId);


            if (!save) {
                return;
            }


            const confirmed =
                await this.confirmNewOperation(
                    `Delete "${save.name}"? This can't be undone.`,
                    {
                        icon: TRASH_ICON_SVG,
                        eyebrow: "DELETE SAVE",
                        title: "Delete this save?",
                        cancelLabel: "CANCEL",
                        proceedLabel: "DELETE",
                        danger: true
                    }
                );


            if (!confirmed) {
                return;
            }


            window.NorthstarSaveSlots.deleteSave(
                saveId
            );


            this.renderLoadSessionGrid();

        },


        loadSelectedSave(saveId) {

            if (
                !window.NorthstarSaveSlots ||
                typeof window.NorthstarSaveSlots.getById !== "function"
            ) {
                return;
            }


            const save =
                window.NorthstarSaveSlots.getById(saveId);


            if (!save) {
                return;
            }


            const scenario =
                save.scenario || "free-operation";


            window.NorthstarScenario =
                scenario;


            localStorage.setItem(
                "northstar-selected-scenario",
                scenario
            );


            window.dispatchEvent(
                new CustomEvent(
                    "northstar:scenario-selected",
                    {
                        detail: {
                            scenario
                        }
                    }
                )
            );


            this.closeLoadSession();


            this.launchDesktop();

        },


        formatSaveDate(timestamp) {

            if (!timestamp) {
                return "";
            }


            const date =
                new Date(timestamp);


            if (Number.isNaN(date.getTime())) {
                return "";
            }


            const pad =
                n => String(n).padStart(2, "0");


            return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

        },


        escapeMenuText(value) {

            return String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

        },


        escapeMenuAttr(value) {

            return this.escapeMenuText(value)
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");

        },


        /* =====================================================
           LOAD SETTINGS
           ===================================================== */

        loadSettings() {

            let settings =
                { ...DEFAULT_SETTINGS };


            try {

                const saved =
                    localStorage.getItem(
                        SETTINGS_KEY
                    );


                if (saved) {

                    const parsed =
                        JSON.parse(saved);


                    settings = {
                        ...DEFAULT_SETTINGS,
                        ...parsed
                    };

                }

            } catch (error) {

                console.warn(
                    "[NORTHSTAR] Failed to load settings.",
                    error
                );

            }


            settings.theme =
                settings.theme === "light"
                    ? "light"
                    : "dark";


            settings.skipCutscenes =
                Boolean(settings.skipCutscenes);


            settings.sound =
                Boolean(settings.sound);


            settings.confirmNewOperation =
                Boolean(settings.confirmNewOperation);


            window.NorthstarSettings =
                settings;


            this.applySettingsToInterface(
                settings
            );


            const theme =
                document.getElementById(
                    "ns-theme"
                );


            const skipCutscenes =
                document.getElementById(
                    "ns-skip-cutscenes"
                );


            const sound =
                document.getElementById(
                    "ns-sound"
                );


            const confirmNewOperation =
                document.getElementById(
                    "ns-confirm-new-operation"
                );


            if (theme) {

                this.setToggleState(
                    theme,
                    settings.theme === "light",
                    { on: "LIGHT", off: "DARK" }
                );

            }


            if (skipCutscenes) {

                this.setToggleState(
                    skipCutscenes,
                    settings.skipCutscenes
                );

            }


            if (sound) {

                this.setToggleState(
                    sound,
                    settings.sound
                );

            }


            if (confirmNewOperation) {

                this.setToggleState(
                    confirmNewOperation,
                    settings.confirmNewOperation
                );

            }


            return settings;

        },


        /* =====================================================
           APPLY SETTINGS
           ===================================================== */

        applySettings() {

            const theme =
                document.getElementById(
                    "ns-theme"
                );


            const skipCutscenes =
                document.getElementById(
                    "ns-skip-cutscenes"
                );


            const sound =
                document.getElementById(
                    "ns-sound"
                );


            const confirmNewOperation =
                document.getElementById(
                    "ns-confirm-new-operation"
                );


            const settings = {

                theme:
                    (theme && theme.dataset.enabled === "true")
                        ? "light"
                        : "dark",


                skipCutscenes:
                    skipCutscenes
                        ? skipCutscenes.dataset.enabled !== "false"
                        : false,


                sound:
                    sound
                        ? sound.dataset.enabled !== "false"
                        : true,


                confirmNewOperation:
                    confirmNewOperation
                        ? confirmNewOperation.dataset.enabled !== "false"
                        : true

            };


            localStorage.setItem(
                SETTINGS_KEY,
                JSON.stringify(settings)
            );


            window.NorthstarSettings =
                settings;


            this.applySettingsToInterface(
                settings
            );


            this.closeSettings(true);


            console.log(
                "[NORTHSTAR] Settings applied:",
                settings
            );

        },


        /* =====================================================
           APPLY SETTINGS TO INTERFACE
           ===================================================== */

        applySettingsToInterface(settings) {

            /*
             * UI scale and reduced-motion are both owned entirely
             * by the desktop's own Display Settings now
             * (DesktopFeatures.js) — this screen used to apply
             * duplicate, unsynced versions of both, which meant
             * whichever settings UI ran last silently overrode
             * the other's choice. Tooltips never controlled a
             * real feature (nothing in NORTHSTAR reads that
             * class).
             *
             * Theme is this screen's own thing, scoped to the
             * menu shell it actually owns (Main Menu, Settings,
             * Load Session, Exit) — main-menu.css's
             * [data-northstar-theme="light"] rules key off this
             * attribute. The in-game desktop and every app inside
             * it stay dark-only for now.
             */

            document.documentElement.setAttribute(
                "data-northstar-theme",
                settings.theme === "light" ? "light" : "dark"
            );


            window.dispatchEvent(
                new CustomEvent(
                    "northstar:settings-changed",
                    {
                        detail: {
                            ...settings
                        }
                    }
                )
            );

        },


        /* =====================================================
           RESET SETTINGS
           ===================================================== */

        resetSettings() {

            const settings =
                { ...DEFAULT_SETTINGS };


            localStorage.setItem(
                SETTINGS_KEY,
                JSON.stringify(settings)
            );


            window.NorthstarSettings =
                settings;


            this.applySettingsToInterface(
                settings
            );


            this.loadSettings();


            console.log(
                "[NORTHSTAR] Settings reset to defaults."
            );

        },


        /* =====================================================
           EXIT
           ===================================================== */

        exitOperation() {

            console.log(
                "[NORTHSTAR] EXIT"
            );


            this.hide();
            this.closeSettings(false);

            if (this.loadSessionScreen) {

                this.loadSessionScreen.classList.add(
                    "hidden"
                );

            }


            const scenario =
                document.getElementById(
                    "scenario-select"
                );


            const desktop =
                document.getElementById(
                    "desktop"
                );


            const boot =
                document.getElementById(
                    "boot-screen"
                );


            if (scenario) {
                scenario.classList.add("hidden");
            }


            if (desktop) {
                desktop.classList.remove("visible");
            }


            if (boot) {
                boot.classList.add("hidden");
            }


            const oldExit =
                document.getElementById(
                    "northstar-exit-screen"
                );


            if (oldExit) {
                oldExit.remove();
            }


            const exit =
                document.createElement("div");


            exit.id =
                "northstar-exit-screen";


            exit.innerHTML = `

                <div class="northstar-exit-panel">

                    <div class="northstar-exit-logo">
                        NS
                    </div>

                    <div class="northstar-exit-status">
                        SESSION TERMINATED
                    </div>

                    <h1>
                        NORTHSTAR SOC
                    </h1>

                    <p>
                        Analyst session has been terminated.
                    </p>

                    <button
                        type="button"
                        id="northstar-return-menu"
                    >
                        RETURN TO MAIN MENU
                    </button>

                </div>

            `;


            document.body.appendChild(
                exit
            );


            document
                .getElementById(
                    "northstar-return-menu"
                )
                .addEventListener(
                    "click",
                    () => {

                        exit.remove();

                        this.show();

                    }
                );

        },


        /* =====================================================
           LAUNCH DESKTOP
           ===================================================== */

        launchDesktop() {

            this.hide();
            this.closeSettings(false);


            if (
                typeof window.showDesktop ===
                "function"
            ) {

                window.showDesktop();

                return;

            }


            const desktop =
                document.getElementById(
                    "desktop"
                );


            if (desktop) {
                desktop.classList.add("visible");
            }

        },


        /* =====================================================
           CREATE ABOUT SCREEN
           ---------------------------------------------------
           Same built-once-reused pattern as createStatsScreen()/
           createSettingsScreen(). Fully static content — a quick
           "what is this / how do I play it" primer for someone
           opening the game cold (a judge, a first-time player),
           plus build credits. Nothing here reads from a store.
           ===================================================== */

        createAboutScreen() {

            const existing =
                document.getElementById(
                    "northstar-about"
                );


            if (existing) {

                this.aboutScreen =
                    existing;

                return;

            }


            const screen =
                document.createElement("div");


            screen.id =
                "northstar-about";


            screen.className =
                "northstar-about-screen hidden";


            screen.innerHTML = `

                <div class="northstar-about-box">

                    <div class="northstar-settings-top">

                        <div>

                            <div class="northstar-settings-label">
                                NORTHSTAR SOC
                            </div>

                            <h1>
                                ABOUT
                            </h1>

                            <p>
                                What this simulates, how to play it, and who built it.
                            </p>

                        </div>


                        <button
                            type="button"
                            class="northstar-settings-x"
                            id="northstar-about-x"
                            aria-label="Close"
                        >
                            ×
                        </button>

                    </div>


                    <div class="northstar-about-content">

                        <div class="northstar-about-section">

                            <div class="northstar-about-section-label">
                                WHAT IS THIS?
                            </div>

                            <p class="northstar-about-text">
                                NORTHSTAR SOC Command Center is a browser-based
                                blue-team cybersecurity simulation. You play a
                                Security Operations Center (SOC) analyst
                                investigating a live, scripted cyberattack
                                against a fictional company, using the same
                                categories of tools a real analyst works with
                                every day — a SIEM alert queue, packet capture,
                                an email/phishing investigator, endpoint and
                                process monitoring, VPN logs, threat
                                intelligence lookups, identity &amp; access
                                management, a malware sandbox, and an
                                incident-response playbook.
                            </p>

                            <p class="northstar-about-text">
                                The current operation, <strong>Operation
                                Nightfall</strong>, walks through a real-world
                                attack pattern: a phishing email leads to a
                                stolen credential, which an attacker rides
                                deeper into the network. Your job is to find
                                the evidence, confirm what actually happened,
                                contain it, and write an incident report that
                                gets graded by an AI reviewer — the same way a
                                real SOC team is judged on its documentation,
                                not just its actions.
                            </p>

                        </div>


                        <div class="northstar-about-section">

                            <div class="northstar-about-section-label">
                                HOW TO PLAY — QUICK START
                            </div>

                            <div class="northstar-about-steps">

                                <div class="northstar-about-step">
                                    <span class="northstar-about-step-num">1</span>
                                    <div class="northstar-about-step-body">
                                        <div class="northstar-about-step-title">
                                            Start Operation
                                        </div>
                                        <div class="northstar-about-step-desc">
                                            Pick Operation Nightfall from Scenario
                                            Select. A mission timer starts the
                                            moment you're on the desktop.
                                        </div>
                                    </div>
                                </div>

                                <div class="northstar-about-step">
                                    <span class="northstar-about-step-num">2</span>
                                    <div class="northstar-about-step-body">
                                        <div class="northstar-about-step-title">
                                            Investigate
                                        </div>
                                        <div class="northstar-about-step-desc">
                                            Work through Mail, Network,
                                            Endpoints, SIEM/Alerts, VPN, and
                                            Threat Intel to piece together what
                                            the attacker did and who they hit.
                                        </div>
                                    </div>
                                </div>

                                <div class="northstar-about-step">
                                    <span class="northstar-about-step-num">3</span>
                                    <div class="northstar-about-step-body">
                                        <div class="northstar-about-step-title">
                                            Contain &amp; report
                                        </div>
                                        <div class="northstar-about-step-desc">
                                            Isolate or quarantine only what the
                                            evidence actually supports — an
                                            unjustified action costs more than a
                                            missed one — then file the incident
                                            report from Mail.
                                        </div>
                                    </div>
                                </div>

                                <div class="northstar-about-step">
                                    <span class="northstar-about-step-num">4</span>
                                    <div class="northstar-about-step-body">
                                        <div class="northstar-about-step-title">
                                            Finish the operation
                                        </div>
                                        <div class="northstar-about-step-desc">
                                            Re-detonate the malicious file in
                                            the Malware Sandbox to trigger the
                                            Nightfall endgame and get your
                                            AI-graded report score.
                                        </div>
                                    </div>
                                </div>

                            </div>

                            <p class="northstar-about-text" style="margin-top:12px;">
                                New to it? <strong>TRAINING</strong> walks
                                through every tool one at a time, and
                                <strong>EXPERIENCE OTHER ATTACKS</strong> lets
                                you watch 10 real attack techniques play out
                                risk-free from both sides.
                            </p>

                        </div>


                        <div class="northstar-about-section">

                            <div class="northstar-about-section-label">
                                BUILT BY
                            </div>

                            <div class="northstar-about-credits">

                                <div class="northstar-about-credit-row">
                                    <span class="northstar-about-credit-label">DEVELOPER</span>
                                    <span class="northstar-about-credit-value">Sarvesh Komarraju</span>
                                </div>

                                <div class="northstar-about-credit-row">
                                    <span class="northstar-about-credit-label">SCHOOL</span>
                                    <span class="northstar-about-credit-value">Wake Early College of Information and Biotechnologies (WECIB)</span>
                                </div>

                                <div class="northstar-about-credit-row">
                                    <span class="northstar-about-credit-label">SUBMITTED FOR</span>
                                    <span class="northstar-about-credit-value">Congressional App Challenge</span>
                                </div>

                                <div class="northstar-about-credit-row">
                                    <span class="northstar-about-credit-label">STACK</span>
                                    <span class="northstar-about-credit-value">Vanilla JavaScript, HTML &amp; CSS — no build step, no game framework</span>
                                </div>

                                <div class="northstar-about-credit-row">
                                    <span class="northstar-about-credit-label">AI GRADING</span>
                                    <span class="northstar-about-credit-value">Incident reports are graded by a local AI model — nothing leaves your machine</span>
                                </div>

                            </div>

                        </div>

                    </div>


                    <div class="northstar-settings-bottom">

                        <button
                            type="button"
                            id="northstar-about-back"
                            class="ns-settings-back"
                        >
                            BACK
                        </button>

                    </div>

                </div>

            `;


            document.body.appendChild(
                screen
            );


            this.aboutScreen =
                screen;


            document
                .getElementById("northstar-about-x")
                .addEventListener(
                    "click",
                    () => this.closeAbout()
                );


            document
                .getElementById("northstar-about-back")
                .addEventListener(
                    "click",
                    () => this.closeAbout()
                );


            screen.addEventListener(
                "click",
                event => {

                    if (event.target === screen) {

                        this.closeAbout();

                    }

                }
            );

        },


        openAbout() {

            if (!this.aboutScreen) {

                this.createAboutScreen();

            }


            if (!this.aboutScreen) {
                return;
            }


            this.hide();


            const scenario =
                document.getElementById("scenario-select");

            const desktop =
                document.getElementById("desktop");


            if (scenario) {
                scenario.classList.add("hidden");
            }

            if (desktop) {
                desktop.classList.remove("visible");
            }


            if (this.loadSessionScreen) {

                this.loadSessionScreen.classList.add(
                    "hidden"
                );

            }


            if (this.statsScreen) {

                this.statsScreen.classList.add(
                    "hidden"
                );

            }


            this.closeSettings(false);


            this.aboutScreen.classList.remove(
                "hidden"
            );

        },


        closeAbout() {

            if (this.aboutScreen) {

                this.aboutScreen.classList.add(
                    "hidden"
                );

            }


            this.element.classList.remove(
                "hidden"
            );

        }

    };


    /* =========================================================
       GLOBAL
       ========================================================= */

    window.NorthstarMainMenu =
        MainMenu;


    window.NorthstarSettings =
        { ...DEFAULT_SETTINGS };


    /* =========================================================
       INITIALIZE
       ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            () => MainMenu.init(),
            { once: true }
        );

    } else {

        MainMenu.init();

    }

})();