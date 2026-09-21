import LiveGrid from "@/components/LiveGrid";
import { getLiveMonthSummary, getLiveProperties, LIVE_AGENTS } from "@/lib/live-grid";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const [{ properties, liveAds }, summary] = await Promise.all([getLiveProperties(), getLiveMonthSummary()]);
  return <LiveGrid properties={properties} agents={LIVE_AGENTS} summary={summary} liveAds={liveAds} />;
}
