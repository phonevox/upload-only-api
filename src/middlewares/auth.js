import { prisma } from '../prisma/client.js'
import { logging } from '../utils/logging/index.js'
import { verifyToken } from '../utils/jwt/index.js'

export async function requireAuth(req, reply) {
    const logger = logging.getLogger(`${req?.logger?.name}.requireAuth`)
    const authHeader = req.headers['authorization']

    if (!authHeader?.startsWith('Bearer ')) {
        logger.warn('No token provided for authentication')
        return reply.code(401).send({ message: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]

    try {
        // Valida o token (pode lançar erro)
        verifyToken(token)

        // Busca o usuário no banco
        const user = await prisma.user.findUnique({ where: { token } })

        if (!user) {
            logger.warn('User not found in database')
            return reply.code(401).send({ message: 'Invalid token' })
        }

        // Anexa o usuário à requisição
        req.user = {
            id: user.id,
            name: user.name,
            role: user.role
        }

    } catch (err) {
        logger.warn(`Authentication failed: ${err?.message || err}`)
        return reply.code(401).send({ message: 'Invalid token' })
    }
}

export function requireRole(...allowedRoles) {
    return async function (req, reply) {
        if (!req.user) {
            req.logger.warn('User is not authenticated. Method requireAuth must be called before requireRole') || console.log('User is not authenticated. Method requireAuth must be called before requireRole')
            return reply.code(401).send({ message: 'Unauthorized' });
        }

        const role = req.user?.role;
        if (!role || !allowedRoles.includes(role)) {
            return reply.code(403).send({ message: 'Insufficient role' });
        } 
    };
}