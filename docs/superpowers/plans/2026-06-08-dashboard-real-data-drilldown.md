# Dashboard Real Data Drilldown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all production mock data, support real CSV import from the homepage, and add country-to-province-to-city map drilldown with large-screen layout fixes.

**Architecture:** Production data starts empty and only reads browser/local/API records. CSV schema excludes longitude and latitude. The dashboard owns drill state and import flow; the ECharts map component renders either the China map or a dynamically loaded province map.

**Tech Stack:** Next.js App Router, React, TypeScript, ECharts, GSAP, PapaParse, Vitest, Playwright.

---

### Task 1: Real Data Defaults And Test Fixtures

**Files:**
- Create: `tests/fixtures/deliveries.ts`
- Modify: `components/dashboard/useCoverageData.ts`
- Modify: `components/admin/AdminDataEntry.tsx`
- Modify: `lib/data/server-store.ts`
- Delete: `lib/mock/deliveries.ts`
- Modify tests that currently import `@/lib/mock/deliveries`

- [x] Add `sampleDeliveries` under `tests/fixtures/` for tests only.
- [x] Update production components/providers to use empty arrays as seed data.
- [x] Remove production imports of `mockDeliveries`.
- [x] Delete `lib/mock/deliveries.ts` and replace test imports.

### Task 2: CSV Without Coordinates

**Files:**
- Modify: `lib/csv/schema.ts`
- Modify: `lib/csv/parse.ts`
- Modify: `tests/csv.test.ts`

- [x] Remove longitude/latitude from exported template and export columns.
- [x] Treat legacy longitude/latitude columns as ignored input.
- [x] Update tests to assert coordinate columns are absent and legacy CSV does not fail.

### Task 3: Homepage Import And Empty State

**Files:**
- Modify: `components/dashboard/CoverageDashboard.tsx`
- Modify: `components/dashboard/useCoverageData.ts`
- Modify: `components/dashboard/coverage-dashboard.css`
- Modify: `tests/coverage-dashboard.test.tsx`

- [x] Add homepage CSV import and admin navigation actions.
- [x] Add empty state when no records exist.
- [x] Refresh dashboard state immediately after import.

### Task 4: Province-to-City Map Drilldown

**Files:**
- Modify: `components/dashboard/ChinaCoverageMap.tsx`
- Modify: `components/dashboard/CoverageDashboard.tsx`
- Modify: `lib/analytics/summary.ts`
- Modify: dashboard tests

- [x] Add province map code lookup and dynamic GeoJSON import.
- [x] Render province map with city metrics after province click.
- [x] Add city selection state and filter university cards by selected city.
- [x] Add back actions for city and country levels.

### Task 5: Large-Screen Layout And Legend Separation

**Files:**
- Modify: `components/dashboard/coverage-dashboard.css`
- Modify: `tests/e2e/dashboard.spec.ts`

- [x] Replace fixed map heights with viewport-aware sizing.
- [x] Move map legend away from current-region information.
- [x] Add large desktop E2E viewport coverage.

### Task 6: Verification

- [ ] Run focused unit tests for CSV, dashboard, hook, analytics, data provider.
- [ ] Run `bun run lint`.
- [ ] Run `bun run build`.
- [ ] Run `bun run export`.
- [ ] Run Playwright checks for desktop, mobile, and large-screen dashboard.
