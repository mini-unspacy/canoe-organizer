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

  return (
    <DragDropContext onDragEnd={ctx.onDragEnd} onDragStart={ctx.handleDragStart}>
      <div className="overflow-hidden" style={{ height: '100%', backgroundColor: '#ffffff', touchAction: ctx.isDragging ? 'none' : 'auto', paddingTop: 'env(safe-area-inset-top)' }}>
        <main className="max-w-6xl mx-auto" style={{ height: '100%', overflow: 'hidden', padding: '0 2px' }}>
          {ctx.dataLoading ? (
            <LokahiSplash />
          ) : ctx.hasNoData ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div
                onClick={() => { ctx.triggerAnimation(); ctx.populatePaddlers(); ctx.populateCanoes(); }}
                className="rounded-full border-[3px] flex items-center justify-center cursor-pointer transition-all hover:opacity-80"
                style={{ width: 64, height: 64, backgroundColor: '#faf9f7', borderColor: '#b0b0b0', color: '#222222', fontSize: '28px' }}
              >
                🛶
              </div>
              <p className="text-center mt-4 text-sm" style={{ color: '#717171' }}>Tap to load sample data</p>
            </div>
          ) : (
            <div style={{ display: 'flex', height: '100%', gap: '0', width: '100%', overflow: 'hidden' }}>
              {/* LEFT SIDEBAR - NAVIGATION */}
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
                <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: '#faf9f7', padding: ctx.leftSidebarOpen ? '16px 10px 0' : '16px 6px 0' }}>
                  <div onClick={() => ctx.setLeftSidebarOpen(!ctx.leftSidebarOpen)} style={{ textAlign: ctx.leftSidebarOpen ? 'left' : 'center', cursor: 'pointer', paddingBottom: '12px', borderBottom: '1px solid rgba(0,0,0,.08)', marginBottom: '8px' }}>
                    <span style={{
                      fontFamily: "'UnifrakturMaguntia', cursive",
                      color: '#ed1c24',
                      fontSize: ctx.leftSidebarOpen ? '26px' : '22px',
                      lineHeight: 1,
                    }}>
                      {ctx.leftSidebarOpen ? 'Lokahi' : 'L'}
                    </span>
                    {ctx.leftSidebarOpen && (
                      <div style={{ fontSize: '9px', color: '#717171', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '2px' }}>
                        Outrigger Canoe Club
                      </div>
                    )}
                  </div>
                </div>
                {/* Nav items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: ctx.leftSidebarOpen ? '8px 8px' : '8px 4px', flex: 1 }}>
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
                          padding: ctx.leftSidebarOpen ? '8px 10px' : '8px 0',
                          borderRadius: '8px',
                          color: ctx.activePage === page ? '#005280' : '#484848',
                          backgroundColor: ctx.activePage === page ? 'rgba(0, 82, 128, 0.08)' : 'transparent',
                          fontWeight: ctx.activePage === page ? 600 : 400,
                          userSelect: 'none',
                          justifyContent: ctx.leftSidebarOpen ? 'flex-start' : 'center',
                        }}
                        onMouseEnter={(e) => { if (ctx.activePage !== page) e.currentTarget.style.backgroundColor = 'rgba(0, 82, 128, 0.06)'; }}
                        onMouseLeave={(e) => { if (ctx.activePage !== page) e.currentTarget.style.backgroundColor = ctx.activePage === page ? 'rgba(0, 82, 128, 0.08)' : 'transparent'; }}
                      >
                        <span style={{ fontSize: '18px', lineHeight: 1, width: '20px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                        {ctx.leftSidebarOpen && <span style={{ fontSize: '14px', fontWeight: 'inherit' }}>{label}</span>}
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

              {/* MIDDLE COLUMN */}
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', height: '100%' }}>
              <div className="scrollbar-hidden" onClick={() => ctx.showGoingList && ctx.setShowGoingList(false)} style={{ width: '100%', maxWidth: '100%', overflowY: ctx.isDragging ? 'hidden' : 'auto', overflowX: 'hidden', height: '100%', touchAction: ctx.isDragging ? 'none' : 'auto', paddingBottom: 'env(safe-area-inset-bottom)' }}>
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
                  />
                )}
              </div>
              </div>

              {/* RIGHT COLUMN - STAGING SIDEBAR (admin only) */}
              {ctx.activePage === 'today' && ctx.isAdmin && (
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
              )}
            </div>
          )}
        </main>

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
