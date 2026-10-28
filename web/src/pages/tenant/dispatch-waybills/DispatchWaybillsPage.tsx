import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Scale, Truck, CheckCircle2, AlertTriangle, ArrowRight,
  Plus, Search, Filter, RefreshCw, Calendar, MapPin, User, Phone,
  Clock, Check, Building2, Package, Layers, X, ShieldCheck, ArrowUpRight
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';

interface DispatchWaybill {
  id: number;
  waybillNumber: string;
  projectId: string;
  projectName: string;
  corridorId?: number;
  corridorName?: string;
  originYardId?: number;
  originYardName?: string;
  destinationYardId?: number;
  destinationYardName?: string;
  materialName: string;
  grade?: string;
  unitOfMeasure: string;
  tareWeight: number;
  grossWeight: number;
  netWeight: number;
  vehicleNumber: string;
  driverName: string;
  driverPhone?: string;
  transporterName?: string;
  ewayBillNumber?: string;
  status: 'Dispatched' | 'In-Transit' | 'Delivered' | 'Cancelled';
  dispatchedAt: string;
  deliveredAt?: string;
  remarks?: string;
}

interface Stockyard {
  id: number;
  yardName: string;
  yardCode: string;
}

export default function DispatchWaybillsPage() {
  const { currentUser } = useAuth();
  const [waybills, setWaybills] = useState<DispatchWaybill[]>([]);
  const [stockyards, setStockyards] = useState<Stockyard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'All' | 'In-Transit' | 'Delivered'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deliveringWb, setDeliveringWb] = useState<DispatchWaybill | null>(null);
  const [deliveryRemarks, setDeliveryRemarks] = useState('Weighbridge checked & material stockpiled');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Form State
  const [form, setForm] = useState({
    waybillNumber: '',
    projectId: 'PRJ-001',
    projectName: 'Delhi Metro Rail Project (Phase IV)',
    corridorName: 'Western DFCC Rail-to-Road Metro Siding Corridor',
    originYardId: '',
    originYardName: 'Singrauli Rail Siding & Central Stockyard',
    destinationYardId: '',
    destinationYardName: 'Noida Sector-62 Processing Stockyard',
    materialName: 'Track Ballast 40mm',
    grade: 'RDSO Class-A',
    unitOfMeasure: 'MT',
    tareWeight: '17.5',
    grossWeight: '52.8',
    vehicleNumber: 'UP-14-BT-9021',
    driverName: 'Rajesh Kumar',
    driverPhone: '+91 98765 43210',
    transporterName: 'Rewa Earthmovers & Haulage',
    ewayBillNumber: 'EWB-2026-904128',
    remarks: 'Scheduled siding aggregate dispatch'
  });

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiFetch('/api/tenant/dispatch-waybills');
      if (res.ok) {
        const data = await res.json();
        setWaybills(Array.isArray(data) ? data : []);
      }
      const yRes = await apiFetch('/api/tenant/stockyards');
      if (yRes.ok) {
        const yData = await yRes.json();
        setStockyards(Array.isArray(yData) ? yData : []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Summary Metrics
  const inTransitCount = useMemo(() => {
    return waybills.filter(w => w.status === 'In-Transit').length;
  }, [waybills]);

  const deliveredCount = useMemo(() => {
    return waybills.filter(w => w.status === 'Delivered').length;
  }, [waybills]);

  const totalTonnageHauled = useMemo(() => {
    return waybills.reduce((acc, w) => acc + (parseFloat(String(w.netWeight)) || 0), 0);
  }, [waybills]);

  // Filtered List
  const filteredWaybills = useMemo(() => {
    return waybills.filter(w => {
      if (statusFilter !== 'All' && w.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          w.waybillNumber?.toLowerCase().includes(q) ||
          w.vehicleNumber?.toLowerCase().includes(q) ||
          w.driverName?.toLowerCase().includes(q) ||
          w.materialName?.toLowerCase().includes(q) ||
          w.projectName?.toLowerCase().includes(q) ||
          w.destinationYardName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [waybills, statusFilter, searchQuery]);

  // Submit New Waybill
  const handleCreateWaybill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const gross = parseFloat(form.grossWeight) || 0;
      const tare = parseFloat(form.tareWeight) || 0;
      const net = Math.max(0, gross - tare);

      const res = await apiFetch('/api/tenant/dispatch-waybills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          firebaseUid: currentUser?.uid,
          tareWeight: tare,
          grossWeight: gross,
          netWeight: net
        })
      });

      if (res.ok) {
        showToast('Digital dispatch waybill issued successfully!');
        setIsCreateModalOpen(false);
        fetchData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Confirm Delivery
  const handleConfirmDelivery = async () => {
    if (!deliveringWb) return;
    try {
      const res = await apiFetch(`/api/tenant/dispatch-waybills/${deliveringWb.id}/deliver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remarks: deliveryRemarks
        })
      });

      if (res.ok) {
        showToast(`Waybill #${deliveringWb.waybillNumber} verified and delivered!`);
        setDeliveringWb(null);
        fetchData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-xl border border-slate-700 animate-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#00705a] flex items-center justify-center font-bold shadow-sm">
                <Scale size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dispatch Waybills & Gate Passports</h1>
                <p className="text-xs text-slate-500 font-medium">Digital weighbridge tare/gross receipts, haulage passports & transit loss tracking</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchData(true)}
              className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
              title="Refresh waybills"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-sm transition-all"
            >
              <Plus size={16} />
              <span>Issue Dispatch Slip</span>
            </button>
          </div>
        </div>

        {/* Operational Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
              <span>Active In-Transit</span>
              <Truck size={15} className="text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-700">{inTransitCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Vehicles currently on road/rail legs</p>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
              <span>Delivered & Verified</span>
              <CheckCircle2 size={15} className="text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700">{deliveredCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Weighbridge receipt completed</p>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
              <span>Total Material Hauled</span>
              <Package size={15} className="text-[#00705a]" />
            </div>
            <div className="text-2xl font-black text-slate-900">{totalTonnageHauled.toLocaleString()} <span className="text-sm font-bold text-slate-500">MT</span></div>
            <p className="text-[11px] text-slate-500 mt-0.5">Net weight aggregate & ballast</p>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
              <span>Shrinkage Tolerance</span>
              <ShieldCheck size={15} className="text-amber-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">±1.5%</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Zero tolerance threshold violations</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Waybill #, Vehicle, Material..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a] w-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
          {(['All', 'In-Transit', 'Delivered'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Waybills List */}
      <div className="space-y-4">
        {filteredWaybills.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
            <FileText size={36} className="text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-black text-slate-700">No Waybills Found</h3>
            <p className="text-xs text-slate-500 mt-1">Issue a new digital dispatch slip from the button above.</p>
          </div>
        ) : (
          filteredWaybills.map(wb => {
            const isInTransit = wb.status === 'In-Transit';
            return (
              <div
                key={wb.id}
                className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Left: Waybill & Material Details */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                      {wb.waybillNumber}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      isInTransit
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {wb.status}
                    </span>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                      {wb.projectName}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-slate-900">{wb.materialName}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium mt-0.5">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-amber-500" />
                        From: <span className="font-bold text-slate-700">{wb.originYardName || 'Quarry Pit Face'}</span>
                      </span>
                      <ArrowRight size={12} className="text-slate-400" />
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-emerald-500" />
                        To: <span className="font-bold text-slate-700">{wb.destinationYardName || 'Delivery Site'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-medium pt-1">
                    <span className="flex items-center gap-1 font-mono font-bold text-slate-800">
                      <Truck size={13} className="text-slate-400" />
                      {wb.vehicleNumber}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <User size={13} className="text-slate-400" />
                      Pilot: {wb.driverName} ({wb.driverPhone || 'Contact Active'})
                    </span>
                    {wb.ewayBillNumber && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-[11px] text-slate-500">eWay: {wb.ewayBillNumber}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Weighbridge Net/Gross & Action */}
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 shrink-0">
                  <div className="text-right space-y-0.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Certified Net Weight</div>
                    <div className="text-xl font-black text-slate-900 font-mono">
                      {wb.netWeight} <span className="text-xs font-bold text-slate-500">{wb.unitOfMeasure}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Gross: {wb.grossWeight} MT · Tare: {wb.tareWeight} MT
                    </div>
                  </div>

                  {isInTransit ? (
                    <button
                      onClick={() => setDeliveringWb(wb)}
                      className="flex items-center gap-1.5 bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-black uppercase tracking-wider px-3.5 py-2.5 rounded-xl shadow-sm transition-all"
                    >
                      <Check size={14} />
                      <span>Confirm Delivery</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/60 px-3 py-2 rounded-xl">
                      <CheckCircle2 size={15} />
                      <span>Received & Stacked</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: ISSUE DISPATCH SLIP */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Issue Digital Dispatch Waybill</h3>
                <p className="text-[11px] text-slate-500 font-medium">Automatic origin stockpile deduction & weighbridge logging</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateWaybill} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Project</label>
                  <input
                    type="text"
                    value={form.projectName}
                    onChange={e => setForm({ ...form, projectName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Material Name</label>
                  <input
                    type="text"
                    required
                    value={form.materialName}
                    onChange={e => setForm({ ...form, materialName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Origin Stockyard / Loading Pit</label>
                  <select
                    value={form.originYardName}
                    onChange={e => setForm({ ...form, originYardName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  >
                    {stockyards.map(y => (
                      <option key={y.id} value={y.yardName}>{y.yardName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Destination Stockyard / Site</label>
                  <select
                    value={form.destinationYardName}
                    onChange={e => setForm({ ...form, destinationYardName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  >
                    {stockyards.map(y => (
                      <option key={y.id} value={y.yardName}>{y.yardName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Gross Weight (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.grossWeight}
                    onChange={e => setForm({ ...form, grossWeight: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Tare Weight (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.tareWeight}
                    onChange={e => setForm({ ...form, tareWeight: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Net Weight (MT)</label>
                  <div className="w-full p-2.5 bg-slate-100 font-mono font-black text-slate-800 rounded-xl border border-slate-200">
                    {(parseFloat(form.grossWeight || 0) - parseFloat(form.tareWeight || 0)).toFixed(2)} MT
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Haulage Vehicle Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., UP-14-BT-9021"
                    value={form.vehicleNumber}
                    onChange={e => setForm({ ...form, vehicleNumber: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Commercial Driver Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Rajesh Kumar"
                    value={form.driverName}
                    onChange={e => setForm({ ...form, driverName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00705a] hover:bg-[#005a48] text-white font-black uppercase tracking-wider rounded-xl shadow-sm"
                >
                  Generate & Dispatch Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM WEIGHBRIDGE RECEIPT */}
      {deliveringWb && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Confirm Weighbridge Delivery</h3>
                <p className="text-[11px] text-slate-500 font-medium">Waybill #{deliveringWb.waybillNumber}</p>
              </div>
              <button onClick={() => setDeliveringWb(null)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>Material:</span>
                <span className="text-slate-900">{deliveringWb.materialName}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>Certified Net Weight:</span>
                <span className="font-mono text-slate-900 font-black">{deliveringWb.netWeight} {deliveringWb.unitOfMeasure}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>Vehicle & Pilot:</span>
                <span className="text-slate-900">{deliveringWb.vehicleNumber} ({deliveringWb.driverName})</span>
              </div>
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>Destination Stockyard:</span>
                <span className="text-emerald-700">{deliveringWb.destinationYardName}</span>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 text-xs mb-1 block">Receiving Remarks / Weighbridge Slip #</label>
              <input
                type="text"
                value={deliveryRemarks}
                onChange={e => setDeliveryRemarks(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeliveringWb(null)}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelivery}
                className="px-5 py-2 bg-[#00705a] hover:bg-[#005a48] text-white font-black uppercase tracking-wider rounded-xl shadow-sm"
              >
                Confirm Weighbridge Receipt
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
