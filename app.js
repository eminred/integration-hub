/* ============================================================
   STATE
============================================================ */
const state = {
  page: 'integrations',
  tab: 'hubspot',
  hubspot: {
    phase: 'idle',   // idle | connecting | awaiting | polling | connected | error
    id: null,
    token: null,
    credentialId: null,
    link: null
  },
  leads: [],
  logs: [],
  nextLeadId: 1,
  apiToken: ''
};

/* ============================================================
   NAVIGATION
============================================================ */
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector('[data-page="' + page + '"]').classList.add('active');
  state.page = page;
  if (page === 'leads') refreshLeadsPage();
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  state.tab = tab;
}

/* ============================================================
   HUBSPOT — START CONNECTION
============================================================ */
async function startConnection() {
  const btn = document.getElementById('btn-add-connection');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner-sm"></div> Connecting…';

  state.hubspot.phase = 'connecting';

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr =
    now.getFullYear() + '-' +
    pad(now.getMonth() + 1) + '-' +
    pad(now.getDate()) + ' ' +
    pad(now.getHours()) + ':' +
    pad(now.getMinutes()) + ':' +
    pad(now.getSeconds());

  const endpoint = 'https://api.albato.com/credentials/grant-access-sharing';
  const body = { partnerId: 10055, title: 'Hubspot Connection and ' + dateStr };

  addLog({ type: 'req', method: 'POST', url: endpoint, body, note: 'Initiating HubSpot connection' });

  try {
    const res = await fetch('/api/grant-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    addLog({ type: 'res', method: 'POST', url: endpoint, status: res.status, body: data });

    if (!data.success) throw new Error('API returned success: false');

    state.hubspot.id    = data.data.id;
    state.hubspot.token = data.data.token;
    state.hubspot.link  = 'https://connect.integrations-hub.com?id=' + data.data.id + '&token=' + data.data.token;
    state.hubspot.phase = 'awaiting';

    showConnectionFlow();
  } catch (err) {
    addLog({ type: 'err', url: endpoint, message: err.message });
    btn.disabled = false;
    btn.innerHTML = [
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">',
      '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>',
      '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
      'Add a connection'
    ].join('');
    state.hubspot.phase = 'idle';
    toast('Connection failed: ' + err.message, 'error');
  }
}

function showConnectionFlow() {
  document.getElementById('hubspot-actions').style.display = 'none';
  document.getElementById('hubspot-flow').style.display = 'block';

  const link = state.hubspot.link;
  const el = document.getElementById('connect-link');
  el.href = link;
  el.textContent = link;

  setHubspotStatus('connecting', 'Awaiting authorization');
}

function copyLink() {
  navigator.clipboard.writeText(state.hubspot.link).then(() => {
    const btn = document.getElementById('btn-copy');
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy'; }, 2000);
  }).catch(() => toast('Copy failed — please copy the link manually.', 'error'));
}

/* ============================================================
   HUBSPOT — CONFIRM CONNECTION READY
============================================================ */
async function confirmReady() {
  document.getElementById('btn-ready').style.display = 'none';
  document.getElementById('status-checking').style.display = 'flex';
  state.hubspot.phase = 'polling';

  const url = 'https://api.albato.com/credentials/grant-access-sharing/' + state.hubspot.id;
  addLog({ type: 'req', method: 'GET', url, note: 'Checking connection status…' });

  await pollStatus(url, state.hubspot.id, 0);
}

async function pollStatus(url, id, attempt) {
  const MAX = 20;

  try {
    const res = await fetch('/api/grant-access-status?id=' + id);
    const data = await res.json();
    addLog({ type: 'res', method: 'GET', url, status: res.status, body: data, note: 'Poll #' + (attempt + 1) });

    if (data.success && data.data.status === 1 && data.data.credentialId !== null) {
      state.hubspot.credentialId = data.data.credentialId;
      state.hubspot.phase = 'connected';
      onConnected();
      return;
    }
  } catch (err) {
    addLog({ type: 'err', url, message: err.message });
  }

  if (attempt + 1 >= MAX) {
    document.getElementById('status-checking').style.display = 'none';
    document.getElementById('status-error').style.display = 'flex';
    document.getElementById('status-error-text').textContent = 'Verification timed out. Please try again.';
    document.getElementById('btn-ready').style.display = 'flex';
    state.hubspot.phase = 'awaiting';
    return;
  }

  setTimeout(() => pollStatus(url, id, attempt + 1), 3000);
}

/* ============================================================
   HUBSPOT — ON CONNECTED
============================================================ */
async function onConnected() {
  document.getElementById('status-checking').style.display = 'none';
  document.getElementById('status-success').style.display = 'flex';
  setHubspotStatus('connected', 'Connected');
  refreshLeadsPage();
  toast('HubSpot connected!', 'success');

  // Log: fetch available actions schema
  await logFetchActionsSchema();

  // Log: fetch run/info
  await logFetchRunInfo();
}

async function logFetchActionsSchema() {
  const url = 'https://uapi.albato.com/partners/trigger-actions/info?filter[partnerId]=10055&filter[isAction]=1';
  addLog({ type: 'req', method: 'GET', url, note: 'Fetching available actions schema' });
  try {
    const res = await fetch('/api/actions-schema', { headers: bearerHeaders() });
    const data = await res.json();
    addLog({ type: 'res', method: 'GET', url, status: res.status, body: data, note: 'Actions schema' });
  } catch (err) {
    addLog({ type: 'err', url, message: err.message });
  }
}

async function logFetchRunInfo() {
  const url = 'https://uapi.albato.com/partners/trigger-actions/10025156/run/info';
  const body = { credentialData: { '0': { value: state.hubspot.credentialId } } };
  addLog({ type: 'req', method: 'POST', url, body, note: 'Fetching run configuration' });
  try {
    const res = await fetch('/api/run-info', {
      method: 'POST',
      headers: { ...bearerHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    addLog({ type: 'res', method: 'POST', url, status: res.status, body: data, note: 'Run info' });
  } catch (err) {
    addLog({ type: 'err', url, message: err.message });
  }
}

function setHubspotStatus(phase, label) {
  const dot  = document.getElementById('hubspot-status-dot');
  const text = document.getElementById('hubspot-status-text');
  dot.className = 'status-dot ' + phase;
  text.textContent = label;
}

/* ============================================================
   LEADS
============================================================ */
function openModal() {
  document.getElementById('modal-overlay').style.display = 'flex';
  setTimeout(() => document.getElementById('f-first').focus(), 50);
}
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  ['f-first', 'f-last', 'f-email'].forEach(id => { document.getElementById(id).value = ''; });
}
function overlayClick(e) { if (e.target === e.currentTarget) closeModal(); }

function addLead(e) {
  e.preventDefault();
  const lead = {
    id: state.nextLeadId++,
    firstName: document.getElementById('f-first').value.trim(),
    lastName:  document.getElementById('f-last').value.trim(),
    email:     document.getElementById('f-email').value.trim()
  };
  state.leads.push(lead);
  renderLeads();
  closeModal();
}

function deleteLead(id) {
  state.leads = state.leads.filter(l => l.id !== id);
  renderLeads();
}

function renderLeads() {
  const body  = document.getElementById('leads-body');
  const empty = document.getElementById('leads-empty');

  if (state.leads.length === 0) {
    if (!empty) {
      body.innerHTML = '<tr id="leads-empty"><td colspan="4"><div class="table-empty"><p>No leads yet — click <strong>Add lead</strong> to get started.</p></div></td></tr>';
    } else {
      empty.style.display = '';
    }
    return;
  }

  body.innerHTML = state.leads.map(l => `
    <tr>
      <td>${esc(l.firstName)}</td>
      <td>${esc(l.lastName)}</td>
      <td>${esc(l.email)}</td>
      <td>
        <button class="btn-del" onclick="deleteLead(${l.id})" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </td>
    </tr>
  `).join('');
}

function refreshLeadsPage() {
  const connected = state.hubspot.phase === 'connected';
  const sendBtn   = document.getElementById('btn-send-leads');
  const warning   = document.getElementById('leads-warning');
  sendBtn.disabled = !connected;
  warning.style.display = connected ? 'none' : 'flex';
}

/* ============================================================
   SEND LEADS TO HUBSPOT
============================================================ */
async function sendLeads() {
  if (state.hubspot.phase !== 'connected') { toast('Connect HubSpot first.', 'error'); return; }
  if (state.leads.length === 0) { toast('Add at least one lead first.', 'error'); return; }

  const btn = document.getElementById('btn-send-leads');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner-sm"></div> Sending…';

  const url = 'https://uapi.albato.com/partners/trigger-actions/10025156/run/sync';

  for (const lead of state.leads) {
    const body = {
      credentialData: { '0': { value: state.hubspot.credentialId } },
      runnerData: {
        'cf__342f5c77ed008542e78094607ce1f7f3': lead.firstName,
        'cf__8ad75c5a8821cc294f189181722acb56': lead.lastName,
        'cf__0c83f57c786a0b4a39efab23731c7ebc': lead.email
      }
    };

    addLog({ type: 'req', method: 'POST', url, body, note: lead.firstName + ' ' + lead.lastName });

    try {
      const res = await fetch('/api/run-sync', {
        method: 'POST',
        headers: { ...bearerHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      addLog({ type: 'res', method: 'POST', url, status: res.status, body: data, note: lead.firstName + ' ' + lead.lastName });
    } catch (err) {
      addLog({ type: 'err', url, message: err.message, note: lead.firstName + ' ' + lead.lastName });
    }
  }

  btn.disabled = false;
  btn.innerHTML = [
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">',
    '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    'Send to HubSpot'
  ].join('');

  toast(state.leads.length + ' lead(s) sent — check Logs.', 'success');
  navigate('logs');
}

/* ============================================================
   LOGS
============================================================ */
function addLog(entry) {
  const log = Object.assign({}, entry, { id: Date.now() + Math.random(), ts: new Date() });
  state.logs.push(log);
  renderOneLog(log);
  updateLogsEmpty();
}

function renderOneLog(log) {
  const list = document.getElementById('logs-list');
  const div  = document.createElement('div');
  div.className = 'log-entry ' + log.type;
  div.id = 'log-' + log.id;

  const time   = log.ts.toLocaleTimeString('en-GB');
  const method = log.method ? `<span class="badge badge-${log.method.toLowerCase()}">${log.method}</span>` : '';
  const status = log.status ? `<span class="badge ${statusClass(log.status)}">${log.status}</span>` : '';
  const errBdg = log.type === 'err' ? `<span class="badge badge-err">ERR</span>` : '';
  const note   = log.note ? `<span class="log-note">${esc(log.note)}</span>` : '';
  const hasBody = log.body || log.message;

  const bodyContent = log.type === 'err'
    ? `<pre>Error: ${esc(log.message)}</pre>`
    : `<pre>${esc(JSON.stringify(log.body, null, 2))}</pre>`;

  div.innerHTML = `
    <div class="log-row" onclick="toggleLog('log-${log.id}')">
      <span class="log-time">${time}</span>
      ${errBdg}${method}${status}
      <span class="log-url">${esc(log.url)}</span>
      ${note}
      ${hasBody ? '<span class="log-chevron">▶</span>' : ''}
    </div>
    ${hasBody ? `<div class="log-body">${bodyContent}</div>` : ''}
  `;

  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
}

function toggleLog(id) {
  document.getElementById(id).classList.toggle('open');
}

function updateLogsEmpty() {
  const empty = document.getElementById('logs-empty-state');
  empty.style.display = state.logs.length === 0 ? 'flex' : 'none';
}

function clearLogs() {
  state.logs = [];
  document.getElementById('logs-list').innerHTML = '';
  updateLogsEmpty();
}

function statusClass(s) {
  if (s >= 200 && s < 300) return 'badge-200';
  if (s >= 400 && s < 500) return 'badge-4xx';
  return 'badge-5xx';
}

/* ============================================================
   TOKEN
============================================================ */
function updateToken(val) { state.apiToken = val; }

function toggleToken() {
  const input = document.getElementById('api-token');
  const btn   = document.getElementById('btn-toggle-token');
  const show  = input.type === 'password';
  input.type  = show ? 'text' : 'password';
  btn.textContent = show ? 'Hide' : 'Show';
}

function bearerHeaders() {
  return state.apiToken ? { 'Authorization': 'Bearer ' + state.apiToken } : {};
}

/* ============================================================
   TOAST
============================================================ */
function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (type ? ' ' + type : '');
  el.style.display = 'block';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

/* ============================================================
   UTILITIES
============================================================ */
function esc(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   INIT
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); });
  });

  // Tabs
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', () => switchTab(el.dataset.tab));
  });

  // Initial state
  renderLeads();
  refreshLeadsPage();
  updateLogsEmpty();
});
