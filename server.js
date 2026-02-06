import dotenv from 'dotenv';

// Load environment variables FIRST, before any other imports
// This is critical because imports trigger Prisma initialization which needs DATABASE_URL
dotenv.config();

import app from './app.js';
import { initializeDatabase } from './src/database/db.js';

const PORT = process.env.PORT || 5000;

// Initialize database
const startServer = async () => {
    try {
        await initializeDatabase();
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        process.exit(1);
    }

    // Start server
    app.listen(PORT, () => {
        console.log(`\n🚀 Server running on port ${PORT}`);
        console.log(`📍 API URL: http://localhost:${PORT}/api`);
        console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
        console.log(`\n⏳ Waiting for GPU SSH connection details...\n`);
    });
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
});
