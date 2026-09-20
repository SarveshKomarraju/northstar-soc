/* =========================================================
   NORTHSTAR SOC — TRAINING
   ---------------------------------------------------------
   Plain script (not a module) — same convention as
   MainMenu.js / ScenarioSelect.js. Builds its own full-screen
   overlay (like Settings / Load Session in MainMenu.js) and
   exposes window.NorthstarTraining with .show() / .hide().

   Reads app + scenario content from window.NorthstarTrainingData
   (training-data.js, must load first). Runs entirely on
   invented sample data — never touches the live simulation
   stores — so it's safe to open from Main Menu before any
   real operation exists.
   ========================================================= */

(function () {

    "use strict";


    const PROGRESS_KEY =
        "northstar-training-progress";


    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

    }


    function loadProgress() {

        try {

            const raw =
                localStorage.getItem(PROGRESS_KEY);

            const parsed =
                raw ? JSON.parse(raw) : {};

            /* Migrate the old schema ({appId: true}) to the
               current one ({appId: {knowledge, practice}}) so
               anyone who trained before this update doesn't
               lose their completed apps. */

            const migrated = {};

            Object.keys(parsed || {}).forEach(id => {

                const value =
                    parsed[id];

                if (typeof value === "boolean") {

                    migrated[id] = {
                        knowledge: value,
                        practice: value
                    };

                } else if (value && typeof value === "object") {

                    migrated[id] = {
                        knowledge: Boolean(value.knowledge),
                        practice: Boolean(value.practice)
                    };

                }

            });

            return migrated;

        } catch (err) {

            return {};

        }

    }


    function saveProgress(progress) {

        try {

            localStorage.setItem(
                PROGRESS_KEY,
                JSON.stringify(progress)
            );

        } catch (err) {

            /* localStorage unavailable — training still works,
               it just won't remember completion between visits. */

        }

    }


    const Training = {

        element: null,
        initialized: false,

        hubEl: null,
        detailEl: null,
        practiceEl: null,

        progress: {},

        currentAppId: null,
        currentStepIndex: 0,
        maxStepIndexSeen: 0,
        currentSelection: null,
        knowledgeSessionState: {},


        /* =====================================================
           PROGRESS HELPERS
           ===================================================== */

        getAppProgress(appId) {

            const existing =
                this.progress[appId];

            if (existing && typeof existing === "object") {
                return existing;
            }

            return {
                knowledge: false,
                practice: false
            };

        },


        /* =====================================================
           INIT
           ===================================================== */

        init() {

            if (this.initialized) {
                return true;
            }


            if (
                !window.NorthstarTrainingData ||
                !window.NorthstarTrainingData.apps
            ) {

                console.error(
                    "[NORTHSTAR] TrainingApp: training-data.js not loaded."
                );

                return false;

            }


            this.progress =
                loadProgress();


            this.buildScreen();


            this.initialized = true;


            console.log(
                "[NORTHSTAR] Training Ready"
            );


            return true;

        },


        /* =====================================================
           SHOW / HIDE
           ===================================================== */

        show() {

            if (!this.init()) {
                return;
            }


            this.progress =
                loadProgress();


            this.renderHub();

            this.showView("hub");


            this.element.classList.remove(
                "hidden"
            );

        },


        hide() {

            if (this.element) {

                this.element.classList.add(
                    "hidden"
                );

            }

        },


        backToMenu() {

            this.hide();


            if (
                window.NorthstarMainMenu &&
                typeof window.NorthstarMainMenu.show ===
                "function"
            ) {

                window.NorthstarMainMenu.show();

            }

        },


        showView(name) {

            [
                ["hub", this.hubEl],
                ["detail", this.detailEl],
                ["practice", this.practiceEl]
            ].forEach(([viewName, el]) => {

                if (!el) return;

                el.classList.toggle(
                    "hidden",
                    viewName !== name
                );

            });


            if (this.element) {

                this.element.scrollTop = 0;

            }

        },


        /* =====================================================
           BUILD SCREEN (once)
           ===================================================== */

        buildScreen() {

            const existing =
                document.getElementById(
                    "northstar-training-screen"
                );


            if (existing) {

                this.element = existing;

                this.hubEl =
                    existing.querySelector(
                        ".ns-training-hub"
                    );

                this.detailEl =
                    existing.querySelector(
                        ".ns-training-detail"
                    );

                this.practiceEl =
                    existing.querySelector(
                        ".ns-training-practice"
                    );

                return;

            }


            const screen =
                document.createElement("div");


            screen.id =
                "northstar-training-screen";


            screen.className =
                "northstar-training-screen hidden";


            screen.innerHTML = `

                <div class="ns-training-hub">

                    <div class="ns-training-hub-top">

                        <div>

                            <div class="ns-training-eyebrow">
                                NORTHSTAR SOC
                            </div>

                            <h1>
                                TRAINING
                            </h1>

                            <p>
                                Learn every tool on the desktop before you're on the clock. Pick an app, see what it's for, then try it hands-on in a short practice scenario.
                            </p>

                        </div>

                        <button
                            type="button"
                            class="ns-training-x"
                            id="ns-training-close"
                            aria-label="Close training"
                        >
                            ×
                        </button>

                    </div>

                    <div class="ns-training-progress-row">

                        <div class="ns-training-progress-track">
                            <div class="ns-training-progress-fill" id="ns-training-progress-fill"></div>
                        </div>

                        <span class="ns-training-progress-label" id="ns-training-progress-label">
                            0 / 0 modules complete
                        </span>

                    </div>

                    <div class="ns-training-grid" id="ns-training-grid"></div>

                </div>


                <div class="ns-training-detail hidden">

                    <div class="ns-training-detail-inner" id="ns-training-detail-inner"></div>

                </div>


                <div class="ns-training-practice hidden">

                    <div class="ns-training-practice-inner" id="ns-training-practice-inner"></div>

                </div>

            `;


            document.body.appendChild(
                screen
            );


            this.element = screen;

            this.hubEl =
                screen.querySelector(".ns-training-hub");

            this.detailEl =
                screen.querySelector(".ns-training-detail");

            this.practiceEl =
                screen.querySelector(".ns-training-practice");


            const closeBtn =
                screen.querySelector(
                    "#ns-training-close"
                );

            if (closeBtn) {

                closeBtn.addEventListener(
                    "click",
                    () => this.backToMenu()
                );

            }


            document.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Escape" &&
                        this.element &&
                        !this.element.classList.contains("hidden")
                    ) {

                        if (
                            this.practiceEl &&
                            !this.practiceEl.classList.contains("hidden")
                        ) {

                            this.exitPractice();

                        } else if (
                            this.detailEl &&
                            !this.detailEl.classList.contains("hidden")
                        ) {

                            this.showHub();

                        } else {

                            this.backToMenu();

                        }

                    }

                }
            );

        },


        /* =====================================================
           HUB — APP GRID
           ===================================================== */

        renderHub() {

            const data =
                window.NorthstarTrainingData;

            const grid =
                document.getElementById(
                    "ns-training-grid"
                );

            if (!grid) return;


            const total =
                data.order.length;

            const done =
                data.order.filter(
                    id => this.getAppProgress(id).practice
                ).length;


            const fill =
                document.getElementById(
                    "ns-training-progress-fill"
                );

            const label =
                document.getElementById(
                    "ns-training-progress-label"
                );

            if (fill) {

                fill.style.width =
                    (total ? (done / total) * 100 : 0) + "%";

            }

            if (label) {

                label.textContent =
                    `${done} / ${total} modules complete`;

            }


            grid.innerHTML = "";


            data.order.forEach(appId => {

                const app =
                    data.apps[appId];

                if (!app) return;


                const completed =
                    this.getAppProgress(appId).practice;


                const card =
                    document.createElement("button");

                card.type = "button";

                card.className =
                    "ns-training-card" +
                    (completed ? " ns-training-card-done" : "");

                card.style.setProperty(
                    "--ns-accent",
                    app.accent
                );


                const tierLabel =
                    data.tierLabels[app.tier] || "STANDARD";


                card.innerHTML = `

                    ${completed
                        ? '<span class="ns-training-card-check">✓</span>'
                        : ""
                    }

                    <span class="ns-training-card-icon">
                        ${escapeHTML(app.icon)}
                    </span>

                    <span class="ns-training-card-title">
                        ${escapeHTML(app.title)}
                    </span>

                    <span class="ns-training-card-tagline">
                        ${escapeHTML(app.tagline)}
                    </span>

                    <span class="ns-training-card-meta">
                        <span class="ns-training-tier ns-training-tier-${app.tier}">
                            ${escapeHTML(tierLabel)}
                        </span>
                        <span class="ns-training-card-time">
                            ~${app.estMinutes} min
                        </span>
                    </span>

                `;


                card.addEventListener(
                    "click",
                    () => this.openDetail(appId)
                );


                grid.appendChild(card);

            });

        },


        showHub() {

            this.renderHub();

            this.showView("hub");

        },


        /* =====================================================
           DETAIL VIEW
           ===================================================== */

        openDetail(appId) {

            const app =
                window.NorthstarTrainingData.apps[appId];

            if (!app) return;


            this.currentAppId = appId;


            const appProgress =
                this.getAppProgress(appId);

            const completed =
                appProgress.practice;

            const knowledgePassed =
                appProgress.knowledge;

            const tierLabel =
                window.NorthstarTrainingData.tierLabels[app.tier] ||
                "STANDARD";


            /* Track which knowledge-check questions have been
               answered correctly during THIS viewing of the
               detail screen. If the app was already passed
               before, treat every question as pre-passed so the
               practice button starts unlocked. */

            this.knowledgeSessionState = {};

            (app.knowledgeCheck || []).forEach(q => {

                this.knowledgeSessionState[q.id] =
                    knowledgePassed;

            });


            const inner =
                document.getElementById(
                    "ns-training-detail-inner"
                );

            if (!inner) return;


            inner.style.setProperty(
                "--ns-accent",
                app.accent
            );


            inner.innerHTML = `

                <button type="button" class="ns-training-back" id="ns-training-detail-back">
                    ← Back to Training
                </button>

                <div class="ns-training-detail-header">

                    <span class="ns-training-detail-icon">
                        ${escapeHTML(app.icon)}
                    </span>

                    <div>

                        <div class="ns-training-detail-eyebrow">
                            ${escapeHTML(tierLabel)} &nbsp;·&nbsp; ~${app.estMinutes} MIN
                            ${completed ? " &nbsp;·&nbsp; ✓ COMPLETED" : ""}
                        </div>

                        <h2>
                            ${escapeHTML(app.title)}
                        </h2>

                        <p class="ns-training-detail-tagline">
                            ${escapeHTML(app.tagline)}
                        </p>

                    </div>

                </div>

                <div class="ns-training-detail-body">

                    <h3>What it does</h3>

                    ${app.overview.map(
                        paragraph => `<p>${escapeHTML(paragraph)}</p>`
                    ).join("")}

                    <h3>Skills you'll practice</h3>

                    <ul class="ns-training-skill-list">
                        ${app.keySkills.map(
                            skill => `<li>${escapeHTML(skill)}</li>`
                        ).join("")}
                    </ul>

                </div>

                ${this.renderKnowledgeCheck(app, knowledgePassed)}

                <div class="ns-training-detail-scenario">

                    <div class="ns-training-detail-scenario-label">
                        HANDS-ON SCENARIO
                    </div>

                    <div class="ns-training-detail-scenario-title">
                        ${escapeHTML(app.scenario.title)}
                    </div>

                    <p>
                        ${escapeHTML(app.scenario.briefing)}
                    </p>

                    <button
                        type="button"
                        class="ns-training-start-btn"
                        id="ns-training-start-practice"
                        ${knowledgePassed ? "" : "disabled"}
                    >
                        ${completed ? "Practice Again" : "Start Hands-On Practice"} →
                    </button>

                    <p
                        class="ns-training-locked-note${knowledgePassed ? " hidden" : ""}"
                        id="ns-training-locked-note"
                    >
                        🔒 Answer both questions above correctly to unlock.
                    </p>

                </div>

            `;


            const backBtn =
                inner.querySelector(
                    "#ns-training-detail-back"
                );

            if (backBtn) {

                backBtn.addEventListener(
                    "click",
                    () => this.showHub()
                );

            }


            const startBtn =
                inner.querySelector(
                    "#ns-training-start-practice"
                );

            if (startBtn) {

                startBtn.addEventListener(
                    "click",
                    () => {

                        if (startBtn.disabled) return;

                        this.startPractice(appId);

                    }
                );

            }


            this.bindKnowledgeCheckInteractions(
                app,
                inner
            );


            this.showView("detail");

        },


        /* =====================================================
           KNOWLEDGE CHECK (gates hands-on practice)
           ===================================================== */

        renderKnowledgeCheck(app, knowledgePassed) {

            const questions =
                app.knowledgeCheck || [];

            if (questions.length === 0) {
                return "";
            }

            return `

                <div class="ns-training-knowledge-check">

                    <div class="ns-training-detail-scenario-label">
                        CHECK YOUR UNDERSTANDING
                    </div>

                    <p class="ns-training-knowledge-intro">
                        ${knowledgePassed
                            ? "You've already shown you know this one. Scroll down when you're ready to practice."
                            : "Answer both questions correctly to unlock hands-on practice."
                        }
                    </p>

                    ${questions.map((q, qi) => `

                        <div class="ns-training-kc-question" data-question-id="${escapeHTML(q.id)}">

                            <div class="ns-training-kc-prompt">
                                ${qi + 1}. ${escapeHTML(q.prompt)}
                            </div>

                            <div class="ns-training-kc-choices">
                                ${q.choices.map(choice => `
                                    <button
                                        type="button"
                                        class="ns-training-kc-choice${
                                            knowledgePassed && choice.id === q.correctId
                                                ? " ns-training-kc-choice-correct"
                                                : ""
                                        }"
                                        data-option-id="${escapeHTML(choice.id)}"
                                        ${knowledgePassed ? "disabled" : ""}
                                    >
                                        ${escapeHTML(choice.text)}
                                    </button>
                                `).join("")}
                            </div>

                            <div class="ns-training-kc-feedback" id="ns-training-kc-feedback-${escapeHTML(q.id)}"></div>

                        </div>

                    `).join("")}

                </div>

            `;

        },


        bindKnowledgeCheckInteractions(app, inner) {

            const questions =
                app.knowledgeCheck || [];

            if (questions.length === 0) {
                return;
            }

            const startBtn =
                inner.querySelector(
                    "#ns-training-start-practice"
                );

            const lockedNote =
                inner.querySelector(
                    "#ns-training-locked-note"
                );


            const checkAllPassed = () => {

                const allPassed =
                    questions.every(
                        q => this.knowledgeSessionState[q.id]
                    );

                if (!allPassed) return;


                const appProgress =
                    this.getAppProgress(app.id);

                appProgress.knowledge = true;

                this.progress[app.id] = appProgress;

                saveProgress(this.progress);


                if (startBtn) {
                    startBtn.disabled = false;
                }

                if (lockedNote) {
                    lockedNote.classList.add("hidden");
                }

            };


            questions.forEach(question => {

                const questionEl =
                    inner.querySelector(
                        `.ns-training-kc-question[data-question-id="${
                            window.CSS && window.CSS.escape
                                ? window.CSS.escape(question.id)
                                : question.id
                        }"]`
                    );

                if (!questionEl) return;


                const feedback =
                    questionEl.querySelector(
                        ".ns-training-kc-feedback"
                    );

                const choiceButtons =
                    questionEl.querySelectorAll(
                        "[data-option-id]"
                    );


                choiceButtons.forEach(btn => {

                    btn.addEventListener(
                        "click",
                        () => {

                            if (btn.disabled) return;


                            const optionId =
                                btn.dataset.optionId;

                            const isCorrect =
                                optionId === question.correctId;


                            if (isCorrect) {

                                choiceButtons.forEach(el => {
                                    el.disabled = true;
                                });

                                btn.classList.add(
                                    "ns-training-kc-choice-correct"
                                );

                                if (feedback) {

                                    feedback.textContent =
                                        "✓ Correct.";

                                    feedback.className =
                                        "ns-training-kc-feedback ns-training-kc-feedback-success";

                                }

                                this.knowledgeSessionState[question.id] = true;

                                checkAllPassed();

                            } else {

                                btn.classList.add(
                                    "ns-training-kc-choice-wrong"
                                );

                                btn.disabled = true;

                                if (feedback) {

                                    feedback.textContent =
                                        "Not quite — try another option.";

                                    feedback.className =
                                        "ns-training-kc-feedback ns-training-kc-feedback-fail";

                                }

                            }

                        }
                    );

                });

            });

        },


        /* =====================================================
           PRACTICE RUNNER
           ===================================================== */

        startPractice(appId) {

            const app =
                window.NorthstarTrainingData.apps[appId];

            if (!app) return;


            this.currentAppId = appId;

            this.currentStepIndex = 0;

            this.maxStepIndexSeen = 0;


            this.showView("practice");

            this.renderStep();

        },


        exitPractice() {

            this.showHub();

        },


        renderStep() {

            const app =
                window.NorthstarTrainingData.apps[this.currentAppId];

            if (!app) return;


            const steps =
                app.scenario.steps;

            const stepIndex =
                this.currentStepIndex;


            const inner =
                document.getElementById(
                    "ns-training-practice-inner"
                );

            if (!inner) return;


            inner.style.setProperty(
                "--ns-accent",
                app.accent
            );


            if (stepIndex >= steps.length) {

                this.renderCompletion(inner, app);

                return;

            }


            const step =
                steps[stepIndex];

            const total =
                steps.length;


            if (stepIndex > this.maxStepIndexSeen) {

                this.maxStepIndexSeen = stepIndex;

            }


            let bodyHTML = "";


            if (step.type === "info") {

                bodyHTML = this.renderInfoStep(step);

            } else if (step.type === "spot") {

                bodyHTML = this.renderSpotStep(step);

            } else if (step.type === "quiz") {

                bodyHTML = this.renderQuizStep(step);

            } else if (step.type === "type") {

                bodyHTML = this.renderTypeStep(step);

            } else if (step.type === "ingame") {

                bodyHTML = this.renderIngameStep(step);

            }


            inner.innerHTML = `

                <div class="ns-training-practice-top">

                    <button type="button" class="ns-training-back" id="ns-training-practice-exit">
                        ← Exit Practice
                    </button>

                    <div class="ns-training-practice-step-count">
                        ${escapeHTML(app.title)} &nbsp;·&nbsp; Step ${stepIndex + 1} of ${total}
                    </div>

                </div>

                <div class="ns-training-step-dots">
                    ${steps.map((s, i) => `
                        <button
                            type="button"
                            class="ns-training-step-dot${
                                i < stepIndex ? " ns-training-step-dot-done" : ""
                            }${
                                i === stepIndex ? " ns-training-step-dot-active" : ""
                            }"
                            data-step-index="${i}"
                            ${i > this.maxStepIndexSeen ? "disabled" : ""}
                            aria-label="Go to step ${i + 1}"
                        ></button>
                    `).join("")}
                </div>

                <div class="ns-training-step-card">

                    ${bodyHTML}

                </div>

            `;


            const exitBtn =
                inner.querySelector(
                    "#ns-training-practice-exit"
                );

            if (exitBtn) {

                exitBtn.addEventListener(
                    "click",
                    () => this.exitPractice()
                );

            }


            const stepDots =
                inner.querySelectorAll(
                    "[data-step-index]"
                );

            stepDots.forEach(dot => {

                dot.addEventListener(
                    "click",
                    () => {

                        if (dot.disabled) return;


                        const targetIndex =
                            parseInt(dot.dataset.stepIndex, 10);

                        if (Number.isNaN(targetIndex)) return;


                        this.currentStepIndex = targetIndex;

                        this.renderStep();

                    }
                );

            });


            this.bindStepInteractions(step, inner);

        },


        renderInfoStep(step) {

            return `

                <div class="ns-training-step-title">
                    ${escapeHTML(step.title)}
                </div>

                <div class="ns-training-step-body">
                    ${(step.body || []).map(
                        paragraph => `<p>${escapeHTML(paragraph)}</p>`
                    ).join("")}

                    ${step.bullets ? `
                        <ul>
                            ${step.bullets.map(
                                b => `<li>${escapeHTML(b)}</li>`
                            ).join("")}
                        </ul>
                    ` : ""}
                </div>

                <div class="ns-training-step-footer">

                    <span></span>

                    <button type="button" class="ns-training-continue-btn" id="ns-training-step-continue">
                        Continue →
                    </button>

                </div>

            `;

        },


        renderSpotStep(step) {

            return `

                <div class="ns-training-step-title">
                    ${escapeHTML(step.title)}
                </div>

                <p class="ns-training-step-prompt">
                    ${escapeHTML(step.prompt)}
                </p>

                <div class="ns-training-spot-table" style="--ns-cols: ${step.columns.length}">

                    <div class="ns-training-spot-row ns-training-spot-header">
                        ${step.columns.map(
                            c => `<span>${escapeHTML(c)}</span>`
                        ).join("")}
                    </div>

                    ${step.rows.map(row => `
                        <button
                            type="button"
                            class="ns-training-spot-row ns-training-spot-option"
                            data-option-id="${escapeHTML(row.id)}"
                        >
                            ${row.cells.map(
                                cell => `<span>${escapeHTML(cell)}</span>`
                            ).join("")}
                        </button>
                    `).join("")}

                </div>

                <div class="ns-training-step-feedback" id="ns-training-step-feedback"></div>

                <div class="ns-training-step-footer">

                    <button type="button" class="ns-training-hint-btn" id="ns-training-hint-btn">
                        Show a hint
                    </button>

                    <button type="button" class="ns-training-continue-btn hidden" id="ns-training-step-continue">
                        Continue →
                    </button>

                </div>

            `;

        },


        renderQuizStep(step) {

            return `

                <div class="ns-training-step-title">
                    ${escapeHTML(step.title)}
                </div>

                <p class="ns-training-step-prompt">
                    ${escapeHTML(step.prompt)}
                </p>

                <div class="ns-training-quiz-choices">

                    ${step.choices.map(choice => `
                        <button
                            type="button"
                            class="ns-training-quiz-choice"
                            data-option-id="${escapeHTML(choice.id)}"
                        >
                            ${escapeHTML(choice.text)}
                        </button>
                    `).join("")}

                </div>

                <div class="ns-training-step-feedback" id="ns-training-step-feedback"></div>

                <div class="ns-training-step-footer">

                    <button type="button" class="ns-training-hint-btn" id="ns-training-hint-btn">
                        Show a hint
                    </button>

                    <button type="button" class="ns-training-continue-btn hidden" id="ns-training-step-continue">
                        Continue →
                    </button>

                </div>

            `;

        },


        renderTypeStep(step) {

            return `

                <div class="ns-training-step-title">
                    ${escapeHTML(step.title)}
                </div>

                <p class="ns-training-step-prompt">
                    ${escapeHTML(step.prompt)}
                </p>

                <div class="ns-training-type-row">

                    <input
                        type="text"
                        class="ns-training-type-input"
                        id="ns-training-type-input"
                        placeholder="${escapeHTML(step.placeholder || "")}"
                        autocomplete="off"
                        spellcheck="false"
                    >

                    <button type="button" class="ns-training-type-submit" id="ns-training-type-submit">
                        Submit
                    </button>

                </div>

                <div class="ns-training-step-feedback" id="ns-training-step-feedback"></div>

                <div class="ns-training-step-footer">

                    <button type="button" class="ns-training-hint-btn" id="ns-training-hint-btn">
                        Show a hint
                    </button>

                    <button type="button" class="ns-training-continue-btn hidden" id="ns-training-step-continue">
                        Continue →
                    </button>

                </div>

            `;

        },


        renderIngameStep(step) {

            return `

                <div class="ns-training-step-title">
                    ${escapeHTML(step.title)}
                </div>

                <p class="ns-training-step-prompt">
                    ${escapeHTML(step.intro)}
                </p>

                <div class="ns-training-ingame-frame">

                    <div class="ns-training-ingame-ribbon">
                        LIVE APP PREVIEW
                    </div>

                    <div class="ns-training-ingame-mockup">
                        ${step.mockup}
                    </div>

                </div>

                <ul class="ns-training-ingame-notes">
                    ${(step.notes || []).map(
                        note => `<li>${escapeHTML(note)}</li>`
                    ).join("")}
                </ul>

                <p class="ns-training-step-prompt ns-training-ingame-outro">
                    ${escapeHTML(step.outro)}
                </p>

                <div class="ns-training-step-footer">

                    <span></span>

                    <button type="button" class="ns-training-continue-btn" id="ns-training-step-continue">
                        Finish Module →
                    </button>

                </div>

            `;

        },


        bindStepInteractions(step, inner) {

            const hintBtn =
                inner.querySelector(
                    "#ns-training-hint-btn"
                );

            const feedback =
                inner.querySelector(
                    "#ns-training-step-feedback"
                );

            const continueBtn =
                inner.querySelector(
                    "#ns-training-step-continue"
                );


            if (hintBtn) {

                hintBtn.addEventListener(
                    "click",
                    () => {

                        if (!feedback) return;

                        if (step.hint) {

                            const hintEl =
                                document.createElement("div");

                            hintEl.className =
                                "ns-training-hint";

                            hintEl.textContent =
                                "Hint: " + step.hint;

                            feedback.appendChild(
                                hintEl
                            );

                        }

                        hintBtn.disabled = true;

                        hintBtn.textContent =
                            "Hint shown";

                    }
                );

            }


            if (continueBtn) {

                continueBtn.addEventListener(
                    "click",
                    () => {

                        this.currentStepIndex += 1;

                        this.renderStep();

                    }
                );

            }


            if (step.type === "info" || step.type === "ingame") {
                return;
            }


            if (step.type === "spot" || step.type === "quiz") {

                const options =
                    inner.querySelectorAll(
                        "[data-option-id]"
                    );


                const correctId =
                    step.correctId;


                options.forEach(optionEl => {

                    optionEl.addEventListener(
                        "click",
                        () => {

                            if (
                                optionEl.classList.contains(
                                    "ns-training-option-correct"
                                )
                            ) {
                                return;
                            }


                            const optionId =
                                optionEl.dataset.optionId;

                            const isCorrect =
                                optionId === correctId;


                            const noteSource =
                                step.type === "spot"
                                    ? (step.rows || []).find(r => r.id === optionId)
                                    : null;


                            if (isCorrect) {

                                options.forEach(el => {
                                    el.disabled = true;
                                });

                                optionEl.classList.add(
                                    "ns-training-option-correct"
                                );


                                if (feedback) {

                                    feedback.innerHTML = "";

                                    const successEl =
                                        document.createElement("div");

                                    successEl.className =
                                        "ns-training-feedback-success";

                                    successEl.textContent =
                                        step.successText || "That's right.";

                                    feedback.appendChild(
                                        successEl
                                    );


                                    if (
                                        noteSource &&
                                        noteSource.note
                                    ) {

                                        const noteEl =
                                            document.createElement("div");

                                        noteEl.className =
                                            "ns-training-feedback-note";

                                        noteEl.textContent =
                                            noteSource.note;

                                        feedback.appendChild(
                                            noteEl
                                        );

                                    }

                                }


                                if (continueBtn) {

                                    continueBtn.classList.remove(
                                        "hidden"
                                    );

                                }

                            } else {

                                optionEl.classList.add(
                                    "ns-training-option-wrong"
                                );

                                optionEl.disabled = true;


                                if (feedback) {

                                    feedback.innerHTML = "";

                                    const failEl =
                                        document.createElement("div");

                                    failEl.className =
                                        "ns-training-feedback-fail";

                                    failEl.textContent =
                                        step.failText || "Not quite — try another.";

                                    feedback.appendChild(
                                        failEl
                                    );


                                    if (
                                        noteSource &&
                                        noteSource.note
                                    ) {

                                        const noteEl =
                                            document.createElement("div");

                                        noteEl.className =
                                            "ns-training-feedback-note";

                                        noteEl.textContent =
                                            noteSource.note;

                                        feedback.appendChild(
                                            noteEl
                                        );

                                    }

                                }

                            }

                        }
                    );

                });

            }


            if (step.type === "type") {

                const input =
                    inner.querySelector(
                        "#ns-training-type-input"
                    );

                const submitBtn =
                    inner.querySelector(
                        "#ns-training-type-submit"
                    );


                const checkAnswer = () => {

                    if (!input) return;


                    const value =
                        input.value.trim().toLowerCase();

                    const accepted =
                        (step.accepted || []).map(
                            a => String(a).trim().toLowerCase()
                        );

                    const isCorrect =
                        accepted.includes(value);


                    if (feedback) {

                        feedback.innerHTML = "";

                        const el =
                            document.createElement("div");

                        el.className =
                            isCorrect
                                ? "ns-training-feedback-success"
                                : "ns-training-feedback-fail";

                        el.textContent =
                            isCorrect
                                ? (step.successText || "That's right.")
                                : (step.failText || "Not quite — try again.");

                        feedback.appendChild(el);

                    }


                    if (isCorrect) {

                        if (input) input.disabled = true;

                        if (submitBtn) submitBtn.disabled = true;


                        if (continueBtn) {

                            continueBtn.classList.remove(
                                "hidden"
                            );

                        }

                    }

                };


                if (submitBtn) {

                    submitBtn.addEventListener(
                        "click",
                        checkAnswer
                    );

                }

                if (input) {

                    input.addEventListener(
                        "keydown",
                        event => {

                            if (event.key === "Enter") {

                                event.preventDefault();

                                checkAnswer();

                            }

                        }
                    );

                }

            }

        },


        renderCompletion(inner, app) {

            const appProgress =
                this.getAppProgress(app.id);

            appProgress.practice = true;

            /* Reaching completion requires having passed the
               knowledge check to unlock Start in the first
               place, but set it defensively in case this is
               ever reached another way. */

            appProgress.knowledge = true;

            this.progress[app.id] = appProgress;

            saveProgress(
                this.progress
            );


            inner.innerHTML = `

                <div class="ns-training-complete">

                    <div class="ns-training-complete-icon">
                        ✓
                    </div>

                    <div class="ns-training-complete-eyebrow">
                        TRAINING COMPLETE
                    </div>

                    <h2>
                        ${escapeHTML(app.title)}
                    </h2>

                    <p>
                        You've worked through ${escapeHTML(app.scenario.title)}. Here's what you practiced:
                    </p>

                    <ul class="ns-training-skill-list ns-training-complete-list">
                        ${app.keySkills.map(
                            skill => `<li>✓ ${escapeHTML(skill)}</li>`
                        ).join("")}
                    </ul>

                    <div class="ns-training-complete-actions">

                        <button type="button" class="ns-training-back-hub-btn" id="ns-training-complete-hub">
                            Back to Training Hub
                        </button>

                        <button type="button" class="ns-training-start-btn" id="ns-training-complete-replay">
                            Practice Again
                        </button>

                    </div>

                </div>

            `;


            const hubBtn =
                inner.querySelector(
                    "#ns-training-complete-hub"
                );

            if (hubBtn) {

                hubBtn.addEventListener(
                    "click",
                    () => this.showHub()
                );

            }


            const replayBtn =
                inner.querySelector(
                    "#ns-training-complete-replay"
                );

            if (replayBtn) {

                replayBtn.addEventListener(
                    "click",
                    () => this.startPractice(app.id)
                );

            }

        }

    };


    window.NorthstarTraining =
        Training;

})();
