import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { DragStart, DragUpdate, DropResult } from "@hello-pangea/dnd";
import { useMutation, useQuery } from "convex/react";
import { api } from "./convex_generated/api";
import type { Id } from "./convex_generated/dataModel";
import type { Paddler, Canoe, CanoeSortItem } from "./types";
import { getLocalToday, sortPaddlersByPriority, CANOE_SORT_OPTIONS } from "./utils";
import { useAnimationTrigger } from "./useAnimationTrigger";
import type { EditForm } from "./EditPaddlerModal";

interface SelectedEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  eventType?: string;
}

export function useCanoeAssignment(currentUser: { email: string; role: string; paddlerId: string }) {
  const isAdmin = currentUser.role === 'admin';
  // ─── DRAG STABILITY LAYER ───
  // @hello-pangea/dnd has a footgun: if a Draggable unmounts mid-drag
  // (e.g. because one of these Convex queries blips back to undefined
  // during a reconnect), the library's lock resets the internal phase
  // to IDLE, the subsequent window-mouseup no-ops, onDragEnd never
  // fires, and a position:fixed drag clone is stranded on the page with
  // touchAction:none locking the entire UI. We defend against that by
  // caching the last non-undefined snapshot of each query and, while a
  // drag is in flight, substituting the cached snapshot whenever the
  // live query is undefined so the render tree stays intact and the
  // Draggables never unmount. isDragging is declared up here (rather
  // than with the other drag state below) so the substitution is
  // available before any memo that consumes these values.
  const [isDragging, setIsDragging] = useState(false);
  const [dragFromStaging, setDragFromStaging] = useState(false);
  // Canoe id that is the SOURCE of the current drag (null when not
  // dragging from a canoe, e.g. dragging from On Shore). TodayView uses
  // this to boost the source canoe card's z-index during the drag, so
  // the drag clone (a descendant of the card) paints above sibling
  // canoe cards that come later in the fleet grid's DOM order.
  const [draggingFromCanoeId, setDraggingFromCanoeId] = useState<string | null>(null);
  // Canoe id that the drag is currently HOVERING over (null when over On
  // Shore / nothing). TodayView uses this to pop the hovered canoe card
  // above the On Shore drawer so you can actually see the target seats
  // while dragging, even when the drawer otherwise overlaps the card.
  const [draggingOverCanoeId, setDraggingOverCanoeId] = useState<string | null>(null);
  const _canoesLive = useQuery(api.canoes.getCanoes);
  const _paddlersLive = useQuery(api.paddlers.getPaddlers);
  const lastCanoesRef = useRef(_canoesLive);
  const lastPaddlersRef = useRef(_paddlersLive);
  if (_canoesLive !== undefined) lastCanoesRef.current = _canoesLive;
  if (_paddlersLive !== undefined) lastPaddlersRef.current = _paddlersLive;
  // Always prefer the cached snapshot when live is undefined — not just
  // during a drag. Convex reconnect blips that flash empty lists unmount
  // the Draggable tree, which the library can't recover from. Cheap
  // loading UX win too.
  const canoes = _canoesLive === undefined ? lastCanoesRef.current : _canoesLive;
  const paddlers = _paddlersLive === undefined ? lastPaddlersRef.current : _paddlersLive;
  // ─── OPTIMISTIC DRAG COMMIT ───
  // Without these, the moment pangea drops a paddler onto a new seat
  // the UI re-renders from the stale Convex cache (paddler still in
  // old seat / old on-shore slot) until the server round-trip returns,
  // which shows as a brief flash of the pre-drag state before the new
  // one appears. Each mutation now applies the same mutation-logic
  // locally against the getEventAssignments query so the UI snaps to
  // the post-drop state immediately. Convex reconciles the real server
  // result against the optimistic value when it arrives.
  // Shape of a single row in the getEventAssignments query result. We
  // type this locally so the optimistic filter/push callbacks below
  // don't fall through to implicit-any under strict tsc -b builds —
  // Convex's generated types don't always propagate the element type
  // through .filter/.push without a hint.
  type AssignmentRow = {
    _id: Id<"eventAssignments">;
    _creationTime: number;
    eventId: string;
    canoeId: string;
    seat: number;
    paddlerId: string;
  };
  const assignPaddler = useMutation(api.eventAssignments.assignPaddlerToSeat)
    .withOptimisticUpdate((localStore, args) => {
      const { eventId, paddlerId, canoeId, seat } = args;
      const existing = localStore.getQuery(api.eventAssignments.getEventAssignments, { eventId }) as AssignmentRow[] | undefined;
      if (existing === undefined) return;
      // Mirror server logic: remove any existing assignment for this
      // paddler in this event, then remove any current occupant of the
      // target seat, then insert the new assignment.
      const next: AssignmentRow[] = existing.filter(
        (a) => a.paddlerId !== paddlerId && !(a.canoeId === canoeId && a.seat === seat)
      );
      next.push({
        _id: `optimistic-assign-${paddlerId}-${canoeId}-${seat}-${Date.now()}` as Id<"eventAssignments">,
        _creationTime: Date.now(),
        eventId, canoeId, seat, paddlerId,
      });
      localStore.setQuery(api.eventAssignments.getEventAssignments, { eventId }, next);
    });
  const unassignPaddler = useMutation(api.eventAssignments.unassignPaddler)
    .withOptimisticUpdate((localStore, args) => {
      const { eventId, paddlerId, canoeId, seat } = args;
      const existing = localStore.getQuery(api.eventAssignments.getEventAssignments, { eventId }) as AssignmentRow[] | undefined;
      if (existing === undefined) return;
      const next: AssignmentRow[] = existing.filter(
        (a) => !(a.paddlerId === paddlerId && a.canoeId === canoeId && a.seat === seat)
      );
      localStore.setQuery(api.eventAssignments.getEventAssignments, { eventId }, next);
    });
  const swapPaddlers = useMutation(api.eventAssignments.swapPaddlers)
    .withOptimisticUpdate((localStore, args) => {
      const { eventId, paddlerA, canoeA, seatA, paddlerB, canoeB, seatB } = args;
      const existing = localStore.getQuery(api.eventAssignments.getEventAssignments, { eventId }) as AssignmentRow[] | undefined;
      if (existing === undefined) return;
      // Drop both paddlers' current rows, then re-insert them at each
      // other's seat. Same shape as the server mutation.
      const next: AssignmentRow[] = existing.filter((a) => a.paddlerId !== paddlerA && a.paddlerId !== paddlerB);
      const now = Date.now();
      next.push(
        {
          _id: `optimistic-swap-${paddlerA}-${canoeB}-${seatB}-${now}` as Id<"eventAssignments">,
          _creationTime: now,
          eventId, canoeId: canoeB, seat: seatB, paddlerId: paddlerA,
        },
        {
          _id: `optimistic-swap-${paddlerB}-${canoeA}-${seatA}-${now}` as Id<"eventAssignments">,
          _creationTime: now,
          eventId, canoeId: canoeA, seat: seatA, paddlerId: paddlerB,
        },
      );
      localStore.setQuery(api.eventAssignments.getEventAssignments, { eventId }, next);
    });
  const assignOptimal = useMutation(api.eventAssignments.assignOptimalForEvent);
  const unassignAllForEventMut = useMutation(api.eventAssignments.unassignAllForEvent);
  const populatePaddlers = useMutation(api.paddlers.populateSamplePaddlers);
  const populateCanoes = useMutation(api.canoes.populateSampleCanoes);
  const addCanoe = useMutation(api.canoes.addCanoe);
  const removeCanoe = useMutation(api.canoes.removeCanoe);
  const updatePaddler = useMutation(api.paddlers.updatePaddler);
  const toggleAttendanceMut = useMutation(api.attendance.toggleAttendance);
  const setAttendanceMut = useMutation(api.attendance.setAttendance);
  const removeGuestMut = useMutation(api.eventGuests.removeGuest);
  const addGuestMut = useMutation(api.eventGuests.addGuest);
  const allEvents = useQuery(api.events.getEvents);
  const allUsers = useQuery(api.auth.getAllUsers);
  const updateDesignationMut = useMutation(api.canoes.updateDesignation);
  const renameCanoeMut = useMutation(api.canoes.renameCanoe);
  const toggleAdminMut = useMutation(api.auth.toggleAdmin);
  const deleteUserByPaddlerIdMut = useMutation(api.auth.deleteUserByPaddlerId);
  const deletePaddlerMut = useMutation(api.paddlers.deletePaddler);

  const userEmailByPaddlerId = useMemo(() => {
    if (!allUsers) return new Map<string, string>();
    return new Map<string, string>(allUsers.map((u: { paddlerId: string; email: string }) => [u.paddlerId, u.email]));
  }, [allUsers]);

  const userRoleByPaddlerId = useMemo(() => {
    if (!allUsers) return new Map<string, string>();
    return new Map<string, string>(allUsers.map((u: { paddlerId: string; role: string }) => [u.paddlerId, u.role]));
  }, [allUsers]);

  const [selectedPaddlerId, setSelectedPaddlerId] = useState<string | null>(() => localStorage.getItem('selectedPaddlerId') || currentUser.paddlerId);
  useEffect(() => {
    const handler = () => setSelectedPaddlerId(localStorage.getItem('selectedPaddlerId'));
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const [canoePriority, setCanoePriority] = useState<CanoeSortItem[]>(() => {
    const saved = localStorage.getItem('canoePriority');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const requiredIds = CANOE_SORT_OPTIONS.map(o => o.id);
        const hasAllIds = requiredIds.every(id => parsed.some((p: CanoeSortItem) => p.id === id));
        if (hasAllIds) return parsed;
      } catch { /* fall through to default */ }
    }
    return CANOE_SORT_OPTIONS;
  });

  useEffect(() => {
    localStorage.setItem('canoePriority', JSON.stringify(canoePriority));
  }, [canoePriority]);

  const [viewBy, setViewBy] = useState<"ability" | "gender" | "type" | "seatPreference">("ability");
  const [isReassigning, setIsReassigning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 768 : true);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 768 : true);
  const [activePage, setActivePage] = useState<'today' | 'roster' | 'schedule' | 'attendance' | 'crews'>('today');
  const [scrollToEventId, setScrollToEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);
  const [showAllBoats, setShowAllBoats] = useState(false);
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const addSearchInputRef = useRef<HTMLInputElement>(null);
  const addSearchMenuRef = useRef<HTMLDivElement>(null);
  const [showGoingList, setShowGoingList] = useState(false);
  const scheduleScrollPosRef = useRef(0);

  useEffect(() => {
    if (!showAddSearch) return;
    const handler = (e: MouseEvent) => {
      if (addSearchMenuRef.current && !addSearchMenuRef.current.contains(e.target as Node)) {
        setShowAddSearch(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddSearch]);

  const eventAttendance = useQuery(
    api.attendance.getAttendanceForEvent,
    selectedEvent ? { eventId: selectedEvent.id } : "skip"
  );
  const eventAttendingPaddlerIds = useMemo(() => {
    if (!eventAttendance) return null;
    return new Set<string>(eventAttendance.map((a: { paddlerId: string }) => a.paddlerId));
  }, [eventAttendance]);

  const _eventAssignmentsLive = useQuery(
    api.eventAssignments.getEventAssignments,
    selectedEvent ? { eventId: selectedEvent.id } : "skip"
  );
  const lastEventAssignmentsRef = useRef(_eventAssignmentsLive);
  if (_eventAssignmentsLive !== undefined) lastEventAssignmentsRef.current = _eventAssignmentsLive;
  const eventAssignments = _eventAssignmentsLive === undefined
    ? lastEventAssignmentsRef.current
    : _eventAssignmentsLive;

  const eventGuests = useQuery(
    api.eventGuests.getByEvent,
    selectedEvent ? { eventId: selectedEvent.id } : "skip"
  );

  const canoeAssignmentsByCanoe = useMemo(() => {
    const map = new Map<string, { seat: number; paddlerId: string }[]>();
    if (!eventAssignments) return map;
    for (const a of eventAssignments) {
      const list = map.get(a.canoeId) || [];
      list.push({ seat: a.seat, paddlerId: a.paddlerId });
      map.set(a.canoeId, list);
    }
    return map;
  }, [eventAssignments]);

  const assignedPaddlerIds = useMemo(() => {
    if (!eventAssignments) return new Set<string>();
    return new Set<string>(eventAssignments.map((a: { paddlerId: string }) => a.paddlerId));
  }, [eventAssignments]);

  const todayEvent = useMemo(() => {
    if (!allEvents) return undefined;
    const today = getLocalToday();
    const todaysEvents = allEvents.filter((e: { date: string }) => e.date === today);
    const evt = todaysEvents.length > 0 ? todaysEvents.reduce((a: { time: string }, b: { time: string }) => a.time >= b.time ? a : b) : null;
    if (!evt) {
      const upcoming = allEvents.filter((e: { date: string }) => e.date > today);
      if (upcoming.length === 0) return null;
      const next = upcoming.reduce((a: { date: string }, b: { date: string }) => a.date <= b.date ? a : b);
      return { id: next.id, title: next.title, date: next.date, time: next.time, location: next.location, eventType: next.eventType };
    }
    return { id: evt.id, title: evt.title, date: evt.date, time: evt.time, location: evt.location, eventType: evt.eventType };
  }, [allEvents]);

  useEffect(() => {
    if (todayEvent && !selectedEvent) {
      setSelectedEvent(todayEvent);
    }
  }, [todayEvent]);

  const [editingPaddler, setEditingPaddler] = useState<Paddler | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    firstName: '',
    lastName: '',
    gender: 'kane',
    type: 'casual',
    ability: 3,
    seatPreference: '000000',
  });

  const { animationKey, trigger: triggerAnimation } = useAnimationTrigger();

  const [pendingAssignIds, setPendingAssignIds] = useState<Set<string>>(new Set());

  // Watchdog: if a drag somehow gets stranded (library swallowed
  // onDragEnd because of a mid-drag remount, for example), force the
  // drag state off after a generous timeout so touchAction:none is
  // cleared and the UI stops being frozen. Belt-and-suspenders on top
  // of the stability layer above.
  const dragWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearDragWatchdog = useCallback(() => {
    if (dragWatchdogRef.current) {
      clearTimeout(dragWatchdogRef.current);
      dragWatchdogRef.current = null;
    }
  }, []);

  const handleDragStart = useCallback((start: DragStart) => {
    setIsDragging(true);
    setDragFromStaging(start.source.droppableId.startsWith('staging-'));
    // Source droppableId for a paddler sitting in a canoe is
    // `paddler-host-canoe-${canoeId}-seat-${seat}` — extract the canoe
    // id so TodayView can raise its z-index during the drag. Null for
    // drags originating in On Shore / staging.
    const m = start.source.droppableId.match(/^paddler-host-canoe-(.+)-seat-\d+$/);
    setDraggingFromCanoeId(m ? m[1] : null);
    setDraggingOverCanoeId(null);
    clearDragWatchdog();
    dragWatchdogRef.current = setTimeout(() => {
      // Last-resort belt-and-suspenders: if 15 seconds have elapsed and
      // the drag still hasn't resolved (neither a normal drop nor the
      // mouseup-based recovery in App.tsx fired), force-clear our state
      // so at minimum touchAction:none is removed and the UI thaws.
      setIsDragging(false);
      setDragFromStaging(false);
      setDraggingFromCanoeId(null);
      setDraggingOverCanoeId(null);
    }, 15000);
  }, [clearDragWatchdog]);

  // onDragUpdate fires every time the pangea engine recomputes the drop
  // destination — including when the drag enters / leaves / switches
  // between droppables. Parse the destination droppableId to recover
  // which canoe (if any) the drag is currently over, so the card can be
  // lifted above the On Shore drawer while the user hovers. Matches both
  // seat shapes: `canoe-<id>-seat-<n>` (the drop zone itself) and
  // `paddler-host-canoe-<id>-seat-<n>` (the inner paddler host, for
  // swap-onto-occupied-seat drops).
  const handleDragUpdate = useCallback((update: DragUpdate) => {
    const id = update.destination?.droppableId ?? '';
    const m = id.match(/^(?:paddler-host-)?canoe-(.+)-seat-\d+$/);
    setDraggingOverCanoeId(m ? m[1] : null);
  }, []);

  useEffect(() => clearDragWatchdog, [clearDragWatchdog]);

  useEffect(() => {
    const handler = () => {
      if (document.activeElement && document.activeElement !== document.body) {
        (document.activeElement as HTMLElement).blur();
      }
    };
    document.addEventListener('touchstart', handler, { passive: true });
    return () => document.removeEventListener('touchstart', handler);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handler = (e: TouchEvent) => { e.preventDefault(); };
    document.addEventListener('touchmove', handler, { passive: false });
    return () => document.removeEventListener('touchmove', handler);
  }, [isDragging]);

  const canoeSortedPaddlers = useMemo(() =>
    paddlers ? sortPaddlersByPriority(paddlers, canoePriority) : [],
  [paddlers, canoePriority]);

  const unassignedPaddlers = useMemo(() => {
    if (!paddlers || !selectedEvent || !eventAttendingPaddlerIds) return [];
    return paddlers.filter((p: Paddler) => !assignedPaddlerIds.has(p.id) && eventAttendingPaddlerIds.has(p.id));
  }, [paddlers, selectedEvent, eventAttendingPaddlerIds, assignedPaddlerIds]);

  const guestPaddlerMap = useMemo(() => {
    const map = new Map<string, Paddler>();
    if (!eventGuests) return map;
    for (const guest of eventGuests) {
      const nameParts = guest.name.trim().split(/\s+/);
      const firstName = nameParts[0] || guest.name;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      const guestId = `guest-${guest._id}`;
      map.set(guestId, {
        _id: guest._id,
        _creationTime: 0,
        id: guestId,
        firstName,
        lastInitial: lastName ? lastName[0] : firstName[0],
        lastName: lastName || undefined,
        gender: 'kane' as const,
        type: 'casual' as const,
        ability: 0,
      } as Paddler);
    }
    return map;
  }, [eventGuests]);

  const unassignedGuests = useMemo(() => {
    if (!eventGuests) return [];
    return eventGuests.filter((g: any) => !assignedPaddlerIds.has(`guest-${g._id}`));
  }, [eventGuests, assignedPaddlerIds]);

  const handleToggleAttendance = useCallback(async (paddlerId: string, eventId: string) => {
    const wasAttending = eventAttendingPaddlerIds?.has(paddlerId);
    await toggleAttendanceMut({ paddlerId, eventId });
    if (wasAttending) {
      const assignment = eventAssignments?.find((a: { paddlerId: string }) => a.paddlerId === paddlerId);
      if (assignment) {
        await unassignPaddler({ eventId, paddlerId, canoeId: assignment.canoeId, seat: assignment.seat });
      }
    }
  }, [eventAttendingPaddlerIds, eventAssignments, toggleAttendanceMut, unassignPaddler]);

  const [lockedCanoes, setLockedCanoes] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('lockedCanoes');
    if (saved) { try { return new Set(JSON.parse(saved)); } catch { /* default */ } }
    return new Set();
  });

  useEffect(() => {
    localStorage.setItem('lockedCanoes', JSON.stringify([...lockedCanoes]));
  }, [lockedCanoes]);

  const canoeDesignations = useMemo(() => {
    if (!canoes) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    for (const c of canoes) {
      if (c.designation) map[c.id] = c.designation;
    }
    return map;
  }, [canoes]);

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1000);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 100));
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const handleReassignCanoes = useCallback(async (onlyReassignExisting = true) => {
    if (!paddlers || !canoes || isReassigning || !selectedEvent) return;
    triggerAnimation();
    setIsReassigning(true);
    await assignOptimal({
      eventId: selectedEvent.id,
      priority: canoePriority,
      excludeCanoeIds: [...lockedCanoes],
      onlyReassignExisting,
    });
    setIsReassigning(false);
  }, [paddlers, canoes, isReassigning, selectedEvent, canoePriority, lockedCanoes, triggerAnimation]);

  const prevCanoePriorityRef = useRef<string>("");
  useEffect(() => {
    const priorityKey = canoePriority.map(p => p.id).join(",");
    if (prevCanoePriorityRef.current && prevCanoePriorityRef.current !== priorityKey && !isReassigning) {
      handleReassignCanoes();
    }
    prevCanoePriorityRef.current = priorityKey;
    // Include handleReassignCanoes + isReassigning so the effect always
    // closes over the freshest versions. The if-guard above (priorityKey
    // change vs ref) keeps the actual reassign call gated on canoePriority
    // changes; extra re-runs from handleReassignCanoes identity flips are
    // cheap no-ops that just refresh the ref.
  }, [canoePriority, handleReassignCanoes, isReassigning]);

  const onDragEnd = async (result: DropResult) => {
    clearDragWatchdog();
    setIsDragging(false);
    setDragFromStaging(false);
    setDraggingFromCanoeId(null);
    setDraggingOverCanoeId(null);
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const isGuestDrag = draggableId.startsWith('guest-');

    if (destination.droppableId === "trash-can") {
      if (!selectedEvent) return;
      const draggedPaddler = paddlers?.find((p: Paddler) => p.id === draggableId) || guestPaddlerMap.get(draggableId);
      if (draggedPaddler) {
        const paddlerAssignment = eventAssignments?.find((a: { paddlerId: string }) => a.paddlerId === draggableId);
        if (paddlerAssignment) {
          await unassignPaddler({ eventId: selectedEvent.id, paddlerId: draggableId, canoeId: paddlerAssignment.canoeId, seat: paddlerAssignment.seat });
        }
        if (isGuestDrag) {
          await removeGuestMut({ guestId: draggedPaddler._id as any });
        } else {
          await setAttendanceMut({ paddlerId: draggableId, eventId: selectedEvent.id, attending: false });
        }
      }
      return;
    }

    if (destination.droppableId === "edit-area") {
      if (isGuestDrag) return;
      const draggedPaddler = paddlers?.find((p: Paddler) => p.id === draggableId);
      if (draggedPaddler) {
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
      }
      return;
    }

    if (!selectedEvent) return;

    const draggedPaddler = paddlers?.find((p: Paddler) => p.id === draggableId) || guestPaddlerMap.get(draggableId);
    if (!draggedPaddler) return;

    const currentAssignment = eventAssignments?.find((a: { paddlerId: string }) => a.paddlerId === draggableId);
    const oldCanoeId = currentAssignment?.canoeId;
    const oldSeat = currentAssignment?.seat;

    if (oldCanoeId && lockedCanoes.has(oldCanoeId)) return;
    if (source.droppableId === destination.droppableId) return;

    if (destination.droppableId.startsWith("staging-")) {
      if (oldCanoeId && oldSeat) {
        await unassignPaddler({ eventId: selectedEvent.id, paddlerId: draggableId, canoeId: oldCanoeId, seat: oldSeat });
      }
      return;
    }

    const destParts = destination.droppableId.split("-");
    if (destParts.length !== 4 || destParts[0] !== "canoe" || destParts[2] !== "seat") return;
    const destCanoeId = destParts[1];
    const destSeat = parseInt(destParts[3]);
    if (lockedCanoes.has(destCanoeId) || isNaN(destSeat)) return;
    if (!canoes?.find((c: Canoe) => c.id === destCanoeId)) return;
    // Self-drop: source is paddler-host-canoe-X-seat-Y, dest is canoe-X-seat-Y — never string-equal, so compare by id/seat.
    if (oldCanoeId === destCanoeId && oldSeat === destSeat) return;

    const destAssignments = canoeAssignmentsByCanoe.get(destCanoeId) || [];
    const existingAssignment = destAssignments.find(a => a.seat === destSeat);
    const existingPaddlerId = existingAssignment?.paddlerId;

    const idsToHide = [draggableId];
    if (existingPaddlerId && existingPaddlerId !== draggableId) idsToHide.push(existingPaddlerId);
    setPendingAssignIds(prev => { const next = new Set(prev); idsToHide.forEach(id => next.add(id)); return next; });

    try {
      if (existingPaddlerId && existingPaddlerId !== draggableId && oldCanoeId && oldSeat) {
        await swapPaddlers({
          eventId: selectedEvent.id,
          paddlerA: draggableId, canoeA: oldCanoeId, seatA: oldSeat,
          paddlerB: existingPaddlerId, canoeB: destCanoeId, seatB: destSeat,
        });
        return;
      }

      if (existingPaddlerId && existingPaddlerId !== draggableId) {
        await unassignPaddler({ eventId: selectedEvent.id, paddlerId: existingPaddlerId, canoeId: destCanoeId, seat: destSeat });
      }

      await assignPaddler({ eventId: selectedEvent.id, paddlerId: draggableId, canoeId: destCanoeId, seat: destSeat });
      if (oldCanoeId && oldSeat && (oldCanoeId !== destCanoeId || oldSeat !== destSeat)) {
        await unassignPaddler({ eventId: selectedEvent.id, paddlerId: draggableId, canoeId: oldCanoeId, seat: oldSeat });
      }
    } finally {
      setPendingAssignIds(prev => { const next = new Set(prev); idsToHide.forEach(id => next.delete(id)); return next; });
    }
  };

  const handleRemoveCanoe = (canoeId: string) => {
    if (!canoes) return;
    removeCanoe({ canoeId });
  };

  const handleAddCanoeAfter = (_index: number) => {
    // Create canoe with blank name; the name is populated later when the
    // user selects a canoe # from the designation picker.
    addCanoe({ name: '' });
  };

  const handleUnassignAll = async () => {
    if (!selectedEvent) return;
    await unassignAllForEventMut({
      eventId: selectedEvent.id,
      excludeCanoeIds: [...lockedCanoes],
    });
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
    if (!paddlers || !canoes || !selectedEvent) return;
    const attendingCount = eventAttendingPaddlerIds ? eventAttendingPaddlerIds.size : paddlers.length;
    const neededCanoes = Math.ceil(attendingCount / 6);
    if (neededCanoes > canoes.length) {
      // Auto-created canoes get a blank name; admin can assign a canoe # later.
      for (let i = canoes.length; i < neededCanoes; i++) {
        await addCanoe({ name: '' });
      }
    }
    triggerAnimation();
    assignOptimal({ eventId: selectedEvent.id, priority: canoePriority, excludeCanoeIds: [...lockedCanoes] });
  };

  // Layout sizing — mobile-only now, no desktop sidebars.
  const sidebarW = 0;
  const leftSidebarW = 0;
  // 12px horizontal padding on each side of <main>; keep in sync with App.tsx.
  const mainPad = 24;
  const maxLayoutWidth = 1152; // max-w-6xl = 72rem
  const effectiveWidth = Math.min(windowWidth, maxLayoutWidth);
  const containerWidth = effectiveWidth - sidebarW - leftSidebarW - mainPad;
  const canoeMargin = 20;
  const gridPad = 32;
  const boatWidth = Math.floor((containerWidth - canoeMargin - gridPad) / 2);
  const seatHeight = 22;
  const canoeRowHeight = 6 * seatHeight;

  const dataLoading = canoes === undefined || paddlers === undefined;
  const hasNoData = !dataLoading && canoes.length === 0 && paddlers.length === 0;

  return {
    // Data
    isAdmin, canoes, paddlers, allEvents, canoeSortedPaddlers,
    canoeAssignmentsByCanoe, eventAssignments, eventAttendingPaddlerIds,
    eventGuests, guestPaddlerMap, assignedPaddlerIds, unassignedPaddlers, unassignedGuests,
    userEmailByPaddlerId, userRoleByPaddlerId, canoeDesignations,
    dataLoading, hasNoData, todayEvent,

    // State
    selectedPaddlerId, selectedEvent, setSelectedEvent,
    canoePriority, setCanoePriority, viewBy, setViewBy,
    sidebarOpen, setSidebarOpen, leftSidebarOpen, setLeftSidebarOpen,
    activePage, setActivePage, scrollToEventId, setScrollToEventId,
    showAllBoats, setShowAllBoats, showGoingList, setShowGoingList,
    showAddSearch, setShowAddSearch, addSearchQuery, setAddSearchQuery,
    addSearchInputRef, addSearchMenuRef,
    lockedCanoes, setLockedCanoes, windowWidth,
    editingPaddler, isEditModalOpen, editForm, setEditForm,
    isDragging, pendingAssignIds, dragFromStaging, draggingFromCanoeId, draggingOverCanoeId,
    animationKey, scheduleScrollPosRef,

    // Layout
    containerWidth, boatWidth, canoeRowHeight, canoeMargin,

    // Handlers
    handleDragStart, handleDragUpdate, onDragEnd, handleToggleAttendance,
    handleAssign, handleUnassignAll, handleReassignCanoes,
    handleRemoveCanoe, handleAddCanoeAfter, handleSaveEdit, handleCloseEditModal,
    triggerAnimation, populatePaddlers, populateCanoes, addCanoe,
    updatePaddler, updateDesignationMut, renameCanoeMut, toggleAdminMut,
    deleteUserByPaddlerIdMut, deletePaddlerMut, setAttendanceMut,
    removeGuestMut, addGuestMut,
  };
}
