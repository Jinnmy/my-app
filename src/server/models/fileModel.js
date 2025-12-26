const db = require('../config/database');

// Initialize Files table
const initFileTable = () => {
    const sql = `
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('file', 'folder')),
            size INTEGER DEFAULT 0,
            parent_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES files(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `;
    db.run(sql, (err) => {
        if (err) {
            console.error('Error creating files table:', err.message);
        } else {
            console.log('Files table ready.');
            // Migration: Add user_id column if it doesn't exist
            const migrationSql = `ALTER TABLE files ADD COLUMN user_id INTEGER REFERENCES users(id)`;
            db.run(migrationSql, (err) => {
                if (!err) {
                    console.log('Added user_id column to files table.');
                }
            });

            // Migration: Add caption and tags columns
            const captionSql = `ALTER TABLE files ADD COLUMN caption TEXT`;
            db.run(captionSql, (err) => {
                if (!err) console.log('Added caption column to files table.');
            });

            const tagsSql = `ALTER TABLE files ADD COLUMN tags TEXT`;
            db.run(tagsSql, (err) => {
                if (!err) console.log('Added tags column to files table.');
            });
            // Migration: Add last_accessed_at column
            const lastAccessSql = `ALTER TABLE files ADD COLUMN last_accessed_at DATETIME`;
            db.run(lastAccessSql, (err) => {
                if (!err) console.log('Added last_accessed_at column to files table.');
            });

            // Migration: Add soft delete columns
            const isDeletedSql = `ALTER TABLE files ADD COLUMN is_deleted INTEGER DEFAULT 0`;
            db.run(isDeletedSql, (err) => {
                if (!err) console.log('Added is_deleted column to files table.');
            });
            const trashedAtSql = `ALTER TABLE files ADD COLUMN trashed_at DATETIME`;
            db.run(trashedAtSql, (err) => {
                if (!err) console.log('Added trashed_at column to files table.');
            });
        }
    });

    // Create Shared Files Table
    const shareSql = `
        CREATE TABLE IF NOT EXISTS shared_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL, -- User who receives access
            permission TEXT DEFAULT 'view', -- 'view' or 'edit'
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(file_id, user_id)
        )
    `;
    db.run(shareSql, (err) => {
        if (err) console.error('Error creating shared_files table:', err.message);
        else console.log('Shared files table ready.');
    });

    // Migration: Add is_locked and password_hash
    const lockSql = `ALTER TABLE files ADD COLUMN is_locked INTEGER DEFAULT 0`;
    db.run(lockSql, (err) => {
        if (!err) console.log('Added is_locked column to files table.');
    });
    const passSql = `ALTER TABLE files ADD COLUMN password_hash TEXT`;
    db.run(passSql, (err) => {
        if (!err) console.log('Added password_hash column to files table.');
    });
    // Create Share Links Table
    const shareLinkSql = `
        CREATE TABLE IF NOT EXISTS share_links (
            token TEXT PRIMARY KEY,
            file_id INTEGER NOT NULL,
            created_by INTEGER,
            expires_at DATETIME, -- NULL means no expiry
            max_uses INTEGER,    -- NULL means unlimited
            used_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        )
    `;
    db.run(shareLinkSql, (err) => {
        if (err) console.error('Error creating share_links table:', err.message);
        else console.log('Share links table ready.');
    });

    // Migration: Add is_encrypted column
    const encryptedSql = `ALTER TABLE files ADD COLUMN is_encrypted INTEGER DEFAULT 0`;
    db.run(encryptedSql, (err) => {
        if (!err) console.log('Added is_encrypted column to files table.');
    });
};

initFileTable();

class FileModel {
    static create(file, callback) {
        const { name, path: filePath, type, size, parent_id, user_id, caption, tags, is_encrypted } = file;
        const sql = `INSERT INTO files (name, path, type, size, parent_id, user_id, caption, tags, is_encrypted, last_accessed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
        const tagsStr = tags ? JSON.stringify(tags) : null;
        const encryptedVal = is_encrypted ? 1 : 0;

        db.run(sql, [name, filePath, type, size, parent_id, user_id, caption, tagsStr, encryptedVal], function (err) {
            callback(err, { id: this.lastID, ...file });
        });
    }

    static findById(id, callback) {
        const sql = `SELECT * FROM files WHERE id = ?`;
        db.get(sql, [id], (err, row) => {
            callback(err, row);
        });
    }

    static findByPath(path, callback) {
        const sql = `SELECT * FROM files WHERE path = ? AND (is_deleted = 0 OR is_deleted IS NULL)`;
        db.get(sql, [path], (err, row) => {
            callback(err, row);
        });
    }

    static findByParentId(userId, parentId, limit, offset, callback) {
        // Handle optional pagination arguments
        if (typeof limit === 'function') {
            callback = limit;
            limit = 100;
            offset = 0;
        }

        let sql = ``;
        let params = [];

        if (parentId) {
            // Inside a folder
            // 1. Check if parent folder is shared with user
            const checkShare = `SELECT 1 FROM shared_files WHERE file_id = ? AND user_id = ?`;
            db.get(checkShare, [parentId, userId], (err, row) => {
                if (row) {
                    // Parent is shared, so list its children
                    sql = `SELECT * FROM files WHERE parent_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) AND is_encrypted = 0 ORDER BY type DESC, name ASC LIMIT ? OFFSET ?`;
                    db.all(sql, [parentId, limit, offset], (err, rows) => callback(err, rows));
                } else {
                    // Parent not shared explicitly, check ownership.
                    sql = `SELECT * FROM files WHERE user_id = ? AND parent_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) AND is_encrypted = 0 ORDER BY type DESC, name ASC LIMIT ? OFFSET ?`;
                    db.all(sql, [userId, parentId, limit, offset], (err, rows) => callback(err, rows));
                }
            });
            return;
        } else {
            // Root: Own files (parent is null) OR Shared files (files shared with me)
            sql = `
                SELECT * FROM (
                    SELECT f.*, 'owner' as role FROM files f 
                    WHERE f.user_id = ? AND f.parent_id IS NULL AND (f.is_deleted = 0 OR f.is_deleted IS NULL) AND f.is_encrypted = 0
                    
                    UNION
                    
                    SELECT f.*, sf.permission as role FROM files f
                    JOIN shared_files sf ON f.id = sf.file_id
                    WHERE sf.user_id = ? AND (f.is_deleted = 0 OR f.is_deleted IS NULL) AND f.is_encrypted = 0
                ) ORDER BY type DESC, name ASC LIMIT ? OFFSET ?
            `;
            params = [userId, userId, limit, offset];

            db.all(sql, params, (err, rows) => {
                callback(err, rows);
            });
        }
    }

    static countByParentId(userId, parentId, callback) {
        if (parentId) {
            // Inside a folder
            const checkShare = `SELECT 1 FROM shared_files WHERE file_id = ? AND user_id = ?`;
            db.get(checkShare, [parentId, userId], (err, row) => {
                let sql = '';
                let params = [];
                if (row) {
                    // Shared parent
                    sql = `SELECT COUNT(*) as count FROM files WHERE parent_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)`;
                    params = [parentId];
                } else {
                    // Owned parent
                    sql = `SELECT COUNT(*) as count FROM files WHERE user_id = ? AND parent_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)`;
                    params = [userId, parentId];
                }
                db.get(sql, params, (err, result) => {
                    callback(err, result ? result.count : 0);
                });
            });
            return;
        } else {
            // Root
            const sql = `
                SELECT COUNT(*) as count FROM (
                    SELECT f.id FROM files f 
                    WHERE f.user_id = ? AND f.parent_id IS NULL AND (f.is_deleted = 0 OR f.is_deleted IS NULL)
                    
                    UNION
                    
                    SELECT f.id FROM files f
                    JOIN shared_files sf ON f.id = sf.file_id
                    WHERE sf.user_id = ? AND (f.is_deleted = 0 OR f.is_deleted IS NULL)
                )
            `;
            db.get(sql, [userId, userId], (err, result) => {
                callback(err, result ? result.count : 0);
            });
        }
    }

    static findAll(callback) {
        const sql = `SELECT * FROM files WHERE is_encrypted = 0`;
        db.all(sql, [], (err, rows) => {
            callback(err, rows);
        });
    }

    // Vault Specific
    static findEncrypted(userId, limit, offset, callback) {
        const sql = `
            SELECT * FROM files 
            WHERE user_id = ? AND is_encrypted = 1 AND (is_deleted = 0 OR is_deleted IS NULL)
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;
        db.all(sql, [userId, limit, offset], (err, rows) => {
            callback(err, rows);
        });
    }

    static updateParent(id, parentId, callback) {
        const sql = `UPDATE files SET parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [parentId, id], function (err) {
            callback(err);
        });
    }

    static updateLocation(id, parentId, path, callback) {
        const sql = `UPDATE files SET parent_id = ?, path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [parentId, path, id], function (err) {
            callback(err);
        });
    }

    static updateDetails(id, name, path, type, oldPath, caption, tags, callback) {
        // 1. Update the item itself
        const sql = `UPDATE files SET name = ?, path = ?, caption = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        const tagsStr = tags ? JSON.stringify(tags) : null;

        console.log(`[FileModel] updateDetails called for ID: ${id}, Caption: "${caption ? caption.substring(0, 20) + '...' : 'null'}", Tags: ${tagsStr}`);

        db.run(sql, [name, path, caption, tagsStr, id], function (err) {
            if (err) {
                console.error(`[FileModel] Update error for ${id}:`, err);
                return callback(err);
            }
            console.log(`[FileModel] Update success for ${id}. Rows changed: ${this.changes}`);

            // 2. If it is a folder AND path changed, update all children paths
            if (type === 'folder' && path !== oldPath) {
                // SQLite concatenation operator is ||
                // We want to replace the start of the path for all children
                const updateChildrenSql = `
                    UPDATE files 
                    SET path = ? || SUBSTR(path, LENGTH(?) + 1) 
                    WHERE path LIKE ? || '%'
                `;
                db.run(updateChildrenSql, [path, oldPath, oldPath], (err) => {
                    callback(err);
                });
            } else {
                callback(null);
            }
        });
    }

    static search(userId, query, type, callback) {
        let sql = `SELECT * FROM files WHERE user_id = ? AND (name LIKE ? OR caption LIKE ? OR tags LIKE ?) AND (is_deleted = 0 OR is_deleted IS NULL)`;
        const wildcard = `%${query}%`;
        const params = [userId, wildcard, wildcard, wildcard];

        if (type) {
            sql += ` AND type = ?`;
            params.push(type);
        }

        db.all(sql, params, (err, rows) => {
            callback(err, rows);
        });
    }

    static delete(id, callback) {
        // Soft Delete
        const sql = `UPDATE files SET is_deleted = 1, trashed_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [id], function (err) {
            callback(err, this.changes);
        });
    }

    static restore(id, callback) {
        const sql = `UPDATE files SET is_deleted = 0, trashed_at = NULL WHERE id = ?`;
        db.run(sql, [id], function (err) {
            callback(err, this.changes);
        });
    }

    static permanentDelete(id, callback) {
        const sql = `DELETE FROM files WHERE id = ?`;
        db.run(sql, [id], function (err) {
            callback(err, this.changes);
        });
    }

    // Locking Methods
    static lock(id, passwordHash, callback) {
        const sql = `UPDATE files SET is_locked = 1, password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [passwordHash, id], function (err) {
            callback(err);
        });
    }

    static unlock(id, callback) {
        // Clear hash and unlock
        const sql = `UPDATE files SET is_locked = 0, password_hash = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [id], function (err) {
            callback(err);
        });
    }

    static getPasswordHash(id, callback) {
        const sql = `SELECT password_hash FROM files WHERE id = ?`;
        db.get(sql, [id], (err, row) => {
            callback(err, row ? row.password_hash : null);
        });
    }

    static findTrashed(userId, callback) {
        const sql = `SELECT * FROM files WHERE user_id = ? AND is_deleted = 1 ORDER BY trashed_at DESC`;
        db.all(sql, [userId], (err, rows) => {
            callback(err, rows);
        });
    }

    static emptyTrash(userId, callback) {
        // 1. Get all trashed files to delete from disk
        const sqlGet = `SELECT * FROM files WHERE user_id = ? AND is_deleted = 1`;
        db.all(sqlGet, [userId], (err, files) => {
            if (err) return callback(err);

            // 2. Delete from disk (best effort)
            const fs = require('fs');
            let deleteErrors = [];

            files.forEach(file => {
                try {
                    if (fs.existsSync(file.path)) {
                        fs.rmSync(file.path, { recursive: true, force: true });
                    }
                } catch (e) {
                    console.error(`Failed to delete file from disk: ${file.path}`, e);
                    deleteErrors.push(e.message);
                }
            });

            // 3. Delete from DB
            const sqlDelete = `DELETE FROM files WHERE user_id = ? AND is_deleted = 1`;
            db.run(sqlDelete, [userId], function (err) {
                if (err) return callback(err);

                // Update storage usage
                const UserModel = require('../models/userModel');
                // Calculate total size freed
                const totalSize = files.reduce((acc, file) => acc + (file.size || 0), 0);

                if (totalSize > 0) {
                    UserModel.updateStorage(userId, -totalSize, (err) => {
                        if (err) console.error('Failed to update storage after emptying trash:', err);
                    });
                }

                callback(null, { deletedCount: this.changes, errors: deleteErrors });
            });
        });
    }

    static deleteAllByUserId(userId, callback) {
        // 1. Get all files to delete from disk
        const sqlGet = `SELECT * FROM files WHERE user_id = ?`;
        db.all(sqlGet, [userId], (err, files) => {
            if (err) return callback(err);

            // 2. Delete from disk (best effort)
            const fs = require('fs');

            files.forEach(file => {
                try {
                    if (fs.existsSync(file.path)) {
                        fs.rmSync(file.path, { recursive: true, force: true });
                    }
                } catch (e) {
                    console.error(`Failed to delete file from disk during user deletion: ${file.path}`, e);
                }
            });

            // 3. Delete from DB
            const sqlDelete = `DELETE FROM files WHERE user_id = ?`;
            db.run(sqlDelete, [userId], function (err) {
                if (err) return callback(err);

                // Also clean up shared files where this user is the recipient
                const sqlDeleteShares = `DELETE FROM shared_files WHERE user_id = ?`;
                db.run(sqlDeleteShares, [userId], (err) => {
                    callback(err, { deletedCount: this.changes });
                });
            });
        });
    }

    static deleteOldTrash(days, callback) {
        const sql = `DELETE FROM files WHERE is_deleted = 1 AND trashed_at < datetime('now', '-' || ? || ' days')`;
        db.run(sql, [days], function (err) {
            if (callback) callback(err, this.changes);
        });
    }

    // Share Methods
    static share(fileId, targetUserId, permission, callback) {
        const sql = `INSERT OR REPLACE INTO shared_files (file_id, user_id, permission) VALUES (?, ?, ?)`;
        db.run(sql, [fileId, targetUserId, permission], function (err) {
            callback(err);
        });
    }

    static unshare(fileId, targetUserId, callback) {
        const sql = `DELETE FROM shared_files WHERE file_id = ? AND user_id = ?`;
        db.run(sql, [fileId, targetUserId], function (err) {
            callback(err);
        });
    }

    static getSharedUsers(fileId, callback) {
        const sql = `
            SELECT u.id, u.username, u.email, sf.permission
            FROM users u
            JOIN shared_files sf ON u.id = sf.user_id
            WHERE sf.file_id = ?
        `;
        db.all(sql, [fileId], (err, rows) => callback(err, rows));
    }

    static isSharedWith(fileId, userId, callback) {
        const sql = `SELECT 1 FROM shared_files WHERE file_id = ? AND user_id = ?`;
        db.get(sql, [fileId, userId], (err, row) => {
            callback(err, !!row);
        });
    }

    // Share Link Methods
    static createShareLink(fileId, userId, token, expiresAt, maxUses, callback) {
        const sql = `INSERT INTO share_links (token, file_id, created_by, expires_at, max_uses) VALUES (?, ?, ?, ?, ?)`;
        db.run(sql, [token, fileId, userId, expiresAt, maxUses], function (err) {
            callback(err);
        });
    }

    static findShareLink(token, callback) {
        const sql = `SELECT * FROM share_links WHERE token = ?`;
        db.get(sql, [token], (err, row) => {
            callback(err, row);
        });
    }

    static incrementShareLinkUsage(token, callback) {
        const sql = `UPDATE share_links SET used_count = used_count + 1 WHERE token = ?`;
        db.run(sql, [token], function (err) {
            callback(err);
        });
    }

    static deleteShareLink(token, callback) {
        const sql = `DELETE FROM share_links WHERE token = ?`;
        db.run(sql, [token], function (err) {
            callback(err);
        });
    }

    // Track Access
    static updateLastAccessed(id, callback) {
        const sql = `UPDATE files SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [id], function (err) {
            callback(err);
        });
    }

    static findRecentlyAccessed(userId, limit, callback) {
        // Find files accessed by user (owned) or shared?
        // Let's focus on owned files for now, or broadly "files I have access to" that were recently accessed.
        // It's tricky if we don't track *who* accessed it in a separate table (access_logs). 
        // Currently 'last_accessed_at' is on the file itself.
        // So updateLastAccessed updates it for EVERYONE.
        // This means if I share a file and you read it, it becomes "recently accessed" for ME too.
        // For a simple NAS, this is acceptable. 
        // We will just filter by user_id to show "My Recently Accessed" (files I own that were accessed).
        // OR we can join with shared_files.
        // Given the constraints, let's show files the user OWNS that were recently accessed.

        const sql = `
            SELECT * FROM files 
            WHERE user_id = ? AND last_accessed_at IS NOT NULL AND (is_deleted = 0 OR is_deleted IS NULL) AND is_encrypted = 0
            ORDER BY last_accessed_at DESC 
            LIMIT ?
        `;
        db.all(sql, [userId, limit], (err, rows) => {
            callback(err, rows);
        });
    }

    // Check availability of multiple files (for duplicate detection)
    static checkExistence(userId, parentId, filenames, callback) {
        if (!filenames || filenames.length === 0) {
            return callback(null, []);
        }

        const placeholders = filenames.map(() => '?').join(',');
        let sql = `SELECT name FROM files WHERE user_id = ? AND name IN (${placeholders}) AND (is_deleted = 0 OR is_deleted IS NULL)`;
        const params = [userId, ...filenames];

        if (parentId) {
            sql += ` AND parent_id = ?`;
            params.push(parentId);
        } else {
            sql += ` AND parent_id IS NULL`;
        }

        db.all(sql, params, (err, rows) => {
            if (err) return callback(err);
            // Return array of names that exist
            const existingNames = rows.map(row => row.name);
            callback(null, existingNames);
        });
    }

    // Unmarked Files Management
    static findUnmarked(callback) {
        // Return only "Top Level" unmarked files.
        // A file is top-level unmarked if its user_id is NULL AND (its parent_id is NULL OR its parent has user_id IS NOT NULL).
        // Essentially, we want to hide files whose parent is ALSO unmarked (because they are inside an unmarked folder).

        // Complex query:
        // SELECT f.* FROM files f
        // LEFT JOIN files parent ON f.parent_id = parent.id
        // WHERE f.user_id IS NULL AND (f.is_deleted = 0 OR ...)
        // AND (f.parent_id IS NULL OR parent.user_id IS NOT NULL)

        const sql = `
            SELECT f.* FROM files f
            LEFT JOIN files parent ON f.parent_id = parent.id
            WHERE f.user_id IS NULL 
            AND (f.is_deleted = 0 OR f.is_deleted IS NULL)
            AND (f.parent_id IS NULL OR parent.user_id IS NOT NULL)
        `;
        db.all(sql, [], (err, rows) => {
            callback(err, rows);
        });
    }

    static allocate(fileIds, userId, callback) {
        if (!fileIds || fileIds.length === 0) return callback(null, 0);

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // 1. Update direct items
            const placeholders = fileIds.map(() => '?').join(',');
            const sqlUpdateDirect = `UPDATE files SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
            const params = [userId, ...fileIds];

            db.run(sqlUpdateDirect, params, function (err) {
                if (err) {
                    console.error('Allocation error (direct):', err);
                    db.run('ROLLBACK');
                    return callback(err);
                }

                const changes = this.changes;

                // 2. Update children (recursive ownership)
                // Fetch paths of the allocated items to find folders
                const sqlGetPaths = `SELECT path, type FROM files WHERE id IN (${placeholders})`;
                db.all(sqlGetPaths, fileIds, (err, rows) => {
                    if (err) {
                        console.error('Allocation error (fetch paths):', err);
                        db.run('ROLLBACK');
                        return callback(err);
                    }

                    // Filter only folders
                    const folders = rows.filter(r => r.type === 'folder');

                    if (folders.length === 0) {
                        db.run('COMMIT', (err) => {
                            if (err) return callback(err);
                            callback(null, changes);
                        });
                        return;
                    }

                    // Update children for each folder
                    // We do this sequentially to accept any number of folders without blowing stack or expression tree
                    let completed = 0;
                    let hasError = false;

                    const runNext = (index) => {
                        if (index >= folders.length) {
                            if (!hasError) {
                                db.run('COMMIT', (err) => {
                                    if (err) return callback(err);
                                    callback(null, changes); // We return direct changes, or maybe total? managing total is hard async.
                                });
                            }
                            return;
                        }

                        const folder = folders[index];
                        // Update all files that start with this path
                        const childSql = `UPDATE files SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE path LIKE ? OR path LIKE ?`;
                        // Coverage for both slash types if mixed, though usually one per system.
                        db.run(childSql, [userId, folder.path + '\\%', folder.path + '/%'], (err) => {
                            if (err) {
                                hasError = true;
                                console.error('Allocation error (children):', err);
                                db.run('ROLLBACK');
                                return callback(err);
                            }
                            runNext(index + 1);
                        });
                    };

                    runNext(0);
                });
            });
        });
    }

    static createUnmarked(file, callback) {
        const { name, path, type, size, parent_id } = file;
        const sql = `INSERT INTO files (name, path, type, size, parent_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;

        db.run(sql, [name, path, type, size, parent_id], function (err) {
            callback(err, this.lastID);
        });
    }

    // Sync Helpers
    static getAllPaths(callback) {
        const sql = `SELECT path FROM files WHERE is_deleted = 0 OR is_deleted IS NULL`;
        db.all(sql, [], (err, rows) => {
            if (err) return callback(err);
            const paths = new Set(rows.map(row => row.path));
            callback(null, paths);
        });
    }

    static bulkCreateUnmarked(files, callback) {
        if (!files || files.length === 0) return callback(null);

        // SQLite doesn't support bulk insert efficiently with a single statement limit easily for huge sets, 
        // but transaction is best here.
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            const stmt = db.prepare(`INSERT INTO files (name, path, type, size, parent_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);

            files.forEach(f => {
                stmt.run(f.name, f.path, f.type, f.size);
            });

            stmt.finalize(err => {
                if (err) {
                    db.run('ROLLBACK');
                    return callback(err);
                }
                db.run('COMMIT', (err) => {
                    callback(err);
                });
            });
        });
    }
}

module.exports = FileModel;
