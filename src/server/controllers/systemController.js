const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
let electronApp = null;

const setElectronApp = (app) => {
    electronApp = app;
};

const systemController = {
    getDisks: (req, res) => {
        const platform = os.platform();
        if (platform === 'win32') {
            exec('wmic logicaldisk get deviceid, volumename, size, freespace', (err, stdout, stderr) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                const lines = stdout.trim().split('\n').slice(1);
                const disks = lines.map(line => {
                    const parts = line.trim().split(/\s{2,}/);
                    if (parts.length >= 4) {
                        return {
                            device: parts[0],
                            freeSpace: parseInt(parts[1]),
                            size: parseInt(parts[2]),
                            name: parts[3]
                        };
                    } else if (parts.length === 3) {
                        // Sometimes VolumeName is empty
                        return {
                            device: parts[0],
                            freeSpace: parseInt(parts[1]),
                            size: parseInt(parts[2]),
                            name: 'Local Disk'
                        };
                    }
                    return null;
                }).filter(d => d);

                res.json(disks);
            });
        } else {
            // Mock for non-windows or implement df -h
            res.json([
                { device: '/dev/sda1', size: 100000000000, freeSpace: 50000000000, name: 'Main Disk' }
            ]);
        }
    },

    setStartup: (req, res) => {
        const { enable } = req.body;

        if (electronApp) {
            try {
                electronApp.setLoginItemSettings({
                    openAtLogin: enable,
                    path: process.execPath
                });
                res.json({ success: true, message: `Startup set to ${enable}` });
            } catch (error) {
                res.status(500).json({ error: 'Failed to set startup settings: ' + error.message });
            }
        } else {
            res.status(503).json({ error: 'Electron app instance not available' });
        }
    },

    saveStorageConfig: (req, res) => {
        const config = req.body;
        const configPath = path.join(__dirname, '../config/storage.json');

        fs.writeFile(configPath, JSON.stringify(config, null, 2), (err) => {
            if (err) {
                console.error('Error saving config:', err);
                return res.status(500).json({ error: 'Failed to save configuration' });
            }
            console.log('Storage Config Saved to:', configPath);
            res.json({ success: true, message: 'Storage configuration saved' });
        });
    }
};

module.exports = { systemController, setElectronApp };
