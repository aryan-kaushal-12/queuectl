import db, { getConfigRow, setConfigRow } from './db.js';

export const config = {
  get: (key) => {
    const row = getConfigRow.get(key);
    return row ? row.value : null;
  },
  set: (key, value) => {
    setConfigRow.run(key, String(value));
  },
  getAll: () => {
    const rows = db.prepare('SELECT key, value FROM config').all();
    const out = {};
    rows.forEach(r => out[r.key] = r.value);
    return out;
  }
};
