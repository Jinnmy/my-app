const UserModel = require('../models/userModel');
const FileModel = require('../models/fileModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'your-secret-key'; // In production, use environment variable

const userController = {
    createUser: (req, res) => {
        const { username, email, password, role } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const hashedPassword = bcrypt.hashSync(password, 8);

        UserModel.create({ username, email, password: hashedPassword, role }, (err, data) => {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Email already exists' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: 'User created successfully', user: data });
        });
    },

    login: (req, res) => {
        const { email, password } = req.body;

        UserModel.findByEmail(email, (err, user) => {
            if (err) return res.status(500).json({ error: 'Server error' });
            if (!user) return res.status(404).json({ error: 'User not found' });

            // Check if password matches (support both hashed and legacy plain text for now if needed, but let's stick to hash)
            // If existing users have plain text, this might fail. 
            // Simple check: if password matches plain text (legacy) OR bcrypt compare (new)

            let passwordIsValid = false;
            if (bcrypt.compareSync(password, user.password)) {
                passwordIsValid = true;
            } else if (user.password === password) {
                // Legacy plain text fallback (optional, but good for transition)
                passwordIsValid = true;
            }

            if (!passwordIsValid) {
                return res.status(401).json({ auth: false, token: null, error: 'Invalid password' });
            }

            const isLongLived = req.body.longLived === true;
            const expiresIn = isLongLived ? 86400 * 30 : 86400; // 30 days or 24 hours

            const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, {
                expiresIn: expiresIn
            });

            res.status(200).json({
                auth: true,
                token: token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    storage_limit: user.storage_limit || 10737418240,
                    used_storage: user.used_storage || 0,
                    preferences: user.preferences || {}
                }
            });
        });
    },

    getUsers: (req, res) => {
        UserModel.findAll((err, users) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(users);
        });
    },

    getUserById: (req, res) => {
        const id = req.params.id;
        UserModel.findById(id, (err, user) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json(user);
        });
    },

    getMe: (req, res) => {
        const id = req.user.id;
        UserModel.findById(id, (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) return res.status(404).json({ error: 'User not found' });

            // Return safe user data
            res.json({
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                storage_limit: user.storage_limit || 10737418240,
                used_storage: user.used_storage || 0,
                preferences: user.preferences || {}
            });
        });
    },

    updateUser: (req, res) => {
        const id = req.params.id;
        const { username, email, password, role, storage_limit } = req.body;

        // Basic validation could go here

        let updateData = { username, email, role, storage_limit };
        if (password) {
            updateData.password = bcrypt.hashSync(password, 8);
        }

        UserModel.update(id, updateData, (err, changes) => {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Email already exists' });
                }
                return res.status(500).json({ error: err.message });
            }
            if (changes === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json({ message: 'User updated successfully' });
        });
    },

    deleteUser: (req, res) => {
        const id = req.params.id;
        // Optional: Prevent deleting self
        // if (req.user.id == id) return res.status(400).json({ error: "Cannot delete yourself" });

        // First delete all user files
        FileModel.deleteAllByUserId(id, (err, fileResult) => {
            if (err) {
                console.error("Error deleting user files:", err);
                // Proceed to delete user anyway? Or fail?
                // Failing is safer to avoid partial state, but maybe we want to force delete user.
                // Let's return error.
                return res.status(500).json({ error: "Failed to delete user files: " + err.message });
            }

            UserModel.delete(id, (err, changes) => {
                if (err) return res.status(500).json({ error: err.message });
                if (changes === 0) return res.status(404).json({ error: 'User not found' });
                res.json({ message: 'User and their files deleted successfully' });
            });
        });
    },

    updatePreferences: (req, res) => {
        const id = req.user.id;
        const preferences = req.body;

        if (!preferences || typeof preferences !== 'object') {
            return res.status(400).json({ error: 'Invalid preferences format' });
        }

        // Fetch current user to merge preferences (optional, but good practice to not overwrite all if partial)
        // For now, let's assume the frontend sends the full or merged object, OR we merge here.
        // Let's doing a simple merge here.
        UserModel.findById(id, (err, user) => {
            if (err) return res.status(500).json({ error: 'Server error' });
            if (!user) return res.status(404).json({ error: 'User not found' });

            const currentPrefs = user.preferences || {};
            const newPrefs = { ...currentPrefs, ...preferences };

            UserModel.updatePreferences(id, newPrefs, (err) => {
                if (err) return res.status(500).json({ error: 'Failed to update preferences' });
                res.json({ message: 'Preferences updated', preferences: newPrefs });
            });
        });
    }
};

module.exports = userController;
