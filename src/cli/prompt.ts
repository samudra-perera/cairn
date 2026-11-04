import { createInterface } from "node:readline/promises";

/** Asks a question on stderr (so stdout stays clean) and returns the trimmed answer. */
export async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/** A yes/no question. Anything but "y" or "yes" is no. */
export async function confirm(question: string): Promise<boolean> {
  const answer = (await ask(`${question} [y/N] `)).toLowerCase();
  return answer === "y" || answer === "yes";
}
