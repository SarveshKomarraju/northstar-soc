/* =========================================================
   NORTHSTAR SOC — DESKTOP FEATURES
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       APPLICATION DEFINITIONS
       ===================================================== */

    const APPS = {

        siem: {
            name: "SIEM",
            icon: "▤"
        },

        alerts: {
            name: "Alerts",
            icon: "!"
        },

        network: {
            name: "Network",
            icon: "⌁"
        },

        map: {
            name: "Attack Map",
            icon: "◎"
        },

        email: {
            name: "Mail",
            icon: "✉"
        },

        hosts: {
            name: "Endpoints",
            icon: "▣"
        },

        vpn: {
            name: "VPN",
            icon: "🔒"
        },

        files: {
            name: "File Explorer",
            icon: "📁"
        },

        playbook: {
            name: "IR Playbook",
            icon: "📖"
        },

        cracker: {
            name: "Password Cracker",
            icon: "🔓"
        },

        intel: {
            name: "Threat Intel",
            icon: "🔎"
        },

        iam: {
            name: "IAM",
            icon: "ID"
        },

        sandbox: {
            name: "Malware Sandbox",
            icon: "🧪"
        },

        terminal: {
            name: "Terminal",
            icon: ">_"
        }

    };


    /* =====================================================
       DEFAULT PINS
       ===================================================== */

    const DEFAULT_PINS = [
        "siem",
        "alerts",
        "network",
        "email"
    ];


    const STORAGE_KEY =
        "northstar-taskbar-pins";


    /* =====================================================
       PERSONALIZATION
       ===================================================== */

    const PERSONALIZATION_KEY =
        "northstar-desktop-personalization";


    const DEFAULT_PERSONALIZATION = {

        accent: "blue",

        background: "command"

    };


    /* =====================================================
       DESKTOP BACKGROUNDS
       ===================================================== */

    const BACKGROUNDS = [

        ["command", "Command Center", "Balanced ops-room glow — the default"],

        ["aurora", "Aurora Circuit", "Cyan and blue signal bloom"],

        ["matrix", "Signal Matrix", "Green phosphor terminal grid"],

        ["crimson", "Threat State", "Deep red high-alert theme"]

    ];


    let personalizationTab = "accent";


    /* =====================================================
       DISPLAY SETTINGS
       ===================================================== */

    const DISPLAY_KEY =
        "northstar-desktop-display";


    const DEFAULT_DISPLAY = {

        scale: 100,

        iconSize: "normal",

        taskbarSize: "normal",

        showIcons: true,

        showClock: true,

        density: "normal",

        reducedMotion: false

    };


    let displaySettings = {
        ...DEFAULT_DISPLAY
    };


    /* =====================================================
       STATE
       ===================================================== */

    let pinnedApps = [];

    let selectedContextApp = null;

    let personalization = {
        ...DEFAULT_PERSONALIZATION
    };


    /* =====================================================
       INITIALIZATION
       ===================================================== */

    /*
     * Any desktop-icon button whose app was stripped out of APPS
     * above (scenario-locked — see ACTIVE_SCENARIO) gets hidden
     * here. Inline style.display, not the `hidden` attribute —
     * .desktop-icon's own `display` rule in style.css ties the
     * [hidden] UA default on specificity and would win by cascade
     * order, so `hidden` alone would not actually hide it.
     */
    function hideScenarioLockedIcons() {

        document.querySelectorAll(
            ".desktop-icon"
        ).forEach(
            icon => {

                const appId =
                    icon.dataset.app;


                if (!APPS[appId]) {

                    icon.style.display =
                        "none";

                }

            }
        );

    }


    function init() {

        hideScenarioLockedIcons();

        loadPins();

        loadPersonalization();

        loadDisplaySettings();

        renderTaskbar();

        renderStartMenuPins();

        bindSearch();

        bindContextMenu();

        bindDesktopAppMenus();

        bindAccountMenu();

        applyPersonalization();

        applyDisplaySettings();

        console.log(
            "[DESKTOP] Desktop features initialized."
        );

    }


    /* =====================================================
       PIN STORAGE
       ===================================================== */

    function loadPins() {

        try {

            const saved =
                localStorage.getItem(
                    STORAGE_KEY
                );


            if (saved) {

                const parsed =
                    JSON.parse(saved);


                if (Array.isArray(parsed)) {

                    pinnedApps =
                        parsed.filter(
                            id => APPS[id]
                        );


                    if (pinnedApps.length > 0) {
                        return;
                    }

                }

            }

        } catch (error) {

            console.warn(
                "[DESKTOP] Could not load pins.",
                error
            );

        }


        pinnedApps =
            [...DEFAULT_PINS];

    }


    function savePins() {

        try {

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(pinnedApps)
            );

        } catch (error) {

            console.warn(
                "[DESKTOP] Could not save pins.",
                error
            );

        }

    }


    /* =====================================================
       PERSONALIZATION STORAGE
       ===================================================== */

    function loadPersonalization() {

        try {

            const saved =
                localStorage.getItem(
                    PERSONALIZATION_KEY
                );


            if (saved) {

                const parsed =
                    JSON.parse(saved);


                if (
                    parsed &&
                    typeof parsed === "object"
                ) {

                    personalization = {
                        ...DEFAULT_PERSONALIZATION,
                        ...parsed
                    };

                }

            }

        } catch (error) {

            console.warn(
                "[DESKTOP] Could not load personalization.",
                error
            );

            personalization = {
                ...DEFAULT_PERSONALIZATION
            };

        }

    }


    function savePersonalization() {

        try {

            localStorage.setItem(
                PERSONALIZATION_KEY,
                JSON.stringify(personalization)
            );

        } catch (error) {

            console.warn(
                "[DESKTOP] Could not save personalization.",
                error
            );

        }

    }


    /* =====================================================
       DISPLAY SETTINGS STORAGE
       ===================================================== */

    function loadDisplaySettings() {

        try {

            const saved =
                localStorage.getItem(
                    DISPLAY_KEY
                );


            if (saved) {

                const parsed =
                    JSON.parse(saved);


                if (
                    parsed &&
                    typeof parsed === "object"
                ) {

                    displaySettings = {
                        ...DEFAULT_DISPLAY,
                        ...parsed
                    };

                }

            }

        } catch (error) {

            console.warn(
                "[DESKTOP] Could not load display settings.",
                error
            );

            displaySettings = {
                ...DEFAULT_DISPLAY
            };

        }

    }


    function saveDisplaySettings() {

        try {

            localStorage.setItem(
                DISPLAY_KEY,
                JSON.stringify(displaySettings)
            );

        } catch (error) {

            console.warn(
                "[DESKTOP] Could not save display settings.",
                error
            );

        }

    }


    function applyPersonalization() {

        const desktop =
            document.getElementById("desktop");

        if (!desktop) {
            return;
        }


        /*
        * Apply accent color.
        */

        document.documentElement.style.setProperty(
            "--northstar-accent",
            getAccentColor(
                personalization.accent
            )
        );


        /*
        * Apply desktop wallpaper.
        */

        Array.from(desktop.classList)
            .filter(
                className => className.indexOf("northstar-bg-") === 0
            )
            .forEach(
                className => {

                    desktop.classList.remove(
                        className
                    );

                }
            );


        desktop.classList.add(
            `northstar-bg-${personalization.background ||
            DEFAULT_PERSONALIZATION.background
            }`
        );


        /*
        * Notify the rest of NORTHSTAR.
        */

        document.dispatchEvent(
            new CustomEvent(
                "northstar:personalization-changed",
                {
                    detail: {
                        ...personalization
                    }
                }
            )
        );

    }


    function getAccentColor(
        accent
    ) {

        const accents = {

            blue: "#6fa8ff",

            cyan: "#65d9ff",

            green: "#69d99a",

            violet: "#9d8cff",

            amber: "#e7b86a",

            red: "#ff7180"

        };


        return accents[accent] ||
            accents.blue;

    }

    /* =====================================================
       DISPLAY SETTINGS APPLICATION
       ===================================================== */

    function applyDisplaySettings() {

        const root =
            document.documentElement;

        const desktop =
            document.getElementById(
                "desktop"
            );


        /*
         * UI scale
         */

        root.style.setProperty(
            "--northstar-ui-scale",
            displaySettings.scale / 100
        );


        root.style.setProperty(
            "--northstar-icon-scale",
            getIconScale(
                displaySettings.iconSize
            )
        );


        root.style.setProperty(
            "--northstar-taskbar-height",
            getTaskbarHeight(
                displaySettings.taskbarSize
            )
        );


        if (desktop) {

            desktop.classList.toggle(
                "northstar-hide-desktop-icons",
                !displaySettings.showIcons
            );


            desktop.classList.toggle(
                "northstar-compact-desktop",
                displaySettings.density === "compact"
            );


            desktop.classList.toggle(
                "northstar-reduced-motion",
                displaySettings.reducedMotion
            );

        }


        document.body.classList.toggle(
            "northstar-reduced-motion",
            displaySettings.reducedMotion
        );


        const clock =
            document.querySelector(
                ".tray-time"
            );


        if (clock) {

            clock.classList.toggle(
                "northstar-hidden-clock",
                !displaySettings.showClock
            );

        }


        document.dispatchEvent(
            new CustomEvent(
                "northstar:display-settings-changed",
                {
                    detail: {
                        ...displaySettings
                    }
                }
            )
        );

    }


    function getIconScale(
        size
    ) {

        if (size === "small") {
            return 0.82;
        }


        if (size === "large") {
            return 1.18;
        }


        return 1;

    }


    function getTaskbarHeight(
        size
    ) {

        if (size === "small") {
            return "48px";
        }


        if (size === "large") {
            return "68px";
        }


        return "58px";

    }


    /* =====================================================
       TASKBAR
       ===================================================== */

    function renderTaskbar() {

        /*
         * Actual button creation/reconciliation lives in
         * script.js's syncTaskbar() now — it's the one place
         * that knows about BOTH pin state (via getPins() below)
         * AND which apps have a live window open, which is what
         * it takes to never show a pinned app's icon twice the
         * moment it's opened. This function stays (rather than
         * renaming every call site) so init()/pin()/unpin()/
         * togglePin() don't need to change.
         */

        if (
            window.SOCCommandCenter &&
            typeof window.SOCCommandCenter.syncTaskbar ===
            "function"
        ) {

            window.SOCCommandCenter.syncTaskbar();

        }

    }


    /* =====================================================
       START MENU — PINNED SECTION
       ---------------------------------------------------
       The Start Menu's PINNED grid used to be 4 buttons
       hardcoded straight into index.html — pinning/unpinning a
       different app from the taskbar's right-click menu never
       touched it, so the two "pinned" lists could disagree.
       Rebuilt from the same pinnedApps state the taskbar uses,
       every time it changes.
       ===================================================== */

    function renderStartMenuPins() {

        const grid =
            document.querySelector(
                "#start-menu .start-grid"
            );


        if (!grid) {
            return;
        }


        grid.innerHTML = "";


        pinnedApps.forEach(
            appId => {

                const app =
                    APPS[appId];


                if (!app) {
                    return;
                }


                const button =
                    document.createElement(
                        "button"
                    );


                button.type =
                    "button";


                button.dataset.app =
                    appId;


                button.innerHTML = `
                    <span>
                        ${app.icon}
                    </span>
                    ${app.name}
                `;


                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        event.stopPropagation();


                        openApp(appId);


                        if (
                            window.SOCCommandCenter &&
                            typeof window.SOCCommandCenter.closeStartMenu ===
                            "function"
                        ) {

                            window.SOCCommandCenter.closeStartMenu();

                        }

                    }
                );


                button.addEventListener(
                    "contextmenu",
                    event => {

                        event.preventDefault();

                        event.stopPropagation();


                        showAppContextMenu(
                            event.clientX,
                            event.clientY,
                            appId
                        );

                    }
                );


                grid.appendChild(
                    button
                );

            }
        );

    }


    /* =====================================================
       OPEN APPLICATION
       ===================================================== */

    function openApp(appId) {

        if (!APPS[appId]) {

            console.warn(
                `[DESKTOP] Unknown application: ${appId}`
            );

            return;

        }


        /*
        * The real desktop/start-menu icons only open their
        * app on DOUBLE click (see script.js), so a simulated
        * single .click() on them does nothing. Go straight
        * through the app-opening API script.js exposes.
        */

        if (
            window.openApplication &&
            typeof window.openApplication === "function"
        ) {

            window.openApplication(
                appId
            );

            return;

        }


        const desktopButton =
            document.querySelector(
                `.desktop-icon[data-app="${appId}"]`
            );


        if (desktopButton) {

            desktopButton.dispatchEvent(
                new MouseEvent(
                    "dblclick",
                    {
                        bubbles: true,
                        cancelable: true
                    }
                )
            );

            return;

        }


        console.warn(
            `[DESKTOP] Could not open application: ${appId}`
        );

    }


    /* =====================================================
       SEARCH
       ===================================================== */

    function bindSearch() {

        const input =
            document.getElementById(
                "taskbar-search-input"
            );


        const results =
            document.getElementById(
                "search-results"
            );


        if (!input || !results) {
            return;
        }


        input.addEventListener(
            "input",
            () => {

                const query =
                    input.value
                        .trim()
                        .toLowerCase();


                if (!query) {

                    hideSearchResults();

                    return;

                }


                const matches =
                    Object.entries(APPS)
                        .filter(
                            ([id, app]) => {

                                return (
                                    app.name
                                        .toLowerCase()
                                        .includes(query) ||

                                    id
                                        .toLowerCase()
                                        .includes(query)
                                );

                            }
                        );


                renderSearchResults(
                    matches
                );

            }
        );


        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();


                    const firstResult =
                        results.querySelector(
                            "[data-search-app]"
                        );


                    if (firstResult) {

                        openApp(
                            firstResult.dataset.searchApp
                        );


                        input.value = "";

                        hideSearchResults();

                        input.blur();

                    }

                }


                if (
                    event.key === "Escape"
                ) {

                    event.preventDefault();

                    input.value = "";

                    hideSearchResults();

                    input.blur();

                }

            }
        );


        input.addEventListener(
            "focus",
            () => {

                const query =
                    input.value
                        .trim()
                        .toLowerCase();


                if (!query) {
                    return;
                }


                const matches =
                    Object.entries(APPS)
                        .filter(
                            ([id, app]) => {

                                return (
                                    app.name
                                        .toLowerCase()
                                        .includes(query) ||

                                    id
                                        .toLowerCase()
                                        .includes(query)
                                );

                            }
                        );


                renderSearchResults(
                    matches
                );

            }
        );


        document.addEventListener(
            "click",
            event => {

                if (
                    !event.target.closest(
                        "#taskbar-search"
                    ) &&
                    !event.target.closest(
                        "#search-results"
                    )
                ) {

                    hideSearchResults();

                }

            }
        );

    }


    /* =====================================================
       SEARCH RESULTS
       ===================================================== */

    function renderSearchResults(
        matches
    ) {

        const results =
            document.getElementById(
                "search-results"
            );


        if (!results) {
            return;
        }


        results.innerHTML = "";


        if (!matches.length) {

            results.innerHTML = `
                <div class="search-no-results">
                    No applications found
                </div>
            `;


            results.classList.remove(
                "hidden"
            );


            return;

        }


        matches.forEach(
            ([id, app]) => {

                const item =
                    document.createElement(
                        "button"
                    );


                item.type =
                    "button";


                item.className =
                    "search-result";


                item.dataset.searchApp =
                    id;


                item.innerHTML = `
                    <span class="search-result-icon">
                        ${app.icon}
                    </span>

                    <span class="search-result-name">
                        ${app.name}
                    </span>
                `;


                item.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        event.stopPropagation();


                        openApp(id);


                        const input =
                            document.getElementById(
                                "taskbar-search-input"
                            );


                        if (input) {

                            input.value = "";

                            input.blur();

                        }


                        hideSearchResults();

                    }
                );


                results.appendChild(
                    item
                );

            }
        );


        results.classList.remove(
            "hidden"
        );

    }


    function hideSearchResults() {

        const results =
            document.getElementById(
                "search-results"
            );


        if (results) {

            results.classList.add(
                "hidden"
            );

        }

    }


    /* =====================================================
       CONTEXT MENU
       ===================================================== */

    function bindContextMenu() {

        const desktop =
            document.getElementById(
                "desktop"
            );


        const menu =
            document.getElementById(
                "context-menu"
            );


        if (!desktop || !menu) {
            return;
        }


        desktop.addEventListener(
            "contextmenu",
            event => {

                if (
                    event.target.closest(
                        ".desktop-icon"
                    )
                ) {

                    return;

                }


                if (
                    event.target.closest(
                        ".app-window"
                    )
                ) {

                    return;

                }


                if (
                    event.target.closest(
                        ".taskbar"
                    )
                ) {

                    return;

                }


                event.preventDefault();

                event.stopPropagation();


                showDesktopContextMenu(
                    event.clientX,
                    event.clientY
                );

            }
        );


        menu.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "button[data-context-action]"
                    );


                if (!button) {
                    return;
                }


                event.preventDefault();

                event.stopPropagation();


                const action =
                    button.dataset.contextAction;


                handleContextAction(
                    action
                );

            }
        );


        document.addEventListener(
            "click",
            event => {

                if (
                    !event.target.closest(
                        "#context-menu"
                    )
                ) {

                    hideContextMenu();

                }

            }
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Escape"
                ) {

                    hideContextMenu();

                }

            }
        );

    }


    /* =====================================================
       DESKTOP APP RIGHT CLICK
       ===================================================== */

    function bindDesktopAppMenus() {

        const icons =
            document.querySelectorAll(
                ".desktop-icon"
            );


        icons.forEach(
            icon => {

                icon.addEventListener(
                    "contextmenu",
                    event => {

                        event.preventDefault();

                        event.stopPropagation();


                        const appId =
                            icon.dataset.app;


                        if (!APPS[appId]) {
                            return;
                        }


                        showAppContextMenu(
                            event.clientX,
                            event.clientY,
                            appId
                        );

                    }
                );

            }
        );

    }


    /* =====================================================
       START MENU
       ===================================================== */

    /*
     * bindStartMenuApps() used to live here — it manually bound
     * click listeners onto the Start Menu's PINNED grid buttons
     * separately from script.js's own initializeStartMenuButtons(),
     * so the two files were quietly double-binding the same
     * buttons. renderStartMenuPins() now builds that grid AND
     * binds it in one place, so this is gone rather than kept
     * as dead weight.
     */


    /* =====================================================
       ACCOUNT MENU (SOC Analyst profile)
       ---------------------------------------------------
       Clicking the profile row at the top of the Start Menu
       opens a small flyout with the two things there's actually
       a meaningful difference between: Save and Quit (records a
       save slot first) and Quit (doesn't). Everything else about
       leaving — the "SESSION TERMINATED" screen, returning to
       the main menu — already exists in MainMenu.js's
       exitOperation(), so both just call straight into that
       once the (optional) save is written.
       ===================================================== */

    function bindAccountMenu() {

        const profile =
            document.querySelector(
                ".start-profile"
            );


        if (!profile) {
            return;
        }


        profile.addEventListener(
            "click",
            event => {

                event.preventDefault();

                event.stopPropagation();


                toggleAccountMenu(
                    profile
                );

            }
        );


        document.addEventListener(
            "click",
            event => {

                const menu =
                    document.getElementById(
                        "account-menu"
                    );


                if (!menu) {
                    return;
                }


                if (
                    menu.contains(event.target) ||
                    profile.contains(event.target)
                ) {
                    return;
                }


                hideAccountMenu();

            }
        );


        document.addEventListener(
            "keydown",
            event => {

                if (event.key === "Escape") {

                    hideAccountMenu();

                }

            }
        );

    }


    function toggleAccountMenu(anchor) {

        if (
            document.getElementById(
                "account-menu"
            )
        ) {

            hideAccountMenu();

        } else {

            showAccountMenu(
                anchor
            );

        }

    }


    function showAccountMenu(anchor) {

        hideAccountMenu();


        const menu =
            document.createElement(
                "div"
            );


        menu.id =
            "account-menu";


        menu.className =
            "account-menu";


        const savesApi =
            window.NorthstarSaveSlots;

        const hasSaves =
            Boolean(
                savesApi &&
                typeof savesApi.getAll === "function" &&
                savesApi.getAll().length > 0
            );


        menu.innerHTML = `

            <button
                type="button"
                class="account-menu-item account-menu-save"
                data-account-action="save-quit"
            >
                <span class="account-menu-icon">⤓</span>
                <span class="account-menu-text">
                    <strong>Save and Quit</strong>
                    <small>Save this session, then exit</small>
                </span>
            </button>

            <button
                type="button"
                class="account-menu-item account-menu-replace"
                data-account-action="replace-save"
                ${hasSaves ? "" : "disabled"}
            >
                <span class="account-menu-icon">⇄</span>
                <span class="account-menu-text">
                    <strong>Replace a Save</strong>
                    <small>${hasSaves
                    ? "Overwrite an existing save, then exit"
                    : "No saves yet to replace"
                }</small>
                </span>
            </button>

            <button
                type="button"
                class="account-menu-item account-menu-quit"
                data-account-action="quit"
            >
                <span class="account-menu-icon">×</span>
                <span class="account-menu-text">
                    <strong>Quit</strong>
                    <small>Exit without saving</small>
                </span>
            </button>

        `;


        anchor.appendChild(
            menu
        );


        menu
            .querySelector('[data-account-action="quit"]')
            .addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    performQuit();

                }
            );


        menu
            .querySelector('[data-account-action="save-quit"]')
            .addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    performSaveAndQuit();

                }
            );


        const replaceButton =
            menu.querySelector(
                '[data-account-action="replace-save"]'
            );

        if (replaceButton) {

            replaceButton.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    if (replaceButton.disabled) {
                        return;
                    }

                    performReplaceSave();

                }
            );

        }

    }


    function hideAccountMenu() {

        const menu =
            document.getElementById(
                "account-menu"
            );


        if (menu) {
            menu.remove();
        }

    }


    /* =====================================================
       QUIT / SAVE AND QUIT
       ===================================================== */

    function performQuit() {

        hideAccountMenu();


        if (
            window.NorthstarMainMenu &&
            typeof window.NorthstarMainMenu.exitOperation ===
            "function"
        ) {

            window.NorthstarMainMenu.exitOperation();

        } else {

            console.warn(
                "[DESKTOP] Main menu unavailable — cannot quit."
            );

        }

    }


    async function performSaveAndQuit() {

        hideAccountMenu();


        const api =
            window.NorthstarSaveSlots;


        if (!api) {

            console.warn(
                "[DESKTOP] Save system unavailable — quitting without saving."
            );

            performQuit();

            return;

        }


        const scenario =
            window.NorthstarScenario ||
            localStorage.getItem(
                "northstar-selected-scenario"
            ) ||
            "free-operation";


        const thumbnail =
            await captureDesktopThumbnail();


        if (!api.isFull()) {

            api.createSave({
                scenario,
                thumbnail
            });


            performQuit();


            return;

        }


        /*
         * All 3 slots are full — the player picks which one to
         * overwrite rather than something getting silently
         * dropped.
         */

        showOverwriteSlotPicker(
            api.getAll(),
            selectedId => {

                if (!selectedId) {
                    /* Cancelled — stay in the desktop. */
                    return;
                }


                api.overwriteSave(
                    selectedId,
                    {
                        scenario,
                        thumbnail
                    }
                );


                performQuit();

            }
        );

    }


    /**
     * "Replace a Save" — the player's explicit choice to overwrite
     * one of their existing saves with the current session, rather
     * than only being offered that choice once all 3 slots are
     * full (see performSaveAndQuit() above). Always shows the
     * picker against every existing save; the account menu item
     * itself is disabled when there are none yet (see
     * showAccountMenu()), so this is only ever reached with at
     * least one save to offer.
     */
    async function performReplaceSave() {

        hideAccountMenu();


        const api =
            window.NorthstarSaveSlots;


        if (!api) {

            console.warn(
                "[DESKTOP] Save system unavailable — cannot replace a save."
            );

            return;

        }


        const saves =
            api.getAll();


        if (!saves.length) {
            return;
        }


        const scenario =
            window.NorthstarScenario ||
            localStorage.getItem(
                "northstar-selected-scenario"
            ) ||
            "free-operation";


        const thumbnail =
            await captureDesktopThumbnail();


        showOverwriteSlotPicker(
            saves,
            selectedId => {

                if (!selectedId) {
                    /* Cancelled — stay in the desktop. */
                    return;
                }


                api.overwriteSave(
                    selectedId,
                    {
                        scenario,
                        thumbnail
                    }
                );


                performQuit();

            },
            {
                title: "Replace a Save",
                subtitle: "Choose a save to overwrite with your current session."
            }
        );

    }


    /**
     * A downscaled JPEG snapshot of the whole desktop, for a
     * save's thumbnail — same html2canvas the Capture Tool
     * already uses (capture/CaptureTool.js), just scaled way
     * down since up to 3 of these live in localStorage rather
     * than becoming an in-game file.
     */
    function captureDesktopThumbnail() {

        return new Promise(resolve => {

            try {

                const desktopEl =
                    document.getElementById(
                        "desktop"
                    );


                if (
                    !desktopEl ||
                    typeof html2canvas !== "function"
                ) {

                    resolve(null);

                    return;

                }


                html2canvas(
                    desktopEl,
                    {
                        backgroundColor: null,
                        useCORS: true,
                        logging: false
                    }
                )
                    .then(fullCanvas => {

                        const targetWidth = 480;

                        const scale =
                            targetWidth / fullCanvas.width;

                        const targetHeight =
                            Math.max(
                                1,
                                Math.round(fullCanvas.height * scale)
                            );


                        const thumbCanvas =
                            document.createElement("canvas");

                        thumbCanvas.width = targetWidth;
                        thumbCanvas.height = targetHeight;


                        thumbCanvas
                            .getContext("2d")
                            .drawImage(
                                fullCanvas,
                                0,
                                0,
                                targetWidth,
                                targetHeight
                            );


                        resolve(
                            thumbCanvas.toDataURL("image/jpeg", 0.6)
                        );

                    })
                    .catch(error => {

                        console.warn(
                            "[DESKTOP] Thumbnail capture failed.",
                            error
                        );

                        resolve(null);

                    });

            } catch (error) {

                console.warn(
                    "[DESKTOP] Thumbnail capture failed.",
                    error
                );

                resolve(null);

            }

        });

    }


    /* =====================================================
       SAVE-SLOT OVERWRITE PICKER
       ---------------------------------------------------
       Shown from performSaveAndQuit() (all 3 slots full — the
       title/subtitle default to that framing) and from
       performReplaceSave() (the player explicitly asked to
       replace one, so it passes its own title/subtitle via
       `options`). callback receives the chosen save's id, or
       null if the player cancelled.
       ===================================================== */

    function showOverwriteSlotPicker(saves, callback, options = {}) {

        const existing =
            document.getElementById(
                "northstar-slot-picker"
            );


        if (existing) {
            existing.remove();
        }


        const overlay =
            document.createElement("div");


        overlay.id =
            "northstar-slot-picker";


        overlay.className =
            "northstar-slot-picker";


        const title =
            options.title || "All 3 save slots are full";

        const subtitle =
            options.subtitle || "Choose a save to overwrite.";


        overlay.innerHTML = `

            <div class="northstar-slot-picker-box">

                <div class="northstar-slot-picker-title">
                    ${escapeAccountText(title)}
                </div>

                <div class="northstar-slot-picker-subtitle">
                    ${escapeAccountText(subtitle)}
                </div>

                <div class="northstar-slot-picker-grid">

                    ${saves.map(save => `

                        <button
                            type="button"
                            class="northstar-slot-card"
                            data-slot-id="${escapeAccountText(save.id)}"
                        >

                            <div
                                class="northstar-slot-thumb"
                                ${save.thumbnail
                    ? `style="background-image:url('${save.thumbnail}')"`
                    : ""
                }
                            >
                                ${save.thumbnail ? "" : "<span>No preview</span>"}
                            </div>

                            <div class="northstar-slot-name">
                                ${escapeAccountText(save.name)}
                            </div>

                            <div class="northstar-slot-date">
                                ${escapeAccountText(formatSlotDate(save.timestamp))}
                            </div>

                        </button>

                    `).join("")}

                </div>

                <button
                    type="button"
                    class="northstar-slot-picker-cancel"
                    id="northstar-slot-picker-cancel"
                >
                    Cancel
                </button>

            </div>

        `;


        document.body.appendChild(
            overlay
        );


        const finish = id => {

            overlay.remove();

            callback(id);

        };


        overlay
            .querySelectorAll("[data-slot-id]")
            .forEach(card => {

                card.addEventListener(
                    "click",
                    () => finish(card.dataset.slotId)
                );

            });


        document
            .getElementById("northstar-slot-picker-cancel")
            .addEventListener(
                "click",
                () => finish(null)
            );


        overlay.addEventListener(
            "click",
            event => {

                if (event.target === overlay) {
                    finish(null);
                }

            }
        );

    }


    function formatSlotDate(timestamp) {

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

    }


    function escapeAccountText(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    /* =====================================================
       DESKTOP CONTEXT MENU
       ===================================================== */

    function showDesktopContextMenu(
        x,
        y
    ) {

        const menu =
            document.getElementById(
                "context-menu"
            );


        const desktopActions =
            document.getElementById(
                "desktop-context-actions"
            );


        const appActions =
            document.getElementById(
                "app-context-actions"
            );


        if (!menu) {
            return;
        }


        selectedContextApp =
            null;


        if (desktopActions) {

            desktopActions.classList.remove(
                "hidden"
            );

        }


        if (appActions) {

            appActions.classList.add(
                "hidden"
            );

        }


        positionContextMenu(
            menu,
            x,
            y
        );

    }


    /* =====================================================
       APP CONTEXT MENU
       ===================================================== */

    function showAppContextMenu(
        x,
        y,
        appId
    ) {

        const app =
            APPS[appId];


        if (!app) {
            return;
        }


        const menu =
            document.getElementById(
                "context-menu"
            );


        const desktopActions =
            document.getElementById(
                "desktop-context-actions"
            );


        const appActions =
            document.getElementById(
                "app-context-actions"
            );


        if (!menu) {
            return;
        }


        selectedContextApp =
            appId;


        if (desktopActions) {

            desktopActions.classList.add(
                "hidden"
            );

        }


        if (appActions) {

            appActions.classList.remove(
                "hidden"
            );

        }


        const icon =
            document.getElementById(
                "context-app-icon"
            );


        const name =
            document.getElementById(
                "context-app-name"
            );


        const pinText =
            document.getElementById(
                "context-pin-text"
            );


        if (icon) {

            icon.textContent =
                app.icon;

        }


        if (name) {

            name.textContent =
                app.name;

        }


        if (pinText) {

            pinText.textContent =
                pinnedApps.includes(appId)
                    ? "Unpin from taskbar"
                    : "Pin to taskbar";

        }


        positionContextMenu(
            menu,
            x,
            y
        );

    }


    /* =====================================================
       POSITION CONTEXT MENU
       ===================================================== */

    function positionContextMenu(
        menu,
        x,
        y
    ) {

        menu.classList.remove(
            "hidden"
        );


        menu.style.left =
            `${x}px`;


        menu.style.top =
            `${y}px`;


        requestAnimationFrame(
            () => {

                const rect =
                    menu.getBoundingClientRect();


                let finalX =
                    x;


                let finalY =
                    y;


                if (
                    rect.right >
                    window.innerWidth
                ) {

                    finalX =
                        window.innerWidth -
                        rect.width -
                        8;

                }


                if (
                    rect.bottom >
                    window.innerHeight
                ) {

                    finalY =
                        window.innerHeight -
                        rect.height -
                        8;

                }


                menu.style.left =
                    `${Math.max(
                        8,
                        finalX
                    )}px`;


                menu.style.top =
                    `${Math.max(
                        8,
                        finalY
                    )}px`;

            }
        );

    }


    /* =====================================================
       HANDLE CONTEXT ACTION
       ===================================================== */

    function handleContextAction(
        action
    ) {

        /* =================================================
           REFRESH
           ================================================= */

        if (
            action === "refresh"
        ) {

            hideContextMenu();


            const desktop =
                document.getElementById(
                    "desktop"
                );


            if (desktop) {

                desktop.classList.remove(
                    "desktop-refresh"
                );


                void desktop.offsetWidth;


                desktop.classList.add(
                    "desktop-refresh"
                );


                setTimeout(
                    () => {

                        desktop.classList.remove(
                            "desktop-refresh"
                        );

                    },
                    600
                );

            }


            return;

        }


        /* =================================================
           DISPLAY SETTINGS
           ================================================= */

        if (
            action === "display"
        ) {

            hideContextMenu();

            showDisplaySettings();

            return;

        }


        /* =================================================
           PERSONALIZE
           ================================================= */

        if (
            action === "personalize"
        ) {

            hideContextMenu();

            showPersonalization();

            return;

        }


        /* =================================================
           APP ACTIONS
           ================================================= */

        if (!selectedContextApp) {
            return;
        }


        const appId =
            selectedContextApp;


        if (
            action === "open"
        ) {

            hideContextMenu();

            openApp(
                appId
            );

            return;

        }


        if (
            action === "pin"
        ) {

            togglePin(
                appId
            );

            hideContextMenu();

            return;

        }


        if (
            action === "close"
        ) {

            hideContextMenu();

            closeApp(
                appId
            );

            return;

        }

    }


    /* =====================================================
       PERSONALIZATION WINDOW
       ===================================================== */

    function showPersonalization(
        tab
    ) {

        if (tab) {

            personalizationTab =
                tab;

        }


        removeSystemPanel();


        const panel =
            document.createElement(
                "div"
            );


        panel.id =
            "northstar-personalization";


        panel.className =
            "northstar-system-panel";


        const accentSection = `

            <div class="northstar-settings-section">

                <div class="northstar-settings-section-title">
                    ACCENT COLOR
                </div>

                <div class="northstar-settings-section-description">
                    Choose the highlight color used across the NORTHSTAR interface.
                </div>

                <div class="northstar-accent-row">

                    ${[
                ["blue", "Command Blue"],
                ["cyan", "Cyber Cyan"],
                ["green", "Secure Green"],
                ["violet", "Violet Signal"],
                ["amber", "Amber Ops"],
                ["red", "Threat Red"]
            ]
                .map(
                    ([id, name]) => `

                                <button
                                    type="button"
                                    class="
                                        northstar-accent-option
                                        accent-${id}
                                        ${personalization.accent === id ? "selected" : ""}
                                    "
                                    data-accent="${id}"
                                    title="${name}"
                                >
                                    <span></span>
                                </button>

                            `
                )
                .join("")
            }

                </div>

            </div>

        `;


        const appearanceSection = `

            <div class="northstar-settings-section">

                <div class="northstar-settings-section-title">
                    DESKTOP BACKGROUND
                </div>

                <div class="northstar-settings-section-description">
                    Pick a wallpaper for the NORTHSTAR desktop.
                </div>

                <div class="northstar-background-grid">

                    ${BACKGROUNDS
                .map(
                    ([id, name, description]) => `

                                <button
                                    type="button"
                                    class="
                                        northstar-background-card
                                        northstar-bg-${id}
                                        ${personalization.background === id ? "selected" : ""}
                                    "
                                    data-background="${id}"
                                    title="${name}"
                                >

                                    <div class="northstar-background-preview"></div>

                                    <div class="northstar-background-info">

                                        <strong>
                                            ${name}
                                        </strong>

                                        <small>
                                            ${description}
                                        </small>

                                    </div>

                                    <span class="northstar-background-check">
                                        ✓
                                    </span>

                                </button>

                            `
                )
                .join("")
            }

                </div>

            </div>

        `;


        panel.innerHTML = `

            <div class="northstar-settings-window">

                <div class="northstar-settings-header">

                    <div>
                        <div class="northstar-settings-title">
                            Personalization
                        </div>

                        <div class="northstar-settings-subtitle">
                            NORTHSTAR WORKSTATION // DESKTOP APPEARANCE
                        </div>
                    </div>

                    <button
                        type="button"
                        class="northstar-settings-close"
                        data-system-close
                    >
                        ×
                    </button>

                </div>


                <div class="northstar-settings-layout">

                    <aside class="northstar-settings-sidebar">

                        <div
                            class="northstar-settings-nav ${personalizationTab === "accent" ? "active" : ""}"
                            data-settings-tab="accent"
                        >
                            <span>◈</span>
                            Accent
                        </div>

                        <div
                            class="northstar-settings-nav ${personalizationTab === "appearance" ? "active" : ""}"
                            data-settings-tab="appearance"
                        >
                            <span>◇</span>
                            Appearance
                        </div>

                    </aside>


                    <main class="northstar-settings-main">

                        ${personalizationTab === "appearance" ? appearanceSection : accentSection}

                    </main>

                </div>


                <div class="northstar-settings-footer">

                    <span>
                        Changes are saved automatically
                    </span>

                    <div>

                        <button
                            type="button"
                            class="northstar-secondary-button"
                            data-reset-personalization
                        >
                            Reset Defaults
                        </button>

                        <button
                            type="button"
                            class="northstar-primary-button"
                            data-system-close
                        >
                            Done
                        </button>

                    </div>

                </div>

            </div>

        `;


        document.body.appendChild(
            panel
        );


        bindPersonalizationPanel(
            panel
        );

    }


    function bindPersonalizationPanel(
        panel
    ) {

        panel.addEventListener(
            "click",
            event => {

                const close =
                    event.target.closest(
                        "[data-system-close]"
                    );


                if (close) {

                    removeSystemPanel();

                    return;

                }


                const tab =
                    event.target.closest(
                        "[data-settings-tab]"
                    );


                if (tab) {

                    showPersonalization(
                        tab.dataset.settingsTab
                    );

                    return;

                }


                const accent =
                    event.target.closest(
                        "[data-accent]"
                    );


                if (accent) {

                    const id =
                        accent.dataset.accent;


                    personalization.accent =
                        id;


                    savePersonalization();

                    applyPersonalization();


                    panel
                        .querySelectorAll(
                            "[data-accent]"
                        )
                        .forEach(
                            option => {

                                option.classList.toggle(
                                    "selected",
                                    option.dataset.accent === id
                                );

                            }
                        );

                    return;

                }


                const background =
                    event.target.closest(
                        "[data-background]"
                    );


                if (background) {

                    const id =
                        background.dataset.background;


                    personalization.background =
                        id;


                    savePersonalization();

                    applyPersonalization();


                    panel
                        .querySelectorAll(
                            "[data-background]"
                        )
                        .forEach(
                            card => {

                                card.classList.toggle(
                                    "selected",
                                    card.dataset.background === id
                                );

                            }
                        );

                    return;

                }


                const reset =
                    event.target.closest(
                        "[data-reset-personalization]"
                    );


                if (reset) {

                    personalization = {
                        ...DEFAULT_PERSONALIZATION
                    };


                    savePersonalization();

                    applyPersonalization();


                    showPersonalization();

                }

            }
        );


        panel.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Escape"
                ) {

                    removeSystemPanel();

                }

            }
        );


        const firstFocusable =
            panel.querySelector(
                "[data-accent], [data-background]"
            );


        if (firstFocusable) {
            firstFocusable.focus();
        }

    }


    /* =====================================================
       DISPLAY SETTINGS WINDOW
       ===================================================== */

    function showDisplaySettings() {

        removeSystemPanel();


        const panel =
            document.createElement(
                "div"
            );


        panel.id =
            "northstar-display-settings";


        panel.className =
            "northstar-system-panel";


        panel.innerHTML = `

            <div class="northstar-settings-window northstar-display-window">

                <div class="northstar-settings-header">

                    <div>

                        <div class="northstar-settings-title">
                            Display Settings
                        </div>

                        <div class="northstar-settings-subtitle">
                            NORTHSTAR WORKSTATION // DISPLAY CONFIGURATION
                        </div>

                    </div>


                    <button
                        type="button"
                        class="northstar-settings-close"
                        data-system-close
                    >
                        ×
                    </button>

                </div>


                <div class="northstar-display-content">


                    <!-- SCALE -->

                    <section class="northstar-display-section">

                        <div class="northstar-display-heading">

                            <div>

                                <strong>
                                    Interface Scale
                                </strong>

                                <span>
                                    Adjust the size of the NORTHSTAR interface.
                                </span>

                            </div>

                            <output
                                id="northstar-scale-value"
                                class="northstar-setting-value"
                            >
                                ${displaySettings.scale}%
                            </output>

                        </div>


                        <input
                            type="range"
                            id="northstar-scale-slider"
                            class="northstar-range"
                            min="80"
                            max="120"
                            step="5"
                            value="${displaySettings.scale}"
                        />


                        <div class="northstar-range-labels">

                            <span>80%</span>
                            <span>100%</span>
                            <span>120%</span>

                        </div>

                    </section>


                    <!-- ICON SIZE -->

                    <section class="northstar-display-section">

                        <div class="northstar-display-heading">

                            <div>

                                <strong>
                                    Desktop Icon Size
                                </strong>

                                <span>
                                    Change the scale of desktop application icons.
                                </span>

                            </div>

                        </div>


                        <div class="northstar-option-row">

                            ${[
                ["small", "Small", "Compact desktop"],
                ["normal", "Normal", "Recommended"],
                ["large", "Large", "High visibility"]
            ]
                .map(
                    ([id, name, description]) => `

                                        <button
                                            type="button"
                                            class="
                                                northstar-choice-card
                                                ${displaySettings.iconSize === id ? "selected" : ""}
                                            "
                                            data-icon-size="${id}"
                                        >

                                            <strong>
                                                ${name}
                                            </strong>

                                            <span>
                                                ${description}
                                            </span>

                                        </button>

                                    `
                )
                .join("")
            }

                        </div>

                    </section>


                    <!-- TASKBAR -->

                    <section class="northstar-display-section">

                        <div class="northstar-display-heading">

                            <div>

                                <strong>
                                    Taskbar Size
                                </strong>

                                <span>
                                    Change taskbar height and control spacing.
                                </span>

                            </div>

                        </div>


                        <div class="northstar-option-row">

                            ${[
                ["small", "Compact", "48 px"],
                ["normal", "Normal", "58 px"],
                ["large", "Large", "68 px"]
            ]
                .map(
                    ([id, name, description]) => `

                                        <button
                                            type="button"
                                            class="
                                                northstar-choice-card
                                                ${displaySettings.taskbarSize === id ? "selected" : ""}
                                            "
                                            data-taskbar-size="${id}"
                                        >

                                            <strong>
                                                ${name}
                                            </strong>

                                            <span>
                                                ${description}
                                            </span>

                                        </button>

                                    `
                )
                .join("")
            }

                        </div>

                    </section>


                    <!-- DESKTOP OPTIONS -->

                    <section class="northstar-display-section">

                        <div class="northstar-display-heading">

                            <div>

                                <strong>
                                    Desktop Behavior
                                </strong>

                                <span>
                                    Configure workstation visibility and density.
                                </span>

                            </div>

                        </div>


                        <div class="northstar-toggle-list">


                            <label class="northstar-toggle-row">

                                <span>

                                    <strong>
                                        Show desktop icons
                                    </strong>

                                    <small>
                                        Display application shortcuts on the desktop.
                                    </small>

                                </span>

                                <input
                                    type="checkbox"
                                    data-display-toggle="showIcons"
                                    ${displaySettings.showIcons ? "checked" : ""}
                                />

                                <span class="northstar-toggle-switch"></span>

                            </label>


                            <label class="northstar-toggle-row">

                                <span>

                                    <strong>
                                        Show clock
                                    </strong>

                                    <small>
                                        Display the system clock in the taskbar.
                                    </small>

                                </span>

                                <input
                                    type="checkbox"
                                    data-display-toggle="showClock"
                                    ${displaySettings.showClock ? "checked" : ""}
                                />

                                <span class="northstar-toggle-switch"></span>

                            </label>


                            <label class="northstar-toggle-row">

                                <span>

                                    <strong>
                                        Compact desktop
                                    </strong>

                                    <small>
                                        Reduce desktop spacing for a denser operations layout.
                                    </small>

                                </span>

                                <input
                                    type="checkbox"
                                    data-display-density
                                    ${displaySettings.density === "compact" ? "checked" : ""}
                                />

                                <span class="northstar-toggle-switch"></span>

                            </label>


                            <label class="northstar-toggle-row">

                                <span>

                                    <strong>
                                        Reduce motion
                                    </strong>

                                    <small>
                                        Disable non-essential desktop animations.
                                    </small>

                                </span>

                                <input
                                    type="checkbox"
                                    data-display-toggle="reducedMotion"
                                    ${displaySettings.reducedMotion ? "checked" : ""}
                                />

                                <span class="northstar-toggle-switch"></span>

                            </label>


                        </div>

                    </section>


                </div>


                <div class="northstar-settings-footer">

                    <span>
                        Changes are applied immediately
                    </span>

                    <div>

                        <button
                            type="button"
                            class="northstar-secondary-button"
                            data-reset-display
                        >
                            Reset Defaults
                        </button>

                        <button
                            type="button"
                            class="northstar-primary-button"
                            data-system-close
                        >
                            Done
                        </button>

                    </div>

                </div>

            </div>

        `;


        document.body.appendChild(
            panel
        );


        bindDisplayPanel(
            panel
        );

    }


    /* =====================================================
       DISPLAY PANEL EVENTS
       ===================================================== */

    function bindDisplayPanel(
        panel
    ) {

        const slider =
            panel.querySelector(
                "#northstar-scale-slider"
            );


        const scaleOutput =
            panel.querySelector(
                "#northstar-scale-value"
            );


        if (slider) {

            slider.addEventListener(
                "input",
                () => {

                    const value =
                        Number(
                            slider.value
                        );


                    displaySettings.scale =
                        value;


                    if (scaleOutput) {

                        scaleOutput.textContent =
                            `${value}%`;

                    }


                    saveDisplaySettings();

                    applyDisplaySettings();

                }
            );

        }


        panel.addEventListener(
            "click",
            event => {

                const close =
                    event.target.closest(
                        "[data-system-close]"
                    );


                if (close) {

                    removeSystemPanel();

                    return;

                }


                const iconSize =
                    event.target.closest(
                        "[data-icon-size]"
                    );


                if (iconSize) {

                    displaySettings.iconSize =
                        iconSize.dataset.iconSize;


                    saveDisplaySettings();

                    applyDisplaySettings();


                    panel
                        .querySelectorAll(
                            "[data-icon-size]"
                        )
                        .forEach(
                            button => {

                                button.classList.toggle(
                                    "selected",
                                    button.dataset.iconSize ===
                                    displaySettings.iconSize
                                );

                            }
                        );


                    return;

                }


                const taskbarSize =
                    event.target.closest(
                        "[data-taskbar-size]"
                    );


                if (taskbarSize) {

                    displaySettings.taskbarSize =
                        taskbarSize.dataset.taskbarSize;


                    saveDisplaySettings();

                    applyDisplaySettings();


                    panel
                        .querySelectorAll(
                            "[data-taskbar-size]"
                        )
                        .forEach(
                            button => {

                                button.classList.toggle(
                                    "selected",
                                    button.dataset.taskbarSize ===
                                    displaySettings.taskbarSize
                                );

                            }
                        );


                    return;

                }


                const reset =
                    event.target.closest(
                        "[data-reset-display]"
                    );


                if (reset) {

                    displaySettings = {
                        ...DEFAULT_DISPLAY
                    };


                    saveDisplaySettings();

                    applyDisplaySettings();


                    showDisplaySettings();

                }

            }
        );


        panel.addEventListener(
            "change",
            event => {

                const toggle =
                    event.target.closest(
                        "[data-display-toggle]"
                    );


                if (toggle) {

                    const setting =
                        toggle.dataset.displayToggle;


                    displaySettings[setting] =
                        toggle.checked;


                    saveDisplaySettings();

                    applyDisplaySettings();

                }


                const density =
                    event.target.closest(
                        "[data-display-density]"
                    );


                if (density) {

                    displaySettings.density =
                        density.checked
                            ? "compact"
                            : "normal";


                    saveDisplaySettings();

                    applyDisplaySettings();

                }

            }
        );


        panel.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Escape"
                ) {

                    removeSystemPanel();

                }

            }
        );


        if (slider) {
            slider.focus();
        }

    }


    /* =====================================================
       REMOVE SYSTEM PANEL
       ===================================================== */

    function removeSystemPanel() {

        const existing =
            document.querySelector(
                ".northstar-system-panel"
            );


        if (existing) {

            existing.classList.add(
                "northstar-panel-closing"
            );


            setTimeout(
                () => {

                    existing.remove();

                },
                120
            );

        }

    }


    /* =====================================================
       PIN / UNPIN
       ===================================================== */

    function togglePin(
        appId
    ) {

        if (!APPS[appId]) {
            return;
        }


        const index =
            pinnedApps.indexOf(
                appId
            );


        if (index === -1) {

            pinnedApps.push(
                appId
            );


            console.log(
                `[DESKTOP] Pinned ${appId}`
            );

        }

        else {

            pinnedApps.splice(
                index,
                1
            );


            console.log(
                `[DESKTOP] Unpinned ${appId}`
            );

        }


        savePins();

        renderTaskbar();

        renderStartMenuPins();

    }


    /* =====================================================
       CLOSE APPLICATION
       ===================================================== */

    function closeApp(
        appId
    ) {

        const windows =
            document.querySelectorAll(
                `.app-window[data-app="${appId}"]`
            );


        windows.forEach(
            windowElement => {

                const closeButton =
                    windowElement.querySelector(
                        ".window-close"
                    );


                if (closeButton) {

                    closeButton.click();

                }

                else {

                    windowElement.remove();

                }

            }
        );

    }


    /* =====================================================
       SYSTEM MESSAGE
       ===================================================== */

    function showSystemMessage(
        title,
        message
    ) {

        const existing =
            document.getElementById(
                "northstar-system-message"
            );


        if (existing) {
            existing.remove();
        }


        const modal =
            document.createElement(
                "div"
            );


        modal.id =
            "northstar-system-message";


        modal.innerHTML = `

            <div class="system-message-window">

                <div class="system-message-header">

                    <span>
                        ${title}
                    </span>


                    <button
                        type="button"
                        class="system-message-close"
                    >
                        ×
                    </button>

                </div>


                <div class="system-message-body">

                    ${message}

                </div>


                <button
                    type="button"
                    class="system-message-ok"
                >
                    OK
                </button>

            </div>

        `;


        document.body.appendChild(
            modal
        );


        const close =
            () => {

                modal.remove();

            };


        const closeButton =
            modal.querySelector(
                ".system-message-close"
            );


        const okButton =
            modal.querySelector(
                ".system-message-ok"
            );


        if (closeButton) {

            closeButton.addEventListener(
                "click",
                close
            );

        }


        if (okButton) {

            okButton.addEventListener(
                "click",
                close
            );

        }

    }


    /* =====================================================
       HIDE CONTEXT MENU
       ===================================================== */

    function hideContextMenu() {

        const menu =
            document.getElementById(
                "context-menu"
            );


        if (menu) {

            menu.classList.add(
                "hidden"
            );

        }


        selectedContextApp =
            null;

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.NorthstarDesktop = {

        pin(appId) {

            if (
                APPS[appId] &&
                !pinnedApps.includes(
                    appId
                )
            ) {

                pinnedApps.push(
                    appId
                );


                savePins();

                renderTaskbar();

                renderStartMenuPins();

            }

        },


        unpin(appId) {

            const index =
                pinnedApps.indexOf(
                    appId
                );


            if (index !== -1) {

                pinnedApps.splice(
                    index,
                    1
                );


                savePins();

                renderTaskbar();

                renderStartMenuPins();

            }

        },


        open:
            openApp,


        personalize:
            showPersonalization,


        displaySettings:
            showDisplaySettings,


        showAppContextMenu:
            showAppContextMenu,


        getPersonalization() {

            return {
                ...personalization
            };

        },


        getDisplaySettings() {

            return {
                ...displaySettings
            };

        },


        getPins() {

            return [
                ...pinnedApps
            ];

        }

    };


    /* =====================================================
       START DESKTOP FEATURES
       ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    }

    else {

        init();

    }

})();