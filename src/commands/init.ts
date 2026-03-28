import {
  existsSync,
  mkdirSync,
  writeFileSync,
  cpSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { logInfo, logSuccess, logError, logWarning, logPhase } from "../utils/logger.js";

const TEMPLATE_REPO = "loewen-digital/sveltekit-ai-starter-template";

/** Minimal files/dirs expected from the starter template. */
const EXPECTED_TEMPLATE_FILES = ["package.json", "src"];

export async function runInit(
  projectName: string,
  options: { force?: boolean },
): Promise<void> {
  logPhase("Init: Create New Project");

  const projectDir = join(process.cwd(), projectName);

  // Check if directory exists
  if (existsSync(projectDir) && !options.force) {
    logError(
      `Directory "${projectName}" already exists. Use --force to overwrite.`,
    );
    process.exit(1);
  }

  try {
    // Clone template via degit
    logInfo(`Cloning template from ${TEMPLATE_REPO}...`);
    execSync(`npx degit ${TEMPLATE_REPO} "${projectName}"`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    // Validate cloned template
    validateTemplate(projectDir);

    // Install dependencies
    logInfo("Running npm install...");
    execSync("npm install", { stdio: "inherit", cwd: projectDir });

    // Install orchestrator as devDependency
    logInfo("Installing orchestrator as devDependency...");
    execSync("npm install --save-dev @loewen-digital/sveltekit-orchestrator", {
      stdio: "inherit",
      cwd: projectDir,
    });

    // Create .claude-harness/ directory
    const harnessDir = join(projectDir, ".claude-harness");
    mkdirSync(harnessDir, { recursive: true });
    mkdirSync(join(harnessDir, "logs"), { recursive: true });

    // Create placeholder files
    writeFileSync(
      join(projectDir, "briefing.md"),
      `# Project: ${projectName}

<!-- Fill out this briefing or use "npx orchestrate discover" -->

## What / For Whom / Why
<!-- What are you building? Who uses it? Why is it needed? -->

## Tech Decisions
<!-- Platform, DB, auth, deployment, etc. -->

## Features
### Feature 1
- [ ] Acceptance Criterion 1
- [ ] Acceptance Criterion 2

## Explicitly Out of Scope
<!-- What will NOT be built -->
`,
    );

    writeFileSync(
      join(projectDir, "idea.md"),
      `# Project Idea

<!-- Describe your idea here. Then use "npx orchestrate discover"
     for a guided discovery phase. -->

## Core Idea
<!-- What is the problem? How should the app solve it? -->

## Target Audience
<!-- Who uses the app? -->

## MVP Features
<!-- What must the first version be able to do? -->
`,
    );

    // Copy GitHub Action and Issue Templates
    const templatesDir = join(import.meta.dirname ?? ".", "..", "templates");
    copyTemplates(projectDir, templatesDir);

    // Add orchestrate scripts to package.json
    addOrchestrateScripts(projectDir);

    // Git init + initial commit
    logInfo("Initializing git...");
    execSync("git init", { cwd: projectDir, stdio: "pipe" });
    execSync("git add -A", { cwd: projectDir, stdio: "pipe" });
    execSync(
      'git commit -m "chore: initial setup from sveltekit-ai-starter-template"',
      {
        cwd: projectDir,
        stdio: "pipe",
      },
    );

    logSuccess(`Project "${projectName}" created!`);
    console.log(`
📋 Next steps:
  cd ${projectName}
  npx orchestrate discover    # Interactive discovery phase
  npx orchestrate build       # Autonomous build process
`);
  } catch (error) {
    logError(
      `Init failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

function validateTemplate(projectDir: string): void {
  const missing = EXPECTED_TEMPLATE_FILES.filter(
    (f) => !existsSync(join(projectDir, f)),
  );
  if (missing.length > 0) {
    logWarning(
      `Template validation: missing expected files/dirs: ${missing.join(", ")}. The template may have changed or cloned incompletely.`,
    );
  }

  // Verify it looks like a Node project
  const entries = readdirSync(projectDir);
  if (entries.length < 2) {
    throw new Error(
      "Template clone appears empty or incomplete. Check the template repository.",
    );
  }
}

function copyTemplates(projectDir: string, templatesDir: string): void {
  // GitHub Action
  const workflowDir = join(projectDir, ".github", "workflows");
  mkdirSync(workflowDir, { recursive: true });
  const actionSrc = join(templatesDir, "github-action.yml");
  if (existsSync(actionSrc)) {
    cpSync(actionSrc, join(workflowDir, "maintenance-loop.yml"));
  }

  // Issue Templates
  const issueTemplateDir = join(projectDir, ".github", "ISSUE_TEMPLATE");
  mkdirSync(issueTemplateDir, { recursive: true });
  const bugSrc = join(templatesDir, "issue-templates", "bug.yml");
  const featureSrc = join(templatesDir, "issue-templates", "feature.yml");
  if (existsSync(bugSrc)) {
    cpSync(bugSrc, join(issueTemplateDir, "bug.yml"));
  }
  if (existsSync(featureSrc)) {
    cpSync(featureSrc, join(issueTemplateDir, "feature.yml"));
  }
}

function addOrchestrateScripts(projectDir: string): void {
  try {
    const pkgPath = join(projectDir, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<
      string,
      unknown
    >;
    const scripts = (pkg["scripts"] ?? {}) as Record<string, string>;
    scripts["orchestrate:discover"] = "orchestrate discover";
    scripts["orchestrate:build"] = "orchestrate build";
    scripts["orchestrate:polish"] = "orchestrate polish";
    pkg["scripts"] = scripts;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  } catch {
    // Non-critical — skip if package.json doesn't exist yet
  }
}
