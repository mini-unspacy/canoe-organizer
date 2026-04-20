import { useEffect, useRef, useState } from "react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import type { Paddler } from "./types";
import { PaddlerChip, POOL_ROW_ZOOM_STEPS } from "./PaddlerChip";

// Lokahi.html's On Shore bottom panel: a collapsible drawer docked above
// the mobile tab bar that hosts the paddler pool with a notched zoom
// slider and a sort menu. Replaces the right-hand staging sidebar on
// narrow viewports; the sidebar continues to handle desktop.

type OnShoreSort = "default" | "name" | "ability" | "gender" | "type";

const sortLabels: Record<OnShoreSort, string> = {
  default: "Default",
  name: "Name",
  ability: "Ability",
  gender: "Gender",
  type: "Type",
};

interface OnShorePanelProps {
  unassignedPaddlers: Paddler[];
  unassignedGuests: any[];
  guestPaddlerMap: Map<string, Paddler>;
  pendingAssignIds: Set<string>;
  animationKey: number;
  dragFromStaging: boolean;
  /** Distance in px to leave below the panel (height of the mobile tab bar). */
  bottomOffset: number;
  /** Full roster — used as the search pool for the + Add picker. */
  paddlers: Paddler[] | undefined;
  /** Currently selected event id; disables + Add when null. */
  selectedEventId: string | undefined;
  /** Paddler ids already attending today — filtered out of the picker. */
  eventAttendingPaddlerIds: Set<string> | null;
  /** Called when user picks a paddler to add to today's event. */
  onAddPaddler: (paddlerId: string) => void;
}

function sortPaddlers(paddlers: Paddler[], sort: OnShoreSort): Paddler[] {
  if (sort === "default") return paddlers;
  const copy = [...paddlers];
  if (sort === "name") {
    copy.sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""));
  } else if (sort === "ability") {
    copy.sort((a, b) => (b.ability || 0) - (a.ability || 0));
  } else if (sort === "gender") {
    copy.sort((a, b) => (a.gender || "").localeCompare(b.gender || ""));
  } else if (sort === "type") {
    copy.sort((a, b) => (a.type || "").localeCompare(b.type || ""));
  }
  return copy;
}

// Snap presets for the drag-to-resize On Shore panel. Heights are derived
// from the viewport so the panel always looks right on phones of varying
// sizes. Multiple intermediate stops let the user pick a comfortable
// amount of pool height without the drawer jumping to "halfway up the
// screen" on the first pull. Closed is a hairline with just the pill
// floating above it; the pill doubles as the drag handle.
const CLOSED_H = 32;
const getSmallH = () => (typeof window === "undefined" ? 140 : Math.max(110, Math.round(window.innerHeight * 0.18)));
const getMediumH = () => (typeof window === "undefined" ? 240 : Math.round(window.innerHeight * 0.32));
const getLargeH = () => (typeof window === "undefined" ? 380 : Math.round(window.innerHeight * 0.52));
const getFullH = () => (typeof window === "undefined" ? 640 : Math.round(window.innerHeight * 0.78));
const PANEL_HEIGHT_LS_KEY = "lokahi.onShorePanelHeight";

export function OnShorePanel({
  unassignedPaddlers,
  unassignedGuests,
  guestPaddlerMap,
  pendingAssignIds,
  dragFromStaging,
  bottomOffset,
  paddlers,
  selectedEventId,
  eventAttendingPaddlerIds,
  onAddPaddler,
}: OnShorePanelProps) {
  const [panelHeight, setPanelHeight] = useState<number>(() => {
    if (typeof window === "undefined") return 360;
    const rawH = window.localStorage.getItem(PANEL_HEIGHT_LS_KEY);
    if (rawH != null) {
      const n = parseInt(rawH, 10);
      if (!Number.isNaN(n) && n >= CLOSED_H) return n;
    }
    // Legacy collapsed flag fallback from the pre-drag version
    const legacyCollapsed = window.localStorage.getItem("lokahi.onShoreCollapsed") === "1";
    return legacyCollapsed ? CLOSED_H : getSmallH();
  });
  const [zoom, setZoom] = useState<number>(() => {
    if (typeof window === "undefined") return 2;
    const raw = parseInt(window.localStorage.getItem("lokahi.onShoreZoom") || "2", 10);
    // Clamp to the current step count. If a user has a stale value from
    // before the slider was trimmed (e.g. zoom=4 when we had 5 steps),
    // pin it to the last valid step instead of indexing past the end of
    // POOL_ROW_ZOOM_STEPS, which would leave rowDims undefined and crash
    // the whole drawer on render.
    const maxIdx = POOL_ROW_ZOOM_STEPS.length - 1;
    return Number.isNaN(raw) ? 2 : Math.max(0, Math.min(maxIdx, raw));
  });
  const [sort, setSort] = useState<OnShoreSort>(() => {
    if (typeof window === "undefined") return "default";
    const raw = window.localStorage.getItem("lokahi.onShoreSort");
    return (raw as OnShoreSort) || "default";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // + Add paddler picker state — local to the drawer, not hoisted.
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const addPanelRef = useRef<HTMLDivElement>(null);
  const canAdd = Boolean(selectedEventId);

  // Collapsed is a computed property of height, with a small tolerance so
  // that near-closed drag targets snap visually to "closed" styling.
  const collapsed = panelHeight <= CLOSED_H + 8;

  // Remember the last non-collapsed height so the pill's show/hide toggle
  // returns to where the user left the drawer, not always to SMALL.
  const lastOpenH = useRef<number>(collapsed ? getSmallH() : panelHeight);
  useEffect(() => { if (!collapsed) lastOpenH.current = panelHeight; }, [panelHeight, collapsed]);

  useEffect(() => {
    window.localStorage.setItem(PANEL_HEIGHT_LS_KEY, String(panelHeight));
    window.localStorage.setItem("lokahi.onShoreCollapsed", collapsed ? "1" : "0");
  }, [panelHeight, collapsed]);
  useEffect(() => {
    window.localStorage.setItem("lokahi.onShoreZoom", String(zoom));
  }, [zoom]);
  useEffect(() => {
    window.localStorage.setItem("lokahi.onShoreSort", sort);
  }, [sort]);

  // Close the sort menu on click-outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Close the + Add picker on click-outside
  useEffect(() => {
    if (!addOpen) return;
    const handler = (e: MouseEvent) => {
      if (addPanelRef.current && !addPanelRef.current.contains(e.target as Node)) {
        setAddOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [addOpen]);

  // When the drawer collapses, dismiss any open + Add picker.
  useEffect(() => {
    if (collapsed && addOpen) {
      setAddOpen(false);
      setAddQuery("");
    }
  }, [collapsed, addOpen]);

  // Keep the panel reasonable when the viewport is resized (e.g. phone
  // rotation). Clamps to the current FULL max and, if it lands above that,
  // re-snaps to a viable preset.
  useEffect(() => {
    const onResize = () => {
      const full = getFullH();
      setPanelHeight(h => (h > full ? full : h));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Drag-to-resize state. We track startY/startH plus a "moved" flag so a
  // tap (no drag) toggles open/closed while an actual drag sets a height.
  const dragState = useRef<{ startY: number; startH: number; moved: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const snapToNearest = (h: number): number => {
    const targets = [CLOSED_H, getSmallH(), getMediumH(), getLargeH(), getFullH()];
    let best = targets[0];
    let bestDist = Math.abs(h - best);
    for (const t of targets) {
      const d = Math.abs(h - t);
      if (d < bestDist) { bestDist = d; best = t; }
    }
    return best;
  };

  const onHandlePointerDown = (e: React.PointerEvent) => {
    dragState.current = { startY: e.clientY, startH: panelHeight, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setIsDragging(true);
  };
  const onHandlePointerMove = (e: React.PointerEvent) => {
    const st = dragState.current;
    if (!st) return;
    const dy = st.startY - e.clientY; // dragging up = taller
    if (Math.abs(dy) > 3) st.moved = true;
    const full = getFullH();
    const nextH = Math.max(CLOSED_H, Math.min(full, st.startH + dy));
    setPanelHeight(nextH);
  };
  const onHandlePointerUp = (e: React.PointerEvent) => {
    const st = dragState.current;
    if (!st) return;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    if (st.moved) {
      setPanelHeight(snapToNearest(panelHeight));
    }
    dragState.current = null;
    setIsDragging(false);
  };

  // Pill is the show/hide toggle — taps only; dragging happens on the
  // dedicated center grip.
  const togglePill = () => {
    setPanelHeight(collapsed ? lastOpenH.current : CLOSED_H);
  };

  // Belt-and-suspenders against a stale zoom index blowing up the drawer.
  const rowDims = POOL_ROW_ZOOM_STEPS[zoom] ?? POOL_ROW_ZOOM_STEPS[POOL_ROW_ZOOM_STEPS.length - 1];
  const visiblePaddlers = sortPaddlers(
    unassignedPaddlers.filter(p => !pendingAssignIds.has(p.id)),
    sort
  );
  const count = visiblePaddlers.length + unassignedGuests.length;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        // Parent passes the tab bar's real measured height (including any
        // safe-area padding it has), so we sit flush on top of it. When
        // the nav auto-hides on scroll, bottomOffset drops to 0 and the
        // drawer slides down to the true bottom of the screen.
        bottom: bottomOffset,
        zIndex: 30,
        height: panelHeight,
        background: "#faf7f0",
        borderTop: "1px solid rgba(0,0,0,.08)",
        boxShadow: collapsed ? "none" : "0 -4px 14px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
        transition: isDragging ? "none" : "height 220ms ease, bottom 220ms ease",
      }}
    >
      {/* Top row — pill (show/hide toggle) on the left, center drag grip,
          zoom + sort on the right. The pill now only opens/closes the
          drawer; resize lives on the grip. */}
      <div
        style={{
          boxSizing: "border-box",
          padding: "4px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
          position: "relative",
          height: CLOSED_H,
        }}
      >
        <button
          type="button"
          onClick={togglePill}
          aria-label={`On Shore ${count} paddlers — tap to ${collapsed ? "open" : "close"}`}
          aria-expanded={!collapsed}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 24,
            padding: "0 10px",
            borderRadius: 12,
            border: "none",
            background: count === 0 ? "#a8a39a" : "#c82028",
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            cursor: "pointer",
            userSelect: "none",
            WebkitUserSelect: "none",
            boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
            transition: "background 120ms ease",
          }}
        >
          <span>On Shore</span>
          <span style={{ fontWeight: 800, letterSpacing: 0 }}>{count}</span>
        </button>

        {/* + Add paddler — sits next to the ON SHORE pill so it stays
            clear of the centered drag grip. Only shown when the drawer
            is open; the ON SHORE pill is the collapsed-state handle. */}
        {!collapsed && (
          <button
            type="button"
            onClick={() => {
              if (!canAdd) return;
              setAddOpen(v => !v);
              setAddQuery("");
              setTimeout(() => addInputRef.current?.focus(), 60);
            }}
            aria-label="Add paddler to today's event"
            title={canAdd ? "Add paddler to today's event" : "Select an event first"}
            disabled={!canAdd}
            style={{
              height: 24,
              padding: "0 9px",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              borderRadius: 12,
              border: "none",
              background: canAdd ? (addOpen ? "#7a1318" : "#1f7a4f") : "#c7c3bc",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: canAdd ? "pointer" : "not-allowed",
              boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
              transition: "background 120ms ease",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1, letterSpacing: 0 }}>+</span>
            <span>Add</span>
          </button>
        )}

        {/* Center drag grip — sits horizontally centered in the row and is
            the ONLY place that resizes the drawer. */}
        <div
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Drag to resize On Shore panel"
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            transform: "translateX(-50%)",
            height: CLOSED_H,
            width: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "ns-resize",
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: isDragging ? "#c82028" : "rgba(0,0,0,0.22)",
              transition: "background 120ms ease",
            }}
          />
        </div>

        {!collapsed && (
          <>
            <div style={{ flex: 1 }} />
            <NotchedZoom zoom={zoom} setZoom={setZoom} />
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setMenuOpen(v => !v)}
                style={{
                  height: 24,
                  padding: "0 8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  borderRadius: 7,
                  border: "1px solid rgba(0,0,0,.12)",
                  background: "#fff",
                  color: "#484848",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M7 12h10M10 18h4" />
                </svg>
                {sortLabels[sort]}
              </button>
              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 30,
                    zIndex: 40,
                    background: "#fff",
                    border: "1px solid rgba(0,0,0,.12)",
                    borderRadius: 10,
                    padding: 6,
                    boxShadow: "0 10px 24px rgba(0,0,0,0.15)",
                    minWidth: 140,
                  }}
                >
                  {(Object.keys(sortLabels) as OnShoreSort[]).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setSort(v);
                        setMenuOpen(false);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "7px 10px",
                        background: sort === v ? "rgba(200,32,40,0.08)" : "transparent",
                        border: "none",
                        borderRadius: 6,
                        color: sort === v ? "#c82028" : "#484848",
                        fontSize: 12,
                        fontWeight: sort === v ? 700 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {sortLabels[v]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {!collapsed && addOpen && (
        <div
          ref={addPanelRef}
          style={{
            flexShrink: 0,
            borderBottom: "1px solid rgba(0,0,0,.08)",
            background: "#fff",
            padding: "8px 12px 10px",
            boxShadow: "inset 0 1px 0 rgba(0,0,0,0.04), 0 4px 10px -6px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ position: "relative" }}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#717171"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              ref={addInputRef}
              type="text"
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setAddOpen(false); setAddQuery(""); }
              }}
              placeholder="search paddler to add…"
              autoFocus
              style={{
                width: "100%",
                padding: "7px 28px 7px 28px",
                fontSize: 13,
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,.12)",
                background: "#faf9f7",
                color: "#222",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {addQuery && (
              <button
                type="button"
                onClick={() => { setAddQuery(""); addInputRef.current?.focus(); }}
                aria-label="Clear search"
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "transparent",
                  color: "#717171",
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 4,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            )}
          </div>
          <div style={{ marginTop: 6, maxHeight: 180, overflowY: "auto" }}>
            {(() => {
              const q = addQuery.toLowerCase().trim();
              if (!paddlers) return null;
              if (!q) {
                return (
                  <div style={{ fontSize: 12, color: "#8a8a8a", padding: "6px 8px", fontStyle: "italic" }}>
                    Type a name to find a paddler
                  </div>
                );
              }
              const matches = paddlers
                .filter((p) => {
                  if (eventAttendingPaddlerIds?.has(p.id)) return false;
                  const full = `${p.firstName || ""} ${p.lastName || ""}`.toLowerCase();
                  return full.includes(q);
                })
                .slice(0, 8);
              if (matches.length === 0) {
                return (
                  <div style={{ fontSize: 12, color: "#8a8a8a", padding: "6px 8px", fontStyle: "italic" }}>
                    No matches
                  </div>
                );
              }
              return matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onAddPaddler(p.id);
                    setAddOpen(false);
                    setAddQuery("");
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#222",
                    background: "transparent",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(200,32,40,0.08)"; e.currentTarget.style.color = "#c82028"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#222"; }}
                >
                  {p.firstName}{p.lastName ? ` ${p.lastName[0]}.` : ""}
                </button>
              ));
            })()}
          </div>
        </div>
      )}

      {!collapsed && (
        <Droppable droppableId="staging-mobile" direction="vertical" isDropDisabled={dragFromStaging}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "4px 12px 10px",
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 4 + rowDims.gap,
                alignContent: "flex-start",
                background: snapshot.isDraggingOver ? "rgba(251,191,36,0.12)" : "transparent",
                transition: "background 120ms ease",
              }}
            >
              {visiblePaddlers.length === 0 && unassignedGuests.length === 0 ? (
                <div
                  style={{
                    width: "100%",
                    textAlign: "center",
                    padding: "20px",
                    color: "#717171",
                    fontSize: 12,
                    fontStyle: "italic",
                  }}
                >
                  Everyone's seated 🛶
                </div>
              ) : (
                <>
                  {visiblePaddlers.map((paddler, index) => {
                    // Mirror the seat-row layout from TodayView so the pool
                    // reads as "rows of paddlers" that visually match the
                    // canoe seats they'll be dropped into. Gender drives the
                    // name color (wahine red / kane teal).
                    const pFirst = paddler.firstName || '';
                    const pLi = (paddler.lastInitial || paddler.lastName?.[0] || '').toUpperCase();
                    const paddlerLabel = pFirst && pLi ? `${pFirst}${pLi}` : (pFirst || 'Paddler');
                    const paddlerColor = paddler.gender === 'wahine'
                      ? '#a81a22'
                      : paddler.gender === 'kane'
                        ? '#1f4e5e'
                        : '#2a2a2a';
                    return (
                      <Draggable key={paddler._id.toString()} draggableId={paddler.id} index={index} shouldRespectForcePress={false}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            tabIndex={-1}
                            role="none"
                            aria-roledescription=""
                            style={{
                              ...dragProvided.draggableProps.style,
                              touchAction: 'manipulation',
                              WebkitUserSelect: 'none',
                              userSelect: 'none',
                            }}
                          >
                            <PaddlerChip
                              label={paddlerLabel}
                              color={paddlerColor}
                              dims={rowDims}
                              isDragging={dragSnapshot.isDragging}
                              title={paddler.firstName + (paddler.lastName ? ' ' + paddler.lastName : '')}
                            />
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {unassignedGuests.map((guest: any, gi: number) => {
                    const guestId = `guest-${guest._id}`;
                    const guestPaddler = guestPaddlerMap.get(guestId);
                    if (!guestPaddler) return null;
                    const pFirst = guestPaddler.firstName || '';
                    const pLi = (guestPaddler.lastInitial || guestPaddler.lastName?.[0] || '').toUpperCase();
                    const paddlerLabel = pFirst && pLi ? `${pFirst}${pLi}` : (pFirst || 'Guest');
                    const guestColor = '#a07838';
                    return (
                      <Draggable
                        key={guestId}
                        draggableId={guestId}
                        index={visiblePaddlers.length + gi}
                        shouldRespectForcePress={false}
                      >
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            tabIndex={-1}
                            role="none"
                            aria-roledescription=""
                            style={{
                              ...dragProvided.draggableProps.style,
                              touchAction: 'manipulation',
                              WebkitUserSelect: 'none',
                              userSelect: 'none',
                            }}
                          >
                            <PaddlerChip
                              label={paddlerLabel}
                              color={guestColor}
                              dims={rowDims}
                              isDragging={dragSnapshot.isDragging}
                              title={guestPaddler.firstName + (guestPaddler.lastName ? ' ' + guestPaddler.lastName : '')}
                            />
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                </>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      )}
    </div>
  );
}

// Four-step zoom slider. The previous dotted version had tiny 4-12px hit
// targets that were fiddly on touch. We now render a real draggable thumb
// that snaps to the 4 steps, with visible tick marks underneath so the
// notched feel from the mock is preserved.
function NotchedZoom({ zoom, setZoom }: { zoom: number; setZoom: (n: number) => void }) {
  const TRACK_W = 72;
  const STEPS = 4;
  const clamp = (n: number) => Math.max(0, Math.min(STEPS - 1, n));
  const fromX = (x: number, trackLeft: number) => {
    const frac = (x - trackLeft) / TRACK_W;
    return clamp(Math.round(frac * (STEPS - 1)));
  };
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const pointerUpdate = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = fromX(clientX, rect.left);
    if (next !== zoom) setZoom(next);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointerUpdate(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    pointerUpdate(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const thumbLeft = (zoom / (STEPS - 1)) * TRACK_W;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "0 8px",
        height: 28,
        background: "#fff",
        border: "1px solid rgba(0,0,0,.12)",
        borderRadius: 8,
      }}
    >
      <div
        ref={trackRef}
        role="slider"
        aria-label="Paddler chip zoom"
        aria-valuemin={0}
        aria-valuemax={STEPS - 1}
        aria-valuenow={zoom}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); setZoom(clamp(zoom + 1)); }
          if (e.key === "ArrowLeft"  || e.key === "ArrowDown") { e.preventDefault(); setZoom(clamp(zoom - 1)); }
        }}
        style={{
          position: "relative",
          width: TRACK_W,
          height: 24,
          cursor: "pointer",
          touchAction: "none",
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Track line */}
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, transform: "translateY(-50%)", background: "rgba(0,0,0,0.10)", borderRadius: 2 }} />
        {/* Filled portion up to the thumb */}
        <div style={{ position: "absolute", left: 0, top: "50%", height: 2, width: thumbLeft, transform: "translateY(-50%)", background: "#c82028", borderRadius: 2 }} />
        {/* Tick marks */}
        {[0, 1, 2, 3].map(n => {
          const left = (n / (STEPS - 1)) * TRACK_W;
          return (
            <div
              key={n}
              style={{
                position: "absolute",
                left,
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: 2,
                height: 8,
                background: n <= zoom ? "#c82028" : "rgba(0,0,0,0.25)",
                borderRadius: 1,
                pointerEvents: "none",
              }}
            />
          );
        })}
        {/* Thumb */}
        <div
          style={{
            position: "absolute",
            left: thumbLeft,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#c82028",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            border: "2px solid #fff",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}
