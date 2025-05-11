
import { ethers } from 'ethers';

const profileCache = new Map<string, { username: string; avatarUrl: string; basename: string | null }>();
const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_ALCHEMY_URL || '');

interface UserProfile {
  username: string;
  display_name: string;
  pfp_url: string;
  address: string;
}

async function fetchBasename(walletAddress: string): Promise<string | null> {
  try {
    // Attempt to resolve Basename (e.g., username.base.eth)
    const resolver = await provider.getResolver(`${walletAddress.toLowerCase()}.base.eth`);
    if (resolver) {
      const name = await resolver.getName();
      return name || null;
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch Basename for ${walletAddress}:`, error);
    return null;
  }
}

export async function getUserProfile(walletAddress: string) {
  const lowerAddress = walletAddress.toLowerCase();
  if (profileCache.has(lowerAddress)) {
    return profileCache.get(lowerAddress)!;
  }
  try {
    const response = await fetch(`/api/profiles?address=${encodeURIComponent(lowerAddress)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const user: UserProfile | null = await response.json();
    const basename = await fetchBasename(lowerAddress);
    const profile = {
      username: user?.username || user?.display_name || walletAddress.slice(0, 6),
      avatarUrl: user?.pfp_url || 'https://bay-batches.vercel.app/splashicon.png',
      basename: basename || null,
    };
    profileCache.set(lowerAddress, profile);
    return profile;
  } catch (error) {
    console.error(`Failed to fetch profile for ${walletAddress}:`, error);
    const basename = await fetchBasename(lowerAddress);
    const profile = {
      username: walletAddress.slice(0, 6),
      avatarUrl: 'https://bay-batches.vercel.app/splashicon.png',
      basename: basename || null,
    };
    profileCache.set(lowerAddress, profile);
    return profile;
  }
}

export async function getUserProfiles(walletAddresses: string[]): Promise<Record<string, { username: string; avatarUrl: string; basename: string | null }>> {
  try {
    const lowerAddresses = walletAddresses.map((addr) => addr.toLowerCase());
    const response = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: lowerAddresses }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const profiles: Record<string, UserProfile> = await response.json();
    const result: Record<string, { username: string; avatarUrl: string; basename: string | null }> = {};
    for (const [address, user] of Object.entries(profiles) as [string, UserProfile][]) {
      const basename = await fetchBasename(address);
      const profile = {
        username: user.username || user.display_name || address.slice(0, 6),
        avatarUrl: user.pfp_url || 'https://bay-batches.vercel.app/splashicon.png',
        basename: basename || null,
      };
      profileCache.set(address, profile);
      result[address] = profile;
    }
    return result;
  } catch (error) {
    console.error('Failed to fetch bulk profiles:', error);
    const result: Record<string, { username: string; avatarUrl: string; basename: string | null }> = {};
    for (const address of walletAddresses) {
      const lowerAddress = address.toLowerCase();
      const basename = await fetchBasename(lowerAddress);
      const profile = {
        username: lowerAddress.slice(0, 6),
        avatarUrl: 'https://bay-batches.vercel.app/splashicon.png',
        basename: basename || null,
      };
      profileCache.set(lowerAddress, profile);
      result[lowerAddress] = profile;
    }
    return result;
  }
}