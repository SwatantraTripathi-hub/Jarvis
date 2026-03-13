require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/db/db');
const { initSocketServer } = require('./src/sockets/socket.server');
const httpServer = require("http").createServer(app);

const PORT = Number(process.env.PORT) || 10000;
const HOST = '0.0.0.0';

connectDB().catch((error) => {
    console.error('MongoDB connection failed during startup:', error.message);
});

initSocketServer(httpServer);

httpServer.listen(PORT, HOST, () => {
    console.log(`Server is running on ${HOST}:${PORT}`);
});

httpServer.on('error', (error) => {
    console.error('HTTP server failed to start:', error.message);
    process.exit(1);
});
