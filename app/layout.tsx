import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import MobileTopNav from "@/components/MobileTopNav";
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
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>
        <DashboardProvider>
          <MobileTopNav />
          <div className="shell-grid flex min-h-screen gap-3 p-3">
            <Sidebar />
            <div className="min-w-0 flex-1">
              <main className="mx-auto max-w-[1440px] px-2 py-1 pt-20 md:pt-1 lg:px-5">
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
