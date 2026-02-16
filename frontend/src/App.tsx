import { useMutation, useQuery, Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "./convex_generated/api";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult, DragStart, DragUpdate } from "@hello-pangea/dnd";
import type { Doc } from "./convex_generated/dataModel";
import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from "react";

import { useAnimationTrigger } from "./useAnimationTrigger";
import LoginPage from "./LoginPage";
import OnboardingPage from "./OnboardingPage";

type User = { email: string; role: "admin" | "normal"; paddlerId: string };

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
  { id: "ability", label: "ability", gradient: "from-violet-500 to-purple-600", icon: "⭐" },
  { id: "gender", label: "gender", gradient: "from-pink-500 to-rose-500", icon: "⚥" },
  { id: "type", label: "racer?", gradient: "from-cyan-500 to-blue-500", icon: "🏁" },
  { id: "seatPreference", label: "seat", gradient: "from-orange-500 to-amber-500", icon: "💺" },
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

  const firstInitial = paddler.firstName?.[0] || '?';
  const lastInitial = paddler.lastName?.[0] || paddler.lastInitial || '?';
  const maxFirstNameLen = 5;
  const truncatedFirst = paddler.firstName.length > maxFirstNameLen
    ? paddler.firstName.slice(0, maxFirstNameLen)
    : paddler.firstName;

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
      {/* Name - two lines centered */}
      <div className="flex flex-col items-center justify-center leading-none text-center px-0.5 max-w-full" style={{ color: '#e0e0e0' }}>
        <span className="text-[10px] font-black truncate max-w-full" style={{ WebkitTextStroke: '0.3px' }}>{compact ? firstInitial : truncatedFirst}</span>
        <span className="text-[10px] font-black" style={{ WebkitTextStroke: '0.3px' }}>{lastInitial}</span>
      </div>
      
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
          sections.push({ id: `ability-${i}`, label: `level ${i}`, paddlers: sectionPaddlers });
        }
      }
      return sections;
    }
    case "gender": {
      const kane = paddlers.filter(p => p.gender === "kane");
      const wahine = paddlers.filter(p => p.gender === "wahine");
      const sections = [];
      if (kane.length > 0) sections.push({ id: "gender-kane", label: "kane", paddlers: kane });
      if (wahine.length > 0) sections.push({ id: "gender-wahine", label: "wahine", paddlers: wahine });
      return sections;
    }
    case "type": {
      const racer = paddlers.filter(p => p.type === "racer");
      const casual = paddlers.filter(p => p.type === "casual");
      const veryCasual = paddlers.filter(p => p.type === "very-casual");
      const sections = [];
      if (racer.length > 0) sections.push({ id: "type-racer", label: "racer", paddlers: racer });
      if (casual.length > 0) sections.push({ id: "type-casual", label: "casual", paddlers: casual });
      if (veryCasual.length > 0) sections.push({ id: "type-very-casual", label: "very casual", paddlers: veryCasual });
      return sections;
    }
    case "seatPreference": {
      const sections = [];
      for (let seat = 1; seat <= 6; seat++) {
        const sectionPaddlers = paddlers.filter(p => getPrimarySeatPreference(p.seatPreference) === seat);
        if (sectionPaddlers.length > 0) {
          sections.push({ id: `seat-${seat}`, label: `seat ${seat}`, paddlers: sectionPaddlers });
        }
      }
      const noPref = paddlers.filter(p => !p.seatPreference || p.seatPreference === "000000");
      if (noPref.length > 0) {
        sections.push({ id: "seat-none", label: "no pref", paddlers: noPref });
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

function SchedulePage({ onSelectEvent, isAdmin = true, scrollPosRef }: { onSelectEvent?: (evt: { id: string; title: string; date: string; time: string; location: string; eventType?: string }) => void; isAdmin?: boolean; scrollPosRef?: React.MutableRefObject<number> }) {
  const events = useQuery(api.events.getEvents);
  const paddlers = useQuery(api.paddlers.getPaddlers);
  const addEventMut = useMutation(api.events.addEvent);
  const updateEventMut = useMutation(api.events.updateEvent);
  const deleteEventMut = useMutation(api.events.deleteEvent);
  const toggleAttendanceMut = useMutation(api.attendance.toggleAttendance);

  const [selectedPaddlerId, setSelectedPaddlerId] = useState<string | null>(() => {
    return localStorage.getItem('selectedPaddlerId');
  });

  // Persist selected paddler to localStorage
  useEffect(() => {
    if (selectedPaddlerId) {
      localStorage.setItem('selectedPaddlerId', selectedPaddlerId);
    } else {
      localStorage.removeItem('selectedPaddlerId');
    }
  }, [selectedPaddlerId]);

  // Reset if selected paddler no longer exists
  useEffect(() => {
    if (selectedPaddlerId && paddlers && !paddlers.find((p: Paddler) => p.id === selectedPaddlerId)) {
      setSelectedPaddlerId(null);
    }
  }, [selectedPaddlerId, paddlers]);

  const attendanceData = useQuery(
    api.attendance.getAttendanceForPaddler,
    selectedPaddlerId ? { paddlerId: selectedPaddlerId } : "skip"
  );

  const attendingEventIds = useMemo(() => {
    if (!attendanceData) return new Set<string>();
    return new Set(attendanceData.filter((a: { attending: boolean }) => a.attending).map((a: { eventId: string }) => a.eventId));
  }, [attendanceData]);

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '', date: '', time: '', location: '',
    eventType: 'practice' as 'practice' | 'race' | 'other',
    repeating: 'none' as 'none' | 'weekly' | 'monthly',
    weekdays: [] as number[],
    monthdays: [] as number[],
    repeatUntil: '',
  });
  const [activeMonth, setActiveMonth] = useState('');
  const scheduleScrollRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Restore scroll position when returning to schedule page
  useEffect(() => {
    if (scrollPosRef && scheduleScrollRef.current && scrollPosRef.current > 0) {
      scheduleScrollRef.current.scrollTop = scrollPosRef.current;
    }
  }, []);

  const eventsByMonth = useMemo(() => {
    if (!events) return [];
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = events.filter((e: { date: string }) => e.date >= today);
    const grouped: Record<string, typeof upcoming> = {};
    for (const e of upcoming) {
      const monthKey = e.date.slice(0, 7);
      if (!grouped[monthKey]) grouped[monthKey] = [];
      grouped[monthKey].push(e);
    }
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    return Object.keys(grouped).sort().map(month => {
      const [y, m] = month.split('-');
      return {
        month,
        label: `${monthNames[parseInt(m) - 1]} ${y}`,
        events: grouped[month].sort((a: { date: string; time: string }, b: { date: string; time: string }) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
      };
    });
  }, [events]);

  const allMonths = useMemo(() => {
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const now = new Date();
    const result: { month: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      result.push({ month: key, label: `${monthNames[d.getMonth()]} ${d.getFullYear()}` });
    }
    return result;
  }, []);

  const monthList = useMemo(() => allMonths.map(m => m.month), [allMonths]);

  useEffect(() => {
    if (!activeMonth && allMonths.length > 0) {
      setActiveMonth(allMonths[0].month);
    }
  }, [allMonths, activeMonth]);

  return (
    <div style={{ display: 'flex', height: 'calc(100% - 40px)', gap: '0' }}>
      {/* Event list */}
      <div
        ref={scheduleScrollRef}
        onScroll={() => {
          const container = scheduleScrollRef.current;
          if (!container) return;
          const scrollTop = container.scrollTop;
          if (scrollPosRef) scrollPosRef.current = scrollTop;
          let found = monthList[0] || '';
          for (const m of monthList) {
            const el = monthRefs.current[m];
            if (el && el.offsetTop - container.offsetTop <= scrollTop + 60) {
              found = m;
            }
          }
          if (found && found !== activeMonth) setActiveMonth(found);
        }}
        style={{ flex: 1, overflowY: 'auto', padding: '0 16px', position: 'relative' }}
        className="scrollbar-hidden"
      >
        {/* Floating + event button (admin only) */}
        {isAdmin && <div style={{ position: 'sticky', top: '8px', zIndex: 20, float: 'right' }}>
          <span
            onClick={() => {
              setEditingEventId(null);
              setEventForm({ title: '', date: '', time: '', location: '', eventType: 'practice', repeating: 'none', weekdays: [], monthdays: [], repeatUntil: '' });
              setShowEventForm(!showEventForm);
            }}
            style={{
              cursor: 'pointer', fontSize: '16px', fontWeight: 800, color: '#475569',
              userSelect: 'none', padding: '4px 12px', backgroundColor: '#e2e8f0', borderRadius: '999px',
            }}
          >
            + event
          </span>

          {/* Inline event form */}
          {showEventForm && !editingEventId && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowEventForm(false)} />
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', zIndex: 20, width: '260px', backgroundColor: '#111111', borderRadius: '8px', padding: '12px', border: '1px solid #4b5563', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Event type selector */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {(['practice', 'race', 'other'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setEventForm(f => ({ ...f, eventType: t }))}
                    style={{
                      padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                      border: '2px solid',
                      borderColor: eventForm.eventType === t ? (t === 'practice' ? '#3b82f6' : t === 'race' ? '#ef4444' : '#64748b') : 'transparent',
                      backgroundColor: eventForm.eventType === t ? (t === 'practice' ? 'rgba(59,130,246,0.15)' : t === 'race' ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)') : 'transparent',
                      color: eventForm.eventType === t ? (t === 'practice' ? '#60a5fa' : t === 'race' ? '#f87171' : '#94a3b8') : '#6b7280',
                      cursor: 'pointer',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="title"
                value={eventForm.title}
                onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                style={{ backgroundColor: '#000000', border: '1px solid #4b5563', borderRadius: '6px', padding: '6px 10px', color: '#c0c0c0', fontSize: '14px', outline: 'none' }}
              />
              <input
                type="text"
                placeholder="location"
                value={eventForm.location}
                onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))}
                style={{ backgroundColor: '#000000', border: '1px solid #4b5563', borderRadius: '6px', padding: '6px 10px', color: '#c0c0c0', fontSize: '14px', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                {(editingEventId || eventForm.repeating === 'none') && (
                  <input
                    type="date"
                    value={eventForm.date}
                    onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
                    style={{ flex: 1, backgroundColor: '#000000', border: '1px solid #4b5563', borderRadius: '6px', padding: '6px 10px', color: '#c0c0c0', fontSize: '14px', outline: 'none' }}
                  />
                )}
                <input
                  type="time"
                  value={eventForm.time}
                  onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))}
                  style={{ flex: 1, backgroundColor: '#000000', border: '1px solid #4b5563', borderRadius: '6px', padding: '6px 10px', color: '#c0c0c0', fontSize: '14px', outline: 'none' }}
                />
              </div>
              {!editingEventId && (<>
              {/* Repeating pills */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600, marginRight: '2px' }}>repeat:</span>
                {(['none', 'weekly', 'monthly'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setEventForm(f => ({ ...f, repeating: r, weekdays: [], monthdays: [], repeatUntil: r !== 'none' && !f.repeatUntil ? new Date().toISOString().slice(0, 10) : f.repeatUntil }))}
                    style={{
                      padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                      border: '2px solid',
                      borderColor: eventForm.repeating === r ? '#3b82f6' : 'transparent',
                      backgroundColor: eventForm.repeating === r ? 'rgba(59,130,246,0.15)' : 'transparent',
                      color: eventForm.repeating === r ? '#60a5fa' : '#6b7280',
                      cursor: 'pointer',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {/* Day-of-week multi-select for weekly */}
              {eventForm.repeating === 'weekly' && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const).map((day, i) => {
                    const isSelected = eventForm.weekdays.includes(i);
                    return (
                      <button
                        key={day}
                        onClick={() => {
                          setEventForm(f => ({
                            ...f,
                            weekdays: isSelected ? f.weekdays.filter(d => d !== i) : [...f.weekdays, i].sort(),
                          }));
                        }}
                        style={{
                          padding: '4px 0', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                          border: '2px solid',
                          borderColor: isSelected ? '#3b82f6' : '#4b5563',
                          backgroundColor: isSelected ? 'rgba(59,130,246,0.15)' : 'transparent',
                          color: isSelected ? '#60a5fa' : '#6b7280',
                          cursor: 'pointer',
                          flex: 1,
                          textAlign: 'center',
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Day-of-month mini calendar for monthly */}
              {eventForm.repeating === 'monthly' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                    const isSelected = eventForm.monthdays.includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => {
                          setEventForm(f => ({
                            ...f,
                            monthdays: isSelected ? f.monthdays.filter(d => d !== day) : [...f.monthdays, day].sort((a, b) => a - b),
                          }));
                        }}
                        style={{
                          padding: '3px 0', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                          border: '1.5px solid',
                          borderColor: isSelected ? '#3b82f6' : '#4b5563',
                          backgroundColor: isSelected ? 'rgba(59,130,246,0.15)' : 'transparent',
                          color: isSelected ? '#60a5fa' : '#6b7280',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Till when */}
              {eventForm.repeating !== 'none' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600, flexShrink: 0 }}>till when</span>
                  <input
                    type="date"
                    value={eventForm.repeatUntil}
                    onChange={e => setEventForm(f => ({ ...f, repeatUntil: e.target.value }))}
                    style={{ flex: 1, backgroundColor: '#000000', border: '1px solid #4b5563', borderRadius: '6px', padding: '6px 10px', color: '#c0c0c0', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              )}
              </>)}
              {/* Buttons */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowEventForm(false); setEditingEventId(null); }}
                  style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: '1px solid #4b5563', backgroundColor: 'transparent', color: '#9ca3af', cursor: 'pointer' }}
                >
                  cancel
                </button>
                <button
                  onClick={async () => {
                    if (!eventForm.title || !eventForm.time) return;
                    const startDate = eventForm.date || new Date().toISOString().slice(0, 10);
                    await addEventMut({
                      title: eventForm.title,
                      date: startDate,
                      time: eventForm.time,
                      location: eventForm.location || '',
                      eventType: eventForm.eventType,
                      repeating: eventForm.repeating,
                      weekdays: eventForm.weekdays.length > 0 ? eventForm.weekdays : undefined,
                      monthdays: eventForm.monthdays.length > 0 ? eventForm.monthdays : undefined,
                      repeatUntil: eventForm.repeatUntil || undefined,
                    });
                    setShowEventForm(false);
                  }}
                  style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: '1px solid #3b82f6', backgroundColor: 'rgba(59,130,246,0.2)', color: '#60a5fa', cursor: 'pointer' }}
                >
                  add
                </button>
              </div>
            </div>
          </div>
            </>
          )}
        </div>}

        {/* Event list by month */}
        {allMonths.map(m => {
          const group = eventsByMonth.find(g => g.month === m.month);
          const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
          return (
            <div key={m.month} ref={el => { monthRefs.current[m.month] = el; }}>
              <div style={{ fontSize: '20px', color: '#9ca3af', fontWeight: 700, padding: '18px 0 10px', textTransform: 'lowercase' }}>
                {m.label}
              </div>
              {group ? group.events.map((evt: { id: string; title: string; date: string; time: string; location: string; eventType?: string; repeating: string; weekdays?: number[]; monthdays?: number[]; repeatUntil?: string }) => {
                const d = new Date(evt.date + 'T00:00:00');
                const dayNum = d.getDate();
                const dayName = dayNames[d.getDay()];
                if (editingEventId === evt.id && showEventForm) {
                  return (
                    <div key={evt.id} style={{ backgroundColor: '#111111', borderRadius: '8px', padding: '12px', marginBottom: '4px', marginTop: '4px', border: '1px solid #4b5563' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Event type selector */}
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(['practice', 'race', 'other'] as const).map(t => (
                            <button
                              key={t}
                              onClick={() => setEventForm(f => ({ ...f, eventType: t }))}
                              style={{
                                padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                                border: '2px solid',
                                borderColor: eventForm.eventType === t ? (t === 'practice' ? '#3b82f6' : t === 'race' ? '#ef4444' : '#64748b') : 'transparent',
                                backgroundColor: eventForm.eventType === t ? (t === 'practice' ? 'rgba(59,130,246,0.15)' : t === 'race' ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)') : 'transparent',
                                color: eventForm.eventType === t ? (t === 'practice' ? '#60a5fa' : t === 'race' ? '#f87171' : '#94a3b8') : '#6b7280',
                                cursor: 'pointer',
                              }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="title"
                          value={eventForm.title}
                          onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                          style={{ backgroundColor: '#000000', border: '1px solid #4b5563', borderRadius: '6px', padding: '6px 10px', color: '#c0c0c0', fontSize: '14px', outline: 'none' }}
                        />
                        <input
                          type="text"
                          placeholder="location"
                          value={eventForm.location}
                          onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))}
                          style={{ backgroundColor: '#000000', border: '1px solid #4b5563', borderRadius: '6px', padding: '6px 10px', color: '#c0c0c0', fontSize: '14px', outline: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="date"
                            value={eventForm.date}
                            onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
                            style={{ flex: 1, backgroundColor: '#000000', border: '1px solid #4b5563', borderRadius: '6px', padding: '6px 10px', color: '#c0c0c0', fontSize: '14px', outline: 'none' }}
                          />
                          <input
                            type="time"
                            value={eventForm.time}
                            onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))}
                            style={{ flex: 1, backgroundColor: '#000000', border: '1px solid #4b5563', borderRadius: '6px', padding: '6px 10px', color: '#c0c0c0', fontSize: '14px', outline: 'none' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => { setShowEventForm(false); setEditingEventId(null); }}
                            style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: '1px solid #4b5563', backgroundColor: 'transparent', color: '#9ca3af', cursor: 'pointer' }}
                          >
                            cancel
                          </button>
                          <button
                            onClick={async () => {
                              if (!eventForm.title || !eventForm.time) return;
                              await updateEventMut({
                                eventId: editingEventId,
                                title: eventForm.title,
                                date: eventForm.date,
                                time: eventForm.time,
                                location: eventForm.location,
                                eventType: eventForm.eventType,
                              });
                              setShowEventForm(false);
                              setEditingEventId(null);
                            }}
                            style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: '1px solid #3b82f6', backgroundColor: 'rgba(59,130,246,0.2)', color: '#60a5fa', cursor: 'pointer' }}
                          >
                            save
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                const isAttending = attendingEventIds.has(evt.id);
                return (
                  <div
                    key={evt.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0', borderBottom: '1px solid #4b5563' }}
                  >
                    <div
                      onClick={() => onSelectEvent?.({ id: evt.id, title: evt.title, date: evt.date, time: evt.time, location: evt.location, eventType: evt.eventType })}
                      style={{ width: '48px', textAlign: 'center', flexShrink: 0, cursor: onSelectEvent ? 'pointer' : 'default' }}
                    >
                      <div style={{ fontSize: '24px', fontWeight: 700, color: '#e0e0e0', lineHeight: 1.1 }}>{dayNum}</div>
                      <div style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 600 }}>{dayName}</div>
                    </div>
                    {selectedPaddlerId && (
                      <div
                        onClick={() => toggleAttendanceMut({ paddlerId: selectedPaddlerId, eventId: evt.id })}
                        style={{
                          width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', userSelect: 'none',
                          border: `2px solid ${isAttending ? '#22c55e' : '#ef4444'}`,
                          backgroundColor: isAttending ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                          color: isAttending ? '#22c55e' : '#ef4444',
                          fontSize: '18px', fontWeight: 700,
                        }}
                      >
                        {isAttending ? 'Y' : 'N'}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div
                        onClick={() => onSelectEvent?.({ id: evt.id, title: evt.title, date: evt.date, time: evt.time, location: evt.location, eventType: evt.eventType })}
                        style={{ fontSize: '20px', color: '#e0e0e0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: onSelectEvent ? 'pointer' : 'default' }}
                      ><span style={{ fontWeight: 700 }}>{evt.time}</span> {evt.title}</div>
                      <div style={{ fontSize: '16px', color: '#9ca3af', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {evt.eventType && (
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px', fontSize: '13px', fontWeight: 600,
                            backgroundColor: evt.eventType === 'practice' ? 'rgba(59,130,246,0.15)' : evt.eventType === 'race' ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)',
                            color: evt.eventType === 'practice' ? '#60a5fa' : evt.eventType === 'race' ? '#f87171' : '#94a3b8',
                            border: `1px solid ${evt.eventType === 'practice' ? 'rgba(59,130,246,0.3)' : evt.eventType === 'race' ? 'rgba(239,68,68,0.3)' : 'rgba(100,116,139,0.3)'}`,
                          }}>
                            {evt.eventType}
                          </span>
                        )}
                        {evt.location && <span>{evt.location}</span>}
                      </div>
                    </div>
                    {isAdmin && <svg
                      onClick={() => {
                        setEditingEventId(evt.id);
                        setEventForm({
                          title: evt.title, date: evt.date, time: evt.time, location: evt.location,
                          eventType: (evt.eventType || 'practice') as 'practice' | 'race' | 'other',
                          repeating: evt.repeating as 'none' | 'weekly' | 'monthly',
                          weekdays: evt.weekdays || [],
                          monthdays: evt.monthdays || [],
                          repeatUntil: evt.repeatUntil || '',
                        });
                        setShowEventForm(true);
                      }}
                      width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ cursor: 'pointer', flexShrink: 0, padding: '6px', boxSizing: 'content-box' }}
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>}
                    {isAdmin && <svg
                      onClick={() => deleteEventMut({ eventId: evt.id })}
                      width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ cursor: 'pointer', flexShrink: 0, padding: '6px', boxSizing: 'content-box' }}
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>}
                  </div>
                );
              }) : (
                <div style={{ padding: '12px 0', fontSize: '16px', color: '#4b5563' }}>—</div>
              )}
            </div>
          );
        })}
        <div style={{ height: '80px' }} />
      </div>
    </div>
  );
}

function AppMain({ currentUser, onLogout }: { currentUser: User; onLogout: () => void }) {
  const isAdmin = currentUser.role === 'admin';
  const canoes = useQuery(api.canoes.getCanoes);
  const paddlers = useQuery(api.paddlers.getPaddlers);
  const assignPaddler = useMutation(api.eventAssignments.assignPaddlerToSeat);
  const unassignPaddler = useMutation(api.eventAssignments.unassignPaddler);
  const assignOptimal = useMutation(api.eventAssignments.assignOptimalForEvent);
  const unassignAllForEventMut = useMutation(api.eventAssignments.unassignAllForEvent);
  const populatePaddlers = useMutation(api.paddlers.populateSamplePaddlers);
  const populateCanoes = useMutation(api.canoes.populateSampleCanoes);
  // Unused: clearPaddlers, clearCanoes
  // const _clearPaddlers = useMutation(api.paddlers.clearAllPaddlers);
  // const _clearCanoes = useMutation(api.canoes.clearAllCanoes);
  const addCanoe = useMutation(api.canoes.addCanoe);
  const removeCanoe = useMutation(api.canoes.removeCanoe);


  const updatePaddler = useMutation(api.paddlers.updatePaddler);
  const toggleAttendanceMut = useMutation(api.attendance.toggleAttendance);
  const setAttendanceMut = useMutation(api.attendance.setAttendance);
  const allEvents = useQuery(api.events.getEvents);
  const allUsers = useQuery(api.auth.getAllUsers);
  const userEmailByPaddlerId = useMemo(() => {
    if (!allUsers) return new Map<string, string>();
    return new Map<string, string>(allUsers.map((u: { paddlerId: string; email: string }) => [u.paddlerId, u.email]));
  }, [allUsers]);
  const userRoleByPaddlerId = useMemo(() => {
    if (!allUsers) return new Map<string, string>();
    return new Map<string, string>(allUsers.map((u: { paddlerId: string; role: string }) => [u.paddlerId, u.role]));
  }, [allUsers]);
  const toggleAdminMut = useMutation(api.auth.toggleAdmin);
  const deleteUserByPaddlerIdMut = useMutation(api.auth.deleteUserByPaddlerId);
  const deletePaddlerMut = useMutation(api.paddlers.deletePaddler);

  // Read selectedPaddlerId from localStorage (persisted by SchedulePage), fallback to currentUser
  const [selectedPaddlerId, setSelectedPaddlerId] = useState<string | null>(() => localStorage.getItem('selectedPaddlerId') || currentUser.paddlerId);
  useEffect(() => {
    const handler = () => setSelectedPaddlerId(localStorage.getItem('selectedPaddlerId'));
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);



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
  const [activePage, setActivePage] = useState<'today' | 'roster' | 'schedule' | 'attendance' | 'crews'>('today');
  const [selectedEvent, setSelectedEvent] = useState<{ id: string; title: string; date: string; time: string; location: string; eventType?: string } | null>(null);
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const addSearchInputRef = useRef<HTMLInputElement>(null);
  const [showGoingList, setShowGoingList] = useState(false);
  const scheduleScrollPosRef = useRef(0);

  const eventAttendance = useQuery(
    api.attendance.getAttendanceForEvent,
    selectedEvent ? { eventId: selectedEvent.id } : "skip"
  );
  const eventAttendingPaddlerIds = useMemo(() => {
    if (!eventAttendance) return null;
    return new Set(eventAttendance.map((a: { paddlerId: string }) => a.paddlerId));
  }, [eventAttendance]);

  const eventAssignments = useQuery(
    api.eventAssignments.getEventAssignments,
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
    return new Set(eventAssignments.map((a: { paddlerId: string }) => a.paddlerId));
  }, [eventAssignments]);

  // Find today's event, or the next upcoming event if none today
  const todayEvent = useMemo(() => {
    if (!allEvents) return undefined; // still loading
    const today = new Date().toISOString().slice(0, 10);
    const evt = allEvents.find((e: { date: string }) => e.date === today);
    if (!evt) {
      // No event today — find the next upcoming event
      const upcoming = allEvents.filter((e: { date: string }) => e.date > today);
      if (upcoming.length === 0) return null;
      const next = upcoming.reduce((a: { date: string }, b: { date: string }) => a.date <= b.date ? a : b);
      return { id: next.id, title: next.title, date: next.date, time: next.time, location: next.location, eventType: next.eventType };
    }
    return { id: evt.id, title: evt.title, date: evt.date, time: evt.time, location: evt.location, eventType: evt.eventType };
  }, [allEvents]);

  // Auto-select today's event on load (once events are loaded and no event selected yet)
  useEffect(() => {
    if (todayEvent && !selectedEvent) {
      setSelectedEvent(todayEvent);
    }
  }, [todayEvent]);

  const [editingSeatPrefId, setEditingSeatPrefId] = useState<string | null>(null);
  const [tempSeatPref, setTempSeatPref] = useState('000000');
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
  const sortPillRef = useRef<HTMLDivElement>(null);
  const openSortMenuRef = useRef<HTMLDivElement>(null);

  // Close sort menus on click outside
  useEffect(() => {
    if (!sortPillOpen && !openSortMenu) return;
    const handler = (e: MouseEvent) => {
      if (sortPillOpen && sortPillRef.current && !sortPillRef.current.contains(e.target as Node)) {
        setSortPillOpen(false);
      }
      if (openSortMenu && openSortMenuRef.current && !openSortMenuRef.current.contains(e.target as Node)) {
        setOpenSortMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sortPillOpen, openSortMenu]);
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

  // Canoe designations - read from DB, derive as a map
  const updateDesignationMut = useMutation(api.canoes.updateDesignation);
  const canoeDesignations = useMemo(() => {
    if (!canoes) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    for (const c of canoes) {
      if (c.designation) map[c.id] = c.designation;
    }
    return map;
  }, [canoes]);
  const [openDesignator, setOpenDesignator] = useState<string | null>(null);
  
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

  const unassignedPaddlers = useMemo(() => {
    if (!paddlers || !selectedEvent || !eventAttendingPaddlerIds) return [];
    return paddlers.filter((p: Paddler) => !assignedPaddlerIds.has(p.id) && eventAttendingPaddlerIds.has(p.id));
  }, [paddlers, selectedEvent, eventAttendingPaddlerIds, assignedPaddlerIds]);

  // Toggle attendance and unassign from canoe (even locked) when marking NO
  const handleToggleAttendance = useCallback(async (paddlerId: string, eventId: string) => {
    const wasAttending = eventAttendingPaddlerIds?.has(paddlerId);
    await toggleAttendanceMut({ paddlerId, eventId });
    // If toggling from YES to NO, also unassign from their canoe seat
    if (wasAttending) {
      const assignment = eventAssignments?.find((a: { paddlerId: string }) => a.paddlerId === paddlerId);
      if (assignment) {
        await unassignPaddler({ eventId, paddlerId, canoeId: assignment.canoeId, seat: assignment.seat });
      }
    }
  }, [eventAttendingPaddlerIds, eventAssignments, toggleAttendanceMut, unassignPaddler]);

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

    // Handle trash can - mark absent for event, or just unassign if no event
    if (destination.droppableId === "trash-can") {
      if (!selectedEvent) return;
      const draggedPaddler = paddlers?.find((p: Paddler) => p.id === draggableId);
      if (draggedPaddler) {
        // Unassign from canoe if assigned in this event
        const paddlerAssignment = eventAssignments?.find((a: { paddlerId: string }) => a.paddlerId === draggableId);
        if (paddlerAssignment) {
          await unassignPaddler({
            eventId: selectedEvent.id,
            paddlerId: draggableId,
            canoeId: paddlerAssignment.canoeId,
            seat: paddlerAssignment.seat,
          });
        }
        // Set attendance to NO
        await setAttendanceMut({ paddlerId: draggableId, eventId: selectedEvent.id, attending: false });
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

    if (!selectedEvent) return;

    const draggedPaddler = paddlers?.find((p: Paddler) => p.id === draggableId);
    if (!draggedPaddler) return;

    // Look up current assignment from eventAssignments
    const currentAssignment = eventAssignments?.find((a: { paddlerId: string }) => a.paddlerId === draggableId);
    const oldCanoeId = currentAssignment?.canoeId;
    const oldSeat = currentAssignment?.seat;

    // Block dragging from a locked canoe
    if (oldCanoeId && lockedCanoes.has(oldCanoeId)) return;

    if (source.droppableId === destination.droppableId) return;

    // Dropped to staging
    if (destination.droppableId.startsWith("staging-")) {
      if (oldCanoeId && oldSeat) {
        await unassignPaddler({ eventId: selectedEvent.id, paddlerId: draggableId, canoeId: oldCanoeId, seat: oldSeat });
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

    // Look up existing occupant from eventAssignments
    const destAssignments = canoeAssignmentsByCanoe.get(destCanoeId) || [];
    const existingAssignment = destAssignments.find(a => a.seat === destSeat);
    const existingPaddlerId = existingAssignment?.paddlerId;

    // SWAP - handle seamlessly without going through staging
    if (existingPaddlerId && existingPaddlerId !== draggableId) {
      const existingPaddler = paddlers?.find((p: Paddler) => p.id === existingPaddlerId);
      if (existingPaddler && oldCanoeId && oldSeat) {
        // Direct swap - both operations in parallel
        await Promise.all([
          unassignPaddler({ eventId: selectedEvent.id, paddlerId: existingPaddlerId, canoeId: destCanoeId, seat: destSeat }),
          assignPaddler({ eventId: selectedEvent.id, paddlerId: existingPaddlerId, canoeId: oldCanoeId, seat: oldSeat })
        ]);
      } else {
        await unassignPaddler({ eventId: selectedEvent.id, paddlerId: existingPaddlerId, canoeId: destCanoeId, seat: destSeat });
      }
    }

    // Only unassign if we're actually moving (not just swapping)
    if (oldCanoeId && oldSeat && (oldCanoeId !== destCanoeId || oldSeat !== destSeat)) {
      await unassignPaddler({ eventId: selectedEvent.id, paddlerId: draggableId, canoeId: oldCanoeId, seat: oldSeat });
    }

    await assignPaddler({ eventId: selectedEvent.id, paddlerId: draggableId, canoeId: destCanoeId, seat: destSeat });
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
    if (!selectedEvent) return;
    await unassignAllForEventMut({
      eventId: selectedEvent.id,
      excludeCanoeIds: [...lockedCanoes],
    });
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
    if (!paddlers || !canoes || !selectedEvent) return;
    // Count attending paddlers for this event
    const attendingCount = eventAttendingPaddlerIds ? eventAttendingPaddlerIds.size : paddlers.length;
    const neededCanoes = Math.ceil(attendingCount / 6);
    if (neededCanoes > canoes.length) {
      for (let i = canoes.length; i < neededCanoes; i++) {
        await addCanoe({ name: `Canoe ${i + 1}` });
      }
    }
    triggerAnimation();
    assignOptimal({ eventId: selectedEvent.id, priority: canoePriority, excludeCanoeIds: [...lockedCanoes] });
  };

  const dataLoading = canoes === undefined || paddlers === undefined;
  const hasNoData = !dataLoading && canoes.length === 0 && paddlers.length === 0;

  // Calculate dynamic horizontal sizing (no CSS transform)
  const sidebarW = activePage === 'today' && isAdmin ? (sidebarOpen ? 176 : 24) : 0;
  const leftSidebarW = leftSidebarOpen ? 110 : 28;
  const mainPad = 4;
  const flexGap = 8;
  const containerWidth = windowWidth - sidebarW - leftSidebarW - flexGap * (sidebarW > 0 ? 2 : 1) - mainPad;
  const leftControlWidth = 36;
  const canoePadding = 16;
  const availableForSeats = containerWidth - leftControlWidth - canoePadding;
  const dynamicGap = Math.min(PADDING, Math.max(2, Math.floor((availableForSeats - CIRCLE_SIZE * 6) / 5)));
  const dynamicCircleW = Math.min(CIRCLE_SIZE, Math.max(20, Math.floor((availableForSeats - dynamicGap * 5) / 6) - 2));
  // Canoe row height: fit 6 rows in viewport minus sticky sort bar (~32px)
  const sortBarHeight = 32;
  const canoeMargin = 20;
  const canoeRowHeight = Math.floor((windowHeight - sortBarHeight - canoeMargin * 6) / 7);

  return (
    <DragDropContext onDragEnd={onDragEnd} onDragStart={handleDragStart} onDragUpdate={handleDragUpdate}>
      <div className="overflow-hidden" style={{ height: '100%', backgroundColor: '#000000', touchAction: isDragging ? 'none' : 'auto', paddingTop: 'env(safe-area-inset-top)' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap');`}</style>
        {/* Header - compact */}
        <main className="max-w-6xl mx-auto" style={{ height: '100%', overflow: 'hidden', padding: '0 2px' }}>
          {dataLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000', zIndex: 50 }}>
              <span style={{ fontFamily: "'UnifrakturMaguntia', cursive", color: '#dc2626', WebkitTextStroke: '1.5px white', paintOrder: 'stroke fill', textShadow: '-1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white', fontSize: '36px' }}>Lokahi</span>
            </div>
          ) : hasNoData ? (
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
                  width: leftSidebarOpen ? 110 : 28,
                  height: '100%',
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: leftSidebarOpen ? 'auto' : 'hidden',
                  overflowX: 'hidden',
                  backgroundColor: '#000000',
                  padding: '12px 4px 0 4px',
                  borderRight: '1px solid #4b5563',
                }}
              >
                <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: '#000000', padding: '12px 4px 0 4px' }}>
                  <div className="flex items-center" style={{ marginBottom: '4px', justifyContent: leftSidebarOpen ? 'flex-end' : 'center' }}>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 4px', flex: 1 }}>
                    {([
                      { page: 'today' as const, icon: '⊞', label: 'event' },
                      { page: 'schedule' as const, icon: '☰', label: 'schedule' },
                      { page: 'roster' as const, icon: '♱', label: 'roster' },
                      { page: 'attendance' as const, icon: '✓', label: 'attendance' },
                      { page: 'crews' as const, icon: '⛵', label: 'crews' },
                    ]).map(({ page, icon, label }) => (
                      <span
                        key={page}
                        onClick={() => { setActivePage(page); if (page === 'today') setSelectedEvent(todayEvent || null); }}
                        title={label}
                        className="cursor-pointer transition-colors"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 0 6px 0',
                          borderRadius: '8px',
                          color: activePage === page ? '#ffffff' : '#c0c0c0',
                          backgroundColor: activePage === page ? '#4b5563' : 'transparent',
                          userSelect: 'none',
                          justifyContent: 'flex-start',
                        }}
                        onMouseEnter={(e) => { if (activePage !== page) e.currentTarget.style.backgroundColor = '#4b5563'; }}
                        onMouseLeave={(e) => { if (activePage !== page) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <span style={{ fontSize: '22px', lineHeight: 1, width: '20px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                        {leftSidebarOpen && <span style={{ fontSize: '15px', fontWeight: 500 }}>{label}</span>}
                      </span>
                    ))}
                    {leftSidebarOpen && (
                      <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #4b5563' }}>
                        <div style={{ fontSize: '10px', color: '#9ca3af', padding: '0 8px', wordBreak: 'break-all' }}>
                          {currentUser.email}
                        </div>
                        <span
                          onClick={onLogout}
                          className="cursor-pointer hover:text-white transition-colors"
                          style={{ fontSize: '13px', color: '#9ca3af', padding: '4px 8px', display: 'block' }}
                        >
                          log out
                        </span>
                      </div>
                    )}
                  </div>
              </div>

              {/* MIDDLE COLUMN - CANOES */}
              <div style={{ width: containerWidth, minWidth: 0, flexShrink: 0, overflow: 'hidden', height: '100%' }}>
              <div className="scrollbar-hidden" onClick={() => showGoingList && setShowGoingList(false)} style={{ width: '100%', maxWidth: '100%', overflowY: isDragging ? 'hidden' : 'auto', overflowX: 'hidden', height: '100%', touchAction: isDragging ? 'none' : 'auto', paddingBottom: 'env(safe-area-inset-bottom)' }}>
                {/* Header */}
                <div className="py-1" style={{ width: '100%', maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap' }}>
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
                    Lokahi
                  </span>
                  {activePage === 'today' && (selectedEvent ? (() => {
                    const d = new Date(selectedEvent.date + 'T00:00:00');
                    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                    const dayName = dayNames[d.getDay()];
                    const dayMonth = `${d.getMonth() + 1}/${d.getDate()}`;
                    const goingCount = eventAttendingPaddlerIds && paddlers ? paddlers.filter((p: Paddler) => eventAttendingPaddlerIds.has(p.id)).length : 0;
                    return (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '18px', color: '#c0c0c0', fontWeight: 700, position: 'relative', whiteSpace: 'nowrap' }}>
                        <span style={{ overflow: 'hidden' }}>{dayName} {dayMonth}</span>
                        {!sidebarOpen && <>
                        <span
                          onClick={() => setShowGoingList(!showGoingList)}
                          style={{ fontSize: '14px', color: '#3b82f6', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
                        >
                          ({goingCount} going)
                        </span>
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
                              ATTENDING ({goingCount})
                            </div>
                            {goingCount === 0 ? (
                              <div style={{ fontSize: '14px', color: '#6b7280' }}>No one yet</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                                {paddlers
                                  ?.filter((p: Paddler) => eventAttendingPaddlerIds!.has(p.id))
                                  .sort((a: Paddler, b: Paddler) => a.firstName.localeCompare(b.firstName))
                                  .map((p: Paddler) => (
                                    <div key={p.id} style={{ fontSize: '14px', color: '#e5e7eb' }}>
                                      {p.firstName} {p.lastName || p.lastInitial}
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        )}
                        </>}
                      </span>
                    );
                  })() : (
                    <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>{(() => {
                      const now = new Date();
                      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                      return `${dayNames[now.getDay()]} ${now.getMonth() + 1}/${now.getDate()} ---`;
                    })()}</span>
                  ))}
                </div>
                {activePage === 'today' && (<>
                {/* Sort Widget (admin only) */}
                {isAdmin && selectedEvent && <div className="flex items-center px-1 py-1 sticky z-20" style={{ top: 0, backgroundColor: '#000000', width: '100%', maxWidth: '600px', margin: '0 auto', gap: '8px' }}>
                    <div ref={sortPillRef} style={{ position: 'relative' }}>
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
                        {sidebarOpen && windowWidth < 768 ? 'sort:' : 'sort by:'}
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
                      )}
                    </div>
                    <div style={{ flex: 1 }} />
                    <span
                      onClick={handleAssign}
                      style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 800, color: '#475569', userSelect: 'none', padding: '2px 8px', backgroundColor: '#e2e8f0', borderRadius: '999px', whiteSpace: 'nowrap' }}
                    >
                      {sidebarOpen && windowWidth < 768 ? '←' : '←assign'}
                    </span>
                    <span
                      onClick={() => { triggerAnimation(); handleUnassignAll(); }}
                      style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 800, color: '#475569', userSelect: 'none', padding: '2px 8px', backgroundColor: '#e2e8f0', borderRadius: '999px', whiteSpace: 'nowrap' }}
                    >
                      {sidebarOpen && windowWidth < 768 ? '→' : 'return→'}
                    </span>
                </div>}

                {selectedEvent && (
                <div style={{ width: '100%', maxWidth: '600px', margin: '20px auto 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '26px', fontWeight: 800, color: '#e5e7eb', marginBottom: '12px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {selectedPaddlerId && (() => {
                      const isAttending = eventAttendingPaddlerIds ? eventAttendingPaddlerIds.has(selectedPaddlerId) : false;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <div
                            onClick={() => selectedEvent && handleToggleAttendance(selectedPaddlerId, selectedEvent.id)}
                            style={{
                              width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', userSelect: 'none',
                              border: `2px solid ${isAttending ? '#22c55e' : '#ef4444'}`,
                              backgroundColor: isAttending ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                              color: isAttending ? '#22c55e' : '#ef4444',
                              fontSize: '16px', fontWeight: 700,
                            }}
                          >
                            {isAttending ? 'Y' : 'N'}
                          </div>
                        </div>
                      );
                    })()}
                    <span style={{ color: '#6b7280', flexShrink: 0 }}>-</span>
                    <span style={{ overflow: 'hidden' }}>{selectedEvent?.time}{!sidebarOpen && ` ${selectedEvent?.title}`}</span>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '22px', fontWeight: 700, color: '#e5e7eb', letterSpacing: '1px', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden' }}>PADDLER ASSIGNMENT</div>
                  {canoes?.map((canoe: Canoe, index: number) => {
                    const canoeEventAssignments = canoeAssignmentsByCanoe.get(canoe.id) || [];
                    const isFull = canoeEventAssignments.length === 6;
                    return (
                      <div
                        key={canoe._id.toString()}
                        className={`rounded-xl border ${lockedCanoes.has(canoe.id) ? 'border-red-400' : isFull ? 'border-emerald-300 dark:border-emerald-700' : 'border-slate-400'} shadow-sm flex items-center gap-0`}
                        style={{ backgroundColor: 'transparent', padding: '8px 4px', marginBottom: `${canoeMargin}px`, height: `${canoeRowHeight}px`, boxSizing: 'border-box', position: 'relative' }}
                      >
                        {/* Lock button - top right (admin only) */}
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
                          style={{ position: 'absolute', top: '3px', right: '4px', cursor: 'pointer', zIndex: 5 }}
                        >
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          {lockedCanoes.has(canoe.id)
                            ? <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            : <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                          }
                        </svg>}
                        {/* Canoe designation pill — straddles top border */}
                        <div style={{ position: 'absolute', top: '-12px', left: '6px', zIndex: 5 }}>
                          <span
                            className={`transition-colors ${isAdmin && !lockedCanoes.has(canoe.id) ? 'cursor-pointer hover:text-blue-600' : 'cursor-default'}`}
                            style={{
                              display: 'inline-block',
                              fontSize: '10px',
                              fontWeight: 800,
                              color: '#94a3b8',
                              backgroundColor: '#000000',
                              border: '1px solid #64748b',
                              borderRadius: '999px',
                              padding: '1px 7px',
                              lineHeight: '14px',
                              whiteSpace: 'nowrap',
                            }}
                            onClick={() => isAdmin && !lockedCanoes.has(canoe.id) && setOpenDesignator(openDesignator === canoe.id ? null : canoe.id)}
                          >
                            {canoeDesignations[canoe.id] || '???'}
                          </span>
                          {/* Designation selector dropdown */}
                          {openDesignator === canoe.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenDesignator(null)} />
                              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-1.5 z-20 grid grid-cols-3 gap-1" style={{ minWidth: '110px' }}>
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
                            </>
                          )}
                        </div>
                        {/* -/+ circle buttons — straddle bottom border */}
                        {isAdmin && <div className="flex items-center" style={{ position: 'absolute', bottom: '-9px', left: '4px', zIndex: 5, gap: '6px' }}>
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

                        {/* 6 seats */}
                        <div className="flex items-center justify-between" style={{ flex: 1, padding: '0 4px' }}>
                          {Array.from({ length: 6 }).map((_, i) => {
                            const seat = i + 1;
                            const assignment = canoeEventAssignments.find(a => a.seat === seat);
                            const assignedPaddler = assignment ? canoeSortedPaddlers.find((p: Paddler) => p.id === assignment.paddlerId) : undefined;

                            return (
                              <Droppable droppableId={`canoe-${canoe.id}-seat-${seat}`} key={seat}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    style={{ width: dynamicCircleW, height: CIRCLE_SIZE, position: 'relative', flexShrink: 0 }}
                                  >
                                    {/* Empty seat / drag-over visual */}
                                    {(!assignedPaddler || snapshot.isDraggingOver || snapshot.draggingFromThisWith) && (
                                      <div
                                        className={`rounded-full transition-all ${snapshot.isDraggingOver ? 'scale-110 ring-2 ring-white' : 'border-2 border-dashed border-slate-400'}`}
                                        style={{ position: 'absolute', top: 0, left: 0, backgroundColor: snapshot.isDraggingOver ? '#60a5fa' : '#9ca3af', width: dynamicCircleW, height: CIRCLE_SIZE, pointerEvents: 'none' }}
                                      />
                                    )}
                                    {assignedPaddler ? (
                                      <Draggable draggableId={assignedPaddler.id} index={0} shouldRespectForcePress={false}>
                                        {(provided, snapshot) => (
                                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} tabIndex={-1} role="none" aria-roledescription="" style={{ ...provided.draggableProps.style, touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none' }}>
                                            <PaddlerCircle paddler={assignedPaddler} isDragging={snapshot.isDragging} animationKey={animationKey} animationDelay={seat * 30} sizeW={dynamicCircleW} compact={sidebarOpen && windowWidth < 768} />
                                          </div>
                                        )}
                                      </Draggable>
                                    ) : null}
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
                )}
                </>)}

                {activePage === 'schedule' && <SchedulePage isAdmin={isAdmin} scrollPosRef={scheduleScrollPosRef} onSelectEvent={(evt) => {
                  setSelectedEvent(evt);
                  setActivePage('today');
                }} />}

                {activePage === 'roster' && paddlers && (
                  <div style={{ padding: '8px 0', width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', minWidth: isAdmin ? '500px' : '280px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #4b5563' }}>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#9ca3af', fontSize: '12px', fontWeight: 600 }}>name</th>
                          <th style={{ textAlign: 'center', padding: '8px 12px', color: '#9ca3af', fontSize: '12px', fontWeight: 600 }}>gender</th>
                          {isAdmin && <th style={{ textAlign: 'center', padding: '8px 12px', color: '#9ca3af', fontSize: '12px', fontWeight: 600 }}>type</th>}
                          {isAdmin && <th style={{ textAlign: 'center', padding: '8px 12px', color: '#9ca3af', fontSize: '12px', fontWeight: 600 }}>ability</th>}
                          {isAdmin && <th style={{ textAlign: 'center', padding: '8px 12px', color: '#9ca3af', fontSize: '12px', fontWeight: 600 }}>seat pref</th>}
                          {isAdmin && <th style={{ textAlign: 'center', padding: '8px 4px', color: '#9ca3af', fontSize: '12px', fontWeight: 600, width: '40px' }}>adm</th>}
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: '#9ca3af', fontSize: '12px', fontWeight: 600 }}>email</th>
                          {isAdmin && <th style={{ width: '32px' }}></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {paddlers.map((p: Paddler) => (
                          <tr key={p._id.toString()} style={{ borderBottom: '1px solid #4b5563' }}>
                            <td style={{ padding: '8px 12px', color: '#c0c0c0', fontSize: '14px', fontWeight: 500 }}>
                              {p.firstName} {p.lastName}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <button
                                onClick={() => isAdmin && updatePaddler({ paddlerId: p.id, gender: p.gender === 'kane' ? 'wahine' : 'kane' })}
                                style={{
                                  padding: '4px 12px',
                                  borderRadius: '999px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  border: '2px solid',
                                  borderColor: p.gender === 'kane' ? '#3b82f6' : '#ec4899',
                                  backgroundColor: p.gender === 'kane' ? 'rgba(59,130,246,0.15)' : 'rgba(236,72,153,0.15)',
                                  color: p.gender === 'kane' ? '#60a5fa' : '#f472b6',
                                  cursor: isAdmin ? 'pointer' : 'default',
                                }}
                              >
                                {p.gender}
                              </button>
                            </td>
                            {isAdmin && <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              {windowWidth < 768 ? (
                                <button
                                  onClick={() => {
                                    const types: Array<'racer' | 'casual' | 'very-casual'> = ['racer', 'casual', 'very-casual'];
                                    const next = types[(types.indexOf(p.type) + 1) % 3];
                                    updatePaddler({ paddlerId: p.id, type: next });
                                  }}
                                  style={{
                                    padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                                    border: '2px solid',
                                    borderColor: p.type === 'racer' ? '#8b5cf6' : p.type === 'casual' ? '#3b82f6' : '#64748b',
                                    backgroundColor: p.type === 'racer' ? 'rgba(139,92,246,0.15)' : p.type === 'casual' ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.15)',
                                    color: p.type === 'racer' ? '#a78bfa' : p.type === 'casual' ? '#60a5fa' : '#94a3b8',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {p.type === 'very-casual' ? 'v-casual' : p.type}
                                </button>
                              ) : (
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                  {(['racer', 'casual', 'very-casual'] as const).map((t) => (
                                    <button
                                      key={t}
                                      onClick={() => updatePaddler({ paddlerId: p.id, type: t })}
                                      style={{
                                        padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                                        border: '2px solid',
                                        borderColor: p.type === t
                                          ? t === 'racer' ? '#8b5cf6' : t === 'casual' ? '#3b82f6' : '#64748b'
                                          : 'transparent',
                                        backgroundColor: p.type === t
                                          ? t === 'racer' ? 'rgba(139,92,246,0.15)' : t === 'casual' ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.15)'
                                          : 'transparent',
                                        color: p.type === t
                                          ? t === 'racer' ? '#a78bfa' : t === 'casual' ? '#60a5fa' : '#94a3b8'
                                          : '#6b7280',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {t === 'very-casual' ? 'v-casual' : t}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </td>}
                            {isAdmin && <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              {windowWidth < 768 ? (() => {
                                const color = p.ability >= 4 ? '#10b981' : p.ability >= 3 ? '#eab308' : '#ef4444';
                                return (
                                  <button
                                    onClick={() => updatePaddler({ paddlerId: p.id, ability: (p.ability % 5) + 1 })}
                                    style={{
                                      width: '28px', height: '28px', borderRadius: '6px',
                                      fontSize: '12px', fontWeight: 700, border: '2px solid',
                                      borderColor: color, backgroundColor: `${color}26`, color,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {p.ability}
                                  </button>
                                );
                              })() : (
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                  {[1, 2, 3, 4, 5].map((level) => {
                                    const isActive = p.ability === level;
                                    const color = level >= 4 ? '#10b981' : level >= 3 ? '#eab308' : '#ef4444';
                                    return (
                                      <button
                                        key={level}
                                        onClick={() => updatePaddler({ paddlerId: p.id, ability: level })}
                                        style={{
                                          width: '28px', height: '28px', borderRadius: '6px',
                                          fontSize: '12px', fontWeight: 700, border: '2px solid',
                                          borderColor: isActive ? color : 'transparent',
                                          backgroundColor: isActive ? `${color}26` : 'transparent',
                                          color: isActive ? color : '#6b7280',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        {level}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </td>}
                            {isAdmin && <td style={{ padding: '8px 12px', textAlign: 'center', position: 'relative' }}>
                              <span
                                onClick={() => { if (editingSeatPrefId !== p.id) { setEditingSeatPrefId(p.id); setTempSeatPref(p.seatPreference || '000000'); } }}
                                style={{ color: '#9ca3af', fontSize: '13px', cursor: 'pointer', borderBottom: editingSeatPrefId === p.id ? 'none' : '1px dashed #4b5563' }}
                              >
                                {p.seatPreference?.split('').map(Number).filter((n: number) => n > 0).join(' > ') || '—'}
                              </span>
                              {editingSeatPrefId === p.id && (
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 30, backgroundColor: '#111111', border: '1px solid #4b5563', borderRadius: '6px', padding: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                  <div style={{ display: 'flex', gap: '3px' }}>
                                    {[1, 2, 3, 4, 5, 6].map((seat) => {
                                      const prefs = tempSeatPref.split('').map(Number).filter(n => n > 0);
                                      const isSelected = prefs.includes(seat);
                                      const priority = prefs.indexOf(seat) + 1;
                                      return (
                                        <button
                                          key={seat}
                                          onClick={() => {
                                            const currentPrefs = tempSeatPref.split('').map(Number).filter(n => n > 0);
                                            let newPrefs;
                                            if (currentPrefs.includes(seat)) {
                                              newPrefs = currentPrefs.filter(s => s !== seat);
                                            } else {
                                              newPrefs = [...currentPrefs, seat];
                                            }
                                            setTempSeatPref([...newPrefs, ...Array(6 - newPrefs.length).fill(0)].join('').slice(0, 6));
                                          }}
                                          style={{
                                            width: '20px', height: '20px', borderRadius: '4px',
                                            fontSize: '10px', fontWeight: 700, border: '1.5px solid',
                                            borderColor: isSelected ? '#f97316' : '#4b5563',
                                            backgroundColor: isSelected ? 'rgba(249,115,22,0.15)' : 'transparent',
                                            color: isSelected ? '#fb923c' : '#6b7280',
                                            cursor: 'pointer', position: 'relative', padding: 0, lineHeight: 1,
                                          }}
                                        >
                                          {seat}
                                          {isSelected && (
                                            <span style={{
                                              position: 'absolute', top: '-3px', right: '-3px',
                                              width: '10px', height: '10px', borderRadius: '50%',
                                              backgroundColor: '#f97316', color: '#fff',
                                              fontSize: '6px', fontWeight: 700,
                                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                              {priority}
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                      onClick={() => setEditingSeatPrefId(null)}
                                      style={{ padding: '1px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, border: '1px solid #4b5563', backgroundColor: 'transparent', color: '#9ca3af', cursor: 'pointer' }}
                                    >
                                      ✕
                                    </button>
                                    <button
                                      onClick={() => { updatePaddler({ paddlerId: p.id, seatPreference: tempSeatPref }); setEditingSeatPrefId(null); }}
                                      style={{ padding: '1px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, border: '1px solid #3b82f6', backgroundColor: 'rgba(59,130,246,0.2)', color: '#60a5fa', cursor: 'pointer' }}
                                    >
                                      ✓
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>}
                            {isAdmin && <td style={{ padding: '8px 4px', textAlign: 'center', width: '40px' }}>
                              <input
                                type="checkbox"
                                checked={userRoleByPaddlerId.get(p.id) === 'admin'}
                                onChange={() => toggleAdminMut({ paddlerId: p.id })}
                                style={{ cursor: 'pointer', accentColor: '#3b82f6' }}
                              />
                            </td>}
                            <td style={{ padding: '8px 12px', color: '#9ca3af', fontSize: '13px' }}>
                              {userEmailByPaddlerId.get(p.id) || '—'}
                            </td>
                            {isAdmin && <td style={{ padding: '8px 4px', textAlign: 'center', width: '32px' }}>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete ${p.firstName} ${p.lastName || p.lastInitial}? This removes their paddler profile and user account.`)) {
                                    deleteUserByPaddlerIdMut({ paddlerId: p.id });
                                    deletePaddlerMut({ paddlerId: p.id });
                                  }
                                }}
                                style={{
                                  background: 'none', border: 'none', color: '#6b7280', fontSize: '14px',
                                  cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', lineHeight: 1,
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}
                              >
                                ✕
                              </button>
                            </td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              </div>

              {/* RIGHT COLUMN - STAGING SIDEBAR (admin only) */}
              {activePage === 'today' && isAdmin && (
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
                  backgroundColor: sidebarOpen ? '#000000' : 'transparent',
                  padding: sidebarOpen ? '12px 4px 0 4px' : '12px 0 0 0',
                  paddingBottom: 0,
                  borderLeft: '1px solid #94a3b8',
                }}
              >
                {/* Toolbar - sticky */}
                <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: sidebarOpen ? '#000000' : 'transparent', padding: '12px 4px 0 4px' }}>
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
                      {showAddSearch && selectedEvent && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowAddSearch(false)} />
                          <div className="absolute bottom-full right-0 mb-2 z-20 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-2" style={{ width: '200px' }}>
                            <input
                              ref={addSearchInputRef}
                              type="text"
                              value={addSearchQuery}
                              onChange={(e) => setAddSearchQuery(e.target.value)}
                              placeholder="search paddler..."
                              className="w-full px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-400"
                              autoFocus
                            />
                            <div className="mt-1 max-h-[200px] overflow-y-auto">
                              {(() => {
                                const query = addSearchQuery.toLowerCase().trim();
                                if (!query || !paddlers) return null;
                                const matches = paddlers.filter((p: Paddler) => {
                                  if (eventAttendingPaddlerIds?.has(p.id)) return false;
                                  const fullName = `${p.firstName} ${p.lastName || ''}`.toLowerCase();
                                  return fullName.includes(query);
                                }).slice(0, 8);
                                if (matches.length === 0) return <div className="text-xs text-slate-400 px-2 py-1">no matches</div>;
                                return matches.map((p: Paddler) => (
                                  <div
                                    key={p.id}
                                    onClick={async () => {
                                      await setAttendanceMut({ paddlerId: p.id, eventId: selectedEvent.id, attending: true });
                                      setShowAddSearch(false);
                                      setAddSearchQuery('');
                                    }}
                                    className="px-2 py-1 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                                  >
                                    {p.firstName} {p.lastName ? p.lastName[0] + '.' : ''}
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                        </>
                      )}
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
                                    style={{ ...provided.draggableProps.style, touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none' }}
                                  >
                                    <PaddlerCircle paddler={paddler} isDragging={snapshot.isDragging} animationKey={animationKey} animationDelay={index * 20} />
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
                </div>
                )}
                {/* Bottom spacer to keep content above iOS browser bar */}
                <div style={{ flexShrink: 0, height: 80, minHeight: 80 }} />
              </div>
              )}
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
                  <span>✏️</span> edit paddler
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
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>first name</label>
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
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>last name</label>
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
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">gender</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'kane', label: 'kane', icon: '♂️', color: 'blue' },
                      { id: 'wahine', label: 'wahine', icon: '♀️', color: 'pink' },
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
                      { id: 'racer', label: 'racer', color: 'violet' },
                      { id: 'casual', label: 'casual', color: 'blue' },
                      { id: 'very-casual', label: 'very casual', color: 'slate' },
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

function AuthenticatedApp() {
  const { signOut } = useAuthActions();
  const convexUser = useQuery(api.auth.currentUser);

  // Still loading user data
  if (convexUser === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000', zIndex: 50 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap');`}</style>
        <span style={{ fontFamily: "'UnifrakturMaguntia', cursive", color: '#dc2626', WebkitTextStroke: '1.5px white', paintOrder: 'stroke fill', textShadow: '-1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white', fontSize: '36px' }}>Lokahi</span>
      </div>
    );
  }

  // User doc not found (shouldn't happen, but handle gracefully)
  if (!convexUser) {
    return <LoginPage />;
  }

  // Onboarding not complete — show onboarding screen
  if (!convexUser.onboardingComplete || !convexUser.paddlerId) {
    return <OnboardingPage name={convexUser.name} />;
  }

  // Sync paddlerId to localStorage for components that read it
  if (convexUser.paddlerId) {
    localStorage.setItem("selectedPaddlerId", convexUser.paddlerId);
  }

  const currentUser: User = {
    email: convexUser.email || "",
    role: convexUser.role || "normal",
    paddlerId: convexUser.paddlerId,
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("selectedPaddlerId");
    void signOut();
  };

  return <AppMain currentUser={currentUser} onLogout={handleLogout} />;
}

function App() {
  return (
    <>
      <AuthLoading>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000', zIndex: 50 }}>
          <style>{`@import url('https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap');`}</style>
          <span style={{ fontFamily: "'UnifrakturMaguntia', cursive", color: '#dc2626', WebkitTextStroke: '1.5px white', paintOrder: 'stroke fill', textShadow: '-1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white', fontSize: '36px' }}>Lokahi</span>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <LoginPage />
      </Unauthenticated>
      <Authenticated>
        <AuthenticatedApp />
      </Authenticated>
    </>
  );
}

export default App;
