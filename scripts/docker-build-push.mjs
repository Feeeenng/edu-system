#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const DEFAULT_IMAGE = "feeeng/edu-system";

function hasFlag(name) {
  return process.argv.includes(name);
}

function getOption(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} 需要指定值`);
  }
  return value;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} 执行失败，退出码 ${result.status}`);
  }
}

function printHelp() {
  console.log(`
用法:
  bun run docker:build
  bun run docker:push
  node scripts/docker-build-push.mjs --tag v1.0.0 --push

参数:
  --image <name>  镜像名，默认 ${DEFAULT_IMAGE}
  --tag <tag>     镜像标签，默认 latest
  --push          构建完成后推送镜像
  --no-latest     指定非 latest tag 时，不额外更新 latest
`);
}

if (hasFlag("--help") || hasFlag("-h")) {
  printHelp();
  process.exit(0);
}

try {
  const image = getOption("--image", process.env.DOCKER_IMAGE || DEFAULT_IMAGE);
  const tag = getOption("--tag", process.env.DOCKER_TAG || "latest");
  const push = hasFlag("--push") || process.env.DOCKER_PUSH === "true";
  const tagLatest = tag !== "latest" && !hasFlag("--no-latest");
  const imageTag = `${image}:${tag}`;

  run("docker", ["build", "-t", imageTag, "."]);

  if (tagLatest) {
    run("docker", ["tag", imageTag, `${image}:latest`]);
  }

  if (push) {
    run("docker", ["push", imageTag]);
    if (tagLatest) run("docker", ["push", `${image}:latest`]);
  }

  console.log(`镜像已构建: ${imageTag}`);
  if (tagLatest) console.log(`latest 已更新: ${image}:latest`);
  if (push) console.log("镜像已推送完成");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
