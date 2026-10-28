PRAGMA foreign_keys = ON;

CREATE TABLE features (
  id          INTEGER PRIMARY KEY,
  repo        TEXT NOT NULL,
  name        TEXT NOT NULL,
  brief       TEXT,
  contract    TEXT,
  depends_on  INTEGER REFERENCES features(id),
  created_at  TEXT NOT NULL,
  UNIQUE (repo, name)
);

CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT,
  status      TEXT NOT NULL DEFAULT 'todo'
              CHECK (status IN ('todo','doing','review','done')),
  owner       TEXT NOT NULL DEFAULT 'me',
  claimed_by  TEXT,
  repo        TEXT,
  branch      TEXT,
  feature_id  INTEGER REFERENCES features(id),
  summary     TEXT,
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  done_at     TEXT
);

CREATE INDEX idx_tasks_repo_branch ON tasks(repo, branch);
CREATE INDEX idx_tasks_status ON tasks(status);

CREATE TABLE notes (
  id          INTEGER PRIMARY KEY,
  task_id     INTEGER REFERENCES tasks(id),
  repo        TEXT,
  branch      TEXT,
  author      TEXT NOT NULL,
  body        TEXT NOT NULL,
  private     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_notes_task_id ON notes(task_id);

CREATE TABLE events (
  id          INTEGER PRIMARY KEY,
  task_id     INTEGER REFERENCES tasks(id),
  actor       TEXT NOT NULL,
  kind        TEXT NOT NULL,
  data        TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_events_task_id ON events(task_id);

CREATE TABLE refs (
  from_id INTEGER NOT NULL REFERENCES tasks(id),
  to_id   INTEGER NOT NULL REFERENCES tasks(id),
  PRIMARY KEY (from_id, to_id)
);

CREATE TABLE agent_seen (
  agent        TEXT PRIMARY KEY,
  last_seen_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE tasks_fts USING fts5(
  title, body, summary, content='tasks', content_rowid='id'
);

CREATE VIRTUAL TABLE notes_fts USING fts5(
  body, content='notes', content_rowid='id'
);

CREATE TRIGGER tasks_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts(rowid, title, body, summary) VALUES (new.id, new.title, new.body, new.summary);
END;

CREATE TRIGGER tasks_ad AFTER DELETE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, title, body, summary) VALUES('delete', old.id, old.title, old.body, old.summary);
END;

CREATE TRIGGER tasks_au AFTER UPDATE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, title, body, summary) VALUES('delete', old.id, old.title, old.body, old.summary);
  INSERT INTO tasks_fts(rowid, title, body, summary) VALUES (new.id, new.title, new.body, new.summary);
END;

CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, body) VALUES (new.id, new.body);
END;

CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, body) VALUES('delete', old.id, old.body);
END;

CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, body) VALUES('delete', old.id, old.body);
  INSERT INTO notes_fts(rowid, body) VALUES (new.id, new.body);
END;
