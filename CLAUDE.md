# 项目开发指南

本文件是本项目技术栈、目录职责与开发方式的统一入口。开始任何任务前必须阅读本文件；执行和提交规则以根目录 `AGENTS.md` 为准，视觉规范以 `DESIGN.md` 为准。

## 1. 当前阶段与范围

项目当前处于后台管理系统第一版重构阶段。首个落地业务域为“高校信息维护”：管理高校交付、覆盖、资源与设备信息，并同步供首页覆盖大屏读取。

- 后台入口：`/admin`，以左侧菜单切换业务模块；当前只实现“高校管理 / 高校信息维护”。
- 首页入口：`/`，读取同一份高校交付数据。
- 旧页面结构和旧数据不作为兼容目标；新需求确认后可按新领域模型重构。
- 未实现的侧栏菜单只作为信息架构占位，不得伪造可用业务功能。

## 2. 技术栈

- 应用框架：Next.js 15 App Router、React 19、TypeScript。
- UI：Ant Design 6 与 `@ant-design/icons`，后台界面必须优先使用其 Layout、Menu、Table、Form、Drawer、Modal、Statistic 等组件。
- 图表：首页使用 ECharts 与 `china-map-echarts`；动效使用 GSAP。
- 数据交换：Next Route Handlers（`app/api/**/route.ts`），JSON 和 XLSX（`xlsx`）。
- 数据层：本地 JSON / SQLite、Supabase PostgreSQL 或 Vercel Blob 由 `lib/data/server-store.ts` 统一选择。
- 部署：Docker、Vercel；时区统一为 `Asia/Shanghai`。

当前仓库不包含 Python、FastAPI、Tauri、Rust、Celery 或 Redis 服务。未经明确需求，不得依据过时设想引入这些技术或依赖。

## 3. 目录与依赖方向

```text
app/                         Next 页面、全局样式与 Route Handlers
components/<domain>/         领域界面组件与页面专属样式
lib/data/                    服务端存储、客户端 Provider、数据规范化与校验
lib/analytics/               首页统计与筛选纯逻辑
lib/excel/                   Excel 模板、解析与导出
lib/types.ts                 领域数据契约
docs/                        业务和部署说明
```

依赖方向固定为：`app` / `components` -> `lib`。页面负责组合和路由，不得直接读写数据源；客户端必须通过 `lib/data/client-provider.ts` 调用 `/api/deliveries`。Route Handler 负责认证、参数读取与响应，存储细节只放在 `lib/data`。

## 4. 前端约定

- 使用 React 函数组件与 Hooks；项目模块一律使用 `@/` 路径别名导入。
- 新增后台 UI 前先阅读 `DESIGN.md`。Ant Design 为后台唯一基础 UI 库，不手写已有的表格、表单、抽屉、弹窗、菜单、分页或提示组件。
- 页面专属组件、类型和样式放在对应业务目录；仅有多个真实消费者时才进入公共目录。
- API 契约与展示字段不同，应在数据适配层显式映射，避免在 JSX 中拼接业务规则。
- 业务数据加载、空数据、错误、受限权限和提交中状态必须可见；后台表格在窄屏下允许横向滚动，不得挤压列内容。
- 后端返回 `YYYY-MM-DD HH:mm:ss` 时，按中国标准时间直接显示，不再由浏览器转换时区。

## 5. 数据与接口约定

- `DeliveryRecord` / `DeliveryPayload` 是当前高校信息维护领域契约，定义在 `lib/types.ts`。
- `GET /api/deliveries` 读取记录；写操作由 `ADMIN_API_TOKEN` 会话保护。
- 管理会话由 `GET|POST|DELETE /api/admin/session` 管理；Cookie 必须保持 HttpOnly，密码不进入 localStorage。
- 所有写入先通过 `lib/data/validation.ts` 校验，再经 `lib/data/normalize.ts` 规范化。
- 数据库或数据源重构时，先确定新的领域契约、迁移边界和 API 兼容策略；当前阶段不为旧数据保留隐式转换。

## 6. 本地开发与验证

依赖和命令以 `package.json` 为准：

```bash
bun install
bun dev
bun run lint
bun run test
bun run build
bun run e2e
```

默认开发地址是 `http://localhost:3000`。是否执行 lint、测试、构建和端到端测试必须遵循 `AGENTS.md` 的授权规则；未运行时须如实说明。

## 7. 文档同步

下列变化必须在同一次修改中同步文档：

- UI 体系、后台信息架构或页面状态变化：更新 `DESIGN.md`。
- 技术栈、目录职责、接口边界或开发命令变化：更新本文件。
- 部署方式、环境变量或用户可用功能变化：更新 `README.md`。
