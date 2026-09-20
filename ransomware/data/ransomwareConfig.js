/* =========================================================
   NORTHSTAR SOC — RANSOMWARE CAMPAIGN CONFIG
   File: ransomware/data/ransomwareConfig.js

   Static, fictional configuration for the BLACKFROST
   ransomware campaign — the single source of truth every
   other ransomware file (RansomwareEngine, ProcessTree,
   IncidentResponse, FileExplorer, Terminal) reads from,
   same "one source of truth" convention as
   data/threatSources.js / data/phishingInfrastructure.js.

   Nothing here executes anything. Command lines are DISPLAY
   STRINGS only. No real cryptocurrency address, no real
   payment instructions — see RANSOM_NOTE below.
   ========================================================= */

import { ATTACKERS } from "../../engine/AttackEngine.js";
import { HOSTS } from "../../data/hosts.js";
import { USERS } from "../../data/users.js";

/*
 * Reuses the existing RED RAVEN actor from AttackEngine's
 * attacker roster rather than inventing a new fictional
 * IP/country — BLACKFROST is RED RAVEN's ransomware
 * operation, same actor pool the credential-theft campaign
 * already draws from.
 */
export const BLACKFROST_ACTOR =
    ATTACKERS.find(actor => actor.id === "ACTOR-RED-RAVEN") ||
    ATTACKERS[0];

export const RANSOMWARE_FAMILY = "BLACKFROST";

export const RANSOMWARE_CAMPAIGN_ID = "RANSOM-2026-001";

/*
 * The one real C2 domain this campaign uses everywhere —
 * DNS/TLS traffic (network/PacketEngine.js, via
 * data/phishingInfrastructure.js), Threat Intel, the ransom
 * note, Incident Response. A second, quieter relay domain is
 * used only late in the incident (secondary C2 fallback).
 */
export const C2_DOMAIN = "blackfrost-c2.example";
export const C2_RELAY_DOMAIN = "blackfrost-relay.example";
export const C2_IP = BLACKFROST_ACTOR.ip;

/*
 * The affected host + user — a real HOSTS/USERS fleet entry,
 * not an invented parallel roster. WORKSTATION-06 / jturner
 * (Engineering) so Endpoints, Process Tree, Attack Map, DNS
 * telemetry and File Explorer's "affected host" toggle all
 * agree on the exact same machine.
 */
export function getAffectedHost() {
    return HOSTS.find(host => host.hostname === "WORKSTATION-06") || null;
}

export function getAffectedUser() {
    const host = getAffectedHost();
    if (!host) return null;
    return USERS.find(user => user.username === host.assignedUser) || null;
}

/*
 * BACKUP-SERVER-01 already exists in the real HOSTS fleet
 * (host-018) — reused as-is rather than inventing a parallel
 * backup roster. Recovery Point is a fixed simulated
 * timestamp offset from campaign start (set by
 * RansomwareCampaign.create()).
 */
export function getBackupHost() {
    return HOSTS.find(host => host.hostname === "BACKUP-SERVER-01") || null;
}

/*
 * The malicious process chain — synthetic endpoint telemetry
 * only. Every commandLine value is a DISPLAY STRING; nothing
 * here is ever executed.
 */
export const PROCESS_CHAIN = [
    {
        processName: "WINWORD.EXE",
        parentProcessName: "explorer.exe",
        commandLine: "\"C:\\Program Files\\Microsoft Office\\WINWORD.EXE\" /n \"Q3_Shipping_Invoice.docm\"",
        integrityLevel: "Medium",
        suspicious: false
    },
    {
        processName: "wscript.exe",
        parentProcessName: "WINWORD.EXE",
        commandLine: "wscript.exe //B //Nologo invoice_macro.vbs",
        integrityLevel: "Medium",
        suspicious: true
    },
    {
        processName: "svchost32.exe",
        parentProcessName: "wscript.exe",
        commandLine: "svchost32.exe --enc --path=C:\\Users\\jturner\\Documents",
        integrityLevel: "Medium",
        suspicious: true
    }
];

/*
 * The Documents-folder files targeted for simulated
 * encryption — matches the spec's own example set. Sizes are
 * fictional but plausible. Nothing on the real filesystem is
 * ever touched; this is a static manifest RansomwareEngine
 * walks through, purely inside FileExplorerStore's simulated
 * state.
 */
export const TARGET_FILES = [
    { name: "budget.xlsx", folder: "Documents", size: 84000 },
    { name: "employees.csv", folder: "Documents", size: 51000 },
    { name: "project.docx", folder: "Documents", size: 62000 },
    { name: "presentation.pptx", folder: "Documents", size: 4200000 },
    { name: "report.pdf", folder: "Documents", size: 910000 },
    { name: "client_contacts.xlsx", folder: "Documents", size: 39000 },
    { name: "roadmap_2026.docx", folder: "Documents", size: 47000 },
    { name: "sprint_notes.txt", folder: "Documents", size: 6100 },
    { name: "org_backup.zip", folder: "Documents", size: 1800000 },
    { name: "vendor_contract.pdf", folder: "Documents", size: 320000 },
    { name: "design_review.pptx", folder: "Documents", size: 3100000 },
    { name: "timesheet_q3.xlsx", folder: "Documents", size: 28000 },
    { name: "engineering_specs.docx", folder: "Documents", size: 71000 },
    { name: "release_notes.txt", folder: "Documents", size: 4300 },
    { name: "photos_offsite.jpg", folder: "Pictures", size: 3400000 },
    { name: "team_diagram.png", folder: "Pictures", size: 980000 },
    { name: "quarterly_review.pptx", folder: "Desktop", size: 2600000 },
    { name: "notes.txt", folder: "Desktop", size: 900 },
    { name: "signed_nda.pdf", folder: "Downloads", size: 210000 },
    { name: "install_log.txt", folder: "Downloads", size: 3200 },
    { name: "customer_export.csv", folder: "Documents", size: 118000 },
    { name: "invoice_archive.zip", folder: "Documents", size: 2200000 },
    { name: "handbook_2026.pdf", folder: "Documents", size: 640000 },
    { name: "asset_inventory.xlsx", folder: "Documents", size: 33000 },
    { name: "meeting_recording.mp4", folder: "Videos", size: 51000000 },
    { name: "onboarding_guide.docx", folder: "Documents", size: 44000 },
    { name: "salary_bands.xlsx", folder: "Documents", size: 21000 },
    { name: "floor_plan.pdf", folder: "Documents", size: 780000 },
    { name: "vpn_config_backup.txt", folder: "Documents", size: 2100 },
    { name: "legal_review.docx", folder: "Documents", size: 58000 },
    { name: "supplier_list.csv", folder: "Documents", size: 19000 },
    { name: "compliance_audit.pdf", folder: "Documents", size: 990000 },
    { name: "brand_assets.zip", folder: "Downloads", size: 6700000 },
    { name: "release_checklist.xlsx", folder: "Documents", size: 15000 },
    { name: "customer_survey.csv", folder: "Documents", size: 27000 },
    { name: "architecture_diagram.pptx", folder: "Documents", size: 1900000 },
    { name: "budget_forecast.xlsx", folder: "Documents", size: 41000 },
    { name: "hr_policy.docx", folder: "Documents", size: 36000 },
    { name: "backup_manifest.txt", folder: "Documents", size: 5400 },
    { name: "server_inventory.xlsx", folder: "Documents", size: 24000 },
    { name: "final_report.docx", folder: "Documents", size: 52000 },
    { name: "expense_report.xlsx", folder: "Documents", size: 19500 },
    { name: "training_slides.pptx", folder: "Documents", size: 2400000 }
];

export const RANSOM_NOTE_FILENAME = "README_BLACKFROST.txt";

/*
 * Deliberately no real cryptocurrency address, no operational
 * payment instructions — establishes the incident narrative
 * only, per NORTHSTAR's safety requirements.
 */
export function buildRansomNoteContents(campaign) {
    return [
        "===================================================",
        "  YOUR FILES HAVE BEEN ENCRYPTED — BLACKFROST",
        "===================================================",
        "",
        `Incident Reference: ${campaign?.id || RANSOMWARE_CAMPAIGN_ID}`,
        `Attacker Identifier: ${BLACKFROST_ACTOR.name}`,
        `Recovery Identifier: BF-RCV-${(campaign?.id || RANSOMWARE_CAMPAIGN_ID).slice(-6)}`,
        "",
        "All documents, spreadsheets, presentations, and archives",
        "on this system have been encrypted. Do not attempt to",
        "rename, move, or restart this machine.",
        "",
        `Deadline: 72 hours from ${campaign?.encryptionStartedAt || "detection"}.`,
        "",
        "Payment information: [REDACTED — CONTACT VIA NEGOTIATION",
        "PORTAL. NO PAYMENT ADDRESS IS PROVIDED IN THIS SIMULATION.]",
        "",
        "This is a NORTHSTAR SOC training simulation. No files on",
        "any real system have been modified.",
        "==================================================="
    ].join("\n");
}

/*
 * SOC objectives — grouped exactly like the spec's
 * INVESTIGATION / CONTAINMENT / RECOVERY sections. Each item's
 * `done` predicate is evaluated live against the campaign by
 * IncidentResponseStore — nothing here is a static checklist.
 */
export const OBJECTIVE_DEFINITIONS = [
    { id: "identify-host", group: "INVESTIGATION", label: "Identify the compromised endpoint" },
    { id: "identify-process", group: "INVESTIGATION", label: "Identify the malicious process" },
    { id: "identify-timeline", group: "INVESTIGATION", label: "Determine the attack timeline" },
    { id: "identify-c2", group: "INVESTIGATION", label: "Identify C2 infrastructure" },

    { id: "isolate-host", group: "CONTAINMENT", label: "Isolate the affected host" },
    { id: "terminate-process", group: "CONTAINMENT", label: "Terminate the malicious process" },
    { id: "block-c2", group: "CONTAINMENT", label: "Block C2 communication" },

    { id: "validate-backup", group: "RECOVERY", label: "Validate backup availability" },
    { id: "restore-files", group: "RECOVERY", label: "Restore affected files" },
    { id: "return-to-service", group: "RECOVERY", label: "Return the host to service" }
];

/*
 * MITRE ATT&CK mapping — documentation/education only, and
 * only techniques this specific simulation actually
 * represents (per spec: no giant encyclopedia).
 */
export const MITRE_MAPPING = [
    {
        tactic: "Initial Access",
        technique: "T1566 — Phishing",
        evidence: "Malicious document delivered as an email attachment"
    },
    {
        tactic: "Execution",
        technique: "T1204 — User Execution",
        evidence: "User opened the attachment, triggering macro execution"
    },
    {
        tactic: "Execution",
        technique: "T1059 — Command and Scripting Interpreter",
        evidence: "wscript.exe spawned from WINWORD.EXE, then svchost32.exe"
    },
    {
        tactic: "Discovery",
        technique: "T1083 — File and Directory Discovery",
        evidence: "Rapid enumeration of the Documents folder before encryption began"
    },
    {
        tactic: "Impact",
        technique: "T1486 — Data Encrypted for Impact",
        evidence: "Mass file modification and extension changes across Documents"
    },
    {
        tactic: "Command and Control",
        technique: "T1071 — Application Layer Protocol",
        evidence: "Outbound DNS/TLS traffic to blackfrost-c2.example"
    }
];

/*
 * Terminal command reference — Terminal (script.js) maps
 * these display strings to RansomwareEngine method calls.
 * Never executed against the real OS.
 */
export const TERMINAL_COMMANDS = [
    { command: "ps", description: "list simulated processes on the affected host" },
    { command: "netstat", description: "list simulated network connections" },
    { command: "whoami", description: "show the affected user" },
    { command: "hostname", description: "show the affected host" },
    { command: "isolate-host <hostname>", description: "isolate a host from the network" },
    { command: "terminate <process>", description: "terminate the simulated ransomware process" },
    { command: "block-c2 <domain>", description: "block simulated C2 infrastructure" }
];
