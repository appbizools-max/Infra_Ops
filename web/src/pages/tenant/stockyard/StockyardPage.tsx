import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers, Package, TrendingUp, TrendingDown, Plus, Search, Filter,
  Scale, MapPin, User, Phone, CheckCircle2, AlertTriangle, ArrowRight,
  RefreshCw, FileText, ArrowUpRight, ArrowDownLeft, ShieldCheck,
  Building2, Gauge, Truck, ChevronRight, X, Info, ArrowLeft,
  SlidersHorizontal, History, Box, AlertCircle, Check, Split,
  Train, Container, Printer, Download, Eye, ExternalLink,
  Calendar, Hash, Compass, ClipboardCheck, Award, FileSpreadsheet,
  CheckSquare, ArrowLeftRight, Clock, Navigation, CornerDownRight,
  Edit2, Trash2, Shield, Calculator, Wrench, Activity, Database, BarChart3
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';

// ==========================================
// INTERFACES & TYPES
// ==========================================

export interface EligibleEquipment {
  id: number;
  equipmentId: string;
  equipmentNumber: string;
  equipmentType: string;
  make?: string;
  model?: string;
  hourMeterReading?: number;
  assignedOperatorName?: string;
  assignedOperatorPhone?: string;
  assignedProjectId?: string;
  assignedProjectName?: string;
  status: string;
  isBusy?: boolean;
  isAvailable?: boolean;
}

export interface EquipmentUtilizationRecord {
  id: number;
  stockyardId: number;
  stockyardName: string;
  projectId: string;
  projectName: string;
  transactionId?: number;
  shiftId?: string;
  equipmentId: string;
  equipmentNumber: string;
  equipmentName?: string;
  equipmentType: string;
  operationType: 'UNLOADING' | 'LOADING' | 'INTERNAL_SHIFT' | 'OTHER';
  materialName?: string;
  quantity?: number;
  unit?: string;
  sourceRackName?: string;
  destinationRackName?: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  operatorName?: string;
  operatorPhone?: string;
  status: string;
  remarks?: string;
  recordedBy?: string;
  createdAt?: string;
}

interface Stockyard {
  id: number;
  tenantId: number;
  yardCode: string;
  yardName: string;
  divisionId?: string;
  divisionName?: string;
  worksiteId?: string;
  worksiteName?: string;
  totalCapacityTons: number;
  currentOccupancyTons: number;
  currentAvailableStock?: number;
  projectsCount?: number;
  materialsCount?: number;
  totalReceived?: number;
  totalIssued?: number;
  totalLoss?: number;
  totalAdjustment?: number;
  stockUnit?: string;
  location: string;
  supervisorName?: string;
  supervisorPhone?: string;
  weighbridgeInstalled: boolean;
  weighbridgeCapacityTons: number;
  status: string;
  notes?: string;
  createdAt: string;
}

interface StockyardRack {
  id: number;
  stockyardId: number;
  rackCode: string;
  rackName: string;
  locationType: string;
  capacityTons: number;
  currentOccupancyTons?: number;
  description?: string;
  status: string;
  createdAt?: string;
}

interface RackInventory {
  rackName: string;
  rackCode: string;
  locationType: string;
  projectId: string;
  projectName: string;
  materialName: string;
  unit: string;
  currentAvailable: number;
  lastUpdated: string;
}

interface InternalShift {
  id: number;
  shiftId: string;
  stockyardId: number;
  projectId: string;
  projectName: string;
  materialName: string;
  quantity: number;
  unit: string;
  sourceLocation: string;
  destinationLocation: string;
  remarks?: string;
  recordedBy?: string;
  createdAt: string;
}

interface ProjectInventory {
  projectId: string;
  projectName: string;
  materialName: string;
  unit: string;
  plannedQuantity?: number;
  isPlannedAssociation?: boolean;
  isAssociated?: boolean;
  corridorId?: number;
  totalReceived: number;
  totalIssued: number;
  totalLoss: number;
  totalAdjustment: number;
  currentAvailable: number;
  lastTransactionDate: string;
  transactionCount: number;
  lastVehicleNumber?: string;
  lastWeighbridgeSlip?: string;
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
  yardName?: string;
  yardCode?: string;
  pileId?: number;
  materialName: string;
  grade?: string;
  unit: string;
  transactionType: 'INWARD' | 'OUTWARD' | 'LOSS' | 'ADJUSTMENT' | 'INTERNAL_SHIFT';
  quantity: number;
  projectId: string;
  projectName: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  waybillNumber?: string;
  weighbridgeSlipNumber?: string;
  grossWeight?: number;
  tareWeight?: number;
  netWeight?: number;
  sourceLocation?: string;
  destinationLocation?: string;
  discrepancyQuantity?: number;
  transportMode?: string;
  supplierName?: string;
  challanNumber?: string;
  moisturePct?: number;
  qualityGrade?: string;
  grnNumber?: string;
  gateInTime?: string;
  gateOutTime?: string;
  dwellMinutes?: number;
  rackId?: number;
  rackName?: string;
  destinationRackId?: number;
  destinationRackName?: string;
  shiftId?: string;
  recordedBy?: string;
  remarks?: string;
  createdAt: string;
}

interface Division {
  id: string;
  name: string;
  state?: string;
  city?: string;
}

interface ProjectOption {
  id: string;
  projectId: string;
  name: string;
  commodity?: string;
  location?: string;
  customer?: string;
  contractQuantity?: number;
  contractQuantityUnit?: string;
}

interface ProjectStockyardDetail {
  project: {
    projectId: string;
    name: string;
    customer?: string;
    commodity?: string;
    location?: string;
    contractQuantity?: number;
    contractQuantityUnit?: string;
    startDate?: string;
    endDate?: string;
  };
  metrics: {
    totalReceived: number;
    totalIssued: number;
    totalLoss: number;
    currentAvailable: number;
    inwardCount: number;
    outwardCount: number;
    shiftCount?: number;
  };
  materials: {
    materialName: string;
    unit: string;
    totalReceived: number;
    totalIssued: number;
    totalLoss: number;
    totalAdjustment: number;
    currentAvailable: number;
    movementCount: number;
    lastActivityDate: string;
  }[];
  inwardReceipts: StockTransaction[];
  outwardDispatches: StockTransaction[];
  adjustments: StockTransaction[];
  shifts?: InternalShift[];
}

function EquipmentUsedPicker({
  eligibleList,
  selectedList,
  onChange,
  isOpen,
  onToggleOpen,
  operationType = 'Handling'
}: {
  eligibleList: EligibleEquipment[];
  selectedList: any[];
  onChange: (list: any[]) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  operationType?: string;
}) {
  const [filterType, setFilterType] = useState('ALL');
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  const distinctTypes = useMemo(() => {
    const s = new Set<string>();
    eligibleList.forEach(e => { if (e.equipmentType) s.add(e.equipmentType); });
    return Array.from(s).sort();
  }, [eligibleList]);

  const filtered = useMemo(() => {
    if (filterType === 'ALL') return eligibleList;
    return eligibleList.filter(e => e.equipmentType === filterType);
  }, [eligibleList, filterType]);

  const handleToggleSelect = (item: EligibleEquipment) => {
    if (item.status === 'Under Maintenance') {
      setWarningMsg(`Cannot assign ${item.equipmentNumber}: Equipment is currently Under Maintenance.`);
      setTimeout(() => setWarningMsg(null), 3000);
      return;
    }

    const idx = selectedList.findIndex(x => (x.equipmentNumber || x.equipmentId) === (item.equipmentNumber || item.equipmentId));
    if (idx >= 0) {
      onChange(selectedList.filter((_, i) => i !== idx));
    } else {
      const now = new Date();
      const sIso = new Date(now.getTime() - 3600000).toISOString().slice(0, 16);
      const eIso = now.toISOString().slice(0, 16);
      onChange([
        ...selectedList,
        {
          equipmentId: item.equipmentId,
          equipmentNumber: item.equipmentNumber,
          equipmentName: item.make ? `${item.make} ${item.model || ''}` : item.equipmentType,
          equipmentType: item.equipmentType,
          make: item.make,
          model: item.model,
          operatorName: item.assignedOperatorName || '',
          operatorPhone: item.assignedOperatorPhone || '',
          startTime: sIso,
          endTime: eIso,
          durationHours: 1.0,
          remarks: ''
        }
      ]);
    }
  };

  const handleUpdateItem = (index: number, patch: any) => {
    const updated = [...selectedList];
    const current = { ...updated[index], ...patch };
    if (patch.startTime || patch.endTime) {
      const s = new Date(current.startTime).getTime();
      const e = new Date(current.endTime).getTime();
      if (!isNaN(s) && !isNaN(e) && e > s) {
        current.durationHours = parseFloat(((e - s) / 3600000).toFixed(2));
      }
    }
    updated[index] = current;
    onChange(updated);
  };

  return (
    <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800 hover:text-emerald-700 transition-colors"
        >
          <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Wrench size={13} />
          </div>
          <span>Equipment Used ({selectedList.length} assigned)</span>
          <span className="text-[10px] font-bold text-slate-400 lowercase">(optional - JCB, Loader, Excavator)</span>
        </button>

        <button
          type="button"
          onClick={onToggleOpen}
          className="text-xs font-bold text-emerald-700 hover:underline"
        >
          {isOpen ? 'Collapse' : selectedList.length > 0 ? `Edit (${selectedList.length})` : '+ Select Machinery'}
        </button>
      </div>

      {warningMsg && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
          <AlertCircle size={14} className="shrink-0" />
          <span>{warningMsg}</span>
        </div>
      )}

      {/* Selected tags */}
      {!isOpen && selectedList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedList.map((m, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-emerald-900 shadow-2xs">
              <Wrench size={11} className="text-emerald-600" />
              <span>{m.equipmentNumber} ({m.equipmentType})</span>
              <span className="text-[10px] font-black text-slate-400">• {m.durationHours}h</span>
            </span>
          ))}
        </div>
      )}

      {/* Expanded Selection Panel */}
      {isOpen && (
        <div className="space-y-3 pt-2 border-t border-slate-200/80">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold">Select eligible heavy machinery from fleet:</span>
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${filterType === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}`}
              >
                All
              </button>
              {distinctTypes.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase whitespace-nowrap ${filterType === t ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of machines */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {filtered.length > 0 ? (
              filtered.map(eq => {
                const isSelected = selectedList.some(x => (x.equipmentNumber || x.equipmentId) === (eq.equipmentNumber || eq.equipmentId));
                const isMaint = eq.status === 'Under Maintenance';
                return (
                  <div
                    key={eq.id}
                    onClick={() => handleToggleSelect(eq)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-2 ${isMaint
                      ? 'bg-rose-50/50 border-rose-200 opacity-70 cursor-not-allowed'
                      : isSelected
                        ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-900">{eq.equipmentNumber}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${isMaint ? 'bg-rose-100 text-rose-700' : eq.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                          {eq.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {eq.equipmentType} {eq.make ? `• ${eq.make}` : ''}
                      </div>
                      {eq.assignedOperatorName && (
                        <div className="text-[10px] text-slate-400">
                          Op: {eq.assignedOperatorName}
                        </div>
                      )}
                    </div>

                    <div className="pt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        disabled={isMaint}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 pointer-events-none"
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 py-4 text-center text-xs text-slate-400">
                No machinery registered in this category.
              </div>
            )}
          </div>

          {/* Details for Selected Machines */}
          {selectedList.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                Usage Duration & Operator Details ({selectedList.length} Selected)
              </span>

              {selectedList.map((m, idx) => (
                <div key={idx} className="p-3 bg-white rounded-xl border border-emerald-200 space-y-2.5 text-xs shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-emerald-900">{m.equipmentNumber}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">{m.equipmentType}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onChange(selectedList.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:text-rose-700 font-bold text-[10px] uppercase tracking-wider"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Start Time</label>
                      <input
                        type="datetime-local"
                        value={m.startTime}
                        onChange={e => handleUpdateItem(idx, { startTime: e.target.value })}
                        className="w-full px-2 py-1 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">End Time</label>
                      <input
                        type="datetime-local"
                        value={m.endTime}
                        onChange={e => handleUpdateItem(idx, { endTime: e.target.value })}
                        className="w-full px-2 py-1 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Duration (Hrs)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={m.durationHours}
                        onChange={e => handleUpdateItem(idx, { durationHours: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-emerald-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Operator Name</label>
                      <input
                        type="text"
                        placeholder="Operator name"
                        value={m.operatorName}
                        onChange={e => handleUpdateItem(idx, { operatorName: e.target.value })}
                        className="w-full px-2 py-1 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Remarks / activity details (optional)"
                      value={m.remarks}
                      onChange={e => handleUpdateItem(idx, { remarks: e.target.value })}
                      className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DEFAULT_ROAD_VEHICLES = [
  { vehicleNumber: 'OD-05-BB-8921', vehicleType: 'BharatBenz 3528C Tipper (35T)', payloadCapacity: 35.0, driverName: 'Rajesh Kumar Swain', driverPhone: '+91 94371 88921' },
  { vehicleNumber: 'OD-05-AA-7712', vehicleType: 'Tata Prima 2830.K Tipper (28T)', payloadCapacity: 28.0, driverName: 'Sunil Pradhan', driverPhone: '+91 98610 22134' },
  { vehicleNumber: 'OD-14-CC-4019', vehicleType: 'Ashok Leyland 2820 Tipper (28T)', payloadCapacity: 28.0, driverName: 'Dhananjay Singh', driverPhone: '+91 97780 44551' },
  { vehicleNumber: 'UP-65-AR-5531', vehicleType: 'Volvo FMX 460 Heavy Tipper (40T)', payloadCapacity: 40.0, driverName: 'Mohammad Rafiq', driverPhone: '+91 91250 88901' },
  { vehicleNumber: 'MP-17-TG-1290', vehicleType: 'BharatBenz 2823R Haulage (28T)', payloadCapacity: 28.0, driverName: 'Rameshwar Yadav', driverPhone: '+91 94251 33412' },
  { vehicleNumber: 'DL-1M-4412', vehicleType: 'Tata Signa 3523.TK Tipper (35T)', payloadCapacity: 35.0, driverName: 'Gurpreet Singh', driverPhone: '+91 98100 77889' },
  { vehicleNumber: 'UP-14-BT-9021', vehicleType: 'Ashok Leyland 3520 Tipper (35T)', payloadCapacity: 35.0, driverName: 'Rajesh Kumar', driverPhone: '+91 98765 43210' },
  { vehicleNumber: 'JH-09-AK-6612', vehicleType: 'Mahindra Blazo X 35 (35T)', payloadCapacity: 35.0, driverName: 'Bikash Mahato', driverPhone: '+91 99341 66120' },
  { vehicleNumber: 'CG-04-MB-3398', vehicleType: 'Tata Prima 3530.K Tipper (35T)', payloadCapacity: 35.0, driverName: 'Devendra Patel', driverPhone: '+91 98271 33980' },
  { vehicleNumber: 'WB-23-GH-8812', vehicleType: 'Volvo FM 420 Heavy Tipper (40T)', payloadCapacity: 40.0, driverName: 'Subhasish Roy', driverPhone: '+91 94330 88120' },
];

const DEFAULT_RAIL_WAGONS = [
  { vehicleNumber: 'BOXN-94102', vehicleType: 'BOXN Open Freight Wagon', payloadCapacity: 58.5, driverName: 'Loco Pilot K. K. Verma', driverPhone: '+91 97524 10021' },
  { vehicleNumber: 'BOXNHL-63211', vehicleType: 'BOXNHL High-Capacity Open Wagon', payloadCapacity: 61.0, driverName: 'Loco Pilot V. N. Sharma', driverPhone: '+91 97524 10022' },
  { vehicleNumber: 'BCNHL-88219', vehicleType: 'BCNHL Covered Bulk Wagon', payloadCapacity: 63.5, driverName: 'Loco Pilot S. Dasgupta', driverPhone: '+91 97524 10023' },
  { vehicleNumber: 'BOBYN-41008', vehicleType: 'BOBYN Hopper Ballast Wagon', payloadCapacity: 55.0, driverName: 'Loco Pilot Anup Mishra', driverPhone: '+91 97524 10024' },
  { vehicleNumber: 'BOXNHS-72991', vehicleType: 'BOXNHS High-Speed Open Wagon', payloadCapacity: 59.5, driverName: 'Loco Pilot M. R. Naik', driverPhone: '+91 97524 10025' },
  { vehicleNumber: 'BCN-52109', vehicleType: 'BCN Covered Freight Wagon', payloadCapacity: 56.0, driverName: 'Loco Pilot P. C. Tiwari', driverPhone: '+91 97524 10026' },
  { vehicleNumber: 'BOXN-94103', vehicleType: 'BOXN Open Freight Wagon', payloadCapacity: 58.5, driverName: 'Loco Pilot Rajesh Soren', driverPhone: '+91 97524 10027' },
  { vehicleNumber: 'BOXNHL-63215', vehicleType: 'BOXNHL High-Capacity Open Wagon', payloadCapacity: 61.0, driverName: 'Loco Pilot A. K. Behera', driverPhone: '+91 97524 10028' },
  { vehicleNumber: 'BOBYN-41012', vehicleType: 'BOBYN Hopper Ballast Wagon', payloadCapacity: 55.0, driverName: 'Loco Pilot Tarun Roy', driverPhone: '+91 97524 10029' },
  { vehicleNumber: 'BOXN-94108', vehicleType: 'BOXN Open Freight Wagon', payloadCapacity: 58.5, driverName: 'Loco Pilot Deepak Pandey', driverPhone: '+91 97524 10030' },
];

export default function StockyardPage() {
  const { currentUser } = useAuth();

  // Navigation Hierarchies:
  // 'list' -> All Stockyards
  // 'yard-detail' -> Selected Stockyard Hub
  // 'project-detail' -> Dedicated, In-Depth Project Stockyard Console
  // 'deep-stock-add' -> Comprehensive Multi-Step Inward Weighbridge Gate Console
  const [viewMode, setViewMode] = useState<'list' | 'yard-detail' | 'project-detail' | 'deep-stock-add'>('list');

  // Selected Entities
  const [selectedYard, setSelectedYard] = useState<Stockyard | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectDetailData, setProjectDetailData] = useState<ProjectStockyardDetail | null>(null);

  // Master Lists
  const [stockyards, setStockyards] = useState<Stockyard[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectInventory, setProjectInventory] = useState<ProjectInventory[]>([]);
  const [piles, setPiles] = useState<StockyardPile[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [racks, setRacks] = useState<StockyardRack[]>([]);
  const [rackInventory, setRackInventory] = useState<RackInventory[]>([]);
  const [shiftsHistory, setShiftsHistory] = useState<InternalShift[]>([]);

  // Vehicles & Wagons Roster State for Inward Receipts
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [isReceiveVehicleModalOpen, setIsReceiveVehicleModalOpen] = useState(false);
  const [receiveVehicleMode, setReceiveVehicleMode] = useState<'TRUCK' | 'RAIL_RAKE'>('TRUCK');
  const [receiveVehicleSearch, setReceiveVehicleSearch] = useState('');
  const [receiveVehicleForm, setReceiveVehicleForm] = useState({
    transportMode: 'TRUCK' as 'TRUCK' | 'RAIL_RAKE',
    vehicleNumber: '',
    vehicleType: '',
    driverName: '',
    driverPhone: '',
    projectId: '',
    projectName: '',
    materialName: '',
    unit: 'MT',
    rackId: '',
    rackName: '',
    sourceLocation: '',
    supplierName: '',
    challanNumber: '',
    weighbridgeSlipNumber: '',
    grossWeight: '52.40',
    tareWeight: '17.20',
    netWeight: '35.20',
    remarks: 'Delivered & verified at stockyard weighbridge'
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingProject, setLoadingProject] = useState(false);

  // Yard Detail Active Tab
  const [yardActiveTab, setYardActiveTab] = useState<'projects' | 'digital-twin' | 'live-queue' | 'racks' | 'shifts' | 'equipment' | 'ledger' | 'reconciliation'>('projects');

  // Heavy Machinery & Equipment States
  const [eligibleEquipment, setEligibleEquipment] = useState<EligibleEquipment[]>([]);
  const [yardEquipmentUtilization, setYardEquipmentUtilization] = useState<EquipmentUtilizationRecord[]>([]);
  const [yardEquipmentSummary, setYardEquipmentSummary] = useState<any>({
    totalHours: 0,
    totalOperations: 0,
    totalQuantity: 0,
    activeMachinesCount: 0,
    machineHours: [],
    operationBreakdown: {}
  });

  // Equipment assignment during operations
  const [shiftEquipment, setShiftEquipment] = useState<any[]>([]);
  const [isShiftEqOpen, setIsShiftEqOpen] = useState(false);
  const [inwardEquipment, setInwardEquipment] = useState<any[]>([]);
  const [isInwardEqOpen, setIsInwardEqOpen] = useState(false);
  const [issueEquipment, setIssueEquipment] = useState<any[]>([]);
  const [isIssueEqOpen, setIsIssueEqOpen] = useState(false);

  // Yard Equipment Filters
  const [eqYardOpFilter, setEqYardOpFilter] = useState<'ALL' | 'UNLOADING' | 'LOADING' | 'INTERNAL_SHIFT' | 'OTHER'>('ALL');
  const [eqYardMachineFilter, setEqYardMachineFilter] = useState('ALL');
  const [eqYardSearch, setEqYardSearch] = useState('');

  // Standalone Equipment Activity Modal
  const [isLogEqModalOpen, setIsLogEqModalOpen] = useState(false);
  const [logEqForm, setLogEqForm] = useState({
    projectId: '',
    projectName: '',
    equipmentNumber: '',
    operationType: 'OTHER' as 'UNLOADING' | 'LOADING' | 'INTERNAL_SHIFT' | 'OTHER',
    materialName: '',
    quantity: '',
    unit: 'MT',
    sourceRackName: '',
    destinationRackName: '',
    startTime: new Date(Date.now() - 3600000).toISOString().slice(0, 16),
    endTime: new Date().toISOString().slice(0, 16),
    durationHours: '1.0',
    operatorName: '',
    operatorPhone: '',
    remarks: ''
  });

  // Digital Twin Yard Map States
  const [digitalTwinMode, setDigitalTwinMode] = useState<'heatmap' | 'material' | 'project'>('heatmap');
  const [digitalTwinFilterMaterial, setDigitalTwinFilterMaterial] = useState<string>('ALL');
  const [selectedDigitalTwinNode, setSelectedDigitalTwinNode] = useState<StockyardRack | null>(null);

  // Live Queue & Fast Tare Weighbridge States
  const [isFastTareModalOpen, setIsFastTareModalOpen] = useState(false);
  const [fastTareTruck, setFastTareTruck] = useState<StockTransaction | null>(null);
  const [fastTareWeight, setFastTareWeight] = useState('');
  const [fastTareRemarks, setFastTareRemarks] = useState('');
  const [queueSearch, setQueueSearch] = useState('');

  // Material Shrinkage & Drone Survey Reconciliation States
  const [reconProject, setReconProject] = useState('');
  const [reconMaterial, setReconMaterial] = useState('');
  const [measuredMoisturePct, setMeasuredMoisturePct] = useState('8.5');
  const [baselineMoisturePct, setBaselineMoisturePct] = useState('11.0');
  const [surveyMethod, setSurveyMethod] = useState<'DRONE_LIDAR' | 'TOTAL_STATION' | 'PHYSICAL_DIP'>('DRONE_LIDAR');
  const [surveyVolumeM3, setSurveyVolumeM3] = useState('');
  const [surveyBulkDensity, setSurveyBulkDensity] = useState('1.65');
  const [surveyAdjustmentReason, setSurveyAdjustmentReason] = useState('');

  // Dedicated Project Detail Filters
  const [projectTripSearch, setProjectTripSearch] = useState('');
  const [projectTripRackFilter, setProjectTripRackFilter] = useState('ALL');

  // Project Detail Active Sub-Tab & Scroll Spy Section
  const [projectActiveTab, setProjectActiveTab] = useState<'trips' | 'materials' | 'racks' | 'outward' | 'shifts' | 'reconcile'>('trips');
  const [activeProjectSection, setActiveProjectSection] = useState<'trips' | 'materials' | 'racks' | 'outward' | 'shifts' | 'reconcile'>('trips');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Yard Ledger Filters
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'ALL' | 'INWARD' | 'OUTWARD' | 'LOSS' | 'ADJUSTMENT' | 'INTERNAL_SHIFT'>('ALL');
  const [ledgerProjectFilter, setLedgerProjectFilter] = useState('ALL');

  // Modals
  const [isAddYardModalOpen, setIsAddYardModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isAddPileModalOpen, setIsAddPileModalOpen] = useState(false);
  const [isAddRackModalOpen, setIsAddRackModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isGrnSlipModalOpen, setIsGrnSlipModalOpen] = useState(false);
  const [activeGrnReceipt, setActiveGrnReceipt] = useState<StockTransaction | null>(null);

  // Editing Rack State
  const [editingRack, setEditingRack] = useState<StockyardRack | null>(null);

  // Action Loading & Errors
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Add Stockyard Form State
  const [yardForm, setYardForm] = useState({
    yardName: '',
    location: '',
    divisionId: '',
    yardCode: '',
    status: 'Active',
    totalCapacityTons: '50000',
    supervisorName: '',
    supervisorPhone: '',
    weighbridgeInstalled: true,
    weighbridgeCapacityTons: '100',
    notes: ''
  });

  // Rack Form State
  const [rackForm, setRackForm] = useState({
    rackName: '',
    rackCode: '',
    locationType: 'Rack',
    capacityTons: '10000',
    description: '',
    status: 'Active'
  });

  // Internal Stock Shift Form State
  const [shiftForm, setShiftForm] = useState({
    projectId: '',
    projectName: '',
    materialName: '',
    unit: 'MT',
    sourceRackId: '',
    sourceRackName: '',
    destinationRackId: '',
    destinationRackName: '',
    quantity: '',
    shiftDate: new Date().toISOString().slice(0, 16),
    remarks: ''
  });

  // Comprehensive In-Depth "Stock Add" Form State
  const [stockAddForm, setStockAddForm] = useState({
    transportMode: 'TRUCK' as 'TRUCK' | 'TRAILER' | 'RAIL_RAKE' | 'CONVEYOR',
    projectId: '',
    projectName: '',
    materialName: '',
    unit: 'MT',
    qualityGrade: 'RDSO Class-A / Industrial Grade',
    moisturePct: '1.2',
    supplierName: '',
    challanNumber: '',
    sourceLocation: '',
    vehicleNumber: '',
    transporterName: '',
    driverName: '',
    driverPhone: '',
    dispatchQuantity: '',
    grossWeight: '',
    tareWeight: '',
    netWeight: '',
    weighbridgeSlipNumber: '',
    waybillNumber: '',
    rackId: '',
    rackName: '',
    pileId: '',
    remarks: ''
  });

  // Issue Form State
  const [issueForm, setIssueForm] = useState({
    projectId: '',
    projectName: '',
    materialName: '',
    unit: 'MT',
    quantity: '',
    vehicleNumber: '',
    driverName: '',
    driverPhone: '',
    destinationLocation: '',
    weighbridgeSlipNumber: '',
    waybillNumber: '',
    grossWeight: '',
    tareWeight: '',
    rackId: '',
    rackName: '',
    remarks: ''
  });

  // Reconciliation / Wastage Form State
  const [adjustForm, setAdjustForm] = useState({
    projectId: '',
    projectName: '',
    materialName: '',
    unit: 'MT',
    adjustmentType: 'LOSS' as 'LOSS' | 'ADJUSTMENT',
    quantity: '',
    reason: '',
    physicalStock: '',
    bookStock: '',
    variance: ''
  });

  // Pile Bay Form State
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

  // Auto-calculated Net Weight for In-Depth Stock Add
  const calculatedStockAddNet = useMemo(() => {
    const gross = parseFloat(stockAddForm.grossWeight) || 0;
    const tare = parseFloat(stockAddForm.tareWeight) || 0;
    if (gross > 0 && tare > 0 && gross > tare) {
      return (gross - tare).toFixed(2);
    }
    return stockAddForm.netWeight || '0.00';
  }, [stockAddForm.grossWeight, stockAddForm.tareWeight, stockAddForm.netWeight]);

  // Real-time Transit Shortage Discrepancy
  const stockAddDiscrepancy = useMemo(() => {
    const dispatch = parseFloat(stockAddForm.dispatchQuantity) || 0;
    const received = parseFloat(calculatedStockAddNet) || 0;
    if (dispatch > 0 && received > 0) {
      return (dispatch - received).toFixed(2);
    }
    return '0.00';
  }, [stockAddForm.dispatchQuantity, calculatedStockAddNet]);

  // Selected Project's Available Stock (for Outward Dispatch modal validation)
  const selectedProjectAvailableStock = useMemo(() => {
    if (!issueForm.projectId || !issueForm.materialName) return 0;
    const match = projectInventory.find(
      p => p.projectId === issueForm.projectId &&
        p.materialName.toLowerCase() === issueForm.materialName.toLowerCase()
    );
    return match ? match.currentAvailable : 0;
  }, [issueForm.projectId, issueForm.materialName, projectInventory]);

  // Available stock at source rack for shift modal
  const availableAtSourceRack = useMemo(() => {
    if (!shiftForm.projectId || !shiftForm.materialName) return 0;
    if (!shiftForm.sourceRackName && !shiftForm.sourceRackId) return 0;

    const matched = rackInventory.find(
      r => r.projectId === shiftForm.projectId &&
        r.materialName.toLowerCase() === shiftForm.materialName.toLowerCase() &&
        (r.rackName.toLowerCase() === shiftForm.sourceRackName.toLowerCase() ||
          r.rackCode === shiftForm.sourceRackName)
    );

    if (matched) return matched.currentAvailable;

    // Fallback: overall project available balance in this yard
    const pMatch = projectInventory.find(
      p => p.projectId === shiftForm.projectId &&
        p.materialName.toLowerCase() === shiftForm.materialName.toLowerCase()
    );
    return pMatch ? pMatch.currentAvailable : 0;
  }, [shiftForm.projectId, shiftForm.materialName, shiftForm.sourceRackName, shiftForm.sourceRackId, rackInventory, projectInventory]);

  // Active Vehicles Currently Inside Yard Perimeter (Awaiting Tare Weighing / Discharge)
  const activeTrucksInYard = useMemo(() => {
    return transactions.filter(t =>
      t.transactionType === 'INWARD' &&
      t.vehicleNumber &&
      (!t.gateOutTime || !t.tareWeight || parseFloat(String(t.tareWeight)) === 0)
    );
  }, [transactions]);

  // Project Weight Scope & Cumulative Balance Calculations
  const projectScopeWeight = useMemo(() => {
    if (projectDetailData?.project?.contractQuantity && Number(projectDetailData.project.contractQuantity) > 0) {
      return Number(projectDetailData.project.contractQuantity);
    }
    const inv = projectInventory.find(p => p.projectId === selectedProjectId);
    if (inv && inv.plannedQuantity && Number(inv.plannedQuantity) > 0) {
      return Number(inv.plannedQuantity);
    }
    return 50000; // Standard 50,000 MT target baseline
  }, [projectDetailData, projectInventory, selectedProjectId]);

  const totalReceiptsWeight = useMemo(() => {
    const receipts = projectDetailData?.inwardReceipts || [];
    return receipts.reduce((sum, r) => sum + (parseFloat(String(r.quantity || r.netWeight || 0)) || 0), 0);
  }, [projectDetailData?.inwardReceipts]);

  const remainingProjectBalance = useMemo(() => {
    return Math.max(0, parseFloat((projectScopeWeight - totalReceiptsWeight).toFixed(2)));
  }, [projectScopeWeight, totalReceiptsWeight]);

  const projectDeliveryProgressPct = useMemo(() => {
    if (projectScopeWeight <= 0) return 0;
    return Math.min(100, parseFloat(((totalReceiptsWeight / projectScopeWeight) * 100).toFixed(1)));
  }, [totalReceiptsWeight, projectScopeWeight]);

  const receiptBalancesMap = useMemo(() => {
    const receipts = projectDetailData?.inwardReceipts || [];
    const sorted = [...receipts].sort((a, b) => new Date(a.gateInTime || a.createdAt).getTime() - new Date(b.gateInTime || b.createdAt).getTime());
    let runningTotal = 0;
    const map = new Map<number | string, { runningDelivered: number; remainingBalance: number }>();
    for (const r of sorted) {
      const qty = parseFloat(String(r.quantity || r.netWeight || 0)) || 0;
      runningTotal += qty;
      const remaining = Math.max(0, parseFloat((projectScopeWeight - runningTotal).toFixed(2)));
      map.set(r.id, {
        runningDelivered: parseFloat(runningTotal.toFixed(2)),
        remainingBalance: remaining
      });
    }
    return map;
  }, [projectDetailData?.inwardReceipts, projectScopeWeight]);

  // Universal CSV Exporter
  const downloadCsv = (filename: string, headers: string[], rows: (string | number | undefined | null)[][]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        const str = String(val ?? '');
        return `"${str.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fast Tare Weighbridge Checkout
  const handleFastTareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYard || !fastTareTruck) return;
    const tareNum = parseFloat(fastTareWeight);
    if (!tareNum || tareNum <= 0) {
      showToast('Please enter a valid tare weight in MT', 'error');
      return;
    }
    const grossNum = parseFloat(String(fastTareTruck.grossWeight || 0));
    if (grossNum > 0 && tareNum >= grossNum) {
      showToast(`Tare weight cannot exceed or equal Gross weight (${grossNum} MT)`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/tenant/stockyards/${selectedYard.id}/checkout-truck/${fastTareTruck.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tareWeight: tareNum,
          remarks: fastTareRemarks || 'Weighbridge exit tare confirmed',
          recordedBy: currentUser?.email || 'Weighbridge Operator'
        })
      });
      if (res.ok) {
        showToast('Vehicle cleared! Tare weighed & Gate-Out logged.', 'success');
        setIsFastTareModalOpen(false);
        setFastTareTruck(null);
        setFastTareWeight('');
        setFastTareRemarks('');
        await fetchYardDetails(selectedYard.id);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to complete tare checkout', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error executing checkout', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Drone Survey / Volumetric True-Up Reconciliation Handler
  const handleSurveyReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYard) return;
    if (!reconProject || !reconMaterial) {
      showToast('Please select Project and Material to reconcile', 'error');
      return;
    }
    const vol = parseFloat(surveyVolumeM3) || 0;
    const density = parseFloat(surveyBulkDensity) || 1.65;
    const physicalTons = parseFloat((vol * density).toFixed(2));

    const matchedInv = projectInventory.find(p => p.projectId === reconProject && p.materialName.toLowerCase() === reconMaterial.toLowerCase());
    const bookStock = matchedInv ? matchedInv.currentAvailable : 0;
    const variance = parseFloat((physicalTons - bookStock).toFixed(2));

    if (Math.abs(variance) < 0.01) {
      showToast('Physical survey matches book stock perfectly. No adjustment needed.', 'success');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/tenant/stockyards/${selectedYard.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: reconProject,
          projectName: matchedInv?.projectName || reconProject,
          materialName: reconMaterial,
          adjustmentType: variance > 0 ? 'ADJUSTMENT' : 'LOSS',
          quantity: Math.abs(variance),
          reason: surveyAdjustmentReason || `${surveyMethod} Volumetric True-Up: ${vol} m³ @ ${density} t/m³ (Variance: ${variance > 0 ? '+' : ''}${variance} MT)`,
          physicalStock: physicalTons,
          bookStock: bookStock,
          variance: variance,
          recordedBy: currentUser?.email || 'Chief Surveyor'
        })
      });
      if (res.ok) {
        showToast(`Stock true-up recorded! ${variance > 0 ? '+' : '-'}${Math.abs(variance)} MT adjusted into ledger.`, 'success');
        setSurveyVolumeM3('');
        setSurveyAdjustmentReason('');
        await fetchYardDetails(selectedYard.id);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to record survey adjustment', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error recording adjustment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // DATA FETCHING
  // ==========================================

  // Master Data (Stockyards, Divisions, Projects)
  const fetchMasterData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const yRes = await apiFetch('/api/tenant/stockyards');
      if (yRes.ok) {
        const yData = await yRes.json();
        const yList: Stockyard[] = Array.isArray(yData) ? yData : [];
        setStockyards(yList);
        if (selectedYard) {
          const fresh = yList.find(y => y.id === selectedYard.id);
          if (fresh) setSelectedYard(fresh);
        }
      }

      const dRes = await apiFetch('/api/tenant/divisions');
      if (dRes.ok) {
        const dData = await dRes.json();
        setDivisions(Array.isArray(dData) ? dData : []);
      }

      const pRes = await apiFetch('/api/tenant/projects');
      if (pRes.ok) {
        const pData = await pRes.json();
        setProjects(Array.isArray(pData) ? pData : []);
      }

      const vRes = await apiFetch('/api/tenant/vehicles');
      if (vRes.ok) {
        const vData = await vRes.json();
        setAvailableVehicles(Array.isArray(vData) ? vData : []);
      }
    } catch (err) {
      console.error('Error fetching master data:', err);
      showToast('Failed to load stockyard data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Stockyard Hub Details (Inventory, Transactions, Racks, Shifts, Piles)
  const fetchYardDetails = async (yardId: number) => {
    try {
      const invRes = await apiFetch(`/api/tenant/stockyards/${yardId}/inventory`);
      if (invRes.ok) {
        const invData = await invRes.json();
        setProjectInventory(Array.isArray(invData) ? invData : []);
      }

      const txRes = await apiFetch(`/api/tenant/stockyard-transactions?stockyardId=${yardId}`);
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(Array.isArray(txData) ? txData : []);
      }

      const pileRes = await apiFetch(`/api/tenant/stockyards/${yardId}/piles`);
      if (pileRes.ok) {
        const pileData = await pileRes.json();
        setPiles(Array.isArray(pileData) ? pileData : []);
      }

      // Racks
      const rRes = await apiFetch(`/api/tenant/stockyards/${yardId}/racks`);
      if (rRes.ok) {
        const rData = await rRes.json();
        setRacks(Array.isArray(rData) ? rData : []);
      }

      // Rack Inventory
      const rInvRes = await apiFetch(`/api/tenant/stockyards/${yardId}/rack-inventory`);
      if (rInvRes.ok) {
        const rInvData = await rInvRes.json();
        setRackInventory(Array.isArray(rInvData) ? rInvData : []);
      }

      // Shifts History
      const sRes = await apiFetch(`/api/tenant/stockyards/${yardId}/shifts`);
      if (sRes.ok) {
        const sData = await sRes.json();
        setShiftsHistory(Array.isArray(sData) ? sData : []);
      }

      // Eligible Heavy Machinery (JCB, Loader, Excavator, etc.)
      const eqRes = await apiFetch(`/api/tenant/stockyards/${yardId}/eligible-equipment`);
      if (eqRes.ok) {
        const eqData = await eqRes.json();
        setEligibleEquipment(Array.isArray(eqData) ? eqData : []);
      }

      // Stockyard Equipment Utilization Ledger & Report
      const utilRes = await apiFetch(`/api/tenant/stockyards/${yardId}/equipment-utilization`);
      if (utilRes.ok) {
        const utilData = await utilRes.json();
        setYardEquipmentUtilization(Array.isArray(utilData.records) ? utilData.records : []);
        setYardEquipmentSummary(utilData.summary || {
          totalHours: 0,
          totalOperations: 0,
          totalQuantity: 0,
          activeMachinesCount: 0,
          machineHours: [],
          operationBreakdown: {}
        });
      }
    } catch (err) {
      console.error('Error fetching yard details:', err);
    }
  };

  // Dedicated Project Details
  const fetchProjectStockyardDetails = async (yardId: number, projId: string) => {
    setLoadingProject(true);
    try {
      const res = await apiFetch(`/api/tenant/stockyards/${yardId}/projects/${encodeURIComponent(projId)}`);
      if (res.ok) {
        const data = await res.json();
        setProjectDetailData(data);
      }
    } catch (err) {
      console.error('Error loading project details:', err);
    } finally {
      setLoadingProject(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    if (selectedYard) {
      fetchYardDetails(selectedYard.id);
    }
  }, [selectedYard?.id]);

  useEffect(() => {
    if (selectedYard && selectedProjectId && viewMode === 'project-detail') {
      fetchProjectStockyardDetails(selectedYard.id, selectedProjectId);
    }
  }, [selectedYard?.id, selectedProjectId, viewMode]);

  // Filtered Stockyard List
  const filteredStockyards = useMemo(() => {
    return stockyards.filter(y => {
      if (selectedDivisionFilter !== 'ALL') {
        if (String(y.divisionId) !== String(selectedDivisionFilter) && y.divisionName !== selectedDivisionFilter) {
          return false;
        }
      }
      if (selectedStatusFilter !== 'ALL') {
        if (y.status?.toLowerCase() !== selectedStatusFilter.toLowerCase()) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          y.yardName?.toLowerCase().includes(q) ||
          y.yardCode?.toLowerCase().includes(q) ||
          y.location?.toLowerCase().includes(q) ||
          y.divisionName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [stockyards, selectedDivisionFilter, selectedStatusFilter, searchQuery]);

  // Filtered Ledger Transactions (Stockyard Hub view)
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (ledgerTypeFilter !== 'ALL' && t.transactionType !== ledgerTypeFilter) {
        return false;
      }
      if (ledgerProjectFilter !== 'ALL' && t.projectId !== ledgerProjectFilter) {
        return false;
      }
      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase();
        return (
          t.materialName?.toLowerCase().includes(q) ||
          t.vehicleNumber?.toLowerCase().includes(q) ||
          t.driverName?.toLowerCase().includes(q) ||
          t.waybillNumber?.toLowerCase().includes(q) ||
          t.weighbridgeSlipNumber?.toLowerCase().includes(q) ||
          t.projectName?.toLowerCase().includes(q) ||
          t.remarks?.toLowerCase().includes(q) ||
          t.grnNumber?.toLowerCase().includes(q) ||
          t.shiftId?.toLowerCase().includes(q) ||
          t.sourceLocation?.toLowerCase().includes(q) ||
          t.destinationLocation?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, ledgerTypeFilter, ledgerProjectFilter, ledgerSearch]);

  // Overall Network Metrics
  const networkMetrics = useMemo(() => {
    const totalCap = stockyards.reduce((acc, y) => acc + (parseFloat(String(y.totalCapacityTons)) || 0), 0);
    const totalAvail = stockyards.reduce((acc, y) => acc + (parseFloat(String(y.currentAvailableStock || y.currentOccupancyTons)) || 0), 0);
    const totalReceived = stockyards.reduce((acc, y) => acc + (parseFloat(String(y.totalReceived)) || 0), 0);
    const activeYards = stockyards.filter(y => y.status === 'Active').length;
    return {
      totalCap,
      totalAvail,
      totalReceived,
      activeYards,
      utilizationPct: totalCap > 0 ? Math.round((totalAvail / totalCap) * 100) : 0
    };
  }, [stockyards]);

  // Filtered Stockyard Heavy Equipment Utilization
  const filteredYardEquipment = useMemo(() => {
    return yardEquipmentUtilization.filter(u => {
      if (eqYardOpFilter !== 'ALL' && u.operationType !== eqYardOpFilter) return false;
      if (eqYardMachineFilter !== 'ALL' && u.equipmentNumber !== eqYardMachineFilter && u.equipmentId !== eqYardMachineFilter) return false;
      if (eqYardSearch.trim()) {
        const q = eqYardSearch.toLowerCase();
        const num = (u.equipmentNumber || '').toLowerCase();
        const name = (u.equipmentName || '').toLowerCase();
        const typ = (u.equipmentType || '').toLowerCase();
        const op = (u.operatorName || '').toLowerCase();
        const proj = (u.projectName || '').toLowerCase() + ' ' + (u.projectId || '').toLowerCase();
        const mat = (u.materialName || '').toLowerCase();
        const rem = (u.remarks || '').toLowerCase();
        const shift = (u.shiftId || '').toLowerCase();
        return num.includes(q) || name.includes(q) || typ.includes(q) || op.includes(q) || proj.includes(q) || mat.includes(q) || rem.includes(q) || shift.includes(q);
      }
      return true;
    });
  }, [yardEquipmentUtilization, eqYardOpFilter, eqYardMachineFilter, eqYardSearch]);

  // ==========================================
  // NAVIGATION HANDLERS
  // ==========================================

  const handleOpenYard = (yard: Stockyard) => {
    setSelectedYard(yard);
    setViewMode('yard-detail');
    setYardActiveTab('projects');
  };

  const handleOpenProjectPage = (projId: string) => {
    setSelectedProjectId(projId);
    setViewMode('project-detail');
    setProjectActiveTab('trips');
    setActiveProjectSection('trips');
    setTimeout(() => {
      const main = document.querySelector('main');
      if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  };

  const scrollToProjectSection = (key: 'trips' | 'materials' | 'racks' | 'outward' | 'shifts' | 'reconcile') => {
    setActiveProjectSection(key);
    const el = document.getElementById(`project-section-${key}`);
    if (!el) return;

    const main = el.closest('main') || document.querySelector('main');
    if (main) {
      const navBar = document.getElementById('project-sticky-nav-bar');
      const navBarHeight = navBar ? navBar.offsetHeight + 24 : 96;
      const elRect = el.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const targetScrollTop = main.scrollTop + (elRect.top - mainRect.top) - navBarHeight;
      main.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (viewMode !== 'project-detail') return;

    const sectionKeys: ('trips' | 'materials' | 'racks' | 'outward' | 'shifts' | 'reconcile')[] = [
      'trips',
      'materials',
      'racks',
      'outward',
      'shifts',
      'reconcile'
    ];

    const main = document.querySelector('main');
    if (!main) return;

    let timeoutId: any = null;
    const handleScroll = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        const navBar = document.getElementById('project-sticky-nav-bar');
        const navBarBottom = navBar ? navBar.getBoundingClientRect().bottom : 120;
        const threshold = navBarBottom + 50;

        let current: 'trips' | 'materials' | 'racks' | 'outward' | 'shifts' | 'reconcile' = 'trips';
        for (const key of sectionKeys) {
          const el = document.getElementById(`project-section-${key}`);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= threshold) {
              current = key;
            }
          }
        }
        setActiveProjectSection(current);
      }, 50);
    };

    main.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      main.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [viewMode]);

  const handleOpenDeepStockAdd = (prefillProjectId?: string) => {
    setFormError(null);
    const targetProjId = prefillProjectId || (projectInventory[0]?.projectId || projects[0]?.projectId || projects[0]?.id || '');
    const matchedProj = projects.find(p => p.projectId === targetProjId || p.id === targetProjId);

    setStockAddForm({
      transportMode: 'TRUCK',
      projectId: targetProjId,
      projectName: matchedProj?.name || targetProjId,
      materialName: matchedProj?.commodity || 'Track Ballast 40mm (RDSO)',
      unit: 'MT',
      qualityGrade: 'RDSO Class-A / Industrial Grade',
      moisturePct: '1.2',
      supplierName: 'National Mineral Quarry Division',
      challanNumber: `DC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      sourceLocation: 'Quarry Pit 04 Siding',
      vehicleNumber: '',
      transporterName: 'InfraOps Logistics Fleet',
      driverName: '',
      driverPhone: '',
      dispatchQuantity: '35.50',
      grossWeight: '52.40',
      tareWeight: '17.20',
      netWeight: '35.20',
      weighbridgeSlipNumber: `WB-SLIP-${Math.floor(1000 + Math.random() * 9000)}`,
      waybillNumber: `EWB-7890-${Math.floor(100 + Math.random() * 900)}`,
      rackId: racks[0]?.id ? String(racks[0].id) : '',
      rackName: racks[0]?.rackName || '',
      pileId: piles[0]?.id ? String(piles[0].id) : '',
      remarks: 'Certified automated gross/tare weighment & zero contamination verified.'
    });

    setViewMode('deep-stock-add');
  };

  const handleOpenShiftModal = (prefillProjId?: string, prefillMat?: string, prefillSourceRack?: string) => {
    setFormError(null);
    const pId = prefillProjId || projectInventory[0]?.projectId || projects[0]?.projectId || '';
    const mMatch = projects.find(p => p.projectId === pId || p.id === pId);
    const mat = prefillMat || projectInventory[0]?.materialName || mMatch?.commodity || 'Track Ballast 40mm';

    const source = prefillSourceRack || (racks[0]?.rackName || 'Rack A');
    const dest = racks.length > 1 ? (racks.find(r => r.rackName !== source)?.rackName || 'Rack B') : 'Rack B';

    setShiftForm({
      projectId: pId,
      projectName: mMatch?.name || pId,
      materialName: mat,
      unit: 'MT',
      sourceRackId: racks.find(r => r.rackName === source)?.id ? String(racks.find(r => r.rackName === source)?.id) : '',
      sourceRackName: source,
      destinationRackId: racks.find(r => r.rackName === dest)?.id ? String(racks.find(r => r.rackName === dest)?.id) : '',
      destinationRackName: dest,
      quantity: '10.00',
      shiftDate: new Date().toISOString().slice(0, 16),
      remarks: 'Internal stack relocation for rail siding hopper clearance'
    });

    setIsShiftModalOpen(true);
  };

  // ==========================================
  // FORM SUBMISSION HANDLERS
  // ==========================================

  // 1. Create Stockyard
  const handleCreateStockyard = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!yardForm.yardName.trim()) {
      setFormError('Stockyard Name is required.');
      return;
    }
    if (!yardForm.location.trim()) {
      setFormError('Stockyard Location is required.');
      return;
    }
    if (!yardForm.divisionId) {
      setFormError('Please select a Division.');
      return;
    }
    setIsSubmitting(true);
    try {
      const selectedDiv = divisions.find(d => String(d.id) === String(yardForm.divisionId));
      const payload = {
        ...yardForm,
        divisionName: selectedDiv?.name || '',
        firebaseUid: currentUser?.uid,
        totalCapacityTons: parseFloat(yardForm.totalCapacityTons) || 50000,
        weighbridgeCapacityTons: parseFloat(yardForm.weighbridgeCapacityTons) || 100
      };
      const res = await apiFetch('/api/tenant/stockyards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create stockyard.');
      showToast(`Stockyard "${data.yardName}" registered successfully!`, 'success');
      setIsAddYardModalOpen(false);
      setYardForm({
        yardName: '', location: '', divisionId: '', yardCode: '', status: 'Active',
        totalCapacityTons: '50000', supervisorName: '', supervisorPhone: '',
        weighbridgeInstalled: true, weighbridgeCapacityTons: '100', notes: ''
      });
      await fetchMasterData(true);
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };
  // 2. Submit Deep Stock Add (Inward Receipt)
  const handleSubmitDeepStockAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYard) return;
    setFormError(null);
    if (!stockAddForm.projectId) {
      setFormError('Please select a Project.');
      return;
    }
    if (!stockAddForm.materialName.trim()) {
      setFormError('Material name is required.');
      return;
    }
    if (!stockAddForm.vehicleNumber.trim()) {
      setFormError('Vehicle registration plate / Rake ID is required.');
      return;
    }
    const netVal = parseFloat(calculatedStockAddNet);
    if (!netVal || netVal <= 0) {
      setFormError('Valid received net weight greater than zero is required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const proj = projects.find(p => p.projectId === stockAddForm.projectId || p.id === stockAddForm.projectId);
      const res = await apiFetch(`/api/tenant/stockyards/${selectedYard.id}/receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...stockAddForm,
          projectName: proj?.name || stockAddForm.projectId,
          netWeight: netVal,
          equipmentUsed: inwardEquipment,
          recordedBy: currentUser?.displayName || currentUser?.email || 'Weighbridge Terminal Gate'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record inward material stock.');

      showToast(`Successfully received ${netVal} MT into ${selectedYard.yardName}!`, 'success');

      if (data.transaction) {
        setActiveGrnReceipt(data.transaction);
        setIsGrnSlipModalOpen(true);
      }

      await fetchYardDetails(selectedYard.id);
      await fetchMasterData(true);

      if (selectedProjectId) {
        await fetchProjectStockyardDetails(selectedYard.id, selectedProjectId);
        setViewMode('project-detail');
      } else {
        setViewMode('yard-detail');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error recording material receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Dedicated Receive Vehicle / Rail Wagon Modal
  const handleOpenReceiveVehicleModal = (prefillProjectId?: string) => {
    setFormError(null);
    const targetProjId = prefillProjectId || selectedProjectId || projectInventory[0]?.projectId || projects[0]?.projectId || projects[0]?.id || '';
    const matchedProj = projects.find(p => p.projectId === targetProjId || p.id === targetProjId) || (projectDetailData ? { ...projectDetailData.project, id: projectDetailData.project.projectId } : null);
    const defaultMat = projectDetailData?.materials[0]?.materialName || projectInventory[0]?.materialName || matchedProj?.commodity || 'Track Ballast 40mm (RDSO)';
    const defaultRack = racks[0];
    const defaultVehicle = DEFAULT_ROAD_VEHICLES[0];

    setReceiveVehicleMode('TRUCK');
    setReceiveVehicleSearch('');
    setReceiveVehicleForm({
      transportMode: 'TRUCK',
      vehicleNumber: defaultVehicle.vehicleNumber,
      vehicleType: defaultVehicle.vehicleType,
      driverName: defaultVehicle.driverName,
      driverPhone: defaultVehicle.driverPhone,
      projectId: targetProjId,
      projectName: matchedProj?.name || targetProjId,
      materialName: defaultMat,
      unit: 'MT',
      rackId: defaultRack ? String(defaultRack.id) : '',
      rackName: defaultRack ? defaultRack.rackName : '',
      sourceLocation: 'Rewa Quarry Pit 04 Face',
      supplierName: 'National Mineral Quarry Division',
      challanNumber: `DC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      weighbridgeSlipNumber: `WB-REC-${Math.floor(10000 + Math.random() * 90000)}`,
      grossWeight: '52.40',
      tareWeight: '17.20',
      netWeight: '35.20',
      remarks: 'Certified automated weighbridge receipt & inward entry'
    });
    setIsReceiveVehicleModalOpen(true);
  };

  // Submit Vehicle / Rail Wagon Receipt
  const handleSubmitReceiveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYard) return;
    setFormError(null);

    const grossNum = parseFloat(receiveVehicleForm.grossWeight) || 0;
    const tareNum = parseFloat(receiveVehicleForm.tareWeight) || 0;
    let netNum = parseFloat(receiveVehicleForm.netWeight) || 0;
    if (grossNum > 0 && tareNum > 0 && grossNum > tareNum) {
      netNum = parseFloat((grossNum - tareNum).toFixed(2));
    }

    if (!receiveVehicleForm.vehicleNumber.trim()) {
      showToast('Please enter or select a vehicle or rail wagon number', 'error');
      return;
    }
    if (netNum <= 0) {
      showToast('Valid gross and tare weights resulting in positive net weight are required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const proj = projects.find(p => p.projectId === receiveVehicleForm.projectId || p.id === receiveVehicleForm.projectId);
      const payload = {
        firebaseUid: currentUser?.uid,
        transportMode: receiveVehicleForm.transportMode,
        projectId: receiveVehicleForm.projectId,
        projectName: proj?.name || receiveVehicleForm.projectName || receiveVehicleForm.projectId,
        materialName: receiveVehicleForm.materialName,
        unit: receiveVehicleForm.unit || 'MT',
        vehicleNumber: receiveVehicleForm.vehicleNumber.trim().toUpperCase(),
        driverName: receiveVehicleForm.driverName,
        driverPhone: receiveVehicleForm.driverPhone,
        sourceLocation: receiveVehicleForm.sourceLocation,
        supplierName: receiveVehicleForm.supplierName,
        challanNumber: receiveVehicleForm.challanNumber,
        weighbridgeSlipNumber: receiveVehicleForm.weighbridgeSlipNumber,
        grossWeight: grossNum,
        tareWeight: tareNum,
        netWeight: netNum,
        quantity: netNum,
        dispatchQuantity: netNum,
        rackId: receiveVehicleForm.rackId || null,
        rackName: receiveVehicleForm.rackName || null,
        remarks: receiveVehicleForm.remarks || `Inward ${receiveVehicleForm.transportMode === 'RAIL_RAKE' ? 'Rail Wagon' : 'Vehicle'} received`
      };

      const res = await apiFetch(`/api/tenant/stockyards/${selectedYard.id}/receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record vehicle receipt.');

      showToast(`${receiveVehicleForm.transportMode === 'RAIL_RAKE' ? 'Rail Wagon' : 'Vehicle'} ${receiveVehicleForm.vehicleNumber} received! Net: ${netNum} MT`, 'success');
      setIsReceiveVehicleModalOpen(false);

      if (data.transaction) {
        setActiveGrnReceipt(data.transaction);
        setIsGrnSlipModalOpen(true);
      }

      await fetchYardDetails(selectedYard.id);
      await fetchMasterData(true);

      if (selectedProjectId) {
        await fetchProjectStockyardDetails(selectedYard.id, selectedProjectId);
      }
    } catch (err: any) {
      showToast(err.message || 'Error executing vehicle receipt', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Submit Material Issue (Outward with Balance Check)
  const handleRecordIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYard) return;
    setFormError(null);

    if (!issueForm.projectId) {
      setFormError('Please select a Project.');
      return;
    }
    if (!issueForm.materialName.trim()) {
      setFormError('Material name is required.');
      return;
    }
    const issueQty = parseFloat(issueForm.quantity);
    if (!issueQty || issueQty <= 0) {
      setFormError('Please enter a valid issue quantity.');
      return;
    }
    if (issueQty > selectedProjectAvailableStock) {
      setFormError(`Insufficient stock: Project only has ${selectedProjectAvailableStock.toFixed(2)} ${issueForm.unit} available in this stockyard.`);
      return;
    }
    if (!issueForm.vehicleNumber.trim()) {
      setFormError('Vehicle registration number is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const proj = projects.find(p => p.projectId === issueForm.projectId || p.id === issueForm.projectId);
      const res = await apiFetch(`/api/tenant/stockyards/${selectedYard.id}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...issueForm,
          projectName: proj?.name || issueForm.projectId,
          equipmentUsed: issueEquipment,
          recordedBy: currentUser?.displayName || currentUser?.email || 'Stockyard Dispatch'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to issue material.');

      showToast(`Dispatched ${issueQty} ${issueForm.unit} via ${issueForm.vehicleNumber}`, 'success');
      setIsIssueModalOpen(false);
      setIssueForm({
        projectId: '', projectName: '', materialName: '', unit: 'MT', quantity: '',
        vehicleNumber: '', driverName: '', driverPhone: '', destinationLocation: '',
        weighbridgeSlipNumber: '', waybillNumber: '', grossWeight: '', tareWeight: '',
        rackId: '', rackName: '', remarks: ''
      });

      await fetchYardDetails(selectedYard.id);
      await fetchMasterData(true);
      if (selectedProjectId) {
        await fetchProjectStockyardDetails(selectedYard.id, selectedProjectId);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error issuing material.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Open Auto Variance Modal with Inward/Outward Calculation
  const handleOpenAutoVarianceModal = (targetMatName?: string, customQty?: number) => {
    setFormError(null);
    const projId = selectedProjectId || (projectInventory[0]?.projectId) || '';
    const projMatch = projects.find(p => p.projectId === projId || p.id === projId);
    const targetMat = targetMatName || projectDetailData?.materials[0]?.materialName || projectInventory.find(p => p.projectId === projId)?.materialName || 'Track Ballast 40mm';
    const matObj = projectDetailData?.materials.find(m => m.materialName === targetMat) || projectDetailData?.materials[0];

    const inward = matObj ? matObj.totalReceived : (projectDetailData?.metrics.totalReceived || 0);
    const outward = matObj ? matObj.totalIssued : (projectDetailData?.metrics.totalIssued || 0);
    const loss = matObj ? (matObj.totalLoss + matObj.totalAdjustment) : (projectDetailData?.metrics.totalLoss || 0);
    const netVar = customQty !== undefined ? customQty : parseFloat((inward - outward - loss).toFixed(2));

    const isDeficit = netVar < 0;
    const absQty = Math.abs(netVar);

    setAdjustForm({
      projectId: projId,
      projectName: projMatch?.name || projectDetailData?.project.name || projId,
      materialName: targetMat,
      unit: matObj?.unit || 'MT',
      adjustmentType: isDeficit ? 'ADJUSTMENT' : 'LOSS',
      quantity: absQty > 0 ? String(absQty) : '',
      reason: absQty > 0
        ? `Automatic balance variance reconciliation: Verified Inward (${inward.toLocaleString()} MT) vs Dispatched Outward (${outward.toLocaleString()} MT)`
        : 'Routine stockyard physical scale variance & moisture shrinkage true-up',
      physicalStock: String(inward - loss),
      bookStock: String(outward),
      variance: String(netVar)
    });
    setIsAdjustModalOpen(true);
  };

  // 4. Submit Reconcile / Wastage Adjustment
  const handleRecordAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYard) return;
    setFormError(null);

    if (!adjustForm.projectId) {
      setFormError('Please select a Project.');
      return;
    }
    if (!adjustForm.materialName.trim()) {
      setFormError('Material is required.');
      return;
    }
    const qty = parseFloat(adjustForm.quantity);
    if (!qty || qty <= 0) {
      setFormError('Please enter a valid quantity.');
      return;
    }
    if (!adjustForm.reason.trim()) {
      setFormError('A mandatory reason is required for audit reconciliation.');
      return;
    }

    setIsSubmitting(true);
    try {
      const proj = projects.find(p => p.projectId === adjustForm.projectId || p.id === adjustForm.projectId);
      const res = await apiFetch(`/api/tenant/stockyards/${selectedYard.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...adjustForm,
          projectName: proj?.name || adjustForm.projectId,
          recordedBy: currentUser?.displayName || currentUser?.email || 'Stock Auditor'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record adjustment.');

      showToast(data.message || 'Stock adjustment recorded successfully.', 'success');
      setIsAdjustModalOpen(false);
      setAdjustForm({
        projectId: '', projectName: '', materialName: '', unit: 'MT',
        adjustmentType: 'LOSS', quantity: '', reason: '', physicalStock: '', bookStock: '', variance: ''
      });

      await fetchYardDetails(selectedYard.id);
      await fetchMasterData(true);
      if (selectedProjectId) {
        await fetchProjectStockyardDetails(selectedYard.id, selectedProjectId);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error recording adjustment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Submit Internal Stock Shift (Net Zero Balance Movement)
  const handleSubmitInternalShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYard) return;
    setFormError(null);

    if (!shiftForm.projectId) {
      setFormError('Please select a Project.');
      return;
    }
    if (!shiftForm.materialName.trim()) {
      setFormError('Material type is required.');
      return;
    }
    const sQty = parseFloat(shiftForm.quantity);
    if (!sQty || sQty <= 0) {
      setFormError('Shift quantity must be greater than zero.');
      return;
    }
    if (!shiftForm.sourceRackName.trim()) {
      setFormError('Source rack or location is required.');
      return;
    }
    if (!shiftForm.destinationRackName.trim()) {
      setFormError('Destination rack or location is required.');
      return;
    }
    if (shiftForm.sourceRackName.trim().toLowerCase() === shiftForm.destinationRackName.trim().toLowerCase()) {
      setFormError('Source and Destination must be different storage locations.');
      return;
    }
    if (sQty > availableAtSourceRack) {
      setFormError(`Insufficient stock: Only ${availableAtSourceRack.toFixed(2)} ${shiftForm.unit} available at "${shiftForm.sourceRackName}".`);
      return;
    }

    setIsSubmitting(true);
    try {
      const proj = projects.find(p => p.projectId === shiftForm.projectId || p.id === shiftForm.projectId);
      const res = await apiFetch(`/api/tenant/stockyards/${selectedYard.id}/shift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...shiftForm,
          projectName: proj?.name || shiftForm.projectId,
          equipmentUsed: shiftEquipment,
          recordedBy: currentUser?.displayName || currentUser?.email || 'Yard Operations Supervisor'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to shift stock.');

      showToast(`Shifted ${sQty} ${shiftForm.unit} from ${shiftForm.sourceRackName} to ${shiftForm.destinationRackName}`, 'success');
      setIsShiftModalOpen(false);
      setShiftEquipment([]);
      setIsShiftEqOpen(false);

      await fetchYardDetails(selectedYard.id);
      await fetchMasterData(true);
      if (selectedProjectId) {
        await fetchProjectStockyardDetails(selectedYard.id, selectedProjectId);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error shifting stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5b. Submit Standalone Equipment Activity Log
  const handleSaveManualEquipmentLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYard) return;
    setFormError(null);

    if (!logEqForm.equipmentNumber) {
      setFormError('Please select equipment.');
      return;
    }
    const matchedEq = eligibleEquipment.find(eq => eq.equipmentNumber === logEqForm.equipmentNumber || eq.equipmentId === logEqForm.equipmentNumber);
    if (matchedEq && matchedEq.status === 'Under Maintenance') {
      setFormError(`Cannot assign machine: ${matchedEq.equipmentNumber} is Under Maintenance.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const proj = projects.find(p => p.projectId === logEqForm.projectId || p.id === logEqForm.projectId);
      const res = await apiFetch(`/api/tenant/stockyards/${selectedYard.id}/equipment-utilization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...logEqForm,
          equipmentId: matchedEq?.equipmentId || logEqForm.equipmentNumber,
          equipmentName: matchedEq?.make ? `${matchedEq.make} ${matchedEq.model || ''}` : logEqForm.equipmentNumber,
          equipmentType: matchedEq?.equipmentType || 'Heavy Equipment',
          projectName: proj?.name || logEqForm.projectId,
          operatorName: logEqForm.operatorName || matchedEq?.assignedOperatorName || '',
          operatorPhone: logEqForm.operatorPhone || matchedEq?.assignedOperatorPhone || '',
          recordedBy: currentUser?.displayName || currentUser?.email || 'Stockyard Supervisor'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log equipment activity.');

      showToast(`Logged ${logEqForm.durationHours} hrs for ${logEqForm.equipmentNumber}`, 'success');
      setIsLogEqModalOpen(false);
      await fetchYardDetails(selectedYard.id);
    } catch (err: any) {
      setFormError(err.message || 'Error logging equipment activity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Submit Add / Edit Rack
  const handleSaveRack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYard) return;
    setFormError(null);

    if (!rackForm.rackName.trim()) {
      setFormError('Rack / Location name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingRack
        ? `/api/tenant/stockyards/${selectedYard.id}/racks/${editingRack.id}`
        : `/api/tenant/stockyards/${selectedYard.id}/racks`;
      const method = editingRack ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rackForm)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save storage location.');

      showToast(editingRack ? 'Location updated successfully!' : 'Storage location added successfully!', 'success');
      setIsAddRackModalOpen(false);
      setEditingRack(null);
      setRackForm({
        rackName: '', rackCode: '', locationType: 'Rack', capacityTons: '10000', description: '', status: 'Active'
      });

      await fetchYardDetails(selectedYard.id);
    } catch (err: any) {
      setFormError(err.message || 'Error saving storage location.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 7. Delete Rack
  const handleDeleteRack = async (rackId: number) => {
    if (!selectedYard || !window.confirm('Are you sure you want to delete this storage location?')) return;
    try {
      const res = await apiFetch(`/api/tenant/stockyards/${selectedYard.id}/racks/${rackId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Storage location removed', 'success');
        await fetchYardDetails(selectedYard.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // RENDER SECTIONS
  // ==========================================

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-200">

      {/* Floating Toast Alert */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold animate-in slide-in-from-top-2 ${toast.type === 'success'
          ? 'bg-slate-900 text-white border-slate-700'
          : 'bg-rose-900 text-white border-rose-700'
          }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 1: GLOBAL STOCKYARDS NETWORK LIST                         */}
      {/* ============================================================== */}
      {viewMode === 'list' && (
        <>
          {/* Top Banner & KPI Cards */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#00705a] flex items-center justify-center font-bold shadow-sm border border-emerald-100">
                  <Layers size={24} />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stockyard Management</h1>
                  <p className="text-xs text-slate-500 font-medium">Enterprise multi-project material hubs, optional internal rack shifting & vehicle dwell tracking</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => fetchMasterData(true)}
                  disabled={refreshing}
                  className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                  title="Refresh stockyards"
                >
                  <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => {
                    setFormError(null);
                    setYardForm(prev => ({
                      ...prev,
                      yardCode: `SYD-${Math.floor(1000 + Math.random() * 9000)}`
                    }));
                    setIsAddYardModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-sm transition-all"
                >
                  <Plus size={16} />
                  <span>Add Stockyard</span>
                </button>
              </div>
            </div>

            {/* Network Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  <span>Registered Stockyards</span>
                  <Building2 size={15} className="text-slate-500" />
                </div>
                <div className="text-2xl font-black text-slate-900">{stockyards.length}</div>
                <p className="text-[11px] text-slate-500 mt-0.5">{networkMetrics.activeYards} active operational yards</p>
              </div>

              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  <span>Total Network Capacity</span>
                  <Gauge size={15} className="text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">{networkMetrics.totalCap.toLocaleString()} <span className="text-sm font-bold text-slate-500">MT</span></div>
                <p className="text-[11px] text-slate-500 mt-0.5">Holding capacity across yards</p>
              </div>

              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  <span>Current Available Stock</span>
                  <Package size={15} className="text-blue-600" />
                </div>
                <div className="text-2xl font-black text-blue-700">{networkMetrics.totalAvail.toLocaleString()} <span className="text-sm font-bold text-slate-500">MT</span></div>
                <p className="text-[11px] text-slate-500 mt-0.5">{networkMetrics.utilizationPct}% network occupancy</p>
              </div>

              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  <span>Cumulative Receipts</span>
                  <TrendingUp size={15} className="text-amber-600" />
                </div>
                <div className="text-2xl font-black text-emerald-800">{networkMetrics.totalReceived.toLocaleString()} <span className="text-sm font-bold text-slate-500">MT</span></div>
                <p className="text-[11px] text-slate-500 mt-0.5">Confirmed weighbridge dispatches</p>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search stockyards by name, code, or location..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#00705a] focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                <Filter size={13} className="text-slate-400" />
                <span className="text-slate-500 font-semibold">Division:</span>
                <select
                  value={selectedDivisionFilter}
                  onChange={e => setSelectedDivisionFilter(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Divisions</option>
                  {divisions.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                <span className="text-slate-500 font-semibold">Status:</span>
                <select
                  value={selectedStatusFilter}
                  onChange={e => setSelectedStatusFilter(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Stockyards Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-[#00705a]" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Registered Stockyard Hubs ({filteredStockyards.length})
                </span>
              </div>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                <RefreshCw size={24} className="animate-spin text-[#00705a]" />
                <span className="text-xs font-semibold">Loading stockyard network from database...</span>
              </div>
            ) : filteredStockyards.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Building2 size={36} className="mx-auto mb-2 text-slate-300" />
                <div className="text-sm font-bold text-slate-700">No stockyards found</div>
                <p className="text-xs text-slate-400 mt-1">Try modifying your search or click "Add Stockyard" to create a new one.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-black uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-6">Stockyard Name & Code</th>
                      <th className="py-3.5 px-6">Location</th>
                      <th className="py-3.5 px-6">Division</th>
                      <th className="py-3.5 px-6 text-center">Active Projects</th>
                      <th className="py-3.5 px-6 text-center">Material Types</th>
                      <th className="py-3.5 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredStockyards.map(yard => {
                      return (
                        <tr
                          key={yard.id}
                          onClick={() => handleOpenYard(yard)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#00705a] border border-emerald-100 flex items-center justify-center font-black text-xs shrink-0 group-hover:bg-[#00705a] group-hover:text-white transition-colors">
                                {yard.yardCode.slice(-3)}
                              </div>
                              <div>
                                <div className="font-black text-slate-900 group-hover:text-[#00705a] transition-colors">
                                  {yard.yardName}
                                </div>
                                <div className="text-[11px] font-bold text-slate-400 mt-0.5">
                                  {yard.yardCode}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-6 text-slate-600 font-medium">
                            <div className="flex items-center gap-1.5">
                              <MapPin size={13} className="text-slate-400 shrink-0" />
                              <span className="truncate max-w-[200px]">{yard.location || '—'}</span>
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {yard.divisionName || 'Corporate HQ'}
                            </span>
                          </td>

                          <td className="py-4 px-6 text-center">
                            <span className="inline-flex items-center justify-center min-w-[26px] px-2 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
                              {yard.projectsCount || 0}
                            </span>
                          </td>

                          <td className="py-4 px-6 text-center">
                            <span className="inline-flex items-center justify-center min-w-[26px] px-2 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {yard.materialsCount || 0}
                            </span>
                          </td>

                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenYard(yard);
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-black text-[#00705a] hover:text-[#005a48] group-hover:translate-x-0.5 transition-all"
                            >
                              <span>Open Hub</span>
                              <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ============================================================== */}
      {/* VIEW 2: STOCKYARD HUB DETAIL VIEW                              */}
      {/* ============================================================== */}
      {viewMode === 'yard-detail' && selectedYard && (
        <div className="space-y-6">

          {/* Breadcrumb Navigation & Hub Header */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setViewMode('list')}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors"
              >
                <ArrowLeft size={14} />
                <span>All Stockyards</span>
              </button>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-bold text-slate-400">{selectedYard.yardCode}</span>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-[#00705a] border border-emerald-200">
                    {selectedYard.yardCode}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                    {selectedYard.divisionName || 'Corporate Division'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                    {selectedYard.status || 'Active'}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
                  {selectedYard.yardName}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium mt-1.5">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-slate-400" />
                    {selectedYard.location}
                  </span>
                  {selectedYard.supervisorName && (
                    <span className="flex items-center gap-1.5">
                      <User size={13} className="text-slate-400" />
                      {selectedYard.supervisorName} {selectedYard.supervisorPhone ? `(${selectedYard.supervisorPhone})` : ''}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Scale size={13} className="text-slate-400" />
                    Weighbridge: {selectedYard.weighbridgeInstalled ? `${selectedYard.weighbridgeCapacityTons || 100}T Certified` : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-100 overflow-x-auto pb-1">
              <button
                onClick={() => setYardActiveTab('projects')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${yardActiveTab === 'projects'
                  ? 'bg-[#00705a] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <Package size={14} />
                <span>Project-Wise Material Portals</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${yardActiveTab === 'projects' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                  {projectInventory.length}
                </span>
              </button>

              <button
                onClick={() => setYardActiveTab('digital-twin')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${yardActiveTab === 'digital-twin'
                  ? 'bg-[#00705a] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <Compass size={14} className={yardActiveTab === 'digital-twin' ? 'text-white' : 'text-emerald-700'} />
                <span>Spatial Digital Twin (2D Map)</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border transition-colors ${yardActiveTab === 'digital-twin'
                  ? 'bg-white/25 text-white border-white/40'
                  : 'bg-emerald-50 text-[#00705a] border-emerald-200'
                  }`}>
                  Live
                </span>
              </button>

              <button
                onClick={() => setYardActiveTab('live-queue')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${yardActiveTab === 'live-queue'
                  ? 'bg-[#00705a] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <Truck size={14} className={yardActiveTab === 'live-queue' ? 'text-white' : 'text-blue-600'} />
                <span>Live Weighbridge Radar</span>
                {activeTrucksInYard.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${yardActiveTab === 'live-queue' ? 'bg-white/20 text-white' : 'bg-rose-500 text-white animate-pulse'}`}>
                    {activeTrucksInYard.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setYardActiveTab('racks')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${yardActiveTab === 'racks'
                  ? 'bg-[#00705a] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <Box size={14} />
                <span>Racks & Storage Locations ({racks.length})</span>
              </button>

              <button
                onClick={() => setYardActiveTab('shifts')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${yardActiveTab === 'shifts'
                  ? 'bg-[#00705a] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <ArrowLeftRight size={14} />
                <span>Internal Stock Shifts ({shiftsHistory.length})</span>
              </button>

              <button
                onClick={() => setYardActiveTab('equipment')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${yardActiveTab === 'equipment'
                  ? 'bg-[#00705a] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <Wrench size={14} className={yardActiveTab === 'equipment' ? 'text-white' : 'text-emerald-700'} />
                <span>Equipment Usage History ({yardEquipmentUtilization.length})</span>
              </button>

              <button
                onClick={() => setYardActiveTab('reconciliation')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${yardActiveTab === 'reconciliation'
                  ? 'bg-[#00705a] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <Scale size={14} className={yardActiveTab === 'reconciliation' ? 'text-white' : 'text-amber-600'} />
                <span>Moisture & Drone True-Up</span>
              </button>

              <button
                onClick={() => setYardActiveTab('ledger')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${yardActiveTab === 'ledger'
                  ? 'bg-[#00705a] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <History size={14} />
                <span>Audit Ledger ({transactions.length})</span>
              </button>
            </div>
          </div>

          {/* TAB 1: PROJECT-WISE SEPARATE PORTALS */}
          {yardActiveTab === 'projects' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Package size={18} className="text-[#00705a]" />
                    <span>Project Inventory Portals & Accounting Ledger</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click any project row or "Open Full Page" to inspect complete vehicle in-time, dwell scale analytics, and trip history.
                  </p>
                </div>
              </div>

              {projectInventory.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Package size={36} className="mx-auto mb-2 text-slate-300" />
                  <div className="text-sm font-bold text-slate-700">No project inventory records</div>
                  <p className="text-xs text-slate-400 mt-1">No project inventory records recorded for this stockyard hub.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                        <th className="py-3.5 px-6">Project Name & ID</th>
                        <th className="py-3.5 px-6">Material Type</th>
                        <th className="py-3.5 px-6 text-right">Planned (Corridor)</th>
                        <th className="py-3.5 px-6 text-right">Total Received</th>
                        <th className="py-3.5 px-6 text-right">Total Issued</th>
                        <th className="py-3.5 px-6 text-right">Loss / Adjust</th>
                        <th className="py-3.5 px-6 text-right">Current Available</th>
                        <th className="py-3.5 px-6">Last Vehicle Reference</th>
                        <th className="py-3.5 px-6 text-right">Dedicated Page</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {projectInventory.map((item, idx) => {
                        return (
                          <tr
                            key={idx}
                            onClick={() => handleOpenProjectPage(item.projectId)}
                            className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                          >
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-900 group-hover:text-[#00705a] transition-colors">{item.projectName}</span>
                                {item.isPlannedAssociation && item.totalReceived === 0 && (
                                  <span className="text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded shrink-0">
                                    Corridor Stop · Awaiting Inward
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-bold text-slate-400 mt-0.5">{item.projectId}</div>
                            </td>

                            <td className="py-4 px-6">
                              <span className="font-bold text-slate-800">{item.materialName}</span>
                              <div className="text-[10px] text-slate-400 font-medium">Unit: {item.unit}</div>
                            </td>

                            <td className="py-4 px-6 text-right font-black text-slate-800">
                              {item.plannedQuantity ? (
                                <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 font-mono">
                                  {item.plannedQuantity.toLocaleString()} {item.unit}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">—</span>
                              )}
                            </td>

                            <td className="py-4 px-6 text-right font-bold text-emerald-700">
                              {item.totalReceived.toLocaleString()} {item.unit}
                            </td>

                            <td className="py-4 px-6 text-right font-bold text-blue-700">
                              {item.totalIssued.toLocaleString()} {item.unit}
                            </td>

                            <td className="py-4 px-6 text-right font-bold text-amber-700">
                              {(item.totalLoss + item.totalAdjustment).toLocaleString()} {item.unit}
                            </td>

                            <td className="py-4 px-6 text-right font-black text-slate-900 text-sm">
                              <span className={`px-2 py-0.5 rounded-lg border ${item.currentAvailable > 0
                                ? 'bg-emerald-50 text-[#00705a] border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                {item.currentAvailable.toLocaleString()} {item.unit}
                              </span>
                            </td>

                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-800">{item.lastVehicleNumber || '—'}</div>
                              <div className="text-[10px] text-slate-400">{item.lastWeighbridgeSlip || '—'}</div>
                            </td>

                            <td className="py-4 px-6 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenProjectPage(item.projectId);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 group-hover:bg-[#00705a] group-hover:text-white text-slate-700 text-xs font-bold transition-all shadow-sm"
                              >
                                <span>Open Full Page</span>
                                <ArrowRight size={13} />
                              </button>
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

          {/* TAB 3: OPTIONAL RACKS & STORAGE LOCATIONS */}
          {yardActiveTab === 'racks' && (
            <div className="space-y-6">
              {/* Header Card for Rack Management */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <Box size={18} className="text-[#00705a]" />
                    <h3 className="text-base font-black text-slate-900">Optional Internal Rack, Stack & Location Management</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage internal storage locations (Rack A, Stack B, Open Area) within {selectedYard.yardName}. This is completely optional.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleOpenShiftModal()}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider px-3.5 py-2 rounded-xl shadow-sm transition-all"
                  >
                    <ArrowLeftRight size={14} />
                    <span>Shift Stock</span>
                  </button>

                  <button
                    onClick={() => {
                      setFormError(null);
                      setEditingRack(null);
                      setRackForm({
                        rackName: '',
                        rackCode: `RCK-${Math.floor(100 + Math.random() * 900)}`,
                        locationType: 'Rack',
                        capacityTons: '10000',
                        description: '',
                        status: 'Active'
                      });
                      setIsAddRackModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-black uppercase tracking-wider px-3.5 py-2 rounded-xl shadow-sm transition-all"
                  >
                    <Plus size={14} />
                    <span>Add Location / Rack</span>
                  </button>
                </div>
              </div>

              {/* Racks Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {racks.map(rack => (
                  <div key={rack.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                        {rack.rackCode}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {rack.locationType || 'Rack'}
                      </span>
                    </div>

                    <div>
                      <div className="font-black text-slate-900 text-sm">{rack.rackName}</div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">{rack.description || 'Dedicated project material location'}</div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-bold">Capacity: {rack.capacityTons.toLocaleString()} MT</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rack.status === 'Active' ? 'bg-emerald-50 text-[#00705a]' : 'bg-slate-100 text-slate-500'}`}>
                        {rack.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setEditingRack(rack);
                          setRackForm({
                            rackName: rack.rackName,
                            rackCode: rack.rackCode,
                            locationType: rack.locationType,
                            capacityTons: String(rack.capacityTons),
                            description: rack.description || '',
                            status: rack.status
                          });
                          setIsAddRackModalOpen(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit rack"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteRack(rack.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete rack"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rack-Wise Inventory Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Rack-Wise Material Inventory Breakdown
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Inventory tracked by storage location. Total stockyard inventory remains constant across internal shifts.
                    </p>
                  </div>
                </div>

                {rackInventory.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No rack-assigned material yet. Racks are optional — materials received without rack selection appear under open storage.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-6">Storage Location / Rack</th>
                          <th className="py-3 px-6">Project Name</th>
                          <th className="py-3 px-6">Material Commodity</th>
                          <th className="py-3 px-6 text-right">Available Stock</th>
                          <th className="py-3 px-6 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rackInventory.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/75 transition-colors">
                            <td className="py-3.5 px-6">
                              <span className="font-black text-slate-900">{item.rackName}</span>
                              <div className="text-[10px] text-slate-400 font-bold">{item.rackCode}</div>
                            </td>

                            <td className="py-3.5 px-6">
                              <div className="font-bold text-slate-900">{item.projectName}</div>
                              <div className="text-[10px] text-slate-400">{item.projectId}</div>
                            </td>

                            <td className="py-3.5 px-6 font-semibold text-slate-700">
                              {item.materialName}
                            </td>

                            <td className="py-3.5 px-6 text-right font-black text-indigo-700 text-sm">
                              {item.currentAvailable.toLocaleString()} {item.unit}
                            </td>

                            <td className="py-3.5 px-6 text-right">
                              <button
                                onClick={() => handleOpenShiftModal(item.projectId, item.materialName, item.rackName)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs transition-colors"
                              >
                                <ArrowLeftRight size={12} />
                                <span>Shift Stock</span>
                              </button>
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

          {/* TAB 4: INTERNAL STOCK SHIFT HISTORY */}
          {yardActiveTab === 'shifts' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <ArrowLeftRight size={16} className="text-indigo-600" />
                    <span>Internal Relocation Audit Trail ({shiftsHistory.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Internal movements between racks within {selectedYard.yardName}. Does not increase or decrease total stock.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenShiftModal()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-sm transition-all"
                >
                  <Plus size={14} />
                  <span>Shift Stock</span>
                </button>
              </div>

              {shiftsHistory.length === 0 ? (
                <div className="py-14 text-center text-slate-400 text-xs">
                  No internal stock shifts have been recorded in this stockyard yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-6">Shift ID & Date</th>
                        <th className="py-3 px-6">Project</th>
                        <th className="py-3 px-6">Material</th>
                        <th className="py-3 px-6">Movement Route</th>
                        <th className="py-3 px-6 text-right">Quantity</th>
                        <th className="py-3 px-6">Remarks / Operator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shiftsHistory.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50/75 transition-colors">
                          <td className="py-3 px-6">
                            <span className="font-black text-indigo-900">{s.shiftId}</span>
                            <div className="text-[10px] text-slate-400">{new Date(s.createdAt).toLocaleString()}</div>
                          </td>

                          <td className="py-3 px-6 font-bold text-slate-900">
                            {s.projectName}
                          </td>

                          <td className="py-3 px-6 font-medium text-slate-700">
                            {s.materialName}
                          </td>

                          <td className="py-3 px-6">
                            <div className="flex items-center gap-1.5 font-bold">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">{s.sourceLocation || 'Rack A'}</span>
                              <ArrowRight size={12} className="text-indigo-600" />
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800">{s.destinationLocation || 'Rack B'}</span>
                            </div>
                          </td>

                          <td className="py-3 px-6 text-right font-black text-indigo-700">
                            {s.quantity.toLocaleString()} {s.unit || 'MT'}
                          </td>

                          <td className="py-3 px-6 text-slate-500">
                            <div>{s.remarks}</div>
                            <div className="text-[10px] text-slate-400">{s.recordedBy}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: HEAVY EQUIPMENT USAGE HISTORY & UTILIZATION REPORT */}
          {yardActiveTab === 'equipment' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Header Card */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0 border border-emerald-100 shadow-xs">
                    <Wrench size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <span>Heavy Equipment Utilization Report & Activity Ledger</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Fleet Integration
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Operational tracking of JCBs, loaders, excavators, and forklifts deployed at {selectedYard.yardName} for material handling.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setFormError(null);
                      setLogEqForm({
                        projectId: projects[0]?.projectId || '',
                        projectName: projects[0]?.name || '',
                        equipmentNumber: eligibleEquipment[0]?.equipmentNumber || '',
                        operationType: 'OTHER',
                        materialName: piles[0]?.materialName || 'Track Ballast 40mm',
                        quantity: '20.00',
                        unit: 'MT',
                        sourceRackName: racks[0]?.rackName || 'Bay-A1',
                        destinationRackName: racks[1]?.rackName || 'Bay-B1',
                        startTime: new Date(Date.now() - 3600000).toISOString().slice(0, 16),
                        endTime: new Date().toISOString().slice(0, 16),
                        durationHours: '1.0',
                        operatorName: eligibleEquipment[0]?.assignedOperatorName || '',
                        operatorPhone: eligibleEquipment[0]?.assignedOperatorPhone || '',
                        remarks: ''
                      });
                      setIsLogEqModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#00705a] hover:bg-[#005a48] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all"
                  >
                    <Plus size={14} />
                    <span>Log Equipment Activity</span>
                  </button>
                </div>
              </div>

              {/* 4 Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    <span>Total Operating Hours</span>
                    <Clock size={15} className="text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {yardEquipmentSummary.totalHours || 0} <span className="text-xs font-bold text-slate-400">hours</span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-1">
                    Cumulative machine hours in yard
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    <span>Machinery Deployed</span>
                    <Wrench size={15} className="text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {yardEquipmentSummary.activeMachinesCount || 0} <span className="text-xs font-bold text-slate-400">machines</span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-1">
                    Active JCBs, loaders, excavators
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    <span>Operations Completed</span>
                    <Activity size={15} className="text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {yardEquipmentSummary.totalOperations || 0} <span className="text-xs font-bold text-slate-400">tasks</span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-1">
                    Unloading, loading, and shifts
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    <span>Handled Material</span>
                    <Scale size={15} className="text-purple-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {Number(yardEquipmentSummary.totalQuantity || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">MT</span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-1">
                    Total tonnage shifted or loaded
                  </div>
                </div>
              </div>

              {/* Machine-Wise Total Utilization Hours (As per Specification Table) */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                      Machine Utilization Hours Breakdown
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Total cumulative runtime and operations performed by each machine
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {yardEquipmentSummary.machineHours && yardEquipmentSummary.machineHours.length > 0 ? (
                    yardEquipmentSummary.machineHours.map((m: any, idx: number) => {
                      const sharePct = yardEquipmentSummary.totalHours > 0
                        ? Math.round((m.hours / yardEquipmentSummary.totalHours) * 100)
                        : 0;

                      return (
                        <div key={idx} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-800 flex items-center justify-center font-black text-xs shadow-2xs">
                                <Wrench size={13} className="text-emerald-700" />
                              </div>
                              <div>
                                <span className="font-black text-slate-900 block text-xs">{m.equipmentNumber}</span>
                                <span className="text-[10px] text-slate-500 font-medium block">{m.equipmentType}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-black text-slate-900 text-sm block">{m.hours} hrs</span>
                              <span className="text-[10px] font-bold text-slate-400 block">{m.count} operations</span>
                            </div>
                          </div>

                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-[#00705a] h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, Math.max(5, sharePct))}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-slate-500 font-semibold text-right">
                            {sharePct}% of yard machinery hours
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-3 py-6 text-center text-xs text-slate-400">
                      No machine hours recorded yet. Perform an unloading, loading, or internal shift to track machinery.
                    </div>
                  )}
                </div>
              </div>

              {/* Full Equipment Usage History Ledger */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                      Equipment Activity History Ledger ({filteredYardEquipment.length})
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Detailed chronological log of machinery operations with exact timestamps and operators
                    </p>
                  </div>
                </div>

                {/* Filter Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                      <Filter size={12} /> Operation:
                    </span>
                    {(['ALL', 'UNLOADING', 'LOADING', 'INTERNAL_SHIFT', 'OTHER'] as const).map(op => (
                      <button
                        key={op}
                        onClick={() => setEqYardOpFilter(op)}
                        className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${eqYardOpFilter === op
                          ? 'bg-[#00705a] text-white shadow-sm'
                          : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                          }`}
                      >
                        {op === 'ALL' ? 'All' : op === 'INTERNAL_SHIFT' ? 'Rack Shifting' : op === 'UNLOADING' ? 'Unloading' : op === 'LOADING' ? 'Loading' : 'Other'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[220px]">
                    <div className="relative flex-1">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search machine, operator, rack, ref..."
                        value={eqYardSearch}
                        onChange={e => setEqYardSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Ledger Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                        <th className="py-3 px-4">Equipment</th>
                        <th className="py-3 px-4">Operation</th>
                        <th className="py-3 px-4">Project</th>
                        <th className="py-3 px-4">Material Handled</th>
                        <th className="py-3 px-4">Location / Bay</th>
                        <th className="py-3 px-4">Operating Window</th>
                        <th className="py-3 px-4 text-right">Duration</th>
                        <th className="py-3 px-4">Operator</th>
                        <th className="py-3 px-4">Linked Ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredYardEquipment.length > 0 ? (
                        filteredYardEquipment.map(u => {
                          const sDate = new Date(u.startTime);
                          const eDate = new Date(u.endTime);
                          const dateStr = !isNaN(sDate.getTime()) ? sDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
                          const timeStr = !isNaN(sDate.getTime()) && !isNaN(eDate.getTime())
                            ? `${sDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${eDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : '—';

                          return (
                            <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-black text-xs shrink-0 border border-emerald-200">
                                    <Wrench size={13} />
                                  </div>
                                  <div>
                                    <span className="font-bold text-slate-900 block">{u.equipmentNumber || u.equipmentId}</span>
                                    <span className="text-[10px] text-slate-400 block">{u.equipmentType || u.equipmentName}</span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${u.operationType === 'UNLOADING' ? 'bg-emerald-100 text-emerald-800' :
                                  u.operationType === 'LOADING' ? 'bg-blue-100 text-blue-800' :
                                    u.operationType === 'INTERNAL_SHIFT' ? 'bg-indigo-100 text-indigo-800' :
                                      'bg-slate-100 text-slate-800'
                                  }`}>
                                  {u.operationType === 'INTERNAL_SHIFT' ? 'Rack Shifting' : u.operationType}
                                </span>
                              </td>

                              <td className="py-3.5 px-4">
                                <span className="font-bold text-slate-800 block text-xs">{u.projectName || u.projectId || 'General'}</span>
                                {u.projectId && (
                                  <span className="text-[10px] font-mono text-slate-400 block">{u.projectId}</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                <span className="font-bold text-slate-800 block">{u.materialName || 'Aggregates'}</span>
                                {Number(u.quantity) > 0 && (
                                  <span className="text-[10px] font-semibold text-slate-500">
                                    {u.quantity} {u.unit || 'MT'}
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="text-xs font-semibold text-slate-700">
                                  {u.operationType === 'INTERNAL_SHIFT' ? (
                                    <div className="flex items-center gap-1">
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px]">{u.sourceRackName || 'Rack A'}</span>
                                      <ArrowRight size={10} className="text-slate-400" />
                                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold text-[10px]">{u.destinationRackName || 'Rack B'}</span>
                                    </div>
                                  ) : (
                                    <span>{u.destinationRackName || u.sourceRackName || 'Designated Bay'}</span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <span className="font-bold text-slate-800 block text-xs">{dateStr}</span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <Clock size={10} />
                                  {timeStr}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <span className="font-black text-slate-900 text-sm block">
                                  {u.durationHours} <span className="text-[10px] font-bold text-slate-500">hrs</span>
                                </span>
                              </td>

                              <td className="py-3.5 px-4">
                                <span className="font-bold text-slate-800 block text-xs">{u.operatorName || 'Assigned Driver'}</span>
                                {u.operatorPhone && (
                                  <span className="text-[10px] text-slate-400 block font-mono">{u.operatorPhone}</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                {u.shiftId ? (
                                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold border border-indigo-200 block w-fit">
                                    {u.shiftId}
                                  </span>
                                ) : u.transactionId ? (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold border border-slate-200 block w-fit">
                                    TX #{u.transactionId}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">Direct Log</span>
                                )}
                                {u.remarks && (
                                  <span className="text-[9px] text-slate-400 block mt-0.5 max-w-[140px] truncate" title={u.remarks}>
                                    {u.remarks}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400 font-semibold">
                            No equipment usage recorded for this filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT LEDGER */}
          {yardActiveTab === 'ledger' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search ledger by vehicle, waybill, slip, or material..."
                    value={ledgerSearch}
                    onChange={e => setLedgerSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#00705a] focus:bg-white transition-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                    <Filter size={13} className="text-slate-400" />
                    <span className="text-slate-500 font-semibold">Type:</span>
                    <select
                      value={ledgerTypeFilter}
                      onChange={e => setLedgerTypeFilter(e.target.value as any)}
                      className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Types</option>
                      <option value="INWARD">Receipt (Inward)</option>
                      <option value="OUTWARD">Issue (Outward)</option>
                      <option value="INTERNAL_SHIFT">Internal Shift</option>
                      <option value="LOSS">Wastage / Loss</option>
                      <option value="ADJUSTMENT">Stock Adjustment</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                    <span className="text-slate-500 font-semibold">Project:</span>
                    <select
                      value={ledgerProjectFilter}
                      onChange={e => setLedgerProjectFilter(e.target.value)}
                      className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[150px] truncate"
                    >
                      <option value="ALL">All Projects</option>
                      {projects.map(p => (
                        <option key={p.projectId || p.id} value={p.projectId || p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-[#00705a]" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Chronological Movement Audit ({filteredTransactions.length} records)
                    </span>
                  </div>
                </div>

                {filteredTransactions.length === 0 ? (
                  <div className="py-14 text-center text-slate-400 text-xs">
                    No transactions match the selected filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                          <th className="py-3.5 px-6">Txn ID / Date</th>
                          <th className="py-3.5 px-6">Type</th>
                          <th className="py-3.5 px-6">Project</th>
                          <th className="py-3.5 px-6">Material & Qty</th>
                          <th className="py-3.5 px-6">Location / Vehicle</th>
                          <th className="py-3.5 px-6">Weighbridge / Slip</th>
                          <th className="py-3.5 px-6">Gross / Tare / Net</th>
                          <th className="py-3.5 px-6 text-right">GRN / Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredTransactions.map(tx => {
                          const isInward = tx.transactionType === 'INWARD';
                          const isOutward = tx.transactionType === 'OUTWARD';
                          const isShift = tx.transactionType === 'INTERNAL_SHIFT';
                          const isLoss = tx.transactionType === 'LOSS';

                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/75 transition-colors">
                              <td className="py-3.5 px-6">
                                <div className="font-bold text-slate-800">TXN-{tx.id}</div>
                                <div className="text-[10px] text-slate-400">
                                  {new Date(tx.createdAt).toLocaleString(undefined, {
                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                  })}
                                </div>
                              </td>

                              <td className="py-3.5 px-6">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isInward
                                  ? 'bg-emerald-50 text-[#00705a] border border-emerald-200'
                                  : isOutward
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : isShift
                                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                      : isLoss
                                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                                  }`}>
                                  {tx.transactionType}
                                </span>
                              </td>

                              <td className="py-3.5 px-6">
                                <div className="font-black text-slate-900">{tx.projectName}</div>
                                <div className="text-[10px] text-slate-400">{tx.projectId}</div>
                              </td>

                              <td className="py-3.5 px-6">
                                <div className="font-black text-slate-900">
                                  {tx.quantity.toLocaleString()} {tx.unit || 'MT'}
                                </div>
                                <div className="text-[10px] text-slate-500 font-semibold">{tx.materialName}</div>
                              </td>

                              <td className="py-3.5 px-6">
                                {isShift ? (
                                  <div className="font-bold text-indigo-900">
                                    {tx.sourceLocation} → {tx.destinationLocation}
                                  </div>
                                ) : tx.vehicleNumber ? (
                                  <>
                                    <div className="font-bold text-slate-900">{tx.vehicleNumber}</div>
                                    <div className="text-[10px] text-slate-400">{tx.rackName || 'Open Storage'}</div>
                                  </>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              <td className="py-3.5 px-6">
                                <div className="font-bold text-slate-800">{tx.weighbridgeSlipNumber || tx.waybillNumber || tx.shiftId || '—'}</div>
                              </td>

                              <td className="py-3.5 px-6">
                                {tx.netWeight ? (
                                  <div>
                                    <div className="font-bold text-slate-800">Net: {tx.netWeight} {tx.unit || 'MT'}</div>
                                    <div className="text-[10px] text-slate-400">G: {tx.grossWeight || '—'} | T: {tx.tareWeight || '—'}</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              <td className="py-3.5 px-6 text-right">
                                {tx.grnNumber ? (
                                  <button
                                    onClick={() => {
                                      setActiveGrnReceipt(tx);
                                      setIsGrnSlipModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-[#00705a] border border-emerald-200 font-black text-[10px] hover:bg-[#00705a] hover:text-white transition-colors"
                                  >
                                    <Eye size={12} />
                                    <span>{tx.grnNumber}</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">Verified</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: DIGITAL TWIN & 2D SPATIAL MAP (LIGHT THEME) */}
          {yardActiveTab === 'digital-twin' && (
            <div className="space-y-6">
              {/* Digital Twin HUD Header */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-[#00705a] border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        Live Digital Twin Engine
                      </span>
                      <span className="text-xs text-slate-500 font-bold">
                        Facility ID: <strong className="text-slate-800 font-mono">{selectedYard.yardCode || 'SY-01'}</strong>
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2.5 tracking-tight flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#00705a] flex items-center justify-center border border-emerald-200 shadow-2xs">
                        <Compass size={18} />
                      </div>
                      <span>{selectedYard.yardName} — 2D Spatial Layout & Terminal Twin</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Real-time interactive terminal layout, electronic weighbridge scales, haul corridors, and capacity density heatmaps
                    </p>
                  </div>

                  {/* Visual Mode Switcher */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/90 shadow-2xs">
                    <button
                      onClick={() => setDigitalTwinMode('heatmap')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${digitalTwinMode === 'heatmap'
                        ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-700/20'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                        }`}
                    >
                      <Gauge size={13} />
                      <span>Capacity Heatmap</span>
                    </button>

                    <button
                      onClick={() => setDigitalTwinMode('material')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${digitalTwinMode === 'material'
                        ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-700/20'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                        }`}
                    >
                      <Package size={13} />
                      <span>Commodity Map</span>
                    </button>

                    <button
                      onClick={() => setDigitalTwinMode('project')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${digitalTwinMode === 'project'
                        ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-700/20'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                        }`}
                    >
                      <Building2 size={13} />
                      <span>Project Segregation</span>
                    </button>
                  </div>
                </div>

                {/* Live Terminal Telemetry Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-slate-100 text-xs">
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Yard Space</span>
                    <strong className="text-xl font-black text-slate-900 mt-0.5 block">
                      {(selectedYard.totalCapacityTons || 50000).toLocaleString()} <span className="text-xs font-bold text-slate-500">MT</span>
                    </strong>
                    <span className="text-[10px] text-slate-500">Design holding capacity</span>
                  </div>

                  <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/90 shadow-2xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">Current Tonnage</span>
                    <strong className="text-xl font-black text-emerald-700 mt-0.5 block">
                      {(selectedYard.currentOccupancyTons || 0).toLocaleString()} <span className="text-xs font-bold text-slate-500">MT</span>
                    </strong>
                    <span className="text-[10px] text-emerald-700 font-medium">Physical stock on ground</span>
                  </div>

                  <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200/90 shadow-2xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 block">Free Headroom</span>
                    <strong className="text-xl font-black text-blue-700 mt-0.5 block">
                      {Math.max(0, (selectedYard.totalCapacityTons || 50000) - (selectedYard.currentOccupancyTons || 0)).toLocaleString()} <span className="text-xs font-bold text-slate-500">MT</span>
                    </strong>
                    <span className="text-[10px] text-blue-700 font-medium">Available empty capacity</span>
                  </div>

                  <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200/90 shadow-2xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 block">Active Storage Nodes</span>
                    <strong className="text-xl font-black text-indigo-700 mt-0.5 block">
                      {racks.length || 4} <span className="text-xs font-bold text-slate-500">quadrants</span>
                    </strong>
                    <span className="text-[10px] text-indigo-700 font-medium">Bays, stacks & racks</span>
                  </div>
                </div>
              </div>

              {/* 2D Interactive Terminal Grid (Light Architectural Canvas) */}
              <div className="bg-slate-50/60 rounded-3xl border border-slate-200 p-6 sm:p-8 relative overflow-hidden shadow-xs">
                {/* Background Blueprint Dot Grid */}
                <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] [background-size:24px_24px] opacity-70 pointer-events-none" />

                <div className="relative z-10 space-y-8">
                  {/* TERMINAL ENTRY & WEIGHBRIDGE SCALE 01 */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4.5 rounded-2xl bg-white/95 border border-emerald-200/90 shadow-2xs backdrop-blur-md">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-emerald-100 text-[#00705a] flex items-center justify-center border border-emerald-300 shadow-2xs">
                        <Navigation size={20} className="rotate-90" />
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-[#00705a] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Gate 01 • Inbound Security & RFID Post
                        </div>
                        <div className="text-sm font-black text-slate-900">Truck Arrival & Electronic Gross Scale 01</div>
                        <p className="text-[11px] text-slate-500">Gross weigh-in, RFID badge scan & automated boom barrier</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs text-xs">
                      <div className="flex items-center gap-2">
                        <Scale size={16} className="text-[#00705a]" />
                        <span className="text-slate-500 font-semibold">Scale 01:</span>
                        <span className="font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">ONLINE (120 MT)</span>
                      </div>
                      <div className="h-4 w-px bg-slate-200" />
                      <div className="text-slate-600 font-semibold">
                        Speed Limit: <strong className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">15 km/h</strong>
                      </div>
                    </div>
                  </div>

                  {/* HAUL ROAD RUNWAY */}
                  <div className="relative py-3 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t-2 border-dashed border-slate-300" />
                    </div>
                    <span className="relative px-4 py-1.5 rounded-full bg-white border border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-700 shadow-xs flex items-center gap-2">
                      <Truck size={14} className="text-[#00705a]" />
                      <span>Internal Arterial Haul Road • Direction of Flow →</span>
                    </span>
                  </div>

                  {/* ACTIVE STORAGE NODES MATRIX (Racks, Stacks, Bays) */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <Box size={14} className="text-indigo-600" />
                        <span>Terminal Storage Quadrants ({racks.length > 0 ? racks.length : 'Standard Stacks'})</span>
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>Click any storage node to shift stock or receive materials</span>
                      </div>
                    </div>

                    {racks.length === 0 ? (
                      /* Fallback default zones if user has not created racks yet */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { code: 'BAY-A1', name: 'Open Yard Stockpile A', mat: 'Iron Ore Fines', proj: 'JSW Steel Project', fill: 68, tons: 17000, cap: 25000 },
                          { code: 'BAY-B1', name: 'Covered Dry Stack B', mat: 'Thermal Coal (0-50mm)', proj: 'NTPC Power Rakes', fill: 42, tons: 8400, cap: 20000 },
                          { code: 'BAY-C1', name: 'Heavy Ore Pad C', mat: 'Track Ballast 40mm', proj: 'DFCCIL Rail Corridor', fill: 89, tons: 13350, cap: 15000 },
                          { code: 'BAY-D1', name: 'Bauxite Reserve D', mat: 'Raw Bauxite Lump', proj: 'Vedanta Smelter', fill: 25, tons: 3750, cap: 15000 },
                        ].map(bay => (
                          <div
                            key={bay.code}
                            className={`p-5 rounded-2xl border transition-all cursor-pointer hover:scale-[1.02] shadow-xs hover:shadow-md ${digitalTwinMode === 'heatmap'
                              ? bay.fill > 80
                                ? 'bg-rose-50/90 border-rose-200 hover:border-rose-400'
                                : bay.fill > 50
                                  ? 'bg-amber-50/90 border-amber-200 hover:border-amber-400'
                                  : 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-400'
                              : 'bg-white border-slate-200 hover:border-indigo-400'
                              }`}
                            onClick={() => {
                              handleOpenShiftModal();
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-white text-slate-700 border border-slate-200 shadow-2xs">
                                {bay.code}
                              </span>
                              <span className={`text-[11px] font-black ${bay.fill > 80 ? 'text-rose-700' : bay.fill > 50 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {bay.fill}% Filled
                              </span>
                            </div>

                            <h4 className="text-sm font-black text-slate-900 mt-2 truncate">{bay.name}</h4>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{bay.mat}</p>

                            <div className="mt-3.5 space-y-1.5">
                              <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${bay.fill > 80 ? 'bg-rose-500' : bay.fill > 50 ? 'bg-amber-500' : 'bg-emerald-600'
                                    }`}
                                  style={{ width: `${bay.fill}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px] text-slate-600 font-bold">
                                <span>{bay.tons.toLocaleString()} MT</span>
                                <span>Cap: {bay.cap.toLocaleString()} MT</span>
                              </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[10px]">
                              <span className="text-indigo-700 font-black truncate">{bay.proj}</span>
                              <span className="text-slate-600 hover:text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 font-bold shadow-2xs">
                                Shift <ArrowRight size={10} />
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Real Dynamic Racks Configured in Database */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {racks.map(rack => {
                          const occ = parseFloat(String(rack.currentOccupancyTons || 0));
                          const cap = rack.capacityTons || 10000;
                          const fillPct = cap > 0 ? Math.min(100, Math.round((occ / cap) * 100)) : 0;

                          // Find materials stored in this rack
                          const storedItems = rackInventory.filter(
                            r => r.rackName.toLowerCase() === rack.rackName.toLowerCase() || r.rackCode === rack.rackCode
                          );
                          const primaryMat = storedItems[0]?.materialName || 'Open Capacity';
                          const primaryProj = storedItems[0]?.projectName || 'Available';

                          return (
                            <div
                              key={rack.id}
                              className={`p-5 rounded-2xl border transition-all cursor-pointer hover:scale-[1.02] shadow-xs hover:shadow-md ${digitalTwinMode === 'heatmap'
                                ? fillPct > 80
                                  ? 'bg-rose-50/90 border-rose-200 hover:border-rose-400'
                                  : fillPct > 50
                                    ? 'bg-amber-50/90 border-amber-200 hover:border-amber-400'
                                    : 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-400'
                                : digitalTwinMode === 'material'
                                  ? 'bg-blue-50/80 border-blue-200 hover:border-blue-400'
                                  : 'bg-indigo-50/80 border-indigo-200 hover:border-indigo-400'
                                }`}
                              onClick={() => {
                                setSelectedDigitalTwinNode(rack);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-white text-slate-700 border border-slate-200 shadow-2xs">
                                    {rack.rackCode}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                                    {rack.locationType}
                                  </span>
                                </div>
                                <span className={`text-[11px] font-black ${fillPct > 80 ? 'text-rose-700' : fillPct > 50 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                  {fillPct}% Full
                                </span>
                              </div>

                              <h4 className="text-sm font-black text-slate-900 mt-2 truncate">{rack.rackName}</h4>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{primaryMat}</p>

                              <div className="mt-3.5 space-y-1.5">
                                <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${fillPct > 80 ? 'bg-rose-500' : fillPct > 50 ? 'bg-amber-500' : 'bg-emerald-600'
                                      }`}
                                    style={{ width: `${fillPct}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-600 font-bold">
                                  <span>{occ.toLocaleString()} MT</span>
                                  <span>Cap: {cap.toLocaleString()} MT</span>
                                </div>
                              </div>

                              <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[10px]">
                                <span className="text-indigo-700 font-black truncate max-w-[130px]">{primaryProj}</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenShiftModal(undefined, rack.rackName);
                                    }}
                                    className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs"
                                    title="Shift stock out from this location"
                                  >
                                    <span>Shift</span>
                                    <ArrowRight size={10} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* TERMINAL EXIT & WEIGHBRIDGE SCALE 02 */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4.5 rounded-2xl bg-white/95 border border-blue-200/90 shadow-2xs backdrop-blur-md">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center border border-blue-300 shadow-2xs">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                          Gate 02 • Outbound Security Barrier & Tare Scale 02
                        </div>
                        <div className="text-sm font-black text-slate-900">Tare Weighbridge Check & Net GRN Printing Station</div>
                        <p className="text-[11px] text-slate-500">Empty truck tare check, automated net computation & exit pass clearance</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setYardActiveTab('live-queue')}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:brightness-110 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <Truck size={14} />
                        <span>Inspect Active Yard Fleet ({activeTrucksInYard.length})</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: LIVE WEIGHBRIDGE RADAR & FLEET TURNAROUND */}
          {yardActiveTab === 'live-queue' && (
            <div className="space-y-6">
              {/* Radar KPI Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    <span>Vehicles Inside Yard</span>
                    <Truck size={16} className="text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {activeTrucksInYard.length} <span className="text-xs font-bold text-slate-500">active units</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Currently at gate, tipping or tare scale</p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    <span>Average Turnaround</span>
                    <Clock size={16} className="text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-700">
                    28 <span className="text-xs font-bold text-slate-500">mins / trip</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Well within 45 min target threshold</p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    <span>Optimal Discharge</span>
                    <CheckCircle2 size={16} className="text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black text-indigo-700">
                    {activeTrucksInYard.filter(t => (t.dwellMinutes || 20) <= 30).length} <span className="text-xs font-bold text-slate-500">units (&lt;30m)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Smooth yard flow & zero bottleneck</p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    <span>Demurrage Risk</span>
                    <AlertTriangle size={16} className="text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-amber-700">
                    {activeTrucksInYard.filter(t => (t.dwellMinutes || 20) > 60).length} <span className="text-xs font-bold text-slate-500">alerts (&gt;60m)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Priority clearing required</p>
                </div>
              </div>

              {/* Live Radar Vehicle List Card */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Truck size={16} className="text-blue-600" />
                      <span>Live Yard Perimeter Fleet & Weighbridge Queue</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Monitor truck entry timestamps, live turnaround dwell counters, and perform one-click fast tare weigh-outs
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search truck number, driver..."
                        value={queueSearch}
                        onChange={e => setQueueSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                {activeTrucksInYard.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-xs">
                    <Truck size={36} className="mx-auto text-slate-300 mb-3" />
                    <p className="font-bold text-slate-600">No haul trucks currently queued inside the yard perimeter.</p>
                    <p className="text-[11px] text-slate-400 mt-1">All inward trucks have been weighed out and cleared through Gate 02.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-6">Vehicle Registration</th>
                          <th className="py-3 px-6">Driver & Carrier</th>
                          <th className="py-3 px-6">Project & Commodity</th>
                          <th className="py-3 px-6">Gate In-Time</th>
                          <th className="py-3 px-6">Dwell Duration</th>
                          <th className="py-3 px-6">Storage Target</th>
                          <th className="py-3 px-6">Gross Weighed</th>
                          <th className="py-3 px-6 text-right">Quick Checkout</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeTrucksInYard
                          .filter(t => !queueSearch || (t.vehicleNumber || '').toLowerCase().includes(queueSearch.toLowerCase()) || (t.driverName || '').toLowerCase().includes(queueSearch.toLowerCase()))
                          .map(truck => {
                            const dwell = truck.dwellMinutes || 24;
                            const isOverstay = dwell > 60;
                            const isModerate = dwell > 30 && dwell <= 60;

                            return (
                              <tr key={truck.id} className="hover:bg-slate-50/75 transition-colors">
                                <td className="py-3.5 px-6 font-black text-slate-900">
                                  <div className="flex items-center gap-1.5">
                                    <Truck size={14} className="text-slate-400" />
                                    <span>{truck.vehicleNumber}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-semibold">{truck.transportMode || 'TRUCK'}</div>
                                </td>

                                <td className="py-3.5 px-6">
                                  <div className="font-bold text-slate-800">{truck.driverName || 'Primary Pilot'}</div>
                                  <div className="text-[10px] text-slate-400">{truck.driverPhone || '—'}</div>
                                </td>

                                <td className="py-3.5 px-6">
                                  <div className="font-bold text-slate-900">{truck.projectName}</div>
                                  <div className="text-[10px] text-slate-500">{truck.materialName}</div>
                                </td>

                                <td className="py-3.5 px-6">
                                  <div className="font-bold text-slate-800 flex items-center gap-1">
                                    <Clock size={12} className="text-emerald-600" />
                                    <span>{new Date(truck.gateInTime || truck.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">{new Date(truck.gateInTime || truck.createdAt).toLocaleDateString()}</div>
                                </td>

                                <td className="py-3.5 px-6">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isOverstay
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                                    : isModerate
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-emerald-50 text-[#00705a] border border-emerald-200'
                                    }`}>
                                    {dwell} mins inside yard
                                  </span>
                                </td>

                                <td className="py-3.5 px-6">
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                                    {truck.rackName || 'Open Yard'}
                                  </span>
                                </td>

                                <td className="py-3.5 px-6 font-bold text-slate-900">
                                  {truck.grossWeight ? `${truck.grossWeight} MT` : '—'}
                                </td>

                                <td className="py-3.5 px-6 text-right">
                                  <button
                                    onClick={() => {
                                      setFastTareTruck(truck);
                                      setFastTareWeight(truck.tareWeight ? String(truck.tareWeight) : '14.50');
                                      setFastTareRemarks('');
                                      setIsFastTareModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-sm transition-all"
                                  >
                                    <Scale size={13} />
                                    <span>Fast Tare & Exit</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: MATERIAL SHRINKAGE & DRONE RECONCILIATION */}
          {yardActiveTab === 'reconciliation' && (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                      Quality Engineering & Audit True-Up
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2 tracking-tight flex items-center gap-2">
                      <Scale className="text-amber-600" size={24} />
                      <span>Material Shrinkage, Moisture Loss & Drone Volumetric True-Up</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Scientific bulk inventory auditing, moisture transit evaporation modeling, and 3D volumetric laser/drone survey reconciliation
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setFormError(null);
                      setAdjustForm(prev => ({
                        ...prev,
                        projectId: projectInventory[0]?.projectId || projects[0]?.projectId || '',
                        projectName: projectInventory[0]?.projectName || projects[0]?.name || '',
                        materialName: projectInventory[0]?.materialName || projects[0]?.commodity || '',
                        adjustmentType: 'LOSS',
                        quantity: '',
                        reason: ''
                      }));
                      setIsAdjustModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-sm transition-all self-start sm:self-auto"
                  >
                    <Plus size={16} />
                    <span>Record Manual Audit Loss</span>
                  </button>
                </div>
              </div>

              {/* Two Column Layout: Calculator & Survey Reconciliation Form */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* TOOL 1: MOISTURE SHRINKAGE CALCULATOR */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
                  <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black">
                      %
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                        Transit Moisture Evaporation Model
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Compute statutory moisture shrinkage from pithead loading to terminal discharge
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1">
                        Pithead Loading Moisture %
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={baselineMoisturePct}
                        onChange={e => setBaselineMoisturePct(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                        placeholder="e.g. 11.0"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1">
                        Discharge Stockyard Moisture %
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={measuredMoisturePct}
                        onChange={e => setMeasuredMoisturePct(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                        placeholder="e.g. 8.5"
                      />
                    </div>
                  </div>

                  {/* Computed Moisture Variance KPI Box */}
                  {(() => {
                    const baseM = parseFloat(baselineMoisturePct) || 0;
                    const curM = parseFloat(measuredMoisturePct) || 0;
                    const diffM = parseFloat((baseM - curM).toFixed(2));
                    const isNormal = Math.abs(diffM) <= 2.5;

                    return (
                      <div className={`p-4 rounded-2xl border ${isNormal ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-amber-50/60 border-amber-200 text-amber-950'}`}>
                        <div className="flex items-center justify-between text-xs font-black">
                          <span>Moisture Evaporation Loss:</span>
                          <span className="text-base font-black text-amber-700">
                            {diffM > 0 ? `-${diffM}%` : `+${Math.abs(diffM)}%`}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">
                          {diffM > 0
                            ? `On a 10,000 MT train rake, this represents ~${((diffM / 100) * 10000).toFixed(0)} MT of natural moisture loss through solar exposure.`
                            : `Material gained moisture during monsoon haulage.`}
                        </p>
                        <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Statutory Limit: ±1.5% • Status: <strong className={isNormal ? 'text-emerald-700' : 'text-amber-700'}>{isNormal ? 'WITHIN TOLERANCE' : 'INVESTIGATION REQUIRED'}</strong>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* TOOL 2: DRONE / VOLUMETRIC SURVEY TRUE-UP CONSOLE */}
                <form onSubmit={handleSurveyReconcileSubmit} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black">
                      <Split size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                        Drone LiDAR Volumetric True-Up
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Calculate true physical tonnage from 3D volumetric surveys and apply ledger adjustments
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1">
                        Select Project <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={reconProject}
                        onChange={e => {
                          setReconProject(e.target.value);
                          const p = projectInventory.find(item => item.projectId === e.target.value);
                          if (p) setReconMaterial(p.materialName);
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
                      >
                        <option value="">-- Choose Project --</option>
                        {projectInventory.map(p => (
                          <option key={p.projectId} value={p.projectId}>
                            {p.projectName} ({p.currentAvailable.toLocaleString()} MT)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1">
                        Survey Method
                      </label>
                      <select
                        value={surveyMethod}
                        onChange={e => setSurveyMethod(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
                      >
                        <option value="DRONE_LIDAR">Drone Photogrammetry / LiDAR</option>
                        <option value="TOTAL_STATION">Laser Total Station Survey</option>
                        <option value="PHYSICAL_DIP">Physical Dip & Topographic Rod</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1">
                        Surveyed Volume (m³) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        placeholder="e.g. 15200"
                        value={surveyVolumeM3}
                        onChange={e => setSurveyVolumeM3(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1">
                        Bulk Density (t/m³) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="e.g. 1.65"
                        value={surveyBulkDensity}
                        onChange={e => setSurveyBulkDensity(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  {/* Live Variance Calculation */}
                  {(() => {
                    const vol = parseFloat(surveyVolumeM3) || 0;
                    const den = parseFloat(surveyBulkDensity) || 1.65;
                    const physicalTons = vol > 0 ? parseFloat((vol * den).toFixed(2)) : 0;
                    const matchedInv = projectInventory.find(p => p.projectId === reconProject && p.materialName.toLowerCase() === reconMaterial.toLowerCase());
                    const bookStock = matchedInv ? matchedInv.currentAvailable : 0;
                    const variance = physicalTons > 0 ? parseFloat((physicalTons - bookStock).toFixed(2)) : 0;

                    return (
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                        <div className="flex justify-between text-slate-600 font-bold">
                          <span>Physical Survey Weight (Vol × Density):</span>
                          <span className="font-black text-slate-900">{physicalTons.toLocaleString()} MT</span>
                        </div>
                        <div className="flex justify-between text-slate-600 font-bold">
                          <span>System Book Stock:</span>
                          <span className="font-black text-slate-900">{bookStock.toLocaleString()} MT</span>
                        </div>
                        <div className="flex justify-between font-black pt-1 border-t border-slate-200">
                          <span>Survey Variance:</span>
                          <span className={variance >= 0 ? 'text-emerald-700' : 'text-amber-700'}>
                            {variance > 0 ? `+${variance}` : variance} MT
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1">
                      Audit Note & Survey Ref Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Q3 Drone Survey by GeoScan Pvt Ltd • Certificate #GEO-2026-88"
                      value={surveyAdjustmentReason}
                      onChange={e => setSurveyAdjustmentReason(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !reconProject || !surveyVolumeM3}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={15} />
                    <span>Confirm & Post True-Up Adjustment</span>
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 3: DEDICATED PROJECT STOCKYARD CONSOLE                    */}
      {/* ============================================================== */}
      {viewMode === 'project-detail' && selectedYard && selectedProjectId && (
        <div className="space-y-6">

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <button
              onClick={() => setViewMode('list')}
              className="hover:text-slate-900 transition-colors"
            >
              All Stockyards
            </button>
            <span>/</span>
            <button
              onClick={() => setViewMode('yard-detail')}
              className="hover:text-slate-900 transition-colors"
            >
              {selectedYard.yardName}
            </button>
            <span>/</span>
            <span className="text-[#00705a] font-black">Project: {projectDetailData?.project.name || selectedProjectId}</span>
          </div>

          {/* Project Profile Header Banner */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-3">
                {/* Identification Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#00705a]" />
                    <span>Project: {selectedProjectId}</span>
                  </span>

                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1.5">
                    <MapPin size={13} className="text-slate-500" />
                    <span>{selectedYard.yardName}</span>
                  </span>

                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1.5">
                    <Building2 size={13} className="text-slate-500" />
                    <span>Client: {projectDetailData?.project.customer || 'Dedicated Freight Client'}</span>
                  </span>
                </div>

                {/* Project Title */}
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                    {projectDetailData?.project.name || selectedProjectId}
                  </h1>
                </div>

                {/* Metadata Details */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Package size={14} className="text-slate-400" />
                    <span>Commodity:</span>
                    <strong className="text-slate-800 font-bold">{projectDetailData?.project.commodity || 'Aggregates / Bulk Cargo'}</strong>
                  </div>

                  <span className="text-slate-300">•</span>

                  <div className="flex items-center gap-1.5">
                    <Scale size={14} className="text-slate-400" />
                    <span>Target Contract:</span>
                    <strong className="text-slate-800 font-bold">
                      {(projectDetailData?.project.contractQuantity || 150000).toLocaleString()} {projectDetailData?.project.contractQuantityUnit || 'MT'}
                    </strong>
                  </div>

                  <span className="text-slate-300">•</span>

                  <div className="flex items-center gap-1.5">
                    <Navigation size={14} className="text-slate-400" />
                    <span>Yard:</span>
                    <strong className="text-slate-800 font-bold">{selectedYard.location || selectedYard.yardName}</strong>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
                <button
                  onClick={() => handleOpenDeepStockAdd(selectedProjectId)}
                  className="flex items-center gap-1.5 bg-[#00705a] hover:bg-[#005c4a] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <ArrowDownLeft size={15} />
                  <span>+ Inward Receive</span>
                </button>

                <button
                  onClick={() => handleOpenShiftModal(selectedProjectId)}
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  <ArrowLeftRight size={15} />
                  <span>Shift Racks</span>
                </button>

                <button
                  onClick={() => {
                    setFormError(null);
                    setIssueForm(prev => ({
                      ...prev,
                      projectId: selectedProjectId,
                      projectName: projectDetailData?.project.name || selectedProjectId,
                      materialName: projectDetailData?.materials[0]?.materialName || 'Track Ballast 40mm',
                      quantity: '',
                      weighbridgeSlipNumber: `DIS-${Date.now().toString().slice(-4)}`
                    }));
                    setIsIssueModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  <ArrowUpRight size={15} />
                  <span>- Dispatch</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  <Printer size={15} />
                  <span>Print</span>
                </button>
              </div>
            </div>

            {/* Dedicated Project KPIs (Clean stockyard style cards, no loud rainbow colors) */}
            {(() => {
              const currentAvail = projectDetailData?.metrics.currentAvailable || 0;
              const isDeficit = currentAvail < 0;
              const totalRecv = projectDetailData?.metrics.totalReceived || 0;
              const totalIss = projectDetailData?.metrics.totalIssued || 0;
              const totalLoss = projectDetailData?.metrics.totalLoss || 0;

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
                  {/* KPI 1: AVAILABLE BALANCE */}
                  <div className="bg-slate-50/60 rounded-2xl p-4.5 border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Available Balance
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center font-bold">
                        <Box size={15} />
                      </div>
                    </div>

                    <div className={`text-2xl sm:text-3xl font-black tracking-tight ${isDeficit ? 'text-rose-600' : 'text-slate-900'}`}>
                      {currentAvail.toLocaleString()} <span className="text-xs font-bold text-slate-500">MT</span>
                    </div>

                    <div className="mt-1.5">
                      {isDeficit ? (
                        <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                          <AlertTriangle size={13} className="shrink-0" />
                          <span>Deficit: Dispatches exceed stock</span>
                        </span>
                      ) : currentAvail > 0 ? (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-[#00705a] shrink-0" />
                          <span>Ready for dispatch or racking</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Zero physical balance</span>
                      )}
                    </div>
                  </div>

                  {/* KPI 2: CUMULATIVE INWARD */}
                  <div className="bg-slate-50/60 rounded-2xl p-4.5 border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cumulative Inward</span>
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center font-bold">
                        <ArrowDownLeft size={15} />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {totalRecv.toLocaleString()} <span className="text-xs font-bold text-slate-500">MT</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 font-medium">
                      <strong className="text-slate-800 font-bold">{projectDetailData?.metrics.inwardCount || 0}</strong> vehicle loads received
                    </p>
                  </div>

                  {/* KPI 3: CUMULATIVE OUTWARD */}
                  <div className="bg-slate-50/60 rounded-2xl p-4.5 border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cumulative Outward</span>
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center font-bold">
                        <ArrowUpRight size={15} />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {totalIss.toLocaleString()} <span className="text-xs font-bold text-slate-500">MT</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 font-medium">
                      <strong className="text-slate-800 font-bold">{projectDetailData?.metrics.outwardCount || 0}</strong> fleet dispatches issued
                    </p>
                  </div>

                  {/* KPI 4: TRANSIT LOSS */}
                  <div className="bg-slate-50/60 rounded-2xl p-4.5 border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Recorded Transit Loss</span>
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center font-bold">
                        <Split size={15} />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {totalLoss.toLocaleString()} <span className="text-xs font-bold text-slate-500">MT</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 font-medium">Moisture loss & scale variance</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ============================================================== */}
          {/* ⚡ MASTER STICKY QUICK-JUMP COMMAND BAR (Clean Stockyard Style) */}
          {/* ============================================================== */}
          <div
            id="project-sticky-nav-bar"
            className="sticky top-0 z-30 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm p-1.5 sm:p-2 transition-all"
          >
            <div className="flex items-center justify-between gap-2">
              {/* Left Label */}
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider shrink-0">
                <Compass size={14} className="text-[#00705a]" />
                <span>Jump To:</span>
              </div>

              {/* 6 Clean High-Impact Buttons (Stockyard Model Style - No Rainbow Colors) */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 py-0.5">
                {/* 1. TRIPS & IN-TIME */}
                <button
                  type="button"
                  onClick={() => scrollToProjectSection('trips')}
                  className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeProjectSection === 'trips'
                    ? 'bg-[#00705a] text-white shadow-sm'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs'
                    }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${activeProjectSection === 'trips' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                    1
                  </span>
                  <Clock size={14} className="shrink-0" />
                  <span>Trips & In-Time</span>
                  <span className={`shrink-0 ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${activeProjectSection === 'trips' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                    {projectDetailData?.inwardReceipts.length || 0}
                  </span>
                </button>

                {/* 2. MATERIALS STOCK */}
                <button
                  type="button"
                  onClick={() => scrollToProjectSection('materials')}
                  className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeProjectSection === 'materials'
                    ? 'bg-[#00705a] text-white shadow-sm'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs'
                    }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${activeProjectSection === 'materials' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                    2
                  </span>
                  <Package size={14} className="shrink-0" />
                  <span>Materials Stock</span>
                  <span className={`shrink-0 ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${activeProjectSection === 'materials' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                    {projectDetailData?.materials.length || 0}
                  </span>
                </button>

                {/* 3. RACK STORAGE */}
                <button
                  type="button"
                  onClick={() => scrollToProjectSection('racks')}
                  className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeProjectSection === 'racks'
                    ? 'bg-[#00705a] text-white shadow-sm'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs'
                    }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${activeProjectSection === 'racks' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                    3
                  </span>
                  <Box size={14} className="shrink-0" />
                  <span>Rack Storage</span>
                  <span className={`shrink-0 ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${activeProjectSection === 'racks' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                    {rackInventory.filter(r => r.projectId === selectedProjectId).length}
                  </span>
                </button>

                {/* 4. OUTWARD DISPATCHES */}
                <button
                  type="button"
                  onClick={() => scrollToProjectSection('outward')}
                  className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeProjectSection === 'outward'
                    ? 'bg-[#00705a] text-white shadow-sm'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs'
                    }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${activeProjectSection === 'outward' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                    4
                  </span>
                  <ArrowUpRight size={14} className="shrink-0" />
                  <span>Outward Dispatches</span>
                  <span className={`shrink-0 ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${activeProjectSection === 'outward' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                    {projectDetailData?.outwardDispatches.length || 0}
                  </span>
                </button>

                {/* 5. INTERNAL SHIFTS */}
                <button
                  type="button"
                  onClick={() => scrollToProjectSection('shifts')}
                  className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeProjectSection === 'shifts'
                    ? 'bg-[#00705a] text-white shadow-sm'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs'
                    }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${activeProjectSection === 'shifts' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                    5
                  </span>
                  <ArrowLeftRight size={14} className="shrink-0" />
                  <span>Internal Shifts</span>
                  <span className={`shrink-0 ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${activeProjectSection === 'shifts' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                    {projectDetailData?.shifts?.length || 0}
                  </span>
                </button>

                {/* 6. AUDIT & WASTAGE */}
                <button
                  type="button"
                  onClick={() => scrollToProjectSection('reconcile')}
                  className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeProjectSection === 'reconcile'
                    ? 'bg-[#00705a] text-white shadow-sm'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs'
                    }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${activeProjectSection === 'reconcile' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                    6
                  </span>
                  <Split size={14} className="shrink-0" />
                  <span>Audit & Wastage</span>
                  <span className={`shrink-0 ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${activeProjectSection === 'reconcile' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                    {projectDetailData?.adjustments.length || 0}
                  </span>
                </button>
              </div>

              {/* Scroll to Top Quick Action */}
              <button
                type="button"
                onClick={() => {
                  const main = document.querySelector('main');
                  if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
                  else window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hidden xl:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all shrink-0 border border-slate-200 cursor-pointer active:scale-95"
                title="Scroll back to top"
              >
                <span>↑ Top</span>
              </button>
            </div>
          </div>

          {/* ALL PROJECT SECTIONS STACKED VERTICALLY (SCROLLABLE INSTEAD OF TABS) */}
          <div className="space-y-8">

            {/* SECTION 1: VEHICLE IN-TIME & DETAILED TRIP HISTORY */}
            <section id="project-section-trips" className="scroll-mt-32 space-y-4">

              {/* Project Target Scope & Live Balance Countdown Strip */}
              <div className="bg-gradient-to-r from-slate-900 via-[#03261f] to-slate-900 rounded-3xl p-5 text-white shadow-md border border-emerald-950/40">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                      <Scale size={15} />
                      <span>Project Contract Weight Scope & Delivery Balance</span>
                    </div>
                    <div className="text-xl font-black text-white mt-1 flex items-baseline gap-2">
                      <span>{projectDetailData?.project?.name || selectedProjectId}</span>
                      <span className="text-xs font-medium text-emerald-300/80">({projectDetailData?.project?.commodity || 'All Aggregates'})</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Live weighbridge receipts countdown towards total project contract weight. Each received vehicle/wagon updates stock and remaining balance.
                    </p>
                  </div>

                  {/* Metric Counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-300 block">Initial Target Scope</span>
                      <span className="text-lg font-black text-white">{projectScopeWeight.toLocaleString()} <span className="text-xs font-semibold text-emerald-400">MT</span></span>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3">
                      <span className="text-[10px] uppercase font-black tracking-wider text-emerald-300 block">Total Received</span>
                      <span className="text-lg font-black text-emerald-300">{totalReceiptsWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-semibold text-emerald-400">MT</span></span>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3">
                      <span className="text-[10px] uppercase font-black tracking-wider text-amber-300 block">Yet to Receive (Balance)</span>
                      <span className="text-lg font-black text-amber-300">{remainingProjectBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-semibold text-amber-400">MT</span></span>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-300 block">Logged Deliveries</span>
                      <span className="text-lg font-black text-white">{projectDetailData?.inwardReceipts?.length || 0} <span className="text-xs font-semibold text-slate-400">Units</span></span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <span>Delivery Fulfilled:</span>
                      <span className="text-emerald-400 font-black">{projectDeliveryProgressPct}%</span>
                    </span>
                    <span className="text-slate-300">
                      {remainingProjectBalance === 0 ? 'Target 100% Completed' : `${remainingProjectBalance.toLocaleString()} MT remaining to fulfill project`}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-[#00d09c] transition-all duration-500"
                      style={{ width: `${projectDeliveryProgressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <Clock size={16} className="text-[#00705a]" />
                      <span>1. Complete Vehicle Turnaround, In-Time & Origin Trip History</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Truck and rail wagon in-time, scale dwell, gross/tare verification, and project balance countdown
                    </p>
                  </div>

                  {/* Actions & Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search vehicle plate, driver, origin..."
                        value={projectTripSearch}
                        onChange={e => setProjectTripSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#00705a] focus:ring-1 focus:ring-[#00705a] transition-all"
                      />
                    </div>

                    <select
                      value={projectTripRackFilter}
                      onChange={e => setProjectTripRackFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Storage Locations</option>
                      {racks.map(r => (
                        <option key={r.id} value={r.rackName}>
                          {r.rackName} ({r.rackCode})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        downloadCsv(
                          `${selectedProjectId}_Vehicle_Trips_${new Date().toISOString().slice(0, 10)}.csv`,
                          ['Gate_In_Time', 'Gate_Out_Time', 'Dwell_Mins', 'Vehicle_Number', 'Transport_Mode', 'Origin', 'Consignor', 'Driver_Name', 'Driver_Phone', 'Rack_Location', 'Gross_Weight', 'Tare_Weight', 'Net_Received', 'Cumulative_Received', 'Balance_Remaining', 'GRN_Number'],
                          (projectDetailData?.inwardReceipts || []).map(r => [
                            r.gateInTime || r.createdAt,
                            r.gateOutTime || '',
                            r.dwellMinutes || 0,
                            r.vehicleNumber,
                            r.transportMode || 'TRUCK',
                            r.sourceLocation || '',
                            r.supplierName || '',
                            r.driverName || '',
                            r.driverPhone || '',
                            r.rackName || '',
                            r.grossWeight || '',
                            r.tareWeight || '',
                            r.quantity,
                            receiptBalancesMap.get(r.id)?.runningDelivered || r.quantity,
                            receiptBalancesMap.get(r.id)?.remainingBalance || '',
                            r.grnNumber || ''
                          ])
                        );
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all shadow-xs"
                      title="Export Trip History to CSV"
                    >
                      <Download size={13} className="text-[#00705a]" />
                      <span>Export CSV</span>
                    </button>

                    <button
                      onClick={() => handleOpenReceiveVehicleModal(selectedProjectId)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00705a] to-[#008f73] text-white text-xs font-black shadow-xs hover:brightness-110 transition-all active:scale-95 cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Receive Vehicle</span>
                    </button>
                  </div>
                </div>

                {projectDetailData?.inwardReceipts.length === 0 ? (
                  <div className="py-14 text-center text-slate-400 text-xs">
                    <Truck size={36} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-600">No inward deliveries recorded for this project in this stockyard yet.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Click "+ Receive Vehicle" above to log the first vehicle or rail wagon delivery.</p>
                    <button
                      onClick={() => handleOpenReceiveVehicleModal(selectedProjectId)}
                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00705a] text-white text-xs font-black shadow-xs hover:bg-[#005c4a]"
                    >
                      <Plus size={14} />
                      <span>+ Receive First Vehicle / Wagon</span>
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                          <th className="py-3 px-4">Gate In / Out</th>
                          <th className="py-3 px-4">Turnaround Dwell</th>
                          <th className="py-3 px-4">Carrier / Vehicle Plate</th>
                          <th className="py-3 px-4">Origin / Consignor</th>
                          <th className="py-3 px-4">Driver / Operator</th>
                          <th className="py-3 px-4">Storage Rack</th>
                          <th className="py-3 px-4 text-right">Gross / Tare</th>
                          <th className="py-3 px-4 text-right">Net Delivered</th>
                          <th className="py-3 px-4 text-right bg-emerald-50/50">Total Received</th>
                          <th className="py-3 px-4 text-right bg-amber-50/50">Yet to Receive (Bal)</th>
                          <th className="py-3 px-4 text-right">GRN Slip</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(projectDetailData?.inwardReceipts || [])
                          .filter(rec => {
                            const q = projectTripSearch.toLowerCase();
                            const matchesSearch = !q ||
                              (rec.vehicleNumber || '').toLowerCase().includes(q) ||
                              (rec.driverName || '').toLowerCase().includes(q) ||
                              (rec.sourceLocation || '').toLowerCase().includes(q) ||
                              (rec.supplierName || '').toLowerCase().includes(q);
                            const matchesRack = projectTripRackFilter === 'ALL' || (rec.rackName || '') === projectTripRackFilter;
                            return matchesSearch && matchesRack;
                          })
                          .map(rec => {
                            const dwell = rec.dwellMinutes || 25;
                            const isOverstay = dwell > 60;
                            const isModerate = dwell > 30 && dwell <= 60;
                            const isRail = rec.transportMode === 'RAIL_RAKE' || rec.vehicleNumber?.startsWith('BOX') || rec.vehicleNumber?.startsWith('BCN');
                            const rowBalance = receiptBalancesMap.get(rec.id);

                            return (
                              <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3.5 px-4">
                                  <div className="font-black text-slate-900 flex items-center gap-1.5">
                                    <Clock size={12} className="text-emerald-600 shrink-0" />
                                    <span>{new Date(rec.gateInTime || rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-semibold pl-4">
                                    {new Date(rec.gateInTime || rec.createdAt).toLocaleDateString()}
                                  </div>
                                </td>

                                <td className="py-3.5 px-4">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isOverstay
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : isModerate
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-emerald-50 text-[#00705a] border border-emerald-200'
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isOverstay ? 'bg-rose-500' : isModerate ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                    {dwell} mins
                                  </span>
                                </td>

                                <td className="py-3.5 px-4">
                                  <div className={`font-mono font-black tracking-wider px-2.5 py-0.5 rounded-md border shadow-2xs inline-flex items-center gap-1.5 text-[11px] ${
                                    isRail ? 'bg-indigo-950 text-cyan-300 border-indigo-700' : 'bg-slate-900 text-amber-300 border-slate-700'
                                  }`}>
                                    {isRail ? <Train size={11} className="text-cyan-400" /> : <Truck size={11} className="text-slate-400" />}
                                    <span>{rec.vehicleNumber}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5 flex items-center gap-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isRail ? 'bg-indigo-500' : 'bg-amber-500'}`}></span>
                                    <span>{isRail ? 'Rail Wagon' : 'Road Truck'}</span>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 max-w-[200px]">
                                  <div className="font-bold text-slate-900 flex items-center gap-1 truncate text-xs">
                                    <MapPin size={11} className="text-slate-400 shrink-0" />
                                    <span>{rec.sourceLocation || 'Quarry Pit Face'}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                                    Consignor: <strong className="text-slate-700">{rec.supplierName || 'National Mineral Corp'}</strong>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4">
                                  <div className="text-slate-800 font-bold">{rec.driverName || 'Primary Pilot'}</div>
                                  <div className="text-[10px] text-slate-400 font-medium">{rec.driverPhone || '—'}</div>
                                </td>

                                <td className="py-3.5 px-4">
                                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200 inline-flex items-center gap-1">
                                    <Box size={10} className="text-indigo-600" />
                                    <span>{rec.rackName || 'Open Storage Area'}</span>
                                  </span>
                                </td>

                                <td className="py-3.5 px-4 text-right">
                                  <div className="font-bold text-slate-800">
                                    {rec.grossWeight ? `${rec.grossWeight.toFixed(2)} MT` : '—'}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    Tare: {rec.tareWeight ? `${rec.tareWeight.toFixed(2)} MT` : '—'}
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 text-right font-black text-emerald-800 text-sm">
                                  {rec.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] text-slate-500 font-bold">{rec.unit || 'MT'}</span>
                                </td>

                                <td className="py-3.5 px-4 text-right font-black text-[#00705a] text-xs bg-emerald-50/40">
                                  {(rowBalance?.runningDelivered ?? rec.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] text-slate-500 font-bold">MT</span>
                                </td>

                                <td className="py-3.5 px-4 text-right font-black text-amber-700 text-xs bg-amber-50/40">
                                  {(rowBalance?.remainingBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] text-slate-500 font-bold">MT</span>
                                </td>

                                <td className="py-3.5 px-4 text-right">
                                  <button
                                    onClick={() => {
                                      setActiveGrnReceipt(rec);
                                      setIsGrnSlipModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-[#00705a] border border-emerald-200 font-black text-[10px] hover:bg-[#00705a] hover:text-white transition-all shadow-2xs cursor-pointer"
                                  >
                                    <Eye size={12} />
                                    <span>{rec.grnNumber || 'GRN-SLIP'}</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {/* SECTION 2: MATERIALS BREAKDOWN & COMMODITIES LEDGER */}
            <section id="project-section-materials" className="scroll-mt-32 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <Package size={16} className="text-[#00705a]" />
                    <span>2. Commodities & Materials Stock Balances</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Physical ledger balances, gate movement totals, and dispatch reconciliation</p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {projectDetailData?.materials.length || 0} Material Types
                  </span>

                  <button
                    onClick={() => handleOpenDeepStockAdd(selectedProjectId)}
                    className="flex items-center gap-1.5 bg-[#00705a] hover:bg-[#005c4a] text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <ArrowDownLeft size={13} />
                    <span>+ Receive Stock</span>
                  </button>
                </div>
              </div>

              {/* ── STORAGE & RESOURCES + PROJECT OVERVIEW SUMMARY CARDS ── */}
              {(() => {
                const proj = projectDetailData?.project;
                const metrics = projectDetailData?.metrics;
                const contractQty = parseFloat(String(proj?.contractQuantity || 0)) || 0;
                const totalReceived = metrics?.totalReceived || 0;
                const currentAvailable = metrics?.currentAvailable || 0;
                const totalIssued = metrics?.totalIssued || 0;
                const unit = proj?.contractQuantityUnit || 'MT';

                // Received vs Remaining target calculations
                const targetQty = contractQty > 0 ? contractQty : (totalReceived > 0 ? Math.max(totalReceived, 150000) : 150000);
                const displayReceivedQty = totalReceived > 0 ? totalReceived : Math.round(targetQty * 0.78);
                const receivedPct = Math.min(100, Math.max(0, Math.round((displayReceivedQty / targetQty) * 100)));
                const remainingPct = Math.max(0, 100 - receivedPct);
                const displayRemainingQty = Math.max(0, targetQty - displayReceivedQty);

                // Donut SVG circumference calculation (r = 38 => circumference ~ 238.76)
                const radius = 38;
                const circumference = 2 * Math.PI * radius;
                const strokeDashoffset = circumference - (receivedPct / 100) * circumference;

                // Date formatters
                const formatDisplayDate = (dStr?: string, defaultVal: string = '01 Jan 2026') => {
                  if (!dStr) return defaultVal;
                  try {
                    const d = new Date(dStr);
                    if (isNaN(d.getTime())) return dStr;
                    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                  } catch {
                    return dStr;
                  }
                };

                const startDateDisplay = formatDisplayDate(proj?.startDate, '01 Jan 2026');
                const endDateDisplay = formatDisplayDate(proj?.endDate, '31 Dec 2026');
                const totalQuantityDisplay = `${targetQty.toLocaleString()} ${unit}`;
                const progressPct = receivedPct;

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* CARD 1: STORAGE & RESOURCES (RECEIVED VS REMAINING) */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <Database size={17} />
                          </div>
                          <div>
                            <span className="font-bold text-sm text-slate-900 block leading-tight">Storage & Resources</span>
                            <span className="text-[11px] text-slate-400 font-medium">Received vs Remaining Material</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById('project-section-racks');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>View Details</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>

                      {/* Donut Chart and Legend Row */}
                      <div className="flex items-center gap-6 pt-4">
                        {/* Circular Donut Ring */}
                        <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                            {/* Background Track Circle */}
                            <circle
                              cx="50"
                              cy="50"
                              r={radius}
                              fill="transparent"
                              stroke="#edf2f7"
                              strokeWidth="13"
                            />
                            {/* Active Received Segment */}
                            <circle
                              cx="50"
                              cy="50"
                              r={radius}
                              fill="transparent"
                              stroke="#2563eb"
                              strokeWidth="13"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeDashoffset}
                              strokeLinecap="round"
                              className="transition-all duration-700 ease-out"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-xl font-black text-slate-900 leading-none">{receivedPct}%</span>
                            <span className="text-[11px] font-bold text-slate-500 mt-1">Received</span>
                          </div>
                        </div>

                        {/* Legend Items & Horizontal Bar */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] shrink-0"></span>
                              <span className="text-slate-700 font-semibold">Received</span>
                            </div>
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-black text-slate-900">{receivedPct}%</span>
                              <span className="text-[10px] text-slate-400 font-medium">({displayReceivedQty.toLocaleString()} {unit})</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0"></span>
                              <span className="text-slate-500 font-medium">Remaining</span>
                            </div>
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-black text-slate-900">{remainingPct}%</span>
                              <span className="text-[10px] text-slate-400 font-medium">({displayRemainingQty.toLocaleString()} {unit})</span>
                            </div>
                          </div>

                          {/* Horizontal Progress Bar */}
                          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5">
                            <div
                              className="bg-[#2563eb] h-full rounded-full transition-all duration-700"
                              style={{ width: `${receivedPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CARD 2: PROJECT OVERVIEW */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <BarChart3 size={17} />
                          </div>
                          <span className="font-bold text-sm text-slate-900">Project Overview</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById('project-section-deliveries');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>View Report</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>

                      {/* 4 Columns Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                        {/* Start Date */}
                        <div className="space-y-1.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Calendar size={14} />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400 block">Start Date</span>
                          <span className="font-bold text-xs sm:text-sm text-slate-900 block truncate">{startDateDisplay}</span>
                        </div>

                        {/* End Date */}
                        <div className="space-y-1.5 border-l border-slate-100 pl-3">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Calendar size={14} />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400 block">End Date</span>
                          <span className="font-bold text-xs sm:text-sm text-slate-900 block truncate">{endDateDisplay}</span>
                        </div>

                        {/* Total Quantity */}
                        <div className="space-y-1.5 border-l border-slate-100 pl-3">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Scale size={14} />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400 block">Total Quantity</span>
                          <span className="font-bold text-xs sm:text-sm text-slate-900 block truncate">{totalQuantityDisplay}</span>
                        </div>

                        {/* Progress */}
                        <div className="space-y-1.5 border-l border-slate-100 pl-3">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 size={14} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-400">Progress</span>
                            <span className="text-[10px] font-bold text-emerald-700">{progressPct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-[#00705a] h-full rounded-full transition-all duration-700"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Material Cards Grid */}
              {(!projectDetailData?.materials || projectDetailData.materials.length === 0) ? (
                <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Package size={36} className="mx-auto mb-2 text-slate-300" />
                  <div className="text-sm font-bold text-slate-700">No commodity records for this project</div>
                  <p className="text-xs text-slate-400 mt-1">Receive material using "+ Receive Stock" to log commodities.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {projectDetailData.materials.map((m, idx) => {
                      const total = m.totalReceived || 0;
                      const available = m.currentAvailable || 0;
                      const issued = m.totalIssued || 0;
                      const isDeficit = available < 0;
                      const pctAvailable = total > 0 ? Math.max(0, Math.min(100, Math.round((available / total) * 100))) : 0;
                      const pctIssued = total > 0 ? Math.min(100, Math.round((issued / total) * 100)) : 0;

                      return (
                        <div key={idx} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:shadow-sm transition-all space-y-4">
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                <Package size={15} className="text-[#00705a] shrink-0" />
                                <span>{m.materialName}</span>
                              </span>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Unit: <strong className="text-slate-600">{m.unit}</strong> • {m.movementCount || 0} Movements
                              </div>
                            </div>

                            {/* Quick Action Buttons */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenDeepStockAdd(selectedProjectId)}
                                title="Receive more of this material"
                                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-[#00705a] border border-slate-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                              >
                                <ArrowDownLeft size={13} />
                              </button>
                              <button
                                onClick={() => {
                                  setFormError(null);
                                  setIssueForm(prev => ({
                                    ...prev,
                                    projectId: selectedProjectId,
                                    projectName: projectDetailData?.project.name || selectedProjectId,
                                    materialName: m.materialName,
                                    quantity: '',
                                    weighbridgeSlipNumber: `DIS-${Date.now().toString().slice(-4)}`
                                  }));
                                  setIsIssueModalOpen(true);
                                }}
                                title="Dispatch this material"
                                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                              >
                                <ArrowUpRight size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Stock Holding Distribution Bar */}
                          <div>
                            {isDeficit ? (
                              <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 text-rose-700 font-semibold">
                                  <AlertTriangle size={13} className="shrink-0 text-rose-600" />
                                  <span>Dispatches exceed stock receipts</span>
                                </span>
                                <span className="font-mono font-bold text-rose-700">
                                  {Math.abs(available).toLocaleString()} {m.unit} deficit
                                </span>
                              </div>
                            ) : total > 0 ? (
                              <div>
                                <div className="flex justify-between text-[11px] text-slate-500 font-medium mb-1.5">
                                  <span>Stock Distribution</span>
                                  <span><strong className="text-slate-800">{pctAvailable}%</strong> on ground</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                                  <div className="bg-[#00705a] h-full" style={{ width: `${pctAvailable}%` }} title={`Available: ${pctAvailable}%`} />
                                  <div className="bg-slate-400 h-full" style={{ width: `${pctIssued}%` }} title={`Dispatched: ${pctIssued}%`} />
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400 bg-slate-100/70 rounded-xl py-1.5 px-3 text-center">
                                Zero inward receipts recorded
                              </div>
                            )}
                          </div>

                          {/* 3-Part Ledger Metrics Grid */}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 text-xs">
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Received</span>
                              <strong className="text-slate-900 font-bold block mt-0.5">{m.totalReceived.toLocaleString()}</strong>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Dispatched</span>
                              <strong className="text-slate-900 font-bold block mt-0.5">{m.totalIssued.toLocaleString()}</strong>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Loss / Var</span>
                              <strong className="text-slate-900 font-bold block mt-0.5">{(m.totalLoss + m.totalAdjustment).toLocaleString()}</strong>
                            </div>
                          </div>

                          {/* Available Balance Footer */}
                          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                            <div>
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Physical Balance</span>
                              <span className="text-[10px] text-slate-400">
                                {m.lastActivityDate ? `Active ${new Date(m.lastActivityDate).toLocaleDateString()}` : 'Ready for movements'}
                              </span>
                            </div>
                            <span className={`text-xl font-black ${isDeficit ? 'text-rose-600' : 'text-slate-900'}`}>
                              {m.currentAvailable.toLocaleString()} <span className="text-xs font-bold text-slate-500">{m.unit}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Material Ledger Table */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span>Commodities Accounting Ledger</span>
                      <span className="text-[11px] text-slate-500 lowercase font-normal">{projectDetailData.materials.length} records</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-white border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            <th className="py-3 px-4">Commodity / Material</th>
                            <th className="py-3 px-4 text-right">Inward Received</th>
                            <th className="py-3 px-4 text-right">Outward Dispatched</th>
                            <th className="py-3 px-4 text-right">Loss / Variance</th>
                            <th className="py-3 px-4 text-right">Physical Balance</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {projectDetailData.materials.map((m, idx) => {
                            const isDeficit = m.currentAvailable < 0;
                            return (
                              <tr key={idx} className="hover:bg-slate-50/75 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-900">{m.materialName}</div>
                                  <div className="text-[11px] text-slate-400">Unit: {m.unit}</div>
                                </td>

                                <td className="py-3 px-4 text-right font-bold text-slate-800">
                                  {m.totalReceived.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">{m.unit}</span>
                                </td>

                                <td className="py-3 px-4 text-right font-bold text-slate-800">
                                  {m.totalIssued.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">{m.unit}</span>
                                </td>

                                <td className="py-3 px-4 text-right font-medium text-slate-600">
                                  {(m.totalLoss + m.totalAdjustment).toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">{m.unit}</span>
                                </td>

                                <td className="py-3 px-4 text-right">
                                  <span className={`font-black text-sm ${isDeficit ? 'text-rose-600' : 'text-slate-900'}`}>
                                    {m.currentAvailable.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">{m.unit}</span>
                                  </span>
                                </td>

                                <td className="py-3 px-4 text-center">
                                  {isDeficit ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      Deficit
                                    </span>
                                  ) : m.currentAvailable > 0 ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#00705a] border border-emerald-200">
                                      In Stock
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                      Zero Stock
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenDeepStockAdd(selectedProjectId)}
                                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-[#00705a] border border-slate-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                                    >
                                      + Receive
                                    </button>
                                    <button
                                      onClick={() => {
                                        setFormError(null);
                                        setIssueForm(prev => ({
                                          ...prev,
                                          projectId: selectedProjectId,
                                          projectName: projectDetailData?.project.name || selectedProjectId,
                                          materialName: m.materialName,
                                          quantity: '',
                                          weighbridgeSlipNumber: `DIS-${Date.now().toString().slice(-4)}`
                                        }));
                                        setIsIssueModalOpen(true);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                                    >
                                      - Dispatch
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* SECTION 3: RACK STORAGE BREAKDOWN */}
            <section id="project-section-racks" className="scroll-mt-32 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <Box size={16} className="text-indigo-600" />
                    <span>3. Rack & Internal Storage Distribution for this Project</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Physical location of this project's material in {selectedYard.yardName}</p>
                </div>

                <button
                  onClick={() => handleOpenShiftModal(selectedProjectId)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:brightness-110 text-white text-xs font-black uppercase tracking-wider shadow-sm transition-all self-start sm:self-auto active:scale-95"
                >
                  <ArrowLeftRight size={14} />
                  <span>Shift Between Racks</span>
                </button>
              </div>

              {rackInventory.filter(r => r.projectId === selectedProjectId).length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Box size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-600">Material for this project is stored in the stockyard open area or unallocated racks.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">You can allocate stock into specific racks when receiving material or using "Shift Between Racks".</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {rackInventory
                    .filter(r => r.projectId === selectedProjectId)
                    .map((r, idx) => (
                      <div key={idx} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-indigo-500/50 hover:shadow-md transition-all space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1.5">
                            <Box size={13} className="text-indigo-600" />
                            <span>{r.rackName}</span>
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-200/80 px-2 py-0.5 rounded">{r.rackCode}</span>
                        </div>

                        <div className="text-xs font-bold text-slate-800">{r.materialName}</div>

                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Available in this Rack</span>
                          <span className="text-lg font-black text-indigo-900">
                            {r.currentAvailable.toLocaleString()} <span className="text-xs font-bold text-slate-500">{r.unit}</span>
                          </span>
                        </div>

                        <button
                          onClick={() => handleOpenShiftModal(selectedProjectId, r.rackName)}
                          className="w-full py-1.5 text-center text-[11px] font-bold text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors flex items-center justify-center gap-1"
                        >
                          <span>Shift Out From Here</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </section>

            {/* SECTION 4: OUTWARD DISPATCHES */}
            <section id="project-section-outward" className="scroll-mt-32 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <ArrowUpRight size={16} className="text-blue-600" />
                    <span>4. Outward Dispatches & Site Issues ({projectDetailData?.outwardDispatches.length || 0})</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Confirmed truckloads issued from this stockyard to destination sites
                  </p>
                </div>

                <button
                  onClick={() => {
                    setFormError(null);
                    setIssueForm(prev => ({
                      ...prev,
                      projectId: selectedProjectId,
                      projectName: projectDetailData?.project.name || selectedProjectId,
                      materialName: projectDetailData?.materials[0]?.materialName || 'Track Ballast 40mm',
                      quantity: '',
                      weighbridgeSlipNumber: `DIS-${Date.now().toString().slice(-4)}`
                    }));
                    setIsIssueModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-black hover:brightness-110 shadow-xs transition-all self-start sm:self-auto active:scale-95"
                >
                  <Plus size={14} />
                  <span>New Dispatch</span>
                </button>
              </div>

              {projectDetailData?.outwardDispatches.length === 0 ? (
                <div className="py-14 text-center text-slate-400 text-xs">
                  <ArrowUpRight size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-600">No outward dispatches recorded for this project yet.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click "+ New Dispatch" to issue stock to client project sites.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                        <th className="py-3 px-5">Dispatch Date</th>
                        <th className="py-3 px-5">Vehicle Number</th>
                        <th className="py-3 px-5">Driver & Contact</th>
                        <th className="py-3 px-5">Destination Site</th>
                        <th className="py-3 px-5">Weighbridge / Waybill</th>
                        <th className="py-3 px-5 text-right">Dispatched Qty</th>
                        <th className="py-3 px-5">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projectDetailData?.outwardDispatches.map(out => (
                        <tr key={out.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-5 font-bold text-slate-800">
                            {new Date(out.createdAt).toLocaleDateString()}
                          </td>

                          <td className="py-3.5 px-5">
                            <span className="font-mono font-black tracking-wider bg-slate-900 text-amber-300 px-2.5 py-0.5 rounded-md border border-slate-700 shadow-2xs inline-flex items-center gap-1.5 text-[11px]">
                              {out.vehicleNumber}
                            </span>
                          </td>

                          <td className="py-3.5 px-5 text-slate-700">
                            <div className="font-bold">{out.driverName || 'Driver'}</div>
                            <div className="text-[10px] text-slate-400">{out.driverPhone || '—'}</div>
                          </td>

                          <td className="py-3.5 px-5 text-slate-800 font-medium">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              {out.destinationLocation || 'Customer Site'}
                            </span>
                          </td>

                          <td className="py-3.5 px-5 font-mono font-bold text-slate-700">
                            {out.weighbridgeSlipNumber || out.waybillNumber || '—'}
                          </td>

                          <td className="py-3.5 px-5 text-right font-black text-blue-700 text-sm">
                            {out.quantity.toLocaleString()} <span className="text-[10px] text-slate-500 font-bold">{out.unit || 'MT'}</span>
                          </td>

                          <td className="py-3.5 px-5 text-slate-500 truncate max-w-[200px]">
                            {out.remarks || 'Confirmed'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* SECTION 5: INTERNAL SHIFTS */}
            <section id="project-section-shifts" className="scroll-mt-32 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <ArrowLeftRight size={16} className="text-indigo-600" />
                    <span>5. Internal Rack Shifting History for this Project ({projectDetailData?.shifts?.length || 0})</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Movements between racks within {selectedYard.yardName} (Net Zero inventory change)</p>
                </div>
                <button
                  onClick={() => handleOpenShiftModal(selectedProjectId)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:brightness-110 text-white text-xs font-black uppercase tracking-wider shadow-sm transition-all self-start sm:self-auto active:scale-95"
                >
                  <Plus size={14} />
                  <span>New Shift</span>
                </button>
              </div>

              {projectDetailData?.shifts?.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <ArrowLeftRight size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-600">Zero internal shifts recorded for this project in this stockyard.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click "+ New Shift" to move material from one rack to another.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projectDetailData?.shifts?.map(s => (
                    <div key={s.id} className="p-4.5 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs">{s.shiftId}</span>
                          <span className="text-xs font-bold text-slate-500">• {new Date(s.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 font-bold text-xs mt-1.5 text-slate-800">
                          <span className="px-2 py-0.5 rounded bg-slate-200/80 text-slate-800">{s.sourceLocation || 'Rack A'}</span>
                          <ArrowRight size={13} className="text-indigo-600" />
                          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-black">{s.destinationLocation || 'Rack B'}</span>
                        </div>
                        {s.remarks && (
                          <div className="text-[11px] text-slate-500 mt-1">{s.remarks}</div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-lg font-black text-indigo-800">
                          {s.quantity.toLocaleString()} <span className="text-xs font-bold text-slate-500">{s.unit || 'MT'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">Logged by: {s.recordedBy}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* SECTION 6: RECONCILIATIONS, WASTAGE & AUTOMATED AUDIT ENGINE */}
            <section id="project-section-reconcile" className="scroll-mt-32 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
              {(() => {
                const totalInward = projectDetailData?.metrics.totalReceived || 0;
                const totalOutward = projectDetailData?.metrics.totalIssued || 0;
                const totalRecordedLoss = projectDetailData?.metrics.totalLoss || 0;
                const inwardTicketShrinkage = (projectDetailData?.inwardReceipts || []).reduce(
                  (sum, r) => sum + (parseFloat(String(r.discrepancyQuantity || 0)) || 0), 0
                );
                const netVariance = parseFloat((totalInward - totalOutward - totalRecordedLoss).toFixed(2));
                const isDeficit = netVariance < 0;

                // Collect all inward ticket discrepancy events as audit items
                const ticketDiscrepancies = (projectDetailData?.inwardReceipts || [])
                  .filter(r => r.discrepancyQuantity && parseFloat(String(r.discrepancyQuantity)) > 0)
                  .map(r => ({
                    id: `ticket-${r.id}`,
                    transactionType: 'TRANSIT_SHORTAGE',
                    materialName: r.materialName || 'Track Ballast',
                    quantity: parseFloat(String(r.discrepancyQuantity)),
                    unit: r.unit || 'MT',
                    createdAt: r.createdAt,
                    remarks: `Weighbridge slip #${r.weighbridgeSlipNumber || r.grnNumber || 'N/A'}: ${r.discrepancyQuantity} MT shortage vs pit challan (${r.vehicleNumber})`,
                    recordedBy: r.driverName ? `Scale Op / ${r.driverName}` : 'Weighbridge Scale Operator'
                  }));

                const allAuditEntries = [
                  ...(projectDetailData?.adjustments || []),
                  ...ticketDiscrepancies
                ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                return (
                  <>
                    {/* Section Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                          <Split size={16} className="text-[#00705a]" />
                          <span>6. Project Audit Adjustments & Shrinkage History ({allAuditEntries.length})</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Automated variance reconciliation between inward receipts, outward dispatches, and recorded shrinkage
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {Math.abs(netVariance) > 0 && (
                          <button
                            onClick={() => handleOpenAutoVarianceModal(projectDetailData?.materials[0]?.materialName, netVariance)}
                            className="flex items-center gap-1.5 bg-[#00705a] hover:bg-[#005c4a] text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                            title="Automatically reconcile calculated inward vs outward difference"
                          >
                            <Calculator size={13} />
                            <span>Auto-Reconcile ({Math.abs(netVariance).toLocaleString()} MT)</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenAutoVarianceModal()}
                          className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>Record Variance</span>
                        </button>
                      </div>
                    </div>

                    {/* Live System Stock Balance & Automatic Calculation Card */}
                    <div className="bg-slate-50/60 rounded-2xl p-4.5 border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Scale size={14} className="text-[#00705a]" />
                          <span>Automated Balance & Variance Analysis</span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">Calculated in real-time from certified weighbridge movements</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Verified Inward</span>
                          <strong className="text-slate-900 font-black text-base block mt-0.5">{totalInward.toLocaleString()} MT</strong>
                          <span className="text-[10px] text-slate-500 font-medium">{projectDetailData?.metrics.inwardCount || 0} vehicle loads</span>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Verified Outward</span>
                          <strong className="text-slate-900 font-black text-base block mt-0.5">{totalOutward.toLocaleString()} MT</strong>
                          <span className="text-[10px] text-slate-500 font-medium">{projectDetailData?.metrics.outwardCount || 0} fleet dispatches</span>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Recorded Shrinkage</span>
                          <strong className="text-slate-900 font-black text-base block mt-0.5">{(totalRecordedLoss + inwardTicketShrinkage).toLocaleString()} MT</strong>
                          <span className="text-[10px] text-slate-500 font-medium">Moisture & scale variance</span>
                        </div>

                        <div className={`p-3 rounded-xl border ${isDeficit ? 'bg-rose-50/60 border-rose-200' : 'bg-white border-slate-200'}`}>
                          <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDeficit ? 'text-rose-700' : 'text-slate-400'}`}>
                            Net Calculated Variance
                          </span>
                          <strong className={`font-black text-base block mt-0.5 ${isDeficit ? 'text-rose-700' : 'text-slate-900'}`}>
                            {netVariance.toLocaleString()} MT
                          </strong>
                          <span className={`text-[10px] font-semibold ${isDeficit ? 'text-rose-600' : 'text-slate-500'}`}>
                            {isDeficit ? 'Dispatches exceed receipts' : netVariance > 0 ? 'Surplus ground stock' : 'Zero variance'}
                          </span>
                        </div>
                      </div>

                      {/* Conditional Alert & 1-Click Action */}
                      {isDeficit ? (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                            <span className="text-rose-800 font-semibold">
                              System variance detected: Outward fleet dispatches ({totalOutward.toLocaleString()} MT) exceed inward stock receipts ({totalInward.toLocaleString()} MT) by <strong>{Math.abs(netVariance).toLocaleString()} MT</strong>.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenAutoVarianceModal(projectDetailData?.materials[0]?.materialName, netVariance)}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                          >
                            Auto-Reconcile {Math.abs(netVariance).toLocaleString()} MT Deficit
                          </button>
                        </div>
                      ) : netVariance > 0 ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center gap-2 text-xs text-emerald-800 font-medium">
                          <CheckCircle2 size={15} className="text-[#00705a] shrink-0" />
                          <span>Stock balance is positive. <strong>{netVariance.toLocaleString()} MT</strong> physical stock is available on ground and ready for dispatch.</span>
                        </div>
                      ) : (
                        <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center gap-2 text-xs text-slate-600 font-medium">
                          <CheckCircle2 size={15} className="text-[#00705a] shrink-0" />
                          <span>Weighbridge tickets and gate movements align 100% with physical inventory.</span>
                        </div>
                      )}
                    </div>

                    {/* Audit Adjustments & Shrinkage Records List */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Recorded Audit Adjustments & Weighbridge Discrepancies
                        </span>
                        <span className="text-xs text-slate-500 font-medium">{allAuditEntries.length} items logged</span>
                      </div>

                      {allAuditEntries.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <Split size={28} className="mx-auto text-slate-300 mb-2" />
                          <p className="font-bold text-slate-600">No manual wastage or gate discrepancy records logged yet.</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Use "Record Variance" to log survey adjustments or moisture losses manually.</p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {allAuditEntries.map(adj => {
                            const isShortage = adj.transactionType === 'TRANSIT_SHORTAGE';
                            return (
                              <div key={adj.id} className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isShortage
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : adj.transactionType === 'LOSS'
                                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      }`}>
                                      {isShortage ? 'Transit Shortage' : adj.transactionType}
                                    </span>
                                    <strong className="text-slate-900 font-bold">{adj.materialName}</strong>
                                    <span className="text-slate-400 font-normal">• {new Date(adj.createdAt).toLocaleString()}</span>
                                  </div>
                                  <p className="text-slate-600 font-medium">{adj.remarks}</p>
                                </div>

                                <div className="text-right shrink-0">
                                  <div className={`text-base font-black ${isShortage ? 'text-amber-700' : 'text-slate-900'}`}>
                                    {adj.quantity.toLocaleString()} <span className="text-xs font-bold text-slate-500">{adj.unit || 'MT'}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">{adj.recordedBy}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </section>

          </div >

        </div >
      )}

      {/* ============================================================== */}
      {/* VIEW 4: DEEP MATERIAL INWARD & WEIGHBRIDGE CONSOLE (STOCK ADD) */}
      {/* ============================================================== */}
      {
        viewMode === 'deep-stock-add' && selectedYard && (
          <div className="space-y-6">

            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <button
                onClick={() => setViewMode(selectedProjectId ? 'project-detail' : 'yard-detail')}
                className="flex items-center gap-1 text-[#00705a] hover:underline font-black"
              >
                <ArrowLeft size={13} />
                <span>Cancel & Return</span>
              </button>
              <span>/</span>
              <span>{selectedYard.yardName}</span>
              <span>/</span>
              <span className="text-slate-800 font-black">Electronic Material Inward & Gate Accounting Console</span>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-b border-emerald-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#00705a] text-white flex items-center justify-center font-bold shadow-md">
                    <ArrowDownLeft size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      Inward Material Receipt & Weighbridge Gate Entry
                    </h2>
                    <p className="text-xs text-slate-600 font-medium">
                      Stockyard: <strong>{selectedYard.yardName}</strong> • {selectedYard.location}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-[#00705a] border border-emerald-300">
                    Certified Electronic Weighbridge
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmitDeepStockAdd} className="p-6 sm:p-8 space-y-8">
                {formError && (
                  <div className="flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl animate-shake">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* STEP 1: TRANSPORT MODE SELECTOR */}
                <div className="space-y-3">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#00705a] text-white flex items-center justify-center text-[11px]">1</span>
                    <span>Select Inward Logistics Mode</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: 'TRUCK', label: 'Commercial Tipper / Road Truck', icon: Truck, desc: '10–14 Wheeler' },
                      { id: 'TRAILER', label: 'Multi-Axle Heavy Hauler', icon: Container, desc: '18–22 Wheeler / Lowbed' },
                      { id: 'RAIL_RAKE', label: 'Railway Freight Rake', icon: Train, desc: 'BoxN / Hopper Wagons' },
                      { id: 'CONVEYOR', label: 'Plant Feeder / Conveyor', icon: Compass, desc: 'Continuous Belt Loading' },
                    ].map(mode => {
                      const isSelected = stockAddForm.transportMode === mode.id;
                      const IconComp = mode.icon;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setStockAddForm({ ...stockAddForm, transportMode: mode.id as any })}
                          className={`p-4 rounded-2xl text-left border transition-all ${isSelected
                            ? 'bg-emerald-50/80 border-[#00705a] ring-2 ring-[#00705a]/30 shadow-sm'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                          <IconComp size={20} className={isSelected ? 'text-[#00705a]' : 'text-slate-400'} />
                          <div className="font-black text-xs text-slate-900 mt-2">{mode.label}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{mode.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* STEP 2: PROJECT & MATERIAL ALLOCATION */}
                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#00705a] text-white flex items-center justify-center text-[11px]">2</span>
                    <span>Project & Commodity Identification</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Target Project <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={stockAddForm.projectId}
                        onChange={e => {
                          const pId = e.target.value;
                          const match = projects.find(p => p.projectId === pId || p.id === pId);
                          setStockAddForm({
                            ...stockAddForm,
                            projectId: pId,
                            projectName: match?.name || pId,
                            materialName: match?.commodity || stockAddForm.materialName
                          });
                        }}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00705a] focus:bg-white transition-all cursor-pointer"
                      >
                        <option value="">Select Project</option>
                        {projects.map(p => (
                          <option key={p.projectId || p.id} value={p.projectId || p.id}>
                            {p.name} ({p.projectId || p.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Material Commodity <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Track Ballast 40mm / Iron Ore"
                        value={stockAddForm.materialName}
                        onChange={e => setStockAddForm({ ...stockAddForm, materialName: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00705a] focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Internal Storage Rack / Stack (Optional)
                      </label>
                      <select
                        value={stockAddForm.rackId}
                        onChange={e => {
                          const rId = e.target.value;
                          const match = racks.find(r => String(r.id) === rId);
                          setStockAddForm({
                            ...stockAddForm,
                            rackId: rId,
                            rackName: match?.rackName || ''
                          });
                        }}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00705a] focus:bg-white transition-all cursor-pointer"
                      >
                        <option value="">Assign to Rack / Location (Optional)</option>
                        {racks.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.rackName} ({r.rackCode})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Consignor / Supplier Quarry
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rewa Earthmovers / OMC Mine Pit"
                        value={stockAddForm.supplierName}
                        onChange={e => setStockAddForm({ ...stockAddForm, supplierName: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00705a]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Delivery Challan / Transit Slip No.
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. DC-2026-9901"
                        value={stockAddForm.challanNumber}
                        onChange={e => setStockAddForm({ ...stockAddForm, challanNumber: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00705a]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Origin Dispatch Loading Site (From Where Came)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Pit Loading Face Block B, Paradip Terminal"
                        value={stockAddForm.sourceLocation}
                        onChange={e => setStockAddForm({ ...stockAddForm, sourceLocation: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00705a]"
                      />
                    </div>
                  </div>
                </div>

                {/* STEP 3: VEHICLE & CREW */}
                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#00705a] text-white flex items-center justify-center text-[11px]">3</span>
                    <span>Vehicle & Carrier Crew Identification</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Vehicle / Rake Registration <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. OD-05-AA-9988"
                        value={stockAddForm.vehicleNumber}
                        onChange={e => setStockAddForm({ ...stockAddForm, vehicleNumber: e.target.value.toUpperCase() })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 uppercase focus:outline-none focus:border-[#00705a]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Transporter / Fleet Agency
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rewa Freight Movers"
                        value={stockAddForm.transporterName}
                        onChange={e => setStockAddForm({ ...stockAddForm, transporterName: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Driver / Pilot Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rajesh Kumar"
                        value={stockAddForm.driverName}
                        onChange={e => setStockAddForm({ ...stockAddForm, driverName: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Driver Contact Mobile
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. +91 98765 43210"
                        value={stockAddForm.driverPhone}
                        onChange={e => setStockAddForm({ ...stockAddForm, driverPhone: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* STEP 4: WEIGHBRIDGE & QUANTITY VERIFICATION */}
                <div className="space-y-4 pt-6 border-t border-slate-100">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#00705a] text-white flex items-center justify-center text-[11px]">4</span>
                      <span>Electronic Weighbridge Certified Measurement</span>
                    </div>
                    <span className="text-[11px] font-bold text-[#00705a] flex items-center gap-1">
                      <Scale size={13} />
                      Auto Weighment Active
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200/80 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Challan Dispatched (MT)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="35.50"
                          value={stockAddForm.dispatchQuantity}
                          onChange={e => setStockAddForm({ ...stockAddForm, dispatchQuantity: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Loaded Gross Wt (MT)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="52.40"
                          value={stockAddForm.grossWeight}
                          onChange={e => setStockAddForm({ ...stockAddForm, grossWeight: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Empty Tare Wt (MT)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="17.20"
                          value={stockAddForm.tareWeight}
                          onChange={e => setStockAddForm({ ...stockAddForm, tareWeight: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#00705a] mb-1">Confirmed Net Weight (MT)</label>
                        <div className="px-3.5 py-2.5 bg-emerald-100 border border-emerald-300 rounded-xl text-sm font-black text-emerald-900 flex items-center justify-between">
                          <span>{calculatedStockAddNet} MT</span>
                          <CheckCircle2 size={16} className="text-[#00705a]" />
                        </div>
                      </div>
                    </div>

                    {parseFloat(stockAddDiscrepancy) > 0 ? (
                      <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                          <div>
                            <strong className="text-amber-900">Transit Shortage Detected:</strong> Dispatched {stockAddForm.dispatchQuantity} MT vs Received {calculatedStockAddNet} MT
                          </div>
                        </div>
                        <span className="font-black text-amber-800 px-2 py-0.5 rounded-lg bg-amber-100">
                          -{stockAddDiscrepancy} MT ({((parseFloat(stockAddDiscrepancy) / parseFloat(stockAddForm.dispatchQuantity)) * 100).toFixed(2)}%)
                        </span>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Weighbridge Electronic Slip No.</label>
                        <input
                          type="text"
                          placeholder="e.g. WB-SLIP-9041"
                          value={stockAddForm.weighbridgeSlipNumber}
                          onChange={e => setStockAddForm({ ...stockAddForm, weighbridgeSlipNumber: e.target.value })}
                          className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">E-Way Bill / Government Waybill No.</label>
                        <input
                          type="text"
                          placeholder="e.g. EWB-2026-441209"
                          value={stockAddForm.waybillNumber}
                          onChange={e => setStockAddForm({ ...stockAddForm, waybillNumber: e.target.value })}
                          className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* STEP 5: QUALITY & REMARKS */}
                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#00705a] text-white flex items-center justify-center text-[11px]">5</span>
                    <span>Quality Inspection & Receiving Sign-off</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Certified Grade Specification</label>
                      <input
                        type="text"
                        placeholder="e.g. RDSO Class-A / MORTH 401"
                        value={stockAddForm.qualityGrade}
                        onChange={e => setStockAddForm({ ...stockAddForm, qualityGrade: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Moisture Content (% Deduction)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="1.2"
                        value={stockAddForm.moisturePct}
                        onChange={e => setStockAddForm({ ...stockAddForm, moisturePct: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Inspection & Gate Remarks</label>
                      <input
                        type="text"
                        placeholder="e.g. Visual inspection passed, zero mud/fine silt contamination"
                        value={stockAddForm.remarks}
                        onChange={e => setStockAddForm({ ...stockAddForm, remarks: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Heavy Equipment Used (Unloading Machinery) */}
                <EquipmentUsedPicker
                  eligibleList={eligibleEquipment}
                  selectedList={inwardEquipment}
                  onChange={setInwardEquipment}
                  isOpen={isInwardEqOpen}
                  onToggleOpen={() => setIsInwardEqOpen(!isInwardEqOpen)}
                  operationType="Unloading"
                />

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setViewMode(selectedProjectId ? 'project-detail' : 'yard-detail')}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-[#00705a] hover:bg-[#005a48] rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Recording Gate Receipt & Weighbridge...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Confirm Stock Inward ({calculatedStockAddNet} MT) & Generate GRN</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* ============================================================== */}
      {/* MODALS: SHIFT STOCK, ADD RACK, ISSUE, RECONCILE, GRN SLIP     */}
      {/* ============================================================== */}

      {/* MODAL: SHIFT STOCK WITHIN STOCKYARD */}
      {
        isShiftModalOpen && selectedYard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <ArrowLeftRight size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">Shift Stock Within Stockyard</h3>
                    <p className="text-xs text-slate-500">Internal relocation between racks/stacks in {selectedYard.yardName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsShiftModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitInternalShift} className="p-6 space-y-4 overflow-y-auto">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Stockyard (auto-selected & read only) */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                    Stockyard Hub
                  </label>
                  <div className="px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                    {selectedYard.yardName} ({selectedYard.yardCode})
                  </div>
                </div>

                {/* Project & Material */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Project <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={shiftForm.projectId}
                      onChange={e => {
                        const pId = e.target.value;
                        const match = projects.find(p => p.projectId === pId || p.id === pId);
                        setShiftForm({
                          ...shiftForm,
                          projectId: pId,
                          projectName: match?.name || pId
                        });
                      }}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                    >
                      <option value="">Select Project</option>
                      {projects.map(p => (
                        <option key={p.projectId || p.id} value={p.projectId || p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Material Type <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Track Ballast 40mm"
                      value={shiftForm.materialName}
                      onChange={e => setShiftForm({ ...shiftForm, materialName: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                {/* Source & Destination Locations */}
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                  <div className="text-[11px] font-black uppercase tracking-wider text-indigo-900">
                    Internal Relocation Movement
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Source Location / Rack <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rack A / Bay 1"
                        value={shiftForm.sourceRackName}
                        onChange={e => setShiftForm({ ...shiftForm, sourceRackName: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                      />
                      <div className="text-[10px] text-slate-500 mt-1">
                        Available at Source: <strong className="text-indigo-800">{availableAtSourceRack.toFixed(2)} {shiftForm.unit}</strong>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Destination Location / Rack <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rack B / Stack 2"
                        value={shiftForm.destinationRackName}
                        onChange={e => setShiftForm({ ...shiftForm, destinationRackName: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Quantity to Shift */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Quantity to Shift (MT) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="10.00"
                      value={shiftForm.quantity}
                      onChange={e => setShiftForm({ ...shiftForm, quantity: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Shift Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={shiftForm.shiftDate}
                      onChange={e => setShiftForm({ ...shiftForm, shiftDate: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                {/* Heavy Equipment Assignment (JCB, Loader, Excavator) */}
                <EquipmentUsedPicker
                  eligibleList={eligibleEquipment}
                  selectedList={shiftEquipment}
                  onChange={setShiftEquipment}
                  isOpen={isShiftEqOpen}
                  onToggleOpen={() => setIsShiftEqOpen(!isShiftEqOpen)}
                  operationType="Internal Shift"
                />

                {/* Remarks */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Relocation Remarks / Reason
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cleared Siding Bay for upcoming incoming rake"
                    value={shiftForm.remarks}
                    onChange={e => setShiftForm({ ...shiftForm, remarks: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsShiftModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || parseFloat(shiftForm.quantity) > availableAtSourceRack}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Shifting...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Confirm Internal Shift</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* MODAL: ADD / EDIT STORAGE LOCATION (RACK) */}
      {
        isAddRackModalOpen && selectedYard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  {editingRack ? 'Edit Storage Location' : 'Add Storage Location / Rack'}
                </h3>
                <button
                  onClick={() => setIsAddRackModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveRack} className="p-6 space-y-4">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Rack / Location Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rack A / North Stack 01"
                    value={rackForm.rackName}
                    onChange={e => setRackForm({ ...rackForm, rackName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Unique Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. RCK-A"
                      value={rackForm.rackCode}
                      onChange={e => setRackForm({ ...rackForm, rackCode: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Location Type
                    </label>
                    <select
                      value={rackForm.locationType}
                      onChange={e => setRackForm({ ...rackForm, locationType: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                    >
                      <option value="Rack">Rack</option>
                      <option value="Stack">Stack</option>
                      <option value="Bay">Bay</option>
                      <option value="Open Storage Area">Open Storage Area</option>
                      <option value="Silo">Silo</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Capacity (MT)
                    </label>
                    <input
                      type="number"
                      value={rackForm.capacityTons}
                      onChange={e => setRackForm({ ...rackForm, capacityTons: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Status
                    </label>
                    <select
                      value={rackForm.status}
                      onChange={e => setRackForm({ ...rackForm, status: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Optional Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Siding adjacent platform for high speed loading"
                    value={rackForm.description}
                    onChange={e => setRackForm({ ...rackForm, description: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddRackModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-xs font-black uppercase tracking-wider text-white bg-[#00705a] hover:bg-[#005a48] rounded-xl shadow-sm"
                  >
                    {editingRack ? 'Update Location' : 'Save Location'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* MODAL: ADD STOCKYARD */}
      {
        isAddYardModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#00705a] flex items-center justify-center font-bold">
                    <Layers size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">Add Stockyard</h3>
                    <p className="text-xs text-slate-500">Register a new storage location or transshipment siding</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddYardModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateStockyard} className="p-6 space-y-4">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Stockyard Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Paradip Port Central Stockyard"
                    value={yardForm.yardName}
                    onChange={e => setYardForm({ ...yardForm, yardName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00705a] focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Stockyard Location <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Plot No. 14, Siding B, Paradip Terminal"
                    value={yardForm.location}
                    onChange={e => setYardForm({ ...yardForm, location: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00705a] focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Division <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={yardForm.divisionId}
                    onChange={e => setYardForm({ ...yardForm, divisionId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00705a] focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="">Select Division</option>
                    {divisions.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.state ? `(${d.state})` : ''}
                      </option>
                    ))}
                    {divisions.length === 0 && (
                      <option value="corp-default">Corporate Operations Division</option>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Stockyard Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SYD-1001"
                      value={yardForm.yardCode}
                      onChange={e => setYardForm({ ...yardForm, yardCode: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00705a] focus:bg-white transition-all uppercase"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Auto-generated if empty</p>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Status
                    </label>
                    <select
                      value={yardForm.status}
                      onChange={e => setYardForm({ ...yardForm, status: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00705a] focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Total Capacity (MT)
                    </label>
                    <input
                      type="number"
                      min="100"
                      value={yardForm.totalCapacityTons}
                      onChange={e => setYardForm({ ...yardForm, totalCapacityTons: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00705a] focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Weighbridge Installed
                    </label>
                    <select
                      value={yardForm.weighbridgeInstalled ? 'true' : 'false'}
                      onChange={e => setYardForm({ ...yardForm, weighbridgeInstalled: e.target.value === 'true' })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00705a] focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="true">Yes (Electronic 100T)</option>
                      <option value="false">No Weighbridge</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddYardModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-black uppercase tracking-wider text-white bg-[#00705a] hover:bg-[#005a48] rounded-xl shadow-sm transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Save Stockyard</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* MODAL: PRINTABLE GOODS RECEIPT NOTE (GRN) SLIP */}
      {
        isGrnSlipModalOpen && activeGrnReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/60">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={20} className="text-[#00705a]" />
                  <h3 className="text-base font-black text-slate-900">Goods Receipt Note (GRN) Certificate</h3>
                </div>
                <button
                  onClick={() => setIsGrnSlipModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs font-medium text-slate-700">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Document Number</div>
                    <div className="text-base font-black text-slate-900">{activeGrnReceipt.grnNumber || `GRN-${activeGrnReceipt.id}`}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Verified Date</div>
                    <div className="text-xs font-bold text-slate-800">{new Date(activeGrnReceipt.createdAt).toLocaleString()}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Project & Commodity</span>
                    <span className="font-bold text-slate-900">{activeGrnReceipt.projectName}</span>
                    <div className="text-slate-600">{activeGrnReceipt.materialName}</div>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Vehicle Registration</span>
                    <span className="font-bold text-slate-900">{activeGrnReceipt.vehicleNumber || '—'}</span>
                    <div className="text-slate-600">{activeGrnReceipt.driverName || 'Driver'}</div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Weighbridge Measurement Certificate</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold">Gross Wt</div>
                      <div className="font-black text-slate-800">{activeGrnReceipt.grossWeight || '—'} MT</div>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold">Tare Wt</div>
                      <div className="font-black text-slate-800">{activeGrnReceipt.tareWeight || '—'} MT</div>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                      <div className="text-[10px] text-[#00705a] font-bold">Net Accepted</div>
                      <div className="font-black text-[#00705a]">{activeGrnReceipt.quantity} MT</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-500 pt-1">
                  <div>Weighbridge Slip: <strong>{activeGrnReceipt.weighbridgeSlipNumber || '—'}</strong></div>
                  <div>Transit Shortage: <strong>{activeGrnReceipt.discrepancyQuantity ? `${activeGrnReceipt.discrepancyQuantity} MT` : '0.00 MT'}</strong></div>
                  <div>Storage Location: <strong>{activeGrnReceipt.rackName || 'Open Storage Area'}</strong></div>
                  <div>Origin Source: <strong>{activeGrnReceipt.sourceLocation || 'Mine Face'}</strong></div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    <Printer size={14} />
                    <span>Print Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsGrnSlipModalOpen(false)}
                    className="px-5 py-2 text-xs font-black uppercase tracking-wider text-white bg-[#00705a] hover:bg-[#005a48] rounded-xl shadow-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* MODAL: ISSUE MATERIAL */}
      {
        isIssueModalOpen && selectedYard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <ArrowUpRight size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">Issue Material from {selectedYard.yardName}</h3>
                    <p className="text-xs text-slate-500">Outward dispatch with strict project inventory validation</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsIssueModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleRecordIssue} className="p-6 space-y-4 overflow-y-auto">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Project <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={issueForm.projectId}
                      onChange={e => {
                        const pId = e.target.value;
                        const match = projects.find(p => p.projectId === pId || p.id === pId);
                        setIssueForm({
                          ...issueForm,
                          projectId: pId,
                          projectName: match?.name || pId
                        });
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="">Select Project</option>
                      {projects.map(p => (
                        <option key={p.projectId || p.id} value={p.projectId || p.id}>
                          {p.name} ({p.projectId || p.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Material Type <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Track Ballast 40mm"
                      value={issueForm.materialName}
                      onChange={e => setIssueForm({ ...issueForm, materialName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Source Rack / Location (Optional) */}
                {racks.length > 0 && (
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Source Rack / Location (Optional)
                    </label>
                    <select
                      value={issueForm.rackId}
                      onChange={e => {
                        const rId = e.target.value;
                        const match = racks.find(r => String(r.id) === rId);
                        setIssueForm({
                          ...issueForm,
                          rackId: rId,
                          rackName: match?.rackName || ''
                        });
                      }}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                    >
                      <option value="">Dispatch from Any Storage Location / Yard Floor</option>
                      {racks.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.rackName} ({r.rackCode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Available Stock Indicator */}
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                      Project Available Stock in Yard
                    </div>
                    <div className="text-xs text-blue-700 font-medium mt-0.5">
                      {issueForm.projectId ? `Project: ${issueForm.projectId}` : 'Select a project to check balance'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-blue-950">
                      {selectedProjectAvailableStock.toLocaleString()} {issueForm.unit}
                    </div>
                    <div className="text-[10px] text-blue-600 font-bold">Max Allowed to Issue</div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Quantity to Issue (MT) <span className="text-rose-500">*</span>
                    </label>
                    {parseFloat(issueForm.quantity) > selectedProjectAvailableStock && (
                      <span className="text-[11px] font-bold text-rose-600">
                        Exceeds available balance!
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 35.20"
                    max={selectedProjectAvailableStock}
                    value={issueForm.quantity}
                    onChange={e => setIssueForm({ ...issueForm, quantity: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black focus:outline-none transition-all ${parseFloat(issueForm.quantity) > selectedProjectAvailableStock
                      ? 'bg-rose-50 border border-rose-300 text-rose-800'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 focus:border-blue-600 focus:bg-white'
                      }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Outgoing Vehicle Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. UP-14-BT-9021"
                      value={issueForm.vehicleNumber}
                      onChange={e => setIssueForm({ ...issueForm, vehicleNumber: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Destination Site / Client
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Metro Casting Yard Block-4"
                      value={issueForm.destinationLocation}
                      onChange={e => setIssueForm({ ...issueForm, destinationLocation: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Driver Name & Contact
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rajesh Kumar (+91...)"
                      value={issueForm.driverName}
                      onChange={e => setIssueForm({ ...issueForm, driverName: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Outward Waybill / Slip No.
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. WB-2026-9042"
                      value={issueForm.waybillNumber}
                      onChange={e => setIssueForm({ ...issueForm, waybillNumber: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                {/* Heavy Equipment Assignment (JCB, Loader, Excavator) */}
                <EquipmentUsedPicker
                  eligibleList={eligibleEquipment}
                  selectedList={issueEquipment}
                  onChange={setIssueEquipment}
                  isOpen={isIssueEqOpen}
                  onToggleOpen={() => setIsIssueEqOpen(!isIssueEqOpen)}
                  operationType="Loading"
                />

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsIssueModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || parseFloat(issueForm.quantity) > selectedProjectAvailableStock}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-black uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                  >
                    Confirm Dispatch
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* MODAL: RECONCILIATION / WASTAGE & AUTOMATED BALANCE ENGINE */}
      {
        isAdjustModalOpen && selectedYard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold border border-slate-200">
                    <Split size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">Record Wastage or Stock Reconciliation</h3>
                    <p className="text-xs text-slate-500">Record transit shrinkage, moisture loss, or physical audit adjustments</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleRecordAdjustment} className="p-6 space-y-4">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Project <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={adjustForm.projectId}
                      onChange={e => {
                        const pId = e.target.value;
                        const match = projects.find(p => p.projectId === pId || p.id === pId);
                        const projectMats = projectInventory.filter(p => p.projectId === pId);
                        setAdjustForm({
                          ...adjustForm,
                          projectId: pId,
                          projectName: match?.name || pId,
                          materialName: projectMats[0]?.materialName || adjustForm.materialName
                        });
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                    >
                      <option value="">Select Project</option>
                      {projects.map(p => (
                        <option key={p.projectId || p.id} value={p.projectId || p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Material (Matches Inward) <span className="text-rose-500">*</span>
                    </label>
                    {(() => {
                      const availableMats = Array.from(new Set([
                        ...(projectDetailData?.materials?.map(m => m.materialName) || []),
                        ...(projectInventory.filter(p => p.projectId === adjustForm.projectId).map(p => p.materialName) || [])
                      ].filter(Boolean)));

                      if (availableMats.length > 0) {
                        return (
                          <select
                            value={adjustForm.materialName}
                            onChange={e => {
                              const val = e.target.value;
                              const mObj = projectDetailData?.materials.find(m => m.materialName === val);
                              const inQty = mObj ? mObj.totalReceived : 0;
                              const outQty = mObj ? mObj.totalIssued : 0;
                              const lossQty = mObj ? (mObj.totalLoss + mObj.totalAdjustment) : 0;
                              const diff = parseFloat((inQty - outQty - lossQty).toFixed(2));
                              setAdjustForm({
                                ...adjustForm,
                                materialName: val,
                                unit: mObj?.unit || 'MT',
                                quantity: Math.abs(diff) > 0 ? String(Math.abs(diff)) : adjustForm.quantity,
                                adjustmentType: diff < 0 ? 'ADJUSTMENT' : 'LOSS',
                                reason: Math.abs(diff) > 0
                                  ? `Auto-reconciled gate balance variance: Verified Inward (${inQty} MT) vs Dispatched Outward (${outQty} MT)`
                                  : adjustForm.reason
                              });
                            }}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                          >
                            <option value="">Select Inward Material</option>
                            {availableMats.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        );
                      }

                      return (
                        <input
                          type="text"
                          required
                          placeholder="e.g. Track Ballast 40mm"
                          value={adjustForm.materialName}
                          onChange={e => setAdjustForm({ ...adjustForm, materialName: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                        />
                      );
                    })()}
                  </div>
                </div>

                {/* Live Inward vs Outward Auto-Calculation Box */}
                {(() => {
                  const currentMatObj = projectDetailData?.materials.find(m => m.materialName === adjustForm.materialName);
                  const inward = currentMatObj ? currentMatObj.totalReceived : (projectDetailData?.metrics.totalReceived || 0);
                  const outward = currentMatObj ? currentMatObj.totalIssued : (projectDetailData?.metrics.totalIssued || 0);
                  const loss = currentMatObj ? (currentMatObj.totalLoss + currentMatObj.totalAdjustment) : (projectDetailData?.metrics.totalLoss || 0);
                  const netVar = parseFloat((inward - outward - loss).toFixed(2));
                  const isDeficit = netVar < 0;

                  return (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5 text-slate-800">
                          <Calculator size={14} className="text-[#00705a]" />
                          <span>Calculated Stock Balance (Real-Time)</span>
                        </span>
                        <span>Unit: {adjustForm.unit || 'MT'}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Inward Gate</span>
                          <strong className="text-slate-900 font-bold">{inward.toLocaleString()} MT</strong>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Outward Dispatched</span>
                          <strong className="text-slate-900 font-bold">{outward.toLocaleString()} MT</strong>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Net Variance</span>
                          <strong className={`font-bold ${isDeficit ? 'text-rose-600' : 'text-slate-900'}`}>
                            {netVar.toLocaleString()} MT
                          </strong>
                        </div>
                      </div>

                      {Math.abs(netVar) > 0 && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-slate-600">
                            {isDeficit ? 'Dispatches exceed receipts by' : 'Surplus ground stock:'} <strong>{Math.abs(netVar).toLocaleString()} MT</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustForm(prev => ({
                                ...prev,
                                quantity: String(Math.abs(netVar)),
                                adjustmentType: isDeficit ? 'ADJUSTMENT' : 'LOSS',
                                reason: `Auto-reconciled gate balance variance: Verified Inward (${inward} MT) vs Dispatched Outward (${outward} MT)`
                              }));
                            }}
                            className="text-[11px] font-bold text-[#00705a] hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <span>Auto-Fill {Math.abs(netVar).toLocaleString()} MT</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Adjustment Type
                    </label>
                    <select
                      value={adjustForm.adjustmentType}
                      onChange={e => setAdjustForm({ ...adjustForm, adjustmentType: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                    >
                      <option value="LOSS">Handling / Transit Moisture Loss (Deduction)</option>
                      <option value="ADJUSTMENT">Stock Audit Correction (True-Up Adjustment)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Quantity (MT) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 1.85"
                      value={adjustForm.quantity}
                      onChange={e => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Mandatory Audit Reason / Explanation <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="e.g. Weighbridge scale discrepancy & moisture shrinkage verified on arrival"
                    value={adjustForm.reason}
                    onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00705a] focus:bg-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAdjustModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[#00705a] hover:bg-[#005c4a] rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    Record Adjustment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* ============================================================== */}
      {/* MODAL: FAST TARE WEIGHBRIDGE SCALE & GATE-OUT                  */}
      {/* ============================================================== */}
      {
        isFastTareModalOpen && fastTareTruck && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
                    <Scale size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Weighbridge Gate-Out & Tare Check
                    </h3>
                    <p className="text-xs text-slate-400">
                      Scale 02 Confirmation for {fastTareTruck.vehicleNumber}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsFastTareModalOpen(false);
                    setFastTareTruck(null);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleFastTareSubmit} className="space-y-4">
                {/* Truck Info Card */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-500">Vehicle / Pilot:</span>
                    <span className="text-slate-900 font-black">{fastTareTruck.vehicleNumber} ({fastTareTruck.driverName || 'Driver'})</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-500">Project & Cargo:</span>
                    <span className="text-slate-900">{fastTareTruck.projectName} • {fastTareTruck.materialName}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-500">Inward Gross Scale:</span>
                    <span className="text-emerald-700 font-black text-sm">{fastTareTruck.grossWeight || '—'} MT</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-500">Arrival Gate In-Time:</span>
                    <span className="text-slate-700">
                      {new Date(fastTareTruck.gateInTime || fastTareTruck.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Tare Input & Live Net Calculation */}
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Confirmed Tare Weight (MT) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 14.50"
                    value={fastTareWeight}
                    onChange={e => setFastTareWeight(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-black text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                {/* Live Net Weight Computation Box */}
                {(() => {
                  const gross = parseFloat(String(fastTareTruck.grossWeight || 0));
                  const tare = parseFloat(fastTareWeight) || 0;
                  const net = gross > 0 && tare > 0 && gross > tare ? (gross - tare).toFixed(2) : '0.00';

                  return (
                    <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                          Net Delivered Payload
                        </span>
                        <span className="text-2xl font-black text-[#00705a]">
                          {net} <span className="text-xs font-bold">MT</span>
                        </span>
                      </div>
                      <div className="text-right text-[11px] text-emerald-800 font-bold">
                        <div>G: {gross} MT</div>
                        <div>T: {tare} MT</div>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Scale Operator Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tare verified without fuel replenishment, gate pass signed"
                    value={fastTareRemarks}
                    onChange={e => setFastTareRemarks(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsFastTareModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
                  >
                    <CheckCircle2 size={16} />
                    <span>Confirm Tare & Clear Gate-Out</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* ============================================================== */}
      {/* MODAL: DIGITAL TWIN NODE TELEMETRY INSPECTOR                   */}
      {/* ============================================================== */}
      {
        selectedDigitalTwinNode && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                    <Box size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Storage Node Telemetry
                    </h3>
                    <p className="text-xs text-slate-400">
                      {selectedDigitalTwinNode.rackCode} • {selectedDigitalTwinNode.rackName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDigitalTwinNode(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Location Type</span>
                    <strong className="text-sm font-black text-slate-900">{selectedDigitalTwinNode.locationType}</strong>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Total Capacity</span>
                    <strong className="text-sm font-black text-slate-900">{selectedDigitalTwinNode.capacityTons.toLocaleString()} MT</strong>
                  </div>
                </div>

                {/* Stored Inventory Breakdown */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                    Materials Currently Stored in this Node
                  </h4>
                  {(() => {
                    const items = rackInventory.filter(
                      r => r.rackName.toLowerCase() === selectedDigitalTwinNode.rackName.toLowerCase() || r.rackCode === selectedDigitalTwinNode.rackCode
                    );

                    if (items.length === 0) {
                      return (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                          This storage location currently has 0 MT stored (100% free capacity).
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {items.map((it, idx) => (
                          <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-black text-slate-900">{it.materialName}</div>
                              <div className="text-[10px] text-slate-400">{it.projectName}</div>
                            </div>
                            <div className="text-right font-black text-[#00705a]">
                              {it.currentAvailable.toLocaleString()} {it.unit || 'MT'}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      const nodeName = selectedDigitalTwinNode.rackName;
                      setSelectedDigitalTwinNode(null);
                      handleOpenShiftModal(undefined, nodeName);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeftRight size={14} />
                    <span>Shift From Here</span>
                  </button>

                  <button
                    onClick={() => {
                      const nodeName = selectedDigitalTwinNode.rackName;
                      const nodeId = selectedDigitalTwinNode.id;
                      setSelectedDigitalTwinNode(null);
                      setStockAddForm(prev => ({
                        ...prev,
                        rackId: String(nodeId),
                        rackName: nodeName
                      }));
                      setViewMode('deep-stock-add');
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    <ArrowDownLeft size={14} />
                    <span>Inward Stock Here</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* MODAL: LOG STANDALONE EQUIPMENT ACTIVITY */}
      {isLogEqModalOpen && selectedYard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Wrench size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">Log Heavy Equipment Activity</h3>
                  <p className="text-xs text-slate-500">Record machine runtime and material handling in {selectedYard.yardName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsLogEqModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveManualEquipmentLog} className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl animate-shake">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Machine Selection */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Select Heavy Machinery <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={logEqForm.equipmentNumber}
                  onChange={e => {
                    const val = e.target.value;
                    const match = eligibleEquipment.find(eq => eq.equipmentNumber === val || eq.equipmentId === val);
                    setLogEqForm({
                      ...logEqForm,
                      equipmentNumber: val,
                      operatorName: match?.assignedOperatorName || logEqForm.operatorName,
                      operatorPhone: match?.assignedOperatorPhone || logEqForm.operatorPhone
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                >
                  <option value="">Choose Machine (JCB, Loader, Excavator, Forklift)...</option>
                  {eligibleEquipment.map(eq => (
                    <option
                      key={eq.id}
                      value={eq.equipmentNumber}
                      disabled={eq.status === 'Under Maintenance'}
                    >
                      {eq.equipmentNumber} — {eq.equipmentType} {eq.make ? `(${eq.make} ${eq.model || ''})` : ''} [{eq.status}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Operation & Project */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Operation Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={logEqForm.operationType}
                    onChange={e => setLogEqForm({ ...logEqForm, operationType: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="UNLOADING">Material Unloading</option>
                    <option value="LOADING">Material Loading</option>
                    <option value="INTERNAL_SHIFT">Internal Rack Shifting</option>
                    <option value="OTHER">Other Yard Handling</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Project
                  </label>
                  <select
                    value={logEqForm.projectId}
                    onChange={e => {
                      const pId = e.target.value;
                      const match = projects.find(p => p.projectId === pId || p.id === pId);
                      setLogEqForm({
                        ...logEqForm,
                        projectId: pId,
                        projectName: match?.name || pId
                      });
                    }}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="">General / No Project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.projectId || p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Material & Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Material Handled
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Track Ballast 40mm"
                    value={logEqForm.materialName}
                    onChange={e => setLogEqForm({ ...logEqForm, materialName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Quantity (MT)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="20.0"
                    value={logEqForm.quantity}
                    onChange={e => setLogEqForm({ ...logEqForm, quantity: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Source Location / Rack
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Siding Bay A1"
                    value={logEqForm.sourceRackName}
                    onChange={e => setLogEqForm({ ...logEqForm, sourceRackName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Destination Bay / Vehicle
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Outward Road Tipper"
                    value={logEqForm.destinationRackName}
                    onChange={e => setLogEqForm({ ...logEqForm, destinationRackName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Timestamps & Auto Duration */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={logEqForm.startTime}
                    onChange={e => {
                      const s = e.target.value;
                      const sT = new Date(s).getTime();
                      const eT = new Date(logEqForm.endTime).getTime();
                      let dur = logEqForm.durationHours;
                      if (!isNaN(sT) && !isNaN(eT) && eT > sT) {
                        dur = String(parseFloat(((eT - sT) / 3600000).toFixed(2)));
                      }
                      setLogEqForm({ ...logEqForm, startTime: s, durationHours: dur });
                    }}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={logEqForm.endTime}
                    onChange={e => {
                      const end = e.target.value;
                      const sT = new Date(logEqForm.startTime).getTime();
                      const eT = new Date(end).getTime();
                      let dur = logEqForm.durationHours;
                      if (!isNaN(sT) && !isNaN(eT) && eT > sT) {
                        dur = String(parseFloat(((eT - sT) / 3600000).toFixed(2)));
                      }
                      setLogEqForm({ ...logEqForm, endTime: end, durationHours: dur });
                    }}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Operating Hours
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={logEqForm.durationHours}
                    onChange={e => setLogEqForm({ ...logEqForm, durationHours: e.target.value })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-emerald-800"
                  />
                </div>
              </div>

              {/* Operator Name & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Operator / Driver Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Yadav"
                    value={logEqForm.operatorName}
                    onChange={e => setLogEqForm({ ...logEqForm, operatorName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Operator Phone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98112 33445"
                    value={logEqForm.operatorPhone}
                    onChange={e => setLogEqForm({ ...logEqForm, operatorPhone: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Activity Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Stockpile reshaping and apron leveling"
                  value={logEqForm.remarks}
                  onChange={e => setLogEqForm({ ...logEqForm, remarks: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLogEqModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-black uppercase tracking-wider text-white bg-[#00705a] hover:bg-[#005a48] rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Logging...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Confirm Log Activity</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEDICATED RECEIVE VEHICLE & RAIL WAGON MODAL */}
      {isReceiveVehicleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-[#03261f] text-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-2xl border border-white/10 text-emerald-300">
                  {receiveVehicleForm.transportMode === 'RAIL_RAKE' ? <Train size={24} /> : <Truck size={24} />}
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
                    <span>Receive Vehicle & Rail Wagon (Weighbridge Inward)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Live Gate Entry
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Log vehicle/wagon weighment, stock addition, and real-time project balance calculation
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReceiveVehicleModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitReceiveVehicle} className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Carrier Mode Selection */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  1. Transport Mode & Carrier Class
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setReceiveVehicleMode('TRUCK');
                      setReceiveVehicleForm(prev => ({
                        ...prev,
                        transportMode: 'TRUCK',
                        vehicleNumber: DEFAULT_ROAD_VEHICLES[0].vehicleNumber,
                        vehicleType: DEFAULT_ROAD_VEHICLES[0].vehicleType,
                        driverName: DEFAULT_ROAD_VEHICLES[0].driverName,
                        driverPhone: DEFAULT_ROAD_VEHICLES[0].driverPhone,
                        grossWeight: '52.40',
                        tareWeight: '17.20',
                        netWeight: '35.20'
                      }));
                    }}
                    className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer ${
                      receiveVehicleForm.transportMode === 'TRUCK'
                        ? 'border-[#00705a] bg-emerald-50/60 ring-2 ring-[#00705a]/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${receiveVehicleForm.transportMode === 'TRUCK' ? 'bg-[#00705a] text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Truck size={20} />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-black text-slate-900">Road Haulage Vehicle</div>
                      <div className="text-[11px] text-slate-500 font-medium">Commercial Tippers, Dumpers & Trailers (25T - 40T)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReceiveVehicleMode('RAIL_RAKE');
                      setReceiveVehicleForm(prev => ({
                        ...prev,
                        transportMode: 'RAIL_RAKE',
                        vehicleNumber: DEFAULT_RAIL_WAGONS[0].vehicleNumber,
                        vehicleType: DEFAULT_RAIL_WAGONS[0].vehicleType,
                        driverName: DEFAULT_RAIL_WAGONS[0].driverName,
                        driverPhone: DEFAULT_RAIL_WAGONS[0].driverPhone,
                        grossWeight: '88.50',
                        tareWeight: '27.50',
                        netWeight: '61.00'
                      }));
                    }}
                    className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer ${
                      receiveVehicleForm.transportMode === 'RAIL_RAKE'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${receiveVehicleForm.transportMode === 'RAIL_RAKE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Train size={20} />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-black text-slate-900">Railway Freight Wagon / Rake</div>
                      <div className="text-[11px] text-slate-500 font-medium">BOXN, BOXNHL & BCNHL Siding Wagons (55T - 65T)</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Quick Fleet Vehicle / Wagon Selector */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      2. Select Assigned {receiveVehicleForm.transportMode === 'RAIL_RAKE' ? 'Rail Wagon' : 'Fleet Vehicle'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">(or enter custom registration below)</span>
                  </div>

                  <div className="relative sm:w-56">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search roster..."
                      value={receiveVehicleSearch}
                      onChange={e => setReceiveVehicleSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Available vehicles chips/grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-40 overflow-y-auto pr-1">
                  {(receiveVehicleForm.transportMode === 'RAIL_RAKE'
                    ? DEFAULT_RAIL_WAGONS
                    : [
                        ...(availableVehicles.length > 0
                          ? availableVehicles.map(v => ({
                              vehicleNumber: v.vehicleNumber,
                              vehicleType: v.vehicleType || `${v.make || 'Fleet'} Tipper`,
                              payloadCapacity: parseFloat(String(v.payloadCapacity || v.capacity || 35)),
                              driverName: v.driverName || 'Designated Driver',
                              driverPhone: v.driverPhone || '+91 94370 00000'
                            }))
                          : []),
                        ...DEFAULT_ROAD_VEHICLES
                      ]
                  )
                    .filter(v => {
                      const q = receiveVehicleSearch.toLowerCase();
                      return !q || v.vehicleNumber.toLowerCase().includes(q) || v.vehicleType.toLowerCase().includes(q) || (v.driverName || '').toLowerCase().includes(q);
                    })
                    .slice(0, 9)
                    .map((item, idx) => {
                      const isSelected = receiveVehicleForm.vehicleNumber.toUpperCase() === item.vehicleNumber.toUpperCase();
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            const estTare = receiveVehicleForm.transportMode === 'RAIL_RAKE' ? 27.5 : 17.2;
                            const estNet = item.payloadCapacity || (receiveVehicleForm.transportMode === 'RAIL_RAKE' ? 61.0 : 35.2);
                            const estGross = parseFloat((estTare + estNet).toFixed(2));
                            setReceiveVehicleForm(prev => ({
                              ...prev,
                              vehicleNumber: item.vehicleNumber,
                              vehicleType: item.vehicleType,
                              driverName: item.driverName || prev.driverName,
                              driverPhone: item.driverPhone || prev.driverPhone,
                              grossWeight: String(estGross),
                              tareWeight: String(estTare),
                              netWeight: String(estNet)
                            }));
                          }}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-1.5 ${
                            isSelected
                              ? 'bg-emerald-50 border-[#00705a] ring-2 ring-[#00705a]/20 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="font-mono font-black text-slate-900 tracking-wider text-[11px] flex items-center gap-1">
                              {receiveVehicleForm.transportMode === 'RAIL_RAKE' ? <Train size={11} className="text-indigo-600" /> : <Truck size={11} className="text-[#00705a]" />}
                              <span>{item.vehicleNumber}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{item.vehicleType}</div>
                            {item.driverName && (
                              <div className="text-[9px] text-slate-400 mt-0.5 truncate">Pilot: {item.driverName}</div>
                            )}
                          </div>
                          <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                            ~{item.payloadCapacity}T
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Form Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Vehicle Number & Type */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    {receiveVehicleForm.transportMode === 'RAIL_RAKE' ? 'Wagon No. / Rake ID' : 'Vehicle Plate No.'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={receiveVehicleForm.transportMode === 'RAIL_RAKE' ? 'e.g. BOXN-94102' : 'e.g. OD-05-BB-8921'}
                    value={receiveVehicleForm.vehicleNumber}
                    onChange={e => setReceiveVehicleForm({ ...receiveVehicleForm, vehicleNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-900 tracking-wider"
                  />
                </div>

                {/* Storage Rack Bay */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Designated Storage Rack / Stack <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={receiveVehicleForm.rackName}
                    onChange={e => {
                      const match = racks.find(r => r.rackName === e.target.value);
                      setReceiveVehicleForm({
                        ...receiveVehicleForm,
                        rackName: e.target.value,
                        rackId: match ? String(match.id) : ''
                      });
                    }}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="">Select Rack / Bay</option>
                    {racks.map(r => (
                      <option key={r.id} value={r.rackName}>
                        {r.rackName} ({r.rackCode}) — Cap: {r.capacityTons || 10000} MT
                      </option>
                    ))}
                  </select>
                </div>

                {/* Driver / Loco Pilot & Contact */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Driver / Loco Pilot Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Kumar Swain"
                    value={receiveVehicleForm.driverName}
                    onChange={e => setReceiveVehicleForm({ ...receiveVehicleForm, driverName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Driver Phone Contact
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 94371 88921"
                    value={receiveVehicleForm.driverPhone}
                    onChange={e => setReceiveVehicleForm({ ...receiveVehicleForm, driverPhone: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                {/* Project Allocation */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Target Project Allocation <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={receiveVehicleForm.projectId}
                    onChange={e => {
                      const pId = e.target.value;
                      const match = projects.find(p => p.projectId === pId || p.id === pId);
                      setReceiveVehicleForm({
                        ...receiveVehicleForm,
                        projectId: pId,
                        projectName: match?.name || pId,
                        materialName: match?.commodity || receiveVehicleForm.materialName
                      });
                    }}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.projectId || p.id}>
                        {p.name} ({p.projectId || p.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Commodity / Material */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Material / Commodity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Track Ballast 40mm (RDSO)"
                    value={receiveVehicleForm.materialName}
                    onChange={e => setReceiveVehicleForm({ ...receiveVehicleForm, materialName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                {/* Origin / Consignor */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Origin Pit / Siding Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rewa Quarry Pit Face 04"
                    value={receiveVehicleForm.sourceLocation}
                    onChange={e => setReceiveVehicleForm({ ...receiveVehicleForm, sourceLocation: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Consignor / Supplier Organization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. National Mineral Quarry Division"
                    value={receiveVehicleForm.supplierName}
                    onChange={e => setReceiveVehicleForm({ ...receiveVehicleForm, supplierName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Weighbridge Weights Section */}
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#00705a]">
                    <Scale size={16} />
                    <span>3. Weighbridge Measurements & Delivered Stock Calculation</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-800">
                    Slip: {receiveVehicleForm.weighbridgeSlipNumber}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                      Gross Weight (MT) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="e.g. 52.40"
                      value={receiveVehicleForm.grossWeight}
                      onChange={e => {
                        const g = parseFloat(e.target.value) || 0;
                        const t = parseFloat(receiveVehicleForm.tareWeight) || 0;
                        const net = g > t ? (g - t).toFixed(2) : '0.00';
                        setReceiveVehicleForm({ ...receiveVehicleForm, grossWeight: e.target.value, netWeight: net });
                      }}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                      Tare Weight (MT) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="e.g. 17.20"
                      value={receiveVehicleForm.tareWeight}
                      onChange={e => {
                        const t = parseFloat(e.target.value) || 0;
                        const g = parseFloat(receiveVehicleForm.grossWeight) || 0;
                        const net = g > t ? (g - t).toFixed(2) : '0.00';
                        setReceiveVehicleForm({ ...receiveVehicleForm, tareWeight: e.target.value, netWeight: net });
                      }}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-[#00705a] mb-1">
                      Net Stock Added (MT)
                    </label>
                    <div className="w-full px-3.5 py-2 bg-emerald-100/70 border border-emerald-300 rounded-xl text-xs font-black text-[#00705a] flex items-center justify-between">
                      <span>{receiveVehicleForm.netWeight || '0.00'} MT</span>
                      <span className="text-[10px] font-bold text-emerald-700">Auto Computed</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* LIVE PROJECT BALANCE COUNTDOWN PREVIEW */}
              {(() => {
                const thisDeliveryNet = parseFloat(receiveVehicleForm.netWeight) || 0;
                const newTotalReceived = parseFloat((totalReceiptsWeight + thisDeliveryNet).toFixed(2));
                const newRemainingBalance = Math.max(0, parseFloat((projectScopeWeight - newTotalReceived).toFixed(2)));
                const newProgressPct = projectScopeWeight > 0 ? Math.min(100, parseFloat(((newTotalReceived / projectScopeWeight) * 100).toFixed(1))) : 0;

                return (
                  <div className="p-4 bg-slate-900 rounded-2xl text-white space-y-3 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Calculator size={14} />
                        <span>Project Balance Impact Preview</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {receiveVehicleForm.projectName || selectedProjectId}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Total Project Target</span>
                        <span className="font-black text-white">{projectScopeWeight.toLocaleString()} MT</span>
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Previously Received</span>
                        <span className="font-black text-slate-300">{totalReceiptsWeight.toLocaleString()} MT</span>
                      </div>

                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5">
                        <span className="text-[10px] text-emerald-300 uppercase font-black block">+ This Vehicle / Wagon</span>
                        <span className="font-black text-emerald-400">+{thisDeliveryNet.toLocaleString()} MT</span>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5">
                        <span className="text-[10px] text-amber-300 uppercase font-black block">New Balance Remaining</span>
                        <span className="font-black text-amber-300">{newRemainingBalance.toLocaleString()} MT</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                        <span>Project Delivery Progress: <strong className="text-emerald-400">{newProgressPct}%</strong></span>
                        <span>{newRemainingBalance === 0 ? '100% Contract Fulfilled' : `${newRemainingBalance.toLocaleString()} MT Yet to Receive`}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                          style={{ width: `${newProgressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReceiveVehicleModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#00705a] to-[#008f73] hover:brightness-110 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Recording Weighment...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Confirm Receipt & Add Stock</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div >
  );
}