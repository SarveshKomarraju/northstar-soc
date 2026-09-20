// =========================================================
// NORTHSTAR SOC
// PACKET PARSER
// =========================================================

class PacketParser {

    static parse(packet) {

        if (!packet || typeof packet !== "object") {
            return [];
        }

        const layers = [];

        // =================================================
        // FRAME
        // =================================================

        layers.push({
            name: "Frame",
            protocol: "frame",
            fields: [
                ["Packet number", packet.number ?? "N/A"],
                ["Packet ID", packet.id ?? "N/A"],
                ["Arrival time", packet.timestamp ?? "N/A"],
                ["Frame length", `${packet.length ?? 0} bytes`]
            ]
        });

        // =================================================
        // ETHERNET
        // =================================================

        layers.push({
            name: "Ethernet II",
            protocol: "ethernet",
            fields: [
                [
                    "Destination",
                    packet.destinationMAC ?? "N/A"
                ],
                [
                    "Source",
                    packet.sourceMAC ?? "N/A"
                ],
                [
                    "Type",
                    packet.protocol === "ARP"
                        ? "ARP"
                        : "IPv4"
                ]
            ]
        });

        // =================================================
        // ARP
        // =================================================

        if (packet.protocol === "ARP") {

            const arp = packet.arp || {};

            layers.push({
                name: "Address Resolution Protocol",
                protocol: "arp",
                fields: [
                    [
                        "Hardware type",
                        arp.hardwareType ?? "N/A"
                    ],
                    [
                        "Protocol type",
                        arp.protocolType ?? "N/A"
                    ],
                    [
                        "Operation",
                        arp.operation ?? "N/A"
                    ],
                    [
                        "Sender MAC address",
                        arp.senderMAC ?? "N/A"
                    ],
                    [
                        "Sender IP address",
                        arp.senderIP ?? "N/A"
                    ],
                    [
                        "Target MAC address",
                        arp.targetMAC ?? "N/A"
                    ],
                    [
                        "Target IP address",
                        arp.targetIP ?? "N/A"
                    ]
                ]
            });

            return layers;
        }

        // =================================================
        // IPV4
        // =================================================

        layers.push({
            name: "Internet Protocol Version 4",
            protocol: "ipv4",
            fields: [
                [
                    "Source",
                    packet.sourceIP ?? "N/A"
                ],
                [
                    "Destination",
                    packet.destinationIP ?? "N/A"
                ],
                [
                    "Time to live",
                    "128"
                ],
                [
                    "Header length",
                    "20 bytes"
                ],
                [
                    "Protocol",
                    packet.transport ||
                    packet.protocol ||
                    "UNKNOWN"
                ]
            ]
        });

        // =================================================
        // TCP
        // =================================================

        if (packet.transport === "TCP") {

            const tcp = packet.tcp || {};

            layers.push({
                name: "Transmission Control Protocol",
                protocol: "tcp",
                fields: [
                    [
                        "Source Port",
                        packet.sourcePort ?? "N/A"
                    ],
                    [
                        "Destination Port",
                        packet.destinationPort ?? "N/A"
                    ],
                    [
                        "Sequence Number",
                        tcp.sequence ?? "N/A"
                    ],
                    [
                        "Acknowledgment Number",
                        tcp.acknowledgement ?? "N/A"
                    ],
                    [
                        "Flags",
                        tcp.flags ?? "N/A"
                    ],
                    [
                        "Window Size",
                        tcp.windowSize ?? "N/A"
                    ]
                ]
            });
        }

        // =================================================
        // UDP
        // =================================================

        if (packet.transport === "UDP") {

            layers.push({
                name: "User Datagram Protocol",
                protocol: "udp",
                fields: [
                    [
                        "Source Port",
                        packet.sourcePort ?? "N/A"
                    ],
                    [
                        "Destination Port",
                        packet.destinationPort ?? "N/A"
                    ],
                    [
                        "Length",
                        `${packet.length ?? 0} bytes`
                    ]
                ]
            });
        }

        // =================================================
        // ICMP
        // =================================================

        if (packet.protocol === "ICMP") {

            const icmp = packet.icmp || {};

            layers.push({
                name: "Internet Control Message Protocol",
                protocol: "icmp",
                fields: [
                    [
                        "Type",
                        `${icmp.type ?? "N/A"} (${icmp.typeName ?? "Unknown"})`
                    ],
                    [
                        "Code",
                        icmp.code ?? "N/A"
                    ],
                    [
                        "Sequence",
                        icmp.sequence ?? "N/A"
                    ]
                ]
            });

            return layers;
        }

        // =================================================
        // DNS
        // =================================================

        if (packet.protocol === "DNS") {

            const dns = packet.dns || {};

            const transactionId =
                Number.isFinite(Number(dns.transactionId))
                    ? `0x${Number(dns.transactionId)
                        .toString(16)
                        .padStart(4, "0")}`
                    : "N/A";

            layers.push({
                name: "Domain Name System",
                protocol: "dns",
                fields: [
                    [
                        "Transaction ID",
                        transactionId
                    ],
                    [
                        "Flags",
                        dns.flags ?? "N/A"
                    ],
                    [
                        "Query Name",
                        dns.queryName ?? "N/A"
                    ],
                    [
                        "Query Type",
                        dns.queryType ?? "N/A"
                    ],
                    [
                        "Query Class",
                        dns.queryClass ?? "N/A"
                    ]
                ]
            });
        }

        // =================================================
        // NBNS
        // =================================================

        if (packet.protocol === "NBNS") {

            const nbns = packet.nbns || {};

            const transactionId =
                Number.isFinite(Number(nbns.transactionId))
                    ? `0x${Number(nbns.transactionId)
                        .toString(16)
                        .padStart(4, "0")}`
                    : "N/A";

            layers.push({
                name: "NetBIOS Name Service",
                protocol: "nbns",
                fields: [
                    [
                        "Transaction ID",
                        transactionId
                    ],
                    [
                        "Flags",
                        nbns.flags ?? "N/A"
                    ],
                    [
                        "Query Name",
                        nbns.queryName ?? "N/A"
                    ],
                    [
                        "Suffix",
                        nbns.suffix ?? "N/A"
                    ]
                ]
            });
        }

        // =================================================
        // KERBEROS
        // =================================================

        if (packet.protocol === "KRB5") {

            const kerberos =
                packet.kerberos || {};

            layers.push({
                name: "Kerberos",
                protocol: "kerberos",
                fields: [
                    [
                        "Protocol Version",
                        kerberos.protocolVersion ?? "N/A"
                    ],
                    [
                        "Message Type",
                        kerberos.messageType ?? "N/A"
                    ],
                    [
                        "Client Name",
                        kerberos.clientName ?? "N/A"
                    ],
                    [
                        "Realm",
                        kerberos.realm ?? "N/A"
                    ],
                    [
                        "Service Name",
                        kerberos.serviceName ?? "N/A"
                    ],
                    [
                        "Encryption Type",
                        kerberos.encryptionType ?? "N/A"
                    ]
                ]
            });
        }

        // =================================================
        // HTTP
        // =================================================

        if (packet.protocol === "HTTP") {

            const http = packet.http || {};

            layers.push({
                name: "Hypertext Transfer Protocol",
                protocol: "http",
                fields: [
                    [
                        "Request Method",
                        http.requestMethod ?? "N/A"
                    ],
                    [
                        "Request URI",
                        http.requestUri ?? "N/A"
                    ],
                    [
                        "Host",
                        http.host ?? "N/A"
                    ],
                    [
                        "HTTP Version",
                        http.version ?? "N/A"
                    ]
                ]
            });
        }

        // =================================================
        // TLS
        // =================================================

        if (packet.protocol === "TLS") {

            const tls = packet.tls || {};

            layers.push({
                name: "Transport Layer Security",
                protocol: "tls",
                fields: [
                    [
                        "Record Type",
                        tls.recordType ?? "N/A"
                    ],
                    [
                        "Handshake Type",
                        tls.handshakeType ?? "N/A"
                    ],
                    [
                        "Version",
                        tls.version ?? "N/A"
                    ],
                    [
                        "Server Name",
                        tls.serverName ?? "N/A"
                    ]
                ]
            });
        }

        return layers;
    }


    // =====================================================
    // RAW BYTES
    // =====================================================

    static generateBytes(packet) {

        if (!packet) {
            return [];
        }

        const requestedLength =
            Number(packet.length) || 0;

        const length =
            Math.min(
                Math.max(requestedLength, 0),
                256
            );

        const seed =
            `${packet.id ?? ""}|` +
            `${packet.sourceIP ?? ""}|` +
            `${packet.destinationIP ?? ""}|` +
            `${packet.protocol ?? ""}`;

        let hash = 0;

        for (
            let index = 0;
            index < seed.length;
            index++
        ) {

            hash =
                (
                    (
                        hash << 5
                    ) -
                    hash +
                    seed.charCodeAt(index)
                ) |
                0;
        }

        const bytes = [];

        for (
            let index = 0;
            index < length;
            index++
        ) {

            hash =
                (
                    hash * 1664525 +
                    1013904223
                ) |
                0;

            bytes.push(
                (hash >>> 0) & 0xff
            );
        }

        return bytes;
    }
}


window.PacketParser = PacketParser;

console.log(
    "%c[PACKET PARSER] ONLINE",
    "color:#69d99a;font-weight:bold;"
);