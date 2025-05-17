import { Metadata } from 'next';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import { ethers } from 'ethers';
import { TokenDetail } from '../../../components/TokenDetail';

interface Edition {
  id: string;
  name: string;
  creator: { id: string };
  createdAt: string;
  palette: string;
  totalSupply: string;
  editionSize: string;
  price: string;
  isFreeMint: boolean;
  paused: boolean;
  glyphContract?: { id: string };
}

interface EditionData {
  edition: Edition;
}

interface TokenPageProps {
  params: {
    editionId: string;
    tokenId: string;
  };
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://bay-batches.vercel.app';
const IMAGE_BASE_URL = 'https://pub-bd7c5d8a825145c691a3ad40196fd45c.r2.dev';

export async function generateMetadata({ params }: TokenPageProps): Promise<Metadata> {
  const { editionId } = params;

  if (!ethers.isAddress(editionId)) {
    console.error('Invalid editionId:', editionId);
    return {
      title: 'Invalid Edition | Mintbay',
      description: 'The specified edition ID is invalid.',
    };
  }

  const imageUrl = `${IMAGE_BASE_URL}/${editionId.toLowerCase()}.png`;
  console.log('Generating metadata for editionId:', { editionId, imageUrl });

  const client = new ApolloClient({
    uri: process.env.NEXT_PUBLIC_GRAPHQL_URL,
    cache: new InMemoryCache(),
  });

  try {
    const { data, errors } = await client.query<EditionData>({
      query: gql`
        query TokenPageQuery($id: ID!) {
          edition(id: $id) {
            id
            name
            totalSupply
            editionSize
            price
            isFreeMint
            paused
          }
        }
      `,
      variables: { id: editionId.toLowerCase() },
    });

    if (errors) {
      console.error('GraphQL errors:', errors);
      throw new Error('GraphQL query errors');
    }

    const edition = data?.edition;
    const name = edition?.name || 'Sample NFT';

    return {
      title: `${name} | Mintbay`,
      description: `Collect ${name} on Mintbay!`,
      openGraph: {
        title: `${name} | Mintbay`,
        description: `Collect ${name} on Mintbay!`,
        url: `${BASE_URL}/token/${editionId.toLowerCase()}/1`,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: `${name} NFT`,
          },
        ],
        type: 'website',
      },
      other: {
        'fc:frame': 'vNext',
        'fc:frame:image': imageUrl,
        'fc:frame:button:1': 'Collect',
        'fc:frame:button:1:action': 'tx',
        'fc:frame:button:1:target': `${BASE_URL}/api/collect/${editionId.toLowerCase()}`,
        'fc:frame:button:2': 'Create',
        'fc:frame:button:2:action': 'link',
        'fc:frame:button:2:target': 'https://warpcast.com/miniapps/NoE3DOFVe3dr/baybatches',
        'fc:frame:post_url': `${BASE_URL}/api/frame-callback`,
      },
    };
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return {
      title: 'Error | Mintbay',
      description: 'Failed to load edition data.',
      openGraph: {
        title: 'Error | Mintbay',
        description: 'Failed to load edition data.',
        url: `${BASE_URL}/token/${editionId.toLowerCase()}/1`,
        images: [{ url: imageUrl, width: 1200, height: 630, alt: 'Mintbay NFT' }],
        type: 'website',
      },
    };
  }
}

export default async function TokenPage({ params }: TokenPageProps) {
  const { editionId, tokenId } = params;

  if (!ethers.isAddress(editionId)) {
    console.error('Invalid editionId in render:', editionId);
    return (
      <div className="text-sm text-red-500 text-center mt-4">
        Invalid edition ID
      </div>
    );
  }

  const client = new ApolloClient({
    uri: process.env.NEXT_PUBLIC_GRAPHQL_URL,
    cache: new InMemoryCache(),
  });

  let data: EditionData | undefined;
  let error: Error | undefined;
  try {
    const result = await client.query<EditionData>({
      query: gql`
        query TokenPageQuery($id: ID!) {
          edition(id: $id) {
            id
            name
            totalSupply
            editionSize
            price
            isFreeMint
            paused
          }
        }
      `,
      variables: { id: editionId.toLowerCase() },
    });
    data = result.data;
    if (result.errors) {
      throw new Error('GraphQL query errors');
    }
  } catch (err) {
    error = err instanceof Error ? err : new Error('Unknown error');
    console.error('Error loading edition:', { error, editionId });
  }

  if (!data?.edition || error) {
    console.error('Error loading edition:', { error, editionId });
    return (
      <div className="text-sm text-red-500 text-center mt-4">
        Error loading token: {error?.message || 'Edition not found'}
      </div>
    );
  }

  const edition = {
    id: editionId,
    name: data.edition.name || 'Sample NFT',
    totalSupply: data.edition.totalSupply || '0',
    editionSize: data.edition.editionSize || '0',
    price: data.edition.price || '0',
    isFreeMint: data.edition.isFreeMint ?? false,
    paused: data.edition.paused ?? false,
  };

  return (
    <div className="flex justify-center">
      <TokenDetail edition={edition} tokenId={Number(tokenId)} />
    </div>
  );
}