import { useState, useRef, useEffect, Fragment } from "react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { PaddlerCircle, GuestPaddlerCircle } from "./components/PaddlerCircle";
import type { Paddler, ViewBy, SortBy } from "./types";
import { TOOLBAR_SIZE, getViewSections, sortPaddlers } from "./utils";

interface StagingSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isDragging: boolean;
  dragFromStaging: boolean;
  viewBy: ViewBy;
  setViewBy: (v: ViewBy) => void;
  unassignedPaddlers: Paddler[];
  unassignedGuests: any[];
  guestPaddlerMap: Map<string, Paddler>;
  pendingAssignIds: Set<string>;
  animationKey: number;
  isAdmin: boolean;
  selectedEvent: { id: string } | null;
  showAddSearch: boolean;
  setShowAddSearch: (open: boolean) => void;
  addSearchQuery: string;
  setAddSearchQuery: (q: string) => void;
  addSearchInputRef: React.RefObject<HTMLInputElement | null>;
  addSearchMenuRef: React.RefObject<HTMLDivElement | null>;
  paddlers: Paddler[] | undefined;
  eventAttendingPaddlerIds: Set<string> | null;
  setAttendanceMut: (args: { paddlerId: string; eventId: string; attending: boolean }) => void;
}

export function StagingSidebar({
  sidebarOpen, setSidebarOpen, isDragging,
  viewBy, setViewBy, unassignedPaddlers, unassignedGuests, guestPaddlerMap,
  pendingAssignIds, animationKey, isAdmin, selectedEvent,
  showAddSearch, setShowAddSearch, addSearchQuery, setAddSearchQuery,
  addSearchInputRef, addSearchMenuRef, paddlers, eventAttendingPaddlerIds, setAttendanceMut,
}: StagingSidebarProps) {
  const [sectionSorts, setSectionSorts] = useState<{ [sectionId: string]: SortBy }>({});
  const [openSortMenu, setOpenSortMenu] = useState<string | null>(null);
  const openSortMenuRef = useRef<HTMLDivElement>(null);

  const viewSections = getViewSections(unassignedPaddlers, viewBy);

  const handleSectionSort = (sectionId: string, sortBy: SortBy) => {
    setSectionSorts(prev => ({ ...prev, [sectionId]: sortBy }));
  };

  // Close sort menus on click outside
  useEffect(() => {
    if (!openSortMenu) return;
    const handler = (e: MouseEvent) => {
      if (openSortMenu && openSortMenuRef.current && !openSortMenuRef.current.contains(e.target as Node)) {
        setOpenSortMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openSortMenu]);

  return (
    <div
      className="scrollbar-hidden"
      style={{
        width: sidebarOpen ? 210 : 32,
        height: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflowY: isDragging ? 'hidden' : sidebarOpen ? 'auto' : 'hidden',
        overflowX: 'hidden',
        touchAction: isDragging ? 'none' : 'auto',
        backgroundColor: sidebarOpen ? '#faf9f7' : 'transparent',
        padding: sidebarOpen ? '16px 10px 0 10px' : '16px 4px 0 4px',
        paddingBottom: 0,
        borderLeft: '1px solid rgba(0,0,0,.08)',
      }}
    >
      {/* Toolbar - sticky */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: sidebarOpen ? '#faf9f7' : 'transparent', padding: sidebarOpen ? '0 0 8px' : '0', borderBottom: sidebarOpen ? '1px solid rgba(0,0,0,.08)' : 'none', marginBottom: sidebarOpen ? '8px' : 0 }} className="relative">
        {/* Top row: toggle + A button */}
        <div className="flex items-center" style={{ marginBottom: sidebarOpen ? '4px' : 0 }}>
          <span
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 800,
              color: '#005280',
              userSelect: 'none',
              padding: '2px 8px',
              backgroundColor: 'rgba(0, 82, 128, 0.06)',
              borderRadius: '6px',
            }}
          >
            {sidebarOpen ? '›››' : '‹'}
          </span>

        {sidebarOpen && (
          <div ref={openSortMenu === 'viewby' ? openSortMenuRef : undefined} style={{ position: 'relative', marginLeft: 'auto' }}>
            <span
              onClick={() => setOpenSortMenu(openSortMenu === 'viewby' ? null : 'viewby')}
              style={{
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 800,
                color: '#005280',
                userSelect: 'none',
                padding: '2px 8px',
                backgroundColor: 'rgba(0, 82, 128, 0.06)',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              {{ gender: 'gender', type: 'racer', seatPreference: 'seat', ability: 'ability' }[viewBy]}
            </span>
            {openSortMenu === 'viewby' && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 50, overflow: 'hidden', minWidth: '100px' }}>
                {[
                  { id: "gender", label: "gender" },
                  { id: "type", label: "racer" },
                  { id: "seatPreference", label: "seat" },
                  { id: "ability", label: "ability" },
                ].map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => { setViewBy(opt.id as ViewBy); setOpenSortMenu(null); }}
                    style={{ padding: '8px 12px', fontSize: '13px', fontWeight: viewBy === opt.id ? 700 : 500, color: viewBy === opt.id ? '#222222' : '#717171', backgroundColor: viewBy === opt.id ? '#faf9f7' : '#fff', cursor: 'pointer' }}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>

      {sidebarOpen && (
      <>
        {/* Second row: Edit/Trash/+ icons */}
        <div className="flex items-center gap-1">
          <Droppable droppableId="edit-area">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="rounded-full border-[3px] flex items-center justify-center transition-all"
                style={{
                  width: TOOLBAR_SIZE,
                  height: TOOLBAR_SIZE,
                  backgroundColor: snapshot.isDraggingOver ? '#facc15' : '#faf9f7',
                  borderColor: snapshot.isDraggingOver ? '#fde047' : 'rgba(0,0,0,.12)',
                  transform: snapshot.isDraggingOver ? 'scale(1.1)' : 'scale(1)',
                }}
                title="Drag paddlers here to edit"
              >
                <span style={{ fontSize: '16px' }}>✏️</span>
                <div style={{ display: 'none' }}>{provided.placeholder}</div>
              </div>
            )}
          </Droppable>
          <Droppable droppableId="trash-can">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="rounded-full border-[3px] flex items-center justify-center transition-all"
                style={{
                  width: TOOLBAR_SIZE,
                  height: TOOLBAR_SIZE,
                  backgroundColor: snapshot.isDraggingOver ? '#f87171' : '#faf9f7',
                  borderColor: snapshot.isDraggingOver ? '#fca5a5' : 'rgba(0,0,0,.12)',
                  transform: snapshot.isDraggingOver ? 'scale(1.1)' : 'scale(1)',
                }}
                title="Drag paddlers here to mark absent"
              >
                <span style={{ fontSize: '16px' }}>🗑️</span>
                <div style={{ display: 'none' }}>{provided.placeholder}</div>
              </div>
            )}
          </Droppable>
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => {
                if (!selectedEvent) return;
                setShowAddSearch(!showAddSearch);
                setAddSearchQuery('');
                setTimeout(() => addSearchInputRef.current?.focus(), 50);
              }}
              className={`rounded-full border-[3px] flex items-center justify-center transition-all ${selectedEvent ? 'cursor-pointer hover:opacity-80' : 'opacity-40 cursor-not-allowed'}`}
              style={{ width: TOOLBAR_SIZE, height: TOOLBAR_SIZE, fontSize: '26px', lineHeight: 1, backgroundColor: '#faf9f7', borderColor: 'rgba(0,0,0,.12)', color: '#222222' }}
              title={selectedEvent ? 'Add paddler to event' : 'Select an event first'}
            >
              +
            </div>
          </div>
        </div>
        {showAddSearch && selectedEvent && (
            <div ref={addSearchMenuRef} style={{ position: 'absolute', left: '4px', right: '4px', zIndex: 30, backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '8px', marginTop: '4px' }}>
              <input
                ref={addSearchInputRef}
                type="text"
                value={addSearchQuery}
                onChange={(e) => setAddSearchQuery(e.target.value)}
                placeholder="search paddler..."
                style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid rgba(0,0,0,.12)', backgroundColor: '#faf9f7', color: '#222222', outline: 'none', boxSizing: 'border-box' }}
                autoFocus
              />
              <div style={{ marginTop: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                {(() => {
                  const query = addSearchQuery.toLowerCase().trim();
                  if (!query || !paddlers) return null;
                  const matches = paddlers.filter((p: Paddler) => {
                    if (eventAttendingPaddlerIds?.has(p.id)) return false;
                    const fullName = `${p.firstName} ${p.lastName || ''}`.toLowerCase();
                    return fullName.includes(query);
                  }).slice(0, 8);
                  if (matches.length === 0) return <div style={{ fontSize: '13px', color: '#717171', padding: '4px 8px' }}>no matches</div>;
                  return matches.map((p: Paddler) => (
                    <div
                      key={p.id}
                      onClick={async () => {
                        await setAttendanceMut({ paddlerId: p.id, eventId: selectedEvent.id, attending: true });
                        setShowAddSearch(false);
                        setAddSearchQuery('');
                      }}
                      style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 500, color: '#717171', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#faf9f7'; e.currentTarget.style.color = '#222222'; e.currentTarget.style.fontWeight = '700'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.color = '#717171'; e.currentTarget.style.fontWeight = '500'; }}
                    >
                      {p.firstName} {p.lastName ? p.lastName[0] + '.' : ''}
                    </div>
                  ));
                })()}
              </div>
            </div>
        )}
      </>
      )}
      </div>

      {sidebarOpen && (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Staging - single drop zone. Stays enabled even while dragging
          FROM the pool: a disabled droppable is hidden from
          dragSnapshot.draggingOver, which breaks any "over the pool"
          detection (e.g. the seat→chip clone morph in TodayView).
          onDragEnd already short-circuits same-droppable drops, and
          the staging-* branch no-ops when there's no oldCanoeId, so
          drop-onto-self stays a no-op. */}
      <Droppable droppableId="staging-all" direction="vertical">
        {(provided, snapshot) => {
          // Flatten all sections into one ordered list for draggable indices
          const allPaddlers: Paddler[] = [];
          const sectionBreaks: { index: number; label: string; id: string }[] = [];
          if (viewSections.length > 0) {
            viewSections.forEach((section) => {
              const sectionSort = sectionSorts[section.id] || "gender";
              const sorted = sortPaddlers(section.paddlers, sectionSort).filter(p => !pendingAssignIds.has(p.id));
              sectionBreaks.push({ index: allPaddlers.length, label: section.label, id: section.id });
              allPaddlers.push(...sorted);
            });
          }

          return (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`rounded-lg transition-colors flex flex-col
                ${snapshot.isDraggingOver ? 'bg-amber-50 ring-2 ring-amber-400/50' : ''}`}
              style={{ padding: '4px 6px', marginTop: '8px', flex: 1, minHeight: '100px' }}
            >
              {allPaddlers.length > 0 ? allPaddlers.map((paddler: Paddler, index: number) => {
                const sectionBreak = sectionBreaks.find(b => b.index === index);
                return (
                  <Fragment key={paddler._id.toString()}>
                    {sectionBreak && (
                      <div className="flex items-center justify-between w-full" style={{ padding: '8px 0 4px', borderBottom: '1px solid rgba(0,0,0,.06)', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '12px', color: '#717171', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {sectionBreak.label} ({viewSections.find(s => s.id === sectionBreak.id)?.paddlers.length})
                        </span>
                        <div ref={openSortMenu === sectionBreak.id ? openSortMenuRef : undefined} style={{ position: 'relative' }}>
                          <span
                            onClick={() => setOpenSortMenu(openSortMenu === sectionBreak.id ? null : sectionBreak.id)}
                            style={{
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: 800,
                              color: '#005280',
                              userSelect: 'none',
                              padding: '2px 8px',
                              backgroundColor: 'rgba(0, 82, 128, 0.06)',
                              borderRadius: '6px',
                            }}
                          >
                            {{ gender: 'G', type: 'R', seatPreference: 'S', ability: 'A' }[sectionSorts[sectionBreak.id] || 'gender']}
                          </span>
                          {openSortMenu === sectionBreak.id && (
                            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 50, overflow: 'hidden', minWidth: '100px' }}>
                              {[
                                { id: "gender", label: "gender" },
                                { id: "type", label: "racer" },
                                { id: "seatPreference", label: "seat" },
                                { id: "ability", label: "ability" },
                              ].map((sort) => (
                                <div
                                  key={sort.id}
                                  onClick={() => { handleSectionSort(sectionBreak.id, sort.id as SortBy); setOpenSortMenu(null); }}
                                  style={{ padding: '8px 12px', fontSize: '13px', fontWeight: (sectionSorts[sectionBreak.id] || 'gender') === sort.id ? 700 : 500, color: (sectionSorts[sectionBreak.id] || 'gender') === sort.id ? '#222222' : '#717171', backgroundColor: (sectionSorts[sectionBreak.id] || 'gender') === sort.id ? '#faf9f7' : '#fff', cursor: 'pointer' }}
                                >
                                  {sort.label}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <Draggable draggableId={paddler.id} index={index} shouldRespectForcePress={false}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          tabIndex={-1}
                          role="none"
                          aria-roledescription=""
                          style={{ ...provided.draggableProps.style, touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', marginBottom: 4, display: 'flex', alignItems: 'center' }}
                        >
                          <PaddlerCircle paddler={paddler} isDragging={snapshot.isDragging} animationKey={animationKey} animationDelay={index * 20} isAdmin={isAdmin} variant="sidebar" />
                        </div>
                      )}
                    </Draggable>
                  </Fragment>
                );
              }) : (
                <span className="text-sm w-full text-center mt-4" style={{ color: '#c0c0c0' }}>drag paddlers here to unassign</span>
              )}
              {provided.placeholder}
            </div>
          );
        }}
      </Droppable>
      {/* Guest paddler circles (draggable). staging-guests stays
          enabled during pool drags for the same reason as staging-all
          above (don't hide from dragSnapshot.draggingOver). */}
      {unassignedGuests.length > 0 && (
        <Droppable droppableId="staging-guests" direction="vertical">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              style={{ padding: '4px 6px', marginTop: '8px' }}
            >
              <span className="font-semibold text-sm" style={{ color: '#f59e0b', display: 'block', padding: '4px 0 2px' }}>
                guests ({unassignedGuests.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {unassignedGuests.map((guest: any, index: number) => {
                  const guestId = `guest-${guest._id}`;
                  const guestPaddler = guestPaddlerMap.get(guestId);
                  if (!guestPaddler) return null;
                  return (
                    <Draggable draggableId={guestId} index={index} key={guestId} shouldRespectForcePress={false}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          tabIndex={-1}
                          role="none"
                          aria-roledescription=""
                          style={{ ...provided.draggableProps.style, touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', marginBottom: 4, display: 'flex', alignItems: 'center' }}
                        >
                          <GuestPaddlerCircle paddler={guestPaddler} isDragging={snapshot.isDragging} variant="sidebar" />
                        </div>
                      )}
                    </Draggable>
                  );
                })}
              </div>
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      )}
      </div>
      )}
      {/* Bottom spacer to keep content above iOS browser bar */}
      <div style={{ flexShrink: 0, height: 80, minHeight: 80 }} />
    </div>
  );
}
