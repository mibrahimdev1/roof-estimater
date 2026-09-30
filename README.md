# Roof Estimator

Roof material takeoff and quoting engine for pitched, flat, and hybrid roofs. Enter measurements and preferred brands, calculate quantities from a manufacturer catalog, apply pricing/margins, and export PDF, Word, or Excel proposals.

## Features

- Estimator UI for pitched / flat / hybrid roofs with brand selection (1–4)
- Catalog-driven product recommendations (`manufacturer_products` in SQLite)
- Admin dashboard: settings, history, manufacturers & products, CSV/XLSX import
- Exports: PDF proposal, Word (`.docx`), Excel material order
- Technical guide at `/guide.html`

## Requirements

- **Node.js 22.13+** (uses built-in `node:sqlite`)
- **pnpm** (recommended) or npm

## Setup

```bash
pnpm install
```

Create a `.env` in the project root (copy from below and adjust):

```env
PORT=5008
NODE_ENV=development
JWT_SECRET=change-me-to-a-long-random-string
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ChangeMe123!
SQLITE_PATH=
```

- Leave `SQLITE_PATH` empty to use `data/app.db` by default.
- On first start, the admin user is seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, and the material catalog is seeded if empty.

## Run

**Development** (auto-reload):

```bash
pnpm dev
```

**Production**:

```bash
pnpm start
```

Open:

| Page | URL |
|------|-----|
| Estimator | http://localhost:5008/ |
| Technical guide | http://localhost:5008/guide.html |
| Admin login | http://localhost:5008/login.html |
| Dashboard | http://localhost:5008/dashboard.html |

Default port is **5005** if `PORT` is unset; with the sample `.env` above it is **5008**.

## Useful scripts

```bash
pnpm db:reset                  # rebuild SQLite DB and reseed
pnpm db:sync-shingle-coverage  # sync pitched shingle coverage from constants
```

## API (quick)

- `GET /api/health` — health check
- `POST /api/calculate` — materials + pricing JSON
- `POST /api/proposal` — PDF
- `POST /api/proposal/docx` — Word
- `POST /api/proposal/xlsx` — Excel

Full formulas and endpoint list: see **Technical guide** (`/guide.html`).
