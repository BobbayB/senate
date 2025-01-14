import {
    DAOHandlerType,
    RefreshStatus,
    RefreshType,
    VoterHandler,
    prisma
} from '@senate/database'
import {
    DAOS_VOTES_SNAPSHOT_INTERVAL,
    DAOS_VOTES_SNAPSHOT_INTERVAL_FORCE
} from '../config'
import { bin } from 'd3-array'
import { thresholdsTime } from '../utils'
import { log_ref } from '@senate/axiom'

export const addSnapshotDaoVotes = async () => {
    await prisma.$transaction(
        async (tx) => {
            const normalRefresh = new Date(
                Date.now() - DAOS_VOTES_SNAPSHOT_INTERVAL * 60 * 1000
            )
            const forceRefresh = new Date(
                Date.now() - DAOS_VOTES_SNAPSHOT_INTERVAL_FORCE * 60 * 1000
            )
            const newRefresh = new Date(Date.now() - 5 * 1000)

            let daoHandlers = await tx.dAOHandler.findMany({
                where: {
                    type: DAOHandlerType.SNAPSHOT,
                    voterHandlers: {
                        some: {
                            OR: [
                                {
                                    refreshStatus: RefreshStatus.DONE,
                                    lastRefresh: {
                                        lt: normalRefresh
                                    }
                                },
                                {
                                    refreshStatus: RefreshStatus.PENDING,
                                    lastRefresh: {
                                        lt: forceRefresh
                                    }
                                },
                                {
                                    refreshStatus: RefreshStatus.NEW,
                                    lastRefresh: {
                                        lt: newRefresh
                                    }
                                }
                            ]
                        }
                    }
                },
                include: {
                    voterHandlers: {
                        where: {
                            OR: [
                                {
                                    refreshStatus: RefreshStatus.DONE,
                                    lastRefresh: {
                                        lt: normalRefresh
                                    }
                                },
                                {
                                    refreshStatus: RefreshStatus.PENDING,
                                    lastRefresh: {
                                        lt: forceRefresh
                                    }
                                },
                                {
                                    refreshStatus: RefreshStatus.NEW,
                                    lastRefresh: {
                                        lt: newRefresh
                                    }
                                }
                            ]
                        },
                        include: { voter: true }
                    },
                    dao: true,
                    proposals: true
                }
            })

            daoHandlers = daoHandlers.filter(
                (daoHandlers) => daoHandlers.proposals.length
            )

            if (!daoHandlers.length) {
                return
            }

            const previousPrio = (await tx.refreshQueue.findFirst({
                where: {
                    refreshType: RefreshType.DAOSNAPSHOTVOTES
                },
                orderBy: { priority: 'desc' },
                take: 1,
                select: { priority: true }
            })) ?? { priority: 1 }

            let voterHandlerToRefresh: VoterHandler[] = []

            const refreshEntries = daoHandlers
                .map((daoHandler) => {
                    const voterHandlers = daoHandler.voterHandlers

                    const voteTimestamps = voterHandlers.map((voterHandler) =>
                        Number(voterHandler.snapshotIndex?.getTime())
                    )

                    const voteTimestampBuckets = bin<number, Date>()
                        .domain([
                            new Date('2009-01-09T04:54:25.00Z'),
                            new Date(Date.now() + 60 * 60 * 1000)
                        ])
                        .thresholds(thresholdsTime(10))(voteTimestamps)

                    const refreshItemsDao = voteTimestampBuckets
                        .map((bucket) => {
                            const bucketMax = Number(bucket['x1'])
                            const bucketMin = Number(bucket['x0'])

                            const bucketVh = voterHandlers
                                .filter(
                                    (voterHandler) =>
                                        bucketMin <=
                                            Number(
                                                voterHandler.snapshotIndex?.getTime()
                                            ) &&
                                        Number(
                                            voterHandler.snapshotIndex?.getTime()
                                        ) < bucketMax
                                )
                                .slice(0, 100)

                            voterHandlerToRefresh = [
                                ...voterHandlerToRefresh,
                                ...bucketVh
                            ]

                            return {
                                bucket: `[${new Date(
                                    bucketMin
                                ).toUTCString()}, ${new Date(
                                    bucketMax
                                ).toUTCString()}] - ${bucketVh.length} items`,
                                item: {
                                    handlerId: daoHandler.id,
                                    refreshType: RefreshType.DAOSNAPSHOTVOTES,
                                    args: {
                                        voters: bucketVh.map(
                                            (vhandler) => vhandler.voter.address
                                        )
                                    },
                                    priority: Number(previousPrio.priority) + 1
                                }
                            }
                        })
                        .filter((el) => el.item.args.voters.length)

                    log_ref.log({
                        level: 'info',
                        message: `Added refresh items to queue`,
                        dao: daoHandler.dao.name,
                        daoHandler: daoHandler.id,
                        type: RefreshType.DAOSNAPSHOTVOTES,
                        noOfBuckets: refreshItemsDao.length,
                        items: refreshItemsDao
                    })

                    return refreshItemsDao
                })
                .flat(2)

            await tx.refreshQueue.createMany({
                data: refreshEntries.map((q) => q.item)
            })

            await tx.voterHandler.updateMany({
                where: { id: { in: voterHandlerToRefresh.map((v) => v.id) } },
                data: {
                    refreshStatus: RefreshStatus.PENDING,
                    lastRefresh: new Date()
                }
            })
        },
        { maxWait: 30000 }
    )
}
