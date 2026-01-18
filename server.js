const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '5f3cf0ff-f2f2-4457-99ff-ef65124bbd33';
const PORT = process.env.PORT || 3000;

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Solana Meme Tracker API - ONLINE', 
    version: '1.0.0',
    endpoints: {
      walletBalance: '/api/wallet-balance?walletAddress=YOUR_ADDRESS'
    }
  });
});

// Main API endpoint
app.get('/api/wallet-balance', async (req, res) => {
  const { walletAddress } = req.query;
  
  console.log('📡 Request for wallet:', walletAddress);
  
  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  try {
    const response = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'wallet-balance',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: walletAddress,
            page: 1,
            limit: 1000,
            displayOptions: {
              showFungible: true,
              showNativeBalance: false,
            },
          },
        }),
      }
    );

    const data = await response.json();
    
    if (data.error) {
      console.error('Helius error:', data.error);
      return res.status(400).json({ error: data.error.message });
    }

    // Get all tokens with balance
    const allTokens = data.result.items
      .filter(item => item.token_info && item.token_info.balance > 0)
      .map(item => ({
        tokenAddress: item.id,
        tokenAmount: {
          uiAmount: item.token_info.balance / Math.pow(10, item.token_info.decimals || 0),
          decimals: item.token_info.decimals || 0,
        },
      }))
      .filter(token => token.tokenAmount.uiAmount > 0);

    console.log(`Found ${allTokens.length} tokens with positive balance`);

    // Sort tokens by balance (largest first) to prioritize checking valuable tokens
    allTokens.sort((a, b) => b.tokenAmount.uiAmount - a.tokenAmount.uiAmount);

    // Fetch prices from DexScreener in small batches
    // Stop early once we have enough tokens worth $10+
    const allPrices = {};
    const batchSize = 20; // Smaller batches
    let tokensFound = 0;
    const targetTokens = 50; // Stop after finding 50 valuable tokens
    
    console.log('Fetching prices from DexScreener (smart batching)...');
    
    for (let i = 0; i < allTokens.length && tokensFound < targetTokens; i += batchSize) {
      const batch = allTokens.slice(i, i + batchSize);
      const addresses = batch.map(t => t.tokenAddress).join(',');
      
      try {
        // Small delay to avoid rate limits
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        const response = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${addresses}`
        );
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.pairs && Array.isArray(data.pairs)) {
            // Group pairs by token address
            data.pairs.forEach(pair => {
              const addr = pair.baseToken?.address?.toLowerCase();
              if (addr && pair.priceUsd) {
                allPrices[addr] = {
                  price: parseFloat(pair.priceUsd),
                  change24h: pair.priceChange?.h24 || 0,
                  name: pair.baseToken.name,
                  symbol: pair.baseToken.symbol,
                  icon: pair.info?.imageUrl
                };
              }
            });
            
            // Count how many valuable tokens we found in this batch
            batch.forEach(token => {
              const price = allPrices[token.tokenAddress.toLowerCase()];
              if (price && (token.tokenAmount.uiAmount * price.price) >= 10) {
                tokensFound++;
              }
            });
            
            console.log(`Batch ${Math.floor(i/batchSize) + 1}: Got ${data.pairs.length} pairs, ${tokensFound} valuable tokens found so far`);
