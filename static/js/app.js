console.log('[app.js] loaded');

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocalhost 
  ? 'http://localhost:8001/api' 
  : 'https://devin-teller-api.onrender.com/api';
const DB_API = `${API_BASE}/db`;
const LLC_API = `${API_BASE}/llc`;

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
  banner.innerHTML = '<div class="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded">No access token found. Click the "Refresh Data" button below to authenticate and load your account data.</div>';
  document.body.prepend(banner);
  return true;
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
  static async getLiveBalances(accountId) {
    const r = await fetch(`${API_BASE}/accounts/${accountId}/balances`, { headers: { ...authHeaders() } });
    if (!r.ok) throw new Error(`getLiveBalances ${r.status}`);
    return r.json();
  }
  static async listDbTransactions(accountId, limit = TX_LIMIT) {
    const r = await fetch(`${DB_API}/accounts/${accountId}/transactions?limit=${limit}`, { headers: { ...authHeaders() } });
    if (!r.ok) throw new Error(`transactions ${r.status}`);
    return r.json();
  }
  
  static async loadLLCAccounts() {
    try {
      const r = await fetch(`${LLC_API}/accounts`, { headers: { ...authHeaders() } });
      if (!r.ok) throw new Error(`loadLLCAccounts ${r.status}`);
      return r.json();
    } catch (e) {
      console.error('[Api.loadLLCAccounts] error:', e);
      return [];
    }
  }
  
  static async saveLLCAccount(accountSlug, accountData) {
    try {
      const payload = { slug: accountSlug, ...accountData };
      console.log('[Api.saveLLCAccount] Saving account:', accountSlug, JSON.stringify(payload, null, 2));
      const r = await fetch(`${LLC_API}/accounts`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error(`saveLLCAccount ${r.status}`);
      const result = await r.json();
      console.log('[Api.saveLLCAccount] Backend response:', JSON.stringify(result, null, 2));
      return result;
    } catch (e) {
      console.error('[Api.saveLLCAccount] error:', e);
      throw e;
    }
  }
  
  static async loadRentData(monthStr) {
    try {
      const r = await fetch(`${LLC_API}/rent/${monthStr}`, { headers: { ...authHeaders() } });
      if (!r.ok) throw new Error(`loadRentData ${r.status}`);
      return r.json();
    } catch (e) {
      console.error('[Api.loadRentData] error:', e);
      return null;
    }
  }
  
  static async saveRentData(monthStr, rentData) {
    try {
      const r = await fetch(`${LLC_API}/rent/${monthStr}`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(rentData)
      });
      if (!r.ok) throw new Error(`saveRentData ${r.status}`);
      return r.json();
    } catch (e) {
      console.error('[Api.saveRentData] error:', e);
      throw e;
    }
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

async function fetchFreshBalances(ids) {
  const promises = [];
  if (ids.checkingId) {
    promises.push(
      Api.getLiveBalances(ids.checkingId).catch(e => {
        console.error('[app.js] failed to fetch checking balance', e);
      })
    );
  }
  if (ids.savingsId) {
    promises.push(
      Api.getLiveBalances(ids.savingsId).catch(e => {
        console.error('[app.js] failed to fetch savings balance', e);
      })
    );
  }
  await Promise.all(promises);
}

function getPersistedAccountIds() {
  try {
    const raw = localStorage.getItem('accountIds');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function persistAccountIds(ids) {
  try {
    const existing = getPersistedAccountIds() || {};
    const merged = {
      checkingId: ids.checkingId || existing.checkingId || null,
      savingsId: ids.savingsId || existing.savingsId || null
    };
    localStorage.setItem('accountIds', JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.error('[app.js] failed to persist account IDs', e);
    return ids;
  }
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

async function handleRefresh() {
  console.log('[app.js] refresh button clicked');
  const refreshBtn = document.getElementById('refresh-data-btn');
  
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '🔄 Connecting...';
  }
  
  try {
    if (typeof TellerConnect !== 'undefined') {
      console.log('[app.js] TellerConnect SDK available, starting real authentication flow');
      const tellerConnect = TellerConnect.setup({
        applicationId: 'app_pj4c5t83p8q0ibrr8k000',
        environment: 'development',
        products: ['balance', 'transactions'],
        selectAccount: 'multiple',
        onSuccess: async function(enrollment) {
          console.log('[app.js] TellerConnect enrollment success', enrollment);
          
          if (typeof TellerStore !== 'undefined') {
            const store = new TellerStore();
            store.putEnrollment(enrollment);
            store.putUser(enrollment.user);
          } else {
            localStorage.setItem('teller:enrollment', JSON.stringify(enrollment));
            localStorage.setItem('teller:user', JSON.stringify(enrollment.user));
          }
          
          const ids = await resolveAccountIds();
          console.log('[app.js] resolved ids after enrollment', ids);
          
          const mergedIds = persistAccountIds(ids);
          console.log('[app.js] persisted and merged account IDs', mergedIds);
          window.__llcIds = mergedIds;
          
          await fetchFreshBalances(mergedIds);
          console.log('[app.js] fetched fresh balances from Teller API');
          
          await hydrateBalances(mergedIds);
          console.log('[app.js] hydrated balances after enrollment');
          
          const checkingCard = document.querySelector(ACCOUNTS_PAGE.checking.card);
          const savingsCard = document.querySelector(ACCOUNTS_PAGE.savings.card);
          if (checkingCard && mergedIds.checkingId) {
            checkingCard.replaceWith(checkingCard.cloneNode(true));
            document.querySelector(ACCOUNTS_PAGE.checking.card).addEventListener('click', () => onCardClick('checking', mergedIds));
          }
          if (savingsCard && mergedIds.savingsId) {
            savingsCard.replaceWith(savingsCard.cloneNode(true));
            document.querySelector(ACCOUNTS_PAGE.savings.card).addEventListener('click', () => onCardClick('savings', mergedIds));
          }
        },
        onFailure: function(error) {
          console.error('[app.js] TellerConnect enrollment failed', error);
          alert('Authentication failed: ' + (error.message || 'Please try again.'));
        },
        onExit: function() {
          console.log('[app.js] User closed TellerConnect without completing enrollment');
        }
      });
      
      tellerConnect.open();
    } else {
      console.log('[app.js] TellerConnect SDK not available, simulating authentication flow for development');
      
      const userConfirmed = confirm(
        'TellerConnect Authentication Flow\n\n' +
        'In production, this would open the Teller Connect authentication window where you would:\n' +
        '1. Select your bank\n' +
        '2. Enter your banking credentials\n' +
        '3. Choose which accounts to connect\n' +
        '4. Complete the secure authentication process\n\n' +
        'For development purposes, would you like to simulate a successful authentication?'
      );
      
      if (userConfirmed) {
        console.log('[app.js] Simulating successful TellerConnect enrollment');
        
        const mockEnrollment = {
          accessToken: 'test_token_' + Date.now(),
          user: {
            id: 'test_user_' + Date.now()
          },
          accounts: [
            {
              id: 'acc_checking_' + Date.now(),
              name: 'LLC Checking',
              type: 'depository',
              subtype: 'checking'
            },
            {
              id: 'acc_savings_' + Date.now(),
              name: 'LLC Savings',
              type: 'depository',
              subtype: 'savings'
            }
          ]
        };
        
        if (typeof TellerStore !== 'undefined') {
          const store = new TellerStore();
          store.putEnrollment(mockEnrollment);
          store.putUser(mockEnrollment.user);
        } else {
          localStorage.setItem('teller:enrollment', JSON.stringify(mockEnrollment));
          localStorage.setItem('teller:user', JSON.stringify(mockEnrollment.user));
        }
        
        const ids = await resolveAccountIds();
        console.log('[app.js] resolved ids after simulated enrollment', ids);
        
        const mergedIds = persistAccountIds(ids);
        console.log('[app.js] persisted and merged account IDs', mergedIds);
        window.__llcIds = mergedIds;
        
        await fetchFreshBalances(mergedIds);
        console.log('[app.js] fetched fresh balances from Teller API (simulated)');
        
        await hydrateBalances(mergedIds);
        console.log('[app.js] hydrated balances after simulated enrollment');
        
        const checkingCard = document.querySelector(ACCOUNTS_PAGE.checking.card);
        const savingsCard = document.querySelector(ACCOUNTS_PAGE.savings.card);
        if (checkingCard && mergedIds.checkingId) {
          checkingCard.replaceWith(checkingCard.cloneNode(true));
          document.querySelector(ACCOUNTS_PAGE.checking.card).addEventListener('click', () => onCardClick('checking', mergedIds));
        }
        if (savingsCard && mergedIds.savingsId) {
          savingsCard.replaceWith(savingsCard.cloneNode(true));
          document.querySelector(ACCOUNTS_PAGE.savings.card).addEventListener('click', () => onCardClick('savings', mergedIds));
        }
        
        alert('Simulated authentication completed! In production, this would be the real Teller Connect flow.');
      } else {
        console.log('[app.js] User cancelled simulated authentication');
      }
    }
    
  } catch (e) {
    console.log('[app.js] refresh failed', e && e.message);
    alert('Failed to start authentication. Please check your connection and try again.');
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = '🔄 Refresh Data';
    }
  }
}

let accountsData = {
  juliePersonalFinances: {
    name: "Julie's Finances",
    subtitle: "Transactions related to the LLC.",
    balance: null,
    type: 'personal',
    transactions: [
      { date: '2025-01-15', description: 'Loan to LLC (from HELOC)', debit: 0, credit: 50000 },
      { date: '2025-03-05', description: 'Loan to LLC (Roof Share)', debit: 0, credit: 7500 },
      { date: '2025-04-05', description: 'Distribution from LLC', debit: 1000, credit: 0 },
      { date: '2025-04-06', description: 'Payment to HELOC Lender', debit: 0, credit: 500 },
      { date: '2025-04-06', description: 'Share of Mortgage Payment', debit: 0, credit: 750 },
    ]
  },
  davidPersonalFinances: {
    name: "David's Finances",
    subtitle: "Transactions related to the LLC.",
    balance: null,
    type: 'personal',
    transactions: [
      { date: '2025-03-05', description: 'Loan to LLC (Roof Share)', debit: 0, credit: 7500 },
      { date: '2025-04-05', description: 'Distribution from LLC', debit: 1000, credit: 0 },
      { date: '2025-04-06', description: 'Share of Mortgage Payment', debit: 0, credit: 750 },
    ]
  },
  llcBank: {
    name: "LLC Checking",
    subtitle: "Central hub for all business income and expenses.",
    balance: 0,
    type: 'asset',
    isTellerAccount: true,
    transactions: []
  },
  llcSavings: {
    name: "LLC Savings",
    subtitle: "Reserve funds for future capital expenditures.",
    balance: 0,
    type: 'asset',
    isTellerAccount: true,
    transactions: []
  },
  helocLoan: {
    name: "HELOC Loan",
    subtitle: "Liability from Julie's HELOC for the down payment.",
    balance: 50000,
    type: 'liability',
    transactions: [
      { date: '2025-01-15', description: 'Loan from Julie', debit: 0, credit: 50000 },
    ],
    financingTerms: {
      principal: 50000,
      interestRate: 6.5,
      termYears: 15,
      breakdown: {
        Total: 50000,
        Julie: 50000,
        David: 0
      }
    }
  },
  memberLoan: {
    name: "Member Loan (Roof)",
    subtitle: "A formal liability owed by the LLC to its members.",
    balance: 15000,
    type: 'liability',
    transactions: [
      { date: '2025-03-05', description: 'Loan proceeds for roof', debit: 0, credit: 15000 },
    ],
    financingTerms: {
      principal: 15000,
      interestRate: 5.0,
      termYears: 10,
      breakdown: {
        Total: 15000,
        Julie: 7500,
        David: 7500
      }
    }
  },
  mortgageLoan: {
    name: "672 Elm St. Mortgage",
    subtitle: "Primary mortgage for the investment property.",
    balance: 200000,
    type: 'liability',
    transactions: [
      { date: '2025-01-20', description: 'Initial Mortgage Loan', debit: 0, credit: 200000 },
    ],
    financingTerms: {
      principal: 200000,
      interestRate: 7.1,
      termYears: 30
    }
  },
  propertyAsset: {
    name: "672 Elm St",
    subtitle: "The capitalized value of the building and improvements.",
    balance: 265000,
    type: 'asset',
    transactions: [
      { date: '2025-01-20', description: 'Property Acquisition (Building Value)', debit: 250000, credit: 0 },
      { date: '2025-03-10', description: 'Capital Improvement (New Roof)', debit: 15000, credit: 0 },
    ]
  },
  rent: {
    name: "Rent Roll",
    subtitle: "Monthly rental income from all units.",
    totalMonthlyRent: 5000,
    type: 'revenue',
    baseTenants: [
      { id: 0, floor: "1st Floor", renter: "NA" },
      { id: 1, floor: "2nd Floor", renter: "Gina" },
      { id: 2, floor: "2nd Floor", renter: "ECC" },
      { id: 3, floor: "3rd Floor", renter: "Timoth" },
      { id: 4, floor: "3rd Floor", renter: "Angua" },
      { id: 5, floor: "Barn", renter: "Steve" }
    ],
    monthlyRecords: [
      {
        month: "2025-08",
        tenants: [
          { id: 0, monthlyRent: "TBD", due: 0, received: 0 },
          { id: 1, monthlyRent: 1300, due: 1300, received: 1300 },
          { id: 2, monthlyRent: 1250, due: 1250, received: 1250 },
          { id: 3, monthlyRent: 1200, due: 1200, received: 0 },
          { id: 4, monthlyRent: 0, due: 0, received: 0 },
          { id: 5, monthlyRent: 1250, due: 1250, received: 1250 }
        ]
      }
    ]
  }
};

const callGemini = async (prompt, maxRetries = 3) => {
  let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
  const payload = { contents: chatHistory };
  const apiKey = "";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        return result.candidates[0].content.parts[0].text;
      } else {
        throw new Error("Invalid response structure from Gemini API");
      }
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error("Gemini API call failed after multiple retries:", error);
        return "Sorry, I was unable to process your request at this time. Please try again later.";
      }
      const delay = Math.pow(2, i) * 1000;
      await new Promise(res => setTimeout(res, delay));
    }
  }
};

function formatCurrency(amount) {
  if (amount === null || isNaN(amount)) return '';
  return Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

async function loadAccountDataFromBackend() {
  try {
    console.log('[loadAccountDataFromBackend] Loading LLC accounts from backend...');
    const llcAccounts = await Api.loadLLCAccounts();
    console.log('[loadAccountDataFromBackend] Backend returned:', JSON.stringify(llcAccounts, null, 2));
    
    if (llcAccounts && llcAccounts.length > 0) {
      console.log('[loadAccountDataFromBackend] Loaded', llcAccounts.length, 'accounts from backend');
      
      llcAccounts.forEach(account => {
        if (accountsData[account.slug]) {
          accountsData[account.slug].balance = parseFloat(account.current_balance) || 0;
          
          if (account.transactions && account.transactions.length > 0) {
            accountsData[account.slug].transactions = account.transactions.map(tx => ({
              date: tx.txn_date || tx.date,
              description: tx.description,
              debit: parseFloat(tx.debit) || 0,
              credit: parseFloat(tx.credit) || 0
            }));
          }
          
          if (account.financing_terms) {
            accountsData[account.slug].financingTerms = {
              principal: parseFloat(account.financing_terms.principal) || 0,
              interestRate: parseFloat(account.financing_terms.interest_rate) || 0,
              termYears: parseInt(account.financing_terms.term_years) || 0,
              breakdown: account.financing_terms.breakdown
            };
          }
        }
      });
    }
    
    const currentMonth = new Date();
    const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    const rentData = await Api.loadRentData(monthStr);
    
    if (rentData && rentData.baseTenants) {
      console.log('[loadAccountDataFromBackend] Loaded rent data for', monthStr);
      accountsData.rent.baseTenants = rentData.baseTenants;
      if (rentData.totalMonthlyRent) {
        accountsData.rent.totalMonthlyRent = parseFloat(rentData.totalMonthlyRent);
      }
      if (rentData.currentRecord) {
        const existingRecord = accountsData.rent.monthlyRecords.find(r => r.month === monthStr);
        if (existingRecord) {
          existingRecord.tenants = rentData.currentRecord.tenants;
        } else {
          accountsData.rent.monthlyRecords.push({
            month: monthStr,
            tenants: rentData.currentRecord.tenants
          });
        }
      }
    }
    
    console.log('[loadAccountDataFromBackend] Successfully loaded all account data from backend');
    return true;
  } catch (e) {
    console.error('[loadAccountDataFromBackend] Error loading data:', e);
    return false;
  }
}

function calculateTotalEquity() {
  const totalAssets = Object.values(accountsData)
    .filter(acc => acc.type === 'asset')
    .reduce((sum, acc) => sum + acc.balance, 0);

  const totalLiabilities = Object.values(accountsData)
    .filter(acc => acc.type === 'liability')
    .reduce((sum, acc) => sum + acc.balance, 0);

  return totalAssets - totalLiabilities;
}

function updateDashboardBalances() {
  const propertyEl = document.getElementById('property-asset-balance');
  const llcBankEl = document.getElementById('llc-bank-balance');
  const llcSavingsEl = document.getElementById('llc-savings-balance');
  const helocEl = document.getElementById('heloc-loan-balance');
  const memberLoanEl = document.getElementById('member-loan-balance');
  const mortgageEl = document.getElementById('mortgage-loan-balance');
  const rentTotalEl = document.getElementById('rent-roll-total');
  const equityEl = document.getElementById('total-equity-balance');

  if (propertyEl) propertyEl.textContent = formatCurrency(accountsData.propertyAsset.balance);
  if (llcBankEl && !accountsData.llcBank.isTellerAccount) llcBankEl.textContent = formatCurrency(accountsData.llcBank.balance);
  if (llcSavingsEl && !accountsData.llcSavings.isTellerAccount) llcSavingsEl.textContent = formatCurrency(accountsData.llcSavings.balance);
  if (helocEl) helocEl.textContent = formatCurrency(accountsData.helocLoan.balance);
  if (memberLoanEl) memberLoanEl.textContent = formatCurrency(accountsData.memberLoan.balance);
  if (mortgageEl) mortgageEl.textContent = formatCurrency(accountsData.mortgageLoan.balance);
  if (rentTotalEl) rentTotalEl.textContent = formatCurrency(accountsData.rent.totalMonthlyRent);
  if (equityEl) equityEl.textContent = formatCurrency(calculateTotalEquity());
}

function openModalForAccount(accountId) {
  let data;
  if (accountId === 'totalEquity') {
    data = { name: "Owner's Equity Calculation", subtitle: "A snapshot of the LLC's net worth." };
  } else {
    data = accountsData[accountId];
  }

  const modal = document.getElementById('account-modal');
  modal.dataset.currentAccount = accountId;
  document.getElementById('modal-title').textContent = data.name;
  document.getElementById('modal-subtitle').textContent = data.subtitle;

  const tabsContainer = document.getElementById('modal-tabs');
  tabsContainer.innerHTML = '';
  const contentContainer = document.getElementById('modal-tab-content');
  contentContainer.innerHTML = '';
  const footerContainer = document.getElementById('modal-footer');
  footerContainer.innerHTML = '';

  if (accountId === 'rent') {
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    renderRentModal(currentMonthStr);
  } else if (accountId === 'totalEquity') {
    renderEquityModal();
  } else {
    const availableTabs = ['Transactions'];
    if (data.financingTerms) {
      availableTabs.push('Financing Terms', 'Amortization');
    }

    availableTabs.forEach((tabName, index) => {
      const tab = document.createElement('button');
      tab.className = `tab text-sm font-semibold p-4 border-b-2 border-transparent text-slate-500 hover:text-slate-700 ${index === 0 ? 'active' : ''}`;
      tab.textContent = tabName;
      tab.dataset.tabContentId = tabName.toLowerCase().replace(/\s+/g, '-');
      tabsContainer.appendChild(tab);
    });

    tabsContainer.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        tabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderTabContent(accountId, tab.dataset.tabContentId);
      });
    });

    renderTabContent(accountId, availableTabs[0].toLowerCase().replace(/\s+/g, '-'));
  }

  modal.classList.remove('hidden');
  setTimeout(() => {
    const modalBg = modal.querySelector('.modal-bg');
    const modalContent = modal.querySelector('.modal-content');
    modalBg.classList.remove('opacity-0');
    modalContent.classList.remove('scale-95', 'opacity-0');
  }, 10);
}

function renderTabContent(accountId, tabId) {
  const data = accountsData[accountId];
  const contentContainer = document.getElementById('modal-tab-content');
  const footerContainer = document.getElementById('modal-footer');
  let html = '';
  footerContainer.innerHTML = '';

  switch (tabId) {
    case 'transactions':
      html = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead class="bg-slate-50 text-xs text-slate-700 uppercase">
              <tr>
                <th class="px-2 py-3">Date</th>
                <th class="px-2 py-3">Description</th>
                <th class="px-2 py-3 text-right">Debit (In)</th>
                <th class="px-2 py-3 text-right">Credit (Out)</th>
                <th class="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody id="transaction-table-body">
              ${data.transactions.map(tx => createTransactionRow(tx)).join('')}
            </tbody>
          </table>
        </div>
      `;
      footerContainer.innerHTML = `
        <div class="flex justify-between">
          <button id="add-tx-btn" class="bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors">Add Transaction</button>
          <button id="save-tx-btn" class="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors">Save Changes</button>
        </div>
      `;
      break;
    case 'financing-terms':
      const terms = data.financingTerms;
      let breakdownHtml = '';
      if (terms.breakdown) {
        breakdownHtml = Object.entries(terms.breakdown).map(([key, value]) => `
          <div class="bg-slate-100 p-4 rounded-lg">
            <p class="text-sm text-slate-500">Principal (${key})</p>
            <p class="text-2xl font-bold text-slate-800">${formatCurrency(value)}</p>
          </div>
        `).join('');
      } else {
        breakdownHtml = `<div class="bg-slate-100 p-4 rounded-lg">
          <p class="text-sm text-slate-500">Principal</p>
          <p class="text-2xl font-bold text-slate-800">${formatCurrency(terms.principal)}</p>
        </div>`;
      }

      html = `
        <div class="grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
          ${breakdownHtml}
          <div class="bg-slate-100 p-4 rounded-lg">
            <p class="text-sm text-slate-500">Interest Rate</p>
            <p class="text-2xl font-bold text-slate-800">${terms.interestRate.toFixed(2)}%</p>
          </div>
          <div class="bg-slate-100 p-4 rounded-lg">
            <p class="text-sm text-slate-500">Term</p>
            <p class="text-2xl font-bold text-slate-800">${terms.termYears} Years</p>
          </div>
        </div>
      `;
      break;
    case 'amortization':
      html = generateAmortizationTable(data.financingTerms);
      break;
  }
  contentContainer.innerHTML = html;
  if (tabId === 'transactions') {
    attachTransactionButtonListeners();
  }
}

function createTransactionRow(tx = { date: new Date().toISOString().split('T')[0], description: '', debit: 0, credit: 0 }) {
  return `
    <tr class="bg-white border-b transaction-row">
      <td class="px-2 py-2"><input type="date" class="tx-date w-full border rounded p-1" value="${tx.date}"></td>
      <td class="px-2 py-2"><input type="text" class="tx-desc w-full border rounded p-1" value="${tx.description}"></td>
      <td class="px-2 py-2"><input type="number" step="0.01" class="tx-debit w-full border rounded p-1 text-right" value="${tx.debit}"></td>
      <td class="px-2 py-2"><input type="number" step="0.01" class="tx-credit w-full border rounded p-1 text-right" value="${tx.credit}"></td>
      <td class="px-2 py-2 text-center"><button class="delete-tx-btn text-red-500 hover:text-red-700 font-bold text-xl">&times;</button></td>
    </tr>
  `;
}

function attachTransactionButtonListeners() {
  document.getElementById('add-tx-btn').addEventListener('click', () => {
    const tableBody = document.getElementById('transaction-table-body');
    tableBody.insertAdjacentHTML('beforeend', createTransactionRow());
    attachDeleteListeners();
  });

  document.getElementById('save-tx-btn').addEventListener('click', async () => {
    const accountId = document.getElementById('account-modal').dataset.currentAccount;
    const newTransactions = [];
    document.querySelectorAll('#transaction-table-body .transaction-row').forEach(row => {
      newTransactions.push({
        date: row.querySelector('.tx-date').value,
        description: row.querySelector('.tx-desc').value,
        debit: parseFloat(row.querySelector('.tx-debit').value) || 0,
        credit: parseFloat(row.querySelector('.tx-credit').value) || 0,
      });
    });
    accountsData[accountId].transactions = newTransactions;
    recalculateBalance(accountId);
    updateDashboardBalances();
    
    try {
      await Api.saveLLCAccount(accountId, {
        name: accountsData[accountId].name,
        subtitle: accountsData[accountId].subtitle,
        account_type: accountsData[accountId].type,
        current_balance: accountsData[accountId].balance,
        transactions: newTransactions
      });
      console.log('[save-tx-btn] Successfully saved account data to backend');
    } catch (e) {
      console.error('[save-tx-btn] Failed to save account data:', e);
      alert('Failed to save changes to server. Please try again.');
      return;
    }
    
    closeModal();
  });

  attachDeleteListeners();
}

function attachDeleteListeners() {
  document.querySelectorAll('.delete-tx-btn').forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });
  document.querySelectorAll('.delete-tx-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.transaction-row').remove();
    });
  });
}

function recalculateBalance(accountId) {
  const account = accountsData[accountId];
  if (account.type === 'personal' || account.isTellerAccount) return;

  let balance = 0;
  const transactions = account.transactions;

  if (account.type === 'asset') {
    balance = transactions.reduce((acc, tx) => acc + tx.debit - tx.credit, 0);
  } else if (account.type === 'liability') {
    balance = transactions.reduce((acc, tx) => acc - tx.debit + tx.credit, 0);
  }
  account.balance = balance;
}

function renderRentModal(monthStr) {
  const contentContainer = document.getElementById('modal-tab-content');
  const footerContainer = document.getElementById('modal-footer');
  const tabsContainer = document.getElementById('modal-tabs');

  let currentMonth = new Date(monthStr + '-02');

  let monthRecord = accountsData.rent.monthlyRecords.find(r => r.month === monthStr);
  if (!monthRecord) {
    const lastRecord = accountsData.rent.monthlyRecords[accountsData.rent.monthlyRecords.length - 1];
    monthRecord = {
      month: monthStr,
      tenants: lastRecord.tenants.map(t => ({ ...t, due: 0, received: 0 }))
    };
    accountsData.rent.monthlyRecords.push(monthRecord);
    accountsData.rent.monthlyRecords.sort((a, b) => a.month.localeCompare(b.month));
  }

  const monthDisplay = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  tabsContainer.innerHTML = `
    <div class="flex justify-between items-center w-full">
      <button id="prev-month-btn" class="px-3 py-1 bg-slate-200 rounded-md hover:bg-slate-300">&lt; Prev</button>
      <span class="font-bold text-lg">${monthDisplay}</span>
      <button id="next-month-btn" class="px-3 py-1 bg-slate-200 rounded-md hover:bg-slate-300">Next &gt;</button>
    </div>
  `;

  const floors = ['3rd Floor', '2nd Floor', '1st Floor', 'Barn'];
  let tenantsHtml = '';

  floors.forEach(floor => {
    const tenantsOnFloor = accountsData.rent.baseTenants.filter(t => t.floor === floor);
    if (tenantsOnFloor.length > 0) {
      let floorSubtotal = 0;
      tenantsHtml += `
        <div class="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <h3 class="text-lg font-bold text-slate-800 mb-3">${floor}</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead class="bg-slate-200 text-xs text-slate-700 uppercase">
                <tr>
                  <th class="px-2 py-2">Renter</th>
                  <th class="px-2 py-2 text-right">Monthly Rent</th>
                  <th class="px-2 py-2 text-right">$ Due</th>
                  <th class="px-2 py-2 text-right">$ Received</th>
                </tr>
              </thead>
              <tbody>
      `;

      tenantsOnFloor.forEach(baseTenant => {
        const tenantData = monthRecord.tenants.find(t => t.id === baseTenant.id) || { monthlyRent: 'TBD', due: 0, received: 0 };
        let monthlyRentValue = tenantData.monthlyRent === 'TBD' ? '' : tenantData.monthlyRent;
        let monthlyRentPlaceholder = tenantData.monthlyRent === 'TBD' ? 'TBD' : '0.00';
        const rent = parseFloat(tenantData.monthlyRent);
        if (!isNaN(rent)) {
          floorSubtotal += rent;
        }
        tenantsHtml += `
          <tr class="bg-white border-b tenant-row" data-tenant-id="${baseTenant.id}">
            <td class="px-2 py-2"><input type="text" value="${baseTenant.renter}" class="w-full border rounded p-1 rent-renter"></td>
            <td class="px-2 py-2"><input type="text" value="${monthlyRentValue}" placeholder="${monthlyRentPlaceholder}" class="w-full border rounded p-1 text-right rent-monthly"></td>
            <td class="px-2 py-2"><input type="number" step="0.01" value="${tenantData.due}" class="w-full border rounded p-1 text-right rent-due"></td>
            <td class="px-2 py-2"><input type="number" step="0.01" value="${tenantData.received}" class="w-full border rounded p-1 text-right rent-received"></td>
          </tr>
        `;
      });

      tenantsHtml += `
                  <tr class="bg-slate-100 font-bold">
                    <td class="px-2 py-2 text-right" colspan="1">Sub-total</td>
                    <td class="px-2 py-2 text-right">${formatCurrency(floorSubtotal)}</td>
                    <td class="px-2 py-2"></td>
                    <td class="px-2 py-2"></td>
                  </tr>
                </tbody></table></div></div>
      `;
    }
  });

  const totalMonthlyRent = monthRecord.tenants.reduce((total, tenant) => {
    const rent = parseFloat(tenant.monthlyRent);
    return total + (isNaN(rent) ? 0 : rent);
  }, 0);

  tenantsHtml += `
    <div class="mt-6 p-4 bg-blue-100 rounded-lg border border-blue-200">
      <div class="flex justify-end items-center">
        <h4 class="font-bold text-lg text-blue-800 mr-4">Total Monthly Rent:</h4>
        <p class="text-xl font-bold text-blue-900">${formatCurrency(totalMonthlyRent)}</p>
      </div>
    </div>
  `;

  contentContainer.innerHTML = `<div id="rent-roll-editor">${tenantsHtml}</div>`;
  footerContainer.innerHTML = `
    <div class="flex justify-end">
      <button id="save-rent-btn" class="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors">Save Changes</button>
    </div>
  `;

  document.getElementById('prev-month-btn').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    const newMonthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    renderRentModal(newMonthStr);
  });

  document.getElementById('next-month-btn').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    const newMonthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    renderRentModal(newMonthStr);
  });

  document.getElementById('save-rent-btn').addEventListener('click', async () => {
    const currentRecord = accountsData.rent.monthlyRecords.find(r => r.month === monthStr);
    let totalRent = 0;

    document.querySelectorAll('.tenant-row').forEach(row => {
      const tenantId = parseInt(row.dataset.tenantId);
      const baseTenant = accountsData.rent.baseTenants.find(t => t.id === tenantId);
      baseTenant.renter = row.querySelector('.rent-renter').value;

      const tenantRecord = currentRecord.tenants.find(t => t.id === tenantId);
      const monthlyRentVal = row.querySelector('.rent-monthly').value;
      tenantRecord.monthlyRent = monthlyRentVal === '' || isNaN(parseFloat(monthlyRentVal)) ? "TBD" : parseFloat(monthlyRentVal);
      tenantRecord.due = parseFloat(row.querySelector('.rent-due').value) || 0;
      tenantRecord.received = parseFloat(row.querySelector('.rent-received').value) || 0;

      if (typeof tenantRecord.monthlyRent === 'number') {
        totalRent += tenantRecord.monthlyRent;
      }
    });
    accountsData.rent.totalMonthlyRent = totalRent;
    updateDashboardBalances();
    
    try {
      await Api.saveRentData(monthStr, {
        baseTenants: accountsData.rent.baseTenants,
        currentRecord: currentRecord,
        totalMonthlyRent: totalRent
      });
      console.log('[save-rent-btn] Successfully saved rent data to backend');
    } catch (e) {
      console.error('[save-rent-btn] Failed to save rent data:', e);
      alert('Failed to save rent changes to server. Please try again.');
      return;
    }
    
    closeModal();
  });
}

function renderEquityModal() {
  const contentContainer = document.getElementById('modal-tab-content');
  const ownersEquity = calculateTotalEquity();

  const totalAssets = Object.values(accountsData)
    .filter(acc => acc.type === 'asset')
    .reduce((sum, acc) => sum + acc.balance, 0);

  const totalLiabilities = Object.values(accountsData)
    .filter(acc => acc.type === 'liability')
    .reduce((sum, acc) => sum + acc.balance, 0);

  contentContainer.innerHTML = `
    <div class="space-y-4 text-center">
      <div class="bg-green-50 p-4 rounded-lg">
        <p class="text-sm text-green-700">Total Assets</p>
        <p class="text-3xl font-bold text-green-900">${formatCurrency(totalAssets)}</p>
      </div>
      <p class="text-2xl font-bold text-slate-500">-</p>
      <div class="bg-rose-50 p-4 rounded-lg">
        <p class="text-sm text-rose-700">Total Liabilities</p>
        <p class="text-3xl font-bold text-rose-900">${formatCurrency(totalLiabilities)}</p>
      </div>
      <p class="text-2xl font-bold text-slate-500">=</p>
      <div class="bg-indigo-50 p-4 rounded-lg">
        <p class="text-sm text-indigo-700">Owner's Equity</p>
        <p class="text-3xl font-bold text-indigo-900">${formatCurrency(ownersEquity)}</p>
      </div>
    </div>
  `;
}

function generateAmortizationTable(terms) {
  const { principal, interestRate, termYears } = terms;
  const monthlyRate = interestRate / 100 / 12;
  const numberOfPayments = termYears * 12;
  const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

  let tableHtml = `
    <div class="mb-4 text-center">
      <p class="text-sm text-slate-500">Calculated Monthly Payment</p>
      <p class="text-2xl font-bold text-indigo-600">${formatCurrency(monthlyPayment)}</p>
    </div>
    <div class="overflow-auto max-h-96">
      <table class="w-full text-sm text-left">
        <thead class="bg-slate-50 text-xs text-slate-700 uppercase sticky top-0">
          <tr>
            <th class="px-4 py-3">Pmt #</th>
            <th class="px-4 py-3 text-right">Principal</th>
            <th class="px-4 py-3 text-right">Interest</th>
            <th class="px-4 py-3 text-right">Remaining Balance</th>
          </tr>
        </thead>
        <tbody>`;

  let remainingBalance = principal;
  for (let i = 1; i <= numberOfPayments; i++) {
    const interest = remainingBalance * monthlyRate;
    const principalPayment = monthlyPayment - interest;
    remainingBalance -= principalPayment;
    tableHtml += `
      <tr class="bg-white border-b">
        <td class="px-4 py-2">${i}</td>
        <td class="px-4 py-2 text-right">${formatCurrency(principalPayment)}</td>
        <td class="px-4 py-2 text-right">${formatCurrency(interest)}</td>
        <td class="px-4 py-2 text-right font-medium">${formatCurrency(Math.abs(remainingBalance))}</td>
      </tr>`;
  }

  tableHtml += `</tbody></table></div>`;
  return tableHtml;
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[app.js] DOMContentLoaded');
  if (!requireTokenOrBanner()) {
    console.log('[app.js] missing token');
    return;
  }

  let ids = { checkingId: DEFAULT_CHECKING_ID, savingsId: null };
  try {
    const persistedIds = getPersistedAccountIds();
    if (persistedIds && (persistedIds.checkingId || persistedIds.savingsId)) {
      ids = persistedIds;
      console.log('[app.js] loaded persisted account IDs', ids);
    } else {
      const enrollment = JSON.parse(localStorage.getItem('teller:enrollment') || 'null');
      if (enrollment && enrollment.accessToken) {
        const resolvedIds = await resolveAccountIds();
        ids = resolvedIds;
        console.log('[app.js] resolved ids from enrollment', ids);
      }
    }
  } catch (e) {
    console.log('[app.js] using default ids, could not load persisted IDs', e.message);
  }
  window.__llcIds = ids;

  try {
    await hydrateBalances(ids);
    console.log('[app.js] hydrated cached balances');
  } catch (e) {
    console.log('[app.js] hydrate cached failed', e && e.message);
  }

  try {
    await loadAccountDataFromBackend();
    console.log('[app.js] loaded LLC account data from backend');
  } catch (e) {
    console.log('[app.js] failed to load LLC data from backend', e && e.message);
  }

  document.querySelectorAll('.account-card').forEach(card => {
    card.addEventListener('click', () => {
      const accountId = card.dataset.accountId;
      if (accountId === 'llcBank') {
        onCardClick('checking', ids);
      } else if (accountId === 'llcSavings') {
        onCardClick('savings', ids);
      } else if (accountId) {
        openModalForAccount(accountId);
      }
    });
  });

  const refreshBtn = document.getElementById('refresh-data-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', handleRefresh);
  }

  const generateSummaryBtn = document.getElementById('generate-summary-btn');
  const summaryLoader = document.getElementById('summary-loader');
  const summaryOutput = document.getElementById('summary-output');

  if (generateSummaryBtn) {
    generateSummaryBtn.addEventListener('click', async () => {
      summaryLoader.classList.remove('hidden');
      summaryOutput.classList.add('hidden');
      summaryOutput.textContent = '';

      const financialData = {
        assets: {
          propertyValue: accountsData.propertyAsset.balance,
          checking: accountsData.llcBank.balance,
          savings: accountsData.llcSavings.balance
        },
        liabilities: {
          mortgageLoan: accountsData.mortgageLoan.balance,
          helocLoan: accountsData.helocLoan.balance,
          memberLoan: accountsData.memberLoan.balance
        },
        recentTransactions: accountsData.llcBank.transactions.slice(-5)
      };

      const prompt = `You are a financial analyst for a small real estate LLC. Based on the following JSON data, provide a concise, easy-to-read summary of the LLC's current financial health in markdown format. Highlight key metrics like liquidity (cash on hand), total debt, and net asset value (Assets - Liabilities). Analyze the recent transactions for cash flow insights.
      
      Data: ${JSON.stringify(financialData)}`;

      const summary = await callGemini(prompt);
      summaryOutput.innerHTML = summary.replace(/\n/g, '<br>');
      summaryLoader.classList.add('hidden');
      summaryOutput.classList.remove('hidden');
    });
  }

  const askAiBtn = document.getElementById('ask-ai-btn');
  const askAiLoader = document.getElementById('ask-ai-loader');
  const askAiOutput = document.getElementById('ask-ai-output');
  const aiQuestionInput = document.getElementById('ai-accountant-question');

  if (askAiBtn) {
    askAiBtn.addEventListener('click', async () => {
      const question = aiQuestionInput.value;
      if (!question.trim()) {
        askAiOutput.textContent = "Please enter a question.";
        askAiOutput.classList.remove('hidden');
        return;
      }

      askAiLoader.classList.remove('hidden');
      askAiOutput.classList.add('hidden');
      askAiOutput.textContent = '';

      const prompt = `You are an expert real estate accountant providing advice to a small LLC owner. Answer the following question clearly and concisely in markdown format.
      
      Question: "${question}"`;

      const answer = await callGemini(prompt);
      askAiOutput.innerHTML = answer.replace(/\n/g, '<br>');
      askAiLoader.classList.add('hidden');
      askAiOutput.classList.remove('hidden');
    });
  }

  const navLinks = document.querySelectorAll('header a');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        const headerOffset = 80;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }
    });
  });

  updateDashboardBalances();
});

document.addEventListener('click', (e) => {
  const modal = document.getElementById('account-modal');
  if (!modal) return;
  if (e.target && e.target.id === 'close-modal-btn') closeModal();
  if (e.target && e.target.id === 'account-modal') closeModal();
});
