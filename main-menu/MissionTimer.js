/* =========================================================
   NORTHSTAR SOC — MISSION TIMER
   File: main-menu/MissionTimer.js

   A flat, scenario-level countdown shown as a small HUD pinned
   to the top-right of the desktop: how long the analyst has
   before the attacker finishes what they started. Deliberately
   a flat meta-clock for pacing, not a readout of AttackEngine's
   own internal state machine — it ticks down regardless of
   which stage the simulated attack is actually in.

   Only counts down while #desktop is actually the visible
   screen — it pauses the instant the player steps out to Main
   Menu / Scenario Select / Settings (none of which reload the
   page) and picks back up exactly where it left off once
   #desktop is "visible" again, via a MutationObserver on its
   class attribute rather than hooking every individual show/
   hide call site.

   Credential Theft ("Operation Nightfall") is the beginner
   scenario, so its limit is set well past what a careful
   investigation actually needs — a safety net, not a speed
   challenge. A scenario id with no entry in TIME_LIMITS_MINUTES
   gets no timer at all (same "unlisted = skip" convention
   main-menu/ScenarioBriefing.js uses for its own BRIEFINGS map),
   so free-play and any future scenario are unaffected until
   someone deliberately adds a line here.

   Deliberately a plain script outside the Store/Renderer/
   EventBridge pattern, same convention as ScenarioBriefing.js /
   NightfallEnding.js / vpn/BreachCutscene.js — a one-off,
   whole-desktop UI effect that injects its own <style> instead
   of depending on a separate stylesheet, so nothing else has to
   know this file exists to keep working.

   Hooked from script.js's showDesktop() — the single place the
   desktop actually becomes visible, for both a fresh operation
   and Continue/Load Session. Reads the scenario id the same way
   ScenarioBriefing.js and MainMenu.js do — localStorage's
   "northstar-selected-scenario" — rather than importing
   data/scenarios.js (this file has no ES module access to it).

   Known limitation, noted rather than silently swallowed:
   loading a save mid-investigation restarts the countdown at
   the full limit instead of resuming wherever it left off —
   nothing in this codebase persists elapsed mission time today
   (engine/GameClock.js is defined but never instantiated
   either), and the generous limit here makes that gap low-
   stakes. Worth revisiting if per-save timer persistence ever
   matters.
   ========================================================= */

(function () {

    "use strict";

    const HUD_ID = "mission-timer-hud";
    const FAIL_OVERLAY_ID = "mission-timer-failed";
    const STYLE_ID = "mission-timer-styles";

    /*
     * Must stay in sync with mail/MailStore.js's
     * MAIL_STORE_EVENTS.REPORT_SENT ("mail:report-sent") — that
     * module exports it as an ES module constant this plain
     * script has no import access to, so the string is
     * duplicated here on purpose (same convention documented in
     * ScenarioBriefing.js for its own copy of Marcus's name).
     */
    const REPORT_SENT_EVENT = "mail:report-sent";

    /*
     * Minutes given per scenario id (the data-scenario value on
     * the Scenario Select card, e.g. "credential-theft" — not
     * data/scenarios.js's own "scenario-001" id, which this
     * plain script has no import access to either).
     */
    const TIME_LIMITS_MINUTES = {
        "credential-theft": 40
    };

    const WARNING_AT_SECONDS = 5 * 60;
    const CRITICAL_AT_SECONDS = 60;


    /* =====================================================
       STYLES (injected once)
       ===================================================== */

    function ensureStyles() {

        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement("style");

        style.id = STYLE_ID;

        style.textContent = `
            #${HUD_ID} {
                position: fixed;
                top: 16px;
                right: 20px;
                z-index: 5000;

                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 2px;

                padding: 8px 16px;

                border: 1px solid #223449;
                border-radius: 10px;
                background: rgba(4, 8, 15, 0.82);
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);

                font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
                pointer-events: none;
                user-select: none;

                transition: border-color 0.3s ease, box-shadow 0.3s ease;
            }

            #${HUD_ID} .mt-label {
                font-size: 9px;
                font-weight: 700;
                letter-spacing: 1.2px;
                color: #6f89a6;
            }

            #${HUD_ID} .mt-value {
                font-size: 20px;
                font-weight: 800;
                letter-spacing: 1px;
                color: #5ce1ff;
                font-variant-numeric: tabular-nums;
            }

            #${HUD_ID}.mt-warning {
                border-color: rgba(245, 158, 11, 0.55);
                box-shadow: 0 8px 24px rgba(245, 158, 11, 0.2);
            }

            #${HUD_ID}.mt-warning .mt-value {
                color: #f59e0b;
            }

            #${HUD_ID}.mt-critical {
                border-color: rgba(239, 68, 68, 0.65);
                box-shadow: 0 8px 24px rgba(239, 68, 68, 0.3);
                animation: missionTimerPulse 1s ease-in-out infinite;
            }

            #${HUD_ID}.mt-critical .mt-value {
                color: #ef4444;
            }

            @keyframes missionTimerPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.04); }
            }

            #${HUD_ID}.mt-contained .mt-value {
                color: #4ade80;
            }

            #${HUD_ID}.mt-fading {
                opacity: 0;
                transition: opacity 900ms ease;
            }


            /* =========================================
               FAIL OVERLAY
               ========================================= */

            #${FAIL_OVERLAY_ID} {
                position: fixed;
                inset: 0;
                z-index: 1000000;

                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;

                background: #030405;
                opacity: 0;
                transition: opacity 900ms ease;
            }

            #${FAIL_OVERLAY_ID}.mt-visible {
                opacity: 1;
            }

            #${FAIL_OVERLAY_ID} .mt-fail-bg {
                position: absolute;
                inset: 0;
                background:
                    repeating-linear-gradient(
                        0deg,
                        rgba(239, 68, 68, 0.05) 0px,
                        rgba(239, 68, 68, 0.05) 1px,
                        transparent 1px,
                        transparent 3px
                    ),
                    radial-gradient(
                        circle at 50% 45%,
                        rgba(239, 68, 68, 0.14),
                        transparent 60%
                    );
            }

            #${FAIL_OVERLAY_ID} .mt-fail-content {
                position: relative;
                z-index: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                padding: 0 24px;
            }

            #${FAIL_OVERLAY_ID} .mt-fail-title {
                font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
                font-size: clamp(30px, 7vw, 60px);
                font-weight: 800;
                letter-spacing: 5px;
                color: #ef4444;
                text-shadow:
                    0 0 24px rgba(239, 68, 68, 0.55),
                    2px 0 #5ce1ff,
                    -2px 0 #ff2fb0;
                min-height: 1.1em;
            }

            #${FAIL_OVERLAY_ID} .mt-fail-sub {
                margin-top: 18px;
                max-width: 440px;
                color: rgba(237, 245, 255, 0.6);
                font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
                font-size: 12px;
                line-height: 1.7;
                letter-spacing: 0.3px;
            }

            #${FAIL_OVERLAY_ID} .mt-fail-menu-btn {
                margin-top: 30px;
                padding: 13px 30px;
                border: 1px solid rgba(239, 68, 68, 0.5);
                border-radius: 8px;
                background: rgba(239, 68, 68, 0.12);
                color: #edf5ff;
                font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 2px;
                cursor: pointer;
                transition: background 0.2s ease, transform 0.2s ease;
            }

            #${FAIL_OVERLAY_ID} .mt-fail-menu-btn:hover {
                background: rgba(239, 68, 68, 0.28);
                transform: translateY(-1px);
            }
        `;

        document.head.appendChild(style);
    }


    /* =====================================================
       HELPERS
       ===================================================== */

    function formatTime(totalSeconds) {

        const clamped = Math.max(0, totalSeconds);

        const minutes = Math.floor(clamped / 60);
        const seconds = clamped % 60;

        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function scrambleReveal(el, finalText, durationMs) {

        const scrambleChars = "!<>-_\\/[]{}—=+*^?#01";

        const totalFrames = Math.max(10, Math.floor(durationMs / 40));

        let frame = 0;

        const timer = setInterval(() => {

            frame += 1;

            const revealCount = Math.floor((frame / totalFrames) * finalText.length);

            el.textContent = finalText
                .split("")
                .map((char, index) => {

                    if (char === " ") {
                        return " ";
                    }

                    return index < revealCount
                        ? char
                        : scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
                })
                .join("");

            if (frame >= totalFrames) {
                clearInterval(timer);
                el.textContent = finalText;
            }

        }, 40);
    }

    function closeAllWindowsInstantly() {

        const api = window.SOCCommandCenter;

        if (!api || !api.state || !api.state.windows ||
            typeof api.closeWindow !== "function") {
            return;
        }

        [...api.state.windows.keys()].forEach(appId => {

            try {
                api.closeWindow(appId);
            } catch (error) {
                console.error("[MISSION TIMER] Failed to close window:", appId, error);
            }
        });
    }

    /*
     * Best-effort, defensive flavor text pulling the real
     * compromised host/user off EndpointStore — same lookup
     * marcus-ai-report-grading.md's grader already trusts. Never
     * lets a missing store break the fail screen.
     */
    function describeWhatWasLost() {

        try {

            const hosts = window.endpointStore && typeof window.endpointStore.getHosts === "function"
                ? window.endpointStore.getHosts()
                : [];

            const host = hosts.find(h => h.compromised);

            if (!host) {
                return "NIGHTFALL completed the breach before you could contain it. The trail goes cold from here.";
            }

            const user = typeof window.endpointStore.getUser === "function"
                ? window.endpointStore.getUser(host.assignedUser)
                : null;

            const who = user && user.displayName
                ? `${user.displayName}'s account (${host.hostname})`
                : host.hostname;

            return `NIGHTFALL finished what it started on ${who} before you could contain it. The trail goes cold from here.`;

        } catch (error) {

            return "NIGHTFALL completed the breach before you could contain it. The trail goes cold from here.";
        }
    }

    function stopSimulation() {

        try {

            if (window.simulationEngine && typeof window.simulationEngine.stop === "function") {
                window.simulationEngine.stop();
            }

        } catch (error) {

            console.error("[MISSION TIMER] Failed to stop simulation:", error);
        }
    }


    /* =====================================================
       MISSION TIMER
       ===================================================== */

    const MissionTimer = {

        totalSeconds: 0,
        remainingSeconds: 0,
        interval: null,
        running: false,
        paused: false, // true whenever #desktop itself isn't the visible screen (main menu, scenario select, etc.)
        settled: false, // true once won, failed, or torn down
        hudEl: null,
        desktopEl: null,
        desktopObserver: null,
        unsubscribeReportSent: null,


        start() {

            if (this.running || this.settled) {
                return;
            }

            const scenarioId = localStorage.getItem("northstar-selected-scenario");

            const minutes = TIME_LIMITS_MINUTES[scenarioId];

            if (!minutes) {
                /* No timer defined for this scenario — nothing to do. */
                return;
            }

            const desktop = document.getElementById("desktop");

            if (!desktop) {
                return;
            }

            this.totalSeconds = minutes * 60;
            this.remainingSeconds = this.totalSeconds;
            this.running = true;
            this.desktopEl = desktop;

            ensureStyles();
            this.mountHud(desktop);
            this.watchForReportSent();
            this.watchDesktopVisibility(desktop);

            this.startTicking();

            console.log(
                `[MISSION TIMER] Started — ${minutes}m on the clock for "${scenarioId}".`
            );
        },


        /*
         * The clock only counts against the player while #desktop
         * is actually the screen on display. Main Menu, Scenario
         * Select, Settings — none of them reload the page (see
         * MainMenu.js's own repeated
         * desktop.classList.add/remove("visible") calls on every
         * show/hide path), so without this the countdown kept
         * running in the background the whole time the player sat
         * at the menu. A MutationObserver on #desktop's class
         * attribute catches every one of those transitions
         * without needing to hook each show/hide call site
         * individually.
         */
        watchDesktopVisibility(desktop) {

            const observer = new MutationObserver(() => {
                this.syncWithDesktopVisibility();
            });

            observer.observe(desktop, {
                attributes: true,
                attributeFilter: ["class"]
            });

            this.desktopObserver = observer;

            /* Pick up whatever the current state already is. */
            this.syncWithDesktopVisibility();
        },


        syncWithDesktopVisibility() {

            if (!this.running || !this.desktopEl) {
                return;
            }

            if (this.desktopEl.classList.contains("visible")) {
                this.resumeTicking();
            } else {
                this.pauseTicking();
            }
        },


        startTicking() {

            if (this.interval) {
                return;
            }

            this.paused = false;

            this.interval = setInterval(() => this.tick(), 1000);
        },


        pauseTicking() {

            if (this.paused) {
                return;
            }

            this.paused = true;

            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }
        },


        resumeTicking() {

            if (!this.paused) {
                return;
            }

            this.startTicking();
        },


        tick() {

            if (!this.running || this.paused) {
                return;
            }

            this.remainingSeconds -= 1;

            if (this.remainingSeconds <= 0) {

                this.remainingSeconds = 0;
                this.updateHud();
                this.handleExpired();
                return;
            }

            this.updateHud();
        },


        mountHud(desktop) {

            const hud = document.createElement("div");

            hud.id = HUD_ID;

            hud.innerHTML = `
                <div class="mt-label">TIME UNTIL BREACH</div>
                <div class="mt-value">${formatTime(this.remainingSeconds)}</div>
            `;

            desktop.appendChild(hud);

            this.hudEl = hud;
        },


        updateHud() {

            if (!this.hudEl) {
                return;
            }

            const valueEl = this.hudEl.querySelector(".mt-value");

            if (valueEl) {
                valueEl.textContent = formatTime(this.remainingSeconds);
            }

            this.hudEl.classList.toggle(
                "mt-warning",
                this.remainingSeconds <= WARNING_AT_SECONDS && this.remainingSeconds > CRITICAL_AT_SECONDS
            );

            this.hudEl.classList.toggle(
                "mt-critical",
                this.remainingSeconds <= CRITICAL_AT_SECONDS
            );
        },


        watchForReportSent() {

            if (!window.mailStore || typeof window.mailStore.on !== "function") {
                return;
            }

            this.unsubscribeReportSent = window.mailStore.on(
                REPORT_SENT_EVENT,
                () => this.handleContained()
            );
        },


        /*
         * The analyst got their incident report in before the
         * clock ran out — stop counting down, leave the HUD
         * showing a calm "contained" state for a few seconds,
         * then let it fade away rather than yanking it instantly.
         */
        handleContained() {

            if (!this.running) {
                return;
            }

            this.running = false;
            this.settled = true;

            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }

            if (this.desktopObserver) {
                this.desktopObserver.disconnect();
                this.desktopObserver = null;
            }

            if (typeof this.unsubscribeReportSent === "function") {
                this.unsubscribeReportSent();
                this.unsubscribeReportSent = null;
            }

            if (this.hudEl) {

                this.hudEl.classList.remove("mt-warning", "mt-critical");
                this.hudEl.classList.add("mt-contained");

                const labelEl = this.hudEl.querySelector(".mt-label");
                const valueEl = this.hudEl.querySelector(".mt-value");

                if (labelEl) {
                    labelEl.textContent = "REPORT FILED";
                }

                if (valueEl) {
                    valueEl.textContent = "✓ CONTAINED";
                }

                setTimeout(() => {

                    if (!this.hudEl) {
                        return;
                    }

                    this.hudEl.classList.add("mt-fading");

                    setTimeout(() => {
                        this.hudEl && this.hudEl.remove();
                        this.hudEl = null;
                    }, 900);

                }, 4000);
            }

            console.log("[MISSION TIMER] Incident report filed in time — countdown stopped.");
        },


        /*
         * Time's up — the attacker finished the job. Full GAME
         * OVER-style beat, mirroring vpn/BreachCutscene.js's own
         * ending screen (same visual language: scramble-reveal
         * title, red glitch shadow, MAIN MENU button) but its own
         * overlay id/markup since this is a different narrative
         * (a missed deadline, not the analyst's own OPSEC
         * failure) and doesn't need that file's chaos sequence.
         */
        handleExpired() {

            if (this.settled) {
                return;
            }

            this.running = false;
            this.settled = true;

            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }

            if (this.desktopObserver) {
                this.desktopObserver.disconnect();
                this.desktopObserver = null;
            }

            if (typeof this.unsubscribeReportSent === "function") {
                this.unsubscribeReportSent();
                this.unsubscribeReportSent = null;
            }

            if (this.hudEl) {
                this.hudEl.remove();
                this.hudEl = null;
            }

            stopSimulation();
            closeAllWindowsInstantly();

            this.showFailScreen();

            console.log("[MISSION TIMER] Time expired — mission failed.");
        },


        showFailScreen() {

            if (document.getElementById(FAIL_OVERLAY_ID)) {
                return;
            }

            const screen = document.createElement("div");

            screen.id = FAIL_OVERLAY_ID;

            screen.innerHTML = `
                <div class="mt-fail-bg"></div>
                <div class="mt-fail-content">
                    <div class="mt-fail-title" id="mission-timer-fail-title"></div>
                    <div class="mt-fail-sub">${describeWhatWasLost()}</div>
                    <button class="mt-fail-menu-btn" type="button">MAIN MENU</button>
                </div>
            `;

            document.body.appendChild(screen);

            requestAnimationFrame(() => {
                screen.classList.add("mt-visible");
            });

            const titleEl = screen.querySelector("#mission-timer-fail-title");

            scrambleReveal(titleEl, "MISSION FAILED", 900);

            const menuButton = screen.querySelector(".mt-fail-menu-btn");

            menuButton.addEventListener("click", () => {

                screen.remove();

                if (typeof window.showMainMenu === "function") {
                    window.showMainMenu();
                }
            });
        }

    };


    /* =====================================================
       GLOBAL
       ===================================================== */

    window.NorthstarMissionTimer = MissionTimer;

})();
