const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class TailscaleService {
    constructor() {
        this.dnsName = null;
    }

    async getStatus() {
        try {
            // Check if tailscale command exists first
            const isInstalled = await this.checkInstallation();
            if (!isInstalled) return { installed: false };

            const { stdout } = await execPromise('tailscale status --json');
            const status = JSON.parse(stdout);

            if (status.Self && status.Self.DNSName) {
                // DNSName usually ends with a dot, e.g., "machine.tailnet.ts.net."
                this.dnsName = status.Self.DNSName.replace(/\.$/, '');

                // Check Serve status
                let serveActive = false;
                try {
                    const { stdout: serveOutput } = await execPromise('tailscale serve status --json');
                    const serveStatus = JSON.parse(serveOutput);
                    // Check if there are any active TCP listeners or routes
                    if (serveStatus && (serveStatus.TCP || (serveStatus.Web && Object.keys(serveStatus.Web).length > 0))) {
                        serveActive = true;
                    }
                } catch (e) {
                    // Ignore errors, might not be configured
                }

                return { ...status, installed: true, serveActive };
            }
            return { installed: true, status: 'inactive', serveActive: false };
        } catch (error) {
            console.error('Tailscale error:', error.message);
            return { installed: false, error: error.message };
        }
    }

    async checkInstallation() {
        try {
            // Check if tailscale version command works
            await execPromise('tailscale version');
            return true;
        } catch (e) {
            return false;
        }
    }


    async startServe(port) {
        try {
            const status = await this.getStatus();
            if (!status || !status.installed) {
                console.log('Tailscale not installed or active, skipping Serve.');
                return null;
            }

            console.log(`Configuring Tailscale Serve for port ${port} (Background)...`);

            // 1. Configure Serve (Non-blocking)
            // Modern syntax: tailscale serve --bg <port>
            exec(`tailscale serve --bg --yes ${port}`, (err) => {
                if (err) console.warn('Tailscale Serve background setup error:', err.message);
                else {
                    console.log(`Tailscale Serve configured for port ${port}`);
                    // 2. Enable Funnel (Modern syntax: tailscale funnel --bg <port>)
                    exec(`tailscale funnel --bg --yes ${port}`, (funnelErr) => {
                        if (funnelErr) console.warn('Tailscale Funnel setup error:', funnelErr.message);
                        else console.log('Tailscale Funnel enabled.');
                    });
                }
            });

            const url = `https://${this.dnsName}`;
            console.log(`Potential Tailscale URL: ${url}`);
            return url;
        } catch (error) {
            console.error('Failed to initiate Tailscale Serve:', error.message);
            return null;
        }
    }

    async getTailscaleUrl() {
        if (!this.dnsName) {
            await this.getStatus();
        }
        return this.dnsName ? `https://${this.dnsName}` : null;
    }
}

module.exports = new TailscaleService();
