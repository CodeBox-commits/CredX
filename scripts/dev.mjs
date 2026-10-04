#!/usr/bin/env node
// Cross-platform developer tasks (Windows/macOS/Linux) — no make/bash required.
//   node scripts/dev.mjs setup   create backend venv, install deps, seed demo
//   node scripts/dev.mjs seed    (re)seed the demo portfolio
//   node scripts/dev.mjs dev     run API (:8000) + web (:3000) together
//   node scripts/dev.mjs api     run API only
//   node scripts/dev.mjs test    backend pytest + frontend vitest
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const frontend = path.join(root, "frontend");
const win = process.platform === "win32";
const venvPy = path.join(backend, ".venv", win ? "Scripts/python.exe" : "bin/python");
const py = () => (existsSync(venvPy) ? venvPy : win ? "python" : "python3");
const env = { ...process.env, PYTHONIOENCODING: "utf-8" };

const run = (cmd, args, cwd, extra = {}) => {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: win, env: { ...env, ...extra } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const tasks = {
  setup() {
    if (!existsSync(venvPy)) run(win ? "py" : "python3", win ? ["-3", "-m", "venv", ".venv"] : ["-m", "venv", ".venv"], backend);
    run(venvPy, ["-m", "pip", "install", "-r", "requirements-dev.txt"], backend);
    run("npm", ["install"], frontend);
    tasks.seed();
  },
  seed() {
    run(py(), ["-m", "database.seed", "--reset"], backend);
    run(py(), ["-m", "database.seed", "--export-only", "../demo/documents"], backend);
  },
  api() {
    run(py(), ["-m", "uvicorn", "main:app", "--reload", "--port", "8000"], backend, { JOB_BACKEND: process.env.JOB_BACKEND ?? "thread" });
  },
  dev() {
    const procs = [
      spawn(py(), ["-m", "uvicorn", "main:app", "--reload", "--port", "8000"], { cwd: backend, stdio: "inherit", shell: win, env: { ...env, JOB_BACKEND: env.JOB_BACKEND ?? "thread" } }),
      spawn("npm", ["run", "dev"], { cwd: frontend, stdio: "inherit", shell: win, env }),
    ];
    const stop = () => procs.forEach((p) => p.kill());
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  },
  "test-api"() {
    run(py(), ["-m", "pytest", "-q"], backend);
  },
  test() {
    tasks["test-api"]();
    run("npm", ["run", "test"], frontend);
  },
};

const task = tasks[process.argv[2]];
if (!task) {
  console.error(`Usage: node scripts/dev.mjs <${Object.keys(tasks).join("|")}>`);
  process.exit(1);
}
task();
