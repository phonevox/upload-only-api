import bcrypt from 'bcrypt'
import { logging } from '../../utils/logging/index.js'

const logger = logging.getLogger(process.env.LOGGING_BASE_NAME + '.utils.bcrypt')

export const generateHash = async (password) => {
    try {
        const saltRounds = 12;

        const start = performance.now(); // Marca o início
        const salt = await bcrypt.genSalt(saltRounds);
        const hash = await bcrypt.hash(password, salt);
        const end = performance.now(); // Marca o fim

        logger.info(`Tempo para gerar hash com ${saltRounds} rounds: ${(end - start).toFixed(2)} ms`);

        return hash;
    } catch (error) {
        logger.error('Erro ao gerar hash da senha:', error);
        throw error;
    }
}

export const comparePassword = async (password, hash) => {
    try {
        const start = performance.now(); // Marca o início
        const result = await bcrypt.compare(password, hash);
        const end = performance.now(); // Marca o fim

        logger.info(`Tempo para comparar senha: ${(end - start).toFixed(2)} ms`);

        return result;
    } catch (error) {
        logger.error('Erro ao comparar senhas:', error);
        throw error;
    }
}