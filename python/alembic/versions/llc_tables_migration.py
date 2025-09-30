"""Add LLC tables for hybrid architecture

Revision ID: llc_tables_001
Revises: e3cac1307792
Create Date: 2025-09-30 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'llc_tables_001'
down_revision = 'e3cac1307792'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('llc_members',
    sa.Column('member_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.PrimaryKeyConstraint('member_id'),
    sa.UniqueConstraint('name')
    )
    
    op.create_table('llc_accounts',
    sa.Column('account_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('slug', sa.String(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('subtitle', sa.String(), nullable=True),
    sa.Column('account_type', sa.String(), nullable=False),
    sa.Column('current_balance', sa.Numeric(precision=14, scale=2), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('account_id'),
    sa.UniqueConstraint('slug')
    )
    
    op.create_table('llc_rent_tenants',
    sa.Column('tenant_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('base_id', sa.Integer(), nullable=False),
    sa.Column('floor', sa.String(), nullable=False),
    sa.Column('renter_name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.PrimaryKeyConstraint('tenant_id'),
    sa.UniqueConstraint('base_id')
    )
    
    op.create_table('llc_rent_months',
    sa.Column('rent_month_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('month_start', sa.DateTime(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.PrimaryKeyConstraint('rent_month_id'),
    sa.UniqueConstraint('month_start')
    )
    
    op.create_table('llc_account_transactions',
    sa.Column('transaction_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('account_id', sa.Integer(), nullable=False),
    sa.Column('txn_date', sa.DateTime(), nullable=False),
    sa.Column('description', sa.String(), nullable=False),
    sa.Column('debit', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('credit', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['account_id'], ['llc_accounts.account_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('transaction_id')
    )
    
    op.create_table('llc_financing_terms',
    sa.Column('financing_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('account_id', sa.Integer(), nullable=False),
    sa.Column('principal', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('interest_rate', sa.Numeric(precision=5, scale=2), nullable=False),
    sa.Column('term_years', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['account_id'], ['llc_accounts.account_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('financing_id'),
    sa.UniqueConstraint('account_id')
    )
    
    op.create_table('llc_rent_records',
    sa.Column('rent_record_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('rent_month_id', sa.Integer(), nullable=False),
    sa.Column('tenant_id', sa.Integer(), nullable=False),
    sa.Column('monthly_rent', sa.Numeric(precision=14, scale=2), nullable=True),
    sa.Column('amount_due', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('amount_received', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.ForeignKeyConstraint(['rent_month_id'], ['llc_rent_months.rent_month_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['tenant_id'], ['llc_rent_tenants.tenant_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('rent_record_id')
    )
    
    op.create_table('llc_rent_totals',
    sa.Column('rent_month_id', sa.Integer(), nullable=False),
    sa.Column('total_monthly_rent', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.ForeignKeyConstraint(['rent_month_id'], ['llc_rent_months.rent_month_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('rent_month_id')
    )
    
    op.create_table('llc_financing_breakdown',
    sa.Column('financing_breakdown_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('financing_id', sa.Integer(), nullable=False),
    sa.Column('label', sa.String(), nullable=False),
    sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.ForeignKeyConstraint(['financing_id'], ['llc_financing_terms.financing_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('financing_breakdown_id')
    )
    
    op.create_table('llc_member_loans',
    sa.Column('member_loan_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('financing_id', sa.Integer(), nullable=False),
    sa.Column('member_id', sa.Integer(), nullable=False),
    sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.ForeignKeyConstraint(['financing_id'], ['llc_financing_terms.financing_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['member_id'], ['llc_members.member_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('member_loan_id')
    )


def downgrade():
    op.drop_table('llc_member_loans')
    op.drop_table('llc_financing_breakdown')
    op.drop_table('llc_rent_totals')
    op.drop_table('llc_rent_records')
    op.drop_table('llc_financing_terms')
    op.drop_table('llc_account_transactions')
    op.drop_table('llc_rent_months')
    op.drop_table('llc_rent_tenants')
    op.drop_table('llc_accounts')
    op.drop_table('llc_members')
