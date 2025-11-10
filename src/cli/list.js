import { listJobs } from '../core/jobModel.js';
export async function listCommand(options) {
  const state = options.state;
  const rows = listJobs(state);
  if (!rows.length) {
    console.log('No jobs found.');
    return;
  }
  for (const r of rows) {
    console.log(`${r.id} | ${r.state} | attempts=${r.attempts}/${r.max_retries} | command="${r.command}" | next_run=${r.next_run ? new Date(r.next_run).toISOString() : 'immediate'}`);
  }
}
