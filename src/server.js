const express = require('express');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.AUTH_SERVER_PORT || process.env.PORT || 3000;

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    logger.info(`[AuthServer] ${req.method} ${req.url}`);
    next();
});

/**
 * Authentication Endpoint
 * GET /api/auth?uuid=<PLAYER_UUID>
 * Always returns HTTP 200 OK (Authorized)
 */
app.get('/api/auth', (req, res) => {
    const playerUuid = req.query.uuid;

    if (!playerUuid) {
        logger.warn('[AuthServer] ⚠️ Request received without player UUID');
    } else {
        logger.info(`[AuthServer] ✅ Player authenticated: ${playerUuid}`);
    }

    // Always respond with 200 OK
    res.status(200).json({
        authorized: true,
        status: 200,
        message: "Access Granted",
        playerUuid: playerUuid || null,
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

function startServer(port = PORT) {
    return app.listen(port, () => {
        logger.info(`=================================`);
        logger.info(`🚀 Auth API Server is running!`);
        logger.info(`📍 Endpoint: http://localhost:${port}/api/auth`);
        logger.info(`=================================`);
    });
}

if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };
