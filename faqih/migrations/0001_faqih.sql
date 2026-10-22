-- Questions answered per day (DAILY_LIMIT in wrangler.toml) and a log of answers: what happened, never the question.
CREATE TABLE IF NOT EXISTS budget (day TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS log (ts INTEGER NOT NULL, status TEXT NOT NULL, dropped INTEGER NOT NULL DEFAULT 0, ms INTEGER);
