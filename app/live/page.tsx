import LiveGrid from "@/components/LiveGrid";
import { getLiveMonthSummary, getLiveProperties, LIVE_AGENTS } from "@/lib/live-grid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live Grid" };

export default async function LivePage() {
  const [{ properties }, summary] = await Promise.all([getLiveProperties(), getLiveMonthSummary()]);
  return <LiveGrid properties={properties} agents={LIVE_AGENTS} summary={summary} fullPage />;
}
