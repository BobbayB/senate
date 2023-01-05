import { axiom } from '@senate/axiom'
import { DAOHandler, DAOHandlerType, prisma } from '@senate/database'
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider({
    url: String(process.env.PROVIDER_URL)
})

export const updateMakerExecutiveChainDaoVotes = async (
    daoHandlerId: string,
    voters: [string]
) => {
    if (!Array.isArray(voters)) voters = [voters]

    const daoHandler = await prisma.dAOHandler.findFirstOrThrow({
        where: { id: daoHandlerId, type: DAOHandlerType.MAKER_EXECUTIVE },
        include: {
            dao: {
                include: {
                    votes: { where: { daoHandlerId: daoHandlerId } }
                }
            }
        }
    })

    await axiom.datasets.ingestEvents(
        `proposal-detective-${process.env.AXIOM_DEPLOYMENT}`,
        [
            {
                event: 'updateMakerExecutiveChainDaoVotes',
                details: `run`,
                item: { daoHandler: daoHandler, voters: voters }
            }
        ]
    )

    const results = new Map()

    for (const voter of voters) {
        results.set(voter, 'ok')
        let votes

        const voterHandler = await prisma.voterHandler.findFirstOrThrow({
            where: {
                daoHandlerId: daoHandlerId,
                voter: {
                    is: {
                        address: voter
                    }
                }
            }
        })

        const voterLatestVoteBlock = voterHandler.lastChainVoteCreatedBlock

        await axiom.datasets.ingestEvents(
            `proposal-detective-${process.env.AXIOM_DEPLOYMENT}`,
            [
                {
                    event: 'updateMakerExecutiveChainDaoVotes',
                    details: `update-voter`,
                    item: {
                        voter: voter,
                        lastChainVoteCreatedBlock: voterLatestVoteBlock
                    }
                }
            ]
        )

        try {
            const latestVoteBlock = Number(voterLatestVoteBlock) ?? 0
            const currentBlock = await provider.getBlockNumber()

            votes = await getVotes(daoHandler, voter, latestVoteBlock)

            if (!votes) {
                continue
            }

            for (const vote of votes) {
                const proposal = await prisma.proposal.findFirst({
                    where: {
                        externalId: vote,
                        daoId: daoHandler.daoId,
                        daoHandlerId: daoHandler.id
                    }
                })

                if (!proposal) {
                    results.set(voter, 'nok')
                    await axiom.datasets.ingestEvents(
                        `proposal-detective-${process.env.AXIOM_DEPLOYMENT}`,
                        [
                            {
                                event: 'updateMakerExecutiveChainDaoVotes',
                                details: `update-voter`,
                                err: `did not find proposal ${vote}`
                            }
                        ]
                    )
                    break
                }

                await prisma.vote
                    .upsert({
                        where: {
                            voterAddress_daoId_proposalId: {
                                voterAddress: voter,
                                daoId: daoHandler.daoId,
                                proposalId: proposal.id
                            }
                        },
                        update: {
                            choiceId: '1',
                            choice: 'Yes'
                        },
                        create: {
                            voterAddress: voter,
                            daoId: daoHandler.daoId,
                            proposalId: proposal.id,
                            daoHandlerId: daoHandler.id,
                            choiceId: '1',
                            choice: 'Yes'
                        }
                    })
                    .then(async (r) => {
                        await prisma.voterHandler.update({
                            where: {
                                id: voterHandler.id
                            },
                            data: {
                                lastChainVoteCreatedBlock: currentBlock
                            }
                        })
                        await axiom.datasets.ingestEvents(
                            `proposal-detective-${process.env.AXIOM_DEPLOYMENT}`,
                            [
                                {
                                    event: 'updateMakerExecutiveChainDaoVotes',
                                    details: `update-voter`,
                                    item: { vote: r }
                                }
                            ]
                        )

                        return
                    })
                    .catch(async (e) => {
                        results.set(voter, 'nok')
                        await axiom.datasets.ingestEvents(
                            `proposal-detective-${process.env.AXIOM_DEPLOYMENT}`,
                            [
                                {
                                    event: 'updateMakerExecutiveChainDaoVotes',
                                    details: `update-voter`,
                                    err: JSON.stringify(e)
                                }
                            ]
                        )
                        console.log(e)
                    })
            }
        } catch (e) {
            results.set(voter, 'nok')
            await axiom.datasets.ingestEvents(
                `proposal-detective-${process.env.AXIOM_DEPLOYMENT}`,
                [
                    {
                        event: 'updateMakerExecutiveChainDaoVotes',
                        details: `run`,
                        err: JSON.stringify(e)
                    }
                ]
            )
            console.log(e)
        }
    }

    const resultsArray = Array.from(results, ([name, value]) => ({
        voterAddress: name,
        response: value
    }))

    await axiom.datasets.ingestEvents(
        `proposal-detective-${process.env.AXIOM_DEPLOYMENT}`,
        [
            {
                event: 'updateMakerExecutiveChainDaoVotes',
                details: `success`,
                item: { proposals: resultsArray, response: resultsArray }
            }
        ]
    )

    return resultsArray
}

const getVotes = async (
    daoHandler: DAOHandler,
    voterAddress: string,
    latestVoteBlock: number
): Promise<string[]> => {
    const iface = new ethers.utils.Interface(daoHandler.decoder['abi'])
    const chiefContract = new ethers.Contract(
        daoHandler.decoder['address'],
        daoHandler.decoder['abi'],
        provider
    )

    if (daoHandler.type != DAOHandlerType.MAKER_EXECUTIVE) return []

    const voteMultipleActionsTopic =
        '0xed08132900000000000000000000000000000000000000000000000000000000'
    const voteSingleActionTopic =
        '0xa69beaba00000000000000000000000000000000000000000000000000000000'
    const voterAddressTopic = '0x' + '0'.repeat(24) + voterAddress.substring(2)

    const logs = await provider.getLogs({
        fromBlock: latestVoteBlock,
        address: daoHandler.decoder['address'],
        topics: [
            [voteMultipleActionsTopic, voteSingleActionTopic],
            voterAddressTopic
        ]
    })

    const spellAddressesSet = new Set<string>()
    for (let i = 0; i < logs.length; i++) {
        const log = logs[i]
        const eventArgs = iface.decodeEventLog('LogNote', log.data)

        const decodedFunctionData =
            log.topics[0] === voteSingleActionTopic
                ? iface.decodeFunctionData('vote(bytes32)', eventArgs.fax)
                : iface.decodeFunctionData('vote(address[])', eventArgs.fax)

        const spells: string[] =
            decodedFunctionData.yays !== undefined
                ? decodedFunctionData.yays
                : await getSlateYays(chiefContract, decodedFunctionData.slate)

        spells.forEach((spell) => {
            spellAddressesSet.add(spell)
        })
    }

    return Array.from(spellAddressesSet)
}

const getSlateYays = async (chiefContract: ethers.Contract, slate: string) => {
    const yays = []
    let count = 0

    while (true) {
        let spellAddress
        try {
            spellAddress = await chiefContract.slates(slate, count)
            yays.push(spellAddress)
            count++
        } catch (err) {
            break
        }
    }

    return yays
}
