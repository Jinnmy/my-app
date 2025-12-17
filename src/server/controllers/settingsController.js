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
