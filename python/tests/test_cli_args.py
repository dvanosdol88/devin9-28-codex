import sys

import pytest

from teller import _parse_args


def test_parse_args_requires_cert_in_development(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["teller.py", "--environment", "development"])

    with pytest.raises(SystemExit):
        _parse_args()


def test_parse_args_allows_sandbox_without_cert(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["teller.py", "--environment", "sandbox"])

    args = _parse_args()

    assert args.environment == "sandbox"
    assert args.cert is None
    assert args.cert_key is None


def test_parse_args_accepts_cert_when_provided(monkeypatch, tmp_path):
    cert = tmp_path / "cert.pem"
    key = tmp_path / "key.pem"
    cert.write_text("cert")
    key.write_text("key")
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "teller.py",
            "--environment",
            "production",
            "--cert",
            str(cert),
            "--cert-key",
            str(key),
        ],
    )

    args = _parse_args()

    assert args.environment == "production"
    assert args.cert == str(cert)
    assert args.cert_key == str(key)

