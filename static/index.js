const APPLICATION_ID = 'app_pj4c5t83p8q0ibrr8k000'
const ENVIRONMENT = 'development';

const BASE_URL = '/api';

class TellerStore {
  constructor() {
    this.keys = {
      enrollment: 'teller:enrollment',
      user: 'teller:user',
    }
  }

  getUser() {
    return this.get(this.keys.user);
  }

  getEnrollment() {
    return this.get(this.keys.enrollment);
  }

  putUser(user) {
    return this.put(this.keys.user, user);
  }

  putEnrollment(enrollment) {
    return this.put(this.keys.enrollment, enrollment);
  }

  clear() {
    localStorage.clear();
  }

  get(key) {
    const raw = localStorage.getItem(key);
    return JSON.parse(raw);
  }

  put(key, value) {
    const raw = JSON.stringify(value);
    return localStorage.setItem(key, raw);
  }
}

class Client {
  constructor() {
    this.baseURL = BASE_URL;
    this.accessToken = null;
  }

  listAccounts() {
    return this.get('/accounts');
  }

  getAccountDetails(account) {
    return this.get(`/accounts/${account.id}/details`);
  }

  getAccountBalances(account) {
    return this.get(`/accounts/${account.id}/balances`);
  }

  listAccountTransactions(account) {
    return this.get(`/accounts/${account.id}/transactions`);
  }

  listAccountPayees(account) {
    return this.get(`/accounts/${account.id}/payments/zelle/payees`);
  }

  createAccountPayee(account, payee) {
    return this.post(`/accounts/${account.id}/payments/zelle/payees`, payee);
  }

  createAccountPayment(account, payment) {
    return this.post(`/accounts/${account.id}/payments/zelle`, payment);
  }

  get(path) {
    return this.request('GET', path, null);
  }

  post(path, data) {
    return this.request('POST', path, JSON.stringify(data));
  }

  request(method, path, data) {
    const headers = new Headers({
      'Content-Type': 'application/json',
    });
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }
    const request = new Request(this.baseURL + path, {
      method: method,
      headers,
      body: data,
    });
    return fetch(request);
  }
}
class FlipCards {
  constructor(client, container) {
    this.client = client;
    this.container = container;
  }

  async renderAccount(account) {
    const card = document.createElement('div');
    card.className = 'flip-card w-full max-w-md mx-auto my-4';
    card.innerHTML = `
      <div class="flip-card-inner">
        <div class="flip-card-front bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-xl rounded-xl p-5">
          <div class="flex justify-between items-center">
            <div>
              <div class="text-sm opacity-80">${account.institution?.name || ''}</div>
              <div class="text-xl font-bold">${account.name || account.subtype || account.type}</div>
            </div>
            <button class="refresh-live bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-md">Refresh Live</button>
          </div>
          <div class="mt-4">
            <div class="text-sm opacity-80">Available</div>
            <div class="text-2xl font-semibold" data-role="available">$—</div>
          </div>
          <div class="mt-2">
            <div class="text-sm opacity-80">Ledger</div>
            <div class="text-lg" data-role="ledger">$—</div>
          </div>
          <div class="mt-4 text-sm opacity-80">Click to view recent transactions</div>
        </div>
        <div class="flip-card-back bg-white text-slate-800 shadow-xl rounded-xl p-5">
          <div class="flex justify-between items-center">
            <div class="text-xl font-bold">Recent Transactions</div>
            <div class="text-sm text-slate-500">Last 10</div>
          </div>
          <div class="mt-3 space-y-2" data-role="txns"></div>
          <div class="mt-4 text-sm text-slate-500">Click to flip back</div>
        </div>
      </div>
    `;

    const setCurrency = (el, v) => {
      if (!el) return;
      if (v === undefined || v === null || v === '') { el.textContent = '$—'; return; }
      const n = Number(v);
      el.textContent = n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    };

    const frontAvailable = card.querySelector('[data-role="available"]');
    const frontLedger = card.querySelector('[data-role="ledger"]');
    const txnsEl = card.querySelector('[data-role="txns"]');

    await this.loadCachedBalances(account, (b) => {
      setCurrency(frontAvailable, b.available);
      setCurrency(frontLedger, b.ledger);
    });

    await this.loadCachedTransactions(account, 10, (txns) => {
      txnsEl.innerHTML = '';
      txns.forEach(t => {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center border-b border-slate-100 pb-1';
        const amt = Number(t.amount);
        row.innerHTML = `
          <div class="text-sm truncate max-w-[70%]">${t.description || t.details || ''}</div>
          <div class="text-sm font-medium ${amt < 0 ? 'text-rose-600' : 'text-emerald-600'}">
            ${amt.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
          </div>
        `;
        txnsEl.appendChild(row);
      });
    });

    const inner = card.querySelector('.flip-card-inner');
    card.addEventListener('click', (e) => {
      if ((e.target).classList.contains('refresh-live')) return;
      inner.classList.toggle('is-flipped');
    });

    const refreshBtn = card.querySelector('.refresh-live');
    refreshBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await Promise.all([
          this.client.get(`/accounts/${account.id}/balances`),
          this.client.get(`/accounts/${account.id}/transactions?count=10`),
        ]);
      } catch (_) {}
      await this.loadCachedBalances(account, (b) => {
        setCurrency(frontAvailable, b.available);
        setCurrency(frontLedger, b.ledger);
      });
      await this.loadCachedTransactions(account, 10, (txns) => {
        txnsEl.innerHTML = '';
        txns.forEach(t => {
          const row = document.createElement('div');
          row.className = 'flex justify-between items-center border-b border-slate-100 pb-1';
          const amt = Number(t.amount);
          row.innerHTML = `
            <div class="text-sm truncate max-w-[70%]">${t.description || t.details || ''}</div>
            <div class="text-sm font-medium ${amt < 0 ? 'text-rose-600' : 'text-emerald-600'}">
              ${amt.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
            </div>
          `;
          txnsEl.appendChild(row);
        });
      });
    });

    this.container.appendChild(card);
  }

  async loadCachedBalances(account, cb) {
    try {
      const r = await fetch(`${BASE_URL}/db/accounts/${account.id}/balances`);
      if (!r.ok) return;
      const b = await r.json();
      cb(b || {});
    } catch (_) {}
  }

  async loadCachedTransactions(account, limit, cb) {
    try {
      const r = await fetch(`${BASE_URL}/db/accounts/${account.id}/transactions?limit=${limit}`);
      if (!r.ok) return;
      const txns = await r.json();
      cb(txns || []);
    } catch (_) {}
  }
}


class EnrollmentHandler {
  constructor(client, containers, templates) {
    this.client = client;
    this.containers = containers;
    this.templates = templates;
  }

  onEnrollment(enrollment) {
    this.client.accessToken = enrollment.accessToken;

    const container = this.containers.accounts;
    const template = this.templates.account;
    const spinner = new Spinner(container);
    const callbacks = this;

    spinner.show();

    console.log("onEnrollment called");
    this.client.listAccounts()
      .then(function(response) {
        return response.json();
      })
      .then((accounts) => {
        let cardsContainer = document.getElementById('cards-container');
        if (!cardsContainer) {
          cardsContainer = document.createElement('div');
          cardsContainer.id = 'cards-container';
          cardsContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-6 my-6';
          this.containers.root.prepend(cardsContainer);
        }
        const cards = new FlipCards(this.client, cardsContainer);
        cardsContainer.innerHTML = '';
        accounts.forEach((account) => {
          cards.renderAccount(account);
        });
        spinner.hide();
      })
      .catch(function(error) {
        spinner.hide();
      });
  }

  onDetails(account) {
    const container = this.containers.logs;
    const template = this.templates.detail;
    const spinner = new Spinner(container);
    const header = this.templates.log.render({
      method: 'GET',
      name: 'Details',
      path: `/accounts/${account.id}/details`,
    });

    spinner.show();

    this.client.getAccountDetails(account)
      .then(function(response) {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(function(details) {
        console.log('Details received:', details);
        container.prepend(template.render(details));
        container.prepend(header);

        spinner.hide();
      })
      .catch(function(error) {
        console.error('Error fetching details:', error);
        spinner.hide();
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4';
        errorDiv.textContent = `Failed to load details: ${error.message}`;
        container.prepend(errorDiv);
        container.prepend(header);
      });
  }

  onBalances(account) {
    const container = this.containers.logs;
    const template = this.templates.balance;
    const spinner = new Spinner(container);
    const header = this.templates.log.render({
      method: 'GET',
      name: 'Balances',
      path: `/accounts/${account.id}/balances`,
    });

    spinner.show();

    this.client.getAccountBalances(account)
      .then(function(response) {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(function(balances) {
        console.log('Balances received:', balances);
        container.prepend(template.render(balances));
        container.prepend(header);

        spinner.hide();
      })
      .catch(function(error) {
        console.error('Error fetching balances:', error);
        spinner.hide();
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4';
        errorDiv.textContent = `Failed to load balances: ${error.message}`;
        container.prepend(errorDiv);
        container.prepend(header);
      });
  }

  onTransactions(account) {
    const container = this.containers.logs;
    const template = this.templates.transaction;
    const spinner = new Spinner(container);
    const header = this.templates.log.render({
      method: 'GET',
      name: 'Transactions',
      path: `/accounts/${account.id}/transactions?count=30`,
    });

    spinner.show();

    this.client.listAccountTransactions(account)
      .then(function(response) {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(function(transactions) {
        console.log('Transactions received:', transactions);
        transactions.reverse().forEach(function(transaction) {
          container.prepend(template.render(transaction));
        });

        container.prepend(header);
        spinner.hide();
      })
      .catch(function(error) {
        console.error('Error fetching transactions:', error);
        spinner.hide();
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4';
        errorDiv.textContent = `Failed to load transactions: ${error.message}`;
        container.prepend(errorDiv);
        container.prepend(header);
      });
  }

  onPayees(account) {
    const container = this.containers.logs;
    const template = this.templates.payee;
    const spinner = new Spinner(container);
    const header = this.templates.log.render({
      method: 'GET',
      name: 'Payees',
      path: `/accounts/${account.id}/payments/zelle/payees`,
    });

    spinner.show();

    const onCreatePayment = this.onCreatePayment.bind(this);
    this.client.listAccountPayees(account)
      .then(function(response) {
        return response.json();
      })
      .then(function(payees) {
        payees.forEach(function(payee) {
          const callback = function() {
            onCreatePayment(account, payee);
          };
          container.prepend(template.render(payee, callback));
        });

        container.prepend(header);
        spinner.hide();
      });
  }

  onCreatePayee(account) {
    const container = this.containers.logs;
    const spinner = new Spinner(container);
    const rootContainer = this.containers.root;
    const modalTemplate = this.templates.payeeModal;

    const person = generatePerson();
    const modal = modalTemplate.render(person.name, person.email);
    rootContainer.append(modal);

    const enrollmentHandler = this;

    document.getElementById('submit-payee').addEventListener('click', function() {
      const name = document.getElementById('payee-name').value;
      const email = document.getElementById('payee-email').value;

      document.getElementById('payee-modal').remove();
      spinner.show();

      const payee = {
        name: name,
        type: 'person',
        address: {
          type: 'email',
          value: email,
        },
      };

      enrollmentHandler.client.createAccountPayee(account, payee)
        .then(function(response) {
          return response.json();
        })
        .then(function(payeeResponse) {
          spinner.hide();
          enrollmentHandler.onPayeeResponse(account, payee, payeeResponse);
        });
    });

    document.getElementById('payee-modal').addEventListener('click', function() {
      document.getElementById('payee-modal').remove();
    });

    document.getElementById('payee-modal-content').addEventListener('click', function(e) {
      // prevent event from propagating to the dismiss function
      e.stopPropagation();
    });
  }

  onCreatePayment(account, payee) {
    const container = this.containers.logs;
    const rootContainer = this.containers.root;
    const spinner = new Spinner(container);
    const template = this.templates.paymentModal;

    const prefilledMemo = 'Teller test';
    const prefilledAmount = `${Math.ceil(Math.random() * 100)}.00`;

    const modal = template.render(prefilledMemo, prefilledAmount);
    rootContainer.append(modal);

    const enrollmentHandler = this;

    document.getElementById('submit-payment').addEventListener('click', function() {
      const memo = document.getElementById('payment-memo').value;
      const amount = document.getElementById('payment-amount').value;

      document.getElementById('payment-modal').remove();
      spinner.show();

      const payment = {
        payee_id: payee.id,
        amount: amount,
        memo: memo,
      };

      enrollmentHandler.client.createAccountPayment(account, payment)
        .then(function(response) {
          return response.json();
        })
        .then(function(paymentResponse) {
          spinner.hide();
          enrollmentHandler.onPaymentResponse(account, payee, payment, paymentResponse);
        });
    });

    document.getElementById('payment-modal').addEventListener('click', function() {
      document.getElementById('payment-modal').remove();
    });

    document.getElementById('payment-modal-content').addEventListener('click', function(e) {
      // prevent event from propagating to the dismiss function
      e.stopPropagation();
    });
  }

  onPayeeResponse(account, payee, payeeResponse) {

    const enrollmentHandler = this;
    const container = this.containers.logs;
    const template = this.templates.payee;
    const spinner = new Spinner(container);

    const header = this.templates.log.render({
      method: 'POST',
      name: 'Payees',
      path: `/accounts/${account.id}/payments/zelle/payees`,
    });

    const callback = function() {
      enrollmentHandler.onCreatePayment(account, payeeResponse);
    };

    if (payeeResponse.connect_token) {
      spinner.show();

      const tellerConnect = TellerConnect.setup({
        applicationId: APPLICATION_ID,
        environment: ENVIRONMENT,
        connectToken: payeeResponse.connect_token,
        onSuccess: function(payeeData) {
          container.prepend(template.render(payee, callback));
          container.prepend(header);
          spinner.hide();
        },
        onFailure: function(details) {
          spinner.hide();
        },
      });

      tellerConnect.open();

    } else {
      container.prepend(template.render(payee, callback));
      container.prepend(header);
    }
  }

  onPaymentResponse(account, payee, payment, paymentResponse) {
    const container = this.containers.logs;
    const spinner = new Spinner(container);
    const template = this.templates.payment;
    const header = this.templates.log.render({
      method: 'POST',
      name: 'Payments',
      path: `/accounts/${account.id}/payments/zelle`,
    });

    if (paymentResponse.connect_token) {
      spinner.show();

      const tellerConnect = TellerConnect.setup({
        applicationId: APPLICATION_ID,
        environment: ENVIRONMENT,
        connectToken: paymentResponse.connect_token,
        onSuccess: function(payment_data) {
          container.prepend(template.render(payment, payee));
          container.prepend(header);
          spinner.hide();
        },
        onFailure: function(details) {
          spinner.hide();
        },
      });

      tellerConnect.open();
    } else {
      container.prepend(template.render(payment, payee));
      container.prepend(header);
    }
  }

  clear() {
    const parents = Object.values(this.containers);
    parents.forEach(function(parent) {
      while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
      }
    });
  }
}

class UserHandler {
  constructor(labels) {
    this.labels = labels;
  }

  onEnrollment(enrollment) {
    this.labels.userId.textContent = enrollment.user.id;
    this.labels.accessToken.textContent = enrollment.accessToken;
  }

  clear() {
    const nodes = Object.values(this.labels);
    nodes.forEach(function(node) {
      node.textContent = 'not_available';
    });
  }
}

class LogTemplate {
  constructor(template) {
    this.template = template;
  }

  render(resource) {
    const node = this.template.content.cloneNode(true);

    const name = node.querySelector('.log .resource');
    const timestamp = node.querySelector('.log .timestamp');
    const http = node.querySelector('.log .http');

    name.textContent = resource.name;
    timestamp.textContent = new Date().toLocaleString();
    http.textContent = `${resource.method} ${resource.path}`;

    return node;
  }
}

class AccountTemplate {
  constructor(template) {
    this.template = template;
  }

  render(account, callbacks) {
    const node = this.template.content.cloneNode(true);

    const title = node.querySelector('.account .title');
    const institution = node.querySelector('.account .institution');
    const type = node.querySelector('.account .type');
    const subtype = node.querySelector('.account .subtype');
    const details = node.querySelector('.account .details');
    const balances = node.querySelector('.account .balances');
    const transactions = node.querySelector('.account .transactions');
    const payees = node.querySelector('.account .payees');
    const createPayee = node.querySelector('.account .create-payee');

    title.textContent = [account.name, account.last_four].join(', ');
    institution.textContent = account.institution.id;
    type.textContent = account.type;
    subtype.textContent = account.subtype;

    if (account.type == "depository") {
      details.addEventListener('click', function() {
        callbacks.onDetails(account);
      });
    } else {
      details.setAttribute('disabled', true);
    }

    balances.addEventListener('click', function() {
      callbacks.onBalances(account);
    });

    transactions.addEventListener('click', function() {
      callbacks.onTransactions(account);
    });

    if (account.subtype == 'checking') {
      payees.addEventListener('click', function() {
        callbacks.onPayees(account);
      });

      createPayee.addEventListener('click', function() {
        callbacks.onCreatePayee(account);
      });
    } else {
      payees.setAttribute('disabled', true);
      createPayee.setAttribute('disabled', true);
    }

    return node;
  }
}

class DetailTemplate {
  constructor(template) {
    this.template = template;
  }

  render(details) {
    const node = this.template.content.cloneNode(true);

    const number = node.querySelector('.detail .number');
    const ach = node.querySelector('.detail .ach');

    number.textContent = `${details.account_number}`;
    ach.textContent = `${details.routing_numbers.ach}`;

    return node;
  }
}

class BalanceTemplate {
  constructor(template) {
    this.template = template;
  }

  render(balances) {
    const node = this.template.content.cloneNode(true);

    const available = node.querySelector('.balance .available');
    const ledger = node.querySelector('.balance .ledger');

    available.textContent = `${balances.available}$`;
    ledger.textContent = `${balances.ledger}$`;

    return node;
  }
}

class TransactionTemplate {
  constructor(template) {
    this.template = template;
  }

  render(transaction) {
    const node = this.template.content.cloneNode(true);

    const description = node.querySelector('.transaction .description');
    const date = node.querySelector('.transaction .date');
    const amount = node.querySelector('.transaction .amount');

    description.textContent = transaction.description;
    date.textContent = transaction.date;
    amount.textContent = `${transaction.amount}$`;

    return node;
  }
}

class PayeeModalTemplate {
  constructor(template) {
    this.template = template;
  }

  render(prefilledName, prefilledEmail) {
    const node = this.template.content.cloneNode(true);

    const name = node.querySelector('#payee-name');
    const email = node.querySelector('#payee-email');

    name.value = prefilledName;
    email.value = prefilledEmail;

    return node;
  }
}

class PayeeTemplate {
  constructor(template) {
    this.template = template;
  }

  render(payee, callback) {
    const node = this.template.content.cloneNode(true);

    const name = node.querySelector('.payee .name');
    const address = node.querySelector('.payee .address');
    const createPayment = node.querySelector('.payee .create-payment');

    name.textContent = payee.name;
    address.textContent = payee.address.value;
    createPayment.addEventListener('click', callback);

    return node;
  }
}

class PaymentModalTemplate {
  constructor(template) {
    this.template = template;
  }

  render(prefilledMemo, prefilledAmount) {
    const node = this.template.content.cloneNode(true);

    const memo = node.querySelector('#payment-memo');
    const amount = node.querySelector('#payment-amount');

    memo.value = prefilledMemo;
    amount.value = prefilledAmount;

    return node;
  }
}

class PaymentTemplate {
  constructor(template) {
    this.template = template;
  }

  render(payment, payee) {
    const node = this.template.content.cloneNode(true);

    const name = node.querySelector('.payment .name');
    const amount = node.querySelector('.payment .amount');

    name.textContent = payee.name;
    amount.textContent = `${payment.amount}$`;

    return node;
  }
}

class StatusHandler {
  constructor(button) {
    this.connected = false;
    this.button = button;
  }

  onEnrollment(enrollment) {
    this.setConnected(true);
    this.button.textContent = 'Disconnect';
  }

  toggle(callbacks) {
    if (this.connected) {
      this.setConnected(false);
      this.button.textContent = 'Connect';

      callbacks.onDisconnect();
    } else {
      callbacks.onConnect();
    }
  }

  setConnected(connected) {
    this.connected = connected;
  }
}

class Spinner {
  constructor(parent) {
    this.parent = parent;
    this.node = document.createElement('div');
    this.node.classList.add('spinner');
  }

  show() {
    this.parent.prepend(this.node);
  }

  hide() {
    this.parent.removeChild(this.node);
  }
}

function generatePerson() {
  const pickRandom = function(choices) {
    return choices[Math.floor(Math.random() * choices.length)];
  }

  const firstName = pickRandom([
    'William', 'James', 'Evelyn', 'Harper', 'Mason',
    'Ella', 'Jackson', 'Avery', 'Scarlett', 'Jack',
  ]);

  const middleLetter = pickRandom('ABCDEFGHIJKLMNOPQRSTUVWXYZ');

  const lastName = pickRandom([
    'Adams', 'Wilson', 'Burton', 'Harris', 'Stevens',
    'Robinson', 'Lewis', 'Walker', 'Payne', 'Baker',
  ]);

  const username = (Math.random() + 1).toString(36).substring(2);

  return {
    name: `${firstName} ${middleLetter}. ${lastName}`,
    email: `${username}@teller.io`,
  }
}

document.addEventListener('DOMContentLoaded', function(event) {
  const containers = {
    accounts: document.getElementById('accounts'),
    logs: document.getElementById('logs'),
    root: document.getElementsByTagName('body')[0]
  };

  const templates = {
    log: new LogTemplate(document.getElementById('log-template')),
    account: new AccountTemplate(document.getElementById('account-template')),
    detail: new DetailTemplate(document.getElementById('detail-template')),
    balance: new BalanceTemplate(document.getElementById('balance-template')),
    transaction: new TransactionTemplate(document.getElementById('transaction-template')),
    payee: new PayeeTemplate(document.getElementById('payee-template')),
    payment: new PaymentTemplate(document.getElementById('payment-template')),
    payeeModal: new PayeeModalTemplate(document.getElementById('payee-modal-template')),
    paymentModal: new PaymentModalTemplate(document.getElementById('payment-modal-template'))
  };

  const labels = {
    userId: document.getElementById('user-id'),
    accessToken: document.getElementById('access-token'),
  };

  const store = new TellerStore();
  const client = new Client();
  const enrollmentHandler = new EnrollmentHandler(client, containers, templates);
  const userHandler = new UserHandler(labels);

  const connectButton = document.getElementById('teller-connect');
  const statusHandler = new StatusHandler(connectButton);

  const tellerConnect = TellerConnect.setup({
    applicationId: APPLICATION_ID,
    environment: ENVIRONMENT,
    selectAccount: 'multiple',
    onSuccess: function(enrollment) {
      store.putUser(enrollment.user);
      store.putEnrollment(enrollment);

      enrollmentHandler.onEnrollment(enrollment);
      userHandler.onEnrollment(enrollment);
      statusHandler.onEnrollment(enrollment);
    },
  });

  connectButton.addEventListener('click', function() {
    statusHandler.toggle({
      onConnect: function() {
        tellerConnect.open();
      },
      onDisconnect: function() {
        enrollmentHandler.clear();
        userHandler.clear();
        store.clear();
        location.reload();
      },
    });
  });

  const enrollment = store.getEnrollment();
  if (enrollment && enrollment.accessToken) {
    // If an enrollment with an access token exists in storage,
    // automatically fetch accounts and update the UI.
    client.accessToken = enrollment.accessToken;
    enrollmentHandler.onEnrollment(enrollment); // This will now fetch accounts
    userHandler.onEnrollment(enrollment); // This will display user/token
    statusHandler.onEnrollment(enrollment); // This will set button to "Disconnect"
  }
})
