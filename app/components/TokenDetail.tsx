'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import confetti from 'canvas-confetti';
import { useAccount, useSwitchChain, useWriteContract } from 'wagmi';
import MemoizedNFTImage from './NFTImage';
import MintbayEditionAbi from '../contracts/MintbayEdition.json';
import { sdk } from '@farcaster/frame-sdk';

interface Edition {
  id: string;
  name: string;
  totalSupply: string;
  editionSize: string;
  price: string;
  isFreeMint: boolean;
  paused: boolean;
}

interface TokenDetailProps {
  edition: Edition;
  tokenId?: number;
}

const LAUNCHPAD_FEE = '0.0004';
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://bay-batches.vercel.app';

export function TokenDetail({ edition, tokenId = 1 }: TokenDetailProps) {
  const [showCollectedOverlay, setShowCollectedOverlay] = useState(false);
  const { address: walletAddress, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContract, data: txHash, error: writeError, isPending: isWriting } = useWriteContract();

  const handleShareToFarcaster = async () => {
    const frameUrl = `${BASE_URL}/frame/${edition.id.toLowerCase()}`;
    const imageUrl = `https://pub-bd7c5d8a825145c691a3ad40196fd45c.r2.dev/${edition.id.toLowerCase()}.png`;
    try {
      await sdk.actions.composeCast({
        text: `Collect ${edition.name} on Mintbay! 🎨`,
        embeds: [frameUrl],
      });
      console.log('Cast composer opened with Frame:', {
        frameUrl,
        imageUrl,
        editionId: edition.id,
        walletAddress,
      });
    } catch (error) {
      console.error('Error sharing to Farcaster:', error);
      alert('Failed to share to Farcaster. Please try again.');
    }
  };

  useEffect(() => {
    if (txHash) {
      setShowCollectedOverlay(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff0000', '#00ff00', '#0000ff', '#ff69b4', '#ffd700'],
        disableForReducedMotion: true,
      });
      const timer = setTimeout(() => {
        setShowCollectedOverlay(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [txHash]);

  useEffect(() => {
    console.log('Wallet Config:', {
      apiKey: process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY,
      walletAddress,
    });
  }, [walletAddress]);

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl font-bold mb-2 mt-0">{edition.name}</h2>
      <div className="w-full max-w-md mb-4 relative">
        <MemoizedNFTImage address={edition.id} tokenId={tokenId} />
        {showCollectedOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[#ffffff] text-lg font-medium">
            collected
          </div>
        )}
      </div>
      <p className="text-sm mb-4">
        Edition: {`${Number(edition.totalSupply)}/${Number(edition.editionSize) || 'Open Edition'}`}
      </p>
      {isConnected ? (
        <>
          <button
            onClick={async () => {
              if (!isConnected) {
                alert("Please connect your wallet first to collect an NFT.");
                return;
              }
              try {
                console.log("Switching to Base Mainnet...");
                await switchChain({ chainId: 8453 });
                console.log("Chain switched, preparing transaction...");
                const baseCost = edition.isFreeMint ? 0 : Number(ethers.formatEther(edition.price));
                const totalCost = baseCost + Number(LAUNCHPAD_FEE);
                const totalCostWei = BigInt(Math.round(totalCost * 1e18));
                console.log("Total cost (wei):", totalCostWei.toString());
                console.log("Minting to contract:", edition.id);
                console.log("Wallet address:", walletAddress);
                await writeContract({
                  address: edition.id as `0x${string}`,
                  abi: MintbayEditionAbi.abi,
                  functionName: "collectBatch",
                  args: [BigInt(1)],
                  value: totalCostWei,
                });
                console.log("Transaction sent, awaiting confirmation...");
              } catch (error) {
                console.error("Error in handleCollect:", error);
              }
            }}
            className={`w-full max-w-md py-2 px-4 text-sm tracking-[0.1em] text-[#ffffff] bg-green-500 hover:bg-green-600 border-radius-0 disabled:bg-gray-400`}
            disabled={
              edition.paused ||
              Number(edition.totalSupply) >= Number(edition.editionSize) ||
              Number(edition.editionSize) === 0 ||
              isWriting
            }
          >
            {Number(edition.totalSupply) >= Number(edition.editionSize) && Number(edition.editionSize) > 0
              ? 'sold out'
              : edition.paused
              ? 'paused'
              : edition.isFreeMint
              ? `collect (${LAUNCHPAD_FEE} ETH)`
              : `collect (${LAUNCHPAD_FEE} ETH)`}
          </button>
          {isWriting && <p className="text-xs mt-2 text-yellow-500">Minting in progress...</p>}
          {txHash && (
            <p className="text-xs mt-2 text-green-600">
              [Collected! Tx:{' '}
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-green-800"
              >
                {txHash.slice(0, 6)}...
              </a>]
            </p>
          )}
          {writeError && <p className="text-xs mt-2 text-red-500">Error: {writeError.message}</p>}
        </>
      ) : (
        <div
          className="w-full max-w-md py-2 px-4 text-sm tracking-[0.1em] text-[#ffffff] bg-gray-400 text-center"
        >
          Please connect your wallet to collect.
        </div>
      )}
      <button
        onClick={handleShareToFarcaster}
        className="w-full max-w-md py-2 px-4 mt-2 text-sm tracking-[0.1em] text-[#ffffff] bg-purple-600 hover:bg-purple-700"
      >
        Share to Farcaster
      </button>
      <a
        href={`https://mintbay.co/token/${edition.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 text-blue-500 hover:underline text-sm"
      >
        View on Mintbay
      </a>
    </div>
  );
}

export default TokenDetail;