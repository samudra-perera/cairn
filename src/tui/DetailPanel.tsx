import { Box, Text } from "ink";
import type { Task } from "../core/tasks";
import type { Event } from "../core/events";
import type { Note } from "../core/notes";

interface TimelineItem {
  createdAt: string;
  label: string;
}

function buildTimeline(events: Event[], notes: Note[]): TimelineItem[] {
  const fromEvents: TimelineItem[] = events.map((e) => ({
    createdAt: e.createdAt,
    label: `${e.actor} ${e.kind}`,
  }));
  const fromNotes: TimelineItem[] = notes.map((n) => ({
    createdAt: n.createdAt,
    label: `note from ${n.author}${n.private ? " 🔒" : ""}: ${n.body}`,
  }));
  return [...fromEvents, ...fromNotes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

interface Props {
  task: Task | null;
  events: Event[];
  notes: Note[];
}

export function DetailPanel({ task, events, notes }: Props) {
  if (!task) {
    return (
      <Box flexDirection="column" borderStyle="single" paddingX={1} flexGrow={1}>
        <Text dimColor>Select a task (j/k) to see its detail.</Text>
      </Box>
    );
  }

  const timeline = buildTimeline(events, notes);

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1} flexGrow={1}>
      <Text bold>
        #{task.id} {task.title}
      </Text>
      <Text dimColor>
        [{task.status}]{task.claimedBy ? ` claimed by ${task.claimedBy}` : ""}
      </Text>
      {task.body && <Text>{task.body}</Text>}
      {task.summary && <Text>summary: {task.summary}</Text>}
      <Box marginTop={1} flexDirection="column">
        {timeline.length === 0 && <Text dimColor>No activity yet.</Text>}
        {timeline.map((item, i) => (
          <Text key={i}>
            {item.createdAt} {item.label}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
