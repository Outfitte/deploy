# Contributing to Outfitte deploy

## Contributor License Agreement

Before a pull request can be merged, you must sign the Outfitte CLA. The CLA
bot will comment on your PR with a link the first time you open one.

## Running the stack

```sh
cp .env.example .env          # set JWT_SECRET to `openssl rand -hex 32` output
docker compose pull
docker compose up -d
```

The frontend is available at `http://localhost:30080`.

For full configuration options and production guidance (TLS, backups, upgrades)
see [SELF_HOSTING.md](SELF_HOSTING.md).

## E2E tests

### Quick start

```sh
npm install
npx playwright install chromium --with-deps   # first time only
npm test                                       # auto-scales to CPUs/2
PLAYWRIGHT_WORKERS=4 npm test                 # explicit count
npm run test:report                           # open HTML report
```

Run a single file or test:

```sh
npx playwright test e2e/tests/03-auth.spec.ts
npx playwright test --grep "unauthenticated access"
```

### How the fixture works

Each Playwright worker starts an **isolated Docker Compose stack** on a
dedicated port (`40080+N`, project name `outfitte-wN`). The fixture registers
an admin, enables registration, and pre-registers a member and recipient. The
stack is torn down automatically when the worker exits. No pre-running stack is
needed.

### Writing specs

**Self-contained describes.** Each `test.describe.configure({ mode: 'serial' })`
block is an independently schedulable unit — under multiple workers it may land
on a different Docker stack than the previous block. Every block must create the
data it needs in its own first test(s). Never rely on state set up by another
describe block.

**Fixed item names.** Use literal strings (e.g. `'WearLog-E2E-Item'`), not
`Date.now()` at module scope. Playwright re-evaluates each describe block in a
separate worker, so dynamic names evaluated at module scope will diverge between
blocks.

**`exact: true` for card links.** Use
`page.getByRole('link', { name: 'View ' + name, exact: true })` rather than a
`RegExp`. Substring matching triggers a strict-mode violation when one item name
is a prefix of another (e.g. `'Outfit-E2E'` vs `'Outfit-E2E-Zero'`).

**`group-hover` buttons.** Buttons rendered with `opacity-0 group-hover:opacity-100`
require hovering the parent card first before clicking.

## Commit style

```
<issue-number>: one sentence describing what changed
```

Example: `57: add CONTRIBUTING.md and SECURITY.md`
