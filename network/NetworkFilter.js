/* =========================================================
   NORTHSTAR SOC
   WIRESHARK-STYLE DISPLAY FILTER ENGINE

   Supported examples:

   ip.addr == 10.10.10.21
   ip.src == 10.10.10.21
   ip.dst == 10.10.10.21

   kerberos
   dns
   nbns
   http
   tls
   tcp
   udp
   arp
   icmp

   tcp.port == 443
   udp.port == 53

   eth.addr == 02:10:10:00:00:21
   eth.src == 02:10:10:00:00:21
   eth.dst == 02:10:10:00:00:21

   dns.qry.name == example.com
   http.host == example.com
   http.request.uri == /login
   tls.handshake.extensions_server_name == example.com

   Combined expressions:

   ip.addr == 10.10.10.21 && kerberos
   ip.addr == 10.10.10.21 && nbns
   ip.addr == 10.10.10.21 && (dns || kerberos)

   dns || nbns

   ip.addr == 10.10.10.21 && !arp

   ip.addr == 10.10.10.21 && tcp.port == 443

   =========================================================
   No eval()
   No Function()
   No dynamically generated JavaScript
   ========================================================= */


export class NetworkFilter {


    constructor() {

        /* =================================================
           PROTOCOL ALIASES
           ================================================= */

        this.protocolAliases = {

            kerberos: "KRB5",
            krb5: "KRB5",

            dns: "DNS",
            nbns: "NBNS",

            http: "HTTP",
            tls: "TLS",

            tcp: "TCP",
            udp: "UDP",

            arp: "ARP",
            icmp: "ICMP"

        };


        /* =================================================
           FIELD ALIASES
           ================================================= */

        this.fieldAliases = {

            "ip.addr":
                "ip.addr",

            "ip.src":
                "ip.src",

            "ip.dst":
                "ip.dst",

            "eth.addr":
                "eth.addr",

            "eth.src":
                "eth.src",

            "eth.dst":
                "eth.dst",

            "tcp.port":
                "tcp.port",

            "tcp.srcport":
                "tcp.srcport",

            "tcp.dstport":
                "tcp.dstport",

            "udp.port":
                "udp.port",

            "udp.srcport":
                "udp.srcport",

            "udp.dstport":
                "udp.dstport",

            "dns.qry.name":
                "dns.qry.name",

            "http.host":
                "http.host",

            "http.request.uri":
                "http.request.uri",

            "tls.handshake.extensions_server_name":
                "tls.handshake.extensions_server_name"

        };


        /* =================================================
           LAST FILTER RESULT
           ================================================= */

        this.lastResult = {

            valid:
                true,

            expression:
                "",

            count:
                0,

            error:
                null

        };


        console.log(
            "[NETWORK FILTER] ONLINE"
        );

    }


    /* =====================================================
       PUBLIC FILTER API
       ===================================================== */

    apply(
        packets,
        expression
    ) {

        const source =
            Array.isArray(packets)
                ? packets
                : [];


        const text =
            String(
                expression || ""
            ).trim();


        /* -------------------------------------------------
           Empty filter = show everything
           ------------------------------------------------- */

        if (!text) {

            this.lastResult = {

                valid:
                    true,

                expression:
                    "",

                count:
                    source.length,

                error:
                    null

            };


            return [
                ...source
            ];

        }


        let ast;


        /* -------------------------------------------------
           Parse filter
           ------------------------------------------------- */

        try {

            ast =
                this.parse(
                    text
                );

        }

        catch (error) {

            this.lastResult = {

                valid:
                    false,

                expression:
                    text,

                count:
                    0,

                error:
                    error instanceof Error
                        ? error.message
                        : String(error)

            };


            return [];

        }


        /* -------------------------------------------------
           Evaluate packets
           ------------------------------------------------- */

        const results =
            source.filter(
                packet =>
                    this.evaluate(
                        ast,
                        packet
                    )
            );


        this.lastResult = {

            valid:
                true,

            expression:
                text,

            count:
                results.length,

            error:
                null

        };


        return results;

    }


    /* =====================================================
       PARSER ENTRY
       ===================================================== */

    parse(
        expression
    ) {

        const tokens =
            this.tokenize(
                expression
            );


        if (
            !tokens.length
        ) {

            throw new Error(
                "Empty display filter."
            );

        }


        const state = {

            tokens:
                tokens,

            position:
                0

        };


        const ast =
            this.parseOr(
                state
            );


        /* -------------------------------------------------
           Make sure nothing remains unparsed
           ------------------------------------------------- */

        if (
            state.position <
            state.tokens.length
        ) {

            const token =
                state.tokens[
                state.position
                ];


            throw new Error(
                `Unexpected token "${token.value}".`
            );

        }


        return ast;

    }


    /* =====================================================
       OR
       ===================================================== */

    parseOr(
        state
    ) {

        let node =
            this.parseAnd(
                state
            );


        while (
            this.matchOperator(
                state,
                "||"
            )
        ) {

            node = {

                type:
                    "OR",

                left:
                    node,

                right:
                    this.parseAnd(
                        state
                    )

            };

        }


        return node;

    }


    /* =====================================================
       AND
       ===================================================== */

    parseAnd(
        state
    ) {

        let node =
            this.parseUnary(
                state
            );


        while (
            this.matchOperator(
                state,
                "&&"
            )
        ) {

            node = {

                type:
                    "AND",

                left:
                    node,

                right:
                    this.parseUnary(
                        state
                    )

            };

        }


        return node;

    }


    /* =====================================================
       NOT
       ===================================================== */

    parseUnary(
        state
    ) {

        if (
            this.matchOperator(
                state,
                "!"
            )
        ) {

            return {

                type:
                    "NOT",

                expression:
                    this.parseUnary(
                        state
                    )

            };

        }


        return this.parsePrimary(
            state
        );

    }


    /* =====================================================
       PRIMARY EXPRESSION
       ===================================================== */

    parsePrimary(
        state
    ) {

        /* -------------------------------------------------
           Parentheses
           ------------------------------------------------- */

        if (
            this.matchOperator(
                state,
                "("
            )
        ) {

            const expression =
                this.parseOr(
                    state
                );


            if (
                !this.matchOperator(
                    state,
                    ")"
                )
            ) {

                throw new Error(
                    "Missing closing parenthesis."
                );

            }


            return expression;

        }


        const token =
            this.peek(
                state
            );


        if (!token) {

            throw new Error(
                "Expected a filter expression."
            );

        }


        /* -------------------------------------------------
           Protocol shorthand

           Example:

           kerberos
           dns
           nbns
           tcp
           ------------------------------------------------- */

        const protocol =
            this.protocolAliases[
            token.value.toLowerCase()
            ];


        if (
            protocol &&
            token.type ===
            "IDENTIFIER"
        ) {

            state.position++;


            return {

                type:
                    "PROTOCOL",

                protocol:
                    protocol

            };

        }


        /* -------------------------------------------------
           Field comparison
           ------------------------------------------------- */

        if (
            token.type !==
            "IDENTIFIER"
        ) {

            throw new Error(
                `Unexpected token "${token.value}".`
            );

        }


        state.position++;


        const field =
            token.value.toLowerCase();


        if (
            !this.fieldAliases[field]
        ) {

            throw new Error(
                `Unknown field "${token.value}".`
            );

        }


        const operatorToken =
            this.consume(
                state
            );


        if (
            !operatorToken ||
            (
                operatorToken.value !==
                "==" &&

                operatorToken.value !==
                "!="
            )
        ) {

            throw new Error(
                `Expected == or != after "${token.value}".`
            );

        }


        const valueToken =
            this.consume(
                state
            );


        if (!valueToken) {

            throw new Error(
                `Expected a value after "${operatorToken.value}".`
            );

        }


        if (
            valueToken.type !==
            "VALUE" &&

            valueToken.type !==
            "IDENTIFIER"
        ) {

            throw new Error(
                `Invalid value "${valueToken.value}".`
            );

        }


        return {

            type:
                "COMPARISON",

            field:
                this.fieldAliases[field],

            operator:
                operatorToken.value,

            value:
                valueToken.value

        };

    }


    /* =====================================================
       TOKENIZER
       ===================================================== */

    tokenize(
        expression
    ) {

        const tokens = [];

        let index =
            0;


        while (
            index <
            expression.length
        ) {

            const char =
                expression[index];


            /* ------------------------------------------------
               Whitespace
               ------------------------------------------------ */

            if (
                /\s/.test(
                    char
                )
            ) {

                index++;

                continue;

            }


            /* ------------------------------------------------
               &&
               ------------------------------------------------ */

            if (
                expression.startsWith(
                    "&&",
                    index
                )
            ) {

                tokens.push({

                    type:
                        "OPERATOR",

                    value:
                        "&&"

                });


                index += 2;

                continue;

            }


            /* ------------------------------------------------
               ||
               ------------------------------------------------ */

            if (
                expression.startsWith(
                    "||",
                    index
                )
            ) {

                tokens.push({

                    type:
                        "OPERATOR",

                    value:
                        "||"

                });


                index += 2;

                continue;

            }


            /* ------------------------------------------------
               ==
               ------------------------------------------------ */

            if (
                expression.startsWith(
                    "==",
                    index
                )
            ) {

                tokens.push({

                    type:
                        "OPERATOR",

                    value:
                        "=="

                });


                index += 2;

                continue;

            }


            /* ------------------------------------------------
               !=
               ------------------------------------------------ */

            if (
                expression.startsWith(
                    "!=",
                    index
                )
            ) {

                tokens.push({

                    type:
                        "OPERATOR",

                    value:
                        "!="

                });


                index += 2;

                continue;

            }


            /* ------------------------------------------------
               Single-character operators
               ------------------------------------------------ */

            if (
                char === "!" ||
                char === "(" ||
                char === ")"
            ) {

                tokens.push({

                    type:
                        "OPERATOR",

                    value:
                        char

                });


                index++;

                continue;

            }


            /* ------------------------------------------------
               Quoted string
               ------------------------------------------------ */

            if (
                char === '"' ||
                char === "'"
            ) {

                const quote =
                    char;

                index++;


                let value =
                    "";


                while (
                    index <
                    expression.length
                ) {

                    if (
                        expression[index] ===
                        quote
                    ) {

                        break;

                    }


                    value +=
                        expression[index];

                    index++;

                }


                if (
                    index >=
                    expression.length
                ) {

                    throw new Error(
                        "Unterminated quoted value."
                    );

                }


                index++;


                tokens.push({

                    type:
                        "VALUE",

                    value:
                        value

                });


                continue;

            }


            /* ------------------------------------------------
               Identifier / unquoted value
               ------------------------------------------------ */

            let value =
                "";


            while (
                index <
                expression.length
            ) {

                const current =
                    expression[index];


                if (
                    /\s/.test(
                        current
                    )
                ) {

                    break;

                }


                if (
                    current === "(" ||
                    current === ")" ||
                    current === "!"
                ) {

                    break;

                }


                if (
                    expression.startsWith(
                        "&&",
                        index
                    ) ||

                    expression.startsWith(
                        "||",
                        index
                    ) ||

                    expression.startsWith(
                        "==",
                        index
                    ) ||

                    expression.startsWith(
                        "!=",
                        index
                    )
                ) {

                    break;

                }


                value +=
                    current;

                index++;

            }


            if (!value) {

                throw new Error(
                    `Unable to parse "${char}".`
                );

            }


            tokens.push({

                type:
                    this.isSimpleValue(
                        value
                    )
                        ? "VALUE"
                        : "IDENTIFIER",

                value:
                    value

            });

        }


        return tokens;

    }


    /* =====================================================
       TOKEN HELPERS
       ===================================================== */

    peek(
        state
    ) {

        return (
            state.tokens[
            state.position
            ] ||
            null
        );

    }


    consume(
        state
    ) {

        if (
            state.position >=
            state.tokens.length
        ) {

            return null;

        }


        return (
            state.tokens[
            state.position++
            ]
        );

    }


    matchOperator(
        state,
        value
    ) {

        const token =
            this.peek(
                state
            );


        if (
            token &&
            token.type ===
            "OPERATOR" &&
            token.value ===
            value
        ) {

            state.position++;

            return true;

        }


        return false;

    }


    /* =====================================================
       SIMPLE VALUE DETECTION
       ===================================================== */

    isSimpleValue(
        value
    ) {

        const text =
            String(
                value
            ).trim();


        /* -------------------------------------------------
           IPv4 address
           ------------------------------------------------- */

        const ipv4 =
            /^\d{1,3}(?:\.\d{1,3}){3}$/;


        /* -------------------------------------------------
           Numeric port
           ------------------------------------------------- */

        const number =
            /^\d+$/;


        /* -------------------------------------------------
           MAC address
           ------------------------------------------------- */

        const mac =
            /^[0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5}$/;


        return (
            ipv4.test(
                text
            ) ||

            number.test(
                text
            ) ||

            mac.test(
                text
            )
        );

    }


    /* =====================================================
       AST EVALUATOR
       ===================================================== */

        evaluate(
        node,
        packet
    ) {

        if (!node) {

            return false;

        }


        switch (
        node.type
        ) {

            case "AND":

                return (
                    this.evaluate(
                        node.left,
                        packet
                    ) &&

                    this.evaluate(
                        node.right,
                        packet
                    )
                );


            case "OR":

                return (
                    this.evaluate(
                        node.left,
                        packet
                    ) ||

                    this.evaluate(
                        node.right,
                        packet
                    )
                );


            case "NOT":

                return !this.evaluate(
                    node.expression,
                    packet
                );

            case "PROTOCOL": {

                const protocol =
                    String(
                        packet.protocol || ""
                    ).toUpperCase();

                const transport =
                    String(
                        packet.transport || ""
                    ).toUpperCase();

                return (
                    protocol === node.protocol ||
                    transport === node.protocol
                );
            }


            case "COMPARISON":

                return this.evaluateComparison(
                    node,
                    packet
                );


            default:

                return false;

        }

    }


    /* =====================================================
       COMPARISON
       ===================================================== */

    evaluateComparison(
        node,
        packet
    ) {

        const values =
            this.getFieldValues(
                node.field,
                packet
            );


        const expected =
            String(
                node.value
            ).toLowerCase();


        const matched =
            values.some(
                value =>
                    String(
                        value
                    ).toLowerCase() ===
                    expected
            );


        if (
            node.operator ===
            "=="
        ) {

            return matched;

        }


        if (
            node.operator ===
            "!="
        ) {

            return !matched;

        }


        return false;

    }


    /* =====================================================
       PACKET FIELD EXTRACTION
       ===================================================== */

    getFieldValues(
        field,
        packet
    ) {

        switch (
        field
        ) {


            /* =============================================
               IP
               ============================================= */
            case "ip.addr":

                return [

                    packet.sourceIP ||
                    packet.srcIP,

                    packet.destinationIP ||
                    packet.destIP

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            case "ip.src":

                return [

                    packet.sourceIP ||
                    packet.srcIP

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            case "ip.dst":

                return [

                    packet.destinationIP ||
                    packet.destIP

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            /* =============================================
               Ethernet
               ============================================= */

            case "eth.addr":

                return [

                    packet.sourceMAC,

                    packet.destinationMAC

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            case "eth.src":

                return [

                    packet.sourceMAC

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            case "eth.dst":

                return [

                    packet.destinationMAC

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            /* =============================================
               TCP
               ============================================= */

            case "tcp.port":

                if (
                    String(
                        packet.transport ||
                        ""
                    ).toUpperCase() !==
                    "TCP"
                ) {

                    return [];

                }


                return [

                    packet.sourcePort,

                    packet.destinationPort

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            case "tcp.srcport":

                if (
                    String(
                        packet.transport ||
                        ""
                    ).toUpperCase() !==
                    "TCP"
                ) {

                    return [];

                }


                return [

                    packet.sourcePort

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            case "tcp.dstport":

                if (
                    String(
                        packet.transport ||
                        ""
                    ).toUpperCase() !==
                    "TCP"
                ) {

                    return [];

                }


                return [

                    packet.destinationPort

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            /* =============================================
               UDP
               ============================================= */

            case "udp.port":

                if (
                    String(
                        packet.transport ||
                        ""
                    ).toUpperCase() !==
                    "UDP"
                ) {

                    return [];

                }


                return [

                    packet.sourcePort,

                    packet.destinationPort

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            case "udp.srcport":

                if (
                    String(
                        packet.transport ||
                        ""
                    ).toUpperCase() !==
                    "UDP"
                ) {

                    return [];

                }


                return [

                    packet.sourcePort

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            case "udp.dstport":

                if (
                    String(
                        packet.transport ||
                        ""
                    ).toUpperCase() !==
                    "UDP"
                ) {

                    return [];

                }


                return [

                    packet.destinationPort

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            /* =============================================
               DNS
               ============================================= */

            case "dns.qry.name":

                return [

                    packet.dns?.queryName

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            /* =============================================
               HTTP
               ============================================= */

            case "http.host":

                return [

                    packet.http?.host

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            case "http.request.uri":

                return [

                    packet.http?.requestUri

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            /* =============================================
               TLS
               ============================================= */

            case "tls.handshake.extensions_server_name":

                return [

                    packet.tls?.serverName

                ].filter(
                    value =>
                        value !==
                        undefined &&
                        value !==
                        null
                );


            default:

                return [];

        }

    }


    /* =====================================================
       VALIDATE
       ===================================================== */

    validate(
        expression
    ) {

        const text =
            String(
                expression || ""
            ).trim();


        if (!text) {

            return {

                valid:
                    true,

                error:
                    null

            };

        }


        try {

            this.parse(
                text
            );


            return {

                valid:
                    true,

                error:
                    null

            };

        }

        catch (error) {

            return {

                valid:
                    false,

                error:
                    error instanceof Error
                        ? error.message
                        : String(error)

            };

        }

    }


    /* =====================================================
       LAST RESULT
       ===================================================== */

    getLastResult() {

        return {

            ...this.lastResult

        };

    }

}


/* =========================================================
   GLOBAL INSTANCE
   ========================================================= */

window.networkFilter =
    new NetworkFilter();

console.log(
    "[NETWORK FILTER] Global instance exposed."
);