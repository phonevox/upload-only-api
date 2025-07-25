import jwt from 'jsonwebtoken'
import { logging } from '../../utils/logging/index.js'

const logger = logging.getLogger(process.env.LOGGING_BASE_NAME + '.utils.jwt')

export const verifyToken = async (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        logger.unit('Token válido.')
        return true
    } catch (error) {
        logger.error('Erro ao verificar token:', error)
        throw error
    }
}

export const tokenify = async (payload, expiresIn) => {
    try {
        if (expiresIn === undefined) {
            logger.unit('Token será gerado sem expiração.')
            return jwt.sign(payload, process.env.JWT_SECRET)
        }

        logger.unit(`Expiração customizada definida: ${expiresIn}`)
        return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn })
    } catch (error) {
        logger.error('Erro ao gerar token:', error)
        throw error
    }
}