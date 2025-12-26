const UserModel = require('../models/userModel');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

class VaultController {
    // Enable Vault
    static enableVault(req, res) {
        const { password } = req.body;
        const userId = req.user.id;

        if (!password || password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters long' });
        }

        UserModel.findById(userId, (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (user.vault_enabled) return res.status(400).json({ error: 'Vault is already enabled' });

            // Generate Salt and Hash
            const salt = crypto.randomBytes(16).toString('hex');
            // Use PBKDF2 for security
            crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
                if (err) return res.status(500).json({ error: 'Encryption error' });

                const hash = derivedKey.toString('hex');

                UserModel.updateVaultSettings(userId, 1, hash, salt, (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Vault enabled successfully' });
                });
            });
        });
    }

    // Verify Password (Unlock)
    static verifyPassword(req, res) {
        const { password } = req.body;
        const userId = req.user.id;

        UserModel.getVaultSettings(userId, (err, settings) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!settings || !settings.vault_enabled) {
                return res.status(400).json({ error: 'Vault is not enabled' });
            }

            const { vault_password_hash, vault_salt } = settings;

            crypto.pbkdf2(password, vault_salt, 100000, 64, 'sha512', (err, derivedKey) => {
                if (err) return res.status(500).json({ error: 'Processing error' });

                const hash = derivedKey.toString('hex');
                if (hash === vault_password_hash) {
                    // Password Correct.
                    // Generate a "Vault Key" that the client will store in session.
                    // Ideally, we derive this from the password + a fixed salt or something consistent, 
                    // so it CAN decrypt files.
                    // For now, let's use the first 32 bytes of the hash as the AES key.
                    const vaultKey = derivedKey.slice(0, 32).toString('hex');

                    res.json({ success: true, vaultKey });
                } else {
                    res.status(401).json({ error: 'Incorrect password' });
                }
            });
        });
    }

    // Disable Vault (Only if empty? Or delete everything?)
    static disableVault(req, res) {
        // Require password confirmation
        const { password } = req.body;
        const userId = req.user.id;

        UserModel.getVaultSettings(userId, (err, settings) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!settings.vault_enabled) return res.status(400).json({ error: 'Vault is not enabled' });

            crypto.pbkdf2(password, settings.vault_salt, 100000, 64, 'sha512', (err, derivedKey) => {
                if (err) return res.status(500).json({ error: 'Processing error' });

                if (derivedKey.toString('hex') !== settings.vault_password_hash) {
                    return res.status(401).json({ error: 'Incorrect password' });
                }

                const FileModel = require('../models/fileModel');
                const fs = require('fs');
                FileModel.findEncrypted(userId, 1000, 0, (err, files) => {
                    if (err) return res.status(500).json({ error: err.message });

                    // Helper to delete files
                    const deletePromises = (files || []).map(file => {
                        return new Promise((resolve) => {
                            // Delete from DB
                            // We should probably have a delete method in FileModel or just raw query
                            // Ideally use controller logic but for now simple query implies physical delete handled manually here

                            // 1. Delete physical file
                            if (file.path && fs.existsSync(file.path)) {
                                fs.unlinkSync(file.path);
                            }

                            // 2. Delete from DB
                            const db = require('../config/database');
                            db.run('DELETE FROM files WHERE id = ?', [file.id], (err) => {
                                resolve();
                            });
                        });
                    });

                    Promise.all(deletePromises).then(() => {
                        // Disable
                        UserModel.updateVaultSettings(userId, 0, null, null, (err) => {
                            if (err) return res.status(500).json({ error: err.message });
                            res.json({ message: 'Vault disabled and all encrypted files deleted.' });
                        });
                    });
                });
            });
        });
    }

    static getStatus(req, res) {
        const userId = req.user.id;
        UserModel.getVaultSettings(userId, (err, settings) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ enabled: !!(settings && settings.vault_enabled) });
        });
    }
}

module.exports = VaultController;
