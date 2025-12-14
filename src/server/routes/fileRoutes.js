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

const upload = multer({ storage: storage });

router.get('/', verifyToken, FileController.list);
router.get('/search', verifyToken, FileController.search);
router.post('/folder', verifyToken, FileController.createFolder);
// Note: Frontend must send 'parentId' BEFORE 'file' in the FormData for req.body.parentId to be available here.
// Also, verifyToken must run before upload.single to protect the upload, but multer handles multipart/form-data.
// If verifyToken reads body, it might fail if body isn't parsed yet. 
// However, verifyToken only reads headers, so it's fine.
router.post('/upload', verifyToken, upload.single('file'), FileController.uploadFile);
router.get('/download/:id', verifyToken, FileController.download);
router.put('/move/:id', verifyToken, FileController.move);
router.delete('/:id', verifyToken, FileController.delete);
router.get('/stream/:id', verifyToken, FileController.stream);

module.exports = router;
