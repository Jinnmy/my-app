const UserModel = require('../models/userModel');

const userController = {
    createUser: (req, res) => {
        const { username, email, password, role } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        UserModel.create({ username, email, password, role }, (err, data) => {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Email already exists' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: 'User created successfully', user: data });
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
    }
};

module.exports = userController;
