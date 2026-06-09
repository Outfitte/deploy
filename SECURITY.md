# Security policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Use GitHub's [private vulnerability disclosure](https://github.com/Outfitte/deploy/security/advisories/new)
to report a vulnerability confidentially. We aim to acknowledge reports within
72 hours and will coordinate a fix and disclosure timeline with you.

## Scope

This repository contains Docker Compose orchestration and Playwright E2E tests.
The application code lives in the `backend` and `frontend` repositories —
please report vulnerabilities in those components to the corresponding repo.

## TLS and HSTS

The frontend container serves **plain HTTP** on `PORT`. TLS termination and
`Strict-Transport-Security` (HSTS) are **the operator's responsibility** at the
reverse proxy layer. The app deliberately does not set HSTS itself, so operators
retain control over the header parameters.

See [SELF_HOSTING.md § Reverse proxy & TLS](SELF_HOSTING.md#reverse-proxy--tls)
for setup guidance including Caddy and Nginx examples.

## Supported versions

Only the latest published images (`ghcr.io/outfitte/*:latest`) receive security
fixes. If you are running a pinned tag, upgrade to the latest release.
