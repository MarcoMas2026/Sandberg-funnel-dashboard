import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import CommandPalette from "@/components/CommandPalette";
import { DashboardProvider } from "@/lib/dashboard-context";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Sandberg Estates – Funnel Intelligence",
  description: "AI-fueled paid-performance operating system for Sandberg Estates",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defaults to dark to preserve the app's existing look for anyone who
  // hasn't toggled the theme yet — AnimatedThemeToggler (components/ui)
  // flips this class; light-mode CSS vars live in app/globals.css.
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans`}>
        <DashboardProvider>
          <div className="shell-grid flex min-h-screen">
            <Sidebar />
            <div className="min-w-0 flex-1">
              <main className="mx-auto max-w-[1440px] px-5 py-6 lg:px-8">
                <Topbar />
                {children}
              </main>
            </div>
          </div>
          <CommandPalette />
        </DashboardProvider>
      </body>
    </html>
  );
}
