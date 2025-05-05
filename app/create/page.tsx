"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWriteContract, usePublicClient, useWaitForTransactionReceipt, useAccount, useConnect } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { ethers } from "ethers";
import Header from "../components/Header";
import Modal from "react-modal";
import NFTImage from "../components/NFTImage";
import factoryAbi from "../contracts/MintbayEditionFactory.json";
import editionAbi from "../contracts/MintbayEdition.json";
import customGlyphsArtifact from "../contracts/CustomGlyphs.json";
import fallbackGlyphs from "../data/glyphsFallback.json";
import { Info, RefreshCw, Droplet, ArrowLeftCircle, ArrowRightCircle } from "@geist-ui/icons";

const customGlyphsAbi = customGlyphsArtifact.abi;

const FACTORY_ADDRESS = "0x75a8882d081ED5E8a16c487b703381Fcc409470e";
const GLYPH_SET_ADDRESS = "0x94e1f188d72970ce27c890fb9469a5bbb550e2d7";
const LAUNCHPAD_FEE = "400000000000000"; // 0.0004 ETH in wei
const LAUNCHPAD_FEE_RECEIVER = "0x193c97e10aB0e2c0A12884f045145B44D8A551D4";
const MARKETPLACE_FEE_RECEIVER = "0x193c97e10aB0e2c0A12884f045145B44D8A551D4";

const COLORS = [
  [36, 17, 10],    // #black
  [153, 153, 153], // #grey
  [253, 210, 1],   // #gelb
  [255, 95, 17],   // #orange
  [255, 0, 0],     // #red
  [224, 150, 182], // #pink
  [7, 145, 83],    // #green
  [17, 139, 203],  // #light blue
  [0, 82, 255],    // #base blue
];

const BLOCK_GLYPH = { id: 1, bitmap: BigInt("0xFFFFFFFFFFFFFFFF") };

const TYPO_VARIATIONS = [
  [16, 17, 18, 19, 20, 21, 22], // Variation 1: B, A, T, C, H, E, S
  [23, 24, 25, 26, 27, 28, 29], // Variation 2
  [30, 31, 32, 33, 34, 35, 36], // Variation 3
  [37, 38, 39, 40, 41, 42, 43], // Variation 4
  [44, 45, 46, 47, 48, 49, 50], // Variation 5
  [51, 52, 53, 54, 55, 56, 57], // Variation 6
  [58, 59, 60, 61, 62, 63, 64], // Variation 7
  [65, 66, 67, 68, 69, 70, 71], // Variation 8
  [72, 73, 74, 75, 76, 77, 78], // Variation 9
];

const TYPO_VARIATIONS_BASE = TYPO_VARIATIONS.map((variation) => [
  variation[0], // B
  variation[1], // A
  variation[6], // S
  variation[5], // E
]);

async function callWithRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (i === retries - 1) throw err;
      const backoff = (err as { code?: number }).code === 429 ? delayMs * (i + 1) * 2 : delayMs * (i + 1);
      console.warn(`Retry ${i + 1}/${retries} failed:`, (err as Error).message, `Waiting ${backoff}ms`);
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
  throw new Error("Max retries reached");
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function Create() {
  const { address } = useAccount();
  const [isMounted, setIsMounted] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setIsMounted(true);
    const observer = new MutationObserver((mutations, obs) => {
      const appElement = document.getElementById('__next');
      if (appElement) {
        Modal.setAppElement(appElement);
        console.log('react-modal: Successfully set app element to #__next');
        obs.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timeout = setTimeout(() => {
      const appElement = document.getElementById('__next');
      if (!appElement) {
        console.warn('react-modal: #__next element not found after 5s. Using ariaHideApp={false} as fallback.');
        console.log('DOM root elements:', Array.from(document.body.children).map(el => el.id || el.tagName));
      }
    }, 5000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, []);

  if (!isMounted) return null;

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        <Header />
        <div
          className="w-full h-11 flex items-center justify-center text-white text-sm tracking-[0.1em] mb-3 cursor-pointer"
          style={{ backgroundColor: "#0052ff" }}
          onClick={() => {
            console.log("CREATE bar clicked, resetting to ColorSelection");
            localStorage.removeItem("selectedColors");
            localStorage.removeItem("bgGlyphs");
            localStorage.removeItem("fgGlyphs");
            localStorage.removeItem("bgColors");
            localStorage.removeItem("fgColors");
            localStorage.removeItem("typoRow");
            localStorage.removeItem("typoRow2");
            localStorage.removeItem("typoCol");
            localStorage.removeItem("typoCols");
            localStorage.removeItem("shouldGenerateArt");
            setPage(1);
          }}
        >
          CREATE
        </div>
      </div>
      <main className="relative w-full max-w-[400px] mx-auto px-4 py-3">
        {page === 1 && <ColorSelection setPage={setPage} />}
        {page === 2 && <ArtGeneration setPage={setPage} />}
        {page === 3 && <MetadataDeployment setPage={setPage} address={address!} />}
      </main>
    </div>
  );
}

function ColorSelection({ setPage }: { setPage: (page: number) => void }) {
  const [selectedColors, setSelectedColors] = useState<number[]>([]);

  const toggleColor = (index: number) => {
    setSelectedColors((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  useEffect(() => {
    localStorage.removeItem("bgGlyphs");
    localStorage.removeItem("fgGlyphs");
    localStorage.removeItem("bgColors");
    localStorage.removeItem("fgColors");
    localStorage.removeItem("typoRow");
    localStorage.removeItem("typoRow2");
    localStorage.removeItem("typoCol");
    localStorage.removeItem("typoCols");
    console.log("Cleared canvas state in localStorage on ColorSelection mount");
  }, []);

  useEffect(() => {
    localStorage.setItem("selectedColors", JSON.stringify(selectedColors));
  }, [selectedColors]);

  const handleNext = () => {
    localStorage.setItem("shouldGenerateArt", "true");
    setPage(2);
  };

  return (
    <div className="max-w-[400px] mx-auto px-2">
      <h2 className="text-base text-center text-gray-500 mb-2">Select your Colors</h2>
      <div className="grid grid-cols-3 mb-4">
        {COLORS.map((rgb, idx) => (
          <div
            key={idx}
            className={`w-[118px] h-[118px] border-none cursor-pointer transition-all ${
              selectedColors.includes(idx) ? "opacity-80" : "opacity-100"
            }`}
            style={{ backgroundColor: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` }}
            onClick={() => toggleColor(idx)}
          />
        ))}
      </div>
      <p className="text-sm mb-4 text-center">Selected: {selectedColors.length}/9 (min 2)</p>
      <button
        onClick={handleNext}
        disabled={selectedColors.length < 2}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 text-base rounded-none disabled:bg-gray-400 transition-colors"
      >
        <ArrowRightCircle size={16} className="mr-2 inline" />
      </button>
    </div>
  );
}

function ArtGeneration({ setPage }: { setPage: (page: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedColors, setSelectedColors] = useState<number[]>([]);
  const [complexity, setComplexity] = useState(1);
  const [glyphs, setGlyphs] = useState<{ id: number; bitmap: bigint }[]>([BLOCK_GLYPH]);
  const [bgGlyphs, setBgGlyphs] = useState<(number | null)[]>(new Array(81).fill(null));
  const [fgGlyphs, setFgGlyphs] = useState<(number | null)[]>(new Array(81).fill(null));
  const [bgColors, setBgColors] = useState<(number | null)[]>(new Array(81).fill(null));
  const [fgColors, setFgColors] = useState<(number | null)[]>(new Array(81).fill(null));
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [typoRow, setTypoRow] = useState<number | null>(null);
  const [typoRow2, setTypoRow2] = useState<number | null>(null);
  const [typoCol, setTypoCol] = useState<number | null>(null);
  const [typoCols, setTypoCols] = useState<(number | null)[]>(new Array(7).fill(null));
  const lastTapRef = useRef<{ time: number; idx: number } | null>(null);
  const [selectedGlyph, setSelectedGlyph] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const size = 9;
  const scale = 48;

  const glyphCount = useMemo(
    () => (complexity === 1 ? 1 : complexity === 2 ? 2 : complexity === 3 ? 4 : Math.min(complexity, 10)),
    [complexity]
  );

  const provider = useMemo(
    () =>
      new ethers.JsonRpcProvider(
        `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
      ),
    []
  );

  const fetchGlyphs = useCallback(async () => {
    const cachedGlyphsRaw = JSON.parse(localStorage.getItem("cachedGlyphs") || "[]");
    const cachedGlyphs = cachedGlyphsRaw.map((g: { id: number; bitmap: string }) => ({
      id: g.id,
      bitmap: BigInt(g.bitmap),
    }));

    if (cachedGlyphs.length > 0) {
      console.log("Using cached glyphs:", cachedGlyphs);
      setGlyphs(cachedGlyphs);
      setError("Using cached glyphs.");
      return;
    }

    const useRpc = process.env.NEXT_PUBLIC_USE_RPC === "true";
    if (!useRpc) {
      console.log("Development mode: Using fallback glyphs from JSON");
      setGlyphs(fallbackGlyphs.map((g) => ({ id: g.id, bitmap: BigInt(g.bitmap) })));
      setError(null);
      return;
    }

    const contract = new ethers.Contract(GLYPH_SET_ADDRESS, customGlyphsAbi, provider);
    try {
      const code = await callWithRetry(() => provider.getCode(GLYPH_SET_ADDRESS), 5, 2000);
      if (code === "0x") {
        throw new Error("No contract deployed at the specified address");
      }

      const glyphsData = await callWithRetry(() => contract.getAllGlyphs());
      const fetchedGlyphs = glyphsData
        .slice(0, 79)
        .map((bitmap: bigint, id: number) => ({ id, bitmap }))
        .filter((g) => g.id >= 1);
      console.log("Fetched glyphs:", fetchedGlyphs.map((g) => ({ id: g.id, bitmap: g.bitmap.toString() })));

      localStorage.setItem(
        "cachedGlyphs",
        JSON.stringify(fetchedGlyphs.map((g) => ({ id: g.id, bitmap: g.bitmap.toString() })))
      );
      setGlyphs(fetchedGlyphs.length > 0 ? fetchedGlyphs : fallbackGlyphs.map((g) => ({ id: g.id, bitmap: BigInt(g.bitmap) })));
    } catch (error: unknown) {
      console.error("Glyphs fetch failed:", error);
      setError(`Failed to load glyphs from contract: ${(error as Error).message || "Unknown error"}. Using fallback glyphs.`);
      setGlyphs(fallbackGlyphs.map((g) => ({ id: g.id, bitmap: BigInt(g.bitmap) })));
    }
  }, [provider]);

  useEffect(() => {
    fetchGlyphs();
  }, [fetchGlyphs]);

  const stableGlyphs = useMemo(() => glyphs, [glyphs]);

  useEffect(() => {
    const storedColors = JSON.parse(localStorage.getItem("selectedColors") || "[]");
    if (storedColors.length < 2) {
      setPage(1);
    } else {
      setSelectedColors(storedColors);
      const storedBgGlyphs = JSON.parse(localStorage.getItem("bgGlyphs") || "[]");
      const storedFgGlyphs = JSON.parse(localStorage.getItem("fgGlyphs") || "[]");
      const storedBgColors = JSON.parse(localStorage.getItem("bgColors") || "[]");
      const storedFgColors = JSON.parse(localStorage.getItem("fgColors") || "[]");
      const storedTypoRow = JSON.parse(localStorage.getItem("typoRow") || "null");
      const storedTypoRow2 = JSON.parse(localStorage.getItem("typoRow2") || "null");
      const storedTypoCol = JSON.parse(localStorage.getItem("typoCol") || "null");
      const storedTypoCols = JSON.parse(localStorage.getItem("typoCols") || "[]");
      if (
        storedBgGlyphs.length === 81 &&
        storedFgGlyphs.length === 81 &&
        storedBgColors.length === 81 &&
        storedFgColors.length === 81 &&
        storedBgGlyphs.every((g: number) => g !== null && g >= 1)
      ) {
        console.log("Loading stored canvas state:", {
          storedBgGlyphs,
          storedFgGlyphs,
          storedTypoRow,
          storedTypoRow2,
          storedTypoCol,
          storedTypoCols,
        });
        setBgGlyphs(storedBgGlyphs);
        setFgGlyphs(storedFgGlyphs);
        setBgColors(storedBgColors);
        setFgColors(storedFgColors);
        setTypoRow(storedTypoRow);
        setTypoRow2(storedTypoRow2);
        setTypoCol(storedTypoCol);
        setTypoCols(storedTypoCols.length === 7 ? storedTypoCols : new Array(7).fill(null));
        setHasGenerated(true);
      } else {
        console.log("No valid stored state, initializing empty canvas");
        setBgGlyphs(new Array(81).fill(null));
        setFgGlyphs(new Array(81).fill(null));
        setBgColors(new Array(81).fill(null));
        setFgColors(new Array(81).fill(null));
        setTypoRow(null);
        setTypoRow2(null);
        setTypoCol(null);
        setTypoCols(new Array(7).fill(null));
        setHasGenerated(false);
      }
    }
  }, [setPage]);

  const isTypoGlyph = useCallback(
    (row: number, col: number) => {
      if (complexity === 1 || complexity === 2) {
        return row === typoRow && col >= 1 && col <= 7;
      } else if (complexity === 3) {
        return col === typoCol && row >= 1 && row <= 7;
      } else if (complexity === 4) {
        return (
          (row === 1 && (col === 1 || col === 7)) ||
          (row === 2 && (col === 2 || col === 6)) ||
          (row === 3 && (col === 3 || col === 5)) ||
          (row === 4 && col === 4) ||
          (row === 5 && (col === 3 || col === 5)) ||
          (row === 6 && (col === 2 || col === 6)) ||
          (row === 7 && (col === 1 || col === 7))
        );
      } else if (complexity === 5) {
        return col === typoCol && row >= 1 && row <= 7;
      } else if (complexity === 6) {
        return [1, 3, 5, 7].includes(row) || [2, 4, 6].includes(row);
      } else if (complexity === 7) {
        return row === typoRow && col >= 1 && col <= 4;
      } else if (complexity === 8) {
        return (
          (row === typoRow && col >= 1 && col <= 4) ||
          (row === typoRow2 && col >= 1 && col <= 7)
        );
      } else if (complexity === 9) {
        return [1, 3, 5, 7].includes(col);
      } else if (complexity === 10) {
        return row >= 1 && row <= 7 && col === typoCols[row - 1];
      }
      return false;
    },
    [complexity, typoRow, typoRow2, typoCol, typoCols]
  );

  const generateArt = useCallback(() => {
    if (selectedColors.length < 2) return;
    console.log("Generating art with complexity:", complexity, "glyphCount:", glyphCount);

    const availableGlyphs = stableGlyphs
      .filter((g) => g.id >= 1 && g.id <= 15)
      .sort(() => Math.random() - 0.5)
      .slice(0, glyphCount);
    const newBgGlyphs = new Array(81).fill(1);
    const newFgGlyphs = new Array(81).fill(null);
    const newBgColors = new Array(81).fill(1);
    const newFgColors = new Array(81).fill(null);

    const availableColors = selectedColors.map((idx) => idx + 1);
    const usedColors = new Set<number>();
    const getRandomColor = (excludeColors: number[] = []) => {
      const filteredColors = availableColors.filter((c) => !excludeColors.includes(c));
      const unusedColors = filteredColors.filter((c) => !usedColors.has(c));
      const colorPool = unusedColors.length > 0 ? unusedColors : filteredColors;
      const color = colorPool[Math.floor(Math.random() * colorPool.length)] || availableColors[0];
      usedColors.add(color);
      return color;
    };

    const numColors = selectedColors.length;
    let bgColor: number | undefined;
    let typoColor1: number | undefined;
    let frameColor: number | undefined;
    let typoBgColor: number | undefined;
    let typoColor2: number | undefined;
    let frameColor2: number | undefined;
    let glyphColor: number | undefined;
    let bgColor1: number | undefined;
    let bgColor2: number | undefined;
    let bgColor3: number | undefined;
    let bgColor4: number | undefined;
    let fgColor1: number | undefined;
    let fgColor2: number | undefined;
    let fgColor3: number | undefined;
    let innerBgColor1: number | undefined;
    let innerBgColor2: number | undefined;
    let innerBgColor3: number | undefined;
    let innerFgColor1: number | undefined;
    let innerFgColor2: number | undefined;
    let innerFgColor3: number | undefined;
    let typoColor: number | undefined;
    let graphicColorTop: number | undefined;
    let graphicColorBottom: number | undefined;
    let bgColorsRows: number[] | undefined;
    let fgColorsRows: number[] | undefined;
    let blockAssignments: { bgColor: number; fgColor: number }[] | undefined;

    if (numColors === 4) {
      bgColor = getRandomColor();
      typoColor = getRandomColor([bgColor]);
      graphicColorTop = getRandomColor([bgColor, typoColor]);
      graphicColorBottom = getRandomColor([bgColor, typoColor, graphicColorTop]);
      typoColor1 = typoColor;
      frameColor = typoColor;
      typoBgColor = bgColor;
      typoColor2 = bgColor;
      frameColor2 = frameColor;
    } else if (numColors === 5) {
      glyphColor = getRandomColor();
      bgColor1 = getRandomColor([glyphColor]);
      bgColor2 = getRandomColor([glyphColor, bgColor1]);
      bgColor3 = getRandomColor([glyphColor, bgColor1, bgColor2]);
      bgColor4 = getRandomColor([glyphColor, bgColor1, bgColor2, bgColor3]);
      bgColor = bgColor1;
      typoColor1 = glyphColor;
      frameColor = glyphColor;
      typoBgColor = bgColor1;
      typoColor2 = glyphColor;
      frameColor2 = glyphColor;
    } else if (numColors === 6) {
      bgColor1 = getRandomColor();
      bgColor2 = getRandomColor([bgColor1]);
      bgColor3 = getRandomColor([bgColor1, bgColor2]);
      fgColor1 = getRandomColor([bgColor1, bgColor2, bgColor3]);
      fgColor2 = getRandomColor([bgColor1, bgColor2, bgColor3, fgColor1]);
      fgColor3 = getRandomColor([bgColor1, bgColor2, bgColor3, fgColor1, fgColor2]);
      bgColor = bgColor1;
      typoColor1 = fgColor1;
      frameColor = fgColor1;
      typoBgColor = bgColor1;
      typoColor2 = fgColor1;
      frameColor2 = fgColor1;
    } else if (numColors === 7) {
      innerBgColor1 = getRandomColor();
      innerBgColor2 = getRandomColor([innerBgColor1]);
      innerBgColor3 = getRandomColor([innerBgColor1, innerBgColor2]);
      innerFgColor1 = getRandomColor([innerBgColor1, innerBgColor2, innerBgColor3]);
      innerFgColor2 = getRandomColor([innerBgColor1, innerBgColor2, innerBgColor3, innerFgColor1]);
      innerFgColor3 = getRandomColor([innerBgColor1, innerBgColor2, innerBgColor3, innerFgColor1, innerFgColor2]);
      typoColor = getRandomColor([innerBgColor1, innerBgColor2, innerBgColor3, innerFgColor1, innerFgColor2, innerFgColor3]);
      blockAssignments = [];
      const colorPairs = [
        { bgColor: innerBgColor1, fgColor: innerFgColor1 },
        { bgColor: innerBgColor2, fgColor: innerFgColor2 },
        { bgColor: innerBgColor3, fgColor: innerFgColor3 },
      ];
      const shuffledPairs = [...colorPairs, ...colorPairs, ...colorPairs].sort(() => Math.random() - 0.5);
      for (let blockRow = 0; blockRow < 3; blockRow++) {
        for (let blockCol = 0; blockCol < 3; blockCol++) {
          blockAssignments[blockRow * 3 + blockCol] = shuffledPairs[blockRow * 3 + blockCol];
        }
      }
      bgColor = innerBgColor1;
      typoColor1 = typoColor;
      frameColor = typoColor;
      typoBgColor = innerBgColor1;
      typoColor2 = typoColor;
      frameColor2 = typoColor;
    } else if (numColors === 8) {
      typoColor = getRandomColor();
      bgColor = typoColor;
      typoColor1 = typoColor;
      frameColor = typoColor;
      typoBgColor = typoColor;
      typoColor2 = typoColor;
      frameColor2 = typoColor;
    } else if (numColors >= 9) {
      bgColorsRows = [];
      fgColorsRows = [];
      const shuffledColors = [...availableColors].sort(() => Math.random() - 0.5);
      for (let i = 0; i < 9; i++) {
        bgColorsRows[i] = shuffledColors[i];
        usedColors.add(shuffledColors[i]);
      }
      const remainingColors = shuffledColors.slice(0, 9);
      for (let i = 0; i < 9; i++) {
        const availableFgColors = remainingColors.filter((c) => c !== bgColorsRows[i]);
        fgColorsRows[i] = availableFgColors[Math.floor(Math.random() * availableFgColors.length)] || remainingColors[0];
      }
      bgColor = bgColorsRows[0];
      typoColor1 = fgColorsRows[0];
      frameColor = fgColorsRows[0];
      typoBgColor = bgColorsRows[0];
      typoColor2 = fgColorsRows[0];
      frameColor2 = fgColorsRows[0];
    } else {
      bgColor = getRandomColor();
      typoColor1 = numColors >= 2 ? getRandomColor([bgColor]) : bgColor;
      frameColor = numColors >= 3 ? getRandomColor([bgColor, typoColor1]) : typoColor1;
      typoBgColor = bgColor;
      typoColor2 = typoColor1;
      frameColor2 = frameColor;
    }

    const cornerGlyph = availableGlyphs[0] || { id: 1 };
    const edgeGlyphs = availableGlyphs.length > 1 ? availableGlyphs.slice(1) : [cornerGlyph];

    const frameGlyphs = complexity === 9 && edgeGlyphs.length >= 4
      ? edgeGlyphs.slice(0, 4)
      : edgeGlyphs.length >= 1
      ? [edgeGlyphs[0], edgeGlyphs[0], edgeGlyphs[0], edgeGlyphs[0]]
      : [cornerGlyph, cornerGlyph, cornerGlyph, cornerGlyph];

    const frameGlyphsU = (complexity === 8 || complexity === 5) && edgeGlyphs.length >= 2
      ? edgeGlyphs.slice(0, 2)
      : edgeGlyphs.length >= 1
      ? [edgeGlyphs[0], edgeGlyphs[0]]
      : [cornerGlyph, cornerGlyph];

    const getRandomGraphicGlyph = () =>
      availableGlyphs[Math.floor(Math.random() * availableGlyphs.length)]?.id || 1;

    const getTypoGlyphForRow = (row: number, variation: number[]) => {
      const letterIdx = row === 1 ? 0 : row - 1;
      return variation[letterIdx];
    };

    const variation1 = TYPO_VARIATIONS[Math.floor(Math.random() * TYPO_VARIATIONS.length)];
    const variation2 = TYPO_VARIATIONS[Math.floor(Math.random() * TYPO_VARIATIONS.length)];
    const variationBase = TYPO_VARIATIONS_BASE[Math.floor(Math.random() * TYPO_VARIATIONS_BASE.length)];

    let newTypoRow = typoRow;
    let newTypoRow2 = typoRow2;
    if (complexity === 1 || complexity === 2 || complexity === 7) {
      newTypoRow = Math.floor(Math.random() * 7) + 1;
    } else if (complexity === 8) {
      const possibleRows = [2, 4, 6];
      const rowIndex1 = Math.floor(Math.random() * possibleRows.length);
      newTypoRow = possibleRows[rowIndex1];
      const remainingRows = possibleRows.filter((r) => r !== newTypoRow);
      newTypoRow2 = remainingRows[Math.floor(Math.random() * remainingRows.length)];
    }
    const newTypoCol = complexity === 3 || complexity === 5 ? Math.floor(Math.random() * 7) + 1 : typoCol;
    const newTypoCols = complexity === 10
      ? Array.from({ length: 7 }, () => Math.floor(Math.random() * 7) + 1)
      : typoCols;

    const blockGlyphCache: { [key: string]: number } = {};
    const rowGlyphCache: { [key: number]: number } = {};
    const colGlyphCache: { [key: number]: number } = {};
    const nonXGlyphCache: { [key: string]: number } = {};

    if (complexity === 4) {
      const nonXCells: { row: number; col: number }[] = [];
      for (let row = 1; row <= 7; row++) {
        for (let col = 1; col <= 7; col++) {
          if (
            !(
              (row === 1 && (col === 1 || col === 7)) ||
              (row === 2 && (col === 2 || col === 6)) ||
              (row === 3 && (col === 3 || col === 5)) ||
              (row === 4 && col === 4) ||
              (row === 5 && (col === 3 || col === 5)) ||
              (row === 6 && (col === 2 || col === 6)) ||
              (row === 7 && (col === 1 || col === 7))
            )
          ) {
            nonXCells.push({ row, col });
          }
        }
      }
      const pattern = Math.floor(Math.random() * 4);
      const shuffledGlyphs = [...availableGlyphs].sort(() => Math.random() - 0.5);
      let glyphIndex = 0;

      if (pattern === 0) {
        const glyphId = shuffledGlyphs[glyphIndex++]?.id || 1;
        nonXCells.forEach(({ row, col }) => {
          nonXGlyphCache[`${row}-${col}`] = glyphId;
        });
      } else if (pattern === 1) {
        const upperGlyph = shuffledGlyphs[glyphIndex++]?.id || 1;
        const bottomGlyph = shuffledGlyphs[glyphIndex++]?.id || 1;
        const leftGlyph = shuffledGlyphs[glyphIndex++]?.id || 1;
        const rightGlyph = shuffledGlyphs[glyphIndex++]?.id || 1;
        nonXCells.forEach(({ row, col }) => {
          if (row <= 3 && col <= 4) {
            nonXGlyphCache[`${row}-${col}`] = upperGlyph;
          } else if (row >= 5 && col <= 4) {
            nonXGlyphCache[`${row}-${col}`] = bottomGlyph;
          } else if (col < 4) {
            nonXGlyphCache[`${row}-${col}`] = leftGlyph;
          } else {
            nonXGlyphCache[`${row}-${col}`] = rightGlyph;
          }
        });
      } else if (pattern === 2) {
        const upperBottomGlyph = shuffledGlyphs[glyphIndex++]?.id || 1;
        const middleGlyph = shuffledGlyphs[glyphIndex++]?.id || 1;
        nonXCells.forEach(({ row, col }) => {
          if (row <= 3 || row >= 5) {
            nonXGlyphCache[`${row}-${col}`] = upperBottomGlyph;
          } else {
            nonXGlyphCache[`${row}-${col}`] = middleGlyph;
          }
        });
      } else if (pattern === 3) {
        const leftGlyph = shuffledGlyphs[glyphIndex++]?.id || 1;
        const rightGlyph = shuffledGlyphs[glyphIndex++]?.id || 1;
        nonXCells.forEach(({ row, col }) => {
          if (col <= 4) {
            nonXGlyphCache[`${row}-${col}`] = leftGlyph;
          } else {
            nonXGlyphCache[`${row}-${col}`] = rightGlyph;
          }
        });
      }
    }

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const i = row * 9 + col;
        let currentBgColor: number;
        let currentFgColor: number;

        if (numColors === 4) {
          currentBgColor = bgColor!;
          currentFgColor = isTypoGlyph(row, col) ? typoColor! : (row <= 4 ? graphicColorTop! : graphicColorBottom!);
        } else if (numColors === 5) {
          if (row === 0 || row === 1) {
            currentBgColor = bgColor1!;
          } else if (row === 2 || row === 3) {
            currentBgColor = bgColor2!;
          } else if (row === 4 || row === 5) {
            currentBgColor = bgColor3!;
          } else {
            currentBgColor = bgColor4!;
          }
          currentFgColor = glyphColor!;
        } else if (numColors === 6) {
          if (row <= 2) {
            currentBgColor = bgColor1!;
            currentFgColor = fgColor1!;
          } else if (row <= 5) {
            currentBgColor = bgColor2!;
            currentFgColor = fgColor2!;
          } else {
            currentBgColor = bgColor3!;
            currentFgColor = fgColor3!;
          }
        } else if (numColors === 7) {
          const blockRow = Math.floor(row / 3);
          const blockCol = Math.floor(col / 3);
          const blockIndex = blockRow * 3 + blockCol;
          const block = blockAssignments![blockIndex];
          currentBgColor = block.bgColor;
          currentFgColor = isTypoGlyph(row, col) ? typoColor! : block.fgColor;
        } else if (numColors === 8) {
          const randomColors = availableColors.filter((c) => c !== typoColor);
          currentBgColor = randomColors[Math.floor(Math.random() * randomColors.length)];
          currentFgColor = isTypoGlyph(row, col)
            ? typoColor!
            : randomColors[Math.floor(Math.random() * randomColors.length)];
          usedColors.add(currentBgColor);
          usedColors.add(currentFgColor);
        } else if (numColors >= 9) {
          currentBgColor = bgColorsRows![row];
          currentFgColor = fgColorsRows![row];
        } else {
          currentBgColor = row >= 1 && row <= 7 && (col === 1 || col >= 3) ? typoBgColor! : bgColor!;
          currentFgColor =
            row >= 1 && row <= 7 && (col === 1 || col >= 3) && numColors >= 5 && row % 2 === 0
              ? typoColor2!
              : row === 0 || row === 8 || col === 0 || col === 8
              ? numColors >= 6 && row >= 5
                ? frameColor2!
                : frameColor!
              : typoColor1!;
        }

        if ((row === 0 || row === 8 || col === 0 || col === 8) && !(col === 2)) {
          if (complexity === 9) {
            if (row === 0) {
              newFgGlyphs[i] = frameGlyphs[0].id;
            } else if (col === 8) {
              newFgGlyphs[i] = frameGlyphs[1].id;
            } else if (row === 8) {
              newFgGlyphs[i] = frameGlyphs[2].id;
            } else if (col === 0) {
              newFgGlyphs[i] = frameGlyphs[3].id;
            }
          } else if (complexity === 8 || complexity === 5) {
            if (row === 0 || (col === 0 && row <= 3) || (col === 8 && row <= 3)) {
              newFgGlyphs[i] = frameGlyphsU[0].id;
            } else if (row === 8 || (col === 0 && row >= 4) || (col === 8 && row >= 4)) {
              newFgGlyphs[i] = frameGlyphsU[1].id;
            }
          } else {
            if ((row === 0 && col === 0) || (row === 0 && col === 8) || (row === 8 && col === 0) || (row === 8 && col === 8)) {
              newFgGlyphs[i] = cornerGlyph.id;
            } else {
              newFgGlyphs[i] = edgeGlyphs[Math.floor(Math.random() * edgeGlyphs.length)]?.id || cornerGlyph.id;
            }
          }
          newFgColors[i] = currentFgColor;
          newBgGlyphs[i] = 1;
          newBgColors[i] = currentBgColor;
          continue;
        }

        if (col === 2) {
          if (row === 0 || row === 8) {
            newFgGlyphs[i] = complexity === 9
              ? frameGlyphs[row === 0 ? 0 : 2].id
              : complexity === 8 || complexity === 5
              ? frameGlyphsU[row === 0 ? 0 : 1].id
              : edgeGlyphs[Math.floor(Math.random() * edgeGlyphs.length)]?.id || cornerGlyph.id;
            newFgColors[i] = currentFgColor;
            newBgGlyphs[i] = 1;
            newBgColors[i] = currentBgColor;
          }
        }

        if (row >= 1 && row <= 7 && (col === 1 || col >= 2)) {
          if (complexity === 1) {
            if (row === typoRow) {
              const colToLetterIdx = [1, 2, 3, 4, 5, 6, 7].indexOf(col);
              newFgGlyphs[i] = variation1[colToLetterIdx];
            } else {
              newFgGlyphs[i] = getRandomGraphicGlyph();
            }
            newFgColors[i] = currentFgColor;
            newBgGlyphs[i] = 1;
            newBgColors[i] = currentBgColor;
          } else if (complexity === 2) {
            if (row === typoRow) {
              const colToLetterIdx = [1, 2, 3, 4, 5, 6, 7].indexOf(col);
              newFgGlyphs[i] = variation1[colToLetterIdx];
            } else {
              newFgGlyphs[i] = getRandomGraphicGlyph();
            }
            newFgColors[i] = currentFgColor;
            newBgGlyphs[i] = 1;
            newBgColors[i] = currentBgColor;
          } else if (complexity === 3) {
            if (col === typoCol) {
              const rowToLetterIdx = row - 1;
              newFgGlyphs[i] = variation1[rowToLetterIdx];
            } else {
              newFgGlyphs[i] = getRandomGraphicGlyph();
            }
            newFgColors[i] = currentFgColor;
            newBgGlyphs[i] = 1;
            newBgColors[i] = currentBgColor;
          } else if (complexity === 4) {
            if (
              (row === 1 && (col === 1 || col === 7)) ||
              (row === 2 && (col === 2 || col === 6)) ||
              (row === 3 && (col === 3 || col === 5)) ||
              (row === 4 && col === 4) ||
              (row === 5 && (col === 3 || col === 5)) ||
              (row === 6 && (col === 2 || col === 6)) ||
              (row === 7 && (col === 1 || col === 7))
            ) {
              newFgGlyphs[i] = getTypoGlyphForRow(row, variation1);
            } else {
              const cellKey = `${row}-${col}`;
              newFgGlyphs[i] = nonXGlyphCache[cellKey] || getRandomGraphicGlyph();
            }
            newFgColors[i] = currentFgColor;
            newBgGlyphs[i] = 1;
            newBgColors[i] = currentBgColor;
          } else if (complexity === 5) {
            if (col === typoCol) {
              const rowToLetterIdx = row - 1;
              newFgGlyphs[i] = variation1[rowToLetterIdx];
            } else {
              const blockRow = Math.floor((row - 1) / 2) * 2 + 1;
              const blockCol = Math.floor((col - 1) / 2) * 2 + 1;
              const blockIdx = `${blockRow}-${blockCol}`;
              if (!blockGlyphCache[blockIdx]) {
                blockGlyphCache[blockIdx] = getRandomGraphicGlyph();
              }
              newFgGlyphs[i] = blockGlyphCache[blockIdx];
            }
            newFgColors[i] = currentFgColor;
            newBgGlyphs[i] = 1;
            newBgColors[i] = currentBgColor;
          } else if (complexity === 6) {
            if ([1, 3, 5, 7].includes(row)) {
              newFgGlyphs[i] = getTypoGlyphForRow(row, variation1);
            } else {
              newFgGlyphs[i] = getTypoGlyphForRow(row, variation2);
            }
            newFgColors[i] = currentFgColor;
            newBgGlyphs[i] = 1;
            newBgColors[i] = currentBgColor;
          } else if (complexity === 7) {
            if (row === typoRow && col >= 1 && col <= 4) {
              const colToLetterIdx = col - 1;
              newFgGlyphs[i] = variationBase[colToLetterIdx];
            } else {
              if (!rowGlyphCache[row]) {
                rowGlyphCache[row] = getRandomGraphicGlyph();
              }
              newFgGlyphs[i] = rowGlyphCache[row];
            }
            newFgColors[i] = currentFgColor;
            newBgGlyphs[i] = 1;
            newBgColors[i] = currentBgColor;
          } else if (complexity === 8) {
            if ([2, 4, 6].includes(row)) {
              if (row === typoRow && col >= 1 && col <= 4) {
                const colToLetterIdx = col - 1;
                newFgGlyphs[i] = variationBase[colToLetterIdx];
              } else if (row === typoRow2 && col >= 1 && col <= 7) {
                const colToLetterIdx = [1, 2, 3, 4, 5, 6, 7].indexOf(col);
                newFgGlyphs[i] = variation1[colToLetterIdx];
              } else {
                if (!rowGlyphCache[row]) {
                  rowGlyphCache[row] = getRandomGraphicGlyph();
                }
                newFgGlyphs[i] = rowGlyphCache[row];
              }
            } else if ([1, 3, 5, 7].includes(row)) {
              if (!rowGlyphCache[row]) {
                rowGlyphCache[row] = getRandomGraphicGlyph();
              }
              newFgGlyphs[i] = rowGlyphCache[row];
            }
            newFgColors[i] = currentFgColor;
            newBgGlyphs[i] = 1;
            newBgColors[i] = currentBgColor;
          } else if (complexity === 9) {
            if ([1, 3, 5, 7].includes(col)) {
              newFgGlyphs[i] = getTypoGlyphForRow(row, variation1);
            } else {
              if (!colGlyphCache[col]) {
                colGlyphCache[col] = getRandomGraphicGlyph();
              }
              newFgGlyphs[i] = colGlyphCache[col];
            }
            newFgColors[i] = currentFgColor;
            newBgGlyphs[i] = 1;
            newBgColors[i] = currentBgColor;
          } else if (complexity === 10) {
            if (row >= 1 && row <= 7 && col === typoCols[row - 1]) {
              const rowToLetterIdx = row - 1;
              newFgGlyphs[i] = variation1[rowToLetterIdx];
            } else {
              const blockRow = Math.floor((row - 1) / 3) * 3 + 1;
              const blockCol = Math.floor((col - 1) / 3) * 3 + 1;
              const blockIdx = `${blockRow}-${blockCol}`;
              if (!blockGlyphCache[blockIdx]) {
                blockGlyphCache[blockIdx] = getRandomGraphicGlyph();
              }
              newFgGlyphs[i] = blockGlyphCache[blockIdx];
            }
            newFgColors[i] = currentFgColor;
            newBgGlyphs[i] = 1;
            newBgColors[i] = currentBgColor;
          }
          continue;
        }

        newBgGlyphs[i] = 1;
        newBgColors[i] = currentBgColor;
      }
    }

    console.log("Generated art data:", {
      newBgGlyphs,
      newFgGlyphs,
      newBgColors,
      newFgColors,
    });

    setBgGlyphs(newBgGlyphs);
    setFgGlyphs(newFgGlyphs);
    setBgColors(newBgColors);
    setFgColors(newFgColors);
    if (complexity === 1 || complexity === 2 || complexity === 7 || complexity === 8) {
      setTypoRow(newTypoRow);
      localStorage.setItem("typoRow", JSON.stringify(newTypoRow));
    }
    if (complexity === 8) {
      setTypoRow2(newTypoRow2);
      localStorage.setItem("typoRow2", JSON.stringify(newTypoRow2));
    }
    if (complexity === 3 || complexity === 5) {
      setTypoCol(newTypoCol);
      localStorage.setItem("typoCol", JSON.stringify(newTypoCol));
    }
    if (complexity === 10) {
      setTypoCols(newTypoCols);
      localStorage.setItem("typoCols", JSON.stringify(newTypoCols));
    }
    localStorage.setItem("bgGlyphs", JSON.stringify(newBgGlyphs));
    localStorage.setItem("fgGlyphs", JSON.stringify(newFgGlyphs));
    localStorage.setItem("bgColors", JSON.stringify(newBgColors));
    localStorage.setItem("fgColors", JSON.stringify(newFgColors));
    setHasGenerated(true);
  }, [complexity, glyphCount, selectedColors, stableGlyphs, typoRow, typoRow2, typoCol, typoCols, isTypoGlyph]);

  useEffect(() => {
    const shouldGenerate = localStorage.getItem("shouldGenerateArt") === "true";
    if (shouldGenerate && selectedColors.length >= 2 && !hasGenerated) {
      console.log("Auto-generating art on ArtGeneration mount due to ColorSelection signal");
      generateArt();
      localStorage.removeItem("shouldGenerateArt");
    }
  }, [selectedColors, hasGenerated, generateArt]);

  const shuffleColors = useCallback(() => {
    if (!hasGenerated || selectedColors.length < 2) return;
    const fgColorSet = new Set<number>();
    const bgColorSet = new Set<number>();
    for (let i = 0; i < 81; i++) {
      if (fgColors[i] !== null) fgColorSet.add(fgColors[i]!);
      if (bgColors[i] !== null) bgColorSet.add(bgColors[i]!);
    }
    const fgColorPool = Array.from(fgColorSet);
    const bgColorPool = Array.from(bgColorSet);
    const shuffledFgColors = shuffleArray([...fgColorPool]);
    const shuffledBgColors = shuffleArray([...bgColorPool]);

    const fgColorMap = new Map<number, number>();
    const bgColorMap = new Map<number, number>();
    fgColorPool.forEach((color, idx) => {
      fgColorMap.set(color, shuffledFgColors[idx % shuffledFgColors.length]);
    });
    bgColorPool.forEach((color, idx) => {
      bgColorMap.set(color, shuffledBgColors[idx % shuffledBgColors.length]);
    });

    const newFgColors = new Array(81).fill(null);
    const newBgColors = new Array(81).fill(null);

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const i = row * 9 + col;
        if ((row === 0 || row === 8 || col === 0 || col === 8) && !(col === 2)) {
          newFgColors[i] = fgColors[i] !== null ? fgColorMap.get(fgColors[i]!) || fgColors[i] : null;
          newBgColors[i] = bgColors[i] !== null ? bgColorMap.get(bgColors[i]!) || bgColors[i] : null;
          continue;
        }
        if (col === 2) {
          if (row === 0 || row === 8) {
            newFgColors[i] = fgColors[i] !== null ? fgColorMap.get(fgColors[i]!) || fgColors[i] : null;
            newBgColors[i] = bgColors[i] !== null ? bgColorMap.get(bgColors[i]!) || bgColors[i] : null;
          } else {
            newFgColors[i] = fgColors[i] !== null ? fgColorMap.get(fgColors[i]!) || fgColors[i] : null;
            newBgColors[i] = bgColors[i] !== null ? bgColorMap.get(bgColors[i]!) || bgColors[i] : null;
          }
          continue;
        }
        if (row >= 1 && row <= 7 && (col === 1 || col >= 3)) {
          newFgColors[i] = fgColors[i] !== null ? fgColorMap.get(fgColors[i]!) || fgColors[i] : null;
          newBgColors[i] = bgColors[i] !== null ? bgColorMap.get(bgColors[i]!) || bgColors[i] : null;
          continue;
        }
        newBgColors[i] = bgColors[i] !== null ? bgColorMap.get(bgColors[i]!) || bgColors[i] : null;
      }
    }

    for (let i = 0; i < 81; i++) {
      if (
        fgGlyphs[i] !== null &&
        newFgColors[i] !== null &&
        newBgColors[i] !== null &&
        newFgColors[i] === newBgColors[i]
      ) {
        const bgColor = newBgColors[i]!;
        let nextBgColorIdx = bgColorPool.indexOf(bgColor);
        let attempts = 0;
        while (newFgColors[i] === newBgColors[i] && attempts < bgColorPool.length) {
          nextBgColorIdx = (nextBgColorIdx + 1) % bgColorPool.length;
          newBgColors[i] = bgColorPool[nextBgColorIdx];
          attempts++;
        }
      }
    }

    setFgColors(newFgColors);
    setBgColors(newBgColors);
    localStorage.setItem("fgColors", JSON.stringify(newFgColors));
    localStorage.setItem("bgColors", JSON.stringify(newBgColors));
  }, [hasGenerated, selectedColors, fgColors, bgColors, fgGlyphs]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!hasGenerated || selectedColors.length < 2) return;
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.floor((e.clientX - rect.left) * scaleX / scale);
      const y = Math.floor((e.clientY - rect.top) * scaleY / scale);
      const idx = y * 9 + x;
      if (idx < 0 || idx >= 81) return;

      const row = y;
      const col = x;

      if (isTypoGlyph(row, col)) {
        console.log(`Cannot modify typo glyph at index ${idx} (row ${row}, col ${col})`);
        return;
      }

      const availableColors = selectedColors.map((idx) => idx + 1);
      const newBgColors = [...bgColors];
      const newFgColors = [...fgColors];
      const newFgGlyphs = [...fgGlyphs];

      const currentTime = Date.now();
      const isDoubleTap = lastTapRef.current && currentTime - lastTapRef.current.time < 300 && lastTapRef.current.idx === idx;
      const isBackgroundClick = e.shiftKey || isDoubleTap;

      lastTapRef.current = { time: currentTime, idx };

      if (selectedGlyph !== null && !isBackgroundClick) {
        const glyphExists = stableGlyphs.some((g) => g.id === selectedGlyph);
        if (glyphExists) {
          newFgGlyphs[idx] = selectedGlyph;
          if (newFgColors[idx] === null) {
            const bgColor = bgColors[idx];
            let newColor = availableColors[Math.floor(Math.random() * availableColors.length)];
            let attempts = 0;
            while (newColor === bgColor && attempts < availableColors.length) {
              newColor = availableColors[Math.floor(Math.random() * availableColors.length)];
              attempts++;
            }
            newFgColors[idx] = newColor;
          }
          setSelectedGlyph(null);
        }
      } else if (isBackgroundClick && bgColors[idx] !== null) {
        const currentIdx = availableColors.indexOf(bgColors[idx]!);
        let nextIdx = (currentIdx + 1) % availableColors.length;
        while (fgColors[idx] !== null && availableColors[nextIdx] === fgColors[idx]) {
          nextIdx = (nextIdx + 1) % availableColors.length;
        }
        newBgColors[idx] = availableColors[nextIdx];
      } else if (fgGlyphs[idx] !== null && fgColors[idx] !== null) {
        if (selectedColors.length === 2) {
          const temp = newBgColors[idx];
          newBgColors[idx] = newFgColors[idx];
          newFgColors[idx] = temp;
        } else {
          const currentIdx = availableColors.indexOf(fgColors[idx]!);
          let nextIdx = (currentIdx + 1) % availableColors.length;
          while (availableColors[nextIdx] === newBgColors[idx]) {
            nextIdx = (nextIdx + 1) % availableColors.length;
          }
          newFgColors[idx] = availableColors[nextIdx];
        }
      }

      setBgColors(newBgColors);
      setFgColors(newFgColors);
      setFgGlyphs(newFgGlyphs);
      localStorage.setItem("bgColors", JSON.stringify(newBgColors));
      localStorage.setItem("fgColors", JSON.stringify(newFgColors));
      localStorage.setItem("fgGlyphs", JSON.stringify(newFgGlyphs));
    },
    [bgColors, fgColors, fgGlyphs, selectedColors, hasGenerated, selectedGlyph, stableGlyphs, isTypoGlyph]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!hasGenerated || selectedColors.length < 2) return;
      const key = e.key;
      if (!/^[0-9]$/.test(key)) return;
      const glyphId = key === "0" ? 10 : parseInt(key);
      if (glyphId < 1 || glyphId > 10) return;
      const glyphExists = stableGlyphs.some((g) => g.id === glyphId);
      if (!glyphExists) {
        console.log(`Glyph ID ${glyphId} not available in stableGlyphs`);
        return;
      }
      setSelectedGlyph(glyphId);
    },
    [hasGenerated, selectedColors, stableGlyphs]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#D3D3D3";
    ctx.fillRect(0, 0, size * scale, size * scale);

    const pixelSize = scale / 8;
    const offset = (scale - pixelSize * 8) / 2;

    for (let i = 0; i < 81; i++) {
      const x = (i % size) * scale;
      const y = Math.floor(i / size) * scale;

      if (bgGlyphs[i] !== null && bgColors[i] !== null && bgColors[i]! <= COLORS.length) {
        const rgb = COLORS[bgColors[i]! - 1];
        if (rgb) {
          ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
          ctx.fillRect(x, y, scale, scale);
        }
      }

      if (
        fgGlyphs[i] !== null &&
        fgGlyphs[i] !== 0 &&
        fgColors[i] !== null &&
        fgColors[i]! <= COLORS.length
      ) {
        const glyphId = fgGlyphs[i]!;
        const rgb = COLORS[fgColors[i]! - 1];
        if (rgb) {
          ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
          const glyph = stableGlyphs.find((g) => g.id === glyphId);
          if (glyph && typeof glyph.bitmap !== "undefined") {
            const bitmap = typeof glyph.bitmap === "string" ? BigInt(glyph.bitmap) : glyph.bitmap;
            for (let gy = 0; gy < 8; gy++) {
              for (let gx = 0; gx < 8; gx++) {
                if ((bitmap & (BigInt(1) << BigInt(63 - (gy * 8 + gx)))) !== BigInt(0)) {
                  const glyphX = x + offset + gx * pixelSize;
                  const glyphY = y + offset + gy * pixelSize;
                  ctx.fillRect(glyphX, glyphY, pixelSize, pixelSize);
                }
              }
            }
          }
        }
      }
    }
  }, [bgGlyphs, fgGlyphs, bgColors, fgColors, stableGlyphs]);

  useEffect(() => {
    if (selectedColors.length >= 2 && hasGenerated) {
      redrawCanvas();
    }
  }, [redrawCanvas, selectedColors, hasGenerated]);

  return (
    <div className="max-w-[400px] mx-auto">
      <div className="flex items-center justify-center mb-2">
        <h2 className="text-base text-center text-gray-500">Generate Your Art</h2>
        <button
          onClick={() => setShowInfo(true)}
          className="ml-2 text-gray-500 hover:text-gray-400"
        >
          <Info size={16} />
        </button>
      </div>
      {selectedColors.length < 2 ? (
        <p className="text-red-500 mb-4 text-center">Please select at least 2 colors first.</p>
      ) : (
        <div className="flex justify-center mb-4 relative">
          <canvas
            ref={canvasRef}
            width={size * scale}
            height={size * scale}
            className="border border-gray-100 pixelated"
            style={{ maxWidth: "100%", height: "auto", aspectRatio: "1 / 1" }}
            onClick={handleCanvasClick}
          />
          {showInfo && (
            <div
              className="absolute inset-0 bg-black/50 flex items-center justify-center z-10"
              onClick={() => setShowInfo(false)}
            >
              <div className="bg-white p-4 max-w-[80%] text-center">
                <ul className="text-sm text-black list-disc ml-4 space-y-2 text-left">
                  <li>Tap to change glyph color.</li>
                  <li>Double-tap or Shift+click to change background color.</li>
                  <li>Press 0–9 to draw glyphs 1–10.</li>
                  <li>
                    <RefreshCw size={16} className="inline mr-2" /> Randomize pattern.
                  </li>
                  <li>
                    <Droplet size={16} className="inline mr-2" /> Shuffle colors.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
      {error && error !== "Using cached glyphs." && (
        <p className="text-red-500 mb-4 text-center">{error}</p>
      )}
      <div className="space-y-4 mb-2">
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value={complexity}
          onChange={(e) => {
            const newComplexity = parseInt(e.target.value);
            console.log("Complexity changed to:", newComplexity);
            setComplexity(newComplexity);
          }}
          className="w-full"
        />
        <div className="mt-6 space-y-2">
          <button
            onClick={() => {
              console.log("Generate button clicked");
              generateArt();
            }}
            disabled={selectedColors.length < 2}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 text-base rounded-none disabled:bg-gray-400 transition-colors"
          >
            <RefreshCw size={16} className="mr-2 inline" />
          </button>
          <button
            onClick={() => {
              console.log("Shuffle Colors button clicked");
              shuffleColors();
            }}
            disabled={!hasGenerated || selectedColors.length < 2}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 text-base rounded-none disabled:bg-gray-400 transition-colors"
          >
            <Droplet size={16} className="mr-2 inline" />
          </button>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(1)}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-black py-2 text-base rounded-none transition-colors"
            >
              <ArrowLeftCircle size={16} className="mr-2 inline" />
            </button>
            <button
              onClick={() => setPage(3)}
              disabled={!hasGenerated || selectedColors.length < 2}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 text-base rounded-none disabled:bg-gray-400 transition-colors"
            >
              <ArrowRightCircle size={16} className="mr-2 inline" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



function MetadataDeployment({ setPage, address }: { setPage: (page: number) => void; address: string }) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });
  const { connect, connectors } = useConnect();
  const [name, setName] = useState('BaseBatch');
  const [symbol, setSymbol] = useState('BBART');
  const [description, setDescription] = useState('This Artwork was made in a shared moment of creation Minted during BayBatches on Base');
  const [editionSize, setEditionSize] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [editionAddress, setEditionAddress] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [artTxHash, setArtTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [manualReceipt, setManualReceipt] = useState<ethers.TransactionReceipt | null>(null);
  const [isClient, setIsClient] = useState(false);
  const ALCHEMY_URL = process.env.NEXT_PUBLIC_ALCHEMY_URL || '';

  const provider = useMemo(() => {
    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
    if (!apiKey) {
      console.error('NEXT_PUBLIC_ALCHEMY_API_KEY is missing');
      return new ethers.JsonRpcProvider('https://sepolia.base.org');
    }
    return new ethers.JsonRpcProvider(`https://base-sepolia.g.alchemy.com/v2/${apiKey}`);
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    console.log('Alchemy API Key:', process.env.NEXT_PUBLIC_ALCHEMY_API_KEY);
    provider.getNetwork().then(net => {
      console.log('Current chainId:', net.chainId);
      if (Number(net.chainId) !== baseSepolia.id) {
        console.error('Wrong chain! Expected:', baseSepolia.id, 'Got:', net.chainId);
      }
    }).catch(err => {
      console.error('Failed to get chainId:', err);
    });
  }, [provider]);

  const { data: receipt, error: receiptError, status: receiptStatus } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}`,
    chainId: baseSepolia.id,
    pollingInterval: 1000,
    timeout: 60000,
  });
  const { data: artReceipt } = useWaitForTransactionReceipt({
    hash: artTxHash as `0x${string}`,
    chainId: baseSepolia.id,
  });

  useEffect(() => {
    console.log('useWaitForTransactionReceipt:', {
      txHash,
      receipt,
      receiptError,
      receiptStatus,
      artTxHash,
      artReceipt,
    });
  }, [txHash, receipt, receiptError, receiptStatus, artTxHash, artReceipt]);

  useEffect(() => {
    if (txHash && !manualReceipt && !receipt) {
      console.log('Manually fetching receipt for txHash:', txHash);
      const fetchReceipt = async (attempt = 1, maxAttempts = 5) => {
        try {
          let fetchedReceipt = await callWithRetry(() => provider.getTransactionReceipt(txHash!));
          if (fetchedReceipt) {
            console.log('Manually fetched receipt (ethers):', fetchedReceipt);
            setManualReceipt(fetchedReceipt);
            return;
          }
          if (publicClient) {
            fetchedReceipt = await callWithRetry(() => publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` }));
            console.log('Manually fetched receipt (wagmi):', fetchedReceipt);
            if (fetchedReceipt) {
              setManualReceipt(fetchedReceipt);
              return;
            }
          }
          if (attempt < maxAttempts) {
            console.log(`Receipt not found, retrying (${attempt}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            await fetchReceipt(attempt + 1, maxAttempts);
          } else {
            console.error('Failed to fetch receipt after max attempts');
          }
        } catch (err: unknown) {
          console.error('Failed to fetch receipt:', err);
          if (attempt < maxAttempts) {
            console.log(`Receipt fetch failed, retrying (${attempt}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            await fetchReceipt(attempt + 1, maxAttempts);
          } else {
            console.error('Failed to fetch receipt after max attempts:', err);
          }
        }
      };
      fetchReceipt();
    }
  }, [txHash, provider, publicClient, receipt, manualReceipt]);

  useEffect(() => {
    const activeReceipt = receipt || manualReceipt;
    console.log('useEffect triggered with:', {
      activeReceipt,
      txHash,
      editionAddress,
      address,
      editionSize,
      provider: !!provider,
    });
    if (activeReceipt && !editionAddress && txHash) {
      console.log('Processing receipt:', activeReceipt);
      const editionCreatedLog = activeReceipt.logs.find(
        (log) =>
          log.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase() &&
          log.topics[0] === ethers.id('EditionCreated(address,address)')
      );
      console.log('EditionCreated log:', editionCreatedLog);
      if (!editionCreatedLog) {
        console.error('EditionCreated event not found');
        setError('Failed to find edition address');
        setIsCreating(false);
        setStatusMessage('');
        return;
      }

      const newEdition = '0x' + editionCreatedLog.topics[2].slice(-40);
      setEditionAddress(newEdition);

      const setBaseArt = async () => {
        try {
          console.log('Starting setBaseArt for edition:', newEdition);
          setStatusMessage('Step 2/2: Setting artwork...');
          const bgGlyphsRaw = JSON.parse(localStorage.getItem('bgGlyphs') || '[]') as (number | null)[];
          const fgGlyphsRaw = JSON.parse(localStorage.getItem('fgGlyphs') || '[]') as (number | null)[];
          const bgColorsRaw = JSON.parse(localStorage.getItem('bgColors') || '[]') as (number | null)[];
          const fgColorsRaw = JSON.parse(localStorage.getItem('fgColors') || '[]') as (number | null)[];

          console.log('Raw localStorage data:', {
            bgGlyphsRaw,
            fgGlyphsRaw,
            bgColorsRaw,
            fgColorsRaw,
            bgGlyphsLength: bgGlyphsRaw.length,
            fgGlyphsLength: fgGlyphsRaw.length,
            bgColorsLength: bgColorsRaw.length,
            fgColorsLength: fgColorsRaw.length,
            bgGlyphsValid: bgGlyphsRaw.every((g) => typeof g === 'number' && g >= 1),
            fgGlyphsValid: fgGlyphsRaw.every((g) => g === null || (typeof g === 'number' && g >= 1)),
            bgColorsValid: bgColorsRaw.every((c) => typeof c === 'number' && c >= 1 && c <= COLORS.length),
            fgColorsValid: fgColorsRaw.every((c) => c === null || (typeof c === 'number' && c >= 0 && c <= COLORS.length)),
          });

          if (
            !Array.isArray(bgGlyphsRaw) ||
            !Array.isArray(fgGlyphsRaw) ||
            !Array.isArray(bgColorsRaw) ||
            !Array.isArray(fgColorsRaw) ||
            bgGlyphsRaw.length !== 81 ||
            fgGlyphsRaw.length !== 81 ||
            bgColorsRaw.length !== 81 ||
            fgColorsRaw.length !== 81 ||
            !bgGlyphsRaw.every((g) => typeof g === 'number' && g >= 1) ||
            !bgColorsRaw.every((c) => typeof c === 'number' && c >= 1 && c <= COLORS.length) ||
            !fgGlyphsRaw.every((g) => g === null || (typeof g === 'number' && g >= 1)) ||
            !fgColorsRaw.every((c) => c === null || (typeof c === 'number' && c >= 0 && c <= COLORS.length))
          ) {
            throw new Error('Invalid or missing canvas state in localStorage');
          }

          const bgGlyphs = bgGlyphsRaw.map((g) => g!);
          const fgGlyphs = fgGlyphsRaw.map((g) => g ?? 0);

          const usedColorIndices = new Set<number>(
            [...bgColorsRaw, ...fgColorsRaw].filter((c): c is number => c !== null && c > 0)
          );
          const usedColors: number[] = [];
          const colorMap: { [oldIdx: number]: number } = {};

          const sortedUsedIndices = Array.from(usedColorIndices).sort((a, b) => a - b);
          sortedUsedIndices.forEach((oldIdx, newIdx) => {
            colorMap[oldIdx] = newIdx + 1;
            usedColors.push(...COLORS[oldIdx - 1]);
          });

          const remappedBgColors = bgColorsRaw.map((c) =>
            c !== null && colorMap[c] ? colorMap[c] : 0
          );
          const remappedFgColors = fgColorsRaw.map((c) =>
            c !== null && colorMap[c] ? colorMap[c] : 0
          );

          const newColors = usedColors;

          console.log('Processed data for setBaseArt:', {
            bgGlyphs,
            fgGlyphs,
            remappedBgColors,
            remappedFgColors,
            newColors,
            colorMap,
            usedColorIndices: sortedUsedIndices,
          });

          const config = {
            address: newEdition as `0x${string}`,
            abi: editionAbi.abi,
            functionName: 'setBaseArt',
            args: [
              bgGlyphs,
              fgGlyphs,
              remappedBgColors,
              remappedFgColors,
              newColors,
              false,
              ethers.ZeroAddress,
              ethers.ZeroAddress,
              true,
              0,
              GLYPH_SET_ADDRESS,
            ],
          };

          const contract = new ethers.Contract(newEdition, editionAbi.abi, provider);
          const gasEstimate = await callWithRetry(() =>
            contract.setBaseArt.estimateGas(
              bgGlyphs,
              fgGlyphs,
              remappedBgColors,
              remappedFgColors,
              newColors,
              false,
              ethers.ZeroAddress,
              ethers.ZeroAddress,
              true,
              0,
              GLYPH_SET_ADDRESS,
              { from: address }
            )
          ).catch((err) => {
            throw new Error('Gas estimation failed: ' + (err as Error).message);
          });

          const gasWithBuffer = (gasEstimate * BigInt(120)) / BigInt(100);

          let maxFeePerGas: bigint, maxPriorityFeePerGas: bigint;
          try {
            const gasFeeData = await callWithRetry(() => provider.getFeeData());
            maxFeePerGas = gasFeeData.maxFeePerGas
              ? (gasFeeData.maxFeePerGas * BigInt(150)) / BigInt(100)
              : BigInt('50000000000'); // Fallback: 50 Gwei
            maxPriorityFeePerGas = gasFeeData.maxPriorityFeePerGas
              ? (gasFeeData.maxPriorityFeePerGas * BigInt(150)) / BigInt(100)
              : BigInt('2000000000'); // Fallback: 2 Gwei
          } catch (err: unknown) {
            console.error('Failed to fetch gas fee data for setBaseArt:', err);
            if (publicClient) {
              const gasFeeData = await callWithRetry(() => publicClient.getFeeData());
              maxFeePerGas = gasFeeData.maxFeePerGas
                ? (gasFeeData.maxFeePerGas * BigInt(150)) / BigInt(100)
                : BigInt('50000000000');
              maxPriorityFeePerGas = gasFeeData.maxPriorityFeePerGas
                ? (gasFeeData.maxPriorityFeePerGas * BigInt(150)) / BigInt(100)
                : BigInt('2000000000');
            } else {
              console.warn('Using fallback gas values for setBaseArt');
              maxFeePerGas = BigInt('50000000000');
              maxPriorityFeePerGas = BigInt('2000000000');
            }
          }

          const artTx = await callWithRetry(() =>
            writeContractAsync({
              ...config,
              gas: gasWithBuffer,
              maxFeePerGas,
              maxPriorityFeePerGas,
            })
          ).catch(err => {
            throw new Error('setBaseArt transaction failed: ' + (err as Error).message);
          });
          console.log('setBaseArt txHash:', artTx);
          setArtTxHash(artTx);
        } catch (error: unknown) {
          console.error('Set base art failed:', error);
          setError('Edition created at ' + newEdition + ', but artwork not set. Call setBaseArt manually.');
          setIsCreating(false);
          setStatusMessage('');
        }
      };

      setBaseArt();
    }
  }, [receipt, manualReceipt, txHash, writeContractAsync, address, editionSize, provider, publicClient, editionAddress]);

  useEffect(() => {
    if (artReceipt && editionAddress && isClient) {
      console.log('artReceipt received, triggering PNG generation for:', editionAddress);
      setStatusMessage('Finalizing... Generating PNG...');
      const triggerPng = async (attempt = 1, maxAttempts = 3) => {
        try {
          const response = await callWithRetry(() =>
            fetch('/api/trigger-png', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ editionAddress }),
            })
          );
          const responseData = await response.json();
          console.log('PNG API response:', response.status, responseData);
          if (!response.ok) {
            throw new Error(`PNG generation failed: ${responseData.error || 'Unknown error'}`);
          }
          setStatusMessage('Edition created successfully!');
          setTimeout(() => {
            setIsCreating(false);
            setStatusMessage('');
          }, 2000);
        } catch (err: unknown) {
          console.error(`PNG trigger error for ${editionAddress} (attempt ${attempt}/${maxAttempts}):`, err);
          if (attempt < maxAttempts) {
            console.log(`Retrying PNG generation (${attempt}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            await triggerPng(attempt + 1, maxAttempts);
          } else {
            console.warn('PNG generation failed, relying on NFTImage for display');
            setStatusMessage('Edition created successfully!');
            setTimeout(() => {
              setIsCreating(false);
              setStatusMessage('');
            }, 2000);
          }
        }
      };
      setTimeout(() => {
        triggerPng();
      }, 5000); // 5-second delay to match mini-editor.tsx
    }
  }, [artReceipt, editionAddress, isClient]);

  const createEdition = async () => {
    if (!connectors.length) {
      console.error('No wallet connectors available');
      setError('No wallet connectors available. Please try again.');
      return;
    }

    if (!address || isCreating) return;
    setIsCreating(true);
    setError(null);
    setStatusMessage('Creating edition, please confirm transactions...');
    try {
      if (!name.trim()) throw new Error('Name is required');
      if (!symbol.trim()) throw new Error('Symbol is required');
      if (!description.trim()) throw new Error('Description is required');
      if (editionSize < 1 || editionSize > 5) throw new Error('Edition size must be 1–5');

      const config = {
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: factoryAbi.abi,
        functionName: 'createEdition',
        args: [
          name,
          symbol,
          description,
          editionSize,
          BigInt(0),
          BigInt(LAUNCHPAD_FEE),
          LAUNCHPAD_FEE_RECEIVER,
          MARKETPLACE_FEE_RECEIVER,
        ],
        value: BigInt('500000000000000'),
      };

      const contract = new ethers.Contract(FACTORY_ADDRESS, factoryAbi.abi, provider);
      const gasEstimate = await callWithRetry(() =>
        contract.createEdition.estimateGas(
          name,
          symbol,
          description,
          editionSize,
          BigInt(0),
          BigInt(LAUNCHPAD_FEE),
          LAUNCHPAD_FEE_RECEIVER,
          MARKETPLACE_FEE_RECEIVER,
          { from: address, value: BigInt('500000000000000') }
        )
      ).catch((err) => {
        throw new Error('Gas estimation failed: ' + (err as Error).message);
      });
      const gasWithBuffer = (gasEstimate * BigInt(120)) / BigInt(100);

      let maxFeePerGas: bigint, maxPriorityFeePerGas: bigint;
      try {
        const gasFeeData = await callWithRetry(() => provider.getFeeData());
        maxFeePerGas = gasFeeData.maxFeePerGas
          ? (gasFeeData.maxFeePerGas * BigInt(150)) / BigInt(100)
          : BigInt('50000000000'); // Fallback: 50 Gwei
        maxPriorityFeePerGas = gasFeeData.maxPriorityFeePerGas
          ? (gasFeeData.maxPriorityFeePerGas * BigInt(150)) / BigInt(100)
          : BigInt('2000000000'); // Fallback: 2 Gwei
      } catch (err: unknown) {
        console.error('Failed to fetch gas fee data for createEdition:', err);
        if (publicClient) {
          const gasFeeData = await callWithRetry(() => publicClient.getFeeData());
          maxFeePerGas = gasFeeData.maxFeePerGas
            ? (gasFeeData.maxFeePerGas * BigInt(150)) / BigInt(100)
            : BigInt('50000000000');
          maxPriorityFeePerGas = gasFeeData.maxPriorityFeePerGas
            ? (gasFeeData.maxPriorityFeePerGas * BigInt(150)) / BigInt(100)
            : BigInt('2000000000');
        } else {
          console.warn('Using fallback gas values for createEdition');
          maxFeePerGas = BigInt('50000000000');
          maxPriorityFeePerGas = BigInt('2000000000');
        }
      }

      const createTx = await callWithRetry(() =>
        writeContractAsync({
          ...config,
          gas: gasWithBuffer,
          maxFeePerGas,
          maxPriorityFeePerGas,
        })
      );
      console.log('createEdition txHash:', createTx);
      setTxHash(createTx);
      setStatusMessage('Step 1/2: Creating edition...');
    } catch (error: unknown) {
      console.error('Create edition failed:', error);
      setError('Failed to create edition: ' + ((error as Error).message || 'Unknown error'));
      setIsCreating(false);
      setStatusMessage('');
    }
  };

  const shareToFarcaster = () => {
    if (!editionAddress) return;
    const text = `I minted a unique pixel art NFT on Pixel Edition! 🎨 Check it out: https://your-app.com/token/${editionAddress} #PixelMini`;
    const imageUrl = `https://your-app.com/api/png/${editionAddress}`;
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(imageUrl)}`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!isClient) return <div>Loading...</div>;

  return (
    <div className="px-4">
      <div className="flex items-center justify-center mb-2">
        <h2 className="text-base text-center text-gray-500">Finalize Your Edition</h2>
      </div>
      {!editionAddress ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="BaseBatch"
              className="w-full border border-gray-300 p-2 rounded-sm placeholder-gray-400"
              disabled={isCreating}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Token Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="BBART"
              className="w-full border border-gray-300 p-2 rounded-sm placeholder-gray-400"
              disabled={isCreating}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="This Artwork was made in a shared moment of creation Minted during BayBatches on Base"
              className="w-full border border-gray-300 p-2 rounded-sm h-20 placeholder-gray-400"
              disabled={isCreating}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Edition Size: {editionSize}</label>
            <input
              type="range"
              min="1"
              max="5"
              value={editionSize}
              onChange={(e) => setEditionSize(parseInt(e.target.value))}
              className="w-full"
              disabled={isCreating}
            />
          </div>
          <p className="text-sm text-gray-500">collect fee 0.0004 (earn 50% from primary sale)</p>
          {error && (
            <div className="p-4 bg-red-100 rounded-sm">
              <p className="text-red-700">{error}</p>
            </div>
          )}
          {statusMessage && (
            <div className="p-4 bg-gray-100 rounded-sm flex items-center justify-center">
              <p className="text-gray-700 mr-2">{statusMessage}</p>
              {(statusMessage.includes('Creating') || statusMessage.includes('Setting') || statusMessage.includes('Finalizing')) && (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
              )}
            </div>
          )}
          <div className="space-y-2">
            <button
              onClick={createEdition}
              disabled={isCreating || !name.trim() || !symbol.trim() || !description.trim() || editionSize < 1 || editionSize > 5}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 text-base rounded-none disabled:bg-gray-400 transition-colors"
            >
              Mint (0.0005)
            </button>
            <button
              onClick={() => setPage(2)}
              className="w-full bg-gray-300 hover:bg-gray-400 text-black py-2 text-base rounded-none transition-colors"
              disabled={isCreating}
            >
              <ArrowLeftCircle size={16} className="mr-2 inline" />
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm">Edition created at: {editionAddress}</p>
          {txHash && (
            <p className="text-sm text-green-600">
              Creation Tx:{' '}
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-green-800"
              >
                {txHash.slice(0, 6)}...
              </a>
            </p>
          )}
          {artTxHash && (
            <p className="text-sm text-green-600">
              Artwork Tx:{' '}
              <a
                href={`https://sepolia.basescan.org/tx/${artTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-green-800"
              >
                {artTxHash.slice(0, 6)}...
              </a>
            </p>
          )}
          <div className="flex justify-center">
            <NFTImage
              address={editionAddress}
              tokenId={1}
              onImageLoad={() => console.log("NFT image loaded")}
              alchemyUrl={ALCHEMY_URL}
            />
          </div>
          <button
            onClick={shareToFarcaster}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-sm transition-colors"
          >
            Share to Farcaster
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('selectedColors');
              localStorage.removeItem('bgGlyphs');
              localStorage.removeItem('fgGlyphs');
              localStorage.removeItem('bgColors');
              localStorage.removeItem('fgColors');
              localStorage.removeItem('typoRow');
              localStorage.removeItem('typoRow2');
              localStorage.removeItem('typoCol');
              localStorage.removeItem('typoCols');
              setPage(1);
            }}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-sm transition-colors"
            disabled={isCreating}
          >
            Create Another
          </button>
        </div>
      )}
    </div>
  );
}