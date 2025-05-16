import { ethers } from 'ethers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { editionAddress } = body;

    if (!editionAddress || !ethers.isAddress(editionAddress)) {
      console.error('Invalid edition address:', editionAddress);
      return NextResponse.json({ error: 'Invalid edition address' }, { status: 400 });
    }

    const response = await fetch(
      `https://mintbay-r2-worker.mintbay-world.workers.dev/pull-specific/${editionAddress}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.PULL_SECRET_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`Worker error for ${editionAddress}: ${response.status} ${response.statusText}`);
      return NextResponse.json({ error: `Worker error: ${response.statusText}` }, { status: response.status });
    }

    console.log(`Triggered PNG generation for ${editionAddress}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`Failed to trigger PNG:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
