'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UserProfile } from '../../components/UserProfile';
import { getUserProfile } from '../../lib/neynar';
import Header from '../../components/Header';

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const walletAddress = params?.walletAddress as string | undefined;
  const [profile, setProfile] = useState<{ username: string; avatarUrl: string; basename: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (walletAddress) {
      getUserProfile(walletAddress)
        .then(setProfile)
        .catch((err) => {
          console.error(`Failed to fetch profile for ${walletAddress}:`, err);
          setError('Failed to load user profile');
        });
    }
  }, [walletAddress]);

  if (!walletAddress) {
    return <div className="text-center">Invalid wallet address</div>;
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  if (!profile) {
    return <div className="text-center">Loading...</div>;
  }

  return (
    <div className="flex flex-col min-h-screen font-sans text-[#111111] mini-app-theme bg-[#ffffff]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        <Header />
        <div
          className="w-full h-11 flex items-center justify-center text-white text-sm tracking-[0.1em] mb-3"
          style={{ backgroundColor: '#ff5f11' }}
          onClick={() => router.push('/leaderboard')}
        >
          USER PROFILE
        </div>
      </div>
      <main className="w-full max-w-md mx-auto px-4">
        <UserProfile
          walletAddress={walletAddress}
          username={profile.username}
          avatarUrl={profile.avatarUrl}
          basename={profile.basename}
        />
      </main>
    </div>
  );
}