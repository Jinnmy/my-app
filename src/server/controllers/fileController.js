const fs = require('fs');
const path = require('path');
const FileModel = require('../models/fileModel');
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
        FileModel.findByParentId(parentId, (err, files) => {
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

    // Handle file upload (Metadata saving after Multer handles physical upload)
    static uploadFile(req, res) {
        const file = req.file;
        const { parentId } = req.body;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // The file is already moved to the destination by Multer configuration in the route
        // We just need to record it in the DB

        FileModel.create({
            name: file.originalname,
            path: file.path,
            type: 'file',
            size: file.size,
            parent_id: parentId || null,
            user_id: req.user ? req.user.id : null
        }, (err, newFile) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(newFile);
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
                    res.json({ message: 'Deleted successfully' });
                });
            });
        });
    }
}

module.exports = FileController;
