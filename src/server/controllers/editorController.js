const fs = require('fs');
const mammoth = require('mammoth');
const HTMLtoDOCX = require('html-to-docx');
const FileModel = require('../models/fileModel');

const crypto = require('crypto');

class EditorController {
    // Get docx content as HTML
    static getContent(req, res) {
        const id = req.params.id;
        // const userId = req.user.id; 

        FileModel.findById(id, (err, file) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!file) return res.status(404).json({ error: 'File not found' });
            if (!fs.existsSync(file.path)) {
                return res.status(404).json({ error: 'File not found on disk' });
            }

            if (file.is_encrypted) {
                const vaultKey = req.headers['x-vault-key'];
                if (!vaultKey) return res.status(400).json({ error: 'Vault key required for encrypted files' });

                try {
                    // Decrypt File
                    const fileData = fs.readFileSync(file.path);
                    const iv = fileData.slice(0, 16);
                    const encryptedContent = fileData.slice(16);
                    const key = Buffer.from(vaultKey, 'hex');

                    const decipher = crypto.createDecipheriv('aes-256-ctr', key, iv);
                    const decrypted = Buffer.concat([decipher.update(encryptedContent), decipher.final()]);

                    mammoth.convertToHtml({ buffer: decrypted })
                        .then(result => {
                            res.json({ html: result.value, originalName: file.name });
                        })
                        .catch(err => {
                            console.error('Conversion error:', err);
                            res.status(500).json({ error: 'Failed to convert file' });
                        });

                } catch (e) {
                    console.error('Decryption error:', e);
                    res.status(500).json({ error: 'Failed to decrypt file. Key may be invalid.' });
                }

            } else {
                // Standard File
                mammoth.convertToHtml({ path: file.path })
                    .then(result => {
                        res.json({ html: result.value, originalName: file.name });
                    })
                    .catch(err => {
                        console.error('Conversion error:', err);
                        res.status(500).json({ error: 'Failed to convert file' });
                    });
            }
        });
    }

    // Save HTML as docx
    static saveContent(req, res) {
        const id = req.params.id;
        const { html } = req.body;
        // const userId = req.user.id;

        FileModel.findById(id, async (err, file) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!file) return res.status(404).json({ error: 'File not found' });

            try {
                // Generate DOCX Buffer
                const buffer = await HTMLtoDOCX(html, null, {
                    table: { row: { cantSplit: true } },
                    footer: true,
                    pageNumber: true,
                });

                if (file.is_encrypted) {
                    const vaultKey = req.headers['x-vault-key'];
                    if (!vaultKey) return res.status(400).json({ error: 'Vault key required to save encrypted file' });

                    // Encrypt Buffer
                    const iv = crypto.randomBytes(16);
                    const key = Buffer.from(vaultKey, 'hex');
                    const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);

                    const encrypted = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);

                    fs.writeFile(file.path, encrypted, (err) => {
                        if (err) throw err;
                        res.json({ message: 'Saved successfully (Encrypted)' });
                    });

                } else {
                    // Standard Save
                    fs.writeFile(file.path, buffer, (err) => {
                        if (err) throw err;
                        res.json({ message: 'Saved successfully' });
                    });
                }

            } catch (error) {
                console.error('Save error:', error);
                res.status(500).json({ error: 'Failed to save file: ' + error.message });
            }
        });
    }
}

module.exports = EditorController;
