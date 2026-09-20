/* =========================================================
   NORTHSTAR SOC — EXPERIENCE OTHER ATTACKS
   Attack Compare Screen
   ---------------------------------------------------------
   The 11th tile on the picker screen ("COMPARE ATTACKS"). Lets
   the user pick any two of the 10 attack experiences and see,
   side by side, exactly how they differ — aimed at the attacks
   that are easy to mix up (Evil Twin / ARP Spoofing / MITM all
   involve traffic interception; Rainbow Table / Credential
   Stuffing are both credential attacks; etc.).

   Reusable, data-driven, same as every other file in this
   feature: this file has ZERO per-attack content or per-pair
   hardcoded logic. Every attack in attackExperienceData.js
   carries a small `compare` object (vector, targetLayer,
   requiresVictimAction, automated, primarySignal, goal, and an
   OPTIONAL curated `distinguishFrom` note for genuinely
   confusable pairs — see the schema comment at the top of
   attackExperienceData.js). This screen:

     1. Renders a generic "AT A GLANCE" table from those fields
        for whichever two attacks are selected.
     2. Computes a "WHAT THEY HAVE IN COMMON" summary by
        comparing the structured fields.
     3. For "HOW TO TELL THEM APART", uses a curated
        distinguishFrom note if either attack has one for the
        other; otherwise it AUTO-GENERATES a comparison from the
        same structured fields, so every one of the 45 possible
        pairs works even though only the genuinely-confusable
        ones have hand-written notes.

   Adding an 11th attack (or a 12th) means adding its
   `compare` object to attackExperienceData.js — nothing in this
   file changes.

   Exposes window.AttackCompareApp with .show() / .hide(),
   matching the .show()/.hide() convention used by
   NorthstarFreePlay and AttackExperienceRenderer.
   ========================================================= */

(function () {

    "use strict";


    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

    }


    function lowerFirst(text) {

        const str = String(text || "");
        return str.charAt(0).toLowerCase() + str.slice(1);

    }


    function yesNo(value) {

        return value ? "Yes" : "No";

    }


    /* =====================================================
       GENERIC COMPARISON LOGIC
       (operates purely on the structured `compare` fields —
       no attack-specific code)
       ===================================================== */

    function buildSimilarity(A, B, cA, cB) {

        const points = [];

        if (A.category === B.category) {
            points.push(`Both are classified as <strong>${escapeHTML(A.category)}</strong> techniques.`);
        }

        if (cA.targetLayer && cA.targetLayer === cB.targetLayer) {
            points.push(`Both primarily operate at the <strong>${escapeHTML(cA.targetLayer)}</strong> layer.`);
        }

        if (cA.requiresVictimAction === cB.requiresVictimAction) {

            points.push(
                cA.requiresVictimAction
                    ? "Both require the victim to personally take an action — like clicking a link, typing credentials, or plugging something in."
                    : "Neither requires the victim to personally do anything — both can unfold without any conscious action from them."
            );

        }

        if (cA.automated === cB.automated && cA.automated) {
            points.push("Both are typically carried out in an automated, at-scale fashion rather than as a single manual attempt.");
        }

        if (!points.length) {

            points.push("These two attacks differ across nearly every dimension below — beyond both being simulated here, they don't have much in common.");

        }

        return points;

    }


    function buildGenericDistinction(A, B, cA, cB) {

        const parts = [];

        if (cA.vector && cB.vector && cA.vector !== cB.vector) {
            parts.push(`${escapeHTML(A.title)} works by ${escapeHTML(lowerFirst(cA.vector))}, while ${escapeHTML(B.title)} works by ${escapeHTML(lowerFirst(cB.vector))}.`);
        }

        if (cA.targetLayer && cB.targetLayer && cA.targetLayer !== cB.targetLayer) {
            parts.push(`${escapeHTML(A.title)} primarily targets the <strong>${escapeHTML(cA.targetLayer)}</strong> layer; ${escapeHTML(B.title)} targets the <strong>${escapeHTML(cB.targetLayer)}</strong> layer instead.`);
        }

        if (cA.requiresVictimAction !== cB.requiresVictimAction) {

            const needsAction = cA.requiresVictimAction ? A.title : B.title;
            const doesnt = cA.requiresVictimAction ? B.title : A.title;

            parts.push(`${escapeHTML(needsAction)} needs the victim to actually do something — click, type, or plug something in. ${escapeHTML(doesnt)} doesn't require any action from the victim at all.`);

        }

        if (cA.primarySignal && cB.primarySignal && cA.primarySignal !== cB.primarySignal) {
            parts.push(`The clearest tell also differs: for ${escapeHTML(A.title)} it's "${escapeHTML(cA.primarySignal)}," while for ${escapeHTML(B.title)} it's "${escapeHTML(cB.primarySignal)}."`);
        }

        if (!parts.length) {
            return "These two are structurally similar at this level of detail — the real differences show up in exactly how each one plays out, not in the high-level mechanics. Watch both simulations back to back to see it.";
        }

        return parts.join(" ");

    }


    function findCuratedNote(A, B, cA, cB) {

        if (cA.distinguishFrom && cA.distinguishFrom[B.id]) {
            return cA.distinguishFrom[B.id];
        }

        if (cB.distinguishFrom && cB.distinguishFrom[A.id]) {
            return cB.distinguishFrom[A.id];
        }

        return null;

    }


    /* =====================================================
       APP
       ===================================================== */

    const CompareApp = {

        element: null,
        initialized: false,
        refs: null,


        init() {

            if (this.initialized) {
                return true;
            }

            this.buildScreen();
            this.initialized = true;

            console.log("[NORTHSTAR] Attack Compare screen ready");

            return true;

        },


        buildScreen() {

            const existing = document.getElementById("northstar-attack-compare-screen");

            if (existing) {
                this.element = existing;
                this.cacheRefs();
                return;
            }

            const screen = document.createElement("div");

            screen.id = "northstar-attack-compare-screen";
            screen.className = "nsac-screen hidden";

            screen.innerHTML = `

                <div class="nsac-inner">

                    <div class="nsac-topbar">

                        <button type="button" class="nsac-back" id="nsac-back">
                            ← BACK TO ATTACKS
                        </button>

                        <div class="nsac-title-block">
                            <div class="nsac-eyebrow">SIDE-BY-SIDE BREAKDOWN</div>
                            <h2>COMPARE ATTACKS</h2>
                        </div>

                    </div>

                    <p class="nsac-intro">
                        Some of these techniques look alike on the surface. Pick any
                        two below to see exactly what's different — and what really
                        is the same.
                    </p>

                    <div class="nsac-selectors">

                        <div class="nsac-selector">
                            <label for="nsac-select-a">ATTACK A</label>
                            <select id="nsac-select-a"></select>
                        </div>

                        <button type="button" class="nsac-swap" id="nsac-swap" title="Swap A and B" aria-label="Swap Attack A and Attack B">
                            ⇄
                        </button>

                        <div class="nsac-selector">
                            <label for="nsac-select-b">ATTACK B</label>
                            <select id="nsac-select-b"></select>
                        </div>

                    </div>

                    <div class="nsac-body" id="nsac-body"></div>

                </div>

            `;

            document.body.appendChild(screen);

            this.element = screen;

            this.cacheRefs();
            this.wireControls();

            document.addEventListener("keydown", event => {

                if (
                    event.key === "Escape" &&
                    this.element &&
                    !this.element.classList.contains("hidden")
                ) {

                    this.backToPicker();

                }

            });

        },


        cacheRefs() {

            const byId = id => document.getElementById(id);

            this.refs = {
                back: byId("nsac-back"),
                selectA: byId("nsac-select-a"),
                selectB: byId("nsac-select-b"),
                swap: byId("nsac-swap"),
                body: byId("nsac-body")
            };

        },


        wireControls() {

            this.refs.back.addEventListener("click", () => this.backToPicker());

            this.refs.selectA.addEventListener("change", () => this.renderComparison());
            this.refs.selectB.addEventListener("change", () => this.renderComparison());

            this.refs.swap.addEventListener("click", () => {

                const a = this.refs.selectA.value;
                const b = this.refs.selectB.value;

                this.refs.selectA.value = b;
                this.refs.selectB.value = a;

                this.renderComparison();

            });

        },


        /* =====================================================
           SHOW / HIDE
           ===================================================== */

        show() {

            if (!this.init()) {
                return;
            }

            this.populateSelectors();
            this.renderComparison();

            this.element.classList.remove("hidden");

        },


        hide() {

            if (this.element) {
                this.element.classList.add("hidden");
            }

        },


        backToPicker() {

            this.hide();

            if (
                window.NorthstarFreePlay &&
                typeof window.NorthstarFreePlay.show === "function"
            ) {

                window.NorthstarFreePlay.show();

            }

        },


        /* =====================================================
           SELECTORS
           ===================================================== */

        populateSelectors() {

            const experiences = window.ATTACK_EXPERIENCES || [];

            const options = experiences.map(exp => `
                <option value="${escapeHTML(exp.id)}">${String(exp.number).padStart(2, "0")} — ${escapeHTML(exp.title)}</option>
            `).join("");

            const previousA = this.refs.selectA.value;
            const previousB = this.refs.selectB.value;

            this.refs.selectA.innerHTML = options;
            this.refs.selectB.innerHTML = options;

            const stillValid = id => experiences.some(exp => exp.id === id);

            if (stillValid(previousA)) {
                this.refs.selectA.value = previousA;
            } else if (experiences[0]) {
                this.refs.selectA.value = experiences[0].id;
            }

            if (stillValid(previousB) && previousB !== this.refs.selectA.value) {
                this.refs.selectB.value = previousB;
            } else if (experiences[1]) {
                this.refs.selectB.value = experiences[1].id;
            }

        },


        /* =====================================================
           COMPARISON RENDER
           ===================================================== */

        renderComparison() {

            const idA = this.refs.selectA.value;
            const idB = this.refs.selectB.value;

            const A = window.getAttackExperience ? window.getAttackExperience(idA) : null;
            const B = window.getAttackExperience ? window.getAttackExperience(idB) : null;

            if (!A || !B) {
                this.refs.body.innerHTML = "";
                return;
            }

            if (A.id === B.id) {

                this.refs.body.innerHTML = `
                    <div class="nsac-same">
                        Pick two <em>different</em> attacks above to compare them.
                    </div>
                `;

                return;

            }

            const cA = A.compare || {};
            const cB = B.compare || {};

            const similarity = buildSimilarity(A, B, cA, cB);
            const curatedNote = findCuratedNote(A, B, cA, cB);
            const distinguishText = curatedNote || buildGenericDistinction(A, B, cA, cB);

            const mitreLabel = exp => exp.mitre ? `${exp.mitre.id} — ${exp.mitre.name}` : "";

            const rows = [
                { label: "Category", a: A.category, b: B.category },
                { label: "Difficulty", a: A.difficulty, b: B.difficulty },
                { label: "MITRE ATT&CK", a: mitreLabel(A), b: mitreLabel(B) },
                { label: "Attack Vector", a: cA.vector, b: cB.vector },
                { label: "Target Layer", a: cA.targetLayer, b: cB.targetLayer },
                { label: "Needs Victim to Act?", a: yesNo(cA.requiresVictimAction), b: yesNo(cB.requiresVictimAction) },
                { label: "Runs Automated at Scale?", a: yesNo(cA.automated), b: yesNo(cB.automated) },
                { label: "Primary Detection Signal", a: cA.primarySignal, b: cB.primarySignal },
                { label: "Attacker's Goal", a: cA.goal, b: cB.goal }
            ];

            this.refs.body.innerHTML = `

                <div class="nsac-headcards">

                    ${[A, B].map(exp => `
                        <div class="nsac-headcard" style="--nsac-accent:${escapeHTML(exp.accent || "#6fb2e0")}">
                            <div class="nsac-headcard-number">${String(exp.number).padStart(2, "0")}</div>
                            <div class="nsac-headcard-title">${escapeHTML(exp.title)}</div>
                            <div class="nsac-headcard-meta">
                                <span>${escapeHTML(exp.category)}</span>
                                <span>${escapeHTML(exp.difficulty)}</span>
                                ${exp.mitre ? `<span class="nsac-mitre-tag">${escapeHTML(exp.mitre.id)}</span>` : ""}
                            </div>
                            <p class="nsac-headcard-desc">${escapeHTML(exp.description)}</p>
                            <button type="button" class="nsac-try-btn" data-launch="${escapeHTML(exp.id)}">
                                EXPERIENCE THIS ATTACK →
                            </button>
                        </div>
                    `).join("")}

                </div>

                <div class="nsac-block">
                    <div class="nsac-block-label">WHAT THEY HAVE IN COMMON</div>
                    <ul class="nsac-similarity-list">
                        ${similarity.map(point => `<li>${point}</li>`).join("")}
                    </ul>
                </div>

                <div class="nsac-block">
                    <div class="nsac-block-label">AT A GLANCE</div>
                    <div class="nsac-table">

                        <div class="nsac-table-row nsac-table-head">
                            <span></span>
                            <span>${escapeHTML(A.title)}</span>
                            <span>${escapeHTML(B.title)}</span>
                        </div>

                        ${rows.map(row => {

                            const differs = String(row.a) !== String(row.b);

                            return `
                                <div class="nsac-table-row ${differs ? "nsac-table-row-diff" : ""}">
                                    <span class="nsac-table-label">${escapeHTML(row.label)}</span>
                                    <span class="nsac-table-val" data-side="${escapeHTML(A.title)}">${escapeHTML(row.a || "—")}</span>
                                    <span class="nsac-table-val" data-side="${escapeHTML(B.title)}">${escapeHTML(row.b || "—")}</span>
                                </div>
                            `;

                        }).join("")}

                    </div>
                </div>

                <div class="nsac-block nsac-block-distinguish ${curatedNote ? "nsac-block-curated" : ""}">
                    <div class="nsac-block-label">
                        HOW TO TELL THEM APART
                        ${curatedNote ? '<span class="nsac-curated-badge">EXPERT NOTE</span>' : ""}
                    </div>
                    <p>${distinguishText}</p>
                </div>

            `;

            this.refs.body.querySelectorAll("[data-launch]").forEach(btn => {

                btn.addEventListener("click", () => {

                    const id = btn.getAttribute("data-launch");

                    if (
                        window.AttackExperienceRenderer &&
                        typeof window.AttackExperienceRenderer.show === "function"
                    ) {

                        this.hide();
                        window.AttackExperienceRenderer.show(id);

                    }

                });

            });

        }

    };


    window.AttackCompareApp = CompareApp;

})();
