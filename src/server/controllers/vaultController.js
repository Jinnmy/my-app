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

    // Change Password (Re-encryption)
    static changePassword(req, res) {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!newPassword || newPassword.length < 4) {
            return res.status(400).json({ error: 'New password must be at least 4 characters long' });
        }

        UserModel.getVaultSettings(userId, (err, settings) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!settings || !settings.vault_enabled) return res.status(400).json({ error: 'Vault is not enabled' });

            // 1. Verify Old Password
            crypto.pbkdf2(currentPassword, settings.vault_salt, 100000, 64, 'sha512', (err, oldDerivedKey) => {
                if (err) return res.status(500).json({ error: 'Processing error' });

                if (oldDerivedKey.toString('hex') !== settings.vault_password_hash) {
                    return res.status(401).json({ error: 'Incorrect current password' });
                }

                // 2. Generate New Key
                const newSalt = crypto.randomBytes(16).toString('hex');
                crypto.pbkdf2(newPassword, newSalt, 100000, 64, 'sha512', (err, newDerivedKey) => {
                    if (err) return res.status(500).json({ error: 'Encryption error' });

                    const oldKey = oldDerivedKey.slice(0, 32);
                    const newKey = newDerivedKey.slice(0, 32);
                    const newHash = newDerivedKey.toString('hex');

                    // 3. Re-encrypt Files
                    const FileModel = require('../models/fileModel');
                    const fs = require('fs');
                    const path = require('path');

                    FileModel.findEncrypted(userId, 100000, 0, (err, files) => {
                        if (err) return res.status(500).json({ error: err.message });
                        if (!files || files.length === 0) {
                            // No files, just update settings
                            return UserModel.updateVaultSettings(userId, 1, newHash, newSalt, (err) => {
                                if (err) return res.status(500).json({ error: err.message });
                                res.json({ message: 'Password changed successfully' });
                            });
                        }

                        // Helper to re-encrypt a single file
                        const reEncryptFile = (file) => {
                            return new Promise((resolve, reject) => {
                                if (!fs.existsSync(file.path)) {
                                    console.warn(`File missing for re-encryption: ${file.path}`);
                                    return resolve(); // Skip
                                }

                                const tempPath = file.path + '.tmp';

                                // Read IV from existing file (first 16 bytes)
                                fs.open(file.path, 'r', (err, fd) => {
                                    if (err) return reject(err);

                                    const ivBuffer = Buffer.alloc(16);
                                    fs.read(fd, ivBuffer, 0, 16, 0, (err, bytesRead) => {
                                        fs.close(fd, () => { });
                                        if (err) return reject(err);

                                        // Setup Decipher (Old Key, Old IV)
                                        const decipher = crypto.createDecipheriv('aes-256-ctr', oldKey, ivBuffer);

                                        // Setup Cipher (New Key, REUSE IV to avoid having to rewrite file header logic heavily, or generate new IV?)
                                        // Generating new IV is safer.
                                        const newIv = crypto.randomBytes(16);
                                        const cipher = crypto.createCipheriv('aes-256-ctr', newKey, newIv);

                                        const readStream = fs.createReadStream(file.path, { start: 16 }); // Skip old IV
                                        const writeStream = fs.createWriteStream(tempPath);

                                        // Write New IV first
                                        writeStream.write(newIv);

                                        const stream = readStream.pipe(decipher).pipe(cipher).pipe(writeStream);

                                        stream.on('finish', () => {
                                            // Replace original file
                                            fs.unlink(file.path, (err) => {
                                                if (err) return reject(err);
                                                fs.rename(tempPath, file.path, (err) => {
                                                    if (err) return reject(err);
                                                    resolve();
                                                });
                                            });
                                        });

                                        stream.on('error', (err) => {
                                            reject(err);
                                        });
                                    });
                                });
                            });
                        };

                        // Process sequentially or parallel? Parallel with limit is best.
                        // For simplicity in a prototype: Promise.all (might blow up memory if too many valid streams? No, streams backpressure).
                        // File descriptors might run out.
                        // Let's do batches of 5.

                        const batchProcess = async () => {
                            try {
                                for (let i = 0; i < files.length; i += 5) {
                                    const batch = files.slice(i, i + 5);
                                    await Promise.all(batch.map(f => reEncryptFile(f)));
                                }

                                // 4. Update Settings
                                UserModel.updateVaultSettings(userId, 1, newHash, newSalt, (err) => {
                                    if (err) return res.status(500).json({ error: err.message });
                                    res.json({ message: 'Password changed and files re-encrypted successfully' });
                                });

                            } catch (e) {
                                console.error('Re-encryption failed:', e);
                                // This is bad state: some files new key, some old.
                                // In real app, we'd need rollback or a "pending" state.
                                res.status(500).json({ error: 'Partial re-encryption failure. Data may be inconsistent.' });
                            }
                        };

                        batchProcess();
                    });
                });
            });
        });
    }

    // Disable Vault (Delete everything)
    static disableVault(req, res) {
        const userId = req.user.id; // Removed password from extraction

        UserModel.getVaultSettings(userId, (err, settings) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!settings || !settings.vault_enabled) return res.status(400).json({ error: 'Vault is not enabled' });

            // No password check anymore. Proceed to delete files.

            const FileModel = require('../models/fileModel');
            const fs = require('fs');
            const db = require('../config/database');

            // Get ALL encrypted files (high limit)
            FileModel.findEncrypted(userId, 100000, 0, (err, files) => {
                if (err) return res.status(500).json({ error: err.message });

                // Helper to delete files safely
                const deletePromises = (files || []).map(file => {
                    return new Promise((resolve) => {
                        // 1. Delete physical file (Best Effort)
                        try {
                            if (file.path && fs.existsSync(file.path)) {
                                fs.unlinkSync(file.path);
                            }
                        } catch (e) {
                            console.error(`Failed to delete encrypted file ${file.path}:`, e.message);
                            // Continue even if file delete fails (orphaned file is better than stuck vault)
                        }

                        // 2. Delete from DB
                        db.run('DELETE FROM files WHERE id = ?', [file.id], (err) => {
                            if (err) console.error(`Failed to delete DB record for file ${file.id}:`, err);
                            resolve();
                        });
                    });
                });

                Promise.all(deletePromises)
                    .then(() => {
                        // Disable in User Settings
                        UserModel.updateVaultSettings(userId, 0, null, null, (err) => {
                            if (err) return res.status(500).json({ error: err.message });
                            res.json({ message: 'Vault disabled and all encrypted files deleted.' });
                        });
                    })
                    .catch(err => {
                        console.error("Critical error during vault disable:", err);
                        res.status(500).json({ error: "Partial failure disabling vault. Please try again." });
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
