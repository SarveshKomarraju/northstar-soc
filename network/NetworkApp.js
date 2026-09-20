// =========================================================
// NORTHSTAR SOC
// NETWORK APPLICATION
//
// Simulated Wireshark-style network analyzer.
//
// NetworkStore is the authoritative packet history.
// PacketEngine is the live packet source.
//
// Display filters are parsed by NetworkFilter.js.
//
// Examples:
//
//     dns
//     kerberos
//     nbns
//     ip.addr == 10.10.10.21
//     ip.src == 10.10.10.21
//     ip.dst == 10.10.10.21
//     tcp.port == 443
//     udp.port == 53
//     eth.addr == 02:10:10:00:00:21
//     dns.qry.name == example.com
//     http.host == example.com
//     tls.handshake.extensions_server_name == example.com
//
//     ip.addr == 10.10.10.21 && kerberos
//     ip.addr == 10.10.10.21 && nbns
//     ip.addr == 10.10.10.21 && (dns || kerberos)
//     dns || nbns
//     ip.addr == 10.10.10.21 && !arp
// =========================================================

import { NetworkFilter }
    from "./NetworkFilter.js";


// =========================================================
// CONFIRM DIALOG
//
// A centered, on-theme replacement for window.confirm().
// Appended to <body> (not the app container) so it always
// centers on the actual viewport, even though desktop
// windows are draggable/transformed.
// =========================================================

function showNetworkConfirmDialog(options) {

    const {
        title = "CONFIRM",
        message = "",
        confirmLabel = "CONFIRM",
        cancelLabel = "CANCEL"
    } = options || {};


    return new Promise(
        resolve => {

            const overlay =
                document.createElement(
                    "div"
                );

            overlay.className =
                "network-confirm-overlay";


            overlay.innerHTML = `

                <div class="network-confirm-dialog" role="alertdialog" aria-modal="true">

                    <div class="network-confirm-title">
                        ${title}
                    </div>

                    <div class="network-confirm-message">
                        ${message}
                    </div>

                    <div class="network-confirm-actions">

                        <button
                            type="button"
                            class="network-confirm-button cancel"
                            data-network-confirm="cancel"
                        >
                            ${cancelLabel}
                        </button>

                        <button
                            type="button"
                            class="network-confirm-button confirm"
                            data-network-confirm="confirm"
                        >
                            ${confirmLabel}
                        </button>

                    </div>

                </div>

            `;


            function cleanup(result) {

                document.removeEventListener(
                    "keydown",
                    onKeydown
                );

                overlay.remove();

                resolve(
                    result
                );

            }


            function onKeydown(event) {

                if (
                    event.key ===
                    "Escape"
                ) {

                    cleanup(
                        false
                    );

                }

            }


            overlay.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        overlay
                    ) {

                        cleanup(
                            false
                        );

                    }

                }
            );


            overlay
                .querySelector(
                    '[data-network-confirm="cancel"]'
                )
                .addEventListener(
                    "click",
                    () =>
                        cleanup(
                            false
                        )
                );


            overlay
                .querySelector(
                    '[data-network-confirm="confirm"]'
                )
                .addEventListener(
                    "click",
                    () =>
                        cleanup(
                            true
                        )
                );


            document.addEventListener(
                "keydown",
                onKeydown
            );


            document.body.appendChild(
                overlay
            );


            overlay
                .querySelector(
                    '[data-network-confirm="confirm"]'
                )
                .focus();

        }
    );

}


function initializeNetwork(container) {

    if (!container) {

        console.error(
            "[NETWORK] Container not found."
        );

        return;

    }


    // =====================================================
    // INITIALIZE GLOBAL WINDOW STATE
    // =====================================================

    window.highestZIndex =
        Number.isFinite(
            Number(window.highestZIndex)
        )
            ? Number(window.highestZIndex)
            : 1000;


    // =====================================================
    // APPLICATION HTML
    // =====================================================

    container.innerHTML = `

        <div class="network-app">

            <header class="network-header">

                <div class="network-header-left">

                    <div class="network-title">
                        NETWORK TRAFFIC ANALYZER
                    </div>

                    <div class="network-subtitle">
                        NORTHSTAR SECURITY OPERATIONS CENTER
                    </div>

                </div>

                <div class="network-capture-status">

                    <span
                        class="network-status-dot"
                        data-network-status-dot
                    ></span>

                    <span data-network-status>
                        CAPTURE STOPPED
                    </span>

                </div>

            </header>


            <section class="network-toolbar">

                <div class="network-capture-controls">

                    <button
                        class="network-control-button start"
                        data-network-action="start"
                    >
                        ▶ START
                    </button>

                    <button
                        class="network-control-button pause"
                        data-network-action="pause"
                    >
                        Ⅱ PAUSE
                    </button>

                    <button
                        class="network-control-button stop"
                        data-network-action="stop"
                    >
                        ■ STOP
                    </button>

                </div>


                <div class="network-stat">

                    <span>
                        CAPTURED
                    </span>

                    <strong data-network-stat="packets">
                        0
                    </strong>

                </div>


                <div class="network-stat">

                    <span>
                        DISPLAYED
                    </span>

                    <strong data-network-stat="displayed">
                        0
                    </strong>

                </div>


                <div class="network-stat">

                    <span>
                        DROPPED
                    </span>

                    <strong data-network-stat="dropped">
                        0
                    </strong>

                </div>


                <div class="network-stat">

                    <span>
                        INTERFACE
                    </span>

                    <strong>
                        SOC-NET
                    </strong>

                </div>

            </section>


            <section class="network-filter">

                <span class="network-filter-label">
                    DISPLAY FILTER
                </span>

                <input
                    type="text"
                    data-network-filter
                    placeholder="ip.addr == 10.10.10.21 && kerberos"
                    autocomplete="off"
                    spellcheck="false"
                >

                <button
                    data-network-action="filter"
                >
                    APPLY
                </button>

                <button
                    data-network-action="clear-filter"
                >
                    CLEAR
                </button>

                <span
                    class="network-filter-status"
                    data-network-filter-status
                >
                    ALL PACKETS
                </span>

            </section>


            <section class="network-packet-panel">

                <div class="network-panel-header">

                    <span>
                        CAPTURE
                    </span>

                    <span data-network-packet-count>
                        0 PACKETS
                    </span>

                </div>


                <div class="network-packet-table">

                    <div class="network-packet-header">

                        <span>NO.</span>
                        <span>TIME</span>
                        <span>SOURCE</span>
                        <span>DESTINATION</span>
                        <span>PROTOCOL</span>
                        <span>INFO</span>
                        <span>LEN</span>

                    </div>


                    <div
                        class="network-packet-list"
                        data-network-packets
                    ></div>

                </div>

            </section>

        </div>

    `;


    // =====================================================
    // ELEMENTS
    // =====================================================

    const packetList =
        container.querySelector(
            "[data-network-packets]"
        );

    const filterInput =
        container.querySelector(
            "[data-network-filter]"
        );

    const filterStatus =
        container.querySelector(
            "[data-network-filter-status]"
        );

    const status =
        container.querySelector(
            "[data-network-status]"
        );

    const statusDot =
        container.querySelector(
            "[data-network-status-dot]"
        );

    const packetCount =
        container.querySelector(
            "[data-network-packet-count]"
        );

    const startButton =
        container.querySelector(
            '[data-network-action="start"]'
        );

    const pauseButton =
        container.querySelector(
            '[data-network-action="pause"]'
        );


    // =====================================================
    // FILTER ENGINE
    // =====================================================

    const networkFilter =
        window.networkFilter ||
        new NetworkFilter();


    window.networkFilter =
        networkFilter;


    // =====================================================
    // STATE
    // =====================================================

    let displayedPackets = [];

    let selectedPacket = null;

    let captureState = "STOPPED";

    /*
     * Once the player explicitly hits STOP (confirmed via the
     * dialog), capture cannot be brought back without reopening
     * Network — see PacketEngine.stop(). This flag keeps the
     * status indicator honest: START/PAUSE should never flip it
     * back to LIVE/PAUSED after a real stop, since no traffic
     * will actually resume.
     */
    let captureHalted = false;

    let activeFilter = "";

    let unsubscribePacketEngine = null;

    let packetEngineConnectionTimer = null;

    let networkStoreConnectionTimer = null;


    // =====================================================
    // ENGINE HELPERS
    // =====================================================

    function getPacketEngine() {

        return (
            window.packetEngine ||
            null
        );

    }


    function getNetworkStore() {

        return (
            window.networkStore ||
            null
        );

    }


    // =====================================================
    // AUTHORITATIVE PACKET HISTORY
    // =====================================================

    function getPackets() {

        const store =
            getNetworkStore();


        if (
            store &&
            typeof store.getPackets ===
            "function"
        ) {

            const packets =
                store.getPackets();


            return Array.isArray(
                packets
            )
                ? packets
                : [];

        }


        /*
         * Fallback only if NetworkStore has not
         * finished loading yet.
         *
         * We deliberately do NOT maintain a second
         * packet history here.
         */

        return [];

    }


    // =====================================================
    // HELPERS
    // =====================================================

    function safe(value) {

        if (
            typeof escapeHTML ===
            "function"
        ) {

            return escapeHTML(
                String(value ?? "")
            );

        }

        return String(value ?? "")
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );

    }


    function getProtocol(packet) {

        return String(
            packet?.protocol ||
            "UNKNOWN"
        ).toUpperCase();

    }


    function getSource(packet) {

        return (
            packet?.sourceIP ||
            packet?.srcIP ||
            "N/A"
        );

    }


    function getDestination(packet) {

        return (
            packet?.destinationIP ||
            packet?.destIP ||
            "N/A"
        );

    }


    function getLength(packet) {

        return (
            packet?.length ??
            packet?.packetLength ??
            packet?.size ??
            "—"
        );

    }


    function getInfo(packet) {

        if (packet?.info) {

            return packet.info;

        }


        const protocol =
            getProtocol(packet);


        if (
            protocol === "DNS" &&
            packet.dns
        ) {

            return (
                `Standard query ` +
                `${packet.dns.queryType || "A"} ` +
                `${packet.dns.queryName || ""}`
            );

        }


        if (
            protocol === "HTTP" &&
            packet.http
        ) {

            return (
                `${packet.http.requestMethod || "GET"} ` +
                `${packet.http.requestUri || "/"} ` +
                `Host: ${packet.http.host || "N/A"}`
            );

        }


        if (
            protocol === "TLS" &&
            packet.tls
        ) {

            return (
                `${packet.tls.handshakeType || "Handshake"} ` +
                `${packet.tls.serverName || ""}`
            );

        }


        if (
            protocol === "ARP" &&
            packet.arp
        ) {

            return (
                `${packet.arp.operation || "ARP"} ` +
                `${packet.arp.targetIP || ""}`
            );

        }


        if (
            protocol === "ICMP" &&
            packet.icmp
        ) {

            return (
                `${packet.icmp.typeName || "ICMP"} ` +
                `seq=${packet.icmp.sequence ?? "?"}`
            );

        }


        if (
            protocol === "KRB5" &&
            packet.kerberos
        ) {

            return (
                `${packet.kerberos.messageType || "Kerberos"} ` +
                `${packet.kerberos.clientName || ""}`
            );

        }


        if (
            protocol === "NBNS" &&
            packet.nbns
        ) {

            return (
                `Name query ` +
                `${packet.nbns.queryName || ""}`
            );

        }


        return `${protocol} traffic`;

    }


    // =====================================================
    // STATUS
    // =====================================================

    function updateStatus() {

        if (status) {

            status.textContent =
                `CAPTURE ${captureState}`;

        }


        if (statusDot) {

            statusDot.classList.remove(
                "live",
                "paused",
                "stopped"
            );

            statusDot.classList.add(
                captureState.toLowerCase()
            );

        }

    }


    // =====================================================
    // STATS
    // =====================================================

    function updateStats() {

        const packets =
            getPackets();


        const packetStat =
            container.querySelector(
                '[data-network-stat="packets"]'
            );

        const displayedStat =
            container.querySelector(
                '[data-network-stat="displayed"]'
            );

        const droppedStat =
            container.querySelector(
                '[data-network-stat="dropped"]'
            );


        if (packetStat) {

            packetStat.textContent =
                packets.length;

        }


        if (displayedStat) {

            displayedStat.textContent =
                displayedPackets.length;

        }


        /*
         * PacketEngine / NetworkStore already enforce
         * the rolling packet buffer.
         *
         * "DROPPED" here represents packets outside
         * the retained local capture buffer.
         *
         * We do not fabricate a number.
         */

        if (droppedStat) {

            const store =
                getNetworkStore();


            if (
                store &&
                typeof store.getBufferStatus ===
                "function"
            ) {

                const bufferStatus =
                    store.getBufferStatus();


                droppedStat.textContent =
                    bufferStatus?.bufferFull
                        ? "ROLLING"
                        : "0";

            }

            else {

                droppedStat.textContent =
                    "0";

            }

        }


        if (packetCount) {

            packetCount.textContent =
                `${displayedPackets.length} PACKETS`;

        }

    }


    // =====================================================
    // FILTER STATUS
    // =====================================================

    function clearFilterErrorState() {

        if (filterStatus) {

            filterStatus.classList.remove(
                "invalid"
            );

        }


        if (filterInput) {

            filterInput.classList.remove(
                "filter-invalid"
            );

            filterInput.removeAttribute(
                "aria-invalid"
            );

            filterInput.title =
                "";

        }

    }


    // =====================================================
    // FILTER ENGINE
    // =====================================================

    function applyFilter() {

        const packets =
            getPackets();


        const expression =
            String(
                filterInput?.value || ""
            ).trim();

        activeFilter =
            expression;


        clearFilterErrorState();


        // -------------------------------------------------
        // EMPTY FILTER
        // -------------------------------------------------

        if (!expression) {

            displayedPackets =
                [...packets];


            if (filterStatus) {

                filterStatus.textContent =
                    "ALL PACKETS";

            }


            renderPackets();

            updateStats();

            return;

        }


        // -------------------------------------------------
        // VALIDATE
        // -------------------------------------------------

        const validation =
            networkFilter.validate(
                expression
            );


        if (!validation.valid) {

            displayedPackets =
                [];


            if (filterStatus) {

                filterStatus.textContent =
                    `INVALID FILTER: ${validation.error}`;

                filterStatus.classList.add(
                    "invalid"
                );

            }


            if (filterInput) {

                filterInput.classList.add(
                    "filter-invalid"
                );

                filterInput.setAttribute(
                    "aria-invalid",
                    "true"
                );

                filterInput.title =
                    validation.error;

            }


            renderPackets();

            updateStats();

            return;

        }


        // -------------------------------------------------
        // APPLY FILTER
        // -------------------------------------------------

        try {

            displayedPackets =
                networkFilter.apply(
                    packets,
                    expression
                );


            if (filterStatus) {

                filterStatus.textContent =
                    `${displayedPackets.length} MATCHES`;

            }

        }

        catch (error) {

            displayedPackets =
                [];


            if (filterStatus) {

                filterStatus.textContent =
                    `FILTER ERROR: ${error.message}`;

                filterStatus.classList.add(
                    "invalid"
                );

            }

        }


        renderPackets();

        updateStats();

    }


    // =====================================================
    // PACKET TABLE
    // =====================================================

    function renderPackets() {

        if (!packetList) {

            return;

        }


        /*
         * Real Wireshark appends new packets to the bottom of
         * the list with an ever-increasing number — it doesn't
         * yank the view around, but it does follow new traffic
         * if you're already watching the tail of the capture.
         *
         * Capture "was near the bottom" BEFORE wiping the list,
         * so we know whether to follow the new packet down.
         */
        const wasNearBottom =
            packetList.scrollHeight -
            packetList.scrollTop -
            packetList.clientHeight <
            40;


        packetList.innerHTML =
            "";


        if (!displayedPackets.length) {

            packetList.innerHTML = `

                <div class="network-empty">

                    <div class="network-empty-icon">
                        ◌
                    </div>

                    <div class="network-empty-title">
                        ${activeFilter
                    ? "NO MATCHING PACKETS"
                    : "NO PACKETS CAPTURED"
                }
                    </div>

                    <div class="network-empty-text">
                        ${activeFilter
                    ? "No retained packets match the current display filter."
                    : "Waiting for network telemetry."
                }
                    </div>

                </div>

            `;


            updateStats();

            return;

        }


        displayedPackets
            .forEach(
                packet => {

                    const row =
                        document.createElement(
                            "div"
                        );


                    row.className =
                        "network-packet-row";


                    if (
                        selectedPacket &&
                        packet.id ===
                        selectedPacket.id
                    ) {

                        row.classList.add(
                            "selected"
                        );

                    }


                    const timestamp =
                        packet.timestamp
                            ? new Date(
                                packet.timestamp
                            ).toLocaleTimeString(
                                [],
                                {
                                    hour12: false
                                }
                            )
                            : "--:--:--";


                    const protocol =
                        getProtocol(packet);


                    const info =
                        getInfo(packet);


                    row.innerHTML = `

                        <span class="packet-number">
                            ${safe(
                        packet.number ??
                        "—"
                    )}
                        </span>

                        <span class="packet-time">
                            ${safe(timestamp)}
                        </span>

                        <span class="packet-source">
                            ${safe(
                        getSource(packet)
                    )}
                        </span>

                        <span class="packet-destination">
                            ${safe(
                        getDestination(packet)
                    )}
                        </span>

                        <span
                            class="packet-protocol packet-protocol-${safe(
                        protocol.toLowerCase()
                    )}"
                        >
                            ${safe(protocol)}
                        </span>

                        <span class="packet-info">
                            ${safe(info)}
                        </span>

                        <span class="packet-length">
                            ${safe(
                        getLength(packet)
                    )}
                        </span>

                    `;


                    row.addEventListener(
                        "click",
                        () => {

                            selectedPacket =
                                packet;

                            renderPackets();

                        }
                    );


                    row.addEventListener(
                        "dblclick",
                        event => {

                            event.stopPropagation();

                            openPacketInspector(
                                packet
                            );

                        }
                    );


                    packetList.appendChild(
                        row
                    );

                }
            );


        /*
         * Follow live traffic down the list, same as real
         * Wireshark — but only if the analyst was already
         * watching the tail. If they've scrolled up to inspect
         * earlier packets, leave their view alone.
         */
        if (
            wasNearBottom
        ) {

            packetList.scrollTop =
                packetList.scrollHeight;

        }


        updateStats();

    }


    // =====================================================
    // PACKET INSPECTOR
    // =====================================================

    function openPacketInspector(packet) {

        if (!packet) {

            return;

        }


        const packetId =
            String(
                packet.id ||
                packet.number ||
                ""
            );


        const existing =
            Array.from(
                document.querySelectorAll(
                    ".packet-inspector-window"
                )
            ).find(
                windowElement =>
                    windowElement.dataset.packetId ===
                    packetId
            );


        if (existing) {

            existing.style.zIndex =
                ++window.highestZIndex;

            return;

        }


        let layers = [];

        let bytes = [];


        if (
            window.PacketParser &&
            typeof window.PacketParser.parse ===
            "function"
        ) {

            try {

                layers =
                    window.PacketParser.parse(
                        packet
                    );

            }

            catch (error) {

                console.error(
                    "[NETWORK] Packet parser error:",
                    error
                );

            }

        }


        if (
            window.PacketParser &&
            typeof window.PacketParser.generateBytes ===
            "function"
        ) {

            try {

                bytes =
                    window.PacketParser.generateBytes(
                        packet
                    );

            }

            catch (error) {

                console.error(
                    "[NETWORK] Byte generation error:",
                    error
                );

            }

        }


        const inspectorWindow =
            document.createElement(
                "section"
            );


        inspectorWindow.className =
            "packet-inspector-window";


        inspectorWindow.dataset.packetId =
            packetId;


        inspectorWindow.style.zIndex =
            ++window.highestZIndex;


        inspectorWindow.innerHTML = `

            <div class="packet-inspector-titlebar">

                <div class="packet-inspector-title">

                    <span class="packet-inspector-icon">
                        ◈
                    </span>

                    <span>
                        PACKET ${safe(
            packet.number ??
            "N/A"
        )}
                    </span>

                    <span class="packet-inspector-protocol">
                        ${safe(
            getProtocol(packet)
        )}
                    </span>

                </div>


                <div class="packet-inspector-controls">

                    <button
                        class="packet-inspector-minimize"
                        title="Minimize"
                    >
                        −
                    </button>

                    <button
                        class="packet-inspector-maximize"
                        title="Maximize"
                    >
                        □
                    </button>

                    <button
                        class="packet-inspector-close"
                        title="Close"
                    >
                        ×
                    </button>

                </div>

            </div>


            <div class="packet-inspector-summary">

                <div>

                    <span>
                        TIME
                    </span>

                    <strong>
                        ${safe(
            packet.timestamp
                ? new Date(
                    packet.timestamp
                ).toLocaleString()
                : "N/A"
        )}
                    </strong>

                </div>


                <div>

                    <span>
                        SOURCE
                    </span>

                    <strong>
                        ${safe(
            getSource(packet)
        )}
                    </strong>

                </div>


                <div>

                    <span>
                        DESTINATION
                    </span>

                    <strong>
                        ${safe(
            getDestination(packet)
        )}
                    </strong>

                </div>


                <div>

                    <span>
                        PROTOCOL
                    </span>

                    <strong>
                        ${safe(
            getProtocol(packet)
        )}
                    </strong>

                </div>

            </div>


            <div class="packet-inspector-content">

                <div class="packet-protocol-tree">

                    <div class="packet-tree-header">

                        <span>
                            PACKET DETAILS
                        </span>

                        <span>
                            ${safe(
            layers.length
        )} LAYERS
                        </span>

                    </div>

                    <div
                        class="packet-tree"
                        data-packet-tree
                    ></div>

                </div>


                <div class="packet-raw-section">

                    <div class="packet-tree-header">

                        <span>
                            RAW PACKET BYTES
                        </span>

                        <span>
                            ${safe(
            bytes.length
        )} bytes
                        </span>

                    </div>


                    <pre
                        class="packet-raw-bytes"
                        data-packet-bytes
                    ></pre>

                </div>

            </div>

        `;


        document.body.appendChild(
            inspectorWindow
        );


        // =================================================
        // RENDER LAYERS
        // =================================================

        const tree =
            inspectorWindow.querySelector(
                "[data-packet-tree]"
            );


        if (!layers.length) {

            tree.innerHTML = `

                <div class="packet-tree-empty">
                    Packet parser returned no protocol layers.
                </div>

            `;

        }

        else {

            layers.forEach(
                (
                    layer,
                    index
                ) => {

                    renderPacketLayer(
                        tree,
                        layer,
                        index
                    );

                }
            );

        }


        // =================================================
        // RAW BYTES
        // =================================================

        const byteContainer =
            inspectorWindow.querySelector(
                "[data-packet-bytes]"
            );


        if (byteContainer) {

            byteContainer.textContent =
                formatPacketBytesRaw(
                    bytes
                );

        }


        // =================================================
        // CONTROLS
        // =================================================

        const closeButton =
            inspectorWindow.querySelector(
                ".packet-inspector-close"
            );


        const minimizeButton =
            inspectorWindow.querySelector(
                ".packet-inspector-minimize"
            );


        const maximizeButton =
            inspectorWindow.querySelector(
                ".packet-inspector-maximize"
            );


        closeButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                inspectorWindow.remove();

            }
        );


        minimizeButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                inspectorWindow.classList.toggle(
                    "packet-inspector-minimized"
                );

            }
        );


        maximizeButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                inspectorWindow.classList.toggle(
                    "packet-inspector-maximized"
                );

            }
        );


        inspectorWindow.addEventListener(
            "mousedown",
            () => {

                inspectorWindow.style.zIndex =
                    ++window.highestZIndex;

            }
        );


        enablePacketInspectorDragging(
            inspectorWindow
        );

    }


    // =====================================================
    // RENDER PACKET LAYER
    // =====================================================

    function renderPacketLayer(
        container,
        layer,
        index
    ) {

        const element =
            document.createElement(
                "div"
            );


        element.className =
            "packet-tree-layer";


        const fields =
            Array.isArray(
                layer?.fields
            )
                ? layer.fields
                : [];


        element.innerHTML = `

            <div
                class="packet-tree-layer-header"
                data-layer-header
            >

                <span class="packet-tree-arrow">
                    ▼
                </span>

                <strong>
                    ${safe(
            layer?.name ||
            "UNKNOWN"
        )}
                </strong>

                <span class="packet-tree-layer-number">
                    ${index + 1}
                </span>

            </div>


            <div
                class="packet-tree-layer-fields"
                data-layer-fields
            ></div>

        `;


        const fieldsContainer =
            element.querySelector(
                "[data-layer-fields]"
            );


        fields.forEach(
            field => {

                const fieldElement =
                    document.createElement(
                        "div"
                    );


                fieldElement.className =
                    "packet-tree-field";


                let name;

                let value;


                if (
                    Array.isArray(field)
                ) {

                    name =
                        field[0];

                    value =
                        field[1];

                }

                else {

                    name =
                        field?.name ||
                        "FIELD";

                    value =
                        field?.value ??
                        "";

                }


                fieldElement.innerHTML = `

                    <span class="packet-tree-field-name">
                        ${safe(name)}
                    </span>

                    <span class="packet-tree-field-value">
                        ${safe(value)}
                    </span>

                `;


                fieldsContainer.appendChild(
                    fieldElement
                );

            }
        );


        const header =
            element.querySelector(
                "[data-layer-header]"
            );


        const arrow =
            element.querySelector(
                ".packet-tree-arrow"
            );


        header.addEventListener(
            "click",
            () => {

                const collapsed =
                    fieldsContainer.classList.toggle(
                        "collapsed"
                    );


                arrow.textContent =
                    collapsed
                        ? "▶"
                        : "▼";

            }
        );


        container.appendChild(
            element
        );

    }


    // =====================================================
    // RAW BYTE FORMATTER
    // =====================================================

    function formatPacketBytesRaw(
        bytes
    ) {

        if (
            !Array.isArray(bytes) ||
            !bytes.length
        ) {

            return (
                "No raw packet bytes available."
            );

        }


        const lines = [];


        for (
            let offset = 0;
            offset < bytes.length;
            offset += 16
        ) {

            const chunk =
                bytes.slice(
                    offset,
                    offset + 16
                );


            const hex =
                chunk
                    .map(
                        byte =>
                            Number(byte)
                                .toString(16)
                                .padStart(
                                    2,
                                    "0"
                                )
                                .toUpperCase()
                    )
                    .join(" ");


            const paddedHex =
                hex.padEnd(
                    47,
                    " "
                );


            const ascii =
                chunk
                    .map(
                        byte => {

                            const value =
                                Number(byte);


                            return (
                                value >= 32 &&
                                value <= 126
                            )
                                ? String.fromCharCode(
                                    value
                                )
                                : ".";

                        }
                    )
                    .join("");


            lines.push(
                `${offset
                    .toString(16)
                    .padStart(
                        8,
                        "0"
                    )
                    .toUpperCase()}  ` +
                `${paddedHex}  ` +
                `${ascii}`
            );

        }


        return lines.join(
            "\n"
        );

    }


    // =====================================================
    // DRAGGING
    // =====================================================

    function enablePacketInspectorDragging(
        inspectorWindow
    ) {

        const titlebar =
            inspectorWindow.querySelector(
                ".packet-inspector-titlebar"
            );


        if (!titlebar) {

            return;

        }


        let dragging = false;

        let offsetX = 0;

        let offsetY = 0;


        titlebar.addEventListener(
            "mousedown",
            event => {

                if (
                    event.target.closest(
                        ".packet-inspector-controls"
                    )
                ) {

                    return;

                }


                if (
                    inspectorWindow.classList.contains(
                        "packet-inspector-maximized"
                    )
                ) {

                    return;

                }


                dragging = true;


                const rect =
                    inspectorWindow.getBoundingClientRect();


                /*
                 * The window starts centered via CSS
                 * (left/top: 50% + transform: translate(-50%, -50%)).
                 * Once we start dragging we switch to explicit
                 * pixel left/top, so that leftover centering
                 * transform has to be cleared here — otherwise it
                 * keeps shifting the box by half its own
                 * width/height on top of whatever left/top the
                 * drag sets, which is what made dragging feel like
                 * it was jumping/glitching instead of following
                 * the cursor.
                 */
                inspectorWindow.style.left =
                    `${rect.left}px`;


                inspectorWindow.style.top =
                    `${rect.top}px`;


                inspectorWindow.style.transform =
                    "none";


                offsetX =
                    event.clientX -
                    rect.left;


                offsetY =
                    event.clientY -
                    rect.top;


                inspectorWindow.style.zIndex =
                    ++window.highestZIndex;


                event.preventDefault();

            }
        );


        function move(event) {

            if (!dragging) {

                return;

            }


            inspectorWindow.style.left =
                `${event.clientX - offsetX}px`;


            inspectorWindow.style.top =
                `${event.clientY - offsetY}px`;

        }


        function stop() {

            dragging = false;

        }


        document.addEventListener(
            "mousemove",
            move
        );


        document.addEventListener(
            "mouseup",
            stop
        );

    }


    // =====================================================
    // CAPTURE CONTROLS
    // =====================================================

    function startCapture() {

        if (
            captureHalted
        ) {
            return;
        }


        const engine =
            getPacketEngine();


        if (
            !engine ||
            typeof engine.start !==
            "function"
        ) {

            console.error(
                "[NETWORK] PacketEngine unavailable."
            );


            captureState =
                "STOPPED";


            updateStatus();

            return;

        }


        engine.start();


        captureState =
            "LIVE";


        updateStatus();


        console.log(
            "[NETWORK] Packet capture started."
        );

    }


    function pauseCapture() {

        if (
            captureHalted
        ) {
            return;
        }


        const engine =
            getPacketEngine();


        if (
            !engine?.running
        ) {

            return;

        }


        if (
            typeof engine.pause ===
            "function"
        ) {

            engine.pause();

        }


        captureState =
            "PAUSED";


        updateStatus();


        console.log(
            "[NETWORK] Packet capture paused."
        );

    }


    async function stopCapture() {

        if (
            captureHalted
        ) {
            return;
        }


        const confirmed =
            await showNetworkConfirmDialog({
                title:
                    "STOP PACKET CAPTURE",

                message:
                    "Once stopped, capture cannot be restarted with the START button. You'll need to reopen Network to resume live traffic.",

                confirmLabel:
                    "■ STOP CAPTURE",

                cancelLabel:
                    "CANCEL"
            });


        if (
            !confirmed
        ) {
            return;
        }


        const engine =
            getPacketEngine();


        if (
            engine &&
            typeof engine.stop ===
            "function"
        ) {

            engine.stop();

        }


        captureState =
            "STOPPED";

        captureHalted =
            true;


        updateStatus();


        if (
            startButton
        ) {

            startButton.disabled =
                true;

        }


        if (
            pauseButton
        ) {

            pauseButton.disabled =
                true;

        }


        console.log(
            "[NETWORK] Packet capture stopped."
        );

    }


    // =====================================================
    // LIVE PACKET UPDATE
    //
    // PacketEngine is used only as the live notification
    // source. The actual packet list always comes from
    // NetworkStore.
    // =====================================================

    function handleLivePacket() {

        /*
         * NetworkStore receives the packet first and owns
         * the retained history.
         *
         * Read the current store snapshot rather than
         * appending into another local buffer.
         */

        applyFilter();

    }


    // =====================================================
    // PACKET ENGINE CONNECTION
    // =====================================================

    function connectPacketEngine() {

        if (
            unsubscribePacketEngine
        ) {

            return true;

        }


        const engine =
            getPacketEngine();


        if (
            !engine ||
            typeof engine.subscribe !==
            "function"
        ) {

            return false;

        }


        unsubscribePacketEngine =
            engine.subscribe(
                packet => {

                    if (!packet) {

                        return;

                    }


                    handleLivePacket();

                }
            );


        console.log(
            "[NETWORK] Connected to PacketEngine live telemetry."
        );


        return true;

    }


    function waitForPacketEngine() {

        if (
            connectPacketEngine()
        ) {

            if (
                packetEngineConnectionTimer
            ) {

                clearInterval(
                    packetEngineConnectionTimer
                );

                packetEngineConnectionTimer =
                    null;

            }


            return;

        }


        if (
            packetEngineConnectionTimer
        ) {

            return;

        }


        packetEngineConnectionTimer =
            setInterval(
                () => {

                    if (
                        connectPacketEngine()
                    ) {

                        clearInterval(
                            packetEngineConnectionTimer
                        );

                        packetEngineConnectionTimer =
                            null;

                    }

                },
                100
            );

    }


    // =====================================================
    // NETWORK STORE CONNECTION
    //
    // The app may open before NetworkStore finishes
    // connecting to PacketEngine.
    //
    // Once the store exists, immediately load its
    // historical packets.
    // =====================================================

    function connectNetworkStore() {

        const store =
            getNetworkStore();


        if (
            !store ||
            typeof store.getPackets !==
            "function"
        ) {

            return false;

        }


        applyFilter();


        console.log(
            "[NETWORK] Loaded retained packet history:",
            getPackets().length
        );


        return true;

    }


    function waitForNetworkStore() {

        if (
            connectNetworkStore()
        ) {

            if (
                networkStoreConnectionTimer
            ) {

                clearInterval(
                    networkStoreConnectionTimer
                );

                networkStoreConnectionTimer =
                    null;

            }


            return;

        }


        if (
            networkStoreConnectionTimer
        ) {

            return;

        }


        networkStoreConnectionTimer =
            setInterval(
                () => {

                    if (
                        connectNetworkStore()
                    ) {

                        clearInterval(
                            networkStoreConnectionTimer
                        );

                        networkStoreConnectionTimer =
                            null;

                    }

                },
                100
            );

    }


    // =====================================================
    // BUTTON EVENTS
    // =====================================================

    container
        .querySelectorAll(
            "[data-network-action]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const action =
                            button.dataset.networkAction;


                        if (
                            action ===
                            "start"
                        ) {

                            startCapture();

                        }


                        if (
                            action ===
                            "pause"
                        ) {

                            pauseCapture();

                        }


                        if (
                            action ===
                            "stop"
                        ) {

                            stopCapture();

                        }


                        if (
                            action ===
                            "filter"
                        ) {

                            applyFilter();

                        }


                        if (
                            action ===
                            "clear-filter"
                        ) {

                            if (
                                filterInput
                            ) {

                                filterInput.value =
                                    "";

                            }


                            applyFilter();

                        }

                    }
                );

            }
        );


    // =====================================================
    // ENTER KEY
    // =====================================================

    if (filterInput) {

        filterInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    applyFilter();

                }

            }
        );

    }


    // =====================================================
    // INITIAL CONNECTIONS
    // =====================================================

    waitForNetworkStore();

    waitForPacketEngine();


    // =====================================================
    // INITIAL STATE
    // =====================================================

    updateStatus();

    updateStats();

    renderPackets();


    /*
     * If NetworkStore is already online, this immediately
     * populates the table with historical packets.
     */

    connectNetworkStore();


    console.log(
        "%c[NETWORK] Network analyzer initialized.",
        "color:#6fa8ff;"
    );


    // =====================================================
    // RETURN API
    // =====================================================

    return {

        start:
            startCapture,

        pause:
            pauseCapture,

        stop:
            stopCapture,

        clear: () => {

            const store =
                getNetworkStore();


            if (
                store &&
                typeof store.clear ===
                "function"
            ) {

                store.clear();

            }


            selectedPacket =
                null;


            displayedPackets =
                [];


            applyFilter();

            console.log(
                "[NETWORK] Retained packet history cleared."
            );

        },


        refresh: () => {

            applyFilter();

        },


        destroy: () => {

            if (
                typeof unsubscribePacketEngine ===
                "function"
            ) {

                unsubscribePacketEngine();

                unsubscribePacketEngine =
                    null;

            }


            if (
                packetEngineConnectionTimer
            ) {

                clearInterval(
                    packetEngineConnectionTimer
                );

                packetEngineConnectionTimer =
                    null;

            }


            if (
                networkStoreConnectionTimer
            ) {

                clearInterval(
                    networkStoreConnectionTimer
                );

                networkStoreConnectionTimer =
                    null;

            }

        }

    };

}


// =========================================================
// GLOBAL EXPOSURE
// =========================================================

window.initializeNetwork =
    initializeNetwork;