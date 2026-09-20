/* =========================================================
   NORTHSTAR SOC — PASSWORD CRACKER
   File: password-cracker/PasswordCrackerApp.js

   SIMULATED SOC GAME COMPONENT

   This is a controlled simulation. It does not perform
   real password cracking or interact with real credentials.

   Other NORTHSTAR applications can register protected
   simulation targets through:

   window.NorthstarPasswordTargets.register({
       id: "target-id",
       label: "Protected File",
       password: "38160427",
       element: someElement,
       unlock: () => {
           // simulated unlock behavior
       }
   });

   IMPORTANT:
   Random UI elements cannot be linked.
   Only registered NORTHSTAR targets can be linked.
   ========================================================= */

const TARGET_REGISTRY_NAME =
    "NorthstarPasswordTargets";

const PASSWORD_LINK_EVENT =
    "northstar:password-link-request";

const PASSWORD_CRACKED_EVENT =
    "northstar:password-cracked";


/* =========================================================
   PASSWORD VAULT
   ---------------------------------------------------------
   The real, plaintext password for every registered target
   lives ONLY here — a closure-private Map, never attached to
   window.NorthstarPasswordTargets or to any object that
   registry.get()/all()/findFromElement() hand back. That
   public registry is genuinely global (window[...]) for other
   modules to register/link targets, so anything it returns is
   readable from devtools with zero effort
   (NorthstarPasswordTargets.all()) — the fix is keeping the
   secret out of what it returns, not trying to hide the
   registry itself.

   lookupPassword() is a plain module-scope function, not a
   method on the registry object, specifically so it can never
   be reached from outside this file.
   ========================================================= */

const passwordVault = new Map();

function lookupPassword(id) {
    return passwordVault.get(String(id)) || "";
}


/* =========================================================
   TARGET REGISTRY
   ========================================================= */

function createTargetRegistry() {

    if (window[TARGET_REGISTRY_NAME]) {
        return window[TARGET_REGISTRY_NAME];
    }

    const targets = new Map();

    const registry = {

        register(config = {}) {

            if (!config.id) {
                throw new Error(
                    "[PASSWORD CRACKER] Target requires an id."
                );
            }

            const password =
                String(config.password ?? "");

            /*
             * NORTHSTAR uses an 8-digit simulated keyspace.
             */
            if (!/^\d{8}$/.test(password)) {
                throw new Error(
                    "[PASSWORD CRACKER] Target password must be exactly 8 digits."
                );
            }

            /*
             * Callers (e.g. FileExplorerRenderer.registerPasswordTargets())
             * re-register the SAME target on every single render, because
             * rebuilding innerHTML each time throws away the old DOM
             * element and its data-ns-password-target tag along with it —
             * this has to run again to re-tag whatever element exists now.
             * That means "already cracked" is the normal, expected state
             * of a re-registration, not a fresh target — so linked/cracked
             * must carry over from any existing entry with this id, or a
             * crack gets silently wiped out the moment anything else
             * triggers a re-render right after (including the
             * northstar:password-cracked event this very crack fires).
             */
            const existing =
                targets.get(String(config.id));

            /*
             * The plaintext password NEVER goes on the target
             * object itself — it's kept in the private vault,
             * keyed by id, and looked up internally (see
             * lookupPassword()) only when the crack animation
             * actually needs it. Everything registry.get()/
             * all()/findFromElement() hand back stops at
             * {id, label, linked, cracked, metadata} — the
             * fields the UI actually renders.
             */
            passwordVault.set(
                String(config.id),
                password
            );

            const target = {

                id:
                    String(config.id),

                label:
                    String(
                        config.label ||
                        "Protected Target"
                    ),

                element:
                    config.element || null,

                unlock:
                    typeof config.unlock === "function"
                        ? config.unlock
                        : null,

                metadata:
                    config.metadata || {},

                linked:
                    existing?.linked || false,

                cracked:
                    existing?.cracked || false
            };


            targets.set(
                target.id,
                target
            );


            /*
             * This attribute is the actual link gate.
             * The Password Cracker searches for it when
             * LINK mode is active.
             */

            if (target.element) {

                target.element.dataset.nsPasswordTarget =
                    target.id;
            }


            return target;
        },


        unregister(id) {

            passwordVault.delete(
                String(id)
            );

            return targets.delete(
                String(id)
            );
        },


        get(id) {

            return (
                targets.get(
                    String(id)
                ) || null
            );
        },


        has(id) {

            return targets.has(
                String(id)
            );
        },


        all() {

            return Array.from(
                targets.values()
            );
        },


        findFromElement(element) {

            if (!element) {
                return null;
            }

            const targetElement =
                element.closest?.(
                    "[data-ns-password-target]"
                );

            if (!targetElement) {
                return null;
            }

            const id =
                targetElement.dataset.nsPasswordTarget;

            return this.get(id);
        }
    };


    window[TARGET_REGISTRY_NAME] =
        registry;

    return registry;
}


const targetRegistry =
    createTargetRegistry();


/* =========================================================
   PASSWORD CRACKER APPLICATION
   ========================================================= */

export class PasswordCrackerApp {

    constructor(container) {

        this.container =
            typeof container === "string"
                ? document.querySelector(container)
                : container;

        if (!this.container) {
            throw new Error(
                "[PASSWORD CRACKER] Container not found."
            );
        }


        this.linkMode = false;

        this.linkedTarget = null;

        this.running = false;

        this.runToken = 0;

        this.clockTimer = null;


        this.boundDocumentClick =
            this.handleDocumentClick.bind(this);

        this.boundExternalLink =
            this.handleExternalLink.bind(this);
    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    initialize() {

        this.render();


        document.addEventListener(
            "click",
            this.boundDocumentClick,
            true
        );


        window.addEventListener(
            PASSWORD_LINK_EVENT,
            this.boundExternalLink
        );


        this.refreshTargetCount();


        console.log(
            "[PASSWORD CRACKER] Online."
        );


        return this;
    }


    /* =====================================================
       DESTROY
       ===================================================== */

    destroy() {

        this.runToken++;

        this.running = false;

        this.linkMode = false;


        document.removeEventListener(
            "click",
            this.boundDocumentClick,
            true
        );


        window.removeEventListener(
            PASSWORD_LINK_EVENT,
            this.boundExternalLink
        );


        if (this.clockTimer) {

            clearInterval(
                this.clockTimer
            );

            this.clockTimer = null;
        }


        this.container.innerHTML = "";
    }


    /* =====================================================
       RENDER
       ===================================================== */

    render() {

        this.container.innerHTML = `

            <div class="npc-shell">


                <!-- =========================================
                     DIGITAL RAIN
                     ========================================= -->

                <div
                    class="npc-rain"
                    aria-hidden="true"
                ></div>


                <!-- =========================================
                     HEADER
                     ========================================= -->

                <header class="npc-header">

                    <div class="npc-brand">


                        <div class="npc-brand-mark">

                            <span></span>
                            <span></span>
                            <span></span>

                        </div>


                        <div>

                            <div class="npc-title">
                                PASSWORD CRACKER
                            </div>

                            <div class="npc-subtitle">
                                NORTHSTAR SECURITY OPERATIONS CENTER
                            </div>

                        </div>

                    </div>


                    <div class="npc-status">

                        <span
                            class="npc-status-dot"
                        ></span>

                        <span
                            data-npc-status
                        >
                            STANDBY
                        </span>

                    </div>

                </header>


                <!-- =========================================
                     CONTENT
                     ========================================= -->

                <div class="npc-content">


                    <!-- =====================================
                         MAIN CONSOLE
                         ===================================== -->

                    <section class="npc-console">


                        <!-- CONSOLE HEADER -->

                        <div class="npc-console-top">


                            <div>

                                <div class="npc-section-label">
                                    CREDENTIAL RECOVERY CONSOLE
                                </div>


                                <div class="npc-section-description">

                                    Link an authorized NORTHSTAR
                                    protected target before
                                    initiating simulated recovery.

                                </div>

                            </div>


                            <div class="npc-session">

                                SESSION

                                <strong
                                    data-npc-session
                                >
                                    IDLE
                                </strong>

                            </div>

                        </div>


                        <!-- =================================
                             LINKED TARGET
                             ================================= -->

                        <div class="npc-target-card">


                            <div class="npc-target-icon">
                                ⌁
                            </div>


                            <div class="npc-target-info">


                                <div class="npc-target-label">
                                    LINKED TARGET
                                </div>


                                <div
                                    class="npc-target-name"
                                    data-npc-target
                                >
                                    NO TARGET LINKED
                                </div>


                                <div
                                    class="npc-target-meta"
                                    data-npc-target-meta
                                >
                                    Select LINK, then select a
                                    registered protected artifact.
                                </div>


                            </div>


                            <div
                                class="npc-target-state"
                                data-npc-target-state
                            >
                                UNLINKED
                            </div>


                        </div>


                        <!-- =================================
                             CRACK DISPLAY
                             ================================= -->

                        <div class="npc-display">


                            <div class="npc-display-grid"></div>


                            <div class="npc-display-heading">

                                <span>
                                    KEYSPACE
                                </span>

                                <span
                                    data-npc-progress-text
                                >
                                    0 / 8
                                </span>

                            </div>


                            <div
                                class="npc-code"
                                data-npc-code
                            ></div>


                            <div class="npc-display-footer">

                                <span>
                                    SIMULATION MODE
                                </span>

                                <span
                                    data-npc-rate
                                >
                                    RATE: -- DIGITS/S
                                </span>

                            </div>


                        </div>


                        <!-- =================================
                             CONTROLS
                             ================================= -->

                        <div class="npc-controls">


                            <button
                                class="npc-button npc-link-button"
                                data-npc-action="link"
                                type="button"
                            >

                                <span
                                    class="npc-button-symbol"
                                >
                                    ↗
                                </span>

                                LINK

                            </button>


                            <button
                                class="npc-button npc-crack-button"
                                data-npc-action="crack"
                                type="button"
                                disabled
                            >

                                <span
                                    class="npc-button-symbol"
                                >
                                    ▶
                                </span>

                                CRACK PASSWORD

                            </button>


                            <button
                                class="npc-button npc-clear-button"
                                data-npc-action="clear"
                                type="button"
                            >
                                RESET
                            </button>


                        </div>


                        <!-- =================================
                             MESSAGE
                             ================================= -->

                        <div
                            class="npc-message"
                            data-npc-message
                        >
                            SYSTEM READY — A registered target is required.
                        </div>


                    </section>


                    <!-- =====================================
                         SIDEBAR
                         ===================================== -->

                    <aside class="npc-sidebar">


                        <!-- ENGINE STATUS -->

                        <div class="npc-side-card">


                            <div class="npc-side-heading">

                                <span
                                    class="npc-side-dot"
                                ></span>

                                ENGINE STATUS

                            </div>


                            <div class="npc-metric">

                                <span>
                                    ENGINE
                                </span>

                                <strong class="npc-good">
                                    ONLINE
                                </strong>

                            </div>


                            <div class="npc-metric">

                                <span>
                                    TARGETS
                                </span>

                                <strong
                                    data-npc-target-count
                                >
                                    0
                                </strong>

                            </div>


                            <div class="npc-metric">

                                <span>
                                    MODE
                                </span>

                                <strong>
                                    SIMULATED
                                </strong>

                            </div>


                        </div>


                        <!-- OPERATION -->

                        <div class="npc-side-card">


                            <div class="npc-side-heading">
                                OPERATION
                            </div>


                            <div class="npc-step">

                                <span>
                                    01
                                </span>

                                <div>

                                    <strong>
                                        LINK
                                    </strong>

                                    <small>
                                        Select a registered target.
                                    </small>

                                </div>

                            </div>


                            <div class="npc-step">

                                <span>
                                    02
                                </span>

                                <div>

                                    <strong>
                                        RETURN
                                    </strong>

                                    <small>
                                        Return to this console.
                                    </small>

                                </div>

                            </div>


                            <div class="npc-step">

                                <span>
                                    03
                                </span>

                                <div>

                                    <strong>
                                        CRACK
                                    </strong>

                                    <small>
                                        Run the simulated recovery.
                                    </small>

                                </div>

                            </div>


                        </div>


                        <!-- ACTIVITY LOG -->

                        <div
                            class="npc-side-card npc-log-card"
                        >


                            <div class="npc-side-heading">
                                ACTIVITY LOG
                            </div>


                            <div
                                class="npc-log"
                                data-npc-log
                            ></div>


                        </div>


                    </aside>

                </div>


                <!-- =========================================
                     FOOTER
                     ========================================= -->

                <footer class="npc-footer">

                    <span>
                        NORTHSTAR SOC
                    </span>

                    <span>
                        CONTROLLED SIMULATION
                    </span>

                    <span
                        data-npc-clock
                    ></span>

                </footer>


            </div>
        `;


        this.cacheElements();

        this.bindControls();

        this.buildCodeSlots();

        this.buildRain();

        this.updateClock();

        this.addLog(
            "Console initialized."
        );


        this.clockTimer =
            setInterval(
                () => this.updateClock(),
                1000
            );
    }


    /* =====================================================
       CACHE ELEMENTS
       ===================================================== */

    cacheElements() {

        this.codeContainer =
            this.container.querySelector(
                "[data-npc-code]"
            );

        this.status =
            this.container.querySelector(
                "[data-npc-status]"
            );

        this.targetName =
            this.container.querySelector(
                "[data-npc-target]"
            );

        this.targetMeta =
            this.container.querySelector(
                "[data-npc-target-meta]"
            );

        this.targetState =
            this.container.querySelector(
                "[data-npc-target-state]"
            );

        this.message =
            this.container.querySelector(
                "[data-npc-message]"
            );

        this.crackButton =
            this.container.querySelector(
                '[data-npc-action="crack"]'
            );

        this.linkButton =
            this.container.querySelector(
                '[data-npc-action="link"]'
            );

        this.targetCount =
            this.container.querySelector(
                "[data-npc-target-count]"
            );

        this.session =
            this.container.querySelector(
                "[data-npc-session]"
            );

        this.progressText =
            this.container.querySelector(
                "[data-npc-progress-text]"
            );

        this.rate =
            this.container.querySelector(
                "[data-npc-rate]"
            );

        this.log =
            this.container.querySelector(
                "[data-npc-log]"
            );

        this.clock =
            this.container.querySelector(
                "[data-npc-clock]"
            );
    }


    /* =====================================================
       CONTROLS
       ===================================================== */

    bindControls() {

        this.container
            .querySelectorAll(
                "[data-npc-action]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        const action =
                            button.dataset.npcAction;


                        if (action === "link") {

                            this.beginLinkMode();

                        }


                        if (action === "crack") {

                            this.crackPassword();

                        }


                        if (action === "clear") {

                            this.reset();

                        }

                    }
                );
            });
    }


    /* =====================================================
       BUILD THE 8 PASSWORD BOXES
       ===================================================== */

    buildCodeSlots() {

        this.codeContainer.innerHTML = "";


        for (let i = 0; i < 8; i++) {

            const slot =
                document.createElement("div");


            slot.className =
                "npc-code-slot";


            slot.dataset.index =
                String(i);


            slot.innerHTML = `

                <span class="npc-slot-index">
                    ${String(i + 1).padStart(2, "0")}
                </span>


                <span class="npc-slot-value">
                    ·
                </span>


                <span class="npc-slot-state">
                    WAIT
                </span>

            `;


            this.codeContainer.appendChild(
                slot
            );
        }
    }


    /* =====================================================
       DIGITAL RAIN
       ===================================================== */

    buildRain() {

        const rain =
            this.container.querySelector(
                ".npc-rain"
            );


        if (!rain) {
            return;
        }


        const digits =
            "012345678901234567890123456789";


        for (let i = 0; i < 42; i++) {

            const column =
                document.createElement("span");


            column.className =
                "npc-rain-column";


            const length =
                8 +
                Math.floor(
                    Math.random() * 12
                );


            column.textContent =
                Array.from(
                    { length },
                    () =>
                        digits[
                        Math.floor(
                            Math.random() *
                            digits.length
                        )
                        ]
                ).join("\n");


            column.style.left =
                `${(i / 42) * 100 +
                Math.random() * 2
                }%`;


            column.style.animationDelay =
                `${Math.random() * -8}s`;


            column.style.animationDuration =
                `${5 +
                Math.random() * 6
                }s`;


            rain.appendChild(
                column
            );
        }
    }


    /* =====================================================
       LINK MODE
       ===================================================== */

    beginLinkMode() {

        if (this.running) {

            this.setMessage(
                "CRACK OPERATION ACTIVE — LINKING IS LOCKED."
            );

            return;
        }


        this.linkMode = true;


        this.status.textContent =
            "LINK MODE";


        this.linkButton.classList.add(
            "npc-button-active"
        );


        this.setMessage(
            "LINK MODE ACTIVE — SELECT A REGISTERED TARGET."
        );


        this.addLog(
            "Link mode enabled."
        );
    }


    /* =====================================================
       DOCUMENT CLICK
       ===================================================== */

    handleDocumentClick(event) {

        if (!this.linkMode) {
            return;
        }


        /*
         * Don't treat clicks inside the cracker itself
         * as target selections.
         */

        if (
            this.container.contains(
                event.target
            )
        ) {
            return;
        }


        const target =
            targetRegistry.findFromElement(
                event.target
            );


        /*
         * This is what prevents random things from working.
         */

        if (!target) {

            this.setMessage(
                "LINK FAILED — TARGET IS NOT REGISTERED."
            );


            this.addLog(
                "Rejected unregistered target."
            );


            return;
        }


        this.linkTarget(
            target
        );


        event.preventDefault();

        event.stopPropagation();
    }


    /* =====================================================
       EXTERNAL LINK REQUEST
       ===================================================== */

    handleExternalLink(event) {

        const id =
            event.detail?.targetId;


        if (!id) {
            return;
        }


        const target =
            targetRegistry.get(
                id
            );


        if (!target) {
            return;
        }


        this.linkTarget(
            target
        );
    }


    /* =====================================================
       LINK TARGET
       ===================================================== */

    linkTarget(target) {

        if (!target) {
            return;
        }


        if (target.cracked) {

            this.setMessage(
                "TARGET ALREADY RECOVERED."
            );

            return;
        }


        this.linkMode = false;

        target.linked = true;

        this.linkedTarget =
            target;


        this.status.textContent =
            "TARGET LINKED";


        this.linkButton.classList.remove(
            "npc-button-active"
        );


        this.targetName.textContent =
            target.label.toUpperCase();


        this.targetMeta.textContent =
            `TARGET ID: ${target.id}`;


        this.targetState.textContent =
            "READY";


        this.targetState.classList.add(
            "npc-state-ready"
        );


        this.crackButton.disabled =
            false;


        this.setMessage(
            "TARGET ACCEPTED — RETURN TO CONSOLE AND START RECOVERY."
        );


        this.addLog(
            `Target linked: ${target.id}`
        );


        this.resetCodeOnly();
    }


    /* =====================================================
       CRACK PASSWORD
       ===================================================== */

    crackPassword() {

        if (this.running) {
            return;
        }


        const target =
            this.linkedTarget;


        if (!target) {

            this.setMessage(
                "NO TARGET — LINK A REGISTERED TARGET FIRST."
            );

            return;
        }


        if (target.cracked) {

            this.setMessage(
                "TARGET ALREADY RECOVERED."
            );

            return;
        }


        const password =
            lookupPassword(target.id);

        if (!/^\d{8}$/.test(password)) {

            this.setMessage(
                "TARGET ERROR — INVALID SIMULATION KEYSPACE."
            );

            return;
        }


        this.running = true;


        const token =
            ++this.runToken;


        this.crackButton.disabled =
            true;


        this.linkButton.disabled =
            true;


        this.status.textContent =
            "CRACKING";


        this.session.textContent =
            this.makeSessionId();


        this.targetState.textContent =
            "ACTIVE";


        this.targetState.classList.remove(
            "npc-state-ready"
        );


        this.setMessage(
            "KEYSPACE SEARCH ACTIVE — ANALYZING DIGIT SEQUENCE."
        );


        this.addLog(
            `Recovery started: ${target.id}`
        );


        this.resetCodeOnly();


        this.runDigit(
            0,
            password,
            token
        );
    }


    /* =====================================================
       PROCESS ONE DIGIT
       ===================================================== */

    runDigit(
        index,
        password,
        token
    ) {

        if (
            token !== this.runToken
        ) {
            return;
        }


        if (
            index >= 8
        ) {

            this.finishCrack(
                token
            );

            return;
        }


        const slot =
            this.codeContainer.querySelector(
                `[data-index="${index}"]`
            );


        const value =
            slot.querySelector(
                ".npc-slot-value"
            );


        const state =
            slot.querySelector(
                ".npc-slot-state"
            );


        slot.classList.add(
            "npc-slot-spinning"
        );


        state.textContent =
            "SEARCH";


        let ticks = 0;


        /*
         * Each position gets its own simulated search.
         * The animation is intentionally visible enough
         * for the player to understand what is happening.
         */

        const searchLength =
            18 +
            Math.floor(
                Math.random() * 28
            );


        const interval =
            setInterval(
                () => {

                    if (
                        token !==
                        this.runToken
                    ) {

                        clearInterval(
                            interval
                        );

                        return;
                    }


                    const randomDigit =
                        Math.floor(
                            Math.random() * 10
                        );


                    value.textContent =
                        randomDigit;


                    ticks++;


                    this.rate.textContent =
                        `RATE: ${Math.floor(
                            18 +
                            Math.random() * 18
                        )
                        } DIGITS/S`;


                    if (
                        ticks >=
                        searchLength
                    ) {

                        clearInterval(
                            interval
                        );


                        /*
                         * In the simulation the target's
                         * registered password supplies the
                         * correct result.
                         */

                        value.textContent =
                            password[index];


                        slot.classList.remove(
                            "npc-slot-spinning"
                        );


                        slot.classList.add(
                            "npc-slot-solved"
                        );


                        state.textContent =
                            "VERIFIED";


                        this.progressText.textContent =
                            `${index + 1} / 8`;


                        this.addLog(
                            `Position ${index + 1} verified.`
                        );


                        setTimeout(
                            () => {

                                this.runDigit(
                                    index + 1,
                                    password,
                                    token
                                );

                            },
                            190
                        );
                    }

                },
                48
            );
    }


    /* =====================================================
       COMPLETE
       ===================================================== */

    finishCrack(token) {

        if (
            token !==
            this.runToken
        ) {
            return;
        }


        this.running = false;


        const target =
            this.linkedTarget;


        if (!target) {
            return;
        }


        target.cracked =
            true;


        target.linked =
            false;


        this.status.textContent =
            "RECOVERY COMPLETE";


        this.targetState.textContent =
            "RECOVERED";


        this.targetState.classList.add(
            "npc-state-ready"
        );


        this.rate.textContent =
            "RATE: COMPLETE";


        this.progressText.textContent =
            "8 / 8";


        this.setMessage(
            "RECOVERY COMPLETE — SIMULATED PASSWORD VERIFIED."
        );


        this.addLog(
            `Recovery complete: ${target.id}`
        );


        /*
         * Let the target perform its own simulated
         * unlock behavior.
         */

        try {

            if (
                typeof target.unlock ===
                "function"
            ) {

                target.unlock({
                    targetId:
                        target.id,

                    simulated:
                        true
                });
            }

        } catch (error) {

            console.error(
                "[PASSWORD CRACKER] Target unlock callback failed:",
                error
            );
        }


        /*
         * Notify the rest of NORTHSTAR.
         */

        window.dispatchEvent(
            new CustomEvent(
                PASSWORD_CRACKED_EVENT,
                {
                    detail: {

                        targetId:
                            target.id,

                        simulated:
                            true
                    }
                }
            )
        );


        this.crackButton.disabled =
            true;


        this.linkButton.disabled =
            false;
    }


    /* =====================================================
       RESET DIGITS
       ===================================================== */

    resetCodeOnly() {

        if (!this.codeContainer) {
            return;
        }


        this.progressText.textContent =
            "0 / 8";


        this.rate.textContent =
            "RATE: -- DIGITS/S";


        this.buildCodeSlots();
    }


    /* =====================================================
       FULL RESET
       ===================================================== */

    reset() {

        this.runToken++;

        this.running = false;

        this.linkMode = false;

        this.linkedTarget = null;


        this.crackButton.disabled =
            true;


        this.linkButton.disabled =
            false;


        this.linkButton.classList.remove(
            "npc-button-active"
        );


        this.status.textContent =
            "STANDBY";


        this.targetName.textContent =
            "NO TARGET LINKED";


        this.targetMeta.textContent =
            "Select LINK, then select a registered protected artifact.";


        this.targetState.textContent =
            "UNLINKED";


        this.targetState.classList.remove(
            "npc-state-ready"
        );


        this.session.textContent =
            "IDLE";


        this.setMessage(
            "SYSTEM READY — A registered target is required."
        );


        this.resetCodeOnly();


        this.addLog(
            "Console reset."
        );
    }


    /* =====================================================
       UTILITIES
       ===================================================== */

    refreshTargetCount() {

        if (!this.targetCount) {
            return;
        }


        this.targetCount.textContent =
            targetRegistry
                .all()
                .length;
    }


    updateClock() {

        if (!this.clock) {
            return;
        }


        this.clock.textContent =
            new Date().toLocaleTimeString(
                [],
                {
                    hour:
                        "2-digit",

                    minute:
                        "2-digit",

                    second:
                        "2-digit"
                }
            );
    }


    makeSessionId() {

        return (
            "NS-" +
            Math.random()
                .toString(36)
                .slice(2, 8)
                .toUpperCase()
        );
    }


    setMessage(message) {

        if (this.message) {

            this.message.textContent =
                message;
        }
    }


    addLog(message) {

        if (!this.log) {
            return;
        }


        const row =
            document.createElement(
                "div"
            );


        row.className =
            "npc-log-entry";


        const time =
            document.createElement(
                "span"
            );


        time.textContent =
            new Date().toLocaleTimeString();


        const text =
            document.createElement(
                "strong"
            );


        text.textContent =
            message;


        row.appendChild(
            time
        );


        row.appendChild(
            text
        );


        this.log.prepend(
            row
        );


        while (
            this.log.children.length >
            6
        ) {

            this.log.lastElementChild.remove();
        }
    }
}


/* =========================================================
   GLOBAL INITIALIZER
   ========================================================= */

export function initializePasswordCracker(
    container
) {

    const app =
        new PasswordCrackerApp(
            container
        );


    return app.initialize();
}


/*
 * Existing NORTHSTAR desktop code can call this without
 * needing to convert script.js into a module.
 */

window.initializePasswordCracker =
    initializePasswordCracker;


/*
 * Expose the target registry globally so other simulated
 * applications can register protected targets.
 */

window.NorthstarPasswordTargets =
    targetRegistry;