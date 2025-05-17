import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Frame callback received:', body);

    const { transactionId, status } = body;
    const success = status === 'success';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bay-batches.vercel.app';

    if (success) {
      console.log(`Transaction ${transactionId} succeeded`);
    } else {
      console.error(`Transaction ${transactionId} failed`);
    }

    return NextResponse.json({
      frame: {
        version: 'vNext',
        image: success ? 'NFT Collected!' : 'Transaction Failed',
        buttons: [
          {
            label: success ? 'View Collection' : 'Try Again',
            action: success ? 'link' : 'post',
            target: success ? `${baseUrl}/collection` : `${baseUrl}/api/retry`,
          },
        ],
        post_url: `${baseUrl}/api/frame-callback`,
      },
    });
  } catch (error) {
    console.error('Error in frame callback:', error);
    return NextResponse.json({ error: 'Failed to process callback' }, { status: 500 });
  }
}