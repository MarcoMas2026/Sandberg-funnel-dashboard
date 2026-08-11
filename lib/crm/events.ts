// Single source of truth for the CRM's lead-outcome event set (see CONTEXT.md
// / the CRM data-exchange brief). Everything else that needs this list —
// db/migrations/006's seed data, lib/crm/db.ts's validation, the /outcomes UI —
// derives from this array rather than re-declaring it.
//
// `liveAsOfSeed` reflects what the CRM confirmed was ALREADY emitting on
// 2026-08-11, the day this integration was built — seeded into
// crm_event_types.live_as_of at migration time. The other 8 types start with
// live_as_of = NULL and get stamped the first time a pull actually observes
// one, via lib/crm/db.ts's markEventTypesObserved. This is what lets the UI
// tell "no events of this type yet" (live_as_of set, zero rows) apart from
// "the CRM hasn't wired this one up yet" (live_as_of still null) — see
// CONTEXT.md's warning not to infer coverage from silence.
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
  { event: "OfferAccepted", track: "buyer", description: "The offer was accepted", liveAsOfSeed: false },
  {
    event: "ReservationSigned",
    track: "buyer",
    description: "Arras signed — deposit paid, property off the market",
    liveAsOfSeed: false,
  },
  { event: "DealClosed", track: "buyer", description: "Completed at the notary", liveAsOfSeed: false },

  // Seller journey
  { event: "QualifiedSellerLead", track: "seller", description: "A real prospective seller", liveAsOfSeed: false },
  { event: "ValuationBooked", track: "seller", description: "A valuation appointment was set", liveAsOfSeed: false },
  { event: "PriceAgreementReached", track: "seller", description: "Owner and agency agreed an asking price", liveAsOfSeed: false },
  { event: "ListingAgreementSigned", track: "seller", description: "The mandate was signed", liveAsOfSeed: false },

  // Property track
  { event: "ListingActivated", track: "property", description: "The property went live on the market", liveAsOfSeed: true },
  { event: "ListingSold", track: "property", description: "It sold", liveAsOfSeed: true },

  // Reserved — definition still being resolved on the CRM side
  { event: "QualifiedLead", track: "reserved", description: "Reserved — definition not yet finalized by the CRM", liveAsOfSeed: false },
];

export const CRM_EVENT_NAMES = CRM_EVENT_TYPES.map((e) => e.event);

// Arras (ReservationSigned) is the meaningful "campaign won" moment in Spain —
// money changes hands and the property leaves the market — not DealClosed
// (notary date, can trail months behind). See CONTEXT.md for the full reasoning.
export const PRIMARY_WIN_EVENT = "ReservationSigned";
