// =========================================================
// NORTHSTAR SOC
// CORPORATE NETWORK CONFIGURATION
// =========================================================

export const NETWORK = {

    name: "Northstar Corporate Network",

    router: {
        hostname: "EDGE-ROUTER-01",
        ip: "10.10.0.1",
        mac: "02:00:00:00:00:01",
        status: "online"
    },

    firewall: {
        hostname: "FW-01",
        ip: "10.10.0.254",
        mac: "02:00:00:00:00:FE",
        enabled: true,
        blockedIPs: [],
        blockedDomains: []
    },

    dns: {
        hostname: "DNS-01",
        ip: "10.10.20.53",
        mac: "02:20:20:00:00:53",
        enabled: true
    },

    subnets: [

        {
            name: "Corporate",
            cidr: "10.10.10.0/24",
            purpose: "Employee Workstations"
        },

        {
            name: "Server",
            cidr: "10.10.20.0/24",
            purpose: "Critical Infrastructure"
        },

        {
            name: "DMZ",
            cidr: "10.10.30.0/24",
            purpose: "Public Services"
        }

    ]

};