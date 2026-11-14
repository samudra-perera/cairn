import { useEffect, useState } from "react";
import { useStdout } from "ink";

const FALLBACK = { columns: 80, rows: 24 };

/** The terminal's size, kept current as the window is resized. */
export function useTerminalSize(): { columns: number; rows: number } {
  const { stdout } = useStdout();
  const read = () => ({
    columns: stdout.columns || FALLBACK.columns,
    rows: stdout.rows || FALLBACK.rows,
  });
  const [size, setSize] = useState(read);

  useEffect(() => {
    const onResize = () => setSize(read());
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  return size;
}
