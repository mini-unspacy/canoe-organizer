# Canoe Frontend Refactor Plan

**Date:** 2026-02-18
**Status:** On hold - still iterating on features

## The Problem

`frontend/src/App.tsx` is 2,873 lines. It handles:
- Multiple page views (today, roster, schedule, attendance, crews)
- Drag-and-drop logic
- Event CRUD operations
- Canoe assignment algorithms
- User management
- LocalStorage persistence

## What's Already Clean

The backend (Convex) is well-structured with 12 focused modules:
- `canoes.ts` (283 lines)
- `eventAssignments.ts` (237 lines)
- `paddlers.ts` (226 lines)
- `events.ts` (176 lines)
- `auth.ts` (154 lines)
- `paddling.ts` (85 lines)
- `attendance.ts` (78 lines)
- `eventGuests.ts` (36 lines)
- `admin.ts` (22 lines)
- `schema.ts` (94 lines)

The portal app is also well-structured (120-line App.tsx, 6 components, 4 hooks).

Only the canoe frontend needs the refactor.

## Extraction Plan (priority order)

### 1. Extract each view/tab into its own component
Biggest win. Natural boundaries already exist in the code.
- `TodayView.tsx`
- `RosterView.tsx`
- `ScheduleView.tsx`
- `AttendanceView.tsx`
- `CrewsView.tsx`

### 2. Extract drag-and-drop logic into a custom hook
- `useCanoeAssignment.ts` or similar
- Keeps the DnD wiring out of view components

### 3. Extract canoe assignment algorithm into utils
- `utils/assignmentAlgorithm.ts`
- Pure logic, easy to test independently

### 4. Shared state and types
- Leave in place until it gets painful
- If/when we add a state management layer, extract then

## Approach

Do NOT rewrite everything at once. Extract one view at a time, as we touch it for feature work. This avoids regressions and wasted time on code that's working fine.

## File Inventory (frontend/src/)

| File | Lines | Notes |
|------|-------|-------|
| App.tsx | 2873 | Needs decomposition |
| LoginPage.tsx | 177 | Fine |
| OnboardingPage.tsx | 197 | Fine |
| useAnimationTrigger.ts | - | Existing hook |
| components/ui/button.tsx | 57 | shadcn/ui |
| components/ui/card.tsx | 76 | shadcn/ui |
| lib/utils.ts | - | Utility helpers |
