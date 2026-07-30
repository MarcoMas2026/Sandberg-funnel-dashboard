import { SocialRangeProvider } from "@/lib/social/context";

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return <SocialRangeProvider>{children}</SocialRangeProvider>;
}
