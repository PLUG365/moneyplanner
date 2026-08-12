import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { createCanvas, joinSession } from "@github/copilot-sdk/extension";

const servers = new Map();
let session;

function getStoragePath() {
    const baseDir = session?.workspacePath ?? process.cwd();
    return path.join(baseDir, ".copilot", "todo-board", "tasks.json");
}

async function ensureStorage() {
    const filePath = getStoragePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    try {
        await fs.access(filePath);
    } catch {
        await fs.writeFile(filePath, JSON.stringify({ tasks: [] }, null, 2), "utf8");
    }
    return filePath;
}

async function loadTasks() {
    const filePath = await ensureStorage();
    const raw = await fs.readFile(filePath, "utf8");
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed.tasks) ? parsed.tasks : [];
    } catch {
        return [];
    }
}

async function saveTasks(tasks) {
    const filePath = await ensureStorage();
    await fs.writeFile(filePath, JSON.stringify({ tasks }, null, 2), "utf8");
}

function buildTask(task) {
    return {
        id: task.id ?? crypto.randomUUID(),
        title: String(task.title ?? "Untitled task").trim(),
        notes: String(task.notes ?? "").trim(),
        status: ["todo", "in_progress", "done"].includes(task.status) ? task.status : "todo",
        priority: ["low", "medium", "high"].includes(task.priority) ? task.priority : "medium",
        createdAt: task.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

function renderHtml() {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Task Board</title>
    <style>
      :root {
        --bg: #f6f8fb;
        --panel: #ffffff;
        --panel-alt: #eef4ff;
        --border: #dbe2ea;
        --text: #1f2a37;
        --muted: #667085;
        --accent: #2563eb;
        --accent-soft: #dbeafe;
        --success: #16a34a;
        --warning: #f59e0b;
        --danger: #dc2626;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: Inter, "Segoe UI", sans-serif;
      }
      .shell {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px 16px 40px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
      }
      h1 {
        margin: 0;
        font-size: clamp(24px, 4vw, 36px);
      }
      .pill {
        background: var(--panel-alt);
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 8px 12px;
        font-size: 12px;
        color: var(--muted);
        font-weight: 600;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 16px;
        box-shadow: 0 6px 24px rgba(15, 23, 42, 0.04);
      }
      .composer {
        padding: 18px;
      }
      .grid {
        display: grid;
        grid-template-columns: 1.7fr 0.8fr 0.8fr;
        gap: 12px;
      }
      label {
        display: block;
        margin-bottom: 8px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
      }
      input, textarea, select, button {
        width: 100%;
        border-radius: 10px;
        border: 1px solid var(--border);
        padding: 10px 12px;
        font: inherit;
      }
      textarea {
        min-height: 70px;
        resize: vertical;
      }
      input:focus, textarea:focus, select:focus, button:focus {
        outline: 2px solid rgba(37, 99, 235, 0.2);
        border-color: var(--accent);
      }
      .actions {
        display: flex;
        gap: 12px;
        margin-top: 16px;
      }
      button {
        cursor: pointer;
        border: none;
        font-weight: 700;
      }
      .primary {
        background: var(--accent);
        color: white;
      }
      .secondary {
        background: #f2f4f7;
        color: var(--text);
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin: 18px 0;
      }
      .metric {
        padding: 16px;
      }
      .metric span {
        display: block;
        color: var(--muted);
        font-size: 12px;
        margin-bottom: 8px;
      }
      .metric strong {
        font-size: 24px;
      }
      .list {
        display: grid;
        gap: 12px;
        margin-top: 12px;
      }
      .task {
        padding: 16px;
        display: grid;
        gap: 10px;
      }
      .task-head {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 12px;
      }
      .task-head h3 {
        margin: 0;
        font-size: 18px;
      }
      .badge {
        border-radius: 999px;
        padding: 5px 10px;
        font-size: 11px;
        font-weight: 700;
        border: 1px solid transparent;
      }
      .badge.todo { background: #eff6ff; color: #1d4ed8; }
      .badge.in_progress { background: #fef3c7; color: #b45309; }
      .badge.done { background: #dcfce7; color: #15803d; }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        color: var(--muted);
        font-size: 12px;
      }
      .task-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .small {
        padding: 8px 10px;
        font-size: 12px;
      }
      .status-select {
        min-width: 140px;
      }
      .hidden {
        display: none;
      }
      @media (max-width: 700px) {
        .grid, .summary {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="header">
        <h1>Task Board</h1>
        <div class="pill" id="board-status">0 tasks</div>
      </div>

      <section class="panel composer">
        <div class="grid">
          <div>
            <label for="task-title">Task</label>
            <input id="task-title" placeholder="What needs to be done?" />
          </div>
          <div>
            <label for="task-priority">Priority</label>
            <select id="task-priority">
              <option value="high">High</option>
              <option value="medium" selected>Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label for="task-status">Status</label>
            <select id="task-status">
              <option value="todo" selected>To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>
        <div style="margin-top: 12px;">
          <label for="task-notes">Notes</label>
          <textarea id="task-notes" placeholder="Add context or a checklist..."></textarea>
        </div>
        <div class="actions">
          <button class="primary" id="add-task">Add task</button>
          <button class="secondary" id="clear-completed">Clear completed</button>
        </div>
      </section>

      <section class="summary">
        <div class="panel metric"><span>Total</span><strong id="total-count">0</strong></div>
        <div class="panel metric"><span>In progress</span><strong id="progress-count">0</strong></div>
        <div class="panel metric"><span>Done</span><strong id="done-count">0</strong></div>
      </section>

      <section id="task-list" class="list"></section>
    </div>

    <script>
      const state = { tasks: [] };

      async function api(path, options = {}) {
        const response = await fetch(path, {
          headers: { "Content-Type": "application/json" },
          ...options,
        });
        const text = await response.text();
        if (!text) return null;
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }

      function renderTask(task) {
        const item = document.createElement("article");
        item.className = "panel task";

        const statusLabel = task.status === "done" ? "Done" : task.status === "in_progress" ? "In progress" : "To do";
        const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);

        item.innerHTML = `
          <div class="task-head">
            <h3>${escapeHtml(task.title)}</h3>
            <span class="badge ${task.status}">${statusLabel}</span>
          </div>
          <div class="meta">
            <span>Priority: ${priorityLabel}</span>
            <span>Updated: ${new Date(task.updatedAt).toLocaleDateString()}</span>
          </div>
          ${task.notes ? `<div>${escapeHtml(task.notes).replace(/\n/g, "<br />")}</div>` : ""}
          <div class="task-actions">
            <select class="status-select small" data-role="status" data-id="${task.id}">
              <option value="todo" ${task.status === "todo" ? "selected" : ""}>To do</option>
              <option value="in_progress" ${task.status === "in_progress" ? "selected" : ""}>In progress</option>
              <option value="done" ${task.status === "done" ? "selected" : ""}>Done</option>
            </select>
            <button class="secondary small" data-role="delete" data-id="${task.id}">Delete</button>
          </div>
        `;
        return item;
      }

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      function updateSummary() {
        const total = state.tasks.length;
        const done = state.tasks.filter((task) => task.status === "done").length;
        const inProgress = state.tasks.filter((task) => task.status === "in_progress").length;

        document.getElementById("board-status").textContent = `${total} task${total === 1 ? "" : "s"}`;
        document.getElementById("total-count").textContent = String(total);
        document.getElementById("progress-count").textContent = String(inProgress);
        document.getElementById("done-count").textContent = String(done);
      }

      function render() {
        const list = document.getElementById("task-list");
        list.innerHTML = "";
        state.tasks.forEach((task) => list.appendChild(renderTask(task)));
        updateSummary();
      }

      async function refresh() {
        const result = await api("/api/tasks");
        state.tasks = Array.isArray(result) ? result : [];
        render();
      }

      document.getElementById("add-task").addEventListener("click", async () => {
        const title = document.getElementById("task-title").value.trim();
        const notes = document.getElementById("task-notes").value.trim();
        const priority = document.getElementById("task-priority").value;
        const status = document.getElementById("task-status").value;

        if (!title) {
          document.getElementById("task-title").focus();
          return;
        }

        await api("/api/tasks", {
          method: "POST",
          body: JSON.stringify({ title, notes, priority, status }),
        });

        document.getElementById("task-title").value = "";
        document.getElementById("task-notes").value = "";
        document.getElementById("task-priority").value = "medium";
        document.getElementById("task-status").value = "todo";
        refresh();
      });

      document.getElementById("clear-completed").addEventListener("click", async () => {
        await api("/api/tasks/clear-completed", { method: "POST" });
        refresh();
      });

      document.getElementById("task-list").addEventListener("change", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || target.dataset.role !== "status") return;
        const id = target.dataset.id;
        const status = target.value;
        await api(`/api/tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        refresh();
      });

      document.getElementById("task-list").addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || target.dataset.role !== "delete") return;
        const id = target.dataset.id;
        await api(`/api/tasks/${id}`, { method: "DELETE" });
        refresh();
      });

      refresh();
    </script>
  </body>
</html>`;
}

function createJsonResponse(statusCode, payload, res) {
    res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(payload));
}

async function startServer(instanceId) {
    const server = createServer(async (req, res) => {
        const url = new URL(req.url, "http://127.0.0.1");

        if (req.method === "GET" && url.pathname === "/") {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(renderHtml());
            return;
        }

        if (req.method === "GET" && url.pathname === "/api/tasks") {
            const tasks = await loadTasks();
            createJsonResponse(200, tasks, res);
            return;
        }

        if (req.method === "POST" && url.pathname === "/api/tasks") {
            let body = "";
            req.on("data", (chunk) => { body += chunk; });
            req.on("end", async () => {
                try {
                    const payload = JSON.parse(body || "{}");
                    const tasks = await loadTasks();
                    const task = buildTask({
                        id: crypto.randomUUID(),
                        title: payload.title,
                        notes: payload.notes,
                        status: payload.status,
                        priority: payload.priority,
                    });
                    const nextTasks = [task, ...tasks];
                    await saveTasks(nextTasks);
                    createJsonResponse(201, task, res);
                } catch (error) {
                    createJsonResponse(400, { error: "Invalid task payload" }, res);
                }
            });
            return;
        }

        if (req.method === "POST" && url.pathname === "/api/tasks/clear-completed") {
            const tasks = (await loadTasks()).filter((task) => task.status !== "done");
            await saveTasks(tasks);
            createJsonResponse(200, tasks, res);
            return;
        }

        const taskId = url.pathname.match(/^\/api\/tasks\/([^/]+)$/)?.[1];
        if (taskId) {
            const tasks = await loadTasks();
            const index = tasks.findIndex((task) => task.id === taskId);

            if (req.method === "PATCH") {
                let body = "";
                req.on("data", (chunk) => { body += chunk; });
                req.on("end", async () => {
                    try {
                        const payload = JSON.parse(body || "{}");
                        if (index === -1) {
                            createJsonResponse(404, { error: "Task not found" }, res);
                            return;
                        }
                        const nextTask = buildTask({ ...tasks[index], ...payload, updatedAt: new Date().toISOString() });
                        tasks[index] = nextTask;
                        await saveTasks(tasks);
                        createJsonResponse(200, nextTask, res);
                    } catch {
                        createJsonResponse(400, { error: "Invalid update payload" }, res);
                    }
                });
                return;
            }

            if (req.method === "DELETE") {
                if (index === -1) {
                    createJsonResponse(404, { error: "Task not found" }, res);
                    return;
                }
                tasks.splice(index, 1);
                await saveTasks(tasks);
                createJsonResponse(200, { deleted: true }, res);
                return;
            }
        }

        createJsonResponse(404, { error: "Not found" }, res);
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}/`, instanceId };
}

session = await joinSession({
    canvases: [
        createCanvas({
            id: "todo-board",
            displayName: "Task Board",
            description: "Manage a personal to-do list with priorities, notes, and progress status.",
            actions: [
                {
                    name: "list_tasks",
                    description: "List the current tasks and their statuses.",
                    handler: async () => {
                        return await loadTasks();
                    },
                },
                {
                    name: "add_task",
                    description: "Add a new task to the board.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            notes: { type: "string" },
                            priority: { type: "string", enum: ["low", "medium", "high"] },
                            status: { type: "string", enum: ["todo", "in_progress", "done"] },
                        },
                        required: ["title"],
                    },
                    handler: async (ctx) => {
                        const { title, notes = "", priority = "medium", status = "todo" } = ctx.input ?? {};
                        const tasks = await loadTasks();
                        const task = buildTask({ title, notes, priority, status });
                        const nextTasks = [task, ...tasks];
                        await saveTasks(nextTasks);
                        return task;
                    },
                },
                {
                    name: "clear_completed",
                    description: "Remove all tasks marked as done.",
                    handler: async () => {
                        const nextTasks = (await loadTasks()).filter((task) => task.status !== "done");
                        await saveTasks(nextTasks);
                        return nextTasks;
                    },
                },
            ],
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(ctx.instanceId);
                    servers.set(ctx.instanceId, entry);
                }
                return {
                    title: "Task Board",
                    status: `${(await loadTasks()).length} tasks`,
                    url: entry.url,
                };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(() => resolve()));
                }
            },
        }),
    ],
});
