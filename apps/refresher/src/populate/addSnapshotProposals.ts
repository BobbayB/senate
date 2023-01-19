import {
    DAOHandlerType,
    RefreshStatus,
    RefreshType,
    prisma
} from '@senate/database'
import {
    DAOS_PROPOSALS_SNAPSHOT_INTERVAL,
    DAOS_PROPOSALS_SNAPSHOT_INTERVAL_FORCE
} from '../config'

export const addSnapshotProposalsToQueue = async () => {
    await prisma.$transaction(
        async (tx) => {
            const daoHandlers = await tx.dAOHandler.findMany({
                where: {
                    type: DAOHandlerType.SNAPSHOT,
                    OR: [
                        {
                            refreshStatus: RefreshStatus.DONE,
                            lastRefreshTimestamp: {
                                lt: new Date(
                                    Date.now() -
                                        DAOS_PROPOSALS_SNAPSHOT_INTERVAL *
                                            60 *
                                            1000
                                )
                            }
                        },
                        {
                            refreshStatus: RefreshStatus.PENDING,
                            lastRefreshTimestamp: {
                                lt: new Date(
                                    Date.now() -
                                        DAOS_PROPOSALS_SNAPSHOT_INTERVAL_FORCE *
                                            60 *
                                            1000
                                )
                            }
                        },
                        {
                            refreshStatus: RefreshStatus.NEW,
                            lastRefreshTimestamp: {
                                lt: new Date(Date.now() - 15 * 1000)
                            }
                        }
                    ]
                },
                include: {
                    dao: true
                }
            })

            if (!daoHandlers.length) {
                return
            }

            const previousPrio = (await tx.refreshQueue.findFirst({
                where: {
                    refreshType: RefreshType.DAOSNAPSHOTPROPOSALS
                },
                orderBy: { priority: 'desc' },
                take: 1,
                select: { priority: true }
            })) ?? { priority: 50 }

            await tx.refreshQueue.createMany({
                data: daoHandlers.map((daoHandler) => {
                    return {
                        handlerId: daoHandler.id,
                        refreshType: RefreshType.DAOSNAPSHOTPROPOSALS,
                        priority: Number(previousPrio.priority) + 1,
                        args: {}
                    }
                })
            })

            await tx.dAOHandler.updateMany({
                where: {
                    id: {
                        in: daoHandlers.map((daoHandler) => daoHandler.id)
                    }
                },
                data: {
                    refreshStatus: RefreshStatus.PENDING,
                    lastRefreshTimestamp: new Date()
                }
            })
        },
        {
            maxWait: 20000,
            timeout: 60000
        }
    )
}
