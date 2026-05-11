from app.config import Settings


def test_cors_origin_list_splits_and_trims():
    s = Settings(cors_origins=" http://a.test ,http://b.test, ")
    assert s.cors_origin_list() == ["http://a.test", "http://b.test"]


def test_default_cors_origins_non_empty(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    s = Settings()
    assert len(s.cors_origin_list()) >= 1
    assert all(o.startswith("http") for o in s.cors_origin_list())
