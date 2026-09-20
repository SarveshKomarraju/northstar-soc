// =========================================================
// NORTHSTAR SOC
// CORPORATE HOST INVENTORY
// =========================================================

export const HOSTS = [
    {
        id: "host-001",
        hostname: "WORKSTATION-01",
        ip: "10.10.10.21",
        mac: "02:10:10:00:00:21",
        type: "workstation",
        operatingSystem: "Windows 11",
        assignedUser: "jsmith",
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-002",
        hostname: "WORKSTATION-02",
        ip: "10.10.10.22",
        mac: "02:10:10:00:00:22",
        type: "workstation",
        operatingSystem: "Windows 11",
        assignedUser: "alee",
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-003",
        hostname: "IT-ADMIN-01",
        ip: "10.10.10.30",
        mac: "02:10:10:00:00:30",
        type: "workstation",
        operatingSystem: "Windows 11",
        assignedUser: "mgarcia",
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-004",
        hostname: "FILE-SERVER-01",
        ip: "10.10.20.10",
        mac: "02:20:20:00:00:10",
        type: "server",
        operatingSystem: "Windows Server 2022",
        assignedUser: null,
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-005",
        hostname: "DC-01",
        ip: "10.10.20.5",
        mac: "02:20:20:00:00:05",
        type: "domain-controller",
        operatingSystem: "Windows Server 2022",
        assignedUser: null,
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-006",
        hostname: "WORKSTATION-03",
        ip: "10.10.10.23",
        mac: "02:10:10:00:00:23",
        type: "workstation",
        operatingSystem: "Windows 11",
        assignedUser: "ppatel",
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-007",
        hostname: "WORKSTATION-04",
        ip: "10.10.10.24",
        mac: "02:10:10:00:00:24",
        type: "workstation",
        operatingSystem: "Windows 11",
        assignedUser: "rkim",
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-008",
        hostname: "WORKSTATION-05",
        ip: "10.10.10.25",
        mac: "02:10:10:00:00:25",
        type: "workstation",
        operatingSystem: "Windows 11",
        assignedUser: "dcohen",
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-009",
        hostname: "WORKSTATION-06",
        ip: "10.10.10.26",
        mac: "02:10:10:00:00:26",
        type: "workstation",
        operatingSystem: "Windows 11",
        assignedUser: "jturner",
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-010",
        hostname: "WORKSTATION-07",
        ip: "10.10.10.27",
        mac: "02:10:10:00:00:27",
        type: "workstation",
        operatingSystem: "Windows 11",
        assignedUser: "swright",
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-011",
        hostname: "WORKSTATION-08",
        ip: "10.10.10.28",
        mac: "02:10:10:00:00:28",
        type: "workstation",
        operatingSystem: "Windows 11",
        assignedUser: "mnguyen",
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-012",
        hostname: "WORKSTATION-09",
        ip: "10.10.10.29",
        mac: "02:10:10:00:00:29",
        type: "workstation",
        operatingSystem: "Windows 11",
        assignedUser: "bthompson",
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-013",
        hostname: "WORKSTATION-10",
        ip: "10.10.10.31",
        mac: "02:10:10:00:00:31",
        type: "workstation",
        operatingSystem: "Windows 11",
        assignedUser: "lrodriguez",
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-014",
        hostname: "LAPTOP-01",
        ip: "10.10.10.32",
        mac: "02:10:10:00:00:32",
        type: "laptop",
        operatingSystem: "Windows 11",
        assignedUser: "csingh",
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-015",
        hostname: "LAPTOP-02",
        ip: "10.10.10.33",
        mac: "02:10:10:00:00:33",
        type: "laptop",
        operatingSystem: "macOS Sonoma",
        assignedUser: "afischer",
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-016",
        hostname: "WEB-SERVER-01",
        ip: "10.10.20.15",
        mac: "02:20:20:00:00:15",
        type: "server",
        operatingSystem: "Ubuntu Server 22.04 LTS",
        assignedUser: null,
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-017",
        hostname: "DB-SERVER-01",
        ip: "10.10.20.20",
        mac: "02:20:20:00:00:20",
        type: "server",
        operatingSystem: "Ubuntu Server 22.04 LTS",
        assignedUser: null,
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    },

    {
        id: "host-018",
        hostname: "BACKUP-SERVER-01",
        ip: "10.10.20.25",
        mac: "02:20:20:00:00:25",
        type: "server",
        operatingSystem: "Windows Server 2022",
        assignedUser: null,
        status: "online",
        compromised: false,
        isolated: false,
        processTerminated: false
    }
];