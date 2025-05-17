import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import MintbayEditionAbi from '../../../contracts/MintbayEdition.json';

const LAUNCHPAD_FEE = '0.0004';

export async function POST(request: Request, { params }: { params: { editionId: string } }) {
  const { editionId } = params;

  if (!ethers.isAddress(editionId)) {
    return NextResponse.json({ error: 'Invalid edition ID' }, { status: 400 });
  }

  const client = new ApolloClient({
    uri: process.env.NEXT_PUBLIC_GRAPHQL_URL,
    cache: new InMemoryCache(),
  });

  try {
    const { data } = await client.query({
      query: gql`
        query TokenPageQuery($id: ID!) {
          edition(id: $id) {
            id
            priceEth
            isFreeMint
          }
        }
      `,
      variables: { id: editionId.toLowerCase() },
    });

    const edition = data?.edition;
    if (!edition) {
      return NextResponse.json({ error: 'Edition not found' }, { status: 404 });
    }

    const baseCost = edition.isFreeMint ? 0 : Number(edition.priceEth || '0');
    const totalCost = baseCost + Number(LAUNCHPAD_FEE);
    const totalCostWei = BigInt(Math.round(totalCost * 1e18));

    const transaction = {
      chainId: 8453, // Base mainnet
      to: editionId as `0x${string}`,
      data: new ethers.Interface(MintbayEditionAbi.abi).encodeFunctionData('collectBatch', [BigInt(1)]),
      value: totalCostWei.toString(),
    };

    return NextResponse.json({
      transaction,
      message: `Mint ${editionId}`,
    });
  } catch (error) {
    console.error('Error generating transaction:', error);
    return NextResponse.json({ error: 'Failed to generate transaction' }, { status: 500 });
  }
}