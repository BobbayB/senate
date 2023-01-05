import { log_ref } from '@senate/axiom'
import {
    DAOHandlerType,
    prisma,
    RefreshQueue,
    RefreshStatus
} from '@senate/database'
import fetch from 'node-fetch'

export const processSnapshotDaoVotes = async (item: RefreshQueue) => {
    const daoHandler = await prisma.dAOHandler.findFirst({
        where: { id: item.clientId }
    })

    const voters = await prisma.voter.findMany({
        where: {
            voterHandlers: {
                some: {
                    daoHandlerId: daoHandler?.id
                }
            }
        }
    })

    log_ref.log({
        level: 'info',
        message: `Process dao snapshot votes item`,
        data: {
            daoHandler: daoHandler,
            voters: voters
        }
    })

    let proposalDetectiveReq = ''

    voters.map((voter) => (proposalDetectiveReq += `voters=${voter.address}&`))
    proposalDetectiveReq.slice(0, -1)

    log_ref.log({
        level: 'info',
        message: `Detective request`,
        data: {
            url: proposalDetectiveReq
        }
    })

    await fetch(proposalDetectiveReq, {
        method: 'POST'
    })
        .then((response) => response.json())
        .then(async (data) => {
            log_ref.log({
                level: 'info',
                message: `Detective response`,
                data: {
                    data: data
                }
            })

            if (!data) return
            if (!Array.isArray(data)) return

            await prisma.voterHandler
                .updateMany({
                    where: {
                        voter: {
                            address: {
                                in: data
                                    .filter((result) => result.response == 'ok')
                                    .map((result) => result.voterAddress)
                            }
                        },
                        daoHandler: {
                            type: DAOHandlerType.SNAPSHOT
                        },
                        daoHandlerId: daoHandler?.id
                    },
                    data: {
                        refreshStatus: RefreshStatus.DONE,
                        lastRefreshTimestamp: new Date(),
                        lastSnapshotVoteCreatedTimestamp: new Date()
                    }
                })
                .then((r) => {
                    log_ref.log({
                        level: 'info',
                        message: `Succesfully updated refresh status for ok responses`,
                        data: {
                            voters: data
                                .filter((result) => result.response == 'ok')
                                .map((result) => result.voterAddress),
                            result: r
                        }
                    })
                    return
                })
                .catch((e) => {
                    log_ref.log({
                        level: 'error',
                        message: `Could not update refresh status for ok responses`,
                        data: {
                            voters: data
                                .filter((result) => result.response == 'ok')
                                .map((result) => result.voterAddress),
                            error: e
                        }
                    })
                })

            await prisma.voterHandler
                .updateMany({
                    where: {
                        voter: {
                            address: {
                                in: data
                                    .filter(
                                        (result) => result.response == 'nok'
                                    )
                                    .map((result) => result.voterAddress)
                            }
                        },
                        daoHandler: {
                            type: DAOHandlerType.SNAPSHOT
                        },
                        daoHandlerId: daoHandler?.id
                    },
                    data: {
                        refreshStatus: RefreshStatus.NEW,
                        lastSnapshotVoteCreatedTimestamp: new Date(1)
                    }
                })
                .then((r) => {
                    log_ref.log({
                        level: 'info',
                        message: `Succesfully updated refresh status for nok responses`,
                        data: {
                            voters: data
                                .filter((result) => result.response == 'nok')
                                .map((result) => result.voterAddress),
                            result: r
                        }
                    })
                    return
                })
                .catch((e) => {
                    log_ref.log({
                        level: 'error',
                        message: `Could not update refresh status for nok responses`,
                        data: {
                            voters: data
                                .filter((result) => result.response == 'nok')
                                .map((result) => result.voterAddress),
                            error: e
                        }
                    })
                })

            return
        })
        .catch(async (e) => {
            log_ref.log({
                level: 'error',
                message: `Proposal detective request failed`,
                data: {
                    error: e
                }
            })

            await prisma.voterHandler
                .updateMany({
                    where: {
                        voter: {
                            address: {
                                in: voters.map((voter) => voter.address)
                            }
                        },
                        daoHandler: {
                            type: DAOHandlerType.SNAPSHOT
                        }
                    },
                    data: {
                        refreshStatus: RefreshStatus.NEW
                    }
                }) // eslint-disable-next-line promise/no-nesting
                .then((r) => {
                    log_ref.log({
                        level: 'info',
                        message: `Succesfully forced refresh for all failed voters`,
                        data: {
                            voters: voters.map((voter) => voter.address),
                            result: r
                        }
                    })
                    return
                })
                // eslint-disable-next-line promise/no-nesting
                .catch((e) => {
                    log_ref.log({
                        level: 'error',
                        message: `Failed to force refresh for all failed voters`,
                        data: {
                            voters: voters.map((voter) => voter.address),
                            error: e
                        }
                    })
                })
        })
}
