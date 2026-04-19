import { useState, useRef, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { CanoeViewPicker, type CanoeView } from "./components/CanoeViewPicker";
import type { Paddler, Canoe, CanoeSortItem } from "./types";
import { CANOE_DESIGNATIONS, SEAT_ROLES } from "./utils";

// localStorage key used to persist the user's Fleet section view preference
// across sessions. Matches the Lokahi mock's canoeView state.
const CANOE_VIEW_LS_KEY = 'lokahi.canoeView';

const loadCanoeView = (): CanoeView => {
  if (typeof window === 'undefined') return 'list';
  try {
    const v = window.localStorage.getItem(CANOE_VIEW_LS_KEY);
    if (v === '1' || v === '2' || v === '4' || v === 'list') return v;
  } catch {}
  return 'list';
};

interface SelectedEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  eventType?: string;
}

interface TodayViewProps {
  selectedEvent: SelectedEvent | null;
  isAdmin: boolean;
  sidebarOpen: boolean;
  canoes: Canoe[] | undefined;
  paddlers: Paddler[] | undefined;
  canoeSortedPaddlers: Paddler[];
  canoeAssignmentsByCanoe: Map<string, { seat: number; paddlerId: string }[]>;
  eventAssignments: any[] | undefined;
  eventAttendingPaddlerIds: Set<string> | null;
  eventGuests: any[] | undefined;
  guestPaddlerMap: Map<string, Paddler>;
  lockedCanoes: Set<string>;
  setLockedCanoes: React.Dispatch<React.SetStateAction<Set<string>>>;
  canoeDesignations: Record<string, string>;
  updateDesignationMut: (args: { canoeId: string; designation: string }) => void;
  animationKey: number;
  boatWidth: number;
  canoeRowHeight: number;
  canoeMargin: number;
  currentUser: { email: string; role: string; paddlerId: string };
  selectedPaddlerId: string | null;
  showAllBoats: boolean;
  setShowAllBoats: (v: boolean) => void;
  showGoingList: boolean;
  setShowGoingList: (v: boolean) => void;
  handleToggleAttendance: (paddlerId: string, eventId: string) => void;
  handleAssign: () => void;
  handleUnassignAll: () => void;
  handleReassignCanoes: () => void;
  handleRemoveCanoe: (canoeId: string) => void;
  handleAddCanoeAfter: (index: number) => void;
  addCanoe: (args: { name: string }) => void;
  triggerAnimation: () => void;
  canoePriority: CanoeSortItem[];
  setCanoePriority: (p: CanoeSortItem[]) => void;
  setScrollToEventId: (id: string | null) => void;
  setActivePage: (page: 'today' | 'roster' | 'schedule' | 'attendance' | 'crews') => void;
}

export function TodayView({
  selectedEvent, isAdmin, sidebarOpen, canoes, paddlers, canoeSortedPaddlers,
  canoeAssignmentsByCanoe, eventAssignments, eventAttendingPaddlerIds, eventGuests,
  guestPaddlerMap, lockedCanoes, setLockedCanoes,
  canoeDesignations, updateDesignationMut, animationKey, boatWidth, canoeRowHeight, canoeMargin,
  currentUser, selectedPaddlerId, showAllBoats, setShowAllBoats,
  showGoingList, setShowGoingList, handleToggleAttendance,
  handleAssign, handleUnassignAll, handleReassignCanoes,
  handleRemoveCanoe, handleAddCanoeAfter, addCanoe, triggerAnimation,
  canoePriority, setCanoePriority, setScrollToEventId, setActivePage,
}: TodayViewProps) {
  const [openDesignator, setOpenDesignator] = useState<string | null>(null);
  const [sortPillOpen, setSortPillOpen] = useState(false);
  const [tempPriority, setTempPriority] = useState<CanoeSortItem[]>(canoePriority);
  const sortPillRef = useRef<HTMLDivElement>(null);
  // Fleet section view: '1' | 'list' | '2' | '4'. 'list' is the current
  // responsive auto-fit grid (desktop-friendly); '1'/'2'/'4' force a
  // fixed column count with pagination, mirroring the Lokahi mock.
  const [canoeView, setCanoeView] = useState<CanoeView>(() => loadCanoeView());
  const [canoePage, setCanoePage] = useState(0);
  useEffect(() => {
    try { window.localStorage.setItem(CANOE_VIEW_LS_KEY, canoeView); } catch {}
  }, [canoeView]);

  return (
    <>
    {/* Header — no-event fallback */}
    {!selectedEvent && (
      <div className="py-1" style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
        <span style={{ fontSize: '14px', color: '#717171', fontWeight: 500 }}>{(() => {
          const now = new Date();
          const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          return `${dayNames[now.getDay()]} ${now.getMonth() + 1}/${now.getDate()} ---`;
        })()}</span>
      </div>
    )}

    {selectedEvent && (() => {
      const _d = new Date(selectedEvent.date + 'T00:00:00');
      const _dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const _monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const _dayName = _dayNames[_d.getDay()];
      const _monthName = _monthNames[_d.getMonth()];
      const _dayNum = _d.getDate();
      const _isAttending = selectedPaddlerId && eventAttendingPaddlerIds ? eventAttendingPaddlerIds.has(selectedPaddlerId) : false;
      const _goingPaddlers = eventAttendingPaddlerIds && paddlers ? paddlers.filter((p: Paddler) => eventAttendingPaddlerIds.has(p.id)).length : 0;
      const _guestCount = eventGuests?.length || 0;
      const _goingCount = _goingPaddlers + _guestCount;
      return (
    <div style={{ width: '100%', maxWidth: '600px', margin: '10px auto 0', padding: '0 8px' }}>
      {/* Event info card — serif title + stacked date stamp, matches the mock */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', padding: '18px 20px 14px', marginBottom: '12px', boxShadow: '0 0 0 1px rgba(0,0,0,.05), 0 2px 6px rgba(0,0,0,.04), 0 8px 20px rgba(0,0,0,.06)' }}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', alignItems: 'flex-start' }}>
        <div
          onClick={() => { setScrollToEventId(selectedEvent.id); setActivePage('schedule'); }}
          style={{ width: '56px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', paddingTop: '2px' }}
        >
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#717171', letterSpacing: '1.4px', lineHeight: 1 }}>{_dayName}</div>
          <div style={{
            fontFamily: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
            fontSize: '40px', fontWeight: 600, color: '#222222', lineHeight: 1, marginTop: '2px',
          }}>{_dayNum}</div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#717171', letterSpacing: '1.4px', lineHeight: 1, marginTop: '2px' }}>{_monthName}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: 'visible', marginTop: '0px', position: 'relative' }}>
          <div style={{
            fontFamily: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
            fontSize: '24px', color: '#222222', fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.15,
          }}>
            <span onClick={() => { setScrollToEventId(selectedEvent.id); setActivePage('schedule'); }} style={{ cursor: 'pointer' }}>
              {selectedEvent.title}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#717171', fontWeight: 500, marginTop: '4px' }}>
            <span>{selectedEvent.time}</span>
            <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
            <span>{selectedEvent.location}</span>
          </div>
        </div>
        {/* Event-switcher chevron — taps through to the schedule view */}
        <button
          type="button"
          onClick={() => { setScrollToEventId(selectedEvent.id); setActivePage('schedule'); }}
          title="Switch event"
          aria-label="Switch event"
          style={{
            flexShrink: 0, alignSelf: 'center',
            width: 32, height: 32, borderRadius: 8,
            background: 'transparent', border: 'none', padding: 0,
            cursor: 'pointer', color: '#717171',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      {/* Attendance strip — standalone pill below the title row, matching
          the Lokahi mock: green status dot, "N going" + "of M" small caption,
          chevron on the right. Tap to expand the attendees list. */}
      <div style={{ position: 'relative', marginBottom: '10px' }}>
        <div
          onClick={(e) => { e.stopPropagation(); setShowGoingList(!showGoingList); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px', borderRadius: '12px',
            background: '#faf9f7', border: '1px solid rgba(0,0,0,.08)',
            cursor: 'pointer', userSelect: 'none',
          }}
        >
          <div style={{
            width: 9, height: 9, borderRadius: '50%',
            background: '#5a8a5f', boxShadow: '0 0 0 3px rgba(90,138,95,0.22)',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: '14px', color: '#222222', fontWeight: 600 }}>
            {_goingCount} going
          </span>
          <span style={{ fontSize: '12px', color: '#717171', fontWeight: 500 }}>
            of {(paddlers?.length ?? 0) + _guestCount}
          </span>
          <div style={{ flex: 1 }} />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </div>
        {showGoingList && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '6px',
              backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.08)', borderRadius: '12px',
              padding: '12px 16px', zIndex: 100,
              boxShadow: '0 0 0 1px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.06), 0 10px 28px rgba(0,0,0,.12)',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#717171', marginBottom: '8px', letterSpacing: '0.08em' }}>
              ATTENDING ({_goingCount})
            </div>
            {_goingCount === 0 ? (
              <div style={{ fontSize: '14px', color: '#717171' }}>No one yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '390px', overflowY: 'auto' }}>
                {paddlers
                  ?.filter((p: Paddler) => eventAttendingPaddlerIds!.has(p.id))
                  .sort((a: Paddler, b: Paddler) => a.firstName.localeCompare(b.firstName))
                  .map((p: Paddler) => (
                    <div key={p.id} style={{ fontSize: '14px', color: '#484848' }}>
                      {p.firstName} {p.lastName || p.lastInitial}
                    </div>
                  ))}
                {eventGuests && eventGuests.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(0,0,0,.08)', margin: '4px 0', paddingTop: '4px', fontSize: '12px', color: '#717171', fontWeight: 700 }}>GUESTS</div>
                )}
                {eventGuests && eventGuests.length > 0 && eventGuests.map((g: any) => (
                  <div key={g._id} style={{ fontSize: '14px', color: '#a07838' }}>
                    {g.name} <span style={{ fontSize: '11px', color: '#a07838', opacity: 0.7 }}>guest</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Y/N + all boats/my boats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0', marginBottom: '0', flexWrap: 'wrap' }}>
        {selectedPaddlerId && (
          <div style={{ width: '40px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
          <div
            onClick={() => handleToggleAttendance(selectedPaddlerId, selectedEvent.id)}
            style={{
              width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', userSelect: 'none',
              border: `2px solid ${_isAttending ? '#22c55e' : '#ef4444'}`,
              backgroundColor: _isAttending ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: _isAttending ? '#22c55e' : '#ef4444',
              fontSize: '15px', fontWeight: 700, transition: 'all 0.15s',
            }}
          >
            {_isAttending ? 'Y' : 'N'}
          </div>
          </div>
        )}
        {!isAdmin && (
          <span
            onClick={() => setShowAllBoats(!showAllBoats)}
            style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#005280', userSelect: 'none', padding: '6px 12px', backgroundColor: 'rgba(0, 82, 128, 0.06)', borderRadius: '8px', whiteSpace: 'nowrap', border: '1px solid rgba(0,82,128,0.12)', transition: 'all 0.15s' }}
          >
            {showAllBoats ? 'My Boat' : 'All Boats'}
          </span>
        )}
        {isAdmin && (<>
          {/* Mock-style outlined-pill action bar: Auto / Clear / + Canoe / Sort,
              roughly matching the Lokahi mock's Today toolbar (with Sort By kept
              as a fourth pill since the feature is useful). */}
          <button
            type="button"
            onClick={() => { triggerAnimation(); handleAssign(); }}
            title="Auto-assign paddlers to seats"
            style={{
              height: 32, padding: '0 12px',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600, color: '#484848',
              background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3h5v5M4 20l17-17M4 4l5 5M15 15l6 6M21 16v5h-5" />
            </svg>
            Auto
          </button>
          <button
            type="button"
            onClick={() => { triggerAnimation(); handleUnassignAll(); }}
            title="Clear all assignments"
            style={{
              height: 32, padding: '0 12px',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600, color: '#484848',
              background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
            Clear
          </button>
          <button
            type="button"
            onClick={() => {
              const n = (canoes?.length ?? 0) + 1;
              addCanoe({ name: `Canoe ${n}` });
            }}
            title="Add a canoe to the fleet"
            style={{
              height: 32, padding: '0 12px',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600, color: '#484848',
              background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Canoe
          </button>
          <div ref={sortPillRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => { setTempPriority(canoePriority); setSortPillOpen(!sortPillOpen); }}
              title="Change sort priority"
              style={{
                height: 32, padding: '0 12px',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, color: '#484848',
                background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h14M20 17h0" />
                <circle cx="16" cy="7" r="2" fill="currentColor" />
                <circle cx="10" cy="12" r="2" fill="currentColor" />
              </svg>
              Sort: {(() => {
                const top = canoePriority[0];
                const label = top
                  ? ({ ability: 'Ability', gender: 'Gender', type: 'Racer?', seatPreference: 'Seat' } as Record<string, string>)[top.id]
                  : 'Default';
                return label || 'Default';
              })()}
            </button>
            {sortPillOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 0 0 1px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.06), 0 10px 28px rgba(0,0,0,.12)', zIndex: 40, overflow: 'hidden', minWidth: '160px', padding: '8px' }}>
                <DragDropContext onDragEnd={(result) => {
                  if (!result.destination) return;
                  const newPriority = Array.from(tempPriority);
                  const [reorderedItem] = newPriority.splice(result.source.index, 1);
                  newPriority.splice(result.destination.index, 0, reorderedItem);
                  setTempPriority(newPriority);
                }}>
                <Droppable droppableId="canoe-priority" direction="vertical">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {tempPriority.map((item, index) => (
                        <Draggable key={item.id} draggableId={`canoe-${item.id}`} index={index} shouldRespectForcePress={false}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                touchAction: 'none',
                                padding: '8px 12px',
                                backgroundColor: snapshot.isDragging ? 'rgba(0,82,128,0.08)' : '#faf9f7',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#484848',
                                cursor: 'grab',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                            >
                              <span style={{ color: '#b0b0b0', fontSize: '11px' }}>{index + 1}.</span>
                              {{ ability: 'ability', gender: 'gender', type: 'racer?', seatPreference: 'seat' }[item.id]}
                              <span style={{ marginLeft: 'auto', color: '#b0b0b0', fontSize: '11px' }}>⠿</span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                </DragDropContext>
                <div
                  onClick={() => { setCanoePriority(tempPriority); setSortPillOpen(false); handleReassignCanoes(); }}
                  style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: '#005280', color: '#ffffff', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textAlign: 'center', cursor: 'pointer', transition: 'opacity 0.15s' }}
                >
                  apply
                </div>
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />
        </>)}
      </div>
      </div>{/* end event info card */}
      {(isAdmin || showAllBoats) ? (<>
      {/* FLEET / N CANOES divider strip — matches the mock-up's section header.
          On the right we add a CanoeViewPicker (1/List/2/4) and, when a paged
          view is active, a tiny "page of pages" chevron pair. */}
      {(() => {
        const perPage = canoeView === '1' ? 1 : canoeView === '2' ? 2 : canoeView === '4' ? 4 : 0;
        const totalPages = perPage ? Math.max(1, Math.ceil((canoes?.length ?? 0) / perPage)) : 1;
        const page = Math.min(canoePage, totalPages - 1);
        const showPager = perPage > 0 && totalPages > 1;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 4px 10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.6px', color: '#717171', textTransform: 'uppercase' }}>Fleet</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(0,0,0,.08)' }} />
            {showPager && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setCanoePage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  aria-label="Previous page"
                  style={{ width: 22, height: 22, border: 'none', borderRadius: 6, background: 'transparent', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a2a2a', padding: 0 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <span style={{ fontSize: 10, color: '#9a9a9a', fontVariantNumeric: 'tabular-nums', minWidth: 26, textAlign: 'center' }}>{page + 1}/{totalPages}</span>
                <button
                  type="button"
                  onClick={() => setCanoePage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  aria-label="Next page"
                  style={{ width: 22, height: 22, border: 'none', borderRadius: 6, background: 'transparent', cursor: page >= totalPages - 1 ? 'default' : 'pointer', opacity: page >= totalPages - 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a2a2a', padding: 0 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </div>
            )}
            <CanoeViewPicker value={canoeView} onChange={(v) => { setCanoeView(v); setCanoePage(0); }} />
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.6px', color: '#717171', textTransform: 'uppercase' }}>
              {canoes?.length ?? 0} {(canoes?.length ?? 0) === 1 ? 'Canoe' : 'Canoes'}
            </span>
          </div>
        );
      })()}
      {/* Grid layout varies by canoeView: 'list' keeps the existing
          responsive auto-fit grid; '1'/'2'/'4' switch to a fixed column
          count and slice the canoe list by canoePage. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns:
          canoeView === 'list' ? 'repeat(auto-fit, minmax(156px, 1fr))'
          : canoeView === '1' ? '1fr'
          : '1fr 1fr',
        gridAutoRows: canoeView === '4' ? 'min-content' : undefined,
        gap: `${Math.max(canoeMargin, 12)}px`,
        padding: `4px 0 16px`,
      }}>
      {(() => {
        if (!canoes) return null;
        // 'list' mode renders every canoe (full auto-fit responsive grid).
        // Paged modes slice to just the current page so /2 and /4 grids
        // don't force off-screen vertical scrolling of extra canoes.
        if (canoeView === 'list') return canoes.map((canoe, idx) => ({ canoe, index: idx }));
        const perPage = canoeView === '1' ? 1 : canoeView === '2' ? 2 : 4;
        const totalPages = Math.max(1, Math.ceil(canoes.length / perPage));
        const page = Math.min(canoePage, totalPages - 1);
        return canoes
          .map((canoe, idx) => ({ canoe, index: idx }))
          .slice(page * perPage, (page + 1) * perPage);
      })()?.map(({ canoe, index }: { canoe: Canoe; index: number }) => {
        const canoeEventAssignments = canoeAssignmentsByCanoe.get(canoe.id) || [];
        return (
          <div
            key={canoe._id.toString()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: '10px 10px 8px',
              boxShadow: '0 0 0 1px rgba(0,0,0,.05), 0 2px 6px rgba(0,0,0,.04), 0 8px 20px rgba(0,0,0,.06)',
            }}
          >
            {/* Header row: canoe-hull icon · Hawaiian name (big serif) over
                designation · fill count ... 6-bar status strip · lock icon.
                Mirrors the mock's CanoeCard header. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 2px', marginBottom: '4px', position: 'relative' }}>
              {/* Canoe # badge — tappable, opens the designation picker.
                  Mirrors the Lokahi.html #N / #? pill from CanoeCard. */}
              {(() => {
                const designation = canoeDesignations[canoe.id] || '';
                // Strip a leading word like "RACE " so the badge shows just
                // the short token ("RACE 1" -> "1", "M" -> "M", "57" -> "57").
                const short = designation.replace(/^[A-Za-z]+\s+/, '').trim();
                const hasNum = short.length > 0;
                const isEditable = isAdmin && !lockedCanoes.has(canoe.id);
                const badgeFs = short.length >= 3 ? 10 : short.length === 2 ? 12 : 14;
                return (
                  <button
                    type="button"
                    onClick={() => isEditable && setOpenDesignator(openDesignator === canoe.id ? null : canoe.id)}
                    disabled={!isEditable}
                    aria-label={hasNum ? `Canoe number ${designation}` : 'Assign canoe number'}
                    style={{
                      width: 28, height: 28, flexShrink: 0,
                      borderRadius: 8,
                      border: hasNum ? '1.5px solid #b91c1c' : '1.5px solid rgba(0,0,0,0.15)',
                      background: hasNum ? 'rgba(185,28,28,0.10)' : 'transparent',
                      color: hasNum ? '#b91c1c' : '#9a9a9a',
                      fontWeight: 700,
                      fontSize: hasNum ? badgeFs : 10,
                      letterSpacing: hasNum ? 0 : '0.08em',
                      cursor: isEditable ? 'pointer' : 'default',
                      padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                      whiteSpace: 'nowrap',
                      lineHeight: 1,
                    }}
                  >
                    {hasNum ? `#${short}` : '#?'}
                  </button>
                );
              })()}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    fontFamily: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
                    fontSize: '17px',
                    fontWeight: 600,
                    color: '#222222',
                    lineHeight: 1.1,
                    letterSpacing: '0.2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {canoe.name}
                </span>
                <span
                  className={`transition-colors ${isAdmin && !lockedCanoes.has(canoe.id) ? 'cursor-pointer hover:text-blue-400' : 'cursor-default'}`}
                  onClick={() => isAdmin && !lockedCanoes.has(canoe.id) && setOpenDesignator(openDesignator === canoe.id ? null : canoe.id)}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#717171',
                    letterSpacing: '1.2px',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: '2px',
                  }}
                >
                  {canoeDesignations[canoe.id] || '???'}
                  {(() => {
                    const filled = canoeEventAssignments.length;
                    return <span style={{ color: '#b0b0b0', marginLeft: '8px' }}>· {filled}/6</span>;
                  })()}
                </span>
              </div>
              {/* Designation selector dropdown — Lokahi.html-style 5-col grid
                  with taken numbers dimmed and a Clear row at the bottom. */}
              {openDesignator === canoe.id && (
                <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setOpenDesignator(null)} />
                <div style={{ position: 'absolute', top: '100%', left: '4px', zIndex: 20, marginTop: 4 }}>
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(5, 34px)', gap: '4px', boxShadow: '0 12px 32px rgba(0,0,0,0.18)', border: '1px solid rgba(0,0,0,.08)' }}>
                    {CANOE_DESIGNATIONS.map(d => {
                      const isMine = canoeDesignations[canoe.id] === d;
                      const takenBy = Object.entries(canoeDesignations).find(([cid, v]) => v === d && cid !== canoe.id);
                      return (
                        <button
                          key={d}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateDesignationMut({ canoeId: canoe.id, designation: isMine ? '' : d });
                            setOpenDesignator(null);
                          }}
                          style={{
                            width: 34, height: 34, borderRadius: 8,
                            border: `1px solid ${isMine ? '#b91c1c' : 'rgba(0,0,0,0.12)'}`,
                            background: isMine ? 'rgba(185,28,28,0.14)' : takenBy ? 'rgba(0,0,0,0.04)' : '#fff',
                            color: isMine ? '#b91c1c' : takenBy ? '#9a9a9a' : '#484848',
                            fontWeight: 700, fontSize: d.length >= 3 ? 11 : 14,
                            cursor: 'pointer', opacity: takenBy ? 0.5 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 0,
                            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                          }}
                        >
                          {d}
                        </button>
                      );
                    })}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const custom = prompt('Enter canoe designation:');
                        if (custom && custom.trim()) {
                          updateDesignationMut({ canoeId: canoe.id, designation: custom.trim() });
                        }
                        setOpenDesignator(null);
                      }}
                      style={{
                        width: 34, height: 34, borderRadius: 8,
                        border: '1px dashed rgba(0,0,0,0.20)',
                        background: 'transparent',
                        color: '#484848',
                        fontWeight: 700, fontSize: 16,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0,
                      }}
                    >
                      +
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateDesignationMut({ canoeId: canoe.id, designation: '' });
                        setOpenDesignator(null);
                      }}
                      style={{
                        gridColumn: '1 / -1', padding: '6px 8px', marginTop: 2,
                        background: 'transparent', border: '1px dashed rgba(0,0,0,0.20)',
                        color: '#9a9a9a', fontSize: 10, fontWeight: 700,
                        letterSpacing: '0.12em', textTransform: 'uppercase',
                        borderRadius: 6, cursor: 'pointer',
                      }}
                    >
                      Clear #
                    </button>
                  </div>
                </div>
                </>
              )}
              {/* 6-bar fill-status strip — red when seat assigned, grey when open */}
              <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }} aria-hidden="true">
                {[1, 2, 3, 4, 5, 6].map(n => {
                  const filled = canoeEventAssignments.some(a => a.seat === n);
                  return (
                    <div
                      key={n}
                      style={{
                        width: 3, height: 10,
                        background: filled ? '#b91c1c' : 'rgba(0,0,0,.12)',
                        borderRadius: 2,
                      }}
                    />
                  );
                })}
              </div>
              {isAdmin && <button
                type="button"
                onClick={() => setLockedCanoes(prev => {
                  const next = new Set(prev);
                  if (next.has(canoe.id)) next.delete(canoe.id);
                  else next.add(canoe.id);
                  return next;
                })}
                title={lockedCanoes.has(canoe.id) ? 'Unlock canoe' : 'Lock canoe'}
                style={{
                  width: 22, height: 22, borderRadius: 5,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${lockedCanoes.has(canoe.id) ? '#ed1c24' : 'rgba(0,0,0,.12)'}`,
                  background: lockedCanoes.has(canoe.id) ? 'rgba(237,28,36,0.10)' : 'transparent',
                  cursor: 'pointer', padding: 0, flexShrink: 0,
                }}
              >
                <svg
                  width="12" height="12" viewBox="0 0 24 24"
                  fill="none" stroke={lockedCanoes.has(canoe.id) ? '#ed1c24' : '#717171'}
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  {lockedCanoes.has(canoe.id)
                    ? <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    : <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                  }
                </svg>
              </button>}
            </div>
            {/* 6 seats in a single vertical column. Each seat row gets a
                subtle dashed-border card treatment matching the Lokahi mock:
                dashed border + light tint when empty, red-solid border +
                red tint when the drop target is active, with the seat
                number colored red only when a paddler is seated. Paddlers
                get a small RC/CS/VC type tag on the right. */}
            <div style={{ padding: '0 2px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '3px' }}>
              {Array.from({ length: 6 }).map((_, i) => {
                const seat = i + 1;
                const assignment = canoeEventAssignments.find(a => a.seat === seat);
                const assignedPaddler = assignment ? (canoeSortedPaddlers.find((p: Paddler) => p.id === assignment.paddlerId) || guestPaddlerMap.get(assignment.paddlerId)) : undefined;

                return (
                  <Droppable droppableId={`canoe-${canoe.id}-seat-${seat}`} key={seat}>
                    {(provided, snapshot) => {
                      const active = snapshot.isDraggingOver;
                      const hasPaddler = !!assignedPaddler;
                      const typeTag =
                        assignedPaddler && 'type' in assignedPaddler && assignedPaddler.type
                          ? (assignedPaddler.type === 'racer' ? 'RC'
                              : assignedPaddler.type === 'casual' ? 'CS'
                              : assignedPaddler.type === 'very-casual' ? 'VC' : '')
                          : '';
                      // Compose the paddler's seat label as "FirstnameL." (no
                      // space) — e.g. "SharinC." — so the draggable fills the
                      // seat row vertically with type instead of a chip card.
                      const pFirst = assignedPaddler?.firstName || '';
                      const pLi = (assignedPaddler?.lastInitial || assignedPaddler?.lastName?.[0] || '').toUpperCase();
                      const paddlerLabel = pFirst && pLi ? `${pFirst}${pLi}.` : (pFirst || 'Guest');
                      const isGuest = assignedPaddler?.id?.startsWith('guest-');
                      const paddlerColor = isGuest
                        ? '#a07838'
                        : assignedPaddler?.gender === 'wahine'
                          ? '#a81a22'
                          : assignedPaddler?.gender === 'kane'
                            ? '#1f4e5e'
                            : '#2a2a2a';
                      return (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '2px 6px',
                            borderRadius: 7,
                            background: active ? 'rgba(200,32,40,0.12)' : 'rgba(0,0,0,0.03)',
                            border: `1px ${active ? 'solid' : 'dashed'} ${active ? '#c82028' : 'rgba(0,0,0,0.18)'}`,
                            transition: 'background 120ms ease, border-color 120ms ease',
                            minHeight: 26,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <span
                              style={{
                                fontFamily: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
                                fontSize: '16px',
                                fontWeight: 600,
                                color: hasPaddler ? '#b91c1c' : '#484848',
                                lineHeight: 1,
                                width: '12px',
                                textAlign: 'right',
                              }}
                            >
                              {seat}
                            </span>
                            <span
                              style={{
                                fontSize: '8px',
                                fontWeight: 700,
                                letterSpacing: '1px',
                                color: '#9a9a9a',
                                textTransform: 'uppercase',
                                lineHeight: 1,
                                minWidth: 28,
                              }}
                            >
                              {SEAT_ROLES[seat]}
                            </span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                            {assignedPaddler ? (
                              <Draggable draggableId={assignedPaddler.id} index={0} shouldRespectForcePress={false}>
                                {(provided, dragSnapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    tabIndex={-1}
                                    role="none"
                                    aria-roledescription=""
                                    style={{
                                      ...provided.draggableProps.style,
                                      touchAction: 'manipulation',
                                      WebkitUserSelect: 'none',
                                      userSelect: 'none',
                                      visibility: (snapshot.isDraggingOver && !snapshot.draggingFromThisWith) ? 'hidden' : 'visible',
                                      width: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      cursor: dragSnapshot.isDragging ? 'grabbing' : 'grab',
                                      minWidth: 0,
                                    }}
                                    data-animation-key={animationKey}
                                  >
                                    <span
                                      style={{
                                        fontSize: 18,
                                        lineHeight: 1,
                                        fontWeight: 700,
                                        color: paddlerColor,
                                        letterSpacing: '-0.01em',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        flex: 1,
                                        minWidth: 0,
                                        opacity: dragSnapshot.isDragging ? 0.6 : 1,
                                        transform: dragSnapshot.isDragging ? 'scale(1.03)' : 'none',
                                        transition: 'transform 120ms ease, opacity 120ms ease',
                                      }}
                                      title={assignedPaddler.firstName + (assignedPaddler.lastName ? ' ' + assignedPaddler.lastName : '')}
                                    >
                                      {paddlerLabel}
                                    </span>
                                  </div>
                                )}
                              </Draggable>
                            ) : (
                              <div style={{ fontSize: '11px', fontWeight: 500, color: active ? '#c82028' : '#9a9a9a', fontStyle: 'italic', letterSpacing: '0.2px' }}>
                                {active ? 'drop here' : 'open seat'}
                              </div>
                            )}
                          </div>
                          {typeTag && (
                            <div
                              style={{
                                fontSize: 8,
                                fontWeight: 700,
                                letterSpacing: '0.1em',
                                color: '#9a9a9a',
                                flexShrink: 0,
                              }}
                            >
                              {typeTag}
                            </div>
                          )}
                          <div style={{ display: 'none' }}>{provided.placeholder}</div>
                        </div>
                      );
                    }}
                  </Droppable>
                );
              })}
            </div>
            {/* -/+ buttons on last canoe */}
            {isAdmin && canoes && index === canoes.length - 1 && <div className="flex items-center" style={{ gap: '8px', padding: '8px 4px 0' }}>
              <span
                onClick={() => !lockedCanoes.has(canoe.id) && handleRemoveCanoe(canoe.id)}
                className={`transition-colors ${lockedCanoes.has(canoe.id) ? 'cursor-default' : 'hover:text-rose-600 hover:border-rose-400 cursor-pointer'}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '28px', height: '28px', borderRadius: '8px',
                  backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)',
                  fontSize: '16px', fontWeight: 600, lineHeight: 1,
                  color: lockedCanoes.has(canoe.id) ? '#b0b0b0' : '#717171',
                  transition: 'all 0.15s',
                }}
                title="Remove canoe"
              >
                −
              </span>
              <span
                onClick={() => handleAddCanoeAfter(index)}
                className="hover:text-emerald-500 hover:border-emerald-400 cursor-pointer transition-colors"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '28px', height: '28px', borderRadius: '8px',
                  backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)',
                  fontSize: '16px', fontWeight: 600, lineHeight: 1,
                  color: '#717171',
                  transition: 'all 0.15s',
                }}
                title="Add canoe"
              >
                +
              </span>
            </div>}
          </div>
        );
      })}
      </div>{/* end fleet grid */}

      {/* Add Canoe button when no canoes exist */}
      {(!canoes || canoes.length === 0) && (
        <button
          onClick={() => addCanoe({ name: "Canoe 1" })}
          style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '2px dashed rgba(0,0,0,.12)', color: '#717171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'transparent', fontSize: '14px' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#005280'; e.currentTarget.style.color = '#005280'; e.currentTarget.style.backgroundColor = 'rgba(0,82,128,0.04)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,.12)'; e.currentTarget.style.color = '#717171'; e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <span className="text-lg">+</span>
          <span className="font-medium">Add Canoe</span>
        </button>
      )}
      </>) : (
      /* Non-admin: show only the paddler's assigned canoe in military style */
      (() => {
        const myAssignment = eventAssignments?.find((a: { paddlerId: string }) => a.paddlerId === currentUser.paddlerId);
        const myCanoe = myAssignment ? canoes?.find((c: Canoe) => c.id === myAssignment.canoeId) : null;
        const myCanoeAssignments = myCanoe ? (canoeAssignmentsByCanoe.get(myCanoe.id) || []) : [];
        const designation = myCanoe ? (canoeDesignations[myCanoe.id] || '???') : null;
        if (!myCanoe) {
          return (
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#717171', textAlign: 'center', padding: '40px 0', letterSpacing: '1px' }}>
              No Assignment
            </div>
          );
        }

        return (
          <div style={{ padding: '20px 0' }}>
            <div style={{ fontSize: '26px', fontWeight: 700, color: '#222222', letterSpacing: '1px', marginBottom: '20px' }}>
              Boat: {designation}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Array.from({ length: 6 }).map((_, i) => {
                const seat = i + 1;
                const assignment = myCanoeAssignments.find((a: { seat: number }) => a.seat === seat);
                const assignedPaddler = assignment ? (paddlers?.find((p: Paddler) => p.id === assignment.paddlerId) || guestPaddlerMap.get(assignment.paddlerId) || null) : null;
                const isMe = assignedPaddler?.id === currentUser.paddlerId;
                const isGuest = assignedPaddler?.id.startsWith('guest-');
                return (
                  <div key={seat} style={{ fontSize: '18px', fontWeight: 600, color: assignedPaddler ? '#484848' : '#b0b0b0', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,.06)', backgroundColor: isMe ? 'rgba(250, 204, 21, 0.1)' : 'transparent', borderRadius: isMe ? '8px' : '0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ color: '#b0b0b0', marginRight: '12px', fontWeight: 500 }}>{seat}.</span>
                      {assignedPaddler ? (
                        <span style={isMe ? { color: '#facc15', textShadow: '0 0 8px rgba(250, 204, 21, 0.4)' } : undefined}>
                          {assignedPaddler.firstName} {assignedPaddler.lastName}
                          {isGuest && <span style={{ fontSize: '14px', color: '#717171', marginLeft: '8px', opacity: 0.7 }}>guest</span>}
                        </span>
                      ) : (
                        <span>---</span>
                      )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()
      )}
    </div>
      ); })()}
    </>
  );
}
