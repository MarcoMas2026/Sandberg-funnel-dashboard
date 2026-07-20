import { OkrProvider } from "@/lib/okr-context";

export default function OkrLayout({ children }: { children: React.ReactNode }) {
  return <OkrProvider>{children}</OkrProvider>;
}
