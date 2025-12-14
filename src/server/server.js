const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files from the public client directory
app.use(express.static(path.join(__dirname, '../ui/public')));
app.use(express.json());

const systemRoutes = require('./routes/systemRoutes');
const { setElectronApp } = require('./controllers/systemController');
const userRoutes = require('./routes/userRoutes');
const fileRoutes = require('./routes/fileRoutes');
const transferRoutes = require('./routes/transferRoutes');
const TransferService = require('./services/transferService');

app.use('/api/users', userRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/transfers', transferRoutes);

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
    app.listen(port, () => {
        console.log(`NAS Server running at http://localhost:${port}`);
    });
}

module.exports = { startServer };
