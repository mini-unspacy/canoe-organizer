import { useState, useRef, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { CanoeViewPicker, type CanoeView } from "./components/CanoeViewPicker";
import type { Paddler, Canoe, CanoeSortItem } from "./types";
import { CANOE_DESIGNATIONS, CANOE_NAME_BY_DESIGNATION } from "./utils";
import { pickFreshCanoeName } from "./canoeNames";

// localStorage key used to persist the user's Fleet section view preference
// across sessions. Matches the Lokahi mock's canoeView state.
const CANOE_VIEW_LS_KEY = 'lokahi.canoeView';

const loadCanoeView = (): CanoeView => {
  if (typeof window === 'undefined') return '1';
  try {
    const v = window.localStorage.getItem(CANOE_VIEW_LS_KEY);
    if (v === '1' || v === '2' || v === '4') return v;
  } catch {}
  return '1';
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
  renameCanoeMut: (args: { canoeId: string; name: string }) => void;
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
  canoeDesignations, updateDesignationMut, renameCanoeMut, animationKey, boatWidth, canoeRowHeight, canoeMargin,
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
  // Fleet section view: '1' | '2' | '4'. All modes render every canoe in a
  // fixed-column grid; the page scrolls vertically when they overflow.
  const [canoeView, setCanoeView] = useState<CanoeView>(() => loadCanoeView());
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
      const _typeLabel: { text: string; color: string; bg: string } | null =
        selectedEvent.eventType === 'race'
          ? { text: 'RACE', color: '#b8181e', bg: 'rgba(200,32,40,0.2)' }
          : selectedEvent.eventType === 'practice'
          ? { text: 'PRACTICE', color: '#2e6b80', bg: 'rgba(46,107,128,0.18)' }
          : selectedEvent.eventType === 'other'
          ? { text: 'OTHER', color: '#6b6558', bg: 'rgba(107,101,88,0.18)' }
          : null;
      return (
    <div style={{ width: '100%', maxWidth: '600px', margin: '10px auto 0', padding: '0 4px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {selectedPaddlerId && (
              <div
                role="switch"
                aria-checked={_isAttending}
                aria-label={_isAttending ? 'Going — tap to mark not going' : 'Not going — tap to mark going'}
                onClick={(e) => { e.stopPropagation(); handleToggleAttendance(selectedPaddlerId, selectedEvent.id); }}
                style={{
                  position: 'relative',
                  width: 36, height: 20, borderRadius: 999, flexShrink: 0,
                  display: 'inline-block',
                  cursor: 'pointer', userSelect: 'none',
                  background: _isAttending ? '#2f7a47' : '#d6d1c8',
                  transition: 'background 180ms ease',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: _isAttending ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                    transition: 'left 180ms ease',
                  }}
                />
              </div>
            )}
            {_typeLabel && (
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.15em',
                color: _typeLabel.color, background: _typeLabel.bg,
                padding: '3px 6px', borderRadius: 3, flexShrink: 0,
              }}>{_typeLabel.text}</span>
            )}
            <div style={{
              fontFamily: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
              fontSize: '24px', color: '#222222', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.15,
              minWidth: 0, flex: 1,
            }}>
              <span onClick={() => { setScrollToEventId(selectedEvent.id); setActivePage('schedule'); }} style={{ cursor: 'pointer' }}>
                {selectedEvent.title}
              </span>
            </div>
          </div>
          {/* Location / time row with the going pill tucked to the right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '4px' }}>
            <div style={{ fontSize: '13px', color: '#717171', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span>{selectedEvent.time}</span>
              <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
              <span>{selectedEvent.location}</span>
            </div>
            <div style={{ flex: 1 }} />
            <div
              onClick={(e) => { e.stopPropagation(); setShowGoingList(!showGoingList); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '999px',
                background: '#faf9f7', border: '1px solid rgba(0,0,0,.08)',
                cursor: 'pointer', userSelect: 'none', flexShrink: 0,
              }}
            >
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#5a8a5f', boxShadow: '0 0 0 2px rgba(90,138,95,0.22)',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: '12px', color: '#222222', fontWeight: 600 }}>
                {_goingCount} going
              </span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      {/* Expanded attendee list — dropdown anchored below the header card */}
      <div style={{ position: 'relative', marginBottom: showGoingList ? '10px' : '0' }}>
        {showGoingList && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.08)', borderRadius: '12px',
              padding: '12px 16px', zIndex: 100,
              boxShadow: '0 0 0 1px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.06), 0 10px 28px rgba(0,0,0,.12)',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#717171', marginBottom: '8px', letterSpacing: '0.08em' }}>
              ATTENDING ({_goingPaddlers})
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
                  <div style={{ borderTop: '1px solid rgba(0,0,0,.08)', margin: '4px 0', paddingTop: '4px', fontSize: '12px', color: '#717171', fontWeight: 700, letterSpacing: '0.08em' }}>
                    GUESTS ({_guestCount})
                  </div>
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
      {/* Admin action bar — Auto / Clear / + Canoe / Sort. Non-admins see
          the same fleet view below but with no editing controls, so we
          simply skip this whole strip for them. */}
      {isAdmin && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0', marginBottom: '0', flexWrap: 'nowrap', overflowX: 'auto' }}>
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
      </div>
      )}
      </div>{/* end event info card */}
      {/* FLEET / N CANOES divider strip — matches the mock-up's section header.
          On the right we add a CanoeViewPicker (1/2/4). All modes render the
          whole fleet and let the page scroll vertically. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 4px 10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.6px', color: '#717171', textTransform: 'uppercase' }}>Fleet</span>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(0,0,0,.08)' }} />
        <CanoeViewPicker value={canoeView} onChange={(v) => setCanoeView(v)} />
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.6px', color: '#717171', textTransform: 'uppercase' }}>
          {canoes?.length ?? 0} {(canoes?.length ?? 0) === 1 ? 'Canoe' : 'Canoes'}
        </span>
      </div>
      {/* Grid layout: 1/2/4 fixed columns, entire fleet rendered, page
          handles vertical scroll. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns:
          canoeView === '1' ? '1fr'
          : canoeView === '2' ? '1fr 1fr'
          : 'repeat(4, 1fr)',
        gridAutoRows: canoeView === '4' ? 'min-content' : undefined,
        gap: `8px`,
        padding: `4px 0 16px`,
      }}>
      {canoes?.map((canoe, index) => {
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
                {canoeView !== '4' && (
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
                )}
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
                            const nextDesignation = isMine ? '' : d;
                            updateDesignationMut({ canoeId: canoe.id, designation: nextDesignation });
                            // Auto-populate the canoe's name from the # mapping.
                            // Clearing the # also clears the name.
                            const nextName = nextDesignation
                              ? (CANOE_NAME_BY_DESIGNATION[nextDesignation] ?? '')
                              : '';
                            renameCanoeMut({ canoeId: canoe.id, name: nextName });
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
                          const d = custom.trim();
                          updateDesignationMut({ canoeId: canoe.id, designation: d });
                          // Custom # has no canonical name — pick a random
                          // unused Hawaiian name so the canoe still has one.
                          const mapped = CANOE_NAME_BY_DESIGNATION[d];
                          const takenNames = (canoes ?? []).map(c => c.name).filter(Boolean);
                          const nextName = mapped ?? pickFreshCanoeName(takenNames);
                          renameCanoeMut({ canoeId: canoe.id, name: nextName });
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
                        renameCanoeMut({ canoeId: canoe.id, name: '' });
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
              {isAdmin && <button
                type="button"
                onClick={() => { if (!lockedCanoes.has(canoe.id)) handleRemoveCanoe(canoe.id); }}
                disabled={lockedCanoes.has(canoe.id)}
                title={lockedCanoes.has(canoe.id) ? 'Unlock canoe to delete' : 'Delete canoe'}
                aria-label="Delete canoe"
                style={{
                  width: 22, height: 22, borderRadius: 5,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(0,0,0,.12)',
                  background: 'transparent',
                  cursor: lockedCanoes.has(canoe.id) ? 'not-allowed' : 'pointer',
                  opacity: lockedCanoes.has(canoe.id) ? 0.4 : 1,
                  padding: 0, flexShrink: 0,
                }}
              >
                <svg
                  width="12" height="12" viewBox="0 0 24 24"
                  fill="none" stroke="#717171"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M6 6l12 12M6 18L18 6" />
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
                  <Droppable droppableId={`canoe-${canoe.id}-seat-${seat}`} key={seat} isDropDisabled={!isAdmin}>
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
                          <span
                            style={{
                              flexShrink: 0,
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
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                            {assignedPaddler ? (
                              <Draggable draggableId={assignedPaddler.id} index={0} shouldRespectForcePress={false} isDragDisabled={!isAdmin}>
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
                                      cursor: !isAdmin ? 'default' : dragSnapshot.isDragging ? 'grabbing' : 'grab',
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
          </div>
        );
      })}
      {/* Ghost "add canoe" placeholder — sits at the end of the grid as an
          extra cell so scrolling to the bottom surfaces a big dashed card
          to tap. Admin-only; shown whether or not any canoes exist. */}
      {isAdmin && (
        <button
          type="button"
          onClick={() => {
            const n = (canoes?.length ?? 0) + 1;
            addCanoe({ name: `Canoe ${n}` });
          }}
          title="Add canoe"
          aria-label="Add canoe"
          style={{
            minHeight: canoeView === '4' ? 140 : 200,
            width: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8,
            padding: '18px',
            borderRadius: 14,
            border: '2px dashed rgba(0,0,0,.18)',
            background: 'rgba(0,0,0,0.025)',
            color: '#9a9a9a',
            cursor: 'pointer',
            transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#b91c1c';
            e.currentTarget.style.color = '#b91c1c';
            e.currentTarget.style.background = 'rgba(185,28,28,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,0,0,.18)';
            e.currentTarget.style.color = '#9a9a9a';
            e.currentTarget.style.background = 'rgba(0,0,0,0.025)';
          }}
        >
          <svg width={canoeView === '4' ? 28 : 36} height={canoeView === '4' ? 28 : 36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {canoeView !== '4' && (
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>Add canoe</span>
          )}
        </button>
      )}
      </div>{/* end fleet grid */}
    </div>
      ); })()}
    </>
  );
}
