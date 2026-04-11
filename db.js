// db.js — SQLite setup via better-sqlite3
// The database file lives at DATA_DIR/radiant.db
// DATA_DIR defaults to ./data but can be overridden via the DB_PATH env var.

const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'radiant.db');

// Ensure the data directory exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── SCHEMA ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS fixtures (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    brand       TEXT,
    model       TEXT,
    type        TEXT,
    integrated  INTEGER NOT NULL DEFAULT 0,
    watts       REAL,
    cost        REAL,
    cct         TEXT,
    beam        TEXT,
    wire_ft     REAL,
    notes       TEXT,
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );



  CREATE TABLE IF NOT EXISTS estimates (
    id          TEXT    PRIMARY KEY,
    name        TEXT,
    notes       TEXT,
    settings    TEXT    NOT NULL DEFAULT '{}',  -- JSON blob
    saved_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS estimate_fixtures (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    estimate_id TEXT    NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    table_type  TEXT    NOT NULL DEFAULT 'fixture',  -- 'fixture' | 'transformer'
    model       TEXT,
    type        TEXT,
    qty         INTEGER,
    watts       REAL,
    unit_cost   REAL,
    wire_ft     REAL,
    va_rating   REAL
  );
`);

// ── MIGRATIONS ────────────────────────────────────────────────────────────────
// Safe ALTER TABLE calls for columns added after initial release.
// SQLite throws if the column already exists; we catch and ignore that.
const migrations = [
  `ALTER TABLE fixtures ADD COLUMN integrated INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE estimate_fixtures ADD COLUMN brand_model TEXT`,
  `ALTER TABLE estimates ADD COLUMN folder TEXT`,
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (_) { /* column already exists — skip */ }
}

// ── FIXTURE QUERIES ───────────────────────────────────────────────────────────

const fixtureQueries = {
  getAll: db.prepare(`
    SELECT * FROM fixtures ORDER BY updated_at DESC
  `),

  getById: db.prepare(`
    SELECT * FROM fixtures WHERE id = ?
  `),

  upsert: db.prepare(`
    INSERT INTO fixtures (id, name, brand, model, type, integrated, watts, cost, cct, beam, wire_ft, notes, updated_at)
    VALUES (@id, @name, @brand, @model, @type, @integrated, @watts, @cost, @cct, @beam, @wire_ft, @notes, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name       = excluded.name,
      brand      = excluded.brand,
      model      = excluded.model,
      type       = excluded.type,
      integrated = excluded.integrated,
      watts      = excluded.watts,
      cost       = excluded.cost,
      cct        = excluded.cct,
      beam       = excluded.beam,
      wire_ft    = excluded.wire_ft,
      notes      = excluded.notes,
      updated_at = excluded.updated_at
  `),

  delete: db.prepare(`
    DELETE FROM fixtures WHERE id = ?
  `),
};

// ── ESTIMATE QUERIES ──────────────────────────────────────────────────────────

const estimateQueries = {
  getAll: db.prepare(`
    SELECT id, name, folder, notes, settings, saved_at FROM estimates ORDER BY saved_at DESC
  `),

  getById: db.prepare(`
    SELECT id, name, folder, notes, settings, saved_at FROM estimates WHERE id = ?
  `),

  upsertMeta: db.prepare(`
    INSERT INTO estimates (id, name, folder, notes, settings, saved_at)
    VALUES (@id, @name, @folder, @notes, @settings, @saved_at)
    ON CONFLICT(id) DO UPDATE SET
      name     = excluded.name,
      folder   = excluded.folder,
      notes    = excluded.notes,
      settings = excluded.settings,
      saved_at = excluded.saved_at
  `),

  patchFolder: db.prepare(`
    UPDATE estimates SET folder = ? WHERE id = ?
  `),

  deleteRows: db.prepare(`
    DELETE FROM estimate_fixtures WHERE estimate_id = ?
  `),

  insertRow: db.prepare(`
    INSERT INTO estimate_fixtures
      (estimate_id, sort_order, table_type, model, brand_model, type, qty, watts, unit_cost, wire_ft, va_rating)
    VALUES
      (@estimate_id, @sort_order, @table_type, @model, @brand_model, @type, @qty, @watts, @unit_cost, @wire_ft, @va_rating)
  `),

  getRows: db.prepare(`
    SELECT * FROM estimate_fixtures WHERE estimate_id = ? ORDER BY table_type, sort_order
  `),

  delete: db.prepare(`
    DELETE FROM estimates WHERE id = ?
  `),
};

// ── HIGHER-LEVEL HELPERS ──────────────────────────────────────────────────────

// Save a full estimate (meta + all rows) in a single transaction
const saveEstimate = db.transaction((estimate) => {
  estimateQueries.upsertMeta.run({
    id:       estimate.id,
    name:     estimate.name     || '',
    folder:   estimate.folder   || null,
    notes:    estimate.notes    || '',
    settings: JSON.stringify({ ...(estimate.settings || {}), client: estimate.client || {} }),
    saved_at: estimate.savedAt  || new Date().toISOString(),
  });

  // Replace all rows for this estimate
  estimateQueries.deleteRows.run(estimate.id);

  (estimate.fixtures || []).forEach((row, i) => {
    estimateQueries.insertRow.run({
      estimate_id: estimate.id,
      sort_order:  i,
      table_type:  'fixture',
      model:       row.model       || null,
      brand_model: row.brand_model || null,
      type:        row.type        || null,
      qty:         parseInt(row.qty)          || null,
      watts:       parseFloat(row.watts)      || null,
      unit_cost:   parseFloat(row.unit_cost)  || null,
      wire_ft:     parseFloat(row.wire_ft)    || null,
      va_rating:   null,
    });
  });

  (estimate.wire || []).forEach((row, i) => {
    estimateQueries.insertRow.run({
      estimate_id: estimate.id,
      sort_order:  i,
      table_type:  'wire',
      model:       row.model       || null,
      brand_model: row.brand_model || null,
      type:        null,
      qty:         parseFloat(row.qty)         || null,
      watts:       null,
      unit_cost:   parseFloat(row.unit_cost)   || null,
      wire_ft:     null,
      va_rating:   null,
    });
  });

  (estimate.lamps || []).forEach((row, i) => {
    estimateQueries.insertRow.run({
      estimate_id: estimate.id,
      sort_order:  i,
      table_type:  'lamp',
      model:       row.model       || null,
      brand_model: row.brand_model || null,
      type:        null,
      qty:         parseFloat(row.qty)        || null,
      watts:       parseFloat(row.watts)      || null,
      unit_cost:   parseFloat(row.unit_cost)  || null,
      wire_ft:     null,
      va_rating:   null,
    });
  });

  (estimate.misc || []).forEach((row, i) => {
    estimateQueries.insertRow.run({
      estimate_id: estimate.id,
      sort_order:  i,
      table_type:  'misc',
      model:       row.model       || null,
      brand_model: row.brand_model || null,
      type:        null,
      qty:         parseFloat(row.qty)         || null,
      watts:       null,
      unit_cost:   parseFloat(row.unit_cost)   || null,
      wire_ft:     null,
      va_rating:   null,
    });
  });

  (estimate.transformers || []).forEach((row, i) => {
    estimateQueries.insertRow.run({
      estimate_id: estimate.id,
      sort_order:  i,
      table_type:  'transformer',
      model:       row.model       || null,
      brand_model: row.brand_model || null,
      type:        null,
      qty:         parseInt(row.qty)          || null,
      watts:       null,
      unit_cost:   parseFloat(row.unit_cost)  || null,
      wire_ft:     null,
      va_rating:   parseFloat(row.va_rating)  || null,
    });
  });
});

// Load a full estimate (meta + rows) by id
function loadEstimate(id) {
  const meta = estimateQueries.getById.get(id);
  if (!meta) return null;
  const rows = estimateQueries.getRows.all(id);
  return {
    ...meta,
    settings:     JSON.parse(meta.settings || '{}'),
    fixtures:     rows.filter(r => r.table_type === 'fixture'),
    wire:         rows.filter(r => r.table_type === 'wire'),
    lamps:        rows.filter(r => r.table_type === 'lamp'),
    misc:         rows.filter(r => r.table_type === 'misc'),
    transformers: rows.filter(r => r.table_type === 'transformer'),
  };
}

// Load all estimate summaries (no rows — for the sidebar list)
function getAllEstimateSummaries() {
  return estimateQueries.getAll.all().map(e => ({
    ...e,
    settings: JSON.parse(e.settings || '{}'),
  }));
}

// All distinct folder names (non-null, non-empty)
const getAllFolders = db.prepare(`
  SELECT DISTINCT folder FROM estimates
  WHERE folder IS NOT NULL AND folder != ''
  ORDER BY folder
`);

module.exports = {
  db,
  fixtures:  fixtureQueries,
  estimates: estimateQueries,
  saveEstimate,
  loadEstimate,
  getAllEstimateSummaries,
  getAllFolders,
};
