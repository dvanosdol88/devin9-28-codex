#!/usr/bin/env python3

import json
from datetime import datetime
from db import SessionLocal, Account, Transaction, BalanceSnapshot, upsert_account, upsert_transactions, add_balance_snapshot

def test_storage_persistence():
    print("=== Testing Storage Persistence ===")
    
    test_account_id = "acc_test_storage_123"
    test_account_data = {
        "id": test_account_id,
        "name": "Test Checking Account",
        "type": "depository",
        "subtype": "checking",
        "institution": {"name": "Test Bank"}
    }
    
    test_balance_data = {
        "available": "1000.00",
        "ledger": "1000.00"
    }
    
    test_transactions_data = [
        {
            "id": "txn_test_1",
            "account_id": test_account_id,
            "amount": "-25.00",
            "date": "2025-09-24",
            "description": "Test Transaction 1",
            "type": "card_payment"
        },
        {
            "id": "txn_test_2", 
            "account_id": test_account_id,
            "amount": "100.00",
            "date": "2025-09-23",
            "description": "Test Transaction 2",
            "type": "deposit"
        }
    ]
    
    try:
        with SessionLocal() as session:
            print("1. Testing account storage...")
            upsert_account(session, test_account_data)
            session.commit()
            
            stored_account = session.query(Account).filter_by(id=test_account_id).first()
            if stored_account:
                print(f"   ✅ Account stored: {stored_account.id} - {stored_account.name}")
            else:
                print("   ❌ Account not found")
                return False
            
            print("2. Testing balance snapshot storage...")
            add_balance_snapshot(session, test_account_id, test_balance_data)
            session.commit()
            
            stored_balance = session.query(BalanceSnapshot).filter_by(account_id=test_account_id).first()
            if stored_balance:
                print(f"   ✅ Balance snapshot stored for account {test_account_id}")
                print(f"      Available: {stored_balance.raw.get('available', 'N/A')}")
            else:
                print("   ❌ Balance snapshot not found")
                return False
            
            print("3. Testing transaction storage...")
            upsert_transactions(session, test_account_id, test_transactions_data)
            session.commit()
            
            stored_transactions = session.query(Transaction).filter_by(account_id=test_account_id).all()
            if stored_transactions:
                print(f"   ✅ {len(stored_transactions)} transactions stored")
                for txn in stored_transactions:
                    print(f"      - {txn.id}: {txn.raw.get('amount', 'N/A')} - {txn.raw.get('description', 'N/A')}")
            else:
                print("   ❌ Transactions not found")
                return False
            
        print("\n=== Storage Persistence Test: SUCCESS ===")
        return True
        
    except Exception as e:
        print(f"Storage test error: {e}")
        return False

if __name__ == "__main__":
    success = test_storage_persistence()
    if success:
        print("\n🎉 Storage system is working correctly and data persists!")
    else:
        print("\n❌ Storage system has issues")
