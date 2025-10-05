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

    def get_account(self, account_id):
        return self._get(f'/accounts/{account_id}')

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
            logger.info(f"[DEBUG] Fetching balance from Teller API for account {account_id}")
            teller_response = client.get_account_balances(account_id)
            logger.info(f"[DEBUG] Teller API response status: {teller_response.status_code}")
            if teller_response.status_code == 200:
                balance_data = teller_response.json()
                logger.info(f"[DEBUG] Teller balance data: {balance_data}")
                try:
                    from db import (SessionLocal, add_balance_snapshot,
                                    upsert_account)
                    account_response = client.get_account(account_id)
                    if account_response.status_code == 200:
                        acct = account_response.json() or {}
                        logger.info(f"[DEBUG] Account data from Teller: {acct}")
                        logger.info(f"[DEBUG] Upserting account {account_id} to database")
                        with SessionLocal() as s:
                            upsert_account(s, acct)
                            logger.info(f"[DEBUG] Adding balance snapshot: {balance_data}")
                            add_balance_snapshot(s, account_id, balance_data)
                            s.commit()
                            logger.info(f"[DEBUG] Successfully committed balance for {account_id}")
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
                    account_response = client.get_account(account_id)
                    if account_response.status_code == 200:
                        acct = account_response.json() or {}
                        logger.info(f"[DEBUG] Account data from Teller: {acct}")
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
        logger.info(f"[DEBUG] Retrieving cached balance for account {account_id}")
        try:
            from db import SessionLocal, BalanceSnapshot
            with SessionLocal() as s:
                latest = (s.query(BalanceSnapshot)
                           .filter_by(account_id=account_id)
                           .order_by(BalanceSnapshot.as_of.desc())
                           .first())
                if latest:
                    balance_data = {
                        'available': str(latest.available),
                        'ledger': str(latest.ledger)
                    }
                    logger.info(f"[DEBUG] Found cached balance for {account_id}: {balance_data}")
                    resp.media = balance_data
                else:
                    logger.warning(f"[DEBUG] No cached balance found for {account_id}")
                    resp.media = {}
        except Exception:
            logger.error(f"Error retrieving cached balances for "
                         f"account {account_id}", exc_info=True)
            resp.status = falcon.HTTP_500
            resp.media = {"error": "Failed to retrieve cached balances."}

    def _proxy(self, req, resp, fun):
        token = self._extract_token(req)
        logger.info(f"[DEBUG] Extracted token (first 10 chars): {token[:10] if token else 'EMPTY'}...")
        logger.info(f"[DEBUG] Token length: {len(token) if token else 0}")
        user_client = self._client.for_user(token)
        teller_response = fun(user_client)

        logger.info(f"[DEBUG] Teller API response status: {teller_response.status_code}")
        if teller_response.status_code != 200:
            logger.error(f"[DEBUG] Teller API error response: {teller_response.text[:500] if teller_response.text else 'No body'}")

        if teller_response.content:
            resp.media = teller_response.json()

        resp.status = falcon.code_to_http_status(teller_response.status_code)

    def _extract_token(self, req):
        auth_header = req.get_header('Authorization') or ''
        logger.info(f"[DEBUG] Raw Authorization header: {auth_header[:50] if auth_header else 'EMPTY'}...")
        if auth_header.startswith('Basic '):
            try:
                b64 = auth_header.split(' ', 1)[1].strip()
                decoded = base64.b64decode(b64).decode('utf-8')
                username, _, _ = decoded.partition(':')
                logger.info(f"[DEBUG] Extracted from Basic auth, username: {username[:10]}...")
                return username
            except Exception as e:
                logger.error(f"[DEBUG] Failed to decode Basic auth: {e}")
                return ''
        logger.info(f"[DEBUG] Using raw header as token")
        return auth_header


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

    port = os.getenv('PORT') or '8001'

    httpd = simple_server.make_server('', int(port), app)

    logger.info(f"Listening on port {port}, press ^C to stop.\n")

    httpd.serve_forever()


if __name__ == '__main__':
    main()
