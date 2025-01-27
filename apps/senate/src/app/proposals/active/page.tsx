import { prisma } from '@senate/database'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '../../../pages/api/auth/[...nextauth]'
import { Filters } from './components/csr/Filters'
import Table from './components/ssr/Table'

export const revalidate = 300

const getSubscribedDAOs = async () => {
    const session = await getServerSession(authOptions())
    const userAddress = session?.user?.name ?? ''
    try {
        const user = await prisma.user.findFirstOrThrow({
            where: {
                name: { equals: userAddress }
            },
            select: {
                id: true
            }
        })

        const daosList = await prisma.dAO.findMany({
            where: {
                subscriptions: {
                    some: {
                        user: { is: user }
                    }
                }
            },
            orderBy: {
                name: 'asc'
            },
            distinct: 'id'
        })
        return daosList
    } catch (e) {
        const daosList = await prisma.dAO.findMany({
            where: {},
            orderBy: {
                name: 'asc'
            },
            distinct: 'id'
        })
        return daosList
    }
}

const getProxies = async () => {
    const session = await getServerSession(authOptions())
    const userAddress = session?.user?.name ?? ''
    try {
        const user = await prisma.user.findFirstOrThrow({
            where: {
                name: { equals: userAddress }
            },
            include: {
                voters: true
            }
        })

        const proxies = user.voters.map((voter) => voter.address)

        return proxies
    } catch (e) {
        return []
    }
}

export default async function Home({
    searchParams
}: {
    params: { slug: string }
    searchParams?: { from: string; end: number; voted: string; proxy: string }
}) {
    if (process.env.OUTOFSERVICE === 'true') redirect('/outofservice')

    const subscribedDAOs = await getSubscribedDAOs()
    const proxies = await getProxies()

    const subscripions = subscribedDAOs.map((subDAO) => {
        return { id: subDAO.id, name: subDAO.name }
    })

    return (
        <div className='relative min-h-screen'>
            {/* <div className='z-10'>
                <ConnectWalletModal />
            </div> */}

            <Filters subscriptions={subscripions} proxies={proxies} />

            {/* @ts-expect-error Server Component */}
            <Table
                from={searchParams?.from}
                end={searchParams?.end}
                voted={searchParams?.voted}
                proxy={searchParams?.proxy}
            />
        </div>
    )
}
