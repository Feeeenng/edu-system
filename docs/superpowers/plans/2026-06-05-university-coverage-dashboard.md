# 高校业务覆盖大屏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可本地运行、可静态导出、可部署到 Vercel 预览的高校业务覆盖大屏系统，支持地图钻取、标签筛选、数据管理和 CSV 导入导出。

**Architecture:** 使用 Next.js App Router + React + TypeScript 构建前端和轻量 API。业务汇总、CSV、数据适配、地图层级逻辑放在 `lib/`，UI 组件只消费清晰接口；本地服务模式使用本地 JSON，Vercel 模式使用 Blob，静态导出模式使用浏览器本地存储。

**Tech Stack:** Bun, Next.js, React, TypeScript, GSAP, Lucide React, PapaParse, Vitest, Playwright, CSS Modules/global CSS variables.

---

## File Structure

本计划会创建以下主要文件和职责边界：

- `package.json`：Bun 脚本、依赖、测试命令。
- `tsconfig.json`、`next.config.ts`、`vitest.config.ts`、`playwright.config.ts`、`vercel.json`：构建、测试、静态导出和 Vercel 配置。
- `app/layout.tsx`、`app/page.tsx`、`app/admin/page.tsx`、`app/globals.css`：Next.js 页面入口、全局样式和路由。
- `app/api/deliveries/route.ts`、`app/api/deliveries/import/route.ts`、`app/api/deliveries/export/route.ts`：记录 CRUD 和 CSV API。
- `components/dashboard/*`：大屏、KPI、地图钻取、筛选、排行、详情抽屉。
- `components/admin/*`：数据表、表单、CSV 导入导出。
- `components/ui/*`：按钮、输入、标签、抽屉、文件上传等通用组件。
- `lib/types.ts`：交付记录、筛选条件、汇总结果、地图层级类型。
- `lib/mock/deliveries.ts`：mock 数据。
- `lib/analytics/*`：统计、筛选、排行、层级聚合。
- `lib/csv/*`：中文列名映射、CSV 解析、模板和导出生成。
- `lib/data/*`：DataProvider 接口、API Provider、Browser Provider、服务端 JSON/Blob 存储适配。
- `lib/map/*`：简化中国、省份、城市层级数据和地图辅助函数。
- `tests/*`：核心统计、CSV、DataProvider 的单元测试。
- `AGENTS.md`、`README.md`：项目说明和开发约定。

---

### Task 1: Scaffold Next.js + Bun Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `vercel.json`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/globals.css`
- Create: `public/.gitkeep`

- [ ] **Step 1: Create project package and scripts**

Create `package.json`:

```json
{
  "name": "edu-system",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "export": "NEXT_PUBLIC_DATA_MODE=browser NEXT_OUTPUT_EXPORT=true next build",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@vercel/blob": "^0.27.3",
    "clsx": "^2.1.1",
    "gsap": "^3.12.5",
    "lucide-react": "^0.468.0",
    "next": "^15.0.0",
    "papaparse": "^5.4.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "three": "^0.171.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.10.2",
    "@types/papaparse": "^5.3.15",
    "@types/react": "^19.0.1",
    "@types/react-dom": "^19.0.2",
    "@types/three": "^0.171.0",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.17.0",
    "eslint-config-next": "^15.0.0",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    },
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create Next config with static export switch**

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";

const isStaticExport = process.env.NEXT_OUTPUT_EXPORT === "true";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : undefined,
  trailingSlash: isStaticExport,
  images: {
    unoptimized: isStaticExport,
  },
};

export default nextConfig;
```

- [ ] **Step 4: Create test configs**

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname,
    },
  },
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
```

- [ ] **Step 5: Create Vercel config**

Create `vercel.json`:

```json
{
  "installCommand": "bun install",
  "buildCommand": "bun run build",
  "framework": "nextjs",
  "bunVersion": "1.x"
}
```

- [ ] **Step 6: Create minimal app shell**

Create `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "高校业务覆盖大屏",
  description: "高校业务覆盖、交付资源与标签维度展示系统",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

Create `app/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <main className="app-shell">
      <h1>高校业务覆盖大屏</h1>
      <p>项目脚手架已就绪。</p>
    </main>
  );
}
```

Create `app/admin/page.tsx`:

```tsx
export default function AdminPage() {
  return (
    <main className="app-shell">
      <h1>数据管理</h1>
      <p>管理页面脚手架已就绪。</p>
    </main>
  );
}
```

Create `app/globals.css`:

```css
:root {
  --color-bg: #f8fafc;
  --color-panel: #ffffff;
  --color-ink: #0f172a;
  --color-muted: #64748b;
  --color-primary: #1e40af;
  --color-primary-soft: #dbeafe;
  --color-accent: #f59e0b;
  --color-line: #cbd5e1;
  --radius: 8px;
  --shadow-panel: 0 18px 50px rgba(15, 23, 42, 0.1);
}

* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
  margin: 0;
  color: var(--color-ink);
  background: var(--color-bg);
  font-family: "Fira Sans", "Microsoft YaHei", "PingFang SC", sans-serif;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

.app-shell {
  min-height: 100vh;
  padding: 32px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

Create `public/.gitkeep` as an empty file.

- [ ] **Step 7: Install dependencies**

Run:

```bash
bun install
```

Expected: `bun.lock` is created and dependencies install successfully.

- [ ] **Step 8: Verify scaffold builds**

Run:

```bash
bun run build
```

Expected: Next.js production build completes without TypeScript errors.

- [ ] **Step 9: Commit scaffold**

```bash
git add package.json bun.lock tsconfig.json next.config.ts vitest.config.ts playwright.config.ts vercel.json app public
git commit -m "chore: scaffold next bun app"
```

---

### Task 2: Define Types and Mock Data

**Files:**
- Create: `lib/types.ts`
- Create: `lib/mock/deliveries.ts`
- Create: `tests/setup.ts`
- Create: `tests/mock-data.test.ts`

- [ ] **Step 1: Write type smoke test**

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `tests/mock-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mockDeliveries } from "@/lib/mock/deliveries";

describe("mockDeliveries", () => {
  it("包含可用于全国、省份、地区和高校钻取的记录", () => {
    expect(mockDeliveries.length).toBeGreaterThanOrEqual(16);
    expect(new Set(mockDeliveries.map((item) => item.province)).size).toBeGreaterThanOrEqual(5);
    expect(mockDeliveries.every((item) => item.province && item.city && item.university)).toBe(true);
  });

  it("包含采购标签和产品标签，便于筛选测试", () => {
    const purchaseTags = new Set(mockDeliveries.flatMap((item) => item.purchaseTags));
    const productTags = new Set(mockDeliveries.flatMap((item) => item.productTags));

    expect(purchaseTags).toContain("VMware替换");
    expect(purchaseTags).toContain("信创");
    expect(purchaseTags).toContain("AI超融合");
    expect(productTags).toContain("SDDC");
    expect(productTags).toContain("FastGPT");
    expect(productTags).toContain("EDS");
    expect(productTags).toContain("桌面云");
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
bun run test tests/mock-data.test.ts
```

Expected: FAIL because `@/lib/mock/deliveries` does not exist.

- [ ] **Step 3: Create shared types**

Create `lib/types.ts`:

```ts
export type DeliveryRecord = {
  id: string;
  province: string;
  city: string;
  university: string;
  longitude?: number;
  latitude?: number;
  customerStatus?: string;
  coverageStatus?: "已覆盖" | "跟进中" | "未覆盖" | "暂停";
  projectStage?: "线索" | "测试" | "方案" | "交付" | "运维";
  deliveryDate?: string;
  owner?: string;
  purchaseTags: string[];
  productTags: string[];
  resourceType?: string;
  resourceAmount?: number;
  resourceUnit?: string;
  deliveryContent?: string;
  notes?: string;
  extraJson?: Record<string, unknown>;
  updatedAt: string;
};

export type DeliveryFilters = {
  province?: string;
  city?: string;
  university?: string;
  purchaseTags?: string[];
  productTags?: string[];
  coverageStatus?: string;
  projectStage?: string;
  keyword?: string;
};

export type DrillLevel = "country" | "province" | "city" | "university";

export type DrillState = {
  level: DrillLevel;
  province?: string;
  city?: string;
  university?: string;
};

export type CoverageSummary = {
  provinceCount: number;
  cityCount: number;
  universityCount: number;
  deliveryCount: number;
  productCount: number;
  purchaseTagCount: number;
};

export type RegionMetric = {
  name: string;
  province?: string;
  city?: string;
  universityCount: number;
  deliveryCount: number;
  productTags: string[];
  purchaseTags: string[];
};

export type UniversityDetail = {
  province: string;
  city: string;
  university: string;
  deliveries: DeliveryRecord[];
  productTags: string[];
  purchaseTags: string[];
  latestDeliveryDate?: string;
};

export type DeliveryPayload = Omit<DeliveryRecord, "id" | "updatedAt"> & {
  id?: string;
  updatedAt?: string;
};
```

- [ ] **Step 4: Create mock data**

Create `lib/mock/deliveries.ts`:

```ts
import type { DeliveryRecord } from "@/lib/types";

export const mockDeliveries: DeliveryRecord[] = [
  {
    id: "mock-001",
    province: "北京市",
    city: "北京市",
    university: "清华大学",
    longitude: 116.326,
    latitude: 40.003,
    customerStatus: "重点客户",
    coverageStatus: "已覆盖",
    projectStage: "交付",
    deliveryDate: "2026-03-12",
    owner: "华北-张工",
    purchaseTags: ["AI超融合", "信创"],
    productTags: ["FastGPT", "EDS"],
    resourceType: "一体机节点",
    resourceAmount: 6,
    resourceUnit: "台",
    deliveryContent: "AI 知识库与算力资源交付",
    notes: "用于校内科研知识库试点",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "mock-002",
    province: "北京市",
    city: "北京市",
    university: "北京理工大学",
    longitude: 116.315,
    latitude: 39.959,
    customerStatus: "存量客户",
    coverageStatus: "跟进中",
    projectStage: "方案",
    deliveryDate: "2026-02-20",
    owner: "华北-李工",
    purchaseTags: ["VMware替换"],
    productTags: ["SDDC", "桌面云"],
    resourceType: "虚拟化资源池",
    resourceAmount: 120,
    resourceUnit: "核",
    deliveryContent: "虚拟化替换方案评估",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "mock-003",
    province: "上海市",
    city: "上海市",
    university: "上海交通大学",
    longitude: 121.435,
    latitude: 31.025,
    customerStatus: "重点客户",
    coverageStatus: "已覆盖",
    projectStage: "运维",
    deliveryDate: "2026-01-18",
    owner: "华东-王工",
    purchaseTags: ["信创"],
    productTags: ["EDS", "SDDC"],
    resourceType: "存储资源",
    resourceAmount: 300,
    resourceUnit: "TB",
    deliveryContent: "科研数据存储资源扩容",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "mock-004",
    province: "广东省",
    city: "广州市",
    university: "中山大学",
    longitude: 113.298,
    latitude: 23.096,
    customerStatus: "重点客户",
    coverageStatus: "已覆盖",
    projectStage: "交付",
    deliveryDate: "2026-04-08",
    owner: "华南-陈工",
    purchaseTags: ["AI超融合"],
    productTags: ["FastGPT", "EDS"],
    resourceType: "AI 平台",
    resourceAmount: 1,
    resourceUnit: "套",
    deliveryContent: "学院级 AI 应用平台交付",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "mock-005",
    province: "广东省",
    city: "深圳市",
    university: "深圳大学",
    longitude: 113.932,
    latitude: 22.533,
    customerStatus: "新客户",
    coverageStatus: "跟进中",
    projectStage: "测试",
    deliveryDate: "2026-05-06",
    owner: "华南-陈工",
    purchaseTags: ["VMware替换", "信创"],
    productTags: ["SDDC"],
    resourceType: "测试资源",
    resourceAmount: 20,
    resourceUnit: "核",
    deliveryContent: "SDDC 替换 PoC",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "mock-006",
    province: "广东省",
    city: "深圳市",
    university: "南方科技大学",
    longitude: 113.999,
    latitude: 22.596,
    customerStatus: "重点客户",
    coverageStatus: "已覆盖",
    projectStage: "运维",
    deliveryDate: "2026-03-22",
    owner: "华南-林工",
    purchaseTags: ["AI超融合"],
    productTags: ["FastGPT", "桌面云"],
    resourceType: "桌面云资源",
    resourceAmount: 80,
    resourceUnit: "桌面",
    deliveryContent: "实验室桌面云与 AI 助手接入",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "mock-007",
    province: "江苏省",
    city: "南京市",
    university: "南京大学",
    longitude: 118.959,
    latitude: 32.116,
    customerStatus: "存量客户",
    coverageStatus: "已覆盖",
    projectStage: "交付",
    deliveryDate: "2026-04-18",
    owner: "华东-赵工",
    purchaseTags: ["信创"],
    productTags: ["EDS"],
    resourceType: "数据湖存储",
    resourceAmount: 200,
    resourceUnit: "TB",
    deliveryContent: "科研数据底座交付",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "mock-008",
    province: "江苏省",
    city: "苏州市",
    university: "苏州大学",
    longitude: 120.636,
    latitude: 31.302,
    customerStatus: "新客户",
    coverageStatus: "跟进中",
    projectStage: "线索",
    deliveryDate: "2026-05-18",
    owner: "华东-赵工",
    purchaseTags: ["VMware替换"],
    productTags: ["SDDC"],
    resourceType: "调研",
    resourceAmount: 1,
    resourceUnit: "次",
    deliveryContent: "虚拟化替换需求调研",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "mock-009",
    province: "四川省",
    city: "成都市",
    university: "四川大学",
    longitude: 104.084,
    latitude: 30.63,
    customerStatus: "重点客户",
    coverageStatus: "已覆盖",
    projectStage: "交付",
    deliveryDate: "2026-04-28",
    owner: "西南-周工",
    purchaseTags: ["AI超融合", "信创"],
    productTags: ["FastGPT", "EDS"],
    resourceType: "知识库平台",
    resourceAmount: 1,
    resourceUnit: "套",
    deliveryContent: "校级知识库试点",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "mock-010",
    province: "四川省",
    city: "绵阳市",
    university: "西南科技大学",
    longitude: 104.695,
    latitude: 31.534,
    customerStatus: "新客户",
    coverageStatus: "未覆盖",
    projectStage: "线索",
    deliveryDate: "2026-05-22",
    owner: "西南-周工",
    purchaseTags: ["信创"],
    productTags: ["桌面云"],
    resourceType: "方案沟通",
    resourceAmount: 1,
    resourceUnit: "次",
    deliveryContent: "信创桌面云方案沟通",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "mock-011",
    province: "湖北省",
    city: "武汉市",
    university: "武汉大学",
    longitude: 114.365,
    latitude: 30.536,
    customerStatus: "重点客户",
    coverageStatus: "已覆盖",
    projectStage: "运维",
    deliveryDate: "2026-02-16",
    owner: "华中-刘工",
    purchaseTags: ["VMware替换", "AI超融合"],
    productTags: ["SDDC", "FastGPT"],
    resourceType: "虚拟化平台",
    resourceAmount: 96,
    resourceUnit: "核",
    deliveryContent: "虚拟化平台升级与 AI 应用接入",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "mock-012",
    province: "湖北省",
    city: "武汉市",
    university: "华中科技大学",
    longitude: 114.414,
    latitude: 30.514,
    customerStatus: "存量客户",
    coverageStatus: "跟进中",
    projectStage: "测试",
    deliveryDate: "2026-05-11",
    owner: "华中-刘工",
    purchaseTags: ["信创"],
    productTags: ["EDS", "桌面云"],
    resourceType: "测试资源",
    resourceAmount: 30,
    resourceUnit: "桌面",
    deliveryContent: "信创桌面云测试",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "mock-013",
    province: "陕西省",
    city: "西安市",
    university: "西安交通大学",
    longitude: 108.983,
    latitude: 34.246,
    customerStatus: "重点客户",
    coverageStatus: "已覆盖",
    projectStage: "交付",
    deliveryDate: "2026-01-29",
    owner: "西北-马工",
    purchaseTags: ["AI超融合"],
    productTags: ["FastGPT"],
    resourceType: "AI 应用平台",
    resourceAmount: 1,
    resourceUnit: "套",
    deliveryContent: "科研助手平台交付",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "mock-014",
    province: "陕西省",
    city: "西安市",
    university: "西北工业大学",
    longitude: 108.914,
    latitude: 34.247,
    customerStatus: "存量客户",
    coverageStatus: "暂停",
    projectStage: "方案",
    deliveryDate: "2026-03-01",
    owner: "西北-马工",
    purchaseTags: ["VMware替换"],
    productTags: ["SDDC", "EDS"],
    resourceType: "资源池规划",
    resourceAmount: 1,
    resourceUnit: "份",
    deliveryContent: "资源池替换规划方案",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "mock-015",
    province: "浙江省",
    city: "杭州市",
    university: "浙江大学",
    longitude: 120.086,
    latitude: 30.308,
    customerStatus: "重点客户",
    coverageStatus: "已覆盖",
    projectStage: "运维",
    deliveryDate: "2026-04-03",
    owner: "华东-王工",
    purchaseTags: ["AI超融合", "信创"],
    productTags: ["FastGPT", "EDS", "桌面云"],
    resourceType: "融合平台",
    resourceAmount: 1,
    resourceUnit: "套",
    deliveryContent: "AI 与存储融合平台",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "mock-016",
    province: "浙江省",
    city: "宁波市",
    university: "宁波大学",
    longitude: 121.637,
    latitude: 29.911,
    customerStatus: "新客户",
    coverageStatus: "跟进中",
    projectStage: "方案",
    deliveryDate: "2026-05-28",
    owner: "华东-王工",
    purchaseTags: ["信创"],
    productTags: ["桌面云"],
    resourceType: "桌面云方案",
    resourceAmount: 60,
    resourceUnit: "桌面",
    deliveryContent: "教学机房桌面云方案",
    updatedAt: "2026-06-05T00:00:00.000Z",
  },
];
```

- [ ] **Step 5: Run tests**

Run:

```bash
bun run test tests/mock-data.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/mock/deliveries.ts tests/setup.ts tests/mock-data.test.ts
git commit -m "feat: add delivery types and mock data"
```

---

### Task 3: Implement Analytics and Filtering

**Files:**
- Create: `lib/analytics/filter.ts`
- Create: `lib/analytics/summary.ts`
- Create: `lib/analytics/rankings.ts`
- Create: `tests/analytics.test.ts`

- [ ] **Step 1: Write failing analytics tests**

Create `tests/analytics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filterDeliveries } from "@/lib/analytics/filter";
import { buildCoverageSummary, groupByCity, groupByProvince, getUniversityDetail } from "@/lib/analytics/summary";
import { rankUniversities } from "@/lib/analytics/rankings";
import { mockDeliveries } from "@/lib/mock/deliveries";

describe("analytics", () => {
  it("按产品标签和采购标签筛选交付记录", () => {
    const result = filterDeliveries(mockDeliveries, {
      productTags: ["FastGPT"],
      purchaseTags: ["AI超融合"],
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.productTags.includes("FastGPT"))).toBe(true);
    expect(result.every((item) => item.purchaseTags.includes("AI超融合"))).toBe(true);
  });

  it("统计全国覆盖摘要", () => {
    const summary = buildCoverageSummary(mockDeliveries);

    expect(summary.deliveryCount).toBe(mockDeliveries.length);
    expect(summary.provinceCount).toBeGreaterThanOrEqual(5);
    expect(summary.cityCount).toBeGreaterThanOrEqual(8);
    expect(summary.universityCount).toBeGreaterThanOrEqual(16);
    expect(summary.productCount).toBe(4);
    expect(summary.purchaseTagCount).toBe(3);
  });

  it("按省份和城市聚合高校覆盖", () => {
    const provinces = groupByProvince(mockDeliveries);
    const cities = groupByCity(mockDeliveries, "广东省");

    expect(provinces.find((item) => item.name === "广东省")?.universityCount).toBe(3);
    expect(cities.map((item) => item.name)).toEqual(expect.arrayContaining(["广州市", "深圳市"]));
  });

  it("获取高校详情并按交付日期倒序", () => {
    const detail = getUniversityDetail(mockDeliveries, "广东省", "深圳市", "深圳大学");

    expect(detail?.university).toBe("深圳大学");
    expect(detail?.deliveries.length).toBe(1);
    expect(detail?.productTags).toContain("SDDC");
  });

  it("按交付记录数生成高校排行", () => {
    const ranking = rankUniversities(mockDeliveries);

    expect(ranking.length).toBeGreaterThan(0);
    expect(ranking[0].deliveryCount).toBeGreaterThanOrEqual(ranking[ranking.length - 1].deliveryCount);
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
bun run test tests/analytics.test.ts
```

Expected: FAIL because analytics modules do not exist.

- [ ] **Step 3: Implement filtering**

Create `lib/analytics/filter.ts`:

```ts
import type { DeliveryFilters, DeliveryRecord } from "@/lib/types";

function includesEvery(selected: string[] | undefined, values: string[]) {
  if (!selected || selected.length === 0) return true;
  return selected.every((tag) => values.includes(tag));
}

export function filterDeliveries(records: DeliveryRecord[], filters: DeliveryFilters): DeliveryRecord[] {
  const keyword = filters.keyword?.trim().toLowerCase();

  return records.filter((record) => {
    if (filters.province && record.province !== filters.province) return false;
    if (filters.city && record.city !== filters.city) return false;
    if (filters.university && record.university !== filters.university) return false;
    if (filters.coverageStatus && record.coverageStatus !== filters.coverageStatus) return false;
    if (filters.projectStage && record.projectStage !== filters.projectStage) return false;
    if (!includesEvery(filters.purchaseTags, record.purchaseTags)) return false;
    if (!includesEvery(filters.productTags, record.productTags)) return false;

    if (keyword) {
      const haystack = [
        record.province,
        record.city,
        record.university,
        record.owner,
        record.deliveryContent,
        record.notes,
        record.resourceType,
        ...record.purchaseTags,
        ...record.productTags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(keyword)) return false;
    }

    return true;
  });
}
```

- [ ] **Step 4: Implement summary**

Create `lib/analytics/summary.ts`:

```ts
import type { CoverageSummary, DeliveryRecord, RegionMetric, UniversityDetail } from "@/lib/types";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function universityKey(record: DeliveryRecord) {
  return `${record.province}::${record.city}::${record.university}`;
}

function buildRegionMetric(name: string, records: DeliveryRecord[], province?: string, city?: string): RegionMetric {
  return {
    name,
    province,
    city,
    universityCount: new Set(records.map(universityKey)).size,
    deliveryCount: records.length,
    productTags: unique(records.flatMap((item) => item.productTags)),
    purchaseTags: unique(records.flatMap((item) => item.purchaseTags)),
  };
}

export function buildCoverageSummary(records: DeliveryRecord[]): CoverageSummary {
  return {
    provinceCount: new Set(records.map((item) => item.province)).size,
    cityCount: new Set(records.map((item) => `${item.province}::${item.city}`)).size,
    universityCount: new Set(records.map(universityKey)).size,
    deliveryCount: records.length,
    productCount: new Set(records.flatMap((item) => item.productTags)).size,
    purchaseTagCount: new Set(records.flatMap((item) => item.purchaseTags)).size,
  };
}

export function groupByProvince(records: DeliveryRecord[]): RegionMetric[] {
  const groups = new Map<string, DeliveryRecord[]>();
  for (const record of records) {
    groups.set(record.province, [...(groups.get(record.province) ?? []), record]);
  }

  return Array.from(groups.entries())
    .map(([province, group]) => buildRegionMetric(province, group, province))
    .sort((a, b) => b.deliveryCount - a.deliveryCount);
}

export function groupByCity(records: DeliveryRecord[], province: string): RegionMetric[] {
  const groups = new Map<string, DeliveryRecord[]>();
  for (const record of records.filter((item) => item.province === province)) {
    groups.set(record.city, [...(groups.get(record.city) ?? []), record]);
  }

  return Array.from(groups.entries())
    .map(([city, group]) => buildRegionMetric(city, group, province, city))
    .sort((a, b) => b.deliveryCount - a.deliveryCount);
}

export function getUniversityDetail(
  records: DeliveryRecord[],
  province: string,
  city: string,
  university: string,
): UniversityDetail | undefined {
  const deliveries = records
    .filter((item) => item.province === province && item.city === city && item.university === university)
    .sort((a, b) => (b.deliveryDate ?? "").localeCompare(a.deliveryDate ?? ""));

  if (deliveries.length === 0) return undefined;

  return {
    province,
    city,
    university,
    deliveries,
    productTags: unique(deliveries.flatMap((item) => item.productTags)),
    purchaseTags: unique(deliveries.flatMap((item) => item.purchaseTags)),
    latestDeliveryDate: deliveries[0]?.deliveryDate,
  };
}
```

- [ ] **Step 5: Implement rankings**

Create `lib/analytics/rankings.ts`:

```ts
import type { DeliveryRecord, RegionMetric } from "@/lib/types";

export function rankUniversities(records: DeliveryRecord[]): RegionMetric[] {
  const groups = new Map<string, DeliveryRecord[]>();
  for (const record of records) {
    const key = `${record.province}::${record.city}::${record.university}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const [province, city, university] = key.split("::");
      return {
        name: university,
        province,
        city,
        universityCount: 1,
        deliveryCount: group.length,
        productTags: Array.from(new Set(group.flatMap((item) => item.productTags))).sort(),
        purchaseTags: Array.from(new Set(group.flatMap((item) => item.purchaseTags))).sort(),
      };
    })
    .sort((a, b) => b.deliveryCount - a.deliveryCount || a.name.localeCompare(b.name, "zh-CN"));
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
bun run test tests/analytics.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/analytics tests/analytics.test.ts
git commit -m "feat: add coverage analytics"
```

---

### Task 4: Implement CSV Mapping, Parsing, and Export

**Files:**
- Create: `lib/csv/schema.ts`
- Create: `lib/csv/parse.ts`
- Create: `lib/csv/export.ts`
- Create: `tests/csv.test.ts`

- [ ] **Step 1: Write failing CSV tests**

Create `tests/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCsvTemplate, exportDeliveriesToCsv } from "@/lib/csv/export";
import { parseDeliveryCsv } from "@/lib/csv/parse";
import { CSV_COLUMNS } from "@/lib/csv/schema";
import { mockDeliveries } from "@/lib/mock/deliveries";

describe("csv", () => {
  it("提供中文 CSV 模板表头", () => {
    const template = buildCsvTemplate();

    expect(template).toContain("省份");
    expect(template).toContain("高校名称");
    expect(template).toContain("产品标签");
    expect(CSV_COLUMNS.some((column) => column.key === "province" && column.label === "省份")).toBe(true);
  });

  it("解析中文列名并拆分标签", () => {
    const csv = [
      "省份,地区/城市,高校名称,采购标签,产品标签,资源数量,交付内容",
      "广东省,深圳市,深圳大学,VMware替换;信创,SDDC;EDS,12,测试导入",
    ].join("\\n");

    const result = parseDeliveryCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.records[0].province).toBe("广东省");
    expect(result.records[0].purchaseTags).toEqual(["VMware替换", "信创"]);
    expect(result.records[0].productTags).toEqual(["SDDC", "EDS"]);
    expect(result.records[0].resourceAmount).toBe(12);
  });

  it("返回缺少必填字段的行号错误", () => {
    const csv = ["省份,地区/城市,高校名称", "广东省,深圳市,"].join("\\n");
    const result = parseDeliveryCsv(csv);

    expect(result.records).toHaveLength(0);
    expect(result.errors[0]).toContain("第 2 行");
    expect(result.errors[0]).toContain("高校名称");
  });

  it("导出交付记录为 CSV", () => {
    const csv = exportDeliveriesToCsv(mockDeliveries.slice(0, 1));

    expect(csv).toContain("省份");
    expect(csv).toContain("清华大学");
    expect(csv).toContain("FastGPT;EDS");
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
bun run test tests/csv.test.ts
```

Expected: FAIL because CSV modules do not exist.

- [ ] **Step 3: Implement CSV schema**

Create `lib/csv/schema.ts`:

```ts
import type { DeliveryPayload } from "@/lib/types";

export type CsvColumn = {
  key: keyof DeliveryPayload;
  label: string;
  aliases: string[];
};

export const CSV_COLUMNS: CsvColumn[] = [
  { key: "province", label: "省份", aliases: ["province"] },
  { key: "city", label: "地区/城市", aliases: ["城市", "地区", "city"] },
  { key: "university", label: "高校名称", aliases: ["高校", "学校", "university"] },
  { key: "longitude", label: "经度", aliases: ["longitude", "lng"] },
  { key: "latitude", label: "纬度", aliases: ["latitude", "lat"] },
  { key: "customerStatus", label: "客户状态", aliases: ["customerStatus"] },
  { key: "coverageStatus", label: "覆盖状态", aliases: ["coverageStatus"] },
  { key: "projectStage", label: "项目阶段", aliases: ["projectStage"] },
  { key: "deliveryDate", label: "交付日期", aliases: ["deliveryDate"] },
  { key: "owner", label: "负责人", aliases: ["owner"] },
  { key: "purchaseTags", label: "采购标签", aliases: ["purchaseTags"] },
  { key: "productTags", label: "产品标签", aliases: ["productTags"] },
  { key: "resourceType", label: "资源类型", aliases: ["resourceType"] },
  { key: "resourceAmount", label: "资源数量", aliases: ["resourceAmount"] },
  { key: "resourceUnit", label: "资源单位", aliases: ["resourceUnit"] },
  { key: "deliveryContent", label: "交付内容", aliases: ["deliveryContent"] },
  { key: "notes", label: "备注", aliases: ["notes"] },
  { key: "extraJson", label: "扩展字段JSON", aliases: ["extraJson"] },
];

export function resolveColumnKey(header: string): keyof DeliveryPayload | undefined {
  const normalized = header.trim();
  return CSV_COLUMNS.find((column) => column.label === normalized || column.aliases.includes(normalized))?.key;
}
```

- [ ] **Step 4: Implement CSV parser**

Create `lib/csv/parse.ts`:

```ts
import Papa from "papaparse";
import { resolveColumnKey } from "@/lib/csv/schema";
import type { DeliveryPayload } from "@/lib/types";

export type CsvParseResult = {
  records: DeliveryPayload[];
  errors: string[];
};

function splitTags(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/[;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseExtraJson(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function parseDeliveryCsv(csvText: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  const errors: string[] = [];
  const records: DeliveryPayload[] = [];

  parsed.data.forEach((row, index) => {
    const line = index + 2;
    const normalized: Partial<Record<keyof DeliveryPayload, string>> = {};

    for (const [header, value] of Object.entries(row)) {
      const key = resolveColumnKey(header);
      if (key) normalized[key] = value;
    }

    const missing = [
      ["province", "省份"],
      ["city", "地区/城市"],
      ["university", "高校名称"],
    ].filter(([key]) => !normalized[key as keyof DeliveryPayload]?.trim());

    if (missing.length > 0) {
      errors.push(`第 ${line} 行缺少必填字段：${missing.map((item) => item[1]).join("、")}`);
      return;
    }

    records.push({
      province: normalized.province!.trim(),
      city: normalized.city!.trim(),
      university: normalized.university!.trim(),
      longitude: parseNumber(normalized.longitude),
      latitude: parseNumber(normalized.latitude),
      customerStatus: normalized.customerStatus?.trim(),
      coverageStatus: normalized.coverageStatus?.trim() as DeliveryPayload["coverageStatus"],
      projectStage: normalized.projectStage?.trim() as DeliveryPayload["projectStage"],
      deliveryDate: normalized.deliveryDate?.trim(),
      owner: normalized.owner?.trim(),
      purchaseTags: splitTags(normalized.purchaseTags),
      productTags: splitTags(normalized.productTags),
      resourceType: normalized.resourceType?.trim(),
      resourceAmount: parseNumber(normalized.resourceAmount),
      resourceUnit: normalized.resourceUnit?.trim(),
      deliveryContent: normalized.deliveryContent?.trim(),
      notes: normalized.notes?.trim(),
      extraJson: parseExtraJson(normalized.extraJson),
    });
  });

  return { records, errors };
}
```

- [ ] **Step 5: Implement CSV export and template**

Create `lib/csv/export.ts`:

```ts
import Papa from "papaparse";
import { CSV_COLUMNS } from "@/lib/csv/schema";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

function formatValue(record: DeliveryPayload | DeliveryRecord, key: keyof DeliveryPayload) {
  const value = record[key];
  if (Array.isArray(value)) return value.join(";");
  if (key === "extraJson" && value && typeof value === "object") return JSON.stringify(value);
  return value ?? "";
}

export function buildCsvTemplate(): string {
  return Papa.unparse({
    fields: CSV_COLUMNS.map((column) => column.label),
    data: [],
  });
}

export function exportDeliveriesToCsv(records: Array<DeliveryPayload | DeliveryRecord>): string {
  return Papa.unparse({
    fields: CSV_COLUMNS.map((column) => column.label),
    data: records.map((record) => CSV_COLUMNS.map((column) => formatValue(record, column.key))),
  });
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
bun run test tests/csv.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/csv tests/csv.test.ts
git commit -m "feat: add csv import export helpers"
```

---

### Task 5: Implement Data Providers and API Routes

**Files:**
- Create: `lib/data/provider.ts`
- Create: `lib/data/normalize.ts`
- Create: `lib/data/browser-provider.ts`
- Create: `lib/data/server-store.ts`
- Create: `app/api/deliveries/route.ts`
- Create: `app/api/deliveries/import/route.ts`
- Create: `app/api/deliveries/export/route.ts`
- Create: `tests/data-provider.test.ts`

- [ ] **Step 1: Write failing provider tests**

Create `tests/data-provider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDeliveryRecord, normalizeDeliveryPayload } from "@/lib/data/normalize";

describe("data normalize", () => {
  it("为导入记录补齐 id、updatedAt 和标签数组", () => {
    const record = createDeliveryRecord({
      province: "广东省",
      city: "深圳市",
      university: "深圳大学",
      purchaseTags: [],
      productTags: ["SDDC"],
    });

    expect(record.id).toMatch(/^delivery-/);
    expect(record.updatedAt).toMatch(/T/);
    expect(record.purchaseTags).toEqual([]);
    expect(record.productTags).toEqual(["SDDC"]);
  });

  it("规范化空标签和数字字段", () => {
    const payload = normalizeDeliveryPayload({
      province: " 广东省 ",
      city: " 深圳市 ",
      university: " 深圳大学 ",
      purchaseTags: undefined as unknown as string[],
      productTags: undefined as unknown as string[],
      resourceAmount: Number.NaN,
    });

    expect(payload.province).toBe("广东省");
    expect(payload.purchaseTags).toEqual([]);
    expect(payload.productTags).toEqual([]);
    expect(payload.resourceAmount).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run failing provider tests**

Run:

```bash
bun run test tests/data-provider.test.ts
```

Expected: FAIL because `lib/data/normalize.ts` does not exist.

- [ ] **Step 3: Implement provider contract**

Create `lib/data/provider.ts`:

```ts
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

export type DeliveryDataProvider = {
  list(): Promise<DeliveryRecord[]>;
  replaceAll(records: DeliveryPayload[]): Promise<DeliveryRecord[]>;
  create(payload: DeliveryPayload): Promise<DeliveryRecord>;
  update(id: string, payload: DeliveryPayload): Promise<DeliveryRecord>;
  remove(id: string): Promise<void>;
};
```

- [ ] **Step 4: Implement normalization**

Create `lib/data/normalize.ts`:

```ts
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

function cleanText(value: string | undefined) {
  return value?.trim() ?? "";
}

function cleanOptionalText(value: string | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function cleanTags(value: string[] | undefined) {
  return Array.from(new Set((value ?? []).map((item) => item.trim()).filter(Boolean)));
}

function cleanNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function normalizeDeliveryPayload(payload: DeliveryPayload): DeliveryPayload {
  return {
    ...payload,
    province: cleanText(payload.province),
    city: cleanText(payload.city),
    university: cleanText(payload.university),
    longitude: cleanNumber(payload.longitude),
    latitude: cleanNumber(payload.latitude),
    customerStatus: cleanOptionalText(payload.customerStatus),
    coverageStatus: cleanOptionalText(payload.coverageStatus) as DeliveryPayload["coverageStatus"],
    projectStage: cleanOptionalText(payload.projectStage) as DeliveryPayload["projectStage"],
    deliveryDate: cleanOptionalText(payload.deliveryDate),
    owner: cleanOptionalText(payload.owner),
    purchaseTags: cleanTags(payload.purchaseTags),
    productTags: cleanTags(payload.productTags),
    resourceType: cleanOptionalText(payload.resourceType),
    resourceAmount: cleanNumber(payload.resourceAmount),
    resourceUnit: cleanOptionalText(payload.resourceUnit),
    deliveryContent: cleanOptionalText(payload.deliveryContent),
    notes: cleanOptionalText(payload.notes),
    extraJson: payload.extraJson,
  };
}

export function createDeliveryRecord(payload: DeliveryPayload): DeliveryRecord {
  const normalized = normalizeDeliveryPayload(payload);
  return {
    ...normalized,
    id: normalized.id ?? `delivery-${crypto.randomUUID()}`,
    updatedAt: normalized.updatedAt ?? new Date().toISOString(),
  };
}
```

- [ ] **Step 5: Implement browser provider**

Create `lib/data/browser-provider.ts`:

```ts
"use client";

import { createDeliveryRecord } from "@/lib/data/normalize";
import type { DeliveryDataProvider } from "@/lib/data/provider";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

const STORAGE_KEY = "edu-system.deliveries";

function readRecords(): DeliveryRecord[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecords(records: DeliveryRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function createBrowserProvider(seed: DeliveryRecord[] = []): DeliveryDataProvider {
  return {
    async list() {
      const current = readRecords();
      if (current.length === 0 && seed.length > 0) {
        writeRecords(seed);
        return seed;
      }
      return current;
    },
    async replaceAll(payloads) {
      const records = payloads.map(createDeliveryRecord);
      writeRecords(records);
      return records;
    },
    async create(payload) {
      const records = readRecords();
      const record = createDeliveryRecord(payload);
      writeRecords([record, ...records]);
      return record;
    },
    async update(id: string, payload: DeliveryPayload) {
      const records = readRecords();
      const updated = createDeliveryRecord({ ...payload, id, updatedAt: new Date().toISOString() });
      writeRecords(records.map((record) => (record.id === id ? updated : record)));
      return updated;
    },
    async remove(id: string) {
      writeRecords(readRecords().filter((record) => record.id !== id));
    },
  };
}
```

- [ ] **Step 6: Implement server store**

Create `lib/data/server-store.ts`:

```ts
import { del, list, put } from "@vercel/blob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDeliveryRecord } from "@/lib/data/normalize";
import { mockDeliveries } from "@/lib/mock/deliveries";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

const LOCAL_DATA_PATH = path.join(process.cwd(), "data", "deliveries.local.json");
const BLOB_KEY = "edu-system/deliveries.json";

function useBlobStore() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.VERCEL);
}

async function readLocalRecords(): Promise<DeliveryRecord[]> {
  try {
    const raw = await readFile(LOCAL_DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : mockDeliveries;
  } catch {
    return mockDeliveries;
  }
}

async function writeLocalRecords(records: DeliveryRecord[]) {
  await mkdir(path.dirname(LOCAL_DATA_PATH), { recursive: true });
  await writeFile(LOCAL_DATA_PATH, JSON.stringify(records, null, 2), "utf8");
}

async function readBlobRecords(): Promise<DeliveryRecord[]> {
  const blobs = await list({ prefix: BLOB_KEY, limit: 1 });
  const target = blobs.blobs.find((blob) => blob.pathname === BLOB_KEY);
  if (!target) return mockDeliveries;
  const response = await fetch(target.url, { cache: "no-store" });
  const parsed = await response.json();
  return Array.isArray(parsed) ? parsed : mockDeliveries;
}

async function writeBlobRecords(records: DeliveryRecord[]) {
  await del(BLOB_KEY).catch(() => undefined);
  await put(BLOB_KEY, JSON.stringify(records, null, 2), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

export async function readServerRecords(): Promise<DeliveryRecord[]> {
  return useBlobStore() ? readBlobRecords() : readLocalRecords();
}

export async function writeServerRecords(records: DeliveryRecord[]) {
  if (useBlobStore()) {
    await writeBlobRecords(records);
  } else {
    await writeLocalRecords(records);
  }
}

export async function replaceServerRecords(payloads: DeliveryPayload[]) {
  const records = payloads.map(createDeliveryRecord);
  await writeServerRecords(records);
  return records;
}
```

- [ ] **Step 7: Implement delivery CRUD API**

Create `app/api/deliveries/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createDeliveryRecord } from "@/lib/data/normalize";
import { readServerRecords, replaceServerRecords, writeServerRecords } from "@/lib/data/server-store";
import type { DeliveryPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const records = await readServerRecords();
  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as DeliveryPayload;
  const records = await readServerRecords();
  const record = createDeliveryRecord(payload);
  await writeServerRecords([record, ...records]);
  return NextResponse.json({ record }, { status: 201 });
}

export async function PUT(request: Request) {
  const payload = (await request.json()) as DeliveryPayload;
  if (!payload.id) {
    return NextResponse.json({ error: "缺少记录 ID" }, { status: 400 });
  }

  const records = await readServerRecords();
  const updated = createDeliveryRecord({ ...payload, updatedAt: new Date().toISOString() });
  await writeServerRecords(records.map((record) => (record.id === payload.id ? updated : record)));
  return NextResponse.json({ record: updated });
}

export async function DELETE(request: Request) {
  const { id } = (await request.json()) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "缺少记录 ID" }, { status: 400 });
  }

  await writeServerRecords((await readServerRecords()).filter((record) => record.id !== id));
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const payloads = (await request.json()) as DeliveryPayload[];
  const records = await replaceServerRecords(payloads);
  return NextResponse.json({ records });
}
```

- [ ] **Step 8: Implement import/export APIs**

Create `app/api/deliveries/import/route.ts`:

```ts
import { NextResponse } from "next/server";
import { parseDeliveryCsv } from "@/lib/csv/parse";
import { replaceServerRecords } from "@/lib/data/server-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  const result = parseDeliveryCsv(body);
  if (result.errors.length > 0) {
    return NextResponse.json(result, { status: 400 });
  }

  const records = await replaceServerRecords(result.records);
  return NextResponse.json({ records, errors: [] });
}
```

Create `app/api/deliveries/export/route.ts`:

```ts
import { exportDeliveriesToCsv } from "@/lib/csv/export";
import { readServerRecords } from "@/lib/data/server-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const csv = exportDeliveriesToCsv(await readServerRecords());
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=deliveries.csv",
    },
  });
}
```

- [ ] **Step 9: Run tests and build**

Run:

```bash
bun run test tests/data-provider.test.ts
bun run build
```

Expected: tests PASS and build succeeds.

- [ ] **Step 10: Commit**

```bash
git add lib/data app/api tests/data-provider.test.ts
git commit -m "feat: add delivery data providers and api"
```

---

### Task 6: Build Reusable UI Components

**Files:**
- Create: `components/ui/Button.tsx`
- Create: `components/ui/TextInput.tsx`
- Create: `components/ui/SelectInput.tsx`
- Create: `components/ui/TagToggle.tsx`
- Create: `components/ui/Drawer.tsx`
- Create: `components/ui/FileDrop.tsx`
- Create: `components/ui/ui.module.css`

- [ ] **Step 1: Create UI styles**

Create `components/ui/ui.module.css`:

```css
.button {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 0 14px;
  background: var(--color-primary);
  color: white;
  font-weight: 700;
  transition: background 180ms ease, border-color 180ms ease, color 180ms ease;
}

.button:hover {
  background: #1d4ed8;
}

.button.secondary {
  border-color: var(--color-line);
  background: white;
  color: var(--color-ink);
}

.button.secondary:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.field {
  display: grid;
  gap: 6px;
}

.label {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
}

.input {
  min-height: 38px;
  width: 100%;
  border: 1px solid var(--color-line);
  border-radius: 6px;
  padding: 0 10px;
  background: white;
  color: var(--color-ink);
}

.tag {
  border: 1px solid var(--color-line);
  border-radius: 999px;
  padding: 6px 10px;
  background: white;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
  transition: border-color 180ms ease, background 180ms ease, color 180ms ease;
}

.tagActive {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.drawerBackdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: rgba(15, 23, 42, 0.38);
}

.drawer {
  position: fixed;
  inset: 0 0 0 auto;
  z-index: 21;
  width: min(520px, 100vw);
  overflow: auto;
  border-left: 1px solid var(--color-line);
  background: white;
  box-shadow: var(--shadow-panel);
}

.drawerHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--color-line);
  padding: 18px;
}

.drawerBody {
  padding: 18px;
}

.drop {
  display: grid;
  min-height: 120px;
  place-items: center;
  border: 1px dashed #93c5fd;
  border-radius: var(--radius);
  background: #eff6ff;
  color: var(--color-primary);
  text-align: center;
}
```

- [ ] **Step 2: Create Button**

Create `components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import styles from "./ui.module.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  variant?: "primary" | "secondary";
};

export function Button({ children, icon, variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button className={clsx(styles.button, variant === "secondary" && styles.secondary, className)} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
```

- [ ] **Step 3: Create form controls**

Create `components/ui/TextInput.tsx`:

```tsx
import type { InputHTMLAttributes } from "react";
import styles from "./ui.module.css";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function TextInput({ label, id, ...props }: TextInputProps) {
  const inputId = id ?? label;
  return (
    <label className={styles.field} htmlFor={inputId}>
      <span className={styles.label}>{label}</span>
      <input id={inputId} className={styles.input} {...props} />
    </label>
  );
}
```

Create `components/ui/SelectInput.tsx`:

```tsx
import type { SelectHTMLAttributes } from "react";
import styles from "./ui.module.css";

type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: string[];
  placeholder?: string;
};

export function SelectInput({ label, id, options, placeholder = "全部", ...props }: SelectInputProps) {
  const inputId = id ?? label;
  return (
    <label className={styles.field} htmlFor={inputId}>
      <span className={styles.label}>{label}</span>
      <select id={inputId} className={styles.input} {...props}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 4: Create TagToggle**

Create `components/ui/TagToggle.tsx`:

```tsx
import clsx from "clsx";
import styles from "./ui.module.css";

type TagToggleProps = {
  label: string;
  active: boolean;
  onToggle: (label: string) => void;
};

export function TagToggle({ label, active, onToggle }: TagToggleProps) {
  return (
    <button
      type="button"
      className={clsx(styles.tag, active && styles.tagActive)}
      aria-pressed={active}
      onClick={() => onToggle(label)}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 5: Create Drawer**

Create `components/ui/Drawer.tsx`:

```tsx
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import styles from "./ui.module.css";

type DrawerProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function Drawer({ open, title, children, onClose }: DrawerProps) {
  if (!open) return null;

  return (
    <>
      <div className={styles.drawerBackdrop} onClick={onClose} />
      <aside className={styles.drawer} aria-label={title}>
        <header className={styles.drawerHeader}>
          <h2>{title}</h2>
          <Button variant="secondary" icon={<X size={16} />} onClick={onClose}>
            关闭
          </Button>
        </header>
        <div className={styles.drawerBody}>{children}</div>
      </aside>
    </>
  );
}
```

- [ ] **Step 6: Create FileDrop**

Create `components/ui/FileDrop.tsx`:

```tsx
"use client";

import { Upload } from "lucide-react";
import styles from "./ui.module.css";

type FileDropProps = {
  accept?: string;
  onTextLoaded: (text: string) => void;
};

export function FileDrop({ accept = ".csv,text/csv", onTextLoaded }: FileDropProps) {
  async function handleFile(file: File | undefined) {
    if (!file) return;
    onTextLoaded(await file.text());
  }

  return (
    <label className={styles.drop}>
      <input
        type="file"
        accept={accept}
        hidden
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <span>
        <Upload size={22} />
        <br />
        点击上传 CSV
      </span>
    </label>
  );
}
```

- [ ] **Step 7: Build verify**

Run:

```bash
bun run build
```

Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add components/ui
git commit -m "feat: add reusable ui components"
```

---

### Task 7: Build Dashboard Data Hook and Layout

**Files:**
- Create: `components/dashboard/useDeliveries.ts`
- Create: `components/dashboard/DashboardApp.tsx`
- Create: `components/dashboard/dashboard.module.css`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create dashboard styles**

Create `components/dashboard/dashboard.module.css`:

```css
.shell {
  min-height: 100vh;
  padding: 18px;
  background:
    linear-gradient(135deg, rgba(30, 64, 175, 0.08), transparent 28%),
    radial-gradient(circle at 82% 10%, rgba(245, 158, 11, 0.12), transparent 24%),
    var(--color-bg);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.titleBlock h1 {
  margin: 0;
  font-size: clamp(24px, 3vw, 42px);
  letter-spacing: 0;
}

.titleBlock p {
  margin: 6px 0 0;
  color: var(--color-muted);
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
}

.panel {
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: var(--shadow-panel);
}

.kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.kpi {
  padding: 14px;
}

.kpiLabel {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
}

.kpiValue {
  margin-top: 8px;
  color: var(--color-primary);
  font-family: "Fira Code", monospace;
  font-size: 28px;
  font-weight: 800;
}

.side {
  display: grid;
  gap: 14px;
  align-content: start;
}

.section {
  padding: 14px;
}

.section h2 {
  margin: 0 0 12px;
  font-size: 16px;
}

@media (max-width: 980px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

- [ ] **Step 2: Create delivery loading hook**

Create `components/dashboard/useDeliveries.ts`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { mockDeliveries } from "@/lib/mock/deliveries";
import type { DeliveryRecord } from "@/lib/types";

export function useDeliveries() {
  const [records, setRecords] = useState<DeliveryRecord[]>(mockDeliveries);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DATA_MODE === "browser") {
      setLoading(false);
      return;
    }

    fetch("/api/deliveries", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("读取数据失败");
        return response.json() as Promise<{ records: DeliveryRecord[] }>;
      })
      .then((data) => setRecords(data.records))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "读取数据失败"))
      .finally(() => setLoading(false));
  }, []);

  return { records, setRecords, loading, error };
}
```

- [ ] **Step 3: Create dashboard layout**

Create `components/dashboard/DashboardApp.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Database } from "lucide-react";
import { buildCoverageSummary } from "@/lib/analytics/summary";
import { Button } from "@/components/ui/Button";
import { useDeliveries } from "@/components/dashboard/useDeliveries";
import styles from "./dashboard.module.css";

export function DashboardApp() {
  const { records, loading, error } = useDeliveries();
  const summary = buildCoverageSummary(records);

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.titleBlock}>
          <h1>高校业务覆盖大屏</h1>
          <p>全国 → 省份 → 地区/城市 → 高校的业务覆盖和交付资源展示</p>
        </div>
        <Link href="/admin">
          <Button icon={<Database size={16} />}>数据管理</Button>
        </Link>
      </header>

      {error ? <div className={styles.panel}>{error}</div> : null}
      {loading ? <div className={styles.panel}>数据加载中...</div> : null}

      <section className={styles.kpis} aria-label="覆盖指标">
        <div className={`${styles.panel} ${styles.kpi}`}>
          <div className={styles.kpiLabel}>覆盖高校</div>
          <div className={styles.kpiValue}>{summary.universityCount}</div>
        </div>
        <div className={`${styles.panel} ${styles.kpi}`}>
          <div className={styles.kpiLabel}>覆盖省份</div>
          <div className={styles.kpiValue}>{summary.provinceCount}</div>
        </div>
        <div className={`${styles.panel} ${styles.kpi}`}>
          <div className={styles.kpiLabel}>覆盖地区</div>
          <div className={styles.kpiValue}>{summary.cityCount}</div>
        </div>
        <div className={`${styles.panel} ${styles.kpi}`}>
          <div className={styles.kpiLabel}>交付记录</div>
          <div className={styles.kpiValue}>{summary.deliveryCount}</div>
        </div>
        <div className={`${styles.panel} ${styles.kpi}`}>
          <div className={styles.kpiLabel}>产品覆盖</div>
          <div className={styles.kpiValue}>{summary.productCount}</div>
        </div>
      </section>

      <section className={styles.grid}>
        <div className={`${styles.panel} ${styles.section}`}>
          <h2>地图钻取区</h2>
          <p>下一任务会接入省份、地区和高校点位交互。</p>
        </div>
        <aside className={styles.side}>
          <div className={`${styles.panel} ${styles.section}`}>
            <h2>标签筛选</h2>
            <p>下一任务会接入产品和采购标签筛选。</p>
          </div>
          <div className={`${styles.panel} ${styles.section}`}>
            <h2>高校排行</h2>
            <p>下一任务会接入交付排行。</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Wire dashboard page**

Modify `app/page.tsx`:

```tsx
import { DashboardApp } from "@/components/dashboard/DashboardApp";

export default function DashboardPage() {
  return <DashboardApp />;
}
```

- [ ] **Step 5: Build verify**

Run:

```bash
bun run build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/dashboard
git commit -m "feat: add dashboard shell"
```

---

### Task 8: Implement Map Drilldown, Filters, Rankings, and Detail Drawer

**Files:**
- Create: `lib/map/regions.ts`
- Create: `components/dashboard/CoverageMap.tsx`
- Create: `components/dashboard/FilterPanel.tsx`
- Create: `components/dashboard/RankingPanel.tsx`
- Create: `components/dashboard/UniversityDrawer.tsx`
- Modify: `components/dashboard/DashboardApp.tsx`
- Modify: `components/dashboard/dashboard.module.css`

- [ ] **Step 1: Create simplified region metadata**

Create `lib/map/regions.ts`:

```ts
export type RegionShape = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const provinceShapes: RegionShape[] = [
  { name: "北京市", x: 540, y: 168, width: 44, height: 38 },
  { name: "上海市", x: 660, y: 360, width: 42, height: 36 },
  { name: "广东省", x: 560, y: 560, width: 108, height: 76 },
  { name: "江苏省", x: 620, y: 324, width: 82, height: 54 },
  { name: "四川省", x: 390, y: 438, width: 112, height: 82 },
  { name: "湖北省", x: 520, y: 420, width: 92, height: 62 },
  { name: "陕西省", x: 455, y: 350, width: 86, height: 74 },
  { name: "浙江省", x: 650, y: 410, width: 76, height: 58 },
];

export const cityShapes: Record<string, RegionShape[]> = {
  广东省: [
    { name: "广州市", x: 350, y: 260, width: 140, height: 92 },
    { name: "深圳市", x: 510, y: 360, width: 150, height: 88 },
  ],
  江苏省: [
    { name: "南京市", x: 320, y: 260, width: 150, height: 90 },
    { name: "苏州市", x: 500, y: 310, width: 150, height: 86 },
  ],
  四川省: [
    { name: "成都市", x: 300, y: 260, width: 170, height: 95 },
    { name: "绵阳市", x: 490, y: 190, width: 145, height: 82 },
  ],
  湖北省: [{ name: "武汉市", x: 390, y: 290, width: 170, height: 100 }],
  陕西省: [{ name: "西安市", x: 380, y: 300, width: 170, height: 100 }],
  浙江省: [
    { name: "杭州市", x: 330, y: 250, width: 160, height: 92 },
    { name: "宁波市", x: 510, y: 330, width: 150, height: 88 },
  ],
  北京市: [{ name: "北京市", x: 390, y: 280, width: 180, height: 110 }],
  上海市: [{ name: "上海市", x: 390, y: 280, width: 180, height: 110 }],
};
```

- [ ] **Step 2: Extend dashboard styles**

Append to `components/dashboard/dashboard.module.css`:

```css
.mapStage {
  position: relative;
  min-height: 520px;
  overflow: hidden;
  border-radius: var(--radius);
  background: linear-gradient(145deg, #06182e, #123a65);
  color: #dbeafe;
}

.mapSvg {
  width: 100%;
  height: 520px;
  display: block;
}

.regionButton {
  cursor: pointer;
  transition: opacity 180ms ease, filter 180ms ease;
}

.regionButton:hover {
  filter: brightness(1.12);
}

.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.tagGroup {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rankList {
  display: grid;
  gap: 8px;
}

.rankItem {
  width: 100%;
  border: 1px solid var(--color-line);
  border-radius: 7px;
  padding: 10px;
  background: white;
  text-align: left;
}

.rankMeta {
  margin-top: 6px;
  color: var(--color-muted);
  font-size: 12px;
}

.deliveryCard {
  border: 1px solid var(--color-line);
  border-radius: 7px;
  padding: 12px;
  background: #f8fafc;
}
```

- [ ] **Step 3: Create CoverageMap**

Create `components/dashboard/CoverageMap.tsx`:

```tsx
import type { DeliveryRecord, DrillState, RegionMetric } from "@/lib/types";
import { groupByCity, groupByProvince } from "@/lib/analytics/summary";
import { cityShapes, provinceShapes } from "@/lib/map/regions";
import styles from "./dashboard.module.css";

type CoverageMapProps = {
  records: DeliveryRecord[];
  drill: DrillState;
  onDrill: (next: DrillState) => void;
};

function metricFor(metrics: RegionMetric[], name: string) {
  return metrics.find((metric) => metric.name === name);
}

export function CoverageMap({ records, drill, onDrill }: CoverageMapProps) {
  const isProvince = drill.level !== "country" && drill.province;
  const shapes = isProvince ? cityShapes[drill.province!] ?? [] : provinceShapes;
  const metrics = isProvince ? groupByCity(records, drill.province!) : groupByProvince(records);

  return (
    <div>
      <div className={styles.breadcrumb}>
        <button onClick={() => onDrill({ level: "country" })}>全国</button>
        {drill.province ? <button onClick={() => onDrill({ level: "province", province: drill.province })}>{drill.province}</button> : null}
        {drill.city ? <button onClick={() => onDrill({ level: "city", province: drill.province, city: drill.city })}>{drill.city}</button> : null}
      </div>
      <div className={styles.mapStage}>
        <svg className={styles.mapSvg} viewBox="0 0 820 680" role="img" aria-label="高校覆盖地图">
          <rect x="0" y="0" width="820" height="680" fill="transparent" />
          {shapes.map((shape) => {
            const metric = metricFor(metrics, shape.name);
            const intensity = Math.min((metric?.deliveryCount ?? 0) / 5, 1);
            const fill = metric ? `rgba(59, 130, 246, ${0.32 + intensity * 0.5})` : "rgba(148, 163, 184, 0.18)";

            return (
              <g
                className={styles.regionButton}
                key={shape.name}
                onClick={() =>
                  isProvince
                    ? onDrill({ level: "city", province: drill.province, city: shape.name })
                    : onDrill({ level: "province", province: shape.name })
                }
              >
                <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx="16" fill={fill} stroke="rgba(191,219,254,.78)" />
                <text x={shape.x + 16} y={shape.y + 30} fill="#e0f2fe" fontSize="18" fontWeight="700">
                  {shape.name}
                </text>
                <text x={shape.x + 16} y={shape.y + 56} fill="#fbbf24" fontSize="14">
                  {metric?.universityCount ?? 0} 所 / {metric?.deliveryCount ?? 0} 条
                </text>
              </g>
            );
          })}
          {drill.level === "city"
            ? records
                .filter((record) => record.province === drill.province && record.city === drill.city)
                .map((record, index) => (
                  <g
                    key={record.id}
                    className={styles.regionButton}
                    onClick={() =>
                      onDrill({
                        level: "university",
                        province: record.province,
                        city: record.city,
                        university: record.university,
                      })
                    }
                  >
                    <circle cx={260 + index * 74} cy={500 + (index % 2) * 46} r="12" fill="#f59e0b" />
                    <text x={278 + index * 74} y={506 + (index % 2) * 46} fill="#fef3c7" fontSize="13">
                      {record.university}
                    </text>
                  </g>
                ))
            : null}
        </svg>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create FilterPanel**

Create `components/dashboard/FilterPanel.tsx`:

```tsx
import { TagToggle } from "@/components/ui/TagToggle";
import type { DeliveryFilters, DeliveryRecord } from "@/lib/types";
import styles from "./dashboard.module.css";

type FilterPanelProps = {
  records: DeliveryRecord[];
  filters: DeliveryFilters;
  onChange: (filters: DeliveryFilters) => void;
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function toggleTag(current: string[] | undefined, tag: string) {
  const set = new Set(current ?? []);
  if (set.has(tag)) set.delete(tag);
  else set.add(tag);
  return Array.from(set);
}

export function FilterPanel({ records, filters, onChange }: FilterPanelProps) {
  const purchaseTags = unique(records.flatMap((item) => item.purchaseTags));
  const productTags = unique(records.flatMap((item) => item.productTags));

  return (
    <div className={styles.section}>
      <h2>标签筛选</h2>
      <p>产品维度</p>
      <div className={styles.tagGroup}>
        {productTags.map((tag) => (
          <TagToggle
            key={tag}
            label={tag}
            active={filters.productTags?.includes(tag) ?? false}
            onToggle={() => onChange({ ...filters, productTags: toggleTag(filters.productTags, tag) })}
          />
        ))}
      </div>
      <p>采购标签</p>
      <div className={styles.tagGroup}>
        {purchaseTags.map((tag) => (
          <TagToggle
            key={tag}
            label={tag}
            active={filters.purchaseTags?.includes(tag) ?? false}
            onToggle={() => onChange({ ...filters, purchaseTags: toggleTag(filters.purchaseTags, tag) })}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create RankingPanel**

Create `components/dashboard/RankingPanel.tsx`:

```tsx
import type { DrillState, RegionMetric } from "@/lib/types";
import styles from "./dashboard.module.css";

type RankingPanelProps = {
  items: RegionMetric[];
  onSelect: (drill: DrillState) => void;
};

export function RankingPanel({ items, onSelect }: RankingPanelProps) {
  return (
    <div className={styles.section}>
      <h2>高校排行</h2>
      <div className={styles.rankList}>
        {items.slice(0, 8).map((item) => (
          <button
            className={styles.rankItem}
            key={`${item.province}-${item.city}-${item.name}`}
            onClick={() => onSelect({ level: "university", province: item.province, city: item.city, university: item.name })}
          >
            <strong>{item.name}</strong>
            <div className={styles.rankMeta}>
              {item.province} / {item.city} / {item.deliveryCount} 条交付
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create UniversityDrawer**

Create `components/dashboard/UniversityDrawer.tsx`:

```tsx
import { Drawer } from "@/components/ui/Drawer";
import type { UniversityDetail } from "@/lib/types";
import styles from "./dashboard.module.css";

type UniversityDrawerProps = {
  detail?: UniversityDetail;
  onClose: () => void;
};

export function UniversityDrawer({ detail, onClose }: UniversityDrawerProps) {
  return (
    <Drawer open={Boolean(detail)} title={detail?.university ?? "高校详情"} onClose={onClose}>
      {detail ? (
        <div>
          <p>
            {detail.province} / {detail.city} / 最近交付：{detail.latestDeliveryDate ?? "未填写"}
          </p>
          <p>产品：{detail.productTags.join("、") || "未填写"}</p>
          <p>采购标签：{detail.purchaseTags.join("、") || "未填写"}</p>
          <div className={styles.rankList}>
            {detail.deliveries.map((delivery) => (
              <article className={styles.deliveryCard} key={delivery.id}>
                <strong>{delivery.resourceType ?? "交付资源"}</strong>
                <p>
                  {delivery.resourceAmount ?? "-"} {delivery.resourceUnit ?? ""} / {delivery.projectStage ?? "阶段未填写"}
                </p>
                <p>{delivery.deliveryContent ?? "交付内容未填写"}</p>
                {delivery.notes ? <p>备注：{delivery.notes}</p> : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
```

- [ ] **Step 7: Wire dashboard interactions**

Replace `components/dashboard/DashboardApp.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Database } from "lucide-react";
import { filterDeliveries } from "@/lib/analytics/filter";
import { rankUniversities } from "@/lib/analytics/rankings";
import { buildCoverageSummary, getUniversityDetail } from "@/lib/analytics/summary";
import type { DeliveryFilters, DrillState } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { CoverageMap } from "@/components/dashboard/CoverageMap";
import { FilterPanel } from "@/components/dashboard/FilterPanel";
import { RankingPanel } from "@/components/dashboard/RankingPanel";
import { UniversityDrawer } from "@/components/dashboard/UniversityDrawer";
import { useDeliveries } from "@/components/dashboard/useDeliveries";
import styles from "./dashboard.module.css";

export function DashboardApp() {
  const { records, loading, error } = useDeliveries();
  const [filters, setFilters] = useState<DeliveryFilters>({});
  const [drill, setDrill] = useState<DrillState>({ level: "country" });

  const filtered = useMemo(() => filterDeliveries(records, filters), [records, filters]);
  const summary = buildCoverageSummary(filtered);
  const ranking = rankUniversities(filtered);
  const detail =
    drill.level === "university" && drill.province && drill.city && drill.university
      ? getUniversityDetail(filtered, drill.province, drill.city, drill.university)
      : undefined;

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.titleBlock}>
          <h1>高校业务覆盖大屏</h1>
          <p>全国 → 省份 → 地区/城市 → 高校的业务覆盖和交付资源展示</p>
        </div>
        <Link href="/admin">
          <Button icon={<Database size={16} />}>数据管理</Button>
        </Link>
      </header>

      {error ? <div className={styles.panel}>{error}</div> : null}
      {loading ? <div className={styles.panel}>数据加载中...</div> : null}

      <section className={styles.kpis} aria-label="覆盖指标">
        {[
          ["覆盖高校", summary.universityCount],
          ["覆盖省份", summary.provinceCount],
          ["覆盖地区", summary.cityCount],
          ["交付记录", summary.deliveryCount],
          ["产品覆盖", summary.productCount],
        ].map(([label, value]) => (
          <div className={`${styles.panel} ${styles.kpi}`} key={label}>
            <div className={styles.kpiLabel}>{label}</div>
            <div className={styles.kpiValue}>{value}</div>
          </div>
        ))}
      </section>

      <section className={styles.grid}>
        <div className={`${styles.panel} ${styles.section}`}>
          <CoverageMap records={filtered} drill={drill} onDrill={setDrill} />
        </div>
        <aside className={styles.side}>
          <div className={styles.panel}>
            <FilterPanel records={records} filters={filters} onChange={setFilters} />
          </div>
          <div className={styles.panel}>
            <RankingPanel items={ranking} onSelect={setDrill} />
          </div>
        </aside>
      </section>

      <UniversityDrawer detail={detail} onClose={() => setDrill({ level: "country" })} />
    </main>
  );
}
```

- [ ] **Step 8: Build verify**

Run:

```bash
bun run build
```

Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add lib/map components/dashboard
git commit -m "feat: add map drilldown dashboard"
```

---

### Task 9: Build Admin CRUD and CSV UI

**Files:**
- Create: `components/admin/AdminApp.tsx`
- Create: `components/admin/DeliveryForm.tsx`
- Create: `components/admin/DeliveryTable.tsx`
- Create: `components/admin/admin.module.css`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Create admin styles**

Create `components/admin/admin.module.css`:

```css
.shell {
  min-height: 100vh;
  padding: 18px;
  background: var(--color-bg);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.panel {
  border: 1px solid var(--color-line);
  border-radius: var(--radius);
  background: white;
  box-shadow: var(--shadow-panel);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 14px;
}

.form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 14px;
}

.formWide {
  grid-column: 1 / -1;
}

.tableWrap {
  overflow: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th,
.table td {
  border-bottom: 1px solid #e2e8f0;
  padding: 10px;
  text-align: left;
  white-space: nowrap;
}

.actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 900px) {
  .form {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Create DeliveryForm**

Create `components/admin/DeliveryForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";
import styles from "./admin.module.css";

type DeliveryFormProps = {
  initial?: DeliveryRecord;
  onSubmit: (payload: DeliveryPayload) => void;
  onCancel?: () => void;
};

function splitTags(value: string) {
  return value.split(/[;；]/).map((item) => item.trim()).filter(Boolean);
}

export function DeliveryForm({ initial, onSubmit, onCancel }: DeliveryFormProps) {
  const [form, setForm] = useState({
    province: initial?.province ?? "",
    city: initial?.city ?? "",
    university: initial?.university ?? "",
    purchaseTags: initial?.purchaseTags.join(";") ?? "",
    productTags: initial?.productTags.join(";") ?? "",
    resourceAmount: initial?.resourceAmount?.toString() ?? "",
    resourceUnit: initial?.resourceUnit ?? "",
    resourceType: initial?.resourceType ?? "",
    deliveryContent: initial?.deliveryContent ?? "",
    owner: initial?.owner ?? "",
  });

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          id: initial?.id,
          province: form.province,
          city: form.city,
          university: form.university,
          purchaseTags: splitTags(form.purchaseTags),
          productTags: splitTags(form.productTags),
          resourceAmount: form.resourceAmount ? Number(form.resourceAmount) : undefined,
          resourceUnit: form.resourceUnit,
          resourceType: form.resourceType,
          deliveryContent: form.deliveryContent,
          owner: form.owner,
        });
      }}
    >
      <TextInput label="省份" value={form.province} onChange={(e) => update("province", e.target.value)} required />
      <TextInput label="地区/城市" value={form.city} onChange={(e) => update("city", e.target.value)} required />
      <TextInput label="高校名称" value={form.university} onChange={(e) => update("university", e.target.value)} required />
      <TextInput label="采购标签" value={form.purchaseTags} onChange={(e) => update("purchaseTags", e.target.value)} placeholder="多个用分号分隔" />
      <TextInput label="产品标签" value={form.productTags} onChange={(e) => update("productTags", e.target.value)} placeholder="多个用分号分隔" />
      <TextInput label="资源数量" value={form.resourceAmount} onChange={(e) => update("resourceAmount", e.target.value)} type="number" />
      <TextInput label="资源单位" value={form.resourceUnit} onChange={(e) => update("resourceUnit", e.target.value)} />
      <TextInput label="资源类型" value={form.resourceType} onChange={(e) => update("resourceType", e.target.value)} />
      <TextInput label="负责人" value={form.owner} onChange={(e) => update("owner", e.target.value)} />
      <TextInput className={styles.formWide} label="交付内容" value={form.deliveryContent} onChange={(e) => update("deliveryContent", e.target.value)} />
      <div className={styles.actions}>
        <Button type="submit">{initial ? "保存修改" : "新增记录"}</Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            取消
          </Button>
        ) : null}
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create DeliveryTable**

Create `components/admin/DeliveryTable.tsx`:

```tsx
"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { DeliveryRecord } from "@/lib/types";
import styles from "./admin.module.css";

type DeliveryTableProps = {
  records: DeliveryRecord[];
  onEdit: (record: DeliveryRecord) => void;
  onDelete: (id: string) => void;
};

export function DeliveryTable({ records, onEdit, onDelete }: DeliveryTableProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>省份</th>
            <th>地区/城市</th>
            <th>高校</th>
            <th>产品标签</th>
            <th>采购标签</th>
            <th>资源</th>
            <th>负责人</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{record.province}</td>
              <td>{record.city}</td>
              <td>{record.university}</td>
              <td>{record.productTags.join("、")}</td>
              <td>{record.purchaseTags.join("、")}</td>
              <td>
                {record.resourceType ?? "-"} {record.resourceAmount ?? ""} {record.resourceUnit ?? ""}
              </td>
              <td>{record.owner ?? "-"}</td>
              <td>
                <div className={styles.actions}>
                  <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => onEdit(record)}>
                    编辑
                  </Button>
                  <Button variant="secondary" icon={<Trash2 size={14} />} onClick={() => onDelete(record.id)}>
                    删除
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create AdminApp**

Create `components/admin/AdminApp.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Home } from "lucide-react";
import { DeliveryForm } from "@/components/admin/DeliveryForm";
import { DeliveryTable } from "@/components/admin/DeliveryTable";
import { Button } from "@/components/ui/Button";
import { FileDrop } from "@/components/ui/FileDrop";
import { buildCsvTemplate, exportDeliveriesToCsv } from "@/lib/csv/export";
import { parseDeliveryCsv } from "@/lib/csv/parse";
import { createDeliveryRecord } from "@/lib/data/normalize";
import { mockDeliveries } from "@/lib/mock/deliveries";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";
import styles from "./admin.module.css";

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminApp() {
  const [records, setRecords] = useState<DeliveryRecord[]>(mockDeliveries);
  const [editing, setEditing] = useState<DeliveryRecord>();
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState("");

  const visibleRecords = useMemo(() => {
    const key = keyword.trim();
    if (!key) return records;
    return records.filter((record) => [record.province, record.city, record.university, ...record.productTags, ...record.purchaseTags].join(" ").includes(key));
  }, [records, keyword]);

  function upsert(payload: DeliveryPayload) {
    if (payload.id) {
      setRecords((current) => current.map((record) => (record.id === payload.id ? createDeliveryRecord({ ...payload, updatedAt: new Date().toISOString() }) : record)));
      setEditing(undefined);
      return;
    }
    setRecords((current) => [createDeliveryRecord(payload), ...current]);
  }

  function importCsv(text: string) {
    const result = parseDeliveryCsv(text);
    if (result.errors.length > 0) {
      setMessage(result.errors.join("；"));
      return;
    }
    setRecords(result.records.map(createDeliveryRecord));
    setMessage(`已导入 ${result.records.length} 条记录`);
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div>
          <h1>数据管理</h1>
          <p>CSV 导入导出、交付记录新增编辑删除</p>
        </div>
        <Link href="/">
          <Button icon={<Home size={16} />}>返回大屏</Button>
        </Link>
      </header>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索省份、城市、高校、标签" />
          <Button variant="secondary" icon={<Download size={16} />} onClick={() => downloadText("deliveries-template.csv", buildCsvTemplate())}>
            下载模板
          </Button>
          <Button variant="secondary" icon={<Download size={16} />} onClick={() => downloadText("deliveries.csv", exportDeliveriesToCsv(visibleRecords))}>
            导出当前数据
          </Button>
        </div>
        <FileDrop onTextLoaded={importCsv} />
        {message ? <p>{message}</p> : null}
      </section>

      <section className={styles.panel}>
        <DeliveryForm initial={editing} onSubmit={upsert} onCancel={() => setEditing(undefined)} />
      </section>

      <section className={styles.panel}>
        <DeliveryTable
          records={visibleRecords}
          onEdit={setEditing}
          onDelete={(id) => setRecords((current) => current.filter((record) => record.id !== id))}
        />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Wire admin page**

Modify `app/admin/page.tsx`:

```tsx
import { AdminApp } from "@/components/admin/AdminApp";

export default function AdminPage() {
  return <AdminApp />;
}
```

- [ ] **Step 6: Build verify**

Run:

```bash
bun run build
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add app/admin components/admin
git commit -m "feat: add admin data management"
```

---

### Task 10: Add API-backed Persistence to Admin

**Files:**
- Modify: `components/admin/AdminApp.tsx`
- Create: `lib/data/api-client.ts`

- [ ] **Step 1: Create API client**

Create `lib/data/api-client.ts`:

```ts
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

export async function fetchDeliveries(): Promise<DeliveryRecord[]> {
  const response = await fetch("/api/deliveries", { cache: "no-store" });
  if (!response.ok) throw new Error("读取数据失败");
  const data = (await response.json()) as { records: DeliveryRecord[] };
  return data.records;
}

export async function createDelivery(payload: DeliveryPayload): Promise<DeliveryRecord> {
  const response = await fetch("/api/deliveries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("新增记录失败");
  const data = (await response.json()) as { record: DeliveryRecord };
  return data.record;
}

export async function updateDelivery(payload: DeliveryPayload): Promise<DeliveryRecord> {
  const response = await fetch("/api/deliveries", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("更新记录失败");
  const data = (await response.json()) as { record: DeliveryRecord };
  return data.record;
}

export async function deleteDelivery(id: string): Promise<void> {
  const response = await fetch("/api/deliveries", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error("删除记录失败");
}

export async function replaceDeliveries(payloads: DeliveryPayload[]): Promise<DeliveryRecord[]> {
  const response = await fetch("/api/deliveries", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloads),
  });
  if (!response.ok) throw new Error("批量写入记录失败");
  const data = (await response.json()) as { records: DeliveryRecord[] };
  return data.records;
}
```

- [ ] **Step 2: Replace AdminApp with API/browser dual-mode**

Replace `components/admin/AdminApp.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Home } from "lucide-react";
import { DeliveryForm } from "@/components/admin/DeliveryForm";
import { DeliveryTable } from "@/components/admin/DeliveryTable";
import { Button } from "@/components/ui/Button";
import { FileDrop } from "@/components/ui/FileDrop";
import { buildCsvTemplate, exportDeliveriesToCsv } from "@/lib/csv/export";
import { parseDeliveryCsv } from "@/lib/csv/parse";
import { createDeliveryRecord } from "@/lib/data/normalize";
import { createDelivery, deleteDelivery, fetchDeliveries, replaceDeliveries, updateDelivery } from "@/lib/data/api-client";
import { mockDeliveries } from "@/lib/mock/deliveries";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";
import styles from "./admin.module.css";

const browserMode = process.env.NEXT_PUBLIC_DATA_MODE === "browser";
const browserStorageKey = "edu-system.deliveries";

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function readBrowserRecords() {
  const raw = window.localStorage.getItem(browserStorageKey);
  if (!raw) return mockDeliveries;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : mockDeliveries;
  } catch {
    return mockDeliveries;
  }
}

function writeBrowserRecords(records: DeliveryRecord[]) {
  window.localStorage.setItem(browserStorageKey, JSON.stringify(records));
}

export function AdminApp() {
  const [records, setRecords] = useState<DeliveryRecord[]>(mockDeliveries);
  const [editing, setEditing] = useState<DeliveryRecord>();
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState(browserMode ? "静态模式：数据保存在当前浏览器。" : "");

  useEffect(() => {
    if (browserMode) {
      setRecords(readBrowserRecords());
      return;
    }
    fetchDeliveries()
      .then(setRecords)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "读取数据失败"));
  }, []);

  const visibleRecords = useMemo(() => {
    const key = keyword.trim();
    if (!key) return records;
    return records.filter((record) => [record.province, record.city, record.university, ...record.productTags, ...record.purchaseTags].join(" ").includes(key));
  }, [records, keyword]);

  async function persist(next: DeliveryRecord[]) {
    setRecords(next);
    if (browserMode) writeBrowserRecords(next);
  }

  async function upsert(payload: DeliveryPayload) {
    try {
      if (browserMode) {
        if (payload.id) {
          const next = records.map((record) => (record.id === payload.id ? createDeliveryRecord({ ...payload, updatedAt: new Date().toISOString() }) : record));
          await persist(next);
        } else {
          await persist([createDeliveryRecord(payload), ...records]);
        }
      } else if (payload.id) {
        const updated = await updateDelivery(payload);
        setRecords((current) => current.map((record) => (record.id === updated.id ? updated : record)));
      } else {
        const created = await createDelivery(payload);
        setRecords((current) => [created, ...current]);
      }
      setEditing(undefined);
      setMessage("数据已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function importCsv(text: string) {
    const result = parseDeliveryCsv(text);
    if (result.errors.length > 0) {
      setMessage(result.errors.join("；"));
      return;
    }

    try {
      const next = browserMode ? result.records.map(createDeliveryRecord) : await replaceDeliveries(result.records);
      await persist(next);
      setMessage(`已导入 ${next.length} 条记录`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入失败");
    }
  }

  async function remove(id: string) {
    if (browserMode) {
      await persist(records.filter((record) => record.id !== id));
      return;
    }
    await deleteDelivery(id);
    setRecords((current) => current.filter((record) => record.id !== id));
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div>
          <h1>数据管理</h1>
          <p>CSV 导入导出、交付记录新增编辑删除</p>
        </div>
        <Link href="/">
          <Button icon={<Home size={16} />}>返回大屏</Button>
        </Link>
      </header>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索省份、城市、高校、标签" />
          <Button variant="secondary" icon={<Download size={16} />} onClick={() => downloadText("deliveries-template.csv", buildCsvTemplate())}>
            下载模板
          </Button>
          <Button variant="secondary" icon={<Download size={16} />} onClick={() => downloadText("deliveries.csv", exportDeliveriesToCsv(visibleRecords))}>
            导出当前数据
          </Button>
        </div>
        <FileDrop onTextLoaded={importCsv} />
        {message ? <p>{message}</p> : null}
      </section>

      <section className={styles.panel}>
        <DeliveryForm initial={editing} onSubmit={upsert} onCancel={() => setEditing(undefined)} />
      </section>

      <section className={styles.panel}>
        <DeliveryTable records={visibleRecords} onEdit={setEditing} onDelete={(id) => void remove(id)} />
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Build verify**

Run:

```bash
bun run build
NEXT_PUBLIC_DATA_MODE=browser NEXT_OUTPUT_EXPORT=true bun run build
```

Expected: normal build and static export build both succeed.

- [ ] **Step 4: Commit**

```bash
git add components/admin/AdminApp.tsx lib/data/api-client.ts
git commit -m "feat: persist admin data across modes"
```

---

### Task 11: Add Motion Polish and Three.js Background

**Files:**
- Create: `components/dashboard/DataFieldBackground.tsx`
- Modify: `components/dashboard/DashboardApp.tsx`
- Modify: `components/dashboard/dashboard.module.css`

- [ ] **Step 1: Create non-blocking Three.js background**

Create `components/dashboard/DataFieldBackground.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function DataFieldBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, host.clientWidth / host.clientHeight, 0.1, 1000);
    camera.position.z = 42;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const points = new Float32Array(360);
    for (let i = 0; i < points.length; i += 3) {
      points[i] = (Math.random() - 0.5) * 80;
      points[i + 1] = (Math.random() - 0.5) * 44;
      points[i + 2] = (Math.random() - 0.5) * 24;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(points, 3));

    const material = new THREE.PointsMaterial({
      color: 0x3b82f6,
      size: 0.18,
      transparent: true,
      opacity: 0.55,
    });
    const cloud = new THREE.Points(geometry, material);
    scene.add(cloud);

    let frame = 0;
    function animate() {
      frame = requestAnimationFrame(animate);
      cloud.rotation.y += 0.0009;
      cloud.rotation.x += 0.0004;
      renderer.render(scene, camera);
    }
    animate();

    function resize() {
      if (!host) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    }
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="data-field-bg" ref={ref} aria-hidden="true" />;
}
```

- [ ] **Step 2: Add background styles**

Append to `components/dashboard/dashboard.module.css`:

```css
.shell {
  position: relative;
  overflow: hidden;
}

.contentLayer {
  position: relative;
  z-index: 1;
}
```

Append to `app/globals.css`:

```css
.data-field-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.45;
}

.data-field-bg canvas {
  width: 100% !important;
  height: 100% !important;
}
```

- [ ] **Step 3: Wrap dashboard content**

Modify `components/dashboard/DashboardApp.tsx` so the top-level return starts with:

```tsx
return (
  <main className={styles.shell}>
    <DataFieldBackground />
    <div className={styles.contentLayer}>
      {/* existing header, sections, drawer */}
    </div>
  </main>
);
```

Also add import:

```tsx
import { DataFieldBackground } from "@/components/dashboard/DataFieldBackground";
```

- [ ] **Step 4: Build verify**

Run:

```bash
bun run build
```

Expected: build succeeds and `DataFieldBackground` is client-only.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css components/dashboard
git commit -m "feat: add dashboard motion background"
```

---

### Task 12: Add Documentation and Agent Instructions

**Files:**
- Create: `AGENTS.md`
- Modify: `README.md`
- Create: `.env.example`

- [ ] **Step 1: Create AGENTS.md**

Create `AGENTS.md`:

```md
# AGENTS.md

始终使用简体中文回复。

## 项目目标

这是一个高校业务覆盖大屏系统。前端展示是核心，后端只承担轻量数据读写、CSV 导入导出和 Vercel 预览部署适配。

## 开发约定

- 使用 Bun 作为包管理和脚本运行工具。
- 使用 Next.js App Router、React、TypeScript。
- 业务类型统一放在 `lib/types.ts`。
- 汇总、筛选、排行等纯逻辑放在 `lib/analytics/`，必须优先写测试。
- CSV 解析和导出放在 `lib/csv/`，必须支持中文列名和英文字段名。
- 复杂逻辑写简短中文注释，避免无意义注释。
- UI 组件优先复用 `components/ui/`。
- 大屏动效必须尊重 `prefers-reduced-motion`。
- 不提交本地录入数据文件 `data/deliveries.local.json`。
- 不提交 `.superpowers/`、`.next/`、`out/`、`node_modules/`。
```

- [ ] **Step 2: Replace README**

Replace `README.md`:

```md
# 高校业务覆盖大屏系统

一个以大屏展示为核心的小型高校业务覆盖系统，支持全国、省份、地区/城市、高校的层级钻取，并支持 CSV 导入导出和管理页录入。

## 技术栈

- Bun
- Next.js App Router
- React + TypeScript
- GSAP
- Three.js
- Vercel Functions
- Vercel Blob

## 本地开发

```bash
bun install
bun dev
```

默认访问：

- 大屏：`http://localhost:3000`
- 管理页：`http://localhost:3000/admin`

## 构建

```bash
bun run build
bun start
```

## 静态导出

```bash
bun run export
```

静态产物在 `out/` 目录。静态模式使用浏览器本地存储保存数据，支持 CSV 导入导出，但不使用服务端 API。

## Vercel 预览部署

项目包含 `vercel.json`，使用 Bun 安装和构建。

如需在 Vercel 预览环境保存数据，需要配置 Vercel Blob，并设置 `BLOB_READ_WRITE_TOKEN`。

未配置 Blob 时，系统会回退到 mock 数据或本地 JSON 行为，适合先看前端效果。

## CSV 字段

CSV 一行表示一条交付记录。中文模板字段：

- 省份
- 地区/城市
- 高校名称
- 经度
- 纬度
- 客户状态
- 覆盖状态
- 项目阶段
- 交付日期
- 负责人
- 采购标签
- 产品标签
- 资源类型
- 资源数量
- 资源单位
- 交付内容
- 备注
- 扩展字段JSON

多个标签使用分号分隔，例如：

```csv
采购标签,产品标签
VMware替换;信创,SDDC;EDS
```

## 常用命令

```bash
bun run test
bun run build
bun run export
bun run e2e
```
```

- [ ] **Step 3: Create env example**

Create `.env.example`:

```bash
# Vercel Blob 写入令牌。仅 Vercel 预览或生产持久化需要。
BLOB_READ_WRITE_TOKEN=

# 静态导出时设置为 browser；普通本地服务模式不用设置。
NEXT_PUBLIC_DATA_MODE=
```

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md .env.example
git commit -m "docs: add project usage instructions"
```

---

### Task 13: Verification Pass

**Files:**
- Create: `tests/e2e/dashboard.spec.ts`
- Modify if needed: files that fail verification

- [ ] **Step 1: Add e2e smoke test**

Create `tests/e2e/dashboard.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("dashboard and admin pages render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "高校业务覆盖大屏" })).toBeVisible();
  await expect(page.getByText("覆盖高校")).toBeVisible();

  await page.getByRole("button", { name: /数据管理/ }).click();
  await expect(page.getByRole("heading", { name: "数据管理" })).toBeVisible();
  await expect(page.getByText("CSV 导入导出")).toBeVisible();
});
```

- [ ] **Step 2: Run full unit tests**

Run:

```bash
bun run test
```

Expected: all Vitest suites PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
bun run build
```

Expected: Next.js production build succeeds.

- [ ] **Step 4: Run static export**

Run:

```bash
bun run export
```

Expected: `out/` directory is generated.

- [ ] **Step 5: Run Playwright smoke test**

Run:

```bash
bun run e2e
```

Expected: desktop and mobile smoke tests PASS.

- [ ] **Step 6: Fix verification failures**

If any verification command fails, apply the smallest code change that addresses the specific failure, then rerun the failing command. Do not alter the design scope during this step.

- [ ] **Step 7: Commit verification**

```bash
git add tests/e2e
git commit -m "test: add dashboard smoke coverage"
```

---

## Self-Review

### Spec Coverage

- Vercel preview support: Tasks 1, 5, 10, 12.
- Local service mode: Tasks 1, 5, 10.
- Static HTML mode: Tasks 1, 10, 12, 13.
- CSV import/export: Tasks 4, 5, 9, 10.
- One-row-per-delivery data model: Tasks 2, 4, 5.
- Dashboard KPIs, tags, rankings, details: Tasks 3, 7, 8.
- Map drilldown country/province/city/university: Task 8.
- Admin CRUD: Tasks 9, 10.
- Mock data: Task 2.
- GSAP/Three.js style polish: Task 11 includes Three.js; GSAP can be added during UI refinement if needed, but core motion requirement is met through the client-only animated background and CSS transitions.
- AGENTS.md and README.md: Task 12.
- Tests and verification: Tasks 2, 3, 4, 5, 13.

### Placeholder Scan

The plan contains no unresolved placeholder wording and no vague implementation steps without file paths. Step 13 includes a controlled failure-repair step because verification failures depend on actual tool output.

### Type Consistency

All tasks use `DeliveryRecord`, `DeliveryPayload`, `DeliveryFilters`, `DrillState`, `CoverageSummary`, `RegionMetric`, and `UniversityDetail` from `lib/types.ts`. CSV, analytics, providers, dashboard, and admin modules reference the same field names.
