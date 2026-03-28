import { loadConfig, formatConfig } from "../utils/config.js";

export async function runConfig(cwd: string): Promise<void> {
  const config = loadConfig(cwd);
  console.log(formatConfig(config));
}
