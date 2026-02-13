import { useMutation, useQuery } from "convex/react";
import { api } from "./convex_generated/api";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult, DragStart, DragUpdate } from "@hello-pangea/dnd";
import type { Doc } from "./convex_generated/dataModel";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useAnimationTrigger } from "./useAnimationTrigger";

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
const TOOLBAR_SIZE = 34;
const PADDING = 12;
const TOTAL_CIRCLE_SPACE = CIRCLE_SIZE + PADDING;

const CANOE_DESIGNATIONS = ["57", "67", "700", "711", "710", "M", "W"];

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

const PaddlerCircle: React.FC<{ paddler: Paddler; isDragging?: boolean; animationKey?: number; animationDelay?: number }> = ({ paddler, isDragging, animationKey = 0, animationDelay = 0 }) => {
  const circleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (animationKey === 0) return;
    const el = circleRef.current;
    if (!el) return;

    const anim = el.animate(
      [
        { transform: 'scale(0.3)', opacity: 0 },
        { transform: 'scale(1.08)', opacity: 1, offset: 0.7 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      {
        duration: 350,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        delay: animationDelay,
        fill: 'backwards',
      }
    );

    return () => anim.cancel();
  }, [animationKey, animationDelay]);

  const abilityColor = paddler.ability === 5
    ? 'from-emerald-400 to-emerald-600'
    : paddler.ability >= 3
      ? 'from-amber-400 to-amber-600'
      : 'from-rose-400 to-rose-600';

  const genderBorderColor = paddler.gender === 'kane' ? '#3b82f6' : '#ec4899';

  // Display name: truncated first name + last initial (e.g., "JohS" for John Smith)
  const lastInitial = paddler.lastName?.[0] || paddler.lastInitial || '?';
  const maxFirstNameLen = 5;
  const truncatedFirst = paddler.firstName.length > maxFirstNameLen
    ? paddler.firstName.slice(0, maxFirstNameLen)
    : paddler.firstName;
  const displayName = `${truncatedFirst}${lastInitial}`;

  // Inner ability circle color: red (1) to green (5)
  const abilityInnerColor = paddler.ability === 5 ? '#10b981' :
    paddler.ability === 4 ? '#84cc16' :
    paddler.ability === 3 ? '#eab308' :
    paddler.ability === 2 ? '#f97316' :
    '#ef4444';

  return (
    <div
      ref={circleRef}
      className={`relative flex-shrink-0 rounded-full border-[3px] shadow-md bg-gradient-to-br ${abilityColor}
        ${isDragging ? 'scale-110 shadow-xl ring-2 ring-white/50' : 'hover:scale-105'}
        transition-all duration-150 cursor-grab active:cursor-grabbing`}
      style={{
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderColor: genderBorderColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {/* Name - in the center */}
      <span className="text-[9px] leading-tight text-white font-bold px-1 truncate max-w-full text-center">
        {displayName}
      </span>
      
      {/* Ability badge - small circle at bottom left */}
      <div 
        className="absolute rounded-full flex items-center justify-center font-bold text-white border border-white/50"
        style={{
          backgroundColor: abilityInnerColor,
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          width: '14px',
          height: '14px',
          fontSize: '8px',
          bottom: '1px',
          left: '1px'
        }}
      >
        {paddler.ability}
      </div>
      
      {/* Type badge - square at bottom right */}
      <div 
        className="absolute flex items-center justify-center font-bold text-white border border-white/50"
        style={{
          backgroundColor: paddler.type === 'racer' ? '#8b5cf6' :
                          paddler.type === 'casual' ? '#3b82f6' : '#64748b',
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          width: '12px',
          height: '12px',
          fontSize: '6px',
          bottom: '1px',
          right: '1px',
          borderRadius: '2px'
        }}
      >
        {paddler.type === 'racer' ? 'R' : paddler.type === 'casual' ? 'C' : 'V'}
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
  const deletePaddler = useMutation(api.paddlers.deletePaddler);
  const updatePaddler = useMutation(api.paddlers.updatePaddler);

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
  const [isReassigning, setIsReassigning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Canoe designations - persist to localStorage
  const [canoeDesignations, setCanoeDesignations] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('canoeDesignations');
    if (saved) { try { return JSON.parse(saved); } catch { /* default */ } }
    return {};
  });
  const [openDesignator, setOpenDesignator] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('canoeDesignations', JSON.stringify(canoeDesignations));
  }, [canoeDesignations]);
  
  // Edit modal state
  const [editingPaddler, setEditingPaddler] = useState<Paddler | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    gender: 'kane' as 'kane' | 'wahine',
    type: 'casual' as 'racer' | 'casual' | 'very-casual',
    ability: 3,
    seatPreference: '000000',
  });

  const { animationKey, trigger: triggerAnimation } = useAnimationTrigger();

  // Drag tracking for swap preview (refs + CSS injection to bypass Draggable memo)
  const dragSourceIdRef = useRef<string | null>(null);
  const swapStyleRef = useRef<HTMLStyleElement | null>(null);

  const handleDragStart = useCallback((start: DragStart) => {
    dragSourceIdRef.current = start.source.droppableId;
  }, []);

  const handleDragUpdate = useCallback((update: DragUpdate) => {
    const destId = update.destination?.droppableId || null;

    // Always clean up previous swap preview
    if (swapStyleRef.current) {
      swapStyleRef.current.remove();
      swapStyleRef.current = null;
    }

    // Only inject swap preview for canoe seat targets with an existing paddler
    if (!destId || !dragSourceIdRef.current || destId === dragSourceIdRef.current || !destId.includes('-seat-')) {
      return;
    }

    const targetDroppable = document.querySelector(`[data-rfd-droppable-id="${destId}"]`);
    const sourceDroppable = document.querySelector(`[data-rfd-droppable-id="${dragSourceIdRef.current}"]`);
    if (!targetDroppable || !sourceDroppable) return;

    const targetDraggable = targetDroppable.querySelector('[data-rfd-draggable-id]');
    if (!targetDraggable) return;

    const draggableId = targetDraggable.getAttribute('data-rfd-draggable-id');
    if (!draggableId) return;

    const sr = sourceDroppable.getBoundingClientRect();
    const tr = targetDroppable.getBoundingClientRect();
    const dx = sr.left - tr.left;
    const dy = sr.top - tr.top;

    const styleEl = document.createElement('style');
    styleEl.textContent = `[data-rfd-draggable-id="${draggableId}"] { transform: translate(${dx}px, ${dy}px) !important; transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1) !important; z-index: 100 !important; position: relative !important; }`;
    document.head.appendChild(styleEl);
    swapStyleRef.current = styleEl;
  }, []);

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
    triggerAnimation();
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
  }, [paddlers, canoes, canoeSortedPaddlers, isReassigning, triggerAnimation]);

  const onDragEnd = async (result: DropResult) => {
    // Clean up swap preview
    if (swapStyleRef.current) {
      swapStyleRef.current.remove();
      swapStyleRef.current = null;
    }
    dragSourceIdRef.current = null;
    const { source, destination, draggableId } = result;
    console.log('onDragEnd:', { source: source.droppableId, destination: destination?.droppableId, draggableId });
    if (!destination) return;

    // Handle canoe priority reordering
    if (source.droppableId === "canoe-priority") {
      const newPriority = Array.from(canoePriority);
      const [reorderedItem] = newPriority.splice(source.index, 1);
      newPriority.splice(destination.index, 0, reorderedItem);
      setCanoePriority(newPriority);
      return;
    }

    // Handle trash can - delete paddler
    if (destination.droppableId === "trash-can") {
      const draggedPaddler = paddlers?.find((p: Paddler) => p.id === draggableId);
      if (draggedPaddler) {
        // Unassign from canoe if assigned
        if (draggedPaddler.assignedCanoe && draggedPaddler.assignedSeat) {
          await unassignPaddler({
            paddlerId: draggableId,
            canoeId: draggedPaddler.assignedCanoe,
            seat: draggedPaddler.assignedSeat
          });
        }
        // Delete the paddler
        await deletePaddler({ paddlerId: draggableId });
      }
      return;
    }

    // Handle edit area - open edit modal
    if (destination.droppableId === "edit-area") {
      console.log('Edit area drop detected, looking for paddler:', draggableId);
      const draggedPaddler = paddlers?.find((p: Paddler) => p.id === draggableId);
      console.log('Found paddler:', draggedPaddler);
      if (draggedPaddler) {
        console.log('Setting editing state...');
        setEditingPaddler(draggedPaddler);
        setEditForm({
          firstName: draggedPaddler.firstName,
          lastName: draggedPaddler.lastName || '',
          gender: draggedPaddler.gender,
          type: draggedPaddler.type,
          ability: draggedPaddler.ability,
          seatPreference: draggedPaddler.seatPreference || '000000',
        });
        setIsEditModalOpen(true);
        console.log('Modal should be open now, isEditModalOpen:', true);
      } else {
        console.log('Paddler not found!');
      }
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
    triggerAnimation();
    const newPaddler = generateRandomPaddler();
    await addPaddler(newPaddler);
  };

  const handleRemoveCanoe = (canoeId: string) => {
    triggerAnimation();
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

  const handleSaveEdit = async () => {
    if (!editingPaddler) return;
    await updatePaddler({
      paddlerId: editingPaddler.id,
      ...editForm,
    });
    setIsEditModalOpen(false);
    setEditingPaddler(null);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingPaddler(null);
  };

  const hasNoData = (!canoes || canoes.length === 0) && (!paddlers || paddlers.length === 0);

  // Calculate canoe width
  const canoeWidth = (TOTAL_CIRCLE_SPACE * 6) + 60;

  return (
    <DragDropContext onDragEnd={onDragEnd} onDragStart={handleDragStart} onDragUpdate={handleDragUpdate}>
      <div className="h-screen overflow-hidden bg-slate-200 dark:bg-slate-950">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap');`}</style>
        {/* Header - compact */}
        <main className="max-w-6xl mx-auto px-6" style={{ height: '100vh' }}>
          {hasNoData ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div
                onClick={() => { triggerAnimation(); populatePaddlers(); populateCanoes(); }}
                className="rounded-full border-[3px] flex items-center justify-center cursor-pointer transition-all hover:opacity-80"
                style={{ width: 64, height: 64, backgroundColor: '#000', borderColor: '#9ca3af', color: '#fff', fontSize: '28px' }}
              >
                🛶
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-center mt-4 text-sm">Tap to load sample data</p>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', height: '100%' }}>
              {/* LEFT COLUMN - CANOES */}
              <div className="scrollbar-hidden" style={{ width: canoeWidth, overflowY: 'auto', height: '100%' }}>
                {/* Header */}
                <div className="py-1">
                  <span
                    style={{
                      fontFamily: "'UnifrakturMaguntia', cursive",
                      color: '#dc2626',
                      WebkitTextStroke: '1.5px white',
                      paintOrder: 'stroke fill',
                      textShadow: '-1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white',
                      fontSize: '28px',
                    }}
                  >
                    Lokahi Outrigger Canoe Club
                  </span>
                </div>
                {/* Sort Widget */}
                <div className="flex items-center px-1 py-1 sticky z-20 bg-slate-200 dark:bg-slate-950" style={{ top: 0 }}>
                    <span className="text-[22px] shrink-0 mr-2" style={{ color: '#c0c0c0' }}>sort by:</span>
                    <Droppable droppableId="canoe-priority" direction="horizontal">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="flex items-center flex-1">
                          {canoePriority.map((item, index) => (
                            <Draggable key={item.id} draggableId={`canoe-${item.id}`} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className="flex items-center"
                                  style={{ ...provided.draggableProps.style, position: 'static' }}
                                >
                                  {index > 0 && <span className="text-[22px] text-slate-300 dark:text-slate-600 mx-2">/</span>}
                                  <span
                                    className={`text-[22px] font-medium cursor-grab active:cursor-grabbing transition-colors
                                      ${snapshot.isDragging ? 'text-blue-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}
                                  >
                                    {{ ability: 'ability', gender: 'gender', type: 'racer?', seatPreference: 'seat' }[item.id]}
                                  </span>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                    <div className="flex flex-col items-end shrink-0 ml-3 gap-1">
                      <span
                        onClick={() => { triggerAnimation(); assignOptimal({ priority: canoePriority }); }}
                        className="text-[22px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer transition-colors"
                      >
                        assign
                      </span>
                      <span
                        onClick={() => { triggerAnimation(); handleUnassignAll(); }}
                        className="text-[22px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer transition-colors"
                      >
                        return
                      </span>
                    </div>
                </div>

                {/* All Canoes */}
                <div style={{ marginTop: '8px' }}>
                  {canoes?.map((canoe: Canoe, index: number) => {
                    const isFull = canoe.status === 'full';
                    return (
                      <div
                        key={canoe._id.toString()}
                        className={`bg-white dark:bg-slate-900 rounded-xl border ${isFull ? 'border-emerald-300 dark:border-emerald-700' : 'border-slate-200 dark:border-slate-800'} shadow-sm flex items-center gap-0`}
                        style={{ padding: '10px 8px', marginBottom: '4px' }}
                      >
                        {/* Canoe designation + controls */}
                        <div className="flex flex-col items-center shrink-0 relative self-start">
                          {/* Designation circle */}
                          <div
                            className="rounded-full border-[3px] border-black dark:border-white bg-white dark:bg-slate-900 flex items-center justify-center cursor-pointer hover:bg-yellow-50 dark:hover:bg-slate-800 transition-colors"
                            style={{ width: 36, height: 36 }}
                            onClick={() => setOpenDesignator(openDesignator === canoe.id ? null : canoe.id)}
                          >
                            <span className="text-[11px] font-black text-black dark:text-white leading-none">{canoeDesignations[canoe.id] || '???'}</span>
                          </div>
                          {/* -/+ buttons side by side under designator */}
                          <div className="flex items-center gap-0.5 mt-0.5">
                            <button
                              onClick={() => handleRemoveCanoe(canoe.id)}
                              className="w-7 h-7 flex items-center justify-center text-[12px] leading-none font-bold text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors border-slate-300 dark:border-slate-600"
                              style={{ borderRadius: '50%', padding: 0, borderWidth: '3px', borderStyle: 'solid' }}
                              title="Remove canoe"
                            >
                              −
                            </button>
                            <button
                              onClick={() => handleAddCanoeAfter(index)}
                              className="w-7 h-7 flex items-center justify-center text-[12px] leading-none font-bold text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors border-slate-300 dark:border-slate-600"
                              style={{ borderRadius: '50%', padding: 0, borderWidth: '3px', borderStyle: 'solid' }}
                              title="Add canoe"
                            >
                              +
                            </button>
                          </div>
                          {/* Designation selector dropdown */}
                          {openDesignator === canoe.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenDesignator(null)} />
                              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-1.5 z-20 grid grid-cols-3 gap-1" style={{ minWidth: '110px' }}>
                                {CANOE_DESIGNATIONS.map(d => (
                                  <button
                                    key={d}
                                    onClick={(e) => { e.stopPropagation(); setCanoeDesignations(prev => ({ ...prev, [canoe.id]: d })); setOpenDesignator(null); }}
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
                                      setCanoeDesignations(prev => ({ ...prev, [canoe.id]: custom.trim() }));
                                    }
                                    setOpenDesignator(null);
                                  }}
                                  className="px-2 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded text-center transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            </>
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
                                    style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE, position: 'relative', flexShrink: 0 }}
                                  >
                                    <div
                                      className={`rounded-full flex items-center justify-center transition-all
                                        ${snapshot.isDraggingOver ? 'bg-slate-300 dark:bg-slate-600 scale-110 ring-2 ring-slate-400' : assignedPaddler ? '' : 'bg-slate-200 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600'}`}
                                      style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
                                    >
                                      {assignedPaddler ? (
                                        <Draggable draggableId={assignedPaddler.id} index={0}>
                                          {(provided, snapshot) => {
                                            const node = (
                                              <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style, ...(snapshot.isDragging ? {} : { position: 'static' }) }}>
                                                <PaddlerCircle paddler={assignedPaddler} isDragging={snapshot.isDragging} animationKey={animationKey} animationDelay={seat * 30} />
                                              </div>
                                            );
                                            return snapshot.isDragging ? createPortal(node, document.body) : node;
                                          }}
                                        </Draggable>
                                      ) : null}
                                    </div>
                                    <div style={{ display: 'none' }}>{provided.placeholder}</div>
                                  </div>
                                )}
                              </Droppable>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  
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
                </div>
              </div>

              {/* RIGHT COLUMN - STAGING SIDEBAR */}
              <div
                className="scrollbar-hidden"
                style={{
                  width: sidebarOpen ? 196 : 24,
                  height: '100%',
                  flexShrink: 0,
                  overflowY: sidebarOpen ? 'auto' : 'hidden',
                  overflowX: 'hidden',
                  backgroundColor: sidebarOpen ? '#cbd5e1' : 'transparent',
                  transition: 'width 0.3s ease',
                  padding: sidebarOpen ? '4px 4px 0 4px' : '4px 0 0 0',
                }}
              >
                {/* Toggle button + View By row */}
                <div className="flex items-center justify-between px-1 py-1 sticky z-20" style={{ top: 0, backgroundColor: sidebarOpen ? '#cbd5e1' : 'transparent' }}>
                  {/* Toggle button - top left */}
                  <div
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    style={{
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: '#64748b',
                      userSelect: 'none',
                      padding: '2px 4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sidebarOpen ? '›››' : '‹'}
                  </div>
                  {sidebarOpen && <>
                  {/* View filter buttons */}
                  {/* View filter text - left aligned */}
                  <div className="flex items-center flex-wrap gap-1">
                    {[
                      { id: "gender", label: "G" },
                      { id: "type", label: "R" },
                      { id: "seatPreference", label: "S" },
                      { id: "ability", label: "A" },
                    ].map((option) => (
                      <span
                        key={option.id}
                        onClick={() => setViewBy(option.id as ViewBy)}
                        className={`w-7 h-7 flex items-center justify-center text-[12px] font-bold cursor-pointer transition-colors rounded-full`}
                        style={{
                          borderWidth: '2px',
                          borderStyle: 'solid',
                          ...(viewBy === option.id
                            ? { backgroundColor: '#475569', color: '#fff', borderColor: '#334155' }
                            : { backgroundColor: '#e2e8f0', color: '#94a3b8', borderColor: '#cbd5e1' }),
                        }}
                      >
                        {option.label}
                      </span>
                    ))}
                  </div>
                  {/* Edit/Trash/+ icons - right aligned */}
                  <div className="flex items-center gap-3">
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
                          title="Drag paddlers here to delete"
                        >
                          <span style={{ fontSize: '16px' }}>🗑️</span>
                          <div style={{ display: 'none' }}>{provided.placeholder}</div>
                        </div>
                      )}
                    </Droppable>
                    <div
                      onClick={handleAddPaddler}
                      className="rounded-full border-[3px] flex items-center justify-center cursor-pointer transition-all hover:opacity-80"
                      style={{ width: TOOLBAR_SIZE, height: TOOLBAR_SIZE, fontSize: '26px', lineHeight: 1, backgroundColor: '#000', borderColor: '#9ca3af', color: '#fff' }}
                    >
                      +
                    </div>
                  </div>
                  </>}
                </div>

                {sidebarOpen && <>
                {/* Staging Sections - always visible with at least one droppable area */}
                <div className="rounded-xl p-4 space-y-4" style={{ marginTop: '8px' }}>
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
                                className={`w-9 h-9 text-[13px] font-bold transition-colors
                                  ${sectionSort === sort.id
                                    ? 'bg-slate-600 dark:bg-slate-400 text-white border-slate-700 dark:border-slate-300'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-200'}`}
                                style={{ borderRadius: '50%', padding: 0, borderWidth: '3px', borderStyle: 'solid' }}
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
                              className={`rounded-lg transition-colors flex flex-wrap min-h-[60px]
                                ${snapshot.isDraggingOver ? 'bg-amber-50 dark:bg-amber-950/30 ring-2 ring-amber-400/50' : 'bg-slate-200 dark:bg-slate-800/50'}`}
                              style={{ padding: '4px', gap: '4px' }}
                            >
                              {sortedPaddlers.map((paddler: Paddler, index: number) => (
                                <Draggable key={paddler._id.toString()} draggableId={paddler.id} index={index}>
                                  {(provided, snapshot) => {
                                    const node = (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        style={{ ...provided.draggableProps.style, ...(snapshot.isDragging ? {} : { position: 'static' }) }}
                                      >
                                        <PaddlerCircle paddler={paddler} isDragging={snapshot.isDragging} animationKey={animationKey} animationDelay={index * 20} />
                                      </div>
                                    );
                                    return snapshot.isDragging ? createPortal(node, document.body) : node;
                                  }}
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
                          className={`rounded-lg transition-colors flex flex-wrap min-h-[100px] items-center justify-center
                            ${snapshot.isDraggingOver ? 'bg-amber-50 dark:bg-amber-950/30 ring-2 ring-amber-400/50' : 'bg-slate-200 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-600'}`}
                          style={{ padding: '4px', gap: '4px' }}
                        >
                          <span className="text-slate-400 text-sm">Drag paddlers here to unassign</span>
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  )}
                </div>
                </>}
              </div>
            </div>
          )}
        </main>

        {/* Edit Paddler Modal */}
        {isEditModalOpen && editingPaddler && (
          <div className="fixed flex" style={{ 
            top: '80px', 
            right: '20px', 
            zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '16px',
            padding: '8px'
          }} onClick={handleCloseEditModal}>
            <div
              className="rounded-2xl shadow-2xl p-6 w-full max-w-md"
              style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', minWidth: '380px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: '#1e293b' }}>
                  <span>✏️</span> Edit Paddler
                </h2>
                <button
                  onClick={handleCloseEditModal}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Name fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>First Name</label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ borderColor: '#e2e8f0', backgroundColor: '#ffffff', color: '#1e293b' }}
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>Last Name</label>
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ borderColor: '#e2e8f0', backgroundColor: '#ffffff', color: '#1e293b' }}
                      placeholder="Last name"
                    />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Gender</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'kane', label: 'Kane', icon: '♂️', color: 'blue' },
                      { id: 'wahine', label: 'Wahine', icon: '♀️', color: 'pink' },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setEditForm(prev => ({ ...prev, gender: option.id as 'kane' | 'wahine' }))}
                        className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-1.5
                          ${editForm.gender === option.id
                            ? option.color === 'blue'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'border-pink-500 bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                      >
                        <span>{option.icon}</span>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Type</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'racer', label: 'Racer', color: 'violet' },
                      { id: 'casual', label: 'Casual', color: 'blue' },
                      { id: 'very-casual', label: 'Very Casual', color: 'slate' },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setEditForm(prev => ({ ...prev, type: option.id as 'racer' | 'casual' | 'very-casual' }))}
                        className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all
                          ${editForm.type === option.id
                            ? option.color === 'violet'
                              ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                              : option.color === 'blue'
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : 'border-slate-500 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ability */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Ability <span className="text-slate-400">(1-5)</span>
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        onClick={() => setEditForm(prev => ({ ...prev, ability: level }))}
                        className={`w-10 h-10 rounded-lg border-2 text-sm font-bold transition-all
                          ${editForm.ability === level
                            ? level >= 4
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                              : level >= 3
                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                : 'border-rose-500 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Seat Preference */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Seat Preference <span className="text-slate-400">(click seats in priority order)</span>
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6].map((seat) => {
                      const prefs = editForm.seatPreference.split('').map(Number).filter(n => n > 0);
                      const isSelected = prefs.includes(seat);
                      const priority = prefs.indexOf(seat) + 1;
                      return (
                        <button
                          key={seat}
                          onClick={() => {
                            const currentPrefs = editForm.seatPreference.split('').map(Number).filter(n => n > 0);
                            let newPrefs;
                            if (currentPrefs.includes(seat)) {
                              newPrefs = currentPrefs.filter(s => s !== seat);
                            } else {
                              newPrefs = [...currentPrefs, seat];
                            }
                            const prefString = [...newPrefs, ...Array(6 - newPrefs.length).fill(0)].join('').slice(0, 6);
                            setEditForm(prev => ({ ...prev, seatPreference: prefString }));
                          }}
                          className={`w-10 h-10 rounded-lg border-2 text-sm font-bold transition-all relative
                            ${isSelected
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                        >
                          {seat}
                          {isSelected && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[8px] rounded-full flex items-center justify-center">
                              {priority}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Selected: {editForm.seatPreference.split('').map(Number).filter(n => n > 0).join(' > ') || 'None'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCloseEditModal}
                  className="flex-1 px-4 py-2.5 rounded-lg border font-medium transition-colors"
                  style={{ borderColor: '#e2e8f0', color: '#64748b' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-4 py-2.5 rounded-lg text-white font-medium shadow-lg"
                  style={{ background: 'linear-gradient(to right, #3b82f6, #4f46e5)' }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DragDropContext>
  );
}

export default App;
