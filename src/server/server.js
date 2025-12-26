const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;

// Serve static files from the public client directory
app.use(express.static(path.join(__dirname, '../ui/public')));
app.use(express.json());

const systemRoutes = require('./routes/systemRoutes');
const { setElectronApp } = require('./controllers/systemController');
const userRoutes = require('./routes/userRoutes');
const fileRoutes = require('./routes/fileRoutes');

const transferRoutes = require('./routes/transferRoutes');
const editorRoutes = require('./routes/editorRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const backupRoutes = require('./routes/backupRoutes');
const vaultRoutes = require('./routes/vaultRoutes');
const TransferService = require('./services/transferService');

require('./socket')(io);

app.use('/api/users', userRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/files', fileRoutes);

app.use('/api/transfers', transferRoutes);
app.use('/api/editor', editorRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/vault', vaultRoutes);

// Start the transfer background worker
TransferService.start();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../ui/public/index.html'));
});

// Example API endpoint
app.get('/api/status', (req, res) => {
    res.json({ status: 'running', message: 'NAS Server is active' });
});

function startServer(electronAppInstance) {
    if (electronAppInstance) {
        setElectronApp(electronAppInstance);
    }

    // Recalculate storage usage for all users on startup
    const User = require('./models/userModel');
    User.findAll((err, users) => {
        if (!err && users) {
            users.forEach(user => {
                User.recalculateStorage(user.id, (err, total) => {
                    if (err) console.error(`Failed to recalculate storage for user ${user.id}:`, err);
                    else console.log(`Storage for user ${user.id} updated to ${total} bytes`);
                });
            });
        }
    });

    // Start Trash Cleanup Job (Run every 24 hours)
    setInterval(() => {
        const FileModel = require('./models/fileModel'); // Require inside to ensure DB is ready
        console.log('Running scheduled trash cleanup...');
        FileModel.deleteOldTrash(30, (err, changes) => {
            if (err) console.error('Error cleaning trash:', err);
            else if (changes > 0) console.log(`Cleaned up ${changes} old files from trash.`);
        });
    }, 24 * 60 * 60 * 1000);

    server.listen(port, () => {
        console.log(`NAS Server running at http://localhost:${port}`);
    });
}

module.exports = { startServer };
