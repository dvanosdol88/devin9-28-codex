import os
from wsgiref import simple_server

import argparse
import base64
import falcon
import requests
import logging
import sys
from decimal import Decimal

log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=log_level,
    format="%(asctime)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


class TellerClient:

    _BASE_URL = 'https://api.teller.io'

    def __init__(self, cert, access_token=None):
        self.cert = cert
        self.access_token = access_token

    def for_user(self, access_token):
        return TellerClient(self.cert, access_token)

    def list_accounts(self):
        return self._get('/accounts')

    def get_account_details(self, account_id):
        return self._get(f'/accounts/{account_id}/details')

    def get_account_balances(self, account_id):
        return self._get(f'/accounts/{account_id}/balances')

    def list_account_transactions(self, account_id, count=None):
        params = {'count': count} if count else None
        return self._get(f'/accounts/{account_id}/transactions', params=params)

    def list_account_payees(self, account_id, scheme):
        return self._get(f'/accounts/{account_id}/payments/{scheme}/payees')

    def create_account_payee(self, account_id, scheme, data):
        return self._post(f'/accounts/{account_id}/payments/{scheme}/payees',
                          data)

    def create_account_payment(self, account_id, scheme, data):
        return self._post(f'/accounts/{account_id}/payments/{scheme}', data)

    def _get(self, path, params=None):
        return self._request('GET', path, params=params)

    def _post(self, path, data):
        return self._request('POST', path, data=data)

    def _request(self, method, path, data=None, params=None):
        url = self._BASE_URL + path
        auth = (self.access_token, '')
        kwargs = {'json': data, 'auth': auth, 'params': params}
        if self.cert and all(self.cert):
            kwargs['cert'] = self.cert
        return requests.request(method, url, **kwargs)


class HealthResource:
    def on_get(self, req, resp):
        resp.media = {"status": "ok"}


class AccountsResource:

    def __init__(self, client):
        self._client = client

    def on_get(self, req, resp):
        self._proxy(req, resp, lambda client: client.list_accounts())

    def on_get_details(self, req, resp, account_id):
        self._proxy(req, resp,
                    lambda client: client.get_account_details(account_id))

    def on_get_balances(self, req, resp, account_id):
        def store_balances(client):
            teller_response = client.get_account_balances(account_id)
            if teller_response.status_code == 200:
                try:
                    from db import (SessionLocal, add_balance_snapshot,
                                    upsert_account)
                    account_response = client.get_account_details(
                        account_id)
                    if account_response.status_code == 200:
                        acct = account_response.json() or {}
                        acct["id"] = account_id   # ensure required key
                        with SessionLocal() as s:
                            upsert_account(s, acct)
                            add_balance_snapshot(s, account_id,
                                                 teller_response.json())
                            s.commit()
                except Exception:
                    logger.error(f"Error storing balance snapshot for "
                                 f"account {account_id}", exc_info=True)
                    raise falcon.HTTPInternalServerError(
                        title="Database Storage Failed",
                        description="Failed to store balance snapshot in "
                                    "database."
                    )
            return teller_response
        self._proxy(req, resp, store_balances)

    def on_get_transactions(self, req, resp, account_id):
        def store_transactions(client):
            try:
                count = req.get_param_as_int('count') or None
            except Exception:
                count = None
            teller_response = client.list_account_transactions(
                account_id, count=count)
            if teller_response.status_code == 200:
                try:
                    from db import (SessionLocal, upsert_transactions,
                                    upsert_account)
                    account_response = client.get_account_details(
                        account_id)
                    if account_response.status_code == 200:
                        acct = account_response.json() or {}
                        acct["id"] = account_id
                        with SessionLocal() as s:
                            upsert_account(s, acct)
                            upsert_transactions(s, account_id,
                                                teller_response.json())
                            s.commit()
                except Exception:
                    logger.error(f"Error storing transactions for "
                                 f"account {account_id}", exc_info=True)
                    raise falcon.HTTPInternalServerError(
                        title="Database Storage Failed",
                        description="Failed to store transactions in "
                                    "database."
                    )
            return teller_response
        self._proxy(req, resp, store_transactions)

    def on_get_payees(self, req, resp, account_id, scheme):
        self._proxy(req, resp,
                    lambda client: client.list_account_payees(account_id,
                                                              scheme))

    def on_post_payees(self, req, resp, account_id, scheme):
        self._proxy(req, resp,
                    lambda client: client.create_account_payee(account_id,
                                                               scheme,
                                                               req.media))

    def on_post_payments(self, req, resp, account_id, scheme):
        self._proxy(req, resp,
                    lambda client: client.create_account_payment(account_id,
                                                                 scheme,
                                                                 req.media))

    def on_get_cached_transactions(self, req, resp, account_id):
        try:
            from db import SessionLocal, Transaction
            limit = int(req.get_param('limit', default=100))
            with SessionLocal() as s:
                rows = (s.query(Transaction)
                        .filter_by(account_id=account_id)
                        .order_by(Transaction.date.desc())
                        .limit(limit)
                        .all())
                resp.media = [r.raw for r in rows]
        except Exception:
            logger.error(f"Error retrieving cached transactions for "
                         f"account {account_id}", exc_info=True)
            resp.status = falcon.HTTP_500
            resp.media = {"error": "Failed to retrieve cached transactions."}

    def on_get_cached_balances(self, req, resp, account_id):
        try:
            from db import SessionLocal, BalanceSnapshot
            with SessionLocal() as s:
                latest = (s.query(BalanceSnapshot)
                           .filter_by(account_id=account_id)
                           .order_by(BalanceSnapshot.as_of.desc())
                           .first())
                if latest:
                    resp.media = {
                        'available': str(latest.available),
                        'ledger': str(latest.ledger)
                    }
                else:
                    resp.media = {}
        except Exception:
            logger.error(f"Error retrieving cached balances for "
                         f"account {account_id}", exc_info=True)
            resp.status = falcon.HTTP_500
            resp.media = {"error": "Failed to retrieve cached balances."}

    def _proxy(self, req, resp, fun):
        token = self._extract_token(req)
        user_client = self._client.for_user(token)
        teller_response = fun(user_client)

        if teller_response.content:
            resp.media = teller_response.json()

        resp.status = falcon.code_to_http_status(teller_response.status_code)

    def _extract_token(self, req):
        auth_header = req.get_header('Authorization') or ''
        if auth_header.startswith('Basic '):
            try:
                b64 = auth_header.split(' ', 1)[1].strip()
                decoded = base64.b64decode(b64).decode('utf-8')
                username, _, _ = decoded.partition(':')
                return username
            except Exception:
                return ''
        return auth_header


class LLCAccountsResource:

    def on_get(self, req, resp):
        try:
            from db import (SessionLocal, LLCAccount, LLCFinancingTerms, 
                           LLCFinancingBreakdown, LLCTransaction)
            with SessionLocal() as s:
                accounts = s.query(LLCAccount).all()
                result = []
                for acc in accounts:
                    acc_dict = {
                        'account_id': acc.account_id,
                        'slug': acc.slug,
                        'name': acc.name,
                        'subtitle': acc.subtitle,
                        'account_type': acc.account_type,
                        'current_balance': str(acc.current_balance),
                    }
                    
                    if acc.transactions:
                        acc_dict['transactions'] = [{
                            'transaction_id': tx.transaction_id,
                            'date': tx.txn_date.isoformat(),
                            'description': tx.description,
                            'debit': str(tx.debit),
                            'credit': str(tx.credit)
                        } for tx in acc.transactions]
                    
                    if acc.financing_terms:
                        ft = acc.financing_terms
                        acc_dict['financing_terms'] = {
                            'financing_id': ft.financing_id,
                            'principal': str(ft.principal),
                            'interest_rate': str(ft.interest_rate),
                            'term_years': ft.term_years,
                            'breakdown': {bd.label: str(bd.amount) for bd in ft.breakdowns}
                        }
                    result.append(acc_dict)
                resp.media = result
        except Exception:
            logger.error("Error retrieving LLC accounts", exc_info=True)
            resp.status = falcon.HTTP_500
            resp.media = {"error": "Failed to retrieve LLC accounts."}

    def on_post(self, req, resp):
        try:
            from db import (SessionLocal, LLCAccount, LLCFinancingTerms, 
                           LLCFinancingBreakdown, LLCTransaction)
            from datetime import datetime
            account_data = req.media
            with SessionLocal() as s:
                existing = s.query(LLCAccount).filter(LLCAccount.slug == account_data['slug']).first()
                if existing:
                    new_account = existing
                    new_account.name = account_data['name']
                    new_account.subtitle = account_data.get('subtitle', '')
                    new_account.account_type = account_data['account_type']
                    new_account.current_balance = Decimal(str(account_data.get('current_balance', 0.0)))
                else:
                    new_account = LLCAccount(
                        slug=account_data['slug'],
                        name=account_data['name'],
                        subtitle=account_data.get('subtitle', ''),
                        account_type=account_data['account_type'],
                        current_balance=Decimal(str(account_data.get('current_balance', 0.0)))
                    )
                    s.add(new_account)
                s.commit()
                s.refresh(new_account)
                
                if 'transactions' in account_data:
                    s.query(LLCTransaction).filter(LLCTransaction.account_id == new_account.account_id).delete()
                    
                    balance = Decimal('0.0')
                    for tx_data in account_data['transactions']:
                        new_tx = LLCTransaction(
                            account_id=new_account.account_id,
                            txn_date=datetime.fromisoformat(tx_data['date']) if isinstance(tx_data['date'], str) else tx_data['date'],
                            description=tx_data['description'],
                            debit=Decimal(str(tx_data.get('debit', 0))),
                            credit=Decimal(str(tx_data.get('credit', 0)))
                        )
                        s.add(new_tx)
                        
                        if new_account.account_type == 'asset':
                            balance += (new_tx.debit - new_tx.credit)
                        elif new_account.account_type == 'liability':
                            balance += (new_tx.credit - new_tx.debit)
                    
                    new_account.current_balance = balance
                
                if 'financing_terms' in account_data:
                    ft_data = account_data['financing_terms']
                    
                    if new_account.financing_terms:
                        financing = new_account.financing_terms
                        financing.principal = Decimal(str(ft_data['principal']))
                        financing.interest_rate = Decimal(str(ft_data['interest_rate']))
                        financing.term_years = ft_data['term_years']
                    else:
                        financing = LLCFinancingTerms(
                            account_id=new_account.account_id,
                            principal=Decimal(str(ft_data['principal'])),
                            interest_rate=Decimal(str(ft_data['interest_rate'])),
                            term_years=ft_data['term_years']
                        )
                        s.add(financing)
                    s.commit()
                    s.refresh(financing)
                    
                    if 'breakdown' in ft_data:
                        s.query(LLCFinancingBreakdown).filter(
                            LLCFinancingBreakdown.financing_id == financing.financing_id
                        ).delete()
                        
                        for label, amount in ft_data['breakdown'].items():
                            breakdown = LLCFinancingBreakdown(
                                financing_id=financing.financing_id,
                                label=label,
                                amount=Decimal(str(amount))
                            )
                            s.add(breakdown)
                
                s.commit()
                resp.media = {'account_id': new_account.account_id, 'slug': new_account.slug}
        except Exception:
            logger.error("Error creating LLC account", exc_info=True)
            resp.status = falcon.HTTP_500
            resp.media = {"error": "Failed to create LLC account."}

    def on_get_transactions(self, req, resp, account_id):
        try:
            from db import SessionLocal, LLCTransaction
            account_id = int(account_id)
            with SessionLocal() as s:
                transactions = (s.query(LLCTransaction)
                               .filter(LLCTransaction.account_id == account_id)
                               .order_by(LLCTransaction.txn_date.desc())
                               .all())
                
                result = [{
                    'transaction_id': tx.transaction_id,
                    'date': tx.txn_date.isoformat(),
                    'description': tx.description,
                    'debit': str(tx.debit),
                    'credit': str(tx.credit)
                } for tx in transactions]
                resp.media = result
        except Exception:
            logger.error(f"Error retrieving LLC transactions for account {account_id}", exc_info=True)
            resp.status = falcon.HTTP_500
            resp.media = {"error": "Failed to retrieve LLC transactions."}

    def on_put_transactions_bulk(self, req, resp, account_id):
        try:
            from db import SessionLocal, LLCAccount, LLCTransaction
            from datetime import datetime
            from decimal import Decimal
            
            account_id = int(account_id)
            transactions = req.media
            
            with SessionLocal() as s:
                account = s.query(LLCAccount).filter(LLCAccount.account_id == account_id).first()
                if not account:
                    resp.status = falcon.HTTP_404
                    resp.media = {'error': 'Account not found'}
                    return
                
                s.query(LLCTransaction).filter(LLCTransaction.account_id == account_id).delete()
                
                balance = Decimal('0.0')
                for tx_data in transactions:
                    new_tx = LLCTransaction(
                        account_id=account_id,
                        txn_date=datetime.fromisoformat(tx_data['date']) if isinstance(tx_data['date'], str) else tx_data['date'],
                        description=tx_data['description'],
                        debit=Decimal(str(tx_data.get('debit', 0))),
                        credit=Decimal(str(tx_data.get('credit', 0)))
                    )
                    s.add(new_tx)
                    
                    if account.account_type == 'asset':
                        balance += (new_tx.debit - new_tx.credit)
                    elif account.account_type == 'liability':
                        balance += (new_tx.credit - new_tx.debit)
                
                account.current_balance = balance
                s.commit()
                resp.media = {'success': True, 'balance': str(balance)}
        except Exception:
            logger.error(f"Error updating LLC transactions for account {account_id}", exc_info=True)
            resp.status = falcon.HTTP_500
            resp.media = {"error": "Failed to update LLC transactions."}


class LLCRentResource:

    def on_get_tenants(self, req, resp):
        try:
            from db import SessionLocal, LLCRentTenant
            with SessionLocal() as s:
                tenants = s.query(LLCRentTenant).all()
                result = [{
                    'tenant_id': t.tenant_id,
                    'base_id': t.base_id,
                    'floor': t.floor,
                    'renter_name': t.renter_name
                } for t in tenants]
                resp.media = result
        except Exception:
            logger.error("Error retrieving LLC rent tenants", exc_info=True)
            resp.status = falcon.HTTP_500
            resp.media = {"error": "Failed to retrieve LLC rent tenants."}

    def on_get_month(self, req, resp, month_str):
        try:
            from db import SessionLocal, LLCRentMonth, LLCRentRecord, LLCRentTotal
            from datetime import datetime
            
            month_date = datetime.strptime(month_str + '-02', '%Y-%m-%d')
            
            with SessionLocal() as s:
                rent_month = (s.query(LLCRentMonth)
                             .filter(LLCRentMonth.month_start == month_date)
                             .first())
                
                if not rent_month:
                    resp.media = {'month': month_str, 'records': [], 'total': '0.00'}
                    return
                
                records = [{
                    'rent_record_id': r.rent_record_id,
                    'tenant_id': r.tenant_id,
                    'monthly_rent': str(r.monthly_rent) if r.monthly_rent else None,
                    'amount_due': str(r.amount_due),
                    'amount_received': str(r.amount_received)
                } for r in rent_month.records]
                
                total = str(rent_month.total.total_monthly_rent) if rent_month.total else '0.00'
                
                resp.media = {'month': month_str, 'records': records, 'total': total}
        except Exception:
            logger.error(f"Error retrieving LLC rent month {month_str}", exc_info=True)
            resp.status = falcon.HTTP_500
            resp.media = {"error": "Failed to retrieve LLC rent month."}

    def on_put_month(self, req, resp, month_str):
        try:
            from db import (SessionLocal, LLCRentMonth, LLCRentRecord, 
                           LLCRentTotal)
            from datetime import datetime
            from decimal import Decimal
            
            month_date = datetime.strptime(month_str + '-02', '%Y-%m-%d')
            rent_data = req.media
            
            with SessionLocal() as s:
                rent_month = (s.query(LLCRentMonth)
                             .filter(LLCRentMonth.month_start == month_date)
                             .first())
                
                if not rent_month:
                    rent_month = LLCRentMonth(month_start=month_date)
                    s.add(rent_month)
                    s.commit()
                    s.refresh(rent_month)
                
                s.query(LLCRentRecord).filter(
                    LLCRentRecord.rent_month_id == rent_month.rent_month_id
                ).delete()
                
                total_rent = Decimal('0.0')
                for record_data in rent_data.get('records', []):
                    monthly_rent = record_data.get('monthly_rent')
                    if monthly_rent not in [None, 'TBD'] and monthly_rent != '':
                        monthly_rent_val = Decimal(str(monthly_rent))
                        total_rent += monthly_rent_val
                    else:
                        monthly_rent_val = None
                    
                    record = LLCRentRecord(
                        rent_month_id=rent_month.rent_month_id,
                        tenant_id=record_data['tenant_id'],
                        monthly_rent=monthly_rent_val,
                        amount_due=Decimal(str(record_data.get('amount_due', 0))),
                        amount_received=Decimal(str(record_data.get('amount_received', 0)))
                    )
                    s.add(record)
                
                if rent_month.total:
                    rent_month.total.total_monthly_rent = total_rent
                else:
                    total_obj = LLCRentTotal(
                        rent_month_id=rent_month.rent_month_id,
                        total_monthly_rent=total_rent
                    )
                    s.add(total_obj)
                
                s.commit()
                resp.media = {'success': True, 'total': str(total_rent)}
        except Exception:
            logger.error(f"Error updating LLC rent month {month_str}", exc_info=True)
            resp.status = falcon.HTTP_500
            resp.media = {"error": "Failed to update LLC rent month."}


def _parse_args():
    parser = argparse.ArgumentParser(description='Interact with Teller')

    parser.add_argument('--environment',
                        default='sandbox',
                        choices=['sandbox', 'development', 'production'],
                        help='API environment to target')
    parser.add_argument('--cert', type=str,
                        help='path to the TLS certificate')
    parser.add_argument('--cert-key', type=str,
                        help='path to the TLS certificate private key')

    args = parser.parse_args()

    needs_cert = args.environment in ['development', 'production']
    has_cert = args.cert and args.cert_key
    if needs_cert and not has_cert:
        parser.error('--cert and --cert-key are required when '
                     '--environment is not sandbox')

    return args


def main():
    args = _parse_args()
    cert = (args.cert, args.cert_key) if args.cert and args.cert_key else None
    client = TellerClient(cert)

    try:
        from db import init_db
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}", exc_info=True)
        return 1

    logger.info("Starting up ...")

    accounts = AccountsResource(client)
    health = HealthResource()
    llc_accounts = LLCAccountsResource()
    llc_rent = LLCRentResource()

    app = falcon.App(
        middleware=falcon.CORSMiddleware(allow_origins='*',
                                         allow_credentials='*')
    )

    app.add_route('/health', health)
    app.add_route('/api/accounts', accounts)
    app.add_route('/api/accounts/{account_id}/details', accounts,
                  suffix='details')
    app.add_route('/api/accounts/{account_id}/balances', accounts,
                  suffix='balances')
    app.add_route('/api/accounts/{account_id}/transactions', accounts,
                  suffix='transactions')
    app.add_route('/api/accounts/{account_id}/payments/{scheme}/payees',
                  accounts, suffix='payees')
    app.add_route('/api/accounts/{account_id}/payments/{scheme}', accounts,
                  suffix='payments')
    app.add_route('/api/db/accounts/{account_id}/transactions', accounts,
                  suffix='cached_transactions')
    app.add_route('/api/db/accounts/{account_id}/balances', accounts,
                  suffix='cached_balances')
    
    app.add_route('/api/llc/accounts', llc_accounts)
    app.add_route('/api/llc/accounts/{account_id}/transactions', llc_accounts,
                  suffix='transactions')
    app.add_route('/api/llc/accounts/{account_id}/transactions/bulk', llc_accounts,
                  suffix='transactions_bulk')
    app.add_route('/api/llc/rent/tenants', llc_rent, suffix='tenants')
    app.add_route('/api/llc/rent/{month_str}', llc_rent, suffix='month')

    port = os.getenv('PORT') or '8001'

    httpd = simple_server.make_server('', int(port), app)

    logger.info(f"Listening on port {port}, press ^C to stop.\n")

    httpd.serve_forever()


if __name__ == '__main__':
    main()
