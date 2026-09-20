// =========================================================
// NORTHSTAR SOC
// NETWORK STORE
//
// Central packet store for the synthetic network analyzer.
//
// PacketEngine
//      ↓
// NetworkStore
//      ↓
// NetworkApp / NetworkInvestigator
//
// The store waits for PacketEngine if it loads later.
//
// IMPORTANT:
// - Retains up to 5,000 packets.
// - Oldest packets are discarded when the buffer is full.
// - Historical packets remain available when the Network
//   application is opened.
// - The store does NOT control PacketEngine.
// - Clearing the store does NOT stop packet generation.
// =========================================================


class NetworkStore {

    constructor() {

        this.packets = [];

        /*
         * PCAP-style rolling capture buffer.
         *
         * Once this reaches 5,000 packets, the oldest
         * packet is removed whenever a new packet arrives.
         */
        this.maxPackets = 5000;

        this.selectedPacket = null;

        this.subscribers = new Set();

        this.packetEngineUnsubscribe = null;

        this.packetEngineConnected = false;

        this.engineCheckTimer = null;


        // =================================================
        // PACKET ENGINE CONNECTION
        // =================================================

        /*
         * Try immediately in case PacketEngine has already
         * loaded.
         */

        this.connectPacketEngine();


        /*
         * PacketEngine may load after this module.
         *
         * Keep checking until the connection succeeds.
         */

        if (!this.packetEngineConnected) {

            this.engineCheckTimer =
                setInterval(
                    () => {

                        if (
                            this.packetEngineConnected
                        ) {

                            clearInterval(
                                this.engineCheckTimer
                            );

                            this.engineCheckTimer =
                                null;

                            return;

                        }

                        this.connectPacketEngine();

                    },
                    100
                );

        }

    }


    // =====================================================
    // PACKET ENGINE CONNECTION
    // =====================================================

    connectPacketEngine() {

        if (
            this.packetEngineConnected
        ) {

            return true;

        }


        const engine =
            window.packetEngine;


        if (
            !engine ||
            typeof engine.subscribe !==
            "function"
        ) {

            return false;

        }


        this.packetEngineUnsubscribe =
            engine.subscribe(
                packet => {

                    this.addPacket(
                        packet
                    );

                }
            );


        this.packetEngineConnected =
            true;


        /*
         * PacketEngine can already have generated traffic
         * before the NetworkStore connected.
         *
         * The store cannot recover packets that were emitted
         * before subscription unless PacketEngine provides
         * its own history API.
         *
         * Once connected, all subsequent packets are retained.
         */


        console.log(
            "%c[NETWORK STORE] Connected to PacketEngine.",
            "color:#69d99a;font-weight:bold;"
        );


        return true;

    }


    // =====================================================
    // SUBSCRIBE
    // =====================================================

    subscribe(callback) {

        if (
            typeof callback !==
            "function"
        ) {

            return () => { };

        }


        this.subscribers.add(
            callback
        );


        return () => {

            this.subscribers.delete(
                callback
            );

        };

    }


    // =====================================================
    // NOTIFY
    // =====================================================

    notify() {

        this.subscribers.forEach(
            callback => {

                try {

                    callback(
                        this.packets
                    );

                }

                catch (error) {

                    console.error(
                        "[NETWORK STORE]",
                        error
                    );

                }

            }
        );

    }


    // =====================================================
    // ADD PACKET
    // =====================================================

    addPacket(packet) {

        if (!packet) {

            return;

        }


        this.packets.push(
            packet
        );


        /*
         * Rolling PCAP buffer.
         *
         * Preserve only the newest 5,000 packets.
         */

        if (
            this.packets.length >
            this.maxPackets
        ) {

            this.packets.shift();

        }


        this.notify();

    }


    // =====================================================
    // GET PACKETS
    // =====================================================

    getPackets() {

        return [
            ...this.packets
        ];

    }


    // =====================================================
    // GET SINGLE PACKET
    // =====================================================

    getPacket(id) {

        return (
            this.packets.find(
                packet =>
                    packet.id === id
            ) ||
            null
        );

    }


    // =====================================================
    // GET OLDEST PACKET
    // =====================================================

    getOldestPacket() {

        return (
            this.packets[0] ||
            null
        );

    }


    // =====================================================
    // GET NEWEST PACKET
    // =====================================================

    getNewestPacket() {

        return (
            this.packets[
            this.packets.length - 1
            ] ||
            null
        );

    }


    // =====================================================
    // CLEAR
    //
    // IMPORTANT:
    // Clearing the store does NOT stop PacketEngine.
    //
    // New packets will continue arriving while the engine
    // is running.
    // =====================================================

    clear() {

        this.packets = [];

        this.selectedPacket =
            null;

        this.notify();


        console.log(
            "[NETWORK STORE] Capture buffer cleared."
        );

    }


    // =====================================================
    // SELECT
    // =====================================================

    selectPacket(packet) {

        this.selectedPacket =
            packet;

        this.notify();

    }


    // =====================================================
    // PACKET COUNT
    // =====================================================

    getPacketCount() {

        return this.packets.length;

    }


    // =====================================================
    // BUFFER STATUS
    // =====================================================

    getBufferStatus() {

        const count =
            this.packets.length;


        return {

            packetCount:
                count,

            maximum:
                this.maxPackets,

            full:
                count >=
                this.maxPackets,

            utilization:
                this.maxPackets > 0
                    ? count /
                    this.maxPackets
                    : 0

        };

    }


    // =====================================================
    // PROTOCOL COUNTS
    // =====================================================

    getProtocolCounts() {

        const counts = {};


        this.packets.forEach(
            packet => {

                const protocol =
                    packet.protocol ||
                    "UNKNOWN";


                counts[protocol] =
                    (
                        counts[protocol] ||
                        0
                    ) + 1;

            }
        );


        return counts;

    }


    // =====================================================
    // STATUS
    // =====================================================

    getStatus() {

        return {

            packetCount:
                this.packets.length,

            maxPackets:
                this.maxPackets,

            bufferFull:
                this.packets.length >=
                this.maxPackets,

            connected:
                this.packetEngineConnected,

            selectedPacket:
                this.selectedPacket

        };

    }


    // =====================================================
    // DESTROY
    // =====================================================

    destroy() {

        if (
            this.engineCheckTimer
        ) {

            clearInterval(
                this.engineCheckTimer
            );

            this.engineCheckTimer =
                null;

        }


        if (
            this.packetEngineUnsubscribe
        ) {

            this.packetEngineUnsubscribe();

            this.packetEngineUnsubscribe =
                null;

        }


        this.packetEngineConnected =
            false;


        this.subscribers.clear();

        this.packets = [];

        this.selectedPacket =
            null;


        console.log(
            "[NETWORK STORE] Destroyed."
        );

    }

}


// =========================================================
// GLOBAL STORE
// =========================================================

window.networkStore =
    new NetworkStore();


console.log(
    "%c[NETWORK STORE] ONLINE",
    "color:#69d99a;font-weight:bold;"
);