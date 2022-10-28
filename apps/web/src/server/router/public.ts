import { createRouter } from './context'
import { prisma } from '@senate/database'

export const publicRouter = createRouter()
    .query('proposals', {
        async resolve() {
            const userProposals = await prisma.proposal.findMany({
                where: {
                    data: {
                        path: '$.timeEnd',
                        lt: Number(new Date()),
                    },
                },
                include: {
                    dao: {
                        include: {
                            handlers: {
                                select: {
                                    type: true,
                                },
                            },
                        },
                    },
                    votes: {
                        include: {
                            user: true,
                        },
                    },
                },
            })

            return userProposals
        },
    })
    .query('daos', {
        async resolve() {
            const daosList = await prisma.dAO.findMany({
                where: {},
                orderBy: {
                    id: 'asc',
                },
                distinct: 'id',
                include: {
                    handlers: true,
                    subscriptions: {
                        take: 0, //needed in order to maintain type safety
                    },
                },
            })
            return daosList
        },
    })
    .mutation('refreshAllProposals', {
        async resolve() {
            const daos = await prisma.dAO.findMany({})

            daos.forEach(async (dao) => {
                console.log(
                    `${process.env.DETECTIVE_URL}/updateProposals?daoId=${dao.id}`
                )
                await fetch(
                    `${process.env.DETECTIVE_URL}/updateProposals?daoId=${dao.id}`,
                    {
                        method: 'POST', // *GET, POST, PUT, DELETE, etc.
                    }
                )
            })
        },
    })
