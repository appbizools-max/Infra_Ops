import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Route, Plus, Search, Filter, RefreshCw, Truck, Train, Layers,
  MapPin, User, CheckCircle2, Clock, AlertCircle, ChevronRight,
  TrendingUp, FileText, ArrowRight, Eye, ShieldCheck, Scale, Wrench, X
} from 'lucide-react';
import { apiFetch } from '../../../lib/api';

export default function OperationsHubPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'CURRENT' | 'ALL'>('CURRENT');
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [resources, setResources] = useState<any>({
    projects: [],
    stockyards: [],
    stockPoints: [],
    corridors: [],
    vehicles: [],
    machinery: [],
    supervisors: []
  });

  // Modal States
  const [trackingModalOpId, setTrackingModalOpId] = useState<number | null>(null);
  const [trackingDetail, setTrackingDetail] = useState<any | null>(null);
  const [dispatchModalOp, setDispatchModalOp] = useState<any | null>(null);
  const [receiveModalOp, setReceiveModalOp] = useState<any | null>(null);
  const [changeReqModalOp, setChangeReqModalOp] = useState<any | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Dispatch Form State
  const [dispatchForm, setDispatchForm] = useState({
    transportMode: 'TRUCK',
    isTemporary: false,
    vehicleId: '',
    vehicleNumber: '',
    driverName: '',
    driverPhone: '',
    trainNumber: '',
    rakeNumber: '',
    wagonNumbers: '',
    challanNumber: '',
    waybillNumber: '',
    invoiceNumbers: '',
    grossWeight: '',
    tareWeight: '',
    destinationStockyardId: '',
    destinationStockPointId: '',
    destinationStockPointName: '',
    dispatchedByName: 'Site Supervisor',
    remarks: ''
  });

  // Receive Form State
  const [selectedTripToReceive, setSelectedTripToReceive] = useState<any | null>(null);
  const [receiveForm, setReceiveForm] = useState({
    receivedGrossWeight: '',
    receivedTareWeight: '',
    destinationStockyardId: '',
    destinationStockPointId: '',
    destinationStockPointName: '',
    machineryId: '',
    machineryName: '',
    machineryHoursUsed: '1',
    receivedByName: 'Stockyard Supervisor',
    remarks: ''
  });

  // Change Request Form State
  const [changeReqForm, setChangeReqForm] = useState({
    changeType: 'ROUTE_CHANGE',
    summary: '',
    proposedCorridorName: '',
    proposedQuantityTons: '',
    newStockyardId: '',
    newStockyardSupervisor: '',
    remarks: ''
  });

  useEffect(() => {
    fetchOperations();
    fetchResources();
  }, [activeTab, selectedProjectId]);

  const fetchOperations = async () => {
    try {
      setLoading(true);
      const queryStatus = activeTab === 'CURRENT' ? 'RUNNING' : 'ALL';
      const projectParam = selectedProjectId !== 'ALL' ? `&projectId=${selectedProjectId}` : '';
      const res = await apiFetch(`/api/tenant/operations?status=${queryStatus}${projectParam}`);
      if (res.ok) {
        const data = await res.json();
        setOperations(data);
      }
    } catch (err: any) {
      console.error('Error fetching operations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchResources = async () => {
    try {
      const res = await apiFetch('/api/tenant/operations-resources');
      if (res.ok) {
        const data = await res.json();
        setResources(data);
      }
    } catch (err) {
      console.error('Error fetching resources:', err);
    }
  };

  // Open Tracking Panoramic View
  const handleOpenTracking = async (opId: number) => {
    setTrackingModalOpId(opId);
    setTrackingDetail(null);
    try {
      setModalLoading(true);
      const res = await apiFetch(`/api/tenant/operations/${opId}`);
      if (res.ok) {
        const data = await res.json();
        setTrackingDetail(data);
      }
    } catch (err) {
      console.error('Error fetching operation details:', err);
    } finally {
      setModalLoading(false);
    }
  };

  // Open Dispatch Modal
  const handleOpenDispatch = (op: any) => {
    setDispatchModalOp(op);
    setDispatchForm({
      transportMode: op.transportMode || 'TRUCK',
      isTemporary: false,
      vehicleId: '',
      vehicleNumber: '',
      driverName: '',
      driverPhone: '',
      trainNumber: '',
      rakeNumber: '',
      wagonNumbers: '',
      challanNumber: `CHL-${Math.floor(10000 + Math.random() * 90000)}`,
      waybillNumber: `WB-${Math.floor(100000 + Math.random() * 900000)}`,
      invoiceNumbers: '',
      grossWeight: '',
      tareWeight: '',
      destinationStockyardId: '',
      destinationStockPointId: '',
      destinationStockPointName: '',
      dispatchedByName: 'Site Supervisor',
      remarks: ''
    });
  };

  // Select company vehicle auto fills driver
  const handleSelectVehicle = (vehicleId: string) => {
    if (!vehicleId) {
      setDispatchForm(prev => ({ ...prev, vehicleId: '', vehicleNumber: '', driverName: '', driverPhone: '' }));
      return;
    }
    const veh = resources.vehicles.find((v: any) => String(v.id) === vehicleId);
    if (veh) {
      setDispatchForm(prev => ({
        ...prev,
        vehicleId,
        vehicleNumber: veh.registrationNumber,
        driverName: veh.driverName || '',
        driverPhone: veh.driverPhone || ''
      }));
    }
  };

  // Submit Dispatch
  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchModalOp) return;

    try {
      setModalLoading(true);
      const payload = {
        transportMode: dispatchForm.transportMode,
        isTemporary: dispatchForm.isTemporary,
        vehicleId: dispatchForm.vehicleId ? Number(dispatchForm.vehicleId) : null,
        vehicleNumber: dispatchForm.vehicleNumber,
        driverName: dispatchForm.driverName,
        driverPhone: dispatchForm.driverPhone,
        trainNumber: dispatchForm.trainNumber,
        rakeNumber: dispatchForm.rakeNumber,
        wagonNumbers: dispatchForm.wagonNumbers ? dispatchForm.wagonNumbers.split(',').map(s => s.trim()) : [],
        challanNumber: dispatchForm.challanNumber,
        waybillNumber: dispatchForm.waybillNumber,
        invoiceNumbers: dispatchForm.invoiceNumbers ? dispatchForm.invoiceNumbers.split(',').map(s => s.trim()) : [],
        grossWeight: parseFloat(dispatchForm.grossWeight) || 0,
        tareWeight: parseFloat(dispatchForm.tareWeight) || 0,
        destinationStockyardId: dispatchForm.destinationStockyardId ? Number(dispatchForm.destinationStockyardId) : null,
        destinationStockPointId: dispatchForm.destinationStockPointId ? Number(dispatchForm.destinationStockPointId) : null,
        destinationStockPointName: dispatchForm.destinationStockPointName,
        dispatchedByName: dispatchForm.dispatchedByName,
        remarks: dispatchForm.remarks
      };

      const res = await apiFetch(`/api/tenant/operations/${dispatchModalOp.id}/trips/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to dispatch');
      }

      setActionSuccessMsg(`Consignment successfully dispatched into transit!`);
      setDispatchModalOp(null);
      fetchOperations();
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // Open Receive Modal
  const handleOpenReceive = async (op: any) => {
    setReceiveModalOp(op);
    setSelectedTripToReceive(null);
    try {
      setModalLoading(true);
      const res = await apiFetch(`/api/tenant/operations/${op.id}`);
      if (res.ok) {
        const data = await res.json();
        setTrackingDetail(data);
        const inTransitTrips = data.trips?.filter((t: any) => t.currentStage === 'IN_TRANSIT' || t.currentStage === 'LOADED') || [];
        if (inTransitTrips.length > 0) {
          setSelectedTripToReceive(inTransitTrips[0]);
          setReceiveForm({
            receivedGrossWeight: String(inTransitTrips[0].grossWeight || ''),
            receivedTareWeight: String(inTransitTrips[0].tareWeight || ''),
            destinationStockyardId: String(inTransitTrips[0].destinationStockyardId || (data.stockyards?.[0]?.stockyardId || '')),
            destinationStockPointId: String(inTransitTrips[0].destinationStockPointId || ''),
            destinationStockPointName: inTransitTrips[0].destinationStockPointName || '',
            machineryId: '',
            machineryName: '',
            machineryHoursUsed: '1',
            receivedByName: 'Stockyard Supervisor',
            remarks: ''
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  // Submit Receive & Unload
  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripToReceive) return;

    try {
      setModalLoading(true);
      const payload = {
        receivedGrossWeight: parseFloat(receiveForm.receivedGrossWeight) || 0,
        receivedTareWeight: parseFloat(receiveForm.receivedTareWeight) || 0,
        destinationStockyardId: receiveForm.destinationStockyardId ? Number(receiveForm.destinationStockyardId) : null,
        destinationStockPointId: receiveForm.destinationStockPointId ? Number(receiveForm.destinationStockPointId) : null,
        destinationStockPointName: receiveForm.destinationStockPointName,
        machineryId: receiveForm.machineryId ? Number(receiveForm.machineryId) : null,
        machineryName: receiveForm.machineryName,
        machineryHoursUsed: parseFloat(receiveForm.machineryHoursUsed) || 1,
        receivedByName: receiveForm.receivedByName,
        remarks: receiveForm.remarks
      };

      const res = await apiFetch(`/api/tenant/operations/trips/${selectedTripToReceive.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to receive consignment');
      }

      setActionSuccessMsg(`Consignment successfully received and inventory credited to stockyard!`);
      setReceiveModalOp(null);
      fetchOperations();
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // Open Change Request Modal
  const handleOpenChangeRequest = (op: any) => {
    setChangeReqModalOp(op);
    setChangeReqForm({
      changeType: 'ROUTE_CHANGE',
      summary: '',
      proposedCorridorName: op.corridorName || '',
      proposedQuantityTons: String(op.plannedQuantityTons || ''),
      newStockyardId: '',
      newStockyardSupervisor: '',
      remarks: ''
    });
  };

  // Submit Change Request
  const handleChangeRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeReqModalOp) return;

    try {
      setModalLoading(true);
      const proposedPayload: any = {};
      if (changeReqForm.proposedCorridorName) proposedPayload.corridorName = changeReqForm.proposedCorridorName;
      if (changeReqForm.proposedQuantityTons) proposedPayload.plannedQuantityTons = parseFloat(changeReqForm.proposedQuantityTons);
      if (changeReqForm.newStockyardId) {
        const y = resources.stockyards.find((s: any) => String(s.id) === changeReqForm.newStockyardId);
        proposedPayload.newStockyard = {
          stockyardId: Number(changeReqForm.newStockyardId),
          stockyardName: y?.yardName || 'Stockyard',
          supervisorName: changeReqForm.newStockyardSupervisor || y?.supervisorName || 'Supervisor',
          plannedAllocationTons: 5000
        };
      }

      const res = await apiFetch(`/api/tenant/operations/${changeReqModalOp.id}/change-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeType: changeReqForm.changeType,
          summary: changeReqForm.summary || `Request change for ${changeReqModalOp.name}`,
          proposedChanges: proposedPayload,
          currentValues: {
            corridorName: changeReqModalOp.corridorName,
            plannedQuantityTons: changeReqModalOp.plannedQuantityTons
          }
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit change request');
      }

      setActionSuccessMsg('Change request submitted for Admin / HR approval!');
      setChangeReqModalOp(null);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // Metrics computation
  const activeOpsCount = operations.filter(o => o.status === 'Running' || o.status === 'Active').length;
  const totalActiveVehicles = operations.reduce((acc, o) => acc + (parseInt(o.activeVehiclesCount, 10) || 0), 0);
  const totalDispatched = operations.reduce((acc, o) => acc + (parseFloat(o.dispatchedQuantityTons) || 0), 0);
  const totalReceived = operations.reduce((acc, o) => acc + (parseFloat(o.receivedQuantityTons) || 0), 0);

  const filteredOps = operations.filter(o => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      o.name?.toLowerCase().includes(term) ||
      o.opCode?.toLowerCase().includes(term) ||
      o.projectName?.toLowerCase().includes(term) ||
      o.materialName?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Route className="w-7 h-7 text-[#00705a]" />
            Operations Command Center
          </h1>
          <p className="text-sm text-slate-500">
            Monitor running corridor dispatches, track in-transit consignments, and execute live receiving
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/tenant/operations/approvals"
            className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            Approvals Inbox
          </Link>

          <Link
            to="/tenant/operations/new"
            className="px-4 py-2 bg-[#00705a] hover:bg-[#005a48] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Design New Operation
          </Link>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          {actionSuccessMsg}
        </div>
      )}

      {/* Panoramic Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Running Operations</span>
            <Route className="w-4 h-4 text-[#00705a]" />
          </div>
          <div className="text-2xl font-black text-slate-900">{activeOpsCount}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active corridor execution
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Vehicles In-Transit</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalActiveVehicles}</div>
          <div className="text-[11px] text-blue-600 font-semibold mt-1">Dispatched & moving right now</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Dispatched</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalDispatched.toLocaleString()} MT</div>
          <div className="text-[11px] text-slate-500 mt-1">Loaded across all operations</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Received</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalReceived.toLocaleString()} MT</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">Credited into stockyards</div>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('CURRENT')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'CURRENT'
                  ? 'bg-[#00705a] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Current Operations ({activeOpsCount})
            </button>

            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'ALL'
                  ? 'bg-[#00705a] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Operations ({operations.length})
            </button>
          </div>

          {/* Search & Project Filter */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search operation, code, material..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-56 outline-none focus:bg-white focus:ring-2 focus:ring-[#00705a]"
              />
            </div>

            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700"
            >
              <option value="ALL">All Projects</option>
              {resources.projects?.map((p: any) => (
                <option key={p.id} value={p.id}>{p.projectName}</option>
              ))}
            </select>

            <button
              onClick={fetchOperations}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TAB 1: CURRENT OPERATIONS (CARDS VIEW) */}
        {activeTab === 'CURRENT' && (
          <div>
            {loading ? (
              <div className="p-12 text-center text-slate-400">Loading active operations...</div>
            ) : filteredOps.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Route className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">No active running operations found</p>
                <p className="text-xs">Click "Design New Operation" to start and launch corridor operations.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredOps.map(op => {
                  const planned = parseFloat(op.plannedQuantityTons) || 1;
                  const received = parseFloat(op.receivedQuantityTons) || 0;
                  const dispatched = parseFloat(op.dispatchedQuantityTons) || 0;
                  const pct = Math.min(100, Math.round((received / planned) * 100));

                  return (
                    <div
                      key={op.id}
                      className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 shadow-sm space-y-4 transition-all"
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded">
                              {op.opCode}
                            </span>
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              RUNNING
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {op.transportMode === 'TRAIN_RAKE' ? 'Rail Rake' : 'Road Fleet'}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-slate-900">{op.name}</h3>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {op.projectName} · <span className="font-semibold text-slate-700">{op.materialName}</span>
                          </p>
                        </div>

                        {/* In-Transit Badge */}
                        <div className="text-right">
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5" />
                            {op.activeVehiclesCount || 0} in-transit
                          </span>
                        </div>
                      </div>

                      {/* Route Path Indicator */}
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-slate-700 font-semibold truncate max-w-[40%]">
                          <MapPin className="w-3.5 h-3.5 text-[#00705a] shrink-0" />
                          <span className="truncate">{op.originName}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mx-1" />
                        <div className="text-center text-[10px] text-slate-400 font-medium truncate max-w-[20%]">
                          {op.corridorName || 'Corridor Direct'}
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mx-1" />
                        <div className="flex items-center gap-1.5 text-slate-700 font-semibold truncate max-w-[40%] justify-end">
                          <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{op.stockyardsCount || 1} Dest. Stockyards</span>
                        </div>
                      </div>

                      {/* Progress & Metrics */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Delivery Completion</span>
                          <span className="font-bold text-slate-800">{pct}% ({received.toLocaleString()} / {planned.toLocaleString()} MT)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                          <div
                            className="bg-[#00705a] h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                          <span>Dispatched: <strong className="text-slate-700">{dispatched.toLocaleString()} MT</strong></span>
                          <span>In-Transit: <strong className="text-blue-600">{Math.max(0, dispatched - received).toLocaleString()} MT</strong></span>
                        </div>
                      </div>

                      {/* Action Desk Buttons */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleOpenTracking(op.id)}
                          className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Track Live
                        </button>

                        <button
                          onClick={() => handleOpenDispatch(op)}
                          className="py-1.5 px-2 bg-[#00705a] hover:bg-[#005a48] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-sm"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          + Dispatch
                        </button>

                        <button
                          onClick={() => handleOpenReceive(op)}
                          className="py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-sm"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          Receive & Unload
                        </button>

                        <button
                          onClick={() => handleOpenChangeRequest(op)}
                          className="py-1.5 px-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          Request Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ALL OPERATIONS (TABLE VIEW) */}
        {activeTab === 'ALL' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Code / Operation</th>
                  <th className="py-3 px-4">Project & Material</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Planned</th>
                  <th className="py-3 px-4">Dispatched</th>
                  <th className="py-3 px-4">Received</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOps.map(op => (
                  <tr key={op.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{op.name}</div>
                      <div className="font-mono text-[10px] text-slate-400 font-bold">{op.opCode}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{op.projectName}</div>
                      <div className="text-[11px] text-[#00705a] font-semibold">{op.materialName}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                        {op.transportMode === 'TRAIN_RAKE' ? 'Rail Rake' : 'Truck'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {parseFloat(op.plannedQuantityTons || 0).toLocaleString()} MT
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {parseFloat(op.dispatchedQuantityTons || 0).toLocaleString()} MT
                    </td>
                    <td className="py-3 px-4 text-emerald-600 font-bold">
                      {parseFloat(op.receivedQuantityTons || 0).toLocaleString()} MT
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        op.status === 'Running' || op.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {op.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenTracking(op.id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold"
                      >
                        Track
                      </button>
                      <button
                        onClick={() => handleOpenDispatch(op)}
                        className="px-2.5 py-1 bg-[#00705a] text-white hover:bg-[#005a48] rounded text-xs font-bold"
                      >
                        Dispatch
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. PANORAMIC LIVE TRACKING MODAL                                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {trackingModalOpId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                  {trackingDetail?.opCode || 'Operation Details'}
                </span>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Route className="w-5 h-5 text-[#00705a]" />
                  {trackingDetail?.name || 'Loading Tracking View...'}
                </h2>
              </div>
              <button
                onClick={() => setTrackingModalOpId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalLoading || !trackingDetail ? (
              <div className="p-12 text-center text-slate-400">Loading panoramic tracking data...</div>
            ) : (
              <div className="space-y-6">
                {/* Visual Path Flow */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-600 uppercase">Consignment Route Topology</h4>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="p-3 bg-white border border-slate-200 rounded-lg flex-1 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Origin Station</div>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">{trackingDetail.originName}</div>
                      <div className="text-[11px] text-slate-500 font-medium">Type: {trackingDetail.originType}</div>
                    </div>

                    <ArrowRight className="w-5 h-5 text-slate-400 hidden sm:block shrink-0" />

                    <div className="p-3 bg-white border border-slate-200 rounded-lg flex-1 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Active Corridor</div>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">{trackingDetail.corridorName || 'Direct Relay'}</div>
                      <div className="text-[11px] text-blue-600 font-medium">{trackingDetail.transportMode} Transit</div>
                    </div>

                    <ArrowRight className="w-5 h-5 text-slate-400 hidden sm:block shrink-0" />

                    <div className="p-3 bg-white border border-slate-200 rounded-lg flex-1 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Destination Stockyards</div>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">
                        {trackingDetail.stockyards?.map((s: any) => s.stockyardName).join(', ') || 'Main Yard'}
                      </div>
                      <div className="text-[11px] text-emerald-600 font-medium">
                        {trackingDetail.stockyards?.length || 1} Linked Yards
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Trips / Consignments Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-blue-600" />
                      Live Dispatches & Consignment Status ({trackingDetail.trips?.length || 0})
                    </h4>
                  </div>

                  {trackingDetail.trips?.length === 0 ? (
                    <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                      No vehicles or rakes have been dispatched for this operation yet. Click "+ Dispatch" to start.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
                            <th className="py-2.5 px-3">Vehicle / Wagon</th>
                            <th className="py-2.5 px-3">Driver</th>
                            <th className="py-2.5 px-3">Gross / Net (MT)</th>
                            <th className="py-2.5 px-3">Destination Yard</th>
                            <th className="py-2.5 px-3">Current Stage</th>
                            <th className="py-2.5 px-3">Dispatched At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {trackingDetail.trips.map((t: any) => (
                            <tr key={t.id} className="hover:bg-slate-50/80">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900">{t.vehicleNumber}</div>
                                <div className="text-[10px] font-mono text-slate-400">{t.tripNumber}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-slate-800">{t.driverName}</div>
                                <div className="text-[10px] text-slate-500">{t.driverPhone || '—'}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900">{parseFloat(t.netWeight || 0).toFixed(2)} MT</div>
                                <div className="text-[10px] text-slate-400">Gross: {t.grossWeight} MT</div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">
                                {t.destinationStockyardName || 'Stockyard'}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  t.currentStage === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                  {t.currentStage}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                {new Date(t.dispatchedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. SUPERVISOR DISPATCH MODAL                                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {dispatchModalOp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                  {dispatchModalOp.opCode}
                </span>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#00705a]" />
                  Loading & Dispatch Desk ({dispatchModalOp.materialName})
                </h2>
              </div>
              <button onClick={() => setDispatchModalOp(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="space-y-4">
              {/* Fleet Selection Mode */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDispatchForm(prev => ({ ...prev, isTemporary: false, vehicleNumber: '' }))}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                    !dispatchForm.isTemporary ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Company Vehicle (Fleet)
                </button>
                <button
                  type="button"
                  onClick={() => setDispatchForm(prev => ({ ...prev, isTemporary: true, vehicleId: '' }))}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                    dispatchForm.isTemporary ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Temporary / Hired Vehicle
                </button>
              </div>

              {/* Vehicle & Driver Input */}
              {!dispatchForm.isTemporary ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Select Company Vehicle</label>
                  <select
                    value={dispatchForm.vehicleId}
                    onChange={e => handleSelectVehicle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
                    required
                  >
                    <option value="">Select fleet vehicle...</option>
                    {resources.vehicles?.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.registrationNumber} ({v.vehicleType} · {v.driverName || 'Driver'})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Vehicle Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. MH-12-AB-1234"
                      value={dispatchForm.vehicleNumber}
                      onChange={e => setDispatchForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none uppercase"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Driver Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Singh"
                      value={dispatchForm.driverName}
                      onChange={e => setDispatchForm(prev => ({ ...prev, driverName: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Driver Mobile</label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={dispatchForm.driverPhone}
                      onChange={e => setDispatchForm(prev => ({ ...prev, driverPhone: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Rail Rake Specific Fields */}
              {dispatchForm.transportMode === 'TRAIN_RAKE' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-900 mb-1">Train Number</label>
                    <input
                      type="text"
                      placeholder="e.g. TR-9941"
                      value={dispatchForm.trainNumber}
                      onChange={e => setDispatchForm(prev => ({ ...prev, trainNumber: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-900 mb-1">Rake Number</label>
                    <input
                      type="text"
                      placeholder="e.g. RK-204"
                      value={dispatchForm.rakeNumber}
                      onChange={e => setDispatchForm(prev => ({ ...prev, rakeNumber: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-900 mb-1">Wagon Numbers (csv)</label>
                    <input
                      type="text"
                      placeholder="W1, W2, W3..."
                      value={dispatchForm.wagonNumbers}
                      onChange={e => setDispatchForm(prev => ({ ...prev, wagonNumbers: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded text-xs outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Weights & Invoices */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Gross Weight (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="35.50"
                    value={dispatchForm.grossWeight}
                    onChange={e => setDispatchForm(prev => ({ ...prev, grossWeight: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Tare Weight (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="12.00"
                    value={dispatchForm.tareWeight}
                    onChange={e => setDispatchForm(prev => ({ ...prev, tareWeight: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Calculated Net (MT)</label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-900">
                    {Math.max(0, (parseFloat(dispatchForm.grossWeight) || 0) - (parseFloat(dispatchForm.tareWeight) || 0)).toFixed(2)} MT
                  </div>
                </div>
              </div>

              {/* Destination Yard & Invoices */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Destination Stockyard</label>
                  <select
                    value={dispatchForm.destinationStockyardId}
                    onChange={e => setDispatchForm(prev => ({ ...prev, destinationStockyardId: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
                    required
                  >
                    <option value="">Select destination yard...</option>
                    {resources.stockyards?.map((y: any) => (
                      <option key={y.id} value={y.id}>{y.yardName} ({y.location})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Invoice / Challan #</label>
                  <input
                    type="text"
                    value={dispatchForm.challanNumber}
                    onChange={e => setDispatchForm(prev => ({ ...prev, challanNumber: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDispatchModalOp(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 bg-[#00705a] hover:bg-[#005a48] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Dispatch into Transit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. SUPERVISOR RECEIVE & UNLOAD MODAL                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {receiveModalOp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                  {receiveModalOp.opCode}
                </span>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-blue-600" />
                  Receiving & Stockyard Unloading Desk
                </h2>
              </div>
              <button onClick={() => setReceiveModalOp(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!selectedTripToReceive ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No consignments currently in-transit for this operation.
              </div>
            ) : (
              <form onSubmit={handleReceiveSubmit} className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-blue-700 font-bold uppercase">Incoming Consignment</span>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">{selectedTripToReceive.vehicleNumber}</div>
                    <div className="text-[11px] text-slate-600 font-medium">Waybill: {selectedTripToReceive.waybillNumber}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase">Dispatched Net</span>
                    <div className="font-black text-slate-900 text-sm">{selectedTripToReceive.netWeight} MT</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Received Gross (MT)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={receiveForm.receivedGrossWeight}
                      onChange={e => setReceiveForm(prev => ({ ...prev, receivedGrossWeight: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Received Tare (MT)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={receiveForm.receivedTareWeight}
                      onChange={e => setReceiveForm(prev => ({ ...prev, receivedTareWeight: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Stock Point Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Receiving Stockyard</label>
                    <select
                      value={receiveForm.destinationStockyardId}
                      onChange={e => setReceiveForm(prev => ({ ...prev, destinationStockyardId: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
                      required
                    >
                      {resources.stockyards?.map((y: any) => (
                        <option key={y.id} value={y.id}>{y.yardName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Stock Point / Rack / Pile</label>
                    <select
                      value={receiveForm.destinationStockPointId}
                      onChange={e => {
                        const pt = resources.stockPoints?.find((p: any) => String(p.id) === e.target.value);
                        setReceiveForm(prev => ({
                          ...prev,
                          destinationStockPointId: e.target.value,
                          destinationStockPointName: pt?.rackName || ''
                        }));
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
                    >
                      <option value="">General Inward Bay</option>
                      {resources.stockPoints?.filter((p: any) => String(p.stockyardId) === String(receiveForm.destinationStockyardId)).map((pt: any) => (
                        <option key={pt.id} value={pt.id}>{pt.rackName} ({pt.materialType})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Heavy Equipment Used */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">Unloading Machinery Used</label>
                    <select
                      value={receiveForm.machineryId}
                      onChange={e => {
                        const m = resources.machinery?.find((item: any) => String(item.id) === e.target.value);
                        setReceiveForm(prev => ({
                          ...prev,
                          machineryId: e.target.value,
                          machineryName: m ? `${m.machineCode} - ${m.machineName}` : ''
                        }));
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-800 outline-none"
                    >
                      <option value="">None / Manual Unloading</option>
                      {resources.machinery?.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.machineCode} - {m.machineName} ({m.category || 'Machinery'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">Machine Operating Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      value={receiveForm.machineryHoursUsed}
                      onChange={e => setReceiveForm(prev => ({ ...prev, machineryHoursUsed: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-800 outline-none"
                      placeholder="1.0"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setReceiveModalOp(null)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm & Credit to Stockyard
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. CHANGE REQUEST MODAL (PROJECT MANAGER -> ADMIN/HR)             */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {changeReqModalOp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                Submit Operation Change Request
              </h2>
              <button onClick={() => setChangeReqModalOp(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangeRequestSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Change Type</label>
                <select
                  value={changeReqForm.changeType}
                  onChange={e => setChangeReqForm(prev => ({ ...prev, changeType: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
                >
                  <option value="ROUTE_CHANGE">Reroute / Change Corridor</option>
                  <option value="ADD_STOCKYARD">Add Destination Stockyard</option>
                  <option value="QUANTITY_CHANGE">Modify Planned Tonnage</option>
                  <option value="GENERAL_EDIT">General Operation Edit</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Summary Reason *</label>
                <input
                  type="text"
                  placeholder="e.g. NHAI road block requires diversion via Corridor 19"
                  value={changeReqForm.summary}
                  onChange={e => setChangeReqForm(prev => ({ ...prev, summary: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
                  required
                />
              </div>

              {changeReqForm.changeType === 'ADD_STOCKYARD' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Select Stockyard to Add</label>
                  <select
                    value={changeReqForm.newStockyardId}
                    onChange={e => setChangeReqForm(prev => ({ ...prev, newStockyardId: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
                  >
                    <option value="">Select stockyard...</option>
                    {resources.stockyards?.map((y: any) => (
                      <option key={y.id} value={y.id}>{y.yardName} ({y.location})</option>
                    ))}
                  </select>
                </div>
              )}

              {changeReqForm.changeType === 'ROUTE_CHANGE' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Proposed Route / Corridor Name</label>
                  <input
                    type="text"
                    value={changeReqForm.proposedCorridorName}
                    onChange={e => setChangeReqForm(prev => ({ ...prev, proposedCorridorName: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setChangeReqModalOp(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Submit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
