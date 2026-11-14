const ENTER_ALT_SCREEN = "\x1b[?1049h\x1b[H";
const LEAVE_ALT_SCREEN = "\x1b[?1049l";

/**
 * Switches the terminal to its alternate screen buffer, so the TUI takes over
 * the whole window and the shell's scrollback comes back untouched on exit.
 * Returns a restore function that is safe to call more than once; it also runs
 * on process exit, crashes and termination signals, because a terminal left in
 * the alternate screen is broken for the user. Does nothing if stdout isn't a
 * terminal (piped output, tests).
 */
export function enterFullscreen(stdout: NodeJS.WriteStream = process.stdout): () => void {
  if (!stdout.isTTY) return () => {};

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    stdout.write(LEAVE_ALT_SCREEN);
  };

  stdout.write(ENTER_ALT_SCREEN);
  process.once("exit", restore);
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.once(signal, () => {
      restore();
      process.exit(128);
    });
  }
  process.once("uncaughtException", (err) => {
    restore();
    console.error(err);
    process.exit(1);
  });

  return restore;
}
