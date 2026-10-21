"""Presigned browser requests must use regional S3 endpoints without redirects."""

import base64
import json
from urllib.parse import parse_qs, urlsplit

import pytest
from pydantic import SecretStr

from app.core import s3_client


@pytest.mark.parametrize("region", ["us-east-1", "us-east-2", "eu-west-1"])
def test_presigned_requests_use_regional_sigv4_urls(monkeypatch, region):
    """Sign locally with fake credentials; no AWS requests or real files."""
    monkeypatch.setattr(s3_client.settings, "AWS_REGION", region)
    monkeypatch.setattr(s3_client.settings, "AWS_S3_BUCKET_NAME", "donee-test-bucket")
    monkeypatch.setattr(s3_client.settings, "AWS_ACCESS_KEY_ID", "test-access-key")
    monkeypatch.setattr(
        s3_client.settings, "AWS_SECRET_ACCESS_KEY", SecretStr("test-secret")
    )
    s3_client.get_s3_client.cache_clear()
    try:
        upload, _ = s3_client.create_presigned_upload_url(
            "attachments/test-file", "text/plain", 35
        )
        expected_host = f"donee-test-bucket.s3.{region}.amazonaws.com"
        assert urlsplit(upload["url"]).hostname == expected_host
        fields = upload["fields"]
        assert fields["x-amz-algorithm"] == "AWS4-HMAC-SHA256"
        assert f"/{region}/s3/aws4_request" in fields["x-amz-credential"]
        policy = json.loads(base64.b64decode(fields["policy"]))
        assert {"Content-Type": "text/plain"} in policy["conditions"]
        assert ["content-length-range", 35, 35] in policy["conditions"]
        download, _ = s3_client.create_presigned_access_url(
            "attachments/test-file", "text/plain", "test.txt", "download"
        )
        assert urlsplit(download).hostname == expected_host
        query = parse_qs(urlsplit(download).query)
        assert query["X-Amz-Algorithm"] == ["AWS4-HMAC-SHA256"]
    finally:
        s3_client.get_s3_client.cache_clear()
