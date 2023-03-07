import { prisma } from '@senate/database'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authOptions } from '../../../pages/api/auth/[...nextauth]'
import ConnectWalletModal from '../components/csr/ConnectWalletModal'
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
            distinct: 'id',
            include: {
                handlers: true,
                subscriptions: {
                    where: {
                        userId: { contains: user.id }
                    }
                },
                proposals: { where: { timeEnd: { gt: new Date() } } }
            }
        })
        return daosList
    } catch (e) {
        return []
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
    const cookieStore = cookies()
    if (!cookieStore.get('hasSeenLanding')) redirect('/landing')

    const subscribedDAOs = await getSubscribedDAOs()
    const proxies = await getProxies()

    const subscripions = subscribedDAOs.map((subDAO) => {
        return { id: subDAO.id, name: subDAO.name }
    })

    return (
        <div className='relative'>
            <div className='z-10'>
                <ConnectWalletModal />
            </div>
            <div className='hidden lg:flex'>
                <Filters subscriptions={subscripions} proxies={proxies} />
            </div>
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
