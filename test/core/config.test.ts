import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getUserName, readConfig, setUserName } from "../../src/core/config";
import { callerIdentity } from "../../src/core/context";

describe("core/config", () => {
  let dir: string;
  let path: string;
  let priorConfig: string | undefined;
  let priorAgent: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cairn-config-"));
    path = join(dir, "nested", "config.json");
    priorConfig = process.env.CAIRN_CONFIG_PATH;
    priorAgent = process.env.CAIRN_AGENT;
    delete process.env.CAIRN_AGENT;
  });

  afterEach(() => {
    if (priorConfig === undefined) delete process.env.CAIRN_CONFIG_PATH;
    else process.env.CAIRN_CONFIG_PATH = priorConfig;
    if (priorAgent === undefined) delete process.env.CAIRN_AGENT;
    else process.env.CAIRN_AGENT = priorAgent;
    rmSync(dir, { recursive: true, force: true });
  });

  test("no config file means no name", () => {
    expect(getUserName(path)).toBeNull();
  });

  test("setUserName creates the directory and round-trips, trimmed", () => {
    setUserName("  samudra.perera ", path);
    expect(getUserName(path)).toBe("samudra.perera");
  });

  test("a malformed or wrongly-shaped config is treated as empty", () => {
    setUserName("x", path);
    writeFileSync(path, "{not json");
    expect(readConfig(path)).toEqual({});
    writeFileSync(path, JSON.stringify({ userName: 5 }));
    expect(getUserName(path)).toBeNull();
  });

  test("a blank or invalid name is treated as unset", () => {
    setUserName("   ", path);
    expect(getUserName(path)).toBeNull();
    setUserName("has space", path);
    expect(getUserName(path)).toBeNull();
  });

  test("callerIdentity: agent beats saved name beats 'me'", () => {
    process.env.CAIRN_CONFIG_PATH = path;
    expect(callerIdentity()).toBe("me");
    setUserName("samudra.perera", path);
    expect(callerIdentity()).toBe("samudra.perera");
    process.env.CAIRN_AGENT = "claude";
    expect(callerIdentity()).toBe("claude");
  });
});
