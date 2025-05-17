import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import { ethers } from 'ethers';

interface FramePageProps {
  frameMeta: {
    title: string;
    description: string;
    image: string;
    url: string;
  };
}

export default function FramePage({ frameMeta }: FramePageProps) {
  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{frameMeta.title}</title>
        <meta name="description" content={frameMeta.description} />
        <meta property="og:title" content={frameMeta.title} />
        <meta property="og:description" content={frameMeta.description} />
        <meta property="og:image" content={frameMeta.image} />
        <meta property="og:site_name" content="Mintbay" />
        <meta property="og:url" content={frameMeta.url} />
        <meta property="twitter:title" content={frameMeta.title} />
        <meta property="twitter:description" content={frameMeta.description} />
        <meta name="twitter:image" content={frameMeta.image} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="fc:frame" content="vNext" />
        <meta name="fc:frame:image" content={frameMeta.image} />
        <meta name="fc:frame:image:aspect_ratio" content="1:1" />
        <meta name="fc:frame:button:1" content="Collect" />
        <meta name="fc:frame:button:1:action" content="tx" />
        <meta name="fc:frame:button:1:target" content="https://bay-batches.vercel.app/api/collect/${frameMeta.url.split('/token/')[1]?.split('/')[0]}" />
        <meta name="fc:frame:button:2" content="Create" />
        <meta name="fc:frame:button:2:action" content="link" />
        <meta name="fc:frame:button:2:target" content="https://bay-batches.vercel.app" />
        <meta name="fc:frame:post_url" content="https://bay-batches.vercel.app/api/frame-callback" />
        <link rel="shortcut icon" href={frameMeta.image} />
      </Head>
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
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params || {};
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bay-batches.vercel.app';
  console.log('Processing frame for id:', id, 'Base URL:', baseUrl);

  if (!id || typeof id !== 'string' || !ethers.isAddress(id)) {
    console.error(`Invalid address: ${id}`);
    return {
      props: {
        frameMeta: {
          title: 'Mint Your NFT',
          description: 'Claim a limited-edition NFT on Mintbay!',
          image: `${baseUrl}/default-nft.png`,
          url: baseUrl,
        },
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
    console.error('SSR query failed for id:', id, error);
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
    props: {
      frameMeta: {
        title: (edition.name || 'Mint Your NFT').replace(/['"]/g, ''),
        description: `Claim this limited-edition NFT: ${edition.name || 'NFT'}! Edition: ${editionCountDisplay} | Price: ${totalCost} ETH`,
        image: imageUrl,
        url: pageUrl,
      },
    },
  };
};