import SubscribedDAO from './item/page'
import { serverQuery } from '../../../helpers/trpcHelpers'
import { unstable_getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../../../pages/api/auth/[...nextauth]'

const getData = async () => {
    const session = await unstable_getServerSession(getAuthOptions())
    const userAddress = session?.user?.name ?? ''

    const subscribedDAOs = await serverQuery.user.subscriptions.subscribedDAOs({
        userAddress: userAddress
    })
    const allDAOs = await serverQuery.public.daos()

    return allDAOs.filter(
        (dao) =>
            !subscribedDAOs
                .map((subscribedDAO) => subscribedDAO.name)
                .includes(dao.name)
    )
}

export const UnsubscribedDAOs = async () => {
    const unsubscribedDAOs = await getData()

    return (
        <main>
            {unsubscribedDAOs.map((unsubscribedDAO, index) => {
                return <SubscribedDAO key={index} dao={unsubscribedDAO.name} />
            })}
        </main>
    )
}
