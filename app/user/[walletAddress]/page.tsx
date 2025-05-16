'use client';

import { useParams } from 'next/navigation';
import Header from '../../components/Header';
import { UserProfile } from '../../components/UserProfile';

export default function UserProfilePage() {
  const params = useParams();
  const walletAddress = params?.walletAddress as string | undefined;

  if (!walletAddress) {
    return <div className="text-center">Invalid wallet address</div>;
  }

  return (
    <div className="flex flex-col min-h-screen font-sans text-[#111111] mini-app-theme bg-[#ffffff]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        <Header />
        <div
          className="w-full h-11 flex items-center justify-center text-white text-sm tracking-[0.1em] mb-3"
          style={{ backgroundColor: '#ff5f11' }}
        >
          USER PROFILE
        </div>
      </div>
      <main className="w-full max-w-md mx-auto px-4">
        <UserProfile walletAddress={walletAddress} />
      </main>
    </div>
  );
}