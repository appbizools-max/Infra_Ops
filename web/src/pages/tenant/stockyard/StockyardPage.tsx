import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers, Package, TrendingUp, TrendingDown, Plus, Search, Filter,
  Scale, MapPin, User, Phone, CheckCircle2, AlertTriangle, ArrowRight,
  RefreshCw, FileText, ArrowUpRight, ArrowDownLeft, ShieldCheck,
  Building2, Gauge, Truck, ChevronRight, X, Info
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';

interface Stockyard {
  id: number;
  yardCode: string;
  yardName: string;
  worksiteId?: string;
  worksiteName?: string;
  totalCapacityTons: number;
  currentOccupancyTons: number;
  pilesCount: number;
  location: string;
  supervisorName: string;
  supervisorPhone: string;
  weighbridgeInstalled: boolean;
  weighbridgeCapacityTons: number;
  status: string;
  notes?: string;
  createdAt: string;
}

interface StockyardPile {
  id: number;
  stockyardId: number;
  bayNumber: string;
  materialName: string;
  grade: string;
  unitOfMeasure: string;
  currentQuantity: number;
  minThresholdQuantity: number;
  maxCapacity: number;
  densityFactor: number;
  colorCode: string;
  status: string;
}

interface StockTransaction {
  id: number;
  stockyardId: number;
  yardName: string;
  yardCode: string;
  pileId: number;
  materialName: string;
  grade: string;
  transactionType: 'INWARD' | 'OUTWARD' | 'ADJUSTMENT';
  quantity: number;
  projectName: string;
  vehicleNumber: string;
  driverName: string;
  waybillNumber: string;
  weighbridgeSlipNumber?: string;
  grossWeight?: number;
  tareWeight?: number;
  netWeight?: number;
  remarks: string;
  createdAt: string;
}

export default function StockyardPage() {
  const { currentUser } = useAuth();
  const [stockyards, setStockyards] = useState<Stockyard[]>([]);
  const [selectedYard, setSelectedYard] = useState<Stockyard | null>(null);
  const [piles, setPiles] = useState<StockyardPile[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'piles' | 'transactions'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [txFilter, setTxFilter] = useState<'ALL' | 'INWARD' | 'OUTWARD'>('ALL');

  // Modals
  const [isAddYardModalOpen, setIsAddYardModalOpen] = useState(false);
  const [isAddPileModalOpen, setIsAddPileModalOpen] = useState(false);
  const [isLogTxModalOpen, setIsLogTxModalOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Form states
  const [yardForm, setYardForm] = useState({
    yardCode: '',
    yardName: '',
    location: '',
    totalCapacityTons: '50000',
    supervisorName: '',
    supervisorPhone: '',
    weighbridgeInstalled: true,
    weighbridgeCapacityTons: '100',
    notes: ''
  });

  const [pileForm, setPileForm] = useState({
    bayNumber: '',
    materialName: '',
    grade: '',
    unitOfMeasure: 'MT',
    currentQuantity: '5000',
    minThresholdQuantity: '1000',
    maxCapacity: '25000',
    colorCode: '#00705a'
  });
  const [txForm, setTxForm] = useState({
    pileId: '',
    transactionType: 'INWARD',
    quantity: '35',
    projectName: '',
    vehicleNumber: '',
    driverName: '',
    driverPhone: '',
    waybillNumber: '',
    grossWeight: '50',
    tareWeight: '15',
    remarks: ''
  });
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiFetch('/api/tenant/stockyards');
      if (res.ok) {
        const data = await res.json();
        const yardsList: Stockyard[] = Array.isArray(data) ? data : [];
        setStockyards(yardsList);
        if (yardsList.length > 0 && !selectedYard) {
          setSelectedYard(yardsList[0]);
        }
      }

      // Fetch transactions
      const txRes = await apiFetch('/api/tenant/stockyard-transactions');
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(Array.isArray(txData) ? txData : []);
      }
    } catch (err) {
      console.error('Failed to load stockyards:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  // Fetch piles when selected yard changes
  useEffect(() => {
    if (!selectedYard) return;
    const fetchPiles = async () => {
      try {
        const res = await apiFetch(`/api/tenant/stockyards/${selectedYard.id}/piles`);
        if (res.ok) {
          const data = await res.json();
          setPiles(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load piles:', err);
      }
    };
    fetchPiles();
  }, [selectedYard]);
  useEffect(() => {
    fetchData();
  }, []);
  // Summary Metrics across all yards
  const totalNetworkCapacity = useMemo(() => {
    return stockyards.reduce((acc, y) => acc + (parseFloat(String(y.totalCapacityTons)) || 0), 0);
  }, [stockyards]);

  const totalNetworkOccupancy = useMemo(() => {
    return stockyards.reduce((acc, y) => acc + (parseFloat(String(y.currentOccupancyTons)) || 0), 0);
  }, [stockyards]);

  const networkOccupancyPercent = totalNetworkCapacity > 0
    ? Math.round((totalNetworkOccupancy / totalNetworkCapacity) * 100)
    : 0;

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (selectedYard && t.stockyardId !== selectedYard.id) return false;
      if (txFilter !== 'ALL' && t.transactionType !== txFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.materialName?.toLowerCase().includes(q) ||
          t.vehicleNumber?.toLowerCase().includes(q) ||
          t.driverName?.toLowerCase().includes(q) ||
          t.waybillNumber?.toLowerCase().includes(q) ||
          t.projectName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, selectedYard, txFilter, searchQuery]);

  // Handle Add Stockyard Submit
  const handleCreateYard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yardForm.yardName) return;
    try {
      const res = await apiFetch('/api/tenant/stockyards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...yardForm,
          firebaseUid: currentUser?.uid,
          totalCapacityTons: parseFloat(yardForm.totalCapacityTons) || 50000,
          weighbridgeCapacityTons: parseFloat(yardForm.weighbridgeCapacityTons) || 100
        })
      });
      if (res.ok) {
        showToast('Stockyard registered successfully!');
        setIsAddYardModalOpen(false);
        setYardForm({
          yardCode: '', yardName: '', location: '', totalCapacityTons: '50000',
          supervisorName: '', supervisorPhone: '', weighbridgeInstalled: true,
          weighbridgeCapacityTons: '100', notes: ''
        });
        fetchData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Add Pile Submit
  const handleCreatePile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYard || !pileForm.materialName) return;
    try {
      const res = await apiFetch(`/api/tenant/stockyards/${selectedYard.id}/piles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pileForm,
          currentQuantity: parseFloat(pileForm.currentQuantity) || 0,
          minThresholdQuantity: parseFloat(pileForm.minThresholdQuantity) || 500,
          maxCapacity: parseFloat(pileForm.maxCapacity) || 20000
        })
      });
      if (res.ok) {
        showToast('Stockpile bay created successfully!');
        setIsAddPileModalOpen(false);
        setPileForm({
          bayNumber: '', materialName: '', grade: '', unitOfMeasure: 'MT',
          currentQuantity: '5000', minThresholdQuantity: '1000', maxCapacity: '25000',
          colorCode: '#00705a'
        });
        // reload piles
        const pRes = await apiFetch(`/api/tenant/stockyards/${selectedYard.id}/piles`);
        if (pRes.ok) {
          const data = await pRes.json();
          setPiles(Array.isArray(data) ? data : []);
        }
        fetchData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-xl border border-slate-700 animate-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#00705a] flex items-center justify-center font-bold shadow-sm">
                <Layers size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stockyard Hub & Material Flow</h1>
                <p className="text-xs text-slate-500 font-medium">Enterprise material inventory, stockpile bay segregation & weighbridge audit</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchData(true)}
              className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
              title="Refresh inventory"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setIsAddYardModalOpen(true)}
              className="flex items-center gap-2 bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-sm transition-all"
            >
              <Plus size={16} />
              <span>Register Stockyard</span>
            </button>
          </div>
        </div>

        {/* Global Network Occupancy Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
              <span>Network Stockyards</span>
              <Building2 size={15} className="text-slate-500" />
            </div>
            <div className="text-2xl font-black text-slate-900">{stockyards.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Active rail sidings & worksite yards</p>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
              <span>Total Network Capacity</span>
              <Gauge size={15} className="text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{totalNetworkCapacity.toLocaleString()} <span className="text-sm font-bold text-slate-500">MT</span></div>
            <p className="text-[11px] text-slate-500 mt-0.5">Certified storage holding</p>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
              <span>Current Stock On-Hand</span>
              <Package size={15} className="text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-700">{totalNetworkOccupancy.toLocaleString()} <span className="text-sm font-bold text-slate-500">MT</span></div>
            <p className="text-[11px] text-slate-500 mt-0.5">{networkOccupancyPercent}% total network occupancy</p>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
              <span>Weighbridge Status</span>
              <Scale size={15} className="text-amber-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700">100% Online</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Automated gross/tare calibration</p>
          </div>
        </div>
      </div>

      {/* Stockyard Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {stockyards.map(yard => {
          const isSelected = selectedYard?.id === yard.id;
          const occPct = yard.totalCapacityTons > 0 ? Math.round((yard.currentOccupancyTons / yard.totalCapacityTons) * 100) : 0;
          return (
            <button
              key={yard.id}
              onClick={() => setSelectedYard(yard)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left border transition-all shrink-0 ${isSelected
                ? 'bg-white border-[#00705a] shadow-sm ring-1 ring-[#00705a]'
                : 'bg-white/80 border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-emerald-50 text-[#00705a]' : 'bg-slate-100 text-slate-600'
                }`}>
                {yard.yardCode.slice(-3)}
              </div>
              <div>
                <div className="text-xs font-black text-slate-900">{yard.yardName}</div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium mt-0.5">
                  <span>{yard.currentOccupancyTons.toLocaleString()} / {yard.totalCapacityTons.toLocaleString()} MT</span>
                  <span className={`px-1.5 py-0.2 rounded font-bold ${occPct > 85 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                    {occPct}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Content Area for Selected Yard */}
      {selectedYard ? (
        <div className="space-y-6">

          {/* Selected Yard Profile Banner */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-[#00705a] border border-emerald-200">
                    {selectedYard.yardCode}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Worksite Link: {selectedYard.worksiteName || 'Central Siding Hub'}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 mt-1">{selectedYard.yardName}</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-rose-500" />
                    {selectedYard.location || 'Rail Siding Sector'}
                  </span>
                  <span className="flex items-center gap-1">
                    <User size={13} className="text-blue-500" />
                    Supervisor: {selectedYard.supervisorName} ({selectedYard.supervisorPhone})
                  </span>
                  <span className="flex items-center gap-1">
                    <Scale size={13} className="text-amber-500" />
                    Weighbridge: {selectedYard.weighbridgeCapacityTons} MT Capacity
                  </span>
                </div>
              </div>

              {/* Yard Actions */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsAddPileModalOpen(true)}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors shadow-sm"
                >
                  <Plus size={14} />
                  <span>Add Material Pile / Bay</span>
                </button>
              </div>
            </div>

            {/* Capacity Progress Bar */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                <span>Yard Capacity Occupancy</span>
                <span className="text-slate-900">
                  {selectedYard.currentOccupancyTons.toLocaleString()} / {selectedYard.totalCapacityTons.toLocaleString()} MT ({
                    Math.round((selectedYard.currentOccupancyTons / selectedYard.totalCapacityTons) * 100)
                  }%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#00705a] h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round((selectedYard.currentOccupancyTons / selectedYard.totalCapacityTons) * 100))}%`
                  }}
                />
              </div>
            </div>
          </div>

          {/* View Switcher: Stockpiles vs Movement Transactions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                Material Stockpiles ({piles.length})
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'transactions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                Inward & Outward Ledger ({filteredTransactions.length})
              </button>
            </div>

            {activeTab === 'transactions' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                  {(['ALL', 'INWARD', 'OUTWARD'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setTxFilter(f)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${txFilter === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                        }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* TAB 1: MATERIAL STOCKPILE BAYS */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {piles.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-white border border-slate-200 rounded-3xl p-8">
                  <Package size={32} className="text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No stockpile bays configured yet for this yard.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Click "Add Material Pile / Bay" to allocate storage bays.</p>
                </div>
              ) : (
                piles.map(pile => {
                  const isLowStock = pile.currentQuantity <= pile.minThresholdQuantity;
                  const bayCapPct = pile.maxCapacity > 0 ? Math.round((pile.currentQuantity / pile.maxCapacity) * 100) : 0;
                  return (
                    <div
                      key={pile.id}
                      className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Bay Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: pile.colorCode || '#00705a' }} />
                            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">{pile.bayNumber}</span>
                          </div>
                          {isLowStock ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle size={11} />
                              Low Stock Warning
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#00705a] border border-emerald-200">
                              Stock Safe
                            </span>
                          )}
                        </div>

                        {/* Material Info */}
                        <h3 className="text-base font-black text-slate-900">{pile.materialName}</h3>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">Grade: {pile.grade || 'Standard Quality'}</p>

                        {/* Current Quantity */}
                        <div className="my-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-baseline justify-between">
                          <div>
                            <div className="text-[10px] font-bold uppercase text-slate-400">Current Balance</div>
                            <div className="text-xl font-black text-slate-900">
                              {pile.currentQuantity.toLocaleString()} <span className="text-xs font-bold text-slate-500">{pile.unitOfMeasure}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-bold uppercase text-slate-400">Min Threshold</div>
                            <div className="text-xs font-bold text-slate-700">{pile.minThresholdQuantity.toLocaleString()} {pile.unitOfMeasure}</div>
                          </div>
                        </div>

                        {/* Bay Utilization Gauge */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                            <span>Bay Utilization</span>
                            <span>{bayCapPct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(100, bayCapPct)}%`,
                                backgroundColor: isLowStock ? '#e11d48' : (pile.colorCode || '#00705a')
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer Info */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span>Max Cap: {pile.maxCapacity.toLocaleString()} {pile.unitOfMeasure}</span>
                        <span className="text-slate-400">Density: {pile.densityFactor || 1.6} MT/CUM</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: INWARD & OUTWARD TRANSACTION LEDGER */}
          {activeTab === 'transactions' && (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search waybill, vehicle, material..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a] w-64"
                    />
                  </div>
                </div>
                <div className="text-xs font-bold text-slate-500">
                  Showing {filteredTransactions.length} movements
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="py-16 text-center">
                  <FileText size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">No material transactions recorded matching filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <th className="py-3 px-4">Date / Time</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Waybill #</th>
                        <th className="py-3 px-4">Material & Grade</th>
                        <th className="py-3 px-4">Quantity (MT)</th>
                        <th className="py-3 px-4">Vehicle & Driver</th>
                        <th className="py-3 px-4">Project</th>
                        <th className="py-3 px-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredTransactions.map(tx => {
                        const isInward = tx.transactionType === 'INWARD';
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                              {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isInward
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                {isInward ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                                {tx.transactionType}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                              {tx.waybillNumber || '—'}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{tx.materialName}</div>
                              <div className="text-[11px] text-slate-400">{tx.grade}</div>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-black text-slate-900">
                              {isInward ? '+' : '-'}{parseFloat(String(tx.quantity)).toLocaleString()} MT
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-800">{tx.vehicleNumber || '—'}</div>
                              <div className="text-[11px] text-slate-500">{tx.driverName || '—'}</div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-700 font-medium">
                              {tx.projectName || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                              {tx.remarks || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
          <Building2 size={36} className="text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-black text-slate-700">No Stockyard Selected</h3>
          <p className="text-xs text-slate-500 mt-1">Select an active stockyard above or register a new facility.</p>
        </div>
      )}

      {/* MODAL 1: ADD STOCKYARD */}
      {isAddYardModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-black text-slate-900">Register New Stockyard / Siding Facility</h3>
              <button onClick={() => setIsAddYardModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateYard} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 mb-1 block">Facility Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Rewa Siding Terminal A"
                  value={yardForm.yardName}
                  onChange={e => setYardForm({ ...yardForm, yardName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Facility Code</label>
                  <input
                    type="text"
                    placeholder="e.g., SY-004"
                    value={yardForm.yardCode}
                    onChange={e => setYardForm({ ...yardForm, yardCode: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Total Capacity (MT)</label>
                  <input
                    type="number"
                    value={yardForm.totalCapacityTons}
                    onChange={e => setYardForm({ ...yardForm, totalCapacityTons: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">Location / Rail Siding Address</label>
                <input
                  type="text"
                  placeholder="e.g., Singrauli DFCC Yard Line 3"
                  value={yardForm.location}
                  onChange={e => setYardForm({ ...yardForm, location: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Supervisor In-Charge</label>
                  <input
                    type="text"
                    placeholder="e.g., Devendra Rathore"
                    value={yardForm.supervisorName}
                    onChange={e => setYardForm({ ...yardForm, supervisorName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Supervisor Contact</label>
                  <input
                    type="text"
                    placeholder="e.g., +91 98765 11223"
                    value={yardForm.supervisorPhone}
                    onChange={e => setYardForm({ ...yardForm, supervisorPhone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Weighbridge Scale</label>
                  <select
                    value={yardForm.weighbridgeInstalled ? 'true' : 'false'}
                    onChange={e => setYardForm({ ...yardForm, weighbridgeInstalled: e.target.value === 'true' })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  >
                    <option value="true">Installed & Calibrated</option>
                    <option value="false">Not Available</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Weighbridge Max Load (MT)</label>
                  <input
                    type="number"
                    value={yardForm.weighbridgeCapacityTons}
                    onChange={e => setYardForm({ ...yardForm, weighbridgeCapacityTons: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddYardModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00705a] hover:bg-[#005a48] text-white font-black uppercase tracking-wider rounded-xl shadow-sm"
                >
                  Register Stockyard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD PILE / BAY */}
      {isAddPileModalOpen && selectedYard && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Add Material Stockpile Bay</h3>
                <p className="text-[11px] text-slate-500 font-medium">{selectedYard.yardName}</p>
              </div>
              <button onClick={() => setIsAddPileModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePile} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Bay Identifier</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Bay-D1"
                    value={pileForm.bayNumber}
                    onChange={e => setPileForm({ ...pileForm, bayNumber: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Color Tag</label>
                  <input
                    type="color"
                    value={pileForm.colorCode}
                    onChange={e => setPileForm({ ...pileForm, colorCode: e.target.value })}
                    className="w-full h-10 p-1 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">Material Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Track Ballast 40mm, GSB, Crushed Sand"
                  value={pileForm.materialName}
                  onChange={e => setPileForm({ ...pileForm, materialName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Grade / Specification</label>
                  <input
                    type="text"
                    placeholder="e.g., RDSO Class-A / MORTH 401"
                    value={pileForm.grade}
                    onChange={e => setPileForm({ ...pileForm, grade: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Unit of Measure</label>
                  <select
                    value={pileForm.unitOfMeasure}
                    onChange={e => setPileForm({ ...pileForm, unitOfMeasure: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  >
                    <option value="MT">MT (Metric Tons)</option>
                    <option value="CUM">CUM (Cubic Meters)</option>
                    <option value="CFT">CFT (Cubic Feet)</option>
                    <option value="Bags">Bags (50 KG)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Current Stock</label>
                  <input
                    type="number"
                    value={pileForm.currentQuantity}
                    onChange={e => setPileForm({ ...pileForm, currentQuantity: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Min Alert Level</label>
                  <input
                    type="number"
                    value={pileForm.minThresholdQuantity}
                    onChange={e => setPileForm({ ...pileForm, minThresholdQuantity: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Max Bay Cap</label>
                  <input
                    type="number"
                    value={pileForm.maxCapacity}
                    onChange={e => setPileForm({ ...pileForm, maxCapacity: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPileModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-wider rounded-xl shadow-sm"
                >
                  Save Stockpile Bay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
