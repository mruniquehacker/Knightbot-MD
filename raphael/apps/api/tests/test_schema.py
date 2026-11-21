"""Vérifie les garanties du schéma : recherche vectorielle, cascade de suppression,
idempotence des migrations."""
import asyncpg

from scripts.migrate import migrate


async def test_migrations_are_idempotent(test_dsn):
    await migrate(test_dsn)
    assert await migrate(test_dsn) == []


async def test_vector_search_and_user_deletion_cascade(test_dsn):
    await migrate(test_dsn)
    conn = await asyncpg.connect(test_dsn)
    try:
        async with conn.transaction():
            uid = await conn.fetchval(
                "INSERT INTO users(email, display_name, password_hash) "
                "VALUES ('t@example.com','T','x') RETURNING id"
            )
            near = "[" + ",".join(["1"] + ["0"] * 1023) + "]"
            far = "[" + ",".join(["0", "1"] + ["0"] * 1022) + "]"
            await conn.execute(
                "INSERT INTO memories(user_id, kind, content, embedding) VALUES "
                "($1,'goal','Apprendre le japonais',$2::vector),"
                "($1,'preference','Aime le café',$3::vector)",
                uid, near, far,
            )
            best = await conn.fetchval(
                "SELECT content FROM memories WHERE user_id=$1 "
                "ORDER BY embedding <=> $2::vector LIMIT 1", uid, near,
            )
            assert best == "Apprendre le japonais"

            await conn.execute("DELETE FROM users WHERE id=$1", uid)
            assert await conn.fetchval("SELECT count(*) FROM memories WHERE user_id=$1", uid) == 0
            raise _Rollback()
    except _Rollback:
        pass
    finally:
        await conn.close()


class _Rollback(Exception):
    pass
