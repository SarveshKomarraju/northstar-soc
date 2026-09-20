export class SimulationState {

    constructor({ users, hosts, network }) {

        this.time = 0;

        this.running = false;

        this.phase = "INITIALIZING";

        this.users = structuredClone(users);
        this.hosts = structuredClone(hosts);
        this.network = structuredClone(network);

        this.events = [];
        this.alerts = [];

        this.activeAttacks = [];

        this.compromisedHosts = [];
        this.compromisedUsers = [];

        this.blockedIPs = [];
        this.blockedDomains = [];

        this.isolatedHosts = [];
        this.disabledAccounts = [];

        this.statistics = {
            totalEvents: 0,
            totalAlerts: 0,

            criticalAlerts: 0,
            highAlerts: 0,
            mediumAlerts: 0,
            lowAlerts: 0,

            detectedIncidents: 0,
            containedIncidents: 0,

            falsePositives: 0,

            hostsCompromised: 0,
            usersCompromised: 0
        };
    }


    addEvent(event) {

        this.events.push(event);

        this.statistics.totalEvents++;
    }


    addAlert(alert) {

        this.alerts.push(alert);

        this.statistics.totalAlerts++;

        switch (alert.severity) {

            case "CRITICAL":
                this.statistics.criticalAlerts++;
                break;

            case "HIGH":
                this.statistics.highAlerts++;
                break;

            case "MEDIUM":
                this.statistics.mediumAlerts++;
                break;

            case "LOW":
                this.statistics.lowAlerts++;
                break;
        }
    }


    getUser(username) {

        return this.users.find(
            user => user.username === username
        );
    }


    getHost(hostname) {

        return this.hosts.find(
            host => host.hostname === hostname
        );
    }


    compromiseUser(username) {

        const user = this.getUser(username);

        if (!user) return false;

        if (!user.compromised) {

            user.compromised = true;

            this.compromisedUsers.push(username);

            this.statistics.usersCompromised++;
        }

        return true;
    }


    compromiseHost(hostname) {

        const host = this.getHost(hostname);

        if (!host) return false;

        if (!host.compromised) {

            host.compromised = true;

            this.compromisedHosts.push(hostname);

            this.statistics.hostsCompromised++;
        }

        return true;
    }


    disableAccount(username) {

        const user = this.getUser(username);

        if (!user) return false;

        user.accountStatus = "disabled";

        if (!this.disabledAccounts.includes(username)) {
            this.disabledAccounts.push(username);
        }

        return true;
    }


    isolateHost(hostname) {

        const host = this.getHost(hostname);

        if (!host) return false;

        host.isolated = true;
        host.status = "isolated";

        if (!this.isolatedHosts.includes(hostname)) {
            this.isolatedHosts.push(hostname);
        }

        return true;
    }


    blockIP(ip) {

        if (!this.blockedIPs.includes(ip)) {
            this.blockedIPs.push(ip);
        }

        if (!this.network.firewall.blockedIPs.includes(ip)) {
            this.network.firewall.blockedIPs.push(ip);
        }
    }


    blockDomain(domain) {

        if (!this.blockedDomains.includes(domain)) {
            this.blockedDomains.push(domain);
        }

        if (!this.network.firewall.blockedDomains.includes(domain)) {
            this.network.firewall.blockedDomains.push(domain);
        }
    }
}