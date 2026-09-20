/* =========================================================
   NORTHSTAR SOC — VPN RENDERER
   File: vpn/VpnRenderer.js

   Two halves:
   - The personal-connection card at top (connect/disconnect,
     server picker, kill switch, auto-connect, telemetry) —
     the analyst's own VPN client. Flavor, not investigation.
   - COMPANY VPN ACTIVITY below it — the real, live company-
     wide VPN login/connection log (VpnEventBridge), the same
     data DetectionEngine's VPN-* rules already watch. This is
     the part that's actually investigable: spotting the same
     external IP authenticating as multiple different accounts,
     a known-attacker-IP login, or repeated failed logins.
   ========================================================= */

import { VPN_LOCATIONS } from "./data/vpnLocations.js";


export class VpnRenderer {

    constructor(container, store) {

        this.container = container;

        this.store = store;

        this.unsubscribe = null;

        this.boundClick =
            this.handleClick.bind(this);

        this.boundInput =
            this.handleInput.bind(this);
    }


    /* =====================================================
       MOUNT
       ===================================================== */

    mount() {

        if (!this.container) {
            return;
        }

        this.container.classList.add(
            "northstar-vpn"
        );

        this.container.innerHTML = "";

        this.container.addEventListener(
            "click",
            this.boundClick
        );

        this.container.addEventListener(
            "input",
            this.boundInput
        );

        /*
         * destroy() (below) stops the telemetry interval when
         * the window closes, but the store itself — and its
         * "connected" state — is a singleton that outlives the
         * window. Without this, reopening the app while still
         * "connected" would show frozen latency/throughput
         * numbers forever. startTelemetry() already clears any
         * previous interval first, so this is safe to call even
         * if it never actually stopped.
         */
        if (this.store.state.connected) {
            this.store.startTelemetry();
        }

        this.render();

        this.unsubscribe =
            this.store.subscribe(() => this.render());
    }


    destroy() {

        if (this.container) {

            this.container.removeEventListener(
                "click",
                this.boundClick
            );

            this.container.removeEventListener(
                "input",
                this.boundInput
            );
        }

        if (this.unsubscribe) {

            this.unsubscribe();

            this.unsubscribe = null;
        }

        this.store.destroy();
    }


    /* =====================================================
       ROOT
       ===================================================== */

    render() {

        const state =
            this.store.state;

        const location =
            state.selectedLocation;

        const duration =
            this.store.getSessionDuration();

        /*
         * .vpn-shell (below) is the scrollable element, and it
         * gets torn down and rebuilt from scratch on every
         * single render — including the ones nobody asked for,
         * like the 4s telemetry tick while connected. A brand
         * new DOM node starts at scrollTop 0, so without this
         * the page would silently snap back to the top a few
         * seconds after every scroll. Capture it before the
         * rebuild, restore it after.
         */
        const previousShell =
            this.container.querySelector(".vpn-shell");

        const scrollTop =
            previousShell ? previousShell.scrollTop : 0;


        this.container.innerHTML = `

            <div class="vpn-shell">

                <header class="vpn-topbar">

                    <div class="vpn-title-block">

                        <div class="vpn-title">
                            VPN
                        </div>

                        <div class="vpn-subtitle">
                            NORTHSTAR SECURE CONNECTION
                        </div>

                    </div>

                    <div class="vpn-header-badges">

                        <div class="
                            vpn-status-pill
                            ${state.connected
                ? "online"
                : "offline"}
                        ">

                            <span class="vpn-status-dot"></span>

                            ${state.connected
                ? "PROTECTED"
                : "NOT PROTECTED"}

                        </div>

                        <div
                            class="vpn-risk-pill ${this.store.getExposureRisk().toLowerCase()}"
                            title="${this.store.getExposureRisk() === "BREACHED"
                ? "Your credentials were already traced and used once this session."
                : "How easily your own investigative traffic could be traced back to you right now."}"
                        >
                            EXPOSURE: ${this.store.getExposureRisk() === "BREACHED"
                ? "COMPROMISED"
                : this.store.getExposureRisk()}
                        </div>

                    </div>

                </header>


                <main class="vpn-body">

                    ${this.renderIncidentBanner()}


                    <!-- ==================================
                         MAIN CONNECTION CARD
                         ================================== -->

                    <section class="
                        vpn-connection-card
                        ${state.connected
                ? "connected"
                : "disconnected"}
                    ">

                        <div class="
                            vpn-lock-wrapper
                            ${state.connected
                ? ""
                : "offline"}
                        ">

                            <div class="vpn-lock"></div>

                        </div>


                        <div class="vpn-connection-status">

                            ${state.connected
                ? "You are protected"
                : "You are not protected"}

                        </div>


                        <div class="
                            vpn-connection-description
                        ">

                            ${state.connected
                ? `Your connection is secured through
                                   ${this.escapeHtml(location.country)}.`
                : "Connect to secure your network traffic."}

                        </div>


                        <button
                            class="
                                vpn-toggle
                                ${state.connected
                ? "active"
                : ""}
                            "
                            data-action="toggle"
                            aria-label="Toggle VPN"
                        ></button>


                        <div class="vpn-toggle-label">

                            ${state.connected
                ? "VPN ON"
                : "VPN OFF"}

                        </div>

                    </section>



                    <!-- ==================================
                         CURRENT SERVER
                         ================================== -->

                    <section class="vpn-server-card">

                        <div class="vpn-server-left">

                            <div class="vpn-server-icon">
                                ◉
                            </div>

                            <div class="vpn-server-info">

                                <div class="vpn-server-label">
                                    VPN LOCATION
                                </div>

                                <div class="vpn-server-name">

                                    ${this.escapeHtml(
                    location.country
                )}

                                </div>

                                <div class="vpn-server-location">

                                    ${this.escapeHtml(
                    location.ip
                )}

                                </div>

                            </div>

                        </div>


                        <button
                            class="vpn-server-change"
                            data-action="change-location"
                        >
                            Change
                        </button>

                    </section>



                    <!-- ==================================
                         CONNECTION TELEMETRY
                         ================================== -->

                    <section class="vpn-info-cards">

                        ${this.infoCard(
                    "PROTOCOL",
                    state.protocol,
                    "Encrypted tunnel"
                )}

                        ${this.infoCard(
                    "LATENCY",
                    state.connected
                        ? `${state.latency} ms`
                        : "—",
                    state.connected
                        ? "Current connection"
                        : "Not connected"
                )}

                        ${this.infoCard(
                    "SESSION",
                    state.connected
                        ? this.formatDuration(duration)
                        : "—",
                    state.connected
                        ? "Connected time"
                        : "No active session"
                )}

                        ${this.infoCard(
                    "DOWNLOAD",
                    state.connected
                        ? `${state.download} Mbps`
                        : "—",
                    "Current throughput"
                )}

                        ${this.infoCard(
                    "UPLOAD",
                    state.connected
                        ? `${state.upload} Mbps`
                        : "—",
                    "Current throughput"
                )}

                        ${this.infoCard(
                    "SERVER",
                    "NORTHSTAR",
                    "Secure gateway"
                )}

                    </section>



                    <!-- ==================================
                         VPN CONTROLS
                         ================================== -->

                    <section class="vpn-features">


                        ${this.featureCard(
                    "Kill Switch",
                    "If a trace attempt starts landing, cut the tunnel instantly instead of letting your real traffic leak.",
                    state.killSwitch,
                    "kill-switch"
                )}


                        ${this.featureCard(
                    "Auto-Connect",
                    "Connect automatically when NORTHSTAR starts.",
                    state.autoConnect,
                    "auto-connect"
                )}


                    </section>



                    <!-- ==================================
                         RECENT CONNECTIONS
                         ================================== -->

                    <section class="
                        vpn-connection-details
                    ">

                        <div class="vpn-details-title">
                            RECENT CONNECTIONS
                        </div>

                        ${this.renderHistory()}

                    </section>



                    <!-- ==================================
                         COMPANY VPN ACTIVITY (real log)
                         ================================== -->

                    <section class="vpn-activity-log">

                        <div class="vpn-activity-header">

                            <div>
                                <div class="vpn-details-title">
                                    COMPANY VPN ACTIVITY
                                </div>
                                <div class="vpn-activity-sub">
                                    Every employee's VPN logins — not just yours. The same
                                    external IP authenticating as several different accounts
                                    is the tell.
                                </div>
                            </div>

                            <div class="vpn-activity-search">
                                <span class="vpn-activity-search-icon">⌕</span>
                                <input
                                    class="vpn-log-search-input"
                                    type="search"
                                    placeholder="Search user, IP, country..."
                                    value="${this.escapeHtml(this.store.state.logSearchQuery)}"
                                    autocomplete="off"
                                >
                            </div>

                        </div>

                        ${this.renderActivityLog()}

                    </section>



                    <!-- ==================================
                         TRACE RISK DIAGRAM
                         ================================== -->

                    ${this.renderTraceDiagram()}


                </main>

            </div>
        `;

        if (scrollTop) {

            const freshShell =
                this.container.querySelector(".vpn-shell");

            if (freshShell) {
                freshShell.scrollTop = scrollTop;
            }
        }
    }


    /* =====================================================
       INCIDENT BANNER
       ---------------------------------------------------
       The only real-time feedback for a trace attempt —
       everything else about it (score, history) is silent
       by design, same as the rest of this build. But "you
       got caught" should say something rather than only
       ever showing up as a line in Recent Connections.

       Every trace CHECK shows one of these the instant the
       marker in the trace diagram reaches you — not just the
       ones that catch you. Most checks come back "safe" (that's
       the entire point of getting your risk down to LOW/MEDIUM),
       so without a "safe" banner too the diagram's marker would
       visibly arrive and nothing would happen most of the time,
       which reads as broken rather than as good OPSEC. The
       "safe" kind auto-dismisses itself after a few seconds
       (see VpnStore.setIncident); "exposed"/"blocked" stick
       around until the player dismisses them.
       ===================================================== */

    renderIncidentBanner() {

        const incident =
            this.store.state.lastIncident;

        if (!incident) {
            return "";
        }

        const icons = {
            blocked: "◆",
            exposed: "!",
            safe: "✓"
        };

        return `
            <div class="vpn-incident-banner ${incident.kind}">

                <span class="vpn-incident-icon">
                    ${icons[incident.kind] || "!"}
                </span>

                <span class="vpn-incident-message">
                    ${this.escapeHtml(incident.message)}
                </span>

                <button
                    class="vpn-incident-dismiss"
                    data-action="dismiss-incident"
                    aria-label="Dismiss"
                >
                    ×
                </button>

            </div>
        `;
    }


    /* =====================================================
       COMPANY VPN ACTIVITY LOG
       ===================================================== */

    renderActivityLog() {

        const events =
            this.store.getVisibleVpnEvents();

        if (!events.length) {

            const hasAny =
                this.store.getVpnEvents().length > 0;

            return `
                <div class="vpn-empty">
                    ${hasAny
                    ? "No activity matches that search."
                    : "No VPN activity recorded yet this session."}
                </div>
            `;
        }

        return `
            <div class="vpn-log-table">

                <div class="vpn-log-row vpn-log-header">
                    <span>TYPE</span>
                    <span>USER</span>
                    <span>SOURCE IP</span>
                    <span>COUNTRY</span>
                    <span>TIME</span>
                    <span>FLAG</span>
                </div>

                ${events.map(event => {

                    const flagged =
                        this.store.isFlaggedVpnEvent(event);

                    return `
                        <div class="vpn-log-row ${flagged ? "flagged" : ""}">
                            <span>${this.escapeHtml((event.eventType || "").replace(/_/g, " "))}</span>
                            <span>${this.escapeHtml(event.username || "—")}</span>
                            <span class="vpn-mono">${this.escapeHtml(event.sourceIP || "—")}</span>
                            <span>${this.escapeHtml(event.sourceCountry || "—")}</span>
                            <span>${this.formatFullTime(event.timestamp)}</span>
                            <span>${flagged ? `<span class="vpn-flag">ALERT</span>` : "—"}</span>
                        </div>
                    `;
                }).join("")}

            </div>
        `;
    }


    /* =====================================================
       TRACE RISK DIAGRAM
       ---------------------------------------------------
       A rough, at-a-glance read on how much time is left
       before the next trace attempt against YOUR OWN
       connection — not the case data. Purely a reflection of
       state.cycleStartedAt/cycleDurationMs (set by the store's
       resyncExposureCycle()) plus the already-visible EXPOSURE
       pill, so it can't leak anything about the investigation
       itself, only about the analyst's own OPSEC right now.

       The marker's motion is a plain CSS animation driven by
       animation-duration + a NEGATIVE animation-delay computed
       fresh from elapsed time on every render. That lets a
       freshly re-created DOM node (this whole panel is rebuilt
       on every store notification) resume the animation exactly
       where it should be, with no JS ticker of its own to drift
       out of sync with the real countdown.

       When a trace actually lands, the attacker side gets a
       real, visible reaction — a speech-bubble taunt over the
       attacker icon (see ATTACKER_TAUNTS in VpnStore) — instead
       of the consequence being only a score number. It fades
       itself out with the same negative-delay trick, timed off
       lastIncident.timestamp, so it survives re-renders without
       its own ticker too.
       ===================================================== */

    renderTraceDiagram() {

        const state =
            this.store.state;

        const risk =
            this.store.getExposureRisk();

        const duration =
            state.cycleDurationMs || 15000;

        const elapsed =
            state.cycleStartedAt
                ? Date.now() - state.cycleStartedAt
                : 0;

        const clampedElapsed =
            Math.max(0, Math.min(elapsed, duration));

        const riskCopy = {
            HIGH: "No protection at all — a trace attempt could land any moment.",
            MEDIUM: "Protected, but routed through the same country as the case — still an easy target.",
            LOW: "Protected and routed well clear of home turf — hard to pin down right now.",
            BREACHED: "Your credentials were already traced and used once this session — there's nothing left to count down to."
        };

        const isBreached =
            risk === "BREACHED";

        const incident =
            state.lastIncident;

        const TAUNT_DURATION_MS = 6000;

        const showTaunt =
            !!(incident &&
                incident.kind === "exposed" &&
                incident.attackerMessage);

        const tauntElapsed =
            showTaunt
                ? Date.now() - incident.timestamp
                : 0;

        const attackerCaught =
            showTaunt && tauntElapsed < TAUNT_DURATION_MS;

        return `

            <section class="vpn-trace-diagram">

                <div class="vpn-details-title">
                    TRACE RISK
                </div>

                <div class="vpn-trace-sub">
                    ${isBreached
                ? "This already happened once this session — it isn't going to happen again."
                : "A rough sense of how long you have before someone tries to trace this connection back to you."}
                </div>

                <div class="vpn-trace-track-wrapper">

                    <div class="vpn-trace-endpoint ${attackerCaught ? "alerted" : ""}">

                        <span class="vpn-trace-icon">🖥️</span>
                        <span class="vpn-trace-label">UNKNOWN</span>

                        ${showTaunt ? `
                            <div
                                class="vpn-trace-taunt"
                                style="animation-duration: ${TAUNT_DURATION_MS}ms; animation-delay: -${tauntElapsed}ms;"
                            >
                                “${this.escapeHtml(incident.attackerMessage)}”
                            </div>
                        ` : ""}

                    </div>

                    <div class="vpn-trace-track ${risk.toLowerCase()}">

                        <div class="vpn-trace-track-line"></div>

                        ${isBreached ? `
                            <div class="vpn-trace-marker breached parked">
                                🔓
                            </div>
                        ` : `
                            <div
                                class="vpn-trace-marker ${risk.toLowerCase()}"
                                style="animation-duration: ${duration}ms; animation-delay: -${clampedElapsed}ms;"
                            >
                                📡
                            </div>
                        `}

                    </div>

                    <div class="vpn-trace-endpoint you">
                        <span class="vpn-trace-icon">🛡️</span>
                        <span class="vpn-trace-label">YOU</span>
                    </div>

                </div>

                <div class="vpn-trace-note ${risk.toLowerCase()}">
                    ${riskCopy[risk] || ""}
                </div>

            </section>
        `;
    }


    /* =====================================================
       INFO CARD
       ===================================================== */

    infoCard(label, value, sub) {

        return `

            <div class="vpn-info-card">

                <div class="vpn-info-card-label">
                    ${label}
                </div>

                <div class="vpn-info-card-value">
                    ${this.escapeHtml(value)}
                </div>

                <div class="vpn-info-card-sub">
                    ${this.escapeHtml(sub)}
                </div>

            </div>
        `;
    }


    /* =====================================================
       FEATURE CARD
       ===================================================== */

    featureCard(
        title,
        description,
        enabled,
        action
    ) {

        return `

            <div class="vpn-feature-card">

                <div class="vpn-feature-icon">

                    ${action === "kill-switch"
                ? "◆"
                : "↻"}

                </div>

                <div class="vpn-feature-content">

                    <div class="vpn-feature-title">
                        ${title}
                    </div>

                    <div class="
                        vpn-feature-description
                    ">
                        ${description}
                    </div>

                </div>

                <button
                    class="
                        vpn-feature-toggle
                        ${enabled ? "active" : ""}
                    "
                    data-action="${action}"
                    aria-label="${title}"
                ></button>

            </div>
        `;
    }


    /* =====================================================
       HISTORY
       ===================================================== */

    renderHistory() {

        const history =
            this.store.state.connectionHistory;

        if (!history.length) {

            return `
                <div class="vpn-empty">
                    No recent VPN connections.
                </div>
            `;
        }


        return history.map(entry => {

            const date =
                new Date(entry.timestamp);

            const isWarning =
                entry.type.startsWith("EXPOSURE") ||
                entry.type.startsWith("KILL SWITCH");

            return `

                <div class="vpn-detail-item ${isWarning ? "warning" : ""}">

                    <span class="vpn-detail-label">

                        ${this.escapeHtml(
                entry.type
            )}

                    </span>

                    <span class="vpn-detail-value">

                        ${this.escapeHtml(
                entry.country
            )}

                        ·

                        ${this.escapeHtml(
                entry.ip
            )}

                        ·

                        ${date.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit"
            })}

                    </span>

                </div>

            `;

        }).join("");
    }


    /* =====================================================
       CLICK HANDLER
       ===================================================== */

    handleClick(event) {

        const action =
            event.target.closest(
                "[data-action]"
            );

        if (!action) {
            return;
        }


        switch (action.dataset.action) {

            case "toggle":

                this.store.toggleConnection();

                break;


            case "kill-switch":

                this.store.setKillSwitch(
                    !this.store.state.killSwitch
                );

                break;


            case "auto-connect":

                this.store.setAutoConnect(
                    !this.store.state.autoConnect
                );

                break;


            case "change-location":

                this.showLocationPicker();

                break;


            case "dismiss-incident":

                this.store.dismissIncident();

                break;
        }
    }


    /* =====================================================
       INPUT HANDLING
       ===================================================== */

    handleInput(event) {

        if (!event.target.classList.contains("vpn-log-search-input")) {
            return;
        }

        /*
         * setLogSearchQuery() notifies the store, which
         * re-renders the whole panel so the activity log can
         * filter live as you type. That replaces the <input>
         * DOM node, which would otherwise drop focus and reset
         * the cursor after every keystroke. Capture the cursor
         * position first and restore it on the fresh input.
         */
        const cursorPosition =
            event.target.selectionStart;

        this.store.setLogSearchQuery(event.target.value);

        const refreshedInput =
            this.container.querySelector(".vpn-log-search-input");

        if (refreshedInput) {

            refreshedInput.focus();

            refreshedInput.setSelectionRange(
                cursorPosition,
                cursorPosition
            );
        }
    }


    /* =====================================================
       LOCATION PICKER
       ===================================================== */

    showLocationPicker() {

        const current =
            this.store.state.selectedLocation;


        const choices =
            VPN_LOCATIONS
                .map((location, index) => `

                    <button
                        class="vpn-location-option"
                        data-location-index="${index}"
                    >

                        <span>
                            ${this.escapeHtml(
                    location.country
                )}
                        </span>

                        <small>
                            ${this.escapeHtml(
                    location.ip
                )}
                        </small>

                    </button>

                `)
                .join("");


        const overlay =
            document.createElement("div");

        overlay.className =
            "vpn-location-overlay";


        overlay.innerHTML = `

            <div class="vpn-location-modal">

                <div class="vpn-location-header">

                    <div>
                        <div class="vpn-location-title">
                            Choose VPN Location
                        </div>

                        <div class="vpn-location-subtitle">
                            Select a secure NORTHSTAR gateway.
                        </div>
                    </div>

                    <button
                        class="vpn-location-close"
                        data-location-close
                    >
                        ×
                    </button>

                </div>


                <div class="vpn-location-list">

                    ${choices}

                </div>

            </div>
        `;


        this.container.appendChild(overlay);


        overlay.addEventListener(
            "click",
            event => {

                if (
                    event.target.matches(
                        "[data-location-close]"
                    ) ||
                    event.target === overlay
                ) {

                    overlay.remove();

                    return;
                }


                const option =
                    event.target.closest(
                        "[data-location-index]"
                    );

                if (!option) {
                    return;
                }


                const index =
                    Number(
                        option.dataset.locationIndex
                    );


                const location =
                    VPN_LOCATIONS[index];


                if (location) {

                    this.store.setLocation(
                        location
                    );
                }


                overlay.remove();
            }
        );
    }


    /* =====================================================
       FORMATTERS
       ===================================================== */

    formatDuration(ms) {

        if (!ms || ms < 0) {
            return "0s";
        }


        const seconds =
            Math.floor(ms / 1000);


        const minutes =
            Math.floor(seconds / 60);


        const hours =
            Math.floor(minutes / 60);


        if (hours > 0) {

            return `${hours}h ${minutes % 60}m`;
        }


        if (minutes > 0) {

            return `${minutes}m ${seconds % 60}s`;
        }


        return `${seconds}s`;
    }


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
       SECURITY
       ===================================================== */

    escapeHtml(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
}