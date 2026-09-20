/* =========================================================
   SOC COMMAND CENTER
   ALERT STORE

   Stores analyst-facing alerts separately from raw SIEM
   telemetry.

   Raw events belong to EventEngine.
   Alerts belong here.
   ========================================================= */

export class AlertStore {

    constructor() {

        this.alerts = [];

        this.alertCounter = 0;

        this.maxAlerts = 500;

        this.listeners = [];
    }


    /* =====================================================
       CREATE ALERT
       ===================================================== */

    createAlert(data = {}) {

        const alert = {

            id:
                `ALT-${String(
                    ++this.alertCounter
                ).padStart(4, "0")}`,

            title:
                data.title ||
                "Suspicious Activity Detected",

            description:
                data.description ||
                "A security detection was triggered.",

            severity:
                data.severity ||
                "MEDIUM",

            status:
                "NEW",

            createdAt:
                new Date().toISOString(),

            updatedAt:
                new Date().toISOString(),

            ruleId:
                data.ruleId ||
                null,

            attackId:
                data.attackId ||
                null,

            hostname:
                data.hostname ||
                null,

            username:
                data.username ||
                null,

            sourceIP:
                data.sourceIP ||
                null,

            destinationIP:
                data.destinationIP ||
                null,

            sourceCountry:
                data.sourceCountry ||
                null,

            /*
             * IDs of the actual SIEM events that
             * caused this alert.
             */

            evidenceEventIds:
                data.evidenceEventIds || [],

            metadata:
                data.metadata || {}

        };


        this.alerts.push(alert);


        if (
            this.alerts.length >
            this.maxAlerts
        ) {

            this.alerts.shift();

        }


        this.notify(alert);


        console.log(
            "[ALERT STORE] Alert created:",
            alert
        );


        return alert;
    }


    /* =====================================================
       SUBSCRIBE
       ===================================================== */

    subscribe(callback) {

        if (
            typeof callback !==
            "function"
        ) {

            return () => { };
        }


        this.listeners.push(
            callback
        );


        return () => {

            this.listeners =
                this.listeners.filter(
                    listener =>
                        listener !== callback
                );

        };
    }


    /* =====================================================
       NOTIFY
       ===================================================== */

    notify(alert) {

        this.listeners.forEach(
            listener => {

                try {

                    listener(alert);

                } catch (error) {

                    console.error(
                        "[ALERT STORE] Listener error:",
                        error
                    );

                }

            }
        );
    }


    /* =====================================================
       GET ALL
       ===================================================== */

    getAllAlerts() {

        return [
            ...this.alerts
        ];

    }


    /* =====================================================
       GET BY ID
       ===================================================== */

    getAlert(alertId) {

        return this.alerts.find(
            alert =>
                alert.id === alertId
        );

    }


    /* =====================================================
       GET BY STATUS
       ===================================================== */

    getByStatus(status) {

        return this.alerts.filter(
            alert =>
                alert.status === status
        );

    }


    /* =====================================================
       GET BY SEVERITY
       ===================================================== */

    getBySeverity(severity) {

        return this.alerts.filter(
            alert =>
                alert.severity === severity
        );

    }


    /* =====================================================
       UPDATE STATUS
       ===================================================== */

    updateStatus(
        alertId,
        status
    ) {

        const alert =
            this.getAlert(alertId);


        if (!alert) {

            return false;

        }


        alert.status =
            status;

        alert.updatedAt =
            new Date().toISOString();


        this.notify(alert);


        return true;
    }


    /* =====================================================
       CLEAR
       ===================================================== */

    clear() {

        this.alerts = [];

    }


    /* =====================================================
       COUNT
       ===================================================== */

    getCount() {

        return this.alerts.length;

    }
}