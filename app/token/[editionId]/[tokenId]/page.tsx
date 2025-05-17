import { Metadata } from 'next';
import { useQuery } from '@apollo/client';
import { ethers } from 'ethers';
import { TokenDetail } from '../../../components/TokenDetail';
import { EDITION_QUERY } from '../../../graphql/queries';

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

const APP_URL = process.env.NEXT_PUBLIC_URL || 'https://your-app-url.com';
const IMAGE_BASE_URL = 'https://pub-bd7c5d8a825145c691a3ad40196fd45c.r2.dev';

export async function generateMetadata({ params }: TokenPageProps): Promise<Metadata> {
  const { editionId } = params;

  if (!ethers.isAddress(editionId)) {
    return {
      title: 'Invalid Edition | Mintbay',
      description: 'The specified edition ID is invalid.',
    };
  }

  const imageUrl = `${IMAGE_BASE_URL}/${editionId.toLowerCase()}.png`;

  // Fetch edition data server-side
  try {
    const { data } = await import('@apollo/client').then(({ useQuery }) =>
      useQuery<EditionData>(EDITION_QUERY, {
        variables: { id: editionId.toLowerCase() },
        fetchPolicy: 'cache-and-network',
      })
    );

    const edition = data?.edition;
    const name = edition?.name || 'Sample NFT';

    return {
      title: `${name} | Mintbay`,
      description: `Collect ${name} on Mintbay!`,
      openGraph: {
        title: `${name} | Mintbay`,
        description: `Collect ${name} on Mintbay!`,
        url: `${APP_URL}/token/${editionId}/1`,
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
        'fc:frame': JSON.stringify({
          version: 'next',
          imageUrl: imageUrl,
          button: {
            title: 'Collect',
            action: {
              type: 'launch_frame',
              name: 'Mintbay Collect',
              url: `${APP_URL}/token/${editionId}/1`,
              splashImageUrl: imageUrl,
              splashBackgroundColor: '#f5f0ec',
            },
          },
        }),
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
        url: `${APP_URL}/token/${editionId}/1`,
        images: [{ url: imageUrl, width: 1200, height: 630, alt: 'Mintbay NFT' }],
        type: 'website',
      },
    };
  }
}

export default async function TokenPage({ params }: TokenPageProps) {
  const { editionId, tokenId } = params;

  if (!ethers.isAddress(editionId)) {
    return (
      <div className="text-sm text-red-500 text-center mt-4">
        Invalid edition ID
      </div>
    );
  }

  const { data, error } = await import('@apollo/client').then(({ useQuery }) =>
    useQuery<EditionData>(EDITION_QUERY, {
      variables: { id: editionId.toLowerCase() },
      fetchPolicy: 'cache-and-network',
    })
  );

  if (!data?.edition || error) {
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