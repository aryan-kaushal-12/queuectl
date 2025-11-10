import fs from 'fs';
import path from 'path';
import { createJob } from '../core/jobModel.js';

export async function enqueueCommand(jobJsonOrPath) {
  // If argument is path to file, read file; else parse JSON
  let jobObj;
  try {
    const maybePath = path.resolve(process.cwd(), jobJsonOrPath);
    if (fs.existsSync(maybePath)) {
      const content = fs.readFileSync(maybePath, 'utf-8');
      jobObj = JSON.parse(content);
    } else {
      jobObj = JSON.parse(jobJsonOrPath);
    }
  } catch (err) {
    console.error('Invalid JSON input or file path:', err.message);
    process.exit(2);
  }

  if (!jobObj.command) {
    console.error('Job JSON must include "command" field.');
    process.exit(2);
  }

  const id = createJob(jobObj);
  console.log('Enqueued job:', id);
}
