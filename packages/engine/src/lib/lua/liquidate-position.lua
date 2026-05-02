--[[
  liquidate-position.lua — Atomic liquidation execution.

  Atomically:
    1. Close position (DEL position hash)
    2. Debit finalPnl from account balance
    3. Emit liquidation fill event to Redis Stream
    4. Clean up open orders for this symbol (remove from ZSET)

  KEYS:
    1 = account:{uid}:balance
    2 = account:{uid}:positions:{symbol}
    3 = orders:{uid}:open
    4 = fills:{uid}

  ARGV:
    1  = uid
    2  = symbol
    3  = side              ('long' | 'short')
    4  = size              (absolute position size)
    5  = liquidationPrice  (decimal string)
    6  = finalPnl          (decimal string, negative = loss)
    7  = fee               (decimal string)
    8  = fillJson          (JSON blob for the stream)
    9  = timestamp         (ms)
]]

local balanceKey   = KEYS[1]
local positionKey  = KEYS[2]
local openKey      = KEYS[3]
local fillsKey     = KEYS[4]

local uid           = ARGV[1]
local symbol        = ARGV[2]
local side          = ARGV[3]
local size          = ARGV[4]
local liqPrice      = ARGV[5]
local finalPnl      = ARGV[6]
local fee           = ARGV[7]
local fillJson      = ARGV[8]
local timestamp     = ARGV[9]

-- 1. Debit finalPnl from balance (finalPnl is negative for a loss)
redis.call('INCRBYFLOAT', balanceKey, tostring(finalPnl))

-- 2. Close position (delete the hash entirely)
redis.call('DEL', positionKey)

-- 3. Remove all open orders for this user (liquidation closes everything)
-- We can't filter by symbol in ZSET, so we just clear the whole set
-- The matching engine will re-create as needed
local openOrders = redis.call('ZRANGE', openKey, 0, -1)
for _, orderId in ipairs(openOrders) do
  -- Check if order is for this symbol
  local orderData = redis.call('GET', 'order:' .. orderId)
  if orderData then
    -- Simple string match for symbol in the JSON
    if string.find(orderData, '"symbol":"' .. symbol .. '"') then
      redis.call('ZREM', openKey, orderId)
      -- Mark order as liquidated
      local updated = string.gsub(orderData, '"status":"open"', '"status":"liquidated"')
      redis.call('SET', 'order:' .. orderId, updated)
    end
  end
end

-- 4. Publish liquidation fill event to Redis Stream
redis.call('XADD', fillsKey, '*',
  'type',           'liquidation',
  'uid',            uid,
  'symbol',         symbol,
  'side',           side,
  'size',           size,
  'liquidationPrice', liqPrice,
  'finalPnl',       tostring(finalPnl),
  'fee',            fee,
  'timestamp',      timestamp,
  'data',           fillJson
)

return 1
