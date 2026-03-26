import { useState, useRef } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { PaddlerCircle, GuestPaddlerCircle } from "./components/PaddlerCircle";
import type { Paddler, Canoe, CanoeSortItem } from "./types";
import { CANOE_DESIGNATIONS } from "./utils";

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
  assignedPaddlerIds: Set<string>;
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
  guestPaddlerMap, assignedPaddlerIds, lockedCanoes, setLockedCanoes,
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
        <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>{(() => {
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
    <div style={{ width: '100%', maxWidth: '600px', margin: '10px auto 0' }}>
      {/* Event info row */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <div onClick={() => { setScrollToEventId(selectedEvent.id); setActivePage('schedule'); }} style={{ width: '52px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#e0e0e0', lineHeight: 1.1 }}>{_dayNum}</div>
          <div style={{ fontSize: '20px', color: '#c0c0c0', fontWeight: 500 }}>{_dayName}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: 'visible', marginTop: '0px', position: 'relative' }}>
          <div style={{ fontSize: '28px', color: '#e0e0e0', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.1 }}>
            <span onClick={() => { setScrollToEventId(selectedEvent.id); setActivePage('schedule'); }} style={{ cursor: 'pointer' }}>
              {selectedEvent.time} {selectedEvent.title}
            </span>
          </div>
          <div style={{ fontSize: '14px', color: '#3b82f6', fontWeight: 600, marginTop: '4px' }}>
            <span onClick={(e) => { e.stopPropagation(); setShowGoingList(!showGoingList); }} style={{ cursor: 'pointer' }}>({_goingCount} going)</span>
            {showGoingList && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: '8px',
                  backgroundColor: '#111111', border: '1px solid #222222', borderRadius: '12px',
                  padding: '12px 16px', minWidth: '220px', zIndex: 100,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af', marginBottom: '8px' }}>
                  ATTENDING ({_goingCount})
                </div>
                {_goingCount === 0 ? (
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>No one yet</div>
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
                        <div key={p.id} style={{ fontSize: '14px', color: '#e5e7eb' }}>
                          {p.firstName} {p.lastName || p.lastInitial}
                        </div>
                      ))}
                    {eventGuests && eventGuests.length > 0 && (
                      <div style={{ borderTop: '1px solid #333', margin: '4px 0', paddingTop: '4px', fontSize: '12px', color: '#9ca3af', fontWeight: 700 }}>GUESTS</div>
                    )}
                    {eventGuests && eventGuests.length > 0 && eventGuests.map((g: any) => (
                      <div key={g._id} style={{ fontSize: '14px', color: '#fbbf24' }}>
                        {g.name} <span style={{ fontSize: '11px', color: '#f59e0b', opacity: 0.7 }}>guest</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '16px', lineHeight: 1, padding: '2px 0', display: 'none' }}>...</div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Y/N + all boats/my boats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '-2px', marginBottom: '8px' }}>
        {selectedPaddlerId && (
          <div style={{ width: '52px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
          <div
            onClick={() => handleToggleAttendance(selectedPaddlerId, selectedEvent.id)}
            style={{
              width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', userSelect: 'none',
              border: `2px solid ${_isAttending ? '#22c55e' : '#ef4444'}`,
              backgroundColor: _isAttending ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: _isAttending ? '#22c55e' : '#ef4444',
              fontSize: '16px', fontWeight: 700,
            }}
          >
            {_isAttending ? 'Y' : 'N'}
          </div>
          </div>
        )}
        {!isAdmin && (
          <span
            onClick={() => setShowAllBoats(!showAllBoats)}
            style={{ cursor: 'pointer', fontSize: '18px', fontWeight: 800, color: '#475569', userSelect: 'none', padding: '4px 16px', backgroundColor: '#e2e8f0', borderRadius: '999px', whiteSpace: 'nowrap' }}
          >
            {showAllBoats ? 'SEE MY BOAT ASSIGNMENT' : 'SEE ALL BOAT ASSIGNMENTS'}
          </span>
        )}
        {isAdmin && (<>
          <div ref={sortPillRef} style={{ position: 'relative' }}>
            <span
              onClick={() => { setTempPriority(canoePriority); setSortPillOpen(!sortPillOpen); }}
              style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 800, color: '#475569', userSelect: 'none', padding: '2px 8px', backgroundColor: '#e2e8f0', borderRadius: '999px', whiteSpace: 'nowrap' }}
            >
              sort by:
            </span>
            {sortPillOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 40, overflow: 'hidden', minWidth: '160px', padding: '8px' }}>
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
                                backgroundColor: snapshot.isDragging ? '#dbeafe' : '#f1f5f9',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#334155',
                                cursor: 'grab',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                            >
                              <span style={{ color: '#94a3b8', fontSize: '12px' }}>{index + 1}.</span>
                              {{ ability: 'ability', gender: 'gender', type: 'racer?', seatPreference: 'seat' }[item.id]}
                              <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '12px' }}>⠿</span>
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
                  style={{ marginTop: '8px', padding: '6px 12px', backgroundColor: '#3b82f6', color: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: 700, textAlign: 'center', cursor: 'pointer' }}
                >
                  apply
                </div>
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <span
            onClick={handleAssign}
            style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 800, color: '#475569', userSelect: 'none', padding: '2px 8px', backgroundColor: '#e2e8f0', borderRadius: '999px', whiteSpace: 'nowrap' }}
          >
            {sidebarOpen ? '←' : '←assign'}
          </span>
          <span
            onClick={() => { triggerAnimation(); handleUnassignAll(); }}
            style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 800, color: '#475569', userSelect: 'none', padding: '2px 8px', backgroundColor: '#e2e8f0', borderRadius: '999px', whiteSpace: 'nowrap' }}
          >
            {sidebarOpen ? '→' : 'return→'}
          </span>
        </>)}
      </div>
      {(isAdmin || showAllBoats) ? (<>
      <div style={{ display: 'grid', gridTemplateColumns: `${boatWidth}px ${boatWidth}px`, gap: `${canoeMargin}px`, padding: `${canoeMargin}px 16px`, justifyContent: 'center' }}>
      {canoes?.map((canoe: Canoe, index: number) => {
        const canoeEventAssignments = canoeAssignmentsByCanoe.get(canoe.id) || [];
        return (
          <div
            key={canoe._id.toString()}
            style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
          >
            {/* Header row: BOAT: designation ... lock icon */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: '2px', position: 'relative' }}>
              <span
                className={`transition-colors ${isAdmin && !lockedCanoes.has(canoe.id) ? 'cursor-pointer hover:text-blue-400' : 'cursor-default'}`}
                onClick={() => isAdmin && !lockedCanoes.has(canoe.id) && setOpenDesignator(openDesignator === canoe.id ? null : canoe.id)}
                style={{
                  fontFamily: "'Courier New', Courier, monospace",
                  fontSize: '18px',
                  fontWeight: 900,
                  color: '#ffffff',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {sidebarOpen ? '' : 'BOAT: '}{canoeDesignations[canoe.id] || '???'}
              </span>
              {/* Designation selector dropdown */}
              {openDesignator === canoe.id && (
                <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setOpenDesignator(null)} />
                <div style={{ position: 'absolute', top: '100%', left: '4px', zIndex: 20 }}>
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-1.5 grid grid-cols-3 gap-1" style={{ minWidth: '110px' }}>
                    {CANOE_DESIGNATIONS.map(d => (
                      <button
                        key={d}
                        onClick={(e) => { e.stopPropagation(); updateDesignationMut({ canoeId: canoe.id, designation: d }); setOpenDesignator(null); }}
                        className="px-2 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-center transition-colors"
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
                      className="px-2 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded text-center transition-colors"
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
                fill="none" stroke={lockedCanoes.has(canoe.id) ? '#dc2626' : '#94a3b8'}
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
                          <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '18px', fontWeight: 700, color: '#4b5563', padding: '0 2px', lineHeight: 1 }}>{seat}.</div>
                        )}
                        <div style={{ display: 'none' }}>{provided.placeholder}</div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
            {/* -/+ buttons on last canoe */}
            {isAdmin && canoes && index === canoes.length - 1 && <div className="flex items-center" style={{ gap: '6px', padding: '4px 4px 0' }}>
              <span
                onClick={() => !lockedCanoes.has(canoe.id) && handleRemoveCanoe(canoe.id)}
                className={`transition-colors ${lockedCanoes.has(canoe.id) ? 'cursor-default' : 'hover:text-rose-600 hover:border-rose-400 cursor-pointer'}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '18px', height: '18px', borderRadius: '50%',
                  backgroundColor: '#000000', border: '1px solid #64748b',
                  fontSize: '13px', fontWeight: 700, lineHeight: 1,
                  color: lockedCanoes.has(canoe.id) ? '#cbd5e1' : '#94a3b8',
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
                  width: '18px', height: '18px', borderRadius: '50%',
                  backgroundColor: '#000000', border: '1px solid #64748b',
                  fontSize: '13px', fontWeight: 700, lineHeight: 1,
                  color: '#94a3b8',
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

      {/* Add Canoe button when no canoes exist */}
      {(!canoes || canoes.length === 0) && (
        <button
          onClick={() => addCanoe({ name: "Canoe 1" })}
          className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center gap-2"
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
        const monoStyle = { fontFamily: "'Courier New', Courier, monospace", textTransform: 'uppercase' as const };

        if (!myCanoe) {
          return (
            <div style={{ ...monoStyle, fontSize: '28px', fontWeight: 900, color: '#6b7280', textAlign: 'center', padding: '40px 0', letterSpacing: '2px' }}>
              NO ASSIGNMENT
            </div>
          );
        }

        return (
          <div style={{ padding: '20px 0' }}>
            <div style={{ ...monoStyle, fontSize: '32px', fontWeight: 900, color: '#ffffff', letterSpacing: '3px', marginBottom: '20px' }}>
              BOAT: {designation}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Array.from({ length: 6 }).map((_, i) => {
                const seat = i + 1;
                const assignment = myCanoeAssignments.find((a: { seat: number }) => a.seat === seat);
                const assignedPaddler = assignment ? (paddlers?.find((p: Paddler) => p.id === assignment.paddlerId) || guestPaddlerMap.get(assignment.paddlerId) || null) : null;
                const isMe = assignedPaddler?.id === currentUser.paddlerId;
                const isGuest = assignedPaddler?.id.startsWith('guest-');
                return (
                  <div key={seat} style={{ ...monoStyle, fontSize: '24px', fontWeight: 700, color: assignedPaddler ? '#ffffff' : '#6b7280', padding: '6px 0', borderBottom: '1px solid #222222', backgroundColor: isMe ? 'rgba(250, 204, 21, 0.15)' : 'transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ color: '#6b7280', marginRight: '12px' }}>{seat}.</span>
                      {assignedPaddler ? (
                        <span style={isMe ? { color: '#facc15', textShadow: '0 0 8px rgba(250, 204, 21, 0.4)' } : undefined}>
                          {assignedPaddler.firstName} {assignedPaddler.lastName}
                          {isGuest && <span style={{ fontSize: '14px', color: '#9ca3af', marginLeft: '8px', opacity: 0.7 }}>guest</span>}
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
