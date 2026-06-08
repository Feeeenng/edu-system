# 高校产品案例覆盖可视化系统

一个面向高校业务覆盖展示的小型前端系统。首页用于大屏查看全国高校案例覆盖，管理页用于录入和维护交付数据，适合 Vercel 预览和服务端数据托管。

## 当前功能

- 首页 `/`：ECharts 中国地图展示全国高校覆盖，支持按产品标签和采购标签筛选，并提供 CSV 导入入口。
- 地图交互：支持全国 -> 省份 -> 城市下钻，点击省份、市级列表后查看对应地区覆盖、高校分母和高校案例。
- 案例详情：高校卡片聚合展示产品标签、设备清单和业务痛点。
- 管理页 `/admin`：表格化新增和编辑交付记录，支持搜索过滤、批量删除、CSV 导入、CSV 导出和 CSV 模板下载。
- 服务端闭环：管理页新增、编辑、导入、删除会通过 `/api/deliveries` 写入 Supabase，首页读取同一份服务端数据。
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
- `bun run export`：静态导出模式，输出到 `out/`，只适合查看静态资源；真实数据读写需要 Next/Vercel API 环境。
- `bun run e2e`：运行 Playwright 桌面、大屏和移动端端到端测试，默认使用 `3107` 专用端口避免复用旧开发服务。

本地直接打开 HTML 时，请打开 `out/index.html` 或 `out/admin/index.html`，并保留整个 `out/` 目录结构；页面资源会从同级或上级的 `_next/` 目录按相对路径加载。由于当前不再使用浏览器本地存储，静态 HTML 无法完成数据录入、导入和删除，真实数据维护请使用 `bun dev` 或 Vercel 部署地址。

## 数据模式

### Supabase 服务端模式

前端统一通过 `/api/deliveries` 读写数据，不再使用 `localStorage` 保存交付记录。服务端检测到下面两个 Supabase 变量后会自动启用 Supabase：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的 publishable key
```

可以显式配置 `DATA_STORE=supabase`，但不是必须；只要 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 存在，服务端就会优先使用 Supabase。

```bash
DATA_STORE=supabase
ADMIN_API_TOKEN=管理接口访问令牌
```

`ADMIN_API_TOKEN` 用来保护新增、删除、批量替换和导出等管理接口。部署到 Vercel 或生产环境时建议配置；如果配置了它，浏览器写接口需要带同一个 token。

在 GitHub Actions 里使用 GitHub Variables 时，需要把 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 传给 Vercel 部署命令或 Vercel 项目环境变量；只创建 GitHub Variables 但没有注入运行时，Next.js 服务端读取不到这些值。

如果通过 Vercel Git 集成部署，请直接在 Vercel Project Settings -> Environment Variables 中配置同名变量。

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

因为当前按你的变量使用 `publishable key`，Supabase 侧需要给 `anon` 角色配置 `deliveries` 表的读写策略。管理入口仍由本项目的 `ADMIN_API_TOKEN` 保护，浏览器不会直接请求 Supabase。

如果启用了 `ADMIN_API_TOKEN`，可以通过 `NEXT_PUBLIC_ADMIN_API_TOKEN` 注入，也可以在浏览器控制台临时设置：

```js
sessionStorage.setItem("edu-system.admin-token", "你的 ADMIN_API_TOKEN");
```

更推荐只在可信预览环境使用 `NEXT_PUBLIC_ADMIN_API_TOKEN`；公开生产环境不要把管理 token 暴露给普通访客。

## CSV 字段

CSV 解析逻辑在 `lib/csv/schema.ts` 和 `lib/csv/parse.ts`。初版字段按当前业务覆盖场景设计，常用字段包括：

- 省份、城市、高校名称
- 产品标签：如 `SDDC;EDS;桌面云`
- 采购标签：如 `VMware替换;信创;AI超融合`
- 省份高校总数、城市高校总数：用于地图展示 `已覆盖高校 / 区域高校总数`
- 设备明细：如 `超融合节点x3;EDS存储节点x2`
- 业务痛点
- 交付内容

多值字段使用英文或中文分号分隔。

## 开发说明

- 前端代码采用 TypeScript 和 ES6 风格。
- 组件保持复用：地图、仪表盘、数据录入、CSV、数据 Provider 分层放置。
- 复杂逻辑使用中文注释说明原因，避免重复解释简单赋值。
- 可视化调整后建议至少运行 `bun run e2e`，并用 Playwright 截图检查桌面和移动端地图是否非空、文字是否遮挡。
