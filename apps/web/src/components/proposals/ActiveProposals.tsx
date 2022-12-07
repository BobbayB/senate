import { inferProcedureOutput } from '@trpc/server'
import dayjs from 'dayjs'
import { useState } from 'react'
import { AppRouter } from '../../server/trpc/router/_app'
import { trpc } from '../../utils/trpc'
import Image from 'next/image'

const endingInOptions: { name: string; time: number }[] = [
    {
        name: 'Any day',
        time: 365 * 24 * 60 * 60 * 1000,
    },
    {
        name: '7 days',
        time: 7 * 24 * 60 * 60 * 1000,
    },
    {
        name: '5 days',
        time: 5 * 24 * 60 * 60 * 1000,
    },
    {
        name: '3 days',
        time: 3 * 24 * 60 * 60 * 1000,
    },
    {
        name: '1 days',
        time: 1 * 24 * 60 * 60 * 1000,
    },
]

const voteStatus: { id: number; name: string }[] = [
    {
        id: 0,
        name: 'Any status',
    },
    {
        id: 1,
        name: 'Voted on',
    },
    {
        id: 2,
        name: 'Not voted on',
    },
]

export const ActiveProposals = () => {
    const followingDAOs = trpc.user.subscriptions.subscribedDAOs.useQuery()

    const [from, setFrom] = useState('any')
    const [endingIn, setEndingIn] = useState(365 * 24 * 60 * 60 * 1000)
    const [withVoteStatus, setWithVoteStatus] = useState(0)

    const filteredActiveProposals =
        trpc.user.proposals.filteredActiveProposals.useQuery({
            fromDao: from,
            endingIn: endingIn,
            withVoteStatus: withVoteStatus,
        })

    return (
        <div>
            <div className="flex flex-row gap-5">
                <div className="flex h-[38px] w-[300px] flex-row items-center">
                    <label
                        className="flex h-full min-w-max items-center bg-black py-[9px] px-[12px] text-[15px] text-white"
                        htmlFor="fromDao"
                    >
                        From
                    </label>
                    <select
                        className="h-full w-full"
                        id="fromDao"
                        onChange={(e) => {
                            setFrom(e.target.value)
                        }}
                    >
                        <option key="any" value="any">
                            Any
                        </option>
                        {followingDAOs.data?.map((followingDAO) => {
                            return (
                                <option
                                    key={followingDAO.id}
                                    value={followingDAO.id}
                                >
                                    {followingDAO.name}
                                </option>
                            )
                        })}
                    </select>
                </div>

                <div className="flex h-[38px] w-[300px] flex-row items-center">
                    <label
                        className="flex h-full min-w-max items-center bg-black py-[9px] px-[12px] text-[15px] text-white"
                        htmlFor="endingIn"
                    >
                        <div>Ending in</div>
                    </label>
                    <select
                        className="h-full w-full"
                        id="endingIn"
                        onChange={(e) => {
                            setEndingIn(Number(e.target.value))
                        }}
                    >
                        {endingInOptions.map((endingIn) => {
                            return (
                                <option
                                    key={endingIn.time}
                                    value={endingIn.time}
                                >
                                    {endingIn.name}
                                </option>
                            )
                        })}
                    </select>
                </div>

                <div className="flex h-[38px] w-[300px] flex-row items-center">
                    <label
                        className="flex h-full min-w-max items-center bg-black py-[9px] px-[12px] text-[15px] text-white"
                        htmlFor="voteStatus"
                    >
                        <div>With Vote Status of</div>
                    </label>
                    <select
                        className="h-full w-full"
                        id="voteStatus"
                        onChange={(e) => {
                            setWithVoteStatus(Number(e.target.value))
                        }}
                    >
                        {voteStatus.map((status) => {
                            return (
                                <option key={status.id} value={status.id}>
                                    {status.name}
                                </option>
                            )
                        })}
                    </select>
                </div>
            </div>
            <div className="mt-[16px] flex flex-col">
                {filteredActiveProposals.data?.length ? (
                    <table className="w-full table-auto border-separate border-spacing-y-[4px] text-left">
                        <thead className="h-[56px] bg-black text-white">
                            <tr>
                                <th className="w-[200px] pl-[16px] font-normal">
                                    DAO
                                </th>
                                <th className="font-normal">Proposal Title</th>
                                <th className="w-[200px]  font-normal">
                                    Ends in
                                </th>
                                <th className="w-[200px] text-center font-normal">
                                    Vote status
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredActiveProposals.data?.map(
                                (proposal, index) => (
                                    <ActiveProposal
                                        key={index}
                                        proposal={proposal}
                                    />
                                )
                            )}
                        </tbody>
                    </table>
                ) : (
                    <div>No active proposals for current selection</div>
                )}
            </div>
        </div>
    )
}

const ActiveProposal = (props: {
    proposal: inferProcedureOutput<
        AppRouter['user']['proposals']['filteredActiveProposals']
    >[0]
}) => {
    const voted =
        props.proposal.votes.map((vote) =>
            vote.options.map((options) => options.optionName)
        ).length > 0

    return (
        <tr className="h-[96px] w-full items-center justify-evenly bg-[#121212] text-[#EDEDED]">
            <td>
                <div className="m-[12px] flex w-max flex-row items-center gap-[8px]">
                    <div className="border border-b-2 border-r-2 border-t-0 border-l-0">
                        <Image
                            width={64}
                            height={64}
                            src={props.proposal.dao.picture}
                            alt={props.proposal.dao.name}
                        />
                    </div>
                    <div className="text-[24px] font-thin">
                        {props.proposal.dao.name}
                    </div>
                </div>
            </td>
            <td className="cursor-pointer hover:underline">
                <a href={props.proposal.url} target="_blank" rel="noreferrer">
                    <div className="text-[18px] font-normal">
                        {props.proposal.name}
                    </div>
                </a>
            </td>
            <td>
                <div className="text-[21px]">
                    {dayjs(props.proposal.timeEnd).fromNow()}
                </div>
            </td>
            <td>
                <div className="text-end">
                    {voted ? (
                        <div className="flex w-full flex-col items-center">
                            <Image
                                src="/assets/Icon/Voted.svg"
                                alt="voted"
                                width={32}
                                height={32}
                            />
                            <div className="text-[18px]">Voted</div>
                        </div>
                    ) : (
                        <div className="flex w-full flex-col items-center">
                            <Image
                                src="/assets/Icon/Not Voted Yet.svg"
                                alt="voted"
                                width={32}
                                height={32}
                            />
                            <div className="text-[18px]">Not Voted Yet</div>
                        </div>
                    )}
                </div>
            </td>
        </tr>
    )
}
