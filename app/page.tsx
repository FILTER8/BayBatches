"use client";

import { useMiniKit, useOpenUrl } from "@coinbase/onchainkit/minikit";
import { useEffect, useState } from "react";
import { Button, Home } from "./components/DemoComponents";
import { useRouter } from "next/navigation";
import Header from "./components/Header";
import { motion } from "framer-motion";
import { Twitter } from "@geist-ui/icons";

export default function App() {
  const { setFrameReady, isFrameReady } = useMiniKit();
  const router = useRouter();
  const openUrl = useOpenUrl();

  // Colors for the bars
  const colors = [
    "#999999",
    "#079153",
    "#fdd201",
    "#e096b6",
    "#118bcb",
    "#0052ff",
    "#ff5f11",
    "#ff0000",
    "#24110a",
  ];

  // Persist colors in localStorage
  const [barColors] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const savedColors = localStorage.getItem("barColors");
      if (savedColors) {
        return JSON.parse(savedColors);
      }
    }
    const shuffled = [...colors].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 3);
    if (typeof window !== "undefined") {
      localStorage.setItem("barColors", JSON.stringify(selected));
    }
    return selected;
  });

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  // Animation variants for navigation bars
  const barVariants = {
    initial: { y: 0 },
    animate: { y: -50, transition: { duration: 0.5, ease: "easeInOut" } },
  };

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        {/* Header (Fixed, not animated) */}
        <Header />

        {/* Navigation Bars */}
        <nav className="mb-4 flex-1 flex flex-col">
          <motion.div
            variants={barVariants}
            initial="initial"
            whileTap="animate"
            className="w-full h-[calc((100vh-104px)/3)] min-h-[80px] max-h-[200px] flex items-center justify-center text-white text-sm cursor-pointer tracking-[0.1em] transition-all hover:opacity-80"
            style={{ backgroundColor: barColors[0] }}
            onClick={() => router.push("/create")}
          >
            CREATE
          </motion.div>
          <motion.div
            variants={barVariants}
            initial="initial"
            whileTap="animate"
            className="w-full h-[calc((100vh-104px)/3)] min-h-[80px] max-h-[200px] flex items-center justify-center text-white text-sm cursor-pointer tracking-[0.1em] transition-all hover:opacity-80"
            style={{ backgroundColor: barColors[1] }}
            onClick={() => router.push("/gallery")}
          >
            GALLERY
          </motion.div>
          <motion.div
            variants={barVariants}
            initial="initial"
            whileTap="animate"
            className="w-full h-[calc((100vh-104px)/3)] min-h-[80px] max-h-[200px] flex items-center justify-center text-white text-sm cursor-pointer tracking-[0.1em] transition-all hover:opacity-80"
            style={{ backgroundColor: barColors[2] }}
            onClick={() => router.push("/leaderboard")}
          >
            LEADERBOARD
          </motion.div>
        </nav>

        {/* Main Content */}
        <main className="flex-1">
          <Home />
        </main>

        {/* Footer with stacked links */}
        <footer className="mt-2 pt-4 flex flex-col items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--ock-text-foreground-muted)] text-xs"
            onClick={() => openUrl("https://www.mintbay.co/")}
          >
            [visit mintbay]
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--ock-text-foreground-muted)] text-xs"
            onClick={() => openUrl("https://x.com/mintbay_co")}
            icon={<Twitter className="w-4 h-4" />}
          />
        </footer>
      </div>
    </div>
  );
}