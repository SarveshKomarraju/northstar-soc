/* =========================================================
   NORTHSTAR SOC — CREDENTIAL BREACH CUTSCENE
   File: vpn/BreachCutscene.js

   A short, whole-desktop "something just happened" moment for
   the instant the analyst's own VPN credentials get traced and
   used against them — not just a line in one app's own banner.
   Ends in a full GAME OVER screen with a MAIN MENU button —
   getting traced is meant to actually end the session, not just
   cost a few points.

   Deliberately lives OUTSIDE the Store/Renderer/EventBridge
   pattern every other feature module follows here: this is a
   one-off cross-app effect (a login typed out, every other open
   window visibly glitching and slamming shut, then a hard cut
   to Game Over) triggered by VpnStore regardless of whether the
   VPN window itself happens to be open when it fires — your
   OPSEC risk runs for the whole session, so the consequence has
   to be able to reach you wherever you're actually working.

   Self-contained on purpose: injects its own <style> once
   instead of depending on vpn.css, so nothing else has to know
   this exists to keep working.

   Chaos is built out of independent, parallel beats rather than
   one bigger flash/shake: a fake cursor takes over and starts
   clicking around on its own (the real cursor hidden for the
   duration), a fake treasury panel shows real money actually
   leaving the company as a direct consequence of credential
   theft, windows glitch and slam shut on their own schedule, and
   glitch-text bursts keep firing throughout — all running at
   once for the full CHAOS_HOLD_MS instead of a quick beat.
   ========================================================= */

const OVERLAY_ID = "breach-cutscene";
const GAME_OVER_ID = "breach-game-over";
const STYLE_ID = "breach-cutscene-styles";

const TYPE_SPEED_MS = 85;
const CHAOS_HOLD_MS = 9000;
const FADE_MS = 900;
const GLITCH_BURST_INTERVAL_MS = 320;
const WINDOW_GLITCH_MS = 340;
const CURSOR_MOVE_INTERVAL_MS = 550;
const HEIST_TRANSFER_INTERVAL_MS = 950;

const GLITCH_MESSAGES = [
    "UNAUTHORIZED ACCESS",
    "SESSION HIJACKED",
    "CREDENTIALS COMPROMISED",
    "TRACE COMPLETE",
    "FIREWALL BYPASSED",
    "INTRUSION DETECTED",
    "IDENTITY STOLEN",
    "CONNECTION HIJACKED",
    "WIRE TRANSFER INITIATED",
    "ACCESS: analyst"
];

const HEIST_TRANSFERS = [
    { amount: 84200, dest: "****7734" },
    { amount: 61750, dest: "****2290" },
    { amount: 102300, dest: "****9981" },
    { amount: 39600, dest: "****4415" },
    { amount: 156800, dest: "****6602" }
];


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
        #${OVERLAY_ID} {
            position: fixed;
            inset: 0;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background: rgba(4, 2, 2, 0.88);
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
            opacity: 1;
            transition: opacity ${FADE_MS}ms ease;
        }

        #${OVERLAY_ID}.breach-fading {
            opacity: 0;
        }

        #${OVERLAY_ID} .breach-flash {
            position: absolute;
            inset: 0;
            z-index: 1;
            background: rgba(239, 68, 68, 0.35);
            opacity: 0;
            pointer-events: none;
        }

        #${OVERLAY_ID}.breach-chaos .breach-flash {
            animation: breachFlash 0.4s steps(1) infinite;
        }

        @keyframes breachFlash {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
        }

        #${OVERLAY_ID} .breach-static {
            position: absolute;
            inset: 0;
            z-index: 2;
            opacity: 0;
            pointer-events: none;
            mix-blend-mode: overlay;
            background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
        }

        #${OVERLAY_ID}.breach-chaos .breach-static {
            animation: breachStaticFlicker 0.15s steps(2) infinite;
        }

        @keyframes breachStaticFlicker {
            0%, 100% { opacity: 0.12; }
            50% { opacity: 0.32; }
        }

        #${OVERLAY_ID}.breach-chaos {
            animation: breachShake 0.35s ease-in-out infinite;
        }

        @keyframes breachShake {
            0%, 100% { transform: translate(0, 0); }
            25% { transform: translate(-3px, 2px); }
            50% { transform: translate(3px, -2px); }
            75% { transform: translate(-2px, -3px); }
        }

        #${OVERLAY_ID} .breach-glitch-text {
            position: absolute;
            z-index: 3;
            color: #ef4444;
            font-weight: 700;
            font-size: clamp(13px, 2.4vw, 22px);
            letter-spacing: 1px;
            text-shadow: 2px 0 #5ce1ff, -2px 0 #ff2fb0;
            white-space: nowrap;
            pointer-events: none;
            animation: breachGlitchPop 0.7s ease-out forwards;
        }

        @keyframes breachGlitchPop {
            0% { opacity: 0; transform: scale(0.8); }
            15% { opacity: 1; transform: scale(1.05); }
            85% { opacity: 1; }
            100% { opacity: 0; transform: scale(1); }
        }

        #${OVERLAY_ID} .breach-terminal {
            position: relative;
            z-index: 4;
            width: min(90vw, 460px);
            padding: 22px 26px;
            border: 1px solid rgba(239, 68, 68, 0.5);
            border-radius: 10px;
            background: #0a0d0f;
            box-shadow: 0 0 60px rgba(239, 68, 68, 0.25);
            color: #7dffa0;
            font-size: 13px;
            line-height: 1.9;
        }

        #${OVERLAY_ID} .breach-line {
            white-space: pre-wrap;
            word-break: break-word;
        }

        #${OVERLAY_ID} .breach-caret {
            display: inline-block;
            width: 7px;
            height: 13px;
            margin-left: 1px;
            background: #7dffa0;
            vertical-align: -2px;
            animation: breachCaretBlink 0.9s steps(1) infinite;
        }

        @keyframes breachCaretBlink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
        }

        #${OVERLAY_ID} .breach-status {
            margin-top: 14px;
            min-height: 16px;
            font-weight: 700;
            letter-spacing: 1px;
            color: #ef4444;
            opacity: 0;
        }

        #${OVERLAY_ID} .breach-status.breach-granted {
            opacity: 1;
        }

        #${OVERLAY_ID} .breach-sub {
            margin-top: 6px;
            color: rgba(237, 245, 255, 0.55);
            font-size: 10px;
            letter-spacing: 0.4px;
        }

        /*
         * Applied directly to a real app window element (from
         * window.SOCCommandCenter.getWindowForApp) for a brief
         * moment right before it actually closes.
         */
        .breach-window-glitch {
            animation: breachWindowGlitch 0.28s ease-in-out infinite;
            filter: drop-shadow(0 0 12px rgba(239, 68, 68, 0.7)) saturate(1.6);
            outline: 2px solid rgba(239, 68, 68, 0.55);
        }

        @keyframes breachWindowGlitch {
            0%, 100% { transform: translate(0, 0); }
            30% { transform: translate(-4px, 2px); }
            60% { transform: translate(4px, -2px); }
        }

        .breach-taskbar-glitch {
            animation: breachWindowGlitch 0.28s ease-in-out infinite;
            filter: hue-rotate(-20deg) saturate(1.8);
        }


        /* =================================================
           FAKE CURSOR — "someone else is driving"
           ================================================= */

        body.breach-hide-cursor,
        body.breach-hide-cursor * {
            cursor: none !important;
        }

        .breach-fake-cursor {
            position: fixed;
            z-index: 1000001;
            top: 50%;
            left: 50%;
            width: 20px;
            height: 20px;
            background: #fff;
            clip-path: polygon(
                0 0, 0 70%, 25% 55%,
                45% 92%, 60% 84%,
                40% 50%, 70% 45%
            );
            filter:
                drop-shadow(0 0 6px rgba(239, 68, 68, 0.9))
                drop-shadow(0 1px 1px rgba(0, 0, 0, 0.7));
            pointer-events: none;
            transition:
                left 0.45s cubic-bezier(0.2, 0.8, 0.2, 1),
                top 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .breach-click-ripple {
            position: fixed;
            z-index: 1000000;
            width: 10px;
            height: 10px;
            border: 2px solid rgba(239, 68, 68, 0.85);
            border-radius: 50%;
            pointer-events: none;
            transform: translate(-50%, -50%) scale(0.4);
            opacity: 1;
            animation: breachRipple 0.5s ease-out forwards;
        }

        @keyframes breachRipple {
            0% {
                transform: translate(-50%, -50%) scale(0.4);
                opacity: 1;
            }
            100% {
                transform: translate(-50%, -50%) scale(3.2);
                opacity: 0;
            }
        }


        /* =================================================
           FAKE TREASURY HEIST PANEL
           ================================================= */

        .breach-heist {
            position: absolute;
            z-index: 5;
            left: 50%;
            bottom: 7%;
            transform: translateX(-50%);
            width: min(92vw, 380px);
            padding: 14px 18px;
            border: 1px solid rgba(239, 68, 68, 0.5);
            border-radius: 10px;
            background: rgba(10, 13, 15, 0.94);
            color: #ff9d9d;
            font-size: 11px;
            line-height: 1.6;
            box-shadow: 0 0 40px rgba(239, 68, 68, 0.3);
        }

        .breach-heist-title {
            font-weight: 700;
            letter-spacing: 0.6px;
            color: #ef4444;
            margin-bottom: 6px;
        }

        .breach-heist-balance {
            font-size: 21px;
            font-weight: 800;
            color: #fff;
            margin-bottom: 8px;
            transition: color 0.2s ease;
        }

        .breach-heist-balance.breach-heist-drop {
            color: #ef4444;
        }

        .breach-heist-line {
            opacity: 0.9;
        }


        /* =================================================
           GAME OVER
           ================================================= */

        #${GAME_OVER_ID} {
            position: fixed;
            inset: 0;
            z-index: 1000000;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background: #030405;
            opacity: 0;
            transition: opacity ${FADE_MS}ms ease;
        }

        #${GAME_OVER_ID}.breach-visible {
            opacity: 1;
        }

        #${GAME_OVER_ID} .game-over-bg {
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
            animation: gameOverDrift 7s linear infinite;
        }

        @keyframes gameOverDrift {
            0% { background-position: 0 0, 50% 45%; }
            100% { background-position: 0 480px, 50% 45%; }
        }

        #${GAME_OVER_ID} .game-over-bg::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            height: 2px;
            background: rgba(239, 68, 68, 0.55);
            box-shadow: 0 0 24px rgba(239, 68, 68, 0.85);
            animation: gameOverSweep 3.4s ease-in-out infinite;
        }

        @keyframes gameOverSweep {
            0% { top: -2px; }
            100% { top: 100%; }
        }

        #${GAME_OVER_ID} .game-over-content {
            position: relative;
            z-index: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 0 24px;
        }

        #${GAME_OVER_ID} .game-over-title {
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
            font-size: clamp(34px, 8vw, 68px);
            font-weight: 800;
            letter-spacing: 6px;
            color: #ef4444;
            text-shadow:
                0 0 24px rgba(239, 68, 68, 0.55),
                2px 0 #5ce1ff,
                -2px 0 #ff2fb0;
            min-height: 1.1em;
        }

        #${GAME_OVER_ID} .game-over-sub {
            margin-top: 18px;
            max-width: 420px;
            color: rgba(237, 245, 255, 0.6);
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
            font-size: 12px;
            line-height: 1.7;
            letter-spacing: 0.3px;
        }

        #${GAME_OVER_ID} .game-over-menu-btn {
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

        #${GAME_OVER_ID} .game-over-menu-btn:hover {
            background: rgba(239, 68, 68, 0.28);
            transform: translateY(-1px);
        }
    `;

    document.head.appendChild(style);
}


/* =====================================================
   TYPEWRITER
   ===================================================== */

function typeInto(targetEl, text, speedMs, onDone) {

    let index = 0;

    (function step() {

        if (index <= text.length) {

            targetEl.textContent = text.slice(0, index);

            index += 1;

            setTimeout(step, speedMs);

        } else if (typeof onDone === "function") {

            onDone();
        }

    })();
}


/* =====================================================
   SCRAMBLE-REVEAL (for the GAME OVER title)
   ===================================================== */

function scrambleReveal(el, finalText, durationMs, onDone) {

    const scrambleChars =
        "!<>-_\\/[]{}—=+*^?#01";

    const totalFrames =
        Math.max(10, Math.floor(durationMs / 40));

    let frame = 0;

    const timer = setInterval(() => {

        frame += 1;

        const revealCount =
            Math.floor((frame / totalFrames) * finalText.length);

        el.textContent =
            finalText
                .split("")
                .map((char, index) => {

                    if (char === " ") {
                        return " ";
                    }

                    return index < revealCount
                        ? char
                        : scrambleChars[
                        Math.floor(Math.random() * scrambleChars.length)
                        ];
                })
                .join("");

        if (frame >= totalFrames) {

            clearInterval(timer);

            el.textContent = finalText;

            if (typeof onDone === "function") {
                onDone();
            }
        }

    }, 40);
}


/* =====================================================
   GLITCH TEXT BURSTS
   ===================================================== */

function spawnGlitchBurst(overlay) {

    const el = document.createElement("div");

    el.className = "breach-glitch-text";

    el.textContent =
        GLITCH_MESSAGES[
            Math.floor(Math.random() * GLITCH_MESSAGES.length)
        ];

    el.style.left = `${10 + Math.random() * 70}%`;
    el.style.top = `${10 + Math.random() * 70}%`;

    const tilt =
        (Math.random() * 6 - 3).toFixed(1);

    el.style.transform =
        `translate(-50%, -50%) rotate(${tilt}deg)`;

    overlay.appendChild(el);

    setTimeout(() => el.remove(), 700);
}


/* =====================================================
   GLITCH-CLOSE EVERY OPEN WINDOW
   ---------------------------------------------------
   Reaches the desktop shell's own optional global API
   (window.SOCCommandCenter, exposed at the bottom of
   script.js) rather than reimplementing window
   management here. Each window visibly glitches for a
   beat before it actually slams shut, staggered so they
   don't all vanish in the same instant. Defensive — has
   to be safe to call even if that API isn't there.
   ===================================================== */

function glitchCloseAllWindows() {

    const api = window.SOCCommandCenter;

    if (!api || !api.state || !api.state.windows ||
        typeof api.closeWindow !== "function") {
        return;
    }

    const appIds =
        [...api.state.windows.keys()];

    appIds.forEach((appId, index) => {

        setTimeout(() => {

            const windowEl =
                typeof api.getWindowForApp === "function"
                    ? api.getWindowForApp(appId)
                    : null;

            if (windowEl) {
                windowEl.classList.add("breach-window-glitch");
            }

            setTimeout(() => {

                try {
                    api.closeWindow(appId);
                } catch (error) {
                    console.error(
                        "[BREACH CUTSCENE] Failed to close window:",
                        appId,
                        error
                    );
                }

            }, WINDOW_GLITCH_MS);

        }, index * 160);
    });

    const taskbar =
        document.querySelector(".taskbar");

    if (taskbar) {

        taskbar.classList.add("breach-taskbar-glitch");

        setTimeout(() => {
            taskbar.classList.remove("breach-taskbar-glitch");
        }, CHAOS_HOLD_MS);
    }
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
            console.error(
                "[BREACH CUTSCENE] Failed to close window:",
                appId,
                error
            );
        }
    });
}


/* =====================================================
   FAKE CURSOR — "someone else is driving"
   ---------------------------------------------------
   Hides the analyst's real cursor for the duration and
   drives a fake one around the whole screen on its own,
   occasionally "clicking" (a ripple where it lands) —
   the clearest possible signal that control of this
   machine isn't yours right now. Lives on document.body,
   not inside the overlay, so its own smooth movement
   isn't fighting the overlay's shake animation.
   Returns a cleanup function.
   ===================================================== */

function startFakeCursor() {

    const cursor =
        document.createElement("div");

    cursor.className = "breach-fake-cursor";

    document.body.appendChild(cursor);

    document.body.classList.add("breach-hide-cursor");

    const moveTimer = setInterval(() => {

        const xVw = 6 + Math.random() * 86;
        const yVh = 8 + Math.random() * 82;

        cursor.style.left = `${xVw}vw`;
        cursor.style.top = `${yVh}vh`;

        if (Math.random() < 0.55) {

            setTimeout(() => {
                spawnClickRipple(xVw, yVh);
            }, 460);
        }

    }, CURSOR_MOVE_INTERVAL_MS);

    return () => {
        clearInterval(moveTimer);
        cursor.remove();
        document.body.classList.remove("breach-hide-cursor");
    };
}


function spawnClickRipple(xVw, yVh) {

    const ripple =
        document.createElement("div");

    ripple.className = "breach-click-ripple";

    ripple.style.left = `${xVw}vw`;
    ripple.style.top = `${yVh}vh`;

    document.body.appendChild(ripple);

    setTimeout(() => ripple.remove(), 500);
}


/* =====================================================
   FAKE TREASURY HEIST
   ---------------------------------------------------
   The literal, credential-theft-specific consequence the
   flavor text kept alluding to: they didn't just look
   around, they used the exact same stolen login to move
   real company money out the door. A running balance that
   visibly drops as each transfer "completes" makes that
   concrete instead of abstract. Returns a cleanup function.
   ===================================================== */

function spawnBankingHeist(container) {

    let balance = 2450918;

    const panel =
        document.createElement("div");

    panel.className = "breach-heist";

    panel.innerHTML = `
        <div class="breach-heist-title">
            NORTHSTAR TREASURY — UNAUTHORIZED SESSION
        </div>
        <div class="breach-heist-balance">
            $${balance.toLocaleString()}.00
        </div>
        <div class="breach-heist-log"></div>
    `;

    container.appendChild(panel);

    const balanceEl =
        panel.querySelector(".breach-heist-balance");

    const logEl =
        panel.querySelector(".breach-heist-log");

    let index = 0;

    const timer = setInterval(() => {

        if (index >= HEIST_TRANSFERS.length) {
            clearInterval(timer);
            return;
        }

        const transfer =
            HEIST_TRANSFERS[index];

        index += 1;

        balance -= transfer.amount;

        const line =
            document.createElement("div");

        line.className = "breach-heist-line";

        line.textContent =
            `⤷ TRANSFER $${transfer.amount.toLocaleString()}.00 → ${transfer.dest} — COMPLETE`;

        logEl.appendChild(line);

        balanceEl.textContent =
            `$${Math.max(balance, 0).toLocaleString()}.00`;

        balanceEl.classList.add("breach-heist-drop");

        setTimeout(() => {
            balanceEl.classList.remove("breach-heist-drop");
        }, 300);

    }, HEIST_TRANSFER_INTERVAL_MS);

    return () => {
        clearInterval(timer);
        panel.remove();
    };
}


/* =====================================================
   GAME OVER SCREEN
   ===================================================== */

function showGameOverScreen() {

    if (document.getElementById(GAME_OVER_ID)) {
        return;
    }

    const screen =
        document.createElement("div");

    screen.id = GAME_OVER_ID;

    screen.innerHTML = `
        <div class="game-over-bg"></div>
        <div class="game-over-content">
            <div class="game-over-title" id="breach-game-over-title"></div>
            <div class="game-over-sub">
                Your credentials were compromised mid-investigation.
                The trail goes cold from here.
            </div>
            <button class="game-over-menu-btn" type="button">
                MAIN MENU
            </button>
        </div>
    `;

    document.body.appendChild(screen);

    requestAnimationFrame(() => {
        screen.classList.add("breach-visible");
    });

    const titleEl =
        screen.querySelector("#breach-game-over-title");

    scrambleReveal(titleEl, "GAME OVER", 900);

    const menuButton =
        screen.querySelector(".game-over-menu-btn");

    menuButton.addEventListener("click", () => {

        closeAllWindowsInstantly();

        screen.remove();

        if (typeof window.showMainMenu === "function") {
            window.showMainMenu();
        }
    });
}


/* =====================================================
   PLAY
   ===================================================== */

export function playCredentialBreachCutscene(username = "analyst") {

    if (document.getElementById(OVERLAY_ID)) {
        /* Already playing — don't stack a second one. */
        return;
    }

    ensureStyles();

    const overlay =
        document.createElement("div");

    overlay.id = OVERLAY_ID;

    overlay.innerHTML = `
        <div class="breach-flash"></div>
        <div class="breach-static"></div>
        <div class="breach-terminal">
            <div class="breach-line">C:\\NORTHSTAR\\LOGIN&gt; <span class="breach-user"></span><span class="breach-caret breach-caret-user"></span></div>
            <div class="breach-line">PASSWORD: <span class="breach-pass"></span><span class="breach-caret breach-caret-pass" style="display:none;"></span></div>
            <div class="breach-status"></div>
            <div class="breach-sub">Your NORTHSTAR credentials were just used to log in.</div>
        </div>
    `;

    document.body.appendChild(overlay);

    const userSpan = overlay.querySelector(".breach-user");
    const passSpan = overlay.querySelector(".breach-pass");
    const userCaret = overlay.querySelector(".breach-caret-user");
    const passCaret = overlay.querySelector(".breach-caret-pass");
    const statusEl = overlay.querySelector(".breach-status");

    typeInto(userSpan, username, TYPE_SPEED_MS, () => {

        userCaret.style.display = "none";
        passCaret.style.display = "inline-block";

        typeInto(passSpan, "••••••••••", TYPE_SPEED_MS, () => {

            passCaret.style.display = "none";

            statusEl.textContent = "ACCESS GRANTED";
            statusEl.classList.add("breach-granted");

            overlay.classList.add("breach-chaos");

            glitchCloseAllWindows();

            /*
             * Several independent chaos beats running at once
             * for the full CHAOS_HOLD_MS, not one quick flash —
             * a hijacked cursor clicking around on its own, real
             * money visibly leaving the company, windows
             * glitching shut on their own schedule, and glitch
             * text throughout. Each returns/needs its own
             * cleanup so nothing keeps running once Game Over
             * takes over.
             */
            const stopCursor =
                startFakeCursor();

            const stopHeist =
                spawnBankingHeist(overlay);

            const glitchTimer = setInterval(() => {
                spawnGlitchBurst(overlay);
            }, GLITCH_BURST_INTERVAL_MS);

            setTimeout(() => {

                clearInterval(glitchTimer);

                stopCursor();
                stopHeist();

                overlay.classList.remove("breach-chaos");
                overlay.classList.add("breach-fading");

                setTimeout(() => {

                    overlay.remove();

                    showGameOverScreen();

                }, FADE_MS);

            }, CHAOS_HOLD_MS);
        });
    });
}
