// Single source of truth for the CRM's lead-outcome event set (see CONTEXT.md
// / the CRM data-exchange brief). Everything else that needs this list —
// db/migrations/006's seed data, lib/crm/db.ts's validation, the /outcomes UI —
// derives from this array rather than re-declaring it.
//
// `liveAsOfSeed` reflects what the CRM confirmed was actually wired/emitting
// as of 2026-08-11. Corrected same day: the original brief said 7 types were
// live; Daniel (CRM) followed up to say that was a miscount on their side —
// it's actually 14 of 15 (everything except QualifiedLead, permanently
// reserved, see below). `crm_event_types.live_as_of` in Supabase was updated
// to match this correction directly, rather than waiting for the pull
// workflow to empirically observe a row of each type — several of these 14
// currently produce ZERO rows because of an attribution gap on the CRM's
// side (as of 2026-08-11: 1 of 963 seller leads and 0 of 443 offers are
// linked to a campaign), not because the event isn't wired. Per Daniel's
// explicit request: a zero count on ViewingBooked/OfferAccepted/
// ReservationSigned/etc. today reflects that gap, NOT a campaign verdict —
// don't let `/outcomes` (or anyone reading it) infer "this campaign produces
// no buyers" from it. This is the live_as_of-vs-observed-count distinction
// CONTEXT.md's "don't infer coverage from silence" warning was written for.
export type CrmTrack = "buyer" | "seller" | "property" | "reserved";

export interface CrmEventDef {
  event: string;
  track: CrmTrack;
  description: string;
  liveAsOfSeed: boolean;
}

export const CRM_EVENT_TYPES: CrmEventDef[] = [
  // Buyer journey
  { event: "LeadCreated", track: "buyer", description: "The enquiry became a lead", liveAsOfSeed: true },
  { event: "QualifiedBuyerLead", track: "buyer", description: "An agent qualified them as a real buyer", liveAsOfSeed: true },
  { event: "ViewingBooked", track: "buyer", description: "A viewing was scheduled", liveAsOfSeed: true },
  { event: "ViewingCompleted", track: "buyer", description: "The viewing actually happened", liveAsOfSeed: true },
  { event: "OfferStarted", track: "buyer", description: "They made an offer", liveAsOfSeed: true },
  { event: "OfferAccepted", track: "buyer", description: "The offer was accepted", liveAsOfSeed: true },
  {
    event: "ReservationSigned",
    track: "buyer",
    description: "Arras signed — deposit paid, property off the market",
    liveAsOfSeed: true,
  },
  { event: "DealClosed", track: "buyer", description: "Completed at the notary", liveAsOfSeed: true },

  // Seller journey
  { event: "QualifiedSellerLead", track: "seller", description: "A real prospective seller", liveAsOfSeed: true },
  { event: "ValuationBooked", track: "seller", description: "A valuation appointment was set", liveAsOfSeed: true },
  { event: "PriceAgreementReached", track: "seller", description: "Owner and agency agreed an asking price", liveAsOfSeed: true },
  { event: "ListingAgreementSigned", track: "seller", description: "The mandate was signed", liveAsOfSeed: true },

  // Property track
  { event: "ListingActivated", track: "property", description: "The property went live on the market", liveAsOfSeed: true },
  { event: "ListingSold", track: "property", description: "It sold", liveAsOfSeed: true },

  // Reserved — PERMANENTLY dormant by design, not "not built yet". Confirmed
  // 2026-08-11: QualifiedLead is a platform-neutral alias of
  // QualifiedBuyerLead/QualifiedSellerLead, not a distinct outcome — the CRM
  // deliberately never fires it (firing both would double-count one
  // qualification under two names). Expect this to read "not live yet" in
  // /outcomes forever; that's correct, not a gap to chase.
  { event: "QualifiedLead", track: "reserved", description: "Alias of QualifiedBuyerLead/QualifiedSellerLead — deliberately never emitted, not a distinct outcome", liveAsOfSeed: false },
];

export const CRM_EVENT_NAMES = CRM_EVENT_TYPES.map((e) => e.event);

// Arras (ReservationSigned) is the meaningful "campaign won" moment in Spain —
// money changes hands and the property leaves the market — not DealClosed
// (notary date, can trail months behind). See CONTEXT.md for the full reasoning.
export const PRIMARY_WIN_EVENT = "ReservationSigned";
