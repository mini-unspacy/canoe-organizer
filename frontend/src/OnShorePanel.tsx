import { useEffect, useMemo, useRef, useState } from "react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import type { Paddler } from "./types";
import {
  PaddlerChip,
  POOL_ROW_ZOOM_STEPS,
  SEAT_CHIP_DIMS,
  SEAT_CHIP_DIMS_COMPACT,
} from "./PaddlerChip";
import type { PaddlerRowDims } from "./PaddlerChip";

// Lokahi.html's On Shore bottom panel: a collapsible drawer docked above
// the mobile tab bar that hosts the paddler pool with a notched zoom
// slider and a sort menu. Replaces the right-hand staging sidebar on
// narrow viewports; the sidebar continues to handle desktop.

type OnShoreSort = "name" | "ability" | "gender" | "type";

const sortLabels: Record<OnShoreSort, string> = {
  name: "Name",
  ability: "Ability",
  gender: "Gender",
  type: "Type",
};

// Whitelist for migrating legacy localStorage values. Old installs may
// have "default" persisted; treat anything not in the current set as
// "name" so the picker doesn't render an empty label or fall through.
const isOnShoreSort = (v: string | null): v is OnShoreSort =>
  v === "name" || v === "ability" || v === "gender" || v === "type";

interface OnShorePanelProps {
  unassignedPaddlers: Paddler[];
  unassignedGuests: any[];
  guestPaddlerMap: Map<string, Paddler>;
  pendingAssignIds: Set<string>;
  animationKey: number;
  dragFromStaging: boolean;
  /** True while any dnd drag is in flight. Kept on the interface so the
   *  parent can still pass it without a type error, but no longer used
   *  internally — the drawer used to auto-open on drag-start and that
   *  behavior has been removed. */
  dragIsActive?: boolean;
  /** Distance in px to leave below the panel (height of the mobile tab bar). */
  bottomOffset: number;
}

function sortPaddlers(paddlers: Paddler[], sort: OnShoreSort): Paddler[] {
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

// Match TodayView's seat-row dims when morphing the drag clone into a
// seat-card shape. canoeView lives in TodayView component state and
// isn't plumbed down here, so read it straight from localStorage — the
// same key TodayView writes to. Reading inside the drag-style function
// means every drag update picks up the current value with no staleness.
const CANOE_VIEW_LS_KEY = 'lokahi.canoeView';
type CardDims = {
  minHeight: number;
  paddingV: number;
  paddingL: number;
  paddingR: number;
  // Exact pixel width to apply to the morphed clone, so it matches the
  // destination seat. We measure a real `.seat-row-inner` element from
  // the rendered fleet at drag time; the fallback below is only used
  // when no canoe is mounted yet (loading state). The seat width
  // depends on viewport AND canoeView (4-up grid vs 1/2/6-up), so
  // measuring is the only reliable way to track it across resizes.
  width: number;
  // Inner chip dims to use while morphed. We don't render the chip at
  // the user's pool-zoom size when over a seat — the destination seat
  // renders SEAT_CHIP_DIMS (or _COMPACT in 4-up), so the clone should
  // mirror that for a clean "land here" preview regardless of zoom.
  chipDims: PaddlerRowDims;
};
const CARD_DIMS_DEFAULT: CardDims = {
  minHeight: 34,
  paddingV: 2,
  paddingL: 19,
  paddingR: 4,
  width: 220,
  chipDims: SEAT_CHIP_DIMS,
};
const CARD_DIMS_COMPACT: CardDims = {
  minHeight: 26,
  paddingV: 1,
  paddingL: 15,
  paddingR: 3,
  width: 80,
  chipDims: SEAT_CHIP_DIMS_COMPACT,
};
// Measure a rendered seat so the morphed clone matches it exactly. Reads
// from the DOM at call time so it tracks viewport size, canoeView, and
// fleet size without prop plumbing. Falls back to the static base values
// if no seat exists yet (initial load before canoes have rendered).
function getSeatCardDims(): CardDims {
  let isCompact = false;
  try {
    isCompact = window.localStorage.getItem(CANOE_VIEW_LS_KEY) === '4';
  } catch {}
  const base = isCompact ? CARD_DIMS_COMPACT : CARD_DIMS_DEFAULT;
  try {
    const el = document.querySelector('.seat-row-inner') as HTMLElement | null;
    if (el) {
      const w = el.getBoundingClientRect().width;
      if (w > 0) return { ...base, width: Math.round(w) };
    }
  } catch {}
  return base;
}

export function OnShorePanel({
  unassignedPaddlers,
  unassignedGuests,
  guestPaddlerMap,
  pendingAssignIds,
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
    // Clamp to the current step count. If a user has a stale value from
    // before the slider was trimmed (e.g. zoom=4 when we had 5 steps),
    // pin it to the last valid step instead of indexing past the end of
    // POOL_ROW_ZOOM_STEPS, which would leave rowDims undefined and crash
    // the whole drawer on render.
    const maxIdx = POOL_ROW_ZOOM_STEPS.length - 1;
    return Number.isNaN(raw) ? 2 : Math.max(0, Math.min(maxIdx, raw));
  });
  const [sort, setSort] = useState<OnShoreSort>(() => {
    if (typeof window === "undefined") return "name";
    const raw = window.localStorage.getItem("lokahi.onShoreSort");
    return isOnShoreSort(raw) ? raw : "name";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // NOTE: an earlier version auto-opened the drawer on drag-start (when
  // collapsed and dragging FROM a canoe seat) to surface the On Shore drop
  // zone. That behavior was removed — the drawer now stays exactly where
  // the user left it during drags. If the user wants to drop back to On
  // Shore, they can open the drawer themselves before or after the drag.
  // The `dragIsActive` and `dragFromStaging` props are still threaded
  // through for future use but intentionally don't drive panel height.

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
  // Memoize: this re-sorts the entire pool every render, including during
  // drag updates (every mouse move) — wasteful when neither the pool, the
  // pending-assign set, nor the sort key has changed.
  const visiblePaddlers = useMemo(
    () => sortPaddlers(
      unassignedPaddlers.filter(p => !pendingAssignIds.has(p.id)),
      sort
    ),
    [unassignedPaddlers, pendingAssignIds, sort],
  );
  const count = visiblePaddlers.length + unassignedGuests.length;

  // ─── ON SHORE STATUS ANIMATION ───
  // Give the red pill a visible reaction when paddlers move on/off shore.
  // Two layers, driven off count change:
  //  • pill bounce — a small scale pop on any change; a larger green
  //    pulse when count crosses to 0 from a meaningful starting count.
  //    Triggered via direct classList manipulation on the button ref
  //    (remove class → force reflow → add class) so the animation
  //    restarts on every change WITHOUT remounting the button. A key-
  //    based remount caused a visible flicker + "double play" on
  //    desktop because React would tear the DOM node down and rebuild
  //    it between frames.
  //  • rollDir — direction of the digit slide so the number rolls up
  //    when count rises / down when it falls. This still uses key-
  //    based remount on an inner span (the count digit itself), which
  //    is small enough that the remount is invisible.
  const pillRef = useRef<HTMLButtonElement>(null);
  const [rollDir, setRollDir] = useState<{ dir: 'up' | 'down'; nonce: number } | null>(null);
  const prevCountRef = useRef<number>(count);
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = count;
    if (prev === count) return;
    setRollDir(r => ({ dir: count > prev ? 'up' : 'down', nonce: (r?.nonce ?? 0) + 1 }));
    const btn = pillRef.current;
    if (!btn) return;
    // "All seated" pulse only on a meaningful seating wave (prev >= 3).
    // A solo 1→0 move is a routine change and gets the subtle pop.
    const allSeated = count === 0 && prev >= 3;
    const cls = allSeated ? 'onshore-all-seated' : 'onshore-pop';
    // Wipe any in-flight animation classes, force a reflow, re-add.
    // This is the canonical recipe for restarting a CSS animation
    // without unmounting the element. `offsetWidth` read forces
    // layout so the browser sees the class change as two distinct
    // events (remove, then add) rather than coalescing them.
    btn.classList.remove('onshore-pop', 'onshore-all-seated');
    void btn.offsetWidth;
    btn.classList.add(cls);
  }, [count]);

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
          // Animation classes are applied to THIS DOM node directly via
          // ref.classList (see the useEffect above) — we don't use
          // React key to restart the animation because remounting the
          // button between every count change caused a visible flicker
          // and made it look like the animation played twice.
          ref={pillRef}
          type="button"
          onClick={togglePill}
          onAnimationEnd={(e) => {
            // Self-clean the animation class when it naturally
            // completes so a subsequent count change triggers a fresh
            // remove → reflow → add cycle. Guard by animationName so
            // we only react to OUR animations (count-roll inside the
            // digit span also bubbles up here).
            if (
              e.animationName === 'onshore-pop' ||
              e.animationName === 'onshore-all-seated'
            ) {
              (e.currentTarget as HTMLButtonElement).classList.remove(
                'onshore-pop',
                'onshore-all-seated',
              );
            }
          }}
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
            position: "relative",
          }}
        >
          <span>On Shore</span>
          {/* Count digit in an overflow-clipped wrapper so the roll-up /
              roll-down animation slides within a fixed frame instead of
              spilling into the "On Shore" label. Key includes the count
              value AND a nonce so repeated same-direction changes
              restart the slide. */}
          <span
            className="count-roll-wrap"
            style={{ fontWeight: 800, letterSpacing: 0, minWidth: 10, textAlign: 'center' }}
          >
            <span
              key={`${count}-${rollDir?.nonce ?? 0}`}
              className={rollDir ? (rollDir.dir === 'up' ? 'count-roll-up' : 'count-roll-down') : ''}
            >
              {count}
            </span>
          </span>
        </button>

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
                  // Fixed width so rotating between Default/Ability/Gender
                  // etc. doesn't change the button's size and shove the
                  // whole zoom-slider row sideways every time the sort
                  // option changes.
                  width: 78,
                  height: 24,
                  padding: "0 8px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 4,
                  borderRadius: 7,
                  border: "1px solid rgba(0,0,0,.12)",
                  background: "#fff",
                  color: "#484848",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M3 6h18M7 12h10M10 18h4" />
                </svg>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sortLabels[sort]}
                </span>
              </button>
              {menuOpen && (
                <div
                  style={{
                    // Open UPWARD into the canoe area instead of
                    // downward into the (sometimes very short) drawer
                    // body. When the drawer is at the SMALL preset
                    // (~110-140px) the 4-item menu would otherwise
                    // extend past the drawer's bottom edge and end up
                    // behind the bottom tab bar (zIndex 40 > drawer
                    // 30), making the lower options unreachable.
                    // Opening upward puts the menu over the canoe
                    // fleet — plenty of room, and it's still inside
                    // the drawer's stacking context so it draws above
                    // the canoe fleet's normal-flow content.
                    position: "absolute",
                    right: 0,
                    bottom: "100%",
                    marginBottom: 6,
                    zIndex: 41,
                    background: "#fff",
                    border: "1px solid rgba(0,0,0,.12)",
                    borderRadius: 10,
                    padding: 6,
                    // Drop-shadow oriented the other way (downward
                    // shadow under an upward-opening menu) reads as
                    // "this menu sits above the button".
                    boxShadow: "0 -10px 24px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.08)",
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

      {/* Drop zone is mounted unconditionally so dnd can measure it, but
          it only ACCEPTS drops when the drawer is open. A collapsed
          drawer is a ~32px sliver and was never a viable target anyway;
          disabling it here means a drag released over the closed drawer
          falls back to "no valid drop" (the paddler snaps back to its
          source) instead of silently landing On Shore.

          Historically we also disabled this while dragging FROM the
          pool (dragFromStaging), to keep drops-onto-self as no-ops. But
          a disabled droppable never reports in `draggingOver`, so the
          drag-clone morph logic couldn't tell when the cursor had
          returned to the pool — the clone stayed in seat-card shape
          forever. onDragEnd already short-circuits same-droppable
          drops, so enabling this here is safe and lets the clone
          collapse back to a chip when hovering back over the pool. */}
      <Droppable droppableId="staging-mobile" direction="vertical" isDropDisabled={collapsed}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              flex: 1,
              overflowY: collapsed ? "hidden" : "auto",
              // Keep the drop zone laid out even when the drawer is
              // visually collapsed so dnd can still measure it. When
              // collapsed it has 0 height (flex:1 of a collapsed parent)
              // but the auto-open effect expands the drawer on drag start
              // so it becomes a real target before the user can release.
              padding: collapsed ? 0 : "4px 12px 10px",
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
                        {(dragProvided, dragSnapshot) => {
                          // Mirror the seat→pool morph from TodayView in
                          // reverse: the clone grows into a seat-card
                          // shape (tinted bg + colored border + lifted
                          // shadow + seat-like padding) whenever it's
                          // being dragged anywhere outside the pool.
                          // Keying off "not over staging" instead of
                          // "over a canoe seat droppable" means the
                          // morph kicks in the moment the cursor leaves
                          // the On Shore panel — before reaching a
                          // specific seat — so there's no dead zone
                          // between seats or over the canoe container
                          // where the clone flickers back to chip shape.
                          const over = dragSnapshot.draggingOver;
                          const isOverStaging = dragSnapshot.isDragging && !!over && over.startsWith('staging-');
                          const isOverCanoe = dragSnapshot.isDragging && !isOverStaging;
                          // Pick seat-row dims matching the user's current
                          // canoeView (4-up compact vs 1/2/6-up default)
                          // so the morphed clone lines up with the actual
                          // seat it's hovering over.
                          const cardDims = isOverCanoe ? getSeatCardDims() : CARD_DIMS_DEFAULT;
                          return (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            tabIndex={-1}
                            role="none"
                            aria-roledescription=""
                            style={{
                              touchAction: 'manipulation',
                              WebkitUserSelect: 'none',
                              userSelect: 'none',
                              boxSizing: 'border-box',
                              // dp.draggableProps.style MUST precede the
                              // card overrides so we can replace the
                              // captured chip width/height with the card
                              // dims when over a canoe seat.
                              ...dragProvided.draggableProps.style,
                              ...(isOverCanoe ? {
                                // Override pangea's captured chip width
                                // with the actual destination seat
                                // width (measured from a rendered
                                // `.seat-row-inner`) so the clone fits
                                // the seat exactly — no overflow in
                                // 4-up grid, no shrinkage in 1/2/6-up.
                                width: cardDims.width,
                                minWidth: 0,
                                minHeight: cardDims.minHeight,
                                paddingLeft: cardDims.paddingL,
                                paddingRight: cardDims.paddingR,
                                paddingTop: cardDims.paddingV,
                                paddingBottom: cardDims.paddingV,
                                background: `${paddlerColor}1A`,
                                border: `1px solid ${paddlerColor}66`,
                                borderRadius: 7,
                                boxShadow: '0 10px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10)',
                                display: 'flex',
                                alignItems: 'center',
                              } : {}),
                            }}
                          >
                            <PaddlerChip
                              label={paddlerLabel}
                              color={paddlerColor}
                              badges={paddler.badges}
                              // While morphed into a seat card, render
                              // the chip at the destination seat's chip
                              // size — SEAT_CHIP_DIMS_COMPACT for 4-up,
                              // SEAT_CHIP_DIMS otherwise — so the clone
                              // doesn't carry the user's pool-zoom size
                              // into the seat preview.
                              dims={isOverCanoe ? cardDims.chipDims : rowDims}
                              // When the outer wrapper has morphed into a
                              // seat card, flatten the chip so it doesn't
                              // render a second white pill INSIDE the
                              // tinted card. Over the pool (or nothing),
                              // the chip IS the drag clone — render its
                              // white dragging pill as usual.
                              flat={isOverCanoe}
                              isDragging={dragSnapshot.isDragging && !isOverCanoe}
                              parentDragging={dragSnapshot.isDragging}
                              title={paddler.firstName + (paddler.lastName ? ' ' + paddler.lastName : '')}
                            />
                          </div>
                        );
                        }}
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
                        {(dragProvided, dragSnapshot) => {
                          // Same seat-card morph as the paddler Draggable
                          // above — guest chips get the same morph. See
                          // the paddler block for why this keys off
                          // "not over staging" rather than a specific
                          // canoe droppable id (avoids dead-zone flicker).
                          const over = dragSnapshot.draggingOver;
                          const isOverStaging = dragSnapshot.isDragging && !!over && over.startsWith('staging-');
                          const isOverCanoe = dragSnapshot.isDragging && !isOverStaging;
                          // Match the user's current canoeView so the
                          // morphed clone aligns with the target seat row
                          // in both the default and 4-up compact layouts.
                          const cardDims = isOverCanoe ? getSeatCardDims() : CARD_DIMS_DEFAULT;
                          return (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            tabIndex={-1}
                            role="none"
                            aria-roledescription=""
                            style={{
                              touchAction: 'manipulation',
                              WebkitUserSelect: 'none',
                              userSelect: 'none',
                              boxSizing: 'border-box',
                              ...dragProvided.draggableProps.style,
                              ...(isOverCanoe ? {
                                // See paddler Draggable above — width
                                // is the measured seat width so the
                                // morph fits the destination exactly.
                                width: cardDims.width,
                                minWidth: 0,
                                minHeight: cardDims.minHeight,
                                paddingLeft: cardDims.paddingL,
                                paddingRight: cardDims.paddingR,
                                paddingTop: cardDims.paddingV,
                                paddingBottom: cardDims.paddingV,
                                background: `${guestColor}1A`,
                                border: `1px solid ${guestColor}66`,
                                borderRadius: 7,
                                boxShadow: '0 10px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10)',
                                display: 'flex',
                                alignItems: 'center',
                              } : {}),
                            }}
                          >
                            <PaddlerChip
                              label={paddlerLabel}
                              color={guestColor}
                              dims={isOverCanoe ? cardDims.chipDims : rowDims}
                              flat={isOverCanoe}
                              isDragging={dragSnapshot.isDragging && !isOverCanoe}
                              parentDragging={dragSnapshot.isDragging}
                              title={guestPaddler.firstName + (guestPaddler.lastName ? ' ' + guestPaddler.lastName : '')}
                            />
                          </div>
                        );
                        }}
                      </Draggable>
                    );
                  })}
                </>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
    </div>
  );
}

// Four-step zoom slider. The previous dotted version had tiny 4-12px hit
// targets that were fiddly on touch. We now render a real draggable thumb
// that snaps to the 4 steps, with visible tick marks underneath so the
// notched feel from the mock is preserved. The little "roster" icon on
// the left is purely decorative — at true iPhone widths the header row
// is tight enough that it overlaps the center drag grip, so we hide it
// below ZOOM_ICON_MIN_W and show it at desktop-small and wider.
const ZOOM_ICON_MIN_W = 440;
function NotchedZoom({ zoom, setZoom }: { zoom: number; setZoom: (n: number) => void }) {
  const TRACK_W = 72;
  const STEPS = 4;
  const [showIcon, setShowIcon] = useState(typeof window !== "undefined" ? window.innerWidth >= ZOOM_ICON_MIN_W : true);
  useEffect(() => {
    const onResize = () => setShowIcon(window.innerWidth >= ZOOM_ICON_MIN_W);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
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
        height: 24,
        background: "#fff",
        border: "1px solid rgba(0,0,0,.12)",
        borderRadius: 7,
        boxSizing: "border-box",
      }}
    >
      {showIcon && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )}
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
          height: 20,
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
