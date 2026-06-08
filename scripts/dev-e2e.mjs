import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const port = process.env.E2E_PORT ?? "3107";

// e2e 需要稳定复现 dev 编译；清理 Next dev 缓存可避免损坏的 webpack pack 影响测试。
await rm(".next/cache", { recursive: true, force: true });

const child = spawn("./node_modules/.bin/next", ["dev", "--hostname", "127.0.0.1", "--port", port], {
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
