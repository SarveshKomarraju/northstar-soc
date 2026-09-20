/* =========================================================
   NORTHSTAR SOC — FILE EXPLORER EVENT BRIDGE
   File: files/FileExplorerEventBridge.js

   Purpose:
   Periodically scatters ordinary, boring files across the
   analyst's own machine (LOCAL_MACHINE) through the real
   eventEngine — same trickle pattern as EndpointProcessBridge
   and VpnEventBridge, just scoped to one machine instead of
   the corporate fleet. Without this, the only files that
   would ever exist would be whatever the player themselves
   creates, which would make the File Explorer feel dead.
   ========================================================= */

import { LOCAL_MACHINE } from "./data/localMachine.js";
import { pseudoFileHash } from "../engine/AttackEngine.js";
import { randomAmbientFileForHost, buildAmbientFilePath } from "./data/ambientFiles.js";

export class FileExplorerEventBridge {

    constructor(eventEngine, options = {}) {

        this.eventEngine = eventEngine;

        this.running = false;

        this.trickleTimer = null;

        /*
         * A new ambient file every 30-90s of real time.
         */
        this.trickleRange =
            options.trickleRange || [30000, 90000];

        console.log("[FILE EXPLORER EVENT BRIDGE] Ready.");
    }

    start() {

        if (this.running) {
            return;
        }

        if (!this.eventEngine) {
            console.error("[FILE EXPLORER EVENT BRIDGE] Missing eventEngine.");
            return;
        }

        this.running = true;

        this.scheduleNextFile();

        console.log("[FILE EXPLORER EVENT BRIDGE] Online — scattering ambient files on the local machine.");
    }

    stop() {

        this.running = false;

        if (this.trickleTimer) {
            clearTimeout(this.trickleTimer);
            this.trickleTimer = null;
        }

        console.log("[FILE EXPLORER EVENT BRIDGE] Stopped.");
    }

    scheduleNextFile() {

        if (!this.running) {
            return;
        }

        const [min, max] = this.trickleRange;

        const delay =
            Math.floor(Math.random() * (max - min + 1)) + min;

        this.trickleTimer = setTimeout(() => {

            this.trickleTimer = null;

            this.emitAmbientFile();

            this.scheduleNextFile();

        }, delay);
    }

    emitAmbientFile() {

        if (!this.running) {
            return;
        }

        const host =
            LOCAL_MACHINE;

        const { template, isUserFile } =
            randomAmbientFileForHost(host);

        const filePath =
            buildAmbientFilePath(host, template, isUserFile);

        this.eventEngine.createEvent({
            eventType: "FILE_CREATED",
            severity: "INFO",
            hostname: host.hostname,
            username: isUserFile ? host.assignedUser : null,
            message: `${template.name} was created on ${host.hostname}.`,
            metadata: {
                fileName: template.name,
                filePath,
                fileHash: pseudoFileHash(`${host.id}:${filePath}:${Date.now()}`),
                fileSize: template.size,
                simulated: true,
                benign: true
            }
        });
    }
}
