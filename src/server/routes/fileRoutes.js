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
        // Use a temporary folder for initial upload. 
        // The Queue Service will move it to the final destination.
        const tempPath = path.join(__dirname, '../../temp_uploads');
        if (!fs.existsSync(tempPath)) {
            fs.mkdirSync(tempPath, { recursive: true });
        }
        cb(null, tempPath);
    },
    filename: function (req, file, cb) {
        // Use timestamp to avoid collisions in temp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const verifyToken = require('../middleware/authMiddleware');

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.exe') {
        return cb(new Error('Executable files (.exe) are not allowed for security reasons.'), false);
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 1024 * 1024 * 500 } // 500MB limit for now
});

router.get('/', verifyToken, FileController.list);
router.get('/encrypted', verifyToken, FileController.listVault);
router.get('/trash', verifyToken, FileController.getTrashed); // Must be before /:id
router.get('/recent', verifyToken, FileController.getRecentlyAccessed);
router.get('/search', verifyToken, FileController.search);
router.post('/folder', verifyToken, FileController.createFolder);
// Note: Frontend must send 'parentId' BEFORE 'file' in the FormData for req.body.parentId to be available here.
// Also, verifyToken must run before upload.single to protect the upload, but multer handles multipart/form-data.
// If verifyToken reads body, it might fail if body isn't parsed yet. 
// However, verifyToken only reads headers, so it's fine.
router.post('/upload', verifyToken, (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: 'Upload error: ' + err.message });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, FileController.uploadFile);
router.post('/check-exists', verifyToken, FileController.checkExistence);

// Allocation Routes (Admin)
router.get('/unmarked', verifyToken, FileController.getUnmarked);
router.post('/allocate', verifyToken, FileController.allocate);

router.get('/download/:id', verifyToken, FileController.download);
router.put('/move/:id', verifyToken, FileController.move);
router.put('/rename/:id', verifyToken, FileController.rename);
router.put('/metadata/:id', verifyToken, FileController.updateMetadata);
router.put('/restore/:id', verifyToken, FileController.restore);
router.delete('/permanent/:id', verifyToken, FileController.permanentDelete);
router.delete('/trash', verifyToken, FileController.emptyTrash); // Empty Trash
router.delete('/:id', verifyToken, FileController.delete);
router.get('/stream/:id', verifyToken, FileController.stream);

// Share routes
router.post('/:id/share', verifyToken, FileController.share);
router.post('/:id/unshare', verifyToken, FileController.unshare);
router.get('/:id/shared-users', verifyToken, FileController.getSharedUsers);

// Public Share Link Routes
router.post('/:id/share-link', verifyToken, FileController.createLink);
router.get('/s/:token', FileController.getLinkInfo); // Public
router.get('/s/:token/download', FileController.downloadLink); // Public

// Lock routes
router.post('/:id/lock', verifyToken, FileController.lock);
router.post('/:id/unlock', verifyToken, FileController.unlock);
router.post('/:id/verify-password', verifyToken, FileController.verifyPassword);

module.exports = router;
