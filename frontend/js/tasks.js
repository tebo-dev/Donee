import { request } from "./api.js";
import { logout, me } from "./auth.js";
import { $, setLoading } from "./ui.js";

const ACTIVE_WORKSPACE_KEY = "donee_active_workspace_id";

let currentWorkspace = null;
let currentTasks = [];
let currentOrder = "";

function getActiveWorkspaceId() {
  return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
}

function setActiveWorkspaceId(workspaceId) {
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  const fallback = new Date(`${value}T00:00:00`);
  if (!Number.isNaN(fallback.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(fallback);
  }

  return value;
}

function prettifyStatus(status) {
  if (!status) return "Unknown";
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderFeedback(message, type = "error") {
  const el = $("#pageFeedback");
  if (!el) return;

  el.className = `workspace-feedback ${type}`;
  el.textContent = message;
}

function clearFeedback() {
  const el = $("#pageFeedback");
  if (!el) return;

  el.className = "workspace-feedback";
  el.textContent = "";
}

async function requireAuth() {
  try {
    await me();
  } catch {
    window.location.href = "../auth/login.html";
    throw new Error("Not authenticated");
  }
}

async function getWorkspaces() {
  return request("/workspaces", { method: "GET" });
}

async function getWorkspaceById(workspaceId) {
  return request(`/workspaces/${workspaceId}`, { method: "GET" });
}

async function getWorkspaceTasks(workspaceId, orderBy = "") {
  const params = new URLSearchParams({ workspace_id: workspaceId });

  if (orderBy) {
    params.set("order_by", orderBy);
  }

  return request(`/tasks?${params.toString()}`, { method: "GET" });
}

async function getTaskById(taskId) {
  return request(`/tasks/${taskId}`, { method: "GET" });
}

async function createTask(payload) {
  return request("/tasks", {
    method: "POST",
    body: payload,
  });
}

async function updateTask(taskId, payload) {
  return request(`/tasks/${taskId}`, {
    method: "PATCH",
    body: payload,
  });
}

async function deleteTask(taskId) {
  return request(`/tasks/${taskId}`, {
    method: "DELETE",
  });
}

async function resolveActiveWorkspace() {
  const response = await getWorkspaces();
  const workspaces = Array.isArray(response?.workspaces) ? response.workspaces : [];

  if (!workspaces.length) {
    return null;
  }

  const storedId = getActiveWorkspaceId();
  const selected = workspaces.find((workspace) => workspace.id === storedId) || workspaces[0];

  setActiveWorkspaceId(selected.id);

  try {
    return await getWorkspaceById(selected.id);
  } catch {
    return selected;
  }
}

function renderSidebar() {
  const sidebar = $("#workspaceSidebar");
  if (!sidebar) return;

  sidebar.innerHTML = `
    <div class="workspace-brand">
      <h1 class="brand-title">DONEE</h1>
      <p class="workspace-brand-copy">Task foundation</p>
    </div>

    <div class="workspace-sidebar-card">
      <p class="workspace-sidebar-label">Current space</p>
      <h2 class="workspace-sidebar-name" id="sidebarWorkspaceName">Loading...</h2>
      <p class="workspace-sidebar-meta" id="sidebarWorkspaceMeta">Preparing workspace context.</p>
    </div>

    <nav class="workspace-nav">
      <a class="workspace-nav-link active" href="./workspace_home.html">
        <span>Overview & Tasks</span>
        <span class="workspace-nav-dot"></span>
      </a>

      <a class="workspace-nav-link" href="./workspace_switcher.html">
        <span>Workspace manager</span>
        <span class="workspace-nav-dot"></span>
      </a>

      <a class="workspace-nav-link" href="./workspace_settings.html">
        <span>Configuration</span>
        <span class="workspace-nav-dot"></span>
      </a>

      <button class="workspace-nav-button muted" type="button" disabled>
        <span>Projects</span>
        <span>Later</span>
      </button>
    </nav>

    <div class="workspace-sidebar-footer">
      <button class="workspace-secondary-btn" id="sidebarSwitchBtn" type="button">
        Manage workspaces
      </button>
      <button class="workspace-ghost-btn" id="logoutBtn" type="button">
        Log out
      </button>
    </div>
  `;

  $("#sidebarSwitchBtn")?.addEventListener("click", () => {
    window.location.href = "./workspace_switcher.html";
  });

  $("#logoutBtn")?.addEventListener("click", () => {
    logout();
    window.location.href = "../auth/login.html";
  });
}

function renderWorkspaceHeader(workspace) {
  if (!workspace) return;

  const pageTitle = $("#workspacePageTitle");
  const pageMeta = $("#workspacePageMeta");
  const sidebarName = $("#sidebarWorkspaceName");
  const sidebarMeta = $("#sidebarWorkspaceMeta");
  const minimapName = $("#workspaceMinimapName");

  if (pageTitle) pageTitle.textContent = workspace.name;
  if (pageMeta) pageMeta.textContent = `Created on ${formatDate(workspace.created_at)}`;
  if (sidebarName) sidebarName.textContent = workspace.name;
  if (sidebarMeta) sidebarMeta.textContent = `Created on ${formatDate(workspace.created_at)}`;
  if (minimapName) minimapName.textContent = workspace.name;

  $("#workspaceTitleTrigger")?.addEventListener("click", () => {
    window.location.href = "./workspace_switcher.html";
  });

  $("#workspaceSettingsBtn")?.addEventListener("click", () => {
    window.location.href = "./workspace_settings.html";
  });
}

function getStatusClass(status) {
  return `task-status task-status-${status || "unknown"}`;
}

function getPriorityClass(priority) {
  if (priority <= 1) return "task-priority-high";
  if (priority === 2) return "task-priority-medium";
  return "task-priority-low";
}

function renderTaskStats(total) {
  const totalEl = $("#taskTotal");
  const summaryEl = $("#taskSummary");

  if (totalEl) {
    totalEl.textContent = String(total);
  }

  if (summaryEl) {
    summaryEl.textContent =
      total === 1 ? "1 task in this workspace" : `${total} tasks in this workspace`;
  }
}

function renderTasks(tasks) {
  const list = $("#taskList");
  const empty = $("#taskEmptyState");

  if (!list) return;

  list.innerHTML = "";

  if (!tasks.length) {
    empty?.classList.add("show");
    return;
  }

  empty?.classList.remove("show");

  tasks.forEach((task) => {
    const article = document.createElement("article");
    article.className = "task-card";

    article.innerHTML = `
      <div class="task-card-head">
        <div class="task-card-title-wrap">
          <h3 class="task-card-title">${escapeHtml(task.title)}</h3>
          <p class="task-card-description">${escapeHtml(task.description || "No description.")}</p>
        </div>

        <div class="task-card-badges">
          <span class="${getStatusClass(task.status)}">${escapeHtml(prettifyStatus(task.status))}</span>
          <span class="task-priority ${getPriorityClass(task.priority)}">Priority ${escapeHtml(task.priority)}</span>
        </div>
      </div>

      <div class="task-card-meta">
        <div class="task-meta-item">
          <span class="task-meta-label">Due</span>
          <span class="task-meta-value">${escapeHtml(formatDate(task.due_at))}</span>
        </div>

        <div class="task-meta-item">
          <span class="task-meta-label">Project</span>
          <span class="task-meta-value">${task.project_id ? escapeHtml(task.project_id) : "No project"}</span>
        </div>

        <div class="task-meta-item">
          <span class="task-meta-label">Created</span>
          <span class="task-meta-value">${escapeHtml(formatDate(task.created_at))}</span>
        </div>

        <div class="task-meta-item">
          <span class="task-meta-label">Updated</span>
          <span class="task-meta-value">${escapeHtml(formatDate(task.updated_at))}</span>
        </div>

        ${
          task.completed_at
            ? `
              <div class="task-meta-item">
                <span class="task-meta-label">Completed</span>
                <span class="task-meta-value">${escapeHtml(formatDate(task.completed_at))}</span>
              </div>
            `
            : ""
        }
      </div>

      <div class="task-card-actions">
        <button class="workspace-mini-btn" type="button" data-action="edit" data-id="${task.id}">
          Edit
        </button>
        <button class="workspace-mini-btn muted" type="button" data-action="delete" data-id="${task.id}">
          Delete
        </button>
      </div>
    `;

    list.appendChild(article);
  });

  attachTaskCardEvents();
}

function attachTaskCardEvents() {
  document.querySelectorAll("[data-action='edit']").forEach((button) => {
    button.addEventListener("click", async () => {
      const taskId = button.dataset.id;
      await openEditTaskModal(taskId);
    });
  });

  document.querySelectorAll("[data-action='delete']").forEach((button) => {
    button.addEventListener("click", async () => {
      const taskId = button.dataset.id;
      await handleDeleteTask(taskId);
    });
  });
}

function openTaskModal(mode = "create", task = null) {
  const overlay = $("#taskModalOverlay");
  const title = $("#taskModalTitle");
  const submitBtn = $("#taskSubmitBtn");
  const form = $("#taskForm");
  const statusRow = $("#taskStatusRow");
  const completedHint = $("#taskCompletedHint");

  if (!overlay || !form) return;

  form.reset();
  $("#taskError").classList.remove("show");
  $("#taskError").textContent = "";

  $("#taskId").value = "";
  $("#taskTitle").value = "";
  $("#taskDescription").value = "";
  $("#taskPriority").value = "3";
  $("#taskDueAt").value = "";
  $("#taskProjectId").value = "";
  $("#taskStatus").value = "to do";

  if (mode === "create") {
    title.textContent = "Create new task";
    submitBtn.textContent = "Create task";
    statusRow.classList.add("hidden");
    completedHint.classList.add("hidden");
  } else {
    title.textContent = "Edit task";
    submitBtn.textContent = "Save changes";
    statusRow.classList.remove("hidden");

    $("#taskId").value = task.id;
    $("#taskTitle").value = task.title || "";
    $("#taskDescription").value = task.description || "";
    $("#taskPriority").value = String(task.priority ?? 3);
    $("#taskDueAt").value = task.due_at || "";
    $("#taskProjectId").value = task.project_id || "";
    $("#taskStatus").value = task.status || "to do";

    if (task.completed_at) {
      completedHint.textContent = `Completed on ${formatDate(task.completed_at)}`;
      completedHint.classList.remove("hidden");
    } else {
      completedHint.classList.add("hidden");
      completedHint.textContent = "";
    }
  }

  overlay.dataset.mode = mode;
  overlay.classList.remove("hidden");
}

function closeTaskModal() {
  const overlay = $("#taskModalOverlay");
  if (!overlay) return;

  overlay.classList.add("hidden");
}

async function openEditTaskModal(taskId) {
  try {
    clearFeedback();
    const task = await getTaskById(taskId);
    openTaskModal("edit", task);
  } catch (error) {
    renderFeedback(error.message || "Could not load task details.");
  }
}

function normalizeProjectId(value) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildCreatePayload() {
  return {
    title: $("#taskTitle").value.trim(),
    description: $("#taskDescription").value.trim(),
    priority: Number($("#taskPriority").value),
    due_at: $("#taskDueAt").value,
    project_id: normalizeProjectId($("#taskProjectId").value),
    workspace_id: currentWorkspace.id,
  };
}

function buildUpdatePayload() {
  return {
    title: $("#taskTitle").value.trim(),
    description: $("#taskDescription").value.trim(),
    status: $("#taskStatus").value,
    priority: Number($("#taskPriority").value),
    due_at: $("#taskDueAt").value,
    project_id: normalizeProjectId($("#taskProjectId").value),
    workspace_id: currentWorkspace.id,
  };
}

function validateTaskPayload(payload, isEdit = false) {
  if (!payload.title || payload.title.length < 2) {
    return "Task title must contain at least 2 characters.";
  }

  if (!payload.description) {
    return "Task description is required.";
  }

  if (!payload.due_at) {
    return "Due date is required.";
  }

  if (!Number.isInteger(payload.priority) || payload.priority < 1) {
    return "Priority must be a valid number.";
  }

  if (isEdit && !payload.status) {
    return "Task status is required while editing.";
  }

  return null;
}

async function handleTaskSubmit(event) {
  event.preventDefault();

  const overlay = $("#taskModalOverlay");
  const mode = overlay?.dataset.mode || "create";
  const errorEl = $("#taskError");
  const submitBtn = $("#taskSubmitBtn");

  errorEl.classList.remove("show");
  errorEl.textContent = "";

  const payload = mode === "edit" ? buildUpdatePayload() : buildCreatePayload();
  const validationError = validateTaskPayload(payload, mode === "edit");

  if (validationError) {
    errorEl.textContent = validationError;
    errorEl.classList.add("show");
    return;
  }

  setLoading(submitBtn, true);

  try {
    if (mode === "edit") {
      const taskId = $("#taskId").value;
      await updateTask(taskId, payload);
      renderFeedback("Task updated successfully.", "success");
    } else {
      await createTask(payload);
      renderFeedback("Task created successfully.", "success");
    }

    closeTaskModal();
    await loadTasks();
  } catch (error) {
    errorEl.textContent = error.message || "Something went wrong while saving the task.";
    errorEl.classList.add("show");
  } finally {
    setLoading(submitBtn, false);
  }
}

async function handleDeleteTask(taskId) {
  const confirmed = window.confirm("Are you sure you want to delete this task?");

  if (!confirmed) return;

  try {
    await deleteTask(taskId);
    renderFeedback("Task deleted successfully.", "success");
    await loadTasks();
  } catch (error) {
    renderFeedback(error.message || "Could not delete the task.");
  }
}

async function loadTasks() {
  if (!currentWorkspace) return;

  try {
    clearFeedback();

    const response = await getWorkspaceTasks(currentWorkspace.id, currentOrder);
    currentTasks = Array.isArray(response?.tasks) ? response.tasks : [];

    renderTaskStats(response?.total ?? currentTasks.length);
    renderTasks(currentTasks);
  } catch (error) {
    renderFeedback(error.message || "Could not load workspace tasks.");
  }
}

function bindControls() {
  $("#openCreateTaskBtn")?.addEventListener("click", () => {
    openTaskModal("create");
  });

  $("#taskModalCloseBtn")?.addEventListener("click", closeTaskModal);
  $("#taskModalCancelBtn")?.addEventListener("click", closeTaskModal);

  $("#taskModalOverlay")?.addEventListener("click", (event) => {
    if (event.target.id === "taskModalOverlay") {
      closeTaskModal();
    }
  });

  $("#taskForm")?.addEventListener("submit", handleTaskSubmit);

  $("#taskOrderSelect")?.addEventListener("change", async (event) => {
    currentOrder = event.target.value;
    await loadTasks();
  });
}

async function boot() {
  await requireAuth();
  renderSidebar();
  bindControls();

  currentWorkspace = await resolveActiveWorkspace();

  if (!currentWorkspace) {
    renderFeedback("No workspace available yet. Create one first from the workspace manager.");
    $("#taskEmptyState")?.classList.add("show");
    return;
  }

  renderWorkspaceHeader(currentWorkspace);
  await loadTasks();
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await boot();
  } catch {
    // Auth redirect already in progress — do nothing
  }
});
