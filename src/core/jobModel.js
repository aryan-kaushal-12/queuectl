import db from './db.js';
import { randomUUID } from 'crypto';

/**
 Fields:
 id, command, state, attempts, max_retries, created_at, updated_at, next_run, locked_by, last_error
 **/

const nowIso = () => new Date().toISOString();
const nowMs = () => Date.now();

export const createJob = (jobInput) => {
  const id = jobInput.id || randomUUID();
  const created_at = nowIso();
  const updated_at = created_at;
  const next_run = jobInput.next_run ? Number(jobInput.next_run) : 0;
  const max_retries = ('max_retries' in jobInput) ? Number(jobInput.max_retries) : 3;
  const stmt = db.prepare(`INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at, next_run, locked_by, last_error)
                           VALUES (@id, @command, @state, @attempts, @max_retries, @created_at, @updated_at, @next_run, NULL, NULL)`);
  stmt.run({
    id,
    command: jobInput.command,
    state: jobInput.state || 'pending',
    attempts: jobInput.attempts || 0,
    max_retries,
    created_at, updated_at, next_run
  });
  return id;
};

// Atomically claim one job that is due (next_run <= now) and state = 'pending'
const claimJobTxn = db.transaction((workerId) => {
  const now = Date.now();
  // select
  const row = db.prepare(`
    SELECT id, command, state, attempts, max_retries, created_at, updated_at, next_run
    FROM jobs
    WHERE state = 'pending' AND next_run <= ?
    ORDER BY created_at
    LIMIT 1
  `).get(now);

  if (!row) return null;

  // update to processing if still pending
  const updated = db.prepare(`
    UPDATE jobs
    SET state = 'processing', locked_by = ?, updated_at = ?
    WHERE id = ? AND state = 'pending'
  `).run(workerId, new Date().toISOString(), row.id);

  if (updated.changes === 1) {
    const fresh = db.prepare('SELECT * FROM jobs WHERE id = ?').get(row.id);
    return fresh;
  } else {
    // lost race
    return null;
  }
});

export const claimOneJob = (workerId) => {
  return claimJobTxn(workerId);
};

export const updateJobOnSuccess = (id) => {
  db.prepare(`UPDATE jobs SET state = 'completed', updated_at = ? , locked_by = NULL WHERE id = ?`)
    .run(new Date().toISOString(), id);
};

export const updateJobOnFailure = (id, attempts, max_retries, errMsg, baseBackoff) => {
  const nextAttempts = attempts + 1;
  if (nextAttempts > max_retries) {
    // move to dead
    db.prepare(`UPDATE jobs SET state = 'dead', attempts = ?, last_error = ?, updated_at = ?, locked_by = NULL WHERE id = ?`)
      .run(nextAttempts, errMsg, new Date().toISOString(), id);
  } else {
    // schedule next_run using exponential backoff: delay = base ^ attempts (in seconds)
    const delaySeconds = Math.pow(baseBackoff, nextAttempts);
    const nextRunMs = Date.now() + Math.round(delaySeconds * 1000);
    db.prepare(`UPDATE jobs SET state = 'failed', attempts = ?, last_error = ?, next_run = ?, updated_at = ?, locked_by = NULL WHERE id = ?`)
      .run(nextAttempts, errMsg, nextRunMs, new Date().toISOString(), id);
  }
};

export const listJobs = (state) => {
  if (state) {
    return db.prepare('SELECT * FROM jobs WHERE state = ? ORDER BY created_at').all(state);
  } else {
    return db.prepare('SELECT * FROM jobs ORDER BY created_at').all();
  }
};

export const getJobById = (id) => {
  return db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
};

export const retryDeadJob = (id) => {
  const job = getJobById(id);
  if (!job) throw new Error('job not found');
  if (job.state !== 'dead') throw new Error('job is not in DLQ');
  db.prepare(`UPDATE jobs SET state = 'pending', attempts = 0, next_run = 0, last_error = NULL, updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), id);
};

export const countByState = () => {
  return db.prepare(`
    SELECT state, COUNT(*) as cnt FROM jobs GROUP BY state
  `).all();
};
