-- The human's personal list (job applications, errands, habits). Kept apart
-- from `tasks` on purpose: no status workflow, and agents never read it.
CREATE TABLE personal_items (
  id              INTEGER PRIMARY KEY,
  title           TEXT NOT NULL,
  -- NULL = one-off item; N = recurring, wants N completions per Mon-Sun week
  target_per_week INTEGER CHECK (target_per_week BETWEEN 1 AND 7),
  created_at      TEXT NOT NULL
);

-- One row per item per local calendar day. Streaks and stats are derived
-- from this history instead of being stored as a counter.
CREATE TABLE personal_completions (
  item_id      INTEGER NOT NULL REFERENCES personal_items(id),
  completed_on TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (item_id, completed_on)
);
