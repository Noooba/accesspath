CREATE TABLE IF NOT EXISTS world_reports (
 id TEXT PRIMARY KEY,
 latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 radius_meters REAL NOT NULL CHECK(radius_meters BETWEEN 5 AND 30),
 category TEXT NOT NULL,
 description TEXT NOT NULL CHECK(length(description) BETWEEN 0 AND 800),
 reported_at TEXT NOT NULL, expires_at TEXT NOT NULL,
 review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
 reviewed_at TEXT, moderator_notes TEXT NOT NULL DEFAULT '', duplicate_key TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS world_reports_location ON world_reports(latitude,longitude);
CREATE INDEX IF NOT EXISTS world_reports_status_time ON world_reports(review_status,expires_at);
INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(3,datetime('now'));
