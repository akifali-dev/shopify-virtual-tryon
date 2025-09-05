// tryon-sync.js  (plain JS)
export const TRYON_STORAGE_KEY = 'tryon:state:v1';
export const TRYON_CHANNEL = 'tryon:broadcast';
const LEADER_KEY = 'tryon:leader';
const HEARTBEAT_MS = 4000;
const LEADER_TTL = HEARTBEAT_MS * 3; // ~12s safety

const now = () => Date.now();

// --- Storage helpers
export function readPersisted() {
  try { return JSON.parse(localStorage.getItem(TRYON_STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
export function writePersisted(patch) {
  const prev = readPersisted();
  const next = { ...prev, ...patch, _ts: now() };
  localStorage.setItem(TRYON_STORAGE_KEY, JSON.stringify(next));
  // broadcast to other pages
  try {
    const bc = new BroadcastChannel(TRYON_CHANNEL);
    bc.postMessage({ type: 'state', state: next });
    bc.close();
  } catch {}
  return next;
}

// --- Leader election (only one tab/page polls)
function readLeader() {
  try { return JSON.parse(localStorage.getItem(LEADER_KEY) || 'null'); }
  catch { return null; }
}
function writeLeader(obj) {
  localStorage.setItem(LEADER_KEY, JSON.stringify(obj));
}
function expiredLeader(info) {
  return !info || (now() - (info.ts || 0)) > LEADER_TTL;
}

function getTabId() {
  let id = sessionStorage.getItem('tryon:tabid');
  if (!id) {
    id = Math.random().toString(36).slice(2);
    sessionStorage.setItem('tryon:tabid', id);
  }
  return id;
}

// Claim leadership if there is no healthy leader
export function tryBecomeLeader() {
  const current = readLeader();
  if (expiredLeader(current)) {
    const me = { id: getTabId(), ts: now() };
    writeLeader(me);
    // verify we won (no race)
    const again = readLeader();
    if (again && again.id === me.id) return true;
  }
  return false;
}

// Keep/lose leadership with a heartbeat
export function startLeadershipLoop(onChange) {
  const tabId = getTabId();
  let isLeader = false;

  const check = () => {
    const info = readLeader();
    const iAmLeader = info && info.id === tabId && !expiredLeader(info);
    if (iAmLeader !== isLeader) {
      isLeader = iAmLeader;
      onChange?.(isLeader);
    }
    if (!iAmLeader) {
      // attempt to become leader if none healthy
      if (tryBecomeLeader()) {
        isLeader = true;
        onChange?.(true);
      }
    } else {
      // bump heartbeat
      writeLeader({ id: tabId, ts: now() });
    }
  };

  // initial try
  check();
  const t = setInterval(check, HEARTBEAT_MS);
  return () => clearInterval(t);
}

// Subscribe to cross-page updates
export function subscribeExternal(onState, onProgress) {
  const onStorage = (e) => {
    if (e.key === TRYON_STORAGE_KEY && e.newValue) {
      try {
        const state = JSON.parse(e.newValue);
        onState?.(state);
      } catch {}
    }
    if (e.key === LEADER_KEY) {
      // noop here; leadership handled in startLeadershipLoop
    }
  };
  window.addEventListener('storage', onStorage);

  const bc = new BroadcastChannel(TRYON_CHANNEL);
  bc.onmessage = (ev) => {
    const msg = ev?.data;
    if (!msg) return;
    if (msg.type === 'state') onState?.(msg.state);
    if (msg.type === 'progress') onProgress?.(msg.progress, msg.stage, msg.payload);
  };

  return () => {
    window.removeEventListener('storage', onStorage);
    bc.close();
  };
}

// Broadcast progress/results without rewriting all state
export function broadcastProgress(progress, stage, payload) {
  try {
    const bc = new BroadcastChannel(TRYON_CHANNEL);
    bc.postMessage({ type: 'progress', progress, stage, payload });
    bc.close();
  } catch {}
}

// Small helper to only persist light-weight result info
export function slimResults(list) {
  if (!Array.isArray(list)) return [];
  return list.map(r => ({
    id: r?.id ?? null,
    status: (r?.status || '').toUpperCase(),
    fileUrl: r?.fileUrl || null
  }));
}
