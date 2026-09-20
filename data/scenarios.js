export const SCENARIOS = {

    phishingCredentialCompromise: {

        id: "scenario-001",

        name: "Operation Nightfall",

        description:
            "A threat actor is attempting to gain access to the Northstar corporate network through a targeted phishing campaign.",

        difficulty: "Beginner",

        objectives: [
            "Detect the phishing campaign",
            "Identify the affected user",
            "Determine whether the account was compromised",
            "Contain the incident"
        ],

        attacker: {
            name: "NIGHTFALL",

            objective:
                "Gain initial access to the corporate network",

            source: {
                ip: "185.203.117.42",
                country: "Germany",
                city: "Frankfurt"
            }
        }
    },

    ransomwareCampaign: {

        id: "scenario-002",

        name: "Operation Blackfrost",

        description:
            "A ransomware actor has gained a foothold on an engineering workstation and is moving toward file encryption, a ransom note, and command-and-control communication.",

        difficulty: "Intermediate",

        objectives: [
            "Identify the compromised endpoint and malicious process",
            "Determine the attack timeline and C2 infrastructure",
            "Contain the incident — isolate the host, terminate the process, block C2",
            "Eradicate the malware and validate a clean backup",
            "Recover affected files and return the host to service"
        ],

        attacker: {
            /*
             * BLACKFROST is documented here as the ransomware
             * family/operation name; the actor behind it is the
             * same RED RAVEN roster entry ransomware/data/
             * ransomwareConfig.js reuses from engine/AttackEngine.js
             * (ATTACKERS) — kept in sync here rather than inventing
             * a second, disconnected identity for this actor.
             */
            name: "BLACKFROST (RED RAVEN)",

            objective:
                "Encrypt files on the corporate network and extort payment for their recovery",

            source: {
                ip: "91.214.124.31",
                country: "Romania",
                city: "Bucharest"
            }
        }
    }
};