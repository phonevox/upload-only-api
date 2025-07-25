import 'dotenv/config'
import { prisma } from '../prisma/client.js'
import crypto from 'crypto'
import bcrypt from 'bcrypt'

async function main() {
    const existing = await prisma.user.findUnique({
        where: { username: 'root' }
    })

    if (existing) {
        console.log('ℹ️ Usuário root já existe. Nenhuma ação necessária.')
        return
    }

    const rawPassword = process.env.DATABASE_ROOT_PASSWORD || 'root'
    const hashedPassword = await bcrypt.hash(rawPassword, 10)

    const user = await prisma.user.create({
        data: {
            username: 'root',
            password: hashedPassword,
            role: 'superadmin',
            token: crypto.randomUUID()
        }
    })

    console.log('\n✅ Usuário root criado:')
    console.log(`👤 Username: ${user.username}`)
    console.log(`🔐 Password: ${rawPassword}`)
    console.log(`🧾 Role: ${user.role}`)
    console.log(`🪪 Token: ${user.token}\n`)
}

main()
    .catch(err => {
        console.error('❌ Seed falhou:', err)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
