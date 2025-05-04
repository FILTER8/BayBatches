'use client';

import { useRouter } from 'next/navigation';
import { Button } from './DemoComponents';
import { useAddFrame, useMiniKit } from '@coinbase/onchainkit/minikit';
import { useCallback, useMemo, useState } from 'react';
import { Plus, Check, Book, LogIn, LogOut } from '@geist-ui/icons';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { coinbaseWallet } from 'wagmi/connectors';

export default function Header() {
  const router = useRouter();
  const { context } = useMiniKit();
  const addFrame = useAddFrame();
  const [frameAdded, setFrameAdded] = useState(false);
  const { address } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const handleAddFrame = useCallback(async () => {
    const frameAdded = await addFrame();
    setFrameAdded(Boolean(frameAdded));
  }, [addFrame]);

  const saveFrameButton = useMemo(() => {
    if (context && !context.client.added) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddFrame}
          className="text-[#ffffff] p-4"
          icon={<Plus className="w-4 h-4 text-[#ffffff]" />}
        >
          Save Frame
        </Button>
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
        {address ? (
          <button
            onClick={() => disconnect()}
            className="text-sm tracking-[0.1em] text-[#ffffff]"
          >
            <LogOut className="w-4 h-4 text-[#ffffff]" />
          </button>
        ) : (
          <button
            onClick={() => connect({ connector: coinbaseWallet({ appName: 'BayBatches' }) })}
            className="flex items-center text-sm tracking-[0.1em] text-[#ffffff]"
          >
            <LogIn className="w-4 h-4 text-[#ffffff] mr-2" />
            connect
          </button>
        )}
      </div>
    </header>
  );
}