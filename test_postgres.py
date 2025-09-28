#!/usr/bin/env python3
"""Test script to verify PostgreSQL migration works correctly."""

import os
import sys
sys.path.append('python')

from python.db import engine, init_db, SessionLocal, Account, BalanceSnapshot, Transaction
from decimal import Decimal
from datetime import datetime, date

def test_postgres_connection():
    """Test basic PostgreSQL connection and table creation."""
    print("Testing PostgreSQL connection...")
    
    os.environ['DATABASE_URL'] = 'postgresql://teller_user:teller_password@localhost/teller_storage'
    
    try:
        print(f"Database URL: {os.getenv('DATABASE_URL')}")
        print(f"Engine URL: {engine.url}")
        
        print("Creating tables...")
        init_db()
        print("✅ Tables created successfully")
        
        print("Testing CRUD operations...")
        with SessionLocal() as session:
            test_account = Account(
                id="test_account_123",
                name="Test Checking",
                institution_id="test_bank",
                type="depository",
                subtype="checking",
                last_four="1234"
            )
            session.add(test_account)
            session.commit()
            print("✅ Account created successfully")
            
            test_balance = BalanceSnapshot(
                account_id="test_account_123",
                available=Decimal("1000.50"),
                ledger=Decimal("1000.50"),
                raw={"available": "1000.50", "ledger": "1000.50"}
            )
            session.add(test_balance)
            session.commit()
            print("✅ BalanceSnapshot created successfully")
            
            test_transaction = Transaction(
                id="test_txn_456",
                account_id="test_account_123",
                date=date.today(),
                description="Test transaction",
                amount=Decimal("-25.00"),
                raw={"id": "test_txn_456", "amount": "-25.00", "description": "Test transaction"}
            )
            session.add(test_transaction)
            session.commit()
            print("✅ Transaction created successfully")
            
            accounts = session.query(Account).all()
            balances = session.query(BalanceSnapshot).all()
            transactions = session.query(Transaction).all()
            
            print(f"✅ Retrieved {len(accounts)} accounts, {len(balances)} balances, {len(transactions)} transactions")
            
            session.delete(test_transaction)
            session.delete(test_balance)
            session.delete(test_account)
            session.commit()
            print("✅ Test data cleaned up")
            
        print("🎉 PostgreSQL migration test completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ PostgreSQL test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_postgres_connection()
    sys.exit(0 if success else 1)
