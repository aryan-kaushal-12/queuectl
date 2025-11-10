import { createWorker } from '../core/workerEngine.js';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { config } from '../core/config.js';

const PID_PATH = path.resolve(process.cwd(), 'queuectl.pid');

export async function workerCommand(options) {
  const count = Number(options.count || 1);
  const baseBackoff = options.baseBackoff ? Number(options.baseBackoff) : null;
  const maxRetries = options.maxRetries ? Number(options.maxRetries) : null;

  // optional set config for new jobs
  if (maxRetries != null) {
    config.set('max_retries', String(maxRetries));
  }
  if (baseBackoff != null) {
    config.set('base_backoff', String(baseBackoff));
  }

  // write pidfile
  fs.writeFileSync(PID_PATH, String(process.pid), { encoding: 'utf-8' });
  logger.info({ pid: process.pid, count }, 'worker process started');

  const workers = [];
  for (let i = 0; i < count; i++) {
    const w = createWorker(`worker-${process.pid}-${i}`, { baseBackoff });
    workers.push(w);
    w.loop(); // start loop (runs until stopped)
  }

  // graceful shutdown handler
  const shutdown = async () => {
    logger.info('shutdown signal received - stopping workers gracefully');
    // signal workers to stop
    const stops = workers.map(w => w.stop());
    await Promise.all(stops);
    try { fs.unlinkSync(PID_PATH); } catch (e) {}
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // keep process alive
  // main thread waits until shutdown
  logger.info('workers started. Press Ctrl+C to stop.');
}

export async function stopWorkers() {
  try {
    if (!fs.existsSync(PID_PATH)) {
      console.log('No worker pidfile found.');
      return;
    }
    const pid = Number(fs.readFileSync(PID_PATH, 'utf-8'));
    if (!pid) {
      console.log('Invalid pidfile.');
      return;
    }
    try {
      process.kill(pid, 'SIGINT');
      console.log('Sent SIGINT to worker process', pid);
    } catch (err) {
      console.error('Failed to signal worker process:', err.message);
    }
  } catch (err) {
    console.error('Error stopping workers:', err.message);
  }
}
