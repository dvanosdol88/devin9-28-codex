#!/usr/bin/env python3

from db import SessionLocal, Account, Transaction, BalanceSnapshot

def check_storage():
    print("=== Storage Persistence Check ===")
    
    try:
        with SessionLocal() as session:
            accounts = session.query(Account).all()
            print(f"Accounts in database: {len(accounts)}")
            
            if accounts:
                for acc in accounts:
                    print(f"  - Account ID: {acc.id}")
                    print(f"    Name: {getattr(acc, 'name', 'N/A')}")
                    print(f"    Type: {getattr(acc, 'type', 'N/A')}")
            
            transactions = session.query(Transaction).all()
            print(f"Transactions in database: {len(transactions)}")
            
            if transactions:
                for txn in transactions[:5]:  # Show first 5
                    print(f"  - Transaction ID: {txn.id}")
                    print(f"    Account: {txn.account_id}")
                    print(f"    Amount: {getattr(txn, 'amount', 'N/A')}")
            
            balances = session.query(BalanceSnapshot).all()
            print(f"Balance snapshots in database: {len(balances)}")
            
            if balances:
                for bal in balances[:5]:  # Show first 5
                    print(f"  - Balance snapshot for account: {bal.account_id}")
                    print(f"    Timestamp: {bal.as_of}")
                    
        print("\n=== Database Connection: SUCCESS ===")
        return True
        
    except Exception as e:
        print(f"Database error: {e}")
        return False

if __name__ == "__main__":
    check_storage()
