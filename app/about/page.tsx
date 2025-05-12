'use client';

import { Suspense, useEffect, useRef } from 'react';
import Header from '../components/Header';
import { TitleBar, PageFooter } from '../components/PageContent';
import glyphsData from "../data/glyphsFallbackNew.json";

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

export default function About() {
  // Glyph separator: 9 glyphs with background (solid block) and foreground glyph
const GlyphSeparator = ({ glyphId, fgColorIndices, bgColorIndices }: {
  glyphId: number;
  fgColorIndices: [number, number, number];
  bgColorIndices: [number, number, number];
}) => {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>(Array(9).fill(null));
  const glyph = glyphsData.find(g => g.id === glyphId);
  const bitmap = glyph ? BigInt(glyph.bitmap) : BigInt(0);

  useEffect(() => {
    canvasRefs.current.forEach((canvas) => {
      if (canvas) {
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, 16, 16);

        // Draw background glyph (solid block, ID 1)
        ctx.fillStyle = `rgb(${DEFAULT_COLORS[bgColorIndices[0]]}, ${DEFAULT_COLORS[bgColorIndices[1]]}, ${DEFAULT_COLORS[bgColorIndices[2]]})`;
        ctx.fillRect(0, 0, 16, 16);

        // Draw foreground glyph
        ctx.fillStyle = `rgb(${DEFAULT_COLORS[fgColorIndices[0]]}, ${DEFAULT_COLORS[fgColorIndices[1]]}, ${DEFAULT_COLORS[fgColorIndices[2]]})`;
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            if ((bitmap & (BigInt(1) << BigInt(63 - (y * 8 + x)))) !== BigInt(0)) {
              ctx.fillRect(x * 2, y * 2, 2, 2);
            }
          }
        }
      }
    });
  }, [glyphId, fgColorIndices, bgColorIndices, bitmap]);

  return (
    <div className="flex justify-center my-4">
      {Array(9).fill(0).map((_, i) => (
        <canvas
          key={i}
          ref={(el) => {
            canvasRefs.current[i] = el; // No return value
          }}
          width={16}
          height={16}
          className="w-4 h-4"
        />
      ))}
    </div>
  );
};

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        <Header />
        <Suspense
          fallback={
            <div
              className="w-full h-11 flex items-center justify-center text-white text-sm tracking-[0.1em] mb-3"
              style={{ backgroundColor: '#079153' }}
            >
              ABOUT
            </div>
          }
        >
          <TitleBar pageName="ABOUT" />
          <div className="mt-2 space-y-8">
            <div>
              <h2 className="text-lg font-bold mb-2">👋 Welcome to BayBatches</h2>
              <p className="text-sm text-gray-700">
                BayBatches is your canvas to create and collect on-chain pixel art. Built with the Base community, for the Base community. Part of the <span className="font-bold">BaseBatches buildathon</span>, this MiniApp invites you to collaborate where creativity meets code. With just 9 signature colors, 14 graphic glyphs, and 9 typographic styles, every artwork becomes a shared expression. <span className="font-bold">Created on Base. Shaped by many. Stored forever on-chain.</span>
              </p>
            </div>
            <GlyphSeparator
              glyphId={16} // Typo glyph, likely 'B'
              fgColorIndices={[12, 13, 14]} // Red
              bgColorIndices={[6, 7, 8]} // Yellow
            />
            <div className="mt-4">
              <h2 className="text-lg font-bold mb-2">🎨 Create</h2>
              <p className="text-sm text-gray-700">
                Draw on a 9x9 canvas. Use the <span className="font-bold">Randomize</span> button to shuffle glyphs and colors. <span className="font-bold">Double tap</span> to toggle background and glyph color. Deploying is a simple 2-step flow:
              </p>
              <ul className="list-decimal list-inside text-sm text-gray-700 mt-2">
                <li><span className="font-bold">Create contract</span></li>
                <li><span className="font-bold">Sign + Mint (0.0004 ETH)</span></li>
              </ul>
              <p className="text-sm text-gray-700 mt-2">
                You can mint <span className="font-bold">1–5 editions</span> of your artwork. Each mint costs <span className="font-bold">0.0004 ETH</span>. Creators earn <span className="font-bold">50%</span> from each mint, the rest supports the platform. Every artwork is stored fully on-chain, forever on <span className="font-bold">Base</span>.
              </p>
            </div>
            <GlyphSeparator
              glyphId={31} // Graphic glyph
              fgColorIndices={[18, 19, 20]} // Green
              bgColorIndices={[9, 10, 11]} // Orange
            />
            <div className="mt-4">
              <h2 className="text-lg font-bold mb-2">🖼️ Collect</h2>
              <p className="text-sm text-gray-700">
                Explore the <span className="font-bold">Gallery</span> and discover pixel art from creators across the world. Every piece is an on-chain edition minted on Base. Tap into each one to start collecting. Mint directly for <span className="font-bold">0.0004 ETH (primary mint)</span>, or trade later on <a href="https://mintbay.co/" className="text-blue-600 underline">mintbay.co</a>. Whether you’re a first-time collector or pixel art fanatic, each piece is a forever token of this shared movement.
              </p>
            </div>
            <GlyphSeparator
              glyphId={57} // Typo glyph, likely 'S'
              fgColorIndices={[0, 1, 2]} // Black
              bgColorIndices={[15, 16, 17]} // Pink
            />
            <div className="mt-4">
              <h2 className="text-lg font-bold mb-2">🏆 Leaderboard</h2>
              <p className="text-sm text-gray-700">
                Celebrate the top creators and collectors of BayBatches. Climb the ranks by minting, creating, and owning unique pieces, all on Base.
              </p>
   <GlyphSeparator
  glyphId={21} // Typo glyph, likely 'E'
  fgColorIndices={[24, 25, 26]} // Base blue
  bgColorIndices={[3, 4, 5]} // Grey
/>
            </div>
            <div className="mt-4">
              <h2 className="text-lg font-bold mb-2">Built with AI. Powered by Base.</h2>
              <p className="text-sm text-gray-700">
                Welcome to Mintbay. Where code meets Art. <span className="font-bold">Mint it. Collect it. Own it. Forever.</span>
              </p>
            </div>
          </div>
          <PageFooter pageName="ABOUT" />
        </Suspense>
      </div>
    </div>
  );
}