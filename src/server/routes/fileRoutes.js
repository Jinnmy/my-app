const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FileController = require('../controllers/fileController');
const FileModel = require('../models/fileModel');

const storageConfigPath = path.join(__dirname, '../config/storage.json');
const getStoragePath = () => {
    if (fs.existsSync(storageConfigPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(storageConfigPath, 'utf8'));
            return config.volumePath || null;
        } catch (e) {
            return null;
        }
    }
    return null;
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const rootPath = getStoragePath();
        if (!rootPath) return cb(new Error('Storage not configured'));

        const parentId = req.body.parentId;

        if (parentId && parentId !== 'null' && parentId !== 'undefined') {
            FileModel.findById(parentId, (err, parent) => {
                if (err) return cb(err);
                if (!parent) return cb(new Error('Parent folder not found'));
                cb(null, parent.path);
            });
        } else {
            cb(null, rootPath);
        }
    },
    filename: function (req, file, cb) {
        // Simple filename handling. In production, might want to handle duplicates.
        cb(null, file.originalname);
    }
});

const verifyToken = require('../middleware/authMiddleware');

const upload = multer({ storage: storage });

router.get('/', verifyToken, FileController.list);
router.post('/folder', verifyToken, FileController.createFolder);
// Note: Frontend must send 'parentId' BEFORE 'file' in the FormData for req.body.parentId to be available here.
// Also, verifyToken must run before upload.single to protect the upload, but multer handles multipart/form-data.
// If verifyToken reads body, it might fail if body isn't parsed yet. 
// However, verifyToken only reads headers, so it's fine.
router.post('/upload', verifyToken, upload.single('file'), FileController.uploadFile);
router.delete('/:id', verifyToken, FileController.delete);

module.exports = router;
