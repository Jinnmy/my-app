const jwt = require('jsonwebtoken');
const secretKey = 'your-secret-key';

module.exports = (io) => {
    // Middleware for Auth
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }
        jwt.verify(token, secretKey, (err, decoded) => {
            if (err) return next(new Error('Authentication error'));
            socket.user = decoded;
            next();
        });
    });

    io.on('connection', (socket) => {
        console.log('User connected:', socket.user.id);

        socket.on('join-document', (fileId) => {
            socket.join(fileId);
            console.log(`User ${socket.user.id} joined document ${fileId}`);
        });

        socket.on('send-changes', (data) => {
            // data should contain { delta, fileId }
            socket.to(data.fileId).emit('receive-changes', data.delta);
        });

        // Cursor position sync (optional but nice)
        socket.on('cursor-change', (data) => {
            socket.to(data.fileId).emit('cursor-change', {
                userId: socket.user.id,
                range: data.range
            });
        });

        socket.on('disconnect', () => {
            console.log('User disconnected');
        });
    });
};
