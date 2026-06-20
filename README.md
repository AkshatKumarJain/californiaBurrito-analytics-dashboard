# California Burrito Analytics Dashboard

Business analytics dashboard built for the software developer intern assessment. The app turns the provided ~300,000-row Excel file into a responsive sales dashboard with a Node.js TypeScript API, MySQL storage, Redis caching, and a React + Tailwind frontend.

## Tech Stack

- Backend: Node.js, Express, TypeScript
- Database: MySQL with indexed aggregate queries
- Cache: Redis / Render Key Value with memory fallback
- ETL: streaming Excel import with batched inserts
- Frontend: React, Vite, Tailwind CSS, Recharts, Lucide icons
- Deployment target: Render for API/static frontend, with a MySQL-compatible hosted database(TiDB)

 ## why MYSQL was preferred here?

 - Efficient Aggregations – MySQL performs GROUP BY, COUNT, SUM, and reporting queries efficiently, which are heavily used in analytics dashboards.
 - Optimized Indexing – Indexes on filter columns (date, category, region, etc.) enable fast filtering and searching across large datasets.
 - Strong Relational Support – The dataset contains structured relationships between entities such as orders, products, and customers,    making a relational database a natural fit.
 - High Data Consistency – ACID-compliant transactions ensure accurate and reliable analytical results even with concurrent data          operations.
 - Lower Complexity for the Use Case – MongoDB's schema flexibility and PostgreSQL's advanced features were unnecessary for a structured  300k-row analytics workload, making MySQL the most practical choice.

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

1. Choice of Database: Why MySQL / TiDB?
Efficient Aggregations: The dashboard relies heavily on complex analytical functions (SUM, COUNT, AVG, GROUP BY). Relational engines optimize executive rollups far better than document stores like MongoDB.

Deterministic Indexing: High-cardinality columns (e.g., date ranges, store outlets, payment types) use B-Tree indexing strategies to eliminate full-table scans.

ACID Compliance: Ensures absolute financial data consistency across calculated revenues, eliminating rounding errors or drifting figures during concurrent updates.

TiDB Compatibility: Allows seamless distributed scaling while maintaining complete MySQL wire-protocol compatibility.

2. High-Volume Ingestion: Streaming ETL Pipeline
Memory Bounds: Loading a 300,000-row Excel sheet directly into system memory will crash standard server instances (such as Render’s free tier). The pipeline implements a chunked memory stream reader that reads the file row-by-row.

Batched Inserts: Database driver roundtrips are reduced by batching individual rows into parameterized multi-row queries of 5,000 rows per transaction block, reducing import times from minutes to seconds.

Data Transformation: Computes operational derivations at rest (e.g., line_revenue = price * quantity), moving computation away from the frontend application layout.

3. Dual-Layer Caching Strategy
To safeguard the system against connection drops or excessive query costs, a multi-tier caching system handles incoming traffic:

Primary Layer (Redis): Caches API outputs for rapid responses across distributed instances.

Secondary Layer (In-Memory Fallback): If the external Redis service goes cold, restarts, or hits rate limits, the API seamlessly switches to a localized, short-lived in-memory cache loop to prevent database overloading.

 Database Schema & Indexing Strategy
The data core utilizes a highly normalized schema centered around a central operational fact table:

SQL
CREATE TABLE sales_line_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_number VARCHAR(50) NOT NULL,
    order_datetime DATETIME NOT NULL,
    outlet_name VARCHAR(100) NOT NULL,
    brand_name VARCHAR(100) NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    order_type VARCHAR(50) NOT NULL,
    settlement_type VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    item_price DECIMAL(10, 2) NOT NULL,
    line_revenue DECIMAL(12, 2) NOT NULL
);
Performance Optimization Index Profile
To guarantee sub-second execution speeds when applying filters on the frontend, the following target indexes are built into the migration layer:

SQL
-- Date filtering optimization
CREATE INDEX idx_sales_datetime ON sales_line_items(order_datetime);

-- Composite operational coverage index for faceted sidebar searches
CREATE INDEX idx_dashboard_filters ON sales_line_items(outlet_name, brand_name, category_name, order_type);

-- Text search index for specific item identification queries
CREATE INDEX idx_item_search ON sales_line_items(item_name);

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
