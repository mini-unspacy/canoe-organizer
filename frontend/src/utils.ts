import type { Paddler, CanoeSortItem, ViewBy, SortBy } from "./types";

export const TOOLBAR_SIZE = 34;

export const CANOE_DESIGNATIONS = ["57", "67", "700", "711", "710", "M", "W"];

// Hawaiian-convention OC6 seat roles — seat 1 is the steersperson (back),
// seat 6 is the stroke (front). Used to label each seat row on the canoe card.
export const SEAT_ROLES: Record<number, string> = {
  1: "Steers",
  2: "Caller",
  3: "Engine",
  4: "Engine",
  5: "Power",
  6: "Stroke",
};

export const CANOE_SORT_OPTIONS: CanoeSortItem[] = [
  { id: "ability", label: "ability", gradient: "from-violet-500 to-purple-600", icon: "⭐" },
  { id: "gender", label: "gender", gradient: "from-pink-500 to-rose-500", icon: "⚥" },
  { id: "type", label: "racer?", gradient: "from-cyan-500 to-blue-500", icon: "🏁" },
  { id: "seatPreference", label: "seat", gradient: "from-orange-500 to-amber-500", icon: "💺" },
];

export const getLocalToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const getPrimarySeatPreference = (pref: string | undefined): number | null => {
  if (!pref) return null;
  const seats = pref.split('').map(Number).filter(n => n >= 1 && n <= 6);
  return seats.length > 0 ? seats[0] : null;
};

export const sortPaddlersByPriority = (paddlers: Paddler[], priority: CanoeSortItem[]): Paddler[] => {
  return [...paddlers].sort((a, b) => {
    for (const p of priority) {
      let comparison = 0;
      switch (p.id) {
        case "ability":
          comparison = b.ability - a.ability;
          break;
        case "gender":
          comparison = a.gender.localeCompare(b.gender);
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "seatPreference":
          const prefA = getPrimarySeatPreference(a.seatPreference) || 999;
          const prefB = getPrimarySeatPreference(b.seatPreference) || 999;
          comparison = prefA - prefB;
          break;
      }
      if (comparison !== 0) return comparison;
    }
    return 0;
  });
};

export const getAbilityColor = (ability: number) =>
  ability === 5 ? '#e11d48' : ability === 4 ? '#ea580c' : ability === 3 ? '#d97706' : ability === 2 ? '#65a30d' : '#059669';

export const getViewSections = (paddlers: Paddler[], viewBy: ViewBy): { id: string; label: string; paddlers: Paddler[] }[] => {
  switch (viewBy) {
    case "ability": {
      const sections = [];
      for (let i = 5; i >= 1; i--) {
        const sectionPaddlers = paddlers.filter(p => p.ability === i);
        if (sectionPaddlers.length > 0) {
          sections.push({ id: `ability-${i}`, label: `level ${i}`, paddlers: sectionPaddlers });
        }
      }
      return sections;
    }
    case "gender": {
      const kane = paddlers.filter(p => p.gender === "kane");
      const wahine = paddlers.filter(p => p.gender === "wahine");
      const sections = [];
      if (kane.length > 0) sections.push({ id: "gender-kane", label: "kane", paddlers: kane });
      if (wahine.length > 0) sections.push({ id: "gender-wahine", label: "wahine", paddlers: wahine });
      return sections;
    }
    case "type": {
      const racer = paddlers.filter(p => p.type === "racer");
      const casual = paddlers.filter(p => p.type === "casual");
      const veryCasual = paddlers.filter(p => p.type === "very-casual");
      const sections = [];
      if (racer.length > 0) sections.push({ id: "type-racer", label: "racer", paddlers: racer });
      if (casual.length > 0) sections.push({ id: "type-casual", label: "casual", paddlers: casual });
      if (veryCasual.length > 0) sections.push({ id: "type-very-casual", label: "very casual", paddlers: veryCasual });
      return sections;
    }
    case "seatPreference": {
      const sections = [];
      for (let seat = 1; seat <= 6; seat++) {
        const sectionPaddlers = paddlers.filter(p => getPrimarySeatPreference(p.seatPreference) === seat);
        if (sectionPaddlers.length > 0) {
          sections.push({ id: `seat-${seat}`, label: `seat ${seat}`, paddlers: sectionPaddlers });
        }
      }
      const noPref = paddlers.filter(p => !p.seatPreference || p.seatPreference === "000000");
      if (noPref.length > 0) {
        sections.push({ id: "seat-none", label: "no pref", paddlers: noPref });
      }
      return sections;
    }
  }
};

export const sortPaddlers = (paddlers: Paddler[], sortBy: SortBy): Paddler[] => {
  return [...paddlers].sort((a, b) => {
    switch (sortBy) {
      case "ability":
        return b.ability - a.ability;
      case "gender":
        return a.gender.localeCompare(b.gender);
      case "type":
        return a.type.localeCompare(b.type);
      case "seatPreference":
        const prefA = getPrimarySeatPreference(a.seatPreference) || 999;
        const prefB = getPrimarySeatPreference(b.seatPreference) || 999;
        return prefA - prefB;
      default:
        return 0;
    }
  });
};
