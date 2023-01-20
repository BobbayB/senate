import { log_pd } from '@senate/axiom'
import { DAOHandlerType, prisma } from '@senate/database'
import { ethers } from 'ethers'
import { getAaveVotes } from './chain/aave'
import { getMakerExecutiveVotes } from './chain/makerExecutive'
import { getUniswapVotes } from './chain/uniswap'
import { getMakerPollVotes } from './chain/makerPoll'
import { getCompoundVotes } from './chain/compound'
import superagent from 'superagent'

const infuraProvider = new ethers.providers.JsonRpcProvider({
    url: String(process.env.INFURA_NODE_URL)
})

const senateProvider = new ethers.providers.JsonRpcProvider({
    url: String(process.env.SENATE_NODE_URL)
})

interface Result {
    voterAddress: string
    success: boolean
    votes: {
        voterAddress: string
        daoId: string
        proposalId: string
        daoHandlerId: string
        choiceId: string
        choice: string
    }[]
}

export const updateChainDaoVotes = async (
    daoHandlerId: string,
    voters: string[]
) => {
    const result = new Map()
    voters.map((voter) => result.set(voter, 'nok'))

    const daoHandler = await prisma.dAOHandler.findFirstOrThrow({
        where: { id: daoHandlerId },
        include: {
            dao: true,
            proposals: true
        }
    })

    const voterHandlers = await prisma.voterHandler.findMany({
        where: {
            daoHandlerId: daoHandlerId,
            voter: {
                address: { in: voters }
            }
        }
    })

    const firstProposalTimestamp = Math.floor(
        Math.min(...daoHandler.proposals.map((p) => p.timeCreated.valueOf())) /
            1000
    )

    const firstProposalBlock = await superagent
        .get(`https://coins.llama.fi/block/ethereum/${firstProposalTimestamp}`)
        .then((response) => {
            return JSON.parse(response.text).height
        })
        .catch(() => {
            return 0
        })

    const lastVoteBlock = Math.min(
        ...voterHandlers.map((voterHandler) =>
            Number(voterHandler.lastChainVoteCreatedBlock)
        )
    )

    let results: Result[] = [],
        currentBlock: number

    try {
        currentBlock = await senateProvider.getBlockNumber()
    } catch (e) {
        currentBlock = await infuraProvider.getBlockNumber()
    }

    let blockBatchSize = Math.floor(40000000 / voters.length)
    if (daoHandler.type == DAOHandlerType.MAKER_EXECUTIVE)
        blockBatchSize = Math.floor(blockBatchSize / 10)

    let fromBlock = Math.max(lastVoteBlock, 0)

    if (fromBlock < firstProposalBlock) fromBlock = firstProposalBlock

    let toBlock =
        currentBlock - fromBlock > blockBatchSize
            ? fromBlock + blockBatchSize
            : currentBlock

    if (toBlock > daoHandler.lastChainProposalCreatedBlock)
        toBlock = Number(daoHandler.lastChainProposalCreatedBlock)

    const provider: ethers.providers.JsonRpcProvider =
        currentBlock - 50 > fromBlock ? infuraProvider : senateProvider

    log_pd.log({
        level: 'info',
        message: `Search interval for ${daoHandler.dao.name} - ${daoHandler.type}`,
        data: {
            currentBlock: currentBlock,
            fromBlock: fromBlock,
            toBlock: toBlock,
            provider: provider.connection.url
        }
    })

    try {
        switch (daoHandler.type) {
            case 'AAVE_CHAIN':
                results = await getAaveVotes(
                    provider,
                    daoHandler,
                    voters,
                    fromBlock,
                    toBlock
                )
                break
            case 'COMPOUND_CHAIN':
                results = await getCompoundVotes(
                    provider,
                    daoHandler,
                    voters,
                    fromBlock,
                    toBlock
                )
                break
            case 'MAKER_EXECUTIVE':
                results = await getMakerExecutiveVotes(
                    provider,
                    daoHandler,
                    voters,
                    fromBlock,
                    toBlock
                )
                break
            case 'MAKER_POLL':
                results = await getMakerPollVotes(
                    provider,
                    daoHandler,
                    voters,
                    fromBlock,
                    toBlock
                )
                break
            case 'UNISWAP_CHAIN':
                results = await getUniswapVotes(
                    provider,
                    daoHandler,
                    voters,
                    fromBlock,
                    toBlock
                )
                break
        }

        const successfulResults = results.filter((res) => res.success)

        successfulResults.map((res) => {
            result.set(res.voterAddress, 'ok')
        })

        await prisma.vote
            .createMany({
                data: successfulResults.map((res) => res.votes).flat(2),
                skipDuplicates: true
            })
            .then(async () => {
                await prisma.voterHandler.updateMany({
                    where: {
                        voter: {
                            address: {
                                in: successfulResults.map(
                                    (res) => res.voterAddress
                                )
                            }
                        },
                        daoHandlerId: daoHandler.id
                    },
                    data: {
                        lastChainVoteCreatedBlock: toBlock,
                        lastSnapshotVoteCreatedTimestamp: new Date(0)
                    }
                })
                return
            })
    } catch (e) {
        log_pd.log({
            level: 'warn',
            message: `Error fetching votes for ${daoHandler.dao.name}`,
            error: e
        })
    }

    const resultsArray = Array.from(result, ([name, value]) => ({
        voterAddress: name,
        response: value
    }))

    return resultsArray
}
