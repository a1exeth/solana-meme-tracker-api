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

    // Fetch prices from DexScreener for ALL tokens (in chunks of 30)
    const tokenAddresses = allTokens.map(t => t.tokenAddress);
    const chunks = [];
    for (let i = 0; i < tokenAddresses.length; i += 30) {
      chunks.push(tokenAddresses.slice(i, i + 30));
    }

    const allPrices = [];
    for (const chunk of chunks) {
      try {
        const priceResponse = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/solana/${chunk.join(',')}`
        );
        
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          if (priceData.pairs && Array.isArray(priceData.pairs)) {
            allPrices.push(...priceData.pairs);
          }
        }
      } catch (err) {
        console.error('Error fetching prices:', err);
      }
    }

    console.log(`Got ${allPrices.length} price pairs from DexScreener`);

    // Calculate USD values and sort by value
    const tokensWithValue = allTokens.map(token => {
      const pair = allPrices.find(p => 
        p.baseToken.address.toLowerCase() === token.tokenAddress.toLowerCase()
      );
      
      if (!pair) {
        return { ...token, usdValue: 0 };
      }

      const price = parseFloat(pair.priceUsd || 0);
      const usdValue = token.tokenAmount.uiAmount * price;
      
      return { ...token, usdValue };
    }).sort((a, b) => b.usdValue - a.usdValue); // Sort by USD value descending

    // Return top 100 by value
    const topTokens = tokensWithValue.slice(0, 100).map(({ usdValue, ...token }) => token);

    console.log(`✅ Returning top ${topTokens.length} tokens sorted by USD value`);
    res.json({ tokens: topTokens });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
