import { useEffect, useRef, useState } from "react";
import { useQuery, Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "./convex_generated/api";
import { DragDropContext } from "@hello-pangea/dnd";

import LoginPage from "./LoginPage";
import OnboardingPage from "./OnboardingPage";
import { SchedulePage } from "./SchedulePage";
import { TodayView } from "./TodayView";
import { RosterView } from "./RosterView";
import { StagingSidebar } from "./StagingSidebar";
import { OnShorePanel } from "./OnShorePanel";
import { EditPaddlerModal } from "./EditPaddlerModal";
import { useCanoeAssignment } from "./useCanoeAssignment";
import type { User } from "./types";

/* ── Shared loading / splash component ── */
function LokahiSplash() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#ffffff', zIndex: 50 }}>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontFamily: "'UnifrakturMaguntia', cursive", color: '#ed1c24', fontSize: '42px' }}>Lokahi</span>
        <div style={{ fontSize: '13px', color: '#717171', marginTop: '4px', letterSpacing: '0.02em' }}>Outrigger Canoe Club</div>
      </div>
    </div>
  );
}

function AppMain({ currentUser, onLogout }: { currentUser: User; onLogout: () => void }) {
  const ctx = useCanoeAssignment(currentUser);
  // Mobile-only layout: bottom tab bar + On Shore drawer, no desktop sidebars.
  const isNarrow = true;

  // Auto-hide the mobile tab bar when the user scrolls down, show it again
  // when scrolling up or at the top. Standard mobile browser pattern.
  const scrollRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [navHidden, setNavHidden] = useState(false);
  const [navH, setNavH] = useState(68);
  const lastScrollTop = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const top = el.scrollTop;
      const prev = lastScrollTop.current;
      const delta = top - prev;
      if (top <= 4) {
        setNavHidden(false);
      } else if (delta > 6) {
        setNavHidden(true);
      } else if (delta < -6) {
        setNavHidden(false);
      }
      lastScrollTop.current = top;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [ctx.activePage, ctx.dataLoading, ctx.hasNoData, isNarrow]);

  // Measure the tab bar's real height so the On Shore drawer can dock
  // flush on top of it without leaving a stripe of canoe showing through.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const measure = () => setNavH(el.getBoundingClientRect().height || 68);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); };
  }, [isNarrow, ctx.dataLoading, ctx.hasNoData]);

  return (
    <DragDropContext onDragEnd={ctx.onDragEnd} onDragStart={ctx.handleDragStart}>
      <div style={{ height: '100%', overflow: 'hidden', backgroundColor: '#ffffff', touchAction: ctx.isDragging ? 'none' : 'auto', paddingTop: 'env(safe-area-inset-top)' }}>
        <main style={{ height: '100%', overflow: 'hidden', boxSizing: 'border-box', padding: isNarrow ? '0 12px' : '0 2px', maxWidth: '1152px', margin: '0 auto', width: '100%' }}>
          {ctx.dataLoading ? (
            <LokahiSplash />
          ) : ctx.hasNoData ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
              <div
                onClick={() => { ctx.triggerAnimation(); ctx.populatePaddlers(); ctx.populateCanoes(); }}
                style={{ width: 64, height: 64, backgroundColor: '#faf9f7', borderColor: '#b0b0b0', borderWidth: '3px', borderStyle: 'solid', borderRadius: '50%', color: '#222222', fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
              >
                🛶
              </div>
              <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: '#717171' }}>Tap to load sample data</p>
            </div>
          ) : (
            <div style={{ display: 'flex', height: '100%', gap: '0', width: '100%', overflow: 'hidden' }}>
              {/* LEFT SIDEBAR - NAVIGATION (hidden on narrow; bottom tab bar is rendered instead) */}
              {!isNarrow && (
              <div
                className="scrollbar-hidden"
                style={{
                  width: ctx.leftSidebarOpen ? 120 : 36,
                  height: '100%',
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: ctx.leftSidebarOpen ? 'auto' : 'hidden',
                  overflowX: 'hidden',
                  backgroundColor: '#faf9f7',
                  borderRight: '1px solid rgba(0,0,0,.08)',
                }}
              >
                {/* Logo + collapse toggle — sticky header */}
                <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: '#faf9f7', padding: ctx.leftSidebarOpen ? '12px 10px 0' : '12px 6px 0', flexShrink: 0 }}>
                  <div onClick={() => ctx.setLeftSidebarOpen(!ctx.leftSidebarOpen)} style={{ textAlign: ctx.leftSidebarOpen ? 'left' : 'center', cursor: 'pointer', paddingBottom: '8px', borderBottom: '1px solid rgba(0,0,0,.08)', marginBottom: '4px' }}>
                    <span style={{
                      fontFamily: "'UnifrakturMaguntia', cursive",
                      color: '#ed1c24',
                      fontSize: ctx.leftSidebarOpen ? '22px' : '20px',
                      lineHeight: 1,
                    }}>
                      {ctx.leftSidebarOpen ? 'Lokahi' : 'L'}
                    </span>
                  </div>
                </div>
                {/* Nav items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: ctx.leftSidebarOpen ? '4px 8px' : '4px 4px', flex: 1 }}>
                    {([
                      { page: 'today' as const, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /><circle cx="12" cy="15" r="2.5" /><path d="M10 17l-1.5 4 1.5-1 1.5 1L10 17" /><path d="M14 17l-1.5 4 1.5-1 1.5 1L14 17" /></svg>, label: 'event' },
                      { page: 'schedule' as const, icon: '☰', label: 'schedule' },
                      { page: 'roster' as const, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0 1 16 0v1" /></svg>, label: 'roster' },
                      { page: 'attendance' as const, icon: '✓', label: 'attendance' },
                      { page: 'crews' as const, icon: '⛵', label: 'crews' },
                    ]).map(({ page, icon, label }) => (
                      <span
                        key={page}
                        onClick={() => { ctx.setActivePage(page); if (page === 'today') ctx.setSelectedEvent(ctx.todayEvent || null); }}
                        title={label}
                        className="cursor-pointer transition-colors"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: ctx.leftSidebarOpen ? '10px 12px' : '10px 0',
                          borderRadius: '10px',
                          color: ctx.activePage === page ? '#005280' : '#484848',
                          backgroundColor: ctx.activePage === page ? 'rgba(0, 82, 128, 0.08)' : 'transparent',
                          fontWeight: ctx.activePage === page ? 600 : 400,
                          userSelect: 'none',
                          justifyContent: ctx.leftSidebarOpen ? 'flex-start' : 'center',
                        }}
                        onMouseEnter={(e) => { if (ctx.activePage !== page) e.currentTarget.style.backgroundColor = 'rgba(0, 82, 128, 0.06)'; }}
                        onMouseLeave={(e) => { if (ctx.activePage !== page) e.currentTarget.style.backgroundColor = ctx.activePage === page ? 'rgba(0, 82, 128, 0.08)' : 'transparent'; }}
                      >
                        <span style={{ fontSize: '18px', lineHeight: 1, width: '22px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                        {ctx.leftSidebarOpen && <span style={{ fontSize: '15px', fontWeight: 'inherit', textTransform: 'capitalize' }}>{label}</span>}
                      </span>
                    ))}
                    <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(0,0,0,.08)' }}>
                      {ctx.leftSidebarOpen && (
                        <>
                          <div style={{ fontSize: '10px', color: '#717171', padding: '0 8px 4px', wordBreak: 'break-all' }}>
                            {currentUser.email}
                          </div>
                          <span
                            onClick={onLogout}
                            className="cursor-pointer transition-colors"
                            style={{ fontSize: '13px', color: '#717171', padding: '4px 8px', display: 'block' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#005280'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#717171'; }}
                          >
                            log out
                          </span>
                        </>
                      )}
                    </div>
                  </div>
              </div>
              )}

              {/* MIDDLE COLUMN */}
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', height: '100%' }}>
              <div ref={scrollRef} className="scrollbar-hidden" onClick={() => ctx.showGoingList && ctx.setShowGoingList(false)} style={{ width: '100%', maxWidth: '100%', overflowY: ctx.isDragging ? 'hidden' : 'auto', overflowX: 'hidden', height: '100%', boxSizing: 'border-box', touchAction: ctx.isDragging ? 'none' : 'auto', paddingBottom: isNarrow ? (ctx.isAdmin && ctx.activePage === 'today' && ctx.selectedEvent ? 'calc(68px + 44px + env(safe-area-inset-bottom))' : 'calc(68px + env(safe-area-inset-bottom))') : 'env(safe-area-inset-bottom)' }}>
                {ctx.activePage === 'today' && (
                  <TodayView
                    selectedEvent={ctx.selectedEvent}
                    isAdmin={ctx.isAdmin}
                    sidebarOpen={ctx.sidebarOpen}
                    canoes={ctx.canoes}
                    paddlers={ctx.paddlers}
                    canoeSortedPaddlers={ctx.canoeSortedPaddlers}
                    canoeAssignmentsByCanoe={ctx.canoeAssignmentsByCanoe}
                    eventAssignments={ctx.eventAssignments}
                    eventAttendingPaddlerIds={ctx.eventAttendingPaddlerIds}
                    eventGuests={ctx.eventGuests}
                    guestPaddlerMap={ctx.guestPaddlerMap}
                    lockedCanoes={ctx.lockedCanoes}
                    setLockedCanoes={ctx.setLockedCanoes}
                    canoeDesignations={ctx.canoeDesignations}
                    updateDesignationMut={ctx.updateDesignationMut}
                    renameCanoeMut={ctx.renameCanoeMut}
                    animationKey={ctx.animationKey}
                    boatWidth={ctx.boatWidth}
                    canoeRowHeight={ctx.canoeRowHeight}
                    canoeMargin={ctx.canoeMargin}
                    currentUser={currentUser}
                    selectedPaddlerId={ctx.selectedPaddlerId}
                    showAllBoats={ctx.showAllBoats}
                    setShowAllBoats={ctx.setShowAllBoats}
                    showGoingList={ctx.showGoingList}
                    setShowGoingList={ctx.setShowGoingList}
                    handleToggleAttendance={ctx.handleToggleAttendance}
                    handleAssign={ctx.handleAssign}
                    handleUnassignAll={ctx.handleUnassignAll}
                    handleReassignCanoes={ctx.handleReassignCanoes}
                    handleRemoveCanoe={ctx.handleRemoveCanoe}
                    handleAddCanoeAfter={ctx.handleAddCanoeAfter}
                    addCanoe={ctx.addCanoe}
                    triggerAnimation={ctx.triggerAnimation}
                    canoePriority={ctx.canoePriority}
                    setCanoePriority={ctx.setCanoePriority}
                    setScrollToEventId={ctx.setScrollToEventId}
                    setActivePage={ctx.setActivePage}
                  />
                )}

                {ctx.activePage === 'schedule' && <SchedulePage isAdmin={ctx.isAdmin} scrollPosRef={ctx.scheduleScrollPosRef} scrollToEventId={ctx.scrollToEventId} onSelectEvent={(evt) => {
                  ctx.setSelectedEvent(evt);
                  ctx.setScrollToEventId(null);
                  ctx.setActivePage('today');
                }} />}

                {ctx.activePage === 'roster' && ctx.paddlers && (
                  <RosterView
                    paddlers={ctx.paddlers}
                    isAdmin={ctx.isAdmin}
                    windowWidth={ctx.windowWidth}
                    updatePaddler={ctx.updatePaddler}
                    toggleAdminMut={ctx.toggleAdminMut}
                    deleteUserByPaddlerIdMut={ctx.deleteUserByPaddlerIdMut}
                    deletePaddlerMut={ctx.deletePaddlerMut}
                    userEmailByPaddlerId={ctx.userEmailByPaddlerId}
                    userRoleByPaddlerId={ctx.userRoleByPaddlerId}
                    onLogout={onLogout}
                  />
                )}
              </div>
              </div>

              {/* RIGHT COLUMN - STAGING SIDEBAR (admin only, hidden on narrow) */}
              {!isNarrow && ctx.isAdmin && (ctx.activePage === 'today' ? (
                <StagingSidebar
                  sidebarOpen={ctx.sidebarOpen}
                  setSidebarOpen={ctx.setSidebarOpen}
                  isDragging={ctx.isDragging}
                  dragFromStaging={ctx.dragFromStaging}
                  viewBy={ctx.viewBy}
                  setViewBy={ctx.setViewBy}
                  unassignedPaddlers={ctx.unassignedPaddlers}
                  unassignedGuests={ctx.unassignedGuests}
                  guestPaddlerMap={ctx.guestPaddlerMap}
                  pendingAssignIds={ctx.pendingAssignIds}
                  animationKey={ctx.animationKey}
                  isAdmin={ctx.isAdmin}
                  selectedEvent={ctx.selectedEvent}
                  showAddSearch={ctx.showAddSearch}
                  setShowAddSearch={ctx.setShowAddSearch}
                  addSearchQuery={ctx.addSearchQuery}
                  setAddSearchQuery={ctx.setAddSearchQuery}
                  addSearchInputRef={ctx.addSearchInputRef}
                  addSearchMenuRef={ctx.addSearchMenuRef}
                  paddlers={ctx.paddlers}
                  eventAttendingPaddlerIds={ctx.eventAttendingPaddlerIds}
                  setAttendanceMut={ctx.setAttendanceMut}
                />
              ) : (
                /* Spacer to keep layout width consistent across pages */
                <div style={{ width: ctx.sidebarOpen ? 180 : 32, height: '100%', flexShrink: 0, borderLeft: '1px solid rgba(0,0,0,.08)' }} />
              ))}
            </div>
          )}
        </main>

        {/* ON SHORE PANEL — mobile-only paddler pool, replaces sidebar on narrow. */}
        {!ctx.dataLoading && !ctx.hasNoData && isNarrow && ctx.isAdmin && ctx.activePage === 'today' && ctx.selectedEvent && (
          <OnShorePanel
            unassignedPaddlers={ctx.unassignedPaddlers}
            unassignedGuests={ctx.unassignedGuests}
            guestPaddlerMap={ctx.guestPaddlerMap}
            pendingAssignIds={ctx.pendingAssignIds}
            animationKey={ctx.animationKey}
            dragFromStaging={ctx.dragFromStaging}
            bottomOffset={navHidden ? 8 : navH}
            paddlers={ctx.paddlers}
            selectedEventId={ctx.selectedEvent?.id}
            eventAttendingPaddlerIds={ctx.eventAttendingPaddlerIds}
            onAddPaddler={(paddlerId: string) => {
              if (!ctx.selectedEvent) return;
              void ctx.setAttendanceMut({ paddlerId, eventId: ctx.selectedEvent.id, attending: true });
            }}
          />
        )}

        {/* BOTTOM TAB BAR — mobile-only, matches the mock. Auto-hides on
            scroll-down, returns on scroll-up. The drawer reads the real
            measured height so it sits flush without a visible gap. */}
        {!ctx.dataLoading && !ctx.hasNoData && isNarrow && (
          <nav
            ref={navRef}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'stretch',
              backgroundColor: 'rgba(255,255,255,0.96)',
              backdropFilter: 'saturate(180%) blur(18px)',
              WebkitBackdropFilter: 'saturate(180%) blur(18px)',
              borderTop: '1px solid rgba(0,0,0,.08)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              boxShadow: '0 -6px 24px rgba(0,0,0,.04)',
              transform: navHidden ? 'translateY(100%)' : 'translateY(0)',
              transition: 'transform 220ms ease',
              willChange: 'transform',
            }}
          >
            {([
              { page: 'today' as const, label: 'Today',    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12 L12 3 L21 12" /><path d="M5 10 V21 H19 V10" /></svg> },
              { page: 'schedule' as const, label: 'Schedule', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></svg> },
              { page: 'roster' as const, label: 'Roster', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20 a6.5 6.5 0 0 1 13 0" /><circle cx="17.5" cy="9" r="2.8" /><path d="M14.8 20 a5 5 0 0 1 6.7-4.7" /></svg> },
            ]).map(({ page, label, icon }) => {
              const active = ctx.activePage === page;
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => { ctx.setActivePage(page); if (page === 'today') ctx.setSelectedEvent(ctx.todayEvent || null); }}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '10px 6px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                    color: active ? '#b91c1c' : '#717171',
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '40px',
                      height: '26px',
                      borderRadius: '13px',
                      backgroundColor: active ? 'rgba(185,28,28,0.12)' : 'transparent',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    {icon}
                  </span>
                  <span style={{ fontSize: '10.5px', letterSpacing: '0.2px' }}>{label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Edit Paddler Modal */}
        {ctx.isEditModalOpen && ctx.editingPaddler && (
          <EditPaddlerModal
            editForm={ctx.editForm}
            setEditForm={ctx.setEditForm}
            onSave={ctx.handleSaveEdit}
            onClose={ctx.handleCloseEditModal}
          />
        )}
      </div>
    </DragDropContext>
  );
}

function AuthenticatedApp() {
  const { signOut } = useAuthActions();
  const convexUser = useQuery(api.auth.currentUser);

  if (convexUser === undefined) {
    return <LokahiSplash />;
  }

  if (!convexUser) {
    return <LoginPage />;
  }

  if (!convexUser.onboardingComplete || !convexUser.paddlerId) {
    return <OnboardingPage name={convexUser.name} />;
  }

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
        <LokahiSplash />
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
