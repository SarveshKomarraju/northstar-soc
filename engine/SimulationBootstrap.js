/* =========================================================
   SOC SIMULATION BOOTSTRAP
   ========================================================= */

import { HOSTS }
    from "../data/hosts.js";

import { USERS }
    from "../data/users.js";

import { NETWORK }
    from "../data/network.js";

import { EventEngine }
    from "./EventEngine.js";

import { DetectionEngine }
    from "../Detection/DetectionEngine.js";

import { AlertManager }
    from "../alerts/AlertManager.js";

import { AttackEngine }
    from "./AttackEngine.js";

import { SimulationEngine }
    from "./SimulationEngine.js";

import { NetworkEventBridge }
    from "../network/NetworkEventBridge.js";

import { MailStore } from "../mail/MailStore.js";
import { MailEventBridge } from "../mail/Maileventbridge.JS";
import { EndpointStore } from "../endpoints/EndpointStore.js";
import { EndpointProcessBridge } from "../endpoints/EndpointProcessBridge.js";
import { VpnStore } from "../vpn/VpnStore.js";
import { VpnEventBridge } from "../vpn/VpnEventBridge.js";
import { FileExplorerStore } from "../files/FileExplorerStore.js";
import { FileExplorerEventBridge } from "../files/FileExplorerEventBridge.js";
import { PlaybookStore } from "../playbook/PlaybookStore.js";
import { RansomwareEngine } from "../ransomware/RansomwareEngine.js";

/*
 * RANSOMWARE (BLACKFROST) — SCENARIO GATING
 * ---------------------------------------------------------
 * Read once, synchronously, before any engine is constructed.
 * MainMenu.beginNewOperation() sets this in localStorage and
 * then does a full page reload before the desktop (and this
 * module) ever runs again, so this value is reliably the
 * scenario the player actually chose — unlike
 * window.NorthstarScenario, which MainMenu sets later and
 * isn't guaranteed to exist yet at this point in the script
 * load order.
 *
 * Anything other than the literal "ransomware" id (missing,
 * "credential-theft", "free-operation", a future scenario id)
 * keeps today's default behavior byte-for-byte unchanged —
 * the credential-theft AttackEngine starts exactly as before.
 *
 * KNOWN LIMITATION: MainMenu.loadSelectedSave() (Load Session)
 * updates this same localStorage key WITHOUT reloading the
 * page, so resuming a saved ransomware session after this
 * module has already run with a different scenario selected
 * will not retroactively start RansomwareEngine. This is a
 * pre-existing quirk of the save/resume flow (not something
 * ransomware introduces) — New Operation, which always
 * reloads, is unaffected and is the primary way to start a
 * ransomware incident.
 */
const SELECTED_SCENARIO =
    localStorage.getItem("northstar-selected-scenario") || "credential-theft";

const IS_RANSOMWARE_SCENARIO =
    SELECTED_SCENARIO === "ransomware";

console.log(
    "%cSOC SIMULATION BOOTSTRAP ONLINE",
    "font-size:16px;font-weight:bold;"
);


/* =========================================================
   1. EVENT ENGINE
   ========================================================= */

const eventEngine =
    new EventEngine();

window.eventEngine =
    eventEngine;


/* =========================================================
   2. ALERT MANAGER
   ========================================================= */

const alertManager =
    new AlertManager();

window.alertManager =
    alertManager;


/* =========================================================
   3. DETECTION ENGINE
   ========================================================= */

const detectionEngine =
    new DetectionEngine(
        eventEngine,
        alertManager
    );

window.detectionEngine =
    detectionEngine;


/* =========================================================
   4. ATTACK ENGINE
   ========================================================= */

const attackEngine =
    new AttackEngine(
        eventEngine
    );

window.attackEngine =
    attackEngine;


/* =========================================================
   5. SIMULATION ENGINE
   ========================================================= */

const simulationEngine =
    new SimulationEngine({

        attackEngine:
            attackEngine,

        hosts:
            HOSTS,

        users:
            USERS,

        network:
            NETWORK

    });

window.simulationEngine =
    simulationEngine;


/* =========================================================
   6. NETWORK EVENT BRIDGE
   ========================================================= */

const networkEventBridge =
    new NetworkEventBridge(
        window.packetEngine,
        eventEngine
    );

window.networkEventBridge =
    networkEventBridge;

/* =========================================================
   7. MAIL STORE + MAIL EVENT BRIDGE
   ========================================================= */

const mailStore =
    new MailStore();

window.mailStore =
    mailStore;

const mailEventBridge =
    new MailEventBridge(
        eventEngine,
        mailStore
    );

window.mailEventBridge =
    mailEventBridge;

mailEventBridge.start();
/* =========================================================
   START DETECTION
   ========================================================= */

detectionEngine.start();


/* =========================================================
   START NETWORK → SIEM BRIDGE
   ========================================================= */

networkEventBridge.start();

alertManager.subscribe(alert => {

    if (!window.packetEngine) {
        return;
    }

    if (alert.severity === "CRITICAL") {

        window.packetEngine.setThreatLevel(90);

    } else if (alert.severity === "HIGH") {

        window.packetEngine.setThreatLevel(70);

    } else if (alert.severity === "MEDIUM") {

        window.packetEngine.setThreatLevel(40);

    }

});


/* =========================================================
   VERIFY
   ========================================================= */

console.log(
    "[SIMULATION] Bootstrap complete."
);

console.log(
    "[SIMULATION] EventEngine:",
    window.eventEngine
        ? "ONLINE"
        : "OFFLINE"
);

console.log(
    "[SIMULATION] DetectionEngine:",
    window.detectionEngine
        ? "ONLINE"
        : "OFFLINE"
);

console.log(
    "[SIMULATION] AlertManager:",
    window.alertManager
        ? "ONLINE"
        : "OFFLINE"
);

console.log(
    "[SIMULATION] AttackEngine:",
    window.attackEngine
        ? "ONLINE"
        : "OFFLINE"
);

console.log(
    "[SIMULATION] SimulationEngine:",
    window.simulationEngine
        ? "ONLINE"
        : "OFFLINE"
);

console.log(
    "[SIMULATION] NetworkEventBridge:",
    window.networkEventBridge
        ? "ONLINE"
        : "OFFLINE"
);

/* =========================================================
   START SIMULATION
   ---------------------------------------------------------
   Only the credential-theft AttackEngine — driven through
   SimulationEngine — is scenario-gated here. Only one campaign
   engine ever runs at a time.
   ========================================================= */

window.addEventListener(
    "DOMContentLoaded",
    () => {

        setTimeout(() => {

            if (IS_RANSOMWARE_SCENARIO) {

                console.log(
                    "[SIMULATION] Ransomware scenario selected — credential-theft AttackEngine will not start."
                );

                return;
            }

            if (
                window.simulationEngine &&
                typeof window.simulationEngine.start ===
                "function"
            ) {

                window.simulationEngine.start();

            } else {

                console.error(
                    "[SIMULATION] SimulationEngine unavailable."
                );

            }

        }, 100);

    }
);


/* =========================================================
   RANSOMWARE ENGINE (BLACKFROST)
   ---------------------------------------------------------
   Constructed and started only when the ransomware scenario
   was actually selected — see SELECTED_SCENARIO above. Reuses
   the exact same EventEngine/DetectionEngine/AlertManager/
   PacketEngine pipeline the credential-theft campaign already
   runs through; nothing here duplicates that pipeline.
   ========================================================= */

const ransomwareEngine =
    new RansomwareEngine(eventEngine);

window.ransomwareEngine =
    ransomwareEngine;

if (IS_RANSOMWARE_SCENARIO) {

    window.addEventListener(
        "DOMContentLoaded",
        () => {

            setTimeout(() => {

                ransomwareEngine.start();

                console.log(
                    "[SIMULATION] RansomwareEngine: ONLINE"
                );

            }, 100);

        }
    );

} else {

    console.log(
        "[SIMULATION] RansomwareEngine: constructed, not started (scenario is not ransomware)."
    );

}

/* =========================================================
   8. ENDPOINT STORE
   ========================================================= */

const endpointStore =
    new EndpointStore();

window.endpointStore =
    endpointStore;

const endpointProcessBridge =
    new EndpointProcessBridge(eventEngine);

window.endpointProcessBridge =
    endpointProcessBridge;

endpointProcessBridge.start();

const vpnStore = new VpnStore();
window.vpnStore = vpnStore;

const vpnEventBridge = new VpnEventBridge(eventEngine);
window.vpnEventBridge = vpnEventBridge;
vpnEventBridge.start();

window.fileExplorerStore = new FileExplorerStore();
const fileExplorerBridge = new FileExplorerEventBridge(eventEngine);
window.fileExplorerBridge = fileExplorerBridge;
fileExplorerBridge.start();

window.playbookStore = new PlaybookStore();