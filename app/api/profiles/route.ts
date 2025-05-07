import { NextResponse } from 'next/server';
import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';

interface UserProfile {
  username: string;
  display_name: string;
  pfp_url: string;
  address: string;
}

if (!process.env.NEYNAR_API_KEY) {
  throw new Error('NEYNAR_API_KEY is not defined in environment variables');
}

const config = new Configuration({
  apiKey: process.env.NEYNAR_API_KEY,
  baseOptions: {
    headers: {
      'x-neynar-experimental': true,
    },
  },
});

const client = new NeynarAPIClient(config);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    const response = await client.user.fetchUsersByAddress([address.toLowerCase()]);
    const user = response.users[0] || null;
    return NextResponse.json(user);
  } catch (error) {
    console.error(`Failed to fetch profile for ${address}:`, error);
    return NextResponse.json(null, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { addresses } = await request.json();
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json({ error: 'Addresses array is required' }, { status: 400 });
    }

    const lowerAddresses = addresses.map((addr: string) => addr.toLowerCase());
    const response = await client.user.fetchUsersByAddress(lowerAddresses);
    const profiles = response.users.reduce((acc: Record<string, UserProfile>, user: UserProfile) => {
      acc[user.address.toLowerCase()] = {
        username: user.username,
        display_name: user.display_name,
        pfp_url: user.pfp_url,
        address: user.address,
      };
      return acc;
    }, {});

    return NextResponse.json(profiles);
  } catch (error) {
    console.error('Failed to fetch bulk profiles:', error);
    return NextResponse.json({}, { status: 500 });
  }
}