require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/db/db');
const { initSocketServer } = require('./src/sockets/socket.server');

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

async function startServer() {
    // 1. Connect DB — non-fatal so server still starts if DB is slow
    try {
        await connectDB();
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
    }

    // 2. Create HTTP server and attach Socket.IO
    const httpServer = http.createServer(app);
    initSocketServer(httpServer);

    // 3. Bind port — THIS must happen for Render not to time out
    httpServer.listen(PORT, HOST, () => {
        console.log(`Server running on ${HOST}:${PORT}`);
    });

    httpServer.on('error', (err) => {
        console.error('HTTP server failed to bind:', err.message);
        process.exit(1);
    });
}

startServer();
