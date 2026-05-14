import { request } from "./api.js";
import { logout, me } from "./auth.js";
import { $, setLoading, showError, clearError, setText } from "./ui.js";

const ACTIVE_WORKSPACE_KEY = "donee_active_workspace_id";

function getActiveWorkspaceId() {
  return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
}

function setActiveWorkspaceId(workspaceId) {
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
}

function formatDate(isoDate) {
  if (!isoDate) return "Unknown creation date";
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return "Unknown creation date";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getPageName() {
  const path = window.location.pathname;
  return path.split("/").pop() || "";
}

async function ensureAuthenticated() {
  try {
    await me();
  } catch {
    window.location.href = "../auth/login.html";
    throw new Error("Not authenticated");
  }
}

async function getUserWorkspaces() {
  return request("/workspaces", { method: "GET" });
}

async function getWorkspaceById(workspaceId) {
  return request(`/workspaces/${workspaceId}`, { method: "GET" });
}

async function createWorkspace(payload) {
  return request("/workspaces", {
    method: "POST",
    body: payload,
  });
}

async function renameWorkspace(workspaceId, payload) {
  return request(`/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: payload,
  });
}

function getWorkspaceManagerBaseMarkup() {
  return `
    <div class="workspace-brand">
      <h1 class="brand-title">DONEE</h1>
      <p class="workspace-brand-copy">Workspace foundation</p>
    </div>

    <div class="workspace-sidebar-card">
      <p class="workspace-sidebar-label">Current space</p>
      <h2 class="workspace-sidebar-name" id="sidebarWorkspaceName">Loading...</h2>
      <p class="workspace-sidebar-meta" id="sidebarWorkspaceMeta">Preparing workspace context.</p>
    </div>

    <nav class="workspace-nav">
      <a class="workspace-nav-link ${getPageName() === "workspace_home.html" ? "active" : ""}" href="./workspace_home.html">
        <span>Overview</span>
        <span class="workspace-nav-dot"></span>
      </a>

      <a class="workspace-nav-link ${getPageName() === "workspace_switcher.html" ? "active" : ""}" href="./workspace_switcher.html">
        <span>Workspace manager</span>
        <span class="workspace-nav-dot"></span>
      </a>

      <a class="workspace-nav-link ${getPageName() === "workspace_settings.html" ? "active" : ""}" href="./workspace_settings.html">
        <span>Configuration</span>
        <span class="workspace-nav-dot"></span>
      </a>

      <button class="workspace-nav-button muted" type="button" disabled>
        <span>Projects</span>
        <span>Later</span>
      </button>

      <button class="workspace-nav-button muted" type="button" disabled>
        <span>Tasks</span>
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
}

function renderSidebarLayout() {
  const sidebar = $("#workspaceSidebar");
  if (!sidebar) return;

  sidebar.innerHTML = getWorkspaceManagerBaseMarkup();

  const logoutBtn = $("#logoutBtn");
  const switchBtn = $("#sidebarSwitchBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logout();
      window.location.href = "../auth/login.html";
    });
  }

  if (switchBtn) {
    switchBtn.addEventListener("click", () => {
      window.location.href = "./workspace_switcher.html";
    });
  }
}

function renderSidebarWorkspace(workspace) {
  const nameEl = $("#sidebarWorkspaceName");
  const metaEl = $("#sidebarWorkspaceMeta");

  if (nameEl) {
    setText(nameEl, workspace?.name || "No workspace selected");
  }

  if (metaEl) {
    setText(
      metaEl,
      workspace?.created_at
        ? `Created on ${formatDate(workspace.created_at)}`
        : "Choose a workspace to continue."
    );
  }
}

function renderPageFeedback(message, type = "error") {
  const feedback = $("#pageFeedback");
  if (!feedback) return;

  feedback.className = `workspace-feedback ${type}`;
  feedback.textContent = message;
}

function clearPageFeedback() {
  const feedback = $("#pageFeedback");
  if (!feedback) return;

  feedback.className = "workspace-feedback";
  feedback.textContent = "";
}

async function resolveActiveWorkspace() {
  const data = await getUserWorkspaces();
  const workspaces = Array.isArray(data?.workspaces) ? data.workspaces : [];

  if (!workspaces.length) {
    return {
      workspaces: [],
      activeWorkspace: null,
    };
  }

  const storedId = getActiveWorkspaceId();
  let activeWorkspace =
    workspaces.find((workspace) => workspace.id === storedId) || workspaces[0];

  setActiveWorkspaceId(activeWorkspace.id);

  try {
    activeWorkspace = await getWorkspaceById(activeWorkspace.id);
  } catch {
    // Keep lightweight list item if detail call fails.
  }

  return {
    workspaces,
    activeWorkspace,
  };
}

function renderOverviewPage(workspace) {
  const pageTitle = $("#workspacePageTitle");
  const pageMeta = $("#workspacePageMeta");
  const actionWorkspaceName = $("#workspaceActionWorkspaceName");
  const minimapWorkspaceName = $("#workspaceMinimapName");
  const emptyState = $("#workspaceEmptyState");
  const overviewPanel = $("#workspaceOverviewPanel");

  if (!workspace) {
    if (emptyState) emptyState.classList.add("show");
    if (overviewPanel) overviewPanel.style.display = "none";
    return;
  }

  if (emptyState) emptyState.classList.remove("show");
  if (overviewPanel) overviewPanel.style.display = "grid";

  if (pageTitle) setText(pageTitle, workspace.name);
  if (pageMeta) setText(pageMeta, `Created on ${formatDate(workspace.created_at)}`);
  if (actionWorkspaceName) setText(actionWorkspaceName, workspace.name);
  if (minimapWorkspaceName) setText(minimapWorkspaceName, workspace.name);

  const switcherTrigger = $("#workspaceTitleTrigger");
  const settingsTrigger = $("#workspaceSettingsBtn");
  const createProjectBtn = $("#createProjectBtn");
  const createTaskBtn = $("#createTaskBtn");

  if (switcherTrigger) {
    switcherTrigger.addEventListener("click", () => {
      window.location.href = "./workspace_switcher.html";
    });
  }

  if (settingsTrigger) {
    settingsTrigger.addEventListener("click", () => {
      window.location.href = "./workspace_settings.html";
    });
  }

  if (createProjectBtn) {
    createProjectBtn.addEventListener("click", () => {
      renderPageFeedback(
        "Projects UI is intentionally reserved for a later slice. This card is part of the planned layout.",
        "success"
      );
    });
  }

  if (createTaskBtn) {
    createTaskBtn.addEventListener("click", () => {
      renderPageFeedback(
        "Tasks UI will arrive in a following slice. For now, the workspace foundation is ready.",
        "success"
      );
    });
  }
}

function renderWorkspaceList(workspaces, activeWorkspaceId) {
  const list = $("#workspaceList");
  const emptyState = $("#workspaceListEmpty");

  if (!list) return;

  list.innerHTML = "";

  if (!workspaces.length) {
    if (emptyState) emptyState.classList.add("show");
    return;
  }

  if (emptyState) emptyState.classList.remove("show");

  workspaces.forEach((workspace) => {
    const article = document.createElement("article");
    article.className =
      "workspace-list-card" + (workspace.id === activeWorkspaceId ? " active" : "");

    article.innerHTML = `
      <div class="workspace-list-main">
        <h3 class="workspace-list-name">${escapeHtml(workspace.name)}</h3>
        <p class="workspace-list-meta">Created on ${formatDate(workspace.created_at)}</p>
      </div>

      <div class="workspace-list-actions">
        <button class="workspace-mini-btn" type="button" data-action="open" data-id="${workspace.id}">
          Open
        </button>
        <button class="workspace-mini-btn muted" type="button" data-action="rename" data-id="${workspace.id}" data-name="${escapeAttribute(workspace.name)}">
          Rename
        </button>
        <button class="workspace-mini-btn muted" type="button" data-action="settings" data-id="${workspace.id}">
          Settings
        </button>
      </div>
    `;

    list.appendChild(article);
  });

  const buttons = list.querySelectorAll("[data-action]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      const workspaceId = button.dataset.id;
      const workspaceName = button.dataset.name || "";

      if (action === "open") {
        setActiveWorkspaceId(workspaceId);
        window.location.href = "./workspace_home.html";
        return;
      }

      if (action === "rename") {
        const renameId = $("#renameWorkspaceId");
        const renameName = $("#renameWorkspaceName");
        const renameCurrent = $("#renameCurrentName");

        if (renameId) renameId.value = workspaceId;
        if (renameName) renameName.value = workspaceName;
        if (renameCurrent) renameCurrent.textContent = workspaceName;

        const renameError = $("#renameError");
        if (renameError) renameError.classList.remove("show");
        return;
      }

      if (action === "settings") {
        setActiveWorkspaceId(workspaceId);
        window.location.href = "./workspace_settings.html";
      }
    });
  });
}

async function handleCreateWorkspaceSubmit() {
  const form = $("#createWorkspaceForm");
  if (!form) return;

  const input = $("#createWorkspaceName");
  const errorEl = $("#createError");
  const button = $("#createWorkspaceBtn");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError(errorEl);
    errorEl?.classList.remove("show");

    const name = input?.value.trim() || "";

    if (!name) {
      if (errorEl) {
        errorEl.textContent = "Workspace name is required.";
        errorEl.classList.add("show");
      }
      return;
    }

    setLoading(button, true);

    try {
      const newWorkspace = await createWorkspace({ name });
      setActiveWorkspaceId(newWorkspace.id);
      window.location.href = "./workspace_home.html";
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.classList.add("show");
      }
    } finally {
      setLoading(button, false);
    }
  });
}

async function handleRenameWorkspaceSubmit() {
  const form = $("#renameWorkspaceForm");
  if (!form) return;

  const workspaceIdEl = $("#renameWorkspaceId");
  const input = $("#renameWorkspaceName");
  const errorEl = $("#renameError");
  const button = $("#renameWorkspaceBtn");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError(errorEl);
    errorEl?.classList.remove("show");

    const workspaceId = workspaceIdEl?.value || "";
    const name = input?.value.trim() || "";

    if (!workspaceId) {
      if (errorEl) {
        errorEl.textContent = "Select a workspace to rename first.";
        errorEl.classList.add("show");
      }
      return;
    }

    if (!name) {
      if (errorEl) {
        errorEl.textContent = "New workspace name is required.";
        errorEl.classList.add("show");
      }
      return;
    }

    setLoading(button, true);

    try {
      await renameWorkspace(workspaceId, { name });
      setActiveWorkspaceId(workspaceId);
      window.location.href = "./workspace_switcher.html?renamed=1";
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.classList.add("show");
      }
    } finally {
      setLoading(button, false);
    }
  });
}

function renderSettingsPage(workspace) {
  const titleEl = $("#settingsWorkspaceTitle");
  const metaEl = $("#settingsWorkspaceMeta");
  const renameInput = $("#settingsRenameInput");
  const renameCurrent = $("#settingsRenameCurrent");
  const renameBtn = $("#settingsRenameBtn");
  const renameError = $("#settingsRenameError");

  if (!workspace) {
    renderPageFeedback("No workspace is available to configure yet.");
    return;
  }

  if (titleEl) setText(titleEl, workspace.name);
  if (metaEl) setText(metaEl, `Created on ${formatDate(workspace.created_at)}`);
  if (renameInput) renameInput.value = workspace.name;
  if (renameCurrent) renameCurrent.textContent = workspace.name;

  if (renameBtn) {
    renameBtn.addEventListener("click", async () => {
      clearError(renameError);
      renameError?.classList.remove("show");

      const newName = renameInput?.value.trim() || "";

      if (!newName) {
        if (renameError) {
          renameError.textContent = "Workspace name is required.";
          renameError.classList.add("show");
        }
        return;
      }

      setLoading(renameBtn, true);

      try {
        await renameWorkspace(workspace.id, { name: newName });
        renderPageFeedback("Workspace renamed successfully.", "success");
        setTimeout(() => {
          window.location.href = "./workspace_settings.html";
        }, 250);
      } catch (error) {
        if (renameError) {
          renameError.textContent = error.message;
          renameError.classList.add("show");
        }
      } finally {
        setLoading(renameBtn, false);
      }
    });
  }

  const backBtn = $("#settingsBackBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "./workspace_home.html";
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

async function bootOverviewPage() {
  renderSidebarLayout();

  try {
    await ensureAuthenticated();
    const { activeWorkspace } = await resolveActiveWorkspace();
    renderSidebarWorkspace(activeWorkspace);
    renderOverviewPage(activeWorkspace);
  } catch (error) {
    renderPageFeedback(error.message || "Could not load workspace overview.");
  }
}

async function bootSwitcherPage() {
  renderSidebarLayout();
  handleCreateWorkspaceSubmit();
  handleRenameWorkspaceSubmit();

  try {
    await ensureAuthenticated();
    const { workspaces, activeWorkspace } = await resolveActiveWorkspace();
    renderSidebarWorkspace(activeWorkspace);
    renderWorkspaceList(workspaces, activeWorkspace?.id || "");

    const params = new URLSearchParams(window.location.search);
    if (params.get("renamed") === "1") {
      renderPageFeedback("Workspace renamed successfully.", "success");
    }
  } catch (error) {
    renderPageFeedback(error.message || "Could not load your workspaces.");
  }
}

async function bootSettingsPage() {
  renderSidebarLayout();

  try {
    await ensureAuthenticated();
    const { activeWorkspace } = await resolveActiveWorkspace();
    renderSidebarWorkspace(activeWorkspace);
    renderSettingsPage(activeWorkspace);
  } catch (error) {
    renderPageFeedback(error.message || "Could not load workspace settings.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  clearPageFeedback();

  const pageName = getPageName();

  if (pageName === "workspace_home.html") {
    bootOverviewPage();
  }

  if (pageName === "workspace_switcher.html") {
    bootSwitcherPage();
  }

  if (pageName === "workspace_settings.html") {
    bootSettingsPage();
  }
});
