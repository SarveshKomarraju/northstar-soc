/* =========================================================
   NORTHSTAR SOC — SCENARIO SELECT
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       REAL-WORLD EXAMPLE DATA
       ---------------------------------------------------
       Backs each card's "REAL-WORLD EXAMPLE" trigger — an
       icon, a general description of the attack technique,
       a real (historical, publicly reported) case study, and
       a small illustrative trend graph showing how that real
       company was affected. Numbers are simplified/rounded
       for a small in-game chart, not exact company data — see
       the disclaimer rendered under the graph in index.html.
       ===================================================== */

    const SCENARIO_INFO = {

        "credential-theft": {

            label: "Credential Theft",

            color: "#6fb2e0",

            icon: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="8" cy="12" r="4.2"></circle>
                    <path d="M11.8 12h9.2M17 12v3M20 12v2.4"></path>
                </svg>
            `,

            about:
                "Credential theft attacks trick or trap someone into handing over a working username and password — usually through a phishing email, a fake login page, or malware that logs keystrokes. Once attackers have valid credentials, they can log in like a normal employee, which makes their activity far harder to spot than an obvious “hack.” A single stolen password, especially one tied to a vendor or contractor, is often all it takes to open a door into a much larger network.",

            example:
                "In December 2013, attackers stole network credentials from an HVAC vendor through a phishing email, then used that access to plant malware on Target's point-of-sale systems. Roughly 40 million payment card numbers and 70 million customer records were stolen during the holiday shopping season. Target's Q4 profit fell 46% year-over-year, and the company ultimately spent over $200 million on investigation, legal fees, and an $18.5 million multistate settlement.",

            graphTitle:
                "Target Corp. — quarterly profit index",

            graphCaption:
                "Target's holiday-quarter profit fell 46% year-over-year the quarter the breach was disclosed, before recovering the following year. (Index rebased to 100 at Q4 2012.)",

            graphPoints: [
                { label: "Q4 2012", value: 100, valueLabel: "100" },
                { label: "Q4 2013", value: 54, valueLabel: "-46%" },
                { label: "Q4 2014", value: 92, valueLabel: "92" }
            ]

        },


        "ransomware": {

            label: "Ransomware",

            color: "#d4917a",

            icon: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="6" y="11" width="12" height="9" rx="1.5"></rect>
                    <path d="M9 11V8a3 3 0 0 1 6 0v3"></path>
                    <circle cx="12" cy="15" r="1.1" fill="currentColor" stroke="none"></circle>
                    <path d="M12 16.1V18"></path>
                </svg>
            `,

            about:
                "Ransomware encrypts an organization's files and systems, then demands payment — usually in cryptocurrency — for the decryption key. Attackers often get in first through phishing, a stolen password, or an exposed remote-access system, then quietly explore the network before triggering the encryption to maximize damage and leverage. Even when a ransom is paid, recovery can take days or weeks, and some data is never fully restored.",

            example:
                "In May 2021, the DarkSide ransomware group got into Colonial Pipeline's network through a single compromised VPN password with no multi-factor authentication. To contain the damage, Colonial proactively shut down its entire 5,500-mile pipeline — nearly half of the U.S. East Coast's fuel supply — for about six days, causing panic buying and fuel shortages across the Southeast. The company paid roughly $4.4 million in Bitcoin ransom; the Justice Department later recovered about $2.3 million of it.",

            graphTitle:
                "Colonial Pipeline — pipeline capacity",

            graphCaption:
                "The pipeline was taken fully offline on May 7, 2021 as a precaution, then restarted in stages from May 12 once systems were confirmed clean.",

            graphPoints: [
                { label: "May 6", value: 100, valueLabel: "100%" },
                { label: "May 7", value: 0, valueLabel: "0%" },
                { label: "May 10", value: 0, valueLabel: "0%" },
                { label: "May 12", value: 40, valueLabel: "40%" },
                { label: "May 15", value: 100, valueLabel: "100%" }
            ]

        },


        "worm-outbreak": {

            label: "Worm Outbreak",

            color: "#6cc9a2",

            icon: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <ellipse cx="12" cy="13.5" rx="4.3" ry="5.8"></ellipse>
                    <path d="M12 7.7V4M9.3 9 6.3 6M14.7 9l3-3M8.1 12.5H3.3M15.9 12.5h4.8M8.4 17l-3 3M15.6 17l3 3"></path>
                </svg>
            `,

            about:
                "A worm is self-propagating malware that spreads on its own from machine to machine across a network, without needing a person to click anything after the initial infection. Once inside, it can move laterally through shared drives, remote services, or stolen credentials, infecting hundreds or thousands of devices within minutes to hours. Because it spreads automatically, a worm outbreak can escalate from “one infected laptop” to “entire company offline” faster than any human response team can react.",

            example:
                "In June 2017, the NotPetya worm spread through a hijacked update for Ukrainian accounting software, then propagated on its own using stolen credentials and a Windows networking exploit. It hit shipping giant Maersk within minutes, taking systems down at port terminals worldwide. Maersk's IT teams had to reinstall roughly 4,000 servers and 45,000 PCs from scratch in just 10 days, and the company later estimated the total cost at $250–300 million.",

            graphTitle:
                "Maersk — IT systems restored",

            graphCaption:
                "Maersk rebuilt its entire global IT infrastructure — about 4,000 servers and 45,000 PCs — from scratch in a 10-day emergency effort.",

            graphPoints: [
                { label: "Day 0", value: 0, valueLabel: "0%" },
                { label: "Day 3", value: 15, valueLabel: "15%" },
                { label: "Day 6", value: 55, valueLabel: "55%" },
                { label: "Day 10", value: 100, valueLabel: "100%" }
            ]

        }

    };


    function escapeInfoText(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

    }


    /**
     * Small inline-SVG line/area chart for the info modal's
     * "how the company was affected" graph. All our series are
     * 0-100 scales (an index rebased to 100, or a plain percent),
     * so the plotting math stays generic across all 3 cards.
     */
    function buildTrendGraphSvg(points, color) {

        const width = 540;
        const height = 170;

        const paddingX = 26;
        const paddingTop = 20;
        const paddingBottom = 30;

        const plotWidth =
            width - paddingX * 2;

        const plotHeight =
            height - paddingTop - paddingBottom;

        const stepX =
            points.length > 1
                ? plotWidth / (points.length - 1)
                : 0;


        const coords =
            points.map((point, index) => {

                const x =
                    paddingX + stepX * index;

                const clamped =
                    Math.max(0, Math.min(100, point.value));

                const y =
                    paddingTop + plotHeight - (clamped / 100) * plotHeight;

                return { ...point, x, y };

            });


        const linePath =
            coords
                .map((c, i) =>
                    `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`
                )
                .join(" ");

        const baselineY =
            (paddingTop + plotHeight).toFixed(1);

        const areaPath =
            `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${baselineY} ` +
            `L ${coords[0].x.toFixed(1)} ${baselineY} Z`;

        const gridLines =
            [0, 25, 50, 75, 100]
                .map(value => {

                    const y =
                        (paddingTop + plotHeight - (value / 100) * plotHeight).toFixed(1);

                    return `<line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}" class="scenario-graph-gridline" />`;

                })
                .join("");

        const dots =
            coords
                .map(c => `
                    <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.5" fill="${color}"></circle>
                    <text x="${c.x.toFixed(1)}" y="${(c.y - 10).toFixed(1)}" class="scenario-graph-value" text-anchor="middle">${escapeInfoText(c.valueLabel ?? c.value)}</text>
                    <text x="${c.x.toFixed(1)}" y="${(height - 6).toFixed(1)}" class="scenario-graph-label" text-anchor="middle">${escapeInfoText(c.label)}</text>
                `)
                .join("");


        return `
            <svg viewBox="0 0 ${width} ${height}" class="scenario-graph-svg" role="img">
                ${gridLines}
                <path d="${areaPath}" fill="${color}" opacity="0.14"></path>
                <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"></path>
                ${dots}
            </svg>
        `;

    }


    const ScenarioSelect = {

        element: null,
        initialized: false,


        /* =================================================
           INITIALIZE
           ================================================= */

        init() {

            this.element =
                document.getElementById(
                    "scenario-select"
                );


            if (!this.element) {

                console.error(
                    "[NORTHSTAR SCENARIO SELECT] #scenario-select not found."
                );

                return false;

            }


            if (this.initialized) {
                return true;
            }


            this.bindEvents();


            this.initialized = true;


            console.log(
                "[NORTHSTAR SCENARIO SELECT] ONLINE"
            );


            return true;

        },


        /* =================================================
           EVENTS
           ================================================= */

        bindEvents() {

            /*
             * Scenario cards.
             */

            this.element
                .querySelectorAll(
                    ".scenario-card"
                )
                .forEach(card => {

                    if (
                        card.dataset.northstarBound ===
                        "true"
                    ) {
                        return;
                    }


                    card.dataset.northstarBound =
                        "true";


                    card.addEventListener(
                        "click",
                        event => {

                            event.preventDefault();
                            event.stopPropagation();


                            /*
                             * Locked ("COMING SOON") cards are
                             * visible but not launchable — the
                             * ransomware and worm-outbreak
                             * operations aren't built yet.
                             */

                            if (
                                card.classList.contains(
                                    "scenario-locked"
                                )
                            ) {
                                return;
                            }


                            const scenario =
                                card.dataset.scenario;


                            this.selectScenario(
                                scenario
                            );

                        }
                    );

                });


            /*
             * BACK button.
             */

            const back =
                document.getElementById(
                    "scenario-back"
                );


            if (back) {

                back.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();


                        this.backToMainMenu();

                    }
                );

            }


            /*
             * "REAL-WORLD EXAMPLE" triggers + their shared modal.
             */

            this.bindScenarioInfoTriggers();

        },


        /* =================================================
           REAL-WORLD EXAMPLE MODAL
           ---------------------------------------------------
           Each card's ".scenario-info-trigger" is a <span
           role="button">, not a nested <button> — a real
           <button> can't legally sit inside the outer
           ".scenario-card" button, and a click here has to
           stopPropagation() so it never also triggers that
           card's "launch mission" click handler above.
           ================================================= */

        bindScenarioInfoTriggers() {

            document
                .querySelectorAll("[data-scenario-info]")
                .forEach(trigger => {

                    if (
                        trigger.dataset.northstarInfoBound ===
                        "true"
                    ) {
                        return;
                    }

                    trigger.dataset.northstarInfoBound =
                        "true";


                    const open = event => {

                        event.preventDefault();
                        event.stopPropagation();

                        this.openScenarioInfo(
                            trigger.dataset.scenarioInfo
                        );

                    };


                    trigger.addEventListener(
                        "click",
                        open
                    );


                    trigger.addEventListener(
                        "keydown",
                        event => {

                            if (
                                event.key === "Enter" ||
                                event.key === " "
                            ) {

                                open(event);

                            }

                        }
                    );

                });


            const modal =
                document.getElementById(
                    "scenario-info-modal"
                );


            if (!modal) {
                return;
            }


            const closeButton =
                document.getElementById(
                    "scenario-info-close"
                );

            if (closeButton) {

                closeButton.addEventListener(
                    "click",
                    () => this.closeScenarioInfo()
                );

            }


            modal.addEventListener(
                "click",
                event => {

                    if (event.target === modal) {

                        this.closeScenarioInfo();

                    }

                }
            );


            document.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Escape" &&
                        !modal.classList.contains("hidden")
                    ) {

                        this.closeScenarioInfo();

                    }

                }
            );

        },


        openScenarioInfo(scenarioId) {

            const info =
                SCENARIO_INFO[scenarioId];

            const modal =
                document.getElementById(
                    "scenario-info-modal"
                );


            if (!info || !modal) {
                return;
            }


            const iconEl =
                document.getElementById("scenario-info-icon");

            const titleEl =
                document.getElementById("scenario-info-title");

            const aboutEl =
                document.getElementById("scenario-info-about");

            const exampleEl =
                document.getElementById("scenario-info-example");

            const graphTitleEl =
                document.getElementById("scenario-info-graph-title");

            const graphEl =
                document.getElementById("scenario-info-graph");

            const graphCaptionEl =
                document.getElementById("scenario-info-graph-caption");


            if (iconEl) {

                iconEl.innerHTML =
                    info.icon;

                iconEl.style.color =
                    info.color;

            }

            if (titleEl) {

                titleEl.textContent =
                    info.label;

            }

            if (aboutEl) {

                aboutEl.textContent =
                    info.about;

            }

            if (exampleEl) {

                exampleEl.textContent =
                    info.example;

            }

            if (graphTitleEl) {

                graphTitleEl.textContent =
                    info.graphTitle;

            }

            if (graphEl) {

                graphEl.innerHTML =
                    buildTrendGraphSvg(
                        info.graphPoints,
                        info.color
                    );

            }

            if (graphCaptionEl) {

                graphCaptionEl.textContent =
                    info.graphCaption;

            }


            modal.classList.remove(
                "hidden"
            );

        },


        closeScenarioInfo() {

            const modal =
                document.getElementById(
                    "scenario-info-modal"
                );

            if (modal) {

                modal.classList.add(
                    "hidden"
                );

            }

        },


        /* =================================================
           SELECT
           ================================================= */

        selectScenario(scenarioId) {

            if (!scenarioId) {

                console.error(
                    "[NORTHSTAR SCENARIO SELECT] No scenario ID."
                );

                return;

            }


            console.log(
                "[NORTHSTAR SCENARIO SELECT] Selected:",
                scenarioId
            );


            /*
             * Visual selection — the reload below is near-
             * instant, but this still gives a beat of visible
             * acknowledgment before the screen goes.
             */

            this.element
                .querySelectorAll(
                    ".scenario-card"
                )
                .forEach(card => {

                    card.classList.toggle(
                        "selected",
                        card.dataset.scenario ===
                        scenarioId
                    );

                });


            /*
             * Starting a brand-new operation has to guarantee a
             * genuinely clean simulation — every store (mail,
             * endpoints, files, alerts...) is a singleton created
             * once at page load with no reset of its own, so a
             * real reload is the only reliable way to get that.
             * MainMenu.js's beginNewOperation() persists the
             * scenario choice, flags a pending launch, and
             * reloads; boot picks it back up from there (see
             * script.js's showMainMenu() /
             * MainMenu.launchPendingOperation()), including
             * Marcus's briefing before the desktop appears.
             */

            setTimeout(
                () => {

                    if (
                        window.NorthstarMainMenu &&
                        typeof window.NorthstarMainMenu.beginNewOperation ===
                        "function"
                    ) {

                        window.NorthstarMainMenu.beginNewOperation(
                            scenarioId
                        );

                        return;

                    }


                    /*
                     * Fallback if MainMenu.js somehow isn't
                     * loaded — old direct-launch behavior rather
                     * than silently doing nothing.
                     */

                    window.NorthstarScenario =
                        scenarioId;

                    localStorage.setItem(
                        "northstar-selected-scenario",
                        scenarioId
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
                120
            );

        },


        /* =================================================
           BACK
           ================================================= */

        backToMainMenu() {

            console.log(
                "[NORTHSTAR SCENARIO SELECT] Returning to main menu."
            );


            this.hide();


            const desktop =
                document.getElementById(
                    "desktop"
                );


            if (desktop) {

                desktop.classList.remove(
                    "visible"
                );

            }


            if (
                window.NorthstarMainMenu &&
                typeof window.NorthstarMainMenu.show ===
                "function"
            ) {

                window.NorthstarMainMenu.show();

                return;

            }


            console.error(
                "[NORTHSTAR SCENARIO SELECT] Main menu unavailable."
            );

        },


        /* =================================================
           SHOW
           ================================================= */

        show() {

            if (!this.init()) {
                return;
            }


            /*
             * Hide desktop.
             */

            const desktop =
                document.getElementById(
                    "desktop"
                );


            if (desktop) {

                desktop.classList.remove(
                    "visible"
                );

            }


            /*
             * Hide main menu.
             */

            if (
                window.NorthstarMainMenu &&
                typeof window.NorthstarMainMenu.hide ===
                "function"
            ) {

                window.NorthstarMainMenu.hide();

            }


            /*
             * Show scenario selector.
             */

            this.element.classList.remove(
                "hidden"
            );


            console.log(
                "[NORTHSTAR SCENARIO SELECT] SHOW"
            );

        },


        /* =================================================
           HIDE
           ================================================= */

        hide() {

            if (!this.element) {
                return;
            }


            this.element.classList.add(
                "hidden"
            );

        },


        /* =================================================
           DESKTOP
           ================================================= */

        launchDesktop() {

            this.hide();


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

                desktop.classList.add(
                    "visible"
                );

            }

        }

    };


    /* =====================================================
       GLOBAL
       ===================================================== */

    window.NorthstarScenarioSelect =
        ScenarioSelect;


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            () => ScenarioSelect.init(),
            { once: true }
        );

    } else {

        ScenarioSelect.init();

    }

})();