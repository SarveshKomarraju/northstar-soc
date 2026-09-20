/* =========================================================
   NORTHSTAR SOC — IAM DATA
   File: iam/IAMData.js

   Every username referenced here is a REAL account from the
   actual 14-user roster (data/users.js) — not a disconnected
   fictional identity. A player who cross-references one of
   these names in Endpoints, VPN, or Mail will find the same
   real person, same as everywhere else in NORTHSTAR.

   Only a few accounts get an explicit review entry below —
   that's intentional, not incomplete. Real access reviews
   rarely cover 100% of a roster; everyone else correctly
   falls through to "NO REVIEW DATA" via IAMApp.js's own
   fallback, which is an honest state, not a bug.
   ========================================================= */


window.NorthstarIAMData = {

    /* =====================================================
       PRIVILEGE CHANGE HISTORY
       ===================================================== */

    privilegeChanges: [

        {
            id: "IAM-001",

            user: "afischer",

            previousPrivilege:
                "STANDARD-USER",

            newPrivilege:
                "ADMINISTRATOR",

            changedBy:
                "mgarcia",

            date:
                "2026-08-31",

            time:
                "14:22:08",

            reason:
                "Temporary elevated access request",

            status:
                "REVIEW REQUIRED"
        },


        {
            id: "IAM-002",

            user: "mgarcia",

            previousPrivilege:
                "STANDARD-USER",

            newPrivilege:
                "ADMINISTRATOR",

            changedBy:
                "admin",

            date:
                "2026-07-14",

            time:
                "09:41:17",

            reason:
                "IT Administrator role assignment",

            status:
                "APPROVED"
        },


        {
            id: "IAM-003",

            user: "admin",

            previousPrivilege:
                "ADMINISTRATOR",

            newPrivilege:
                "DOMAIN-ADMIN",

            changedBy:
                "SYSTEM",

            date:
                "2026-06-02",

            time:
                "03:14:52",

            reason:
                "Domain administrator provisioning",

            status:
                "APPROVED"
        }

    ],


    /* =====================================================
       ACCOUNT REVIEW METADATA
       ---------------------------------------------------
       Keyed by REAL usernames from data/users.js. Not every
       one of the 14 has an entry — see note above.
       ===================================================== */

    accountMetadata: {

        admin: {

            accountType:
                "USER",

            dormant:
                false,

            serviceAccount:
                false,

            interactiveLogin:
                true,

            lastAccessReview:
                "2026-08-31",

            risk:
                "HIGH",

            reviewStatus:
                "REVIEW REQUIRED"

        },


        afischer: {

            accountType:
                "USER",

            dormant:
                false,

            serviceAccount:
                false,

            interactiveLogin:
                true,

            lastAccessReview:
                "2026-08-31",

            risk:
                "HIGH",

            reviewStatus:
                "REVIEW REQUIRED"

        },


        mgarcia: {

            accountType:
                "USER",

            dormant:
                false,

            serviceAccount:
                false,

            interactiveLogin:
                true,

            lastAccessReview:
                "2026-07-14",

            risk:
                "MEDIUM",

            reviewStatus:
                "CURRENT"

        },


        bthompson: {

            accountType:
                "USER",

            dormant:
                true,

            serviceAccount:
                false,

            interactiveLogin:
                false,

            lastAccessReview:
                "2026-04-11",

            risk:
                "MEDIUM",

            reviewStatus:
                "DORMANT"

        }

    },


    /* =====================================================
       ROLE DEFINITIONS
       ---------------------------------------------------
       Matches the actual privilege string vocabulary used
       in data/users.js (uppercased for comparison, same as
       IAMApp.js's own normalizePrivileges()) — not a
       disconnected made-up vocabulary.
       ===================================================== */

    roleDefinitions: {

        "STANDARD-USER": {

            label:
                "STANDARD USER",

            level:
                1,

            description:
                "Normal workstation and business application access."

        },


        ADMINISTRATOR: {

            label:
                "ADMINISTRATOR",

            level:
                3,

            description:
                "Administrative access to selected systems."

        },


        "DOMAIN-ADMIN": {

            label:
                "DOMAIN ADMIN",

            level:
                4,

            description:
                "Domain-wide administrative privileges."

        }

    }

};


/* =========================================================
   IAM HELPER API
   ========================================================= */

window.NorthstarIAM = {

    getData() {

        return window.NorthstarIAMData;

    },


    getMetadata(username) {

        return (
            window.NorthstarIAMData
                .accountMetadata?.[
            username
            ] || {

                accountType:
                    "USER",

                dormant:
                    false,

                serviceAccount:
                    false,

                interactiveLogin:
                    false,

                lastAccessReview:
                    "UNKNOWN",

                risk:
                    "UNKNOWN",

                reviewStatus:
                    "NO REVIEW DATA"

            }
        );

    },


    getPrivilegeChanges() {

        return [
            ...(
                window.NorthstarIAMData
                    .privilegeChanges || []
            )
        ];

    },


    getRoleDefinition(role) {

        return (
            window.NorthstarIAMData
                .roleDefinitions?.[
            String(role)
                .toUpperCase()
            ] || null
        );

    }

};