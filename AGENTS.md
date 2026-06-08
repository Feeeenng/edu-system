# AGENTS.md

## 响应语言

始终使用简体中文回复。

## 项目目标

这是一个高校产品案例覆盖可视化系统，核心是前端大屏和数据录入：

- 首页展示全国高校业务覆盖、产品案例覆盖和省份钻取。
- 管理页提供本地数据录入、CSV 导入和 CSV 导出。
- 数据字段后续会继续扩展，当前以产品标签、采购标签、设备明细、业务痛点为核心。

## 技术约束

- 使用 Bun 运行脚本和管理依赖。
- 前端采用 Next.js、React、TypeScript、ES6 风格。
- 地图使用 ECharts 中国 GeoJSON，动效可使用 GSAP。
- 优先支持 Vercel 预览和 `bun run export` 静态导出。

## 代码规范

- 保持组件复用和分层清晰：展示组件、数据 Provider、CSV、mock 数据分开维护。
- 新增复杂业务逻辑时添加简体中文注释，说明原因和边界。
- 不要随意引入和当前风格不一致的大型 UI 框架。
- 不要提交本地运行产物，例如 `.next/`、`out/`、`artifacts/`、`tsconfig.tsbuildinfo`。

## 验证要求

常规改动至少运行：

```bash
bun run lint
bun run test
```

涉及构建、部署或静态导出时运行：

```bash
bun run build
bun run export
```

涉及大屏、地图、动画、响应式或管理页交互时运行：

```bash
bun run e2e
```

## Subagent-Driven 说明

较大改动可以按 Subagent-Driven Development 执行：

- 主 Agent 负责实现和集成。
- 子 Agent 做只读规格复核或代码质量复核。
- 子 Agent 不应修改同一批文件，避免覆盖主线改动。
