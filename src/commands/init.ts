import { existsSync, mkdirSync, writeFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { logInfo, logSuccess, logError, logPhase } from "../utils/logger.js";

const TEMPLATE_REPO = "loewen-digital/sveltekit-ai-starter-template";

export async function runInit(
  projectName: string,
  options: { force?: boolean },
): Promise<void> {
  logPhase("Init: Neues Projekt erstellen");

  const projectDir = join(process.cwd(), projectName);

  // Check if directory exists
  if (existsSync(projectDir) && !options.force) {
    logError(`Verzeichnis "${projectName}" existiert bereits. Nutze --force zum Überschreiben.`);
    process.exit(1);
  }

  try {
    // Clone template via degit
    logInfo(`Template von ${TEMPLATE_REPO} klonen...`);
    execSync(`npx degit ${TEMPLATE_REPO} "${projectName}"`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    // Install dependencies
    logInfo("npm install...");
    execSync("npm install", { stdio: "inherit", cwd: projectDir });

    // Install orchestrator as devDependency
    logInfo("Orchestrator als devDependency installieren...");
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
      `# Projekt: ${projectName}

<!-- Fülle dieses Briefing aus oder nutze "npx orchestrate discover" -->

## Was / Für wen / Warum
<!-- Was baut ihr? Wer nutzt es? Warum braucht man das? -->

## Tech-Entscheidungen
<!-- Plattform, DB, Auth, Deployment, etc. -->

## Features
### Feature 1
- [ ] Acceptance Criterion 1
- [ ] Acceptance Criterion 2

## Explizit Out of Scope
<!-- Was wird NICHT gebaut -->
`,
    );

    writeFileSync(
      join(projectDir, "idea.md"),
      `# Projektidee

<!-- Beschreibe deine Idee hier. Nutze dann "npx orchestrate discover"
     für eine geführte Discovery Phase. -->

## Kernidee
<!-- Was ist das Problem? Wie soll die App es lösen? -->

## Zielgruppe
<!-- Wer nutzt die App? -->

## MVP Features
<!-- Was muss die erste Version können? -->
`,
    );

    // Copy GitHub Action and Issue Templates
    const templatesDir = join(import.meta.dirname ?? ".", "..", "templates");
    copyTemplates(projectDir, templatesDir);

    // Add orchestrate scripts to package.json
    addOrchestrateScripts(projectDir);

    // Git init + initial commit
    logInfo("Git initialisieren...");
    execSync("git init", { cwd: projectDir, stdio: "pipe" });
    execSync("git add -A", { cwd: projectDir, stdio: "pipe" });
    execSync('git commit -m "chore: initial setup from sveltekit-ai-starter-template"', {
      cwd: projectDir,
      stdio: "pipe",
    });

    logSuccess(`Projekt "${projectName}" erstellt!`);
    console.log(`
📋 Nächste Schritte:
  cd ${projectName}
  npx orchestrate discover    # Interaktive Discovery Phase
  npx orchestrate build       # Autonomer Build-Prozess
`);
  } catch (error) {
    logError(`Init fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
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
    const pkg = JSON.parse(
      execSync(`cat "${pkgPath}"`, { encoding: "utf-8" }),
    ) as Record<string, unknown>;
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
