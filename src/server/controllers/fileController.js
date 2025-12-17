const fs = require('fs');
const path = require('path');
const FileModel = require('../models/fileModel');
const TransferModel = require('../models/transferModel');
const storageConfigPath = path.join(__dirname, '../config/storage.json');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

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

    // Get recently accessed files
    static getRecentlyAccessed(req, res) {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 5;

        FileModel.findRecentlyAccessed(userId, limit, (err, files) => {
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

                // Check ownership or Shared Access
                const proceedDownload = () => {
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
                            } else {
                                // Track access on successful download
                                FileModel.updateLastAccessed(id, (err) => {
                                    if (err) console.error('Failed to update access time:', err);
                                });
                            }
                        });
                    }

                    // If inline (pipe), we also want to track access. 
                    if (mimeType) {
                        FileModel.updateLastAccessed(id, (err) => {
                            if (err) console.error('Failed to update access time:', err);
                        });
                    }
                };

                if (file.user_id === userId) {
                    proceedDownload();
                } else {
                    FileModel.isSharedWith(id, userId, (err, isShared) => {
                        if (err) return res.status(500).json({ error: err.message });
                        if (!isShared) return res.status(403).json({ error: 'Access denied' });
                        proceedDownload();
                    });
                }
            });
        });
    }

    // Soft Delete file or folder
    static delete(req, res) {
        const id = req.params.id;
        const userId = req.user.id;

        FileModel.findById(id, (err, file) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!file) return res.status(404).json({ error: 'File not found' });
            if (file.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

            // Soft Delete in DB (Do NOT delete from disk yet)
            FileModel.delete(id, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Moved to trash' });
            });
        });
    }

    // Permanent Delete
    static permanentDelete(req, res) {
        const id = req.params.id;
        const userId = req.user.id;

        FileModel.findById(id, (err, file) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!file) return res.status(404).json({ error: 'File not found' }); // Might need to check trashed items specifically if findById filters them out? 
            // findById usually filters out deleted items if we updated it? 
            // Wait, I updated findByPath and others, but did I update findById?
            // Let's check FileModel. findById: `SELECT * FROM files WHERE id = ?`. It does NOT filter. Good.

            if (file.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

            // Remove from filesystem
            fs.rm(file.path, { recursive: true, force: true }, (err) => {
                if (err) {
                    console.error(`Failed to delete file at ${file.path}:`, err);
                    // continue? Yes, inconsistent state otherwise.
                }

                // Remove from DB permanently
                FileModel.permanentDelete(id, (err) => {
                    if (err) return res.status(500).json({ error: err.message });

                    // Update User Storage
                    const UserModel = require('../models/userModel');
                    UserModel.updateStorage(file.user_id, -file.size, (err) => {
                        if (err) console.error('Failed to update storage usage on delete:', err);
                    });

                    res.json({ message: 'Permanently deleted' });
                });
            });
        });
    }

    // Restore file
    static restore(req, res) {
        const id = req.params.id;
        const userId = req.user.id;

        FileModel.findById(id, (err, file) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!file) return res.status(404).json({ error: 'File not found' });
            if (file.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

            FileModel.restore(id, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'File restored' });
            });
        });
    }

    // Get Trashed Files
    static getTrashed(req, res) {
        const userId = req.user.id;
        FileModel.findTrashed(userId, (err, files) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(files);
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

    // Rename file/folder
    static rename(req, res) {
        const id = req.params.id;
        const { newName } = req.body;
        const userId = req.user.id;

        if (!newName || typeof newName !== 'string' || newName.trim() === '') {
            return res.status(400).json({ error: 'Invalid name' });
        }

        // Basic filename validation (prevent path traversal or invalid chars)
        // Adjust regex as needed for Windows/Linux compatibility
        if (/[<>:"/\\|?*]/.test(newName)) {
            return res.status(400).json({ error: 'Name contains invalid characters' });
        }

        FileModel.findById(id, (err, file) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!file) return res.status(404).json({ error: 'File not found' });

            // Check ownership
            if (file.user_id !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const parentDir = path.dirname(file.path);
            const newPath = path.join(parentDir, newName);

            // Check collision
            if (fs.existsSync(newPath)) {
                return res.status(400).json({ error: 'A file or folder with this name already exists' });
            }

            // Physical Rename
            fs.rename(file.path, newPath, (err) => {
                if (err) {
                    console.error('Rename error:', err);
                    return res.status(500).json({ error: 'Failed to rename file on disk' });
                }

                // DB Update
                // We use updateDetails now, but keeping this for backward compatibility or direct calls
                // Be careful with recursive dependency if we remove rename from model. 
                // Since we removed `rename` from model and replaced with `updateDetails`, we must update this too!
                FileModel.updateDetails(id, newName, newPath, file.type, file.path, file.caption, file.tags, (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, newName, newPath });
                });
            });
        });
    }

    // Update File Details (Name, Caption, Tags)
    static updateMetadata(req, res) {
        const id = req.params.id;
        const { name, caption, tags } = req.body;
        const userId = req.user.id;

        FileModel.findById(id, (err, file) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!file) return res.status(404).json({ error: 'File not found' });
            if (file.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

            // Validate tags
            let validTags = tags;
            if (tags && !Array.isArray(tags)) {
                return res.status(400).json({ error: 'Tags must be an array' });
            }

            // Check if name changed
            if (name && name !== file.name) {
                // Name Validation
                if (typeof name !== 'string' || name.trim() === '') {
                    return res.status(400).json({ error: 'Invalid name' });
                }
                if (/[<>:"/\\|?*]/.test(name)) {
                    return res.status(400).json({ error: 'Name contains invalid characters' });
                }

                const parentDir = path.dirname(file.path);
                const newPath = path.join(parentDir, name);

                // Check collision
                if (fs.existsSync(newPath)) {
                    return res.status(400).json({ error: 'A file or folder with this name already exists' });
                }

                // Physical Rename
                fs.rename(file.path, newPath, (err) => {
                    if (err) {
                        console.error('Rename error:', err);
                        return res.status(500).json({ error: 'Failed to rename file on disk' });
                    }

                    // Update DB with new name/path AND metadata
                    FileModel.updateDetails(id, name, newPath, file.type, file.path, caption, validTags, (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ message: 'Details updated successfully', name, newPath });
                    });
                });

            } else {
                // Only metadata update
                FileModel.updateDetails(id, file.name, file.path, file.type, file.path, caption, validTags, (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Metadata updated' });
                });
            }
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
            const ext = path.extname(file.name).toLowerCase();

            // Formats that browsers natively support (Direct Stream)
            const directStreamFormats = {
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ogg': 'video/ogg'
            };

            // Formats that need transcoding
            const transcodeFormats = ['.mkv', '.avi', '.mov', '.wmv', '.flv', '.mpg'];

            if (transcodeFormats.includes(ext)) {
                // Transcoding Logic (FFmpeg)
                const range = req.headers.range;
                // Note: Range requests with transcoding are complex. 
                // For this implementation, we will stream the output linearly.
                // Browsers can still mostly play this, but seeking might be limited depending on the player.

                res.writeHead(200, {
                    'Content-Type': 'video/mp4',
                    'Content-Disposition': `inline; filename="${path.basename(file.name, ext)}.mp4"`
                });

                const command = ffmpeg(videoPath)
                    .format('mp4')
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .outputOptions([
                        '-movflags frag_keyframe+empty_moov', // Necessary for streaming MP4
                        '-preset ultrafast', // Low latency
                        '-b:v 2000k' // Reasonable bitrate, maybe adjust later
                    ])
                    .on('error', (err) => {
                        // Silence error if it's just a broken pipe (client disconnected)
                        if (err.message !== 'Output stream closed') {
                            console.error('FFmpeg error:', err);
                        }
                    });

                command.pipe(res, { end: true });

                // Kill ffmpeg if client disconnects
                req.on('close', () => {
                    command.kill();
                });

            } else if (directStreamFormats[ext]) {
                // Direct Streaming Logic (Existing)
                const contentType = directStreamFormats[ext];

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
                    const headers = {
                        "Content-Length": videoSize,
                        "Content-Type": contentType,
                    };
                    res.writeHead(200, headers);
                    fs.createReadStream(videoPath).pipe(res);
                }
            } else {
                // Fallback for unknown formats
                res.status(415).send('Unsupported video format');
            }

            // Track access
            FileModel.updateLastAccessed(id, (err) => {
                if (err) console.error('Failed to update access time:', err);
            });
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
