// api.js — Radiant Toolkit API client
// All communication with the backend goes through these functions.
// Both HTML pages load this as a <script src="api.js">.

const API = (() => {

  async function request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  }

  // ── FIXTURES ───────────────────────────────────────────────────────────────

  function getFixtures()       { return request('GET',    '/api/fixtures'); }
  function saveFixture(id, f)  { return request('PUT',    `/api/fixtures/${id}`, f); }
  function deleteFixture(id)   { return request('DELETE', `/api/fixtures/${id}`); }

  // ── ESTIMATES ──────────────────────────────────────────────────────────────

  function getEstimates()           { return request('GET',    '/api/estimates'); }
  function getEstimate(id)          { return request('GET',    `/api/estimates/${id}`); }
  function saveEstimate(id, e)      { return request('PUT',    `/api/estimates/${id}`, e); }
  function patchEstimate(id, patch) { return request('PATCH',  `/api/estimates/${id}`, patch); }
  function deleteEstimate(id)       { return request('DELETE', `/api/estimates/${id}`); }
  function getFolders()             { return request('GET',    '/api/folders'); }

  return {
    getFixtures, saveFixture, deleteFixture,
    getEstimates, getEstimate, saveEstimate, patchEstimate, deleteEstimate,
    getFolders,
  };

})();
