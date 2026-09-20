/* =========================================================
   NORTHSTAR SOC — REPORT CLEARANCE BRIEFING
   File: mail/ReportClearanceBriefing.js

   Plays once, right after Marcus actually accepts the
   player's incident report (mail/MailStore.js's sendReport()
   returning success while the subject passes
   isLikelyIncidentReport() — see MailRenderer.js's Compose
   flow, which is the only caller of launch()).

   Problem this solves: once the report is accepted, nothing
   in the game actually told the player what to do next. The
   "ACCESS NIGHTFALL C2" button quietly becomes available in
   Malware Sandbox (see nightfall-ending-sequence.md) but a
   player who isn't already staring at that window has no way
   to know it's there, or that invoice_viewer.ps1 is the file
   to re-run. This overlay closes that gap with an explicit,
   can't-miss "you're clear, here's exactly what to do" beat
   in Marcus's own voice.

   Same structural convention as main-menu/ScenarioBriefing.js
   and malware-sandbox/NightfallEnding.js: a full-screen
   overlay, independent of the desktop window system, appended
   straight to document.body above everything else, as a plain
   script (not an ES module) so mail/MailRenderer.js — which
   IS an ES module — can reach it through window without a
   circular import. Marcus's name/title/initials are hardcoded
   here for the same reason ScenarioBriefing.js hardcodes them
   instead of importing mail/data/company.js's BOSS export.

   Reuses ScenarioBriefing's blue/cyan "Marcus" visual identity
   (report-clearance.css, prefix rc-) rather than Nightfall's
   purple — purple stays reserved for the attacker's own
   infrastructure in the ending sequence itself.

   Exposes: window.NorthstarReportClearanceBriefing.launch()
   ========================================================= */

(function () {

    "use strict";


    const BOSS = {
        name: "Marcus Webb",
        title: "Chief Information Security Officer · Northstar",
        initials: "MW"
    };


    const PARAGRAPHS = [
        "Got it. Just read through everything — the phishing chain, the compromised account, the evidence you pulled together. This is solid work.",
        "Here's the thing: knowing how they got in isn't the same as shutting them out. Nightfall's infrastructure is still live out there — and you've already had a piece of it sitting in front of you since the beginning, in that file you first flagged.",
        "Go back into Malware Sandbox and run invoice_viewer.ps1 again. Follow it all the way through this time. You're cleared to go after their infrastructure directly now — when you get the option, take it. Shut it down for good.",
        "— Marcus"
    ];

    const STEPS = [
        "Open Malware Sandbox",
        "Re-run analysis on invoice_viewer.ps1",
        "Click “ACCESS NIGHTFALL C2 ⚡” once it appears",
        "Hit “TERMINATE NIGHTFALL INFRASTRUCTURE”"
    ];

    const STEPS_LABEL = "HOW TO FINISH THIS";


    let shown = false;
    let active = false;
    let overlay = null;
    let timers = [];


    /* =====================================================
       LAUNCH
       ---------------------------------------------------
       Idempotent by design — safe to call more than once
       (e.g. if a future path re-sends a report) without
       stacking overlays or re-showing after the player has
       already seen and dismissed it once this session.
       ===================================================== */

    function launch() {

        if (shown || active) return;

        active = true;
        shown = true;

        overlay = document.createElement("div");
        overlay.className = "rc-overlay";
        document.body.appendChild(overlay);

        render();

    }


    /* =====================================================
       RENDER
       ===================================================== */

    function render() {

        overlay.innerHTML = `
            <button type="button" class="rc-skip" id="rc-skip">SKIP ▶</button>
            <div class="rc-call">

                <div class="rc-call-header">
                    <div class="rc-call-avatar">${BOSS.initials}</div>
                    <div class="rc-call-who">
                        <div class="rc-call-name">${BOSS.name}</div>
                        <div class="rc-call-title">${BOSS.title}</div>
                    </div>
                    <div class="rc-call-badge">REPORT ACCEPTED</div>
                </div>

                <div class="rc-call-body" id="rc-call-body"></div>

                <div class="rc-steps rc-steps-hidden" id="rc-steps">
                    <div class="rc-steps-label">${STEPS_LABEL}</div>
                    <ol class="rc-steps-list">
                        ${STEPS.map(step => `<li>${step}</li>`).join("")}
                    </ol>
                </div>

                <div class="rc-actions">
                    <button type="button" class="rc-dismiss-button" id="rc-dismiss-button">I'll find it myself</button>
                    <button type="button" class="rc-go-button" id="rc-go-button" disabled>
                        OPEN MALWARE SANDBOX →
                    </button>
                </div>

            </div>
        `;

        overlay
            .querySelector("#rc-skip")
            .addEventListener("click", finishReveal);

        overlay
            .querySelector("#rc-dismiss-button")
            .addEventListener("click", dismiss);

        overlay
            .querySelector("#rc-go-button")
            .addEventListener("click", goToSandbox);

        const bodyEl = overlay.querySelector("#rc-call-body");

        let index = 0;

        const revealNext = () => {

            if (index >= PARAGRAPHS.length) {

                clearTimers();
                enableActions();
                return;

            }

            const p = document.createElement("p");
            p.className = "rc-call-line";
            p.textContent = PARAGRAPHS[index];
            bodyEl.appendChild(p);
            bodyEl.scrollTop = bodyEl.scrollHeight;

            index += 1;

            timers.push(
                setTimeout(revealNext, 800 + Math.random() * 300)
            );

        };

        timers.push(
            setTimeout(revealNext, 350)
        );

    }


    /*
     * SKIP — dump every remaining paragraph in at once, same
     * convention as ScenarioBriefing.js's finishReveal(), so
     * the player still reads the actual instructions rather
     * than jumping straight past them.
     */
    function finishReveal() {

        clearTimers();

        const bodyEl = overlay?.querySelector("#rc-call-body");

        if (!bodyEl) return;

        bodyEl.innerHTML = "";

        PARAGRAPHS.forEach(text => {

            const p = document.createElement("p");
            p.className = "rc-call-line";
            p.textContent = text;
            bodyEl.appendChild(p);

        });

        enableActions();

    }

    function enableActions() {

        const steps = overlay?.querySelector("#rc-steps");

        if (steps) {
            steps.classList.remove("rc-steps-hidden");
        }

        const goButton = overlay?.querySelector("#rc-go-button");

        if (!goButton) return;

        goButton.disabled = false;
        goButton.classList.add("rc-go-button-ready");

    }


    /* =====================================================
       ACTIONS
       ===================================================== */

    function goToSandbox() {

        teardown();

        if (
            window.SOCCommandCenter &&
            typeof window.SOCCommandCenter.openApplication === "function"
        ) {

            window.SOCCommandCenter.openApplication("sandbox");

        }

    }

    function dismiss() {

        teardown();

    }

    function teardown() {

        clearTimers();

        if (overlay) {
            overlay.remove();
            overlay = null;
        }

        active = false;

    }

    function clearTimers() {

        timers.forEach(timer => clearTimeout(timer));
        timers = [];

    }


    window.NorthstarReportClearanceBriefing = { launch };

})();
