/* =========================================================
   SIMULATION ENGINE
   ========================================================= */

export class SimulationEngine {

    constructor(options = {}) {

        this.hosts =
            options.hosts || [];

        this.users =
            options.users || [];

        this.network =
            options.network || null;

        /*
         * Do NOT permanently trust the constructor reference.
         * AttackEngine may be initialized after this object.
         */
        this.attackEngine =
            options.attackEngine || null;

        this.running = false;

        this.startTime = null;

        console.log(
            "[SIMULATION ENGINE] Ready."
        );
    }


    /* =====================================================
       START
       ===================================================== */

    start() {

        if (this.running) {
            return;
        }

        /*
         * Get the live AttackEngine instance.
         *
         * This fixes the problem where SimulationEngine
         * was constructed before AttackEngine was available.
         */
        if (
            !this.attackEngine &&
            window.attackEngine
        ) {

            this.attackEngine =
                window.attackEngine;
        }


        if (!this.attackEngine) {

            console.error(
                "[SIMULATION ENGINE] AttackEngine unavailable."
            );

            return;
        }


        this.running = true;

        this.startTime =
            Date.now();


        console.log(
            "[SIMULATION ENGINE] Simulation started."
        );


        /*
         * Start the autonomous adversary.
         */
        if (
            typeof this.attackEngine.start ===
            "function"
        ) {

            this.attackEngine.start();

        } else {

            console.error(
                "[SIMULATION ENGINE] AttackEngine.start() unavailable."
            );

            this.running = false;

        }
    }


    /* =====================================================
       STOP
       ===================================================== */

    stop() {

        if (!this.running) {
            return;
        }

        this.running = false;


        if (
            this.attackEngine &&
            typeof this.attackEngine.stop ===
            "function"
        ) {

            this.attackEngine.stop();

        }


        console.log(
            "[SIMULATION ENGINE] Simulation stopped."
        );
    }


    /* =====================================================
       RESET
       ===================================================== */

    reset() {

        this.stop();

        this.startTime =
            null;

        console.log(
            "[SIMULATION ENGINE] Simulation reset."
        );
    }


    /* =====================================================
       STATUS
       ===================================================== */

    getStatus() {

        return {

            running:
                this.running,

            startTime:
                this.startTime,

            attackEngine:
                !!this.attackEngine

        };
    }
}


/* =========================================================
   GLOBAL INSTANCE
   ========================================================= */

/*
 * Do not create the instance here.
 *
 * SimulationBootstrap owns the instance so that all engines
 * are initialized in a predictable order.
 */

console.log(
    "[SIMULATION ENGINE] Module loaded."
);