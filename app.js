import "dotenv/config";
import { logging } from './src/utils/logging/index.js';
import fastify from './src/utils/config/index.js';

import uploadRoutes from "./src/routes/v1/upload.routes.js";
import userRoutes from "./src/routes/v1/user.routes.js";
fastify.register(uploadRoutes, {prefix: '/v1'});
fastify.register(userRoutes, {prefix: '/v1'});

// fastify
fastify.listen({ port: process.env.FASTIFY_PORT || 3000 , host: '0.0.0.0' }, (err, address) => {
    const logger = logging.getLogger(process.env.LOGGING_BASE_NAME);
    logger.addTransport(new logging.transports.Console({ level: logging.UNIT, timezone: process.env.LOGGING_TIMEZONE }))
    logger.addTransport(new logging.transports.FileRotate({
        level: logging.UNIT,
        timezone: process.env.LOGGING_TIMEZONE,
        filename: process.env.LOGGING_FILENAME || 'runtime.log',
        maxSize: '20m',
        maxFiles: '7d',
    }))

    if (err) {
        logger.error(err.stack)
        process.exit(1)
    }
    
    logger.info(`server listening on ${address}`)
})
