const express = require('express');
const router = express.Router();
const EditorController = require('../controllers/editorController');
const verifyToken = require('../middleware/authMiddleware');

// Get content
router.get('/:id/content', verifyToken, EditorController.getContent);

// Save content
router.post('/:id/save', verifyToken, EditorController.saveContent);

module.exports = router;
