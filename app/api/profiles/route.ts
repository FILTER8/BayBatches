// app/api/profiles/route.ts
import { NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

interface UserProfile {
  username: string;
  display_name: string;
  pfp_url: string;
  address: string;
}

if (!process.env.NEYNAR_API_KEY) {
  throw new Error('NEYNAR_API_KEY is not defined in environment variables');
}

const client = new NeynarAPIClient(process.env.NEYNAR_API_KEY, {
  headers: {
    'x-neynar-experimental': true,
  },
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    const response = await client.fetchBulkUsersByAddress([address.toLowerCase()]);
    const user = response.users[0] || null;
    if (!user) {
      console.warn(`No user found for address: ${address}`);
    }
    return NextResponse.json(user);
  } catch (error) {
    console.error(`Failed to fetch profile for ${address}:`, error);
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
    const response = await client.fetchBulkUsersByAddress(lowerAddresses);
    const profiles = response.users.reduce((acc: Record<string, UserProfile>, user: UserProfile) => {
      acc[user.address.toLowerCase()] = {
        username: user.username || user.address.slice(0, 6),
        display_name: user.display_name || user.username || user.address.slice(0, 6),
        pfp_url: user.pfp_url || 'https://splashicon.png',
        address: user.address,
      };
      return acc;
    }, {});

    if (response.users.length === 0) {
      console.warn(`No profiles found for addresses: ${lowerAddresses.join(', ')}`);
    }

    return NextResponse.json(profiles);
  } catch (error) {
    console.error('Failed to fetch bulk profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch profiles', details: String(error) }, { status: 500 });
  }
}