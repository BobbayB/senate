import { log_pd } from '@senate/axiom'
import { DAOHandler } from '@senate/database'
import { Decoder } from '@senate/database'
import axios from 'axios'
import { ethers } from 'ethers'

const IPFS_GATEWAY_URLS = [
    'https://ipfs.io/ipfs/',
    'https://ipfs.infura.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/'
]

export const dydxProposals = async (
    provider: ethers.JsonRpcProvider,
    daoHandler: DAOHandler,
    fromBlock: number,
    toBlock: number
) => {
    const iface = new ethers.Interface((daoHandler.decoder as Decoder).abi)

    const logs = await provider.getLogs({
        fromBlock: fromBlock,
        toBlock: toBlock,
        address: (daoHandler.decoder as Decoder).address,
        topics: [iface.getEvent('ProposalCreated').topicHash]
    })

    const args = logs.map((log) => ({
        txBlock: log.blockNumber,
        txHash: log.transactionHash,
        eventData: iface.parseLog({
            topics: log.topics as string[],
            data: log.data
        }).args
    }))

    const govContract = new ethers.Contract(
        (daoHandler.decoder as Decoder).address,
        (daoHandler.decoder as Decoder).abi,
        provider
    )

    const proposals = await Promise.all(
        args.map(async (arg) => {
            const proposalCreatedTimestamp = (
                await provider.getBlock(arg.txBlock)
            ).timestamp

            const votingStartsTimestamp =
                proposalCreatedTimestamp +
                (Number(arg.eventData.startBlock) - arg.txBlock) * 12
            const votingEndsTimestamp =
                proposalCreatedTimestamp +
                (Number(arg.eventData.endBlock) - arg.txBlock) * 12
            const title = await fetchTitleFromIPFS(
                arg.eventData.ipfsHash,
                arg.eventData.id
            )
            const proposalUrl =
                (daoHandler.decoder as Decoder).proposalUrl + arg.eventData.id
            const proposalOnChainId = Number(arg.eventData.id).toString()

            const onchainProposal = await govContract.getProposalById(
                proposalOnChainId
            )

            return {
                externalId: proposalOnChainId,
                name: String(title).slice(0, 1024),
                daoId: daoHandler.daoId,
                daoHandlerId: daoHandler.id,
                timeEnd: new Date(votingEndsTimestamp * 1000),
                timeStart: new Date(votingStartsTimestamp * 1000),
                timeCreated: new Date(proposalCreatedTimestamp * 1000),
                blockCreated: arg.txBlock,
                choices: ['For', 'Against'],
                scores: [
                    parseFloat(onchainProposal.forVotes),
                    parseFloat(onchainProposal.againstVotes)
                ],
                scoresTotal:
                    parseFloat(onchainProposal.forVotes) +
                    parseFloat(onchainProposal.againstVotes),
                url: proposalUrl
            }
        })
    )

    return proposals
}

const fetchTitleFromIPFS = async (
    hexHash: string,
    onChainId: string
): Promise<string> => {
    let title = `DIP ${onChainId} - Unknown`
    try {
        let retries = 12
        let gatewayIndex = 0
        while (retries) {
            try {
                const response = await axios.get(
                    IPFS_GATEWAY_URLS[gatewayIndex] +
                        'f01701220' +
                        hexHash.substring(2)
                )

                if (!response.data || !response.data.title) {
                    log_pd.log({
                        level: 'warn',
                        message: `Could not find proposal title in response`,
                        responseData: response.data
                    })
                }

                title = `DIP ${onChainId} - ${response.data.title}`
                break
            } catch (e) {
                retries--

                if (!retries) {
                    throw e
                }

                gatewayIndex = (gatewayIndex + 1) % IPFS_GATEWAY_URLS.length

                log_pd.log({
                    level: 'warn',
                    message: `Failed fetching dYdX proposal data from ${IPFS_GATEWAY_URLS[gatewayIndex]}. Retrying...`,
                    url:
                        IPFS_GATEWAY_URLS[gatewayIndex] +
                        'f01701220' +
                        hexHash.substring(2),
                    retriesLeft: retries
                })
            }
        }
    } catch (e) {
        log_pd.log({
            level: 'warn',
            message: `Could not get proposal title`,
            hexHash: hexHash,
            url: IPFS_GATEWAY_URLS[0] + 'f01701220' + hexHash.substring(2),
            errorName: (e as Error).name,
            errorMessage: (e as Error).message,
            errorStack: (e as Error).stack
        })
    }

    return title
}
