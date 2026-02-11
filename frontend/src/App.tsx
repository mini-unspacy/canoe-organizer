import { useMutation, useQuery } from "convex/react";
import { api } from "./convex_generated/api";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import type { Doc } from "./convex_generated/dataModel";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";

type Paddler = Doc<"paddlers">;
type Canoe = Doc<"canoes">;

type ViewBy = "ability" | "gender" | "type" | "seatPreference";
type SortBy = "ability" | "gender" | "type" | "seatPreference";
type CanoeSortBy = "ability" | "gender" | "type" | "seatPreference";

interface CanoeSortItem {
  id: CanoeSortBy;
  label: string;
  gradient: string;
  icon: string;
}

const CIRCLE_SIZE = 44;
const PADDING = 8;
const TOTAL_CIRCLE_SPACE = CIRCLE_SIZE + PADDING;

const CANOE_SORT_OPTIONS: CanoeSortItem[] = [
  { id: "ability", label: "Ability", gradient: "from-violet-500 to-purple-600", icon: "⭐" },
  { id: "gender", label: "Gender", gradient: "from-pink-500 to-rose-500", icon: "⚥" },
  { id: "type", label: "Racer?", gradient: "from-cyan-500 to-blue-500", icon: "🏁" },
  { id: "seatPreference", label: "Seat", gradient: "from-orange-500 to-amber-500", icon: "💺" },
];

// Get primary seat preference
const getPrimarySeatPreference = (pref: string | undefined): number | null => {
  if (!pref) return null;
  const seats = pref.split('').map(Number).filter(n => n >= 1 && n <= 6);
  return seats.length > 0 ? seats[0] : null;
};

// Sort paddlers by canoe priority
const sortPaddlersByPriority = (paddlers: Paddler[], priority: CanoeSortItem[]): Paddler[] => {
  return [...paddlers].sort((a, b) => {
    for (const p of priority) {
      let comparison = 0;
      switch (p.id) {
        case "ability":
          comparison = b.ability - a.ability;
          break;
        case "gender":
          comparison = a.gender.localeCompare(b.gender);
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "seatPreference":
          const prefA = getPrimarySeatPreference(a.seatPreference) || 999;
          const prefB = getPrimarySeatPreference(b.seatPreference) || 999;
          comparison = prefA - prefB;
          break;
      }
      if (comparison !== 0) return comparison;
    }
    return 0;
  });
};

// Generate random paddler - racer/casual/very-casual are three options under "racer?"
const generateRandomPaddler = () => {
  const kaneFirstNames = ["James", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles", "Daniel", "Matthew", "Anthony"];
  const wahineFirstNames = ["Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen", "Lisa", "Nancy"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez"];
  
  const typeRoll = Math.random();
  let type: "racer" | "casual" | "very-casual";
  if (typeRoll > 0.5) type = "racer";
  else if (typeRoll > 0.25) type = "casual";
  else type = "very-casual";
  
  const gender = Math.random() > 0.5 ? "kane" : "wahine" as const;
  const firstName = gender === "kane" 
    ? kaneFirstNames[Math.floor(Math.random() * kaneFirstNames.length)]
    : wahineFirstNames[Math.floor(Math.random() * wahineFirstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  return {
    firstName,
    lastName,
    gender,
    type,
    ability: Math.floor(Math.random() * 5) + 1,
    seatPreference: Math.random() > 0.3 
      ? String(Math.floor(Math.random() * 6) + 1).repeat(Math.floor(Math.random() * 4) + 1).padEnd(6, '0')
      : "000000"
  };
};

const PaddlerCircle: React.FC<{ paddler: Paddler; isDragging?: boolean }> = ({ paddler, isDragging }) => {
  const abilityColor = paddler.ability === 5 
    ? 'from-emerald-400 to-emerald-600'
    : paddler.ability >= 3 
      ? 'from-amber-400 to-amber-600'
      : 'from-rose-400 to-rose-600';
  
  const genderBorderColor = paddler.gender === 'kane' ? '#3b82f6' : '#ec4899';
  const seatPref = getPrimarySeatPreference(paddler.seatPreference);
  
  // Display name: truncated first name + last initial (e.g., "JohS" for John Smith)
  const lastInitial = paddler.lastName?.[0] || paddler.lastInitial || '?';
  const maxFirstNameLen = 5;
  const truncatedFirst = paddler.firstName.length > maxFirstNameLen 
    ? paddler.firstName.slice(0, maxFirstNameLen) 
    : paddler.firstName;
  const displayName = `${truncatedFirst}${lastInitial}`;

  return (
    <div className="relative">
      <div
        className={`rounded-full flex flex-col items-center justify-center font-bold text-white 
          border-2 shadow-md bg-gradient-to-br ${abilityColor}
          ${isDragging ? 'scale-110 shadow-xl ring-2 ring-white/50' : 'hover:scale-105'}
          transition-all duration-150 cursor-grab active:cursor-grabbing relative overflow-hidden`}
        style={{
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
          borderColor: genderBorderColor
        }}
      >
        {/* Name - smaller font to fit with badges */}
        <span className="text-[10px] leading-tight text-center px-1 truncate max-w-full">
          {displayName}
        </span>
        
        {/* Badges row inside circle at bottom */}
        <div className="flex items-center justify-center gap-0.5 mt-0.5">
          {/* Ability dot */}
          <span className="text-[6px] bg-black/30 rounded px-0.5">{paddler.ability}</span>
          
          {/* Type dot */}
          <span className={`text-[6px] rounded px-0.5 ${
            paddler.type === 'racer' ? 'bg-purple-500/80' : 
            paddler.type === 'casual' ? 'bg-blue-500/80' : 'bg-slate-400/80'
          }`}>
            {paddler.type === 'racer' ? 'R' : paddler.type === 'casual' ? 'C' : 'V'}
          </span>
          
          {/* Seat preference dot */}
          {seatPref && (
            <span className="text-[6px] bg-orange-500/80 rounded px-0.5">{seatPref}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// Get view sections based on active view
const getViewSections = (paddlers: Paddler[], viewBy: ViewBy): { id: string; label: string; paddlers: Paddler[] }[] => {
  switch (viewBy) {
    case "ability": {
      const sections = [];
      for (let i = 5; i >= 1; i--) {
        const sectionPaddlers = paddlers.filter(p => p.ability === i);
        if (sectionPaddlers.length > 0) {
          sections.push({ id: `ability-${i}`, label: `Level ${i}`, paddlers: sectionPaddlers });
        }
      }
      return sections;
    }
    case "gender": {
      const kane = paddlers.filter(p => p.gender === "kane");
      const wahine = paddlers.filter(p => p.gender === "wahine");
      const sections = [];
      if (kane.length > 0) sections.push({ id: "gender-kane", label: "Kane", paddlers: kane });
      if (wahine.length > 0) sections.push({ id: "gender-wahine", label: "Wahine", paddlers: wahine });
      return sections;
    }
    case "type": {
      const racer = paddlers.filter(p => p.type === "racer");
      const casual = paddlers.filter(p => p.type === "casual");
      const veryCasual = paddlers.filter(p => p.type === "very-casual");
      const sections = [];
      if (racer.length > 0) sections.push({ id: "type-racer", label: "Racer", paddlers: racer });
      if (casual.length > 0) sections.push({ id: "type-casual", label: "Casual", paddlers: casual });
      if (veryCasual.length > 0) sections.push({ id: "type-very-casual", label: "Very Casual", paddlers: veryCasual });
      return sections;
    }
    case "seatPreference": {
      const sections = [];
      for (let seat = 1; seat <= 6; seat++) {
        const sectionPaddlers = paddlers.filter(p => getPrimarySeatPreference(p.seatPreference) === seat);
        if (sectionPaddlers.length > 0) {
          sections.push({ id: `seat-${seat}`, label: `Seat ${seat}`, paddlers: sectionPaddlers });
        }
      }
      const noPref = paddlers.filter(p => !p.seatPreference || p.seatPreference === "000000");
      if (noPref.length > 0) {
        sections.push({ id: "seat-none", label: "No Pref", paddlers: noPref });
      }
      return sections;
    }
  }
};

// Sort paddlers within a section
const sortPaddlers = (paddlers: Paddler[], sortBy: SortBy): Paddler[] => {
  return [...paddlers].sort((a, b) => {
    switch (sortBy) {
      case "ability":
        return b.ability - a.ability;
      case "gender":
        return a.gender.localeCompare(b.gender);
      case "type":
        return a.type.localeCompare(b.type);
      case "seatPreference":
        const prefA = getPrimarySeatPreference(a.seatPreference) || 999;
        const prefB = getPrimarySeatPreference(b.seatPreference) || 999;
        return prefA - prefB;
      default:
        return 0;
    }
  });
};

function App() {
  const canoes = useQuery(api.canoes.getCanoes);
  const paddlers = useQuery(api.paddlers.getPaddlers);
  const assignPaddler = useMutation(api.canoes.assignPaddlerToSeat);
  const unassignPaddler = useMutation(api.canoes.unassignPaddler);
  const assignOptimal = useMutation(api.canoes.assignOptimal);
  const populatePaddlers = useMutation(api.paddlers.populateSamplePaddlers);
  const populateCanoes = useMutation(api.canoes.populateSampleCanoes);
  // Unused: clearPaddlers, clearCanoes
  // const _clearPaddlers = useMutation(api.paddlers.clearAllPaddlers);
  // const _clearCanoes = useMutation(api.canoes.clearAllCanoes);
  const addCanoe = useMutation(api.canoes.addCanoe);
  const removeCanoe = useMutation(api.canoes.removeCanoe);
  const addPaddler = useMutation(api.paddlers.addPaddler);

  // Canoe sort priority (draggable) - persist to localStorage
  const [canoePriority, setCanoePriority] = useState<CanoeSortItem[]>(() => {
    const saved = localStorage.getItem('canoePriority');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate that all required IDs are present
        const requiredIds = CANOE_SORT_OPTIONS.map(o => o.id);
        const hasAllIds = requiredIds.every(id => parsed.some((p: CanoeSortItem) => p.id === id));
        if (hasAllIds) return parsed;
      } catch { /* fall through to default */ }
    }
    return CANOE_SORT_OPTIONS;
  });
  
  // Persist canoePriority to localStorage
  useEffect(() => {
    localStorage.setItem('canoePriority', JSON.stringify(canoePriority));
  }, [canoePriority]);
  
  // Staging view and sort
  const [viewBy, setViewBy] = useState<ViewBy>("ability");
  const [sectionSorts, setSectionSorts] = useState<{ [sectionId: string]: SortBy }>({});
  const [hoveredCanoe, setHoveredCanoe] = useState<string | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);

  // Smart canoe display - start with minimum needed, but user can add more
  useEffect(() => {
    if (!paddlers || !canoes) return;
    const neededCanoes = Math.ceil(paddlers.length / 6);
    // Only add if we have fewer than needed (never remove)
    if (neededCanoes > canoes.length) {
      for (let i = canoes.length; i < neededCanoes; i++) {
        addCanoe({ name: `Canoe ${i + 1}` });
      }
    }
  }, [paddlers?.length, canoes?.length]);

  // Canoe sorted paddlers for display
  const canoeSortedPaddlers = useMemo(() => 
    paddlers ? sortPaddlersByPriority(paddlers, canoePriority) : [],
  [paddlers, canoePriority]);

  const unassignedPaddlers = useMemo(() => 
    paddlers ? paddlers.filter((p: Paddler) => !p.assignedCanoe) : [],
  [paddlers]);

  const viewSections = useMemo(() => 
    getViewSections(unassignedPaddlers, viewBy),
  [unassignedPaddlers, viewBy]);

  // Auto-reassign canoes when canoe priority changes
  const prevCanoePriorityRef = useRef<string>("");
  useEffect(() => {
    const priorityKey = canoePriority.map(p => p.id).join(",");
    if (prevCanoePriorityRef.current && prevCanoePriorityRef.current !== priorityKey && !isReassigning) {
      handleReassignCanoes();
    }
    prevCanoePriorityRef.current = priorityKey;
  }, [canoePriority]);

  const handleReassignCanoes = useCallback(async () => {
    if (!paddlers || !canoes || isReassigning) return;
    setIsReassigning(true);
    
    const assignedPaddlers = paddlers.filter((p: Paddler) => p.assignedCanoe && p.assignedSeat);
    assignedPaddlers.sort((a: Paddler, b: Paddler) => {
      const canoeA = canoes.find((c: Canoe) => c.id === a.assignedCanoe);
      const canoeB = canoes.find((c: Canoe) => c.id === b.assignedCanoe);
      const canoeIdxA = canoes.indexOf(canoeA!);
      const canoeIdxB = canoes.indexOf(canoeB!);
      if (canoeIdxA !== canoeIdxB) return canoeIdxA - canoeIdxB;
      return (a.assignedSeat || 0) - (b.assignedSeat || 0);
    });
    
    const sortedAssigned = canoeSortedPaddlers.filter(p => p.assignedCanoe);
    
    // Parallel execution for speed
    const updates = [];
    for (let i = 0; i < Math.min(assignedPaddlers.length, sortedAssigned.length); i++) {
      const current = assignedPaddlers[i];
      const target = sortedAssigned[i];
      
      if (current.id !== target.id) {
        updates.push(
          assignPaddler({
            paddlerId: target.id,
            canoeId: current.assignedCanoe!,
            seat: current.assignedSeat!,
          })
        );
      }
    }
    
    await Promise.all(updates);
    setIsReassigning(false);
  }, [paddlers, canoes, canoeSortedPaddlers, isReassigning]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    // Handle canoe priority reordering
    if (source.droppableId === "canoe-priority") {
      const newPriority = Array.from(canoePriority);
      const [reorderedItem] = newPriority.splice(source.index, 1);
      newPriority.splice(destination.index, 0, reorderedItem);
      setCanoePriority(newPriority);
      return;
    }

    const draggedPaddler = paddlers?.find((p: Paddler) => p.id === draggableId);
    if (!draggedPaddler) return;

    const oldCanoeId = draggedPaddler.assignedCanoe;
    const oldSeat = draggedPaddler.assignedSeat;

    if (source.droppableId === destination.droppableId) return;

    // Dropped to staging
    if (destination.droppableId.startsWith("staging-")) {
      if (oldCanoeId && oldSeat) {
        await unassignPaddler({ paddlerId: draggableId, canoeId: oldCanoeId, seat: oldSeat });
      }
      return;
    }

    // Parse destination
    const destParts = destination.droppableId.split("-");
    if (destParts.length !== 4 || destParts[0] !== "canoe" || destParts[2] !== "seat") return;
    
    const destCanoeId = destParts[1];
    const destSeat = parseInt(destParts[3]);
    if (isNaN(destSeat)) return;

    const targetCanoe = canoes?.find((c: Canoe) => c.id === destCanoeId);
    if (!targetCanoe) return;

    const existingAssignment = targetCanoe.assignments.find((a: { seat: number; paddlerId: string }) => a.seat === destSeat);
    const existingPaddlerId = existingAssignment?.paddlerId;

    // SWAP - handle seamlessly without going through staging
    if (existingPaddlerId && existingPaddlerId !== draggableId) {
      const existingPaddler = paddlers?.find((p: Paddler) => p.id === existingPaddlerId);
      if (existingPaddler && oldCanoeId && oldSeat) {
        // Direct swap - both operations in parallel
        await Promise.all([
          unassignPaddler({ paddlerId: existingPaddlerId, canoeId: destCanoeId, seat: destSeat }),
          assignPaddler({ paddlerId: existingPaddlerId, canoeId: oldCanoeId, seat: oldSeat })
        ]);
      } else {
        await unassignPaddler({ paddlerId: existingPaddlerId, canoeId: destCanoeId, seat: destSeat });
      }
    }

    // Only unassign if we're actually moving (not just swapping)
    if (oldCanoeId && oldSeat && (oldCanoeId !== destCanoeId || oldSeat !== destSeat)) {
      await unassignPaddler({ paddlerId: draggableId, canoeId: oldCanoeId, seat: oldSeat });
    }

    await assignPaddler({ paddlerId: draggableId, canoeId: destCanoeId, seat: destSeat });
  };

  const handleAddPaddler = async () => {
    const newPaddler = generateRandomPaddler();
    await addPaddler(newPaddler);
  };

  const handleRemoveCanoe = (canoeId: string) => {
    removeCanoe({ canoeId });
  };

  const handleAddCanoeAfter = (_index: number) => {
    const nextNum = (canoes?.length || 0) + 1;
    addCanoe({ name: `Canoe ${nextNum}` });
  };

  const handleUnassignAll = async () => {
    if (!paddlers) return;
    // Use Promise.all for parallel execution - much faster!
    const assignedPaddlers = paddlers.filter((p: Paddler) => p.assignedCanoe && p.assignedSeat);
    await Promise.all(
      assignedPaddlers.map((p: Paddler) => 
        unassignPaddler({ paddlerId: p.id, canoeId: p.assignedCanoe!, seat: p.assignedSeat! })
      )
    );
  };

  const handleSectionSort = (sectionId: string, sortBy: SortBy) => {
    setSectionSorts(prev => ({ ...prev, [sectionId]: sortBy }));
  };

  const hasNoData = (!canoes || canoes.length === 0) && (!paddlers || paddlers.length === 0);

  // Calculate canoe width
  const canoeWidth = (TOTAL_CIRCLE_SPACE * 6) + 140;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {/* Header - only logo and title */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <span className="text-xl">🛶</span>
              </div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Canoe Crew</h1>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">
          {hasNoData ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-6">
                <span className="text-4xl">🛶</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Canoe Crew</h2>
              <p className="text-slate-500 dark:text-slate-400 text-center max-w-md mb-8">Load sample data to get started</p>
              <button onClick={() => { populatePaddlers(); populateCanoes(); }} className="px-6 py-3 text-base font-medium rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl transition-shadow">
                🚀 Load Sample Data
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '80px' }}>
              {/* LEFT COLUMN - CANOES */}
              <div style={{ width: canoeWidth }}>
                {/* Canoe Sort Widget with Auto/Return buttons */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <span>📊</span> Canoe Sort
                    </h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => assignOptimal({ priority: canoePriority })} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm hover:shadow transition-shadow">
                        ✨ Auto
                      </button>
                      <button onClick={handleUnassignAll} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        ↩️ All
                      </button>
                    </div>
                  </div>
                  <Droppable droppableId="canoe-priority" direction="horizontal">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-wrap gap-3">
                        {canoePriority.map((item, index) => (
                          <Draggable key={item.id} draggableId={`canoe-${item.id}`} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{ ...provided.draggableProps.style, position: 'static' }}
                                className={`px-4 py-2.5 rounded-lg text-white text-xs font-medium shadow-md cursor-grab active:cursor-grabbing transition-all bg-gradient-to-r ${item.gradient} border-2 border-white/30
                                  ${snapshot.isDragging ? 'scale-105 shadow-xl ring-2 ring-white/50' : 'hover:shadow-lg hover:border-white/50'}`}
                              >
                                <span className="mr-2">{item.icon}</span>
                                <span className="font-semibold">{item.label}</span>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  <p className="text-xs text-slate-400 mt-2">Drag to reorder • Auto-sorts canoes</p>
                </div>

                {/* All Canoes - MORE SPACING */}
                <div style={{ marginTop: '24px' }}>
                  {canoes?.map((canoe: Canoe, index: number) => {
                    const isFull = canoe.status === 'full';
                    const isHovered = hoveredCanoe === canoe.id;
                    return (
                      <div 
                        key={canoe._id.toString()} 
                        className={`bg-white dark:bg-slate-900 rounded-xl border ${isFull ? 'border-emerald-300 dark:border-emerald-700' : 'border-slate-200 dark:border-slate-800'} shadow-sm flex items-center gap-4`}
                        style={{ padding: '10px 16px', marginBottom: '12px' }}
                        onMouseEnter={() => setHoveredCanoe(canoe.id)}
                        onMouseLeave={() => setHoveredCanoe(null)}
                      >
                        {/* Name and hover controls on the left */}
                        <div className="flex items-center gap-2 w-28 shrink-0 relative">
                          <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate">{canoe.name}</span>
                          
                          {/* Hover controls - shows on hover */}
                          {isHovered && (
                            <div className="absolute left-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-1 flex gap-1 z-10">
                              <button 
                                onClick={() => handleRemoveCanoe(canoe.id)}
                                className="w-6 h-6 rounded bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-200 flex items-center justify-center text-xs font-bold"
                                title="Remove canoe"
                              >
                                −
                              </button>
                              <button 
                                onClick={() => handleAddCanoeAfter(index)}
                                className="w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 flex items-center justify-center text-xs font-bold"
                                title="Add canoe after"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {/* 6 seats */}
                        <div className="flex items-center" style={{ gap: PADDING }}>
                          {Array.from({ length: 6 }).map((_, i) => {
                            const seat = i + 1;
                            const assignment = canoe.assignments.find((a: { seat: number; paddlerId: string }) => a.seat === seat);
                            const assignedPaddler = assignment ? canoeSortedPaddlers.find((p: Paddler) => p.id === assignment.paddlerId) : undefined;

                            return (
                              <Droppable droppableId={`canoe-${canoe.id}-seat-${seat}`} key={seat}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`rounded-full flex items-center justify-center transition-all
                                      ${snapshot.isDraggingOver ? 'bg-emerald-200 dark:bg-emerald-800 scale-110 ring-2 ring-emerald-400' : assignedPaddler ? '' : 'bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400'}`}
                                    style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
                                  >
                                    {assignedPaddler ? (
                                      <Draggable draggableId={assignedPaddler.id} index={0}>
                                        {(provided, snapshot) => (
                                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style, position: 'static' }}>
                                            <PaddlerCircle paddler={assignedPaddler} isDragging={snapshot.isDragging} />
                                          </div>
                                        )}
                                      </Draggable>
                                    ) : (
                                      <span className="text-slate-400 text-[10px] font-bold">{seat}</span>
                                    )}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT COLUMN - STAGING */}
              <div className="space-y-4" style={{ width: 380 }}>
                {/* View By Toggle with + Paddler button */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">View By</h3>
                    <button 
                      onClick={handleAddPaddler}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm hover:shadow transition-shadow"
                    >
                      + Paddler
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { id: "ability", label: "Ability", icon: "⭐" },
                      { id: "gender", label: "Gender", icon: "⚥" },
                      { id: "type", label: "Racer?", icon: "🏁" },
                      { id: "seatPreference", label: "Seat", icon: "💺" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setViewBy(option.id as ViewBy)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1
                          ${viewBy === option.id 
                            ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-800 shadow-md' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                      >
                        <span>{option.icon}</span>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Staging Sections - always visible with at least one droppable area */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4" style={{ marginTop: '24px' }}>
                  {viewSections.length > 0 ? viewSections.map((section) => {
                    const sectionSort = sectionSorts[section.id] || "ability";
                    const sortedPaddlers = sortPaddlers(section.paddlers, sectionSort);
                    
                    return (
                      <div key={section.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 pb-4 last:pb-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                            {section.label} ({section.paddlers.length})
                          </span>
                          
                          {/* Section sort priority */}
                          <div className="flex gap-1">
                            {[
                              { id: "ability", letter: "A" },
                              { id: "gender", letter: "G" },
                              { id: "type", letter: "R" },
                              { id: "seatPreference", letter: "S" },
                            ].map((sort) => (
                              <button
                                key={sort.id}
                                onClick={() => handleSectionSort(section.id, sort.id as SortBy)}
                                className={`w-5 h-5 rounded text-[10px] font-bold transition-colors
                                  ${sectionSort === sort.id 
                                    ? 'bg-slate-600 dark:bg-slate-400 text-white' 
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200'}`}
                                title={`Sort by ${sort.id}`}
                              >
                                {sort.letter}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <Droppable droppableId={`staging-${section.id}`} direction="horizontal">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`rounded-lg p-2 transition-colors flex flex-wrap gap-2 min-h-[60px]
                                ${snapshot.isDraggingOver ? 'bg-amber-50 dark:bg-amber-950/30 ring-2 ring-amber-400/50' : 'bg-slate-50 dark:bg-slate-800/50'}`}
                            >
                              {sortedPaddlers.map((paddler: Paddler, index: number) => (
                                <Draggable key={paddler._id.toString()} draggableId={paddler.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div 
                                      ref={provided.innerRef} 
                                      {...provided.draggableProps} 
                                      {...provided.dragHandleProps} 
                                      style={{ ...provided.draggableProps.style, position: 'static' }}
                                    >
                                      <PaddlerCircle paddler={paddler} isDragging={snapshot.isDragging} />
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    );
                  }) : (
                    // Always show a staging area even when all paddlers are assigned
                    <Droppable droppableId="staging-unassigned" direction="horizontal">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`rounded-lg p-2 transition-colors flex flex-wrap gap-2 min-h-[100px] items-center justify-center
                            ${snapshot.isDraggingOver ? 'bg-amber-50 dark:bg-amber-950/30 ring-2 ring-amber-400/50' : 'bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-600'}`}
                        >
                          <span className="text-slate-400 text-sm">Drag paddlers here to unassign</span>
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </DragDropContext>
  );
}

export default App;
