"use client";

import { useRouter } from "next/navigation";
import { Button } from "./DemoComponents";
import { useAddFrame, useMiniKit } from "@coinbase/onchainkit/minikit";
import { useCallback, useMemo, useState } from "react";
import { Plus, Check, LogIn, LogOut } from "@geist-ui/icons";
import { Book } from "@geist-ui/icons";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors";

export default function Header() {
  const router = useRouter();
  const { context } = useMiniKit();
  const addFrame = useAddFrame();
  const [frameAdded, setFrameAdded] = useState(false);
  const { address } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // Shorten address for display (e.g., 0x1234...abcd) - not used in UI
  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

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

  // Find Coinbase Wallet connector
  const coinbaseConnector = connectors.find(
    (connector) => connector.id === "coinbaseWalletSDK"
  );

  return (
    <header className="flex items-center h-11 bg-black text-white px-4">
      <div className="flex items-center space-x-2">
        <button
          onClick={() => router.push("/")}
          className="text-sm tracking-[0.1em] text-[#ffffff]"
        >
          BayBatches
        </button>
        <button
          onClick={() => router.push("/about")}
          className="text-sm tracking-[0.1em] text-[#ffffff]"
        >
          <Book className="w-4 h-4 text-[#ffffff]" />
        </button>
      </div>
      <div className="ml-auto flex items-center space-x-2">
        {saveFrameButton}
        {address ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => disconnect()}
            className="text-[#ffffff] p-4"
            icon={<LogOut className="w-4 h-4 text-[#ffffff]" />}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              coinbaseConnector
                ? connect({ connector: coinbaseConnector })
                : console.error("Coinbase Wallet connector not found")
            }
            className="text-[#ffffff] p-4"
            icon={<LogIn className="w-4 h-4 text-[#ffffff]" />}
          >
            Connect Wallet
          </Button>
        )}
      </div>
    </header>
  );
}