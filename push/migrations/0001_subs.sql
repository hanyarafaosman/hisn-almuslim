-- One row per browser that turned prayer alerts on. settings: the place rounded to 0.01° (about a kilometre), the time
-- zone, the calculation method and corrections, the alert of each prayer, the minutes of the reminder and the UI language.
-- next_at / next: the next alert to send (milliseconds since 1970, and { p, kind, prayerAt, rank }), NULL when all are off.
CREATE TABLE subs (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  settings TEXT NOT NULL,
  next_at INTEGER,
  next TEXT,
  created INTEGER NOT NULL,
  seen INTEGER NOT NULL
);
CREATE INDEX subs_next_at ON subs (next_at);

-- cron: when the minute job last ran (for GET /health).
CREATE TABLE meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
