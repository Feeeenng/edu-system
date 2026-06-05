import { spawn } from "node:child_process";
import { access, rename, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const apiDir = path.join(root, "app", "api");
const backupDir = path.join(root, ".next-static-api-backup");

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function runNextBuild() {
  return new Promise((resolve) => {
    const child = spawn("next", ["build"], {
      cwd: root,
      env: {
        ...process.env,
        NEXT_PUBLIC_DATA_MODE: "browser",
        NEXT_OUTPUT_EXPORT: "true",
      },
      shell: true,
      stdio: "inherit",
    });

    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

let movedApi = false;

try {
  if (await pathExists(backupDir)) {
    throw new Error(`${backupDir} already exists; remove it before exporting`);
  }

  if (await pathExists(apiDir)) {
    await rename(apiDir, backupDir);
    movedApi = true;
  }

  const code = await runNextBuild();
  process.exitCode = code;
} finally {
  if (movedApi) {
    await rm(apiDir, { recursive: true, force: true });
    await rename(backupDir, apiDir);
  }
}
