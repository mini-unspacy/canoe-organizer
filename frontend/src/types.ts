import type { Doc } from "./convex_generated/dataModel";

export type User = { email: string; role: "admin" | "normal"; paddlerId: string };

export type Paddler = Doc<"paddlers">;
export type Canoe = Doc<"canoes">;

export type ViewBy = "ability" | "gender" | "type" | "seatPreference";
export type SortBy = "ability" | "gender" | "type" | "seatPreference";
export type CanoeSortBy = "ability" | "gender" | "type" | "seatPreference";

export interface CanoeSortItem {
  id: CanoeSortBy;
  label: string;
  gradient: string;
  icon: string;
}
