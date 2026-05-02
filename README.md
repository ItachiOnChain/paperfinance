# HyPaper 0G — Developer Quick Start

Welcome to the HyPaper 0G paper trading engine and dashboard. This guide will help any new developer get the full stack running locally on their machine.

## Prerequisites

Before starting, ensure you have the following installed:
- [Bun](https://bun.sh/) (JavaScript runtime and package manager)
- [Docker](https://www.docker.com/) & Docker Compose (for running Redis & Postgres)
- [Foundry](https://getfoundry.sh/) *(Optional: only needed if you want to modify smart contracts)*

---

## 1. Environment Setup

Clone the repository and install all dependencies:
```bash
git clone https://github.com/ItachiOnChain/paperfinance.git
cd paperfinance
bun install
```

Copy the example environment file and configure the necessary keys (like `JWT_SECRET`, `DEMO_MODE_SECRET`, and `DEPLOYER_PK` if you plan to run settlement scripts).
```bash
cp .env.example .env
```

---

## 2. Start Infrastructure (Databases)

The backend relies on Redis (for the fast in-memory matching engine and orderbooks) and PostgreSQL. We use Docker to spin these up instantly.

From the root directory, run:
```bash
docker compose up -d redis postgres
```
*(This starts the databases in the background. You do not need to run the `engine` or `nginx` docker services for local development).*

---

## 3. Run the Backend Trading Engine

The engine connects to live Binance data, manages the in-memory orderbooks, and exposes the REST/WebSocket API on port `3001`.

Open a new terminal and run:
```bash
cd paperfinance
bun run packages/engine/src/index.ts
```
*You should see logs indicating a successful connection to Redis and the Binance WebSockets.*

---

## 4. Run the Frontend Dashboard

The Next.js dashboard provides the UI to connect wallets, place orders, and view live charts.

Open another terminal and run:
```bash
cd paperfinance/apps/dashboard
bun dev
```
*The dashboard will be available at [http://localhost:3000](http://localhost:3000).*

---

## Demo Mode / Bot Simulation
By default, the engine connects to live Binance price streams. To simulate user activity (bots placing orders) and price shocks, use the **Demo Toggle** in the header of the dashboard to spawn up to 50 active trading bots.

## Useful Commands
- **Run settlement script:** `bun run packages/engine/scripts/settle.ts 1`
- **Run engine tests:** `cd packages/engine && bun test`
- **Build contracts:** `cd packages/contracts && forge build`
