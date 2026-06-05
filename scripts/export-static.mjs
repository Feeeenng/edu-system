import { spawn } from "node:child_process";
import { cp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TOP_LEVEL_EXCLUDED_NAMES = new Set([
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

export function shouldExcludeFromStaticExport(source, projectRoot) {
  const relative = path.relative(projectRoot, source);
  if (!relative) return false;
  const segments = relative.split(path.sep);
  const [firstSegment] = segments;
  return TOP_LEVEL_EXCLUDED_NAMES.has(firstSegment) || segments.some((segment) => segment.startsWith(".env"));
}

async function copyProjectToTemp(root, tempRoot) {
  await mkdir(tempRoot, { recursive: true });
  await cp(root, tempRoot, {
    recursive: true,
    dereference: false,
    filter: (source) => !shouldExcludeFromStaticExport(source, root),
  });
}

async function linkNodeModules(rootNodeModules, tempNodeModules) {
  await symlink(rootNodeModules, tempNodeModules, "dir");
}

async function removeApiRoutes(tempRoot) {
  await rm(path.join(tempRoot, "app", "api"), { recursive: true, force: true });
}

async function runNextBuild(rootNodeModules, tempRoot) {
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

async function copyOutToRoot(root, tempRoot) {
  const tempOut = path.join(tempRoot, "out");
  const rootOut = path.join(root, "out");
  await rm(rootOut, { recursive: true, force: true });
  await cp(tempOut, rootOut, { recursive: true });
}

export async function runStaticExport(root = process.cwd()) {
  const tempRoot = path.join(tmpdir(), `edu-system-static-${process.pid}-${Date.now()}`);
  const rootNodeModules = path.join(root, "node_modules");
  const tempNodeModules = path.join(tempRoot, "node_modules");

  try {
    await copyProjectToTemp(root, tempRoot);
    await linkNodeModules(rootNodeModules, tempNodeModules);
    await removeApiRoutes(tempRoot);

    const code = await runNextBuild(rootNodeModules, tempRoot);
    if (code === 0) {
      await copyOutToRoot(root, tempRoot);
    }

    return code;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await runStaticExport();
}
