"""Initial schema baseline from existing models

Revision ID: e3cac1307792
Revises: 
Create Date: 2025-09-30 03:04:02.495336

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3cac1307792'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'accounts',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('institution_id', sa.String(), nullable=True),
        sa.Column('type', sa.String(), nullable=True),
        sa.Column('subtype', sa.String(), nullable=True),
        sa.Column('last_four', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table(
        'balance_snapshots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('account_id', sa.String(), nullable=True),
        sa.Column('available', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('ledger', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('as_of', sa.DateTime(), nullable=True),
        sa.Column('raw', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('account_id', 'as_of', name='uq_bal_asof')
    )
    op.create_index(op.f('ix_balance_snapshots_account_id'), 'balance_snapshots', ['account_id'], unique=False)
    op.create_index(op.f('ix_balance_snapshots_as_of'), 'balance_snapshots', ['as_of'], unique=False)
    
    op.create_table(
        'transactions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('account_id', sa.String(), nullable=True),
        sa.Column('date', sa.Date(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('raw', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_transactions_account_id'), 'transactions', ['account_id'], unique=False)
    op.create_index(op.f('ix_transactions_date'), 'transactions', ['date'], unique=False)
    op.create_index('ix_txn_acct_date', 'transactions', ['account_id', 'date'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_txn_acct_date', table_name='transactions')
    op.drop_index(op.f('ix_transactions_date'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_account_id'), table_name='transactions')
    op.drop_table('transactions')
    
    op.drop_index(op.f('ix_balance_snapshots_as_of'), table_name='balance_snapshots')
    op.drop_index(op.f('ix_balance_snapshots_account_id'), table_name='balance_snapshots')
    op.drop_table('balance_snapshots')
    
    op.drop_table('accounts')
