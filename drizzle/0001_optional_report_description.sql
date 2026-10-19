CREATE TABLE reports_optional_description (
 id TEXT PRIMARY KEY, site_id TEXT NOT NULL, edge_id TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('blocked-path','stairs','damaged-surface','missing-curb-ramp','steep-slope','inaccessible-entrance','other')),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description) BETWEEN 0 AND 800), reported_at TEXT NOT NULL,
 review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
 reviewed_at TEXT, moderator_notes TEXT NOT NULL DEFAULT '',
 duplicate_key TEXT NOT NULL UNIQUE, FOREIGN KEY(site_id,edge_id) REFERENCES edges(site_id,id)
);
INSERT INTO reports_optional_description(id,site_id,edge_id,category,description,reported_at,review_status,reviewed_at,moderator_notes,duplicate_key)
SELECT id,site_id,edge_id,category,description,reported_at,review_status,reviewed_at,moderator_notes,duplicate_key FROM reports;
DROP TABLE reports;
ALTER TABLE reports_optional_description RENAME TO reports;
CREATE INDEX reports_site_time ON reports(site_id,reported_at DESC);
CREATE INDEX reports_status_time ON reports(review_status,reported_at DESC);
INSERT INTO schema_migrations(version,applied_at) VALUES(2,datetime('now'));
