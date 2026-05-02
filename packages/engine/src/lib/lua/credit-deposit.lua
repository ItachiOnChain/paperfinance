-- credit-deposit.lua
-- Atomic: credit balance + record deposit event
--
-- KEYS[1] = account:{uid}:balance
-- KEYS[2] = account:{uid}:deposits (stream)
-- ARGV[1] = amount (USDC string, e.g. "100.00")
-- ARGV[2] = txHash
-- ARGV[3] = block number
-- ARGV[4] = timestamp

local balKey = KEYS[1]
local streamKey = KEYS[2]
local amount = ARGV[1]
local txHash = ARGV[2]
local blockNum = ARGV[3]
local ts = ARGV[4]

-- Credit balance (create if doesn't exist)
local newBal = redis.call('INCRBYFLOAT', balKey, amount)

-- Record deposit in stream
redis.call('XADD', streamKey, '*',
    'type', 'deposit',
    'amount', amount,
    'txHash', txHash,
    'block', blockNum,
    'newBalance', tostring(newBal),
    'timestamp', ts
)

return newBal
