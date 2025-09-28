console.log('[app.js] loaded');
const API_BASE = 'http://localhost:8001/api';
const DB_API = `${API_BASE}/db`;
const ACCOUNTS_PAGE = {
  checking: { card: '#llc-bank', balanceEl: '#llc-bank-balance' },
  savings: { card: '#llc-savings', balanceEl: '#llc-savings-balance' }
};
const DEFAULT_CHECKING_ID = 'acc_pitkd7ctkup704db7c000';
const TX_LIMIT = 30;
const formatUSD = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v || 0));

function getAccessToken() {
  try {
    const raw = localStorage.getItem('teller:enrollment');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.accessToken ? parsed.accessToken : null;
  } catch (_) {
    return null;
  }
}

function authHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: token } : {};
}

function requireTokenOrBanner() {
  if (getAccessToken()) return true;
  const banner = document.createElement('div');
  banner.className = 'max-w-7xl mx-auto mt-6 px-4';
  banner.innerHTML = '<div class="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded">Connect a bank on the main demo first so we can read your accounts. No access token found in this browser. Open the demo at <a class="underline" href="/index.html">/index.html</a> and complete Connect, then return here.</div>';
  document.body.prepend(banner);
  return false;
}

class Api {
  static async listAccounts() {
    const r = await fetch(`${API_BASE}/accounts`, { headers: { ...authHeaders() } });
    if (!r.ok) throw new Error(`listAccounts ${r.status}`);
    return r.json();
  }
  static async getDbBalances(accountId) {
    const r = await fetch(`${DB_API}/accounts/${accountId}/balances`, { headers: { ...authHeaders() } });
    if (!r.ok) throw new Error(`balances ${r.status}`);
    return r.json();
  }
  static async listDbTransactions(accountId, limit = TX_LIMIT) {
    const r = await fetch(`${DB_API}/accounts/${accountId}/transactions?limit=${limit}`, { headers: { ...authHeaders() } });
    if (!r.ok) throw new Error(`transactions ${r.status}`);
    return r.json();
  }
}

async function resolveAccountIds() {
  const accounts = await Api.listAccounts();
  let checking = accounts.find(a => a.type === 'depository' && a.subtype === 'checking');
  let savings = accounts.find(a => a.type === 'depository' && a.subtype === 'savings');
  if (!checking) checking = accounts.find(a => a.name && /checking/i.test(a.name));
  if (!savings) savings = accounts.find(a => a.name && /savings/i.test(a.name));
  if (!checking && !savings) throw new Error('Could not resolve any Checking/Savings accounts');
  return {
    checkingId: checking ? checking.id : null,
    savingsId: savings ? savings.id : null,
    checking,
    savings
  };
}

async function hydrateBalances(ids) {
  let cb = null, sb = null;
  const checkingEl = document.querySelector(ACCOUNTS_PAGE.checking.balanceEl);
  const savingsEl = document.querySelector(ACCOUNTS_PAGE.savings.balanceEl);
  try {
    if (ids.checkingId) {
      cb = await Api.getDbBalances(ids.checkingId);
      if (checkingEl) checkingEl.textContent = formatUSD(cb.available);
    } else if (checkingEl) {
      checkingEl.textContent = '—';
    }
  } catch (_) {
    if (checkingEl) checkingEl.textContent = '—';
  }
  try {
    if (ids.savingsId) {
      sb = await Api.getDbBalances(ids.savingsId);
      if (savingsEl) savingsEl.textContent = formatUSD(sb.available);
    } else if (savingsEl) {
      savingsEl.textContent = '—';
    }
  } catch (_) {
    if (savingsEl) savingsEl.textContent = '—';
  }
  return { checking: cb, savings: sb };
}

function renderTransactions(transactions) {
  const container = document.createElement('div');
  if (!transactions || !transactions.length) {
    container.innerHTML = '<div class="text-sm text-slate-500">No recent transactions.</div>';
    return container;
  }
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const t of transactions.slice(0, TX_LIMIT)) {
    const row = document.createElement('div');
    row.className = 'flex justify-between text-sm py-2 border-b border-slate-100';
    const left = document.createElement('div');
    left.className = 'text-slate-600';
    left.textContent = `${t.date} — ${t.description}`;
    const right = document.createElement('div');
    right.className = 'font-medium';
    right.textContent = formatUSD(t.amount);
    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  }
  return container;
}

function renderBalanceDetail(bal) {
  const n = document.createElement('div');
  n.className = 'bg-slate-50 rounded-lg p-3 mb-3 text-sm flex gap-6';
  n.innerHTML = `<div>Available: <span class="font-semibold">${formatUSD(bal.available)}</span></div>
<div>Ledger: <span class="font-semibold">${formatUSD(bal.ledger)}</span></div>`;
  return n;
}

function openModal(title, subtitle, node) {
  const modal = document.getElementById('account-modal');
  const titleEl = document.getElementById('modal-title');
  const subtitleEl = document.getElementById('modal-subtitle');
  const content = document.getElementById('modal-tab-content');
  titleEl.textContent = title;
  subtitleEl.textContent = subtitle || '';
  content.innerHTML = '';
  if (node) content.appendChild(node);
  modal.classList.remove('hidden');
  const mc = modal.querySelector('.modal-content');
  if (mc) mc.classList.remove('opacity-0', 'scale-95');
}

function closeModal() {
  const modal = document.getElementById('account-modal');
  modal.classList.add('hidden');
}

async function onCardClick(kind, ids) {
  const id = kind === 'checking' ? ids.checkingId : ids.savingsId;
  const content = document.createElement('div');
  const spinner = document.createElement('div');
  spinner.className = 'text-center text-slate-500 py-4';
  spinner.textContent = 'Loading...';
  content.appendChild(spinner);
  openModal(kind === 'checking' ? 'LLC Checking' : 'LLC Savings', 'Recent activity', content);
  try {
    const bal = await Api.getDbBalances(id);
    const txs = await Api.listDbTransactions(id, TX_LIMIT);
    content.innerHTML = '';
    content.appendChild(renderBalanceDetail(bal));
    content.appendChild(renderTransactions(txs));
  } catch (e) {
    content.innerHTML = '<div class="text-sm text-rose-600">Unable to load data right now.</div>';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[app.js] DOMContentLoaded');
  if (!requireTokenOrBanner()) {
    console.log('[app.js] missing token');
    return;
  }
  let ids = null;
  try {
    ids = await resolveAccountIds();
    console.log('[app.js] resolved ids', ids);
  } catch (e) {
    console.log('[app.js] resolve failed, using default', e && e.message);
    ids = { checkingId: DEFAULT_CHECKING_ID, savingsId: null };
  }
  window.__llcIds = ids;
  try {
    await hydrateBalances(ids);
    console.log('[app.js] hydrated balances');
  } catch (e) {
    console.log('[app.js] hydrate failed', e && e.message);
  }
  const checkingCard = document.querySelector(ACCOUNTS_PAGE.checking.card);
  const savingsCard = document.querySelector(ACCOUNTS_PAGE.savings.card);
  if (checkingCard && ids.checkingId) checkingCard.addEventListener('click', () => onCardClick('checking', ids));
  if (savingsCard && ids.savingsId) savingsCard.addEventListener('click', () => onCardClick('savings', ids));
});

document.addEventListener('click', (e) => {
  const modal = document.getElementById('account-modal');
  if (!modal) return;
  if (e.target && e.target.id === 'close-modal-btn') closeModal();
  if (e.target && e.target.id === 'account-modal') closeModal();
});
