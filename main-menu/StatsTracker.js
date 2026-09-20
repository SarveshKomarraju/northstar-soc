/* =========================================================
   NORTHSTAR SOC — STATS TRACKER
   File: main-menu/StatsTracker.js

   Shared, lightweight activity log behind the Main Menu's
   STATISTICS screen (main-menu/MainMenu.js — replaces the old
   front-page EXIT button, which just showed a "SESSION
   TERMINATED" screen that looped straight back to the main
   menu and didn't actually do anything). Tracks three things,
   each backed by a real signal already fired elsewhere in the
   codebase — nothing here is invented data:

     1. Attack simulations experienced (freeplay/
        AttackExperienceRenderer.js calls recordAttackExperienced()
        the moment a timeline finishes playing).
     2. Real scenario operations completed (listens for the
        `northstar:game-complete` event already dispatched by
        malware-sandbox/NightfallEnding.js when the player wins).
     3. Saved sessions — NOT tracked here; the Stats screen reads
        those directly from window.NorthstarSaveSlots, which is
        already the single source of truth for that data.

   Storage is intentionally shallow, same philosophy as
   SaveSlots.js: no engine-state serialization, just small
   counters/timestamps this screen can read back.

   Plain script (not an ES module) — must load before anything
   that calls into window.NorthstarStats: MainMenu.js (renders
   the screen) and freeplay/AttackExperienceRenderer.js (records
   a play). Loaded alongside SaveSlots.js, ahead of both.
   ========================================================= */

(function () {

    "use strict";


    const STORAGE_KEY =
        "northstar-stats";

    const MAX_OPERATIONS_HISTORY =
        50;


    /* =====================================================
       STORAGE
       ===================================================== */

    function loadData() {

        try {

            const raw =
                localStorage.getItem(
                    STORAGE_KEY
                );

            const parsed =
                raw ? JSON.parse(raw) : null;

            return {

                attacksExperienced:
                    (parsed && parsed.attacksExperienced) || {},

                operationsCompleted:
                    Array.isArray(parsed && parsed.operationsCompleted)
                        ? parsed.operationsCompleted
                        : []

            };

        } catch (error) {

            console.warn(
                "[STATS] Could not load saved stats — starting fresh.",
                error
            );

            return {
                attacksExperienced: {},
                operationsCompleted: []
            };

        }

    }


    function persist(data) {

        try {

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(data)
            );

            return true;

        } catch (error) {

            console.warn(
                "[STATS] Could not save stats.",
                error
            );

            return false;

        }

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    const Stats = {

        /**
         * Called once per completed timeline play by
         * AttackExperienceRenderer.js's handleComplete(). Bumps a
         * per-attack play count rather than a flat boolean, so the
         * screen can show "played 3×" instead of just a checkmark.
         */
        recordAttackExperienced(attackId) {

            if (!attackId) {
                return;
            }

            const data =
                loadData();

            const now =
                Date.now();

            const existing =
                data.attacksExperienced[attackId];

            data.attacksExperienced[attackId] = existing
                ? {
                    count: (existing.count || 0) + 1,
                    firstAt: existing.firstAt || now,
                    lastAt: now
                }
                : {
                    count: 1,
                    firstAt: now,
                    lastAt: now
                };

            persist(data);

        },


        getAttackStats(attackId) {

            return loadData().attacksExperienced[attackId] || null;

        },


        getExperiencedAttackIds() {

            return Object.keys(
                loadData().attacksExperienced
            );

        },


        /**
         * Called once per real scenario win (see the
         * `northstar:game-complete` listener below — this is
         * exposed too in case something wants to record one
         * directly). Keeps only the most recent
         * MAX_OPERATIONS_HISTORY entries.
         */
        recordOperationCompleted(operationId) {

            const data =
                loadData();

            data.operationsCompleted.push({
                operation: operationId || "unknown",
                at: Date.now()
            });

            if (data.operationsCompleted.length > MAX_OPERATIONS_HISTORY) {

                data.operationsCompleted =
                    data.operationsCompleted.slice(
                        -MAX_OPERATIONS_HISTORY
                    );

            }

            persist(data);

        },


        /**
         * Newest first — matches how a real "recent activity" list
         * reads.
         */
        getOperationsCompleted() {

            return loadData()
                .operationsCompleted
                .slice()
                .reverse();

        },


        /**
         * One place for the 3 top-line numbers the Stats screen's
         * summary strip shows — avoids re-deriving them slightly
         * differently in more than one spot.
         */
        getSummary() {

            const data =
                loadData();

            const attackIds =
                Object.keys(data.attacksExperienced);

            const totalAttackPlays =
                attackIds.reduce(
                    (sum, id) =>
                        sum + (data.attacksExperienced[id].count || 0),
                    0
                );

            return {

                attacksExperiencedCount:
                    attackIds.length,

                totalAttackPlays,

                operationsCompletedCount:
                    data.operationsCompleted.length

            };

        }

    };


    /* =====================================================
       WIRE UP THE REAL "OPERATION WON" SIGNAL
       ---------------------------------------------------
       malware-sandbox/NightfallEnding.js already dispatches this
       exact event, with { operation: "nightfall" }, the moment the
       player reaches the victory screen. No new hook needed on
       that side — this just listens.
       ===================================================== */

    window.addEventListener(
        "northstar:game-complete",
        event => {

            const operationId =
                (event && event.detail && event.detail.operation) ||
                window.NorthstarScenario ||
                "unknown";

            Stats.recordOperationCompleted(
                operationId
            );

        }
    );


    window.NorthstarStats =
        Stats;


    console.log(
        "[STATS] Ready."
    );

})();
