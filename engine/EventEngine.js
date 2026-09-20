/* =========================================================
   SOC COMMAND CENTER
   EVENT ENGINE
   ========================================================= */

export class EventEngine {

    constructor() {

        this.events = [];

        this.listeners = [];

        this.eventCounter = 0;

        this.maxEvents = 2000;

        this.originId =
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}`;


        this.channel =
            typeof BroadcastChannel !== "undefined"
                ? new BroadcastChannel(
                    "soc-command-center-events"
                )
                : null;


        if (this.channel) {

            this.channel.onmessage =
                message => {

                    if (
                        !message ||
                        !message.data
                    ) {
                        return;
                    }


                    if (
                        message.data.type !==
                        "SECURITY_EVENT"
                    ) {
                        return;
                    }


                    const event =
                        message.data.event;


                    if (!event) {
                        return;
                    }


                    /*
                     * Don't add our own broadcast
                     * back into our event store.
                     */

                    if (
                        event.originId ===
                        this.originId
                    ) {
                        return;
                    }


                    const duplicate =
                        this.events.some(
                            existing =>
                                existing.id ===
                                event.id
                        );


                    if (duplicate) {
                        return;
                    }


                    this.storeEvent(
                        event
                    );

                };

        }


        console.log(
            "[EVENT ENGINE] ONLINE"
        );
    }


    /* =====================================================
       CREATE EVENT
       ===================================================== */

    createEvent(data = {}) {

        const event = {

            id:
                `${Date.now()}-${++this.eventCounter}-${Math.random()
                    .toString(36)
                    .slice(2, 7)}`,

            originId:
                this.originId,

            timestamp:
                new Date().toISOString(),

            eventType:
                data.eventType ||
                "UNKNOWN",

            severity:
                data.severity ||
                "INFO",

            actor:
                data.actor ||
                null,

            actorType:
                data.actorType ||
                null,

            sourceIP:
                data.sourceIP ||
                null,

            destinationIP:
                data.destinationIP ||
                null,

            hostname:
                data.hostname ||
                null,

            username:
                data.username ||
                null,

            process:
                data.process ||
                null,

            command:
                data.command ||
                null,

            sourceCountry:
                data.sourceCountry ||
                null,

            message:
                data.message ||
                "Security event generated.",

            attackId:
                data.attackId ||
                null,

            metadata:
                data.metadata ||
                {}

        };


        this.storeEvent(
            event
        );


        /*
         * Broadcast to other SOC applications/tabs.
         */

        if (this.channel) {

            this.channel.postMessage({

                type:
                    "SECURITY_EVENT",

                event

            });

        }


        console.log(
            "[EVENT]",
            event.eventType,
            event.actorType || "",
            event.actor || "",
            event
        );


        return event;
    }


    /* =====================================================
       STORE EVENT
       ===================================================== */

    storeEvent(event) {

        this.events.push(
            event
        );


        if (
            this.events.length >
            this.maxEvents
        ) {

            this.events.shift();

        }


        this.notify(
            event
        );
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
                        listener !==
                        callback
                );

        };
    }


    /* =====================================================
       NOTIFY
       ===================================================== */

    notify(event) {

        for (
            const listener
            of [...this.listeners]
        ) {

            try {

                listener(
                    event
                );

            } catch (error) {

                console.error(
                    "[EVENT ENGINE] Listener error:",
                    error
                );

            }

        }
    }


    /* =====================================================
       GET ALL EVENTS
       ===================================================== */

    getAllEvents() {

        return [
            ...this.events
        ];
    }


    /* =====================================================
       SEARCH
       ===================================================== */

    search(query = "") {

        const q =
            String(
                query
            )
                .trim()
                .toLowerCase();


        if (!q) {

            return this.getAllEvents();

        }


        return this.events.filter(
            event => {

                return JSON.stringify(
                    event
                )
                    .toLowerCase()
                    .includes(q);

            }
        );
    }


    /* =====================================================
       GET BY ATTACK
       ===================================================== */

    getEventsByAttack(
        attackId
    ) {

        if (!attackId) {
            return [];
        }


        return this.events.filter(
            event =>
                event.attackId ===
                attackId
        );
    }


    /* =====================================================
       GET BY TYPE
       ===================================================== */

    getEventsByType(
        eventType
    ) {

        return this.events.filter(
            event =>
                event.eventType ===
                eventType
        );
    }


    /* =====================================================
       CLEAR
       ===================================================== */

    clear() {

        this.events = [];

        console.log(
            "[EVENT ENGINE] Event database cleared."
        );
    }


    /* =====================================================
       COUNT
       ===================================================== */

    getEventCount() {

        return this.events.length;
    }


    /* =====================================================
       DESTROY
       ===================================================== */

    destroy() {

        if (this.channel) {

            this.channel.close();

            this.channel = null;
        }


        this.listeners = [];

        this.events = [];


        console.log(
            "[EVENT ENGINE] Shutdown."
        );
    }
}