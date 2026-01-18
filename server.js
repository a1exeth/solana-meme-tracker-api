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

    const tokens = data.result.items
      .filter(item => item.token_info && item.token_info.balance > 0)
      .map(item => ({
        tokenAddress: item.id,
        tokenAmount: {
          uiAmount: item.token_info.balance / Math.pow(10, item.token_info.decimals || 0),
          decimals: item.token_info.decimals || 0,
        },
      }))
      .filter(token => token.tokenAmount.uiAmount > 0); // Double check uiAmount is positive

    console.log(`✅ Returning ${tokens.length} tokens with positive balance`);
    res.json({ tokens });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
