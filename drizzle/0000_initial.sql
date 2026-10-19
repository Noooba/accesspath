PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sites (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL,
 center_latitude REAL NOT NULL CHECK(center_latitude BETWEEN -90 AND 90),
 center_longitude REAL NOT NULL CHECK(center_longitude BETWEEN -180 AND 180),
 site_type TEXT NOT NULL CHECK(site_type IN ('demo','school','community')),
 is_demo INTEGER NOT NULL CHECK(is_demo IN (0,1)),
 verification_status TEXT NOT NULL CHECK(verification_status IN ('verified','unverified','demonstration')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nodes (
 id TEXT NOT NULL, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
 name TEXT NOT NULL, latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180), node_type TEXT NOT NULL CHECK(node_type IN ('intersection','entrance','ramp','elevator','destination','regular')),
 verification_status TEXT NOT NULL CHECK(verification_status IN ('verified','unverified','demonstration')),
 source_description TEXT NOT NULL, verified_at TEXT, created_at TEXT NOT NULL,
 PRIMARY KEY(site_id,id)
);
CREATE TABLE IF NOT EXISTS edges (
 id TEXT NOT NULL, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
 from_node_id TEXT NOT NULL, to_node_id TEXT NOT NULL,
 is_bidirectional INTEGER NOT NULL CHECK(is_bidirectional IN (0,1)), geometry TEXT NOT NULL CHECK(json_valid(geometry)),
 length_meters REAL NOT NULL CHECK(length_meters > 0),
 surface_type TEXT NOT NULL CHECK(surface_type IN ('paved','gravel','uneven','unknown')),
 has_stairs INTEGER NOT NULL CHECK(has_stairs IN (0,1)),
 step_free_status TEXT NOT NULL CHECK(step_free_status IN ('confirmed','not-step-free','unknown')),
 slope_percent REAL CHECK(slope_percent >= 0), width_centimeters REAL CHECK(width_centimeters > 0),
 curb_ramp_status TEXT NOT NULL CHECK(curb_ramp_status IN ('present','not-required','missing','unknown')),
 operational_status TEXT NOT NULL CHECK(operational_status IN ('open','blocked','unknown')),
 verification_status TEXT NOT NULL CHECK(verification_status IN ('verified','unverified','demonstration')),
 verified_at TEXT, source_description TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(site_id,id),
 FOREIGN KEY(site_id,from_node_id) REFERENCES nodes(site_id,id),
 FOREIGN KEY(site_id,to_node_id) REFERENCES nodes(site_id,id), CHECK(from_node_id <> to_node_id)
);
CREATE TABLE IF NOT EXISTS reports (
 id TEXT PRIMARY KEY, site_id TEXT NOT NULL, edge_id TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('blocked-path','stairs','damaged-surface','missing-curb-ramp','steep-slope','inaccessible-entrance','other')),
 description TEXT NOT NULL CHECK(length(description) BETWEEN 5 AND 800), reported_at TEXT NOT NULL,
 review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
 reviewed_at TEXT, moderator_notes TEXT NOT NULL DEFAULT '',
 duplicate_key TEXT NOT NULL UNIQUE, FOREIGN KEY(site_id,edge_id) REFERENCES edges(site_id,id)
);
CREATE TABLE IF NOT EXISTS rate_limits (
 bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL CHECK(hits > 0), expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS nodes_site ON nodes(site_id);
CREATE INDEX IF NOT EXISTS edges_site ON edges(site_id);
CREATE INDEX IF NOT EXISTS reports_site_time ON reports(site_id,reported_at DESC);
CREATE INDEX IF NOT EXISTS reports_status_time ON reports(review_status,reported_at DESC);
CREATE INDEX IF NOT EXISTS rate_limits_expiry ON rate_limits(expires_at);
INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(1,datetime('now'));
