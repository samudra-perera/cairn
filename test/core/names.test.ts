import { describe, expect, test } from "bun:test";
import { validateName } from "../../src/core/names";

describe("core/names", () => {
  test("accepts letters, digits, dots, underscores and dashes", () => {
    for (const name of ["claude", "samudra.perera", "pi_2", "a-b", "X".repeat(32)]) {
      expect(validateName(name)).toBeNull();
    }
  });

  test("rejects an empty name", () => {
    expect(validateName("")).toBe("name can't be empty");
  });

  test("rejects a name over 32 characters", () => {
    expect(validateName("x".repeat(33))).toContain("too long");
  });

  test("rejects spaces, control characters, escapes, and non-ASCII look-alikes", () => {
    for (const name of ["sam perera", "a\nb", "\u001b[31mred", "tab\t", "samudrа", "José", "😀"]) {
      expect(validateName(name)).toContain("invalid characters");
    }
  });
});
