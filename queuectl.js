#!/usr/bin/env node
import { program } from 'commander';
import { enqueueCommand } from './src/cli/enqueue.js';
import { workerCommand } from './src/cli/worker.js';
import { listCommand } from './src/cli/list.js';
import { statusCommand } from './src/cli/status.js';

import { config } from './src/core/config.js';

program.name('queuectl').description('CLI for queuectl - simple job queue').version('0.1.0');

program
  .command('enqueue <jobJson>')
  .description('Enqueue a job. Provide JSON string or path to JSON file.')
  .action(enqueueCommand);

const worker = program
  .command('worker')
  .description('Worker commands');

worker
  .command('start')
  .option('-c, --count <number>', 'number of workers', '1')
  .option('-b, --base-backoff <number>', 'backoff base (overrides config)', null)
  .option('-m, --max-retries <number>', 'default max retries for new jobs', null)
  .description('Start worker(s) to process jobs (runs in foreground).')
  .action(workerCommand);

worker
  .command('stop')
  .description('Stop running worker process (sends SIGINT to PID in pidfile).')
  .action(async () => {
    await import('./src/cli/worker.js').then(m => m.stopWorkers());
  });


program
  .command('list')
  .option('-s, --state <state>', 'filter by state (pending|processing|completed|failed|dead)')
  .description('List jobs (optionally by state)')
  .action(listCommand);

program
  .command('status')
  .description('Show summary of job states & worker status')
  .action(statusCommand);


const dlq = program
  .command('dlq')
  .description('Dead Letter Queue commands');

dlq
  .command('list')
  .description('List Dead Letter Queue jobs')
  .action(async () => {
    const m = await import('./src/cli/dlq.js');
    return m.dlqList();
  });

dlq
  .command('retry <jobId>')
  .description('Retry a job from DLQ (resets attempts and moves to pending)')
  .action(async (jobId) => {
    const m = await import('./src/cli/dlq.js');
    return m.dlqRetry(jobId);
  });


program
  .command('config set <key> <value>')
  .description('Set configuration (max_retries, base_backoff)')
  .action(async (key, value) => {
    await config.set(key, value);
    console.log(`Config ${key} set to ${value}`);
  });

program.parse(process.argv);
