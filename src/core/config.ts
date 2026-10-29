import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";
import { validateName } from "./names";

const configSchema = z.object({ userName: z.string().optional() });

export type Config = z.infer<typeof configSchema>;

export function resolveConfigPath(override?: string): string {
  return override ?? process.env.CAIRN_CONFIG_PATH ?? join(homedir(), ".cairn", "config.json");
}

/** A missing, unreadable, or malformed config is treated as empty, never an error. */
export function readConfig(path?: string): Config {
  const configPath = resolveConfigPath(path);
  if (!existsSync(configPath)) return {};
  try {
    const parsed = configSchema.safeParse(JSON.parse(readFileSync(configPath, "utf-8")));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function writeConfig(config: Config, path?: string): void {
  const configPath = resolveConfigPath(path);
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

/** The human's name as set by `cairn init`, or null if they haven't run it. */
export function getUserName(path?: string): string | null {
  const name = readConfig(path).userName?.trim();
  return name && validateName(name) === null ? name : null;
}

export function setUserName(name: string, path?: string): void {
  writeConfig({ ...readConfig(path), userName: name.trim() }, path);
}
