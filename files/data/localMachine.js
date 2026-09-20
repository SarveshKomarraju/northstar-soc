/* =========================================================
   NORTHSTAR SOC — LOCAL MACHINE
   File: files/data/localMachine.js

   Purpose:
   The File Explorer is the analyst's OWN workstation — not a
   remote-forensics tool for browsing the corporate fleet. It
   is intentionally NOT one of the monitored endpoints in
   data/hosts.js (those stay Endpoints/Network/IAM/VPN
   territory); it exists only for this module, so nothing else
   in the game ever lists, counts, or investigates it.
   ========================================================= */

export const LOCAL_MACHINE = {
    id: "local-machine",
    hostname: "ANALYST-PC",
    operatingSystem: "Windows 11",
    assignedUser: "analyst",
    isolated: false
};
