import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { api } from "./convex_generated/api";
import { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import type { Paddler } from "./types";
import { getLocalToday } from "./utils";

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

  // Restore scroll position when returning to schedule page
  useEffect(() => {
    if (scrollToEventId) return;
    if (scrollPosRef && scheduleScrollRef.current && scrollPosRef.current > 0) {
      scheduleScrollRef.current.scrollTop = scrollPosRef.current;
    }
  }, []);

  // Jump to a specific event at the top
  useEffect(() => {
    if (!scrollToEventId || !scheduleScrollRef.current || !events) return;
    const el = scheduleScrollRef.current.querySelector(`[data-event-id="${scrollToEventId}"]`) as HTMLElement | null;
    if (el) {
      scheduleScrollRef.current.scrollTop = el.offsetTop - scheduleScrollRef.current.offsetTop;
    }
  }, [scrollToEventId, events]);

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
    <div style={{ display: 'flex', height: 'calc(100% - 40px)', gap: '0' }}>
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
        style={{ flex: 1, overflowY: 'auto', padding: '0 12px', position: 'relative' }}
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
              cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: '#005280',
              userSelect: 'none', padding: '8px 16px', backgroundColor: 'rgba(0, 82, 128, 0.06)', borderRadius: '8px', border: '1px solid rgba(0,82,128,0.12)',
            }}
          >
            + event
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
                    onClick={() => setEventForm(f => ({ ...f, eventType: t }))}
                    style={{
                      padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                      border: '2px solid',
                      borderColor: eventForm.eventType === t ? (t === 'practice' ? '#005280' : t === 'race' ? '#ef4444' : '#717171') : 'transparent',
                      backgroundColor: eventForm.eventType === t ? (t === 'practice' ? 'rgba(59,130,246,0.15)' : t === 'race' ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)') : 'transparent',
                      color: eventForm.eventType === t ? (t === 'practice' ? '#3387a2' : t === 'race' ? '#f87171' : '#b0b0b0') : '#717171',
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
                style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '6px', padding: '6px 10px', color: '#484848', fontSize: '14px', outline: 'none' }}
              />
              <input
                type="text"
                placeholder="location"
                value={eventForm.location}
                onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))}
                style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '6px', padding: '6px 10px', color: '#484848', fontSize: '14px', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                {(editingEventId || eventForm.repeating === 'none') && (
                  <input
                    type="date"
                    value={eventForm.date}
                    onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
                    style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '6px', padding: '6px 10px', color: '#484848', fontSize: '14px', outline: 'none' }}
                  />
                )}
                <input
                  type="time"
                  value={eventForm.time}
                  onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))}
                  style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '6px', padding: '6px 10px', color: '#484848', fontSize: '14px', outline: 'none' }}
                />
              </div>
              {!editingEventId && (<>
              {/* Repeating pills */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#717171', fontWeight: 600, marginRight: '2px' }}>repeat:</span>
                {(['none', 'weekly', 'monthly'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setEventForm(f => ({ ...f, repeating: r, weekdays: [], monthdays: [], repeatUntil: r !== 'none' && !f.repeatUntil ? getLocalToday() : f.repeatUntil }))}
                    style={{
                      padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                      border: '2px solid',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#717171', fontWeight: 600, flexShrink: 0 }}>till when</span>
                  <input
                    type="date"
                    value={eventForm.repeatUntil}
                    onChange={e => setEventForm(f => ({ ...f, repeatUntil: e.target.value }))}
                    style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '6px', padding: '6px 10px', color: '#484848', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              )}
              </>)}
              {/* Buttons */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowEventForm(false); setEditingEventId(null); }}
                  style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(0,0,0,.12)', backgroundColor: 'transparent', color: '#717171', cursor: 'pointer' }}
                >
                  cancel
                </button>
                <button
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
                  style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: '1px solid #3b82f6', backgroundColor: 'rgba(59,130,246,0.2)', color: '#3387a2', cursor: 'pointer' }}
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
          const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          return (
            <div key={m.month} ref={el => { monthRefs.current[m.month] = el; }}>
              <div style={{ fontSize: '18px', color: '#222222', fontWeight: 700, padding: '24px 0 12px', textTransform: 'lowercase', letterSpacing: '0.02em', borderBottom: '2px solid rgba(0,0,0,.08)', marginBottom: '12px' }}>
                {m.label}
              </div>
              {group ? group.events.map((evt: { id: string; title: string; date: string; time: string; location: string; eventType?: string; repeating: string; weekdays?: number[]; monthdays?: number[]; repeatUntil?: string }) => {
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
                              onClick={() => setEventForm(f => ({ ...f, eventType: t }))}
                              style={{
                                padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                                border: '2px solid',
                                borderColor: eventForm.eventType === t ? (t === 'practice' ? '#005280' : t === 'race' ? '#ef4444' : '#717171') : 'transparent',
                                backgroundColor: eventForm.eventType === t ? (t === 'practice' ? 'rgba(59,130,246,0.15)' : t === 'race' ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)') : 'transparent',
                                color: eventForm.eventType === t ? (t === 'practice' ? '#3387a2' : t === 'race' ? '#f87171' : '#b0b0b0') : '#717171',
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
                          style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '6px', padding: '6px 10px', color: '#484848', fontSize: '14px', outline: 'none' }}
                        />
                        <input
                          type="text"
                          placeholder="location"
                          value={eventForm.location}
                          onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))}
                          style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '6px', padding: '6px 10px', color: '#484848', fontSize: '14px', outline: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="date"
                            value={eventForm.date}
                            onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
                            style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '6px', padding: '6px 10px', color: '#484848', fontSize: '14px', outline: 'none' }}
                          />
                          <input
                            type="time"
                            value={eventForm.time}
                            onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))}
                            style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '6px', padding: '6px 10px', color: '#484848', fontSize: '14px', outline: 'none' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => { setShowEventForm(false); setEditingEventId(null); }}
                            style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(0,0,0,.12)', backgroundColor: 'transparent', color: '#717171', cursor: 'pointer' }}
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
                            style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: '1px solid #3b82f6', backgroundColor: 'rgba(59,130,246,0.2)', color: '#3387a2', cursor: 'pointer' }}
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
                  <div key={evt.id} data-event-id={evt.id} style={{ position: 'relative', zIndex: guestPopupEventId === evt.id ? 30 : 'auto' }}>
                  <div
                    style={{ display: 'flex', gap: '12px', padding: '14px 16px', marginBottom: '8px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 0 0 1px rgba(0,0,0,.04), 0 1px 4px rgba(0,0,0,.04), 0 3px 10px rgba(0,0,0,.06)' }}
                  >
                    {/* Left column: date + Y/N */}
                    <div style={{ width: '52px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div onClick={() => onSelectEvent?.({ id: evt.id, title: evt.title, date: evt.date, time: evt.time, location: evt.location, eventType: evt.eventType })} style={{ fontSize: '28px', fontWeight: 700, color: '#222222', lineHeight: 1.1, cursor: onSelectEvent ? 'pointer' : 'default' }}>{dayNum}</div>
                      <div onClick={() => onSelectEvent?.({ id: evt.id, title: evt.title, date: evt.date, time: evt.time, location: evt.location, eventType: evt.eventType })} style={{ fontSize: '20px', color: '#484848', fontWeight: 500, cursor: onSelectEvent ? 'pointer' : 'default' }}>{dayName}</div>
                      {selectedPaddlerId && (
                        <div
                          onClick={() => toggleAttendanceMut({ paddlerId: selectedPaddlerId, eventId: evt.id })}
                          style={{
                            width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0, marginTop: '6px',
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
                      )}
                    </div>
                    {/* Right column: time/title, location, badges */}
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', marginTop: '0px' }}>
                      <div style={{ fontSize: '28px', color: '#222222', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.1 }}>
                        <span
                          onClick={() => onSelectEvent?.({ id: evt.id, title: evt.title, date: evt.date, time: evt.time, location: evt.location, eventType: evt.eventType })}
                          style={{ cursor: onSelectEvent ? 'pointer' : 'default' }}
                        >{evt.time} {evt.title}</span>
                      </div>
                      {evt.location && <div style={{ fontSize: '20px', color: '#484848', fontWeight: 500, marginTop: '-1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.location}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {evt.eventType && (
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px', fontSize: '14px', fontWeight: 600,
                            backgroundColor: evt.eventType === 'practice' ? 'rgba(59,130,246,0.15)' : evt.eventType === 'race' ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)',
                            color: evt.eventType === 'practice' ? '#3387a2' : evt.eventType === 'race' ? '#f87171' : '#b0b0b0',
                            border: `1px solid ${evt.eventType === 'practice' ? 'rgba(59,130,246,0.3)' : evt.eventType === 'race' ? 'rgba(239,68,68,0.3)' : 'rgba(100,116,139,0.3)'}`,
                          }}>
                            {evt.eventType}
                          </span>
                        )}
                        <span
                          data-guest-popup
                          onClick={(e) => { e.stopPropagation(); setGuestPopupEventId(guestPopupEventId === evt.id ? null : evt.id); setGuestNameInput(''); }}
                          style={{
                            padding: '6px 8px', borderRadius: '999px', fontSize: '14px', fontWeight: 600,
                            backgroundColor: guestPopupEventId === evt.id ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.1)',
                            color: '#f59e0b',
                            border: `1px solid ${guestPopupEventId === evt.id ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.25)'}`,
                            cursor: 'pointer', userSelect: 'none',
                            marginLeft: 'auto',
                          }}
                        >
                          guest?
                        </span>
                        {isAdmin && <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        <svg
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
                          width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ cursor: 'pointer', padding: '4px', boxSizing: 'content-box' }}
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <svg
                          onClick={() => deleteEventMut({ eventId: evt.id })}
                          width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ cursor: 'pointer', padding: '4px', boxSizing: 'content-box' }}
                        >
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </span>}
                      </div>
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
                <div style={{ padding: '12px 0', fontSize: '16px', color: '#b0b0b0' }}>—</div>
              )}
            </div>
          );
        })}
        <div style={{ height: '80px' }} />
      </div>
    </div>
  );
}

