#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# Use QUEUECTL_BIN if set, otherwise use 'queuectl' in PATH
QUEUECTL_BIN="${QUEUECTL_BIN:-queuectl}"

cleanup() {
  echo "Cleaning up..."
  # if pidfile exists and points to this pid, remove it
  if [[ -f queuectl.pid ]]; then
    pid=$(<queuectl.pid)
    # if pid matches our background worker pid, delete it
    if [[ -n "${BG_PID:-}" && "$pid" -eq "$BG_PID" ]]; then
      rm -f queuectl.pid
    fi
  fi
}
trap cleanup EXIT

echo "Enqueue jobs..."
# Use here-doc for clearer JSON
"$QUEUECTL_BIN" enqueue '{"id":"job1","command":"echo hello; exit 0"}'
"$QUEUECTL_BIN" enqueue '{"id":"job2","command":"bash -c \"exit 1\"","max_retries":2}'
"$QUEUECTL_BIN" enqueue '{"id":"job3","command":"sleep 2 && echo done"}'

echo "Start 2 workers (background)..."
# Start worker process in background and capture its PID; do not overwrite pidfile if worker writes it
node queuectl.js worker start --count 2 > worker.log 2>&1 &
BG_PID=$!
echo "Worker process started, bg pid=$BG_PID (logs -> worker.log)"

# wait until queuectl.pid exists and refers to a running process (timeout)
timeout=10
echo "Waiting for pidfile..."
while [[ $timeout -gt 0 ]]; do
  if [[ -f queuectl.pid ]]; then
    pid=$(<queuectl.pid)
    if kill -0 "$pid" 2>/dev/null; then
      echo "Worker pidfile present and process $pid is running."
      break
    fi
  fi
  sleep 1
  timeout=$((timeout-1))
done

if [[ $timeout -le 0 ]]; then
  echo "Timed out waiting for worker to start. Check worker.log"
  exit 1
fi

echo "Status:"
"$QUEUECTL_BIN" status

echo "Wait 6s to allow jobs to process..."
sleep 6

echo "List all jobs:"
"$QUEUECTL_BIN" list

echo "List DLQ:"
"$QUEUECTL_BIN" dlq list

echo "Stop workers"
"$QUEUECTL_BIN" worker stop

# Wait a bit for graceful shutdown
sleep 2
echo "Done demo."
