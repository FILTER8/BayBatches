const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const profileCache = new Map<
  string,
  { username: string; avatarUrl: string; timestamp: number }
>();

interface UserProfile {
  username: string;
  display_name: string;
  pfp_url: string;
  address: string;
}

export async function getUserProfile(walletAddress: string) {
  const lowerAddress = walletAddress.toLowerCase();
  if (profileCache.has(lowerAddress) && Date.now() - profileCache.get(lowerAddress)!.timestamp < CACHE_TTL) {
    console.log(`Cache hit for profile: ${lowerAddress}`);
    return profileCache.get(lowerAddress)!;
  }
  console.log(`Cache miss for profile: ${lowerAddress}`);
  try {
    const response = await fetch(`/api/profiles?address=${encodeURIComponent(lowerAddress)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const user: UserProfile | null = await response.json();
    const profile = {
      username: user?.username || user?.display_name || walletAddress.slice(0, 6),
      avatarUrl: user?.pfp_url || 'https://bay-batches.vercel.app/splashicon.png',
    };
    profileCache.set(lowerAddress, { ...profile, timestamp: Date.now() });
    return profile;
  } catch (error) {
    console.error(`Failed to fetch profile for ${walletAddress}:`, error);
    const profile = {
      username: walletAddress.slice(0, 6),
      avatarUrl: 'https://bay-batches.vercel.app/splashicon.png',
    };
    profileCache.set(lowerAddress, { ...profile, timestamp: Date.now() });
    return profile;
  }
}

export async function getUserProfiles(walletAddresses: string[]): Promise<Record<string, { username: string; avatarUrl: string }>> {
  try {
    const lowerAddresses = walletAddresses.map((addr) => addr.toLowerCase());
    const cachedProfiles: Record<string, { username: string; avatarUrl: string }> = {};
    const addressesToFetch: string[] = [];

    for (const addr of lowerAddresses) {
      if (profileCache.has(addr) && Date.now() - profileCache.get(addr)!.timestamp < CACHE_TTL) {
        console.log(`Cache hit for profile: ${addr}`);
        cachedProfiles[addr] = profileCache.get(addr)!;
      } else {
        console.log(`Cache miss for profile: ${addr}`);
        addressesToFetch.push(addr);
      }
    }

    if (addressesToFetch.length === 0) {
      return cachedProfiles;
    }

    const response = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: addressesToFetch }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const profiles: Record<string, UserProfile> = await response.json();
    for (const [address, user] of Object.entries(profiles) as [string, UserProfile][]) {
      const profile = {
        username: user.username || user.display_name || address.slice(0, 6),
        avatarUrl: user.pfp_url || 'https://bay-batches.vercel.app/splashicon.png',
      };
      profileCache.set(address, { ...profile, timestamp: Date.now() });
      cachedProfiles[address] = profile;
    }
    return cachedProfiles;
  } catch (error) {
    console.error('Failed to fetch bulk profiles:', error);
    const fallbackProfiles = Object.fromEntries(
      walletAddresses.map((addr) => [
        addr.toLowerCase(),
        {
          username: addr.slice(0, 6),
          avatarUrl: 'https://bay-batches.vercel.app/splashicon.png',
        },
      ])
    );
    return fallbackProfiles;
  }
}