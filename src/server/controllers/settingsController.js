const fs = require('fs');
const path = require('path');

const { app } = require('electron'); // Will be defined if in main process, but might need adjustment if run via node.
// However, this controller is imported by server.js which is run by main.js, so 'electron' module might be available if we are careful.
// Actually, `startServer` in server.js receives the electronAppInstance. We might need a better way to get the path.
// OR, we can just use `require('electron').app` if we are sure we are in the electron context.
// Let's check `src/server/controllers/systemController.js` involves `setElectronApp`.
// But `settingsController.js` is just a module. `require('electron')` works in the main process.

// Let's look at how `main.js` does it: `app.getPath('userData')`.
// Let's look at how `settingsController.js` currently does it:
// `const settingsPath = path.join(__dirname, '../config/settings.json');`

// We need to change how `settingsPath` is defined.
let settingsPath;
try {
    const electron = require('electron');
    if (electron.app && electron.app.isPackaged) {
        settingsPath = path.join(electron.app.getPath('userData'), 'settings.json');
    } else {
        settingsPath = path.join(__dirname, '../config/settings.json');
    }
} catch (e) {
    // Fallback for dev mode/non-electron (e.g. strict node test)
    settingsPath = path.join(__dirname, '../config/settings.json');
}

// Helper to read settings
const readSettings = () => {
    try {
        if (!fs.existsSync(settingsPath)) {
            // Create default if missing
            // Ensure dir exists if using userData
            if (path.dirname(settingsPath) !== __dirname) {
                if (!fs.existsSync(path.dirname(settingsPath))) {
                    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
                }
            }

            const defaultSettings = { minimizeToTray: true };
            fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
            return defaultSettings;
        }
        const data = fs.readFileSync(settingsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading settings from', settingsPath, error);
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
const HW_MONITOR_DIR = path.join(__dirname, '../../../resources/hardware-monitor');
const SETUP_SCRIPT = path.join(__dirname, '../../../resources/setup_models.py');

exports.getAiStatus = (req, res) => {
    try {
        const settings = readSettings();

        // Check for key files
        const blipReady = fs.existsSync(path.join(BLIP_DIR, 'vision_model.onnx')) &&
            fs.existsSync(path.join(BLIP_DIR, 'text_decoder_model.onnx'));

        // Check for Flan (checking encoder as proxy)
        const flanReady = fs.existsSync(path.join(FLAN_DIR, 'encoder_model.onnx'));

        // Check for Health Model
        const healthReady = fs.existsSync(path.join(HW_MONITOR_DIR, 'health_model.onnx'));

        // Check for Python environment
        let pythonReady = true;
        if (require('electron').app.isPackaged) {
            pythonReady = fs.existsSync(path.join(process.resourcesPath, 'python_env/python.exe'));
        }

        res.json({
            ready: blipReady && flanReady && healthReady && pythonReady,
            blipReady,
            flanReady,
            healthReady,
            pythonReady,
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

    // Unified Resource Path Logic
    let resourcePath;
    if (require('electron').app.isPackaged) {
        resourcePath = process.resourcesPath;
    } else {
        resourcePath = path.join(__dirname, '../../../resources');
    }

    const ZIP_SOURCE = path.join(resourcePath, 'python_env.zip');

    // Check Status
    const pythonExec = path.join(resourcePath, 'python_env/python.exe');
    const isPythonMissing = !fs.existsSync(pythonExec);

    const runSetup = () => {
        try {
            console.log('Starting AI model setup...');

            // Use the bundled python if available, else system python (only in dev fallback)
            let pythonPath = 'python';
            if (fs.existsSync(pythonExec)) {
                pythonPath = pythonExec;
            } else if (require('electron').app.isPackaged) {
                // In packaged mode, we MUST have our python. System python is not guaranteed.
                return res.status(500).json({ error: 'Python extraction failed or file missing.' });
            }

            console.log('Using Python at:', pythonPath);

            downloadProcess = spawn(pythonPath, [SETUP_SCRIPT], {
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

            res.json({ message: 'AI Setup started' });
        } catch (error) {
            console.error('Failed to start setup:', error);
            res.status(500).json({ error: 'Failed to start setup' });
        }
    };

    if (isPythonMissing) {
        console.log('Python environment missing. Checking for bundled zip...');
        console.log('Looking for zip at:', ZIP_SOURCE);

        if (!fs.existsSync(ZIP_SOURCE)) {
            console.error('Bundled python_env.zip not found!');
            return res.status(500).json({ error: 'Bundled Python environment not found. Please reinstall (or if in dev, ensure python_env.zip is in resources).' });
        }

        console.log('Extracting bundled Python environment...');

        // Use native tar for speed (much faster than PowerShell Expand-Archive)
        // tar -xf source.zip -C destination
        const tarCommand = `tar -xf "${ZIP_SOURCE}" -C "${resourcePath}"`;

        const { exec } = require('child_process');

        downloadProcess = exec(tarCommand, (error, stdout, stderr) => {
            if (error) {
                console.error('Extraction Error:', stderr || error.message);
                downloadProcess = null;
                // Fallback to PowerShell if tar fails (though unlikely on Win10/11)
                return res.status(500).json({ error: 'Failed to extract Python environment using tar.' });
            }

            console.log('Extraction Complete:', stdout);
            downloadProcess = null;

            // Re-verify existence
            const pythonExecCheck = path.join(resourcePath, 'python_env/python.exe');
            if (fs.existsSync(pythonExecCheck)) {
                runSetup();
            } else {
                console.error('Extraction finished but python.exe still missing.');
                return res.status(500).json({ error: 'Extraction finished but Python executable checking failed.' });
            }
        });

    } else {
        // Python exists
        runSetup();
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

        // Remove Hardware Health Model Files
        if (fs.existsSync(HW_MONITOR_DIR)) {
            // Reordered to delete .pth and .data first, as .onnx might be locked by the runtime
            const filesToRemove = ['health_model.pth', 'health_model.onnx.data', 'health_model.onnx'];
            filesToRemove.forEach(file => {
                const filePath = path.join(HW_MONITOR_DIR, file);
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted: ${file}`);
                    }
                } catch (err) {
                    console.warn(`Failed to delete ${file}:`, err.message);
                }
            });
        }

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
