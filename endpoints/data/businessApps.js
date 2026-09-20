/* =========================================================
   NORTHSTAR SOC — BUSINESS APPLICATIONS
   File: endpoints/data/businessApps.js

   Purpose:
   Ordinary, legitimate software that occasionally starts up
   on real hosts, independent of any attack. This is what
   gives "Terminate Process" a genuine downside — without
   this, every process event in the simulation is guaranteed
   malicious (they only ever come from AttackEngine.postCompromise),
   so there'd be nothing to actually get wrong.

   Each entry describes what breaks, and for whom, if an
   analyst terminates it by mistake — used for the score
   penalty message.
   ========================================================= */

export const BUSINESS_APPS = [

    {
        process: "invoice-sync.exe",
        department: "Finance",
        impact: "Finance can no longer sync invoices with the accounting platform."
    },

    {
        process: "backup-agent.exe",
        department: "IT",
        impact: "Scheduled backups for this host have stopped running."
    },

    {
        process: "salesforce-connector.exe",
        department: "Sales",
        impact: "Sales can no longer sync customer records with the CRM."
    },

    {
        process: "print-spooler.exe",
        department: "Operations",
        impact: "This user can no longer print documents."
    },

    {
        process: "vpn-client.exe",
        department: "IT",
        impact: "This user has lost their VPN connection to internal resources."
    },

    {
        process: "payroll-agent.exe",
        department: "Finance",
        impact: "Payroll processing for this cycle has been interrupted."
    },

    {
        process: "helpdesk-ticket-sync.exe",
        department: "IT",
        impact: "IT support tickets from this user are no longer syncing."
    },

    {
        process: "design-asset-sync.exe",
        department: "Marketing",
        impact: "Marketing has lost access to shared design assets on this machine."
    },

    {
        process: "license-check.exe",
        department: "IT",
        impact: "This host's software licenses can no longer be validated."
    },

    {
        process: "calendar-sync-agent.exe",
        department: "Operations",
        impact: "This user's calendar has stopped syncing across devices."
    }

];

export function randomBusinessApp() {
    return BUSINESS_APPS[Math.floor(Math.random() * BUSINESS_APPS.length)];
}