/* =========================================================
   NORTHSTAR SOC — SAVE SLOTS
   File: main-menu/SaveSlots.js

   Shared data layer for the save-session system — both the
   desktop's account menu ("Save and Quit") and the Main Menu's
   Load Session screen read/write through this instead of each
   touching localStorage directly, so there's exactly one place
   that knows the storage key, the shape of a save record, and
   the 3-slot limit.

   A save record is intentionally shallow:
     { id, name, scenario, timestamp, thumbnail }
   There's no deep engine-state serialization here — AttackEngine/
   EventEngine/etc. are all real-time, in-memory simulations with
   nothing that already serializes to disk, and NorthStar only
   has one real scenario's worth of content today (see
   project-overview.md). Opening a save re-launches the desktop
   for that scenario exactly like the existing "Continue" flow
   already did — this just adds a real picker (thumbnail, name,
   up to 3 of them) in front of that same mechanism instead of
   silently jumping into whichever scenario was last active.

   Plain script (not an ES module) — loaded before MainMenu.js
   and DesktopFeatures.js, both of which call into
   window.NorthstarSaveSlots.
   ========================================================= */

(function () {

    "use strict";


    const STORAGE_KEY =
        "northstar-saved-sessions";

    const MAX_SLOTS = 3;


    const SCENARIO_LABELS = {
        "credential-theft": "Operation Nightfall",
        "scenario-001": "Operation Nightfall",
        "ransomware": "Ransomware Incident",
        "worm-outbreak": "Worm Outbreak",
        "free-operation": "Free Operation"
    };


    /* =====================================================
       STORAGE
       ===================================================== */

    function loadAll() {

        try {

            const raw =
                localStorage.getItem(
                    STORAGE_KEY
                );

            if (!raw) {
                return [];
            }

            const parsed =
                JSON.parse(raw);

            return Array.isArray(parsed)
                ? parsed.filter(
                    entry => entry && entry.id
                )
                : [];

        } catch (error) {

            console.warn(
                "[SAVE SLOTS] Could not load saves.",
                error
            );

            return [];

        }

    }


    function persist(saves) {

        try {

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(saves)
            );

            return true;

        } catch (error) {

            console.warn(
                "[SAVE SLOTS] Could not save.",
                error
            );

            return false;

        }

    }


    /* =====================================================
       LABELS
       ===================================================== */

    function scenarioLabel(scenarioId) {

        return (
            SCENARIO_LABELS[scenarioId] ||
            "Free Operation"
        );

    }


    function defaultName(scenarioId) {

        const now =
            new Date();

        const pad =
            n => String(n).padStart(2, "0");

        const stamp =
            `${now.getMonth() + 1}/${now.getDate()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

        return `${scenarioLabel(scenarioId)} — ${stamp}`;

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.NorthstarSaveSlots = {

        MAX_SLOTS,


        /**
         * Newest first — matches how a real "recent saves" list
         * reads.
         */
        getAll() {

            return loadAll().sort(
                (a, b) =>
                    new Date(b.timestamp || 0) -
                    new Date(a.timestamp || 0)
            );

        },


        getById(id) {

            return (
                loadAll().find(
                    entry => entry.id === id
                ) || null
            );

        },


        isFull() {

            return loadAll().length >= MAX_SLOTS;

        },


        /**
         * Creates a brand-new save. Returns null (without
         * writing anything) if all MAX_SLOTS are already used —
         * the caller is expected to check isFull() first and
         * route to overwriteSave() with a slot the player picked
         * instead of silently failing here.
         */
        createSave({ scenario, name, thumbnail } = {}) {

            const saves =
                loadAll();

            if (saves.length >= MAX_SLOTS) {
                return null;
            }

            const entry = {

                id:
                    `save-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,

                name:
                    name || defaultName(scenario),

                scenario:
                    scenario || null,

                timestamp:
                    new Date().toISOString(),

                thumbnail:
                    thumbnail || null

            };

            saves.push(entry);

            persist(saves);

            return entry;

        },


        /**
         * Replaces an existing save in place (same id, fresh
         * timestamp/thumbnail/scenario) — how "Save and Quit"
         * fills a chosen slot when all 3 are already used.
         */
        overwriteSave(id, { scenario, name, thumbnail } = {}) {

            const saves =
                loadAll();

            const index =
                saves.findIndex(
                    entry => entry.id === id
                );

            if (index === -1) {
                return null;
            }

            const updated = {

                ...saves[index],

                name:
                    name || defaultName(scenario),

                scenario:
                    scenario || saves[index].scenario,

                timestamp:
                    new Date().toISOString(),

                thumbnail:
                    thumbnail || saves[index].thumbnail

            };

            saves[index] = updated;

            persist(saves);

            return updated;

        },


        renameSave(id, name) {

            const trimmed =
                String(name || "").trim();

            if (!trimmed) {
                return false;
            }

            const saves =
                loadAll();

            const entry =
                saves.find(
                    save => save.id === id
                );

            if (!entry) {
                return false;
            }

            entry.name =
                trimmed.slice(0, 60);

            return persist(saves);

        },


        /**
         * Permanently removes a save. Returns true if a save with
         * that id existed and was removed, false otherwise (id
         * not found, or the write failed).
         */
        deleteSave(id) {

            const saves =
                loadAll();

            const index =
                saves.findIndex(
                    entry => entry.id === id
                );

            if (index === -1) {
                return false;
            }

            saves.splice(index, 1);

            return persist(saves);

        },


        scenarioLabel,

        defaultName

    };


    console.log(
        "[SAVE SLOTS] Ready."
    );

})();
