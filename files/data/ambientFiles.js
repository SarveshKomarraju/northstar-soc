/* =========================================================
   NORTHSTAR SOC — AMBIENT FILES
   File: files/data/ambientFiles.js

   Purpose:
   Ordinary ambient files + the small set of deliberate
   investigation artifacts used by the File Explorer scenario.

   Normal ambient files remain completely independent from
   attack activity.

   Scenario artifacts are separate because they are persistent
   investigation objects rather than FILE_CREATED / FILE_DROPPED
   telemetry.
   ========================================================= */

export const WINDOWS_USER_FILES = [

    { name: "Q3_Budget_Review.xlsx", folder: "Documents", size: 48000 },
    { name: "resume_draft.docx", folder: "Documents", size: 22000 },
    { name: "vacation_photo.jpg", folder: "Pictures", size: 3200000 },
    { name: "meeting_notes.txt", folder: "Desktop", size: 1200 },
    { name: "team_offsite.png", folder: "Pictures", size: 4100000 },
    { name: "presentation_final.pptx", folder: "Documents", size: 8900000 },
    { name: "installer_setup.exe", folder: "Downloads", size: 15400000 },
    { name: "budget_2026.xlsx", folder: "Downloads", size: 51000 },
    { name: "notes.txt", folder: "Desktop", size: 800 },
    { name: "invoice_template.docx", folder: "Documents", size: 31000 },
    { name: "printer_driver_setup.exe", folder: "Downloads", size: 22000000 },
    { name: "org_chart.pdf", folder: "Documents", size: 610000 }

];

export const WINDOWS_SYSTEM_FILES = [

    { name: "install_log.txt", folder: "ProgramData", size: 8900 },
    { name: "scheduled_task_backup.xml", folder: "ProgramData", size: 2200 },
    { name: "temp_download.tmp", folder: "Windows\\Temp", size: 41000 },
    { name: "driver_cache.dat", folder: "Windows\\Temp", size: 190000 }

];

export const UNIX_USER_FILES = [

    { name: "notes.md", folder: "Documents", size: 3400 },
    { name: "backup_script.py", folder: "Documents", size: 2100 },
    { name: "readme.txt", folder: "Documents", size: 600 },
    { name: "site_export.tar.gz", folder: "Downloads", size: 18900000 }

];

export const UNIX_SYSTEM_FILES = [

    { name: "deploy.sh", folder: "opt/scripts", size: 1800 },
    { name: "config.yaml", folder: "opt/scripts", size: 900 },
    { name: "cron_job.py", folder: "opt/scripts", size: 1500 },
    { name: "access.log.1", folder: "var/log", size: 5400000 },
    { name: "package_list.txt", folder: "tmp", size: 4100 }

];


/* =========================================================
   NORTHSTAR INVESTIGATION ARTIFACTS
   ---------------------------------------------------------
   These are the ONLY three deliberate File Explorer
   additions.

   1. locked_finance_archive.zip
   2. credential_backup.kdbx
   3. invoice_viewer.ps1
   ========================================================= */

export const NORTHSTAR_SCENARIO_FILES = [

    {
        id: "NS-LOCKED-FINANCE",

        name: "locked_finance_archive.zip",

        folder: "Documents",

        size: 2840000,

        locked: true,

        requiresPasswordCracker: true,

        type: "locked",

        description:
            "Encrypted archive recovered during the investigation. " +
            "Contents cannot be accessed until the password is recovered.",

        investigationNote:
            "Password-protected archive. NORTHSTAR password-cracker access required."
    },

    {
        id: "NS-LOCKED-CREDENTIALS",

        name: "credential_backup.kdbx",

        folder: "Documents",

        size: 146000,

        locked: true,

        requiresPasswordCracker: true,

        type: "locked",

        description:
            "Encrypted credential database discovered on the endpoint. " +
            "The database remains inaccessible while locked.",

        investigationNote:
            "Encrypted credential store. NORTHSTAR password-cracker access required."
    },

    {
        id: "NS-SUSPICIOUS-INVOICE",

        name: "invoice_viewer.ps1",

        folder: "Downloads",

        size: 7800,

        locked: false,

        requiresPasswordCracker: false,

        type: "suspicious",

        description:
            "PowerShell script downloaded shortly before unusual endpoint activity.",

        investigationNote:
            "Potentially malicious script. Review the file metadata and linked telemetry before taking action.",

        contents: [
            "NORTHSTAR FILE INVESTIGATION",
            "",
            "Artifact: invoice_viewer.ps1",
            "Classification: Suspicious",
            "Source: Endpoint download activity",
            "",
            "Analyst note:",
            "This script was downloaded shortly before anomalous",
            "endpoint activity was observed.",
            "",
            "Recommended investigation:",
            "Correlate the file with SIEM, endpoint process,",
            "network, and email telemetry."
        ].join("\n")
    }

];


/**
 * Returns { template, isUserFile } for a random ambient file
 * appropriate to this specific host.
 */
export function randomAmbientFileForHost(host) {

    const isWindows =
        String(host?.operatingSystem || "")
            .toLowerCase()
            .includes("windows");

    const userPool =
        isWindows
            ? WINDOWS_USER_FILES
            : UNIX_USER_FILES;

    const systemPool =
        isWindows
            ? WINDOWS_SYSTEM_FILES
            : UNIX_SYSTEM_FILES;

    const canUseUserFiles =
        !!host?.assignedUser;

    const useUserFile =
        canUseUserFiles &&
        Math.random() < 0.7;

    const pool =
        useUserFile
            ? userPool
            : systemPool;

    const template =
        pool[Math.floor(Math.random() * pool.length)];

    return {
        template,
        isUserFile: useUserFile
    };
}


/**
 * Builds a full, realistic path for an ambient file.
 */
export function buildAmbientFilePath(
    host,
    template,
    isUserFile
) {

    const isWindows =
        String(host?.operatingSystem || "")
            .toLowerCase()
            .includes("windows");

    if (isWindows) {

        return isUserFile
            ? `C:\\Users\\${host.assignedUser}\\${template.folder}\\${template.name}`
            : `C:\\${template.folder}\\${template.name}`;
    }

    return isUserFile
        ? `/home/${host.assignedUser}/${template.folder}/${template.name}`
        : `/${template.folder}/${template.name}`;
}


/**
 * The three deliberate scenario artifacts live in a shared
 * evidence location — not under any one machine's personal
 * folders — since File Explorer is scoped to the analyst's
 * own PC and these need to be reachable regardless.
 */
const SHARED_FILES_ROOT =
    "\\\\NORTHSTAR-SHARE\\Evidence";

/**
 * Small deterministic hash — not cryptographic, just stable
 * across reloads so the same artifact always gets the same
 * lock password (getFileLockPassword derives from file.hash).
 */
function stableHash(seed) {

    let hash = 0;

    for (let i = 0; i < seed.length; i++) {

        hash =
            (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
    }

    const hex =
        (hash >>> 0).toString(16).padStart(8, "0");

    return hex.repeat(8);
}

/**
 * Builds the three deliberate investigation artifacts as real
 * file entries on the shared evidence path — the files that
 * need to go through the Password Cracker (or, for the
 * suspicious script, direct investigation).
 */
export function buildSharedFiles() {

    return NORTHSTAR_SCENARIO_FILES.map(template => ({

        id: template.id,

        name: template.name,

        type: "file",

        path: `${SHARED_FILES_ROOT}\\${template.name}`,

        size: template.size,

        locked: template.locked,

        requiresPasswordCracker: template.requiresPasswordCracker,

        /*
         * Named scenarioType (not "type") — tree nodes already
         * use `type: "file" | "folder"` and the renderer's
         * locked/suspicious badges key off this exact field.
         */
        scenarioType: template.type,

        description: template.description,

        investigationNote: template.investigationNote,

        contents: template.contents || null,

        timestamp: "2026-08-31T19:42:00.000Z",

        hash: stableHash(template.id),

        eventId: null,

        actor: null,

        actorType: null,

        attackId: null,

        scenarioArtifact: true

    }));
}