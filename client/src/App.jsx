import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Wallet, DollarSign, Plus, X, BarChart3, 
  Settings, Bell, AlertTriangle, Compass, History, RefreshCw, Layers, Sparkles 
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import './App.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function App() {
  // Markets state
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Details & Chart state
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [chartRange, setChartRange] = useState('7d'); // '1d' | '7d' | '30d'
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Portfolio state
  const [portfolio, setPortfolio] = useState([]);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [txAssetId, setTxAssetId] = useState('');
  const [txType, setTxType] = useState('buy'); // 'buy' | 'sell'
  const [txAmount, setTxAmount] = useState('');
  const [txPrice, setTxPrice] = useState('');

  // Alerts state
  const [alerts, setAlerts] = useState([]);
  const [alertAssetId, setAlertAssetId] = useState('');
  const [alertType, setAlertType] = useState('above'); // 'above' | 'below'
  const [alertValue, setAlertValue] = useState('');
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);

  // Fetch Market Data (with 15s interval poll)
  const fetchAssets = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/assets');
      if (!response.ok) throw new Error('Failed to fetch market data');
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setAssets(data);
        if (!selectedAsset && data.length > 0) {
          setSelectedAsset(data[0]); // default to Bitcoin
        }
        setError(null);
      } else {
        throw new Error('Invalid ticker API response format');
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Portfolio transactions
  const fetchPortfolio = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/portfolio');
      if (response.ok) {
        const data = await response.json();
        setPortfolio(data);
      }
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
    }
  };

  // Initialize
  useEffect(() => {
    fetchAssets();
    fetchPortfolio();

    const interval = setInterval(fetchAssets, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  // Fetch historical data for chart when selection or range changes
  useEffect(() => {
    if (!selectedAsset) return;

    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const response = await fetch(`http://localhost:3001/api/assets/${selectedAsset.id}/history?range=${chartRange}`);
        if (response.ok) {
          const data = await response.json();
          setHistoryData(data);
        }
      } catch (err) {
        console.error('Failed to fetch history:', err);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [selectedAsset, chartRange]);

  // Monitor price alerts
  useEffect(() => {
    if (assets.length === 0 || alerts.length === 0) return;

    alerts.forEach((alert) => {
      const asset = assets.find((a) => a.id === alert.assetId);
      if (!asset) return;

      const currentPrice = parseFloat(asset.priceUsd);
      const targetPrice = parseFloat(alert.value);

      const isTriggered = 
        (alert.type === 'above' && currentPrice >= targetPrice) ||
        (alert.type === 'below' && currentPrice <= targetPrice);

      if (isTriggered && !triggeredAlerts.some((ta) => ta.id === alert.id)) {
        // Alert triggered
        const alertMsg = {
          id: alert.id,
          text: `🚨 ALERT: ${asset.name} (${asset.symbol}) is now ${alert.type} $${targetPrice.toLocaleString()}! Current: $${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        };
        setTriggeredAlerts((prev) => [alertMsg, ...prev]);

        // Remove from active alerts list
        setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      }
    });
  }, [assets, alerts]);

  // Add mock transaction
  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!txAssetId || !txAmount || !txPrice) return;

    const asset = assets.find((a) => a.id === txAssetId);
    if (!asset) return;

    try {
      const response = await fetch('http://localhost:3001/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: txAssetId,
          symbol: asset.symbol,
          name: asset.name,
          type: txType,
          amount: txAmount,
          price: txPrice
        })
      });

      if (response.ok) {
        fetchPortfolio();
        setIsAddTxOpen(false);
        setTxAmount('');
        setTxPrice('');
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to record transaction');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Clear portfolio
  const handleResetPortfolio = async () => {
    if (!window.confirm('Are you sure you want to clear your portfolio transaction history?')) return;
    try {
      const response = await fetch('http://localhost:3001/api/portfolio/reset', { method: 'POST' });
      if (response.ok) {
        fetchPortfolio();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Price Alert
  const handleAddAlert = (e) => {
    e.preventDefault();
    if (!alertAssetId || !alertValue) return;

    const asset = assets.find((a) => a.id === alertAssetId);
    if (!asset) return;

    const newAlert = {
      id: `alert-${Date.now()}`,
      assetId: alertAssetId,
      symbol: asset.symbol,
      name: asset.name,
      type: alertType,
      value: parseFloat(alertValue)
    };

    setAlerts((prev) => [...prev, newAlert]);
    setAlertValue('');
  };

  // Remove Alert
  const handleRemoveAlert = (id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  // Clear triggered alert notification
  const handleDismissAlert = (id) => {
    setTriggeredAlerts((prev) => prev.filter((ta) => ta.id !== id));
  };

  // Calculate Portfolio Value & Holdings
  const getPortfolioCalculations = () => {
    const holdings = {}; // assetId -> { symbol, name, totalAmount, netSpent }

    portfolio.forEach((tx) => {
      if (!holdings[tx.assetId]) {
        holdings[tx.assetId] = {
          symbol: tx.symbol,
          name: tx.name,
          totalAmount: 0,
          netSpent: 0
        };
      }

      const h = holdings[tx.assetId];
      if (tx.type === 'buy') {
        h.totalAmount += tx.amount;
        h.netSpent += tx.amount * tx.price;
      } else {
        h.totalAmount -= tx.amount;
        h.netSpent -= tx.amount * tx.price;
      }
    });

    let totalValueUsd = 0;
    let totalSpentUsd = 0;
    const items = [];

    Object.keys(holdings).forEach((id) => {
      const h = holdings[id];
      if (h.totalAmount <= 0) return; // ignore completely sold assets

      const currentAsset = assets.find((a) => a.id === id);
      const currentPrice = currentAsset ? parseFloat(currentAsset.priceUsd) : 0;
      const currentValue = h.totalAmount * currentPrice;

      totalValueUsd += currentValue;
      totalSpentUsd += h.netSpent;

      items.push({
        id,
        symbol: h.symbol,
        name: h.name,
        amount: h.totalAmount,
        avgPrice: h.totalAmount > 0 ? h.netSpent / h.totalAmount : 0,
        currentPrice,
        currentValue,
        profit: currentValue - h.netSpent
      });
    });

    const netProfit = totalValueUsd - totalSpentUsd;
    const profitPercentage = totalSpentUsd > 0 ? (netProfit / totalSpentUsd) * 100 : 0;

    return {
      totalValueUsd,
      totalSpentUsd,
      netProfit,
      profitPercentage,
      holdingsList: items
    };
  };

  const portfolioCalcs = getPortfolioCalculations();

  // Dynamic Fear & Greed Index calculation based on top coin changes
  const getFearGreedIndex = () => {
    if (assets.length === 0) return 50;

    // Average 24h percentage change of top 10 assets
    const top10 = assets.slice(0, 10);
    const avgChange = top10.reduce((acc, curr) => acc + parseFloat(curr.changePercent24Hr), 0) / top10.length;

    // Maps change from -10% -> +10% to index 10 -> 90
    let index = 50 + avgChange * 4;
    return Math.max(10, Math.min(90, Math.round(index)));
  };

  const fearGreedIndex = getFearGreedIndex();

  // Prepare chart details
  const getChartConfig = () => {
    if (historyData.length === 0) return { labels: [], datasets: [] };

    const labels = historyData.map((pt) => {
      const date = new Date(pt.time);
      if (chartRange === '1d') {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    });

    const prices = historyData.map((pt) => parseFloat(pt.priceUsd));
    const isGain = prices[prices.length - 1] >= prices[0];

    const strokeColor = isGain ? '#10b981' : '#f43f5e';
    const gradientColorStart = isGain ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)';

    return {
      labels,
      datasets: [
        {
          fill: true,
          label: `${selectedAsset?.name} Price (USD)`,
          data: prices,
          borderColor: strokeColor,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: strokeColor,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          backgroundColor: gradientColorStart,
          tension: 0.15
        }
      ]
    };
  };

  const chartData = getChartConfig();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        padding: 10,
        titleFont: { family: 'Plus Jakarta Sans', weight: 'bold' },
        bodyFont: { family: 'Plus Jakarta Sans' },
        callbacks: {
          label: (context) => `$${context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#6b7280',
          font: { family: 'Plus Jakarta Sans', size: 10 }
        }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: {
          color: '#6b7280',
          font: { family: 'Plus Jakarta Sans', size: 10 },
          callback: (value) => `$${value.toLocaleString()}`
        }
      }
    }
  };

  return (
    <div className="relative min-h-screen w-full px-4 md:px-8 py-6 pb-12 z-10 text-gray-200 bg-[#060913]">
      {/* Background Animated Blobs */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[140px] opacity-[0.15] mix-blend-screen bg-[radial-gradient(circle,_rgba(99,102,241,0.25)_0%,_transparent_70%)] -top-[10%] right-[5%] animate-pulse-glow"></div>
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[140px] opacity-[0.15] mix-blend-screen bg-[radial-gradient(circle,_rgba(16,185,129,0.15)_0%,_transparent_70%)] -bottom-[10%] left-[5%] animate-pulse-glow [animation-delay:2s]"></div>
      </div>

      {/* Nav */}
      <header className="relative flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 z-10 border-b border-white/5 pb-5">
        <div className="flex items-center gap-2.5">
          <Sparkles className="text-indigo-400 filter drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]" size={32} />
          <h1 className="font-sans text-2xl font-black tracking-tight bg-gradient-to-r from-white via-white to-indigo-400 bg-clip-text text-transparent">
            Crypto Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAddTxOpen(true)}
            className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer flex items-center gap-1.5 hover:scale-[1.01] transition-all shadow-md shadow-indigo-500/20"
          >
            <Plus size={14} />
            Record Trade
          </button>
          <button 
            onClick={fetchAssets}
            className="flex items-center justify-center p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-gray-400 cursor-pointer hover:bg-white/[0.08] hover:text-gray-100 transition-all duration-300"
            title="Refresh feeds"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {/* Triggered Alerts overlay */}
      {triggeredAlerts.length > 0 && (
        <div className="relative z-50 flex flex-col gap-2 mb-6">
          {triggeredAlerts.map((ta) => (
            <div 
              key={ta.id}
              className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs animate-fade-in"
            >
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-indigo-400 shrink-0" />
                <span>{ta.text}</span>
              </div>
              <button 
                onClick={() => handleDismissAlert(ta.id)}
                className="bg-transparent border-none text-indigo-400 hover:text-indigo-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full">
          <div className="w-12 h-12 border-4 border-white/5 border-t-indigo-400 rounded-full animate-spin mb-4"></div>
          <div className="text-sm font-semibold text-gray-500">Querying CoinCap assets ticker registry...</div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full text-center bg-slate-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-xl">
          <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
          <h2 className="text-lg font-bold mb-1 text-gray-200">Ticker Feeds Offline</h2>
          <p className="text-xs text-gray-500 max-w-[400px] mb-5">{error}. Please ensure Express API server is active.</p>
          <button className="bg-indigo-500 text-white border-none font-bold px-6 py-2.5 rounded-xl text-xs cursor-pointer hover:scale-[1.01] transition-all" onClick={fetchAssets}>
            Retry Handshake
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5 relative z-10">
          
          {/* Main Portfolio Overview Panel */}
          <div className="col-span-12 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/45 border border-white/5 rounded-2xl p-5 backdrop-blur-xl flex flex-col justify-between hover:border-white/10 transition-all">
              <span className="text-[10px] text-gray-500 uppercase font-semibold flex items-center gap-1.5">
                <Wallet size={12} className="text-indigo-400" />
                Portfolio Value
              </span>
              <span className="text-2xl font-black font-sans text-gray-100 mt-2">
                ${portfolioCalcs.totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-slate-900/45 border border-white/5 rounded-2xl p-5 backdrop-blur-xl flex flex-col justify-between hover:border-white/10 transition-all">
              <span className="text-[10px] text-gray-500 uppercase font-semibold flex items-center gap-1.5">
                <DollarSign size={12} className="text-indigo-400" />
                Net Invested
              </span>
              <span className="text-2xl font-black font-sans text-gray-100 mt-2">
                ${portfolioCalcs.totalSpentUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-slate-900/45 border border-white/5 rounded-2xl p-5 backdrop-blur-xl flex flex-col justify-between hover:border-white/10 transition-all">
              <span className="text-[10px] text-gray-500 uppercase font-semibold flex items-center gap-1.5">
                {portfolioCalcs.netProfit >= 0 ? <TrendingUp size={12} className="text-emerald-400" /> : <TrendingDown size={12} className="text-rose-500" />}
                Total Profit/Loss
              </span>
              <span className={`text-2xl font-black font-sans mt-2 ${portfolioCalcs.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                {portfolioCalcs.netProfit >= 0 ? '+' : ''}${portfolioCalcs.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-slate-900/45 border border-white/5 rounded-2xl p-5 backdrop-blur-xl flex flex-col justify-between hover:border-white/10 transition-all">
              <span className="text-[10px] text-gray-500 uppercase font-semibold flex items-center gap-1.5">
                <Compass size={12} className="text-indigo-400" />
                Fear & Greed Index
              </span>
              <div className="flex items-center gap-2.5 mt-2">
                <span className="text-2xl font-black font-sans text-gray-100">
                  {fearGreedIndex}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  fearGreedIndex > 70 ? 'bg-emerald-500/10 text-emerald-400' :
                  fearGreedIndex > 55 ? 'bg-green-400/10 text-green-400' :
                  fearGreedIndex > 45 ? 'bg-yellow-400/10 text-yellow-400' :
                  'bg-rose-500/10 text-rose-400'
                }`}>
                  {fearGreedIndex > 70 ? 'Extreme Greed' :
                   fearGreedIndex > 55 ? 'Greed' :
                   fearGreedIndex > 45 ? 'Neutral' :
                   fearGreedIndex > 30 ? 'Fear' : 'Extreme Fear'}
                </span>
              </div>
            </div>
          </div>

          {/* Left panel: Coin listings */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-5">
            <div className="bg-slate-900/45 border border-white/5 rounded-2xl p-5 backdrop-blur-xl flex flex-col">
              <h3 className="font-semibold text-base flex items-center gap-2 font-sans text-gray-100 mb-4">
                <BarChart3 size={16} className="text-indigo-400" />
                Cryptocurrency Spot Markets
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-500">
                      <th className="py-2.5 font-semibold">Asset</th>
                      <th className="py-2.5 font-semibold text-right">Price (USD)</th>
                      <th className="py-2.5 font-semibold text-right">24H Change</th>
                      <th className="py-2.5 font-semibold text-right">Market Cap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => {
                      const change = parseFloat(asset.changePercent24Hr);
                      const isUp = change >= 0;
                      const isSelected = selectedAsset && selectedAsset.id === asset.id;

                      return (
                        <tr 
                          key={asset.id}
                          onClick={() => setSelectedAsset(asset)}
                          className={`border-b border-white/[0.02] hover:bg-white/[0.02] cursor-pointer transition-all duration-200 ${isSelected ? 'bg-indigo-500/5 border-b-indigo-500/20' : ''}`}
                        >
                          <td className="py-3.5 flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-xl bg-slate-950 flex items-center justify-center font-bold text-gray-300 border border-white/5 shrink-0 uppercase text-[10px]">
                              {asset.symbol.slice(0, 3)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-gray-200 truncate">{asset.name}</span>
                              <span className="text-[10px] text-gray-500 uppercase font-semibold">{asset.symbol}</span>
                            </div>
                          </td>
                          <td className="py-3.5 text-right font-sans font-bold text-gray-200">
                            ${parseFloat(asset.priceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className={`py-3.5 text-right font-semibold font-sans ${isUp ? 'text-emerald-400' : 'text-rose-500'}`}>
                            {isUp ? '+' : ''}{change.toFixed(2)}%
                          </td>
                          <td className="py-3.5 text-right font-sans text-gray-400">
                            ${(parseFloat(asset.marketCapUsd) / 1e9).toFixed(1)}B
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right panel: Details graph, portfolio holdings, alerts */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-5">
            {/* Chart Widget */}
            {selectedAsset && (
              <div className="bg-slate-900/45 border border-white/5 rounded-2xl p-5 backdrop-blur-xl flex flex-col hover:border-white/10 transition-all duration-300">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex flex-col">
                    <h3 className="font-bold text-sm text-gray-100 flex items-center gap-1.5">
                      <span>{selectedAsset.name}</span>
                      <span className="text-[10px] text-gray-500 uppercase">({selectedAsset.symbol})</span>
                    </h3>
                    <span className="text-base font-black font-sans text-gray-100 mt-0.5">
                      ${parseFloat(selectedAsset.priceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </span>
                  </div>

                  <div className="flex bg-slate-950/40 border border-white/5 rounded-xl p-0.5">
                    {['1d', '7d', '30d'].map((range) => (
                      <button
                        key={range}
                        onClick={() => setChartRange(range)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                          chartRange === range ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-gray-300 bg-transparent border-none'
                        }`}
                      >
                        {range.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative h-[160px] w-full">
                  {historyLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white/5 border-t-indigo-400 rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <Line data={chartData} options={chartOptions} />
                  )}
                </div>
              </div>
            )}

            {/* Portfolio Holdings */}
            <div className="bg-slate-900/45 border border-white/5 rounded-2xl p-5 backdrop-blur-xl flex flex-col hover:border-white/10 transition-all duration-300">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 font-sans text-gray-100">
                  <Layers size={14} className="text-indigo-400" />
                  Your Asset Holdings
                </h3>
                {portfolioCalcs.holdingsList.length > 0 && (
                  <button 
                    onClick={handleResetPortfolio}
                    className="text-[10px] text-gray-500 hover:text-rose-400 bg-transparent border-none cursor-pointer font-semibold"
                  >
                    Clear History
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {portfolioCalcs.holdingsList.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 text-xs">
                    No holdings loaded. Click "Record Trade" to simulate balances.
                  </div>
                ) : (
                  portfolioCalcs.holdingsList.map((item) => {
                    const isUp = item.profit >= 0;
                    return (
                      <div 
                        key={item.id}
                        className="flex justify-between items-center bg-white/[0.01] border border-white/5 rounded-xl px-4 py-2.5"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-xs text-gray-200">{item.name}</span>
                          <span className="text-[10px] text-gray-500">
                            {item.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {item.symbol}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-sans font-bold text-xs text-gray-200">
                            ${item.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className={`text-[9px] font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-500'}`}>
                            {isUp ? '+' : ''}{item.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Profit
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Alert Panel */}
            <div className="bg-slate-900/45 border border-white/5 rounded-2xl p-5 backdrop-blur-xl flex flex-col hover:border-white/10 transition-all duration-300">
              <h3 className="font-semibold text-sm flex items-center gap-2 font-sans text-gray-100 mb-3">
                <Bell size={14} className="text-indigo-400" />
                Price Alerts Engine
              </h3>

              <form onSubmit={handleAddAlert} className="flex gap-1.5 mb-4">
                <select 
                  className="bg-slate-950 border border-white/5 rounded-xl px-2 py-2 text-xs outline-none text-gray-300"
                  value={alertAssetId}
                  onChange={(e) => setAlertAssetId(e.target.value)}
                  required
                >
                  <option value="">Select Asset</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.symbol} ({a.name})</option>
                  ))}
                </select>

                <select 
                  className="bg-slate-950 border border-white/5 rounded-xl px-2 py-2 text-xs outline-none text-gray-300"
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value)}
                >
                  <option value="above">Above</option>
                  <option value="below">Below</option>
                </select>

                <input 
                  type="number"
                  step="any"
                  className="flex-1 bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs outline-none placeholder-gray-700 text-gray-300"
                  placeholder="Target Price USD"
                  value={alertValue}
                  onChange={(e) => setAlertValue(e.target.value)}
                  required
                />

                <button 
                  type="submit"
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold p-2.5 rounded-xl flex items-center justify-center cursor-pointer"
                >
                  Set
                </button>
              </form>

              {/* Active Alerts List */}
              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                {alerts.length === 0 ? (
                  <span className="text-[10px] text-gray-500 italic">No active alerts set.</span>
                ) : (
                  alerts.map((al) => (
                    <div 
                      key={al.id}
                      className="bg-white/[0.02] border border-white/5 rounded-lg pl-2.5 pr-1 py-1 flex items-center gap-1.5 text-[10px]"
                    >
                      <span className="font-semibold text-gray-300">{al.symbol}</span>
                      <span className="text-gray-500">{al.type}</span>
                      <span className="font-bold text-gray-200">${al.value.toLocaleString()}</span>
                      <button 
                        onClick={() => handleRemoveAlert(al.id)}
                        className="bg-transparent border-none text-gray-500 hover:text-red-400 p-1 cursor-pointer rounded-full hover:bg-white/5"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {isAddTxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-[420px] bg-slate-900 border border-white/5 shadow-2xl rounded-2xl p-6 relative animate-slide-up">
            <button 
              onClick={() => setIsAddTxOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-200 p-1 rounded-full hover:bg-white/5 transition-all"
            >
              <X size={16} />
            </button>

            <h3 className="font-bold text-base text-gray-100 flex items-center gap-2 mb-4">
              <History size={16} className="text-indigo-400" />
              Record Simulated Trade
            </h3>

            <form onSubmit={handleAddTransaction} className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-semibold text-gray-500">Asset</label>
                <select 
                  className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-3 outline-none text-gray-300"
                  value={txAssetId}
                  onChange={(e) => setTxAssetId(e.target.value)}
                  required
                >
                  <option value="">Choose Asset</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.symbol})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-semibold text-gray-500">Transaction Type</label>
                <div className="flex bg-slate-950 border border-white/5 rounded-xl p-0.5">
                  <button 
                    type="button"
                    onClick={() => setTxType('buy')}
                    className={`flex-1 py-2 rounded-lg font-bold cursor-pointer transition-all ${
                      txType === 'buy' ? 'bg-emerald-500 text-white' : 'text-gray-500 bg-transparent border-none'
                    }`}
                  >
                    BUY
                  </button>
                  <button 
                    type="button"
                    onClick={() => setTxType('sell')}
                    className={`flex-1 py-2 rounded-lg font-bold cursor-pointer transition-all ${
                      txType === 'sell' ? 'bg-rose-500 text-white' : 'text-gray-500 bg-transparent border-none'
                    }`}
                  >
                    SELL
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-semibold text-gray-500">Token Amount</label>
                <input 
                  type="number"
                  step="any"
                  className="w-full bg-slate-950 border border-white/5 rounded-xl px-3.5 py-3 outline-none placeholder-gray-700 text-gray-300"
                  placeholder="e.g. 0.25"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-semibold text-gray-500">Purchase Price USD</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-gray-600 font-bold">$</span>
                  <input 
                    type="number"
                    step="any"
                    className="w-full bg-slate-950 border border-white/5 rounded-xl pl-7 pr-3.5 py-3 outline-none placeholder-gray-700 text-gray-300"
                    placeholder="Buy/Sell Price USD"
                    value={txPrice}
                    onChange={(e) => setTxPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="mt-3 w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3.5 rounded-xl cursor-pointer text-center hover:scale-[1.01] transition-all"
              >
                Log Trade Transaction
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
