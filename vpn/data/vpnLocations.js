/* =========================================================
   NORTHSTAR SOC — VPN LOCATIONS
   ========================================================= */

export const VPN_LOCATIONS = [

    { ip: "203.0.113.12", country: "United States (East)" },
    { ip: "203.0.113.45", country: "United States (West)" },
    { ip: "203.0.113.78", country: "Canada" },

    { ip: "198.51.100.23", country: "United Kingdom" },
    { ip: "198.51.100.56", country: "Germany" },
    { ip: "198.51.100.89", country: "France" },

    { ip: "192.0.2.14", country: "Netherlands" },
    { ip: "192.0.2.47", country: "Spain" },
    { ip: "192.0.2.90", country: "Italy" },

    { ip: "203.0.113.101", country: "Romania" },
    { ip: "203.0.113.134", country: "Poland" },
    { ip: "203.0.113.167", country: "Sweden" },

    { ip: "198.51.100.112", country: "Australia" },
    { ip: "198.51.100.145", country: "Japan" },
    { ip: "198.51.100.178", country: "South Korea" },

    { ip: "192.0.2.123", country: "Singapore" },
    { ip: "192.0.2.156", country: "India" },
    { ip: "192.0.2.189", country: "Brazil" },

    { ip: "203.0.113.201", country: "Mexico" },
    { ip: "203.0.113.234", country: "South Africa" },

    { ip: "198.51.100.211", country: "United Arab Emirates" },
    { ip: "198.51.100.244", country: "New Zealand" },

    { ip: "192.0.2.221", country: "Ireland" },
    { ip: "192.0.2.254", country: "Switzerland" },

    { ip: "203.0.113.15", country: "Portugal" }

];


export function randomVpnLocation() {

    return VPN_LOCATIONS[
        Math.floor(
            Math.random() * VPN_LOCATIONS.length
        )
    ];
}


/*
 * Approximate country centerpoints for every country name used
 * above, keyed on that exact string. Lets the Attack Map plot
 * the NORTHSTAR icon at wherever the VPN is currently routed
 * through, instead of only ever at the real HQ location — pure
 * map-plotting data, not used for any exposure-risk logic.
 */
export const VPN_COUNTRY_COORDS = {

    "United States (East)": { lat: 40.7128, lon: -74.0060 },
    "United States (West)": { lat: 34.0522, lon: -118.2437 },
    "Canada": { lat: 56.1304, lon: -106.3468 },

    "United Kingdom": { lat: 55.3781, lon: -3.4360 },
    "Germany": { lat: 51.0, lon: 10.0 },
    "France": { lat: 46.2276, lon: 2.2137 },

    "Netherlands": { lat: 52.0, lon: 5.0 },
    "Spain": { lat: 40.4637, lon: -3.7492 },
    "Italy": { lat: 41.8719, lon: 12.5674 },

    "Romania": { lat: 46.0, lon: 25.0 },
    "Poland": { lat: 51.9194, lon: 19.1451 },
    "Sweden": { lat: 60.1282, lon: 18.6435 },

    "Australia": { lat: -25.2744, lon: 133.7751 },
    "Japan": { lat: 36.2048, lon: 138.2529 },
    "South Korea": { lat: 35.9078, lon: 127.7669 },

    "Singapore": { lat: 1.3521, lon: 103.8198 },
    "India": { lat: 20.5937, lon: 78.9629 },
    "Brazil": { lat: -14.2350, lon: -51.9253 },

    "Mexico": { lat: 23.6345, lon: -102.5528 },
    "South Africa": { lat: -30.5595, lon: 22.9375 },

    "United Arab Emirates": { lat: 23.4241, lon: 53.8478 },
    "New Zealand": { lat: -40.9006, lon: 174.8860 },

    "Ireland": { lat: 53.4129, lon: -8.2439 },
    "Switzerland": { lat: 46.8182, lon: 8.2275 },

    "Portugal": { lat: 39.3999, lon: -8.2245 }
};