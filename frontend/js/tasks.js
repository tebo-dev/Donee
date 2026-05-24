import { request } from "./api.js";
import { logout, me } from "./auth.js";
import { $, setLoading } from "./ui.js";

const ACTIVE_WORKSPACE_KEY = "donee_active_workspace_id";

let currentWorkspace = null;
let currentTasks = [];
let currentOrder = "";
let detailSnapshot = null;
let currentDetailTask = null;

// ---- Utils ----

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
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(date);
  }
  const fallback = new Date(`${value}T00:00:00`);
  if (!Number.isNaN(fallback.getTime())) {
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(fallback);
  }
  return value;
}

function prettifyStatus(status) {
  if (!status) return "Unknown";
  return status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

// ---- Auth ----

async function requireAuth() {
  try {
    await me();
  } catch {
    window.location.href = "../auth/login.html";
    throw new Error("Not authenticated");
  }
}

// ---- API ----

async function getWorkspaces() {
  return request("/workspaces", { method: "GET" });
}

async function getWorkspaceById(workspaceId) {
  return request(`/workspaces/${workspaceId}`, { method: "GET" });
}

async function getWorkspaceTasks(workspaceId, orderBy = "") {
  const params = new URLSearchParams({ workspace_id: workspaceId });
  if (orderBy) params.set("order_by", orderBy);
  return request(`/tasks?${params.toString()}`, { method: "GET" });
}

async function createTask(payload) {
  return request("/tasks", { method: "POST", body: payload });
}

async function updateTask(taskId, payload) {
  return request(`/tasks/${taskId}`, { method: "PATCH", body: payload });
}

async function deleteTask(taskId) {
  return request(`/tasks/${taskId}`, { method: "DELETE" });
}

async function resolveActiveWorkspace() {
  const response = await getWorkspaces();
  const workspaces = Array.isArray(response?.workspaces) ? response.workspaces : [];
  if (!workspaces.length) return null;
  const storedId = getActiveWorkspaceId();
  const selected = workspaces.find((w) => w.id === storedId) || workspaces[0];
  setActiveWorkspaceId(selected.id);
  try {
    return await getWorkspaceById(selected.id);
  } catch {
    return selected;
  }
}

// ---- Sidebar ----

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
        <span>Overview &amp; Tasks</span>
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

// ---- Workspace header + inline rename ----

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

  const switcherTrigger = $("#workspaceTitleTrigger");
  if (switcherTrigger) {
    switcherTrigger.addEventListener("click", () => {
      const titleEl = $("#workspacePageTitle");
      if (!titleEl) return;
      if (switcherTrigger.querySelector(".workspace-title-input")) return;

      const currentName = currentWorkspace?.name;
      if (!currentName) return;

      const input = document.createElement("input");
      input.type = "text";
      input.className = "workspace-title-input";
      input.value = currentName;
      input.setAttribute("aria-label", "Workspace name");

      titleEl.replaceWith(input);
      input.focus();
      input.select();

      const restoreTitle = (name) => {
        const h1 = document.createElement("h1");
        h1.className = "workspace-title";
        h1.id = "workspacePageTitle";
        h1.textContent = name;
        if (document.contains(input)) input.replaceWith(h1);
      };

      const doSave = async () => {
        const newName = input.value.trim();
        if (!newName || newName === currentName) { restoreTitle(currentName); return; }
        input.disabled = true;
        try {
          await request(`/workspaces/${currentWorkspace.id}`, {
            method: "PATCH",
            body: { name: newName },
          });
          currentWorkspace.name = newName;
          restoreTitle(newName);
          if (sidebarName) sidebarName.textContent = newName;
          if (minimapName) minimapName.textContent = newName;
          renderFeedback("Workspace renamed successfully.", "success");
        } catch (err) {
          input.disabled = false;
          renderFeedback(err.message || "Could not rename workspace.", "error");
          restoreTitle(currentName);
        }
      };

      let cancelled = false;
      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { cancelled = true; restoreTitle(currentName); }
        if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      });
      input.addEventListener("blur", () => { if (!cancelled) doSave(); });
    });
  }

  $("#workspaceSettingsBtn")?.addEventListener("click", () => {
    window.location.href = "./workspace_settings.html";
  });
}

// ---- Status & priority helpers ----

function getStatusClass(status) {
  return `task-status task-status-${status?.replace(/_/g, "-") || "unknown"}`;
}

function getPriorityLabel(priority) {
  if (priority <= 1) return "Highest";
  if (priority === 2) return "High";
  if (priority === 3) return "Medium";
  if (priority === 4) return "Low";
  return "Lowest";
}

function getPriorityClass(priority) {
  if (priority <= 1) return "task-priority-high";
  if (priority === 2) return "task-priority-medium";
  return "task-priority-low";
}

// ---- Task count badge ----

function renderTaskCount(total) {
  const badge = $("#minimapTaskCount");
  if (badge) badge.textContent = `${total} task${total === 1 ? "" : "s"}`;
}

// ---- Task card (compact view) ----

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
    article.dataset.id = task.id;

    article.innerHTML = `
      <div class="task-card-head">
        <div class="task-card-title-wrap">
          <h3 class="task-card-title">${escapeHtml(task.title)}</h3>
          <p class="task-card-description">${escapeHtml(task.description || "No description.")}</p>
        </div>
        <div class="task-card-badges">
          <span class="${getStatusClass(task.status)}">${escapeHtml(prettifyStatus(task.status))}</span>
          <span class="task-priority ${getPriorityClass(task.priority)}">P${escapeHtml(String(task.priority))}</span>
        </div>
      </div>
      <div class="task-card-footer">
        <span class="task-card-due">Due ${escapeHtml(formatDate(task.due_at))}</span>
        <span class="task-card-expand-hint">Click to open →</span>
      </div>
    `;

    article.addEventListener("click", () => openTaskDetail(task));
    list.appendChild(article);
  });
}

// ---- Task detail panel ----

function buildDetailSnapshot() {
  return {
    title: $("#detailTitle")?.value || "",
    description: $("#detailDescription")?.value || "",
    status: $("#detailStatus")?.value || "",
    priority: $("#detailPriority")?.value || "",
    due_at: $("#detailDueAt")?.value || "",
  };
}

function hasDetailChanges() {
  if (!detailSnapshot) return false;
  const current = buildDetailSnapshot();
  return Object.keys(detailSnapshot).some((key) => current[key] !== detailSnapshot[key]);
}

function updateDetailSaveBtn() {
  const saveBtn = $("#detailSaveBtn");
  if (!saveBtn) return;
  saveBtn.classList.toggle("hidden", !hasDetailChanges());
}

function openTaskDetail(task) {
  const overlay = $("#taskDetailOverlay");
  if (!overlay) return;

  currentDetailTask = task;

  // Clear error
  const errorEl = $("#detailError");
  if (errorEl) { errorEl.textContent = ""; errorEl.classList.remove("show"); }

  // Badges
  const badges = $("#detailBadges");
  if (badges) {
    badges.innerHTML = `
      <span class="${getStatusClass(task.status)}">${escapeHtml(prettifyStatus(task.status))}</span>
      <span class="task-priority ${getPriorityClass(task.priority)}">
        Priority ${escapeHtml(String(task.priority))} · ${escapeHtml(getPriorityLabel(task.priority))}
      </span>
    `;
  }

  // Fields
  const titleEl = $("#detailTitle");
  const descEl = $("#detailDescription");
  const statusEl = $("#detailStatus");
  const priorityEl = $("#detailPriority");
  const dueEl = $("#detailDueAt");

  if (titleEl) titleEl.value = task.title || "";
  if (descEl) descEl.value = task.description || "";
  if (statusEl) statusEl.value = task.status || "to_do";
  if (priorityEl) priorityEl.value = String(task.priority ?? 3);
  if (dueEl) dueEl.value = task.due_at || "";

  const createdEl = $("#detailCreatedAt");
  const updatedEl = $("#detailUpdatedAt");
  const completedRow = $("#detailCompletedRow");
  const completedEl = $("#detailCompletedAt");

  if (createdEl) createdEl.textContent = formatDate(task.created_at);
  if (updatedEl) updatedEl.textContent = formatDate(task.updated_at);

  if (task.completed_at && completedRow && completedEl) {
    completedEl.textContent = formatDate(task.completed_at);
    completedRow.style.display = "";
  } else if (completedRow) {
    completedRow.style.display = "none";
  }

  overlay.dataset.taskId = task.id;
  detailSnapshot = buildDetailSnapshot();
  $("#detailSaveBtn")?.classList.add("hidden");

  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeTaskDetail() {
  $("#taskDetailOverlay")?.classList.add("hidden");
  document.body.style.overflow = "";
  detailSnapshot = null;
  currentDetailTask = null;
}

async function saveTaskDetail() {
  const overlay = $("#taskDetailOverlay");
  const taskId = overlay?.dataset.taskId;
  if (!taskId) return;

  const errorEl = $("#detailError");
  errorEl?.classList.remove("show");

  const title = $("#detailTitle")?.value.trim() || "";
  const description = $("#detailDescription")?.value.trim() || "";
  const status = $("#detailStatus")?.value || "";
  const priority = Number($("#detailPriority")?.value);
  const due_at = $("#detailDueAt")?.value || "";

  if (title.length < 2) {
    if (errorEl) { errorEl.textContent = "Title must be at least 2 characters."; errorEl.classList.add("show"); }
    return;
  }
  if (!due_at) {
    if (errorEl) { errorEl.textContent = "Due date is required."; errorEl.classList.add("show"); }
    return;
  }

  const saveBtn = $("#detailSaveBtn");
  setLoading(saveBtn, true);

  try {
    await updateTask(taskId, {
      title,
      description,
      status,
      priority,
      due_at,
      project_id: currentDetailTask?.project_id || null,
      workspace_id: currentWorkspace.id,
    });
    renderFeedback("Task updated successfully.", "success");
    closeTaskDetail();
    await loadTasks();
  } catch (err) {
    if (errorEl) { errorEl.textContent = err.message || "Could not save task."; errorEl.classList.add("show"); }
  } finally {
    setLoading(saveBtn, false);
  }
}

async function deleteTaskFromDetail() {
  const overlay = $("#taskDetailOverlay");
  const taskId = overlay?.dataset.taskId;
  if (!taskId) return;

  if (!window.confirm("Are you sure you want to delete this task?")) return;

  try {
    await deleteTask(taskId);
    renderFeedback("Task deleted successfully.", "success");
    closeTaskDetail();
    await loadTasks();
  } catch (err) {
    renderFeedback(err.message || "Could not delete the task.");
  }
}

// ---- Create task modal ----

function openCreateTaskModal() {
  const overlay = $("#taskModalOverlay");
  if (!overlay) return;

  const taskError = $("#taskError");
  if (taskError) { taskError.textContent = ""; taskError.classList.remove("show"); }

  const titleEl = $("#taskTitle");
  const descEl = $("#taskDescription");
  const priorityEl = $("#taskPriority");
  const dueEl = $("#taskDueAt");
  const projectEl = $("#taskProjectId");

  if (titleEl) titleEl.value = "";
  if (descEl) descEl.value = "";
  if (priorityEl) priorityEl.value = "3";
  if (dueEl) dueEl.value = "";
  if (projectEl) projectEl.value = "";

  overlay.classList.remove("hidden");
  titleEl?.focus();
}

function closeCreateTaskModal() {
  $("#taskModalOverlay")?.classList.add("hidden");
}

async function handleTaskSubmit(event) {
  event.preventDefault();

  const errorEl = $("#taskError");
  const submitBtn = $("#taskSubmitBtn");

  errorEl?.classList.remove("show");
  if (errorEl) errorEl.textContent = "";

  const payload = {
    title: $("#taskTitle")?.value.trim() || "",
    description: $("#taskDescription")?.value.trim() || "",
    priority: Number($("#taskPriority")?.value),
    due_at: $("#taskDueAt")?.value || "",
    project_id: $("#taskProjectId")?.value.trim() || null,
    workspace_id: currentWorkspace.id,
  };

  if (payload.title.length < 2) {
    if (errorEl) { errorEl.textContent = "Title must be at least 2 characters."; errorEl.classList.add("show"); }
    return;
  }
  if (!payload.description) {
    if (errorEl) { errorEl.textContent = "Description is required."; errorEl.classList.add("show"); }
    return;
  }
  if (!payload.due_at) {
    if (errorEl) { errorEl.textContent = "Due date is required."; errorEl.classList.add("show"); }
    return;
  }

  setLoading(submitBtn, true);

  try {
    await createTask(payload);
    renderFeedback("Task created successfully.", "success");
    closeCreateTaskModal();
    await loadTasks();
  } catch (err) {
    if (errorEl) { errorEl.textContent = err.message || "Something went wrong."; errorEl.classList.add("show"); }
  } finally {
    setLoading(submitBtn, false);
  }
}

// ---- Load tasks ----

async function loadTasks() {
  if (!currentWorkspace) return;
  try {
    clearFeedback();
    const response = await getWorkspaceTasks(currentWorkspace.id, currentOrder);
    currentTasks = Array.isArray(response?.tasks) ? response.tasks : [];
    renderTaskCount(response?.total ?? currentTasks.length);
    renderTasks(currentTasks);
  } catch (err) {
    renderFeedback(err.message || "Could not load workspace tasks.");
  }
}

// ---- Bind controls ----

function setActiveOrderBtn(order) {
  document.querySelectorAll(".workspace-tree-item[data-order]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.order === order);
  });
}

function bindControls() {
  // Create modal
  $("#minimapNewTaskBtn")?.addEventListener("click", openCreateTaskModal);
  $("#taskModalCloseBtn")?.addEventListener("click", closeCreateTaskModal);
  $("#taskModalCancelBtn")?.addEventListener("click", closeCreateTaskModal);
  $("#taskModalOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "taskModalOverlay") closeCreateTaskModal();
  });
  $("#taskForm")?.addEventListener("submit", handleTaskSubmit);

  // Minimap ordering buttons
  document.querySelectorAll(".workspace-tree-item[data-order]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      currentOrder = btn.dataset.order;
      setActiveOrderBtn(currentOrder);
      await loadTasks();
    });
  });

  // Detail panel
  $("#detailCloseBtn")?.addEventListener("click", closeTaskDetail);
  $("#detailSaveBtn")?.addEventListener("click", saveTaskDetail);
  $("#detailDeleteBtn")?.addEventListener("click", deleteTaskFromDetail);
  $("#taskDetailOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "taskDetailOverlay") closeTaskDetail();
  });

  // Change detection
  ["detailTitle", "detailDescription", "detailStatus", "detailPriority", "detailDueAt"].forEach((id) => {
    const el = $(`#${id}`);
    el?.addEventListener("input", updateDetailSaveBtn);
    el?.addEventListener("change", updateDetailSaveBtn);
  });

  // Also update badges live when status/priority changes
  $("#detailStatus")?.addEventListener("change", updateDetailBadges);
  $("#detailPriority")?.addEventListener("change", updateDetailBadges);

  // Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("#taskDetailOverlay")?.classList.contains("hidden")) { closeTaskDetail(); return; }
    if (!$("#taskModalOverlay")?.classList.contains("hidden")) { closeCreateTaskModal(); return; }
  });
}

function updateDetailBadges() {
  const badges = $("#detailBadges");
  if (!badges || !currentDetailTask) return;

  const status = $("#detailStatus")?.value || currentDetailTask.status;
  const priority = Number($("#detailPriority")?.value ?? currentDetailTask.priority);

  badges.innerHTML = `
    <span class="${getStatusClass(status)}">${escapeHtml(prettifyStatus(status))}</span>
    <span class="task-priority ${getPriorityClass(priority)}">
      Priority ${escapeHtml(String(priority))} · ${escapeHtml(getPriorityLabel(priority))}
    </span>
  `;
}

// ---- Boot ----

async function boot() {
  renderSidebar();
  bindControls();

  currentWorkspace = await resolveActiveWorkspace();

  if (!currentWorkspace) {
    renderFeedback("No workspace available yet. Create one from the workspace manager.");
    $("#taskEmptyState")?.classList.add("show");
    return;
  }

  renderWorkspaceHeader(currentWorkspace);
  setActiveOrderBtn("");
  await loadTasks();
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await requireAuth();
    await boot();
  } catch {
    // Auth redirect already in progress
  }
});
