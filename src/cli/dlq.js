import { listJobs, retryDeadJob } from '../core/jobModel.js';
import chalk from 'chalk';

export async function dlqList() {
  const rows = listJobs('dead');
  if (!rows.length) {
    console.log('DLQ is empty.');
    return;
  }
  for (const r of rows) {
    console.log(`${chalk.red(r.id)} | attempts=${r.attempts}/${r.max_retries} | last_error="${chalk.yellow(r.last_error)}" | command="${chalk.blue(r.command)}"`);
  }
}

export async function dlqRetry(jobId) {
  try {
    await retryDeadJob(jobId);
    console.log('Job moved from DLQ to pending:', jobId);
  } catch (err) {
    console.error('Failed to retry DLQ job:', err.message);
    process.exit(2);
  }
}
