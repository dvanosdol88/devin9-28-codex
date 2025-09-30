import base64

import pytest

from teller import AccountsResource, TellerClient


class DummyRequest:
    def __init__(self, header):
        self._header = header

    def get_header(self, name):
        assert name == "Authorization"
        return self._header


def make_resource():
    return AccountsResource(TellerClient(cert=None))


def test_extract_token_returns_username_from_basic_header():
    username = "alice"
    token = base64.b64encode(f"{username}:secret".encode()).decode()
    req = DummyRequest(f"Basic {token}")

    result = make_resource()._extract_token(req)

    assert result == username


def test_extract_token_handles_invalid_base64():
    req = DummyRequest("Basic !!invalid!!")

    result = make_resource()._extract_token(req)

    assert result == ""


def test_extract_token_returns_header_for_non_basic():
    header = "Bearer some-token"
    req = DummyRequest(header)

    result = make_resource()._extract_token(req)

    assert result == header

