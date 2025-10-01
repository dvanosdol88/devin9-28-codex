import os
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import (create_engine, Column, String, Integer, Numeric, Date,
                        DateTime, ForeignKey, JSON, UniqueConstraint, Index, func)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

db_url = os.getenv("DATABASE_URL", "sqlite:///devin_teller.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

DB_URL = db_url
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


class LLCMember(Base):
    __tablename__ = 'llc_members'
    member_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)


class LLCAccount(Base):
    __tablename__ = 'llc_accounts'
    account_id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String, nullable=False, unique=True)
    name = Column(String, nullable=False)
    subtitle = Column(String)
    account_type = Column(String, nullable=False)
    current_balance = Column(Numeric(14, 2), default=0.0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    transactions = relationship('LLCTransaction', back_populates='account', cascade='all, delete-orphan')
    financing_terms = relationship('LLCFinancingTerms', back_populates='account', uselist=False, cascade='all, delete-orphan')


class LLCTransaction(Base):
    __tablename__ = 'llc_account_transactions'
    transaction_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey('llc_accounts.account_id', ondelete='CASCADE'), nullable=False)
    txn_date = Column(DateTime, nullable=False)
    description = Column(String, nullable=False)
    debit = Column(Numeric(14, 2), nullable=False, default=0.0)
    credit = Column(Numeric(14, 2), nullable=False, default=0.0)
    created_at = Column(DateTime, server_default=func.now())
    account = relationship('LLCAccount', back_populates='transactions')


class LLCFinancingTerms(Base):
    __tablename__ = 'llc_financing_terms'
    financing_id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey('llc_accounts.account_id', ondelete='CASCADE'), nullable=False, unique=True)
    principal = Column(Numeric(14, 2), nullable=False)
    interest_rate = Column(Numeric(5, 2), nullable=False)
    term_years = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    account = relationship('LLCAccount', back_populates='financing_terms')
    breakdowns = relationship('LLCFinancingBreakdown', back_populates='financing', cascade='all, delete-orphan')
    member_loans = relationship('LLCMemberLoan', back_populates='financing', cascade='all, delete-orphan')


class LLCFinancingBreakdown(Base):
    __tablename__ = 'llc_financing_breakdown'
    financing_breakdown_id = Column(Integer, primary_key=True, autoincrement=True)
    financing_id = Column(Integer, ForeignKey('llc_financing_terms.financing_id', ondelete='CASCADE'), nullable=False)
    label = Column(String, nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    financing = relationship('LLCFinancingTerms', back_populates='breakdowns')


class LLCMemberLoan(Base):
    __tablename__ = 'llc_member_loans'
    member_loan_id = Column(Integer, primary_key=True, autoincrement=True)
    financing_id = Column(Integer, ForeignKey('llc_financing_terms.financing_id', ondelete='CASCADE'), nullable=False)
    member_id = Column(Integer, ForeignKey('llc_members.member_id', ondelete='CASCADE'), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    financing = relationship('LLCFinancingTerms', back_populates='member_loans')


class LLCRentTenant(Base):
    __tablename__ = 'llc_rent_tenants'
    tenant_id = Column(Integer, primary_key=True, autoincrement=True)
    base_id = Column(Integer, nullable=False, unique=True)
    floor = Column(String, nullable=False)
    renter_name = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class LLCRentMonth(Base):
    __tablename__ = 'llc_rent_months'
    rent_month_id = Column(Integer, primary_key=True, autoincrement=True)
    month_start = Column(DateTime, nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())
    records = relationship('LLCRentRecord', back_populates='month', cascade='all, delete-orphan')
    total = relationship('LLCRentTotal', back_populates='month', uselist=False, cascade='all, delete-orphan')


class LLCRentRecord(Base):
    __tablename__ = 'llc_rent_records'
    rent_record_id = Column(Integer, primary_key=True, autoincrement=True)
    rent_month_id = Column(Integer, ForeignKey('llc_rent_months.rent_month_id', ondelete='CASCADE'), nullable=False)
    tenant_id = Column(Integer, ForeignKey('llc_rent_tenants.tenant_id', ondelete='CASCADE'), nullable=False)
    monthly_rent = Column(Numeric(14, 2))
    amount_due = Column(Numeric(14, 2), nullable=False, default=0.0)
    amount_received = Column(Numeric(14, 2), nullable=False, default=0.0)
    month = relationship('LLCRentMonth', back_populates='records')


class LLCRentTotal(Base):
    __tablename__ = 'llc_rent_totals'
    rent_month_id = Column(Integer, ForeignKey('llc_rent_months.rent_month_id', ondelete='CASCADE'), primary_key=True)
    total_monthly_rent = Column(Numeric(14, 2), nullable=False)
    month = relationship('LLCRentMonth', back_populates='total')
