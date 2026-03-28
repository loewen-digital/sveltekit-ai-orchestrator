import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { logWarning } from "./logger.js";
import type { Feature, FeaturesFile } from "../types/feature.js";

const CURRENT_SCHEMA_VERSION = 1;

function getFeaturesPath(cwd: string): string {
  return join(cwd, ".claude-harness", "features.json");
}

function ensureHarnessDir(cwd: string): void {
  const dir = join(cwd, ".claude-harness");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function readFeatures(cwd: string): Feature[] {
  const filePath = getFeaturesPath(cwd);
  if (!existsSync(filePath)) {
    return [];
  }
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as FeaturesFile;

  // Migrate schema if needed
  if (!data.schemaVersion || data.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const migrated = migrateFeatures(data);
    writeFeatures(cwd, migrated.features);
    return migrated.features;
  }

  return data.features;
}

export function writeFeatures(cwd: string, features: Feature[]): void {
  ensureHarnessDir(cwd);
  const filePath = getFeaturesPath(cwd);
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  const data: FeaturesFile = { schemaVersion: CURRENT_SCHEMA_VERSION, features };
  writeFileSync(tempPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  renameSync(tempPath, filePath);
}

export function addFeature(cwd: string, feature: Feature): void {
  const features = readFeatures(cwd);
  features.push(feature);
  writeFeatures(cwd, features);
}

export function updateFeature(
  cwd: string,
  id: string,
  partial: Partial<Feature>,
): void {
  const features = readFeatures(cwd);
  const index = features.findIndex((f) => f.id === id);
  if (index === -1) {
    throw new Error(`Feature ${id} not found`);
  }
  features[index] = { ...features[index]!, ...partial };
  writeFeatures(cwd, features);
}

/**
 * Detects circular dependencies in the feature graph.
 * Returns an array of feature IDs that form cycles, or empty array if none.
 */
export function detectCircularDependencies(features: Feature[]): string[] {
  const featureIds = new Set(features.map((f) => f.id));
  const depsMap = new Map<string, string[]>();
  for (const f of features) {
    depsMap.set(f.id, f.depends_on.filter((d) => featureIds.has(d)));
  }

  const cycleMembers = new Set<string>();

  // For each node, trace all paths and check for back-edges
  for (const startId of featureIds) {
    const visited = new Set<string>();
    const path: string[] = [];

    function dfs(id: string): void {
      if (visited.has(id)) {
        // Found a cycle — mark all nodes in the cycle path
        const cycleStart = path.indexOf(id);
        if (cycleStart >= 0) {
          for (let i = cycleStart; i < path.length; i++) {
            cycleMembers.add(path[i]!);
          }
        }
        return;
      }

      visited.add(id);
      path.push(id);

      for (const dep of depsMap.get(id) ?? []) {
        dfs(dep);
      }

      path.pop();
    }

    dfs(startId);
  }

  return [...cycleMembers];
}

export function getNextFeature(cwd: string): Feature | undefined {
  const features = readFeatures(cwd);

  // Detect and warn about circular dependencies
  const cyclicIds = detectCircularDependencies(features);
  if (cyclicIds.length > 0) {
    logWarning(
      `Circular dependency detected among features: ${cyclicIds.join(", ")}. These features will be skipped.`,
    );
  }

  const passedIds = new Set(
    features.filter((f) => f.passes).map((f) => f.id),
  );

  const candidates = features
    .filter((f) => !f.passes && !f.skipped)
    .filter((f) => !cyclicIds.includes(f.id))
    .filter((f) => f.depends_on.every((dep) => passedIds.has(dep)))
    .sort((a, b) => a.priority - b.priority);

  return candidates[0];
}

function migrateFeatures(data: FeaturesFile): FeaturesFile {
  // v0 → v1: Add schemaVersion, ensure all features have skipped field
  const migrated = data.features.map((f) => ({
    ...f,
    skipped: f.skipped ?? false,
  }));

  logWarning(`Migrated features.json from schema v${data.schemaVersion ?? 0} to v${CURRENT_SCHEMA_VERSION}`);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    features: migrated,
  };
}
