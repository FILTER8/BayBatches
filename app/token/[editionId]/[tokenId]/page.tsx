import { TokenDetail } from '../../../components/TokenDetail';
import { ethers } from 'ethers';

export default async function TokenPage({ params }: { params: { editionId: string; tokenId: string } }) {
  // Validate editionId
  if (!ethers.isAddress(params.editionId)) {
    throw new Error('Invalid editionId');
  }

  try {
    // Initialize provider for Base Mainnet
    const provider = new ethers.JsonRpcProvider(
      `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    );
    const contract = new ethers.Contract(params.editionId, require('../contracts/MintbayEdition.json').abi, provider);

    // Fetch contract data
    const [name, nextTokenId, editionSize, price, isFreeMint, paused] = await Promise.all([
      contract.name(),
      contract.nextTokenId(),
      contract.editionSize(),
      contract.price(),
      contract.isFreeMint(),
      contract.paused(),
    ]);

    // Derive totalSupply (nextTokenId starts at 1, so subtract 1)
    const totalSupply = (BigInt(nextTokenId) - BigInt(1)).toString();

    const edition = {
      id: params.editionId,
      name: name || 'Sample NFT',
      totalSupply: totalSupply,
      editionSize: editionSize.toString(),
      price: ethers.formatEther(price),
      isFreeMint: isFreeMint,
      paused: paused,
    };

    const imageUrl = `https://pub-bd7c5d8a825145c691a3ad40196fd45c.r2.dev/${params.editionId.toLowerCase()}.png`;
    const appUrl = process.env.NEXT_PUBLIC_URL || 'https://your-app-url.com';
    const frameEmbed = {
      version: 'next',
      imageUrl: imageUrl,
      button: {
        title: 'Collect',
        action: {
          type: 'launch_frame',
          name: 'Mintbay Collect',
          url: `${appUrl}/token/${params.editionId}/1`,
          splashImageUrl: imageUrl,
          splashBackgroundColor: '#f5f0ec',
        },
      },
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
          <TokenDetail edition={edition} tokenId={Number(params.tokenId)} />
        </body>
      </html>
    );
  } catch (error) {
    console.error('Error fetching edition data:', error);
    throw new Error('Failed to load edition data');
  }
}