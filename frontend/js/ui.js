export function $(selector) {
  return document.querySelector(selector);
}

export function setText(el, text) {
  if (!el) return;
  el.textContent = text;
}

export function show(el) {
  if (!el) return;
  el.style.display = "block";
}

export function hide(el) {
  if (!el) return;
  el.style.display = "none";
}

export function setLoading(buttonEl, isLoading) {
  if (!buttonEl) return;

  if (isLoading) {
    buttonEl.disabled = true;
    buttonEl.dataset.originalText = buttonEl.textContent;
    buttonEl.textContent = "Loading...";
  } else {
    buttonEl.disabled = false;
    buttonEl.textContent = buttonEl.dataset.originalText || "Continue";
  }
}

export function showError(containerEl, message) {
  if (!message) return;

  if (containerEl) {
    containerEl.textContent = message;
    containerEl.style.display = "block";
    return;
  }

  alert(message);
}

export function clearError(containerEl) {
  if (!containerEl) return;
  containerEl.textContent = "";
  containerEl.style.display = "none";
}
