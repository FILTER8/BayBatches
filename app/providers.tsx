'use client';

import { type ReactNode } from 'react';
import { ApolloProvider } from '@apollo/client';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import { farcasterFrame as miniAppConnector } from '@farcaster/frame-wagmi-connector';
import { MiniKitProvider } from '@coinbase/onchainkit/minikit';
import client from './components/apollo-client';

const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    miniAppConnector(),
    coinbaseWallet({
      appName: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'BayBatches',
    }),
    injected(),
  ],
  transports: {
    [base.id]: http('https://mainnet.base.org'),
  },
});

export function Providers(props: { children: ReactNode }) {
  return (
    <ApolloProvider client={client}>
      <WagmiProvider config={wagmiConfig}>
        <MiniKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={base}
          config={{
            appearance: {
              mode: 'auto',
              theme: 'mini-app-theme',
              name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME,
              logo: process.env.NEXT_PUBLIC_ICON_URL,
            },
          }}
        >
          {props.children}
        </MiniKitProvider>
      </WagmiProvider>
    </ApolloProvider>
  );
}