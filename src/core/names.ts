const MAX_NAME_LENGTH = 32;
const NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * Names (yours, an assignee, an agent) end up in the terminal, the TUI and
 * command arguments, so they're limited to characters that are safe in all
 * three. Returns an error message, or null if the name is valid.
 */
export function validateName(name: string): string | null {
  if (name.length === 0) return "name can't be empty";
  if (name.length > MAX_NAME_LENGTH) {
    return `name "${name}" is too long (max ${MAX_NAME_LENGTH} characters)`;
  }
  if (!NAME_PATTERN.test(name)) {
    return `name "${name}" has invalid characters (use letters, digits, ".", "_" or "-")`;
  }
  return null;
}
