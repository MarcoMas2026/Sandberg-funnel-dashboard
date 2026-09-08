import { CampaignMapEntry, CompetitorMapEntry } from "./types";

// Order sections appear in property-landing-template/index.html's data-fnl-section
// attributes — drives the display order of LandingEngagement.steps.
export const LANDING_SECTION_ORDER = [
  "hero",
  "intro",
  "specs",
  "gallery",
  "features",
  "location",
  "cta",
] as const;

// Maps a Meta Ads campaign to its corresponding Typeform qualifier.
// SINGLE SOURCE OF TRUTH: this is exposed at /api/config and read live by both
// n8n workflows (Typeform Sync + Merge). To add a campaign, append an entry here
// and push — no n8n edits needed. `property` and `ref` drive the on-screen labels.
// `campaign_type` drives which funnel layout is shown (see MarketingFunnel.tsx):
// "property" (named "SP - REF - PROPERTY") shows video views; "community"
// (named "CW - ...") shows post engagement instead, since those run image ads.
export const CAMPAIGN_MAP: CampaignMapEntry[] = [
  {
    meta_campaign_id: "120249096771300071",
    meta_campaign_name: "SP - 6648 - Catalina Duplex",
    typeform_form_id: "pqBjw5Y6",
    typeform_form_name: "Catalina Duplex Qualifier",
    property: "Catalina Duplex",
    ref: "6648",
    campaign_type: "property",
  },
  {
    meta_campaign_id: "120248931370460071",
    meta_campaign_name: "SP - 32785 - Finca Bugambilia",
    typeform_form_id: "d53a9GPD",
    typeform_form_name: "Finca Bugambilia Qualifier",
    property: "Finca Bugambilia",
    ref: "32785",
    campaign_type: "property",
  },
  {
    meta_campaign_id: "120248754551970071",
    meta_campaign_name: "SP - 32606 - CAN VILA",
    typeform_form_id: "BZDwyYhN",
    typeform_form_name: "CAN VILA Qualifier",
    property: "CAN VILA",
    ref: "32606",
    campaign_type: "property",
  },
  {
    meta_campaign_id: "120250284542490071",
    meta_campaign_name: "CW - Anchorage - ENG",
    typeform_form_id: "OEtGQCfj",
    typeform_form_name: "Anchorage Club Waitlist",
    property: "Anchorage Club",
    ref: "Community",
    campaign_type: "community",
    landing_slug: "Anchorage-Club",
  },
  {
    meta_campaign_id: "120251686476280071",
    meta_campaign_name: "SP - 31482 - Es Revellar",
    typeform_form_id: "PlRHbzZk",
    typeform_form_name: "Es Revellar 31482",
    property: "Es Revellar",
    ref: "31482",
    campaign_type: "property",
  },
  {
    meta_campaign_id: "120251685514180071",
    meta_campaign_name: "Sp - 32826 - Penthouse Amber",
    typeform_form_id: "TvdyiUHP",
    typeform_form_name: "Penthouse Amber 32826",
    property: "Penthouse Amber",
    ref: "32826",
    campaign_type: "property",
  },
];

// Tracked list for the Competitor Ad Intelligence module (Meta Ads Library API).
// SINGLE SOURCE OF TRUTH: exposed at /api/config (competitors field) and read
// daily by the "Funnel Dashboard - Ads Library Sync" n8n workflow. `page_id`
// is resolved once via a Graph API lookup on the vanity URL and hardcoded here
// to avoid a page-id lookup call on every daily run — if a page's `page_id` is
// missing, the sync skips it until resolved (see n8n/competitor-ads-sync.md).
export const COMPETITOR_MAP: CompetitorMapEntry[] = [
  // ── Mallorca-local competitors (named Pages) ──────────────────────────────
  {
    key: "engel_voelkers_mallorca",
    label: "Engel & Völkers Mallorca",
    match_type: "page",
    tier: "local",
    page_url: "https://www.facebook.com/engelvoelkersmallorca/",
    page_id: "586140171444065",
  },
  {
    key: "the_agency_mallorca",
    label: "The Agency Mallorca",
    match_type: "page",
    tier: "local",
    page_url: "https://www.facebook.com/theagencymallorca/",
    page_id: "116036664727096",
  },
  {
    key: "spain_sothebys_international_realty",
    label: "Spain Sotheby's International Realty",
    match_type: "page",
    tier: "local",
    page_url: "https://www.facebook.com/spainsothebysinternationalrealty/",
    page_id: "115239555007809",
  },
  {
    key: "kensington_southwest_central",
    label: "Kensington SW Central",
    match_type: "page",
    tier: "local",
    page_url: "https://www.facebook.com/kensington.southwest.central/",
    page_id: "264783986977350",
  },
  {
    key: "john_taylor_palma",
    label: "John Taylor Palma",
    match_type: "page",
    tier: "local",
    page_url: "https://www.facebook.com/johntaylor.palma/",
    page_id: "2097353990554541",
  },
  {
    key: "living_blue_mallorca",
    label: "Living Blue Mallorca",
    match_type: "page",
    tier: "local",
    page_url: "https://www.facebook.com/LivingBlueMallorca/",
    page_id: "462761633796173",
  },
  {
    key: "knight_frank_es",
    label: "Knight Frank ES",
    match_type: "page",
    tier: "local",
    page_url: "https://www.facebook.com/KnightFrankES/",
    page_id: "231287490266727",
  },
  {
    key: "lucas_fox_tarragona",
    label: "Lucas Fox Tarragona",
    match_type: "page",
    tier: "local",
    page_url: "https://www.facebook.com/lucasfoxtarragona/",
    // Two "Lucas Fox International Properties" pages matched by name search;
    // disambiguated 2026-09-07 via ad creative content — this id's ads
    // reference Priorat/Cambrils (Tarragona province); the other
    // (394934604412739) references Alicante, a different office.
    page_id: "1710633615640342",
  },
  // ── Global luxury real-estate brands (keyword search, all countries) ─────
  {
    key: "keyword_sothebys_international_realty",
    label: "Sotheby's International Realty",
    match_type: "keyword",
    tier: "global",
    search_term: "Sotheby's International Realty",
  },
  {
    key: "keyword_christies_international_real_estate",
    label: "Christie's International Real Estate",
    match_type: "keyword",
    tier: "global",
    search_term: "Christie's International Real Estate",
  },
  {
    key: "keyword_douglas_elliman",
    label: "Douglas Elliman",
    match_type: "keyword",
    tier: "global",
    search_term: "Douglas Elliman",
  },
  {
    key: "keyword_compass_real_estate",
    label: "Compass",
    match_type: "keyword",
    tier: "global",
    search_term: "Compass Real Estate",
  },
  {
    key: "keyword_the_agency_real_estate",
    label: "The Agency",
    match_type: "keyword",
    tier: "global",
    search_term: "The Agency Real Estate",
  },
  {
    key: "keyword_coldwell_banker_global_luxury",
    label: "Coldwell Banker Global Luxury",
    match_type: "keyword",
    tier: "global",
    search_term: "Coldwell Banker Global Luxury",
  },
  {
    key: "keyword_knight_frank",
    label: "Knight Frank",
    match_type: "keyword",
    tier: "global",
    search_term: "Knight Frank",
  },
  {
    key: "keyword_savills",
    label: "Savills",
    match_type: "keyword",
    tier: "global",
    search_term: "Savills",
  },
  {
    key: "keyword_emaar_properties",
    label: "Emaar Properties",
    match_type: "keyword",
    tier: "global",
    search_term: "Emaar Properties",
  },
  {
    key: "keyword_damac_properties",
    label: "DAMAC Properties",
    match_type: "keyword",
    tier: "global",
    search_term: "DAMAC Properties",
  },
  {
    key: "keyword_barnes_international_realty",
    label: "Barnes International Realty",
    match_type: "keyword",
    tier: "global",
    search_term: "Barnes International Realty",
  },
  {
    key: "keyword_berkshire_hathaway_homeservices",
    label: "Berkshire Hathaway HomeServices",
    match_type: "keyword",
    tier: "global",
    search_term: "Berkshire Hathaway HomeServices",
  },
  {
    key: "keyword_corcoran_real_estate",
    label: "Corcoran",
    match_type: "keyword",
    tier: "global",
    search_term: "Corcoran Real Estate",
  },
  {
    key: "keyword_luxhabitat_sothebys",
    label: "Luxhabitat Sotheby's",
    match_type: "keyword",
    tier: "global",
    search_term: "Luxhabitat Sotheby's",
  },
];
