const profileCache = new Map<string, { username: string; avatarUrl: string }>();

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
    const user = await response.json();
    const profile = {
      username: user?.username || user?.display_name || walletAddress.slice(0, 6),
      avatarUrl: user?.pfp_url || 'https://default-avatar.png',
    };
    profileCache.set(lowerAddress, profile);
    return profile;
  } catch (error) {
    console.error(`Failed to fetch profile for ${walletAddress}:`, error);
    const profile = {
      username: walletAddress.slice(0, 6),
      avatarUrl: 'https://default-avatar.png',
    };
    profileCache.set(lowerAddress, profile);
    return profile;
  }
}

export async function getUserProfiles(walletAddresses: string[]) {
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
    const profiles = await response.json();
    for (const [address, user] of Object.entries(profiles)) {
      profileCache.set(address, {
        username: user.username || user.display_name || address.slice(0, 6),
        avatarUrl: user.pfp_url || 'https://default-avatar.png',
      });
    }
    return profiles;
  } catch (error) {
    console.error('Failed to fetch bulk profiles:', error);
    return {};
  }
}