# 高校产品案例覆盖可视化系统

一个面向高校业务覆盖展示的小型前端系统。首页用于大屏查看全国高校案例覆盖，管理页用于录入和维护交付数据，适合 Vercel 预览和本地静态导出。

## 当前功能

- 首页 `/`：ECharts 中国地图展示全国高校覆盖，支持按 `SDDC`、`EDS`、`桌面云`、`FastGPT` 产品标签筛选，并提供 CSV 导入入口。
- 地图交互：支持全国 -> 省份 -> 城市下钻，点击省份、市级列表后查看对应地区覆盖和高校案例。
- 案例详情：高校卡片聚合展示产品标签、设备清单和业务痛点。
- 管理页 `/admin`：表格化新增交付记录，支持搜索过滤、批量删除、CSV 导入、CSV 导出和 CSV 模板下载。
- 本地闭环：管理页新增/导入会写入浏览器 `localStorage`，首页刷新后会读取同一份本地数据。
- 动效：GSAP 页面入场和卡片动效、ECharts 地图过渡、地图扫描线与覆盖点脉冲效果。

## 技术栈

- Bun：依赖安装、脚本运行和测试入口。
- Next.js App Router + React + TypeScript：页面、API routes 和构建。
- ECharts + `china-map-echarts`：中国地图与省份覆盖热力展示。
- GSAP：大屏入场和列表切换动画。
- PapaParse：CSV 解析与导出。
- Vitest + Playwright：单元测试和端到端测试。

## 常用命令

```bash
bun install
bun dev
bun run lint
bun run test
bun run build
bun run export
bun run e2e
```

- `bun dev`：启动本地开发服务，默认地址 `http://localhost:3000`。
- `bun run test`：运行 Vitest 单元测试。
- `bun run lint`：运行 ESLint。
- `bun run build`：普通 Next 构建，包含动态 API routes。
- `bun run export`：静态导出模式，输出到 `out/`，可用于本地 HTML/静态托管。
- `bun run e2e`：运行 Playwright 桌面、大屏和移动端端到端测试，默认使用 `3107` 专用端口避免复用旧开发服务。

本地直接打开 HTML 时，请打开 `out/index.html` 或 `out/admin/index.html`，并保留整个 `out/` 目录结构；页面资源会从同级或上级的 `_next/` 目录按相对路径加载。

## 数据模式

### 浏览器本地模式

前端页面默认优先使用浏览器本地数据源：

```text
localStorage: edu-system.deliveries
```

首次打开时不会内置演示数据。管理页新增、首页导入或 CSV 导入后，会写入同一个 key；首页刷新后即可展示真实记录。这个模式适合静态导出、本地演示和 Vercel 预览。

### API / Supabase / Vercel 模式

项目保留 `/api/deliveries`、导入、导出等接口，以及本地 JSON、Vercel Blob、Supabase Provider。默认 UI 使用浏览器本地模式；如果需要多端共享数据，可切到 API 模式。

- 本地服务端 JSON：`data/deliveries.local.json`
- Vercel Blob key：`edu-system/deliveries.json`
- 写接口可通过 `ADMIN_API_TOKEN` 做保护。

前端切 API：

```bash
NEXT_PUBLIC_DATA_MODE=api
```

Supabase 服务端存储：

```bash
DATA_STORE=supabase
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SERVICE_ROLE_KEY=你的 service role key
ADMIN_API_TOKEN=管理接口访问令牌
```

在 GitHub Actions 或 Vercel 里把这些值配置到 Secrets/Environment Variables 即可。`SUPABASE_SERVICE_ROLE_KEY` 只能放服务端环境变量，不要配置成 `NEXT_PUBLIC_`。

如果通过 GitHub Actions 部署，请把这些 Secrets 注入到部署环境；只放在 GitHub Secrets 里但没有传给 Vercel/运行时，Next.js 服务端读取不到这些变量。

Supabase 建表 SQL：

```sql
create table if not exists public.deliveries (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null
);

create index if not exists deliveries_updated_at_idx
  on public.deliveries (updated_at desc);
```

如果启用了 `ADMIN_API_TOKEN`，浏览器写接口需要提供同一个 token。可以通过 `NEXT_PUBLIC_ADMIN_API_TOKEN` 注入，也可以在浏览器控制台临时设置：

```js
sessionStorage.setItem("edu-system.admin-token", "你的 ADMIN_API_TOKEN");
```

更推荐只在可信预览环境使用写接口；纯本地 HTML 使用不需要任何 token。

## CSV 字段

CSV 解析逻辑在 `lib/csv/schema.ts` 和 `lib/csv/parse.ts`。初版字段按当前业务覆盖场景设计，常用字段包括：

- 省份、城市、高校名称
- 产品标签：如 `SDDC;EDS;桌面云`
- 采购标签：如 `VMware替换;信创;AI超融合`
- 设备明细：如 `超融合节点x3;EDS存储节点x2`
- 业务痛点
- 交付内容

多值字段使用英文或中文分号分隔。

## 开发说明

- 前端代码采用 TypeScript 和 ES6 风格。
- 组件保持复用：地图、仪表盘、数据录入、CSV、数据 Provider 分层放置。
- 复杂逻辑使用中文注释说明原因，避免重复解释简单赋值。
- 可视化调整后建议至少运行 `bun run e2e`，并用 Playwright 截图检查桌面和移动端地图是否非空、文字是否遮挡。
