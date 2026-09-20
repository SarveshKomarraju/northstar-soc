/* =========================================================
   SOC COMMAND CENTER
   ALERT MANAGER
   ---------------------------------------------------------
   Converts detections into SOC alerts.

   IMPORTANT:
   - Alerts begin as NEW.
   - The attacker never changes alert status.
   - Only the analyst/UI changes the status.
   ========================================================= */

export class AlertManager {

    constructor() {

        this.alerts = [];

        this.listeners = [];

        this.alertCounter = 0;

        this.maxAlerts = 500;

        console.log(
            "[ALERT MANAGER] Online."
        );
    }


    /* =====================================================
       CREATE ALERT
       ===================================================== */

    createAlert(data = {}) {

        const now =
            new Date().toISOString();

        const alert = {

            id:
                data.id ||
                `ALT-${String(
                    ++this.alertCounter
                ).padStart(4, "0")}`,

            title:
                data.title ||
                "Security Alert",

            description:
                data.description ||
                "Suspicious security activity detected.",

            severity:
                data.severity ||
                "MEDIUM",

            status:
                "NEW",

            attackId:
                data.attackId ||
                null,

            /*
             * Exact SIEM events that produced this alert.
             */
            eventIds:
                Array.isArray(data.eventIds)
                    ? [...data.eventIds]
                    : [],

            /*
             * Snapshot of the event that initially
             * triggered the detection.
             */
            sourceEvent:
                data.sourceEvent
                    ? { ...data.sourceEvent }
                    : null,

            /*
             * Detection timing.
             */
            firstSeen:
                data.firstSeen ||
                data.sourceEvent?.timestamp ||
                now,

            lastSeen:
                data.lastSeen ||
                data.sourceEvent?.timestamp ||
                now,

            eventCount:
                data.eventCount ||
                1,

            detectionRule:
                data.detectionRule ||
                null,

            createdAt:
                now,

            updatedAt:
                now
        };


        this.alerts.push(alert);


        if (
            this.alerts.length >
            this.maxAlerts
        ) {

            this.alerts.shift();

        }


        console.log(
            "[ALERT MANAGER] NEW ALERT:",
            alert
        );


        this.notify(alert);


        return alert;
    }


    /* =====================================================
       UPDATE STATUS
       -----------------------------------------------------
       ONLY analyst actions should call this.
       ===================================================== */

    updateStatus(
        alertId,
        status
    ) {

        const validStatuses = [

            "NEW",

            "INVESTIGATING",

            "CONTAINED",

            "RESOLVED",

            "FALSE_POSITIVE"

        ];


        if (
            !validStatuses.includes(status)
        ) {

            console.warn(
                "[ALERT MANAGER] Invalid status:",
                status
            );

            return false;
        }


        const alert =
            this.alerts.find(
                item =>
                    item.id === alertId
            );


        if (!alert) {

            return false;
        }


        alert.status =
            status;

        alert.updatedAt =
            new Date().toISOString();


        console.log(
            `[ALERT MANAGER] ${alert.id} → ${status}`
        );


        this.notify(alert);


        return true;
    }


    /* =====================================================
       GET ALERTS
       ===================================================== */

    getAllAlerts() {

        return [
            ...this.alerts
        ];
    }


    getAlert(alertId) {

        return this.alerts.find(
            alert =>
                alert.id === alertId
        );
    }


    /* =====================================================
       SUBSCRIBE
       ===================================================== */

    subscribe(callback) {

        if (
            typeof callback !== "function"
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
                        "[ALERT MANAGER] Listener error:",
                        error
                    );

                }

            }
        );
    }


    /* =====================================================
       CLEAR
       ===================================================== */

    clear() {

        this.alerts = [];

        console.log(
            "[ALERT MANAGER] Alerts cleared."
        );

    }
}


/* =========================================================
   GLOBAL INSTANCE
   ========================================================= */

window.alertManager =
    window.alertManager ||
    new AlertManager();


console.log(
    "[ALERT MANAGER] ONLINE"
);