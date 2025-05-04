import Header from "../components/Header";
import { PageContent } from "../components/PageContent";
import { Suspense } from "react";

export default function Leaderboard() {
  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        {/* Header (Fixed, not animated) */}
        <Header />

        {/* Title Bar and Content */}
        <Suspense
          fallback={
            <div
              className="w-full h-11 flex items-center justify-center text-white text-sm tracking-[0.1em] mb-3"
              style={{ backgroundColor: "#ff5f11" }}
            >
              LEADERBOARD
            </div>
          }
        >
          <PageContent pageName="LEADERBOARD" />
        </Suspense>
      </div>
    </div>
  );
}