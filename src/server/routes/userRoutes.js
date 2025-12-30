const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const verifyToken = require('../middleware/authMiddleware');

const verifyAdmin = require('../middleware/adminMiddleware');

// Public
router.post('/login', userController.login);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);
router.post('/', userController.createUser); // Public registration (optional, or restrict to admin too)

// Protected (Any Authenticated User)
router.get('/me', verifyToken, userController.getMe);
router.put('/preferences', verifyToken, userController.updatePreferences);
router.get('/:id', verifyToken, userController.getUserById);

// Admin Only
router.get('/', verifyToken, verifyAdmin, userController.getUsers);
router.put('/:id', verifyToken, verifyAdmin, userController.updateUser);
router.delete('/:id', verifyToken, verifyAdmin, userController.deleteUser);
// Note: createUser is left public for registration, but if only admin should add users:
// router.post('/', verifyToken, verifyAdmin, userController.createUser);
// For now, let's leave registration public or decide based on requirements. 
// User goal was "only admin is allowed to access this user management".
// This implies listing and modifying. Registration usually allows self-signup or admin-only.
// Given it's a NAS, typically admin creates users. I will restrict creation too.

router.post('/', verifyToken, verifyAdmin, userController.createUser);

module.exports = router;
