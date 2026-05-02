# HyPaper Clone on 0G Blockchain — Complete Production Infrastructure Checklist

> **Prepared for:** Production-grade paper trading system (HyPaper architecture) on 0G EVM chain  
> **Date:** May 2026 | **Author:** Infrastructure Research Report  
> **Reference architecture:** [HyPaper](https://github.com/GigabrainGG/HyPaper) × [0G Chain](https://0g.ai)

---

## WHAT IS THE BUILD TARGET?

HyPaper is a paper trading backend that mirrors the HyperLiquid API exactly — same REST endpoints, same WebSocket protocol, same order model — but fills orders off real mid-prices with simulated VWAP slippage instead of real execution. The goal here is to rebuild that concept **natively on 0G**, where:

- Price data must be sourced externally (no native Hyperliquid feed)
- The simulated orderbook must be built from scratch
- On-chain vault contracts replace Hyperliquid's internal margin ledger
- 0G's EVM layer is used for wallet auth, token issuance, and optional on-chain settlement

---

## 1. CORE INFRA REQUIREMENTS (EVM BASICS)

### 1.1 Network Endpoints

| Network | HTTP RPC | WS RPC | Chain ID |
|---|---|---|---|
| **Mainnet** | `https://evmrpc.0g.ai` | `wss://evmrpc.0g.ai/ws` | **16661** |
| **Testnet (Galileo)** | `https://evmrpc-testnet.0g.ai` | `wss://evmrpc-testnet.0g.ai/ws` | **16602** |
| **Testnet (Galileo v2)** | — | — | **16601** |

**Why needed:** Every on-chain read (balances, events, contract state) and write (transactions) goes through RPC. WebSocket endpoints are required for real-time event subscriptions (`eth_subscribe`).

### 1.2 Private/Premium RPC Providers

Public RPC endpoints are rate-limited and unsuitable for production. Use private endpoints.

| Provider | Plan | How to obtain | Notes |
|---|---|---|---|
| **QuickNode** | Free → Growth ($49/mo) | 1. Go to quicknode.com → Sign Up → Create Endpoint → Select "0G" → Choose network → Copy HTTP + WS URL | Archive data, debug/trace methods, WebSocket |
| **dRPC** | Free tier available | 1. drpc.org → Connect Wallet or Email → Dashboard → Add Endpoint → "0G Mainnet" → Generate key | Geo-distributed, low latency |
| **Ankr** | Free + Premium | 1. ankr.com → Sign Up → Web3 API → Select 0G → Create Endpoint | Geo-distributed "Asphere" nodes |
| **Self-hosted node** | ∞ requests | Clone `github.com/0gfoundation/0g-chain`, build, sync | Full control, high ops burden |

**Step-by-step for QuickNode (most complete):**
1. Visit `quicknode.com` → click **"Sign Up Free"**
2. Create account (email/GitHub/Google)
3. Click **"Create an Endpoint"**
4. Search for **"0G"** in the chain selector
5. Choose **Mainnet** or **Galileo Testnet**
6. Select add-ons: enable **"Trace/Debug"** and **"Archive"** if needed
7. Click **"Create Endpoint"** — copy the **HTTP Provider URL** and **WSS URL**
8. Store both in `.env` as `RPC_URL` and `WS_RPC_URL`

### 1.3 Block Explorer APIs

| Explorer | URL | API Endpoint | Notes |
|---|---|---|---|
| **0GScan (Mainnet)** | `chainscan.0g.ai` | `https://chainscan.0g.ai/api` | Official, Blockscout-based |
| **0GScan (Galileo)** | `chainscan-galileo.0g.ai` | `https://chainscan-galileo.0g.ai/api` | Testnet explorer |
| **0gfoundation/0g-blockscout** | Self-host | — | Open-source fork of Blockscout |

**Usage:** Blockscout API is Etherscan-compatible. Use `?module=contract&action=getabi&address=0x...` to fetch ABIs, verify contracts, and look up transaction receipts.

**Access:** No API key required for public endpoints. For high-volume use, self-host `github.com/0gfoundation/0g-blockscout`.

---

## 2. MARKET DATA SOURCES

### 2.1 Data Source Options (Priority Order)

**For a paper trading system, price feeds are the most critical dependency.** Since 0G has minimal native DEX liquidity at mainnet launch, you MUST use external price oracles or CEX feeds.

#### Option A — Binance REST + WebSocket (Recommended Primary)

| Field | Value |
|---|---|
| Use case | Real-time tick data, OHLCV, index price |
| Endpoint | `api.binance.com` (REST), `stream.binance.com:9443` (WS) |
| Auth | No key required for market data (public) |
| Rate limit | 1200 requests/min (REST), unlimited streams (WS) |

**How to access:**
1. No signup required for market data endpoints
2. Use `GET /api/v3/ticker/price?symbol=BTCUSDT` for spot mid-price
3. Subscribe to `wss://stream.binance.com:9443/ws/btcusdt@trade` for tick-level trades
4. Subscribe to `btcusdt@depth20@100ms` for L2 book snapshot at 100ms intervals
5. Use `btcusdt@kline_1m` for OHLCV candles

**For HyPaper-style VWAP fill simulation:** consume Binance's `aggTrade` stream, aggregate into a local L2 book, and compute VWAP fill price at order time.

#### Option B — CoinGecko / GeckoTerminal (Fallback, No Key Needed)

| Field | Value |
|---|---|
| Use case | Spot price for less liquid tokens |
| REST | `api.geckoterminal.com/api/v2/networks/0g/tokens/{address}/prices` |
| Rate limit | 30 calls/min (free), 100/min (Pro at $129/mo) |
| Auth | No key for free tier |

**How to access:**
1. Free tier: no registration needed, just hit the endpoint
2. Paid: `geckoterminal.com` → Sign Up → Billing → Generate API key → pass as `x-api-key` header

#### Option C — DEXScreener (0G pairs if any exist)

| Field | Value |
|---|---|
| Use case | On-chain pair price if DEX exists on 0G |
| REST | `api.dexscreener.com/latest/dex/pairs/0g/{pairAddress}` |
| Auth | None for public endpoints |
| Rate limit | 300/min |

**Important:** As of May 2026, 0G's DeFi TVL is minimal. DEXScreener may return no pairs. Treat as supplementary.

#### Option D — Chainlink Oracle (If Deployed on 0G)

Chainlink has confirmed a partnership with 0G per the official 0G website. However, feed deployment on 0G mainnet requires confirmation.

**Check:** `https://docs.chain.link/data-feeds/price-feeds/addresses` — filter by 0G chain ID (16661)

**How to integrate if available:**
```solidity
AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
(, int256 price, , , ) = feed.latestRoundData();
```

**Fallback if no Chainlink feeds on 0G:** Deploy your own push-oracle contract that an off-chain relayer updates every N seconds with prices sourced from Binance.

### 2.2 Price Feed Decision Tree

```
Production price feed:
1. Binance WS aggTrade stream → compute mid/VWAP locally (primary)
2. CoinGecko REST poll (30s) → fallback if WS disconnects
3. Custom push oracle on-chain → for on-chain settlement logic only
4. DEXScreener 0G pairs → supplement if any native DEX has liquidity
```

---

## 3. TRADING INFRA (CRITICAL — BUILD FROM SCRATCH)

### 3.1 Reality Check: What 0G Does NOT Have

0G is an AI-focused data Layer-1. It does NOT have:
- A native perpetuals exchange
- A CLOBorder book protocol
- Hyperliquid-style APIs
- Deep AMM liquidity (early stage)

**This means: the entire trading simulation layer must be built from scratch.**

### 3.2 Simulated Orderbook Architecture

You need to build a **virtual matching engine** that:

1. **Ingests live external prices** (Binance feed)
2. **Accepts paper orders** from users via REST
3. **Simulates fills** using VWAP slippage model
4. **Maintains virtual positions, balances, PnL** in Redis
5. **Emits WebSocket events** to clients (fills, order updates, L2 book)

#### Matching Engine Requirements

```
Component: In-Memory Order Book (per asset)
├── Bids: Sorted map (price → [orders])
├── Asks: Sorted map (price → [orders])
├── Market order fill: VWAP against synthetic L2 (from Binance depth)
├── Limit order fill: fill when market crosses limit price
├── Stop orders: trigger on mid-price crossing stop level
└── IOC / ALO / Post-only: flag-based routing

Component: Position Manager
├── Virtual balance ledger per wallet (Redis hash)
├── Weighted average entry price
├── Unrealized PnL = (current_mid - avg_entry) × size
├── Realized PnL on close (accumulated in Redis)
└── Funding rate accrual (optional, periodic cron)

Component: Fill Simulator
├── Input: order, side, size, Binance L2 book snapshot
├── Output: filled price (VWAP), fill size, timestamp
├── Slippage model: walk the synthetic book for the given size
└── Latency simulation: optional configurable fill delay
```

#### Order Types to Implement

| Type | Description | Implementation complexity |
|---|---|---|
| Market | Fill immediately at VWAP | Low |
| Limit | Queue, fill when price crosses | Medium |
| IOC | Fill what's available, cancel rest | Medium |
| ALO (Add Liquidity Only) | Reject if would match | Medium |
| Stop-Loss | Trigger on price breach | Medium |
| Take-Profit | Trigger on price breach | Medium |
| Bracket | SL + TP linked to parent | High |

### 3.3 Liquidity Assumptions

Since there is no real on-chain book:
- **All fills are simulated** against Binance's real depth snapshot
- **Slippage is synthetic** (walk the book for a given notional size)
- **No counterparty risk** (paper system is counterparty to all trades)
- **Funding rates** can be mirrored from Binance perpetual funding rates via `GET /fapi/v1/fundingRate`

---

## 4. BACKEND INFRA

### 4.1 Redis — State Engine

**Why:** All hot state (virtual positions, open orders, virtual balances, real-time fills) must live in Redis for sub-millisecond access. Postgres is too slow for order matching.

| Config | Value |
|---|---|
| Use case | Order state, position ledger, price cache, session store |
| Data structures | Hash (positions), Sorted Set (orderbook), Pub/Sub (WS fanout), String (balance) |
| Recommended version | Redis 7.x |

**Deployment options:**
- **Cloud:** Redis Cloud (free 30MB tier), AWS ElastiCache ($15-50/mo), Upstash ($0 free tier, serverless)
- **Local/Docker:** `docker run -p 6379:6379 redis:7-alpine`
- **Cluster config (production):** 3 primary + 3 replica nodes; use `redis-cli cluster create`

**Key schema:**
```
position:{wallet}:{asset}     → Hash {size, entryPrice, realizedPnl, ...}
orders:{wallet}               → Hash {orderId → JSON}
balance:{wallet}              → String (decimal)
price:mid:{asset}             → String (updated every tick)
book:bids:{asset}             → ZSet (score=price, member=orderId)
book:asks:{asset}             → ZSet (score=price, member=orderId)
```

### 4.2 PostgreSQL — Historical Store

**Why:** All settled trades, funding payments, historical PnL, and audit trails must be durable. Redis is ephemeral (can lose state on restart without persistence config).

| Config | Value |
|---|---|
| Use case | Trade history, fill log, user registry, audit trail |
| Recommended version | Postgres 16 |
| ORM | Prisma (TypeScript) or Drizzle |

**Schema (core tables):**
```sql
fills(id, wallet, asset, side, size, price, fee, timestamp, order_id)
orders(id, wallet, asset, type, side, size, price, status, created_at, filled_at)
positions_history(id, wallet, asset, realized_pnl, closed_at)
accounts(wallet_address, virtual_balance, created_at)
funding_payments(wallet, asset, amount, rate, timestamp)
```

**Deployment options:**
- **Managed:** Supabase (free 500MB), Neon (free 0.5GB, serverless), Railway (~$5/mo), AWS RDS
- **Self-hosted:** Docker `postgres:16-alpine`, or bare metal with `pg_dump` backups

### 4.3 Message Queue — Event Bus

**Why:** Price updates from Binance WS, order matching events, and fill notifications must flow through a durable event bus so multiple services (matcher, PnL engine, WS gateway) consume them independently.

| Option | Recommended for | Setup |
|---|---|---|
| **NATS JetStream** | Low-latency, simple ops | `docker run -p 4222:4222 nats:latest -js` |
| **Redis Streams** | If already using Redis, simplest add-on | Built into Redis; use `XADD` / `XREAD` |
| **Kafka** | High-throughput, multi-consumer, replay | `docker-compose` with Bitnami Kafka image |
| **BullMQ** | TypeScript-native job queue on Redis | `npm i bullmq` |

**Recommendation for MVP:** Redis Streams (zero extra infra). For scale: NATS JetStream.

**Key streams:**
```
stream: price.ticks         → {asset, mid, bid, ask, timestamp}
stream: orders.new          → {orderId, wallet, type, side, size, price}
stream: fills.confirmed     → {fillId, orderId, wallet, asset, price, size}
stream: positions.update    → {wallet, asset, newSize, newPnl}
```

### 4.4 WebSocket Gateway

**Why:** Clients (bots, frontend) need real-time streaming of order updates, fills, position changes, and market data. Must mirror Hyperliquid's WS protocol exactly for HyPaper compatibility.

**Channels to implement (Hyperliquid-compatible):**
```
allMids          → {mids: {BTC: "83000", ETH: "3200"}}
l2Book           → {levels: [[bid, ask]], asset}
orderUpdates     → {orderId, status, filledSize, ...}
userFills        → {wallet, fills: [...]}
userFunding      → {wallet, asset, amount}
```

**Tech stack:**
- `ws` (Node.js) or `socket.io` for WS server
- Redis Pub/Sub → fan-out to connected WebSocket clients
- Heartbeat ping/pong every 30s
- Client subscription model (client sends `{op: "subscribe", subscription: {type: "allMids"}}`)

### 4.5 REST API Gateway

**Why:** Bots switch from `https://api.hyperliquid.xyz` to `http://localhost:3000` with no code changes. All HL endpoints must be implemented.

**Critical endpoints to implement:**
```
POST /exchange          → place/cancel order, set leverage
POST /info              → account state, positions, open orders, meta
GET  /health            → liveness probe
POST /paper/reset       → reset virtual balance (paper-specific)
POST /paper/fund        → add virtual funds
```

**Tech stack:** Fastify (Node.js, fastest), or Express, or Bun HTTP server. Recommend Fastify for production throughput.

---

## 5. ON-CHAIN INTEGRATION INFRA

### 5.1 Wallet Management

| Component | Tool | Notes |
|---|---|---|
| Key management | `ethers.Wallet` or `viem`'s `privateKeyToAccount` | Never log private keys; use env vars |
| Hardware signer | `@ethersproject/hardware-wallets` (Ledger) | For treasury/vault operations |
| Smart account | ERC-4337 (if needed for gasless) | Optional; adds complexity |
| Signing | `eth_signTypedData_v4` (EIP-712) | For SIWE and off-chain orders |

**Key security:**
- Store deployer private key in AWS Secrets Manager, HashiCorp Vault, or Doppler
- Use a dedicated relayer wallet with minimal ETH for gas
- Never store user private keys — use SIWE signatures for auth only

### 5.2 Contract Deployment Tools

| Tool | Config for 0G |
|---|---|
| **Foundry (recommended)** | `forge create --rpc-url https://evmrpc.0g.ai --private-key $PK --evm-version cancun` |
| **Hardhat** | `{url: "https://evmrpc.0g.ai", chainId: 16661, accounts: [process.env.PK]}` |
| **Remix** | Add custom network: Chain ID 16661, RPC `https://evmrpc.0g.ai` |

**Critical compiler flag:** Always set `--evm-version cancun` — 0G Chain requires it.

### 5.3 Contract Verification

```bash
# Via Hardhat verify plugin (Blockscout-compatible)
npx hardhat verify --network 0g-mainnet CONTRACT_ADDRESS [constructor args]

# Blockscout API verification
POST https://chainscan.0g.ai/api?module=contract&action=verifysourcecode
```

### 5.4 Event Indexing

**Option A — The Graph (check if 0G is supported)**

The Graph has not confirmed 0G mainnet support as of May 2026. Monitor `thegraph.com/networks`. If available:
1. `graph init --from-contract 0xVaultAddress --network 0g`
2. Define schema, mappings in `subgraph.yaml`
3. `graph deploy --studio my-hypaper-subgraph`

**Option B — Custom Indexer (Recommended for 0G now)**

Build a lightweight indexer using `ethers.js` or `viem`:

```typescript
const provider = new ethers.WebSocketProvider(WS_RPC_URL);
const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);

vault.on("Deposit", (wallet, amount, event) => {
  // Write to Postgres
  db.insert(deposits).values({ wallet, amount, block: event.blockNumber });
});

vault.on("Withdraw", (wallet, amount, event) => { ... });
```

For production, use a polling + `getLogs` approach with block range pagination as a safety net against WS disconnects.

**Option C — Envio (Modern EVM indexer, check 0G support)**

Envio `hyperindex` supports custom EVM chains. Config: add 0G chain ID and RPC to `envio.config.yaml`.

### 5.5 Getting Contract ABIs

```bash
# From block explorer (Blockscout-compatible)
curl "https://chainscan.0g.ai/api?module=contract&action=getabi&address=0xYOUR_CONTRACT"

# From local build
cat out/VaultContract.sol/VaultContract.json | jq '.abi'

# From Hardhat artifacts
cat artifacts/contracts/Vault.sol/Vault.json | jq '.abi'
```

---

## 6. SMART CONTRACT INFRA

### 6.1 Contracts to Deploy

#### VaultContract.sol (Core)

```solidity
// Minimal interface
contract PaperVault {
    mapping(address => uint256) public virtualBalance;
    
    function deposit(uint256 amount) external;    // deposit test tokens
    function withdraw(uint256 amount) external;  // withdraw test tokens
    function recordFill(address user, int256 pnl) external onlyBackend;
    
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event FillRecorded(address indexed user, int256 pnl);
}
```

#### MockERC20.sol (Test token, testnet only)

```solidity
contract MockUSDC is ERC20 {
    function mint(address to, uint256 amount) external; // faucet function
}
```

#### PriceOracle.sol (Push oracle, if Chainlink not available)

```solidity
contract PaperOracle {
    mapping(string => int256) public prices;
    address public relayer;
    
    function updatePrice(string calldata asset, int256 price) external onlyRelayer;
    function getPrice(string calldata asset) external view returns (int256);
}
```

### 6.2 Testnet Faucets

| Resource | URL | Amount |
|---|---|---|
| **0G Galileo OG faucet** | `faucet.0g.ai` | 0.01 OG/day |
| **thirdweb faucet** | `thirdweb.com/0g-galileo-testnet-16601` | Free OG |
| **Community faucet** | Discord: `discord.gg/0glabs` → #faucet | Variable |

### 6.3 Step-by-Step Contract Deployment on 0G

```bash
# 1. Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 2. Create project
forge init hypaper-contracts && cd hypaper-contracts

# 3. Write contracts in src/

# 4. Compile (MUST use cancun evm version)
forge build --evm-version cancun

# 5. Set env
export PK="your_private_key"
export RPC="https://evmrpc-testnet.0g.ai"

# 6. Deploy
forge create --rpc-url $RPC \
  --private-key $PK \
  --evm-version cancun \
  src/PaperVault.sol:PaperVault

# 7. Verify on Blockscout
forge verify-contract \
  --chain-id 16602 \
  --verifier blockscout \
  --verifier-url https://chainscan-galileo.0g.ai/api \
  0xDEPLOYED_ADDRESS \
  src/PaperVault.sol:PaperVault
```

---

## 7. AUTH & USER MANAGEMENT

### 7.1 Sign-In With Ethereum (SIWE)

**Why:** Wallet-based auth — no passwords, no centralized user DB. Users prove ownership of their wallet address by signing a message.

**Flow:**
```
1. GET /auth/nonce?wallet=0x...   → returns random nonce
2. Client signs: EIP-4361 message (wallet, nonce, domain, timestamp)
3. POST /auth/verify {message, signature}
4. Server: ethers.verifyMessage(message, signature) === wallet
5. Server: issue JWT (signed with server secret)
6. Client: attach JWT as Authorization: Bearer {token} on all requests
```

**Libraries:**
```bash
npm install siwe            # EIP-4361 message builder/verifier
npm install jsonwebtoken    # JWT signing
npm install iron-session    # or cookie-based session
```

### 7.2 Session Management

| Approach | Library | Notes |
|---|---|---|
| **JWT** | `jsonwebtoken` | Stateless, good for bots; set 24h expiry |
| **Iron session** | `iron-session` | Cookie-based, encrypted, good for browser |
| **Redis sessions** | `connect-redis` + `express-session` | Stateful; revocable |

**Recommendation:** JWT for bot API keys, Redis sessions for browser-facing frontend.

### 7.3 API Key System (for Trading Bots)

```typescript
// Schema
api_keys(
  key_hash VARCHAR,        // sha256 of the actual key (never store raw)
  wallet_address VARCHAR,  // owner
  label VARCHAR,           // "my-grid-bot"
  permissions JSONB,       // {trade: true, read: true, withdraw: false}
  rate_limit INT,          // requests per minute
  expires_at TIMESTAMP,
  created_at TIMESTAMP
)

// Auth middleware
const key = req.headers['x-api-key'];
const hash = sha256(key);
const record = await db.query('SELECT * FROM api_keys WHERE key_hash = $1', [hash]);
if (!record || record.expires_at < now()) throw new UnauthorizedError();
```

---

## 8. DEV TOOLS & SDKs

### 8.1 Blockchain Interaction

| Tool | Version | Install | Use |
|---|---|---|---|
| **viem** | ^2.x | `npm i viem` | Recommended: typed, fast, tree-shakeable |
| **ethers.js** | ^6.x | `npm i ethers` | Widely used; good for beginners |
| **web3.js** | ^4.x | `npm i web3` | Legacy; avoid for new projects |
| **Foundry** | latest | `foundryup` | Contract compile, test, deploy |
| **Hardhat** | ^2.x | `npm i -D hardhat` | Full dev environment with scripts |

### 8.2 Database Clients

```bash
npm install pg                  # PostgreSQL raw driver
npm install @prisma/client      # Prisma ORM (recommended)
npm install drizzle-orm         # Drizzle ORM (lightweight alternative)
npm install ioredis             # Redis client (TypeScript-friendly)
```

### 8.3 WebSocket Libraries

```bash
npm install ws                  # Low-level WS server (fastest)
npm install socket.io           # Higher-level, auto-reconnect, rooms
npm install @fastify/websocket  # If using Fastify
npm install reconnecting-websocket  # Client-side auto-reconnect
```

### 8.4 HTTP Server

```bash
npm install fastify             # Fastest Node HTTP framework (recommended)
npm install @fastify/cors
npm install @fastify/jwt
npm install @fastify/rate-limit
```

### 8.5 Utilities

```bash
npm install decimal.js          # Precise financial math (required — no floats)
npm install date-fns            # Date manipulation
npm install zod                 # Request schema validation
npm install pino                # Structured logging
npm install dotenv              # Env file loading
```

---

## 9. OBSERVABILITY & DEVOPS

### 9.1 Logging

```bash
npm install pino pino-pretty    # Structured JSON logging, fast
```

**Config:**
```typescript
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty' } 
    : undefined
});
```

**Log every:** order received, order filled, order cancelled, position opened/closed, wallet authenticated, price feed reconnect, RPC error.

### 9.2 Metrics (Prometheus + Grafana)

```yaml
# docker-compose.yml addition
prometheus:
  image: prom/prometheus:latest
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports: ["9090:9090"]

grafana:
  image: grafana/grafana:latest
  ports: ["3001:3000"]
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
```

**Key metrics to expose:**
```typescript
// Using prom-client
const orderLatency = new Histogram({ name: 'order_fill_latency_ms', ... });
const activeConnections = new Gauge({ name: 'ws_active_connections', ... });
const priceTickRate = new Counter({ name: 'price_ticks_received_total', ... });
const rpcErrors = new Counter({ name: 'rpc_errors_total', labelNames: ['method'] });
```

### 9.3 Tracing (OpenTelemetry)

```bash
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

**Use:** Trace latency across the order lifecycle: API receive → matcher → fill → WS emit.

### 9.4 Alerting

| Alert | Threshold | Channel |
|---|---|---|
| Price feed disconnected | >5s with no tick | PagerDuty / Telegram bot |
| RPC error rate | >5% of calls | Slack webhook |
| Order queue backlog | >100 pending | Slack webhook |
| Redis memory | >80% | Email |
| Postgres disk | >75% | PagerDuty |
| WebSocket connections drop | >50% in 1m | Slack |

**Tools:** Grafana Alerting (built-in), or Alertmanager (with Prometheus).

### 9.5 DevOps Stack

| Tool | Purpose |
|---|---|
| **Docker + Docker Compose** | Local dev, staging |
| **GitHub Actions** | CI/CD pipeline |
| **Kubernetes (k8s)** | Production orchestration (optional for MVP) |
| **Nginx** | Reverse proxy, SSL termination, WS upgrade |
| **Certbot** | Free TLS certificates (Let's Encrypt) |
| **AWS / GCP / Hetzner** | Cloud hosting |

**Minimum production server spec:** 4 vCPU, 8GB RAM, 100GB SSD (for a single-region deploy without k8s)

---

## 10. GATED API ACCESS — STEP-BY-STEP

### 10.1 QuickNode (Private RPC)

1. Go to `quicknode.com` → **Sign Up** (email or GitHub)
2. Dashboard → **Create an Endpoint**
3. Search **"0G"** → select **Mainnet** or **Testnet**
4. Choose **plan** (free = 10M credits/mo, ~limited req/s)
5. Optionally enable **"Trace"** and **"Archive"** add-ons
6. Click **Create** → copy HTTP and WSS URLs
7. Save to `.env`:
   ```
   RPC_URL=https://xxx.quiknode.pro/xxx/
   WS_RPC_URL=wss://xxx.quiknode.pro/xxx/
   ```
8. Rate limit: free tier ~15 req/s; Growth plan = 100 req/s

### 10.2 dRPC (Secondary RPC)

1. Go to `drpc.org` → click **"Get Started"**
2. Connect wallet (MetaMask/WalletConnect) or email
3. Dashboard → **"New Endpoint"** → Select **0G Mainnet**
4. Copy generated URL with API key embedded
5. Free tier: 100M daily credits

### 10.3 Binance Market Data (No Key Needed)

- No registration required for public market data
- For trading (if ever needed): `binance.com` → Register → API Management → Create Key → set IP whitelist

### 10.4 CoinGecko Pro (For Token Prices)

1. `coingecko.com` → **Sign Up**
2. Dashboard → **Developer Dashboard** → **Create New Key**
3. Free: 30 calls/min; Pro ($129/mo): 500 calls/min with historical OHLCV
4. Add header: `x-cg-pro-api-key: YOUR_KEY`

### 10.5 GeckoTerminal (On-chain pair data, free)

- No registration needed for basic tier
- Visit `geckoterminal.com` → API docs → use directly
- Pro: register at `geckoterminal.com/pro`

### 10.6 Ankr (Third RPC option)

1. `ankr.com` → **Sign Up**
2. **Web3 API** → Add Service → Select **0G**
3. Copy endpoint URL
4. Free: 30M req/mo; Premium (pay-per-use): $0.10 per 1M requests

### 10.7 Grafana Cloud (Observability)

1. `grafana.com` → **Sign Up Free**
2. Create **Stack** → get Prometheus remote-write URL + credentials
3. Configure `prometheus.yml` to remote-write to Grafana Cloud
4. Free tier: 10k metrics series, 14-day retention

---

## 11. WHAT DOES NOT EXIST ON 0G (CRITICAL GAPS)

This is the most important section. These gaps require either workarounds or custom builds.

### 11.1 Missing vs. Hyperliquid

| Feature | Hyperliquid | 0G | Gap Severity |
|---|---|---|---|
| Native CLOB perpetuals exchange | ✅ HyperCore (200k orders/s) | ❌ None | **CRITICAL — build from scratch** |
| Native oracle price feed | ✅ Validator-weighted index | ❌ None | **CRITICAL — use CEX feed** |
| Native USDC margin | ✅ USDC native on HyperEVM | ⚠️ Must deploy or bridge | High |
| Funding rate computation | ✅ Built into HyperCore | ❌ None | High — must mirror Binance |
| Liquidation engine | ✅ Built into HyperCore | ❌ None | High — must simulate |
| Sub-account system | ✅ Native | ❌ None | Medium — build in Postgres |
| Public L2 order book feed | ✅ WS stream | ❌ None | **CRITICAL — synthetic from Binance** |
| Cross-margin engine | ✅ Native | ❌ None | High — build in Redis |
| Vault system | ✅ Native | ❌ None | Medium — deploy ERC-4626 |
| Referral system | ✅ Native | ❌ None | Low — build in Postgres |
| Leaderboard | ✅ Native | ❌ None | Low — query Postgres |
| WebSocket API | ✅ `wss://api.hyperliquid.xyz/ws` | ❌ None | **CRITICAL — build custom WS server** |

### 11.2 Assumptions That Will Break

1. **"I can use Hyperliquid's price feed directly"** — You cannot in a decentralized, non-Hyperliquid context. You must source prices independently.

2. **"0G DEX liquidity is deep enough for VWAP slippage models"** — As of 2026, 0G has minimal native DEX TVL. All simulated fills must use Binance depth, not on-chain pools.

3. **"The Graph works on 0G"** — Not confirmed. Build a custom event indexer.

4. **"USDC exists on 0G natively"** — You must deploy a mock stablecoin for testnet, or bridge real USDC via a cross-chain bridge (check `bridge.0g.ai`).

5. **"Block confirmations are instant"** — 0G claims ~500ms block times. Budget for 1-2 block confirmation delays in on-chain settlement paths.

6. **"Chainlink feeds are available"** — Partnership confirmed but specific feed addresses and supported assets on 0G must be verified before relying on them.

### 11.3 What Must Be Built From Scratch

```
✅ Complete simulated matching engine (Redis-based)
✅ VWAP fill simulator against synthetic Binance depth
✅ Custom WebSocket server (HL-compatible protocol)
✅ Virtual position and PnL ledger
✅ Funding rate mirroring from Binance
✅ Event indexer for 0G chain
✅ Push price oracle contract (if Chainlink unavailable)
✅ Mock USDC/USDT ERC20 (testnet)
✅ SIWE authentication system
✅ API key management for bots
✅ REST API (HL-compatible endpoints)
```

---

## 12. FINAL CHECKLIST

### ✅ MUST-HAVE (System will not function without these)

**RPC & Chain:**
- [ ] 0G Mainnet RPC URL (private endpoint from QuickNode / dRPC / Ankr)
- [ ] 0G Mainnet WebSocket RPC URL (for event subscriptions)
- [ ] Chain ID 16661 configured in all tools
- [ ] Foundry or Hardhat configured with `--evm-version cancun`

**Market Data:**
- [ ] Binance WebSocket stream connected (`aggTrade`, `depth20@100ms`)
- [ ] Price cache in Redis (updated every tick)
- [ ] Fallback REST price polling (CoinGecko or Binance REST)
- [ ] Feed reconnection logic with exponential backoff

**Trading Engine:**
- [ ] In-memory order book (per asset, per side)
- [ ] Market order fill simulator (VWAP against Binance depth)
- [ ] Limit order queue with price-trigger matching
- [ ] Stop-loss and take-profit trigger logic
- [ ] Virtual position ledger in Redis (size, avgEntry, unrealizedPnl)
- [ ] Virtual balance ledger in Redis (per wallet)
- [ ] Realized PnL computation on close

**Backend Services:**
- [ ] Redis 7.x running and connected
- [ ] PostgreSQL 16 running with schema migrated
- [ ] REST API server (Fastify) with HL-compatible endpoints
- [ ] WebSocket server with HL-compatible subscription protocol
- [ ] SIWE authentication (nonce → sign → verify → JWT)

**Smart Contracts (on 0G):**
- [ ] PaperVault.sol deployed and verified on chainscan.0g.ai
- [ ] MockERC20 deployed on testnet
- [ ] Deployer wallet funded with OG (via faucet for testnet)
- [ ] Contract ABIs stored in backend

**Observability:**
- [ ] Structured logging (Pino)
- [ ] Prometheus metrics endpoint `/metrics`
- [ ] Price feed disconnect alert

---

### ⚡ RECOMMENDED (Production stability)

**RPC:**
- [ ] Secondary RPC provider configured as fallback
- [ ] RPC health check cron (every 30s, auto-failover)
- [ ] WebSocket RPC reconnection with `reconnecting-websocket`

**Data:**
- [ ] PostgreSQL with automated daily backups
- [ ] Redis persistence enabled (`appendonly yes` in redis.conf)
- [ ] Redis Streams as event bus (price ticks → matcher → fills)

**Auth:**
- [ ] API key system (hash-stored, permissions-scoped)
- [ ] Rate limiting per wallet per minute
- [ ] IP allowlisting for bot API keys

**Contracts:**
- [ ] PriceOracle.sol deployed (backup if Chainlink unavailable)
- [ ] Off-chain relayer pushing prices to oracle every 10s
- [ ] Event indexer running (custom ethers.js listener → Postgres)

**Ops:**
- [ ] Docker Compose with all services (server, Redis, Postgres, NATS)
- [ ] Nginx reverse proxy with SSL (Certbot)
- [ ] GitHub Actions CI: lint → test → Docker build → deploy
- [ ] Grafana dashboard for order volume, fill latency, WS connections

---

### 💡 NICE-TO-HAVE (Scale & features)

**Scale:**
- [ ] Kubernetes deployment (for horizontal scaling)
- [ ] Read replicas for PostgreSQL (for leaderboard / analytics queries)
- [ ] Redis Cluster (3 shards) for >1M active positions
- [ ] NATS JetStream replacing Redis Streams (better replay semantics)
- [ ] CDN (Cloudflare) in front of REST API

**Features:**
- [ ] Leaderboard endpoint (sort wallets by realized PnL)
- [ ] Sub-accounts (multiple paper portfolios per wallet)
- [ ] Backtesting endpoint (replay historical fills)
- [ ] Telegram bot notifications on fills
- [ ] Funding rate accrual (mirrored from Binance perpetual funding)
- [ ] Portfolio analytics (Sharpe, max drawdown, win rate)
- [ ] Paper trading "reset" with configurable starting balance
- [ ] Cross-margin vs. isolated margin toggle

**On-chain:**
- [ ] The Graph subgraph (when 0G support is confirmed)
- [ ] ERC-4626 vault for optional on-chain settlement
- [ ] Chainlink feed integration (when feeds go live on 0G)
- [ ] Multi-sig admin on vault contracts (Gnosis Safe)

---

## APPENDIX: Environment Variables Template

```env
# Chain
RPC_URL=https://xxx.quiknode.pro/xxx/
WS_RPC_URL=wss://xxx.quiknode.pro/xxx/
CHAIN_ID=16661
EXPLORER_API=https://chainscan.0g.ai/api

# Contracts
VAULT_ADDRESS=0x...
MOCK_USDC_ADDRESS=0x...
ORACLE_ADDRESS=0x...
DEPLOYER_PK=<never commit this>

# Market Data
BINANCE_WS_URL=wss://stream.binance.com:9443/ws
BINANCE_REST_URL=https://api.binance.com
COINGECKO_API_KEY=your_key_here

# Redis
REDIS_URL=redis://localhost:6379
REDIS_TLS=false

# Postgres
DATABASE_URL=postgresql://user:pass@localhost:5432/hypaper

# Auth
JWT_SECRET=your_random_256bit_secret
SIWE_DOMAIN=yourdomain.com

# Server
PORT=3000
WS_PORT=3000
LOG_LEVEL=info
NODE_ENV=production

# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
PAGERDUTY_KEY=...
```

---

## APPENDIX: Docker Compose (Minimal Production)

```yaml
version: '3.9'
services:
  server:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    depends_on: [redis, postgres]
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes: [redis-data:/data]
    ports: ["6379:6379"]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: hypaper
      POSTGRES_USER: hypaper
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes: [pg-data:/var/lib/postgresql/data]
    ports: ["5432:5432"]

  prometheus:
    image: prom/prometheus:latest
    volumes: ["./prometheus.yml:/etc/prometheus/prometheus.yml"]
    ports: ["9090:9090"]

  grafana:
    image: grafana/grafana:latest
    ports: ["3001:3000"]
    depends_on: [prometheus]

volumes:
  redis-data:
  pg-data:
```

---

*End of Checklist — Total items: 60+ infra components across 12 categories*  
*Estimated build time to MVP: 3-6 weeks for a 2-person team*  
*Estimated monthly infra cost (cloud): $50-150/mo for staging; $300-800/mo for production*
