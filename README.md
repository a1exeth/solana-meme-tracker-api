# Solana Meme Tracker API

Backend API for the Solana Meme Tracker - connects to Helius RPC to fetch wallet token balances.

## 🚀 One-Click Deploy

Click the button below to deploy to Render.com (free):

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## Environment Variables

After deploying, add this environment variable:
- `HELIUS_API_KEY` = `5f3cf0ff-f2f2-4457-99ff-ef65124bbd33`

## API Endpoints

- `GET /` - Health check
- `GET /api/wallet-balance?walletAddress=YOUR_WALLET` - Fetch wallet token balances

## Local Development

```bash
npm install
npm start
```

Server runs on http://localhost:3000
