import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Feature, FeaturesFile } from "../types/feature.js";

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
  return data.features;
}

export function writeFeatures(cwd: string, features: Feature[]): void {
  ensureHarnessDir(cwd);
  const filePath = getFeaturesPath(cwd);
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  const data: FeaturesFile = { features };
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

export function getNextFeature(cwd: string): Feature | undefined {
  const features = readFeatures(cwd);

  const passedIds = new Set(
    features.filter((f) => f.passes).map((f) => f.id),
  );

  const candidates = features
    .filter((f) => !f.passes && !f.skipped)
    .filter((f) => f.depends_on.every((dep) => passedIds.has(dep)))
    .sort((a, b) => a.priority - b.priority);

  return candidates[0];
}
