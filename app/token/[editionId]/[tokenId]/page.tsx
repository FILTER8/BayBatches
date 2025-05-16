'use client';

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

export default function TokenPage({ params }: TokenPageProps) {
  const { editionId, tokenId } = params;

  // Validate editionId
  if (!ethers.isAddress(editionId)) {
    throw new Error('Invalid editionId');
  }

  const { data, loading, error } = useQuery<EditionData>(EDITION_QUERY, {
    variables: { id: editionId.toLowerCase() },
    fetchPolicy: 'cache-and-network',
  });

  const imageUrl = `https://pub-bd7c5d8a825145c691a3ad40196fd45c.r2.dev/${editionId.toLowerCase()}.png`;
  const appUrl = process.env.NEXT_PUBLIC_URL || 'https://your-app-url.com';
  const frameEmbed = {
    version: 'next',
    imageUrl: imageUrl,
    button: {
      title: 'Collect',
      action: {
        type: 'launch_frame',
        name: 'Mintbay Collect',
        url: `${appUrl}/token/${editionId}/1`,
        splashImageUrl: imageUrl,
        splashBackgroundColor: '#f5f0ec',
      },
    },
  };

  if (loading) {
    return (
      <div className="flex justify-center mt-4">
        <svg
          className="animate-spin h-5 w-5 text-gray-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    );
  }

  if (error || !data?.edition) {
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
    <html lang="en">
      <head>
        <meta name="fc:frame" content={JSON.stringify(frameEmbed)} />
        <meta name="og:image" content={imageUrl} />
        <meta name="og:title" content={edition.name} />
        <meta name="og:description" content={`Collect ${edition.name} on Mintbay!`} />
      </head>
      <body>
        <TokenDetail edition={edition} tokenId={Number(tokenId)} />
      </body>
    </html>
  );
}