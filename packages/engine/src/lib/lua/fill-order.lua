--[[
  fill-order.lua — Atomic fill execution.

  Atomically updates in one Redis round-trip:
    1. Order status  → 'filled'
    2. Position size  → new signed size
    3. Position entry  → new weighted-average entry
    4. Account balance → credit PnL, debit fee
    5. Push fill JSON  → fills:{uid} stream (XADD)
    6. Move order      → from orders:{uid}:open to orders:{uid}:history

  KEYS:
    1 = account:{uid}:balance
    2 = account:{uid}:positions:{symbol}
    3 = orders:{uid}:open
    4 = orders:{uid}:history
    5 = fills:{uid}

  ARGV:
    1  = orderId          (UUID v7)
    2  = fillPrice        (decimal string)
    3  = fillSize          (decimal string, always positive)
    4  = side              ('buy' | 'sell')
    5  = fee               (decimal string)
    6  = realizedPnl       (decimal string, signed)
    7  = newPositionSize   (decimal string, signed)
    8  = newEntryPrice     (decimal string)
    9  = fillJson          (JSON blob for the stream)
    10 = orderScore        (score to remove from ZSET)
    11 = timestamp         (ms)
]]

local balanceKey   = KEYS[1]
local positionKey  = KEYS[2]
local openKey      = KEYS[3]
local historyKey   = KEYS[4]
local fillsKey     = KEYS[5]

local orderId      = ARGV[1]
local fillPrice    = ARGV[2]
local fillSize     = ARGV[3]
local side         = ARGV[4]
local fee          = ARGV[5]
local realizedPnl  = ARGV[6]
local newPosSize   = ARGV[7]
local newEntryPx   = ARGV[8]
local fillJson     = ARGV[9]
local orderScore   = ARGV[10]
local timestamp    = ARGV[11]

-- 1. Update account balance: +realizedPnl −fee
local balanceAdj = tonumber(realizedPnl) - tonumber(fee)
redis.call('INCRBYFLOAT', balanceKey, tostring(balanceAdj))

-- 2. Update position
if tonumber(newPosSize) == 0 then
  -- Position fully closed
  redis.call('DEL', positionKey)
else
  redis.call('HSET', positionKey,
    'size',       newPosSize,
    'entryPrice', newEntryPx,
    'realizedPnl', tostring(tonumber(redis.call('HGET', positionKey, 'realizedPnl') or '0') + tonumber(realizedPnl)),
    'updatedAt',  timestamp
  )
end

-- 3. Remove order from open ZSET
redis.call('ZREM', openKey, orderId)

-- 4. Add order to history (scored by timestamp for chronological query)
redis.call('ZADD', historyKey, timestamp, orderId)

-- 5. Publish fill to Redis Stream
redis.call('XADD', fillsKey, '*',
  'orderId',      orderId,
  'fillPrice',    fillPrice,
  'fillSize',     fillSize,
  'side',         side,
  'fee',          fee,
  'realizedPnl',  realizedPnl,
  'posAfter',     newPosSize,
  'timestamp',    timestamp,
  'data',         fillJson
)

return 1
