"use client";

import { useSocialData } from "@/lib/social/use-social-data";
import { DemographicsData } from "@/lib/social/types";
import { formatDate } from "@/lib/format";
import { SocialPageHeader, NotConnectedPanel } from "@/components/social/shared";
import { CardSkeleton } from "@/components/ui/skeleton";
import { DonutChart } from "@/components/social/DonutChart";

const BAR_AREA_PX = 140;

const GENDER_LABELS: Record<string, string> = { M: "Male", F: "Female", U: "Unknown" };
function genderLabel(key: string) {
  return GENDER_LABELS[key] ?? key;
}

const regionNames = typeof Intl.DisplayNames !== "undefined" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
function countryLabel(key: string) {
  return regionNames?.of(key) ?? key;
}

function AgeBars({ entries }: { entries: { key: string; value: number }[] }) {
  const order = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
  const byKey = new Map(entries.map((e) => [e.key, e.value]));
  const max = Math.max(1, ...entries.map((e) => e.value));
  return (
    <div className="flex gap-3" style={{ height: BAR_AREA_PX + 24 }}>
      {order.map((k) => {
        const v = byKey.get(k) ?? 0;
        return (
          <div key={k} className="flex flex-1 flex-col items-center justify-end gap-1.5">
            <div
              className="w-full rounded-t-md bg-[#6366f1]"
              style={{ height: Math.max(v ? 4 : 0, (v / max) * BAR_AREA_PX) }}
            />
            <span className="text-[10px] text-[var(--text-muted)]">{k}</span>
          </div>
        );
      })}
    </div>
  );
}

function CityTable({ entries }: { entries: { key: string; value: number }[] }) {
  const total = entries.reduce((s, e) => s + e.value, 0);
  const sorted = [...entries].sort((a, b) => b.value - a.value).slice(0, 8);
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="text-xs text-[var(--text-muted)]">
          <th className="pb-2 font-medium">City</th>
          <th className="pb-2 text-right font-medium">Share</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((e) => (
          <tr key={e.key} className="border-t border-[var(--panel2)]">
            <td className="py-2 text-[var(--text)]">{e.key}</td>
            <td className="py-2 text-right text-[var(--text)]">{total ? `${((e.value / total) * 100).toFixed(2)}%` : "0%"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DemographicsSection({ title, breakdowns }: { title: string; breakdowns: DemographicsData["followers"] }) {
  const gender = breakdowns.find((b) => b.breakdown === "gender")?.entries ?? [];
  const age = breakdowns.find((b) => b.breakdown === "age")?.entries ?? [];
  const country = breakdowns.find((b) => b.breakdown === "country")?.entries ?? [];
  const city = breakdowns.find((b) => b.breakdown === "city")?.entries ?? [];

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-[var(--text)]">{title}</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-[var(--panel2)] p-4">
          <p className="mb-3 text-xs font-medium text-[var(--text-muted)]">Gender</p>
          {gender.length ? (
            <DonutChart entries={gender} labelFor={genderLabel} />
          ) : (
            <p className="text-xs text-[var(--text-faint)]">No data</p>
          )}
        </div>
        <div className="rounded-xl bg-[var(--panel2)] p-4">
          <p className="mb-3 text-xs font-medium text-[var(--text-muted)]">Age</p>
          {age.length ? <AgeBars entries={age} /> : <p className="text-xs text-[var(--text-faint)]">No data</p>}
        </div>
        <div className="rounded-xl bg-[var(--panel2)] p-4">
          <p className="mb-3 text-xs font-medium text-[var(--text-muted)]">Followers by country</p>
          {country.length ? (
            <DonutChart entries={country} labelFor={countryLabel} />
          ) : (
            <p className="text-xs text-[var(--text-faint)]">No data</p>
          )}
        </div>
        <div className="rounded-xl bg-[var(--panel2)] p-4">
          <p className="mb-3 text-xs font-medium text-[var(--text-muted)]">Followers by city</p>
          {city.length ? <CityTable entries={city} /> : <p className="text-xs text-[var(--text-faint)]">No data</p>}
        </div>
      </div>
    </div>
  );
}

export default function DemographicsPage() {
  const { data, loading } = useSocialData<DemographicsData>("/api/social/demographics");

  return (
    <div className="mt-8 space-y-5">
      <SocialPageHeader title="Demographics" />

      {loading ? (
        <CardSkeleton className="h-72" />
      ) : !data?.connected ? (
        <NotConnectedPanel
          title="Instagram Analytics isn't connected yet"
          message={data?.error ?? "Missing Supabase credentials."}
          envVars={["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]}
        />
      ) : !data.meetsMinimumFollowers ? (
        <NotConnectedPanel
          title="Not enough followers yet"
          message="The Instagram Graph API only returns demographics once the account has at least 100 followers."
          envVars={["IG_USER_ID", "IG_ACCESS_TOKEN"]}
        />
      ) : !data.snapshotDate ? (
        <NotConnectedPanel
          title="No demographics snapshot yet"
          message="The weekly demographics-snapshot workflow hasn't run yet — check back after its first run."
          envVars={["IG_USER_ID", "IG_ACCESS_TOKEN"]}
        />
      ) : (
        <>
          <p className="text-xs text-[var(--text-faint)]">Snapshot: {formatDate(data.snapshotDate)}</p>
          <DemographicsSection title="Followers" breakdowns={data.followers} />
          {data.engaged.length > 0 && <DemographicsSection title="Engaged audience" breakdowns={data.engaged} />}
        </>
      )}
    </div>
  );
}
