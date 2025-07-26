import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { logging } from '../logging/index.js'

// initialization
const fastify = Fastify({
    logger: false,
    bodyLimit: parseInt(process.env.FASTIFY_BODY_LIMIT_MB || 500) * 1024 * 1024
})

// cors
await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Custom-Header'],
    credentials: true,
    maxAge: 86400,
    preflightContinue: false
})

// helmet for http headers security
await fastify.register(helmet, {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:']
        }
    }
})

// add content type parser for json
fastify.removeAllContentTypeParsers()
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
        const json = JSON.parse(body)
        done(null, json)
    } catch (err) {
        done(err)
    }
})

// logging hook before validation
fastify.addHook('onRequest', (request, reply, done) => {
    const remoteAddress = request.ip || 'unknown'
    const logData = {
        method: request.method,
        url: request.url,
        remoteAddress: remoteAddress,
        headers: request.headers,
        body: request.body,
        query: request.query,
        params: request.params,
    }
    request.logger = logging.getLogger(process.env.LOGGING_BASE_NAME + '.[' + remoteAddress + ':' + logData.method + ':' + logData.url +']')
    
    if (process.env.FASTIFY_LOG_EVERY_REQUEST_DATA === 'true') {
        request.logger.info(JSON.stringify(logData))
    } else {
        request.logger.info('Request received')
    }
    done();
})

// error handling
fastify.setErrorHandler((error, req, reply) => {
    const logger = logging.getLogger(req.logger?.name + '.defaultErrorHandler')
    logger.error(error.stack)
  
    if (error.message && error.message.includes('Unsupported Media Type')) {
      return reply.status(415).send({ message: "Unsupported Media Type" })
    }
  
    return reply.status(error.statusCode ?? 500).send({
      message: 'Internal server error'
    })
  })


export default fastify