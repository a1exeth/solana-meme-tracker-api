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
    status: 'Solana Meme Tracker API - ONLI
