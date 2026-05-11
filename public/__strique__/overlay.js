// Strique live visual editing overlay — injected in dev mode only via vite.config.ts.
// Runs inside the preview iframe. All editing UI lives in the Strique parent app.

// Safety: do nothing when the page is viewed outside the Strique iframe.
if (window === window.parent) {
  // standalone — exit immediately
} else {
  init();
}

function init() {
  const state = {
    selected: null,
    hovered: null,
    isLocked: true, // locked until parent sends strique:lock { locked: false }
    highlightEl: null,
    hoverEl: null,
  };

  const SKIP_TAGS = new Set(['html', 'body', 'head', 'script', 'style', 'link', 'meta', 'noscript']);

  function setup() {
    injectHighlightLayers();
    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('mouseover', onDocumentHover, true);
    document.addEventListener('mouseout', onDocumentMouseout, true);
    window.addEventListener('message', onParentMessage);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

  // ── Element targeting ──────────────────────────────────────────────────────
  // Prefer the nearest ancestor stamped with data-loc by jsxLocPlugin (precise
  // file+line for patching). Falls back to the nearest ancestor with a non-empty
  // className so hover highlighting works even before the plugin is active.
  function findTarget(el) {
    let cur = el;
    let fallback = null;
    while (cur && cur !== document.body) {
      const tag = cur.tagName?.toLowerCase();
      if (!SKIP_TAGS.has(tag)) {
        if (cur.dataset?.loc) return cur;
        if (fallback === null && typeof cur.className === 'string' && cur.className.trim()) {
          fallback = cur;
        }
      }
      cur = cur.parentElement;
    }
    return fallback;
  }

  // Walk up from the clicked element looking for the nearest data-content-path
  // attribute. This is separate from findTarget because the content-path element
  // may be a different ancestor than the data-loc element.
  function findContentPath(el) {
    let cur = el;
    while (cur && cur !== document.body) {
      if (cur.dataset?.contentPath) return cur.dataset.contentPath;
      cur = cur.parentElement;
    }
    return '';
  }

  // ── Click → Select ─────────────────────────────────────────────────────────
  function onDocumentClick(e) {
    if (state.isLocked) return;
    const target = findTarget(e.target);

    if (!target) {
      clearSelection();
      return;
    }

    e.stopPropagation();
    e.preventDefault();
    state.selected = target;
    positionHighlight(state.highlightEl, target, '#6366f1');

    window.parent.postMessage(
      {
        type: 'strique:selected',
        payload: {
          tagName: target.tagName.toLowerCase(),
          text: target.textContent.trim(),
          classes: typeof target.className === 'string' ? target.className : '',
          rect: target.getBoundingClientRect(),
          loc: target.dataset.loc ?? '',
          contentPath: findContentPath(e.target),
        },
      },
      '*'
    );
  }

  // ── Hover ──────────────────────────────────────────────────────────────────
  function onDocumentHover(e) {
    if (state.isLocked) return;
    const target = findTarget(e.target);
    if (!target || target === state.selected) return;
    state.hovered = target;
    positionHighlight(state.hoverEl, target, '#a5b4fc');
  }

  function onDocumentMouseout() {
    if (state.hoverEl) state.hoverEl.style.display = 'none';
    state.hovered = null;
  }

  // ── Receive commands from parent ───────────────────────────────────────────
  function onParentMessage(e) {
    const { type, data } = e.data || {};

    if (type === 'strique:preview-classes' && state.selected) {
      state.selected.className = data.classes;
    }

    if (type === 'strique:preview-inline' && state.selected) {
      Object.assign(state.selected.style, data.inlineStyles);
    }

    if (type === 'strique:commit') {
      if (state.selected) state.selected.removeAttribute('style');
    }

    if (type === 'strique:lock') {
      state.isLocked = data.locked;
      document.body.style.cursor = data.locked ? '' : 'default';
      showLockBanner(data.locked, data.reason);
      if (data.locked) clearSelection();
    }

    if (type === 'strique:clear') {
      clearSelection();
    }
  }

  // ── Highlight layers ───────────────────────────────────────────────────────
  function injectHighlightLayers() {
    state.highlightEl = createHighlightDiv();
    state.hoverEl = createHighlightDiv();
    document.body.appendChild(state.highlightEl);
    document.body.appendChild(state.hoverEl);
  }

  function createHighlightDiv() {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed',
      pointerEvents: 'none',
      border: '2px solid transparent',
      borderRadius: '3px',
      zIndex: '99999',
      display: 'none',
      boxSizing: 'border-box',
      transition: 'all 80ms ease',
    });
    return el;
  }

  function positionHighlight(el, target, color) {
    const r = target.getBoundingClientRect();
    Object.assign(el.style, {
      display: 'block',
      borderColor: color,
      top: r.top + window.scrollY + 'px',
      left: r.left + window.scrollX + 'px',
      width: r.width + 'px',
      height: r.height + 'px',
    });
  }

  function clearSelection() {
    state.selected = null;
    if (state.highlightEl) state.highlightEl.style.display = 'none';
    if (state.hoverEl) state.hoverEl.style.display = 'none';
    window.parent.postMessage({ type: 'strique:deselected' }, '*');
  }

  // ── Lock banner ────────────────────────────────────────────────────────────
  let lockBanner = null;

  function showLockBanner(show, reason) {
    if (show && reason) {
      if (!lockBanner) {
        lockBanner = document.createElement('div');
        Object.assign(lockBanner.style, {
          position: 'fixed',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.75)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '6px',
          fontSize: '13px',
          zIndex: '999999',
          pointerEvents: 'none',
        });
        document.body.appendChild(lockBanner);
      }
      lockBanner.textContent = reason;
      lockBanner.style.display = 'block';
    } else if (lockBanner) {
      lockBanner.style.display = 'none';
    }
  }
}
