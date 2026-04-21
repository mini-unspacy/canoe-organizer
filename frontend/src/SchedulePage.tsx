import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { api } from "./convex_generated/api";
import { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import type { Paddler } from "./types";
import { getLocalToday } from "./utils";
import { ThemedDateInput, ThemedTimeInput } from "./components/ThemedDateTime";

// Shared date/time pair for the event form. Date + time live side by side in
// a two-column grid with small uppercase captions above each. Both inputs
// swap in themed popover pickers on desktop and keep the native OS pickers
// on mobile — see ThemedDateTime.tsx.
function DateTimeFields({
  date, time, onDate, onTime, showDate = true,
}: {
  date: string; time: string;
  onDate: (v: string) => void; onTime: (v: string) => void;
  showDate?: boolean;
}) {
  const captionStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#8a8a8a',
    textTransform: 'uppercase', marginBottom: 4,
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: showDate ? '1fr 1fr' : '1fr', gap: 10 }}>
      {showDate && (
        <label style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={captionStyle}>Date</span>
          <ThemedDateInput value={date} onChange={onDate} />
        </label>
      )}
      <label style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={captionStyle}>Time</span>
        <ThemedTimeInput value={time} onChange={onTime} />
      </label>
    </div>
  );
}

export function SchedulePage({ onSelectEvent, isAdmin = true, scrollPosRef, scrollToEventId }: { onSelectEvent?: (evt: { id: string; title: string; date: string; time: string; location: string; eventType?: string }) => void; isAdmin?: boolean; scrollPosRef?: React.MutableRefObject<number>; scrollToEventId?: string | null }) {
  const cutoffDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const upcomingEvents = useQuery(api.events.getUpcomingEvents, { fromDate: cutoffDate });
  const { results: pastEventsDesc, status: pastStatus, loadMore: loadMorePast } = usePaginatedQuery(
    api.events.getPastEvents,
    { beforeDate: cutoffDate },
    { initialNumItems: 1 }
  );
  const pastEvents = useMemo(() => [...pastEventsDesc].reverse(), [pastEventsDesc]);
  const events = useMemo(() => {
    if (!upcomingEvents) return null;
    return [...pastEvents, ...upcomingEvents];
  }, [pastEvents, upcomingEvents]);
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
  const [guestPopupEventId, setGuestPopupEventId] = useState<string | null>(null);
  const [guestNameInput, setGuestNameInput] = useState('');
  const addGuestMut = useMutation(api.eventGuests.addGuest);
  const removeGuestMut = useMutation(api.eventGuests.removeGuest);
  const guestPopupGuests = useQuery(
    api.eventGuests.getByEvent,
    guestPopupEventId ? { eventId: guestPopupEventId } : "skip"
  );
  const scheduleScrollRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isLoadingPastRef = useRef(false);
  const anchorRef = useRef<{ eventId: string; offsetFromTop: number } | null>(null);
  const lastLoadTime = useRef(0);

  // After past events load, scroll back to the element that was visible before
  useLayoutEffect(() => {
    const container = scheduleScrollRef.current;
    const anchor = anchorRef.current;
    if (!container || !anchor) return;
    const el = container.querySelector(`[data-event-id="${anchor.eventId}"]`) as HTMLElement | null;
    if (el) {
      container.scrollTop = el.offsetTop - container.offsetTop - anchor.offsetFromTop;
    }
    anchorRef.current = null;
    // Cooldown before allowing another load
    setTimeout(() => { isLoadingPastRef.current = false; }, 500);
  }, [pastEventsDesc.length]);

  // Restore scroll position when returning to schedule page. useLayoutEffect
  // so the jump happens before the browser paints — no flash at the top.
  useLayoutEffect(() => {
    if (scrollToEventId) return;
    if (scrollPosRef && scheduleScrollRef.current && scrollPosRef.current > 0) {
      scheduleScrollRef.current.scrollTop = scrollPosRef.current;
    }
  }, []);

  // Keep the page invisible until we've jumped to the target event.
  // Prevents the brief flash of the "Schedule" header at the top before
  // the scroll is applied on the second render (after events arrive).
  const [pendingJump, setPendingJump] = useState<boolean>(!!scrollToEventId);

  // Jump to a specific event at the top. Runs before paint so the user
  // never sees the list at its default top position before the scroll.
  // Stops firing after the first successful jump so later data refreshes
  // don't bounce the scroll back.
  const didJumpRef = useRef(false);
  useLayoutEffect(() => {
    if (didJumpRef.current) return;
    if (!scrollToEventId || !scheduleScrollRef.current || !events) return;
    const el = scheduleScrollRef.current.querySelector(`[data-event-id="${scrollToEventId}"]`) as HTMLElement | null;
    if (el) {
      scheduleScrollRef.current.scrollTop = el.offsetTop - scheduleScrollRef.current.offsetTop;
      didJumpRef.current = true;
      setPendingJump(false);
    } else {
      // Events loaded but target not found — give up hiding so we don't
      // leave the user staring at a blank screen.
      didJumpRef.current = true;
      setPendingJump(false);
    }
  }, [scrollToEventId, events]);
  // Reset the one-shot when the target event changes (new jump requested).
  useEffect(() => {
    didJumpRef.current = false;
    if (scrollToEventId) setPendingJump(true);
  }, [scrollToEventId]);
  // Safety fallback: if nothing ever resolves (no events, stuck), reveal
  // after 600ms so the page isn't permanently hidden.
  useEffect(() => {
    if (!pendingJump) return;
    const t = setTimeout(() => setPendingJump(false), 600);
    return () => clearTimeout(t);
  }, [pendingJump]);

  const eventsByMonth = useMemo(() => {
    if (!events) return [];
    const grouped: Record<string, typeof events> = {};
    for (const e of events) {
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
    const monthMap = new Map<string, { month: string; label: string }>();
    // Future 12 months (always shown)
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, { month: key, label: `${monthNames[d.getMonth()]} ${d.getFullYear()}` });
    }
    // Past months from loaded past events
    for (const e of pastEvents) {
      const key = e.date.slice(0, 7);
      if (!monthMap.has(key)) {
        const [y, m] = key.split('-');
        monthMap.set(key, { month: key, label: `${monthNames[parseInt(m) - 1]} ${y}` });
      }
    }
    return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [pastEvents]);

  const monthList = useMemo(() => allMonths.map(m => m.month), [allMonths]);

  useEffect(() => {
    if (!activeMonth && allMonths.length > 0) {
      // Default to current month, not the first (which could be a past month)
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const match = allMonths.find(m => m.month >= currentMonthKey);
      setActiveMonth(match ? match.month : allMonths[0].month);
    }
  }, [allMonths, activeMonth]);

  return (
    <div style={{ display: 'flex', height: 'calc(100% - 40px)', gap: '0', visibility: pendingJump ? 'hidden' : 'visible' }}>
      {/* Event list */}
      <div
        ref={scheduleScrollRef}
        onClick={(e) => { if (guestPopupEventId && !(e.target as HTMLElement).closest?.('[data-guest-popup]')) setGuestPopupEventId(null); }}
        onScroll={() => {
          const container = scheduleScrollRef.current;
          if (!container) return;
          const scrollTop = container.scrollTop;
          if (scrollPosRef) scrollPosRef.current = scrollTop;
          // Load more past events when scrolled near the top
          if (scrollTop < 100 && pastStatus === 'CanLoadMore' && !isLoadingPastRef.current && Date.now() - lastLoadTime.current > 1000) {
            isLoadingPastRef.current = true;
            lastLoadTime.current = Date.now();
            // Find the first visible event to use as scroll anchor after load
            const containerRect = container.getBoundingClientRect();
            const eventEls = container.querySelectorAll('[data-event-id]');
            for (const el of eventEls) {
              const rect = (el as HTMLElement).getBoundingClientRect();
              if (rect.top >= containerRect.top - 10) {
                anchorRef.current = {
                  eventId: (el as HTMLElement).getAttribute('data-event-id')!,
                  offsetFromTop: rect.top - containerRect.top,
                };
                break;
              }
            }
            loadMorePast(20);
          }
          let found = monthList[0] || '';
          for (const m of monthList) {
            const el = monthRefs.current[m];
            if (el && el.offsetTop - container.offsetTop <= scrollTop + 60) {
              found = m;
            }
          }
          if (found && found !== activeMonth) setActiveMonth(found);
        }}
        style={{ flex: 1, overflowY: 'auto', padding: '0', position: 'relative', background: '#ffffff' }}
        className="scrollbar-hidden"
      >
        {/* Mock-style hero header — warm cream→white gradient for presence,
            with a small live-dot next to the season label hinting that
            the schedule reacts in real-time. */}
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid #e3e0da',
          position: 'relative',
          background: 'linear-gradient(180deg, #faf6ee 0%, #fcfaf5 55%, #ffffff 100%)',
        }}>
          <div style={{ fontSize: 10, color: '#8a8275', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="live-dot" aria-hidden="true" />
            2026 Season · SCORA
          </div>
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 30, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.05, marginTop: 2 }}>
            Schedule
          </div>
        </div>

        <div style={{ padding: '12px 12px 40px' }}>
        {/* Floating + event button (admin only) */}
        {isAdmin && <div style={{ position: 'sticky', top: '8px', zIndex: 20, float: 'right' }}>
          <span
            className="btn-zoom"
            onClick={() => {
              setEditingEventId(null);
              setEventForm({ title: '', date: '', time: '', location: '', eventType: 'practice', repeating: 'none', weekdays: [], monthdays: [], repeatUntil: '' });
              setShowEventForm(!showEventForm);
            }}
            style={{
              cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#ffffff', letterSpacing: '0.05em',
              userSelect: 'none', padding: '8px 14px', backgroundColor: '#c82028', borderRadius: 999, border: 'none',
              boxShadow: '0 2px 8px rgba(200,32,40,0.25)', transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            + Event
          </span>

          {/* Inline event form */}
          {showEventForm && !editingEventId && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowEventForm(false)} />
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', zIndex: 20, width: '260px', backgroundColor: '#ffffff', borderRadius: '8px', padding: '12px', border: '1px solid rgba(0,0,0,.12)', boxShadow: '0 0 0 1px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.04), 0 6px 18px rgba(0,0,0,.08)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Event type selector */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {(['practice', 'race', 'other'] as const).map(t => (
                  <button
                    key={t}
                    className="btn-zoom"
                    onClick={() => setEventForm(f => ({ ...f, eventType: t }))}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                      border: '2px solid',
                      borderColor: eventForm.eventType === t ? (t === 'practice' ? '#005280' : t === 'race' ? '#ef4444' : '#717171') : 'transparent',
                      backgroundColor: eventForm.eventType === t ? (t === 'practice' ? 'rgba(59,130,246,0.1)' : t === 'race' ? 'rgba(239,68,68,0.1)' : 'rgba(100,116,139,0.1)') : 'transparent',
                      color: eventForm.eventType === t ? (t === 'practice' ? '#3387a2' : t === 'race' ? '#f87171' : '#b0b0b0') : '#717171',
                      cursor: 'pointer', transition: 'all 0.15s',
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
                style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '6px', padding: '6px 10px', color: '#484848', fontSize: '14px', outline: 'none' }}
              />
              <input
                type="text"
                placeholder="location"
                value={eventForm.location}
                onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))}
                style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '6px', padding: '6px 10px', color: '#484848', fontSize: '14px', outline: 'none' }}
              />
              <DateTimeFields
                showDate={!!(editingEventId || eventForm.repeating === 'none')}
                date={eventForm.date}
                time={eventForm.time}
                onDate={v => setEventForm(f => ({ ...f, date: v }))}
                onTime={v => setEventForm(f => ({ ...f, time: v }))}
              />
              {!editingEventId && (<>
              {/* Repeating pills */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#717171', fontWeight: 600, marginRight: '2px' }}>repeat:</span>
                {(['none', 'weekly', 'monthly'] as const).map(r => (
                  <button
                    key={r}
                    className="btn-zoom"
                    onClick={() => setEventForm(f => ({ ...f, repeating: r, weekdays: [], monthdays: [], repeatUntil: r !== 'none' && !f.repeatUntil ? getLocalToday() : f.repeatUntil }))}
                    style={{
                      padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                      border: '1px solid',
                      borderColor: eventForm.repeating === r ? '#005280' : 'transparent',
                      backgroundColor: eventForm.repeating === r ? 'rgba(59,130,246,0.15)' : 'transparent',
                      color: eventForm.repeating === r ? '#3387a2' : '#717171',
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
                        className="btn-zoom"
                        onClick={() => {
                          setEventForm(f => ({
                            ...f,
                            weekdays: isSelected ? f.weekdays.filter(d => d !== i) : [...f.weekdays, i].sort(),
                          }));
                        }}
                        style={{
                          padding: '4px 0', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                          border: '2px solid',
                          borderColor: isSelected ? '#005280' : '#b0b0b0',
                          backgroundColor: isSelected ? 'rgba(59,130,246,0.15)' : 'transparent',
                          color: isSelected ? '#3387a2' : '#717171',
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
                        className="btn-zoom"
                        onClick={() => {
                          setEventForm(f => ({
                            ...f,
                            monthdays: isSelected ? f.monthdays.filter(d => d !== day) : [...f.monthdays, day].sort((a, b) => a - b),
                          }));
                        }}
                        style={{
                          padding: '3px 0', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                          border: '1.5px solid',
                          borderColor: isSelected ? '#005280' : '#b0b0b0',
                          backgroundColor: isSelected ? 'rgba(59,130,246,0.15)' : 'transparent',
                          color: isSelected ? '#3387a2' : '#717171',
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
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#8a8a8a', textTransform: 'uppercase' }}>
                    Repeat until
                  </span>
                  <ThemedDateInput
                    value={eventForm.repeatUntil}
                    onChange={v => setEventForm(f => ({ ...f, repeatUntil: v }))}
                  />
                </label>
              )}
              </>)}
              {/* Buttons */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  className="btn-zoom"
                  onClick={() => { setShowEventForm(false); setEditingEventId(null); }}
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, border: '1px solid rgba(0,0,0,.12)', backgroundColor: '#ffffff', color: '#717171', cursor: 'pointer', transition: 'all 0.15s' }}
                >
                  Cancel
                </button>
                <button
                  className="btn-zoom"
                  onClick={async () => {
                    if (!eventForm.title || !eventForm.time) return;
                    const startDate = eventForm.date || getLocalToday();
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
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, border: 'none', backgroundColor: '#005280', color: '#ffffff', cursor: 'pointer', transition: 'opacity 0.15s' }}
                >
                  Add
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
          const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          // "apr 2026" -> "April 2026" so the mock-style section header reads well.
          const prettyMonth = (() => {
            const [y, mo] = m.month.split('-');
            const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            return `${names[parseInt(mo, 10) - 1]} ${y}`;
          })();
          return (
            <div key={m.month} ref={el => { monthRefs.current[m.month] = el; }} style={{ marginBottom: 18 }}>
              {/* Section label with hairline rule — matches mock's SectionLabel */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6b6558' }}>
                <span>{prettyMonth}</span>
                <div style={{ flex: 1, height: 1, background: '#e3e0da' }} />
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {group ? group.events.map((evt: { id: string; title: string; date: string; time: string; location: string; eventType?: string; repeating: string; weekdays?: number[]; monthdays?: number[]; repeatUntil?: string }, evtIdx: number) => {
                const d = new Date(evt.date + 'T00:00:00');
                const dayNum = d.getDate();
                const dayName = dayNames[d.getDay()];
                if (editingEventId === evt.id && showEventForm) {
                  return (
                    <div key={evt.id} style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '12px', marginBottom: '4px', marginTop: '4px', border: '1px solid rgba(0,0,0,.12)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Event type selector */}
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(['practice', 'race', 'other'] as const).map(t => (
                            <button
                              key={t}
                              className="btn-zoom"
                              onClick={() => setEventForm(f => ({ ...f, eventType: t }))}
                              style={{
                                padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                                border: '2px solid',
                                borderColor: eventForm.eventType === t ? (t === 'practice' ? '#005280' : t === 'race' ? '#ef4444' : '#717171') : 'transparent',
                                backgroundColor: eventForm.eventType === t ? (t === 'practice' ? 'rgba(59,130,246,0.1)' : t === 'race' ? 'rgba(239,68,68,0.1)' : 'rgba(100,116,139,0.1)') : 'transparent',
                                color: eventForm.eventType === t ? (t === 'practice' ? '#3387a2' : t === 'race' ? '#f87171' : '#b0b0b0') : '#717171',
                                cursor: 'pointer', transition: 'all 0.15s',
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
                          style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '6px', padding: '6px 10px', color: '#484848', fontSize: '14px', outline: 'none' }}
                        />
                        <input
                          type="text"
                          placeholder="location"
                          value={eventForm.location}
                          onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))}
                          style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '6px', padding: '6px 10px', color: '#484848', fontSize: '14px', outline: 'none' }}
                        />
                        <DateTimeFields
                          date={eventForm.date}
                          time={eventForm.time}
                          onDate={v => setEventForm(f => ({ ...f, date: v }))}
                          onTime={v => setEventForm(f => ({ ...f, time: v }))}
                        />
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn-zoom"
                            onClick={() => { setShowEventForm(false); setEditingEventId(null); }}
                            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, border: '1px solid rgba(0,0,0,.12)', backgroundColor: '#ffffff', color: '#717171', cursor: 'pointer', transition: 'all 0.15s' }}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn-zoom"
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
                            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, border: 'none', backgroundColor: '#005280', color: '#ffffff', cursor: 'pointer', transition: 'opacity 0.15s' }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                const isAttending = attendingEventIds.has(evt.id);
                const isRace = evt.eventType === 'race';
                const typeLabel: { text: string; color: string; bg: string } | null =
                  evt.eventType === 'race'
                    ? { text: 'RACE', color: '#b8181e', bg: 'rgba(200,32,40,0.2)' }
                    : evt.eventType === 'practice'
                    ? { text: 'PRACTICE', color: '#2e6b80', bg: 'rgba(46,107,128,0.18)' }
                    : evt.eventType === 'other'
                    ? { text: 'OTHER', color: '#6b6558', bg: 'rgba(107,101,88,0.18)' }
                    : null;
                const now = new Date();
                now.setHours(0,0,0,0);
                const evDate = new Date(evt.date + 'T12:00:00');
                const evDayStart = new Date(evDate); evDayStart.setHours(0,0,0,0);
                const isToday = evDayStart.getTime() === now.getTime();
                const isPast = evDayStart.getTime() < now.getTime();
                const go = () => onSelectEvent?.({ id: evt.id, title: evt.title, date: evt.date, time: evt.time, location: evt.location, eventType: evt.eventType });
                return (
                  <div key={evt.id} data-event-id={evt.id} style={{ position: 'relative', zIndex: guestPopupEventId === evt.id ? 30 : 'auto' }}>
                  <div
                    className="breathe-in hover-lift"
                    onClick={go}
                    style={{
                      display: 'flex', gap: 12, alignItems: 'center',
                      padding: '10px 12px',
                      background: '#f5f3ef',
                      border: '1px solid #e3e0da',
                      borderRadius: 12,
                      opacity: isPast ? 0.45 : 1,
                      cursor: onSelectEvent ? 'pointer' : 'default',
                      // Stagger entry per row; cap so long months don't cascade forever.
                      animationDelay: `${Math.min(evtIdx, 10) * 30}ms`,
                    }}
                  >
                    {/* Date column: day-of-week + serif day number */}
                    <div style={{ textAlign: 'center', width: 44, flexShrink: 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: isRace ? '#b8181e' : '#2e6b80', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                        {dayName}
                      </div>
                      <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 24, color: '#1a1a1a', fontWeight: 600, lineHeight: 1, marginTop: 1 }}>
                        {dayNum}
                      </div>
                      {selectedPaddlerId && (
                        <div
                          role="switch"
                          aria-checked={isAttending}
                          aria-label={isAttending ? 'Going — tap to mark not going' : 'Not going — tap to mark going'}
                          onClick={(e) => { e.stopPropagation(); toggleAttendanceMut({ paddlerId: selectedPaddlerId, eventId: evt.id }); }}
                          style={{
                            position: 'relative',
                            width: 32, height: 18, borderRadius: 999, marginTop: 8,
                            display: 'inline-block',
                            cursor: 'pointer', userSelect: 'none',
                            background: isAttending ? '#2f7a47' : '#d6d1c8',
                            transition: 'background 180ms ease',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              top: 2,
                              left: isAttending ? 16 : 2,
                              width: 14, height: 14, borderRadius: '50%',
                              background: '#fff',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                              transition: 'left 180ms ease',
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Title + meta column */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
                        {typeLabel && (
                          <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.15em', color: typeLabel.color, background: typeLabel.bg, padding: '2px 5px', borderRadius: 3, flexShrink: 0, marginTop: 2 }}>{typeLabel.text}</span>
                        )}
                        {isToday && (
                          <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.15em', color: '#2f7a47', background: 'rgba(47,122,71,0.2)', padding: '2px 5px', borderRadius: 3, flexShrink: 0, marginTop: 2 }}>TODAY</span>
                        )}
                        <div style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.2, flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {evt.title}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b6558', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {evt.time}{evt.location ? <> <span style={{ opacity: 0.5 }}>·</span> {evt.location}</> : null}
                      </div>
                    </div>

                    {/* Trailing actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      {isAdmin && (
                        <>
                          <svg
                            className="btn-zoom-sm"
                            onClick={(e) => {
                              e.stopPropagation();
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
                            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a928a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                            style={{ cursor: 'pointer', padding: 4, boxSizing: 'content-box' }}
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          <svg
                            className="btn-zoom-sm"
                            onClick={(e) => { e.stopPropagation(); deleteEventMut({ eventId: evt.id }); }}
                            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a928a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                            style={{ cursor: 'pointer', padding: 4, boxSizing: 'content-box' }}
                          >
                            <path d="M6 6l12 12M6 18L18 6" />
                          </svg>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Guest popup */}
                  {guestPopupEventId === evt.id && (
                    <div data-guest-popup onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, right: 0, padding: '4px 0 4px 62px', zIndex: 30 }}>
                      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '10px 12px', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                          <input
                            type="text"
                            placeholder="guest name"
                            value={guestNameInput}
                            onChange={e => setGuestNameInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && guestNameInput.trim()) {
                                addGuestMut({ eventId: evt.id, name: guestNameInput.trim() });
                                setGuestNameInput('');
                              }
                            }}
                            style={{ minWidth: 0, flex: 1, backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '6px', padding: '5px 8px', color: '#484848', fontSize: '13px', outline: 'none' }}
                          />
                          <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              if (guestNameInput.trim()) {
                                addGuestMut({ eventId: evt.id, name: guestNameInput.trim() });
                                setGuestNameInput('');
                              }
                            }}
                            style={{ flexShrink: 0, padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: '1px solid rgba(245,158,11,0.4)', backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b', cursor: 'pointer' }}
                          >
                            add
                          </button>
                        </div>
                        {guestPopupGuests && guestPopupGuests.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {guestPopupGuests.map((guest: any) => (
                              <div key={guest._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
                                <span style={{ fontSize: '13px', color: '#d1d5db' }}>{guest.name}</span>
                                <span
                                  onClick={() => removeGuestMut({ guestId: guest._id })}
                                  style={{ cursor: 'pointer', fontSize: '16px', fontWeight: 700, color: '#ef4444', lineHeight: 1, padding: '0 4px', userSelect: 'none' }}
                                >
                                  −
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  </div>
                );
              }) : (
                <div style={{ padding: '8px 0', fontSize: 12, color: '#8a8275' }}>—</div>
              )}
              </div>
            </div>
          );
        })}
        <div style={{ height: '80px' }} />
        </div>
      </div>
    </div>
  );
}

