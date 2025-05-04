"use client";

import { useEffect, useState, useMemo, memo } from 'react';
import { useReadContract } from 'wagmi';
import { ethers } from 'ethers';
import editionAbi from '../contracts/MintbayEdition.json';
import Image from 'next/image';

const metadataCache = new Map<string, string>();

interface NFTImageProps {
  address: string;
  tokenId: number;
  imageSrc?: string;
  onImageLoad?: () => void;
  alchemyUrl?: string;
}

interface TokenURIResult {
  image: string | null;
  debug: string;
}

const useNFTURI = (address: string, tokenId: number, skip: boolean = false, alchemyUrl?: string): string | null => {
  const { data, error } = useReadContract({
    address: address as `0x${string}`,
    abi: editionAbi.abi,
    functionName: 'tokenURI',
    args: [BigInt(tokenId)],
    query: { enabled: !skip && !alchemyUrl },
  });

  const [alchemyData, setAlchemyData] = useState<string | null>(null);

  useEffect(() => {
    if (skip || !alchemyUrl) return;
    const fetchWithAlchemy = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(alchemyUrl);
        const contract = new ethers.Contract(address, editionAbi.abi, provider);
        const uri = await contract.tokenURI(tokenId);
        setAlchemyData(uri);
      } catch (err) {
        console.error(`Failed to fetch tokenURI with Alchemy for ${address}:${tokenId}:`, err);
      }
    };
    fetchWithAlchemy();
  }, [address, tokenId, skip, alchemyUrl]);

  return useMemo(() => {
    if (alchemyData) return alchemyData;
    if (data && !error) return typeof data === 'string' ? data : null;
    return null;
  }, [data, error, alchemyData]);
};

const processTokenURI = async (uri: string): Promise<TokenURIResult> => {
  if (metadataCache.has(uri)) {
    return { image: metadataCache.get(uri)!, debug: `Cache hit for URI: ${uri}` };
  }

  try {
    let metadata;
    if (uri.startsWith('data:application/json;base64,')) {
      const base64Data = uri.split(',')[1];
      metadata = JSON.parse(atob(base64Data));
      return { image: metadata?.image || null, debug: `Parsed base64 URI: ${uri}` };
    } else if (uri.startsWith('http')) {
      const res = await fetch(uri, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      metadata = await res.json();
      const image = metadata?.image || null;
      if (image) metadataCache.set(uri, image);
      return { image, debug: `Fetched HTTP URI: ${uri}, image: ${image}` };
    } else {
      return { image: null, debug: `Unsupported URI format: ${uri}` };
    }
  } catch (err) {
    return { image: null, debug: `Failed to process URI: ${uri}, error: ${(err as Error).message}` };
  }
};

function NFTImage({ address, tokenId, imageSrc, onImageLoad, alchemyUrl }: NFTImageProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(imageSrc ? 'success' : 'loading');
  const [fetchedImageSrc, setFetchedImageSrc] = useState<string | null>(imageSrc || null);
  const [isVisible, setIsVisible] = useState(false);

  const primaryURI = useNFTURI(address, tokenId, !!imageSrc, alchemyUrl);
  const fallbackURI = useNFTURI(address, 1, !!imageSrc || tokenId === 1, alchemyUrl);

  useEffect(() => {
    if (imageSrc) {
      setIsVisible(true);
      return;
    }

    if (!primaryURI) {
      setStatus('error');
      return;
    }

    const loadImage = async () => {
      const { image } = await processTokenURI(primaryURI);
      if (image) {
        setFetchedImageSrc(image);
        setStatus('success');
        setIsVisible(true);
      } else {
        setStatus('error');
      }
    };

    loadImage();
  }, [primaryURI, imageSrc]);

  useEffect(() => {
    if (status === 'error' && fallbackURI && tokenId !== 1 && !imageSrc) {
      const loadFallback = async () => {
        const { image } = await processTokenURI(fallbackURI);
        setFetchedImageSrc(image || null);
        setStatus(image ? 'success' : 'error');
        if (image) setIsVisible(true);
      };
      loadFallback();
    }
  }, [status, fallbackURI, tokenId, imageSrc]);

  if (status === 'loading') {
    return <Placeholder text="Loading..." />;
  }

  if (fetchedImageSrc) {
    return (
      <div
        style={{ width: '100%', aspectRatio: '1' }}
        className={`transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        <Image
          src={fetchedImageSrc}
          alt={`NFT ${tokenId}`}
          width={0}
          height={0}
          sizes="100vw"
          style={{
            width: '100%',
            height: 'auto',
            objectFit: 'contain',
            imageRendering: 'pixelated',
          }}
          loading="eager"
          priority={!!imageSrc}
          onLoad={onImageLoad}
        />
      </div>
    );
  }

  return <Placeholder text="No image" />;
}

const Placeholder = ({ text }: { text: string }) => (
  <div
    className="bg-gray-100 flex items-center justify-center transition-opacity duration-500 opacity-0"
    style={{ width: '100%', aspectRatio: '1' }}
  >
    <span className="text-gray-400 text-xs">{text}</span>
  </div>
);

export default memo(NFTImage, (prevProps, nextProps) =>
  prevProps.address === nextProps.address &&
  prevProps.tokenId === nextProps.tokenId &&
  prevProps.imageSrc === nextProps.imageSrc &&
  prevProps.onImageLoad === nextProps.onImageLoad &&
  prevProps.alchemyUrl === nextProps.alchemyUrl
);