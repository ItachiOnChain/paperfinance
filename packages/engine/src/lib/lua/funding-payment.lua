--[[
  funding-payment.lua — Atomic funding rate settlement.

  Atomically:
    1. Debit/credit funding payment from account balance
    2. Append payment record to account:{uid}:funding stream

  KEYS:
    1 = account:{uid}:balance
    2 = account:{uid}:funding

  ARGV:
    1  = uid
    2  = symbol
    3  = payment       (decimal string, positive = pay, negative = receive)
    4  = fundingRate   (decimal string)
    5  = notional      (decimal string)
    6  = timestamp     (ms)
]]

local balanceKey  = KEYS[1]
local fundingKey  = KEYS[2]

local uid         = ARGV[1]
local symbol      = ARGV[2]
local payment     = ARGV[3]
local fundingRate = ARGV[4]
local notional    = ARGV[5]
local timestamp   = ARGV[6]

-- 1. Debit payment from balance (negative payment = credit)
redis.call('INCRBYFLOAT', balanceKey, tostring(-tonumber(payment)))

-- 2. Record funding event
redis.call('XADD', fundingKey, '*',
  'uid',          uid,
  'symbol',       symbol,
  'payment',      payment,
  'fundingRate',  fundingRate,
  'notional',     notional,
  'timestamp',    timestamp
)

return 1
