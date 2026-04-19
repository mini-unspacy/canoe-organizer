// Pool of Hawaiian names used to christen new canoes. These are ocean- and
// voyaging-themed words that fit the Lokahi outrigger-canoe-club vibe.
// Used when a new canoe is added from the Fleet UI — we pick one that isn't
// already taken by an existing canoe, falling back to "Canoe N" if the pool
// is exhausted.

export const HAWAIIAN_CANOE_NAMES: readonly string[] = [
  "Pōkai",
  "Puakea",
  "Hōkūleʻa",
  "Kainalu",
  "Mānele",
  "Honu",
  "Nalu",
  "Moana",
  "Kilo",
  "Kaiāulu",
  "Maluhia",
  "ʻIolani",
  "Makani",
  "Kealoha",
  "Lanakila",
  "Hikianalia",
  "Hōkūlani",
  "Kaimana",
  "Mahina",
  "Keahi",
  "Lōkahi",
  "Haliʻa",
  "Anuenue",
  "Kaiolohia",
  "Ehukai",
];

/**
 * Return a Hawaiian canoe name that isn't in `taken`. Picks randomly from
 * the remaining pool. If every name is taken, falls back to `Canoe N`
 * where N is taken.size + 1.
 */
export function pickFreshCanoeName(taken: Iterable<string>): string {
  const takenSet = new Set<string>();
  for (const n of taken) takenSet.add(n.trim());
  const pool = HAWAIIAN_CANOE_NAMES.filter(n => !takenSet.has(n));
  if (pool.length === 0) return `Canoe ${takenSet.size + 1}`;
  return pool[Math.floor(Math.random() * pool.length)];
}
