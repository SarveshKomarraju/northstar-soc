/* =========================================================
   NORTHSTAR SOC — ENDPOINT PROCESS BRIDGE
   File: endpoints/EndpointProcessBridge.js

   Purpose:
   Periodically starts an ordinary, legitimate business
   process on a random real host, through the real
   eventEngine — same trickle pattern as MailEventBridge's
   benign email trickle.

   This is what makes "Terminate Process" a genuine judgment
   call. Without it, every process event in the simulation is
   guaranteed malicious (only ever emitted by
   AttackEngine.postCompromise()), so there'd be nothing an
   analyst could actually get wrong by terminating it.

   These events have NO actorType (no attacker) — that's the
   field EndpointStore/EndpointRenderer already use to tell a
   malicious process apart from a legitimate one.
   ========================================================= */

import { HOSTS } from "../data/hosts.js";
import { randomBusinessApp } from "./data/businessApps.js";

export class EndpointProcessBridge {

    constructor(eventEngine, options = {}) {

        this.eventEngine = eventEngine;

        this.running = false;

        this.trickleTimer = null;

        /*
         * Ordinary business software starting up happens
         * fairly often in real life — every 45-150s of real
         * time by default.
         */
        this.trickleRange =
            options.trickleRange || [45000, 150000];

        console.log("[ENDPOINT PROCESS BRIDGE] Ready.");
    }

    start() {

        if (this.running) {
            return;
        }

        if (!this.eventEngine) {
            console.error("[ENDPOINT PROCESS BRIDGE] Missing eventEngine.");
            return;
        }

        this.running = true;

        this.scheduleNextProcess();

        console.log("[ENDPOINT PROCESS BRIDGE] Online — emitting ordinary business processes.");
    }

    stop() {

        this.running = false;

        if (this.trickleTimer) {
            clearTimeout(this.trickleTimer);
            this.trickleTimer = null;
        }

        console.log("[ENDPOINT PROCESS BRIDGE] Stopped.");
    }

    scheduleNextProcess() {

        if (!this.running) {
            return;
        }

        const [min, max] = this.trickleRange;

        const delay =
            Math.floor(Math.random() * (max - min + 1)) + min;

        this.trickleTimer = setTimeout(() => {

            this.trickleTimer = null;

            this.emitAmbientProcess();

            this.scheduleNextProcess();

        }, delay);
    }

    emitAmbientProcess() {

        if (!this.running || !HOSTS.length) {
            return;
        }

        /*
         * Skip hosts currently isolated (they're cut off, no
         * new software would be starting there) or already
         * compromised (that host's story is already the
         * attack — don't muddy it with unrelated flavor).
         */
        const eligibleHosts =
            HOSTS.filter(host => !host.isolated && !host.compromised);

        if (!eligibleHosts.length) {
            return;
        }

        const host =
            eligibleHosts[Math.floor(Math.random() * eligibleHosts.length)];

        const app =
            randomBusinessApp();

        this.eventEngine.createEvent({
            eventType: "PROCESS_START",
            severity: "INFO",
            actor: null,
            actorType: null,
            sourceIP: null,
            destinationIP: host.ip,
            hostname: host.hostname,
            username: host.assignedUser,
            process: app.process,
            command: app.process,
            message: `${app.process} started normally.`,
            metadata: {
                department: app.department,
                impact: app.impact,
                simulated: true,
                benign: true
            }
        });
    }
}