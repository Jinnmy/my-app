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
const TransferService = require('./services/transferService');

require('./socket')(io);

app.use('/api/users', userRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/files', fileRoutes);

app.use('/api/transfers', transferRoutes);
app.use('/api/editor', editorRoutes);

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

    server.listen(port, () => {
        console.log(`NAS Server running at http://localhost:${port}`);
    });
}

module.exports = { startServer };
