import { ethers } from 'ethers';
import MintbayEditionAbi from '../contracts/MintbayEdition.json';

const ALCHEMY_URL = process.env.NEXT_PUBLIC_ALCHEMY_URL || '';
const provider = ALCHEMY_URL ? new ethers.JsonRpcProvider(ALCHEMY_URL) : null;
const glyphContractCache = new Map<string, string | null>();

export async function getGlyphContractFromEdition(address: string): Promise<string | null> {
  if (!provider) {
    console.error('Provider is not initialized due to missing ALCHEMY_URL');
    return null;
  }
  if (glyphContractCache.has(address)) {
    return glyphContractCache.get(address)!;
  }

  try {
    const contract = new ethers.Contract(address, MintbayEditionAbi.abi, provider);
    const glyphAddress = await contract.glyphContract();
    const result = glyphAddress.toLowerCase();
    glyphContractCache.set(address, result);
    return result;
  } catch (error) {
    console.error(`Failed to fetch glyphContract for ${address}:`, error);
    glyphContractCache.set(address, null);
    return null;
  }
}