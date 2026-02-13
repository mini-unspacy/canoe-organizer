import { useMutation, useQuery } from "convex/react";
import { api } from "./convex_generated/api";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult, DragStart, DragUpdate } from "@hello-pangea/dnd";
import type { Doc } from "./convex_generated/dataModel";
import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from "react";

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
// Circle + padding space: (CIRCLE_SIZE + PADDING)

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

const PaddlerCircle: React.FC<{ paddler: Paddler; isDragging?: boolean; animationKey?: number; animationDelay?: number; sizeW?: number; compact?: boolean }> = ({ paddler, isDragging, animationKey = 0, animationDelay = 0, sizeW, compact }) => {
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

  // Display name: compact = initials only, otherwise truncated first + last initial
  const firstInitial = paddler.firstName?.[0] || '?';
  const lastInitial = paddler.lastName?.[0] || paddler.lastInitial || '?';
  let displayName: string;
  if (compact) {
    displayName = `${firstInitial}${lastInitial}`;
  } else {
    const maxFirstNameLen = 5;
    const truncatedFirst = paddler.firstName.length > maxFirstNameLen
      ? paddler.firstName.slice(0, maxFirstNameLen)
      : paddler.firstName;
    displayName = `${truncatedFirst}${lastInitial}`;
  }

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
        ${isDragging ? 'scale-110 shadow-xl ring-2 ring-white/50' : ''}
        cursor-grab active:cursor-grabbing`}
      style={{
        width: sizeW || CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderColor: genderBorderColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        touchAction: 'manipulation',
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
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 768 : true);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 768 : true);
  const [lockedCanoes, setLockedCanoes] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('lockedCanoes');
    if (saved) { try { return new Set(JSON.parse(saved)); } catch { /* default */ } }
    return new Set();
  });

  useEffect(() => {
    localStorage.setItem('lockedCanoes', JSON.stringify([...lockedCanoes]));
  }, [lockedCanoes]);
  const [openSortMenu, setOpenSortMenu] = useState<string | null>(null);
  const [sortPillOpen, setSortPillOpen] = useState(false);
  const [tempPriority, setTempPriority] = useState<CanoeSortItem[]>(canoePriority);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1000);
  const [windowHeight, setWindowHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 100));
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

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

  const [isDragging, setIsDragging] = useState(false);

  // Drag tracking for swap preview (refs + CSS injection to bypass Draggable memo)
  const dragSourceIdRef = useRef<string | null>(null);
  const swapStyleRef = useRef<HTMLStyleElement | null>(null);

  const [dragFromStaging, setDragFromStaging] = useState(false);

  const handleDragStart = useCallback((start: DragStart) => {
    setIsDragging(true);
    setDragFromStaging(start.source.droppableId.startsWith('staging-'));
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

  // On any touchstart, blur focused elements to prevent iOS focus interference.
  // Do NOT call preventDefault — the library ignores events where defaultPrevented is true.
  useEffect(() => {
    const handler = () => {
      if (document.activeElement && document.activeElement !== document.body) {
        (document.activeElement as HTMLElement).blur();
      }
    };
    document.addEventListener('touchstart', handler, { passive: true });
    return () => document.removeEventListener('touchstart', handler);
  }, []);

  // Block native touchmove on the whole page during drag to prevent scroll interference
  useEffect(() => {
    if (!isDragging) return;
    const handler = (e: TouchEvent) => {
      e.preventDefault();
    };
    document.addEventListener('touchmove', handler, { passive: false });
    return () => document.removeEventListener('touchmove', handler);
  }, [isDragging]);

  // No auto canoe creation - assign button handles this

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
    
    // Skip paddlers in locked canoes
    const assignedPaddlers = paddlers.filter((p: Paddler) => p.assignedCanoe && p.assignedSeat && !lockedCanoes.has(p.assignedCanoe));
    assignedPaddlers.sort((a: Paddler, b: Paddler) => {
      const canoeA = canoes.find((c: Canoe) => c.id === a.assignedCanoe);
      const canoeB = canoes.find((c: Canoe) => c.id === b.assignedCanoe);
      const canoeIdxA = canoes.indexOf(canoeA!);
      const canoeIdxB = canoes.indexOf(canoeB!);
      if (canoeIdxA !== canoeIdxB) return canoeIdxA - canoeIdxB;
      return (a.assignedSeat || 0) - (b.assignedSeat || 0);
    });

    const sortedAssigned = canoeSortedPaddlers.filter(p => p.assignedCanoe && !lockedCanoes.has(p.assignedCanoe));

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
    setIsDragging(false);
    setDragFromStaging(false);
    // Clean up swap preview
    if (swapStyleRef.current) {
      swapStyleRef.current.remove();
      swapStyleRef.current = null;
    }
    dragSourceIdRef.current = null;
    const { source, destination, draggableId } = result;
    console.log('onDragEnd:', { source: source.droppableId, destination: destination?.droppableId, draggableId });
    if (!destination) return;

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

    // Block dragging from a locked canoe
    if (oldCanoeId && lockedCanoes.has(oldCanoeId)) return;

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

    // Block dragging into a locked canoe
    if (lockedCanoes.has(destCanoeId)) return;
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
    if (!canoes || canoes.length <= 1) return; // keep at least 1
    removeCanoe({ canoeId });
  };

  const handleAddCanoeAfter = (_index: number) => {
    const nextNum = (canoes?.length || 0) + 1;
    addCanoe({ name: `Canoe ${nextNum}` });
  };

  const handleUnassignAll = async () => {
    if (!paddlers) return;
    // Skip paddlers in locked canoes
    const assignedPaddlers = paddlers.filter((p: Paddler) => p.assignedCanoe && p.assignedSeat && !lockedCanoes.has(p.assignedCanoe));
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

  const handleAssign = async () => {
    if (!paddlers || !canoes) return;
    const neededCanoes = Math.ceil(paddlers.length / 6);
    if (neededCanoes > canoes.length) {
      for (let i = canoes.length; i < neededCanoes; i++) {
        await addCanoe({ name: `Canoe ${i + 1}` });
      }
    }
    triggerAnimation();
    assignOptimal({ priority: canoePriority });
  };

  const hasNoData = (!canoes || canoes.length === 0) && (!paddlers || paddlers.length === 0);

  // Calculate dynamic horizontal sizing (no CSS transform)
  const sidebarW = sidebarOpen ? 176 : 24;
  const leftSidebarW = leftSidebarOpen ? 110 : 24;
  const mainPad = 4;
  const flexGap = 8;
  const containerWidth = windowWidth - sidebarW - leftSidebarW - flexGap * 2 - mainPad;
  const leftControlWidth = 36;
  const canoePadding = 16;
  const availableForSeats = containerWidth - leftControlWidth - canoePadding;
  const dynamicGap = Math.min(PADDING, Math.max(2, Math.floor((availableForSeats - CIRCLE_SIZE * 6) / 5)));
  const dynamicCircleW = Math.min(CIRCLE_SIZE, Math.max(20, Math.floor((availableForSeats - dynamicGap * 5) / 6) - 2));
  // Canoe row height: fit 6 rows in viewport minus sticky sort bar (~32px)
  const sortBarHeight = 32;
  const canoeMargin = 12;
  const canoeRowHeight = Math.floor((windowHeight - sortBarHeight - canoeMargin * 6) / 6);

  return (
    <DragDropContext onDragEnd={onDragEnd} onDragStart={handleDragStart} onDragUpdate={handleDragUpdate}>
      <div className="overflow-hidden" style={{ height: '100%', backgroundColor: '#374151', touchAction: isDragging ? 'none' : 'auto', paddingTop: 'env(safe-area-inset-top)' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap');`}</style>
        {/* Header - compact */}
        <main className="max-w-6xl mx-auto" style={{ height: '100%', overflow: 'hidden', padding: '0 2px' }}>
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
            <div style={{ display: 'flex', height: '100%', gap: '8px', width: '100%', overflow: 'hidden' }}>
              {/* LEFT SIDEBAR - NAVIGATION */}
              <div
                className="scrollbar-hidden"
                style={{
                  width: leftSidebarOpen ? 110 : 24,
                  height: '100%',
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: leftSidebarOpen ? 'auto' : 'hidden',
                  overflowX: 'hidden',
                  backgroundColor: leftSidebarOpen ? '#374151' : 'transparent',
                  padding: leftSidebarOpen ? '12px 4px 0 4px' : '12px 0 0 0',
                  borderRight: '1px solid #94a3b8',
                  borderLeft: '1px solid #94a3b8',
                }}
              >
                <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: leftSidebarOpen ? '#374151' : 'transparent', padding: '12px 4px 0 4px' }}>
                  <div className="flex items-center" style={{ marginBottom: leftSidebarOpen ? '4px' : 0, justifyContent: leftSidebarOpen ? 'flex-end' : 'flex-start' }}>
                    <span
                      onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
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
                      {leftSidebarOpen ? '‹‹‹' : '›'}
                    </span>
                  </div>
                </div>
                {leftSidebarOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 4px' }}>
                    {['today', 'schedule', 'roster', 'attendance', 'crews'].map((item) => (
                      <span
                        key={item}
                        className="font-medium text-slate-300 hover:text-white cursor-pointer transition-colors"
                        style={{ fontSize: '15px', padding: '6px 8px', borderRadius: '8px' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4b5563')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* MIDDLE COLUMN - CANOES */}
              <div style={{ width: containerWidth, minWidth: 0, flexShrink: 0, overflow: 'hidden', height: '100%' }}>
              <div className="scrollbar-hidden" style={{ width: '100%', maxWidth: '100%', overflowY: isDragging ? 'hidden' : 'auto', overflowX: 'hidden', height: '100%', touchAction: isDragging ? 'none' : 'auto', paddingBottom: 'env(safe-area-inset-bottom)' }}>
                {/* Header */}
                <div className="py-1" style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
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
                <div className="flex items-center px-1 py-1 sticky z-20" style={{ top: 0, backgroundColor: '#374151', width: '100%', maxWidth: '600px', margin: '0 auto', gap: '8px' }}>
                    <div style={{ position: 'relative' }}>
                      <span
                        onClick={() => { setTempPriority(canoePriority); setSortPillOpen(!sortPillOpen); }}
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
                        sort by:
                      </span>
                      {sortPillOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setSortPillOpen(false)} />
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
                              style={{
                                marginTop: '8px',
                                padding: '6px 12px',
                                backgroundColor: '#3b82f6',
                                color: '#fff',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: 700,
                                textAlign: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              apply
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ flex: 1 }} />
                    <span
                      onClick={handleAssign}
                      style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 800, color: '#475569', userSelect: 'none', padding: '2px 8px', backgroundColor: '#e2e8f0', borderRadius: '999px', whiteSpace: 'nowrap' }}
                    >
                      ←assign
                    </span>
                    <span
                      onClick={() => { triggerAnimation(); handleUnassignAll(); }}
                      style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 800, color: '#475569', userSelect: 'none', padding: '2px 8px', backgroundColor: '#e2e8f0', borderRadius: '999px', whiteSpace: 'nowrap' }}
                    >
                      return→
                    </span>
                </div>

                {/* All Canoes */}
                <div style={{ marginTop: '8px', width: '100%', maxWidth: '600px', margin: '8px auto 0' }}>
                  {canoes?.map((canoe: Canoe, index: number) => {
                    const isFull = canoe.status === 'full';
                    return (
                      <div
                        key={canoe._id.toString()}
                        className={`rounded-xl border ${lockedCanoes.has(canoe.id) ? 'border-red-400' : isFull ? 'border-emerald-300 dark:border-emerald-700' : 'border-slate-400'} shadow-sm flex items-center gap-0`}
                        style={{ backgroundColor: '#d1d5db', padding: '8px 10px 8px 2px', marginBottom: `${canoeMargin}px`, height: `${canoeRowHeight}px`, boxSizing: 'border-box', position: 'relative' }}
                      >
                        {/* Lock button - top right */}
                        <svg
                          onClick={() => setLockedCanoes(prev => {
                            const next = new Set(prev);
                            if (next.has(canoe.id)) next.delete(canoe.id);
                            else next.add(canoe.id);
                            return next;
                          })}
                          width="14" height="14" viewBox="0 0 24 24"
                          fill="none" stroke={lockedCanoes.has(canoe.id) ? '#dc2626' : '#94a3b8'}
                          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ position: 'absolute', top: '3px', right: '4px', cursor: 'pointer', zIndex: 5 }}
                        >
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          {lockedCanoes.has(canoe.id)
                            ? <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            : <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                          }
                        </svg>
                        {/* Canoe designation + controls */}
                        <div className="flex flex-col justify-between shrink-0 relative self-stretch" style={{ minWidth: '30px', marginRight: '0px' }}>
                          {/* Designation - top left */}
                          <span
                            className={`text-[15px] font-black leading-none transition-colors ${lockedCanoes.has(canoe.id) ? 'text-slate-400 cursor-default' : 'text-black dark:text-white cursor-pointer hover:text-blue-600'}`}
                            style={{ WebkitTextStroke: '0.5px' }}
                            onClick={() => !lockedCanoes.has(canoe.id) && setOpenDesignator(openDesignator === canoe.id ? null : canoe.id)}
                          >
                            {canoeDesignations[canoe.id] || '???'}
                          </span>
                          {/* -/+ buttons - bottom left */}
                          <div className="flex items-center" style={{ gap: '16px' }}>
                            <span
                              onClick={() => !lockedCanoes.has(canoe.id) && handleRemoveCanoe(canoe.id)}
                              className={`text-[18px] font-bold leading-none transition-colors ${lockedCanoes.has(canoe.id) ? 'text-slate-300 cursor-default' : 'text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer'}`}
                              title="Remove canoe"
                            >
                              −
                            </span>
                            <span
                              onClick={() => handleAddCanoeAfter(index)}
                              className="text-[18px] font-bold text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-colors leading-none"
                              title="Add canoe"
                            >
                              +
                            </span>
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
                        <div className="flex items-center justify-between" style={{ flex: 1, padding: '0 4px 0 0' }}>
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
                                    style={{ width: dynamicCircleW, height: CIRCLE_SIZE, position: 'relative', flexShrink: 0 }}
                                  >
                                    <div
                                      className={`rounded-full flex items-center justify-center transition-all
                                        ${snapshot.isDraggingOver ? 'scale-110 ring-2 ring-slate-400' : assignedPaddler ? '' : 'border-2 border-dashed border-slate-400'}`}
                                      style={{ ...(!assignedPaddler && !snapshot.isDraggingOver ? { backgroundColor: '#9ca3af' } : snapshot.isDraggingOver ? { backgroundColor: '#9ca3af' } : {}), width: dynamicCircleW, height: CIRCLE_SIZE }}
                                    >
                                      {assignedPaddler ? (
                                        <Draggable draggableId={assignedPaddler.id} index={0} shouldRespectForcePress={false}>
                                          {(provided, snapshot) => {
                                            const node = (
                                              <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} tabIndex={-1} role="none" aria-roledescription="" style={{ ...provided.draggableProps.style, touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none' }}>
                                                <PaddlerCircle paddler={assignedPaddler} isDragging={snapshot.isDragging} animationKey={animationKey} animationDelay={seat * 30} sizeW={dynamicCircleW} compact={sidebarOpen} />
                                              </div>
                                            );
                                            return node;
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
              </div>

              {/* RIGHT COLUMN - STAGING SIDEBAR */}
              <div
                className="scrollbar-hidden"
                style={{
                  width: sidebarOpen ? 176 : 24,
                  height: '100%',
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: isDragging ? 'hidden' : sidebarOpen ? 'auto' : 'hidden',
                  overflowX: 'hidden',
                  touchAction: isDragging ? 'none' : 'auto',
                  backgroundColor: sidebarOpen ? '#374151' : 'transparent',
                  padding: sidebarOpen ? '12px 4px 0 4px' : '12px 0 0 0',
                  paddingBottom: 0,
                  borderLeft: '1px solid #94a3b8',
                  borderRight: '1px solid #94a3b8',
                }}
              >
                {/* Toolbar - sticky */}
                <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: sidebarOpen ? '#374151' : 'transparent', padding: '12px 4px 0 4px' }}>
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
                    <div style={{ position: 'relative', marginLeft: 'auto' }}>
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
                </>
                )}
                </div>

                {sidebarOpen && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Staging - single drop zone */}
                <Droppable droppableId="staging-all" direction="horizontal" isDropDisabled={dragFromStaging}>
                  {(provided, snapshot) => {
                    // Flatten all sections into one ordered list for draggable indices
                    const allPaddlers: Paddler[] = [];
                    const sectionBreaks: { index: number; label: string; id: string }[] = [];
                    if (viewSections.length > 0) {
                      viewSections.forEach((section) => {
                        const sectionSort = sectionSorts[section.id] || "gender";
                        const sorted = sortPaddlers(section.paddlers, sectionSort);
                        sectionBreaks.push({ index: allPaddlers.length, label: section.label, id: section.id });
                        allPaddlers.push(...sorted);
                      });
                    }

                    return (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`rounded-lg transition-colors flex flex-wrap content-start
                          ${snapshot.isDraggingOver ? 'bg-amber-50 dark:bg-amber-950/30 ring-2 ring-amber-400/50' : ''}`}
                        style={{ padding: '4px', gap: '4px', marginTop: '8px', flex: 1, minHeight: '100px' }}
                      >
                        {allPaddlers.length > 0 ? allPaddlers.map((paddler: Paddler, index: number) => {
                          const sectionBreak = sectionBreaks.find(b => b.index === index);
                          return (
                            <Fragment key={paddler._id.toString()}>
                              {sectionBreak && (
                                <div className="flex items-center justify-between w-full" style={{ padding: '4px 0 2px' }}>
                                  <span className="font-semibold text-slate-300 text-sm">
                                    {sectionBreak.label} ({viewSections.find(s => s.id === sectionBreak.id)?.paddlers.length})
                                  </span>
                                  <div style={{ position: 'relative' }}>
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
                                    style={{ ...provided.draggableProps.style, touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none' }}
                                  >
                                    <PaddlerCircle paddler={paddler} isDragging={snapshot.isDragging} animationKey={animationKey} animationDelay={index * 20} />
                                  </div>
                                )}
                              </Draggable>
                            </Fragment>
                          );
                        }) : (
                          <span className="text-slate-400 text-sm w-full text-center mt-4">Drag paddlers here to unassign</span>
                        )}
                        {provided.placeholder}
                      </div>
                    );
                  }}
                </Droppable>
                </div>
                )}
                {/* Bottom spacer to keep content above iOS browser bar */}
                <div style={{ flexShrink: 0, height: 80, minHeight: 80 }} />
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
