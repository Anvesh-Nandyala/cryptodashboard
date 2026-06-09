import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORTFOLIO_FILE = path.join(__dirname, 'portfolio.json');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-memory cache for CoinCap API
const cache = new Map();
const CACHE_DURATION_MS = 15 * 1000; // 15 seconds market data cache

function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiryTime) {
    return cached.data;
  }
  return null;
}

function setCachedData(key, data, duration = CACHE_DURATION_MS) {
  cache.set(key, {
    data,
    expiryTime: Date.now() + duration
  });
}

// --- MOCK FALLBACK DATA GENERATOR ---
const MOCK_ASSETS_PRESETS = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', priceUsd: '67450.25', changePercent24Hr: '2.45', marketCapUsd: '1328402910405', volumeUsd24Hr: '28402910405', supply: '19702345' },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', priceUsd: '3520.80', changePercent24Hr: '1.85', marketCapUsd: '422910405830', volumeUsd24Hr: '14910405830', supply: '120234850' },
  { id: 'tether', name: 'Tether', symbol: 'USDT', priceUsd: '1.00', changePercent24Hr: '0.02', marketCapUsd: '112402910405', volumeUsd24Hr: '45402910405', supply: '112402910' },
  { id: 'binance-coin', name: 'BNB', symbol: 'BNB', priceUsd: '585.40', changePercent24Hr: '-0.35', marketCapUsd: '86402910405', volumeUsd24Hr: '1202910405', supply: '147583920' },
  { id: 'solana', name: 'Solana', symbol: 'SOL', priceUsd: '144.75', changePercent24Hr: '-1.25', marketCapUsd: '66402910405', volumeUsd24Hr: '3402910405', supply: '461234850' },
  { id: 'ripple', name: 'Ripple', symbol: 'XRP', priceUsd: '0.485', changePercent24Hr: '-0.85', marketCapUsd: '26910405830', volumeUsd24Hr: '910405830', supply: '55402910405' },
  { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', priceUsd: '0.138', changePercent24Hr: '4.85', marketCapUsd: '20291040583', volumeUsd24Hr: '1910405830', supply: '144583920405' },
  { id: 'cardano', name: 'Cardano', symbol: 'ADA', priceUsd: '0.442', changePercent24Hr: '0.12', marketCapUsd: '15910405830', volumeUsd24Hr: '291040580', supply: '35683920405' },
  { id: 'shiba-inu', name: 'Shiba Inu', symbol: 'SHIB', priceUsd: '0.0000215', changePercent24Hr: '3.15', marketCapUsd: '12910405830', volumeUsd24Hr: '810405830', supply: '589273648501234' },
  { id: 'avalanche', name: 'Avalanche', symbol: 'AVAX', priceUsd: '33.50', changePercent24Hr: '-2.15', marketCapUsd: '13123485012', volumeUsd24Hr: '402910405', supply: '392348501' },
  { id: 'chainlink', name: 'Chainlink', symbol: 'LINK', priceUsd: '15.20', changePercent24Hr: '1.45', marketCapUsd: '9123485012', volumeUsd24Hr: '282910405', supply: '587000000' },
  { id: 'polkadot', name: 'Polkadot', symbol: 'DOT', priceUsd: '6.15', changePercent24Hr: '-1.05', marketCapUsd: '8910405830', volumeUsd24Hr: '191040580', supply: '1423920405' },
  { id: 'near-protocol', name: 'NEAR Protocol', symbol: 'NEAR', priceUsd: '5.85', changePercent24Hr: '2.65', marketCapUsd: '6312348501', volumeUsd24Hr: '310405830', supply: '1078501234' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC', priceUsd: '0.625', changePercent24Hr: '-0.75', marketCapUsd: '6234850123', volumeUsd24Hr: '210405830', supply: '9902348501' },
  { id: 'uniswap', name: 'Uniswap', symbol: 'UNI', priceUsd: '7.85', changePercent24Hr: '-1.95', marketCapUsd: '4712348501', volumeUsd24Hr: '180405830', supply: '599850123' },
  { id: 'pepe', name: 'Pepe', symbol: 'PEPE', priceUsd: '0.0000124', changePercent24Hr: '8.45', marketCapUsd: '5234850123', volumeUsd24Hr: '980405830', supply: '420690000000000' },
  { id: 'litecoin', name: 'Litecoin', symbol: 'LTC', priceUsd: '78.50', changePercent24Hr: '0.45', marketCapUsd: '5850123485', volumeUsd24Hr: '380405830', supply: '74700000' },
  { id: 'ethereum-classic', name: 'Ethereum Classic', symbol: 'ETC', priceUsd: '23.80', changePercent24Hr: '-0.25', marketCapUsd: '3501234850', volumeUsd24Hr: '150405830', supply: '147000000' },
  { id: 'stellar', name: 'Stellar', symbol: 'XLM', priceUsd: '0.098', changePercent24Hr: '-0.45', marketCapUsd: '2850123485', volumeUsd24Hr: '68405830', supply: '29000000000' },
  { id: 'render-token', name: 'Render', symbol: 'RNDR', priceUsd: '7.65', changePercent24Hr: '1.95', marketCapUsd: '2985012348', volumeUsd24Hr: '148405830', supply: '388640291' }
];

// In a real environment with price updates, we can drift prices slightly for a live feel
function getDriftedMockAssets() {
  return MOCK_ASSETS_PRESETS.map(asset => {
    const originalPrice = parseFloat(asset.priceUsd);
    // Apply a small random drift (-0.1% to +0.1%)
    const drift = 1 + (Math.random() * 0.002 - 0.001);
    const newPrice = originalPrice * drift;
    
    // Smooth the change index
    const changeDir = Math.random() > 0.48 ? 1 : -1;
    const newChange = parseFloat(asset.changePercent24Hr) + (Math.random() * 0.1 - 0.05) * changeDir;

    return {
      ...asset,
      priceUsd: newPrice.toFixed(newPrice > 1 ? 2 : 7),
      changePercent24Hr: newChange.toFixed(2)
    };
  });
}

function getMockHistoryData(assetId, limit, range) {
  const asset = MOCK_ASSETS_PRESETS.find(a => a.id === assetId) || MOCK_ASSETS_PRESETS[0];
  const startPrice = parseFloat(asset.priceUsd);
  const points = [];
  
  const now = Date.now();
  let timeStep = 3600 * 1000; // 1 hour for 7d
  if (range === '1d') timeStep = 15 * 60 * 1000; // 15 mins for 1d
  if (range === '30d') timeStep = 24 * 3600 * 1000; // 1 day for 30d

  let currentPrice = startPrice;
  const changePercent = parseFloat(asset.changePercent24Hr) / 100;
  
  // Backwards random walk to generate historical data points
  for (let i = limit - 1; i >= 0; i--) {
    const timestamp = now - i * timeStep;
    
    // Apply random walk step
    const change = 1 + (Math.random() * 0.04 - 0.019) + (changePercent / limit);
    currentPrice = currentPrice / change;

    points.push({
      priceUsd: currentPrice.toFixed(startPrice > 1 ? 2 : 7),
      time: timestamp,
      date: new Date(timestamp).toISOString()
    });
  }

  // Ensure chronologically ascending order
  return points;
}

// 1. Assets list (Top 20) with Mock Fallback
app.get('/api/assets', async (req, res) => {
  const cacheKey = 'assets_list';
  const cached = getCachedData(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const response = await fetch('https://api.coincap.io/v2/assets?limit=20');
    if (!response.ok) {
      throw new Error(`CoinCap API returned status ${response.status}`);
    }
    const data = await response.json();
    setCachedData(cacheKey, data.data);
    res.json(data.data);
  } catch (error) {
    console.warn('CoinCap fetch failed. Serving procedural mock data fallback.');
    // Generate realistic, moving mock data
    const mockData = getDriftedMockAssets();
    setCachedData(cacheKey, mockData);
    res.json(mockData);
  }
});

// 2. Asset Historical Data with Mock Fallback
app.get('/api/assets/:id/history', async (req, res) => {
  const { id } = req.params;
  const range = req.query.range || '7d';

  let interval = 'h6';
  let limit = 28;

  if (range === '1d') {
    interval = 'm15';
    limit = 96;
  } else if (range === '30d') {
    interval = 'd1';
    limit = 30;
  }

  const cacheKey = `history:${id}:${range}`;
  const cached = getCachedData(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0`; // Dummy fetch to test connection
    const checkConnection = await fetch(url).catch(() => null);
    if (!checkConnection || !checkConnection.ok) {
      throw new Error('No internet connection');
    }

    const coincapUrl = `https://api.coincap.io/v2/assets/${id}/history?interval=${interval}`;
    const response = await fetch(coincapUrl);
    if (!response.ok) {
      throw new Error(`CoinCap History API returned status ${response.status}`);
    }
    const data = await response.json();
    const points = data.data.slice(-limit);
    setCachedData(cacheKey, points, 60 * 1000);
    res.json(points);
  } catch (error) {
    console.warn(`CoinCap History fetch failed for ${id}. Serving mock history walk.`);
    const mockHistory = getMockHistoryData(id, limit, range);
    setCachedData(cacheKey, mockHistory, 60 * 1000);
    res.json(mockHistory);
  }
});

// --- PORTFOLIO SYSTEM ---
function readPortfolio() {
  try {
    if (fs.existsSync(PORTFOLIO_FILE)) {
      const data = fs.readFileSync(PORTFOLIO_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to read portfolio transactions:', error);
  }
  return [];
}

function savePortfolio(portfolio) {
  try {
    fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(portfolio, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save portfolio transactions:', error);
  }
}

app.get('/api/portfolio', (req, res) => {
  const portfolio = readPortfolio();
  res.json(portfolio);
});

app.post('/api/portfolio', (req, res) => {
  const { assetId, symbol, name, type, amount, price } = req.body;
  
  if (!assetId || !symbol || !name || !type || amount === undefined || price === undefined) {
    return res.status(400).json({ error: 'All transaction parameters are required' });
  }

  const transactionAmount = parseFloat(amount);
  const transactionPrice = parseFloat(price);

  if (transactionAmount <= 0 || transactionPrice <= 0) {
    return res.status(400).json({ error: 'Amount and price must be greater than zero' });
  }

  const portfolio = readPortfolio();
  const newTransaction = {
    id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    assetId,
    symbol,
    name,
    type,
    amount: transactionAmount,
    price: transactionPrice,
    timestamp: new Date().toISOString()
  };

  portfolio.push(newTransaction);
  savePortfolio(portfolio);

  res.status(201).json(newTransaction);
});

app.post('/api/portfolio/reset', (req, res) => {
  savePortfolio([]);
  res.json({ success: true, message: 'Portfolio history cleared' });
});

app.listen(PORT, () => {
  console.log(`Crypto Dashboard server running on port ${PORT}`);
});
