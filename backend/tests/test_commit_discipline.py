from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
ALLOWED = {"db/session.py", "db/seed.py", "db/migrations.py"}
ALLOWED_PREFIXES = ("scripts/", "tests/")


def _raw_commits():
    found = []
    for path in BACKEND.rglob("*.py"):
        rel = path.relative_to(BACKEND).as_posix()
        if rel in ALLOWED or rel.startswith(ALLOWED_PREFIXES):
            continue
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if "db.session.commit(" in line or "app_module.db.session.commit(" in line:
                found.append(f"{rel}:{lineno}: {line.strip()}")
    return found


def test_no_raw_commits_outside_commit_helper():
    offenders = _raw_commits()
    assert not offenders, "Raw db.session.commit() calls found:\n" + "\n".join(offenders)


def test_commit_helper_returns_true_on_success(app_instance):
    from db.session import _commit_or_warn

    with app_instance.app_context():
        assert _commit_or_warn("commit discipline test") is True
