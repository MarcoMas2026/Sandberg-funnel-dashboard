import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { DashboardProvider } from "@/lib/dashboard-context";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Sandberg Estates – Funnel Intelligence",
  description: "Marketing funnel dashboard for Sandberg Estates ad campaigns",
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
          <Navbar />
          <main className="mx-auto max-w-[1400px] px-6 pb-16">{children}</main>
        </DashboardProvider>
      </body>
    </html>
  );
}
