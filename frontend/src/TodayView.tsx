import { useState, useRef } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { PaddlerCircle, GuestPaddlerCircle } from "./components/PaddlerCircle";
import type { Paddler, Canoe, CanoeSortItem } from "./types";
import { CANOE_DESIGNATIONS, SEAT_ROLES } from "./utils";

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
      const _dayName = _dayNames[_d.getDay()];
      const _dayNum = _d.getDate();
      const _isAttending = selectedPaddlerId && eventAttendingPaddlerIds ? eventAttendingPaddlerIds.has(selectedPaddlerId) : false;
      const _goingPaddlers = eventAttendingPaddlerIds && paddlers ? paddlers.filter((p: Paddler) => eventAttendingPaddlerIds.has(p.id)).length : 0;
      const _guestCount = eventGuests?.length || 0;
      const _goingCount = _goingPaddlers + _guestCount;
      return (
    <div style={{ width: '100%', maxWidth: '600px', margin: '10px auto 0', padding: '0 8px' }}>
      {/* Event info card */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px 20px', marginBottom: '12px', boxShadow: '0 0 0 1px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.04), 0 6px 18px rgba(0,0,0,.08)' }}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
        <div onClick={() => { setScrollToEventId(selectedEvent.id); setActivePage('schedule'); }} style={{ width: '52px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#222222', lineHeight: 1.1 }}>{_dayNum}</div>
          <div style={{ fontSize: '20px', color: '#717171', fontWeight: 500 }}>{_dayName}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: 'visible', marginTop: '0px', position: 'relative' }}>
          <div style={{ fontSize: '24px', color: '#222222', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
            <span onClick={() => { setScrollToEventId(selectedEvent.id); setActivePage('schedule'); }} style={{ cursor: 'pointer' }}>
              {selectedEvent.time} {selectedEvent.title}
            </span>
          </div>
          <div style={{ fontSize: '14px', color: '#005280', fontWeight: 600, marginTop: '6px' }}>
            <span onClick={(e) => { e.stopPropagation(); setShowGoingList(!showGoingList); }} style={{ cursor: 'pointer' }}>({_goingCount} going)</span>
            {showGoingList && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: '8px',
                  backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.08)', borderRadius: '12px',
                  padding: '12px 16px', minWidth: '220px', zIndex: 100,
                  boxShadow: '0 0 0 1px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.06), 0 10px 28px rgba(0,0,0,.12)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#717171', marginBottom: '8px' }}>
                  ATTENDING ({_goingCount})
                </div>
                {_goingCount === 0 ? (
                  <div style={{ fontSize: '14px', color: '#717171' }}>No one yet</div>
                ) : (
                  <>
                  <div
                    ref={(el) => {
                      if (!el) return;
                      const indicator = el.nextElementSibling as HTMLElement;
                      if (!indicator) return;
                      const check = () => { indicator.style.display = el.scrollHeight > el.clientHeight && el.scrollTop + el.clientHeight < el.scrollHeight - 4 ? 'block' : 'none'; };
                      check();
                      el.onscroll = check;
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '390px', overflowY: 'auto' }}>
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
                      <div key={g._id} style={{ fontSize: '14px', color: '#fbbf24' }}>
                        {g.name} <span style={{ fontSize: '11px', color: '#f59e0b', opacity: 0.7 }}>guest</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', color: '#717171', fontSize: '16px', lineHeight: 1, padding: '2px 0', display: 'none' }}>...</div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
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
          <div ref={sortPillRef} style={{ position: 'relative' }}>
            <span
              onClick={() => { setTempPriority(canoePriority); setSortPillOpen(!sortPillOpen); }}
              style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#005280', userSelect: 'none', padding: '6px 12px', backgroundColor: 'rgba(0, 82, 128, 0.06)', borderRadius: '8px', whiteSpace: 'nowrap', border: '1px solid rgba(0,82,128,0.12)', transition: 'all 0.15s' }}
            >
              Sort By
            </span>
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
          <span
            onClick={handleAssign}
            style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#005280', userSelect: 'none', padding: '6px 12px', backgroundColor: 'rgba(0, 82, 128, 0.06)', borderRadius: '8px', whiteSpace: 'nowrap', border: '1px solid rgba(0,82,128,0.12)', transition: 'all 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 82, 128, 0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 82, 128, 0.06)'; }}
          >
            ← Assign
          </span>
          <span
            onClick={() => { triggerAnimation(); handleUnassignAll(); }}
            style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#005280', userSelect: 'none', padding: '6px 12px', backgroundColor: 'rgba(0, 82, 128, 0.06)', borderRadius: '8px', whiteSpace: 'nowrap', border: '1px solid rgba(0,82,128,0.12)', transition: 'all 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 82, 128, 0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 82, 128, 0.06)'; }}
          >
            Return →
          </span>
        </>)}
      </div>
      </div>{/* end event info card */}
      {(isAdmin || showAllBoats) ? (<>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 0 0 1px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.04), 0 6px 18px rgba(0,0,0,.08)', marginBottom: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: `${canoeMargin}px`, padding: `${canoeMargin}px 0` }}>
      {canoes?.map((canoe: Canoe, index: number) => {
        const canoeEventAssignments = canoeAssignmentsByCanoe.get(canoe.id) || [];
        return (
          <div
            key={canoe._id.toString()}
            style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
          >
            {/* Header row: Hawaiian name (big serif) over designation · fill count ... lock icon */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: '6px', position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    fontFamily: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
                    fontSize: '22px',
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
              {/* Designation selector dropdown */}
              {openDesignator === canoe.id && (
                <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setOpenDesignator(null)} />
                <div style={{ position: 'absolute', top: '100%', left: '4px', zIndex: 20 }}>
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '6px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', minWidth: '110px', boxShadow: '0 0 0 1px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.08)', border: '1px solid rgba(0,0,0,.08)' }}>
                    {CANOE_DESIGNATIONS.map(d => (
                      <button
                        key={d}
                        onClick={(e) => { e.stopPropagation(); updateDesignationMut({ canoeId: canoe.id, designation: d }); setOpenDesignator(null); }}
                        style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 700, color: '#484848', borderRadius: '4px', textAlign: 'center', cursor: 'pointer', border: 'none', backgroundColor: 'transparent' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,.06)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {d}
                      </button>
                    ))}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const custom = prompt('Enter canoe number:');
                        if (custom && custom.trim()) {
                          updateDesignationMut({ canoeId: canoe.id, designation: custom.trim() });
                        }
                        setOpenDesignator(null);
                      }}
                      style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 700, color: '#22c55e', borderRadius: '4px', textAlign: 'center', cursor: 'pointer', border: 'none', backgroundColor: 'transparent' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.08)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      +
                    </button>
                  </div>
                </div>
                </>
              )}
              {isAdmin && <svg
                onClick={() => setLockedCanoes(prev => {
                  const next = new Set(prev);
                  if (next.has(canoe.id)) next.delete(canoe.id);
                  else next.add(canoe.id);
                  return next;
                })}
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke={lockedCanoes.has(canoe.id) ? '#ed1c24' : '#b0b0b0'}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ cursor: 'pointer', flexShrink: 0 }}
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                {lockedCanoes.has(canoe.id)
                  ? <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  : <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                }
              </svg>}
            </div>
            {/* 6 seats in a single vertical column */}
            <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0px', height: `${canoeRowHeight}px`, overflow: 'hidden' }}>
              {Array.from({ length: 6 }).map((_, i) => {
                const seat = i + 1;
                const assignment = canoeEventAssignments.find(a => a.seat === seat);
                const assignedPaddler = assignment ? (canoeSortedPaddlers.find((p: Paddler) => p.id === assignment.paddlerId) || guestPaddlerMap.get(assignment.paddlerId)) : undefined;

                return (
                  <Droppable droppableId={`canoe-${canoe.id}-seat-${seat}`} key={seat}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}
                      >
                        {(!assignedPaddler || snapshot.isDraggingOver || snapshot.draggingFromThisWith) && (
                          <div
                            className="transition-all"
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: snapshot.isDraggingOver ? 'rgba(96,165,250,0.3)' : 'transparent', borderRadius: '2px', pointerEvents: 'none' }}
                          />
                        )}
                        {/* Seat number + role label, shown on every row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, width: '92px' }}>
                          <span
                            style={{
                              fontFamily: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
                              fontSize: '20px',
                              fontWeight: 600,
                              color: '#b91c1c',
                              lineHeight: 1,
                              width: '18px',
                              textAlign: 'right',
                            }}
                          >
                            {seat}
                          </span>
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              letterSpacing: '1.2px',
                              color: '#717171',
                              textTransform: 'uppercase',
                              lineHeight: 1,
                            }}
                          >
                            {SEAT_ROLES[seat]}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                          {assignedPaddler ? (
                            <Draggable draggableId={assignedPaddler.id} index={0} shouldRespectForcePress={false}>
                              {(provided, dragSnapshot) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} tabIndex={-1} role="none" aria-roledescription="" style={{ ...provided.draggableProps.style, touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', visibility: (snapshot.isDraggingOver && !snapshot.draggingFromThisWith) ? 'hidden' : 'visible', width: '100%' }}>
                                    {assignedPaddler.id.startsWith('guest-')
                                      ? <GuestPaddlerCircle paddler={assignedPaddler} isDragging={dragSnapshot.isDragging} />
                                      : <PaddlerCircle paddler={assignedPaddler} isDragging={dragSnapshot.isDragging} animationKey={animationKey} animationDelay={seat * 30} isAdmin={isAdmin} />
                                    }
                                </div>
                              )}
                            </Draggable>
                          ) : (
                            <div style={{ fontSize: '11px', fontWeight: 500, color: '#c0c0c0', fontStyle: 'italic', letterSpacing: '0.3px' }}>open seat</div>
                          )}
                        </div>
                        <div style={{ display: 'none' }}>{provided.placeholder}</div>
                      </div>
                    )}
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
      </div>
      </div>{/* end boat grid card */}

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
