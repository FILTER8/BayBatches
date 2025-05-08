'use client';

import { useRouter } from 'next/navigation';
import { useAddFrame, useMiniKit } from '@coinbase/onchainkit/minikit';
import { useCallback, useMemo, useState } from 'react';
import { Plus, Check, Book, LogOut, LogIn } from '@geist-ui/icons';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

export default function Header() {
  const router = useRouter();
  const { context } = useMiniKit();
  const addFrame = useAddFrame();
  const [frameAdded, setFrameAdded] = useState(false);
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const handleAddFrame = useCallback(async () => {
    const frameAdded = await addFrame();
    setFrameAdded(Boolean(frameAdded));
  }, [addFrame]);

  const saveFrameButton = useMemo(() => {
    if (context && !context.client.added) {
      return (
        <button
          onClick={handleAddFrame}
          className="flex items-center space-x-1 text-sm tracking-[0.1em] text-[#ffffff] hover:bg-gray-800 py-2 px-4 transition-colors"
        >
          <Plus className="w-4 h-4 text-[#ffffff]" />
          <span>Save Frame</span>
        </button>
      );
    }

    if (frameAdded) {
      return (
        <div className="flex items-center space-x-1 text-sm font-medium text-[#ffffff] animate-fade-out">
          <Check className="w-4 h-4 text-[#ffffff]" />
          <span>Saved</span>
        </div>
      );
    }

    return null;
  }, [context, frameAdded, handleAddFrame]);

  return (
    <header className="flex items-center h-11 bg-black text-white px-4">
      <div className="flex items-center space-x-2">
        <button
          onClick={() => router.push('/')}
          className="text-sm tracking-[0.1em] text-[#ffffff]"
        >
          BayBatches
        </button>
        <button
          onClick={() => router.push('/about')}
          className="text-sm tracking-[0.1em] text-[#ffffff]"
        >
          <Book className="w-4 h-4 text-[#ffffff]" />
        </button>
      </div>
      <div className="ml-auto flex items-center space-x-2">
        {saveFrameButton}
        {isConnected ? (
          <button
            onClick={() => disconnect()}
            className="text-sm tracking-[0.1em] text-[#ffffff] hover:bg-gray-800 py-2 px-4 transition-colors"
          >
            <LogOut className="w-4 h-4 text-[#ffffff]" />
          </button>
        ) : (
          <button
            onClick={() => connect({ connector: connectors[0] })}
            className="flex items-center space-x-1 text-sm tracking-[0.1em] text-[#ffffff] bg-black hover:bg-gray-800 py-2 px-4 transition-colors"
          >
            <LogIn className="w-4 h-4 text-[#ffffff]" />
            <span>connect</span>
          </button>
        )}
      </div>
    </header>
  );
}