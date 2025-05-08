'use client';

import { type ReactNode } from 'react';
import { ApolloProvider } from '@apollo/client';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import { MiniKitProvider } from '@coinbase/onchainkit/minikit';
import client from './components/apollo-client';

const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'BayBatches',
    }),
    injected(),
  ],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_ALCHEMY_URL),
  },
});

export function Providers(props: { children: ReactNode }) {
  return (
    <ApolloProvider client={client}>
      <WagmiProvider config={wagmiConfig}>
        <MiniKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={baseSepolia}
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