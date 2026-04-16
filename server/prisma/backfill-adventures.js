import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfill() {
    // 1. Criar aventura padrao (idempotente)
    let adventure = await prisma.adventure.findFirst({ where: { nome: 'main' } })
    if (!adventure) {
        adventure = await prisma.adventure.create({ data: { nome: 'main' } })
        console.log(`Aventura criada: id=${adventure.id}`)
    } else {
        console.log(`Aventura ja existe: id=${adventure.id}`)
    }

    // 2. Para cada usuario, criar AdventureUser com o role atual
    const users = await prisma.user.findMany()
    for (const user of users) {
        const exists = await prisma.adventureUser.findUnique({
            where: { userId_adventureId: { userId: user.id, adventureId: adventure.id } }
        })
        if (!exists) {
            await prisma.adventureUser.create({
                data: { userId: user.id, adventureId: adventure.id, role: user.role }
            })
            console.log(`User ${user.username} -> aventura (role: ${user.role})`)
        } else {
            console.log(`User ${user.username} ja vinculado`)
        }
    }

    // 3. Setar adventureId em todos os characters sem aventura
    const updated = await prisma.character.updateMany({
        where: { adventureId: null },
        data: { adventureId: adventure.id }
    })
    console.log(`${updated.count} characters atualizados`)
}

backfill()
    .then(() => console.log('Backfill concluido'))
    .catch(console.error)
    .finally(() => prisma.$disconnect())
