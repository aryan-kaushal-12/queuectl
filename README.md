# 🚀 QueueCTL — CLI-Based Background Job Queue System

QueueCTL is a lightweight **CLI-based background job queue** built with **Node.js**, **Commander**, and **SQLite**.  
It allows you to enqueue shell commands as jobs, process them with worker processes, handle retries using **exponential backoff**, and move permanently failed jobs to a **Dead Letter Queue (DLQ)** 
all from the command line.

---

## ⚙️ Setup Instructions

### 1️⃣ Prerequisites
- Node.js ≥ 18  
- npm ≥ 9  
- SQLite (no manual setup needed — auto-creates `jobs.db`)

### 2️⃣ Install dependencies
```bash
npm install
```

### 3️⃣ (Optional) Link globally for CLI access
```bash
npm link
```
This makes the command `queuectl` available globally.

Otherwise, you can always run it locally:
```bash
node queuectl.js <command>
```

---

## 💻 Usage Examples

### 🧱 Enqueue Jobs
Add new jobs to the queue (each job executes a shell command):

```bash
queuectl enqueue '{"command":"echo hello world"}'
queuectl enqueue '{"command":"bash -c \"exit 1\"","max_retries":2}'
queuectl enqueue '{"command":"sleep 2 && echo done"}'
```

Each job is stored in `jobs.db` with its metadata (`state`, `attempts`, `max_retries`, etc.).

---

### ⚙️ Start Workers
Start one or more workers to process jobs in foreground:
```bash
queuectl worker start --count 2
```

Optional flags:
- `--count` → number of worker threads (default: 1)
- `--base-backoff` → exponential backoff base (default: 2)
- `--max-retries` → default retry limit for new jobs (default: 3)

Stop workers gracefully:
```bash
queuectl worker stop
```

---

### 📋 List Jobs
View all jobs or filter by state:
```bash
queuectl list
queuectl list --state pending
queuectl list --state completed
```

---

### 📊 Check Status
Show summary of all job states and worker process status:
```bash
queuectl status
```

Example:
```
Job counts:
┌────────────┬─────┐
│ (index)    │ cnt │
├────────────┼─────┤
│ pending    │ 1   │
│ processing │ 0   │
│ completed  │ 5   │
│ failed     │ 2   │
│ dead       │ 1   │
└────────────┴─────┘
Worker running: yes (pid 32456)
```

---

### 💀 Dead Letter Queue (DLQ)
Jobs that exceed max retries move to the **DLQ**.

List DLQ jobs:
```bash
queuectl dlq list
```

Retry a job from DLQ:
```bash
queuectl dlq retry <jobId>
```

---

### ⚙️ Configuration
Change default retry/backoff settings at runtime:
```bash
queuectl config set max_retries 5
queuectl config set base_backoff 3
```

---

## 🧠 Architecture Overview

### 🧩 Components
| Component | Responsibility |
|------------|----------------|
| **CLI (Commander)** | User interface for all commands |
| **SQLite (better-sqlite3)** | Persistent storage for jobs and config |
| **Worker Engine** | Pulls pending jobs, executes them, updates their state |
| **Exponential Backoff** | Handles retry timing: `delay = base^attempt` seconds |
| **Dead Letter Queue (DLQ)** | Stores permanently failed jobs for manual retry |
| **Logger (Pino)** | Structured logs for all worker actions |

---

### 🌀 Job Lifecycle

```
          ┌───────────┐
          │  Enqueued │
          └──────┬────┘
                 │
                 ▼
           ┌────────────┐
           │ Processing  │
           └──────┬─────┘
         success  │  fail
                  ▼
        ┌─────────────────┐
        │ Retry (Backoff) │
        └──────┬──────────┘
               │
     exceeded retries
               ▼
         ┌────────────┐
         │ Dead Letter │
         └────────────┘
```

---

## ⚖️ Assumptions & Trade-offs

- Each job is a **shell command**, executed via [`execa`](https://github.com/sindresorhus/execa).
- Persistence handled via **SQLite** (local file `jobs.db`), ensuring durability between restarts.
- Concurrency managed at DB level using **WAL** mode and record locking.
- No message broker (like Redis/RabbitMQ) → simpler but limited scalability.
- Worker failure recovery is manual (PID file cleanup).
- Minimal external dependencies for portability.

---

## 🧪 Testing Instructions

### ✅ 1️⃣ Run a full demo
From project root:
```bash
bash demo/demo.sh
```
This automatically enqueues sample jobs, starts workers, and shows output.

### ✅ 2️⃣ Manual functional tests
- Enqueue several jobs (both successful and failing).
- Start multiple workers (`--count 2`) to verify concurrency.
- Check retries → failed jobs should move to DLQ.
- Retry DLQ job to confirm it returns to pending.

### ✅ 3️⃣ Verify persistence
1. Run a job, stop workers midway (`Ctrl+C`).
2. Restart workers → pending job should resume from `jobs.db`.

---

## 🧩 Folder Structure

```
queuectl/
├── queuectl.js              # Main CLI entry point
├── src/
│   ├── cli/                 # Command modules (enqueue, worker, dlq, etc.)
│   ├── core/                # Core logic (DB, job model, worker engine)
│   └── utils/               # Helper utilities (logger, backoff)
├── demo/                    # Demo scripts (demo.sh)
├── jobs.db                  # SQLite database (auto-generated)
└── package.json
```

---

## 🧰 Tech Stack

- **Node.js (ESM)**  
- **Commander** – CLI framework  
- **Better-SQLite3** – Embedded persistent store  
- **Execa** – Execute shell commands safely  
- **Pino** – Structured logging  

---

## 👨‍💻 Author

**Aryan Kaushal**  

