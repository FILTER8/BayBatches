'use client';

import { memo, useEffect, useState } from 'react';
import localforage from 'localforage';
import Image from 'next/image';

interface NFTImageProps {
  address: string;
  tokenId: number;
  imageSrc?: string;
  onImageLoad?: () => void;
  isReady?: boolean;
}

localforage.config({ name: 'NFTImageCache' });

function NFTImage({ address, tokenId, imageSrc, onImageLoad, isReady = true }: NFTImageProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(imageSrc ? 'success' : 'loading');
  const [fetchedImageSrc, setFetchedImageSrc] = useState<string | null>(imageSrc || null);
  const [pngFailed, setPngFailed] = useState(false);
  const r2Url = `https://pub-bd7c5d8a825145c691a3ad40196fd45c.r2.dev/${address.toLowerCase()}.png`;
  const cacheKey = `${address}:${tokenId}:image`;

  useEffect(() => {
    const tryPngFirst = async () => {
      if (!isReady) {
        setStatus('loading');
        console.log(`NFTImage ${address}:${tokenId} waiting for isReady=true`);
        return;
      }

      if (imageSrc) {
        setFetchedImageSrc(imageSrc);
        setStatus('success');
        console.log(`Using provided imageSrc for ${address}:${tokenId}: ${imageSrc}`);
        return;
      }

      if (!pngFailed) {
        const testImage = new window.Image();
        testImage.src = r2Url;

        testImage.onload = async () => {
          await localforage.setItem(cacheKey, r2Url); // Cache the successful URL
          setFetchedImageSrc(r2Url);
          setStatus('success');
          console.log(`Successfully loaded PNG for ${address}:${tokenId}: ${r2Url}`);
        };

        testImage.onerror = async () => {
          setPngFailed(true);
          const cached = await localforage.getItem<string>(cacheKey);
          if (cached) {
            setFetchedImageSrc(cached);
            setStatus('success');
            console.log(`Loaded cached image for ${address}:${tokenId}: ${cached}`);
          } else {
            setStatus('error');
            console.log(`Failed to load PNG and no cache for ${address}:${tokenId}`);
          }
        };
      }
    };

    tryPngFirst();
  }, [address, tokenId, imageSrc, r2Url, pngFailed, isReady, cacheKey]);

  if (status === 'loading') {
    return <Placeholder text="Loading..." />;
  }

  if (status === 'error') {
    return (
      <div className="relative w-full aspect-square bg-gray-100">
        <Image
          src="/default-nft.png"
          alt="Default NFT"
          fill
          className="object-contain object-center"
          sizes="100vw"
          quality={75}
        />
      </div>
    );
  }

  if (fetchedImageSrc) {
    return (
      <div className="relative w-full aspect-square">
        <Image
          src={fetchedImageSrc}
          alt={`NFT ${tokenId}`}
          fill
          className="object-contain object-center pixelated"
          sizes="100vw"
          quality={75}
          onLoad={onImageLoad}
        />
      </div>
    );
  }

  return <Placeholder text="No image found" />;
}

const Placeholder = ({ text }: { text: string }) => (
  <div className="relative w-full aspect-square bg-gray-100 flex items-center justify-center">
    <span className="text-gray-400 text-xs">{text}</span>
  </div>
);

export default memo(NFTImage, (prevProps, nextProps) =>
  prevProps.address === nextProps.address &&
  prevProps.tokenId === nextProps.tokenId &&
  prevProps.imageSrc === nextProps.imageSrc &&
  prevProps.onImageLoad === nextProps.onImageLoad &&
  prevProps.isReady === nextProps.isReady
);