import os

import pytest

# Base de test dédiée ; si elle est absente, les tests base de données sont ignorés.
TEST_DSN = os.environ.get("RAPHAEL_TEST_DATABASE_URL")


@pytest.fixture
def test_dsn() -> str:
    if not TEST_DSN:
        pytest.skip("RAPHAEL_TEST_DATABASE_URL non défini")
    return TEST_DSN
