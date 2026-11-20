"""Alembic environment. Migrations run automatically at startup (see models.init_db); to create a new one:
    corella db revision -m "add x"      (autogenerates from the models against DATABASE_URL)
"""
from alembic import context

from corella.models import Base, engine

config = context.config
target_metadata = Base.metadata


def run():
    connectable = config.attributes.get("connection")
    if connectable is not None:
        _configure(connectable)
        return
    with engine.connect() as conn:
        _configure(conn)
        conn.commit()


def _configure(conn):
    context.configure(connection=conn, target_metadata=target_metadata, compare_type=True,
                      render_as_batch=conn.dialect.name == "sqlite")
    with context.begin_transaction():
        context.run_migrations()


run()
