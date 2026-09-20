/* =========================================================
   NORTHSTAR SOC — IDENTITY & ACCESS MANAGEMENT
   File: iam/IAMApp.js

   IAM answers:

       WHO HAS ACCESS?
       WHAT DO THEY HAVE ACCESS TO?
       DID THEIR ACCESS CHANGE?

   It intentionally does not function as an activity monitor.
   ========================================================= */


/* =========================================================
   PERSISTED STATE
   ---------------------------------------------------------
   IAM has no backing store the way VPN/Endpoints/Playbook do
   — it's a self-contained initializeIAM(container) closure.
   These two values live here, at module scope, purely so
   closing and reopening the IAM window doesn't silently
   reset the active filter tab and drop the identity an
   analyst had selected. Everything else (the roster, the
   rendered rows) is cheap to rebuild fresh on every open.
   ========================================================= */

let persistedFilter = "ALL";
let persistedSelectedUsername = null;


export function initializeIAM(container) {

    if (!container) {

        console.error(
            "[IAM] Container not found."
        );

        return;
    }


    /* =====================================================
       STATE
       ===================================================== */

    let users = [];

    let currentFilter =
        persistedFilter;

    let selectedUser =
        null;


    /* =====================================================
       LOAD EXISTING USER ROSTER
       ===================================================== */

    function loadUsers() {

        /*
         * Support several possible names so IAM can work
         * with the existing users.js without forcing a
         * rewrite of that file.
         */

        const possibleSources = [

            window.NorthstarUsers,

            window.northstarUsers,

            window.USERS,

            window.users

        ];


        for (
            const source of possibleSources
        ) {

            if (
                Array.isArray(source)
            ) {

                users =
                    source;

                return;

            }

        }


        /*
         * Some NORTHSTAR data modules may expose an object
         * containing the users array.
         */

        for (
            const source of possibleSources
        ) {

            if (
                source &&
                Array.isArray(
                    source.users
                )
            ) {

                users =
                    source.users;

                return;

            }

        }


        console.warn(
            "[IAM] Existing users.js roster was not found. IAM will display an empty roster."
        );

        users = [];

    }


    loadUsers();


    /* =====================================================
       RENDER
       ===================================================== */

    container.innerHTML = `

        <div class="iam-app">

            <!-- =============================================
                 HEADER
            ============================================== -->

            <header class="iam-header">

                <div class="iam-brand">

                    <div class="iam-brand-mark">
                        IAM
                    </div>

                    <div>

                        <div class="iam-title">
                            IDENTITY & ACCESS MANAGEMENT
                        </div>

                        <div class="iam-subtitle">
                            NORTHSTAR SECURITY OPERATIONS CENTER
                        </div>

                    </div>

                </div>


                <div class="iam-header-status">

                    <span class="iam-status-dot"></span>

                    ACCESS CONTROL SERVICE ONLINE

                </div>

            </header>


            <!-- =============================================
                 SUMMARY
            ============================================== -->

            <section class="iam-summary">

                <div class="iam-summary-card">

                    <span>
                        TOTAL IDENTITIES
                    </span>

                    <strong
                        data-iam-total
                    >
                        0
                    </strong>

                </div>


                <div class="iam-summary-card">

                    <span>
                        PRIVILEGED
                    </span>

                    <strong
                        data-iam-privileged
                    >
                        0
                    </strong>

                </div>


                <div class="iam-summary-card">

                    <span>
                        DORMANT
                    </span>

                    <strong
                        data-iam-dormant
                    >
                        0
                    </strong>

                </div>


                <div class="iam-summary-card">

                    <span>
                        SERVICE ACCOUNTS
                    </span>

                    <strong
                        data-iam-service
                    >
                        0
                    </strong>

                </div>


                <div class="iam-summary-card">

                    <span>
                        ACCESS REVIEWS
                    </span>

                    <strong
                        data-iam-reviews
                    >
                        0
                    </strong>

                </div>

            </section>


            <!-- =============================================
                 MAIN
            ============================================== -->

            <main class="iam-main">


                <!-- =========================================
                     USER TABLE
                ========================================== -->

                <section class="iam-users-panel">

                    <div class="iam-panel-header">

                        <div>

                            <div class="iam-section-label">
                                ACCESS REVIEW
                            </div>

                            <div class="iam-panel-description">
                                Review who has privileges and
                                identify unexpected access.
                            </div>

                        </div>


                        <div class="iam-filter-group">

                            <button
                                class="iam-filter iam-filter-active"
                                data-iam-filter="ALL"
                                type="button"
                            >
                                ALL
                            </button>

                            <button
                                class="iam-filter"
                                data-iam-filter="PRIVILEGED"
                                type="button"
                            >
                                PRIVILEGED
                            </button>

                            <button
                                class="iam-filter"
                                data-iam-filter="DORMANT"
                                type="button"
                            >
                                DORMANT
                            </button>

                            <button
                                class="iam-filter"
                                data-iam-filter="SERVICE"
                                type="button"
                            >
                                SERVICE
                            </button>

                        </div>

                    </div>


                    <div class="iam-table-wrap">

                        <table class="iam-table">

                            <thead>

                                <tr>

                                    <th>
                                        IDENTITY
                                    </th>

                                    <th>
                                        TYPE
                                    </th>

                                    <th>
                                        PRIVILEGE
                                    </th>

                                    <th>
                                        STATUS
                                    </th>

                                    <th>
                                        RISK
                                    </th>

                                    <th>
                                        REVIEW
                                    </th>

                                </tr>

                            </thead>


                            <tbody
                                data-iam-users
                            ></tbody>

                        </table>


                        <div
                            class="iam-table-empty"
                            data-iam-table-empty
                        >
                            NO IDENTITIES MATCH THE CURRENT FILTER.
                        </div>

                    </div>

                </section>


                <!-- =========================================
                     SIDEBAR
                ========================================== -->

                <aside class="iam-sidebar">


                    <!-- =====================================
                         SELECTED ACCOUNT
                    ====================================== -->

                    <div class="iam-side-card iam-selected-card">

                        <div class="iam-side-heading">
                            SELECTED IDENTITY
                        </div>


                        <div
                            class="iam-selected-empty"
                            data-iam-selected-empty
                        >

                            Select an identity from the
                            access review table.

                        </div>


                        <div
                            class="iam-selected-content"
                            data-iam-selected
                        >

                            <div
                                class="iam-selected-name"
                                data-iam-selected-name
                            >
                                —
                            </div>


                            <div
                                class="iam-selected-role"
                                data-iam-selected-username
                            >
                                —
                            </div>


                            <div
                                class="iam-selected-role"
                                data-iam-selected-role
                            >
                                —
                            </div>


                            <div class="iam-account-grid">


                                <div>

                                    <span>
                                        ACCOUNT TYPE
                                    </span>

                                    <strong
                                        data-iam-selected-type
                                    >
                                        —
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        RISK
                                    </span>

                                    <strong
                                        data-iam-selected-risk
                                    >
                                        —
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        INTERACTIVE
                                    </span>

                                    <strong
                                        data-iam-selected-interactive
                                    >
                                        —
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        REVIEW
                                    </span>

                                    <strong
                                        data-iam-selected-review
                                    >
                                        —
                                    </strong>

                                </div>

                            </div>


                            <div class="iam-access-block">

                                <div class="iam-detail-heading">
                                    PRIVILEGES
                                </div>

                                <div
                                    class="iam-privilege-list"
                                    data-iam-selected-privileges
                                ></div>

                            </div>


                            <div class="iam-access-block">

                                <div class="iam-detail-heading">
                                    LAST ACCESS REVIEW
                                </div>

                                <div
                                    class="iam-review-date"
                                    data-iam-selected-date
                                >
                                    —
                                </div>

                            </div>


                            <div
                                class="iam-access-block iam-live-status"
                                data-iam-live-status
                                style="display: none;"
                            >

                                <div class="iam-detail-heading">
                                    LIVE STATUS
                                </div>

                                <div
                                    class="iam-live-status-text"
                                    data-iam-live-status-text
                                >
                                </div>

                            </div>

                        </div>

                    </div>


                    <!-- =====================================
                         PRIVILEGE CHANGES
                    ====================================== -->

                    <div class="iam-side-card iam-change-card">

                        <div class="iam-side-heading">
                            PRIVILEGE CHANGES
                        </div>


                        <div
                            class="iam-change-list"
                            data-iam-changes
                        ></div>

                    </div>


                    <!-- =====================================
                         REVIEW SIGNALS
                    ====================================== -->

                    <div class="iam-side-card">

                        <div class="iam-side-heading">
                            REVIEW SIGNALS
                        </div>


                        <div class="iam-signal">

                            <span class="iam-signal-number">
                                01
                            </span>

                            <div>

                                <strong>
                                    PRIVILEGE ESCALATION
                                </strong>

                                <small>
                                    Access increased beyond
                                    the previous role.
                                </small>

                            </div>

                        </div>


                        <div class="iam-signal">

                            <span class="iam-signal-number">
                                02
                            </span>

                            <div>

                                <strong>
                                    DORMANT ACCOUNT
                                </strong>

                                <small>
                                    Identity retains access
                                    despite inactivity.
                                </small>

                            </div>

                        </div>


                        <div class="iam-signal">

                            <span class="iam-signal-number">
                                03
                            </span>

                            <div>

                                <strong>
                                    SERVICE ACCOUNT
                                </strong>

                                <small>
                                    Non-human identity with
                                    elevated permissions.
                                </small>

                            </div>

                        </div>

                    </div>

                </aside>

            </main>


            <!-- =============================================
                 FOOTER
            ============================================== -->

            <footer class="iam-footer">

                <span>
                    NORTHSTAR SOC
                </span>

                <span>
                    ACCESS GOVERNANCE
                </span>

                <span>
                    SIMULATED ENVIRONMENT
                </span>

            </footer>

        </div>
    `;


    /* =====================================================
       ELEMENTS
       ===================================================== */

    const userTable =
        container.querySelector(
            "[data-iam-users]"
        );


    const emptyTable =
        container.querySelector(
            "[data-iam-table-empty]"
        );


    const selectedEmpty =
        container.querySelector(
            "[data-iam-selected-empty]"
        );


    const selectedContent =
        container.querySelector(
            "[data-iam-selected]"
        );


    /* =====================================================
       NORMALIZE USER
       ===================================================== */

    function normalizeUser(
        user
    ) {

        if (!user) {
            return null;
        }


        /*
         * Support common NORTHSTAR roster property names.
         */

        const username =
            user.username ??
            user.user ??
            user.name ??
            user.id ??
            "UNKNOWN";


        const privileges =
            user.privileges ??
            user.privilege ??
            user.role ??
            "STANDARD";


        /*
         * IAM is meant to answer "who is this account" — it
         * previously only ever showed the username, everywhere,
         * even though the roster (data/users.js) already carries
         * a real display name. Endpoints already surfaces this;
         * IAM should too, since it's the more natural place a
         * player would look up an identity.
         */
        const displayName =
            user.displayName ??
            null;


        return {

            raw:
                user,

            username:
                String(username),

            displayName:
                displayName
                    ? String(displayName)
                    : null,

            privileges:
                normalizePrivileges(
                    privileges
                )

        };

    }


    function normalizePrivileges(
        privileges
    ) {

        if (
            Array.isArray(
                privileges
            )
        ) {

            return privileges
                .map(
                    value =>
                        String(
                            value
                        )
                            .trim()
                            .toUpperCase()
                );

        }


        return [

            String(
                privileges
            )
                .trim()
                .toUpperCase()

        ];

    }


    /* =====================================================
       ACCOUNT METADATA
       ===================================================== */

    function getMetadata(
        username
    ) {

        return window.NorthstarIAM
            ?.getMetadata(
                username
            ) || {

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

        };

    }


    /* =====================================================
       PRIVILEGE CLASSIFICATION
       ===================================================== */

    function getPrivilegeLevel(
        privileges
    ) {

        let level = 0;


        privileges.forEach(
            privilege => {

                const value =
                    String(
                        privilege
                    )
                        .toUpperCase();


                if (
                    value.includes(
                        "ADMIN"
                    )
                ) {

                    level =
                        Math.max(
                            level,
                            4
                        );

                } else if (
                    value.includes(
                        "ELEVATED"
                    )
                ) {

                    level =
                        Math.max(
                            level,
                            3
                        );

                } else if (
                    value.includes(
                        "SECURITY"
                    ) ||
                    value.includes(
                        "ANALYST"
                    )
                ) {

                    level =
                        Math.max(
                            level,
                            2
                        );

                } else {

                    level =
                        Math.max(
                            level,
                            1
                        );

                }

            }
        );


        return level;

    }


    function isPrivileged(
        user
    ) {

        return (
            getPrivilegeLevel(
                user.privileges
            ) >= 3
        );

    }


    /* =====================================================
       FILTERING
       ===================================================== */

    function getFilteredUsers() {

        const normalized =
            users
                .map(
                    normalizeUser
                )
                .filter(
                    Boolean
                );


        if (
            currentFilter === "ALL"
        ) {

            return normalized;

        }


        return normalized.filter(
            user => {

                const metadata =
                    getMetadata(
                        user.username
                    );


                if (
                    currentFilter ===
                    "PRIVILEGED"
                ) {

                    return isPrivileged(
                        user
                    );

                }


                if (
                    currentFilter ===
                    "DORMANT"
                ) {

                    return metadata.dormant;

                }


                if (
                    currentFilter ===
                    "SERVICE"
                ) {

                    return (
                        metadata.serviceAccount
                    );

                }


                return true;

            }
        );

    }


    /* =====================================================
       RENDER USERS
       ===================================================== */

    function renderUsers() {

        const filtered =
            getFilteredUsers();


        userTable.innerHTML =
            "";


        emptyTable.style.display =
            filtered.length
                ? "none"
                : "flex";


        filtered.forEach(
            user => {

                const metadata =
                    getMetadata(
                        user.username
                    );


                const row =
                    document.createElement(
                        "tr"
                    );


                row.dataset.username =
                    user.username;


                const privilegeLabel =
                    user.privileges
                        .join(
                            ", "
                        );


                row.innerHTML = `

                    <td>

                        <div class="iam-user-cell">

                            <div class="iam-avatar">
                                ${escapeHTML(
                    user.username
                        .slice(
                            0,
                            2
                        )
                        .toUpperCase()
                )}
                            </div>

                            <div>

                                <strong>
                                    ${escapeHTML(
                    user.displayName ||
                    user.username
                )}
                                </strong>

                                <small>
                                    ${escapeHTML(
                    user.username
                )}
                                </small>

                            </div>

                        </div>

                    </td>


                    <td>

                        <span class="iam-type">
                            ${escapeHTML(
                    metadata.accountType
                )}
                        </span>

                    </td>


                    <td>

                        <div class="iam-privilege-cell">

                            ${user.privileges
                        .map(
                            privilege =>
                                `
                                        <span
                                            class="iam-privilege ${getPrivilegeClass(privilege)}"
                                        >
                                            ${escapeHTML(privilege)}
                                        </span>
                                        `
                        )
                        .join("")}

                        </div>

                    </td>


                    <td>

                        <span
                            class="iam-account-status ${getStatusClass(metadata)}"
                        >
                            ${getStatusLabel(metadata)}
                        </span>

                    </td>


                    <td>

                        <span
                            class="iam-risk ${getRiskClass(metadata.risk)}"
                        >
                            ${escapeHTML(
                            metadata.risk
                        )}
                        </span>

                    </td>


                    <td>

                        <span class="iam-review-status">
                            ${escapeHTML(
                            metadata.reviewStatus
                        )}
                        </span>

                    </td>

                `;


                row.addEventListener(
                    "click",
                    () => {

                        selectUser(
                            user
                        );

                    }
                );


                userTable.appendChild(
                    row
                );

            }
        );

    }


    /* =====================================================
       SELECT USER
       ===================================================== */

    function selectUser(
        user
    ) {

        selectedUser =
            user;

        persistedSelectedUsername =
            user.username;


        const metadata =
            getMetadata(
                user.username
            );


        selectedEmpty.style.display =
            "none";


        selectedContent.style.display =
            "block";


        setText(
            "[data-iam-selected-name]",
            user.displayName ||
            user.username
        );


        setText(
            "[data-iam-selected-username]",
            `@${user.username}`
        );


        setText(
            "[data-iam-selected-role]",
            user.privileges.join(
                " / "
            )
        );


        setText(
            "[data-iam-selected-type]",
            metadata.accountType
        );


        setText(
            "[data-iam-selected-risk]",
            metadata.risk
        );


        setText(
            "[data-iam-selected-interactive]",
            metadata.interactiveLogin
                ? "YES"
                : "NO"
        );


        setText(
            "[data-iam-selected-review]",
            metadata.reviewStatus
        );


        setText(
            "[data-iam-selected-date]",
            metadata.lastAccessReview
        );


        renderSelectedPrivileges(
            user
        );


        renderLiveStatus(
            user
        );


        container
            .querySelectorAll(
                ".iam-table tbody tr"
            )
            .forEach(
                row => {

                    row.classList.toggle(
                        "iam-row-selected",
                        row.dataset.username ===
                        user.username
                    );

                }
            );

    }


    function renderSelectedPrivileges(
        user
    ) {

        const element =
            container.querySelector(
                "[data-iam-selected-privileges]"
            );


        element.innerHTML =
            user.privileges
                .map(
                    privilege =>
                        `
                        <div class="iam-selected-privilege">

                            <span>
                                ${escapeHTML(
                            privilege
                        )}
                            </span>

                            <small>
                                ACCESS LEVEL
                            </small>

                        </div>
                        `
                )
                .join("");

    }


    /* =====================================================
       LIVE COMPROMISE STATUS — DISABLED, PERMANENTLY HIDDEN
       ---------------------------------------------------
       This used to reveal whether a user's assigned host was
       actually compromised, gated on the analyst having
       isolated that host first. That gate doesn't hold up:
       isolating a host in Endpoints costs no time and no
       limited resource — an analyst can isolate all 14 hosts
       in a few clicks — and EndpointStore.isolateHost() is
       explicit that isolating is scored SILENTLY on purpose:
       "no live feedback, no confirmation dialog... they find
       out whether they were right at the end of the session,
       not in the moment." Showing that same right/wrong
       answer here, live, the instant a host got isolated,
       would let an analyst mass-isolate everyone and then
       click through IAM for an instant answer key — exactly
       the shortcut Endpoints' own design was built to close
       off. Re-gating this on some other action would have
       the same problem as long as isolation itself stays
       free and unlimited, so the feature is removed rather
       than re-gated: IAM never shows live compromise status,
       full stop. (IAM's own header comment already says as
       much: "It intentionally does not function as an
       activity monitor.") The score feedback that already
       exists in EndpointStore.js for each isolation is the
       correct place for that answer to live — surfaced at
       the end of the session, not here.
       ===================================================== */

    function renderLiveStatus(
        user
    ) {

        const block =
            container.querySelector(
                "[data-iam-live-status]"
            );

        if (block) {

            block.style.display =
                "none";

        }

    }


    /* =====================================================
       PRIVILEGE CHANGE LIST
       ===================================================== */

    function renderChanges() {

        const element =
            container.querySelector(
                "[data-iam-changes]"
            );


        const changes =
            window.NorthstarIAM
                ?.getPrivilegeChanges()
            || [];


        if (
            changes.length === 0
        ) {

            element.innerHTML = `
                <div class="iam-change-empty">
                    NO RECENT PRIVILEGE CHANGES.
                </div>
            `;

            return;

        }


        element.innerHTML =
            changes
                .map(
                    change =>
                        `

                        <button
                            class="iam-change"
                            data-iam-change-user="${escapeHTML(change.user)}"
                            type="button"
                        >

                            <div class="iam-change-top">

                                <strong>
                                    ${escapeHTML(
                            change.user
                        )}
                                </strong>

                                <span
                                    class="${change.status === "APPROVED"
                            ? "iam-approved"
                            : "iam-review-required"}"
                                >
                                    ${escapeHTML(
                                change.status
                            )}
                                </span>

                            </div>


                            <div class="iam-change-transition">

                                <span>
                                    ${escapeHTML(
                                change.previousPrivilege
                            )}
                                </span>

                                <b>
                                    →
                                </b>

                                <span>
                                    ${escapeHTML(
                                change.newPrivilege
                            )}
                                </span>

                            </div>


                            <small>
                                ${escapeHTML(
                                change.date
                            )}
                                ${escapeHTML(
                                change.time
                            )}
                            </small>

                        </button>

                        `
                )
                .join("");


        element
            .querySelectorAll(
                "[data-iam-change-user]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const username =
                                button.dataset
                                    .iamChangeUser;


                            const user =
                                users
                                    .map(
                                        normalizeUser
                                    )
                                    .find(
                                        item =>
                                            item?.username ===
                                            username
                                    );


                            if (user) {

                                selectUser(
                                    user
                                );

                            }

                        }
                    );

                }
            );

    }


    /* =====================================================
       SUMMARY
       ===================================================== */

    function renderSummary() {

        const normalized =
            users
                .map(
                    normalizeUser
                )
                .filter(
                    Boolean
                );


        const privileged =
            normalized.filter(
                isPrivileged
            );


        const dormant =
            normalized.filter(
                user =>
                    getMetadata(
                        user.username
                    ).dormant
            );


        const service =
            normalized.filter(
                user =>
                    getMetadata(
                        user.username
                    ).serviceAccount
            );


        const reviews =
            (
                window.NorthstarIAM
                    ?.getPrivilegeChanges()
                || []
            ).length;


        setText(
            "[data-iam-total]",
            normalized.length
        );


        setText(
            "[data-iam-privileged]",
            privileged.length
        );


        setText(
            "[data-iam-dormant]",
            dormant.length
        );


        setText(
            "[data-iam-service]",
            service.length
        );


        setText(
            "[data-iam-reviews]",
            reviews
        );

    }


    /* =====================================================
       FILTER BUTTONS
       ===================================================== */

    container
        .querySelectorAll(
            "[data-iam-filter]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        currentFilter =
                            button.dataset
                                .iamFilter;

                        persistedFilter =
                            currentFilter;


                        container
                            .querySelectorAll(
                                "[data-iam-filter]"
                            )
                            .forEach(
                                item => {

                                    item.classList.toggle(
                                        "iam-filter-active",
                                        item ===
                                        button
                                    );

                                }
                            );


                        renderUsers();

                    }
                );

            }
        );


    /* =====================================================
       HELPERS
       ===================================================== */

    function setText(
        selector,
        value
    ) {

        const element =
            container.querySelector(
                selector
            );


        if (element) {

            element.textContent =
                value ?? "—";

        }

    }


    function getPrivilegeClass(
        privilege
    ) {

        const value =
            String(
                privilege
            )
                .toUpperCase();


        if (
            value.includes(
                "ADMIN"
            )
        ) {

            return "iam-privilege-admin";

        }


        if (
            value.includes(
                "ELEVATED"
            )
        ) {

            return "iam-privilege-elevated";

        }


        if (
            value.includes(
                "SECURITY"
            ) ||
            value.includes(
                "ANALYST"
            )
        ) {

            return "iam-privilege-analyst";

        }


        return "iam-privilege-standard";

    }


    function getStatusLabel(
        metadata
    ) {

        if (
            metadata.dormant
        ) {

            return "DORMANT";

        }


        if (
            metadata.serviceAccount
        ) {

            return "SERVICE";

        }


        return "ACTIVE";

    }


    function getStatusClass(
        metadata
    ) {

        if (
            metadata.dormant
        ) {

            return "iam-status-dormant";

        }


        if (
            metadata.serviceAccount
        ) {

            return "iam-status-service";

        }


        return "iam-status-active";

    }


    function getRiskClass(
        risk
    ) {

        switch (
        String(
            risk
        )
            .toUpperCase()
        ) {

            case "HIGH":
                return "iam-risk-high";

            case "MEDIUM":
                return "iam-risk-medium";

            case "LOW":
                return "iam-risk-low";

            default:
                return "iam-risk-unknown";

        }

    }


    function escapeHTML(
        value
    ) {

        return String(
            value ?? ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );

    }


    /* =====================================================
       INITIAL RENDER
       ===================================================== */

    selectedContent.style.display =
        "none";


    renderSummary();

    renderUsers();

    renderChanges();


    /*
     * RESTORE PERSISTED STATE
     * -----------------------------------------------
     * Re-apply the filter tab that was active last time
     * this window was open (the initial HTML template
     * always marks "ALL" active by default), and, if the
     * analyst had an identity selected, re-select it now
     * that the roster/table have been rebuilt.
     */

    container
        .querySelectorAll(
            "[data-iam-filter]"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "iam-filter-active",
                    button.dataset.iamFilter ===
                    currentFilter
                );

            }
        );


    if (persistedSelectedUsername) {

        const restoredUser =
            users
                .map(
                    normalizeUser
                )
                .find(
                    item =>
                        item?.username ===
                        persistedSelectedUsername
                );

        if (restoredUser) {

            selectUser(
                restoredUser
            );

        } else {

            persistedSelectedUsername =
                null;

        }

    }


    console.log(
        "%c[IAM] Identity & Access Management initialized.",
        "color:#79a9e8;"
    );

}


/* =========================================================
   NORTHSTAR WINDOW MANAGER ACCESS
   ========================================================= */

window.initializeIAM =
    initializeIAM;