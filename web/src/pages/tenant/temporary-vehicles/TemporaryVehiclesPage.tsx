import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';
import {
  Truck,
  Clock,
  Calendar,
  IndianRupee,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  XCircle,
  X,
  User,
  Phone,
  Briefcase,
  MapPin,
  RefreshCw,
  Trash2,
  ChevronRight,
  Activity,
  Gauge,
  Layers,
  FileText,
  TrendingUp,
  Info
} from 'lucide-react';

interface TemporaryVehicle {
  id: number;
  tenantId: string;
  vehicleNumber: string;
  vehicleType: string;
  vendorName: string;
  vendorPhone?: string;
  projectId: string;
  projectName: string;
  worksiteId?: string;
  worksiteName?: string;
  driverName?: string;
  driverPhone?: string;
  rateType: 'hourly' | 'daily' | 'trip' | string;
  agreedRate: number | string;
  standbyRate: number | string;
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Standby' | 'Released' | string;
  remarks?: string;
  totalRunningMinutes?: number;
  totalIdleMinutes?: number;
  totalCalculatedCost?: number | string;
  logsCount?: number;
  lastLogDate?: string;
  createdAt?: string;
}

interface RunningLog {
  id: number;
  temporaryVehicleId: number;
  projectId: string;
  projectName: string;
  logDate: string;
  shift: 'Day' | 'Night' | string;
  startTime: string;
  endTime: string;
  idleBreakMinutes: number;
  runningMinutes: number;
  idleMinutes: number;
  startMeter: number | string;
  endMeter: number | string;
  calculatedCost: number | string;
  operatorName?: string;
  workDescription?: string;
  status: string;
  createdAt: string;
}

interface CalculationSummary {
  totalVehicles: number;
  activeVehicles: number;
  standbyVehicles: number;
  releasedVehicles: number;
  totalRunningHours: number;
  totalRunningHoursFormatted: string;
  totalIdleHours: number;
  totalIdleHoursFormatted: string;
  totalCost: number;
  projectRollup: Array<{
    projectName: string;
    vehicleCount: number;
    runningMinutes: number;
    runningHours: number;
    runningHoursFormatted: string;
    totalCost: number;
  }>;
}

export default function TemporaryVehiclesPage() {
  const { currentUser } = useAuth();
  const [vehicles, setVehicles] = useState<TemporaryVehicle[]>([]);
  const [summary, setSummary] = useState<CalculationSummary>({
    totalVehicles: 0,
    activeVehicles: 0,
    standbyVehicles: 0,
    releasedVehicles: 0,
    totalRunningHours: 0,
    totalRunningHoursFormatted: '0h 00m',
    totalIdleHours: 0,
    totalIdleHoursFormatted: '0h 00m',
    totalCost: 0,
    projectRollup: []
  });
  const [projectsList, setProjectsList] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<TemporaryVehicle | null>(null);
  const [vehicleLogs, setVehicleLogs] = useState<RunningLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // New Vehicle Form State
  const [newVehicle, setNewVehicle] = useState({
    vehicleNumber: '',
    vehicleType: 'Tipper (16 Ton)',
    vendorName: '',
    vendorPhone: '',
    projectId: '',
    projectName: '',
    worksiteName: '',
    driverName: '',
    driverPhone: '',
    rateType: 'hourly',
    agreedRate: '',
    standbyRate: '',
    startDate: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  // Log Shift Running Time Form State
  const [logForm, setLogForm] = useState({
    logDate: new Date().toISOString().split('T')[0],
    shift: 'Day',
    startTime: '08:00',
    endTime: '17:30',
    idleBreakMinutes: '60',
    startMeter: '',
    endMeter: '',
    operatorName: '',
    workDescription: 'Project material movement and site support'
  });

  // Computed Running Time & Cost in Log Modal
  const logModalCalculations = useMemo(() => {
    if (!selectedVehicle) return { runningHours: 0, runningMinutes: 0, idleMinutes: 0, cost: 0 };
    const [sh, sm] = (logForm.startTime || '08:00').split(':').map(n => parseInt(n, 10));
    const [eh, em] = (logForm.endTime || '17:30').split(':').map(n => parseInt(n, 10));
    let startM = (sh * 60) + (sm || 0);
    let endM = (eh * 60) + (em || 0);
    if (endM < startM) endM += 24 * 60;
    const totalSpan = endM - startM;
    const idleM = parseInt(logForm.idleBreakMinutes, 10) || 0;
    const runningM = Math.max(0, totalSpan - idleM);
    const agreed = parseFloat(String(selectedVehicle.agreedRate)) || 0;
    const standby = parseFloat(String(selectedVehicle.standbyRate)) || 0;
    const cost = ((runningM / 60) * agreed) + ((idleM / 60) * standby);
    return {
      runningMinutes: runningM,
      runningHours: Number((runningM / 60).toFixed(2)),
      runningHoursFormatted: `${Math.floor(runningM / 60)}h ${runningM % 60}m`,
      idleMinutes: idleM,
      cost: Number(cost.toFixed(2))
    };
  }, [selectedVehicle, logForm.startTime, logForm.endTime, logForm.idleBreakMinutes]);

  const fetchVehicles = async () => {
    try {
      setRefreshing(true);
      const params = new URLSearchParams();
      if (selectedProject !== 'ALL') params.append('projectId', selectedProject);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await apiFetch(`/api/tenant/temporary-vehicles?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to fetch temporary vehicles:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchProjects = async () => {
    if (!currentUser) return;
    try {
      const res = await apiFetch(`/api/tenant/projects/${currentUser.uid}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setProjectsList(data.map((p: any) => ({ id: p.id || p.project_id, name: p.name })));
          if (!newVehicle.projectId) {
            setNewVehicle(prev => ({
              ...prev,
              projectId: data[0].id || data[0].project_id,
              projectName: data[0].name
            }));
          }
        } else {
          setProjectsList([]);
        }
      }
    } catch (err) {
      setProjectsList([]);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [selectedProject, selectedStatus]);

  useEffect(() => {
    fetchProjects();
  }, [currentUser]);

  const handleOpenAddModal = () => {
    if (projectsList.length > 0) {
      setNewVehicle(prev => ({
        ...prev,
        projectId: projectsList[0].id,
        projectName: projectsList[0].name
      }));
    }
    setIsAddModalOpen(true);
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle.vehicleNumber.trim() || !newVehicle.vendorName.trim()) {
      alert('Please fill in required fields (Vehicle Number & Vendor Name)');
      return;
    }
    try {
      const res = await apiFetch('/api/tenant/temporary-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVehicle)
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        setNewVehicle({
          vehicleNumber: '',
          vehicleType: 'Tipper (16 Ton)',
          vendorName: '',
          vendorPhone: '',
          projectId: projectsList[0]?.id || 'PRJ-001',
          projectName: projectsList[0]?.name || 'Delhi Metro Rail Project (Phase IV)',
          worksiteName: 'Main Site Yard',
          driverName: '',
          driverPhone: '',
          rateType: 'hourly',
          agreedRate: '1200',
          standbyRate: '350',
          startDate: new Date().toISOString().split('T')[0],
          remarks: ''
        });
        fetchVehicles();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Failed to add temporary vehicle'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  const handleOpenLogModal = (v: TemporaryVehicle) => {
    setSelectedVehicle(v);
    setLogForm({
      logDate: new Date().toISOString().split('T')[0],
      shift: 'Day',
      startTime: '08:00',
      endTime: '17:30',
      idleBreakMinutes: '60',
      startMeter: '',
      endMeter: '',
      operatorName: v.driverName || '',
      workDescription: `Project support on ${v.projectName}`
    });
    setIsLogModalOpen(true);
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;
    try {
      const res = await apiFetch(`/api/tenant/temporary-vehicles/${selectedVehicle.id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logForm)
      });
      if (res.ok) {
        setIsLogModalOpen(false);
        fetchVehicles();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Failed to save running time log'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  const handleOpenHistory = async (v: TemporaryVehicle) => {
    setSelectedVehicle(v);
    setIsHistoryModalOpen(true);
    setLogsLoading(true);
    try {
      const res = await apiFetch(`/api/tenant/temporary-vehicles/${v.id}/logs`);
      if (res.ok) {
        const logs = await res.json();
        setVehicleLogs(logs);
      }
    } catch (err) {
      console.error('Failed to fetch vehicle logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleStatusToggle = async (v: TemporaryVehicle, newStatus: string) => {
    try {
      const res = await apiFetch(`/api/tenant/temporary-vehicles/${v.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchVehicles();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDeleteVehicle = async (id: number) => {
    if (!confirm('Are you sure you want to remove this temporary vehicle?')) return;
    try {
      const res = await apiFetch(`/api/tenant/temporary-vehicles/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchVehicles();
      }
    } catch (err) {
      console.error('Failed to delete vehicle:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-[#F8FAFC] min-h-screen">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-widest mb-1">
            <Truck className="w-4 h-4" />
            Fleet & Logistics Management
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Temporary & Hired Fleet
            <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-1 rounded-full border border-emerald-200">
              Live Running Time & Rental Cost
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track hired dumpers, transit mixers, tippers and machinery deployed to active projects with shift-based running time calculations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchVehicles}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-black text-sm shadow-md shadow-emerald-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            + Add Temporary Vehicle
          </button>
        </div>
      </div>

      {/* ── 4 CALCULATION TILES & RUNNING TIME METRICS ─────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Hired Assets */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hired Fleet Count</div>
            <div className="text-3xl font-black text-slate-900 mt-1">
              {summary.totalVehicles}
              <span className="text-xs font-bold text-slate-400 ml-1.5 font-sans">Assets</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {summary.activeVehicles} Active
              </span>
              <span className="text-xs font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                {summary.standbyVehicles} Standby
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Total Running Time */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Running Time</div>
            <div className="text-3xl font-black text-emerald-700 mt-1">
              {summary.totalRunningHoursFormatted}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-2 flex items-center gap-1">
              <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>{summary.totalRunningHours} total engine hours</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-100/60 text-emerald-800 flex items-center justify-center border border-emerald-200">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3: Idle / Standby Time */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Idle / Standby Time</div>
            <div className="text-3xl font-black text-amber-700 mt-1">
              {summary.totalIdleHoursFormatted}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-2 flex items-center gap-1">
              <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>{summary.totalIdleHours} hrs non-productive</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4: Total Project Hiring Cost */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Calculated Rental Cost</div>
            <div className="text-3xl font-black text-slate-900 mt-1">
              ₹ {summary.totalCost.toLocaleString('en-IN')}
            </div>
            <div className="text-xs font-semibold text-emerald-600 mt-2 flex items-center gap-1">
              <IndianRupee className="w-3.5 h-3.5" />
              <span>Auto-computed from logs</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <IndianRupee className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── PROJECT ROLLUP SUMMARY STRIP ──────────────────────────── */}
      {summary.projectRollup.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3 border-b border-slate-700/80 pb-2">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-400">
              <Briefcase className="w-4 h-4" />
              Project Running Time & Cost Breakdown
            </div>
            <span className="text-xs text-slate-400 font-medium">Real-time allocation</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.projectRollup.map((proj, idx) => (
              <div key={idx} className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-sm font-black text-white truncate max-w-[200px]" title={proj.projectName}>
                    {proj.projectName}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {proj.vehicleCount} temporary vehicle{proj.vehicleCount > 1 ? 's' : ''} deployed
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-extrabold text-emerald-400 flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3" />
                    {proj.runningHoursFormatted}
                  </div>
                  <div className="text-xs font-black text-white mt-0.5">
                    ₹ {proj.totalCost.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CONTROLS & FILTER BAR ─────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex-1 w-full md:w-auto relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search vehicle number, vendor, driver, or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Project Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Project:</span>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            >
              <option value="ALL">All Projects</option>
              {projectsList.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active</option>
              <option value="Standby">Standby</option>
              <option value="Released">Released</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── TEMPORARY FLEET ROSTER TABLE ───────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-800" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              Temporary Vehicle & Running Time Roster
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} listed
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-700" />
            <div className="font-bold text-sm">Loading temporary fleet data...</div>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <div className="text-base font-bold text-slate-800">No temporary vehicles found</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add temporary hired tippers, transit mixers, dumpers or heavy equipment to track running time.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold"
            >
              + Add Temporary Vehicle
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-3.5 px-4">Vehicle & Type</th>
                  <th className="py-3.5 px-4">Vendor / Agency</th>
                  <th className="py-3.5 px-4">Assigned Project & Site</th>
                  <th className="py-3.5 px-4">Driver / Operator</th>
                  <th className="py-3.5 px-4">Agreed Rate</th>
                  <th className="py-3.5 px-4">Running Time</th>
                  <th className="py-3.5 px-4">Calculated Cost</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {vehicles.map((v) => {
                  const runningMins = v.totalRunningMinutes || 0;
                  const hrs = Math.floor(runningMins / 60);
                  const mins = runningMins % 60;
                  const formattedRunning = `${hrs}h ${mins > 0 ? mins + 'm' : '00m'}`;

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Vehicle Number & Type */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-black border border-emerald-100">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-black text-slate-900 text-sm">{v.vehicleNumber}</div>
                            <div className="text-[11px] text-slate-500 font-semibold">{v.vehicleType}</div>
                          </div>
                        </div>
                      </td>

                      {/* Vendor */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800">{v.vendorName}</div>
                        {v.vendorPhone && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            {v.vendorPhone}
                          </div>
                        )}
                      </td>

                      {/* Project & Worksite */}
                      <td className="py-4 px-4 max-w-[200px]">
                        <div className="font-extrabold text-slate-900 truncate" title={v.projectName}>
                          {v.projectName}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{v.worksiteName || 'Main Yard'}</span>
                        </div>
                      </td>

                      {/* Driver */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {v.driverName || 'Unassigned'}
                        </div>
                        {v.driverPhone && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{v.driverPhone}</div>
                        )}
                      </td>

                      {/* Agreed Rate */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="font-extrabold text-slate-900">
                          ₹ {Number(v.agreedRate).toLocaleString('en-IN')}
                          <span className="text-[10px] text-slate-500 font-normal"> / hr</span>
                        </div>
                        <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                          ₹ {Number(v.standbyRate).toLocaleString('en-IN')} standby
                        </div>
                      </td>

                      {/* Running Time */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-black text-emerald-800 text-sm">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" />
                          {formattedRunning}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {v.logsCount || 0} shift log{v.logsCount !== 1 ? 's' : ''}
                        </div>
                      </td>

                      {/* Calculated Cost */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="font-black text-slate-900 text-sm">
                          ₹ {Number(v.totalCalculatedCost || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-semibold">Total to date</div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                            v.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : v.status === 'Standby'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              v.status === 'Active' ? 'bg-emerald-500' : v.status === 'Standby' ? 'bg-amber-500' : 'bg-slate-400'
                            }`}
                          />
                          {v.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Log Running Time Button */}
                          <button
                            onClick={() => handleOpenLogModal(v)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-black border border-emerald-200 flex items-center gap-1 transition-all"
                            title="Add shift running time log"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            Log Time
                          </button>

                          {/* View History Button */}
                          <button
                            onClick={() => handleOpenHistory(v)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
                            title="View all running logs"
                          >
                            Logs ({v.logsCount || 0})
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteVehicle(v.id)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-all"
                            title="Remove temporary vehicle"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL 1: ADD TEMPORARY VEHICLE ────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-black">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Add Temporary Vehicle</h3>
                  <p className="text-xs text-slate-500">Register a hired or contracted commercial asset for a project</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Vehicle Registration Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UP-16-BT-9900"
                    value={newVehicle.vehicleNumber}
                    onChange={(e) => setNewVehicle({ ...newVehicle, vehicleNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Vehicle Type *
                  </label>
                  <select
                    value={newVehicle.vehicleType}
                    onChange={(e) => setNewVehicle({ ...newVehicle, vehicleType: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  >
                    <option value="Tipper (16 Ton)">Tipper (16 Ton)</option>
                    <option value="Heavy Dump Truck (24 Ton)">Heavy Dump Truck (24 Ton)</option>
                    <option value="Transit Mixer (7 CUM)">Transit Mixer (7 CUM)</option>
                    <option value="Hydraulic Excavator">Hydraulic Excavator</option>
                    <option value="Mobile Crane (40 Ton)">Mobile Crane (40 Ton)</option>
                    <option value="Water Tanker (12 KL)">Water Tanker (12 KL)</option>
                    <option value="Trailer Flatbed">Trailer Flatbed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Vendor / Hiring Agency *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Balaji Roadlines"
                    value={newVehicle.vendorName}
                    onChange={(e) => setNewVehicle({ ...newVehicle, vendorName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Vendor Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 00000"
                    value={newVehicle.vendorPhone}
                    onChange={(e) => setNewVehicle({ ...newVehicle, vendorPhone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Assign to Project *
                  </label>
                  <select
                    value={newVehicle.projectId}
                    onChange={(e) => {
                      const selected = projectsList.find(p => p.id === e.target.value);
                      setNewVehicle({
                        ...newVehicle,
                        projectId: e.target.value,
                        projectName: selected ? selected.name : 'Project'
                      });
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  >
                    {projectsList.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Worksite / Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Casting Yard B"
                    value={newVehicle.worksiteName}
                    onChange={(e) => setNewVehicle({ ...newVehicle, worksiteName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Driver / Operator Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Virendra Yadav"
                    value={newVehicle.driverName}
                    onChange={(e) => setNewVehicle({ ...newVehicle, driverName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Driver Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 11223"
                    value={newVehicle.driverPhone}
                    onChange={(e) => setNewVehicle({ ...newVehicle, driverPhone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-black text-slate-600 mb-1">
                    Rate Type
                  </label>
                  <select
                    value={newVehicle.rateType}
                    onChange={(e) => setNewVehicle({ ...newVehicle, rateType: e.target.value })}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                  >
                    <option value="hourly">Hourly (₹/hr)</option>
                    <option value="daily">Daily (₹/day)</option>
                    <option value="trip">Per Trip (₹/trip)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-600 mb-1">
                    Agreed Rate (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="1200"
                    value={newVehicle.agreedRate}
                    onChange={(e) => setNewVehicle({ ...newVehicle, agreedRate: e.target.value })}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-600 mb-1">
                    Standby Rate (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="350"
                    value={newVehicle.standbyRate}
                    onChange={(e) => setNewVehicle({ ...newVehicle, standbyRate: e.target.value })}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-sm font-black shadow-md shadow-emerald-900/20"
                >
                  Confirm & Add Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: LOG SHIFT RUNNING TIME (WITH LIVE CALCULATION) ── */}
      {isLogModalOpen && selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-black">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Log Shift Running Time</h3>
                  <p className="text-xs text-slate-500">
                    Vehicle: <strong className="text-emerald-800">{selectedVehicle.vehicleNumber}</strong> ({selectedVehicle.vehicleType})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLog} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">Log Date</label>
                  <input
                    type="date"
                    value={logForm.logDate}
                    onChange={(e) => setLogForm({ ...logForm, logDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">Shift</label>
                  <select
                    value={logForm.shift}
                    onChange={(e) => setLogForm({ ...logForm, shift: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                  >
                    <option value="Day">Day Shift</option>
                    <option value="Night">Night Shift</option>
                  </select>
                </div>
              </div>

              {/* Time Span & Break */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-black text-slate-600 mb-1">Start Time (In)</label>
                  <input
                    type="time"
                    required
                    value={logForm.startTime}
                    onChange={(e) => setLogForm({ ...logForm, startTime: e.target.value })}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-600 mb-1">End Time (Out)</label>
                  <input
                    type="time"
                    required
                    value={logForm.endTime}
                    onChange={(e) => setLogForm({ ...logForm, endTime: e.target.value })}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-600 mb-1">Idle/Break (mins)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="60"
                    value={logForm.idleBreakMinutes}
                    onChange={(e) => setLogForm({ ...logForm, idleBreakMinutes: e.target.value })}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black"
                  />
                </div>
              </div>

              {/* LIVE CALCULATION PREVIEW BOX */}
              <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-2xl">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5" />
                  Live Running Time & Rental Calculation
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Running Time</div>
                    <div className="text-base font-black text-emerald-800 mt-0.5">
                      {logModalCalculations.runningHoursFormatted}
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Idle Standby</div>
                    <div className="text-base font-black text-amber-700 mt-0.5">
                      {logModalCalculations.idleMinutes}m
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Calculated Cost</div>
                    <div className="text-base font-black text-slate-900 mt-0.5">
                      ₹ {logModalCalculations.cost.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 text-center">
                  Rate applied: ₹{selectedVehicle.agreedRate}/hr running + ₹{selectedVehicle.standbyRate}/hr standby
                </div>
              </div>

              {/* Meter readings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">Start Meter / Hour</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 1420.0"
                    value={logForm.startMeter}
                    onChange={(e) => setLogForm({ ...logForm, startMeter: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">End Meter / Hour</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 1515.0"
                    value={logForm.endMeter}
                    onChange={(e) => setLogForm({ ...logForm, endMeter: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">Operator / Driver Name</label>
                <input
                  type="text"
                  placeholder="Operator on duty"
                  value={logForm.operatorName}
                  onChange={(e) => setLogForm({ ...logForm, operatorName: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">Work Description / Remarks</label>
                <input
                  type="text"
                  placeholder="Material movement, yard loading, etc."
                  value={logForm.workDescription}
                  onChange={(e) => setLogForm({ ...logForm, workDescription: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-sm font-black shadow-md shadow-emerald-900/20"
                >
                  Save Shift Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: VIEW RUNNING TIME HISTORY DRAWER ──────────────── */}
      {isHistoryModalOpen && selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-end">
          <div className="bg-white w-full max-w-2xl h-full p-6 shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-black">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Running Time History: {selectedVehicle.vehicleNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedVehicle.vehicleType} • Vendor: {selectedVehicle.vendorName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vehicle Summary Bar */}
            <div className="grid grid-cols-3 gap-3 my-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Total Running</div>
                <div className="text-base font-black text-emerald-800 mt-0.5">
                  {Math.floor((selectedVehicle.totalRunningMinutes || 0) / 60)}h {(selectedVehicle.totalRunningMinutes || 0) % 60}m
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Total Cost</div>
                <div className="text-base font-black text-slate-900 mt-0.5">
                  ₹ {Number(selectedVehicle.totalCalculatedCost || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Agreed Rate</div>
                <div className="text-base font-black text-slate-900 mt-0.5">
                  ₹ {selectedVehicle.agreedRate} <span className="text-[11px] font-normal text-slate-500">/hr</span>
                </div>
              </div>
            </div>

            {/* Shift Logs List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {logsLoading ? (
                <div className="py-12 text-center text-slate-400 font-bold text-sm">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-700" />
                  Loading logs...
                </div>
              ) : vehicleLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <div className="font-bold text-sm text-slate-700">No shift logs recorded yet</div>
                  <p className="text-xs text-slate-500 mt-1">
                    Click "Log Running Time" to record vehicle operating hours.
                  </p>
                </div>
              ) : (
                vehicleLogs.map((log) => {
                  const rHrs = Math.floor(log.runningMinutes / 60);
                  const rMins = log.runningMinutes % 60;
                  return (
                    <div
                      key={log.id}
                      className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-200 transition-all shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900">
                            {new Date(log.logDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            {log.shift} Shift
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-slate-900">
                            ₹ {Number(log.calculatedCost).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">TIME SPAN</span>
                          <span className="font-black text-slate-800">
                            {log.startTime} - {log.endTime}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">RUNNING / IDLE</span>
                          <span className="font-black text-emerald-800">
                            {rHrs}h {rMins}m <span className="text-amber-700 font-normal">({log.idleMinutes}m idle)</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">METER (START-END)</span>
                          <span className="font-bold text-slate-700">
                            {log.startMeter || '--'} → {log.endMeter || '--'}
                          </span>
                        </div>
                      </div>

                      {log.workDescription && (
                        <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                          <span className="font-bold text-slate-700">Work: </span>
                          {log.workDescription}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => {
                  setIsHistoryModalOpen(false);
                  handleOpenLogModal(selectedVehicle);
                }}
                className="px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-black"
              >
                + Log New Shift Time
              </button>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
