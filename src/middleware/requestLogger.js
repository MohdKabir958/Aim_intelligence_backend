/**
 * Request logger middleware
 */
export function requestLogger(req, res, next) {
    const start = Date.now();

    // Log after response
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logMessage = `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`;

        if (res.statusCode >= 400) {
            console.error(`❌ ${logMessage}`);
        } else {
            console.log(`✅ ${logMessage}`);
        }
    });

    next();
}
