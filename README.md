# 高校业务覆盖可视化系统

这是一个用于高校业务覆盖展示和交付数据管理的 Next.js 项目。当前版本提供交付记录的数据类型、mock 数据、统计分析、CSV 导入导出、数据 Provider、本地 JSON/Vercel Blob 持久化和 API routes；大屏和管理 UI 会在后续任务继续完善。

## 技术栈

- Bun：依赖安装、脚本运行和测试入口。
- Next.js App Router + React + TypeScript：页面、API routes 和构建。
- Vitest：核心数据、CSV、Provider 和 API handler 单元测试。
- Vercel Blob：Vercel/API 模式下保存交付数据 JSON。
- PapaParse：CSV 解析和导出。

## 常用命令

```bash
bun install
bun dev
bun run test
bun run lint
bun run build
bun run export
```

- `bun dev`：启动本地开发服务。
- `bun run test`：运行 Vitest 单元测试。
- `bun run lint`：运行 ESLint。
- `bun run build`：普通 Next 构建，包含动态 API routes。
- `bun run export`：静态导出模式，输出到 `out/`。

## 数据存储模式

### 本地服务模式

本地 `bun dev` / `bun run build` 后运行服务时，API 默认使用本地 JSON 文件：

```text
data/deliveries.local.json
```

如果本地文件不存在，系统会回退到 `lib/mock/deliveries.ts` 中的 mock 数据。文件存在但 JSON 损坏或内容不是数组时会抛出错误，避免把损坏数据静默覆盖成 mock 数据。

### Vercel Blob 模式

在 Vercel 环境中配置 `BLOB_READ_WRITE_TOKEN` 后，API 会使用 Vercel Blob 的固定 key 保存全量交付记录：

```text
edu-system/deliveries.json
```

Blob 写入使用固定路径覆盖写，并设置 JSON 内容类型。Vercel 环境缺少 `BLOB_READ_WRITE_TOKEN` 时会报配置错误，不会退回本地文件写入。

### 静态导出模式

`bun run export` 会使用浏览器本地数据模式，静态产物不包含 `/api/*`。这是设计预期：静态 HTML 部署没有服务端持久化，后续 UI 会通过 browser provider 和 `localStorage` 管理当前浏览器内的数据。

导出脚本会在构建期间临时排除 `app/api`，构建结束后恢复源码目录。
