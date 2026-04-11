// server.js — Radiant Toolkit local estimator server
// Serves static frontend files and a JSON REST API backed by SQLite.
//
// API routes:
//   GET    /api/fixtures              — all fixtures
//   PUT    /api/fixtures/:id          — create or update a fixture
//   DELETE /api/fixtures/:id          — delete a fixture
//
//   GET    /api/estimates             — all estimate summaries (sidebar)
//   GET    /api/estimates/:id         — full estimate with rows
//   PUT    /api/estimates/:id         — save full estimate (upsert)
//   DELETE /api/estimates/:id         — delete estimate

'use strict';

const express = require('express');
const path    = require('path');
const {
  fixtures,
  saveEstimate,
  loadEstimate,
  getAllEstimateSummaries,
  db,
} = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static files (HTML, CSS) from the same directory as server.js
app.use(express.static(path.join(__dirname, 'public')));


// ── FIXTURES ──────────────────────────────────────────────────────────────────

// GET /api/fixtures — return all fixtures
app.get('/api/fixtures', (req, res) => {
  try {
    res.json(fixtures.getAll.all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/fixtures/:id — create or update a fixture
app.put('/api/fixtures/:id', (req, res) => {
  try {
    const body = req.body;
    if (!body.name?.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    fixtures.upsert.run({
      id:         req.params.id,
      name:       body.name?.trim()  || '',
      brand:      body.brand?.trim() || null,
      model:      body.model?.trim() || null,
      type:       body.type          || null,
      integrated: body.integrated    ? 1 : 0,
      watts:      body.watts    != null ? parseFloat(body.watts)   : null,
      cost:       body.cost     != null ? parseFloat(body.cost)    : null,
      cct:        body.cct?.trim()   || null,
      beam:       body.beam?.trim()  || null,
      wire_ft:    body.wire_ft  != null ? parseFloat(body.wire_ft) : null,
      notes:      body.notes?.trim() || null,
    });
    res.json(fixtures.getById.get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/fixtures/:id
app.delete('/api/fixtures/:id', (req, res) => {
  try {
    fixtures.delete.run(req.params.id);
    res.json({ deleted: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── ESTIMATES ─────────────────────────────────────────────────────────────────

// GET /api/estimates — all summaries for the sidebar
app.get('/api/estimates', (req, res) => {
  try {
    res.json(getAllEstimateSummaries());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/estimates/:id — full estimate with fixture/transformer rows
app.get('/api/estimates/:id', (req, res) => {
  try {
    const est = loadEstimate(req.params.id);
    if (!est) return res.status(404).json({ error: 'not found' });
    res.json(est);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/estimates/:id — full upsert (meta + all rows)
app.put('/api/estimates/:id', (req, res) => {
  try {
    const body = { ...req.body, id: req.params.id };
    saveEstimate(body);
    res.json(loadEstimate(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/estimates/:id
app.delete('/api/estimates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM estimates WHERE id = ?').run(req.params.id);
    res.json({ deleted: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── CATCH-ALL — SPA fallback ──────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Radiant Toolkit running at http://localhost:${PORT}`);
});
