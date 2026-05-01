import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CONFIG_DIR = path.join(os.homedir(), ".experiwall");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export interface Config {
  api_key: string;
  api_url?: string;
}

export function loadConfig(): Config | null {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as Config;
  } catch {
    return null;
  }
}

export function saveConfig(config: Config): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  // mkdirSync's mode is ignored if the directory already exists; chmod to enforce.
  try {
    fs.chmodSync(CONFIG_DIR, 0o700);
  } catch {
    // best-effort on platforms without POSIX permissions (Windows)
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  // writeFileSync's mode is ignored if the file already exists; chmod to enforce.
  try {
    fs.chmodSync(CONFIG_FILE, 0o600);
  } catch {
    // best-effort on platforms without POSIX permissions (Windows)
  }
}

export function deleteConfig(): void {
  try {
    fs.unlinkSync(CONFIG_FILE);
  } catch {
    // already gone
  }
}

export function resolveApiKey(envKey?: string, flagKey?: string): string | null {
  if (flagKey) return flagKey;
  if (envKey) return envKey;
  const config = loadConfig();
  return config?.api_key ?? null;
}

export function resolveApiUrl(envUrl?: string, flagUrl?: string): string | undefined {
  if (flagUrl) return flagUrl;
  if (envUrl) return envUrl;
  const config = loadConfig();
  return config?.api_url;
}
