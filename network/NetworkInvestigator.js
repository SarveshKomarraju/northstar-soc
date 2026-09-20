// =========================================================
// NORTHSTAR SOC
// NETWORK INVESTIGATOR
// =========================================================

class NetworkInvestigator {

    constructor(store) {

        this.store =
            store;

    }


    // =====================================================
    // SEARCH
    // =====================================================

    search(query) {

        const value =
            String(
                query || ""
            )
                .trim()
                .toLowerCase();

        if (!value) {

            return this.store.getPackets();

        }


        return this.store
            .getPackets()
            .filter(packet => {

                return [

                    packet.id,
                    packet.protocol,
                    packet.sourceIP,
                    packet.destinationIP,
                    packet.sourceMAC,
                    packet.destinationMAC,
                    packet.sourceHostname,
                    packet.destinationHostname,
                    packet.dns?.queryName,
                    packet.nbns?.queryName,
                    packet.kerberos?.clientName,
                    packet.kerberos?.realm,
                    packet.http?.host,
                    packet.http?.requestUri,
                    packet.tls?.serverName

                ]
                    .some(
                        fieldValue =>
                            String(
                                fieldValue || ""
                            )
                                .toLowerCase()
                                .includes(value)
                    );

            });

    }


    // =====================================================
    // IP LOOKUP
    // =====================================================

    findByIP(ip) {

        return this.store
            .getPackets()
            .filter(packet =>

                packet.sourceIP === ip ||
                packet.destinationIP === ip

            );

    }


    // =====================================================
    // MAC LOOKUP
    // =====================================================

    findByMAC(mac) {

        const value =
            String(
                mac || ""
            ).toLowerCase();

        return this.store
            .getPackets()
            .filter(packet =>

                String(
                    packet.sourceMAC
                ).toLowerCase() === value

                ||

                String(
                    packet.destinationMAC
                ).toLowerCase() === value

            );

    }


    // =====================================================
    // DOMAIN LOOKUP
    // =====================================================

    findByDomain(domain) {

        const value =
            String(
                domain || ""
            ).toLowerCase();

        return this.store
            .getPackets()
            .filter(packet =>

                String(
                    packet.dns?.queryName ||
                    packet.http?.host ||
                    packet.tls?.serverName ||
                    ""
                )
                    .toLowerCase()
                    .includes(value)

            );

    }


    // =====================================================
    // USER LOOKUP
    // =====================================================

    findByUsername(username) {

        const value =
            String(
                username || ""
            ).toLowerCase();

        return this.store
            .getPackets()
            .filter(packet =>

                String(
                    packet.kerberos?.clientName ||
                    ""
                )
                    .toLowerCase()
                    .includes(value)

            );

    }


    // =====================================================
    // PROTOCOL LOOKUP
    // =====================================================

    findByProtocol(protocol) {

        const value =
            String(
                protocol || ""
            ).toUpperCase();

        return this.store
            .getPackets()
            .filter(
                packet =>
                    String(
                        packet.protocol
                    ).toUpperCase() === value
            );

    }

}


window.networkInvestigator =
    new NetworkInvestigator(
        window.networkStore
    );


console.log(
    "%c[NETWORK INVESTIGATOR] ONLINE",
    "color:#69d99a;font-weight:bold;"
);