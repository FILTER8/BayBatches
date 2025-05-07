const profileCache = new Map<string, { username: string; avatarUrl: string }>();

interface UserProfile {
  username: string;
  display_name: string;
  pfp_url: string;
  address: string;
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
    const profile = {
      username: user?.username || user?.display_name || walletAddress.slice(0, 6),
      avatarUrl: user?.pfp_url || 'https://splashicon.png',
    };
    profileCache.set(lowerAddress, profile);
    return profile;
  } catch (error) {
    console.error(`Failed to fetch profile for ${walletAddress}:`, error);
    const profile = {
      username: walletAddress.slice(0, 6),
      avatarUrl: 'https://splashicon.png',
    };
    profileCache.set(lowerAddress, profile);
    return profile;
  }
}

export async function getUserProfiles(walletAddresses: string[]): Promise<Record<string, { username: string; avatarUrl: string }>> {
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
    for (const [address, user] of Object.entries(profiles) as [string, UserProfile][]) {
      profileCache.set(address, {
        username: user.username || user.display_name || address.slice(0, 6),
        avatarUrl: user.pfp_url || 'https://splashicon.png',
      });
    }
    return Object.fromEntries(
      Object.entries(profiles).map(([address, user]) => [
        address,
        {
          username: user.username || user.display_name || address.slice(0, 6),
          avatarUrl: user.pfp_url || 'https://splashicon.png',
        },
      ])
    );
  } catch (error) {
    console.error('Failed to fetch bulk profiles:', error);
    return {};
  }
}