# California Burrito Analytics Dashboard

Business analytics dashboard built for the software developer intern assessment. The app turns the provided ~300,000-row Excel file into a responsive sales dashboard with a Node.js TypeScript API, MySQL storage, Redis caching, and a React + Tailwind frontend.

## Tech Stack

- Backend: Node.js, Express, TypeScript
- Database: MySQL with indexed aggregate queries
- Cache: Redis / Render Key Value with memory fallback
- ETL: streaming Excel import with batched inserts
- Frontend: React, Vite, Tailwind CSS, Recharts, Lucide icons
- Deployment target: Render for API/static frontend, with a MySQL-compatible hosted database

## Features

- Revenue, orders, total quantity, line-item count, average order value, and items per order KPIs
- Revenue trend by day, week, or month
- Category sales comparison
- Outlet and brand performance
- Order type and payment settlement mix
- Combined dashboard endpoint to reduce request churn
- Top menu items table
- Filters for date range, outlet, brand, category, order type, settlement, and item search
- CSV export of the filtered dataset
- Optional JWT login/register flow with a future `AUTH_REQUIRED=true` deployment mode
- AI-generated or rule-based insights from the filtered aggregates
- API request hook prepared for the login flow by attaching `localStorage.auth_token` as a bearer token

## Architecture Decisions

The dashboard does not read the Excel file on page load. Large-file handling is isolated in a one-time ETL command that streams rows from the workbook, normalizes values, computes `line_revenue = price * quantity`, and inserts records into MySQL in batches. The API then serves pre-cleaned data through aggregate SQL queries.

This approach is safer for Render/free-tier style deployments because the web server handles lightweight JSON requests while MySQL performs indexed filtering and grouping. Redis is used as an optional cache layer, but every cached response still falls back to a short in-memory cache if Redis is unavailable. That means the dashboard keeps working even when the cache service is cold, restarting, or temporarily unreachable.

The main table is `sales_line_items`, one row per Excel line item. Important indexes are placed on `order_datetime` plus common dashboard dimensions such as outlet, brand, category, order type, settlement, and bill number.

## Backend Setup

```bash
cd Backend
npm install
copy .env.example .env
```

Update `Backend/.env` with your MySQL credentials:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=california_burrito_analytics
CORS_ORIGIN=http://localhost:5173
DATA_FILE=C:\Users\HP\Downloads\data.xlsx
REDIS_URL=
AUTH_REQUIRED=false
AUTH_ALLOW_REGISTRATION=true
JWT_SECRET=replace-with-a-long-random-string
OPENAI_API_KEY=
```

Create the database/schema:

```bash
npm run migrate
```

Import the Excel file:

```bash
npm run import:xlsx -- --file "C:\Users\HP\Downloads\data.xlsx" --truncate
```

For a quick smoke import while testing:

```bash
npm run import:xlsx -- --file "C:\Users\HP\Downloads\data.xlsx" --truncate --limit 5000
```

Run the API:

```bash
npm run dev
```

The API runs on `http://localhost:4000`.

## Frontend Setup

```bash
cd Frontend
npm install
copy .env.example .env
npm run dev
```

The dashboard runs on `http://localhost:5173`.

## Production Build

```bash
cd Backend
npm run build
npm start
```

```bash
cd Frontend
npm run build
```

## Deployment Notes

Backend Render service:

- Root directory: `Backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment variables: `DATABASE_URL` or the `DB_*` variables, `CORS_ORIGIN`, `NODE_ENV=production`, `REDIS_URL`, `AUTH_REQUIRED`, `JWT_SECRET`, `OPENAI_API_KEY`
- Add a Render Key Value service and wire its `connectionString` into `REDIS_URL`
- Use a separate MySQL provider because Render does not provide managed MySQL

Frontend Render static site:

- Root directory: `Frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://your-backend-url.onrender.com/api`

Run the ETL import once from a local machine or temporary worker with access to the Excel file and database. Do not make the deployed API import the workbook during startup.

## API Endpoints

- `GET /api/health`
- `GET /api/analytics/filters`
- `GET /api/analytics/summary`
- `GET /api/analytics/revenue-trend?granularity=day`
- `GET /api/analytics/category-sales`
- `GET /api/analytics/outlet-performance`
- `GET /api/analytics/channel-mix`
- `GET /api/analytics/top-items`
- `GET /api/analytics/dashboard`
- `GET /api/analytics/insights`
- `GET /api/analytics/export.csv`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`

All analytics endpoints accept filters such as `from`, `to`, `outlet`, `brand`, `group`, `orderType`, `settlement`, and `itemSearch`.
