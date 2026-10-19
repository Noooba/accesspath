import { sqliteTable, text, real, integer, primaryKey, foreignKey, index } from 'drizzle-orm/sqlite-core';

export const sites = sqliteTable('sites', {
  id: text('id').primaryKey(), slug: text('slug').notNull().unique(), name: text('name').notNull(), description: text('description').notNull(),
  centerLatitude: real('center_latitude').notNull(), centerLongitude: real('center_longitude').notNull(), siteType: text('site_type').notNull(),
  isDemo: integer('is_demo', { mode: 'boolean' }).notNull(), verificationStatus: text('verification_status').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});
export const nodes = sqliteTable('nodes', {
  id: text('id').notNull(), siteId: text('site_id').notNull().references(() => sites.id), name: text('name').notNull(), latitude: real('latitude').notNull(), longitude: real('longitude').notNull(), nodeType: text('node_type').notNull(), verificationStatus: text('verification_status').notNull(), sourceDescription: text('source_description').notNull(), verifiedAt: text('verified_at'), createdAt: text('created_at').notNull(),
}, (t) => [primaryKey({ columns: [t.siteId, t.id] }), index('nodes_site').on(t.siteId)]);
export const edges = sqliteTable('edges', {
  id: text('id').notNull(), siteId: text('site_id').notNull().references(() => sites.id), fromNodeId: text('from_node_id').notNull(), toNodeId: text('to_node_id').notNull(), isBidirectional: integer('is_bidirectional', { mode: 'boolean' }).notNull(), geometry: text('geometry', { mode: 'json' }).notNull(), lengthMeters: real('length_meters').notNull(), surfaceType: text('surface_type').notNull(), hasStairs: integer('has_stairs', { mode: 'boolean' }).notNull(), stepFreeStatus: text('step_free_status').notNull(), slopePercent: real('slope_percent'), widthCentimeters: real('width_centimeters'), curbRampStatus: text('curb_ramp_status').notNull(), operationalStatus: text('operational_status').notNull(), verificationStatus: text('verification_status').notNull(), verifiedAt: text('verified_at'), sourceDescription: text('source_description').notNull(), updatedAt: text('updated_at').notNull(),
}, (t) => [primaryKey({ columns: [t.siteId, t.id] }), foreignKey({ columns: [t.siteId, t.fromNodeId], foreignColumns: [nodes.siteId, nodes.id] }), foreignKey({ columns: [t.siteId, t.toNodeId], foreignColumns: [nodes.siteId, nodes.id] }), index('edges_site').on(t.siteId)]);
export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(), siteId: text('site_id').notNull(), edgeId: text('edge_id').notNull(), category: text('category').notNull(), description: text('description').notNull().default(''), reportedAt: text('reported_at').notNull(), reviewStatus: text('review_status').notNull().default('pending'), reviewedAt: text('reviewed_at'), moderatorNotes: text('moderator_notes').notNull().default(''), duplicateKey: text('duplicate_key').notNull().unique(),
}, (t) => [foreignKey({ columns: [t.siteId, t.edgeId], foreignColumns: [edges.siteId, edges.id] }), index('reports_site_time').on(t.siteId, t.reportedAt), index('reports_status_time').on(t.reviewStatus, t.reportedAt)]);
