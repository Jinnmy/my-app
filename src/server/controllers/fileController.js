const fs = require('fs');
const path = require('path');
const FileModel = require('../models/fileModel');
const TransferModel = require('../models/transferModel');
const storageConfigPath = path.join(__dirname, '../config/storage.json');

// Helper to get root storage path
const getStoragePath = () => {
    if (fs.existsSync(storageConfigPath)) {
        const config = JSON.parse(fs.readFileSync(storageConfigPath, 'utf8'));
        return config.volumePath || null;
    }
    return null;
};

class FileController {
    // List files/folders in a directory (by parentId)
    static list(req, res) {
        const parentId = req.query.parentId || null;
        const userId = req.user.id;
        FileModel.findByParentId(userId, parentId, (err, files) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(files);
        });
    }

    // Search files/folders
    static search(req, res) {
        const { query, type } = req.query;
        const userId = req.user.id;

        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        FileModel.search(userId, query, type, (err, files) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(files);
        });
    }

    // Create a new folder
    static createFolder(req, res) {
        const { name, parentId } = req.body;
        const rootPath = getStoragePath();

        if (!rootPath) {
            return res.status(500).json({ error: 'Storage not configured' });
        }

        // Determine physical path
        const createPhysicalFolder = (parentPath) => {
            const newFolderPath = path.join(parentPath, name);

            if (fs.existsSync(newFolderPath)) {
                return res.status(400).json({ error: 'Folder already exists' });
            }

            fs.mkdir(newFolderPath, { recursive: true }, (err) => {
                if (err) return res.status(500).json({ error: err.message });

                // Save to DB
                FileModel.create({
                    name,
                    path: newFolderPath,
                    type: 'folder',
                    size: 0,
                    parent_id: parentId || null,
                    user_id: req.user ? req.user.id : null
                }, (err, newFolder) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json(newFolder);
                });
            });
        };

        if (parentId) {
            FileModel.findById(parentId, (err, parent) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!parent) return res.status(404).json({ error: 'Parent folder not found' });
                createPhysicalFolder(parent.path);
            });
        } else {
            createPhysicalFolder(rootPath);
        }
    }

    // Handle file upload (Queue the transfer)
    static uploadFile(req, res) {
        const file = req.file;
        const { parentId } = req.body;
        const userId = req.user.id;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const rootPath = getStoragePath();
        if (!rootPath) {
            // Cleanup temp file
            fs.unlink(file.path, () => { });
            return res.status(500).json({ error: 'Storage not configured' });
        }

        // Check Storage Limit
        const UserModel = require('../models/userModel');
        UserModel.findById(userId, (err, user) => {
            if (err || !user) {
                fs.unlink(file.path, () => { });
                return res.status(500).json({ error: 'Failed to retrieve user data' });
            }

            const currentUsed = user.used_storage || 0;
            const limit = user.storage_limit || 10737418240; // Default 10GB if missing

            if (currentUsed + file.size > limit) {
                fs.unlink(file.path, () => { });
                return res.status(400).json({ error: 'Storage limit exceeded' });
            }

            // proceed to resolve destination
            resolveDestination((err, finalPath) => {
                if (err) {
                    fs.unlink(file.path, () => { }); // Cleanup
                    return res.status(400).json({ error: err.message });
                }

                // Create Transfer Record
                TransferModel.create({
                    user_id: userId,
                    type: 'upload',
                    source: file.path,
                    destination: finalPath,
                    metadata: {
                        originalname: file.originalname,
                        size: file.size,
                        mimetype: file.mimetype,
                        parentId: (parentId && parentId !== 'null' && parentId !== 'undefined') ? parentId : null
                    }
                }, (err, transfer) => {
                    if (err) {
                        fs.unlink(file.path, () => { });
                        return res.status(500).json({ error: 'Failed to queue transfer: ' + err.message });
                    }
                    res.json({ message: 'Upload queued', transfer });
                });
            });
        });

        // Determine final destination path (Moved inside callback above to chain correctly)
        const resolveDestination = (cb) => {
            if (parentId && parentId !== 'null' && parentId !== 'undefined') {
                FileModel.findById(parentId, (err, parent) => {
                    if (err) return cb(err);
                    if (!parent) return cb(new Error('Parent folder not found'));
                    cb(null, path.join(parent.path, file.originalname));
                });
            } else {
                cb(null, path.join(rootPath, file.originalname));
            }
        };
    }

    // Download file
    static download(req, res) {
        const id = req.params.id;
        const userId = req.user.id; // Enforce ownership

        // Simple Concurrency Check
        TransferModel.countProcessing((err, count) => {
            // For downloads, we might want a separate limit or share the global limit (2).
            // Let's say we allow 2 uploads AND 2 downloads, or 2 total. 
            // Service uses "countProcessing" which counts ALL transfers.
            // If we want strict control, we check that.
            if (!err && count >= 2) {
                return res.status(429).json({ error: 'Transfer queue is full. Please try again later.' });
            }

            // If proceeding, we should ideally register this download in TransferModel
            // But since we are streaming response immediately, 
            // we can create a "Completed" record just for logging 
            // or "Processing" and then verify... but we can't easily hook into "finish" here cleanly without more code.
            // For now, let's just do the check.

            // Continuation...
            FileModel.findById(id, (err, file) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!file) return res.status(404).json({ error: 'File not found' });

                // Check ownership
                if (file.user_id !== userId) {
                    return res.status(403).json({ error: 'Access denied' });
                }

                if (file.type === 'folder') {
                    return res.status(400).json({ error: 'Cannot download folders yet' });
                }

                if (!fs.existsSync(file.path)) {
                    return res.status(404).json({ error: 'File not found on disk' });
                }

                // Detect mime type for images to allow inline preview
                const ext = path.extname(file.name).toLowerCase();
                const mimeTypes = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                    '.svg': 'image/svg+xml'
                };

                const mimeType = mimeTypes[ext];

                if (mimeType) {
                    // Send as inline to display in browser
                    res.setHeader('Content-Type', mimeType);
                    res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
                    const stream = fs.createReadStream(file.path);
                    stream.pipe(res);
                } else {
                    // Force download for other files
                    res.download(file.path, file.name, (err) => {
                        if (err) {
                            console.error('Download error:', err);
                            if (!res.headersSent) {
                                res.status(500).send('Could not download file');
                            }
                        }
                    });
                }
            });
        });
    }

    // Delete file or folder
    static delete(req, res) {
        const id = req.params.id;

        FileModel.findById(id, (err, file) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!file) return res.status(404).json({ error: 'File not found' });

            // Remove from filesystem
            fs.rm(file.path, { recursive: true, force: true }, (err) => {
                if (err) {
                    console.error(`Failed to delete file at ${file.path}:`, err);
                    // We might still want to delete from DB or return error
                    // For now, return error
                    return res.status(500).json({ error: 'Failed to delete file from disk' });
                }

                // Remove from DB
                FileModel.delete(id, (err) => {
                    if (err) return res.status(500).json({ error: err.message });

                    // Update User Storage
                    const UserModel = require('../models/userModel');
                    UserModel.updateStorage(file.user_id, -file.size, (err) => {
                        if (err) console.error('Failed to update storage usage on delete:', err);
                    });

                    res.json({ message: 'Deleted successfully' });
                });
            });
        });
    }

    // Move file/folder
    static move(req, res) {
        const id = req.params.id;
        const { targetParentId } = req.body;
        const userId = req.user.id;

        FileModel.findById(id, (err, file) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!file) return res.status(404).json({ error: 'File not found' });

            // Check ownership
            if (file.user_id !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Target Parent Validation
            const getTargetDirectory = (targetId, cb) => {
                if (!targetId || targetId === 'root') {
                    const rootPath = getStoragePath();
                    return cb(null, { path: rootPath });
                }

                FileModel.findById(targetId, (err, parent) => {
                    if (err) return cb(err);
                    if (!parent) return cb(new Error('Target folder not found'));
                    if (parent.type !== 'folder') return cb(new Error('Target must be a folder'));
                    if (parent.user_id !== userId) return cb(new Error('Access denied to target')); // Strict isolation
                    cb(null, parent);
                });
            };

            getTargetDirectory(targetParentId, (err, targetDir) => {
                if (err) return res.status(400).json({ error: err.message });

                // Cyclic check for folders
                if (file.type === 'folder' && targetDir.path.startsWith(file.path)) {
                    return res.status(400).json({ error: 'Cannot move folder into itself' });
                }

                const newPath = path.join(targetDir.path, file.name);

                // Check collision
                if (fs.existsSync(newPath)) {
                    return res.status(400).json({ error: 'File/Folder with same name exists in destination' });
                }

                // Physical Move
                fs.rename(file.path, newPath, (err) => {
                    if (err) {
                        console.error('Move error:', err);
                        return res.status(500).json({ error: 'Failed to move file on disk' });
                    }

                    // DB Update
                    const finalParentId = (targetParentId === 'root') ? null : targetParentId;

                    FileModel.updateLocation(id, finalParentId, newPath, (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ success: true, newPath });
                    });
                });
            });
        });
    }

    // Stream file (Video)
    static stream(req, res) {
        const id = req.params.id;
        const userId = req.user.id;
        const range = req.headers.range;

        FileModel.findById(id, (err, file) => {
            if (err) return res.status(500).send(err.message);
            if (!file) return res.status(404).send('File not found');
            if (file.user_id !== userId) return res.status(403).send('Access denied');

            const videoPath = file.path;

            if (!fs.existsSync(videoPath)) {
                return res.status(404).send('File not found on disk');
            }

            const videoSize = fs.statSync(videoPath).size;

            // Allow streaming of common video formats
            const ext = path.extname(file.name).toLowerCase();
            const mimeTypes = {
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ogg': 'video/ogg',
                '.mkv': 'video/x-matroska'
            };

            const contentType = mimeTypes[ext] || 'application/octet-stream';

            // If range is present, send partial content
            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const CHUNK_SIZE = 10 ** 6; // 1MB
                let end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
                if (!parts[1]) end = Math.min(start + CHUNK_SIZE, videoSize - 1);
                const contentLength = end - start + 1;

                const headers = {
                    "Content-Range": `bytes ${start}-${end}/${videoSize}`,
                    "Accept-Ranges": "bytes",
                    "Content-Length": contentLength,
                    "Content-Type": contentType,
                };

                res.writeHead(206, headers);
                const videoStream = fs.createReadStream(videoPath, { start, end });
                videoStream.pipe(res);
            } else {
                // No range, send whole file (not ideal for video but fallback)
                const headers = {
                    "Content-Length": videoSize,
                    "Content-Type": contentType,
                };
                res.writeHead(200, headers);
                fs.createReadStream(videoPath).pipe(res);
            }
        });
    }
    // Share file
    static share(req, res) {
        const id = req.params.id;
        const { targetBy, value, permission } = req.body; // targetBy: 'id' or 'email', value: id or email
        const userId = req.user.id;

        // Verify ownership
        FileModel.findById(id, (err, file) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!file) return res.status(404).json({ error: 'File not found' });
            if (file.user_id !== userId) return res.status(403).json({ error: 'Only owner can share' });

            // Resolve User
            const UserModel = require('../models/userModel');
            const resolveUser = (cb) => {
                if (targetBy === 'id') return UserModel.findById(value, cb);
                if (targetBy === 'email') return UserModel.findByEmail(value, cb);
                cb(new Error('Invalid target type'));
            };

            resolveUser((err, targetUser) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!targetUser) return res.status(404).json({ error: 'User not found' });
                if (targetUser.id === userId) return res.status(400).json({ error: 'Cannot share with yourself' });

                FileModel.share(id, targetUser.id, permission || 'view', (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: `Shared with ${targetUser.username}` });
                });
            });
        });
    }

    // Unshare file
    static unshare(req, res) {
        const id = req.params.id;
        const { targetUserId } = req.body;
        const userId = req.user.id;

        FileModel.findById(id, (err, file) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!file) return res.status(404).json({ error: 'File not found' });
            if (file.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

            FileModel.unshare(id, targetUserId, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Access revoked' });
            });
        });
    }

    // Get Shared Users
    static getSharedUsers(req, res) {
        const id = req.params.id;
        const userId = req.user.id;

        FileModel.findById(id, (err, file) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!file) return res.status(404).json({ error: 'File not found' });
            if (file.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

            FileModel.getSharedUsers(id, (err, users) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(users);
            });
        });
    }
}

module.exports = FileController;
