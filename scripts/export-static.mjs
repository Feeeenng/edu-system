import { spawn } from "node:child_process";
import { cp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const tempRoot = path.join(tmpdir(), `edu-system-static-${process.pid}-${Date.now()}`);
const rootNodeModules = path.join(root, "node_modules");
const tempNodeModules = path.join(tempRoot, "node_modules");

const EXCLUDED_NAMES = new Set([
  ".git",
  ".next",
  ".superpowers",
  "data",
  "node_modules",
  "out",
  "playwright-report",
  "test-results",
  "tsconfig.tsbuildinfo",
]);

function shouldExclude(source) {
  const relative = path.relative(root, source);
  if (!relative) return false;
  const segments = relative.split(path.sep);
  return segments.some((segment) => EXCLUDED_NAMES.has(segment) || segment.startsWith(".env"));
}

async function copyProjectToTemp() {
  await mkdir(tempRoot, { recursive: true });
  await cp(root, tempRoot, {
    recursive: true,
    dereference: false,
    filter: (source) => !shouldExclude(source),
  });
}

async function linkNodeModules() {
  await symlink(rootNodeModules, tempNodeModules, "dir");
}

async function removeApiRoutes() {
  await rm(path.join(tempRoot, "app", "api"), { recursive: true, force: true });
}

async function runNextBuild() {
  return new Promise((resolve) => {
    const child = spawn(path.join(rootNodeModules, ".bin", "next"), ["build"], {
      cwd: tempRoot,
      env: {
        ...process.env,
        NEXT_PUBLIC_DATA_MODE: "browser",
        NEXT_OUTPUT_EXPORT: "true",
      },
      stdio: "inherit",
    });

    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function copyOutToRoot() {
  const tempOut = path.join(tempRoot, "out");
  const rootOut = path.join(root, "out");
  await rm(rootOut, { recursive: true, force: true });
  await cp(tempOut, rootOut, { recursive: true });
}

try {
  await copyProjectToTemp();
  await linkNodeModules();
  await removeApiRoutes();

  const code = await runNextBuild();
  if (code === 0) {
    await copyOutToRoot();
  }
  process.exitCode = code;
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
