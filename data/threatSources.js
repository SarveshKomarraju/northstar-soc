/* =========================================================
   NORTHSTAR SOC — SHARED THREAT SOURCE DATA
   File: data/threatSources.js

   Purpose:
   This was previously a hardcoded array living inside
   initializeAttackMap() in script.js, invisible to every
   other app. It's now the single source of truth for
   external IP/country/geolocation data, so:

   - Attack Map plots these on the world map (unchanged
     visually — same IPs, same positions).
   - Endpoints can reference these same IPs in a host's
     login history / network connections, so an analyst who
     spots a suspicious IP on an endpoint can cross-reference
     the exact same IP on the Attack Map, and vice versa.

   Anything added here automatically shows up on the map.
   ========================================================= */

export const THREAT_SOURCES = [

    {
        ip: "185.203.118.42",
        country: "United States",
        latitude: 39.0,
        longitude: -98.0,
        risk: "LOW"
    },

    {
        ip: "104.28.91.17",
        country: "Canada",
        latitude: 56.0,
        longitude: -106.0,
        risk: "LOW"
    },

    {
        ip: "162.241.22.18",
        country: "Mexico",
        latitude: 23.0,
        longitude: -102.0,
        risk: "LOW"
    },

    {
        ip: "45.83.64.119",
        country: "Brazil",
        latitude: -10.0,
        longitude: -55.0,
        risk: "LOW"
    },

    {
        ip: "190.14.77.21",
        country: "Argentina",
        latitude: -38.0,
        longitude: -64.0,
        risk: "LOW"
    },

    {
        ip: "91.198.174.22",
        country: "United Kingdom",
        latitude: 54.0,
        longitude: -2.0,
        risk: "LOW"
    },

    {
        ip: "185.71.67.31",
        country: "France",
        latitude: 46.0,
        longitude: 2.0,
        risk: "LOW"
    },

    {
        ip: "172.67.14.91",
        country: "Germany",
        latitude: 51.0,
        longitude: 10.0,
        risk: "LOW"
    },

    {
        ip: "185.220.101.14",
        country: "Nigeria",
        latitude: 9.0,
        longitude: 8.0,
        risk: "HIGH"
    },

    {
        ip: "103.72.18.44",
        country: "South Africa",
        latitude: -30.0,
        longitude: 25.0,
        risk: "LOW"
    },

    {
        ip: "64.233.187.99",
        country: "India",
        latitude: 22.0,
        longitude: 79.0,
        risk: "LOW"
    },

    {
        ip: "118.98.42.76",
        country: "China",
        latitude: 35.0,
        longitude: 103.0,
        risk: "MEDIUM"
    },

    {
        ip: "103.15.72.81",
        country: "Japan",
        latitude: 36.0,
        longitude: 138.0,
        risk: "LOW"
    },

    {
        ip: "211.42.91.14",
        country: "South Korea",
        latitude: 37.0,
        longitude: 127.5,
        risk: "LOW"
    },

    {
        ip: "45.12.88.203",
        country: "Australia",
        latitude: -25.0,
        longitude: 133.0,
        risk: "LOW"
    },

    {
        ip: "88.214.63.17",
        country: "Türkiye",
        latitude: 39.0,
        longitude: 35.0,
        risk: "LOW"
    },

    {
        ip: "185.143.223.44",
        country: "Russia",
        latitude: 60.0,
        longitude: 90.0,
        risk: "HIGH"
    },

    {
        ip: "103.91.144.28",
        country: "Indonesia",
        latitude: -2.0,
        longitude: 118.0,
        risk: "MEDIUM"
    }

];

export function findThreatSourceByIp(ip) {

    return THREAT_SOURCES.find(
        source => source.ip === ip
    ) || null;
}

export function getHighRiskThreatSources() {

    return THREAT_SOURCES.filter(
        source => source.risk === "HIGH"
    );
}