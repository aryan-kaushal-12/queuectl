import { countByState } from '../core/jobModel.js';
import fs from 'fs';
import path from 'path';

export async function statusCommand() {
  const counts = countByState();
  const map = {};
  counts.forEach(c => map[c.state] = c.cnt);
  console.log('Job counts:');
  console.table(map);

  // Check pidfile for worker
  const pidFile = path.resolve(process.cwd(), 'queuectl.pid');
  let workerRunning = false;
  let pid = null;
  if (fs.existsSync(pidFile)) {
    pid = Number(fs.readFileSync(pidFile,'utf-8'));
    try {
      process.kill(pid, 0);
      workerRunning = true;
    } catch (e) {
      workerRunning = false;
    }
  }
  console.log('Worker running:', workerRunning ? `yes (pid ${pid})` : 'no');
}
