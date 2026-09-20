/* =========================================================
   NORTHSTAR SOC — SCENARIO BRIEFING (INTRO)
   File: main-menu/ScenarioBriefing.js

   Plays right after the player picks a scenario card in
   Scenario Select, before the desktop appears — the mirror
   image of NightfallEnding.js's role at the other end of the
   game. A full-screen overlay, independent of the desktop
   window system (appended straight to document.body, above
   everything), same as the ending sequence.

   2 phases:
   1. "Incoming" — a short SOC alert/system log, terminal-style,
      auto-advancing, ending on "connecting" to the boss.
   2. The briefing itself — Marcus Webb (CISO) laying out what's
      known so far, revealed a line at a time. Once the message
      finishes, a "WHAT I NEED IN YOUR REPORT" bullet list fades
      in alongside the BEGIN INVESTIGATION button — the exact
      same list the Incident Playbook's report page shows under
      "What Marcus Needs" (see playbookContent.js's "report"
      page checklist).

   Content is keyed by scenario id in BRIEFINGS below. Only
   "credential-theft" (Operation Nightfall) has one today —
   worm-outbreak/ransomware aren't real scenarios yet (see
   data/scenarios.js). A scenario with no entry here just skips
   straight to onComplete(), so nothing else has to know this
   module exists.

   Marcus's name/title mirror mail/data/company.js's BOSS
   export — hardcoded here since this is a plain script, not an
   ES module, same convention NightfallEnding.js uses for its
   own flavor data.

   Exposes: window.NorthstarScenarioBriefing.launch(scenarioId, onComplete)
   ========================================================= */

(function () {

    "use strict";


    const BOSS = {
        name: "Marcus Webb",
        title: "Chief Information Security Officer · Northstar",
        initials: "MW"
    };


    const BRIEFINGS = {

        "credential-theft": {

            alertLines: [
                "[ALERT] Anomalous sign-in activity detected — Northstar Identity Platform",
                "[SIEM] Multiple failed authentication attempts — origin outside expected geo",
                "[SYS] Escalating to on-call analyst: J. SMITH",
                "[SYS] Opening secure line — CISO Marcus Webb"
            ],

            connectingLabel: "CONNECTING TO CISO...",

            paragraphs: [
                "John — got a minute?",
                "IT flagged some odd sign-in activity overnight. A handful of failed logins, and someone on the Finance side mentioned an email that looked off. Nothing's confirmed yet. That's what I need you to find out.",
                "Pull the thread — mail, alerts, endpoints, wherever it leads. I want to know if anyone's actually inside our network before this turns into a bigger problem.",
                "Standard rules: verify before you act, document everything, and get me a report once you've actually got something solid.",
                "— Marcus"
            ],

            /*
             * What he actually wants in that report. Kept in sync
             * by hand with playbook/data/playbookContent.js's
             * "report" page checklist — that file is the real
             * source of truth (an ES module the Playbook can
             * import from); this is a plain script, so it carries
             * its own copy, same convention as BOSS above.
             */
            requirements: [
                "Affected user's full name",
                "Affected user's IP address",
                "Affected user's MAC address",
                "Attacker's source IP address",
                "Attacker's source country",
                "A screenshot or recording of every Nightfall phishing page",
                "Both locked shared-evidence files cracked and attached",
                "Whether the account was actually compromised, confirmed — not assumed",
                "What containment action was taken"
            ],

            requirementsLabel: "WHAT I NEED IN YOUR REPORT",

            buttonLabel: "BEGIN INVESTIGATION →"

        },


        "ransomware": {

            alertLines: [
                "[SIEM] Macro-enabled document executed — WORKSTATION-06",
                "[EDR] Child process spawned from Microsoft Word — WORKSTATION-06",
                "[SYS] Multiple low-confidence indicators correlated on one endpoint",
                "[SYS] Opening secure line — CISO Marcus Webb"
            ],

            connectingLabel: "CONNECTING TO CISO...",

            paragraphs: [
                "John — I need you on something now.",
                "One of the engineering workstations tripped a few small things overnight. Nothing that screams 'incident' on its own — a macro document, a process I don't recognize, a bit of chatter I can't place yet. Together they don't sit right with me.",
                "I don't know what this is yet, and I'd rather you tell me than guess. Work it like anything else — endpoints, network, the works — but move quickly. If this is what I think it might be, every minute matters.",
                "Same rules as always: verify before you act, document everything, and loop me in the second you have something solid.",
                "— Marcus"
            ],

            requirements: [
                "The compromised host and affected user",
                "The malicious process and how it got there",
                "A timeline of what happened and when",
                "The command-and-control infrastructure involved",
                "What containment actions were taken, and when",
                "Whether affected files were successfully recovered",
                "The final status of the affected host"
            ],

            requirementsLabel: "WHAT I NEED IN YOUR REPORT",

            buttonLabel: "BEGIN INVESTIGATION →"

        }

    };


    let active = false;
    let overlay = null;
    let timers = [];
    let onCompleteCallback = null;


    /*
     * "AUTO-SKIP CUTSCENES" (main-menu Settings) — read live off
     * window.NorthstarSettings when it's ready (MainMenu.js sets
     * it during init(), well before a player can ever reach this
     * screen), with a direct localStorage fallback so a load-
     * order fluke can't accidentally leave this stuck showing the
     * briefing when the player asked to skip it.
     */
    function shouldSkipCutscenes() {

        if (
            window.NorthstarSettings &&
            typeof window.NorthstarSettings.skipCutscenes ===
            "boolean"
        ) {

            return window.NorthstarSettings.skipCutscenes;

        }

        try {

            const saved =
                JSON.parse(
                    localStorage.getItem("northstar-settings") || "{}"
                );

            return Boolean(saved.skipCutscenes);

        } catch (error) {

            return false;

        }

    }


    /* =====================================================
       LAUNCH
       ===================================================== */

    function launch(scenarioId, onComplete) {

        const briefing = BRIEFINGS[scenarioId];

        if (!briefing || shouldSkipCutscenes()) {

            /*
             * No briefing written for this scenario yet, or the
             * player has asked to auto-skip cutscenes — don't
             * block them, just go straight in.
             */

            if (typeof onComplete === "function") {
                onComplete();
            }

            return;

        }

        if (active) return;

        active = true;
        onCompleteCallback = onComplete;

        overlay = document.createElement("div");
        overlay.className = "sb-overlay";
        document.body.appendChild(overlay);

        showAlert(briefing);

    }


    /* =====================================================
       PHASE 1 — INCOMING ALERT
       ===================================================== */

    function showAlert(briefing) {

        overlay.innerHTML = `
            <button type="button" class="sb-skip" id="sb-skip-alert">SKIP ▶</button>
            <div class="sb-terminal">
                <div class="sb-terminal-titlebar">
                    <span class="sb-terminal-dot sb-terminal-dot-r"></span>
                    <span class="sb-terminal-dot sb-terminal-dot-y"></span>
                    <span class="sb-terminal-dot sb-terminal-dot-g"></span>
                    <span class="sb-terminal-titletext">SOC // INCOMING</span>
                </div>
                <div class="sb-terminal-body" id="sb-terminal-lines"></div>
                <div class="sb-terminal-progress-track">
                    <div class="sb-terminal-progress-fill" id="sb-terminal-progress"></div>
                </div>
                <div class="sb-terminal-progress-label" id="sb-terminal-progress-label">${briefing.connectingLabel}</div>
            </div>
        `;

        overlay
            .querySelector("#sb-skip-alert")
            .addEventListener("click", () => showBriefing(briefing));

        const linesEl = overlay.querySelector("#sb-terminal-lines");
        const fillEl = overlay.querySelector("#sb-terminal-progress");

        let index = 0;

        const revealNext = () => {

            if (index >= briefing.alertLines.length) {

                clearTimers();

                timers.push(
                    setTimeout(() => showBriefing(briefing), 700)
                );

                return;

            }

            const row = document.createElement("div");
            row.className = "sb-terminal-line";
            row.textContent = briefing.alertLines[index];
            linesEl.appendChild(row);
            linesEl.scrollTop = linesEl.scrollHeight;

            index += 1;

            const percent = Math.round((index / briefing.alertLines.length) * 100);
            fillEl.style.width = `${percent}%`;

            timers.push(
                setTimeout(revealNext, 480 + Math.random() * 320)
            );

        };

        timers.push(
            setTimeout(revealNext, 350)
        );

    }


    /* =====================================================
       PHASE 2 — THE BRIEFING
       ===================================================== */

    function showBriefing(briefing) {

        clearTimers();

        overlay.innerHTML = `
            <button type="button" class="sb-skip" id="sb-skip-briefing">SKIP ▶</button>
            <div class="sb-call">

                <div class="sb-call-header">
                    <div class="sb-call-avatar">${BOSS.initials}</div>
                    <div class="sb-call-who">
                        <div class="sb-call-name">${BOSS.name}</div>
                        <div class="sb-call-title">${BOSS.title}</div>
                    </div>
                    <div class="sb-call-secure">🔒 SECURE LINE</div>
                </div>

                <div class="sb-call-body" id="sb-call-body"></div>

                <div class="sb-requirements sb-requirements-hidden" id="sb-requirements">
                    <div class="sb-requirements-label">${briefing.requirementsLabel}</div>
                    <ul class="sb-requirements-list">
                        ${briefing.requirements.map(item => `<li>${item}</li>`).join("")}
                    </ul>
                </div>

                <button type="button" class="sb-begin-button" id="sb-begin-button" disabled>
                    ${briefing.buttonLabel}
                </button>

            </div>
        `;

        overlay
            .querySelector("#sb-skip-briefing")
            .addEventListener("click", () => finishReveal(briefing));

        overlay
            .querySelector("#sb-begin-button")
            .addEventListener("click", complete);

        const bodyEl = overlay.querySelector("#sb-call-body");

        let index = 0;

        const revealNext = () => {

            if (index >= briefing.paragraphs.length) {

                clearTimers();
                enableBeginButton();
                return;

            }

            const p = document.createElement("p");
            p.className = "sb-call-line";
            p.textContent = briefing.paragraphs[index];
            bodyEl.appendChild(p);
            bodyEl.scrollTop = bodyEl.scrollHeight;

            index += 1;

            timers.push(
                setTimeout(revealNext, 850 + Math.random() * 350)
            );

        };

        timers.push(
            setTimeout(revealNext, 400)
        );

    }

    /*
     * SKIP mid-briefing — dump every remaining paragraph in at
     * once rather than jumping straight to the button, so the
     * player can still read it, just without waiting on the
     * staggered reveal.
     */
    function finishReveal(briefing) {

        clearTimers();

        const bodyEl = overlay.querySelector("#sb-call-body");

        if (!bodyEl) return;

        bodyEl.innerHTML = "";

        briefing.paragraphs.forEach(text => {

            const p = document.createElement("p");
            p.className = "sb-call-line";
            p.textContent = text;
            bodyEl.appendChild(p);

        });

        enableBeginButton();

    }

    function enableBeginButton() {

        const requirements = overlay?.querySelector("#sb-requirements");

        if (requirements) {
            requirements.classList.remove("sb-requirements-hidden");
        }

        const button = overlay?.querySelector("#sb-begin-button");

        if (!button) return;

        button.disabled = false;
        button.classList.add("sb-begin-button-ready");

    }


    /* =====================================================
       COMPLETE / TEARDOWN
       ===================================================== */

    function complete() {

        clearTimers();

        if (overlay) {
            overlay.remove();
            overlay = null;
        }

        active = false;

        const callback = onCompleteCallback;
        onCompleteCallback = null;

        if (typeof callback === "function") {
            callback();
        }

    }

    function clearTimers() {

        timers.forEach(timer => clearTimeout(timer));
        timers = [];

    }


    window.NorthstarScenarioBriefing = { launch };

})();
