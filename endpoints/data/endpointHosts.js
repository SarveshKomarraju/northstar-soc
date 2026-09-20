/* =========================================================
   NORTHSTAR SOC — ENDPOINT DATA
   File: endpoints/data/endpointHosts.js

   WHY MORE ATTACK MAP IPs SHOW UP HERE NOW:
   The Attack Map's own header calls itself "GLOBAL
   AUTHENTICATION TELEMETRY" — those 18 dots are login
   sources, not general traffic. A real company's remote/VPN
   logins genuinely do come from a dozen-plus countries
   (employees traveling, remote hires, contractors) and almost
   all of that is completely legitimate. Only 1-2 out of the
   18 are ever actually malicious in a given session.

   generateAmbientLogins() below assigns each host a handful
   of ordinary, non-suspicious logins from real Attack Map
   IPs — so an analyst clicking around the map will now find
   most of those 18 dots DO correspond to something real in
   Endpoints, and has to actually figure out which 1-2 matter,
   rather than every external IP being an automatic red flag.

   WS-DELTA and SRV-FILE01 keep their hand-authored incident
   narrative (the malicious entries) on top of this ambient
   padding — nothing about the actual incident changed, there's
   just realistic "normal life" activity around it now too.

   RANDOMIZATION: which specific IP is malicious, and which
   IPs get used for ambient/legitimate traffic, are both
   re-rolled every time this module loads.
   ========================================================= */

import { THREAT_SOURCES } from "../../data/threatSources.js";

function pickRandomDistinctSources(count) {

    const shuffled =
        [...THREAT_SOURCES].sort(() => Math.random() - 0.5);

    return shuffled.slice(0, count);
}

const [primaryExternalSource, secondaryExternalSource] =
    pickRandomDistinctSources(2);

const EXTERNAL_C2_IP =
    primaryExternalSource.ip;

const EXTERNAL_SUSPICIOUS_LOGIN_IP =
    secondaryExternalSource.ip;


/*
 * Northstar's public-facing edge/gateway IP — the reference
 * point for "this is us" vs "this is external." Uses the
 * 203.0.113.0/24 block, reserved by RFC 5737 for
 * documentation/example use (same convention already used
 * for simulated external senders in the Mail app).
 */
export const NORTHSTAR_PUBLIC_IP = "203.0.113.10";

export function isInternalIp(ip) {
    return String(ip || "").startsWith("10.20.");
}


export const ENDPOINT_STATUS = {
    ONLINE: "ONLINE",
    OFFLINE: "OFFLINE",
    COMPROMISED: "COMPROMISED",
    ISOLATED: "ISOLATED"
};

export const RISK_LEVEL = {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL"
};


/* =========================================================
   GENERATORS
   ---------------------------------------------------------
   Builds ambient (non-suspicious) history from real
   timestamps and real Attack Map IPs, so timelines are
   substantial instead of 2-3 entries each.
   ========================================================= */

function minutesAgoISO(minutes) {
    return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function hoursAgoISO(hours) {
    return minutesAgoISO(hours * 60);
}

function randomInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

function shuffledThreatSources() {
    return [...THREAT_SOURCES].sort(() => Math.random() - 0.5);
}

function generateAmbientLogins(user, {
    count = 3,
    minHoursAgo = 2,
    maxHoursAgo = 120,
    excludeIps = []
} = {}) {

    const pool =
        shuffledThreatSources().filter(
            source => !excludeIps.includes(source.ip)
        );

    const events = [];

    for (let i = 0; i < count && i < pool.length; i++) {

        events.push({
            user,
            timestamp: hoursAgoISO(minHoursAgo + Math.random() * (maxHoursAgo - minHoursAgo)),
            sourceIP: pool[i].ip,
            suspicious: false
        });
    }

    return events;
}

function generateAmbientConnections({
    count = 4,
    minHoursAgo = 0.2,
    maxHoursAgo = 96,
    internalTargets = ["10.20.2.5"],
    externalPortPool = [443, 443, 443, 8443, 80],
    externalChance = 0.4
} = {}) {

    const pool =
        shuffledThreatSources();

    const events = [];

    for (let i = 0; i < count; i++) {

        const useExternal =
            Math.random() < externalChance && pool.length;

        const destinationIP =
            useExternal
                ? pool[i % pool.length].ip
                : internalTargets[randomInt(0, internalTargets.length - 1)];

        events.push({
            destinationIP,
            port: useExternal
                ? externalPortPool[randomInt(0, externalPortPool.length - 1)]
                : 445,
            protocol: "TCP",
            status: "ESTABLISHED",
            suspicious: false,
            timestamp: hoursAgoISO(minHoursAgo + Math.random() * (maxHoursAgo - minHoursAgo))
        });
    }

    return events;
}

function byTimestampDesc(a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
}


/* =========================================================
   HOST ROSTER
   ========================================================= */

export const HOSTS = [

    {
        id: "HOST-ALPHA",
        hostname: "WS-ALPHA",
        ip: "10.20.4.10",
        mac: "00:1B:44:11:3A:B7",
        os: "Windows 11 Pro",
        currentUser: "j.smith",
        status: ENDPOINT_STATUS.ONLINE,
        risk: RISK_LEVEL.LOW,
        uptimeSeconds: 6 * 3600 + 12 * 60,
        lastActivity: minutesAgoISO(2),
        isolated: false,

        loginHistory: [
            { user: "j.smith", timestamp: minutesAgoISO(370), sourceIP: "10.20.4.10", suspicious: false },
            { user: "j.smith", timestamp: minutesAgoISO(1500), sourceIP: "10.20.4.10", suspicious: false },
            ...generateAmbientLogins("j.smith", { count: 2, maxHoursAgo: 72 })
        ].sort(byTimestampDesc),

        processes: [
            { pid: 1044, name: "explorer.exe", user: "j.smith", status: "RUNNING", suspicious: false, cpu: 0.4, mem: 82 },
            { pid: 2210, name: "chrome.exe", user: "j.smith", status: "RUNNING", suspicious: false, cpu: 3.1, mem: 640 },
            { pid: 3388, name: "outlook.exe", user: "j.smith", status: "RUNNING", suspicious: false, cpu: 0.2, mem: 210 }
        ],

        connections: [
            { destinationIP: "10.20.2.5", port: 443, protocol: "TCP", status: "ESTABLISHED", suspicious: false, timestamp: minutesAgoISO(60) },
            { destinationIP: "10.20.4.15", port: 445, protocol: "TCP", status: "ESTABLISHED", suspicious: false, timestamp: minutesAgoISO(200) },
            ...generateAmbientConnections({ count: 4, internalTargets: ["10.20.2.5", "10.20.4.15"] })
        ].sort(byTimestampDesc),

        alerts: [],

        evidenceFiles: []
    },

    {
        id: "HOST-BRAVO",
        hostname: "WS-BRAVO",
        ip: "10.20.6.15",
        mac: "00:1B:44:22:7C:19",
        os: "macOS Sonoma 14.5",
        currentUser: "j.lee",
        status: ENDPOINT_STATUS.ONLINE,
        risk: RISK_LEVEL.LOW,
        uptimeSeconds: 2 * 24 * 3600 + 4 * 3600,
        lastActivity: minutesAgoISO(8),
        isolated: false,

        loginHistory: [
            { user: "j.lee", timestamp: minutesAgoISO(300), sourceIP: "10.20.6.15", suspicious: false },
            ...generateAmbientLogins("j.lee", { count: 3, maxHoursAgo: 96 })
        ].sort(byTimestampDesc),

        processes: [
            { pid: 512, name: "Figma", user: "j.lee", status: "RUNNING", suspicious: false, cpu: 4.2, mem: 780 },
            { pid: 640, name: "Slack", user: "j.lee", status: "RUNNING", suspicious: false, cpu: 1.1, mem: 340 }
        ],

        connections: [
            { destinationIP: "10.20.2.5", port: 443, protocol: "TCP", status: "ESTABLISHED", suspicious: false, timestamp: minutesAgoISO(90) },
            ...generateAmbientConnections({ count: 3 })
        ].sort(byTimestampDesc),

        alerts: [],

        evidenceFiles: []
    },

    {
        id: "HOST-CHARLIE",
        hostname: "WS-CHARLIE",
        ip: "10.20.3.31",
        mac: "00:1B:44:33:9E:4D",
        os: "Windows 11 Pro",
        currentUser: "p.nair",
        status: ENDPOINT_STATUS.ONLINE,
        risk: RISK_LEVEL.LOW,
        uptimeSeconds: 5 * 3600,
        lastActivity: minutesAgoISO(15),
        isolated: false,

        loginHistory: [
            { user: "p.nair", timestamp: minutesAgoISO(320), sourceIP: "10.20.3.31", suspicious: false },
            ...generateAmbientLogins("p.nair", { count: 2, maxHoursAgo: 80 })
        ].sort(byTimestampDesc),

        processes: [
            { pid: 900, name: "explorer.exe", user: "p.nair", status: "RUNNING", suspicious: false, cpu: 0.3, mem: 75 },
            { pid: 1220, name: "teams.exe", user: "p.nair", status: "RUNNING", suspicious: false, cpu: 2.4, mem: 410 }
        ],

        connections: [
            { destinationIP: "10.20.2.5", port: 443, protocol: "TCP", status: "ESTABLISHED", suspicious: false, timestamp: minutesAgoISO(100) },
            ...generateAmbientConnections({ count: 3 })
        ].sort(byTimestampDesc),

        alerts: [],

        evidenceFiles: []
    },

    {
        id: "HOST-DELTA",
        hostname: "WS-DELTA",
        ip: "10.20.7.52",
        mac: "00:1B:44:55:2F:88",
        os: "Windows 10 Pro",
        currentUser: "t.reyes",
        status: ENDPOINT_STATUS.COMPROMISED,
        risk: RISK_LEVEL.CRITICAL,
        uptimeSeconds: 9 * 3600 + 40 * 60,
        lastActivity: minutesAgoISO(4),
        isolated: false,

        loginHistory: [
            { user: "t.reyes", timestamp: minutesAgoISO(560), sourceIP: "10.20.7.52", suspicious: false },
            { user: "t.reyes", timestamp: minutesAgoISO(40), sourceIP: EXTERNAL_C2_IP, suspicious: true },
            ...generateAmbientLogins("t.reyes", { count: 3, maxHoursAgo: 90, excludeIps: [EXTERNAL_C2_IP] })
        ].sort(byTimestampDesc),

        processes: [
            { pid: 1180, name: "explorer.exe", user: "t.reyes", status: "RUNNING", suspicious: false, cpu: 0.5, mem: 90 },
            { pid: 2044, name: "chrome.exe", user: "t.reyes", status: "RUNNING", suspicious: false, cpu: 2.8, mem: 520 },
            { pid: 4471, name: "powershell.exe", user: "t.reyes", status: "RUNNING", suspicious: true, cpu: 12.6, mem: 145 },
            { pid: 4502, name: "svch0st.exe", user: "SYSTEM", status: "RUNNING", suspicious: true, cpu: 8.3, mem: 60 }
        ],

        connections: [
            { destinationIP: "10.20.2.5", port: 443, protocol: "TCP", status: "ESTABLISHED", suspicious: false, timestamp: minutesAgoISO(300) },
            { destinationIP: EXTERNAL_C2_IP, port: 4444, protocol: "TCP", status: "ESTABLISHED", suspicious: true, timestamp: minutesAgoISO(36) },
            ...generateAmbientConnections({ count: 3, maxHoursAgo: 90 })
        ].sort(byTimestampDesc),

        alerts: [
            {
                id: "ALERT-DELTA-01",
                title: "Suspicious PowerShell Execution",
                severity: "CRITICAL",
                timestamp: minutesAgoISO(38),
                description: "powershell.exe (PID 4471) launched with an obfuscated/encoded command shortly after user t.reyes opened a phishing attachment."
            },
            {
                id: "ALERT-DELTA-02",
                title: "Outbound Connection to Known-Malicious IP",
                severity: "HIGH",
                timestamp: minutesAgoISO(35),
                description: `Established outbound connection to ${EXTERNAL_C2_IP}:4444 — this IP also appears on the Attack Map, worth cross-referencing.`
            },
            {
                id: "ALERT-DELTA-03",
                title: "Masquerading Process Detected",
                severity: "HIGH",
                timestamp: minutesAgoISO(30),
                description: "Process 'svch0st.exe' (PID 4502) is not running from the expected System32 path and does not match the legitimate svchost.exe."
            }
        ],

        evidenceFiles: [
            {
                name: "invoice_update.ps1",
                path: "C:\\Users\\t.reyes\\AppData\\Local\\Temp\\invoice_update.ps1",
                hash: "SIMULATED_SHA256_9F3A21C0",
                size: 4200,
                suspicious: true
            },
            {
                name: "svch0st.exe",
                path: "C:\\Users\\t.reyes\\AppData\\Roaming\\svch0st.exe",
                hash: "SIMULATED_SHA256_B812DE47",
                size: 812000,
                suspicious: true
            }
        ]
    },

    {
        id: "HOST-SRV01",
        hostname: "SRV-FILE01",
        ip: "10.20.1.20",
        mac: "00:1B:44:77:AB:02",
        os: "Windows Server 2022",
        currentUser: null,
        status: ENDPOINT_STATUS.ONLINE,
        risk: RISK_LEVEL.MEDIUM,
        uptimeSeconds: 44 * 24 * 3600,
        lastActivity: minutesAgoISO(6),
        isolated: false,

        loginHistory: [
            { user: "svc-backup", timestamp: minutesAgoISO(700), sourceIP: "10.20.1.20", suspicious: false },
            { user: "svc-backup", timestamp: minutesAgoISO(1420), sourceIP: "10.20.1.20", suspicious: false },
            { user: "administrator", timestamp: minutesAgoISO(90), sourceIP: EXTERNAL_SUSPICIOUS_LOGIN_IP, suspicious: true }
        ].sort(byTimestampDesc),

        processes: [
            { pid: 220, name: "System", user: "SYSTEM", status: "RUNNING", suspicious: false, cpu: 0.1, mem: 40 },
            { pid: 880, name: "smb.exe", user: "SYSTEM", status: "RUNNING", suspicious: false, cpu: 0.6, mem: 120 }
        ],

        connections: [
            { destinationIP: "10.20.4.10", port: 445, protocol: "TCP", status: "ESTABLISHED", suspicious: false, timestamp: minutesAgoISO(500) },
            { destinationIP: EXTERNAL_SUSPICIOUS_LOGIN_IP, port: 3389, protocol: "TCP", status: "ESTABLISHED", suspicious: true, timestamp: minutesAgoISO(88) },
            ...generateAmbientConnections({
                count: 6,
                maxHoursAgo: 120,
                internalTargets: ["10.20.4.10", "10.20.6.15", "10.20.3.31", "10.20.5.44"],
                externalChance: 0.15
            })
        ].sort(byTimestampDesc),

        alerts: [
            {
                id: "ALERT-SRV01-01",
                title: "Unusual Administrative Login — Off-Hours, Foreign IP",
                severity: "MEDIUM",
                timestamp: minutesAgoISO(90),
                description: `A login as 'administrator' originated from ${EXTERNAL_SUSPICIOUS_LOGIN_IP}, which does not match any known Northstar office or VPN range.`
            }
        ],

        evidenceFiles: []
    },

    {
        id: "HOST-ECHO",
        hostname: "LT-ECHO",
        ip: "10.20.2.5",
        mac: "00:1B:44:88:60:E1",
        os: "macOS Sonoma 14.5",
        currentUser: "m.webb",
        status: ENDPOINT_STATUS.OFFLINE,
        risk: RISK_LEVEL.LOW,
        uptimeSeconds: 0,
        lastActivity: minutesAgoISO(640),
        isolated: false,

        loginHistory: [
            { user: "m.webb", timestamp: minutesAgoISO(650), sourceIP: "10.20.2.5", suspicious: false },
            ...generateAmbientLogins("m.webb", { count: 4, minHoursAgo: 20, maxHoursAgo: 200 })
        ].sort(byTimestampDesc),

        processes: [],

        connections: [],

        alerts: [],

        evidenceFiles: []
    },

    {
        id: "HOST-FOXTROT",
        hostname: "WS-FOXTROT",
        ip: "10.20.5.44",
        mac: "00:1B:44:99:1D:76",
        os: "Windows 11 Pro",
        currentUser: "s.brooks",
        status: ENDPOINT_STATUS.ONLINE,
        risk: RISK_LEVEL.LOW,
        uptimeSeconds: 3 * 3600 + 20 * 60,
        lastActivity: minutesAgoISO(20),
        isolated: false,

        loginHistory: [
            { user: "s.brooks", timestamp: minutesAgoISO(210), sourceIP: "10.20.5.44", suspicious: false },
            ...generateAmbientLogins("s.brooks", { count: 2, maxHoursAgo: 70 })
        ].sort(byTimestampDesc),

        processes: [
            { pid: 770, name: "explorer.exe", user: "s.brooks", status: "RUNNING", suspicious: false, cpu: 0.2, mem: 70 },
            { pid: 1105, name: "excel.exe", user: "s.brooks", status: "RUNNING", suspicious: false, cpu: 1.4, mem: 260 }
        ],

        connections: [
            { destinationIP: "10.20.2.5", port: 443, protocol: "TCP", status: "ESTABLISHED", suspicious: false, timestamp: minutesAgoISO(150) },
            ...generateAmbientConnections({ count: 3 })
        ].sort(byTimestampDesc),

        alerts: [],

        evidenceFiles: []
    },

    {
        id: "HOST-GOLF",
        hostname: "WS-GOLF",
        ip: "10.20.5.61",
        mac: "00:1B:44:AA:2C:14",
        os: "Windows 11 Pro",
        currentUser: "r.patel",
        status: ENDPOINT_STATUS.ONLINE,
        risk: RISK_LEVEL.LOW,
        uptimeSeconds: 4 * 3600 + 10 * 60,
        lastActivity: minutesAgoISO(11),
        isolated: false,

        loginHistory: [
            { user: "r.patel", timestamp: minutesAgoISO(250), sourceIP: "10.20.5.61", suspicious: false },
            ...generateAmbientLogins("r.patel", { count: 3, maxHoursAgo: 100 })
        ].sort(byTimestampDesc),

        processes: [
            { pid: 660, name: "explorer.exe", user: "r.patel", status: "RUNNING", suspicious: false, cpu: 0.3, mem: 78 },
            { pid: 1340, name: "outlook.exe", user: "r.patel", status: "RUNNING", suspicious: false, cpu: 0.5, mem: 190 }
        ],

        connections: [
            { destinationIP: "10.20.2.5", port: 443, protocol: "TCP", status: "ESTABLISHED", suspicious: false, timestamp: minutesAgoISO(80) },
            ...generateAmbientConnections({ count: 3 })
        ].sort(byTimestampDesc),

        alerts: [],

        evidenceFiles: []
    },

    {
        id: "HOST-HOTEL",
        hostname: "WS-HOTEL",
        ip: "10.20.6.28",
        mac: "00:1B:44:BB:5E:71",
        os: "macOS Sonoma 14.5",
        currentUser: "k.oconnor",
        status: ENDPOINT_STATUS.ONLINE,
        risk: RISK_LEVEL.LOW,
        uptimeSeconds: 1 * 24 * 3600 + 2 * 3600,
        lastActivity: minutesAgoISO(25),
        isolated: false,

        loginHistory: [
            { user: "k.oconnor", timestamp: minutesAgoISO(400), sourceIP: "10.20.6.28", suspicious: false },
            ...generateAmbientLogins("k.oconnor", { count: 2, maxHoursAgo: 90 })
        ].sort(byTimestampDesc),

        processes: [
            { pid: 480, name: "Slack", user: "k.oconnor", status: "RUNNING", suspicious: false, cpu: 0.8, mem: 320 },
            { pid: 512, name: "Safari", user: "k.oconnor", status: "RUNNING", suspicious: false, cpu: 1.9, mem: 410 }
        ],

        connections: [
            { destinationIP: "10.20.2.5", port: 443, protocol: "TCP", status: "ESTABLISHED", suspicious: false, timestamp: minutesAgoISO(120) },
            ...generateAmbientConnections({ count: 3 })
        ].sort(byTimestampDesc),

        alerts: [],

        evidenceFiles: []
    },

    {
        id: "HOST-INDIA",
        hostname: "LT-INDIA",
        ip: "10.20.5.90",
        mac: "00:1B:44:CC:19:03",
        os: "Windows 11 Pro",
        currentUser: "d.singh",
        status: ENDPOINT_STATUS.ONLINE,
        risk: RISK_LEVEL.LOW,
        uptimeSeconds: 6 * 3600,
        lastActivity: minutesAgoISO(18),
        isolated: false,

        loginHistory: [
            { user: "d.singh", timestamp: minutesAgoISO(180), sourceIP: "10.20.5.90", suspicious: false },
            ...generateAmbientLogins("d.singh", { count: 7, minHoursAgo: 4, maxHoursAgo: 240 })
        ].sort(byTimestampDesc),

        processes: [
            { pid: 900, name: "explorer.exe", user: "d.singh", status: "RUNNING", suspicious: false, cpu: 0.3, mem: 80 },
            { pid: 1550, name: "teams.exe", user: "d.singh", status: "RUNNING", suspicious: false, cpu: 2.0, mem: 380 },
            { pid: 1902, name: "salesforce-connector.exe", user: "d.singh", status: "RUNNING", suspicious: false, cpu: 0.6, mem: 145 }
        ],

        connections: [
            { destinationIP: "10.20.2.5", port: 443, protocol: "TCP", status: "ESTABLISHED", suspicious: false, timestamp: minutesAgoISO(70) },
            ...generateAmbientConnections({ count: 5, maxHoursAgo: 150, externalChance: 0.5 })
        ].sort(byTimestampDesc),

        alerts: [],

        evidenceFiles: []
    },

    {
        id: "HOST-JULIET",
        hostname: "WS-JULIET",
        ip: "10.20.3.47",
        mac: "00:1B:44:DD:8F:36",
        os: "Windows 10 Pro",
        currentUser: "m.fischer",
        status: ENDPOINT_STATUS.ONLINE,
        risk: RISK_LEVEL.LOW,
        uptimeSeconds: 2 * 3600 + 45 * 60,
        lastActivity: minutesAgoISO(33),
        isolated: false,

        loginHistory: [
            { user: "m.fischer", timestamp: minutesAgoISO(160), sourceIP: "10.20.3.47", suspicious: false },
            ...generateAmbientLogins("m.fischer", { count: 2, maxHoursAgo: 60 })
        ].sort(byTimestampDesc),

        processes: [
            { pid: 720, name: "explorer.exe", user: "m.fischer", status: "RUNNING", suspicious: false, cpu: 0.2, mem: 65 },
            { pid: 1310, name: "excel.exe", user: "m.fischer", status: "RUNNING", suspicious: false, cpu: 1.1, mem: 240 }
        ],

        connections: [
            { destinationIP: "10.20.2.5", port: 443, protocol: "TCP", status: "ESTABLISHED", suspicious: false, timestamp: minutesAgoISO(95) },
            ...generateAmbientConnections({ count: 3 })
        ].sort(byTimestampDesc),

        alerts: [],

        evidenceFiles: []
    },

    {
        id: "HOST-DB01",
        hostname: "SRV-DB01",
        ip: "10.20.1.30",
        mac: "00:1B:44:EE:41:5A",
        os: "Ubuntu Server 22.04 LTS",
        currentUser: null,
        status: ENDPOINT_STATUS.ONLINE,
        risk: RISK_LEVEL.LOW,
        uptimeSeconds: 90 * 24 * 3600,
        lastActivity: minutesAgoISO(3),
        isolated: false,

        loginHistory: [
            { user: "svc-app", timestamp: minutesAgoISO(2000), sourceIP: "10.20.1.30", suspicious: false }
        ],

        processes: [
            { pid: 1, name: "systemd", user: "root", status: "RUNNING", suspicious: false, cpu: 0.1, mem: 20 },
            { pid: 340, name: "postgres", user: "postgres", status: "RUNNING", suspicious: false, cpu: 3.5, mem: 1200 }
        ],

        connections: [
            ...generateAmbientConnections({
                count: 10,
                maxHoursAgo: 48,
                internalTargets: ["10.20.1.20", "10.20.1.40", "10.20.4.10", "10.20.6.15", "10.20.3.31"],
                externalChance: 0
            })
        ].sort(byTimestampDesc),

        alerts: [],

        evidenceFiles: []
    },

    {
        id: "HOST-WEB01",
        hostname: "SRV-WEB01",
        ip: "10.20.1.40",
        mac: "00:1B:44:FF:76:22",
        os: "Ubuntu Server 22.04 LTS",
        currentUser: null,
        status: ENDPOINT_STATUS.ONLINE,
        risk: RISK_LEVEL.LOW,
        uptimeSeconds: 60 * 24 * 3600,
        lastActivity: minutesAgoISO(1),
        isolated: false,

        loginHistory: [
            { user: "svc-deploy", timestamp: minutesAgoISO(1600), sourceIP: "10.20.1.40", suspicious: false }
        ],

        processes: [
            { pid: 1, name: "systemd", user: "root", status: "RUNNING", suspicious: false, cpu: 0.1, mem: 18 },
            { pid: 210, name: "nginx", user: "www-data", status: "RUNNING", suspicious: false, cpu: 1.2, mem: 90 },
            { pid: 388, name: "node", user: "www-data", status: "RUNNING", suspicious: false, cpu: 4.8, mem: 610 }
        ],

        connections: [
            ...generateAmbientConnections({
                count: 8,
                maxHoursAgo: 60,
                internalTargets: ["10.20.1.20", "10.20.1.30"],
                externalChance: 0.35
            })
        ].sort(byTimestampDesc),

        alerts: [],

        evidenceFiles: []
    },

    {
        id: "HOST-KILO",
        hostname: "LT-KILO",
        ip: "10.20.6.52",
        mac: "00:1B:45:01:9C:88",
        os: "macOS Sonoma 14.5",
        currentUser: "a.dubois",
        status: ENDPOINT_STATUS.OFFLINE,
        risk: RISK_LEVEL.LOW,
        uptimeSeconds: 0,
        lastActivity: minutesAgoISO(2200),
        isolated: false,

        loginHistory: [
            { user: "a.dubois", timestamp: minutesAgoISO(2260), sourceIP: "10.20.6.52", suspicious: false },
            ...generateAmbientLogins("a.dubois", { count: 2, minHoursAgo: 40, maxHoursAgo: 160 })
        ].sort(byTimestampDesc),

        processes: [],

        connections: [],

        alerts: [],

        evidenceFiles: []
    }

];