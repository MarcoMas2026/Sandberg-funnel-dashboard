// Maps a thank-you-<slug> URL slug to the agent's full display name from AGENT_ROSTER.
// Hand-mapped (not derived from the slug string) because slugs use only a first name or
// two, while AGENT_ROSTER has full legal names — e.g. "sara" -> "Sara Michelle Fenwick".
export const THANK_YOU_AGENT_NAMES: Record<string, string> = {
  "thank-you-angus": "Angus Campbell",
  "thank-you-anne-sophie": "Anne-Sophie Kayrak",
  "thank-you-cecilia": "Cecilia Schwalbach",
  "thank-you-christopher": "Christopher Calvin Klatt",
  "thank-you-daniel": "Daniel Ballmann",
  "thank-you-lauren": "Lauren Payet",
  "thank-you-michael": "Michael Schwalbach",
  "thank-you-natalie": "Natalie Crossley",
  "thank-you-nathan": "Nathan Dilks",
  "thank-you-rebuar": "Rebuar Georg Wentz",
  "thank-you-sabine": "Sabine Kersten",
  "thank-you-sara": "Sara Michelle Fenwick",
  "thank-you-tim": "Tim Schemann",
};
