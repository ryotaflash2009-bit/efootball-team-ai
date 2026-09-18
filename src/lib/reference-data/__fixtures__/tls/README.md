# TLS test fixtures (TEST ONLY — not real credentials)

These files are synthetic, throwaway TLS materials used **only** by
`src/lib/reference-data/pg-ssl-config.tls.test.ts`, specifically the
"期限切れの証明書は、正しいCAを渡していても拒否される" (expired certificate is
rejected even with the correct CA) test case.

They are **not** connected to any real Supabase project, any production
service, or any real certificate authority. They grant no access to anything.
Committing them is safe.

## Why these are committed instead of generated at test time

The rest of this test file's fixtures (valid CA, valid server cert, wrong CA,
hostname-mismatch cert) are generated fresh on every test run via the
`openssl` CLI, because they only need ordinary, universally-supported
operations (`genrsa`, `req -x509`, `req -new`, `x509 -req`).

Generating an **already-expired** certificate on demand requires forcing a
specific past validity window (`-not_before` / `-not_after`), which is not
supported by every OpenSSL version/build. This caused the test to pass
locally but fail in CI (a different OpenSSL build) with `x509: Use -help for
summary.`. Since Node's TLS stack (not the `openssl` CLI) is what actually
performs certificate verification in this test, a certificate generated once
and committed works identically to one generated at test time, without
depending on `openssl` flag availability in the CI environment.

## Files

| File | Contents | Notes |
|---|---|---|
| `expired-test-ca-cert.pem` | Public certificate only, self-signed, `CN=Test Fixture Root CA (expired-cert scenario, not a real CA)` | No corresponding private key is committed; nothing needs to be signed with it at test time. |
| `expired-test-server-cert.pem` | Server certificate signed by the CA above, `CN=localhost`, SAN `DNS:localhost` | `notBefore=2024-01-01T00:00:00Z`, `notAfter=2024-02-01T00:00:00Z` — already expired for the foreseeable future. |
| `expired-test-server-key.pem` | RSA-2048 private key paired with the server certificate above | Used only to start a local TLS test server on `127.0.0.1`; never used outside this test. |

## Regenerating (only if ever needed)

```sh
# Run with MSYS_NO_PATHCONV=1 on Git Bash / Windows to avoid path-mangling the -subj argument.
openssl genrsa -out ca-key.pem 2048
openssl req -x509 -new -nodes -key ca-key.pem -sha256 -days 7300 \
  -out ca-cert.pem -subj "/CN=Test Fixture Root CA (expired-cert scenario, not a real CA)"

openssl genrsa -out server-key.pem 2048
openssl req -new -key server-key.pem -out server.csr -subj "/CN=localhost"
echo "subjectAltName=DNS:localhost" > san.ext
openssl x509 -req -in server.csr -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial \
  -out expired-cert.pem -sha256 -extfile san.ext \
  -not_before 20240101000000Z -not_after 20240201000000Z
```

Then commit `ca-cert.pem` → `expired-test-ca-cert.pem`, `expired-cert.pem` →
`expired-test-server-cert.pem`, and `server-key.pem` →
`expired-test-server-key.pem`. Discard `ca-key.pem` (the CA private key) —
it is never needed again once the server certificate is signed.
