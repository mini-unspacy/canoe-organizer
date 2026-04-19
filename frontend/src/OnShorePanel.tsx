import { useEffect, useRef, useState } from "react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { PaddlerCircle, GuestPaddlerCircle, ON_SHORE_ZOOM_STEPS } from "./components/PaddlerCircle";
import type { Paddler } from "./types";

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
  animationKey,
  dragFromStaging,
  bottomOffset,
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
    return Number.isNaN(raw) ? 2 : Math.max(0, Math.min(4, raw));
  });
  const [sort, setSort] = useState<OnShoreSort>(() => {
    if (typeof window === "undefined") return "default";
    const raw = window.localStorage.getItem("lokahi.onShoreSort");
    return (raw as OnShoreSort) || "default";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Collapsed is a computed property of height, with a small tolerance so
  // that near-closed drag targets snap visually to "closed" styling.
  const collapsed = panelHeight <= CLOSED_H + 8;

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
    if (!st.moved) {
      // Tap: cycle CLOSED → SMALL → MEDIUM → LARGE → FULL → CLOSED so
      // a user can ratchet the drawer up in bite-sized steps without
      // reaching for the drag handle.
      const stops = [CLOSED_H, getSmallH(), getMediumH(), getLargeH(), getFullH()];
      const idx = stops.findIndex(s => Math.abs(panelHeight - s) <= 6);
      const next = stops[(idx + 1) % stops.length] ?? getSmallH();
      setPanelHeight(next);
    } else {
      setPanelHeight(snapToNearest(panelHeight));
    }
    dragState.current = null;
    setIsDragging(false);
  };

  const dims = ON_SHORE_ZOOM_STEPS[zoom];
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
        bottom: bottomOffset,
        zIndex: 30,
        height: panelHeight,
        background: collapsed ? "#fff" : "#faf7f0",
        borderTop: "1px solid rgba(0,0,0,.08)",
        boxShadow: collapsed ? "none" : "0 -4px 14px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
        transition: isDragging ? "none" : "height 220ms ease, background 220ms ease",
      }}
    >
      {/* Top row — the red "ON SHORE n" pill doubles as the drag handle &
          tap-to-toggle target. When collapsed the drawer is just a hairline
          with the pill sitting on it; when open, zoom + sort show on the
          right. */}
      <div
        style={{
          padding: "4px 10px",
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
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          aria-label={`On Shore ${count} paddlers — drag or tap to resize`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 24,
            padding: "0 10px",
            borderRadius: 12,
            border: "none",
            background: count === 0 ? "#a8a39a" : isDragging ? "#9e1820" : "#c82028",
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            cursor: "ns-resize",
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
            boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
            transition: "background 120ms ease",
          }}
        >
          <span>On Shore</span>
          <span style={{ fontWeight: 800, letterSpacing: 0 }}>{count}</span>
        </button>

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

      {!collapsed && (
        <Droppable droppableId="staging-mobile" direction="vertical" isDropDisabled={dragFromStaging}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "4px 10px 10px",
                display: "flex",
                flexWrap: "wrap",
                gap: 4 + zoom,
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
                  {visiblePaddlers.map((paddler, index) => (
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
                            touchAction: "manipulation",
                            WebkitUserSelect: "none",
                            userSelect: "none",
                          }}
                        >
                          <PaddlerCircle
                            paddler={paddler}
                            isDragging={dragSnapshot.isDragging}
                            animationKey={animationKey}
                            animationDelay={index * 20}
                            dims={dims}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {unassignedGuests.map((guest: any, gi: number) => {
                    const guestId = `guest-${guest._id}`;
                    const guestPaddler = guestPaddlerMap.get(guestId);
                    if (!guestPaddler) return null;
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
                              touchAction: "manipulation",
                              WebkitUserSelect: "none",
                              userSelect: "none",
                            }}
                          >
                            <GuestPaddlerCircle
                              paddler={guestPaddler}
                              isDragging={dragSnapshot.isDragging}
                              dims={dims}
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

// Five-step zoom slider. The previous dotted version had tiny 4-12px hit
// targets that were fiddly on touch. We now render a real draggable thumb
// that snaps to the 5 steps, with visible tick marks underneath so the
// notched feel from the mock is preserved.
function NotchedZoom({ zoom, setZoom }: { zoom: number; setZoom: (n: number) => void }) {
  const TRACK_W = 84;
  const STEPS = 5;
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
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
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
        {[0, 1, 2, 3, 4].map(n => {
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
