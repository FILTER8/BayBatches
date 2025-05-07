import { NextResponse } from 'next/server';
import {
  NeynarAPIClient,
  Configuration,
  isApiErrorResponse,
  User as NeynarUser,
} from '@neynar/nodejs-sdk';

interface UserProfile {
  username: string;
  display_name: string;
  pfp_url: string;
  address: string;
}

interface NeynarUserResponse {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  verifications?: string[];
  address?: string;
}

if (!process.env.NEYNAR_API_KEY) {
  throw new Error('NEYNAR_API_KEY is not defined in environment variables');
}

const config = new Configuration({
  apiKey: process.env.NEYNAR_API_KEY,
  baseOptions: {
    headers: {
      'x-neynar-experimental': 'true',
    },
  },
});

const client = new NeynarAPIClient(config);

async function resolveFidsFromAddresses(
  addresses: string[]
): Promise<Record<string, number>> {
  try {
    const response = await fetch(
      'https://api.neynar.com/v2/farcaster/user/bulk-by-address',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          api_key: process.env.NEYNAR_API_KEY!,
          'x-neynar-experimental': 'true',
        },
        body: JSON.stringify({ addresses: addresses.map((addr) => addr.toLowerCase()) }),
      }
    );

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.statusText}`);
    }

    const data = await response.json();

    return data.users.reduce((acc: Record<string, number>, user: NeynarUserResponse) => {
      if (user.fid && user.address) {
        acc[user.address.toLowerCase()] = user.fid;
      }
      return acc;
    }, {});
  } catch (error) {
    console.error('Failed to resolve FIDs from addresses:', error);
    return {};
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    const fidMap = await resolveFidsFromAddresses([address.toLowerCase()]);
    const fid = fidMap[address.toLowerCase()];

    if (!fid) {
      console.warn(`No FID found for address: ${address}`);
      return NextResponse.json(null);
    }

    const response = await client.fetchBulkUsers({ fids: [fid] });
    const user = response.users[0];

    if (!user) {
      console.warn(`No user found for FID: ${fid}`);
      return NextResponse.json(null);
    }

    return NextResponse.json({
      username: user.username || address.slice(0, 6),
      display_name: user.display_name || user.username || address.slice(0, 6),
      pfp_url: user.pfp_url || '/splashicon.png',
      address: user.verifications?.[0] || address,
    });
  } catch (error) {
    if (isApiErrorResponse(error)) {
      console.error(`Failed to fetch profile for ${address}:`, error.response.data);
    } else {
      console.error(`Failed to fetch profile for ${address}:`, error);
    }
    return NextResponse.json({ error: 'Failed to fetch profile', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { addresses } = await request.json();

    if (!Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json({ error: 'Addresses array is required' }, { status: 400 });
    }

    const lowerAddresses = addresses.map((addr: string) => addr.toLowerCase());
    const fidMap = await resolveFidsFromAddresses(lowerAddresses);

    const fids = lowerAddresses
      .map((addr) => fidMap[addr])
      .filter((fid): fid is number => fid !== undefined);

    if (fids.length === 0) {
      console.warn(`No FIDs found for addresses: ${lowerAddresses.join(', ')}`);
      return NextResponse.json({});
    }

    const response = await client.fetchBulkUsers({ fids });

    const profiles = response.users.reduce((acc: Record<string, UserProfile>, user: NeynarUser) => {
      const address =
        user.verifications?.[0]?.toLowerCase() ||
        lowerAddresses.find((addr) => fidMap[addr] === user.fid);

      if (address) {
        acc[address] = {
          username: user.username || address.slice(0, 6),
          display_name: user.display_name || user.username || address.slice(0, 6),
          pfp_url: user.pfp_url || '/splashicon.png',
          address,
        };
      }

      return acc;
    }, {});

    return NextResponse.json(profiles);
  } catch (error) {
    console.error('Failed to fetch bulk profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch profiles', details: String(error) }, { status: 500 });
  }
}
