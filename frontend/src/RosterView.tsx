// Roster page rebuilt to match the Lokahi mock. Presents paddlers as a
// scrolling list with gradient avatar circles, ability dots, a live
// search, and gender + type filter chips. Admins can tap any row to open
// the existing EditPaddlerModal and change details; delete + admin-role
// toggle stay available via the expanded detail panel.

import { useMemo, useState } from "react";
import type { Paddler } from "./types";
import { EditPaddlerModal, type EditForm } from "./EditPaddlerModal";

interface RosterViewProps {
  paddlers: Paddler[];
  isAdmin: boolean;
  windowWidth: number;
  updatePaddler: (args: any) => void;
  toggleAdminMut: (args: { paddlerId: string }) => void;
  deleteUserByPaddlerIdMut: (args: { paddlerId: string }) => void;
  deletePaddlerMut: (args: { paddlerId: string }) => void;
  userEmailByPaddlerId: Map<string, string>;
  userRoleByPaddlerId: Map<string, string>;
}

type GenderFilter = "all" | "kane" | "wahine";
type TypeFilter = "all" | "racer" | "casual" | "very-casual";

// Palette pulled from the Lokahi mock so tokens match 1:1.
const T = {
  bone: "#ffffff",
  inkSoft: "#f5f3ef",
  inkLine: "#e3e0da",
  inkHigh: "#1a1a1a",
  charcoal: "#1a1a1a",
  muted: "#6b6558",
  sand: "#8a8275",
  red: "#c82028",
  redDeep: "#9e1820",
  redGlow: "#b8181e",
  ocean: "#2e6b80",
  oceanDeep: "#1a4a5c",
  guest: "#a07838",
};
const FONT_DISPLAY = "'Instrument Serif', Georgia, serif";
const FONT_BODY = "'Figtree', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: T.muted }}>
      <span>{children}</span>
      <div style={{ flex: 1, height: 1, background: T.inkLine }} />
      {right}
    </div>
  );
}

function SearchIcon({ size = 14, color = T.muted }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function genderLabel(g: GenderFilter) {
  if (g === "kane") return "Kāne";
  if (g === "wahine") return "Wāhine";
  return "All";
}

function typeLabel(t: TypeFilter) {
  if (t === "racer") return "Racer";
  if (t === "casual") return "Casual";
  if (t === "very-casual") return "V.Casual";
  return "All";
}

function abilityFromP(p: Paddler): number {
  return Math.max(0, Math.min(5, p.ability ?? 0));
}

function prefSeats(p: Paddler): number[] {
  const s = p.seatPreference || "";
  return s.split("").map((n: string) => parseInt(n, 10)).filter((n: number) => n > 0);
}

export function RosterView({
  paddlers,
  isAdmin,
  updatePaddler,
  toggleAdminMut,
  deleteUserByPaddlerIdMut,
  deletePaddlerMut,
  userEmailByPaddlerId,
  userRoleByPaddlerId,
}: RosterViewProps) {
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    firstName: "",
    lastName: "",
    gender: "kane",
    type: "casual",
    ability: 3,
    seatPreference: "000000",
  });
  const [adminOpenId, setAdminOpenId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...paddlers].sort((a, b) => (a.firstName || "").localeCompare(b.firstName || "")),
    [paddlers],
  );

  const filtered = useMemo(() => {
    return sorted.filter(p => {
      if (genderFilter !== "all" && p.gender !== genderFilter) return false;
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (search) {
        const needle = search.toLowerCase();
        const hay = `${p.firstName ?? ""} ${p.lastName ?? p.lastInitial ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [sorted, genderFilter, typeFilter, search]);

  const counts = useMemo(
    () => ({
      all: paddlers.length,
      kane: paddlers.filter(p => p.gender === "kane").length,
      wahine: paddlers.filter(p => p.gender === "wahine").length,
    }),
    [paddlers],
  );
  const typeCounts = useMemo(
    () => ({
      all: paddlers.length,
      racer: paddlers.filter(p => p.type === "racer").length,
      casual: paddlers.filter(p => p.type === "casual").length,
      "very-casual": paddlers.filter(p => p.type === "very-casual").length,
    }),
    [paddlers],
  );

  const openEdit = (p: Paddler) => {
    setEditForm({
      firstName: p.firstName || "",
      lastName: p.lastName || "",
      gender: p.gender,
      type: p.type,
      ability: p.ability || 3,
      seatPreference: p.seatPreference || "000000",
    });
    setEditingId(p.id);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updatePaddler({
      paddlerId: editingId,
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      gender: editForm.gender,
      type: editForm.type,
      ability: editForm.ability,
      seatPreference: editForm.seatPreference,
    });
    setEditingId(null);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.bone, fontFamily: FONT_BODY }}>
      {/* Hero header */}
      <div style={{ padding: "14px 16px 8px", borderBottom: `1px solid ${T.inkLine}` }}>
        <div style={{ fontSize: 10, color: T.sand, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700 }}>
          Nā mea hoe · Paddlers
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 600, color: T.charcoal, lineHeight: 1.05, marginTop: 2 }}>
          Roster
        </div>

        {/* Search */}
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: T.inkSoft, border: `1px solid ${T.inkLine}` }}>
          <SearchIcon />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search paddlers"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: T.charcoal, fontSize: 13, fontFamily: FONT_BODY, minWidth: 0 }}
          />
          <span style={{ fontSize: 10, color: T.muted }}>{filtered.length}</span>
        </div>

        {/* Filter chips */}
        <div className="scrollbar-hidden" style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto", paddingBottom: 4 }}>
          {(["all", "kane", "wahine"] as GenderFilter[]).map(f => {
            const active = genderFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setGenderFilter(f)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: `1px solid ${active ? T.red : T.inkLine}`,
                  background: active ? "rgba(200,32,40,0.14)" : "transparent",
                  color: active ? T.red : T.sand,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: FONT_BODY,
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {genderLabel(f)}
                <span style={{ marginLeft: 4, opacity: 0.6 }}>{counts[f]}</span>
              </button>
            );
          })}
          <div style={{ width: 1, background: T.inkLine, margin: "0 2px", flexShrink: 0 }} />
          {(["all", "racer", "casual", "very-casual"] as TypeFilter[]).map(f => {
            const active = typeFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setTypeFilter(f)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: `1px solid ${active ? T.ocean : T.inkLine}`,
                  background: active ? "rgba(46,107,128,0.18)" : "transparent",
                  color: active ? T.ocean : T.sand,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: FONT_BODY,
                  cursor: "pointer",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {typeLabel(f)}
                <span style={{ marginLeft: 4, opacity: 0.6 }}>{typeCounts[f]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Paddler list */}
      <div className="scrollbar-hidden" style={{ flex: 1, overflowY: "auto", padding: "8px 12px 80px" }}>
        {filtered.map(p => {
          const first = p.firstName || "";
          const lastInitial = (p.lastInitial || p.lastName?.[0] || "").toUpperCase();
          const ability = abilityFromP(p);
          const seats = prefSeats(p);
          const seatText = seats.length > 2 ? `Seats ${seats.slice(0, 2).join(",")}+` : seats.length ? `Seats ${seats.join(",")}` : "";
          const isWahine = p.gender === "wahine";
          const gradient = isWahine
            ? `linear-gradient(140deg, ${T.red}, ${T.redDeep})`
            : `linear-gradient(140deg, ${T.ocean}, ${T.oceanDeep})`;
          const email = userEmailByPaddlerId.get(p.id);
          const isClubAdmin = userRoleByPaddlerId.get(p.id) === "admin";
          const showAdminRow = isAdmin && adminOpenId === p.id;

          return (
            <div key={p._id.toString()} style={{ borderBottom: `1px solid ${T.inkLine}` }}>
              <div
                onClick={() => { if (isAdmin) setAdminOpenId(id => (id === p.id ? null : p.id)); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 8px",
                  cursor: isAdmin ? "pointer" : "default",
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: FONT_BODY,
                    border: "1px solid rgba(255,255,255,0.08)",
                    flexShrink: 0,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                  }}
                >
                  {(first[0] || "?").toUpperCase()}
                  {lastInitial}
                </div>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: T.charcoal, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span>{first} {lastInitial ? `${lastInitial}.` : ""}</span>
                    {isClubAdmin && (
                      <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: T.guest, background: "rgba(160,120,56,0.15)", padding: "2px 5px", borderRadius: 3 }}>
                        Admin
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.type}
                    {seatText && (
                      <>
                        {" "}
                        <span style={{ opacity: 0.5 }}>·</span> {seatText}
                      </>
                    )}
                  </div>
                </div>

                {/* Ability dots */}
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <div
                      key={n}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: n <= ability ? T.charcoal : T.inkHigh,
                        opacity: n <= ability ? 1 : 0.2,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Admin-only expanded row with Edit / admin toggle / delete */}
              {showAdminRow && (
                <div style={{ padding: "6px 8px 12px 60px", display: "flex", flexDirection: "column", gap: 6, color: T.muted, fontSize: 12 }}>
                  {email && (
                    <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: T.sand, wordBreak: "break-all" }}>{email}</div>
                  )}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        border: `1px solid ${T.inkLine}`,
                        background: T.bone,
                        color: T.charcoal,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleAdminMut({ paddlerId: p.id }); }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        border: `1px solid ${isClubAdmin ? T.guest : T.inkLine}`,
                        background: isClubAdmin ? "rgba(160,120,56,0.12)" : T.bone,
                        color: isClubAdmin ? T.guest : T.muted,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {isClubAdmin ? "Remove admin" : "Make admin"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete ${p.firstName} ${p.lastName || p.lastInitial}? This removes their paddler profile and user account.`)) {
                          deleteUserByPaddlerIdMut({ paddlerId: p.id });
                          deletePaddlerMut({ paddlerId: p.id });
                          setAdminOpenId(null);
                        }
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        border: `1px solid rgba(200,32,40,0.2)`,
                        background: "rgba(200,32,40,0.08)",
                        color: T.red,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: "40px 0", textAlign: "center", color: T.muted, fontSize: 13 }}>
            <SectionLabel>No matches</SectionLabel>
          </div>
        )}
      </div>

      {editingId && (
        <EditPaddlerModal
          editForm={editForm}
          setEditForm={setEditForm}
          onSave={saveEdit}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
