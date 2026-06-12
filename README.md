# 高校产品案例覆盖可视化系统

一个面向高校业务覆盖展示的小型前端系统。首页用于大屏查看全国高校案例覆盖，管理页用于录入和维护交付数据，适合 Vercel 预览和服务端数据托管。

## 当前功能

- 首页 `/`：ECharts 中国地图展示全国高校覆盖，支持按产品标签和采购标签筛选，并提供进入录入页入口。
- 地图交互：保留全国省份覆盖视图，点击省份后查看该省覆盖、高校分母和高校案例，不再展示市级下钻。
- 案例详情：高校卡片聚合展示产品标签、设备清单和业务痛点。
- 管理页 `/admin`：按 `data/高校信息维护清单-模板.xlsx` 表头新增和编辑高校信息记录，支持搜索过滤、批量删除、XLSX 导入、XLSX 导出和 XLSX 模板下载。
- 服务端闭环：管理页新增、编辑、导入、删除会通过 `/api/deliveries` 写入服务端数据源，首页读取同一份服务端数据。
- 动效：GSAP 页面入场和卡片动效、ECharts 地图过渡、地图扫描线与覆盖点脉冲效果。

## 技术栈

- Bun：依赖安装、脚本运行和测试入口。
- Next.js App Router + React + TypeScript：页面、API routes 和构建。
- ECharts + `china-map-echarts`：中国省份覆盖热力展示。
- GSAP：大屏入场和列表切换动画。
- XLSX：Excel 模板解析、导入和导出；PapaParse 保留用于历史 CSV 兼容。
- SQLite：本地部署和 Docker 默认数据源，数据库文件可通过目录挂载持久化。
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

### Docker 本地部署（默认 SQLite）

Docker 镜像默认使用 SQLite，不需要额外配置数据库路径；容器内固定写入 `/app/data/deliveries.sqlite`。服务默认监听 `3000` 端口，对外暴露 `http://localhost:3000`。

```bash
docker compose pull
docker compose up -d
```

默认 compose 配置会把宿主机 `./data` 挂载到容器 `/app/data`，所以 SQLite 文件会保存在：

```text
data/deliveries.sqlite
```

如果需要自己构建并上传镜像，先执行：

```bash
bun run docker:build
bun run docker:push
```

默认镜像名是 `feeeng/edu-system:latest`。也可以指定标签：

```bash
sh scripts/docker-build-push.sh --tag v1.0.0 --push
```

不使用 compose 时，可以直接运行镜像：

```bash
docker run -d \
  --name edu-system \
  -p 3000:3000 \
  -e ADMIN_API_TOKEN=你的管理密码 \
  -v "$PWD/data:/app/data" \
  feeeng/edu-system:latest
```

Docker 镜像内置：

```bash
DATA_STORE=sqlite
SQLITE_DB_PATH=/app/data/deliveries.sqlite
PORT=3000
```

因此本地 Docker 部署只需要关注管理密码和数据目录挂载。`docker-compose.yml` 为方便首次启动提供了默认 `ADMIN_API_TOKEN=admin123`，正式使用时建议在 shell 或 `.env` 中覆盖。

### SQLite 本地服务模式

不使用 Docker 时，也可以在本机 Next 服务里启用 SQLite：

```bash
DATA_STORE=sqlite
ADMIN_API_TOKEN=你的管理密码
bun dev
```

本机不配置 `SQLITE_DB_PATH` 时，默认使用 `data/deliveries.sqlite`。如果需要自定义路径，可以设置 `SQLITE_DB_PATH`，但 Docker 部署不需要配置它。

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

`ADMIN_API_TOKEN` 用来保护新增、删除、批量替换和导出等管理接口。部署到 Vercel 或生产环境时必须配置；进入 `/admin` 页面后输入这串密码，服务端验证通过后会写入 HttpOnly Cookie，后续管理操作会自动带上同域会话。

在 GitHub Actions 里使用 GitHub Variables 时，需要把 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 传给 Vercel 部署命令或 Vercel 项目环境变量；只创建 GitHub Variables 但没有注入运行时，Next.js 服务端读取不到这些值。

如果通过 Vercel Git 集成部署，请直接在 Vercel Project Settings -> Environment Variables 中配置同名变量。

首次接入 Supabase 时，需要先在 Supabase SQL Editor 里执行 [supabase/schema.sql](/root/zjf/edu-system/supabase/schema.sql)。如果接口返回 `PGRST205` 或提示找不到 `public.deliveries`，说明这张表还没有创建，或刚建完后 Supabase REST schema cache 还没刷新。

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

因为当前按你的变量使用 `publishable key`，Supabase 侧需要给 `anon` 角色配置 `deliveries` 表的读写策略。管理入口仍由本项目的 `ADMIN_API_TOKEN` 保护，浏览器不会直接请求 Supabase，也不需要把管理密码暴露给浏览器或写入浏览器存储。

## XLSX 字段

管理页导入、导出和模板下载使用 `data/高校信息维护清单-模板.xlsx` 的字段结构。常用字段包括：

- 学校ID、省份、高校名称、覆盖状态
- 客户现状、采购时间（年份）、产品标签
- 资源类型（SDDC/EDS/aDesk/AIBuilder）、资源规模、资源单位
- 业务场景、核心价值点、设备型号、中标链接、备注、扩展字段JSON

多值字段使用英文或中文分号分隔。资源类型会同步生成首页产品筛选所需的产品标签。

## 开发说明

- 前端代码采用 TypeScript 和 ES6 风格。
- 组件保持复用：地图、仪表盘、数据录入、Excel/CSV、数据 Provider 分层放置。
- 复杂逻辑使用中文注释说明原因，避免重复解释简单赋值。
- 可视化调整后建议至少运行 `bun run e2e`，并用 Playwright 截图检查桌面和移动端地图是否非空、文字是否遮挡。
