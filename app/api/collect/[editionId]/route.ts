import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import MintbayEditionAbi from '../../../contracts/MintbayEdition.json';

const LAUNCHPAD_FEE = '0.0004';
const RPC_URL = process.env.NEXT_PUBLIC_ALCHEMY_URL || 'https://mainnet.base.org';

export async function POST(req: Request, context: { params: { editionId: string } }) {
  console.log('REQUEST RECEIVED');
  console.log('params', context.params);

  const { editionId } = context.params;

  if (!ethers.isAddress(editionId)) {
    console.error(`Invalid edition ID: ${editionId}`);
    return NextResponse.json({ error: 'Invalid edition ID' }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_ALCHEMY_URL) {
    console.error('NEXT_PUBLIC_ALCHEMY_URL is not set, falling back to public RPC');
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  try {
    // Check if contract exists
    console.log(`Checking contract existence at ${editionId} via RPC: ${RPC_URL}`);
    const code = await provider.getCode(editionId);
    if (code === '0x') {
      console.error(`No contract deployed at ${editionId}`);
      return NextResponse.json({ error: 'No contract deployed at this address' }, { status: 404 });
    }

    const contract = new ethers.Contract(editionId, MintbayEditionAbi.abi, provider);

    console.log(`Querying contract at ${editionId} for price, isFreeMint, paused, editionSize, nextTokenId, and maxBatchMint`);

    // Fetch contract state
    const [priceWei, isFreeMint, paused, editionSize, nextTokenId, maxBatchMint] = await Promise.all([
      contract.price().catch(e => { throw new Error(`price call failed: ${e.message}`); }),
      contract.isFreeMint().catch(e => { throw new Error(`isFreeMint call failed: ${e.message}`); }),
      contract.paused().catch(e => { throw new Error(`paused call failed: ${e.message}`); }),
      contract.editionSize().catch(e => { throw new Error(`editionSize call failed: ${e.message}`); }),
      contract.nextTokenId().catch(e => { throw new Error(`nextTokenId call failed: ${e.message}`); }),
      contract.MAX_BATCH_MINT().catch(e => { throw new Error(`maxBatchMint call failed: ${e.message}`); }),
    ]);

    console.log(`Contract data for ${editionId}`, {
      priceEth: ethers.formatEther(priceWei),
      isFreeMint,
      paused,
      editionSize: editionSize.toString(),
      nextTokenId: nextTokenId.toString(),
      maxBatchMint: maxBatchMint.toString(),
    });

    // Validate editionSize
    if (editionSize <= 0) {
      console.error(`Invalid editionSize for ${editionId}: ${editionSize}`);
      return NextResponse.json({ error: 'Invalid edition size' }, { status: 400 });
    }

    console.log(`Checking mint status: nextTokenId=${nextTokenId}, editionSize=${editionSize}`);
    if (nextTokenId > editionSize) {
      console.error(`Contract at ${editionId} is fully minted (nextTokenId: ${nextTokenId}, editionSize: ${editionSize})`);
      return NextResponse.json({ error: 'Edition is fully minted' }, { status: 400 });
    }

    if (paused) {
      console.error(`Contract at ${editionId} is paused`);
      return NextResponse.json({ error: 'Contract is paused' }, { status: 400 });
    }

    const quantity = BigInt(1); // Hardcoded for Frame
    if (quantity > maxBatchMint) {
      console.error(`Quantity ${quantity} exceeds MAX_BATCH_MINT (${maxBatchMint}) for ${editionId}`);
      return NextResponse.json({ error: `Batch size limited to ${maxBatchMint} NFTs` }, { status: 400 });
    }

    const priceEth = ethers.formatEther(priceWei);
    const baseCost = isFreeMint ? 0 : Number(priceEth || '0');
    const totalCost = baseCost + Number(LAUNCHPAD_FEE);
    if (isNaN(totalCost) || totalCost < 0) {
      console.error(`Invalid total cost for editionId: ${editionId}`, { baseCost, totalCost, priceEth });
      return NextResponse.json({ error: 'Invalid price data' }, { status: 500 });
    }

    const totalCostWei = ethers.parseUnits(totalCost.toFixed(8), 18);
    let transactionData;
    try {
      const iface = new ethers.Interface(MintbayEditionAbi.abi);
      const functionFragment = iface.getFunction('collectBatch');
      if (!functionFragment) {
        console.error(`Function collectBatch not found in ABI for editionId: ${editionId}`);
        return NextResponse.json({ error: 'Invalid contract ABI: collectBatch function missing' }, { status: 500 });
      }
      transactionData = iface.encodeFunctionData('collectBatch', [quantity]);
    } catch (abiError: unknown) {
      const errorMessage = abiError instanceof Error ? abiError.message : 'Unknown ABI error';
      console.error(`ABI encoding error for editionId: ${editionId}`, abiError);
      return NextResponse.json({ error: `Failed to encode transaction data: ${errorMessage}` }, { status: 500 });
    }

    console.log(`Generated transaction for editionId: ${editionId}`, {
      baseCost,
      totalCost,
      totalCostWei: totalCostWei.toString(),
      transactionData,
      to: editionId,
      chainId: 8453,
    });

    const transaction = {
      chainId: 8453, // Base mainnet
      to: editionId, // Validated address
      data: transactionData,
      value: totalCostWei.toString(),
    };

    const response = NextResponse.json({
      transaction,
      message: `Mint ${editionId}`,
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    response.headers.set('Cache-Control', 'no-cache');
    response.headers.set('Content-Type', 'application/json');

    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error generating transaction for editionId: ${editionId}`, {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: `Failed to generate transaction: ${errorMessage}` }, { status: 500 });
  }
}

export async function OPTIONS() {
  const response = NextResponse.json({});
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}