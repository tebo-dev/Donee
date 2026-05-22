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
      const titleEl = $("#workspacePageTitle");
      if (!titleEl) return;

      // Prevent double-activation
      if (switcherTrigger.querySelector(".workspace-title-input")) return;

      const currentName = workspace.name;

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
        if (!newName || newName === currentName) {
          restoreTitle(currentName);
          return;
        }

        input.disabled = true;

        try {
          await renameWorkspace(workspace.id, { name: newName });
          workspace.name = newName;
          restoreTitle(newName);

          // Sync sidebar and minimap
          const sidebarName = document.querySelector(".workspace-sidebar-name");
          if (sidebarName) sidebarName.textContent = newName;
          if (minimapWorkspaceName) minimapWorkspaceName.textContent = newName;

          renderPageFeedback("Workspace renamed successfully.", "success");
        } catch (err) {
          input.disabled = false;
          renderPageFeedback(err.message || "Could not rename workspace.", "error");
          restoreTitle(currentName);
        }
      };

      let cancelled = false;

      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          cancelled = true;
          restoreTitle(currentName);
        }
        if (e.key === "Enter") {
          e.preventDefault();
          input.blur();
        }
      });

      input.addEventListener("blur", () => {
        if (!cancelled) doSave();
      });
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
    const isActive = workspace.id === activeWorkspaceId;
    const card = document.createElement("article");
    card.className = "workspace-list-card" + (isActive ? " active" : "");
    card.dataset.workspaceId = workspace.id;

    card.innerHTML = `
      <button
        class="workspace-list-open-btn"
        type="button"
        data-action="open"
        data-id="${workspace.id}"
        aria-label="Open ${escapeAttribute(workspace.name)}"
      >
        <div class="workspace-list-main">
          <h3 class="workspace-list-name">${escapeHtml(workspace.name)}</h3>
          <p class="workspace-list-meta">Created on ${formatDate(workspace.created_at)}</p>
        </div>
      </button>

      <div class="workspace-list-actions">
        <button class="workspace-mini-btn muted" type="button" data-action="rename"
          data-id="${workspace.id}" data-name="${escapeAttribute(workspace.name)}">
          Rename
        </button>
        <button class="workspace-mini-btn muted" type="button" data-action="settings"
          data-id="${workspace.id}">
          Settings
        </button>
      </div>
    `;

    list.appendChild(card);
  });

  // Single delegated listener — safe because list.innerHTML was cleared above
  list.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const workspaceId = btn.dataset.id;
    const card = btn.closest(".workspace-list-card");

    if (action === "open") {
      if (card.querySelector(".workspace-list-rename-input")) return;
      setActiveWorkspaceId(workspaceId);
      window.location.href = "./workspace_home.html";
      return;
    }

    if (action === "settings") {
      setActiveWorkspaceId(workspaceId);
      window.location.href = "./workspace_settings.html";
      return;
    }

    if (action === "rename") {
      const workspaceName = btn.dataset.name;
      const nameEl = card.querySelector(".workspace-list-name");
      const actionsEl = card.querySelector(".workspace-list-actions");

      const input = document.createElement("input");
      input.type = "text";
      input.className = "input workspace-list-rename-input";
      input.value = workspaceName;
      nameEl.replaceWith(input);
      input.focus();
      input.select();
      input.addEventListener("click", (e) => e.stopPropagation());
      input.addEventListener("keydown", (e) => { if (e.key === " ") e.stopPropagation(); });

      actionsEl.innerHTML = `
        <button class="workspace-mini-btn" type="button"
          data-action="save-rename" data-id="${workspaceId}">Save</button>
        <button class="workspace-mini-btn muted" type="button"
          data-action="cancel-rename" data-id="${workspaceId}"
          data-name="${escapeAttribute(workspaceName)}">Cancel</button>
      `;

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          actionsEl.querySelector("[data-action='save-rename']")?.click();
        }
        if (e.key === "Escape") {
          actionsEl.querySelector("[data-action='cancel-rename']")?.click();
        }
      });

      return;
    }

    if (action === "save-rename") {
      const input = card.querySelector(".workspace-list-rename-input");
      const newName = input?.value.trim() || "";
      const actionsEl = card.querySelector(".workspace-list-actions");

      if (!newName) {
        input?.focus();
        return;
      }

      btn.disabled = true;

      try {
        await renameWorkspace(workspaceId, { name: newName });

        // Restore card UI with the new name
        const h3 = document.createElement("h3");
        h3.className = "workspace-list-name";
        h3.textContent = newName;
        input.replaceWith(h3);

        actionsEl.innerHTML = `
          <button class="workspace-mini-btn muted" type="button"
            data-action="rename" data-id="${workspaceId}"
            data-name="${escapeAttribute(newName)}">Rename</button>
          <button class="workspace-mini-btn muted" type="button"
            data-action="settings" data-id="${workspaceId}">Settings</button>
        `;

        // Sync the open button aria-label
        const openBtn = card.querySelector("[data-action='open']");
        if (openBtn) openBtn.setAttribute("aria-label", `Open ${newName}`);

        renderPageFeedback("Workspace renamed successfully.", "success");
      } catch (err) {
        renderPageFeedback(err.message || "Could not rename workspace.", "error");
        btn.disabled = false;
      }

      return;
    }

    if (action === "cancel-rename") {
      const workspaceName = btn.dataset.name;
      const input = card.querySelector(".workspace-list-rename-input");
      const actionsEl = card.querySelector(".workspace-list-actions");

      const h3 = document.createElement("h3");
      h3.className = "workspace-list-name";
      h3.textContent = workspaceName;
      input.replaceWith(h3);

      actionsEl.innerHTML = `
        <button class="workspace-mini-btn muted" type="button"
          data-action="rename" data-id="${workspaceId}"
          data-name="${escapeAttribute(workspaceName)}">Rename</button>
        <button class="workspace-mini-btn muted" type="button"
          data-action="settings" data-id="${workspaceId}">Settings</button>
      `;
    }
  });
}

function handleCreateWorkspaceModal() {
  const modal = $("#createWorkspaceModal");
  const openBtn = $("#openCreateModalBtn");
  const closeBtn = $("#createModalCloseBtn");
  const cancelBtn = $("#createModalCancelBtn");
  const form = $("#createWorkspaceForm");
  const input = $("#createWorkspaceName");
  const errorEl = $("#createError");
  const submitBtn = $("#createWorkspaceSubmitBtn");

  if (!modal) return;

  const openModal = () => {
    modal.classList.remove("hidden");
    input?.focus();
  };

  const closeModal = () => {
    modal.classList.add("hidden");
    if (input) input.value = "";
    errorEl?.classList.remove("show");
  };

  openBtn?.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl?.classList.remove("show");

    const name = input?.value.trim() || "";

    if (!name) {
      if (errorEl) {
        errorEl.textContent = "Workspace name is required.";
        errorEl.classList.add("show");
      }
      return;
    }

    setLoading(submitBtn, true);

    try {
      const newWorkspace = await createWorkspace({ name });
      setActiveWorkspaceId(newWorkspace.id);
      window.location.href = "./workspace_home.html";
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.classList.add("show");
      }
    } finally {
      setLoading(submitBtn, false);
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
  handleCreateWorkspaceModal();

  try {
    await ensureAuthenticated();
    const { workspaces, activeWorkspace } = await resolveActiveWorkspace();
    renderSidebarWorkspace(activeWorkspace);
    renderWorkspaceList(workspaces, activeWorkspace?.id || "");
  } catch (error) {
    renderPageFeedback(error.message || "Could not load your workspaces.", "error");
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
