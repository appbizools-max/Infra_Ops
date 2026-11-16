import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, AlertCircle, Plus, Trash2,
  Route, Truck, Train, Layers, MapPin, User, Shield, Briefcase
} from 'lucide-react';
import { apiFetch } from '../../../lib/api';

export default function NewOperationPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [opCode, setOpCode] = useState(`OP-${Math.floor(1000 + Math.random() * 9000)}`);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [materialName, setMaterialName] = useState('Aggregates');
  const [unitOfMeasure, setUnitOfMeasure] = useState('MT');
  const [transportMode, setTransportMode] = useState<'TRUCK' | 'TRAIN_RAKE'>('TRUCK');
  const [originType, setOriginType] = useState('WORKSITE');
  const [originName, setOriginName] = useState('');
  const [selectedCorridorId, setSelectedCorridorId] = useState('');
  const [plannedQuantityTons, setPlannedQuantityTons] = useState('25000');
  const [overallSupervisorUid, setOverallSupervisorUid] = useState('');
  const [remarks, setRemarks] = useState('');

  // Stockyards array
  const [assignedStockyards, setAssignedStockyards] = useState<Array<{
    stockyardId: number;
    stockyardName: string;
    supervisorUid: string;
    supervisorName: string;
    supervisorPhone: string;
    targetStockPointId: number | null;
    targetStockPointName: string;
    plannedAllocationTons: string;
  }>>([]);

  // Resources Data
  const [resources, setResources] = useState<{
    projects: any[];
    stockyards: any[];
    stockPoints: any[];
    corridors: any[];
    supervisors: any[];
  }>({
    projects: [],
    stockyards: [],
    stockPoints: [],
    corridors: [],
    supervisors: []
  });

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      setResourcesLoading(true);
      const res = await apiFetch('/api/tenant/operations-resources');
      if (res.ok) {
        const data = await res.json();
        setResources(data);
        if (data.projects?.length > 0) {
          setSelectedProjectId(data.projects[0].id);
        }
        if (data.stockyards?.length > 0) {
          setOriginName(data.stockyards[0].yardName || 'Main Quarry / Pit');
        }
      }
    } catch (err: any) {
      console.error('Error fetching resources:', err);
    } finally {
      setResourcesLoading(false);
    }
  };

  const handleAddStockyard = () => {
    if (resources.stockyards.length === 0) return;
    const defaultYard = resources.stockyards[0];
    const yardPoints = resources.stockPoints.filter(p => p.stockyardId === defaultYard.id);
    
    setAssignedStockyards(prev => [
      ...prev,
      {
        stockyardId: defaultYard.id,
        stockyardName: defaultYard.yardName,
        supervisorUid: defaultYard.supervisorPhone ? defaultYard.supervisorPhone : (resources.supervisors[0]?.id || ''),
        supervisorName: defaultYard.supervisorName || (resources.supervisors[0]?.name || 'Supervisor'),
        supervisorPhone: defaultYard.supervisorPhone || '',
        targetStockPointId: yardPoints.length > 0 ? yardPoints[0].id : null,
        targetStockPointName: yardPoints.length > 0 ? yardPoints[0].rackName : '',
        plannedAllocationTons: '5000'
      }
    ]);
  };

  const handleUpdateStockyard = (index: number, field: string, value: any) => {
    setAssignedStockyards(prev => {
      const copy = [...prev];
      const target = { ...copy[index] };

      if (field === 'stockyardId') {
        const yardId = Number(value);
        const yard = resources.stockyards.find(y => y.id === yardId);
        target.stockyardId = yardId;
        target.stockyardName = yard ? yard.yardName : '';
        target.supervisorName = yard?.supervisorName || target.supervisorName;
        target.supervisorPhone = yard?.supervisorPhone || target.supervisorPhone;

        // Auto select first stock point
        const points = resources.stockPoints.filter(p => p.stockyardId === yardId);
        if (points.length > 0) {
          target.targetStockPointId = points[0].id;
          target.targetStockPointName = points[0].rackName;
        } else {
          target.targetStockPointId = null;
          target.targetStockPointName = '';
        }
      } else if (field === 'supervisorUid') {
        const sup = resources.supervisors.find(s => String(s.id) === String(value) || s.firebaseUid === value);
        target.supervisorUid = value;
        target.supervisorName = sup?.name || '';
        target.supervisorPhone = sup?.mobile || '';
      } else if (field === 'targetStockPointId') {
        const pt = resources.stockPoints.find(p => p.id === Number(value));
        target.targetStockPointId = Number(value);
        target.targetStockPointName = pt?.rackName || '';
      } else {
        (target as any)[field] = value;
      }

      copy[index] = target;
      return copy;
    });
  };

  const handleRemoveStockyard = (index: number) => {
    setAssignedStockyards(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a name for this Operation.');
      return;
    }
    if (!originName.trim()) {
      setError('Origin location / start point is required.');
      return;
    }
    if (assignedStockyards.length === 0) {
      setError('Please add at least one destination stockyard for this operation.');
      return;
    }

    const selectedProj = resources.projects.find(p => String(p.id) === String(selectedProjectId));
    const selectedCorridor = resources.corridors.find(c => String(c.id) === String(selectedCorridorId));
    const overallSup = resources.supervisors.find(s => String(s.id) === String(overallSupervisorUid) || s.firebaseUid === overallSupervisorUid);

    const payload = {
      name,
      opCode,
      projectId: selectedProjectId,
      projectName: selectedProj?.projectName || 'General Project',
      materialName,
      unitOfMeasure,
      transportMode,
      originType,
      originName,
      corridorId: selectedCorridorId ? Number(selectedCorridorId) : null,
      corridorName: selectedCorridor?.name || null,
      overallSupervisorUid: overallSupervisorUid || null,
      overallSupervisorName: overallSup?.name || null,
      overallSupervisorPhone: overallSup?.mobile || null,
      plannedQuantityTons: parseFloat(plannedQuantityTons) || 0,
      remarks,
      stockyards: assignedStockyards
    };

    try {
      setLoading(true);
      const res = await apiFetch('/api/tenant/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create operation');
      }

      navigate('/tenant/operations');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/tenant/operations"
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Route className="w-6 h-6 text-[#00705a]" />
              Design New Operation
            </h1>
            <p className="text-sm text-slate-500">
              Configure origin, transport route corridors, material requirements, and multi-stockyard supervisors
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Operation Master Blueprint */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Briefcase className="w-4 h-4 text-[#00705a]" />
            1. Operation Blueprint & Core Metadata
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Operation Code</label>
              <input
                type="text"
                value={opCode}
                onChange={e => setOpCode(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 font-bold focus:ring-2 focus:ring-[#00705a] outline-none"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Operation Name</label>
              <input
                type="text"
                placeholder="e.g. NHAI Corridor 14 - Crushed Aggregates Movement"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-[#00705a] outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Associated Project</label>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-[#00705a] outline-none"
                required
              >
                {resources.projects.map(p => (
                  <option key={p.id} value={p.id}>{p.projectName} ({p.projectCode || p.id})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Material Type</label>
              <input
                type="text"
                placeholder="e.g. GSB Base Metal / 20mm Aggregate / Iron Ore"
                value={materialName}
                onChange={e => setMaterialName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-[#00705a] outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Transport Mode</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTransportMode('TRUCK')}
                  className={`flex-1 py-2.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    transportMode === 'TRUCK'
                      ? 'bg-[#00705a] text-white border-[#00705a] shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  Road / Truck
                </button>
                <button
                  type="button"
                  onClick={() => setTransportMode('TRAIN_RAKE')}
                  className={`flex-1 py-2.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    transportMode === 'TRAIN_RAKE'
                      ? 'bg-[#00705a] text-white border-[#00705a] shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Train className="w-4 h-4" />
                  Rail / Train Rake
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Origin, Corridor & Overall Supervisor */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
            <MapPin className="w-4 h-4 text-[#00705a]" />
            2. Origin & Route Corridors
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Origin Type</label>
              <select
                value={originType}
                onChange={e => setOriginType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-[#00705a] outline-none"
              >
                <option value="WORKSITE">Work Site / Construction Pit</option>
                <option value="STOCKYARD">Source Stockyard Hub</option>
                <option value="MINING_PIT">Mining Quarry / Crusher</option>
                <option value="SUPPLIER_PLANT">Supplier Plant / Siding</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Origin Start Point Name</label>
              <input
                type="text"
                placeholder="e.g. Quarry Pit Alpha / Site North Gate"
                value={originName}
                onChange={e => setOriginName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-[#00705a] outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Operations Corridor</label>
              <select
                value={selectedCorridorId}
                onChange={e => setSelectedCorridorId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-[#00705a] outline-none"
              >
                <option value="">Select Corridor (Optional)</option>
                {resources.corridors.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.corridorCode})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Total Planned Tonnage ({unitOfMeasure})</label>
              <input
                type="number"
                value={plannedQuantityTons}
                onChange={e => setPlannedQuantityTons(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#00705a] outline-none"
                placeholder="25000"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Overall Operation Supervisor</label>
              <select
                value={overallSupervisorUid}
                onChange={e => setOverallSupervisorUid(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-[#00705a] outline-none"
              >
                <option value="">Select Overall Lead Supervisor</option>
                {resources.supervisors.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.designation || 'Staff'} · {s.mobile})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Destination Stockyards & Multi-Supervisor Assignment */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#00705a]" />
                3. Destination Stockyards & Receiving Supervisors
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign one or more destination yards. You can assign the same supervisor across all yards, or distinct supervisors per yard.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddStockyard}
              className="px-3 py-1.5 bg-[#00705a]/10 text-[#00705a] hover:bg-[#00705a]/20 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Stockyard Hub
            </button>
          </div>

          {assignedStockyards.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 space-y-2">
              <Layers className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No destination stockyards added yet</p>
              <p className="text-xs">Click "+ Add Stockyard Hub" above to link a receiving stockyard and supervisor.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignedStockyards.map((sy, idx) => {
                const yardPoints = resources.stockPoints.filter(p => p.stockyardId === sy.stockyardId);

                return (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#00705a] text-white flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        Stockyard Destination
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStockyard(idx)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Target Stockyard</label>
                        <select
                          value={sy.stockyardId}
                          onChange={e => handleUpdateStockyard(idx, 'stockyardId', e.target.value)}
                          className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
                        >
                          {resources.stockyards.map(y => (
                            <option key={y.id} value={y.id}>{y.yardName} ({y.location || 'Yard'})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Receiving Supervisor</label>
                        <select
                          value={sy.supervisorUid}
                          onChange={e => handleUpdateStockyard(idx, 'supervisorUid', e.target.value)}
                          className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
                        >
                          <option value="">Default (Yard Supervisor)</option>
                          {resources.supervisors.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.designation || 'Staff'})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Stock Point / Pile</label>
                        <select
                          value={sy.targetStockPointId || ''}
                          onChange={e => handleUpdateStockyard(idx, 'targetStockPointId', e.target.value)}
                          className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
                        >
                          <option value="">General Inward Bay</option>
                          {yardPoints.map(pt => (
                            <option key={pt.id} value={pt.id}>{pt.rackName} ({pt.materialType || 'General'})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Planned Allocation ({unitOfMeasure})</label>
                        <input
                          type="number"
                          value={sy.plannedAllocationTons}
                          onChange={e => handleUpdateStockyard(idx, 'plannedAllocationTons', e.target.value)}
                          className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                          placeholder="5000"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 4: Operational Remarks & Submit */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <label className="block text-xs font-semibold text-slate-600 uppercase">Operational Protocol & Remarks</label>
          <textarea
            rows={3}
            placeholder="Special instructions for weighbridge calibration, moisture check, or conveyor dispatch..."
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-[#00705a] outline-none"
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Link
              to="/tenant/operations"
              className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-[#00705a] hover:bg-[#005a48] text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              {loading ? (
                <>Saving Operation...</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Launch Operation
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
