/* =========================================================
   NORTHSTAR SOC COMMAND CENTER
   DESKTOP + WINDOW MANAGER + SECURITY APPLICATIONS
   ========================================================= */

/*
    EXPECTED HTML ELEMENTS
    ---------------------------------------------------------
    #boot-screen
    #desktop
    #boot-progress
    #boot-status-text
    #start-button
    #start-menu
    #context-menu
    #clock-time
    #clock-date
    .taskbar-apps

    OPTIONAL GLOBAL ENGINES
    ---------------------------------------------------------
    window.eventEngine
    window.alertManager
    window.networkStore
    window.packetEngine
    window.networkInvestigator
    window.PacketParser
    window.attackEngine

    This file is designed to work even when some engines
    are not loaded yet.
*/


/* =========================================================
   GLOBAL STATE
   ========================================================= */
import { initializeMail } from "./mail/MailApp.js";
import { THREAT_SOURCES } from "./data/threatSources.js";
import { ATTACKERS } from "./engine/AttackEngine.js";
import { initializeEndpoints } from "./endpoints/EndpointApp.js";
import { initializeVpn } from "./vpn/VpnApp.js";
import { initializeFileExplorer } from "./files/FileExplorerApp.js";
import { initializePlaybook } from "./playbook/PlaybookApp.js";
import { initializePasswordCracker } from "./password-cracker/PasswordCrackerApp.js";
import { initializeThreatIntel } from "./threat-intel/ThreatIntelApp.js";
import { initializeIAM } from "./iam/IAMApp.js";
import { initializeMalwareSandbox } from "./malware-sandbox/MalwareSandboxApp.js";
import { USERS } from "./data/users.js";
import { HOSTS } from "./data/hosts.js";
import { VPN_COUNTRY_COORDS } from "./vpn/data/vpnLocations.js";

/*
 * ThreatIntelData.js is a plain script (not an ES module), so
 * it can't `import { ATTACKERS }` itself — this is how it
 * gets access to the real attacker roster instead of using a
 * disconnected hardcoded list.
 */
window.NorthstarRealAttackers = ATTACKERS;

/*
 * Same reason — IAMApp.js's loadUsers() checks window.USERS
 * (among a few other names) since it isn't an ES module
 * either. Without this it always finds an empty roster.
 */
window.USERS = USERS;

/*
 * Lets IAM cross-reference a user's assigned host against the
 * REAL live compromise state, so a privileged account that's
 * actually been compromised this session can be flagged —
 * distinct from its static, session-independent review flags.
 */
window.NorthstarHosts = HOSTS;

const SOC = {

    windows: new Map(),

    highestZIndex: 100,

    taskbarButtons: new Map(),

    /*
     * appId -> whatever initializeX() returned. Populated in
     * loadApplication(), consumed in closeWindow() so a real
     * .destroy() actually gets called instead of just
     * removing the DOM and leaking any document/window-level
     * listeners the app registered (e.g. Password Cracker's
     * document click listener).
     */
    appInstances: new Map(),

    bootComplete: false,

    clockInterval: null,

    bootInterval: null,

    windowOffset: 0,

    initialized: false

};


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const bootScreen =
    document.getElementById("boot-screen");

const desktop =
    document.getElementById("desktop");

const bootProgress =
    document.getElementById("boot-progress");

const bootStatus =
    document.getElementById("boot-status-text");

const startButton =
    document.getElementById("start-button");

const startMenu =
    document.getElementById("start-menu");

const contextMenu =
    document.getElementById("context-menu");

const clockTime =
    document.getElementById("clock-time");

const clockDate =
    document.getElementById("clock-date");


/* =========================================================
   APPLICATION DEFINITIONS
   ========================================================= */

const applications = {

    siem: {
        title: "SIEM",
        icon: "▤",
        description: "Security event monitoring and correlation"
    },

    alerts: {
        title: "Alerts",
        icon: "!",
        description: "Security detection queue"
    },

    network: {
        title: "Network",
        icon: "⌁",
        description: "Packet capture and network investigation"
    },

    map: {
        title: "Attack Map",
        icon: "◎",
        description: "Threat activity visualization"
    },

    email: {
        title: "Mail",
        icon: "✉",
        description: "Email and phishing investigation"
    },

    hosts: {
        title: "Endpoints",
        icon: "▣",
        description: "Endpoint security monitoring"
    },

    vpn: {
        title: "VPN",
        icon: "🔒",
        description: "Remote access monitoring"
    },

    files: {
        title: "File Explorer",
        icon: "📁",
        description: "Your files and folders"
    },

    playbook: {
        title: "IR Playbook",
        icon: "📖",
        description: "Incident response reference and reporting"
    },

    cracker: {
        title: "Password Cracker",
        icon: "🔓",
        description: "Simulated credential recovery console"
    },

    intel: {
        title: "Threat Intel",
        icon: "🔎",
        description: "Query indicators discovered during investigation"
    },

    iam: {
        title: "IAM",
        icon: "🪪",
        description: "Identity and access review"
    },

    sandbox: {
        title: "Malware Sandbox",
        icon: "🧪",
        description: "Dynamic analysis of files found during investigation"
    },

    terminal: {
        title: "Terminal",
        icon: ">_",
        description: "SOC command terminal"
    }

};


/* =========================================================
   SAFE ENGINE HELPERS
   ========================================================= */

function getEventEngine() {

    return (
        window.eventEngine ||
        null
    );

}


function getAlertManager() {

    return (
        window.alertManager ||
        null
    );

}


function getNetworkStore() {

    return (
        window.networkStore ||
        null
    );

}


function getPacketEngine() {

    return (
        window.packetEngine ||
        null
    );

}


function getNetworkInvestigator() {

    return (
        window.networkInvestigator ||
        null
    );

}


function getPacketParser() {

    return (
        window.PacketParser ||
        null
    );

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {

    return String(value ?? "")

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================================
   BOOT SEQUENCE
   ========================================================= */

function startBootSequence() {

    if (!bootScreen) {

        showDesktop();

        return;

    }


    const bootMessages = [

        "Initializing secure environment...",

        "Loading SOC workstation...",

        "Mounting encrypted workspace...",

        "Initializing network interfaces...",

        "Loading security services...",

        "Checking endpoint protection...",

        "Starting analyst environment...",

        "System ready."

    ];


    const bootLog =
        document.getElementById("boot-log");

    const bootPercent =
        document.getElementById("boot-progress-percent");


    /*
     * appendBootLine() replaces the old single-line
     * bootStatus.textContent swap with a small stacked
     * terminal log (same visual convention as
     * ScenarioBriefing.js's incoming-alert terminal) — the
     * previously-active line gets marked done (✓) and the new
     * one becomes the active line (▸). bootStatus (the legacy
     * #boot-status-text span) is kept in sync too, hidden via
     * CSS, purely so nothing else that might still read it
     * ever sees a stale value.
     */
    function appendBootLine(text, isFinal) {

        if (bootStatus) {
            bootStatus.textContent = text;
        }

        if (!bootLog) {
            return;
        }

        const previousActive =
            bootLog.querySelector(".boot-log-line-active");

        if (previousActive) {

            previousActive.classList.remove(
                "boot-log-line-active"
            );

            previousActive.classList.add(
                "boot-log-line-done"
            );

        }

        const line =
            document.createElement("div");

        line.className =
            "boot-log-line" +
            (isFinal ? " boot-log-line-final" : " boot-log-line-active");

        line.textContent = text;

        bootLog.appendChild(line);

        bootLog.scrollTop =
            bootLog.scrollHeight;

    }


    let step = 0;


    if (bootProgress) {

        bootProgress.style.width = "0%";

    }

    if (bootPercent) {

        bootPercent.textContent = "0%";

    }

    if (bootLog) {

        bootLog.innerHTML = "";

    }


    appendBootLine(bootMessages[0], false);


    SOC.bootInterval =
        setInterval(
            () => {

                step++;


                const progress =
                    Math.min(
                        100,
                        Math.round(
                            (
                                step /
                                bootMessages.length
                            ) * 100
                        )
                    );


                if (bootProgress) {

                    bootProgress.style.width =
                        `${progress}%`;

                }

                if (bootPercent) {

                    bootPercent.textContent =
                        `${progress}%`;

                }


                if (
                    step <
                    bootMessages.length
                ) {

                    appendBootLine(
                        bootMessages[step],
                        step === bootMessages.length - 1
                    );

                    return;

                }


                const finalActive =
                    bootLog?.querySelector(".boot-log-line-active");

                if (finalActive) {

                    finalActive.classList.remove(
                        "boot-log-line-active"
                    );

                    finalActive.classList.add(
                        "boot-log-line-done"
                    );

                }


                clearInterval(
                    SOC.bootInterval
                );


                setTimeout(
                    showMainMenu,
                    500
                );

            },
            350
        );

}


/* =========================================================
   SHOW MAIN MENU
   ========================================================= */

function showMainMenu() {

    SOC.bootComplete = true;


    if (bootScreen) {

        bootScreen.classList.add(
            "hidden"
        );

    }


    if (desktop) {

        desktop.classList.remove(
            "visible"
        );

    }


    /*
     * A brand-new operation (Start Operation / a scenario card /
     * Free Operations) reloads the whole page to guarantee every
     * simulation store comes back genuinely fresh — see
     * MainMenu.js's beginNewOperation(). That reload lands right
     * back here, at the normal boot sequence's end, so check for
     * the pending flag first and route straight into the chosen
     * scenario instead of showing the Main Menu at all.
     */

    let pendingScenario = null;

    try {

        if (
            localStorage.getItem(
                "northstar-pending-new-operation"
            )
        ) {

            pendingScenario =
                localStorage.getItem(
                    "northstar-selected-scenario"
                );

        }

    } catch (error) {

        pendingScenario = null;

    }


    if (pendingScenario) {

        try {

            localStorage.removeItem(
                "northstar-pending-new-operation"
            );

        } catch (error) {

            /* Nothing else to do if storage is unavailable. */

        }


        if (
            window.NorthstarMainMenu &&
            typeof window.NorthstarMainMenu.launchPendingOperation ===
            "function"
        ) {

            window.NorthstarMainMenu.launchPendingOperation(
                pendingScenario
            );

            return;

        }

    }


    if (
        window.NorthstarMainMenu &&
        typeof window.NorthstarMainMenu.show ===
        "function"
    ) {

        window.NorthstarMainMenu.show();

        return;

    }


    /*
     * Fallback if MainMenu.js failed to load.
     */

    showDesktop();

}


/* =========================================================
   SHOW DESKTOP
   ========================================================= */

function showDesktop() {

    if (
        window.NorthstarMainMenu &&
        typeof window.NorthstarMainMenu.hide ===
        "function"
    ) {

        window.NorthstarMainMenu.hide();

    }


    SOC.bootComplete = true;


    if (bootScreen) {

        bootScreen.classList.add(
            "hidden"
        );

    }


    if (desktop) {

        desktop.classList.add(
            "visible"
        );

    }


    if (
        window.NorthstarMissionTimer &&
        typeof window.NorthstarMissionTimer.start ===
        "function"
    ) {

        window.NorthstarMissionTimer.start();

    }

}

window.showDesktop = showDesktop;
window.showMainMenu = showMainMenu;
/* =========================================================
   CLOCK
   ========================================================= */

function updateClock() {

    const now =
        new Date();


    let hours =
        now.getHours();


    const minutes =
        String(
            now.getMinutes()
        ).padStart(
            2,
            "0"
        );


    const seconds =
        String(
            now.getSeconds()
        ).padStart(
            2,
            "0"
        );


    const ampm =
        hours >= 12
            ? "PM"
            : "AM";


    hours =
        hours % 12 || 12;


    if (clockTime) {

        clockTime.textContent =
            `${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;

    }


    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );


    const year =
        now.getFullYear();


    if (clockDate) {

        clockDate.textContent =
            `${month}/${day}/${year}`;

    }

}


function startClock() {

    updateClock();


    if (SOC.clockInterval) {

        clearInterval(
            SOC.clockInterval
        );

    }


    SOC.clockInterval =
        setInterval(
            updateClock,
            1000
        );

}


/* =========================================================
   START MENU
   ========================================================= */

function toggleStartMenu() {

    if (!startMenu) return;


    startMenu.classList.toggle(
        "hidden"
    );

}


function closeStartMenu() {

    if (!startMenu) return;


    startMenu.classList.add(
        "hidden"
    );

}


/* =========================================================
   CONTEXT MENU
   ========================================================= */

function closeContextMenu() {

    if (!contextMenu) return;


    contextMenu.classList.add(
        "hidden"
    );

}


function showContextMenu(
    x,
    y
) {

    if (!contextMenu) return;


    const menuWidth =
        contextMenu.offsetWidth || 200;


    const menuHeight =
        contextMenu.offsetHeight || 150;


    const safeX =
        Math.min(
            x,
            window.innerWidth -
            menuWidth -
            5
        );


    const safeY =
        Math.min(
            y,
            window.innerHeight -
            menuHeight -
            5
        );


    contextMenu.style.left =
        `${Math.max(5, safeX)}px`;


    contextMenu.style.top =
        `${Math.max(5, safeY)}px`;


    contextMenu.classList.remove(
        "hidden"
    );

}


/* =========================================================
   WINDOW ID
   ========================================================= */

function getWindowForApp(
    appId
) {

    return SOC.windows.get(
        appId
    ) || null;

}


/* =========================================================
   OPEN APPLICATION
   ========================================================= */

function openApplication(
    appId
) {

    const app =
        applications[appId];


    if (!app) {

        console.warn(
            `[SOC] Unknown application: ${appId}`
        );

        return null;

    }


    /* -----------------------------------------------------
       Existing window
       ----------------------------------------------------- */

    const existing =
        getWindowForApp(
            appId
        );


    if (existing) {

        restoreWindow(
            existing
        );

        focusWindow(
            existing
        );

        return existing;

    }


    /* -----------------------------------------------------
       Desktop required
       ----------------------------------------------------- */

    if (!desktop) {

        console.error(
            "[SOC] Desktop element not found."
        );

        return null;

    }


    /* -----------------------------------------------------
       Create window
       ----------------------------------------------------- */

    const windowElement =
        document.createElement(
            "section"
        );


    windowElement.className =
        "app-window";


    windowElement.dataset.app =
        appId;


    windowElement.dataset.windowId =
        `${appId}-${Date.now()}`;


    windowElement.style.zIndex =
        ++SOC.highestZIndex;


    windowElement.innerHTML = `

        <div class="window-titlebar">

            <div class="window-title">

                <span class="window-icon">
                    ${escapeHTML(app.icon)}
                </span>

                <span class="window-title-text">
                    ${escapeHTML(app.title)}
                </span>

            </div>


            <div class="window-controls">

                <button
                    type="button"
                    class="window-button minimize"
                    title="Minimize"
                    aria-label="Minimize"
                >
                    −
                </button>


                <button
                    type="button"
                    class="window-button maximize"
                    title="Maximize"
                    aria-label="Maximize"
                >
                    □
                </button>


                <button
                    type="button"
                    class="window-button close"
                    title="Close"
                    aria-label="Close"
                >
                    ×
                </button>

            </div>

        </div>


        <div class="window-content"></div>


        <div
            class="window-resize-handle resize-nw"
            data-resize="nw"
        ></div>

        <div
            class="window-resize-handle resize-n"
            data-resize="n"
        ></div>

        <div
            class="window-resize-handle resize-ne"
            data-resize="ne"
        ></div>

        <div
            class="window-resize-handle resize-w"
            data-resize="w"
        ></div>

        <div
            class="window-resize-handle resize-e"
            data-resize="e"
        ></div>

        <div
            class="window-resize-handle resize-sw"
            data-resize="sw"
        ></div>

        <div
            class="window-resize-handle resize-s"
            data-resize="s"
        ></div>

        <div
            class="window-resize-handle resize-se"
            data-resize="se"
        ></div>

    `;


    desktop.appendChild(
        windowElement
    );


    SOC.windows.set(
        appId,
        windowElement
    );


    /* -----------------------------------------------------
       Initial position
       ----------------------------------------------------- */

    SOC.windowOffset =
        (
            SOC.windowOffset + 28
        ) % 220;


    windowElement.style.left =
        `${100 + SOC.windowOffset}px`;


    windowElement.style.top =
        `${60 + SOC.windowOffset}px`;


    windowElement.style.width =
        "900px";


    windowElement.style.height =
        "600px";


    /* -----------------------------------------------------
       Controls
       ----------------------------------------------------- */

    const minimizeButton =
        windowElement.querySelector(
            ".minimize"
        );


    const maximizeButton =
        windowElement.querySelector(
            ".maximize"
        );


    const closeButton =
        windowElement.querySelector(
            ".close"
        );


    if (minimizeButton) {

        minimizeButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                minimizeWindow(
                    windowElement
                );

            }
        );

    }


    if (maximizeButton) {

        maximizeButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                maximizeWindow(
                    windowElement
                );

            }
        );

    }


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                closeWindow(
                    appId
                );

            }
        );

    }


    /* -----------------------------------------------------
       Focus
       ----------------------------------------------------- */

    windowElement.addEventListener(
        "mousedown",
        () => {

            focusWindow(
                windowElement
            );

        }
    );


    /* -----------------------------------------------------
       Drag / resize
       ----------------------------------------------------- */

    enableWindowDragging(
        windowElement
    );


    enableWindowResizing(
        windowElement
    );


    /* -----------------------------------------------------
       Application
       ----------------------------------------------------- */

    loadApplication(
        appId,
        windowElement
    );


    /* -----------------------------------------------------
       Taskbar
       ----------------------------------------------------- */

    syncTaskbar();


    focusWindow(
        windowElement
    );


    return windowElement;

}
window.openApplication = openApplication;


/* =========================================================
   LOAD APPLICATION
   ========================================================= */

function loadApplication(
    appId,
    windowElement
) {

    const content =
        windowElement.querySelector(
            ".window-content"
        );


    if (!content) return;


    let instance = null;


    switch (appId) {

        case "siem":

            initializeSIEM(
                content
            );

            break;


        case "alerts":

            initializeAlerts(
                content
            );

            break;


        case "network":
            if (
                typeof window.initializeNetwork ===
                "function"
            ) {
                window.initializeNetwork(
                    content
                );
            } else {
                console.error(
                    "[NETWORK] NetworkApp.js initializer unavailable."
                );
            }
            break;


        case "map":

            initializeAttackMap(
                content
            );

            break;

        case "email":

            instance = initializeMail(
                content,
                { store: window.mailStore }
            );

            break;

        case "hosts":

            instance = initializeEndpoints(content, { store: window.endpointStore });

            break;


        case "vpn":

            instance = initializeVpn(content, { store: window.vpnStore });

            break;


        case "files":

            instance = initializeFileExplorer(content, { store: window.fileExplorerStore });

            break;


        case "playbook":

            instance = initializePlaybook(content, { store: window.playbookStore });

            break;


        case "cracker":

            instance = initializePasswordCracker(content);

            break;


        case "intel":

            instance = initializeThreatIntel(content);

            break;


        case "iam":

            instance = initializeIAM(content);

            break;


        case "sandbox":

            instance = initializeMalwareSandbox(content);

            break;


        case "terminal":

            initializeTerminal(
                content
            );

            break;


        default:

            initializePlaceholder(
                content,
                appId
            );

    }


    /*
     * Only apps that actually return a destroyable instance
     * get tracked — SIEM/Alerts/Network/Map/Terminal don't
     * attach anything outside their own container, so there's
     * nothing for them to leak and nothing to store.
     */

    if (
        instance &&
        typeof instance.destroy === "function"
    ) {

        SOC.appInstances.set(appId, instance);
    }

}


/* =========================================================
   PLACEHOLDER
   ========================================================= */

function initializePlaceholder(
    container,
    appId
) {

    const app =
        applications[appId];


    container.innerHTML = `

        <div class="placeholder-app">

            <div class="placeholder-icon">
                ${escapeHTML(app.icon)}
            </div>

            <h2>
                ${escapeHTML(app.title)}
            </h2>

            <p>
                ${escapeHTML(app.description)}
            </p>

            <span>
                NORTHSTAR SOC
            </span>

        </div>

    `;

}


/* =========================================================
   SIEM
   ========================================================= */

function initializeSIEM(
    container
) {

    container.innerHTML = `

        <div class="siem-app">

            <div class="siem-header">

                <div>

                    <div class="siem-title">
                        Security Information & Event Management
                    </div>

                    <div class="siem-subtitle">
                        NORTHSTAR SECURITY OPERATIONS CENTER
                    </div>

                </div>


                <div class="siem-live">

                    <span></span>

                    LIVE

                </div>

            </div>


            <div class="siem-controls">

                <button
                    type="button"
                    data-action="clear"
                >
                    CLEAR
                </button>


                <input
                    type="text"
                    placeholder="Search events..."
                    data-action="search"
                    autocomplete="off"
                >

            </div>


            <div class="siem-stats">

                <div class="siem-stat">

                    <span>
                        EVENTS
                    </span>

                    <strong data-stat="events">
                        0
                    </strong>

                </div>


                <div class="siem-stat">

                    <span>
                        HIGH / CRITICAL
                    </span>

                    <strong data-stat="threats">
                        0
                    </strong>

                </div>


                <div class="siem-stat">

                    <span>
                        INCIDENTS
                    </span>

                    <strong data-stat="incidents">
                        0
                    </strong>

                </div>


                <div class="siem-stat">

                    <span>
                        ENGINE
                    </span>

                    <strong class="online">
                        ONLINE
                    </strong>

                </div>

            </div>


            <div class="siem-table">

                <div class="siem-table-header">

                    <span>TIME</span>
                    <span>EVENT</span>
                    <span>SEVERITY</span>
                    <span>HOST</span>
                    <span>SOURCE</span>
                    <span>DESCRIPTION</span>

                </div>


                <div
                    class="siem-events"
                    data-events
                ></div>

            </div>

        </div>

    `;


    const eventsContainer =
        container.querySelector(
            "[data-events]"
        );


    const search =
        container.querySelector(
            '[data-action="search"]'
        );


    const clearButton =
        container.querySelector(
            '[data-action="clear"]'
        );


    function getEvents() {

        const engine =
            getEventEngine();


        if (
            engine &&
            typeof engine.getAllEvents ===
            "function"
        ) {

            return (
                engine.getAllEvents() || []
            );

        }


        return [];

    }


    function render() {

        if (!eventsContainer) return;


        let events =
            getEvents();


        const query =
            search
                ? search.value
                    .trim()
                    .toLowerCase()
                : "";


        if (query) {

            events =
                events.filter(
                    event => {

                        const searchable = [

                            event.eventType,

                            event.message,

                            event.hostname,

                            event.sourceIP,

                            event.destinationIP,

                            event.username,

                            event.attackId,

                            event.source,

                            event.description

                        ]
                            .map(
                                value =>
                                    String(
                                        value ??
                                        ""
                                    ).toLowerCase()
                            )
                            .join(" ");


                        return searchable.includes(
                            query
                        );

                    }
                );

        }


        events =
            [...events].reverse();


        eventsContainer.innerHTML =
            "";


        if (!events.length) {

            eventsContainer.innerHTML =
                query

                    ? `

                        <div class="siem-empty">

                            NO EVENTS MATCH CURRENT FILTER

                        </div>

                    `

                    : `

                        <div class="siem-empty siem-awaiting">

                            <div class="siem-empty-icon">
                                ◌
                            </div>

                            <div class="siem-empty-title">
                                AWAITING SECURITY EVENTS
                            </div>

                            <div class="siem-empty-text">
                                Live telemetry will appear here when activity is detected.
                            </div>

                            <div class="siem-empty-status">
                                <span></span>
                                EVENT ENGINE ONLINE
                            </div>

                        </div>

                    `;


            updateStats();

            return;

        }


        events.forEach(
            event => {

                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "siem-event-row";


                const timestamp =
                    event.timestamp;


                const time =
                    timestamp

                        ? new Date(
                            timestamp
                        ).toLocaleTimeString()

                        : "N/A";


                const severity =
                    String(
                        event.severity ||
                        "INFO"
                    ).toUpperCase();


                row.innerHTML = `

                    <span class="event-time">
                        ${escapeHTML(time)}
                    </span>


                    <span class="event-type">
                        ${escapeHTML(
                    event.eventType ||
                    "UNKNOWN"
                )}
                    </span>


                    <span>

                        <b
                            class="severity severity-${escapeHTML(
                    severity
                )}"
                        >
                            ${escapeHTML(severity)}
                        </b>

                    </span>


                    <span class="event-host">
                        ${escapeHTML(
                    event.hostname ||
                    "N/A"
                )}
                    </span>


                    <span class="event-ip">
                        ${escapeHTML(
                    event.sourceIP ||
                    "N/A"
                )}
                    </span>


                    <span>
                        ${escapeHTML(
                    event.message ||
                    event.description ||
                    ""
                )}
                    </span>

                `;


                eventsContainer.appendChild(
                    row
                );

            }
        );


        updateStats();

    }


    function updateStats() {

        const events =
            getEvents();


        const threats =
            events.filter(
                event => {

                    const severity =
                        String(
                            event.severity ||
                            ""
                        ).toUpperCase();


                    return (
                        severity === "HIGH" ||
                        severity === "CRITICAL"
                    );

                }
            );


        const incidents =
            new Set(
                events
                    .map(
                        event =>
                            event.attackId
                    )
                    .filter(Boolean)
            );


        const eventsStat =
            container.querySelector(
                '[data-stat="events"]'
            );


        const threatsStat =
            container.querySelector(
                '[data-stat="threats"]'
            );


        const incidentsStat =
            container.querySelector(
                '[data-stat="incidents"]'
            );


        if (eventsStat) {

            eventsStat.textContent =
                events.length;

        }


        if (threatsStat) {

            threatsStat.textContent =
                threats.length;

        }


        if (incidentsStat) {

            incidentsStat.textContent =
                incidents.size;

        }

    }


    if (search) {

        search.addEventListener(
            "input",
            render
        );

    }


    if (clearButton) {

        clearButton.addEventListener(
            "click",
            () => {

                const engine =
                    getEventEngine();


                if (
                    engine &&
                    typeof engine.clear ===
                    "function"
                ) {

                    engine.clear();

                }


                render();

            }
        );

    }


    const engine =
        getEventEngine();


    if (
        engine &&
        typeof engine.subscribe ===
        "function"
    ) {

        engine.subscribe(
            render
        );

    }


    render();

}


/* =========================================================
   ALERTS
   ========================================================= */

function initializeAlerts(
    container
) {

    container.innerHTML = `

        <div class="alerts-app">

            <div class="alerts-topbar">

                <div class="alerts-heading">

                    <div class="alerts-title">
                        Security Alerts
                    </div>

                    <div class="alerts-subtitle">
                        NORTHSTAR SECURITY OPERATIONS CENTER
                    </div>

                </div>


                <div class="alerts-status">

                    <span class="alerts-status-dot"></span>

                    DETECTION ENGINE ONLINE

                </div>

            </div>


            <div class="alerts-summary">

                <div class="alert-summary-card">

                    <span class="summary-label">
                        ACTIVE
                    </span>

                    <strong data-alert-stat="active">
                        0
                    </strong>

                </div>


                <div class="alert-summary-card">

                    <span class="summary-label">
                        HIGH
                    </span>

                    <strong data-alert-stat="high">
                        0
                    </strong>

                </div>


                <div class="alert-summary-card critical-card">

                    <span class="summary-label">
                        CRITICAL
                    </span>

                    <strong data-alert-stat="critical">
                        0
                    </strong>

                </div>


                <div class="alert-summary-card">

                    <span class="summary-label">
                        TOTAL
                    </span>

                    <strong data-alert-stat="total">
                        0
                    </strong>

                </div>

            </div>


            <div class="alerts-toolbar">

                <div class="alerts-toolbar-title">
                    DETECTION QUEUE
                </div>

                <div class="alerts-toolbar-info">
                    Correlated security detections
                </div>

            </div>


            <div
                class="alerts-list"
                data-alerts-list
            ></div>

        </div>

    `;


    const list =
        container.querySelector(
            "[data-alerts-list]"
        );


    function getAlerts() {

        const manager =
            getAlertManager();


        if (
            manager &&
            typeof manager.getAllAlerts ===
            "function"
        ) {

            return (
                manager.getAllAlerts() || []
            );

        }


        return [];

    }


    function renderAlerts() {

        if (!list) return;


        const manager =
            getAlertManager();


        if (!manager) {

            list.innerHTML = `

                <div class="alerts-empty">

                    <div class="alerts-empty-icon">
                        !
                    </div>

                    <div class="alerts-empty-title">
                        ALERT MANAGER OFFLINE
                    </div>

                    <div class="alerts-empty-text">
                        Detection services are unavailable.
                    </div>

                </div>

            `;


            updateAlertStats(
                []
            );


            return;

        }


        const alerts =
            getAlerts();


        const sorted =
            [...alerts].sort(
                (a, b) => {

                    const aTime =
                        new Date(
                            a.timestamp ||
                            a.createdAt ||
                            0
                        ).getTime();


                    const bTime =
                        new Date(
                            b.timestamp ||
                            b.createdAt ||
                            0
                        ).getTime();


                    return (
                        bTime -
                        aTime
                    );

                }
            );


        list.innerHTML =
            "";


        if (!sorted.length) {

            list.innerHTML = `

                <div class="alerts-empty">

                    <div class="alerts-empty-icon">
                        ✓
                    </div>

                    <div class="alerts-empty-title">
                        NO SECURITY ALERTS
                    </div>

                    <div class="alerts-empty-text">
                        The detection queue is currently clear.
                    </div>

                </div>

            `;


            updateAlertStats(
                []
            );


            return;

        }


        sorted.forEach(
            alert => {

                const element =
                    document.createElement(
                        "article"
                    );


                const severity =
                    String(
                        alert.severity ||
                        "INFO"
                    ).toLowerCase();


                element.className =
                    `security-alert-card alert-${severity}`;


                const timestamp =
                    alert.timestamp ||
                    alert.createdAt;


                const time =
                    timestamp

                        ? new Date(
                            timestamp
                        ).toLocaleString()

                        : "Unknown time";


                element.innerHTML = `

                    <div class="alert-card-accent"></div>


                    <div class="alert-card-content">

                        <div class="alert-card-header">

                            <div class="alert-severity-badge">

                                ${escapeHTML(
                    String(
                        alert.severity ||
                        "INFO"
                    ).toUpperCase()
                )}

                            </div>


                            <div class="alert-time">

                                ${escapeHTML(time)}

                            </div>

                        </div>


                        <div class="alert-card-title">

                            ${escapeHTML(
                    alert.title ||
                    "Security Detection"
                )}

                        </div>


                        <div class="alert-card-description">

                            ${escapeHTML(
                    alert.description ||
                    "A security detection requires analyst investigation."
                )}

                        </div>


                        <div class="alert-card-meta">

                            <div class="alert-meta-item">

                                <span class="alert-meta-label">
                                    ALERT
                                </span>

                                <span class="alert-meta-value">
                                    ${escapeHTML(
                    alert.id ||
                    "N/A"
                )}
                                </span>

                            </div>


                            <!--
                                A "CAMPAIGN" field showing alert.attackId
                                used to sit here. Removed: attackId is only
                                ever set on events AttackEngine.js creates
                                as part of the actual live attack — every
                                ambient/benign detection leaves it null. So
                                that field was a raw ground-truth tell —
                                any alert card showing a real value (instead
                                of "UNASSIGNED") was guaranteed to be part
                                of the real incident, visible at a glance,
                                no investigation required. Same class of
                                leak already removed from Mail's reputation
                                badges and IAM's live status block.
                            -->


                            <div class="alert-meta-item">

                                <span class="alert-meta-label">
                                    DETECTION
                                </span>

                                <span class="alert-meta-value">
                                    ${escapeHTML(
                    alert.ruleName ||
                    alert.detectionType ||
                    "CORRELATED EVENT"
                )}
                                </span>

                            </div>

                        </div>


                        <div class="alert-card-footer">

                            <div class="alert-investigation-state">

                                <span class="investigation-dot"></span>

                                ANALYST ACTION REQUIRED

                            </div>


                            <button
                                type="button"
                                class="investigate-alert-button"
                                data-investigate-alert="${escapeHTML(
                    alert.id ||
                    ""
                )}"
                            >
                                INVESTIGATE
                            </button>

                        </div>

                    </div>

                `;


                const investigateButton =
                    element.querySelector(
                        "[data-investigate-alert]"
                    );


                if (investigateButton) {

                    investigateButton.addEventListener(
                        "click",
                        event => {

                            event.stopPropagation();


                            openAlertInvestigation(
                                alert
                            );

                        }
                    );

                }


                list.appendChild(
                    element
                );

            }
        );


        updateAlertStats(
            alerts
        );

    }


    function updateAlertStats(
        alerts
    ) {

        const active =
            alerts.filter(
                alert => {

                    const status =
                        String(
                            alert.status ||
                            "ACTIVE"
                        ).toUpperCase();


                    return (
                        status !== "RESOLVED" &&
                        status !== "FALSE_POSITIVE"
                    );

                }
            ).length;


        const high =
            alerts.filter(
                alert => {

                    return (
                        String(
                            alert.severity ||
                            ""
                        ).toUpperCase() ===
                        "HIGH"
                    );

                }
            ).length;


        const critical =
            alerts.filter(
                alert => {

                    return (
                        String(
                            alert.severity ||
                            ""
                        ).toUpperCase() ===
                        "CRITICAL"
                    );

                }
            ).length;


        const activeStat =
            container.querySelector(
                '[data-alert-stat="active"]'
            );


        const highStat =
            container.querySelector(
                '[data-alert-stat="high"]'
            );


        const criticalStat =
            container.querySelector(
                '[data-alert-stat="critical"]'
            );


        const totalStat =
            container.querySelector(
                '[data-alert-stat="total"]'
            );


        if (activeStat) {

            activeStat.textContent =
                active;

        }


        if (highStat) {

            highStat.textContent =
                high;

        }


        if (criticalStat) {

            criticalStat.textContent =
                critical;

        }


        if (totalStat) {

            totalStat.textContent =
                alerts.length;

        }

    }


    const manager =
        getAlertManager();


    if (
        manager &&
        typeof manager.subscribe ===
        "function"
    ) {

        manager.subscribe(
            renderAlerts
        );

    }


    renderAlerts();

}


/* =========================================================
   ALERT INVESTIGATION
   ========================================================= */

function openAlertInvestigation(
    alert
) {

    console.log(
        "[ALERTS] Investigation opened:",
        alert?.id
    );


    const existing =
        getWindowForApp(
            "siem"
        );


    if (existing) {

        restoreWindow(
            existing
        );


        focusWindow(
            existing
        );


        return;

    }


    openApplication(
        "siem"
    );

}


/* =========================================================
   NETWORK APPLICATION
   ========================================================= */

function initializeNetwork(
    container
) {

    container.innerHTML = `

        <div class="network-app">

            <div class="network-header">

                <div>

                    <div class="network-title">
                        NORTHSTAR PACKET ANALYZER
                    </div>

                    <div class="network-subtitle">
                        NETWORK TRAFFIC INVESTIGATION
                    </div>

                </div>


                <div class="network-capture-status">

                    <span class="network-status-dot"></span>

                    <span data-capture-status>
                        CAPTURE STOPPED
                    </span>

                </div>

            </div>


            <div class="network-toolbar">

                <button
                    type="button"
                    class="network-control network-start"
                    data-network-action="start"
                >
                    ▶ START
                </button>


                <button
                    type="button"
                    class="network-control"
                    data-network-action="pause"
                >
                    ❚❚ PAUSE
                </button>


                <button
                    type="button"
                    class="network-control"
                    data-network-action="stop"
                >
                    ■ STOP
                </button>


                <button
                    type="button"
                    class="network-control"
                    data-network-action="clear"
                >
                    CLEAR
                </button>


                <div class="network-filter">

                    <span>
                        FILTER
                    </span>

                    <input
                        type="text"
                        placeholder="ip, mac, dns, user, protocol..."
                        data-network-search
                        autocomplete="off"
                    >

                </div>

            </div>


            <div class="network-stats">

                <div class="network-stat">

                    <span>
                        PACKETS
                    </span>

                    <strong data-network-stat="packets">
                        0
                    </strong>

                </div>


                <div class="network-stat">

                    <span>
                        PROTOCOLS
                    </span>

                    <strong data-network-stat="protocols">
                        0
                    </strong>

                </div>


                <div class="network-stat">

                    <span>
                        CAPTURE
                    </span>

                    <strong
                        data-network-stat="capture"
                        class="network-online"
                    >
                        STOPPED
                    </strong>

                </div>

            </div>


            <div class="network-main">

                <div class="network-packet-table">

                    <div class="network-table-header">

                        <span>NO.</span>
                        <span>TIME</span>
                        <span>SOURCE</span>
                        <span>DESTINATION</span>
                        <span>PROTOCOL</span>
                        <span>INFO</span>

                    </div>


                    <div
                        class="network-packets"
                        data-network-packets
                    ></div>

                </div>

            </div>

        </div>

    `;


    const packetContainer =
        container.querySelector(
            "[data-network-packets]"
        );


    const search =
        container.querySelector(
            "[data-network-search]"
        );


    const status =
        container.querySelector(
            "[data-capture-status]"
        );


    const packetStat =
        container.querySelector(
            '[data-network-stat="packets"]'
        );


    const protocolStat =
        container.querySelector(
            '[data-network-stat="protocols"]'
        );


    const captureStat =
        container.querySelector(
            '[data-network-stat="capture"]'
        );


    function getPackets() {

        const store =
            getNetworkStore();


        if (
            store &&
            typeof store.getPackets ===
            "function"
        ) {

            return (
                store.getPackets() || []
            );

        }


        return [];

    }


    function getVisiblePackets() {

        const packets =
            getPackets();


        if (!search) {

            return packets;

        }


        const query =
            search.value
                .trim()
                .toLowerCase();


        if (!query) {

            return packets;

        }


        const investigator =
            getNetworkInvestigator();


        if (
            investigator &&
            typeof investigator.search ===
            "function"
        ) {

            return (
                investigator.search(
                    query
                ) || []
            );

        }


        return packets.filter(
            packet => {

                const searchable = [

                    packet.sourceIP,

                    packet.destinationIP,

                    packet.sourceMAC,

                    packet.destinationMAC,

                    packet.protocol,

                    packet.username,

                    packet.info,

                    packet.dns?.queryName,

                    packet.nbns?.queryName,

                    packet.kerberos?.clientName,

                    packet.kerberos?.realm,

                    packet.http?.requestMethod,

                    packet.http?.requestUri,

                    packet.tls?.serverName

                ]
                    .map(
                        value =>
                            String(
                                value ??
                                ""
                            ).toLowerCase()
                    )
                    .join(" ");


                return searchable.includes(
                    query
                );

            }
        );

    }


    function getPacketInfo(
        packet
    ) {

        const protocol =
            String(
                packet.protocol ||
                ""
            ).toUpperCase();


        if (
            protocol === "DNS"
        ) {

            return (
                `Standard query ${packet.dns?.queryName || "unknown"}`
            );

        }


        if (
            protocol === "NBNS"
        ) {

            return (
                `Name query ${packet.nbns?.queryName || "unknown"}`
            );

        }


        if (
            protocol === "KRB5"
        ) {

            return (
                `AS-REQ ${packet.kerberos?.clientName || "unknown"}@${packet.kerberos?.realm || "UNKNOWN"}`
            );

        }


        if (
            protocol === "HTTP"
        ) {

            return (
                `${packet.http?.requestMethod || "GET"} ${packet.http?.requestUri || "/"}`
            );

        }


        if (
            protocol === "TLS"
        ) {

            return (
                `Client Hello — ${packet.tls?.serverName || "unknown"}`
            );

        }


        if (
            protocol === "ARP"
        ) {

            return (
                `Who has ${packet.arp?.targetIP || "unknown"}?`
            );

        }


        if (
            protocol === "ICMP"
        ) {

            return (
                packet.icmp?.typeName ||
                "ICMP packet"
            );

        }


        if (
            protocol === "TCP"
        ) {

            return (
                `${packet.tcp?.flags || "TCP"} ${packet.destinationPort || ""}`
            );

        }


        return (
            packet.info ||
            protocol ||
            "UNKNOWN"
        );

    }


    function protocolClass(
        protocol
    ) {

        return String(
            protocol ||
            "UNKNOWN"
        )
            .toLowerCase()
            .replace(
                /[^a-z0-9]/g,
                "-"
            );

    }


    function render() {

        if (!packetContainer) {
            return;
        }


        const packets =
            getVisiblePackets();


        packetContainer.innerHTML =
            "";


        if (!packets.length) {

            packetContainer.innerHTML = `

                <div class="network-empty">

                    <div class="network-empty-icon">
                        ◌
                    </div>

                    <div class="network-empty-title">
                        NO PACKETS CAPTURED
                    </div>

                    <div class="network-empty-text">
                        Start capture to begin receiving network telemetry.
                    </div>

                </div>

            `;


            updateStats();

            return;

        }


        [...packets]
            .reverse()
            .forEach(
                packet => {

                    const row =
                        document.createElement(
                            "div"
                        );


                    row.className =
                        "network-packet-row";


                    row.dataset.packetId =
                        packet.id ??
                        "";


                    const time =
                        packet.timestamp

                            ? new Date(
                                packet.timestamp
                            ).toLocaleTimeString(
                                [],
                                {
                                    hour12: false
                                }
                            )

                            : "N/A";


                    row.innerHTML = `

                        <span class="network-packet-number">

                            ${escapeHTML(
                        packet.number ??
                        packet.id ??
                        ""
                    )}

                        </span>


                        <span class="network-packet-time">

                            ${escapeHTML(time)}

                        </span>


                        <span class="network-source">

                            ${escapeHTML(
                        packet.sourceIP ||
                        "N/A"
                    )}

                        </span>


                        <span class="network-destination">

                            ${escapeHTML(
                        packet.destinationIP ||
                        "N/A"
                    )}

                        </span>


                        <span>

                            <b
                                class="
                                    network-protocol
                                    protocol-${protocolClass(
                        packet.protocol
                    )}
                                "
                            >

                                ${escapeHTML(
                        packet.protocol ||
                        "UNKNOWN"
                    )}

                            </b>

                        </span>


                        <span class="network-info">

                            ${escapeHTML(
                        getPacketInfo(packet)
                    )}

                        </span>

                    `;


                    row.addEventListener(
                        "click",
                        () => {

                            document
                                .querySelectorAll(
                                    ".network-packet-row.selected"
                                )
                                .forEach(
                                    selected => {

                                        selected.classList.remove(
                                            "selected"
                                        );

                                    }
                                );


                            row.classList.add(
                                "selected"
                            );


                            const store =
                                getNetworkStore();


                            if (
                                store &&
                                typeof store.selectPacket ===
                                "function"
                            ) {

                                store.selectPacket(
                                    packet
                                );

                            }

                        }
                    );


                    row.addEventListener(
                        "dblclick",
                        () => {

                            openPacketInspector(
                                packet
                            );

                        }
                    );


                    packetContainer.appendChild(
                        row
                    );

                }
            );


        updateStats();

    }


    function updateStats() {

        const packets =
            getPackets();


        const protocols =
            new Set(
                packets
                    .map(
                        packet =>
                            packet.protocol
                    )
                    .filter(Boolean)
            );


        if (packetStat) {

            packetStat.textContent =
                packets.length;

        }


        if (protocolStat) {

            protocolStat.textContent =
                protocols.size;

        }


        const engine =
            getPacketEngine();


        if (!engine) {

            if (captureStat) {

                captureStat.textContent =
                    "OFFLINE";

            }


            if (status) {

                status.textContent =
                    "ENGINE OFFLINE";

            }


            return;

        }


        if (
            engine.running &&
            engine.paused
        ) {

            if (captureStat) {

                captureStat.textContent =
                    "PAUSED";

            }


            if (status) {

                status.textContent =
                    "CAPTURE PAUSED";

            }


            return;

        }


        if (
            engine.running
        ) {

            if (captureStat) {

                captureStat.textContent =
                    "CAPTURING";

            }


            if (status) {

                status.textContent =
                    "LIVE CAPTURE";

            }


            return;

        }


        if (captureStat) {

            captureStat.textContent =
                "STOPPED";

        }


        if (status) {

            status.textContent =
                "CAPTURE STOPPED";

        }

    }


    const actionButtons =
        container.querySelectorAll(
            "[data-network-action]"
        );


    actionButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const action =
                        button.dataset.networkAction;


                    const engine =
                        getPacketEngine();


                    const store =
                        getNetworkStore();


                    if (
                        action === "clear"
                    ) {

                        if (
                            store &&
                            typeof store.clear ===
                            "function"
                        ) {

                            store.clear();

                        }


                        render();

                        return;

                    }


                    if (!engine) {

                        console.warn(
                            "[NETWORK] Packet engine unavailable."
                        );


                        updateStats();

                        return;

                    }


                    if (
                        action === "start"
                    ) {

                        if (
                            typeof engine.start ===
                            "function"
                        ) {

                            engine.start();

                        }

                    }


                    if (
                        action === "pause"
                    ) {

                        if (
                            engine.paused &&
                            typeof engine.resume ===
                            "function"
                        ) {

                            engine.resume();

                        }

                        else if (
                            typeof engine.pause ===
                            "function"
                        ) {

                            engine.pause();

                        }

                    }


                    if (
                        action === "stop"
                    ) {

                        if (
                            typeof engine.stop ===
                            "function"
                        ) {

                            engine.stop();

                        }

                    }


                    updateStats();

                }
            );

        }
    );


    if (search) {

        search.addEventListener(
            "input",
            render
        );

    }


    const store =
        getNetworkStore();


    if (
        store &&
        typeof store.subscribe ===
        "function"
    ) {

        store.subscribe(
            render
        );

    }


    render();

    updateStats();

}


/* =========================================================
   PACKET INSPECTOR
   ========================================================= */

function openPacketInspector(
    packet
) {

    if (!packet) return;


    const packetId =
        String(
            packet.id ??
            packet.number ??
            Date.now()
        );


    const existing =
        document.querySelector(
            `.packet-inspector[data-packet-id="${CSS.escape(packetId)}"]`
        );


    if (existing) {

        existing.style.zIndex =
            ++SOC.highestZIndex;


        return;

    }


    const parser =
        getPacketParser();


    let layers = [];


    if (
        parser &&
        typeof parser.parse ===
        "function"
    ) {

        try {

            layers =
                parser.parse(
                    packet
                ) || [];

        }

        catch (error) {

            console.error(
                "[PACKET PARSER]",
                error
            );

        }

    }


    let bytes = [];


    if (
        parser &&
        typeof parser.generateBytes ===
        "function"
    ) {

        try {

            bytes =
                parser.generateBytes(
                    packet
                ) || [];

        }

        catch (error) {

            console.error(
                "[PACKET BYTES]",
                error
            );

        }

    }


    if (
        !Array.isArray(bytes) ||
        bytes.length === 0
    ) {

        bytes =
            generateFallbackPacketBytes(
                packet
            );

    }


    const inspector =
        document.createElement(
            "section"
        );


    inspector.className =
        "packet-inspector";


    inspector.dataset.packetId =
        packetId;


    inspector.style.zIndex =
        ++SOC.highestZIndex;


    inspector.innerHTML = `

        <div class="packet-inspector-titlebar">

            <div class="packet-inspector-title">

                PACKET INSPECTOR
                —
                ${escapeHTML(
        packet.number ??
        packet.id ??
        "?"
    )}

                /

                ${escapeHTML(
        packet.protocol ||
        "UNKNOWN"
    )}

            </div>


            <button
                type="button"
                class="packet-inspector-close"
                title="Close"
            >
                ×
            </button>

        </div>


        <div class="packet-inspector-body">

            <div
                class="packet-layers"
                data-packet-layers
            ></div>


            <div class="packet-bytes">

                <div class="packet-bytes-header">

                    RAW PACKET BYTES

                    <span class="packet-byte-count">

                        ${bytes.length} bytes

                    </span>

                </div>


                <div class="packet-bytes-content">

                    ${formatPacketBytes(bytes)}

                </div>

            </div>

        </div>

    `;


    document.body.appendChild(
        inspector
    );


    renderPacketLayers(
        inspector,
        layers
    );


    const closeButton =
        inspector.querySelector(
            ".packet-inspector-close"
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            () => {

                inspector.remove();

            }
        );

    }


    inspector.addEventListener(
        "mousedown",
        () => {

            inspector.style.zIndex =
                ++SOC.highestZIndex;

        }
    );


    enableInspectorDragging(
        inspector
    );

}


/* =========================================================
   PACKET LAYER RENDERING
   ========================================================= */

function renderPacketLayers(
    inspector,
    layers
) {

    const container =
        inspector.querySelector(
            "[data-packet-layers]"
        );


    if (!container) return;


    if (
        !Array.isArray(layers) ||
        !layers.length
    ) {

        container.innerHTML = `

            <div class="packet-no-layers">

                <strong>
                    No decoded protocol layers
                </strong>

                <span>
                    Packet parser did not return a protocol tree.
                </span>

            </div>

        `;


        return;

    }


    layers.forEach(
        layer => {

            const layerElement =
                document.createElement(
                    "div"
                );


            layerElement.className =
                "packet-layer";


            const fields =
                Array.isArray(
                    layer.fields
                )
                    ? layer.fields
                    : [];


            layerElement.innerHTML = `

                <div
                    class="packet-layer-header"
                    data-layer-header
                >

                    <span class="packet-layer-arrow">
                        ▼
                    </span>

                    <span>
                        ${escapeHTML(
                layer.name ||
                "Unknown Protocol"
            )}
                    </span>

                </div>


                <div class="packet-layer-fields">

                    ${fields.length

                    ? fields
                        .map(
                            field => {

                                const name =
                                    Array.isArray(
                                        field
                                    )
                                        ? field[0]
                                        : field?.name;


                                const value =
                                    Array.isArray(
                                        field
                                    )
                                        ? field[1]
                                        : field?.value;


                                return `

                                            <div class="packet-field">

                                                <span class="packet-field-name">

                                                    ${escapeHTML(
                                    name ??
                                    ""
                                )}

                                                </span>


                                                <span class="packet-field-value">

                                                    ${escapeHTML(
                                    value ??
                                    ""
                                )}

                                                </span>

                                            </div>

                                        `;

                            }
                        )
                        .join("")

                    : `

                                <div class="packet-field">

                                    <span class="packet-field-name">
                                        Information
                                    </span>

                                    <span class="packet-field-value">
                                        No decoded fields available
                                    </span>

                                </div>

                            `
                }

                </div>

            `;


            const header =
                layerElement.querySelector(
                    "[data-layer-header]"
                );


            const fieldsElement =
                layerElement.querySelector(
                    ".packet-layer-fields"
                );


            if (
                header &&
                fieldsElement
            ) {

                header.addEventListener(
                    "click",
                    () => {

                        const collapsed =
                            fieldsElement.style.display ===
                            "none";


                        fieldsElement.style.display =
                            collapsed
                                ? ""
                                : "none";


                        const arrow =
                            header.querySelector(
                                ".packet-layer-arrow"
                            );


                        if (arrow) {

                            arrow.textContent =
                                collapsed
                                    ? "▼"
                                    : "▶";

                        }

                    }
                );

            }


            container.appendChild(
                layerElement
            );

        }
    );

}


/* =========================================================
   INSPECTOR DRAGGING
   ========================================================= */

function enableInspectorDragging(
    inspector
) {

    const titlebar =
        inspector.querySelector(
            ".packet-inspector-titlebar"
        );


    if (!titlebar) return;


    let dragging = false;

    let offsetX = 0;

    let offsetY = 0;


    titlebar.addEventListener(
        "mousedown",
        event => {

            if (
                event.target.closest(
                    ".packet-inspector-close"
                )
            ) {

                return;

            }


            dragging = true;


            const rect =
                inspector.getBoundingClientRect();


            offsetX =
                event.clientX -
                rect.left;


            offsetY =
                event.clientY -
                rect.top;


            inspector.style.transform =
                "none";


            inspector.style.left =
                `${rect.left}px`;


            inspector.style.top =
                `${rect.top}px`;


            inspector.style.zIndex =
                ++SOC.highestZIndex;


            event.preventDefault();

        }
    );


    function move(
        event
    ) {

        if (!dragging) return;


        inspector.style.left =
            `${event.clientX - offsetX}px`;


        inspector.style.top =
            `${event.clientY - offsetY}px`;

    }


    function stop() {

        dragging = false;

    }


    document.addEventListener(
        "mousemove",
        move
    );


    document.addEventListener(
        "mouseup",
        stop
    );

}


/* =========================================================
   FALLBACK PACKET BYTES
   ========================================================= */

function generateFallbackPacketBytes(
    packet
) {

    const bytes = [];


    const destination =
        String(
            packet.destinationMAC ||
            packet.destinationMac ||
            "00:11:22:33:44:55"
        )
            .split(":");


    const source =
        String(
            packet.sourceMAC ||
            packet.sourceMac ||
            "00:AA:BB:CC:DD:EE"
        )
            .split(":");


    destination.forEach(
        value => {

            bytes.push(
                parseInt(
                    value,
                    16
                ) || 0
            );

        }
    );


    source.forEach(
        value => {

            bytes.push(
                parseInt(
                    value,
                    16
                ) || 0
            );

        }
    );


    /* -----------------------------------------------------
       IPv4 EtherType
       ----------------------------------------------------- */

    bytes.push(
        0x08,
        0x00
    );


    /* -----------------------------------------------------
       IPv4 header
       ----------------------------------------------------- */

    bytes.push(
        0x45,
        0x00,
        0x00,
        0x3C
    );


    const packetNumber =
        Number(
            packet.number ||
            1
        );


    bytes.push(
        (packetNumber >> 8) & 0xff,
        packetNumber & 0xff
    );


    bytes.push(
        0x40,
        0x00
    );


    bytes.push(
        0x40
    );


    const protocol =
        String(
            packet.protocol ||
            ""
        ).toUpperCase();


    const protocolNumber = {

        ICMP: 1,

        TCP: 6,

        UDP: 17

    }[protocol] || 6;


    bytes.push(
        protocolNumber
    );


    bytes.push(
        0x00,
        0x00
    );


    appendIPv4(
        bytes,
        packet.sourceIP ||
        "10.0.0.10"
    );


    appendIPv4(
        bytes,
        packet.destinationIP ||
        "10.0.0.20"
    );


    /* -----------------------------------------------------
       TCP
       ----------------------------------------------------- */

    if (
        protocol === "TCP" ||
        protocol === "KRB5" ||
        protocol === "HTTP" ||
        protocol === "TLS"
    ) {

        const sourcePort =
            Number(
                packet.sourcePort ||
                50000
            );


        let defaultDestinationPort =
            443;


        if (
            protocol === "KRB5"
        ) {

            defaultDestinationPort =
                88;

        }

        else if (
            protocol === "HTTP"
        ) {

            defaultDestinationPort =
                80;

        }


        const destinationPort =
            Number(
                packet.destinationPort ||
                defaultDestinationPort
            );


        bytes.push(

            (sourcePort >> 8) & 0xff,

            sourcePort & 0xff,

            (destinationPort >> 8) & 0xff,

            destinationPort & 0xff

        );


        bytes.push(
            0x00,
            0x00,
            0x00,
            0x01
        );


        bytes.push(
            0x00,
            0x00,
            0x00,
            0x00
        );


        bytes.push(
            0x50,
            0x18
        );


        bytes.push(
            0x72,
            0x10
        );


        bytes.push(
            0x00,
            0x00
        );


        bytes.push(
            0x00,
            0x00
        );

    }


    /* -----------------------------------------------------
       Payload
       ----------------------------------------------------- */

    const payload =
        getPacketBytePayload(
            packet
        );


    for (
        let i = 0;
        i < payload.length;
        i++
    ) {

        bytes.push(
            payload.charCodeAt(i) &
            0xff
        );

    }


    /* -----------------------------------------------------
       Fill simulated frame
       ----------------------------------------------------- */

    while (
        bytes.length < 96
    ) {

        bytes.push(
            (
                bytes.length *
                37 +
                packetNumber
            ) & 0xff
        );

    }


    return bytes;


    function appendIPv4(
        target,
        ip
    ) {

        const parts =
            String(ip)
                .split(".")
                .slice(
                    0,
                    4
                );


        while (
            parts.length < 4
        ) {

            parts.push(
                "0"
            );

        }


        parts.forEach(
            octet => {

                target.push(
                    Math.max(
                        0,
                        Math.min(
                            255,
                            Number(
                                octet
                            ) || 0
                        )
                    )
                );

            }
        );

    }

}


/* =========================================================
   PACKET PAYLOAD
   ========================================================= */

function getPacketBytePayload(
    packet
) {

    const protocol =
        String(
            packet.protocol ||
            ""
        ).toUpperCase();


    if (
        protocol === "DNS"
    ) {

        return (
            packet.dns?.queryName ||
            "northstar.local"
        );

    }


    if (
        protocol === "KRB5"
    ) {

        return (
            `${packet.kerberos?.clientName || "analyst"}@` +
            `${packet.kerberos?.realm || "NORTHSTAR.LOCAL"}`
        );

    }


    if (
        protocol === "HTTP"
    ) {

        return (
            `${packet.http?.requestMethod || "GET"} ` +
            `${packet.http?.requestUri || "/"}`
        );

    }


    if (
        protocol === "TLS"
    ) {

        return (
            packet.tls?.serverName ||
            "internal.northstar.local"
        );

    }


    if (
        protocol === "ARP"
    ) {

        return (
            `Who has ${packet.arp?.targetIP || "10.0.0.1"}`
        );

    }


    return (
        packet.info ||
        packet.protocol ||
        "NORTHSTAR"
    );

}


/* =========================================================
   FORMAT PACKET BYTES
   ========================================================= */

function formatPacketBytes(
    bytes
) {

    if (
        !Array.isArray(bytes)
    ) {

        return "";

    }


    const rows = [];


    for (
        let index = 0;
        index < bytes.length;
        index += 16
    ) {

        const chunk =
            bytes.slice(
                index,
                index + 16
            );


        const hex =
            chunk
                .map(
                    byte => {

                        const value =
                            Number(
                                byte
                            ) || 0;


                        return value
                            .toString(16)
                            .padStart(
                                2,
                                "0"
                            )
                            .toUpperCase();

                    }
                )
                .join(" ");


        const ascii =
            chunk
                .map(
                    byte => {

                        const value =
                            Number(
                                byte
                            ) || 0;


                        return (
                            value >= 32 &&
                            value <= 126
                        )
                            ? String.fromCharCode(
                                value
                            )
                            : ".";

                    }
                )
                .join("");


        const row =
            `${String(index).padStart(4, "0")}  ` +
            `${hex.padEnd(47, " ")}  ` +
            ascii;


        rows.push(
            escapeHTML(
                row
            )
        );

    }


    return rows.join(
        "<br>"
    );

}


/* =========================================================
   ATTACK MAP
   ========================================================= */

function initializeAttackMap(container) {

    container.innerHTML = `

        <div class="attack-map-app">

            <!-- HEADER -->

            <div class="attack-map-header">

                <div class="attack-map-title-block">

                    <div class="attack-map-title">
                        GLOBAL ACCESS MAP
                    </div>

                    <div class="attack-map-subtitle">
                        NORTHSTAR SECURITY OPERATIONS CENTER
                    </div>

                </div>


                <div class="attack-map-status">

                    <span class="attack-map-status-dot"></span>

                    LIVE TELEMETRY

                </div>

            </div>


            <!-- MAP -->

            <div class="attack-map-body">

                <div class="attack-map-canvas">

                    <div class="map-grid"></div>


                    <!-- WORLD MAP -->

                    <div class="world-map">

                        <div class="continent north-america"></div>
                        <div class="continent south-america"></div>
                        <div class="continent europe"></div>
                        <div class="continent africa"></div>
                        <div class="continent asia"></div>
                        <div class="continent australia"></div>

                    </div>


                    <!-- LOGIN SOURCES -->

                    <div
                        class="map-sources"
                        id="attack-map-sources"
                    ></div>


                    <!-- NORTHSTAR TARGET -->

                    <!-- NORTHSTAR TARGET -->
                    <div
                        class="map-target"
                        id="attack-map-target"
                    >
                        <div class="target-ring"></div>
                        <div class="target-core"></div>
                    </div>


                    <!-- MAP OVERLAY -->

                    <div class="map-overlay-top">

                        <span>
                            GLOBAL AUTHENTICATION TELEMETRY
                        </span>

                        <span>
                            UTC
                        </span>

                    </div>


                    <div class="map-overlay-bottom">

                        <span>
                            SOURCES
                            <b id="attack-map-source-count">
                                18
                            </b>
                        </span>

                        <span>
                            ACTIVE
                            <b>
                                01
                            </b>
                        </span>

                        <span class="map-warning">
                            SUSPICIOUS
                            <b>
                                01
                            </b>
                        </span>

                    </div>

                </div>


                <!-- RIGHT SIDEBAR -->

                <aside class="attack-map-sidebar">

                    <div class="map-panel-heading">
                        GLOBAL ACTIVITY
                    </div>


                    <div class="map-stat">

                        <div class="map-stat-label">
                            LOGIN SOURCES
                        </div>

                        <div
                            class="map-stat-value"
                            id="attack-map-sidebar-count"
                        >
                            18
                        </div>

                    </div>


                    <div class="map-stat">

                        <div class="map-stat-label">
                            ACTIVE SESSIONS
                        </div>

                        <div class="map-stat-value">
                            01
                        </div>

                    </div>


                    <div class="map-stat suspicious-stat">

                        <div class="map-stat-label">
                            FLAGGED SOURCE
                        </div>

                        <div class="map-stat-value">
                            01
                        </div>

                    </div>


                    <div class="map-divider"></div>


                    <div class="map-panel-heading">
                        SELECTED SOURCE
                    </div>


                    <div class="map-selected-source">

                        <div class="selected-source-label">
                            SOURCE IP
                        </div>

                        <div
                            class="selected-source-ip"
                            id="attack-map-selected-ip"
                        >
                            SELECT NODE
                        </div>


                        <div class="selected-source-country">

                            <span>
                                COUNTRY
                            </span>

                            <strong
                                id="attack-map-selected-country"
                            >
                                —
                            </strong>

                        </div>


                        <div class="selected-source-status">

                            <span></span>

                            AWAITING ANALYST SELECTION

                        </div>

                    </div>


                    <div class="map-instructions">

                        <div class="map-instruction-title">
                            ANALYST TASK
                        </div>

                        <p>
                            Locate the source IP identified
                            during network investigation.
                        </p>

                        <p>
                            Select a node to inspect its
                            authentication activity and
                            geographic origin.
                        </p>

                    </div>

                </aside>

            </div>


            <!-- FOOTER -->

            <div class="attack-map-footer">

                <div>
                    MAP STATUS:
                    <span class="online">
                        OPERATIONAL
                    </span>
                </div>

                <div>
                    TELEMETRY:
                    <span class="online">
                        RECEIVING
                    </span>
                </div>

                <div>
                    NORTHSTAR
                </div>

            </div>

        </div>

    `;


    /* =========================================================
       GLOBAL SOURCE DATA
       ========================================================= */

    const TARGET = {
        lat: 35.7796,
        lon: -78.6382
    };

    /*
     * Approximate country centerpoints for the real attacker
     * list (AttackEngine.ATTACKERS only carries a country
     * name, not coordinates). Germany matches the value
     * already used in threatSources.js for consistency.
     */
    const ATTACKER_COUNTRY_COORDS = {
        "Germany": { lat: 51.0, lon: 10.0 },
        "Romania": { lat: 46.0, lon: 25.0 },
        "Netherlands": { lat: 52.0, lon: 5.0 }
    };

    /*
     * Where the NORTHSTAR icon actually plots: the real HQ
     * (TARGET, Raleigh NC) whenever the analyst isn't routing
     * through the VPN, or wherever the VPN is currently routed
     * through instead — the whole point of a VPN is that the
     * outside world sees the second one, not the first. Read
     * live off window.vpnStore so this always reflects current
     * VPN state, not just whatever it was when the map opened.
     */
    function getNorthstarMapPosition() {

        const vpnStore = window.vpnStore;

        if (vpnStore && vpnStore.state && vpnStore.state.connected) {

            const coords =
                VPN_COUNTRY_COORDS[
                    vpnStore.state.selectedLocation?.country
                ];

            if (coords) {
                return coords;
            }
        }

        return TARGET;
    }

    const realAttackerSources =
        ATTACKERS.map(attacker => {

            const coords =
                ATTACKER_COUNTRY_COORDS[attacker.country] || { lat: 0, lon: 0 };

            return {
                ip: attacker.ip,
                country: attacker.country,
                latitude: coords.lat,
                longitude: coords.lon,
                isRealAttacker: true,
                attackerId: attacker.id,
                attackerName: attacker.name
            };
        });

    /*
     * Ambient sources (the original 18) represent ordinary
     * global login telemetry — mostly legitimate. The 3 real
     * attacker sources above are the ones actually wired to
     * AttackEngine/EventEngine; they get a distinct visual
     * treatment below and light up when a real attack fires.
     */
    const sources = [
        ...THREAT_SOURCES.map(source => ({ ...source, isRealAttacker: false })),
        ...realAttackerSources
    ];


    /* =========================================================
       ELEMENTS
       ========================================================= */

    const canvas =
        container.querySelector(
            ".attack-map-canvas"
        );


    const sourceContainer =
        container.querySelector(
            "#attack-map-sources"
        );


    const selectedIP =
        container.querySelector(
            "#attack-map-selected-ip"
        );


    const selectedCountry =
        container.querySelector(
            "#attack-map-selected-country"
        );


    const sourceCount =
        container.querySelector(
            "#attack-map-source-count"
        );


    const sidebarCount =
        container.querySelector(
            "#attack-map-sidebar-count"
        );


    if (
        !canvas ||
        !sourceContainer
    ) {

        return;

    }


    /* =========================================================
       CREATE NODES
       ========================================================= */

    sources.forEach(
        source => {

            const node =
                document.createElement(
                    "button"
                );


            node.type =
                "button";


            node.className =
                "map-node";


            node.dataset.ip =
                source.ip;


            node.dataset.country =
                source.country;


            node.dataset.latitude =
                source.latitude;


            node.dataset.longitude =
                source.longitude;


            if (source.isRealAttacker) {
                node.dataset.attackerId = source.attackerId;
            }


            node.title =
                "Login source";


            node.innerHTML =
                `<span></span>`;


            node.addEventListener(
                "click",
                () => {

                    sourceContainer
                        .querySelectorAll(
                            ".map-node"
                        )
                        .forEach(
                            currentNode => {

                                currentNode.classList.remove(
                                    "selected"
                                );

                            }
                        );


                    node.classList.add(
                        "selected"
                    );


                    if (selectedIP) {

                        selectedIP.textContent =
                            source.ip;

                    }


                    if (selectedCountry) {

                        selectedCountry.textContent =
                            source.country;

                    }

                }
            );


            sourceContainer.appendChild(
                node
            );

        }
    );


    /* =========================================================
       POSITION SOURCES
       ========================================================= */

    function positionSourceNodes() {

        const rect =
            canvas.getBoundingClientRect();


        if (
            rect.width <= 0 ||
            rect.height <= 0
        ) {

            return;

        }


        /*
         * IMPORTANT:
         *
         * .world-map occupies:
         *
         *   left:  2%
         *   right: 2%
         *   top:   4%
         *   bottom: 5%
         *
         * BUT the SVG background INSIDE it is:
         *
         *   width:  96%
         *   height: 91%
         *
         * Therefore the actual geographic image begins
         * farther inward than the .world-map element.
         */


        const worldLeft =
            rect.width * 0.02;


        const worldTop =
            rect.height * 0.04;


        const worldWidth =
            rect.width * 0.96;


        const worldHeight =
            rect.height * 0.91;


        /*
         * Actual SVG image size.
         */

        const svgWidth =
            worldWidth * 0.96;


        const svgHeight =
            worldHeight * 0.91;


        /*
         * Background-position: center
         * means the SVG has equal margins
         * on both sides.
         */

        const svgLeft =
            worldLeft +
            (
                worldWidth -
                svgWidth
            ) / 2;


        const svgTop =
            worldTop +
            (
                worldHeight -
                svgHeight
            ) / 2;


        /*
         * Convert geographic coordinates to the
         * actual SVG image.
         */

        sourceContainer
            .querySelectorAll(
                ".map-node"
            )
            .forEach(
                node => {

                    const latitude =
                        Number(
                            node.dataset.latitude
                        );


                    const longitude =
                        Number(
                            node.dataset.longitude
                        );


                    if (
                        !Number.isFinite(
                            latitude
                        ) ||
                        !Number.isFinite(
                            longitude
                        )
                    ) {

                        return;

                    }


                    /*
                     * Longitude:
                     *
                     * -180 = left
                     *    0 = center
                     * +180 = right
                     */

                    const xRatio =
                        (
                            longitude + 180
                        ) / 360;


                    /*
                     * Latitude:
                     *
                     * +90 = top
                     *    0 = equator
                     * -90 = bottom
                     */

                    const yRatio =
                        (
                            90 - latitude
                        ) / 180;


                    const x =
                        svgLeft +
                        (
                            xRatio *
                            svgWidth
                        );


                    const y =
                        svgTop +
                        (
                            yRatio *
                            svgHeight
                        );


                    node.style.left =
                        `${(
                            x /
                            rect.width
                        ) * 100}%`;


                    node.style.top =
                        `${(
                            y /
                            rect.height
                        ) * 100}%`;

                }
            );


        /* -----------------------------------------------------
           POSITION NORTHSTAR TARGET (same projection as sources)
           ----------------------------------------------------- */

        const target =
            container.querySelector(
                "#attack-map-target"
            );


        if (target) {

            const northstarPosition =
                getNorthstarMapPosition();

            const targetXRatio =
                (northstarPosition.lon + 180) / 360;


            const targetYRatio =
                (90 - northstarPosition.lat) / 180;


            const targetX =
                svgLeft +
                (targetXRatio * svgWidth);


            const targetY =
                svgTop +
                (targetYRatio * svgHeight);


            target.style.left =
                `${(targetX / rect.width) * 100}%`;


            target.style.top =
                `${(targetY / rect.height) * 100}%`;


            /*
             * Visual tell that this is the VPN-masked position,
             * not the real HQ — same connected state already
             * shown in the VPN app itself, just reflected here.
             */
            target.classList.toggle(
                "vpn-masked",
                northstarPosition !== TARGET
            );

        }

    }


    /* =========================================================
       COUNTS
       ========================================================= */

    if (sourceCount) {

        sourceCount.textContent =
            sources.length;

    }


    if (sidebarCount) {

        sidebarCount.textContent =
            sources.length;

    }


    /* =========================================================
       INITIAL POSITION
       ========================================================= */

    positionSourceNodes();


    /* =========================================================
       KEEP POSITIONS CORRECT WHEN RESIZED
       ========================================================= */

    if (
        typeof ResizeObserver !==
        "undefined"
    ) {

        const observer =
            new ResizeObserver(
                () => {

                    positionSourceNodes();

                }
            );


        observer.observe(
            canvas
        );

    }


    requestAnimationFrame(
        () => {

            positionSourceNodes();

        }
    );


    window.setTimeout(
        () => {

            positionSourceNodes();

        },
        50
    );


    /* =========================================================
       KEEP NORTHSTAR ICON IN SYNC WITH THE VPN
       ---------------------------------------------------------
       So connecting, disconnecting, or switching servers while
       this window is already open moves the icon immediately
       instead of only the next time the map is reopened.
       ========================================================= */

    if (
        window.vpnStore &&
        typeof window.vpnStore.subscribe === "function"
    ) {

        window.vpnStore.subscribe(() => {

            positionSourceNodes();

        });
    }


    /* =========================================================
       LIVE ATTACK HIGHLIGHTING — REMOVED
       ---------------------------------------------------------
       This used to subscribe to window.eventEngine and pulse
       the map node matching event.sourceIP the instant ANY
       event with actorType === "ATTACKER" fired. AttackEngine's
       first campaign action (emitRecon) fires automatically
       15-40s after sim start with no gating on player progress,
       so this leaked the real attacker's IP (ground truth) to
       anyone with the map open, before they had investigated
       anything themselves via Mail/Network. Removed so the map
       no longer reveals the attacker node on its own; the
       player-driven "INDICATOR HANDOFF" mechanism below is the
       only way a node gets highlighted now, and only once the
       player has surfaced that IP through their own work.
       ========================================================= */


    /* =========================================================
       INDICATOR HANDOFF (from Malware Sandbox, or anything
       else that finds an IP elsewhere and wants to locate it
       here). Selects the matching node the same way clicking
       it directly would — no extra information revealed
       beyond what a normal click already shows.
       ========================================================= */

    window.addEventListener("northstar:attack-map-indicator", event => {

        const ip =
            event.detail?.ip;

        if (!ip) {
            return;
        }

        const matchingNode =
            sourceContainer.querySelector(`.map-node[data-ip="${ip}"]`);

        if (!matchingNode) {
            return;
        }

        sourceContainer
            .querySelectorAll(".map-node")
            .forEach(node => node.classList.remove("selected"));

        matchingNode.classList.add("selected");

        if (selectedIP) {
            selectedIP.textContent = ip;
        }

        if (selectedCountry) {
            selectedCountry.textContent = matchingNode.dataset.country || "—";
        }

        matchingNode.scrollIntoView?.({ behavior: "smooth", block: "center" });

    });

}



/*
 * If an attack engine exists, future map rendering can
 * be connected here without changing the window system.
 */

const engine =
    window.attackEngine;


if (engine) {

    console.log(
        "[ATTACK MAP] Attack engine detected."
    );

}


/* =========================================================
   MAIL ERROR ESCAPING
   ========================================================= */

function escapeMailError(
    value
) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================================
   TERMINAL APPLICATION
   ========================================================= */

function initializeTerminal(
    container
) {

    container.innerHTML = `

        <div class="soc-terminal">

            <div class="terminal-output">

                <div>
                    NORTHSTAR SOC TERMINAL
                </div>

                <div>
                    Secure analyst environment initialized.
                </div>

                <div>
                    Type <strong>help</strong> for available commands.
                </div>

            </div>


            <div class="terminal-input-line">

                <span class="terminal-prompt">
                    analyst@northstar:~$
                </span>

                <input
                    type="text"
                    class="terminal-input"
                    autocomplete="off"
                    spellcheck="false"
                >

            </div>

        </div>

    `;


    const output =
        container.querySelector(
            ".terminal-output"
        );


    const input =
        container.querySelector(
            ".terminal-input"
        );


    if (!input) return;


    function print(
        text
    ) {

        const line =
            document.createElement(
                "div"
            );


        line.textContent =
            text;


        output.appendChild(
            line
        );


        output.scrollTop =
            output.scrollHeight;

    }


    function execute(
        command
    ) {

        const cmd =
            command
                .trim()
                .toLowerCase();


        if (!cmd) {
            return;
        }


        print(
            `analyst@northstar:~$ ${command}`
        );


        if (
            cmd === "help"
        ) {

            print(
                "Available commands:"
            );


            print(
                "help      - show commands"
            );


            print(
                "status    - show SOC engine status"
            );


            print(
                "apps      - list applications"
            );


            print(
                "clear     - clear terminal"
            );


            print(
                "version   - show system version"
            );


            if (window.ransomwareEngine?.getCampaign?.()) {

                print(
                    "ps, netstat, whoami, hostname, isolate-host <host>, terminate <process>, block-c2 <domain>  - incident response (active incident only)"
                );

            }


            return;

        }


        /* =============================================
           RANSOMWARE (BLACKFROST) — TERMINAL COMMANDS
           ---------------------------------------------------
           Display data / real store mutations only. NEVER
           executes anything against the real OS — every
           command below either reads the live campaign object
           or calls the same RansomwareEngine response-action
           methods Incident Response's buttons call.
           ============================================= */

        if (
            cmd === "ps" ||
            cmd === "netstat" ||
            cmd === "whoami" ||
            cmd === "hostname" ||
            cmd.startsWith("isolate-host") ||
            cmd.startsWith("terminate") ||
            cmd.startsWith("block-c2")
        ) {

            const campaign =
                window.ransomwareEngine?.getCampaign?.() || null;

            if (!campaign) {

                print(
                    "No active ransomware incident."
                );

                return;
            }


            if (cmd === "ps") {

                if (!campaign.processes.length) {
                    print("No process telemetry available yet.");
                    return;
                }

                print("PID     PPID    STATUS       PROCESS");

                campaign.processes.forEach(process => {
                    print(
                        `${String(process.pid).padEnd(8)}${String(process.ppid ?? "-").padEnd(8)}${String(process.status).padEnd(13)}${process.processName}`
                    );
                });

                return;
            }


            if (cmd === "netstat") {

                const host =
                    HOSTS.find(h => h.hostname === campaign.affectedHostname);

                print("Proto  Local Address        Foreign Address                 State");

                if (campaign.stage === "C2_COMMUNICATION" || campaign.stage === "IMPACT" || campaign.stage === "DETECTED" || campaign.stage === "CONTAINMENT" || campaign.stage === "ERADICATION" || campaign.stage === "RECOVERY" || campaign.stage === "RESOLVED") {

                    print(
                        `TCP    ${host?.ip || "-"}:49212      ${campaign.c2Domain} (${campaign.actor.ip})      ${campaign.c2Blocked ? "BLOCKED" : "ESTABLISHED"}`
                    );

                } else {

                    print("No suspicious outbound connections observed yet.");
                }

                return;
            }


            if (cmd === "whoami") {

                print(campaign.affectedUsername || "unknown");

                return;
            }


            if (cmd === "hostname") {

                print(campaign.affectedHostname || "unknown");

                return;
            }


            if (cmd.startsWith("isolate-host")) {

                const arg =
                    cmd.slice("isolate-host".length).trim();

                if (!arg) {
                    print("Usage: isolate-host <hostname>");
                    return;
                }

                if (arg !== campaign.affectedHostname.toLowerCase()) {
                    print(`Unknown or unreachable host: ${arg}`);
                    return;
                }

                const result = window.ransomwareEngine.isolateHost();

                print(
                    result.success
                        ? `${campaign.affectedHostname} isolated from the network.`
                        : `${campaign.affectedHostname} is already isolated.`
                );

                return;
            }


            if (cmd.startsWith("terminate")) {

                const arg =
                    cmd.slice("terminate".length).trim();

                if (!arg) {
                    print("Usage: terminate <process>");
                    return;
                }

                const knownProcess =
                    campaign.processes.find(p => p.processName.toLowerCase() === arg);

                if (!knownProcess) {
                    print(`No such process: ${arg}`);
                    return;
                }

                const result = window.ransomwareEngine.terminateProcess(knownProcess.pid);

                print(
                    result.success
                        ? (result.message || `${knownProcess.processName} (PID ${knownProcess.pid}) terminated.`)
                        : (result.reason || `${knownProcess.processName} could not be terminated.`)
                );

                return;
            }


            if (cmd.startsWith("block-c2")) {

                const arg =
                    cmd.slice("block-c2".length).trim();

                if (!arg) {
                    print("Usage: block-c2 <domain>");
                    return;
                }

                if (arg !== campaign.c2Domain.toLowerCase()) {
                    print(`Unknown domain: ${arg}`);
                    return;
                }

                const result = window.ransomwareEngine.blockC2();

                print(
                    result.success
                        ? `${campaign.c2Domain} blocked at the firewall.`
                        : `${campaign.c2Domain} is already blocked.`
                );

                return;
            }

        }


        if (
            cmd === "status"
        ) {

            print(
                `EventEngine: ${getEventEngine()
                    ? "ONLINE"
                    : "OFFLINE"
                }`
            );


            print(
                `AlertManager: ${getAlertManager()
                    ? "ONLINE"
                    : "OFFLINE"
                }`
            );


            print(
                `NetworkStore: ${getNetworkStore()
                    ? "ONLINE"
                    : "OFFLINE"
                }`
            );


            print(
                `PacketEngine: ${getPacketEngine()
                    ? "ONLINE"
                    : "OFFLINE"
                }`
            );


            print(
                `AttackEngine: ${window.attackEngine
                    ? "ONLINE"
                    : "OFFLINE"
                }`
            );


            return;

        }


        if (
            cmd === "apps"
        ) {

            Object.values(
                applications
            )
                .forEach(
                    app => {

                        print(
                            `${app.title} — ${app.description}`
                        );

                    }
                );


            return;

        }


        if (
            cmd === "version"
        ) {

            print(
                "NORTHSTAR SOC COMMAND CENTER v1.0"
            );


            return;

        }


        if (
            cmd === "clear"
        ) {

            output.innerHTML =
                "";


            return;

        }


        print(
            `Command not found: ${command}`
        );

    }


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key !==
                "Enter"
            ) {

                return;

            }


            execute(
                input.value
            );


            input.value =
                "";

        }
    );


    input.focus();

}


/* =========================================================
   WINDOW FOCUS
   ========================================================= */

function focusWindow(
    windowElement
) {

    if (!windowElement) return;


    SOC.highestZIndex++;


    windowElement.style.zIndex =
        SOC.highestZIndex;


    updateTaskbarState();

}


/* =========================================================
   RESTORE WINDOW
   ========================================================= */

function restoreWindow(
    windowElement
) {

    if (!windowElement) return;


    if (
        windowElement.classList.contains(
            "window-minimized"
        )
    ) {

        windowElement.classList.remove(
            "window-minimized"
        );


        windowElement.classList.add(
            "window-restoring"
        );


        setTimeout(
            () => {

                windowElement.classList.remove(
                    "window-restoring"
                );

            },
            220
        );

    }


    focusWindow(
        windowElement
    );

}


/* =========================================================
   MINIMIZE WINDOW
   ========================================================= */

function minimizeWindow(
    windowElement
) {

    if (!windowElement) return;


    if (
        windowElement.classList.contains(
            "window-minimized"
        )
    ) {

        return;

    }


    windowElement.classList.add(
        "window-minimizing"
    );


    setTimeout(
        () => {

            windowElement.classList.remove(
                "window-minimizing"
            );


            windowElement.classList.add(
                "window-minimized"
            );


            updateTaskbarState();

        },
        220
    );

}


/* =========================================================
   MAXIMIZE WINDOW
   ========================================================= */

function maximizeWindow(
    windowElement
) {

    if (!windowElement) return;


    if (
        windowElement.classList.contains(
            "window-maximized"
        )
    ) {

        restoreMaximizedWindow(
            windowElement
        );


        return;

    }


    windowElement.dataset.oldLeft =
        windowElement.style.left;


    windowElement.dataset.oldTop =
        windowElement.style.top;


    windowElement.dataset.oldWidth =
        windowElement.style.width;


    windowElement.dataset.oldHeight =
        windowElement.style.height;


    windowElement.classList.add(
        "window-maximized"
    );


    focusWindow(
        windowElement
    );

}


/* =========================================================
   RESTORE MAXIMIZED WINDOW
   ========================================================= */

function restoreMaximizedWindow(
    windowElement
) {

    if (!windowElement) return;


    windowElement.classList.remove(
        "window-maximized"
    );


    if (
        windowElement.dataset.oldLeft
    ) {

        windowElement.style.left =
            windowElement.dataset.oldLeft;

    }


    if (
        windowElement.dataset.oldTop
    ) {

        windowElement.style.top =
            windowElement.dataset.oldTop;

    }


    if (
        windowElement.dataset.oldWidth
    ) {

        windowElement.style.width =
            windowElement.dataset.oldWidth;

    }


    if (
        windowElement.dataset.oldHeight
    ) {

        windowElement.style.height =
            windowElement.dataset.oldHeight;

    }


    focusWindow(
        windowElement
    );

}


/* =========================================================
   CLOSE WINDOW
   ========================================================= */

function closeWindow(
    appId
) {

    const windowElement =
        getWindowForApp(
            appId
        );


    if (!windowElement) return;


    const instance =
        SOC.appInstances.get(appId);

    if (
        instance &&
        typeof instance.destroy === "function"
    ) {

        try {

            instance.destroy();

        } catch (error) {

            console.error(
                `[SOC] ${appId} threw while destroying:`,
                error
            );

        }

    }

    SOC.appInstances.delete(appId);


    windowElement.remove();


    SOC.windows.delete(
        appId
    );


    /*
     * If appId is still pinned, syncTaskbar() leaves its
     * button in place (just no longer "running") instead of
     * removing it — a pinned icon shouldn't vanish from the
     * taskbar just because its window closed.
     */

    syncTaskbar();

}


/* =========================================================
   TASKBAR CLICK
   ---------------------------------------------------------
   ONE handler for every taskbar button, pinned or not — real
   Windows taskbar buttons all behave this way: click a closed
   (pinned) icon and it opens; click a running icon again and
   it toggles minimize/focus. There's no separate "pinned
   button" vs "running button" click behavior anymore, which is
   what made a pinned app spawn a second, differently-behaved
   icon the moment it was opened.
   ========================================================= */

function handleTaskbarButtonClick(
    appId
) {

    const windowElement =
        getWindowForApp(
            appId
        );


    if (!windowElement) {

        openApplication(
            appId
        );


        return;

    }


    if (
        windowElement.classList.contains(
            "window-minimized"
        )
    ) {

        restoreWindow(
            windowElement
        );


        return;

    }


    if (
        Number(
            windowElement.style.zIndex
        ) ===
        SOC.highestZIndex
    ) {

        minimizeWindow(
            windowElement
        );


        return;

    }


    focusWindow(
        windowElement
    );

}


/* =========================================================
   SYNC TASKBAR
   ---------------------------------------------------------
   The single source of truth for what's in .taskbar-apps —
   replaces the old split between DesktopFeatures.js's pinned
   rendering and this file's separate "running app" button
   creation, which is what caused a pinned app to show up
   TWICE the moment it was opened (one pinned icon it already
   had, plus a second "running" icon this file used to create
   right next to it without checking).

   A button exists for appId whenever it's pinned OR has a
   live window open — nothing else. Existing DOM nodes are
   reused (never recreated) so in-flight state like the
   "active"/"running" indicator classes survives a re-sync,
   and re-appending them in order both places new buttons and
   keeps pinned apps in pin order with any running-but-unpinned
   apps trailing after them.
   ========================================================= */

function syncTaskbar() {

    const taskbarApps =
        document.querySelector(
            ".taskbar-apps"
        );


    if (!taskbarApps) return;


    const pinned =
        (
            window.NorthstarDesktop &&
            typeof window.NorthstarDesktop.getPins ===
            "function"
        )
            ? window.NorthstarDesktop.getPins()
            : [];


    const runningIds =
        [...SOC.windows.keys()];


    const orderedIds = [

        ...pinned.filter(
            appId => !!applications[appId]
        ),

        ...runningIds.filter(
            appId =>
                !pinned.includes(appId) &&
                !!applications[appId]
        )

    ];


    /*
     * Drop buttons for anything that's neither pinned nor
     * running anymore.
     */

    SOC.taskbarButtons.forEach(
        (button, appId) => {

            if (!orderedIds.includes(appId)) {

                button.remove();

                SOC.taskbarButtons.delete(
                    appId
                );

            }

        }
    );


    orderedIds.forEach(
        appId => {

            let button =
                SOC.taskbarButtons.get(
                    appId
                );


            if (!button) {

                button =
                    document.createElement(
                        "button"
                    );


                button.type =
                    "button";


                button.className =
                    "taskbar-app";


                button.dataset.app =
                    appId;


                button.title =
                    applications[appId].title;


                button.innerHTML = `
                    <span>
                        ${escapeHTML(applications[appId].icon)}
                    </span>
                `;


                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();


                        handleTaskbarButtonClick(
                            appId
                        );

                    }
                );


                button.addEventListener(
                    "contextmenu",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();


                        if (
                            window.NorthstarDesktop &&
                            typeof window.NorthstarDesktop.showAppContextMenu ===
                            "function"
                        ) {

                            window.NorthstarDesktop.showAppContextMenu(
                                event.clientX,
                                event.clientY,
                                appId
                            );

                        }

                    }
                );


                SOC.taskbarButtons.set(
                    appId,
                    button
                );

            }

            /*
             * appendChild on a node already in the DOM just
             * moves it — this is what keeps ordering correct
             * (pinned apps first, in pin order) on every sync,
             * not just on first creation.
             */

            taskbarApps.appendChild(
                button
            );

        }
    );


    updateTaskbarState();

}


/* =========================================================
   TASKBAR STATE
   ========================================================= */

function updateTaskbarState() {

    SOC.taskbarButtons.forEach(
        (
            button,
            appId
        ) => {

            const windowElement =
                getWindowForApp(
                    appId
                );


            if (!windowElement) {

                button.classList.remove(
                    "active"
                );

                button.classList.remove(
                    "taskbar-running"
                );


                return;

            }


            button.classList.add(
                "taskbar-running"
            );


            const minimized =
                windowElement.classList.contains(
                    "window-minimized"
                );


            const focused =
                Number(
                    windowElement.style.zIndex
                ) ===
                SOC.highestZIndex;


            button.classList.toggle(
                "active",
                !minimized &&
                focused
            );

        }
    );

}


/* =========================================================
   WINDOW DRAGGING
   ========================================================= */

function enableWindowDragging(
    windowElement
) {

    const titlebar =
        windowElement.querySelector(
            ".window-titlebar"
        );


    if (!titlebar) return;


    let dragging = false;

    let offsetX = 0;

    let offsetY = 0;


    titlebar.addEventListener(
        "mousedown",
        event => {

            if (
                event.target.closest(
                    ".window-controls"
                )
            ) {

                return;

            }


            if (
                windowElement.classList.contains(
                    "window-maximized"
                )
            ) {

                return;

            }


            dragging = true;


            const rect =
                windowElement.getBoundingClientRect();


            offsetX =
                event.clientX -
                rect.left;


            offsetY =
                event.clientY -
                rect.top;


            focusWindow(
                windowElement
            );


            event.preventDefault();

        }
    );


    function move(
        event
    ) {

        if (!dragging) return;


        let left =
            event.clientX -
            offsetX;


        let top =
            event.clientY -
            offsetY;


        const maxLeft =
            Math.max(
                0,
                window.innerWidth -
                windowElement.offsetWidth
            );


        const maxTop =
            Math.max(
                0,
                window.innerHeight -
                80
            );


        left =
            Math.max(
                -windowElement.offsetWidth + 100,
                Math.min(
                    left,
                    maxLeft
                )
            );


        top =
            Math.max(
                0,
                Math.min(
                    top,
                    maxTop
                )
            );


        windowElement.style.left =
            `${left}px`;


        windowElement.style.top =
            `${top}px`;

    }


    function stop() {

        dragging = false;

    }


    document.addEventListener(
        "mousemove",
        move
    );


    document.addEventListener(
        "mouseup",
        stop
    );

}


/* =========================================================
   WINDOW RESIZING
   ========================================================= */

function enableWindowResizing(
    windowElement
) {

    const handles =
        windowElement.querySelectorAll(
            ".window-resize-handle"
        );


    handles.forEach(
        handle => {

            handle.addEventListener(
                "mousedown",
                event => {

                    event.preventDefault();

                    event.stopPropagation();


                    if (
                        windowElement.classList.contains(
                            "window-maximized"
                        )
                    ) {

                        return;

                    }


                    focusWindow(
                        windowElement
                    );


                    const direction =
                        handle.dataset.resize;


                    const startX =
                        event.clientX;


                    const startY =
                        event.clientY;


                    const rect =
                        windowElement.getBoundingClientRect();


                    const startLeft =
                        rect.left;


                    const startTop =
                        rect.top;


                    const startWidth =
                        rect.width;


                    const startHeight =
                        rect.height;


                    const minimumWidth =
                        400;


                    const minimumHeight =
                        250;


                    function resize(
                        moveEvent
                    ) {

                        const deltaX =
                            moveEvent.clientX -
                            startX;


                        const deltaY =
                            moveEvent.clientY -
                            startY;


                        let width =
                            startWidth;


                        let height =
                            startHeight;


                        let left =
                            startLeft;


                        let top =
                            startTop;


                        if (
                            direction.includes(
                                "e"
                            )
                        ) {

                            width =
                                Math.max(
                                    minimumWidth,
                                    startWidth +
                                    deltaX
                                );

                        }


                        if (
                            direction.includes(
                                "s"
                            )
                        ) {

                            height =
                                Math.max(
                                    minimumHeight,
                                    startHeight +
                                    deltaY
                                );

                        }


                        if (
                            direction.includes(
                                "w"
                            )
                        ) {

                            width =
                                Math.max(
                                    minimumWidth,
                                    startWidth -
                                    deltaX
                                );


                            left =
                                startLeft +
                                (
                                    startWidth -
                                    width
                                );

                        }


                        if (
                            direction.includes(
                                "n"
                            )
                        ) {

                            height =
                                Math.max(
                                    minimumHeight,
                                    startHeight -
                                    deltaY
                                );


                            top =
                                startTop +
                                (
                                    startHeight -
                                    height
                                );

                        }


                        windowElement.style.width =
                            `${width}px`;


                        windowElement.style.height =
                            `${height}px`;


                        windowElement.style.left =
                            `${left}px`;


                        windowElement.style.top =
                            `${top}px`;

                    }


                    function stopResize() {

                        document.removeEventListener(
                            "mousemove",
                            resize
                        );


                        document.removeEventListener(
                            "mouseup",
                            stopResize
                        );

                    }


                    document.addEventListener(
                        "mousemove",
                        resize
                    );


                    document.addEventListener(
                        "mouseup",
                        stopResize
                    );

                }
            );

        }
    );

}


/* =========================================================
   DESKTOP APP BUTTONS
   ========================================================= */

function initializeDesktopAppButtons() {

    if (!desktop) return;


    const appButtons =
        desktop.querySelectorAll(
            "[data-app]"
        );


    appButtons.forEach(
        button => {

            if (
                button.dataset.socBound ===
                "true"
            ) {

                return;

            }


            button.dataset.socBound =
                "true";


            button.addEventListener(
                "dblclick",
                event => {

                    event.stopPropagation();


                    const appId =
                        button.dataset.app;


                    if (!appId) return;


                    openApplication(
                        appId
                    );


                    closeStartMenu();

                    closeContextMenu();

                }
            );

        }
    );

}


/* =========================================================
   START MENU APP BUTTONS
   ========================================================= */

function initializeStartMenuButtons() {

    if (!startMenu) return;


    const buttons =
        startMenu.querySelectorAll(
            "[data-app]"
        );


    buttons.forEach(
        button => {

            if (
                button.dataset.socBound ===
                "true"
            ) {

                return;

            }


            button.dataset.socBound =
                "true";


            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();


                    const appId =
                        button.dataset.app;


                    if (!appId) return;


                    openApplication(
                        appId
                    );


                    closeStartMenu();

                }
            );

        }
    );

}


/* =========================================================
   START BUTTON EVENTS
   ========================================================= */

function initializeStartButton() {

    if (!startButton) return;


    startButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            toggleStartMenu();

        }
    );

}


/* =========================================================
   GLOBAL CLICK EVENTS
   ========================================================= */

function initializeGlobalClicks() {

    document.addEventListener(
        "click",
        event => {

            if (
                startMenu &&
                !startMenu.contains(
                    event.target
                ) &&
                event.target !== startButton
            ) {

                closeStartMenu();

            }


            if (
                contextMenu &&
                !contextMenu.contains(
                    event.target
                )
            ) {

                closeContextMenu();

            }

        }
    );

}


/* =========================================================
   DESKTOP CONTEXT MENU
   ========================================================= */

function initializeContextMenu() {

    if (!desktop) return;


    desktop.addEventListener(
        "contextmenu",
        event => {

            event.preventDefault();


            showContextMenu(
                event.clientX,
                event.clientY
            );

        }
    );

}


/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

function initializeKeyboardShortcuts() {

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {

                closeStartMenu();

                closeContextMenu();

            }


            /*
             * CTRL + ALT + T
             * Opens terminal.
             */

            if (
                event.ctrlKey &&
                event.altKey &&
                event.key.toLowerCase() ===
                "t"
            ) {

                event.preventDefault();


                openApplication(
                    "terminal"
                );

            }

        }
    );

}


/* =========================================================
   CONTEXT MENU ACTIONS
   ========================================================= */

function initializeContextActions() {

    if (!contextMenu) return;


    const refresh =
        contextMenu.querySelector(
            '[data-action="refresh"]'
        );


    const terminal =
        contextMenu.querySelector(
            '[data-action="terminal"]'
        );


    const closeWindows =
        contextMenu.querySelector(
            '[data-action="close-windows"]'
        );


    if (refresh) {

        refresh.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                closeContextMenu();


                window.location.reload();

            }
        );

    }


    if (terminal) {

        terminal.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                closeContextMenu();


                openApplication(
                    "terminal"
                );

            }
        );

    }


    if (closeWindows) {

        closeWindows.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                closeContextMenu();


                [...SOC.windows.keys()]
                    .forEach(
                        appId => {

                            closeWindow(
                                appId
                            );

                        }
                    );

            }
        );

    }

}


/* =========================================================
   TEMPORARY — DEMO LOCKED FILE
   ---------------------------------------------------------
   A throwaway target so Password Cracker has something real
   to link to. Not tied to any real investigation data —
   safe to delete this whole function (and its call in
   initializeSOC) along with the desktop icon whenever it's
   no longer needed.
   ========================================================= */

/* =========================================================
   DECRYPTED FILE REVEAL MODAL
   ---------------------------------------------------------
   A styled popup for Password Cracker's unlock callbacks —
   fits the app's own red/black theme instead of a raw
   browser alert(). Call this from any registered target's
   `unlock` callback:

     showDecryptedFileModal("some-file.txt", "contents here");

   ========================================================= */

function showDecryptedFileModal(fileName, content) {

    const existing =
        document.querySelector(".npc-reveal-backdrop");

    if (existing) {
        existing.remove();
    }

    const backdrop =
        document.createElement("div");

    backdrop.className =
        "npc-reveal-backdrop";

    backdrop.innerHTML = `
        <div class="npc-reveal-modal">
            <div class="npc-reveal-header">
                <span class="npc-reveal-icon">📄</span>
                <span class="npc-reveal-filename">${escapeHTML(fileName)}</span>
                <button type="button" class="npc-reveal-close">×</button>
            </div>
            <div class="npc-reveal-label">RECOVERED CONTENTS</div>
            <div class="npc-reveal-content">${escapeHTML(content)}</div>
        </div>
    `;

    document.body.appendChild(backdrop);

    const close = () => backdrop.remove();

    backdrop.querySelector(".npc-reveal-close").addEventListener("click", close);

    backdrop.addEventListener("click", event => {
        if (event.target === backdrop) close();
    });

}


/*
 * Exposed so other modules (e.g. FileExplorerStore, for real
 * locked-file unlock reveals) can call this without needing
 * a circular import back into script.js.
 */
window.showDecryptedFileModal = showDecryptedFileModal;


/* =========================================================
   CREDENTIAL VAULT REVEAL — credential_backup.kdbx
   ---------------------------------------------------------
   A real password-manager-style export instead of a wall of
   plain text. Nothing here shouts "suspicious" — the tell is
   noticing that one row (the NORTHSTAR Admin Console entry)
   is the real domain-admin account, sitting in a personal
   password backup where it never should have been stored.
   ========================================================= */

const NORTHSTAR_VAULT_ENTRIES = [
    { title: "NORTHSTAR Expense Portal", username: "mnguyen@northstar.local", password: "Qp7!vRt2vLmZ", url: "expenses.northstar.local" },
    { title: "Corporate VPN — Personal", username: "mnguyen", password: "Vpn#84xNueZq", url: "vpn.northstar.local" },
    { title: "Payroll Self-Service", username: "mnguyen@northstar.local", password: "Pay$52ktRbnW", url: "payroll.northstar.local" },
    { title: "NORTHSTAR Admin Console", username: "admin@northstar.local", password: "Adm!n99cXqLp", url: "admin.northstar.local" },
    { title: "Personal Email", username: "mnguyen@gmail.com", password: "Gml*61fWzTku", url: "mail.google.com" },
    { title: "Streaming Service", username: "mnguyen", password: "Str8@29pJhYs", url: "netflix.com" }
];

function showCredentialVaultModal(fileName) {

    const existing =
        document.querySelector(".ns-vault-overlay");

    if (existing) {
        existing.remove();
    }

    const overlay =
        document.createElement("div");

    overlay.className = "ns-vault-overlay";

    const rows =
        NORTHSTAR_VAULT_ENTRIES.map((entry, index) => `
            <div class="ns-vault-row">
                <div class="ns-vault-cell ns-vault-cell-title">${escapeHTML(entry.title)}</div>
                <div class="ns-vault-cell ns-vault-cell-user">
                    <span>${escapeHTML(entry.username)}</span>
                    <button type="button" class="ns-vault-copy" data-vault-copy="${escapeHTML(entry.username)}" title="Copy username" aria-label="Copy username">⧉</button>
                </div>
                <div class="ns-vault-cell ns-vault-cell-pass">
                    <span class="ns-vault-pass-value" data-vault-pass="${escapeHTML(entry.password)}" data-revealed="false">••••••••••••</span>
                    <button type="button" class="ns-vault-eye" data-vault-toggle="${index}" title="Show/hide password" aria-label="Show/hide password">👁</button>
                    <button type="button" class="ns-vault-copy" data-vault-copy="${escapeHTML(entry.password)}" title="Copy password" aria-label="Copy password">⧉</button>
                </div>
                <div class="ns-vault-cell ns-vault-cell-url">${escapeHTML(entry.url)}</div>
            </div>
        `).join("");

    overlay.innerHTML = `
        <div class="ns-vault-modal" role="dialog" aria-label="${escapeHTML(fileName)}">

            <div class="ns-vault-header">
                <div>
                    <div class="ns-vault-kicker">PASSWORD MANAGER — RECOVERED VAULT</div>
                    <h2>${escapeHTML(fileName)}</h2>
                </div>
                <button type="button" class="ns-vault-close" data-vault-close>×</button>
            </div>

            <div class="ns-vault-table">
                <div class="ns-vault-row ns-vault-row-header">
                    <div class="ns-vault-cell">TITLE</div>
                    <div class="ns-vault-cell">USERNAME</div>
                    <div class="ns-vault-cell">PASSWORD</div>
                    <div class="ns-vault-cell">URL</div>
                </div>
                ${rows}
            </div>

            <div class="ns-vault-footer">
                ${NORTHSTAR_VAULT_ENTRIES.length} saved entries recovered from the encrypted database.
            </div>

        </div>
    `;

    const close = () => overlay.remove();

    overlay.addEventListener("click", event => {

        const toggle =
            event.target.closest("[data-vault-toggle]");

        if (toggle) {

            const valueSpan =
                toggle.parentElement.querySelector("[data-vault-pass]");

            if (valueSpan) {

                const revealed =
                    valueSpan.dataset.revealed === "true";

                valueSpan.textContent =
                    revealed
                        ? "••••••••••••"
                        : valueSpan.dataset.vaultPass;

                valueSpan.dataset.revealed =
                    String(!revealed);
            }

            return;
        }

        const copyButton =
            event.target.closest("[data-vault-copy]");

        if (copyButton) {

            const text =
                copyButton.dataset.vaultCopy || "";

            if (text && navigator.clipboard?.writeText) {

                navigator.clipboard.writeText(text).catch(() => {});

                const original =
                    copyButton.textContent;

                copyButton.textContent = "✓";

                setTimeout(() => {
                    copyButton.textContent = original;
                }, 1000);
            }

            return;
        }

        if (
            event.target === overlay ||
            event.target.closest("[data-vault-close]")
        ) {
            close();
        }
    });

    document.body.appendChild(overlay);
}

window.showCredentialVaultModal = showCredentialVaultModal;


/* =========================================================
   FINANCE REPORT REVEAL — locked_finance_archive.zip
   ---------------------------------------------------------
   Generates a real PDF (reusing Mail's PdfGenerator.js) that
   reads like a routine internal disbursement ledger. The tell
   is one anomalous line item (an unfamiliar payee, an oddly
   round amount) sitting quietly among ordinary transactions —
   never called out with a label. Rendered in the same inline
   iframe lightbox Mail's own PDF viewer uses (reusing its
   .mail-pdf-* classes, which are globally available), so it
   never relies on window.open() being un-blocked.
   ========================================================= */

function buildFinanceReportPdfContent() {

    return {
        title: "Q3 Disbursement Ledger",
        subtitle: "NORTHSTAR INC. — FINANCE DEPARTMENT — INTERNAL RECORD",
        sections: [
            {
                heading: "Account Summary",
                body:
                    "This record reflects outbound disbursements processed against the Finance department's " +
                    "operating account for the period ending July 31, 2026. Entries are compiled from the " +
                    "payment processor's monthly export and are provided for internal reconciliation only."
            },
            {
                heading: "Disbursement Log — July 2026",
                body:
                    "07/14  ACH   Meridian Cloud Hosting Services            $4,820.00   REF: ACH-2207-114\n" +
                    "07/19  ACH   Northstar Payroll Processing (ADP)        $58,412.33   REF: ACH-2207-119\n" +
                    "07/22  WIRE  Sterling Office Supply Co.                 $1,120.44   REF: WIRE-2207-004\n" +
                    "07/26  WIRE  Bright Ledger Monitoring Services          $2,400.00   REF: WIRE-2207-005\n" +
                    "07/27  WIRE  Vantage Point Consolidated Holdings LLC   $85,000.00   REF: WIRE-2207-006\n" +
                    "07/29  ACH   Regional Utilities Co-op                    $612.90    REF: ACH-2207-121"
            },
            {
                heading: "Reconciliation Notes",
                body:
                    "All entries above have been matched against processor confirmations. Outstanding items, " +
                    "if any, are carried forward to the following period's reconciliation. Direct questions " +
                    "regarding vendor payment history to Accounts Payable."
            }
        ]
    };
}

function showFinanceReportModal(fileName) {

    const existing =
        document.querySelector(".mail-pdf-overlay");

    if (existing) {
        existing.remove();
    }

    const overlay =
        document.createElement("div");

    overlay.className = "mail-pdf-overlay";

    overlay.innerHTML = `
        <div class="mail-pdf-modal" role="dialog" aria-label="${escapeHTML(fileName)}">

            <div class="mail-pdf-header">
                <div class="mail-pdf-header-title">
                    <div class="mail-pdf-kicker">DOCUMENT</div>
                    <h2>${escapeHTML(fileName)}</h2>
                </div>
                <div class="mail-pdf-header-actions">
                    <button class="mail-pdf-download" data-pdf-download disabled>Download</button>
                    <button class="mail-pdf-close" data-pdf-close>×</button>
                </div>
            </div>

            <div class="mail-pdf-body">
                <div class="mail-pdf-loading">
                    <span class="mail-pdf-spinner"></span>
                    Generating document...
                </div>
            </div>

        </div>
    `;

    document.body.appendChild(overlay);

    const closeAndCleanup = () => {

        const iframe =
            overlay.querySelector("iframe");

        if (iframe?.src) {
            URL.revokeObjectURL(iframe.src);
        }

        overlay.remove();
    };

    overlay.querySelectorAll("[data-pdf-close]").forEach(button => {
        button.addEventListener("click", closeAndCleanup);
    });

    overlay.addEventListener("click", event => {
        if (event.target === overlay) {
            closeAndCleanup();
        }
    });

    import("./mail/PdfGenerator.js")
        .then(module =>
            module.buildReviewPdf(buildFinanceReportPdfContent())
        )
        .then(({ blobUrl }) => {

            const body =
                overlay.querySelector(".mail-pdf-body");

            if (!body) {
                URL.revokeObjectURL(blobUrl);
                return;
            }

            body.innerHTML = `<iframe src="${blobUrl}" title="${escapeHTML(fileName)}"></iframe>`;

            const downloadButton =
                overlay.querySelector("[data-pdf-download]");

            if (downloadButton) {

                downloadButton.disabled = false;

                downloadButton.addEventListener("click", () => {

                    const link =
                        document.createElement("a");

                    link.href = blobUrl;
                    link.download = fileName;
                    link.click();
                });
            }
        })
        .catch(error => {

            console.error("[FILE EXPLORER] Failed to generate finance report PDF:", error);

            const body =
                overlay.querySelector(".mail-pdf-body");

            if (body) {

                body.innerHTML = `
                    <div class="mail-pdf-error">
                        Couldn't generate this document. Check your connection and try again.
                    </div>
                `;
            }
        });
}

window.showFinanceReportModal = showFinanceReportModal;


/* =========================================================
   INITIALIZATION
   ========================================================= */

function initializeSOC() {

    if (SOC.initialized) {

        return;

    }


    SOC.initialized =
        true;


    startClock();

    initializeStartButton();

    initializeDesktopAppButtons();

    initializeStartMenuButtons();

    initializeGlobalClicks();

    initializeContextMenu();

    initializeContextActions();

    initializeKeyboardShortcuts();

    startBootSequence();


    console.log(
        "%cNORTHSTAR SOC COMMAND CENTER",
        "font-size: 18px; font-weight: bold;"
    );

    console.log(
        "%cDesktop window manager initialized.",
        "color: #6fa8ff;"
    );

    window.setTimeout(() => {

        console.log(
            "%cSimulation engines:",
            "color: #6fa8ff;"
        );

        console.log(
            "EventEngine:",
            window.eventEngine
                ? "ONLINE"
                : "NOT LOADED"
        );

        console.log(
            "AttackEngine:",
            window.attackEngine
                ? "ONLINE"
                : "NOT LOADED"
        );

        console.log(
            "AlertManager:",
            window.alertManager
                ? "ONLINE"
                : "NOT LOADED"
        );

        console.log(
            "NetworkStore:",
            window.networkStore
                ? "ONLINE"
                : "NOT LOADED"
        );

        console.log(
            "PacketEngine:",
            window.packetEngine
                ? "ONLINE"
                : "NOT LOADED"
        );

    }, 500);

}


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeSOC
    );

}

else {

    initializeSOC();

}


/* =========================================================
   OPTIONAL GLOBAL API
   ========================================================= */

window.SOCCommandCenter = {

    openApplication,

    closeWindow,

    minimizeWindow,

    maximizeWindow,

    restoreWindow,

    focusWindow,

    getWindowForApp,

    syncTaskbar,

    closeStartMenu,

    applications,

    state: SOC

};