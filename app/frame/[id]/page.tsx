import { Metadata } from 'next';
import Head from 'next/head';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import { ethers } from 'ethers';

interface FramePageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: FramePageProps): Promise<Metadata> {
  const { id } = params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bay-batches.vercel.app';
  console.log('Generating metadata for id:', id, 'Base URL:', baseUrl);

  if (!id || !ethers.isAddress(id)) {
    console.error(`Invalid address: ${id}`);
    return {
      title: 'Mint Your NFT',
      description: 'Claim a limited-edition NFT on Mintbay!',
      openGraph: {
        title: 'Mint Your NFT',
        description: 'Claim a limited-edition NFT on Mintbay!',
        images: [`${baseUrl}/default-nft.png`],
        url: baseUrl,
      },
      other: {
        'fc:frame': 'vNext',
        'fc:frame:image': `${baseUrl}/default-nft.png`,
        'fc:frame:image:aspect_ratio': '1:1',
        'fc:frame:button:1': 'Collect',
        'fc:frame:button:1:action': 'tx',
        'fc:frame:button:1:target': `${baseUrl}/api/collect/${id.toLowerCase()}`,
        'fc:frame:button:2': 'Create',
        'fc:frame:button:2:action': 'link',
        'fc:frame:button:2:target': 'https://bay-batches.vercel.app',
        'fc:frame:post_url': `${baseUrl}/api/frame-callback`,
      },
    };
  }

  const client = new ApolloClient({
    uri: process.env.NEXT_PUBLIC_GRAPHQL_URL,
    cache: new InMemoryCache(),
  });

  let edition;
  try {
    const { data, errors } = await client.query({
      query: gql`
        query TokenPageQuery($id: ID!) {
          edition(id: $id) {
            id
            name
            totalSupply
            editionSize
            priceEth
            isFreeMint
          }
        }
      `,
      variables: { id: id.toLowerCase() },
    });

    console.log('GraphQL response for id:', id, 'Data:', data, 'Errors:', errors);

    if (errors) {
      console.error('GraphQL errors for id:', id, errors);
      throw new Error('GraphQL query errors');
    }

    edition = data?.edition;
    if (!edition) {
      console.error(`No edition found for id: ${id}`);
      edition = { name: 'Unknown NFT', totalSupply: 0, editionSize: '∞', priceEth: '0', isFreeMint: false };
    }
  } catch (error) {
    console.error('Metadata query failed for id:', id, error);
    edition = { name: 'Unknown NFT', totalSupply: 0, editionSize: '∞', priceEth: '0', isFreeMint: false };
  }

  const minted = Number(edition.totalSupply) || 0;
  const editionSize = Number(edition.editionSize) || '∞';
  const editionCountDisplay = `${minted}/${editionSize}`;
  const totalCost = Number(edition.priceEth || '0').toFixed(4).replace(/\.?0+$/, '');
  const pageUrl = `${baseUrl}/token/${id.toLowerCase()}/1`;
  let imageUrl = `${baseUrl}/default-nft.png`;

  const cloudflareUrl = `https://pub-bd7c5d8a825145c691a3ad40196fd45c.r2.dev/${id.toLowerCase()}.png`;
  try {
    console.log(`Checking Cloudflare image for id: ${id} at ${cloudflareUrl}`);
    const response = await fetch(cloudflareUrl, { method: 'HEAD' });
    if (response.ok) {
      console.log(`Cloudflare image found for id: ${id}`);
      imageUrl = cloudflareUrl;
    } else {
      console.log(`Cloudflare image not found for id: ${id}, status: ${response.status}`);
    }
  } catch (error) {
    console.error(`Error fetching Cloudflare image for id: ${id}`, error);
  }

  console.log(`Final image URL for id: ${id}: ${imageUrl}`);

  return {
    title: (edition.name || 'Mint Your NFT').replace(/['"]/g, ''),
    description: `Claim this limited-edition NFT: ${edition.name || 'NFT'}! Edition: ${editionCountDisplay} | Price: ${totalCost} ETH`,
    openGraph: {
      title: (edition.name || 'Mint Your NFT').replace(/['"]/g, ''),
      description: `Claim this limited-edition NFT: ${edition.name || 'NFT'}! Edition: ${editionCountDisplay} | Price: ${totalCost} ETH`,
      images: [imageUrl],
      url: pageUrl,
      siteName: 'Mintbay',
    },
    twitter: {
      card: 'summary_large_image',
      title: (edition.name || 'Mint Your NFT').replace(/['"]/g, ''),
      description: `Claim this limited-edition NFT: ${edition.name || 'NFT'}! Edition: ${editionCountDisplay} | Price: ${totalCost} ETH`,
      images: [imageUrl],
    },
    other: {
      'fc:frame': 'vNext',
      'fc:frame:image': imageUrl,
      'fc:frame:image:aspect_ratio': '1:1',
      'fc:frame:button:1': 'Collect',
      'fc:frame:button:1:action': 'tx',
      'fc:frame:button:1:target': `${baseUrl}/api/collect/${id.toLowerCase()}`,
      'fc:frame:button:2': 'Create',
      'fc:frame:button:2:action': 'link',
      'fc:frame:button:2:target': 'https://bay-batches.vercel.app',
      'fc:frame:post_url': `${baseUrl}/api/frame-callback`,
    },
  };
}

export default async function FramePage({ params }: FramePageProps) {
  const { id } = params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bay-batches.vercel.app';
  console.log('Rendering frame for id:', id, 'Base URL:', baseUrl);

  if (!id || !ethers.isAddress(id)) {
    console.error(`Invalid address: ${id}`);
    return (
      <main className="min-h-screen bg-gray-100 text-black p-8 font-mono">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Mint Your NFT</h1>
          <p className="text-sm mb-4">Claim a limited-edition NFT on Mintbay!</p>
          <img
            src={`${baseUrl}/default-nft.png`}
            alt="Mint Your NFT"
            className="mx-auto mb-4 max-w-xs aspect-square object-cover"
          />
          <a
            href={baseUrl}
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 text-sm"
          >
            Go to Mint Page
          </a>
        </div>
      </main>
    );
  }

  const client = new ApolloClient({
    uri: process.env.NEXT_PUBLIC_GRAPHQL_URL,
    cache: new InMemoryCache(),
  });

  let edition;
  try {
    const { data, errors } = await client.query({
      query: gql`
        query TokenPageQuery($id: ID!) {
          edition(id: $id) {
            id
            name
            totalSupply
            editionSize
            priceEth
          }
        }
      `,
      variables: { id: id.toLowerCase() },
    });

    console.log('GraphQL response for id:', id, 'Data:', data, 'Errors:', errors);

    if (errors) {
      console.error('GraphQL errors for id:', id, errors);
      throw new Error('GraphQL query errors');
    }

    edition = data?.edition;
    if (!edition) {
      console.error(`No edition found for id: ${id}`);
      edition = { name: 'Unknown NFT', totalSupply: 0, editionSize: '∞', priceEth: '0' };
    }
  } catch (error) {
    console.error('Page query failed for id:', id, error);
    edition = { name: 'Unknown NFT', totalSupply: 0, editionSize: '∞', priceEth: '0' };
  }

  const minted = Number(edition.totalSupply) || 0;
  const editionSize = Number(edition.editionSize) || '∞';
  const editionCountDisplay = `${minted}/${editionSize}`;
  const totalCost = Number(edition.priceEth || '0').toFixed(4).replace(/\.?0+$/, '');
  const pageUrl = `${baseUrl}/token/${id.toLowerCase()}/1`;
  let imageUrl = `${baseUrl}/default-nft.png`;

  const cloudflareUrl = `https://pub-bd7c5d8a825145c691a3ad40196fd45c.r2.dev/${id.toLowerCase()}.png`;
  try {
    console.log(`Checking Cloudflare image for id: ${id} at ${cloudflareUrl}`);
    const response = await fetch(cloudflareUrl, { method: 'HEAD' });
    if (response.ok) {
      console.log(`Cloudflare image found for id: ${id}`);
      imageUrl = cloudflareUrl;
    } else {
      console.log(`Cloudflare image not found for id: ${id}, status: ${response.status}`);
    }
  } catch (error) {
    console.error(`Error fetching Cloudflare image for id: ${id}`, error);
  }

  console.log(`Final image URL for id: ${id}: ${imageUrl}`);

  const frameMeta = {
    title: (edition.name || 'Mint Your NFT').replace(/['"]/g, ''),
    description: `Claim this limited-edition NFT: ${edition.name || 'NFT'}! Edition: ${editionCountDisplay} | Price: ${totalCost} ETH`,
    image: imageUrl,
    url: pageUrl,
  };

  return (
    <main className="min-h-screen bg-gray-100 text-black p-8 font-mono">
      <div className="max-w-7xl mx-auto text-center">
        <h1 className="text-2xl font-bold mb-4">{frameMeta.title}</h1>
        <p className="text-sm mb-4">{frameMeta.description}</p>
        <img
          src={frameMeta.image}
          alt={frameMeta.title}
          className="mx-auto mb-4 max-w-xs aspect-square object-cover"
        />
        <a
          href={frameMeta.url}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 text-sm"
        >
          Go to Mint Page
        </a>
      </div>
    </main>
  );
}