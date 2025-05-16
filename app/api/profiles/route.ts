import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Interface for FID-address mappings
interface FidAddressMapping {
  fid: string;
  address: string;
  username: string;
  avatarUrl?: string;
}

// Path to mappings file
const mappingsFile = join(process.cwd(), 'mappings.json');

// Initialize mappings file if it doesn't exist
try {
  readFileSync(mappingsFile);
} catch {
  writeFileSync(mappingsFile, JSON.stringify({}));
}

// Helper to read mappings
function readMappings(): Record<string, FidAddressMapping> {
  try {
    return JSON.parse(readFileSync(mappingsFile, 'utf-8'));
  } catch (error) {
    console.error('Failed to read mappings:', error);
    return {};
  }
}

// Helper to write mappings
function writeMappings(mappings: Record<string, FidAddressMapping>) {
  try {
    writeFileSync(mappingsFile, JSON.stringify(mappings, null, 2));
  } catch (error) {
    console.error('Failed to write mappings:', error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { untrustedData } = body;
    const { fid, address } = untrustedData || {};

    if (!fid || !address) {
      console.warn('Missing fid or address in Frame payload:', untrustedData);
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Fetch profile from Wield
    const response = await fetch(`https://build.wield.xyz/farcaster/v2/users?fids=${fid}`, {
      headers: {
        'API-KEY': process.env.WIELD_API_KEY!
      }
    });

    if (!response.ok) {
      throw new Error(`Wield API error: ${response.statusText}`);
    }

    const data = await response.json();
    const user = data.result.users[0];
    if (!user) {
      console.warn(`No user found for FID: ${fid}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Store mapping
    const mappings = readMappings();
    mappings[address.toLowerCase()] = {
      fid: fid.toString(),
      address: address.toLowerCase(),
      username: fid === '211246' ? 'baydog' : user.username, // Override for your FID
      avatarUrl: user.pfp.url
    };
    writeMappings(mappings);

    // Return Frame metadata (maintains NFT gallery functionality)
    return NextResponse.json({
      version: 'vNext',
      image: 'https://mintbay-miniframe.vercel.app/nft-gallery.png', // Update with your gallery image
      buttons: [
        {
          label: 'Collect NFT',
          action: 'post'
        }
      ],
      postUrl: 'https://mintbay-miniframe.vercel.app/api/frame'
    });
  } catch (error) {
    console.error('Failed to handle Frame POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}