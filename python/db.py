import os
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import (create_engine, Column, String, Integer, Numeric, Date,
                        DateTime, ForeignKey, JSON, UniqueConstraint, Index, func)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

DB_URL = os.getenv("DATABASE_URL", "sqlite:///devin_teller.db")
engine = create_engine(DB_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()

class Account(Base):
    __tablename__ = "accounts"
    id = Column(String, primary_key=True)           # Teller account id
    name = Column(String)
    institution_id = Column(String)
    type = Column(String)
    subtype = Column(String)
    last_four = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

class BalanceSnapshot(Base):
    __tablename__ = "balance_snapshots"
    id = Column(Integer, primary_key=True)
    account_id = Column(String, ForeignKey("accounts.id"), index=True)
    available = Column(Numeric(14, 2))
    ledger = Column(Numeric(14, 2))
    as_of = Column(DateTime, default=func.now(), index=True)
    raw = Column(JSON)
    account = relationship("Account")
    __table_args__ = (UniqueConstraint("account_id", "as_of", name="uq_bal_asof"),)

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(String, primary_key=True)           # Teller txn id
    account_id = Column(String, ForeignKey("accounts.id"), index=True)
    date = Column(Date, index=True)
    description = Column(String)
    amount = Column(Numeric(14, 2))
    raw = Column(JSON)
    account = relationship("Account")
    __table_args__ = (Index("ix_txn_acct_date", "account_id", "date"),)

def init_db():
    Base.metadata.create_all(engine)

def upsert_account(s, acct_json):
    obj = s.get(Account, acct_json["id"]) or Account(id=acct_json["id"])
    obj.name = acct_json.get("name")
    obj.institution_id = acct_json.get("institution", {}).get("id")
    obj.type = acct_json.get("type")
    obj.subtype = acct_json.get("subtype")
    obj.last_four = acct_json.get("last_four")
    s.add(obj)
    return obj

def add_balance_snapshot(s, account_id, balances_json):
    snap = BalanceSnapshot(
        account_id=account_id,
        available=Decimal(str(balances_json.get("available", 0))),
        ledger=Decimal(str(balances_json.get("ledger", 0))),
        raw=balances_json,
    )
    s.add(snap)

def upsert_transactions(s, account_id, txns_json):
    for t in txns_json:
        if s.get(Transaction, t["id"]):
            continue
        s.add(Transaction(
            id=t["id"],
            account_id=account_id,
            date=date.fromisoformat(t["date"]),
            description=t.get("description"),
            amount=Decimal(str(t.get("amount", 0))),
            raw=t,
        ))
