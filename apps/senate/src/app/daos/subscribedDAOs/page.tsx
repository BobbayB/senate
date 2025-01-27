import { SubscribedDAO } from './components/csr'
import { getAverageColor } from 'fast-average-color-node'
import { prisma } from '@senate/database'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../pages/api/auth/[...nextauth]'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const getSubscribedDAOs = async () => {
    const session = await getServerSession(authOptions())
    const userAddress = session?.user?.name ?? ''

    const user = await prisma.user
        .findFirstOrThrow({
            where: {
                name: { equals: userAddress }
            },
            select: {
                id: true
            }
        })
        .catch(() => {
            return { id: '0' }
        })

    const subscriptionsList = await prisma.subscription.findMany({
        where: {
            userId: user.id
        },
        include: {
            dao: {
                include: {
                    handlers: true,
                    proposals: { where: { timeEnd: { gt: new Date() } } }
                }
            }
        },
        orderBy: {
            dao: {
                name: 'asc'
            }
        }
    })

    return subscriptionsList
}

export default async function SubscribedDAOs() {
    if (process.env.OUTOFSERVICE === 'true') redirect('/outofservice')
    const cookieStore = cookies()
    if (!cookieStore.get('hasSeenLanding')) redirect('/landing')

    const subscriptions = (await getSubscribedDAOs()).sort((a, b) =>
        a.dao.name.localeCompare(b.dao.name)
    )

    const backgroundColors = await Promise.all(
        subscriptions.map(async (sub) => {
            const color = await getAverageColor(
                process.env.WEB_URL + sub.dao.picture + '.svg',
                {
                    mode: 'precision',
                    algorithm: 'sqrt'
                }
            )
                .then((color) => color)
                .catch(() => {
                    return { hex: '#5A5A5A' }
                })
            return {
                daoId: sub.id,
                color: `${color.hex}`
            }
        })
    )

    return (
        <div>
            {subscriptions.length > 0 && (
                <main>
                    <p className='mb-4 w-full text-[36px] font-semibold text-white'>
                        Your DAOs
                    </p>

                    <div className='grid grid-cols-1 place-items-center gap-10 min-[650px]:grid-cols-2 min-[900px]:grid-cols-3 lg:place-items-start min-[1200px]:grid-cols-4 min-[1500px]:grid-cols-5 min-[1800px]:grid-cols-6 min-[2200px]:grid-cols-7 min-[2300px]:grid-cols-8 min-[2500px]:grid-cols-9 min-[3000px]:grid-cols-10'>
                        {subscriptions.map((sub, index) => {
                            return (
                                <SubscribedDAO
                                    key={index}
                                    daoId={sub.dao.id}
                                    daoName={sub.dao.name}
                                    daoPicture={sub.dao.picture}
                                    bgColor={
                                        backgroundColors.find(
                                            (dao) => dao?.daoId == sub.id
                                        )?.color
                                    }
                                    daoHandlers={sub.dao.handlers.map(
                                        (handler) => handler.type
                                    )}
                                    activeProposals={sub.dao.proposals.length}
                                    notificationsEnabled={
                                        sub.notificationsEnabled
                                    }
                                />
                            )
                        })}
                    </div>
                </main>
            )}
        </div>
    )
}
