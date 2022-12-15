import { SessionProvider } from 'next-auth/react'
import type { AppType } from 'next/app'
import type { Session } from 'next-auth'
import '../styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import type { GetSiweMessageOptions } from '@rainbow-me/rainbowkit-siwe-next-auth'
import { RainbowKitSiweNextAuthProvider } from '@rainbow-me/rainbowkit-siwe-next-auth'

import {
    darkTheme,
    getDefaultWallets,
    RainbowKitProvider,
} from '@rainbow-me/rainbowkit'
import { chain, configureChains, createClient, WagmiConfig } from 'wagmi'
import { infuraProvider } from 'wagmi/providers/infura'
import { publicProvider } from 'wagmi/providers/public'
import { trpc } from '../utils/trpc'
import Head from 'next/head'

const { chains, provider } = configureChains(
    [chain.mainnet],
    [
        infuraProvider({ apiKey: process.env.PROVIDER_URL ?? 'missing_key' }),
        publicProvider(),
    ]
)

const { connectors } = getDefaultWallets({
    appName: 'Senate',
    chains,
})

const wagmiClient = createClient({
    autoConnect: true,
    connectors,
    provider,
})

const getSiweMessageOptions: GetSiweMessageOptions = () => ({
    statement: 'Sign in to Senate',
})

const MyApp: AppType<{ session: Session | null }> = ({
    Component,
    pageProps: { session, ...pageProps },
}) => {
    return (
        <WagmiConfig client={wagmiClient}>
            <SessionProvider refetchInterval={0} session={session}>
                <RainbowKitSiweNextAuthProvider
                    getSiweMessageOptions={getSiweMessageOptions}
                >
                    <RainbowKitProvider
                        chains={chains}
                        theme={darkTheme({
                            accentColor: '#262626',
                            accentColorForeground: 'white',
                            borderRadius: 'medium',
                            overlayBlur: 'small',
                        })}
                    >
                        <Head>
                            <title>Senate</title>
                            <meta
                                name="viewport"
                                content="initial-scale=1.0, width=device-width"
                            />
                        </Head>
                        <Component {...pageProps} />
                    </RainbowKitProvider>
                </RainbowKitSiweNextAuthProvider>
            </SessionProvider>
        </WagmiConfig>
    )
}

export default trpc.withTRPC(MyApp)
