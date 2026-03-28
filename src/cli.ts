#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runInit } from "./commands/init.js";
import { runDiscover } from "./commands/discover.js";
import { runPlan } from "./commands/plan.js";
import { runBuild } from "./commands/build.js";
import { runPolish } from "./commands/polish.js";
import { runMaintain } from "./commands/maintain.js";
import { runConfig } from "./commands/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
  try {
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

const program = new Command();

program
  .name("orchestrate")
  .description("AI-powered SvelteKit project orchestrator using Claude Agent SDK")
  .version(getVersion());

program
  .command("init <project-name>")
  .description("Create a new SvelteKit project from the starter template")
  .option("--force", "Overwrite existing directory")
  .action(async (projectName: string, options: { force?: boolean }) => {
    await runInit(projectName, options);
  });

program
  .command("discover")
  .description("Interactive discovery phase — AI asks questions and writes briefing.md")
  .action(async () => {
    await runDiscover(process.cwd());
  });

program
  .command("plan")
  .description("Generate spec.md and features.json from briefing.md")
  .action(async () => {
    await runPlan(process.cwd());
  });

program
  .command("build")
  .description("Autonomous build loop: planning → generator ↔ evaluator")
  .option("--skip-planning", "Skip the planning phase")
  .action(async (options: { skipPlanning?: boolean }) => {
    await runBuild(process.cwd(), options);
  });

program
  .command("polish")
  .description("Final polish pass: loading states, accessibility, responsive design")
  .action(async () => {
    await runPolish(process.cwd());
  });

program
  .command("maintain <issue-number>")
  .description("Autonomously work on a GitHub issue")
  .action(async (issueNumber: string) => {
    const num = parseInt(issueNumber, 10);
    if (isNaN(num)) {
      console.error("❌ Issue number must be a valid integer");
      process.exit(1);
    }
    await runMaintain(process.cwd(), num);
  });

program
  .command("config")
  .description("Show current orchestrator configuration")
  .action(async () => {
    await runConfig(process.cwd());
  });

program.parse();
