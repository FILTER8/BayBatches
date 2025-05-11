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
  isReady?: boolean;
}

interface TokenURIResult {
  image: string | null;
  debug: string;
}

const useNFTURI = (address: string, tokenId: number, skip: boolean = false, alchemyUrl?: string, isReady: boolean = true): string | null => {
  const cacheKey = `${address}:${tokenId}`;
  const { data, error: contractError } = useReadContract({
    address: address as `0x${string}`,
    abi: editionAbi.abi,
    functionName: 'tokenURI',
    args: [BigInt(tokenId)],
    query: { enabled: isReady && !skip && !alchemyUrl },
  });

  const [alchemyData, setAlchemyData] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || skip || !alchemyUrl) return;

    let isMounted = true;
    const fetchWithAlchemy = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(alchemyUrl);
        const contract = new ethers.Contract(address, editionAbi.abi, provider);
        const uri = await contract.tokenURI(tokenId);
        console.log(`Fetched tokenURI for ${cacheKey}: ${uri}`);
        if (isMounted) setAlchemyData(uri);
      } catch (err) {
        console.error(`Failed to fetch tokenURI with Alchemy for ${cacheKey}:`, err);
        if (isMounted) setAlchemyData(null);
      }
    };

    fetchWithAlchemy();
    return () => {
      isMounted = false;
    };
  }, [address, tokenId, skip, alchemyUrl, isReady, cacheKey]);

  return useMemo(() => {
    if (!isReady) {
      console.log(`Skipping tokenURI fetch for ${cacheKey}: isReady=false`);
      return null;
    }
    if (alchemyData) return alchemyData;
    if (data && !contractError) {
      const uri = typeof data === 'string' ? data : null;
      const errorMessage = contractError instanceof Error ? contractError.message : contractError ? String(contractError) : 'none';
      console.log(`Wagmi tokenURI for ${cacheKey}: ${uri}, error: ${errorMessage}`);
      return uri;
    }
    return null;
  }, [data, contractError, alchemyData, isReady, cacheKey]);
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
      const image = metadata?.image || null;
      console.log(`Parsed base64 URI: ${uri}, image: ${image}`);
      if (image) metadataCache.set(uri, image);
      return { image, debug: `Parsed base64 URI: ${uri}` };
    } else if (uri.startsWith('http')) {
      const res = await fetch(uri, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      metadata = await res.json();
      const image = metadata?.image || null;
      console.log(`Fetched HTTP URI: ${uri}, image: ${image}`);
      if (image) metadataCache.set(uri, image);
      return { image, debug: `Fetched HTTP URI: ${uri}, image: ${image}` };
    }
    console.log(`Unsupported URI format: ${uri}`);
    return { image: null, debug: `Unsupported URI format: ${uri}` };
  } catch (err) {
    const errorMessage = (err as Error).message;
    console.error(`Failed to process URI: ${uri}, error: ${errorMessage}`);
    return { image: null, debug: `Failed to process URI: ${uri}, error: ${errorMessage}` };
  }
};

function NFTImage({ address, tokenId, imageSrc, onImageLoad, alchemyUrl, isReady = true }: NFTImageProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(imageSrc ? 'success' : 'loading');
  const [fetchedImageSrc, setFetchedImageSrc] = useState<string | null>(imageSrc || null);
  const [isVisible, setIsVisible] = useState(!!imageSrc);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const primaryURI = useNFTURI(address, tokenId, !!imageSrc, alchemyUrl, isReady);

  useEffect(() => {
    if (imageSrc) {
      setIsVisible(true);
      setStatus('success');
      console.log(`Using provided imageSrc for ${address}:${tokenId}: ${imageSrc}`);
      return;
    }

    if (!isReady) {
      setStatus('loading');
      setErrorMessage('Waiting for artwork to be finalized...');
      console.log(`NFTImage ${address}:${tokenId} waiting for isReady=true`);
      return;
    }

    if (!primaryURI) {
      setStatus('error');
      setErrorMessage('Failed to fetch token URI');
      console.log(`No primaryURI for ${address}:${tokenId}`);
      return;
    }

    const loadImage = async () => {
      try {
        const { image, debug } = await processTokenURI(primaryURI);
        console.log(debug);
        if (image) {
          setFetchedImageSrc(image);
          setStatus('success');
          setIsVisible(true);
          setErrorMessage(null);
        } else {
          throw new Error('No image found in metadata');
        }
      } catch (err) {
        const errorMessage = (err as Error).message;
        setStatus('error');
        setErrorMessage(`Failed to load image: ${errorMessage}`);
        console.error(`Image load failed for ${address}:${tokenId}: ${errorMessage}`);
      }
    };

    loadImage();
  }, [primaryURI, imageSrc, isReady, address, tokenId]);

  if (status === 'loading') {
    return <Placeholder text={errorMessage || "Loading..."} />;
  }

  if (status === 'error') {
    return <Placeholder text={errorMessage || "Failed to load image"} />;
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

  return <Placeholder text="No image available" />;
}

const Placeholder = ({ text }: { text: string }) => (
  <div
    className="bg-gray-100 flex items-center justify-center transition-opacity duration-500 opacity-100"
    style={{ width: '100%', aspectRatio: '1' }}
  >
    <span className="text-gray-400 text-xs text-center">{text}</span>
  </div>
);

export default memo(NFTImage, (prevProps, nextProps) =>
  prevProps.address === nextProps.address &&
  prevProps.tokenId === nextProps.tokenId &&
  prevProps.imageSrc === nextProps.imageSrc &&
  prevProps.onImageLoad === nextProps.onImageLoad &&
  prevProps.alchemyUrl === nextProps.alchemyUrl &&
  prevProps.isReady === nextProps.isReady
);