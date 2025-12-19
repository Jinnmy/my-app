const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '../config/settings.json');

// Helper to read settings
const readSettings = () => {
    try {
        if (!fs.existsSync(settingsPath)) {
            // Create default if missing
            const defaultSettings = { minimizeToTray: true };
            fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
            return defaultSettings;
        }
        const data = fs.readFileSync(settingsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading settings:', error);
        return { minimizeToTray: true }; // Fallback
    }
};

exports.getSettings = (req, res) => {
    try {
        const settings = readSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve settings' });
    }
};

exports.updateSettings = (req, res) => {
    try {
        const currentSettings = readSettings();
        const updates = req.body;

        const newSettings = { ...currentSettings, ...updates };

        fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2));

        res.json({ message: 'Settings updated successfully', settings: newSettings });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};

// AI Helper Functions
const BLIP_DIR = path.join(__dirname, '../../../resources/blip');
const FLAN_DIR = path.join(__dirname, '../../../resources/python/flan_t5_onnx');
const SETUP_SCRIPT = path.join(__dirname, '../../../resources/setup_models.py');

exports.getAiStatus = (req, res) => {
    try {
        const settings = readSettings();

        // Check for key files
        const blipReady = fs.existsSync(path.join(BLIP_DIR, 'vision_model.onnx')) &&
            fs.existsSync(path.join(BLIP_DIR, 'text_decoder_model.onnx'));

        // Check for Flan (checking encoder as proxy)
        const flanReady = fs.existsSync(path.join(FLAN_DIR, 'encoder_model.onnx'));

        res.json({
            ready: blipReady && flanReady,
            blipReady,
            flanReady,
            enabled: settings.aiEnabled || false
        });
    } catch (error) {
        console.error('Error checking AI status:', error);
        res.status(500).json({ error: 'Failed to check AI status' });
    }
};

const { spawn } = require('child_process');
let downloadProcess = null;

exports.downloadAiModels = (req, res) => {
    if (downloadProcess) {
        return res.json({ message: 'Download already in progress' });
    }

    try {
        console.log('Starting AI model download...');
        // We use spawn to run the python script
        downloadProcess = spawn('python', [SETUP_SCRIPT], {
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        downloadProcess.stdout.on('data', (data) => {
            console.log(`[AI Setup]: ${data}`);
        });

        downloadProcess.stderr.on('data', (data) => {
            console.error(`[AI Setup Error]: ${data}`);
        });

        downloadProcess.on('close', (code) => {
            console.log(`AI setup finished with code ${code}`);
            downloadProcess = null;
        });

        res.json({ message: 'Download started' });
    } catch (error) {
        console.error('Failed to start download:', error);
        res.status(500).json({ error: 'Failed to start download' });
    }
};

exports.offloadAiModels = (req, res) => {
    try {
        console.log('Offloading AI models...');

        // Helper to remove directory recursively
        const removeDir = (dirPath) => {
            if (fs.existsSync(dirPath)) {
                fs.rmSync(dirPath, { recursive: true, force: true });
            }
        };

        // Remove BLIP models ONLY (Keep bridge.py)
        if (fs.existsSync(BLIP_DIR)) {
            const files = fs.readdirSync(BLIP_DIR);
            files.forEach(file => {
                if (file.endsWith('.onnx') || file.endsWith('.onnx.data')) {
                    fs.unlinkSync(path.join(BLIP_DIR, file));
                }
            });
        }

        // Remove Flan models
        removeDir(FLAN_DIR);

        // Also disable AI in settings
        const settings = readSettings();
        if (settings.aiEnabled) {
            settings.aiEnabled = false;
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        }

        res.json({ message: 'AI models offloaded successfully', settings });
    } catch (error) {
        console.error('Failed to offload models:', error);
        res.status(500).json({ error: 'Failed to offload models' });
    }
};
