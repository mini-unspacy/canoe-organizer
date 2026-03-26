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
  sidebarOpen, setSidebarOpen, isDragging, dragFromStaging,
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
        width: sidebarOpen ? 170 : 24,
        height: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflowY: isDragging ? 'hidden' : sidebarOpen ? 'auto' : 'hidden',
        overflowX: 'hidden',
        touchAction: isDragging ? 'none' : 'auto',
        backgroundColor: sidebarOpen ? '#000000' : 'transparent',
        padding: sidebarOpen ? '12px 4px 0 4px' : '12px 0 0 0',
        paddingBottom: 0,
        borderLeft: '1px solid #94a3b8',
      }}
    >
      {/* Toolbar - sticky */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: sidebarOpen ? '#000000' : 'transparent', padding: '12px 4px 0 4px' }} className="relative">
        {/* Top row: toggle + A button */}
        <div className="flex items-center" style={{ marginBottom: sidebarOpen ? '4px' : 0 }}>
          <span
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 800,
              color: '#475569',
              userSelect: 'none',
              padding: '2px 8px',
              backgroundColor: '#e2e8f0',
              borderRadius: '999px',
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
                color: '#475569',
                userSelect: 'none',
                padding: '2px 8px',
                backgroundColor: '#e2e8f0',
                borderRadius: '999px',
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
                    style={{ padding: '8px 12px', fontSize: '13px', fontWeight: viewBy === opt.id ? 700 : 500, color: viewBy === opt.id ? '#1e293b' : '#64748b', backgroundColor: viewBy === opt.id ? '#f1f5f9' : '#fff', cursor: 'pointer' }}
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
                  backgroundColor: snapshot.isDraggingOver ? '#facc15' : '#000',
                  borderColor: snapshot.isDraggingOver ? '#fde047' : '#9ca3af',
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
                  backgroundColor: snapshot.isDraggingOver ? '#f87171' : '#000',
                  borderColor: snapshot.isDraggingOver ? '#fca5a5' : '#9ca3af',
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
              style={{ width: TOOLBAR_SIZE, height: TOOLBAR_SIZE, fontSize: '26px', lineHeight: 1, backgroundColor: '#000', borderColor: '#9ca3af', color: '#fff' }}
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
                style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', color: '#1e293b', outline: 'none', boxSizing: 'border-box' }}
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
                  if (matches.length === 0) return <div style={{ fontSize: '13px', color: '#64748b', padding: '4px 8px' }}>no matches</div>;
                  return matches.map((p: Paddler) => (
                    <div
                      key={p.id}
                      onClick={async () => {
                        await setAttendanceMut({ paddlerId: p.id, eventId: selectedEvent.id, attending: true });
                        setShowAddSearch(false);
                        setAddSearchQuery('');
                      }}
                      style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 500, color: '#64748b', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#1e293b'; e.currentTarget.style.fontWeight = '700'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.fontWeight = '500'; }}
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
      {/* Staging - single drop zone */}
      <Droppable droppableId="staging-all" direction="vertical" isDropDisabled={dragFromStaging}>
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
                ${snapshot.isDraggingOver ? 'bg-amber-50 dark:bg-amber-950/30 ring-2 ring-amber-400/50' : ''}`}
              style={{ padding: '4px 6px', marginTop: '8px', flex: 1, minHeight: '100px' }}
            >
              {allPaddlers.length > 0 ? allPaddlers.map((paddler: Paddler, index: number) => {
                const sectionBreak = sectionBreaks.find(b => b.index === index);
                return (
                  <Fragment key={paddler._id.toString()}>
                    {sectionBreak && (
                      <div className="flex items-center justify-between w-full" style={{ padding: '4px 0 2px' }}>
                        <span className="font-semibold text-sm" style={{ color: '#c0c0c0' }}>
                          {sectionBreak.label} ({viewSections.find(s => s.id === sectionBreak.id)?.paddlers.length})
                        </span>
                        <div ref={openSortMenu === sectionBreak.id ? openSortMenuRef : undefined} style={{ position: 'relative' }}>
                          <span
                            onClick={() => setOpenSortMenu(openSortMenu === sectionBreak.id ? null : sectionBreak.id)}
                            style={{
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: 800,
                              color: '#475569',
                              userSelect: 'none',
                              padding: '2px 8px',
                              backgroundColor: '#e2e8f0',
                              borderRadius: '999px',
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
                                  style={{ padding: '8px 12px', fontSize: '13px', fontWeight: (sectionSorts[sectionBreak.id] || 'gender') === sort.id ? 700 : 500, color: (sectionSorts[sectionBreak.id] || 'gender') === sort.id ? '#1e293b' : '#64748b', backgroundColor: (sectionSorts[sectionBreak.id] || 'gender') === sort.id ? '#f1f5f9' : '#fff', cursor: 'pointer' }}
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
                          style={{ ...provided.draggableProps.style, touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', width: '100%', height: '22px', display: 'flex', alignItems: 'center' }}
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
      {/* Guest paddler circles (draggable) */}
      {unassignedGuests.length > 0 && (
        <Droppable droppableId="staging-guests" direction="vertical" isDropDisabled={dragFromStaging}>
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
                          style={{ ...provided.draggableProps.style, touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', width: '100%', height: '22px', display: 'flex', alignItems: 'center' }}
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
