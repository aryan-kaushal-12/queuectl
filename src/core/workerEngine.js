import { claimOneJob, updateJobOnSuccess, updateJobOnFailure } from './jobModel.js';
import { logger } from '../utils/logger.js';
import {execaCommand} from 'execa';
import { getDelaySeconds } from '../utils/backoff.js';
import { config } from './config.js';

let shuttingDown = false;

export const createWorker = (workerId, options = {}) => {
  const baseBackoff = options.baseBackoff != null ? Number(options.baseBackoff) : Number(config.get('base_backoff') || 2);
  logger.info({ workerId, baseBackoff }, 'worker starting');

  let currentJob = null;

  const stop = async () => {
    logger.info({ workerId }, 'shutdown requested');
    shuttingDown = true;
    // wait until current job finishes
    while (currentJob) {
      logger.info({ workerId }, 'waiting for current job to finish...');
      await new Promise(r => setTimeout(r, 200));
    }
    logger.info({ workerId }, 'worker stopped');
  };

  const loop = async () => {
    while (!shuttingDown) {
      try {
        const job = claimOneJob(workerId);
        if (!job) {
          // nothing due, sleep a bit
          await new Promise(r => setTimeout(r, 500));
          continue;
        }

        currentJob = job;
        logger.info({ workerId, jobId: job.id, command: job.command }, 'claimed job');

        try {
          // run the command in shell
          const proc = execaCommand(job.command, { shell: true, stdio: 'inherit' });
          await proc;
          // execa resolves if exit 0
          updateJobOnSuccess(job.id);
          logger.info({ workerId, jobId: job.id }, 'job completed');
        } catch (err) {
          // execa throws on non-zero exit
          const errMsg = (err && err.message) ? String(err.message).slice(0, 1024) : 'unknown';
          logger.warn({ workerId, jobId: job.id, attempts: job.attempts, err: errMsg }, 'job failed');
          const defaultMaxRetries = job.max_retries || Number(config.get('max_retries') || 3);
          updateJobOnFailure(job.id, job.attempts, defaultMaxRetries, errMsg, baseBackoff);
        } finally {
          currentJob = null;
        }
      } catch (outer) {
        logger.error({ err: outer && outer.stack ? outer.stack : outer }, 'unexpected worker loop error');
        // small delay to avoid busy spin on errors
        await new Promise(r => setTimeout(r, 500));
      }
    }
  };

  return { loop, stop };
};
