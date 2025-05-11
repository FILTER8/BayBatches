"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { ethers } from "ethers";
import Header from "../components/Header";
import factoryAbi from "../contracts/MintbayEditionFactory.json";
import editionAbi from "../contracts/MintbayEdition.json";
import glyphsData from "../data/glyphsFallbackNew.json";
import { ArrowLeftCircle, ArrowRightCircle } from "@geist-ui/icons";
import NFTImage from "../components/NFTImage";

const FACTORY_ADDRESS = "0x75a8882d081ED5E8a16c487b703381Fcc409470e";
const GLYPH_SET_ADDRESS = "0x7fE14bE3B6b50bc523faC500Dc3F827cd99c2b84";
const LAUNCHPAD_FEE = "400000000000000"; // 0.0004 ETH in wei
const LAUNCHPAD_FEE_RECEIVER = "0x193c97e10aB0e2c0A12884f045145B44D8A551D4";
const MARKETPLACE_FEE_RECEIVER = "0x193c97e10aB0e2c0A12884f045145B44D8A551D4";

const DEFAULT_COLORS = [
  [36, 17, 10],    // #black
  [153, 153, 153], // #grey
  [253, 210, 1],   // #yellow
  [255, 95, 17],   // #orange
  [255, 0, 0],     // #red
  [224, 150, 182], // #pink
  [7, 145, 83],    // #green
  [17, 139, 203],  // #light blue
  [0, 82, 255],    // #base blue
].flat();

const GLYPHS = [
  { id: 0, bitmap: BigInt(0) }, // Erase
  { id: 1, bitmap: BigInt('0xFFFFFFFFFFFFFFFF') }, // Solid block
  ...glyphsData.map(g => ({ id: g.id, bitmap: BigInt(g.bitmap) })) // Start IDs at 2
];
const FIXED_GLYPHS = [GLYPHS[0], GLYPHS[1]]; // Glyphs 0 (erase) and 1 (solid block)
const CYCLING_GLYPHS = GLYPHS.slice(3); // Glyphs 2–79
const GLYPH_BATCH_SIZE = 7; // 7 cycling glyphs per batch
const GLYPH_BATCHES = Array.from(
  { length: Math.ceil(CYCLING_GLYPHS.length / GLYPH_BATCH_SIZE) },
  (_, i) => CYCLING_GLYPHS.slice(i * GLYPH_BATCH_SIZE, (i + 1) * GLYPH_BATCH_SIZE)
).filter(batch => batch.length > 0);

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number) {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default function Create() {
  const { address } = useAccount();
  const [isMounted, setIsMounted] = useState(false);
  const [page, setPage] = useState(1);
  const [backgroundGlyphs, setBackgroundGlyphs] = useState<(number | null)[]>(new Array(81).fill(null));
  const [foregroundGlyphs, setForegroundGlyphs] = useState<(number | null)[]>(new Array(81).fill(null));
  const [backgroundColors, setBackgroundColors] = useState<(number | null)[]>(new Array(81).fill(null));
  const [glyphColors, setGlyphColors] = useState<(number | null)[]>(new Array(81).fill(null));
  const [colors] = useState<number[]>([...DEFAULT_COLORS]);
  const [selectedColorIdx1, setSelectedColorIdx1] = useState<number>(0); // Background
  const [selectedColorIdx2, setSelectedColorIdx2] = useState<number>(1); // Foreground
  const [selectedGlyphId, setSelectedGlyphId] = useState<number>(0); // Start with erase
  const [glyphBatchIndex, setGlyphBatchIndex] = useState<number>(0);
  const [editionSize, setEditionSize] = useState<number>(1);
  const [name, setName] = useState<string>("");
  const [symbol, setSymbol] = useState<string>("");
  const [description, setDescription] = useState<string>("A unique 9x9 pixel artwork created on Warpcast.");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [artTxHash, setArtTxHash] = useState<string | null>(null);
  const [editionAddress, setEditionAddress] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetEditor = useCallback(() => {
    // Initialize arrays
    const newBackgroundGlyphs = new Array(81).fill(1); // Solid background for all cells
    const newForegroundGlyphs = new Array(81).fill(null);
    const newBackgroundColors = new Array(81).fill(null);
    const newGlyphColors = new Array(81).fill(null);

    // Select two distinct random color indices (0–8)
    const colorIdx1 = getRandomInt(0, 8);
    let colorIdx2;
    do {
      colorIdx2 = getRandomInt(0, 8);
    } while (colorIdx2 === colorIdx1);
    setSelectedColorIdx1(colorIdx1);
    setSelectedColorIdx2(colorIdx2);

    // Set glyph 1 as default
    setSelectedGlyphId(1);

    // Fill canvas with one random graphic glyph (1–15)
    const graphicGlyphId = getRandomInt(1, 15);
    for (let i = 0; i < 81; i++) {
      newForegroundGlyphs[i] = graphicGlyphId;
      newBackgroundColors[i] = colorIdx1 + 1;
      newGlyphColors[i] = colorIdx2 + 1;
    }

    // Place a random typo variation (7 glyphs, including 'S') in row 5, cols 2–8 (indices 37–43)
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
    const variationIndex = getRandomInt(0, TYPO_VARIATIONS.length - 1);
    const typoGlyphs = TYPO_VARIATIONS[variationIndex];
    for (let i = 0; i < 7 && i < typoGlyphs.length; i++) {
      const index = 37 + i; // Row 5, cols 2–8 (indices 37–43)
      newForegroundGlyphs[index] = typoGlyphs[i];
      newBackgroundGlyphs[index] = 1;
      newBackgroundColors[index] = colorIdx1 + 1;
      newGlyphColors[index] = colorIdx2 + 1;
    }

    // Set state
    setBackgroundGlyphs(newBackgroundGlyphs);
    setForegroundGlyphs(newForegroundGlyphs);
    setBackgroundColors(newBackgroundColors);
    setGlyphColors(newGlyphColors);

    const randomNum = getRandomInt(1000, 9999);
    setGlyphBatchIndex(0);
    setEditionSize(1);
    setName(`Pixel Art #${randomNum}`);
    setSymbol(`PXL${randomNum}`);
    setDescription("A unique 9x9 pixel artwork created on Warpcast.");
    setPage(1);
    setTxHash(null);
    setArtTxHash(null);
    setEditionAddress(null);
    setIsCreating(false);
    setError(null);
    console.log("resetEditor: initialized", {
      selectedColorIdx1: colorIdx1,
      selectedColorIdx2: colorIdx2,
      selectedGlyphId: 1,
      graphicGlyphId,
      typoVariationIndex: variationIndex,
      backgroundGlyphs: newBackgroundGlyphs,
      foregroundGlyphs: newForegroundGlyphs,
      backgroundColors: newBackgroundColors,
      glyphColors: newGlyphColors
    });
  }, []); // Removed [colors]

  useEffect(() => {
    setIsMounted(true);
    resetEditor();
  }, [resetEditor]);

  if (!isMounted) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen font-sans text-[#111111] bg-[#ffffff]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        <Header />
        <div
          className="w-full h-11 flex items-center justify-center text-white text-sm tracking-[0.1em] mb-3 cursor-pointer"
          style={{ backgroundColor: "#0052ff" }}
          onClick={() => {
            if (page === 1) {
              resetEditor();
            } else {
              setPage(1);
            }
          }}
        >
          {(page === 2 || page === 3) && <ArrowLeftCircle size={16} className="mr-2" />}
          CREATE
        </div>
      </div>
      <main className="w-full max-w-[400px] mx-auto px-4 py-3">
        {page === 1 && (
          <Editor
            backgroundGlyphs={backgroundGlyphs}
            setBackgroundGlyphs={setBackgroundGlyphs}
            foregroundGlyphs={foregroundGlyphs}
            setForegroundGlyphs={setForegroundGlyphs}
            backgroundColors={backgroundColors}
            setBackgroundColors={setBackgroundColors}
            glyphColors={glyphColors}
            setGlyphColors={setGlyphColors}
            colors={colors}
            selectedColorIdx1={selectedColorIdx1}
            setSelectedColorIdx1={setSelectedColorIdx1}
            selectedColorIdx2={selectedColorIdx2}
            setSelectedColorIdx2={setSelectedColorIdx2}
            selectedGlyphId={selectedGlyphId}
            setSelectedGlyphId={setSelectedGlyphId}
            glyphBatchIndex={glyphBatchIndex}
            setGlyphBatchIndex={setGlyphBatchIndex}
            setPage={setPage}
          />
        )}
        {page === 2 && (
          <DeploymentScreen
            name={name}
            setName={setName}
            symbol={symbol}
            setSymbol={setSymbol}
            description={description}
            setDescription={setDescription}
            editionSize={editionSize}
            setEditionSize={setEditionSize}
            backgroundGlyphs={backgroundGlyphs}
            foregroundGlyphs={foregroundGlyphs}
            backgroundColors={backgroundColors}
            glyphColors={glyphColors}
            colors={colors}
            address={address}
            txHash={txHash}
            setTxHash={setTxHash}
            artTxHash={artTxHash}
            setArtTxHash={setArtTxHash}
            editionAddress={editionAddress}
            setEditionAddress={setEditionAddress}
            isCreating={isCreating}
            setIsCreating={setIsCreating}
            error={error}
            setError={setError}
            setPage={setPage}
          />
        )}
        {page === 3 && editionAddress && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-center">Your Creation</h2>
            <NFTImage
              address={editionAddress}
              tokenId={1}
              isReady={!!artTxHash}
            />
            <button
              onClick={() => {
                resetEditor();
                setPage(1);
              }}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 text-base rounded-none transition-colors"
            >
              Create Another
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

interface EditorProps {
  backgroundGlyphs: (number | null)[];
  setBackgroundGlyphs: (glyphs: (number | null)[]) => void;
  foregroundGlyphs: (number | null)[];
  setForegroundGlyphs: (glyphs: (number | null)[]) => void;
  backgroundColors: (number | null)[];
  setBackgroundColors: (colors: (number | null)[]) => void;
  glyphColors: (number | null)[];
  setGlyphColors: (colors: (number | null)[]) => void;
  colors: number[];
  selectedColorIdx1: number;
  setSelectedColorIdx1: (color: number) => void;
  selectedColorIdx2: number;
  setSelectedColorIdx2: (color: number) => void;
  selectedGlyphId: number;
  setSelectedGlyphId: (id: number) => void;
  glyphBatchIndex: number;
  setGlyphBatchIndex: (index: number) => void;
  setPage: (page: number) => void;
}

function Editor({
  backgroundGlyphs,
  setBackgroundGlyphs,
  foregroundGlyphs,
  setForegroundGlyphs,
  backgroundColors,
  setBackgroundColors,
  glyphColors,
  setGlyphColors,
  colors,
  selectedColorIdx1,
  setSelectedColorIdx1,
  selectedColorIdx2,
  setSelectedColorIdx2,
  selectedGlyphId,
  setSelectedGlyphId,
  glyphBatchIndex,
  setGlyphBatchIndex,
  setPage,
}: EditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glyphCanvasRefs = useRef<(HTMLCanvasElement | null)[]>(new Array(9).fill(null));
  const size = 9;
  const scale = 48;
  const glyphSize = 16;
  const isDrawing = useRef(false);

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

  const TYPO_GLYPH_MAP: { [key: number]: { variation: number; position: number } } = {};
  TYPO_VARIATIONS.forEach((variation, variationIndex) => {
    variation.forEach((glyphId, position) => {
      TYPO_GLYPH_MAP[glyphId] = { variation: variationIndex, position };
    });
  });

  const generateGlyphVariation = () => {
    const newFgGlyphs = [...foregroundGlyphs];
    const newBgGlyphs = [...backgroundGlyphs];
    const newBgColors = [...backgroundColors];
    const newFgColors = [...glyphColors];

    // Collect unique graphic glyph IDs (1–15)
    const graphicGlyphIds = new Set(
      foregroundGlyphs
        .filter(g => g !== null && g >= 1 && g <= 15)
        .map(g => g!)
    );

    // Map each graphic glyph ID to a single new random ID
    const graphicGlyphMap: { [key: number]: number } = {};
    graphicGlyphIds.forEach(originalId => {
      let newId: number;
      do {
        newId = getRandomInt(1, 15);
      } while (newId === originalId || graphicGlyphMap[originalId] === newId);
      graphicGlyphMap[originalId] = newId;
    });

    // Pick a random typo variation
    const targetVariationIndex = getRandomInt(0, TYPO_VARIATIONS.length - 1);

    for (let i = 0; i < 81; i++) {
      const fgGlyph = foregroundGlyphs[i];
      const bgGlyph = backgroundGlyphs[i];

      // Skip if cell is empty, erased, or invalid
      if (fgGlyph === null || bgGlyph === null || fgGlyph === 0) {
        continue;
      }

      // Graphic glyphs (1–15): Swap with mapped glyph ID
      if (fgGlyph >= 1 && fgGlyph <= 15) {
        newFgGlyphs[i] = graphicGlyphMap[fgGlyph] || fgGlyph;
        newBgGlyphs[i] = 1; // Ensure background glyph is 1 for non-erase
      }
      // Typo glyphs (16–78): Swap to corresponding glyph in target variation
      else if (fgGlyph >= 16 && fgGlyph <= 78) {
        const glyphInfo = TYPO_GLYPH_MAP[fgGlyph];
        if (glyphInfo) {
          const { position } = glyphInfo;
          newFgGlyphs[i] = TYPO_VARIATIONS[targetVariationIndex][position];
          newBgGlyphs[i] = 1; // Ensure background glyph is 1
        }
      }
    }

    setForegroundGlyphs(newFgGlyphs);
    setBackgroundGlyphs(newBgGlyphs);
    setBackgroundColors(newBgColors);
    setGlyphColors(newFgColors);
    debouncedRedraw();
    console.log("Generated glyph variation:", {
      targetVariationIndex,
      graphicGlyphMap,
      newFgGlyphs,
      newBgGlyphs,
    });
  };

  const generateColorVariation = () => {
    const newBgColors = [...backgroundColors];
    const newFgColors = [...glyphColors];
    const newFgGlyphs = [...foregroundGlyphs];
    const newBgGlyphs = [...backgroundGlyphs];

    // Collect unique color indices (1–9)
    const usedColorIds = new Set(
      [...backgroundColors, ...glyphColors]
        .filter(c => c !== null)
        .map(c => c!)
    );

    // Determine available colors
    const allColorIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const unusedColorIds = allColorIds.filter(id => !usedColorIds.has(id));

    // Create color mapping
    const colorMap: { [key: number]: number } = {};
    if (usedColorIds.size === 9) {
      // Shuffle all colors
      const shuffled = [...allColorIds].sort(() => Math.random() - 0.5);
      Array.from(usedColorIds).forEach((id, i) => {
        colorMap[id] = shuffled[i];
      });
    } else {
      // Select min(used count, unused count) random unused colors
      const count = Math.min(usedColorIds.size, unusedColorIds.length);
      const selectedColors = unusedColorIds
        .sort(() => Math.random() - 0.5)
        .slice(0, count);
      let i = 0;
      usedColorIds.forEach(id => {
        colorMap[id] = selectedColors[i % selectedColors.length];
        i++;
      });
    }

    // Apply color mapping
    for (let i = 0; i < 81; i++) {
      const bgGlyph = backgroundGlyphs[i];
      if (bgGlyph === null) {
        continue;
      }
      if (backgroundColors[i] !== null) {
        newBgColors[i] = colorMap[backgroundColors[i]!] || backgroundColors[i];
      }
      const fgGlyph = foregroundGlyphs[i];
      if (fgGlyph !== null && fgGlyph !== 0 && glyphColors[i] !== null) {
        newFgColors[i] = colorMap[glyphColors[i]!] || glyphColors[i];
      }
    }

    setBackgroundColors(newBgColors);
    setGlyphColors(newFgColors);
    setForegroundGlyphs(newFgGlyphs);
    setBackgroundGlyphs(newBgGlyphs);
    debouncedRedraw();
    console.log("Generated color variation:", {
      colorMap,
      newBgColors,
      newFgColors,
    });
  };

  const redrawCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#D3D3D3";
    ctx.fillRect(0, 0, size * scale, size * scale);

    const pixelSize = scale / 8;
    const offset = (scale - pixelSize * 8) / 2;

    for (let i = 0; i < 81; i++) {
      const x = (i % size) * scale;
      const y = Math.floor(i / size) * scale;

      if (backgroundGlyphs[i] !== null && backgroundColors[i] !== null) {
        const colorStart = (backgroundColors[i]! - 1) * 3;
        const rgb = colors.slice(colorStart, colorStart + 3);
        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        ctx.fillRect(x, y, scale, scale);
      }

      if (foregroundGlyphs[i] !== null && glyphColors[i] !== null) {
        const glyphId = foregroundGlyphs[i]!;
        const colorStart = (glyphColors[i]! - 1) * 3;
        const rgb = colors.slice(colorStart, colorStart + 3);
        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        const glyph = GLYPHS.find(g => g.id === glyphId);
        if (glyph && glyphId > 0) {
          for (let gy = 0; gy < 8; gy++) {
            for (let gx = 0; gx < 8; gx++) {
              if ((glyph.bitmap & (BigInt(1) << BigInt(63 - (gy * 8 + gx)))) !== BigInt(0)) {
                const glyphX = x + offset + gx * pixelSize;
                const glyphY = y + offset + gy * pixelSize;
                ctx.fillRect(glyphX, glyphY, pixelSize, pixelSize);
              }
            }
          }
        }
      }

      ctx.strokeStyle = "#A9A9A9";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, scale, scale);
    }
  }, [backgroundGlyphs, foregroundGlyphs, backgroundColors, glyphColors, colors]);

  const debouncedRedraw = useCallback(() => {
    return debounce(redrawCanvas, 100)();
  }, [redrawCanvas]);

  useEffect(() => {
    debouncedRedraw();
  }, [debouncedRedraw]);

  useEffect(() => {
    const displayedGlyphs = [...FIXED_GLYPHS, ...GLYPH_BATCHES[glyphBatchIndex]].slice(0, 9);
    glyphCanvasRefs.current.forEach((canvas, index) => {
      if (canvas && displayedGlyphs[index]) {
        const ctx = canvas.getContext("2d")!;
        const glyph = displayedGlyphs[index];

        // Clear canvas
        ctx.clearRect(0, 0, glyphSize, glyphSize);

        // Draw background color (using selectedColorIdx1)
        const bgColorIdx = selectedColorIdx1;
        const bgColorStart = bgColorIdx * 3;
        const bgRgb = colors.slice(bgColorStart, bgColorStart + 3);
        ctx.fillStyle = `rgb(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]})`;
        ctx.fillRect(0, 0, glyphSize, glyphSize);

        // Draw glyph with foreground color (using selectedColorIdx2)
        const fgColorIdx = selectedColorIdx2;
        const fgColorStart = fgColorIdx * 3;
        const fgRgb = colors.slice(fgColorStart, fgColorStart + 3);
        ctx.fillStyle = `rgb(${fgRgb[0]}, ${fgRgb[1]}, ${fgRgb[2]})`;

        if (glyph.id === 0) {
          // Erase glyph: draw an X
          ctx.strokeStyle = `rgb(${fgRgb[0]}, ${fgRgb[1]}, ${fgRgb[2]})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(2, 2);
          ctx.lineTo(14, 14);
          ctx.moveTo(14, 2);
          ctx.lineTo(2, 14);
          ctx.stroke();
        } else if (glyph.id === 1) {
          // Solid block: fill entire canvas with foreground color
          ctx.fillRect(0, 0, glyphSize, glyphSize);
        } else {
          // Other glyphs: draw bitmap pixels
          for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
              if ((glyph.bitmap & (BigInt(1) << BigInt(63 - (y * 8 + x)))) !== BigInt(0)) {
                ctx.fillRect(x * 2, y * 2, 2, 2);
              }
            }
          }
        }
      }
    });
    console.log("Rendering glyphs:", displayedGlyphs.map(g => g.id));
    console.log("Glyph refs:", glyphCanvasRefs.current.map(c => c ? 'set' : 'unset'));
  }, [glyphBatchIndex, selectedColorIdx1, selectedColorIdx2, colors]);

  const getCanvasPosition = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = Math.floor((clientX - rect.left) * scaleX / scale);
    const y = Math.floor((clientY - rect.top) * scaleY / scale);
    return { x, y, idx: y * size + x };
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (selectedColorIdx1 >= colors.length / 3) {
      console.warn("draw: Invalid selectedColorIdx1, resetting to 0", { selectedColorIdx1, colorsLength: colors.length });
      setSelectedColorIdx1(0);
      return;
    }
    if (selectedColorIdx2 >= colors.length / 3) {
      console.warn("draw: Invalid selectedColorIdx2, resetting to 0", { selectedColorIdx2, colorsLength: colors.length });
      setSelectedColorIdx2(0);
      return;
    }

    const { idx } = getCanvasPosition(e);
    if (idx < 0 || idx >= 81) {
      console.warn("draw: Invalid canvas index", { idx });
      return;
    }

    const newBgGlyphs = [...backgroundGlyphs];
    const newFgGlyphs = [...foregroundGlyphs];
    const newBgColors = [...backgroundColors];
    const newFgColors = [...glyphColors];

    if (selectedGlyphId === 1) {
      newBgGlyphs[idx] = 1;
      newBgColors[idx] = selectedColorIdx1 + 1;
      newFgGlyphs[idx] = null;
      newFgColors[idx] = null;
    } else if (selectedGlyphId > 1) {
      newBgGlyphs[idx] = 1;
      newBgColors[idx] = selectedColorIdx1 + 1;
      newFgGlyphs[idx] = selectedGlyphId;
      newFgColors[idx] = selectedColorIdx2 + 1;
    } else {
      newBgGlyphs[idx] = null;
      newBgColors[idx] = null;
      newFgGlyphs[idx] = null;
      newFgColors[idx] = null;
    }

    setBackgroundGlyphs(newBgGlyphs);
    setForegroundGlyphs(newFgGlyphs);
    setBackgroundColors(newBgColors);
    setGlyphColors(newFgColors);
    console.log("draw: updated", {
      idx,
      backgroundColors: newBgColors,
      glyphColors: newFgColors,
      foregroundGlyphs: newFgGlyphs,
      selectedColorIdx1,
      selectedColorIdx2,
      selectedGlyphId,
      colors
    });
    debouncedRedraw();
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    draw(e);
  };

const keepDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
  if (isDrawing.current) {
    if ('touches' in e) {
      e.preventDefault();
    }
    draw(e);
  }
};

const stopDrawing = (e: React.TouchEvent<HTMLCanvasElement>) => {
  isDrawing.current = false;
  if (e) {
    e.preventDefault();
  }
};

  const handleDoubleTap = () => {
    if (selectedColorIdx1 < colors.length / 3 && selectedColorIdx2 < colors.length / 3) {
      const temp = selectedColorIdx1;
      setSelectedColorIdx1(selectedColorIdx2);
      setSelectedColorIdx2(temp);
      console.log("handleDoubleTap: swapped colors", { selectedColorIdx1: selectedColorIdx2, selectedColorIdx2: temp });
      debouncedRedraw();
    } else {
      console.warn("handleDoubleTap: Invalid colors for swap", { selectedColorIdx1, selectedColorIdx2, colorsLength: colors.length });
    }
  };

const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
  if (e.touches.length === 2) {
    handleDoubleTap();
    return;
  }
  e.preventDefault();
  startDrawing(e);
};

  return (
    <div className="space-y-4 w-full">
      <canvas
  ref={canvasRef}
  width={size * scale}
  height={size * scale}
  onMouseDown={startDrawing}
  onMouseMove={keepDrawing}
  onMouseUp={stopDrawing}
  onMouseOut={stopDrawing}
  onTouchStart={handleTouchStart}
  onTouchMove={keepDrawing}
  onTouchEnd={stopDrawing}
  onDoubleClick={handleDoubleTap}
  className="border border-gray-100 mb-1 pixelated w-full"
  style={{ aspectRatio: "1 / 1" }}
/>
      <div className="flex flex-wrap justify-center gap-1 w-full">
        {colors.length === 0 ? (
          <p className="text-sm text-gray-500">No colors available</p>
        ) : (
          colors.filter((_, i) => i % 3 === 0).map((_, idx) => {
            const rgb = colors.slice(idx * 3, idx * 3 + 3);
            const isColor1 = idx === selectedColorIdx1;
            const isColor2 = idx === selectedColorIdx2;
            return (
              <div
                key={idx}
                className={`w-8 h-8 border cursor-pointer hover:shadow ${
                  isColor1 ? "border-2 border-green-500" : isColor2 ? "border-2 border-blue-500" : "border-gray-300"
                }`}
                style={{ backgroundColor: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` }}
                onClick={() => {
                  if (isColor1) {
                    setSelectedColorIdx1(0);
                  } else if (isColor2) {
                    setSelectedColorIdx2(0);
                  } else if (selectedColorIdx1 === 0) {
                    setSelectedColorIdx1(idx);
                  } else if (selectedColorIdx2 === 0) {
                    setSelectedColorIdx2(idx);
                  } else {
                    setSelectedColorIdx1(idx);
                  }
                  console.log("Color selected:", {
                    idx,
                    selectedColorIdx1,
                    selectedColorIdx2,
                    rgb,
                  });
                }}
              >
                {(isColor1 || isColor2) && (
                  <span className="absolute bottom-0 left-0 text-xs">
                    {isColor1 ? "" : ""}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="flex items-center justify-center gap-2 w-full">
        <ArrowLeftCircle
          size={24}
          className={`cursor-pointer ${glyphBatchIndex === 0 ? "text-gray-400" : "text-blue-500"}`}
          onClick={() => glyphBatchIndex > 0 && setGlyphBatchIndex(glyphBatchIndex - 1)}
        />
        {[...FIXED_GLYPHS, ...GLYPH_BATCHES[glyphBatchIndex]].slice(0, 9).map((glyph, index) => (
          <div
            key={glyph.id}
            className="flex-1 max-w-[32px] cursor-pointer"
            onClick={() => {
              setSelectedGlyphId(glyph.id);
              console.log("Glyph selected:", { glyphId: glyph.id, selectedGlyphId: glyph.id });
            }}
          >
<canvas
  ref={(el) => {
    glyphCanvasRefs.current[index] = el;
  }}
  width={glyphSize}
  height={glyphSize}
  className={`w-full h-full border ${
    selectedGlyphId === glyph.id ? "border-blue-500 border-2" : "border-gray-300"
  } hover:border-blue-300`}
/>
          </div>
        ))}
        <ArrowRightCircle
          size={24}
          className={`cursor-pointer ${
            glyphBatchIndex === GLYPH_BATCHES.length - 1 ? "text-gray-400" : "text-blue-500"
          }`}
          onClick={() => glyphBatchIndex < GLYPH_BATCHES.length - 1 && setGlyphBatchIndex(glyphBatchIndex + 1)}
        />
      </div>
      <div className="flex gap-2 w-full">
        <button
          onClick={generateGlyphVariation}
          disabled={!backgroundGlyphs.some(g => g !== null)}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 text-base rounded-none disabled:bg-gray-400 transition-colors"
        >
          Glyph
        </button>
        <button
          onClick={generateColorVariation}
          disabled={!backgroundGlyphs.some(g => g !== null)}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 text-base rounded-none disabled:bg-gray-400 transition-colors"
        >
          Color
        </button>
      </div>
      <button
        onClick={() => setPage(2)}
        disabled={
          !backgroundGlyphs.some(g => g !== null) ||
          backgroundColors.some(c => c !== null && c > colors.length / 3) ||
          glyphColors.some(c => c !== null && c > colors.length / 3)
        }
        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 text-base rounded-none disabled:bg-gray-400 transition-colors"
      >
        Create
      </button>
    </div>
  );
}

interface DeploymentScreenProps {
  name: string;
  setName: (name: string) => void;
  symbol: string;
  setSymbol: (symbol: string) => void;
  description: string;
  setDescription: (description: string) => void;
  editionSize: number;
  setEditionSize: (size: number) => void;
  backgroundGlyphs: (number | null)[];
  foregroundGlyphs: (number | null)[];
  backgroundColors: (number | null)[];
  glyphColors: (number | null)[];
  colors: number[];
  address: string | undefined;
  txHash: string | null;
  setTxHash: (hash: string | null) => void;
  artTxHash: string | null;
  setArtTxHash: (hash: string | null) => void;
  editionAddress: string | null;
  setEditionAddress: (address: string | null) => void;
  isCreating: boolean;
  setIsCreating: (creating: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  setPage: (page: number) => void;
}

function DeploymentScreen({
  name,
  setName,
  symbol,
  setSymbol,
  description,
  setDescription,
  editionSize,
  setEditionSize,
  backgroundGlyphs,
  foregroundGlyphs,
  backgroundColors,
  glyphColors,
  colors,
  address,
  txHash,
  setTxHash,
  artTxHash,
  setArtTxHash,
  editionAddress,
  setEditionAddress,
  isCreating,
  setIsCreating,
  error,
  setError,
  setPage,
}: DeploymentScreenProps) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { data: receipt } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}`,
    chainId: baseSepolia.id,
  });
  const { data: artReceipt } = useWaitForTransactionReceipt({
    hash: artTxHash as `0x${string}`,
    chainId: baseSepolia.id,
  });

  const createEdition = async () => {
    if (isCreating || !canMint() || !publicClient) return;
    if (!address) {
      setError("Please connect your wallet to deploy the artwork.");
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error("Name is required");
      if (!symbol.trim()) throw new Error("Symbol is required");
      if (!description.trim()) throw new Error("Description is required");
      const editionSizeNum = editionSize;
      if (editionSizeNum < 1) throw new Error("Invalid edition size");

      console.log("createEdition inputs:", { name, symbol, description, editionSizeNum });

      const gasEstimate = await publicClient.estimateContractGas({
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: factoryAbi.abi,
        functionName: "createEdition",
        args: [
          name,
          symbol,
          description,
          editionSizeNum,
          BigInt(0),
          BigInt(LAUNCHPAD_FEE),
          LAUNCHPAD_FEE_RECEIVER,
          MARKETPLACE_FEE_RECEIVER,
        ],
        account: address as `0x${string}`,
      }).catch(err => {
        throw new Error(`Gas estimation failed for createEdition: ${err.message}`);
      });
      const gasWithBuffer = (gasEstimate * BigInt(200)) / BigInt(100);
      console.log(`createEdition gas estimate: ${gasEstimate}, buffered: ${gasWithBuffer}`);

      const config = {
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: factoryAbi.abi,
        functionName: "createEdition",
        args: [
          name,
          symbol,
          description,
          editionSizeNum,
          BigInt(0),
          BigInt(LAUNCHPAD_FEE),
          LAUNCHPAD_FEE_RECEIVER,
          MARKETPLACE_FEE_RECEIVER,
        ],
        gas: gasWithBuffer,
      };
      const createTx = await writeContractAsync(config);
      setTxHash(createTx);
    } catch (err: unknown) {
      console.error("createEdition error:", err);
      setError(`Failed to create edition: ${(err as Error).message || "Unknown error"}`);
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (receipt && !editionAddress && txHash) {
const editionCreatedLog = receipt.logs.find(
  log =>
    log.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase() &&
    log.topics[0] === ethers.id("EditionCreated(address,address)")
);
if (!editionCreatedLog || !editionCreatedLog.topics[2]) {
  setError("Failed to find edition address");
  setIsCreating(false);
  return;
}
const newEdition = "0x" + editionCreatedLog.topics[2].slice(-40);
setEditionAddress(newEdition);

      const setBaseArt = async () => {
        try {
          const bgGlyphs = backgroundGlyphs.map(g => g || 0);
          const fgGlyphs = foregroundGlyphs.map(g => g || 0);
          const bgColors = backgroundColors.map(c => c || 0);
          const fgColors = glyphColors.map(c => c || 0);

          // Validate glyphs
          const validGlyphIds = new Set(GLYPHS.map(g => g.id));
          for (let i = 0; i < 81; i++) {
            if (bgGlyphs[i] !== 0 && bgGlyphs[i] !== 1) {
              throw new Error(`Invalid background glyph ID at index ${i}: ${bgGlyphs[i]}`);
            }
            if (fgGlyphs[i] !== 0 && !validGlyphIds.has(fgGlyphs[i])) {
              throw new Error(`Invalid foreground glyph ID at index ${i}: ${fgGlyphs[i]}`);
            }
            if (fgGlyphs[i] > 126) {
              throw new Error(`Foreground glyph ID exceeds 126 at index ${i}: ${fgGlyphs[i]}`);
            }
          }

          // Collect used color indices
          const usedColorIndices = new Set<number>([...bgColors, ...fgColors].filter(c => c > 0));
          if (usedColorIndices.size === 0) {
            setError("Cannot deploy: no colors used on canvas.");
            setIsCreating(false);
            return;
          }

          // No inherited colors in page.tsx
          const inheritedCount = 0;
          const inheritedColors: number[] = [];
          const usedNewColors: number[] = [];
          const newColorMap: { [oldIdx: number]: number } = {};

          // Remap colors
          for (let i = 0; i < colors.length; i += 3) {
            const oldColorIdx = inheritedCount + Math.floor(i / 3) + 1;
            if (usedColorIndices.has(oldColorIdx)) {
              const newColorIdx = Math.floor(usedNewColors.length / 3) + 1;
              newColorMap[oldColorIdx] = newColorIdx;
              usedNewColors.push(...colors.slice(i, i + 3));
            }
          }

          // Ensure colors are valid for rendering
          const finalPalette = [...inheritedColors, ...usedNewColors];
          const remappedBgColors = bgColors.map(c => c > 0 && newColorMap[c] ? newColorMap[c] : c);
          const remappedFgColors = fgColors.map(c => c > 0 && newColorMap[c] ? newColorMap[c] : c);

          // Validate color indices
          const maxColorIdx = Math.floor(finalPalette.length / 3);
          for (let i = 0; i < 81; i++) {
            if (remappedBgColors[i] > maxColorIdx) {
              throw new Error(`Invalid background color index at ${i}: ${remappedBgColors[i]} (max ${maxColorIdx})`);
            }
            if (remappedFgColors[i] > maxColorIdx) {
              throw new Error(`Invalid foreground color index at ${i}: ${remappedFgColors[i]} (max ${maxColorIdx})`);
            }
          }

          console.log("setBaseArt DEBUG", {
            bgGlyphs,
            fgGlyphs,
            bgColors,
            fgColors,
            usedColorIndices: Array.from(usedColorIndices),
            newColorMap,
            usedNewColors,
            remappedBgColors,
            remappedFgColors,
            maxBgColor: Math.max(...remappedBgColors),
            maxFgColor: Math.max(...remappedFgColors),
            finalPalette,
          });

          const config = {
            address: newEdition as `0x${string}`,
            abi: editionAbi.abi,
            functionName: "setBaseArt",
            args: [
              bgGlyphs,
              fgGlyphs,
              remappedBgColors,
              remappedFgColors,
              usedNewColors,
              true,
              ethers.ZeroAddress,
              ethers.ZeroAddress,
              true,
              0,
              GLYPH_SET_ADDRESS,
            ],
            gas: BigInt(3200000), // Fixed gas limit to cover complex inputs
          };
          const artTx = await writeContractAsync(config);
          console.log("Set base art transaction:", artTx);
          setArtTxHash(artTx);
} catch (error) {
  console.error("Set base art failed:", error);
  const errorMessage = error instanceof Error ? error.message : String(error);
  setError("Failed to set base art: " + (errorMessage || "Unknown error"));
  setIsCreating(false);
}
      };

      setBaseArt();
    }
  }, [receipt, txHash, writeContractAsync, publicClient, backgroundGlyphs, foregroundGlyphs, backgroundColors, glyphColors, colors, address, setEditionAddress, setArtTxHash, setError, setIsCreating]);

  useEffect(() => {
    if (artReceipt && editionAddress) {
      setPage(3);
    }
  }, [artReceipt, editionAddress, setPage]);

  const canMint = () => {
    const usedColorIndices = new Set<number>(
      backgroundColors.concat(glyphColors).filter(c => c !== null).map(c => c!)
    );
    return (
      backgroundGlyphs.some(g => g !== null) &&
      colors.length > 0 &&
      name.trim() !== "" &&
      symbol.trim() !== "" &&
      description.trim() !== "" &&
      editionSize >= 1 &&
      !backgroundColors.some(c => c !== null && c > colors.length / 3) &&
      !glyphColors.some(c => c !== null && c > colors.length / 3) &&
      (usedColorIndices.size === 0 || Array.from(usedColorIndices).every(c => c <= colors.length / 3))
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold mb-1">Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Pixel Art #1234"
          className="w-full border border-gray-300 p-2 placeholder-gray-400"
        />
      </div>
      <div>
        <label className="block text-sm font-bold mb-1">Token Symbol</label>
        <input
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
          placeholder="e.g. PXL1234"
          className="w-full border border-gray-300 p-2 placeholder-gray-400"
        />
      </div>
      <div>
        <label className="block text-sm font-bold mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe your artwork"
          className="w-full border border-gray-300 p-2 h-20 placeholder-gray-400"
        />
      </div>
      <div>
        <label className="block text-sm font-bold mb-1">Edition Size (1-5)</label>
        <input
          type="range"
          min="1"
          max="5"
          value={editionSize}
          onChange={e => setEditionSize(parseInt(e.target.value))}
          className="w-full"
        />
        <p className="text-sm text-center">{editionSize}</p>
      </div>
      <p className="text-sm text-gray-500">Free mint (0.0004 ETH platform fee)</p>
      <button
        onClick={createEdition}
        disabled={isCreating || !canMint()}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 text-base rounded-none disabled:bg-gray-400 transition-colors"
      >
        {isCreating ? "Deploying..." : "Deploy"}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {editionAddress && <p className="text-sm">Edition at: {editionAddress}</p>}
    </div>
  );
}