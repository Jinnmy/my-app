const db = require('../config/database');

// Initialize User table
const initUserTable = () => {
    const sql = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;
    db.run(sql, (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        } else {
            console.log('Users table ready.');
            // Migration: Add role column if it doesn't exist (for existing databases)
            const migrationSql = `ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`;
            db.run(migrationSql, (err) => {
                // Ignore error if column already exists
                if (!err) {
                    console.log('Added role column to users table.');
                }
            });
        }
    });
};

initUserTable();

class UserModel {
    static create(user, callback) {
        const { username, email, password, role } = user;
        const userRole = role || 'user';
        const sql = `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`;
        db.run(sql, [username, email, password, userRole], function (err) {
            callback(err, { id: this.lastID, ...user, role: userRole });
        });
    }

    static findByEmail(email, callback) {
        const sql = `SELECT * FROM users WHERE email = ?`;
        db.get(sql, [email], (err, row) => {
            callback(err, row);
        });
    }

    static findById(id, callback) {
        const sql = `SELECT * FROM users WHERE id = ?`;
        db.get(sql, [id], (err, row) => {
            callback(err, row);
        });
    }

    static findAll(callback) {
        const sql = `SELECT * FROM users`;
        db.all(sql, [], (err, rows) => {
            callback(err, rows);
        });
    }
}

module.exports = UserModel;
