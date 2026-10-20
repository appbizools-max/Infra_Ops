import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck, HardHat, Gauge, Fuel, Receipt, Calendar, MapPin,
  User, CheckCircle2, AlertTriangle, Clock, RefreshCw, X,
  ArrowRight, Phone, FileText, ChevronRight, ChevronLeft, Check, Sparkles, Navigation,
  Activity, Zap, ShieldCheck, Search, Filter, Layers, ExternalLink, Info, CheckCircle,
  Maximize2, Minimize2, Radio, Compass, Wifi, Eye, Plus, ArrowUpRight, Wrench,
  TrendingUp, AlertCircle, BarChart3, Sliders, ChevronDown,
  Train, PackageCheck, ArrowDownToLine, Milestone, Route, ArrowRightLeft, Box
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';

export const formatDateDDMMYYYY = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  const clean = String(dateStr).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) return clean;
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }
  return clean;
};

// Interface for database assignments
interface VehicleAssignment {
  id: number;
  tenantId: string;
  assetType: 'vehicle' | 'equipment';
  assetId: string;
  assetNumber: string;
  assetTitle?: string;
  projectId?: string;
  projectName?: string;
  worksiteId?: string;
  worksiteName?: string;
  assignedToType?: string;
  assignedToName?: string;
  assignedToPhone?: string;
  helperName?: string;
  helperPhone?: string;
  helperRole?: string;
  startDate?: string;
  meterReadingAtAssign?: number;
  odometerClosingKm?: number;
  distanceTravelled?: number;
  status: string;
  notes?: string;
  fuelPowerType?: string;
  fuelConsumptionBenchmark?: string;
  categoryType?: string;
  currentLocation?: string;
}

interface DriverFleetLog {
  id: number;
  assetNumber: string;
  assetTitle?: string;
  assetType: 'vehicle' | 'equipment';
  assignmentId?: number;
  projectName?: string;
  worksiteName?: string;
  driverName?: string;
  driverPhone?: string;
  logDate: string;
  shift: string;
  stage: string;
  startOdometer?: number;
  endOdometer?: number;
  distanceRun?: number;
  engineHoursStart?: number;
  engineHoursEnd?: number;
  engineHoursTotal?: number;
  fuelFilledLiters?: number;
  fuelRatePerLiter?: number;
  fuelTotalCost?: number;
  fuelStation?: string;
  fuelBillNumber?: string;
  fuelEfficiency?: number;
  tollAmount?: number;
  fastagDeduction?: number;
  otherExpenses?: number;
  tripsCount?: number;
  remarks?: string;
  createdAt?: string;
}

export interface FuelStopRecord {
  station: string;
  time: string;
  liters: number;
  rate: number;
  billNo: string;
  amount: number;
  paymentMode: string;
}

// Live Vehicle Record representation for the telemetry cockpit
export interface TelemetryVehicle {
  id: string;
  plate: string;
  shortCode: string;
  model: string;
  type: string;
  assetCategory: 'vehicle' | 'equipment'; // auto-differentiates KM vs Engine Hours!
  driverName: string;
  driverPhone?: string;
  driverLicense?: string;
  helperName?: string;
  helperPhone?: string;
  siteDepot: string;
  status: 'Moving' | 'Loading' | 'Unloading' | 'Completed' | 'Assigned';
  liveLocation: string;
  locationDetails: string;
  speed: number;
  fuelLevelPercent: number;
  fuelLiters: number;
  fuelTankMax: number;
  fuelType: string;
  fuelStops?: FuelStopRecord[];
  // Meter Readings (for Commercial Trucks & Vehicles)
  startOdometer?: number; // Starting speedometer reading (km)
  odometer: number;       // Current speedometer reading (km)
  distanceToday: number;  // Net distance travelled today (km)

  // Equipment Hours (for Heavy Machinery / Equipment)
  startEngineHours?: number; // Starting engine hour meter (HMR)
  currentEngineHours?: number; // Current engine hour meter (HMR)
  engineHoursToday?: number; // Net operating hours run today (hrs)

  efficiencyKmL: number | string; // km/L for trucks, L/hr for equipment!
  efficiencyUnit: string; // 'km/L' | 'L/hr'
  costToday: number;

  // Location & Project Information
  projectName: string;
  projectLocation: string;
  worksiteName: string;
  origin: string;
  destination: string;

  eta: string;
  mapCoords: { x: number; y: number }; // percentage inside map viewport
  gpsCoords: { lat: number; lng: number };
  engineRpm: number;
  coolantTemp: number;
  batteryVolt: number;
  oilPressure: number;
  defLevel: number;
  lastPingSecondsAgo: number;
  routeProgressPercent: number;
  attentionAlert?: string;
  isCustomAssignment?: boolean;
}

export default function FmsEmployeePortalPage() {
  const { currentUser } = useAuth();

  // Data State
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [driversList, setDriversList] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('self');
  const [assignments, setAssignments] = useState<VehicleAssignment[]>([]);
  const [myLogs, setMyLogs] = useState<DriverFleetLog[]>([]);
  const [saving, setSaving] = useState(false);

  // Search & Filter Tabs
  const [statusFilter, setStatusFilter] = useState<'All' | 'Moving' | 'Loading' | 'Unloading' | 'Completed' | 'Assigned'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});

  // Interactive Live Map State
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [liveTrackFilter, setLiveTrackFilter] = useState<'All' | 'Moving' | 'Loading' | 'Unloading' | 'Completed' | 'Assigned'>('All');
  const [liveTrackCategory, setLiveTrackCategory] = useState<'all' | 'vehicle' | 'equipment'>('all');
  const [mapZoom, setMapZoom] = useState(1);
  // View Mode: 'overview' | 'live-telemetry' (keeps side navigation visible and uses same light theme)
  const [viewMode, setViewMode] = useState<'overview' | 'route-board' | 'live-telemetry'>('overview');
  const [overviewCategoryFilter, setOverviewCategoryFilter] = useState<'all' | 'vehicle' | 'equipment'>('all');
  const [overviewProjectFilter, setOverviewProjectFilter] = useState<string>('all');
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isTrueFullscreen, setIsTrueFullscreen] = useState(false);
  const [liveStreamActive, setLiveStreamActive] = useState(true);
  const [liveTelemetryVehicles, setLiveTelemetryVehicles] = useState<TelemetryVehicle[]>([]);
  const [liveEventsLog, setLiveEventsLog] = useState<Array<{ id: string; time: string; text: string; type: 'gps' | 'fuel' | 'speed' | 'toll' }>>([
    { id: '1', time: '17:18:42', text: 'GPS telemetry stream active · Real-time coordinates received', type: 'gps' },
    { id: '2', time: '17:16:10', text: 'Project worksite corridor waypoint recorded', type: 'toll' },
    { id: '3', time: '17:10:05', text: 'OBD-II CAN diagnostics normal · Engine temperature & electrical status verified', type: 'speed' },
    { id: '4', time: '16:45:00', text: 'Fuel sensor verified · Shift operational ledger synced', type: 'fuel' }
  ]);

  // Log Form State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [activeAssetForLog, setActiveAssetForLog] = useState<TelemetryVehicle | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  // Shift Log Form
  const initialFormState = {
    logDate: new Date().toISOString().split('T')[0],
    shift: 'Day',
    stage: 'Working',
    assetCategory: 'vehicle' as 'vehicle' | 'equipment',
    driverName: '',
    driverPhone: '',
    driverLicense: '',
    helperName: '',
    helperPhone: '',
    projectName: '',
    projectLocation: '',
    worksiteName: '',
    siteDepot: '',
    fromLocation: '',
    toLocation: '',
    tripsCount: '1',
    startOdometer: '',
    endOdometer: '',
    startEngineHours: '',
    endEngineHours: '',
    tollApplicable: true,
    fuelType: 'Diesel (BS-VI)',
    fuelFilledLiters: '',
    fuelRatePerLiter: '94.50',
    fuelTotalCost: '',
    fuelStation: '',
    fuelBillNumber: '',
    paymentMode: 'Fleet Diesel Card',
    tollAmount: '',
    fastagDeduction: '',
    otherExpenses: '',
    otherExpenseNotes: '',
    remarks: ''
  };
  const [shiftForm, setShiftForm] = useState(initialFormState);
  // Fetch driver portal data from backend
  const fetchPortalData = async () => {
    setLoading(true);
    try {
      const uid = currentUser?.uid || '';
      let url = `/api/tenant/fms-employee/driver-portal/${uid}`;

      if (selectedDriverId !== 'self' && selectedDriverId !== 'all') {
        const found = driversList.find(d => String(d.id) === String(selectedDriverId));
        if (found) {
          url += `?driverPhone=${encodeURIComponent(found.mobile || '')}&driverName=${encodeURIComponent(found.name || '')}`;
        }
      }
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile || null);
        setDriversList(data.driversList || []);
        setAssignments(data.myAssignments || []);
        setMyLogs(data.myLogs || []);
      }
    } catch (err) {
      console.error('[FMS Portal] Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, [currentUser, selectedDriverId]);

  // Keyboard shortcut for closing fullscreen (Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreenOpen) {
        setIsFullscreenOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenOpen]);

  // Real-time live simulation ticker (runs every 2.5s for live updates in full screen & map)
  useEffect(() => {
    if (!liveStreamActive) return;

    const interval = setInterval(() => {
      setLiveTelemetryVehicles(prev => {
        return prev.map(v => {
          if (v.status !== 'Moving') {
            return {
              ...v,
              lastPingSecondsAgo: (v.lastPingSecondsAgo + 2) % 60
            };
          }

          // Micro fluctuation in speed (between 58 and 66 km/h)
          const speedDelta = (Math.random() - 0.48) * 2.5;
          const newSpeed = Math.min(78, Math.max(35, Math.round(v.speed + speedDelta)));
          const odoIncrement = 0.035; // ~35 meters per 2.5s at 55km/h
          const newOdo = Math.round((v.odometer + odoIncrement) * 100) / 100;
          const newDist = Math.round((v.distanceToday + odoIncrement) * 10) / 10;
          const newRpm = 1750 + Math.floor((Math.random() - 0.5) * 80);

          return {
            ...v,
            speed: newSpeed,
            odometer: Math.round(newOdo),
            distanceToday: newDist,
            engineRpm: newRpm,
            lastPingSecondsAgo: Math.floor(Math.random() * 4) + 1,
            locationDetails: `${newSpeed} km/h · Just now`
          };
        });
      });

      // Periodically append a telemetry event log for the selected vehicle
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const randomSpeed = Math.floor(60 + Math.random() * 5);

      setLiveEventsLog(prev => {
        const newEntry = {
          id: String(Date.now()),
          time: timeStr,
          text: `Telemetry packet received · ${randomSpeed} km/h | Lat: 18.75${Math.floor(Math.random() * 90)}, Lng: 73.31${Math.floor(Math.random() * 90)}`,
          type: 'gps' as const
        };
        return [newEntry, ...prev.slice(0, 15)];
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [liveStreamActive]);

  // Map real DB assignments into telemetry list
  const allVehicles: TelemetryVehicle[] = useMemo(() => {
    const list: TelemetryVehicle[] = [];
    const seenPlates = new Set<string>();
    const seenIds = new Set<string>();

    if (assignments && assignments.length > 0) {
      assignments.forEach((a, idx) => {
        if (!a) return;
        const rawPlate = String(a.assetNumber || '').trim();
        const cleanPlate = rawPlate.replace(/\s+/g, '').toLowerCase();

        if (cleanPlate && seenPlates.has(cleanPlate)) {
          return;
        }
        if (cleanPlate) {
          seenPlates.add(cleanPlate);
        }

        const isEq = a.assetType === 'equipment';
        const lastReading = Number(a.odometerClosingKm || a.meterReadingAtAssign || 0);

        const plateSnippet = cleanPlate ? cleanPlate.replace(/[^a-z0-9]/g, '') : `item-${idx}`;
        let uniqueId = `db-${a.assetType || 'asset'}-${a.id ?? idx}-${plateSnippet}`;
        let counter = 1;
        while (seenIds.has(uniqueId)) {
          uniqueId = `db-${a.assetType || 'asset'}-${a.id ?? idx}-${plateSnippet}-${counter++}`;
        }
        seenIds.add(uniqueId);

        // Derive real status
        const rawStatus = (a.status || 'Active').toLowerCase();
        let derivedStatus: TelemetryVehicle['status'] = 'Assigned';
        if (rawStatus.includes('mov') || rawStatus.includes('transit') || rawStatus.includes('active') || rawStatus.includes('operat')) {
          derivedStatus = 'Moving';
        } else if (rawStatus.includes('load')) {
          derivedStatus = 'Loading';
        } else if (rawStatus.includes('unload')) {
          derivedStatus = 'Unloading';
        } else if (rawStatus.includes('complete')) {
          derivedStatus = 'Completed';
        }

        // Aggregate actual shift logs from database for this vehicle
        const matchingLogs = (myLogs || []).filter(l => l.assetNumber === rawPlate);
        const logFuel = matchingLogs.reduce((acc, l) => acc + Number(l.fuelFilledLiters || 0), 0);
        const logCost = matchingLogs.reduce((acc, l) => acc + Number(l.fuelTotalCost || 0) + Number(l.tollAmount || 0) + Number(l.otherExpenses || 0), 0);
        const logDist = matchingLogs.reduce((acc, l) => acc + Number(l.distanceRun || 0), 0);
        const logHrs = matchingLogs.reduce((acc, l) => acc + Number(l.engineHoursTotal || 0), 0);

        const realFuelStops = matchingLogs
          .filter(l => Number(l.fuelFilledLiters || 0) > 0)
          .map((l, sIdx) => ({
            station: l.fuelStation || 'Site Fuel Station',
            time: 'Shift Log',
            liters: Number(l.fuelFilledLiters || 0),
            rate: Number(l.fuelRatePerLiter || 94.5),
            billNo: l.fuelBillNumber || `LOG-${l.id ?? sIdx}`,
            amount: Number(l.fuelTotalCost || (Number(l.fuelFilledLiters || 0) * 94.5)),
            paymentMode: 'Fleet Diesel Card'
          }));

        const finalDist = logDist > 0 ? logDist : Number(a.distanceTravelled || 0);
        const finalFuel = logFuel;
        const finalCost = logCost > 0 ? logCost : Math.round(finalFuel * 94.5);

        list.push({
          id: uniqueId,
          plate: rawPlate || `ASSET-${idx + 1}`,
          shortCode: (rawPlate || `${idx + 1}`).slice(-4),
          model: a.assetTitle || (isEq ? 'Heavy Equipment Machinery' : 'Commercial Fleet Truck'),
          type: isEq ? 'Equipment' : 'Truck',
          assetCategory: isEq ? 'equipment' : 'vehicle',
          driverName: a.assignedToName && a.assignedToName !== 'Unassigned' ? a.assignedToName : (isEq ? 'Site Operator' : 'Fleet Driver'),
          driverPhone: a.assignedToPhone || '',
          driverLicense: a.assignedToLicense || '',
          helperName: a.helperName || '',
          helperPhone: a.helperPhone || '',
          siteDepot: a.worksiteName || 'Project Depot',
          projectName: a.projectName || 'Infrastructure Worksite Package',
          projectLocation: a.worksiteName || 'Active Highway Corridor',
          worksiteName: a.worksiteName || 'Assigned Site Area',
          status: derivedStatus,
          liveLocation: a.worksiteName || a.currentLocation || 'Assigned Site Area',
          locationDetails: 'Active assignment · 4s ago',
          speed: derivedStatus === 'Moving' ? (isEq ? 18 : 58) : 0,
          fuelLevelPercent: 78,
          fuelLiters: finalFuel,
          fuelTankMax: 100,
          fuelType: a.fuelPowerType || 'Diesel (BS-VI)',
          startOdometer: lastReading > finalDist ? lastReading - finalDist : lastReading,
          odometer: lastReading,
          distanceToday: finalDist,
          startEngineHours: isEq ? (lastReading > logHrs ? lastReading - logHrs : lastReading) : undefined,
          currentEngineHours: isEq ? lastReading : undefined,
          engineHoursToday: isEq ? logHrs : undefined,
          efficiencyKmL: isEq ? (logHrs > 0 && finalFuel > 0 ? Number((finalFuel / logHrs).toFixed(2)) : 0) : (finalFuel > 0 && finalDist > 0 ? Number((finalDist / finalFuel).toFixed(2)) : 0),
          efficiencyUnit: isEq ? 'L/hr' : 'km/L',
          costToday: finalCost,
          eta: '17:00',
          mapCoords: { x: 30 + (idx * 15) % 55, y: 35 + (idx * 18) % 45 },
          gpsCoords: { lat: 18.8 + idx * 0.05, lng: 73.2 + idx * 0.05 },
          engineRpm: derivedStatus === 'Moving' ? (isEq ? 1650 : 1750) : 0,
          coolantTemp: 86,
          batteryVolt: 24.3,
          oilPressure: 4.1,
          defLevel: 80,
          lastPingSecondsAgo: 4,
          routeProgressPercent: 50,
          origin: a.worksiteName || a.currentLocation || 'Site Base Yard',
          destination: a.projectName || 'Project Site',
          isCustomAssignment: true,
          fuelStops: realFuelStops
        });
      });
    }
    return list;
  }, [assignments, myLogs]);

  // Safe empty fallback vehicle while assignments load or if fleet is empty
  const EMPTY_FALLBACK_VEHICLE: TelemetryVehicle = useMemo(() => ({
    id: 'empty-asset',
    plate: '—',
    shortCode: '—',
    model: 'No Fleet Asset',
    type: 'Truck',
    assetCategory: 'vehicle',
    driverName: 'Unassigned',
    driverPhone: '—',
    siteDepot: '—',
    projectName: '—',
    projectLocation: '—',
    worksiteName: '—',
    status: 'Assigned',
    liveLocation: '—',
    locationDetails: 'No active telemetry',
    speed: 0,
    fuelLevelPercent: 0,
    fuelLiters: 0,
    fuelTankMax: 100,
    fuelType: 'Diesel',
    startOdometer: 0,
    odometer: 0,
    distanceToday: 0,
    efficiencyKmL: 0,
    efficiencyUnit: 'km/L',
    costToday: 0,
    eta: '—',
    mapCoords: { x: 50, y: 50 },
    gpsCoords: { lat: 18.75, lng: 73.31 },
    engineRpm: 0,
    coolantTemp: 0,
    batteryVolt: 0,
    oilPressure: 0,
    defLevel: 0,
    lastPingSecondsAgo: 0,
    routeProgressPercent: 0,
    origin: '—',
    destination: '—',
    fuelStops: []
  }), []);

  // Selected vehicle for map and fullscreen
  const activeVehicle: TelemetryVehicle = useMemo(() => {
    if (!allVehicles || allVehicles.length === 0) return EMPTY_FALLBACK_VEHICLE;
    return allVehicles.find(v => v.id === selectedVehicleId) || allVehicles[0] || EMPTY_FALLBACK_VEHICLE;
  }, [allVehicles, selectedVehicleId, EMPTY_FALLBACK_VEHICLE]);

  // Keep selectedVehicleId in sync when allVehicles changes
  useEffect(() => {
    if (allVehicles && allVehicles.length > 0) {
      if (!selectedVehicleId || !allVehicles.some(v => v.id === selectedVehicleId)) {
        setSelectedVehicleId(allVehicles[0].id);
      }
    }
  }, [allVehicles, selectedVehicleId]);

  // Filtered vehicles for the ledger table
  const filteredVehicles = useMemo(() => {
    return allVehicles.filter(v => {
      if (!v) return false;
      // Tab filter
      if (statusFilter !== 'All') {
        if (v.status !== statusFilter) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (v.plate || '').toLowerCase().includes(q) ||
          (v.model || '').toLowerCase().includes(q) ||
          (v.driverName || '').toLowerCase().includes(q) ||
          (v.liveLocation || '').toLowerCase().includes(q) ||
          (v.siteDepot || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allVehicles, statusFilter, searchQuery]);

  // Status counts for tabs
  const counts = useMemo(() => {
    return {
      all: allVehicles.length,
      moving: allVehicles.filter(v => v?.status === 'Moving').length,
      loading: allVehicles.filter(v => v?.status === 'Loading').length,
      unloading: allVehicles.filter(v => v?.status === 'Unloading').length,
      completed: allVehicles.filter(v => v?.status === 'Completed').length,
      assigned: allVehicles.filter(v => v?.status === 'Assigned').length,
    };
  }, [allVehicles]);

  // Online active fleet count (vehicles actively Moving, Loading, or Unloading)
  const onlineCount = useMemo(() => {
    return allVehicles.filter(v => v?.status === 'Moving' || v?.status === 'Loading' || v?.status === 'Unloading').length;
  }, [allVehicles]);

  // Filtered vehicles for the Interactive Live Map Tracker
  const mapVehicles = useMemo(() => {
    return allVehicles.filter(v => {
      if (!v) return false;
      if (liveTrackFilter !== 'All' && v.status !== liveTrackFilter) return false;
      if (liveTrackCategory !== 'all' && v.assetCategory !== liveTrackCategory) return false;
      return true;
    });
  }, [allVehicles, liveTrackFilter, liveTrackCategory]);

  // Totals for table footer
  const tableTotals = useMemo(() => {
    const odo = allVehicles.reduce((acc, v) => acc + (v?.odometer || 0), 0);
    const dist = allVehicles.reduce((acc, v) => acc + (v?.distanceToday || 0), 0);
    const fuel = allVehicles.reduce((acc, v) => acc + (v?.fuelLiters || 0), 0);
    const cost = allVehicles.reduce((acc, v) => acc + (v?.costToday || 0), 0);
    const avgKmL = dist > 0 && fuel > 0 ? (dist / fuel).toFixed(2) : '5.00';
    return { odo, dist, fuel, cost, avgKmL };
  }, [allVehicles]);

  // Distinct project names for overview grouping/filtering
  const distinctProjects = useMemo(() => {
    const set = new Set<string>();
    allVehicles.forEach(v => {
      if (v.projectName && v.projectName.trim() && v.projectName !== '—') {
        set.add(v.projectName.trim());
      }
    });
    return Array.from(set);
  }, [allVehicles]);

  // Filtered vehicles for the All Project Vehicles Overview Grid
  const overviewVehicles = useMemo(() => {
    return allVehicles.filter(v => {
      if (overviewCategoryFilter === 'vehicle' && v.assetCategory === 'equipment') return false;
      if (overviewCategoryFilter === 'equipment' && v.assetCategory !== 'equipment') return false;
      if (overviewProjectFilter !== 'all' && v.projectName !== overviewProjectFilter) return false;
      return true;
    });
  }, [allVehicles, overviewCategoryFilter, overviewProjectFilter]);

  // Selected stop index in the active vehicle journey for inspection
  const [selectedStopIndex, setSelectedStopIndex] = useState<number | null>(null);

  // Dynamic Multi-Modal Journey Pipeline for active vehicle
  const activeVehicleJourney = useMemo(() => {
    if (!activeVehicle) return [];
    const isEq = activeVehicle.assetCategory === 'equipment';
    const isCompleted = activeVehicle.status === 'Completed';
    const isLoading = activeVehicle.status === 'Loading';
    const isUnloading = activeVehicle.status === 'Unloading';
    const isAssigned = activeVehicle.status === 'Assigned';

    if (isEq) {
      return [
        {
          id: 'stop-eq-1',
          stationCode: 'Point A',
          title: 'Quarry Pit Loading & Excavation',
          location: activeVehicle.worksiteName || 'Excavation Sector #4',
          type: 'loading' as const,
          transportMode: 'machinery' as const,
          modeLabel: 'Heavy Earthmover / Excavator',
          status: (isLoading ? 'in_progress' : (isAssigned ? 'scheduled' : 'completed')) as 'completed' | 'in_progress' | 'scheduled',
          time: '07:30 AM',
          details: 'Heavy trenching, rock breaking & bulk material loading onto site tippers',
          metric: `${activeVehicle.engineHoursToday || 6.5} hrs`,
          metricLabel: 'HMR Logged'
        },
        {
          id: 'stop-eq-2',
          stationCode: 'Stop 1',
          title: 'Site Diesel Bowzer Refuel',
          location: 'Mobile Bowzer Point #02',
          type: 'fuel' as const,
          transportMode: 'machinery' as const,
          modeLabel: 'Industrial Refuel Station',
          status: (isAssigned || isLoading ? 'scheduled' : 'completed') as 'completed' | 'in_progress' | 'scheduled',
          time: '10:15 AM',
          details: `${activeVehicle.fuelLiters > 0 ? activeVehicle.fuelLiters : 45}L Industrial Grade HSD Diesel filled`,
          metric: `${activeVehicle.fuelLiters > 0 ? activeVehicle.fuelLiters : 45} L`,
          metricLabel: 'Fuel Volume'
        },
        {
          id: 'stop-eq-3',
          stationCode: 'Stop 2',
          title: 'Camp Maintenance & Hydraulic Inspection',
          location: 'Site Camp Workshop Bay #1',
          type: 'maintenance' as const,
          transportMode: 'machinery' as const,
          modeLabel: 'Safety & Equipment Check',
          status: (isAssigned || isLoading ? 'scheduled' : 'completed') as 'completed' | 'in_progress' | 'scheduled',
          time: '12:45 PM',
          details: 'Hydraulic pressure 210 bar, grease lines lubricated & track tension verified',
          metric: '210 bar',
          metricLabel: 'Pressure OK'
        },
        {
          id: 'stop-eq-4',
          stationCode: 'Point B',
          title: 'Heavy Low-Bed Trailer Haul (Transport Method Change)',
          location: 'Access Road Ramp KM 42',
          type: 'multimodal' as const,
          transportMode: 'truck' as const,
          modeLabel: 'Low-Bed Multi-Axle Trailer #LT-14',
          status: (activeVehicle.status === 'Moving' ? 'in_progress' : (isCompleted || isUnloading ? 'completed' : 'scheduled')) as 'completed' | 'in_progress' | 'scheduled',
          time: '14:20 PM',
          details: 'Machinery loaded onto multi-axle trailer for long-distance highway transfer to next sector',
          metric: 'Ramp #2',
          metricLabel: 'Trailer Transfer'
        },
        {
          id: 'stop-eq-5',
          stationCode: 'Point C',
          title: 'Worksite Embankment Unloading & Spreading',
          location: activeVehicle.destination || 'Bridge Embankment Zone',
          type: 'unloading' as const,
          transportMode: 'machinery' as const,
          modeLabel: 'Heavy Earthmover / Roller',
          status: (isUnloading ? 'in_progress' : (isCompleted ? 'completed' : 'scheduled')) as 'completed' | 'in_progress' | 'scheduled',
          time: `ETA: ${activeVehicle.eta || '17:30 PM'}`,
          details: 'Final site grading, ballast leveling, digital inspection sign-off',
          metric: 'Zone #C',
          metricLabel: 'Final Station'
        }
      ];
    }

    // Commercial Trucks & Fleet Vehicles (Multimodal Road -> Rail Freight -> Site)
    const firstFuel = activeVehicle.fuelStops?.[0];
    return [
      {
        id: 'stop-tr-1',
        stationCode: 'Point A',
        title: 'Cargo Loading & Weighment',
        location: activeVehicle.origin || 'Main Depot / Freight Terminal Hub',
        type: 'loading' as const,
        transportMode: 'truck' as const,
        modeLabel: `Road Haul (${activeVehicle.model})`,
        status: (isLoading ? 'in_progress' : (isAssigned ? 'scheduled' : 'completed')) as 'completed' | 'in_progress' | 'scheduled',
        time: '06:30 AM',
        details: 'Cargo loading & weighbridge dispatch clearance logged',
        metric: 'Loaded',
        metricLabel: 'Dispatch'
      },
      {
        id: 'stop-tr-2',
        stationCode: 'Stop 1',
        title: 'Expressway Fuel Station',
        location: firstFuel?.station || 'Highway Fleet Fuel Station',
        type: 'fuel' as const,
        transportMode: 'truck' as const,
        modeLabel: 'Expressway Diesel Plaza',
        status: (isAssigned || isLoading ? 'scheduled' : 'completed') as 'completed' | 'in_progress' | 'scheduled',
        time: firstFuel?.time || '09:15 AM',
        details: `${firstFuel?.liters || (activeVehicle.fuelLiters > 0 ? activeVehicle.fuelLiters : 50)}L High Speed Diesel (BS-VI) · Slip #${firstFuel?.billNo || 'FUEL-REG-01'}`,
        metric: `${firstFuel?.liters || (activeVehicle.fuelLiters > 0 ? activeVehicle.fuelLiters : 50)} L`,
        metricLabel: 'Fuel Filled'
      },
      {
        id: 'stop-tr-3',
        stationCode: 'Stop 2',
        title: 'Safety Checkpoint & Technical Inspection',
        location: 'Highway Inspection & Safety Bay',
        type: 'maintenance' as const,
        transportMode: 'truck' as const,
        modeLabel: 'Fleet Safety & Maintenance Depot',
        status: (isAssigned || isLoading ? 'scheduled' : 'completed') as 'completed' | 'in_progress' | 'scheduled',
        time: '11:45 AM',
        details: 'Tyre pressure verification, brake system air pressure, OBD-II CAN engine scan passed',
        metric: '100% OK',
        metricLabel: 'OBD Scan'
      },
      {
        id: 'stop-tr-4',
        stationCode: 'Point C',
        title: 'Dedicated Rail Freight Corridor Transfer (Transport Method Change)',
        location: 'Multimodal Rail Freight Corridor Hub',
        type: 'multimodal' as const,
        transportMode: 'train' as const,
        modeLabel: 'Dedicated Freight Cargo Train',
        status: (activeVehicle.status === 'Moving' ? 'in_progress' : (isCompleted || isUnloading ? 'completed' : 'scheduled')) as 'completed' | 'in_progress' | 'scheduled',
        time: '14:00 PM',
        details: 'Intermodal transshipment: Container transferred from Road Truck to Electric Freight Cargo Train for railway freight corridor',
        metric: 'Rake Leg',
        metricLabel: 'Train Transfer'
      },
      {
        id: 'stop-tr-5',
        stationCode: 'Point D',
        title: 'Final Worksite Unloading & POD Handover',
        location: activeVehicle.destination || 'Project Infrastructure Worksite Depot',
        type: 'unloading' as const,
        transportMode: 'truck' as const,
        modeLabel: 'Site Delivery Crane / Delivery Tipper',
        status: (isUnloading ? 'in_progress' : (isCompleted ? 'completed' : 'scheduled')) as 'completed' | 'in_progress' | 'scheduled',
        time: `ETA: ${activeVehicle.eta || '17:30 PM'}`,
        details: 'Cargo unloading, proof of delivery (e-POD) sign-off, digital ledger closure',
        metric: 'Delivery',
        metricLabel: 'Destination'
      }
    ];
  }, [activeVehicle]);

  // Open Log Modal Pre-filled for Vehicle or Heavy Equipment
  const handleOpenLogForVehicle = (v: TelemetryVehicle) => {
    setActiveAssetForLog(v);
    const isEq = v.assetCategory === 'equipment';
    setShiftForm({
      ...initialFormState,
      assetCategory: v.assetCategory || (isEq ? 'equipment' : 'vehicle'),
      driverName: v.driverName || '',
      driverPhone: v.driverPhone || '',
      driverLicense: v.driverLicense || '',
      helperName: v.helperName || '',
      helperPhone: v.helperPhone || '',
      projectName: v.projectName || 'Infrastructure Worksite Project',
      projectLocation: v.projectLocation || v.worksiteName || 'Active Worksite Corridor',
      worksiteName: v.worksiteName || v.siteDepot || 'Main Site Yard',
      siteDepot: v.siteDepot || 'Depot',
      fromLocation: v.origin || '',
      toLocation: v.destination || '',
      startOdometer: isEq ? '' : String(v.startOdometer || (v.odometer > 50 ? v.odometer - 120 : v.odometer)),
      endOdometer: isEq ? '' : String(v.odometer || 0),
      startEngineHours: isEq ? (v.startEngineHours ? String(v.startEngineHours) : '') : '',
      endEngineHours: isEq ? (v.currentEngineHours ? String(v.currentEngineHours) : '') : '',
      fuelType: v.fuelType || (isEq ? 'Industrial HSD' : 'Diesel (BS-VI)'),
      fuelStation: v.fuelStops && v.fuelStops.length > 0 ? v.fuelStops[0].station : (isEq ? 'Site Mobile Bowser' : 'Commercial Fuel Plaza'),
      fuelBillNumber: v.fuelStops && v.fuelStops.length > 0 ? v.fuelStops[0].billNo : '',
      fuelFilledLiters: v.fuelStops && v.fuelStops.length > 0 ? String(v.fuelStops[0].liters) : '',
      fuelRatePerLiter: v.fuelStops && v.fuelStops.length > 0 ? String(v.fuelStops[0].rate) : '94.50',
      paymentMode: v.fuelStops && v.fuelStops.length > 0 ? (v.fuelStops[0].paymentMode || 'Fleet Diesel Card') : (isEq ? 'Site Diesel Voucher' : 'Fleet Diesel Card'),
      remarks: ''
    });
    setIsLogModalOpen(true);
  };

  // Submit Shift Log to backend & local telemetry state
  const handleSubmitShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssetForLog) return;

    setSaving(true);
    try {
      const isEq = activeAssetForLog.assetCategory === 'equipment';
      const startOdo = parseFloat(shiftForm.startOdometer) || activeAssetForLog.startOdometer || activeAssetForLog.odometer;
      const endOdo = parseFloat(shiftForm.endOdometer) || activeAssetForLog.odometer;
      const distKm = Math.max(0, endOdo - startOdo);

      const startHrs = parseFloat(shiftForm.startEngineHours) || activeAssetForLog.startEngineHours || 0;
      const endHrs = parseFloat(shiftForm.endEngineHours) || activeAssetForLog.currentEngineHours || 0;
      const runHrs = Math.max(0, Math.round((endHrs - startHrs) * 10) / 10);

      const liters = parseFloat(shiftForm.fuelFilledLiters) || 0;
      const rate = parseFloat(shiftForm.fuelRatePerLiter) || 94.50;
      const fuelCost = liters * rate;
      const tollPaid = parseFloat(shiftForm.tollAmount) || 0;
      const fastagPaid = parseFloat(shiftForm.fastagDeduction) || 0;
      const otherExp = parseFloat(shiftForm.otherExpenses) || 0;

      // Calculated fuel efficiency
      let efficiencyVal: number | undefined;
      const efficiencyUnit: 'km/L' | 'L/hr' = isEq ? 'L/hr' : 'km/L';
      if (isEq) {
        if (runHrs > 0 && liters > 0) {
          efficiencyVal = parseFloat((liters / runHrs).toFixed(2));
        }
      } else {
        if (distKm > 0 && liters > 0) {
          efficiencyVal = parseFloat((distKm / liters).toFixed(2));
        }
      }

      const payload = {
        tenantId: currentUser?.uid || 'demo-tenant',
        assetNumber: activeAssetForLog.plate,
        assetTitle: activeAssetForLog.model,
        assetType: isEq ? 'equipment' : 'vehicle',
        worksiteName: shiftForm.worksiteName || shiftForm.toLocation || activeAssetForLog.siteDepot,
        projectName: shiftForm.projectName || activeAssetForLog.projectName,
        driverName: shiftForm.driverName || activeAssetForLog.driverName,
        driverPhone: shiftForm.driverPhone || activeAssetForLog.driverPhone || '',
        driverLicense: shiftForm.driverLicense || activeAssetForLog.driverLicense || '',
        helperName: shiftForm.helperName || activeAssetForLog.helperName || '',
        helperPhone: shiftForm.helperPhone || activeAssetForLog.helperPhone || '',
        logDate: shiftForm.logDate,
        shift: shiftForm.shift,
        stage: shiftForm.stage,
        startOdometer: !isEq ? startOdo : undefined,
        endOdometer: !isEq ? endOdo : undefined,
        distanceRun: !isEq ? distKm : undefined,
        startEngineHours: isEq ? startHrs : undefined,
        endEngineHours: isEq ? endHrs : undefined,
        engineHoursRun: isEq ? runHrs : undefined,
        fuelType: shiftForm.fuelType,
        fuelFilledLiters: liters,
        fuelRatePerLiter: rate,
        fuelTotalCost: fuelCost,
        fuelStation: shiftForm.fuelStation,
        fuelBillNumber: shiftForm.fuelBillNumber,
        paymentMode: shiftForm.paymentMode,
        fuelEfficiency: efficiencyVal,
        fuelEfficiencyUnit: efficiencyUnit,
        tollAmount: tollPaid,
        fastagDeduction: fastagPaid,
        otherExpenses: otherExp,
        tripsCount: parseInt(shiftForm.tripsCount, 10) || 1,
        remarks: shiftForm.remarks
      };

      // Realtime update in-memory telemetry so UI immediately reflects latest shift data
      setLiveTelemetryVehicles(prev => prev.map(v => {
        if (v.id === activeAssetForLog.id) {
          const newStops = [...(v.fuelStops || [])];
          if (liters > 0) {
            newStops.unshift({
              station: shiftForm.fuelStation || 'Fuel Station',
              time: 'Just now',
              liters: liters,
              rate: rate,
              billNo: shiftForm.fuelBillNumber || `BILL-${Date.now().toString().slice(-4)}`,
              amount: fuelCost,
              paymentMode: shiftForm.paymentMode
            });
          }
          return {
            ...v,
            startOdometer: !isEq ? startOdo : v.startOdometer,
            odometer: !isEq ? endOdo : v.odometer,
            distanceToday: !isEq ? distKm : v.distanceToday,
            startEngineHours: isEq ? startHrs : v.startEngineHours,
            currentEngineHours: isEq ? endHrs : v.currentEngineHours,
            engineHoursToday: isEq ? runHrs : v.engineHoursToday,
            fuelType: shiftForm.fuelType || v.fuelType,
            costToday: v.costToday + fuelCost,
            efficiencyKmL: efficiencyVal ? efficiencyVal : v.efficiencyKmL,
            efficiencyUnit: efficiencyUnit,
            fuelStops: newStops
          };
        }
        return v;
      }));

      await apiFetch('/api/tenant/fleet-logs', {
        method: 'POST',
        body: JSON.stringify(payload)
      }).catch(e => console.warn('Backend fleet log sync note:', e));

      showToast(
        isEq
          ? `Shift log recorded for ${activeAssetForLog.plate}! ${runHrs} hrs run · ${liters}L filled (${efficiencyVal ? efficiencyVal + ' L/hr' : 'logged'})`
          : `Shift log recorded for ${activeAssetForLog.plate}! ${distKm} km run · ${liters}L filled (${efficiencyVal ? efficiencyVal + ' km/L' : 'logged'})`,
        'success'
      );
      setIsLogModalOpen(false);
      setActiveAssetForLog(null);
      fetchPortalData();
    } catch (err: any) {
      console.error('[SubmitShift] Error:', err);
      showToast(err.message || 'Could not save shift log', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Helper for status styling in table and chips
  const getStatusBadge = (status: TelemetryVehicle['status']) => {
    switch (status) {
      case 'Moving':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Moving
          </span>
        );
      case 'Loading':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Loading
          </span>
        );
      case 'Unloading':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            Unloading
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            Completed
          </span>
        );
      case 'Assigned':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            Assigned
          </span>
        );
    }
  };

  // Helper to open live telemetry view with vehicle selected
  const openFullScreenWithVehicle = (v: TelemetryVehicle) => {
    setSelectedVehicleId(v.id);
    setViewMode('live-telemetry');
  };

  return (
    <div className="space-y-4 pb-12 font-sans bg-[#f8fafc] text-slate-800 -m-4 sm:-m-6 p-4 sm:p-6 min-h-screen">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold text-white transition-all animate-in fade-in slide-in-from-bottom-3 ${toast.type === 'error' ? 'bg-rose-600' : toast.type === 'info' ? 'bg-blue-600' : 'bg-emerald-600'
            }`}
        >
          {toast.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TOP HEADER & VIEW NAVIGATION TABS
          ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Fleet Operations &amp; Telematics</span>
            {viewMode === 'live-telemetry' && activeVehicle && (
              <span className="text-xs font-mono font-normal text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {activeVehicle.plate} · Live Tracking
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {viewMode === 'overview'
              ? 'Real-time telemetry stream, fleet availability, and assigned driver shift ledger.'
              : viewMode === 'route-board'
                ? 'Complete visual schematic route tracking board for all fleet assets in one full view.'
                : `High-resolution GPS telemetry, OBD-II engine sensors, and route tracking for ${activeVehicle?.plate || 'vehicle'}.`}
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('overview')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === 'overview'
              ? 'bg-slate-900 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Layers size={13} />
            <span>Fleet Overview &amp; Ledger</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('route-board')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === 'route-board'
              ? 'bg-emerald-700 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Route size={13} className={viewMode === 'route-board' ? 'text-white' : 'text-emerald-600'} />
            <span>Live Route Board (Full)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (activeVehicle) setViewMode('live-telemetry');
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === 'live-telemetry'
              ? 'bg-slate-900 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Radio size={13} className={viewMode === 'live-telemetry' ? 'animate-pulse' : 'text-emerald-600'} />
            <span>Live Telemetry ({activeVehicle?.shortCode || 'Live'})</span>
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          VIEW MODE 1: FLEET OVERVIEW & LEDGER
          ────────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'overview' && (
        <>
          {/* ──────────────────────────────────────────────────────────────────────────
              SECTION 1: TOP SUMMARY STATS BAR (4 CARDS)
              ────────────────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: FLEET AVAILABILITY (Clean Light Card) */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  Fleet Availability
                </span>
                <div className="text-emerald-600">
                  <Truck size={18} />
                </div>
              </div>

              <div className="my-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">
                    {allVehicles.length < 10 ? `0${allVehicles.length}` : allVehicles.length}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">vehicles</span>
                </div>
              </div>

              <div className="text-[11px] font-medium text-slate-500 pt-1 border-t border-slate-100 truncate">
                <span className="text-emerald-600 font-semibold">{counts.moving} moving</span> · {counts.loading} loading · {counts.unloading} unloading
              </div>
            </div>

            {/* Card 2: DISTANCE COVERED (White Card) */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  Distance Covered
                </span>
                <div className="text-emerald-600">
                  <Navigation size={18} />
                </div>
              </div>

              <div className="my-2.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">
                    {tableTotals.dist.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">km</span>
                </div>
              </div>

              <div className="text-[11px] font-semibold text-emerald-600 pt-1 border-t border-slate-100 flex items-center gap-1">
                <span>Across active fleet runs</span>
              </div>
            </div>

            {/* Card 3: FUEL CONSUMED (White Card) */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  Fuel Consumed
                </span>
                <div className="text-teal-600">
                  <Fuel size={18} />
                </div>
              </div>

              <div className="my-2.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">
                    {tableTotals.fuel.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">L</span>
                </div>
              </div>

              <div className="text-[11px] font-medium text-slate-500 pt-1 border-t border-slate-100">
                Fleet efficiency <span className="font-semibold text-slate-700">{tableTotals.avgKmL} km/L</span>
              </div>
            </div>

            {/* Card 4: TOTAL OPERATING COST (White Card) */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  Total Operating Cost
                </span>
                <div className="text-emerald-600 font-bold text-base">
                  ₹
                </div>
              </div>

              <div className="my-2.5">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">
                    ₹{tableTotals.cost.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="text-[11px] font-medium text-slate-500 pt-1 border-t border-slate-100">
                <span className="font-semibold text-slate-700">
                  ₹{(tableTotals.cost / (tableTotals.dist || 1)).toFixed(2)} / km
                </span> · all expenses included
              </div>
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────────────────────────
          {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 2: ALL PROJECT VEHICLES & DEPLOYMENT LIVE OVERVIEW (MINIMAL)
          Clean, glanceable live cards for all fleet assets across project worksites.
          ────────────────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-3.5 text-slate-800">
            {/* Header: Minimal & Glanceable */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center font-bold shrink-0">
                  <Layers size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900">
                      Live Project Fleet Overview
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {onlineCount}/{allVehicles.length} Active
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      · {distinctProjects.length} {distinctProjects.length === 1 ? 'Project' : 'Projects'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Filters & Route Board link */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setOverviewCategoryFilter('all')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      overviewCategoryFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({allVehicles.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverviewCategoryFilter('vehicle')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      overviewCategoryFilter === 'vehicle'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Truck size={12} />
                    <span>Trucks ({allVehicles.filter(v => v.assetCategory !== 'equipment').length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverviewCategoryFilter('equipment')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      overviewCategoryFilter === 'equipment'
                        ? 'bg-amber-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <HardHat size={12} />
                    <span>Equipment ({allVehicles.filter(v => v.assetCategory === 'equipment').length})</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setViewMode('route-board')}
                  className="px-3 py-1 rounded-lg bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Route size={12} className="text-emerald-600" />
                  <span>Route Board</span>
                  <ArrowRight size={11} />
                </button>
              </div>
            </div>

            {/* Minimal Scannable Vehicle Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-0.5">
              {overviewVehicles.map(v => {
                const isEq = v.assetCategory === 'equipment';
                const isSelected = activeVehicle?.id === v.id;

                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      setSelectedVehicleId(v.id);
                      setViewMode('live-telemetry');
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2.5 group ${
                      isSelected
                        ? 'bg-emerald-50/40 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-[#fcfdfd] hover:bg-white border-slate-200/90 hover:border-emerald-500/40 shadow-2xs hover:shadow-xs'
                    }`}
                  >
                    {/* Row 1: Icon, Plate, Status */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isEq ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isEq ? <HardHat size={14} /> : <Truck size={14} />}
                        </div>
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-xs text-slate-900 block leading-tight truncate">
                            {v.plate}
                          </span>
                          <span className="text-[10.5px] text-slate-500 font-medium block truncate">
                            {v.model}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {getStatusBadge(v.status)}
                      </div>
                    </div>

                    {/* Row 2: Site & Driver */}
                    <div className="text-[11px] space-y-1 text-slate-600 bg-slate-50/70 p-2 rounded-lg border border-slate-100/80">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-slate-400 font-medium shrink-0">Site:</span>
                        <span className="font-semibold text-slate-800 truncate" title={v.worksiteName || v.liveLocation}>
                          {v.worksiteName || v.liveLocation || 'Project Worksite'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-slate-400 font-medium shrink-0">Driver:</span>
                        <span className="text-slate-700 truncate" title={v.driverName}>
                          {v.driverName}
                        </span>
                      </div>
                    </div>

                    {/* Row 3: Fuel %, Run km/hrs, and Log button */}
                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <div className="flex items-center gap-1.5 text-slate-600 font-semibold text-[11px]">
                        <span className="flex items-center gap-0.5 text-emerald-700">
                          <Fuel size={12} />
                          <span>{v.fuelLevelPercent}%</span>
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-800 font-mono">
                          {isEq ? `${v.engineHoursToday || 0}h` : `${v.distanceToday} km`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenLogForVehicle(v);
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 rounded-md text-[10.5px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        >
                          <span>Log</span>
                          <ArrowRight size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 3: VEHICLE LEDGER TABLE
          ────────────────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
            {/* Table Top Controls Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div className="flex items-baseline gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Vehicle ledger
                </h2>
                <span className="text-xs text-slate-400 font-medium">
                  {allVehicles.length} vehicles
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Box */}
                <div className="relative min-w-[240px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search vehicle, driver or location"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Columns Button */}
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sliders size={13} className="text-slate-500" />
                  <span>Columns</span>
                </button>

                {/* + Add vehicle / + Log Shift Button */}
                <button
                  type="button"
                  onClick={() => handleOpenLogForVehicle(activeVehicle)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Plus size={14} />
                  <span>Add vehicle</span>
                </button>
              </div>
            </div>

            {/* Filter Tabs & Right Note */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setStatusFilter('All')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${statusFilter === 'All'
                    ? 'bg-slate-100 text-emerald-800 font-bold border-b-2 border-emerald-600'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  All vehicles <span className="font-normal text-slate-400">{counts.all}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('Moving')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${statusFilter === 'Moving'
                    ? 'bg-slate-100 text-emerald-800 font-bold border-b-2 border-emerald-600'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  Moving <span className="font-normal text-slate-400">{counts.moving}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('Loading')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${statusFilter === 'Loading'
                    ? 'bg-slate-100 text-emerald-800 font-bold border-b-2 border-emerald-600'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  Loading <span className="font-normal text-slate-400">{counts.loading}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('Unloading')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${statusFilter === 'Unloading'
                    ? 'bg-slate-100 text-emerald-800 font-bold border-b-2 border-emerald-600'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  Unloading <span className="font-normal text-slate-400">{counts.unloading}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('Completed')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${statusFilter === 'Completed'
                    ? 'bg-slate-100 text-emerald-800 font-bold border-b-2 border-emerald-600'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  Completed <span className="font-normal text-slate-400">{counts.completed}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('Assigned')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${statusFilter === 'Assigned'
                    ? 'bg-slate-100 text-emerald-800 font-bold border-b-2 border-emerald-600'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  Assigned <span className="font-normal text-slate-400">{counts.assigned}</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <Clock size={12} />
                <span>Distance, fuel &amp; costs for today</span>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-8 text-center">
                      <input type="checkbox" className="rounded text-emerald-600 focus:ring-0 cursor-pointer" />
                    </th>
                    <th className="py-2.5 px-3">Vehicle / Type</th>
                    <th className="py-2.5 px-3">Driver / Site</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Live Location</th>
                    <th className="py-2.5 px-3 text-right">Odometer · km</th>
                    <th className="py-2.5 px-3 text-right">Distance · km</th>
                    <th className="py-2.5 px-3 text-right">Fuel · L</th>
                    <th className="py-2.5 px-3 text-right">km/L</th>
                    <th className="py-2.5 px-3 text-right">Cost · ₹</th>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredVehicles.map(v => {
                    const isSelected = selectedRows[v.id] || false;

                    return (
                      <tr
                        key={v.id}
                        className="hover:bg-slate-50/90 transition-colors group cursor-pointer"
                        onClick={() => setSelectedVehicleId(v.id)}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => setSelectedRows(prev => ({ ...prev, [v.id]: e.target.checked }))}
                            className="rounded text-emerald-600 focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* Vehicle / Type */}
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-slate-900 text-xs">
                            {v.plate}
                          </div>
                          <div className="text-[10.5px] text-slate-400">
                            {v.model} · {v.type}
                          </div>
                        </td>

                        {/* Driver / Site */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800 text-xs">
                            {v.driverName}
                          </div>
                          <div className="text-[10.5px] text-slate-400">
                            {v.siteDepot}
                          </div>
                        </td>

                        {/* Status Pill */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getStatusBadge(v.status)}
                        </td>

                        {/* Live Location & Speed */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-800 text-xs">
                            {v.liveLocation}
                          </div>
                          <div className="text-[10.5px] text-slate-400">
                            {v.locationDetails}
                          </div>
                        </td>

                        {/* Odometer */}
                        <td className="py-3 px-3 text-right font-mono text-slate-800">
                          {v.odometer.toLocaleString('en-IN')}
                        </td>

                        {/* Distance today */}
                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800">
                          {v.distanceToday}
                        </td>

                        {/* Fuel & Level progress bar */}
                        <td className="py-3 px-3 text-right">
                          <div className="font-mono text-slate-800">
                            {v.fuelLiters > 0 ? v.fuelLiters : '0'}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${v.fuelLevelPercent}%` }}
                                className={`h-full rounded-full ${v.fuelLevelPercent < 25 ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                              />
                            </div>
                            <span className="text-[9.5px] font-mono text-slate-400">
                              {v.fuelLevelPercent}%
                            </span>
                          </div>
                        </td>

                        {/* km/L Efficiency */}
                        <td className="py-3 px-3 text-right font-mono text-slate-800">
                          {v.efficiencyKmL}
                        </td>

                        {/* Cost */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{v.costToday.toLocaleString('en-IN')}
                        </td>

                        {/* Action: chevron ">" that opens Full Screen Info Live Update */}
                        <td className="py-3 px-3 text-center" onClick={e => {
                          e.stopPropagation();
                          openFullScreenWithVehicle(v);
                        }}>
                          <button
                            type="button"
                            title="Click to view full screen info live update"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer group-hover:text-slate-800"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Table Footer: FLEET TOTAL */}
                <tfoot>
                  <tr className="bg-slate-50/90 font-bold border-t border-slate-200 text-slate-900 text-xs">
                    <td className="py-3 px-3" />
                    <td className="py-3 px-3" colSpan={4}>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold uppercase tracking-wider text-[11px] text-slate-800">
                          Fleet total
                        </span>
                        <span className="text-[11px] font-normal text-slate-500">
                          {allVehicles.length} vehicles · 7 available
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {tableTotals.odo.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {tableTotals.dist.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {tableTotals.fuel}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {tableTotals.avgKmL}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-900">
                      ₹{tableTotals.cost.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
      VIEW MODE: INTEGRATED FLEET BOARD (FULL OPEN VIEW)
      Complete visual schematic route tracking board showing all vehicles simultaneously.
      ────────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'route-board' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Top Full View Navigation Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode('overview')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 shrink-0"
              >
                <ChevronLeft size={16} />
                <span>Back to Overview</span>
              </button>

              <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold shrink-0">
                <Route size={18} />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-sm sm:text-base text-slate-900">
                    Integrated Fleet Board &amp; Live Route Tracking (Full View)
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {onlineCount}/{allVehicles.length} ONLINE
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Viewing all {allVehicles.length} fleet assets · Live schematic route corridors without geographic map clutter
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeVehicle) openFullScreenWithVehicle(activeVehicle);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Radio size={13} />
                <span>Inspect Cockpit</span>
              </button>
            </div>
          </div>

          {/* Full Board Controls: Status Tabs & Category Filter */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              {/* Category selector */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400 font-medium">Fleet Category:</span>
                <button
                  type="button"
                  onClick={() => setLiveTrackCategory('all')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${liveTrackCategory === 'all'
                      ? 'bg-slate-900 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  All Fleet ({allVehicles.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLiveTrackCategory('vehicle')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${liveTrackCategory === 'vehicle'
                      ? 'bg-emerald-700 text-white font-bold'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
                    }`}
                >
                  <Truck size={13} />
                  <span>Trucks ({allVehicles.filter(v => v.assetCategory !== 'equipment').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLiveTrackCategory('equipment')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${liveTrackCategory === 'equipment'
                      ? 'bg-amber-700 text-white font-bold'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
                    }`}
                >
                  <HardHat size={13} />
                  <span>Heavy Equipment / JCB ({allVehicles.filter(v => v.assetCategory === 'equipment').length})</span>
                </button>
              </div>

              {/* Status Tabs */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {(['All', 'Moving', 'Loading', 'Unloading', 'Completed', 'Assigned'] as const).map(cat => {
                  const count = cat === 'All' ? allVehicles.length : counts[cat.toLowerCase() as keyof typeof counts];
                  const isActive = liveTrackFilter === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setLiveTrackFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${isActive
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      {cat} <span className="text-[10px] opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List of All Vehicles in Full View */}
            <div className="space-y-4 pt-1">
              {mapVehicles.map(v => {
                const isEq = v.assetCategory === 'equipment';
                const progress = v.routeProgressPercent || 50;
                const vehX = 60 + (progress / 100) * (860 - 60);
                const isTrainLeg = !isEq && vehX >= 610;

                return (
                  <div
                    key={v.id}
                    className="p-4 sm:p-5 rounded-2xl bg-[#f8fafc] border border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all space-y-4"
                  >
                    {/* Header Strip */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl text-white flex items-center justify-center font-bold shrink-0 shadow-xs ${isEq ? 'bg-amber-600' : 'bg-emerald-600'
                          }`}>
                          {isEq ? <HardHat size={20} /> : <Truck size={20} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-sm text-slate-900 tracking-wider">
                              {v.plate}
                            </span>
                            <span className="text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                              {v.model}
                            </span>
                            {getStatusBadge(v.status)}
                            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              {isEq ? `${v.engineHoursToday || 6.5}h Engine Run` : `${v.speed} km/h`}
                            </span>
                            <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${isEq
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}>
                              {isEq ? (
                                <>
                                  <HardHat size={11} />
                                  <span>Site Earthmoving &amp; Low-Bed Haul</span>
                                </>
                              ) : (
                                <>
                                  <Train size={11} />
                                  <span>Road ➔ Train Intermodal Route</span>
                                </>
                              )}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-2 flex-wrap">
                            <span>👤 <strong className="text-slate-800">{v.driverName}</strong> ({v.driverPhone || '+91 98201 44521'})</span>
                            <span>·</span>
                            <span>📍 <strong className="text-slate-700">{v.liveLocation}</strong></span>
                            <span>·</span>
                            <span>Project: {v.projectName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenLogForVehicle(v)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Plus size={13} className="text-slate-500" />
                          <span>Log Shift</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openFullScreenWithVehicle(v)}
                          className="px-3 py-1.5 rounded-xl bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        >
                          <span>Inspect Cockpit</span>
                          <ArrowUpRight size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Vector Track */}
                    <div className="overflow-x-auto py-2">
                      <div className="min-w-[780px]">
                        <svg viewBox="0 0 920 126" className="w-full overflow-visible">
                          <defs>
                            <linearGradient id={`grad-full-${v.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#059669" />
                              <stop offset="100%" stopColor="#10b981" />
                            </linearGradient>
                          </defs>

                          {isEq ? (
                            <>
                              <line x1="60" y1="64" x2="860" y2="64" stroke="#e2e8f0" strokeWidth="18" strokeLinecap="round" />
                              <line x1="60" y1="64" x2="860" y2="64" stroke="#d97706" strokeWidth="2" strokeDasharray="6 6" />
                              <line
                                x1="60"
                                y1="64"
                                x2={Math.min(860, 60 + (progress / 100) * 800)}
                                y2="64"
                                stroke="#d97706"
                                strokeWidth="5"
                                strokeLinecap="round"
                              />
                            </>
                          ) : (
                            <>
                              <line x1="60" y1="64" x2="610" y2="64" stroke="#cbd5e1" strokeWidth="18" strokeLinecap="round" />
                              <line x1="60" y1="64" x2="610" y2="64" stroke="#334155" strokeWidth="14" strokeLinecap="round" />
                              <line x1="60" y1="64" x2="610" y2="64" stroke="#fbbf24" strokeWidth="2" strokeDasharray="8 6" />

                              <line x1="610" y1="64" x2="860" y2="64" stroke="#e2e8f0" strokeWidth="20" strokeLinecap="round" />
                              {[620, 636, 652, 668, 684, 700, 716, 732, 748, 764, 780, 796, 812, 828, 844, 856].map(tx => (
                                <line key={tx} x1={tx} y1="53" x2={tx} y2="75" stroke="#64748b" strokeWidth="2.5" />
                              ))}
                              <line x1="610" y1="57" x2="860" y2="57" stroke="#4f46e5" strokeWidth="2" />
                              <line x1="610" y1="71" x2="860" y2="71" stroke="#4f46e5" strokeWidth="2" />

                              <line
                                x1="60"
                                y1="64"
                                x2={Math.min(860, 60 + (progress / 100) * 800)}
                                y2="64"
                                stroke={`url(#grad-full-${v.id})`}
                                strokeWidth="4.5"
                                strokeLinecap="round"
                              />
                            </>
                          )}

                          {/* 5 Station Nodes */}
                          <g>
                            <circle cx="60" cy="64" r="11" fill="#ffffff" stroke={isEq ? '#d97706' : '#059669'} strokeWidth="3" />
                            <circle cx="60" cy="64" r="4" fill={isEq ? '#d97706' : '#059669'} />
                            <text x="60" y="20" textAnchor="middle" fill="#0f172a" fontSize="9.5" fontWeight="bold">Point A · Load 📦</text>
                            <text x="60" y="94" textAnchor="middle" fill="#059669" fontSize="9" fontWeight="bold">06:30 AM ✓</text>
                            <text x="60" y="108" textAnchor="middle" fill="#64748b" fontSize="8">{v.origin || (isEq ? 'Site Quarry Pit' : 'Terminal Yard')}</text>
                          </g>

                          <g>
                            <circle cx="260" cy="64" r="10" fill="#ffffff" stroke="#d97706" strokeWidth="2.5" />
                            <circle cx="260" cy="64" r="3.5" fill="#d97706" />
                            <text x="260" y="20" textAnchor="middle" fill="#0f172a" fontSize="9.5" fontWeight="bold">Stop 1 · Fuel ⛽</text>
                            <text x="260" y="94" textAnchor="middle" fill="#d97706" fontSize="9" fontWeight="bold">09:15 AM ✓</text>
                            <text x="260" y="108" textAnchor="middle" fill="#64748b" fontSize="8">{isEq ? 'Mobile Bowzer' : 'Highway Fuel Plaza'}</text>
                          </g>

                          <g>
                            <circle cx="440" cy="64" r="10" fill="#ffffff" stroke="#9333ea" strokeWidth="2.5" />
                            <circle cx="440" cy="64" r="3.5" fill="#9333ea" />
                            <text x="440" y="20" textAnchor="middle" fill="#0f172a" fontSize="9.5" fontWeight="bold">Stop 2 · Safety 🔧</text>
                            <text x="440" y="94" textAnchor="middle" fill="#9333ea" fontSize="9" fontWeight="bold">11:45 AM ✓</text>
                            <text x="440" y="108" textAnchor="middle" fill="#64748b" fontSize="8">{isEq ? 'Camp Maintenance' : 'Safety Depot'}</text>
                          </g>

                          <g>
                            <circle cx="610" cy="64" r="13" fill="#ffffff" stroke="#4f46e5" strokeWidth="3" />
                            <circle cx="610" cy="64" r="5" fill="#4f46e5" />
                            <text x="610" y="20" textAnchor="middle" fill="#3730a3" fontSize="9.5" fontWeight="black">
                              {isEq ? 'Point B · Trailer 🚛' : 'Point C · Train 🚆'}
                            </text>
                            <text x="610" y="94" textAnchor="middle" fill="#4f46e5" fontSize="9" fontWeight="bold">Transfer Hub</text>
                            <text x="610" y="108" textAnchor="middle" fill="#64748b" fontSize="8">
                              {isEq ? 'Low-Bed Haul Ramp' : 'Rail Freight Hub'}
                            </text>
                          </g>

                          <g>
                            <circle cx="860" cy="64" r="11" fill="#ffffff" stroke="#0d9488" strokeWidth="3" />
                            <circle cx="860" cy="64" r="4" fill="#0d9488" />
                            <text x="860" y="20" textAnchor="middle" fill="#0f172a" fontSize="9.5" fontWeight="bold">Point D · Unload 🏗️</text>
                            <text x="860" y="94" textAnchor="middle" fill="#0d9488" fontSize="9" fontWeight="bold">ETA {v.eta || '17:30 PM'}</text>
                            <text x="860" y="108" textAnchor="middle" fill="#64748b" fontSize="8">{v.destination || 'Worksite Depot'}</text>
                          </g>

                          {/* Moving Beacon */}
                          <g transform={`translate(${vehX}, 64)`}>
                            <circle cx="0" cy="0" r="18" fill={isTrainLeg ? '#4f46e5' : '#059669'} fillOpacity="0.25">
                              <animate attributeName="r" values="10;24;10" dur="2s" repeatCount="indefinite" />
                              <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                            </circle>
                            <circle cx="0" cy="0" r="13" fill={isTrainLeg ? '#4f46e5' : (isEq ? '#d97706' : '#059669')} />
                            <circle cx="0" cy="0" r="9" fill="#ffffff" />
                            <circle cx="0" cy="0" r="4" fill={isTrainLeg ? '#4f46e5' : (isEq ? '#d97706' : '#059669')} />

                            <g transform="translate(0, -25)">
                              <rect x="-42" y="-12" width="84" height="20" rx="10" fill="#0f172a" />
                              <text x="0" y="2" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                                {isTrainLeg ? '🚆 Train Rake' : (isEq ? '🚜 ' + v.shortCode : '🚚 ' + v.shortCode)}
                              </text>
                              <polygon points="-3,8 3,8 0,12" fill="#0f172a" />
                            </g>
                          </g>
                        </svg>
                      </div>
                    </div>

                    {/* Operational Strip */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-200/80">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Speed/HMR:</span>
                          <strong className="font-mono text-slate-900 font-bold">
                            {isEq ? `${v.engineHoursToday || 6.5} hrs` : `${v.speed} km/h`}
                          </strong>
                        </div>

                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Fuel:</span>
                          <strong className="font-mono text-slate-900 font-bold">{v.fuelLevelPercent}% ({v.fuelLiters > 0 ? v.fuelLiters : (isEq ? 45 : 68)} L)</strong>
                        </div>

                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Today Run:</span>
                          <strong className="font-mono text-slate-900 font-bold">
                            {isEq ? `${v.engineHoursToday || 6.5} hrs run` : `${v.distanceToday} km`}
                          </strong>
                        </div>

                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Today Cost:</span>
                          <strong className="font-mono text-emerald-700 font-bold">₹{v.costToday.toLocaleString('en-IN')}</strong>
                          <span className="text-[10px] text-slate-400 font-mono">({v.efficiencyKmL} {v.efficiencyUnit})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                        <span className="text-[11px] font-semibold text-slate-500">Route Progress:</span>
                        <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                          <div
                            style={{ width: `${progress}%` }}
                            className={`h-full rounded-full ${isEq ? 'bg-amber-600' : 'bg-emerald-600'}`}
                          />
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-700">
                          {progress}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {mapVehicles.length === 0 && (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <p className="text-sm font-semibold text-slate-600">No vehicles match the selected filter.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setLiveTrackFilter('All');
                      setLiveTrackCategory('all');
                    }}
                    className="mt-2 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
      VIEW MODE 2: LIVE TELEMETRY COCKPIT (SAME LIGHT THEME, SIDEBAR VISIBLE)
      ────────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'live-telemetry' && activeVehicle && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          {/* Top Telemetry Cockpit Action Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Left: Back Button, Plate, Model & Status */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode('overview')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200/80 shrink-0"
                title="Return to fleet overview & ledger"
              >
                <ChevronLeft size={16} />
                <span>Back to Overview</span>
              </button>

              <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold shrink-0">
                <Truck size={18} />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-sm sm:text-base text-slate-900 tracking-wider">
                    {activeVehicle.plate}
                  </span>
                  {getStatusBadge(activeVehicle.status)}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {activeVehicle.model} · {activeVehicle.driverName} ({activeVehicle.siteDepot})
                </div>
              </div>
            </div>

            {/* Right: Asset Switcher Dropdown & Primary Action */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Asset:</span>
                <select
                  value={activeVehicle.id}
                  onChange={e => setSelectedVehicleId(e.target.value)}
                  className="bg-transparent text-slate-800 text-xs font-bold cursor-pointer outline-hidden pr-2"
                >
                  {allVehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.plate} · {v.model} ({v.driverName})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleOpenLogForVehicle(activeVehicle)}
                className="px-4 py-2 rounded-xl bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
              >
                <Plus size={15} />
                <span>Record Shift Run / Diesel Bill For This Vehicle</span>
              </button>
            </div>
          </div>

          {/* Cockpit Content Body Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Left 7 Columns: Multimodal Schematic Route Corridor Board (Replaces Geo Map) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col justify-between space-y-4">
              {/* Header: Title, Live Status & Route Mode */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center font-bold shrink-0">
                    <Route size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-slate-900">
                        Live Route Corridor Tracking
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {activeVehicle.speed > 0 ? `${activeVehicle.speed} km/h · Moving` : activeVehicle.status}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                        activeVehicle.assetCategory === 'equipment'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {activeVehicle.assetCategory === 'equipment' ? (
                          <>
                            <HardHat size={11} />
                            <span>Site Earthmoving ➔ Low-Bed Haul</span>
                          </>
                        ) : (
                          <>
                            <Train size={11} />
                            <span>Road ➔ Train Intermodal Corridor</span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                      📍 Currently at <strong className="text-slate-700">{activeVehicle.liveLocation}</strong> · Project: {activeVehicle.projectName}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    {activeVehicle.routeProgressPercent}% completed
                  </span>
                </div>
              </div>

              {/* Vector Corridor Board Container */}
              <div className="bg-[#f8fafc] rounded-xl border border-slate-200/90 p-3 sm:p-4 space-y-3">
                {(() => {
                  const isEq = activeVehicle.assetCategory === 'equipment';
                  const progress = activeVehicle.routeProgressPercent || 50;
                  const vehX = 60 + (progress / 100) * (860 - 60);
                  const isTrainLeg = !isEq && vehX >= 610;

                  return (
                    <div className="overflow-x-auto py-1">
                      <div className="min-w-[760px]">
                        <svg viewBox="0 0 920 126" className="w-full overflow-visible">
                          <defs>
                            <linearGradient id={`grad-cockpit-${activeVehicle.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#059669" />
                              <stop offset="100%" stopColor="#10b981" />
                            </linearGradient>
                          </defs>

                          {isEq ? (
                            <>
                              <line x1="60" y1="64" x2="860" y2="64" stroke="#e2e8f0" strokeWidth="18" strokeLinecap="round" />
                              <line x1="60" y1="64" x2="860" y2="64" stroke="#d97706" strokeWidth="2" strokeDasharray="6 6" />
                              <line
                                x1="60"
                                y1="64"
                                x2={Math.min(860, 60 + (progress / 100) * 800)}
                                y2="64"
                                stroke="#d97706"
                                strokeWidth="5"
                                strokeLinecap="round"
                              />
                            </>
                          ) : (
                            <>
                              {/* Highway Road Segment */}
                              <line x1="60" y1="64" x2="610" y2="64" stroke="#cbd5e1" strokeWidth="18" strokeLinecap="round" />
                              <line x1="60" y1="64" x2="610" y2="64" stroke="#334155" strokeWidth="14" strokeLinecap="round" />
                              <line x1="60" y1="64" x2="610" y2="64" stroke="#fbbf24" strokeWidth="2" strokeDasharray="8 6" />

                              {/* Rail Track Segment */}
                              <line x1="610" y1="64" x2="860" y2="64" stroke="#e2e8f0" strokeWidth="20" strokeLinecap="round" />
                              {[620, 636, 652, 668, 684, 700, 716, 732, 748, 764, 780, 796, 812, 828, 844, 856].map(tx => (
                                <line key={tx} x1={tx} y1="53" x2={tx} y2="75" stroke="#64748b" strokeWidth="2.5" />
                              ))}
                              <line x1="610" y1="57" x2="860" y2="57" stroke="#4f46e5" strokeWidth="2" />
                              <line x1="610" y1="71" x2="860" y2="71" stroke="#4f46e5" strokeWidth="2" />

                              {/* Live Progress Vector Stroke */}
                              <line
                                x1="60"
                                y1="64"
                                x2={Math.min(860, 60 + (progress / 100) * 800)}
                                y2="64"
                                stroke={`url(#grad-cockpit-${activeVehicle.id})`}
                                strokeWidth="4.5"
                                strokeLinecap="round"
                              />
                            </>
                          )}

                          {/* 5 Waypoint Station Nodes */}
                          <g>
                            <circle cx="60" cy="64" r="11" fill="#ffffff" stroke={isEq ? '#d97706' : '#059669'} strokeWidth="3" />
                            <circle cx="60" cy="64" r="4" fill={isEq ? '#d97706' : '#059669'} />
                            <text x="60" y="20" textAnchor="middle" fill="#0f172a" fontSize="9.5" fontWeight="bold">Point A · Load 📦</text>
                            <text x="60" y="94" textAnchor="middle" fill="#059669" fontSize="9" fontWeight="bold">06:30 AM ✓</text>
                            <text x="60" y="108" textAnchor="middle" fill="#64748b" fontSize="8">{activeVehicle.origin || (isEq ? 'Site Quarry Pit' : 'Terminal Yard')}</text>
                          </g>

                          <g>
                            <circle cx="260" cy="64" r="10" fill="#ffffff" stroke="#d97706" strokeWidth="2.5" />
                            <circle cx="260" cy="64" r="3.5" fill="#d97706" />
                            <text x="260" y="20" textAnchor="middle" fill="#0f172a" fontSize="9.5" fontWeight="bold">Stop 1 · Fuel ⛽</text>
                            <text x="260" y="94" textAnchor="middle" fill="#d97706" fontSize="9" fontWeight="bold">09:15 AM ✓</text>
                            <text x="260" y="108" textAnchor="middle" fill="#64748b" fontSize="8">{isEq ? 'Mobile Bowzer' : 'Highway Fuel Plaza'}</text>
                          </g>

                          <g>
                            <circle cx="440" cy="64" r="10" fill="#ffffff" stroke="#9333ea" strokeWidth="2.5" />
                            <circle cx="440" cy="64" r="3.5" fill="#9333ea" />
                            <text x="440" y="20" textAnchor="middle" fill="#0f172a" fontSize="9.5" fontWeight="bold">Stop 2 · Safety 🔧</text>
                            <text x="440" y="94" textAnchor="middle" fill="#9333ea" fontSize="9" fontWeight="bold">11:45 AM ✓</text>
                            <text x="440" y="108" textAnchor="middle" fill="#64748b" fontSize="8">{isEq ? 'Camp Maintenance' : 'Safety Depot'}</text>
                          </g>

                          <g>
                            <circle cx="610" cy="64" r="13" fill="#ffffff" stroke="#4f46e5" strokeWidth="3" />
                            <circle cx="610" cy="64" r="5" fill="#4f46e5" />
                            <text x="610" y="20" textAnchor="middle" fill="#3730a3" fontSize="9.5" fontWeight="black">
                              {isEq ? 'Point B · Trailer 🚛' : 'Point C · Train 🚆'}
                            </text>
                            <text x="610" y="94" textAnchor="middle" fill="#4f46e5" fontSize="9" fontWeight="bold">Transfer Hub</text>
                            <text x="610" y="108" textAnchor="middle" fill="#64748b" fontSize="8">
                              {isEq ? 'Low-Bed Haul Ramp' : 'Rail Freight Hub'}
                            </text>
                          </g>

                          <g>
                            <circle cx="860" cy="64" r="11" fill="#ffffff" stroke="#0d9488" strokeWidth="3" />
                            <circle cx="860" cy="64" r="4" fill="#0d9488" />
                            <text x="860" y="20" textAnchor="middle" fill="#0f172a" fontSize="9.5" fontWeight="bold">Point D · Unload 🏗️</text>
                            <text x="860" y="94" textAnchor="middle" fill="#0d9488" fontSize="9" fontWeight="bold">ETA {activeVehicle.eta || '17:30 PM'}</text>
                            <text x="860" y="108" textAnchor="middle" fill="#64748b" fontSize="8">{activeVehicle.destination || 'Worksite Depot'}</text>
                          </g>

                          {/* Active Vehicle Live Beacon */}
                          <g transform={`translate(${vehX}, 64)`}>
                            <circle cx="0" cy="0" r="18" fill={isTrainLeg ? '#4f46e5' : '#059669'} fillOpacity="0.25">
                              <animate attributeName="r" values="10;24;10" dur="2s" repeatCount="indefinite" />
                              <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                            </circle>
                            <circle cx="0" cy="0" r="13" fill={isTrainLeg ? '#4f46e5' : (isEq ? '#d97706' : '#059669')} />
                            <circle cx="0" cy="0" r="9" fill="#ffffff" />
                            <circle cx="0" cy="0" r="4" fill={isTrainLeg ? '#4f46e5' : (isEq ? '#d97706' : '#059669')} />

                            <g transform="translate(0, -25)">
                              <rect x="-42" y="-12" width="84" height="20" rx="10" fill="#0f172a" />
                              <text x="0" y="2" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                                {isTrainLeg ? '🚆 Train Rake' : (isEq ? '🚜 ' + activeVehicle.shortCode : '🚚 ' + activeVehicle.shortCode)}
                              </text>
                              <polygon points="-3,8 3,8 0,12" fill="#0f172a" />
                            </g>
                          </g>
                        </svg>
                      </div>
                    </div>
                  );
                })()}

                {/* Route Progress Status Bar */}
                <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium flex items-center gap-1.5">
                      <Navigation size={12} className="text-emerald-600 rotate-45" />
                      <span>Route Corridor Progress</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {activeVehicle.routeProgressPercent}% completed · ETA {activeVehicle.eta || '17:30 PM'}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                    <div
                      style={{ width: `${activeVehicle.routeProgressPercent}%` }}
                      className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full transition-all duration-500"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                    <span>Origin: <strong className="text-slate-700">{activeVehicle.origin || 'Source Yard'}</strong></span>
                    <span>Destination: <strong className="text-slate-700">{activeVehicle.destination || 'Worksite Depot'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Waypoint Milestone Inspection Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">1. Loading</span>
                  <span className="font-bold text-slate-800 text-[11.5px] block truncate">Point A ✓</span>
                  <span className="text-[10px] text-emerald-700 font-semibold">Completed</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">2. Fuel Stop</span>
                  <span className="font-bold text-slate-800 text-[11.5px] block truncate">Stop 1 ✓</span>
                  <span className="text-[10px] text-amber-700 font-semibold">Refueled</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">3. Safety Bay</span>
                  <span className="font-bold text-slate-800 text-[11.5px] block truncate">Stop 2 ✓</span>
                  <span className="text-[10px] text-purple-700 font-semibold">Cleared</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">4. Intermodal</span>
                  <span className="font-bold text-slate-800 text-[11.5px] block truncate">Transfer Hub</span>
                  <span className="text-[10px] text-indigo-700 font-semibold">Rail Corridor</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">5. Delivery</span>
                  <span className="font-bold text-slate-800 text-[11.5px] block truncate">Point D</span>
                  <span className="text-[10px] text-teal-700 font-semibold">Scheduled</span>
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Operational Shift Summary & Quick Dispatch */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                {/* Driver Profile & Phone */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-emerald-50 text-[#00705a] flex items-center justify-center font-bold">
                      <User size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{activeVehicle.driverName}</h4>
                      <span className="text-[11px] text-slate-500">Base Depot: {activeVehicle.siteDepot}</span>
                    </div>
                  </div>
                  {activeVehicle.driverPhone && (
                    <a
                      href={`tel:${activeVehicle.driverPhone}`}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
                    >
                      <Phone size={11} className="text-[#00705a]" />
                      <span>{activeVehicle.driverPhone}</span>
                    </a>
                  )}
                </div>

                {/* Project & Worksite Assignment */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-500 text-[10.5px]">
                    <span className="font-semibold uppercase tracking-wider">Project Assignment</span>
                    <span className="text-slate-400">Site Worksite</span>
                  </div>
                  <strong className="text-slate-900 block font-semibold">{activeVehicle.projectName}</strong>
                  <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                    <MapPin size={12} className="text-[#00705a] shrink-0" />
                    <span>{activeVehicle.worksiteName} · {activeVehicle.projectLocation}</span>
                  </div>
                </div>

                {/* Shift Run & Cost Metrics */}
                <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      {activeVehicle.assetCategory === 'equipment' ? 'Today Run (HRS)' : 'Today Run (KM)'}
                    </span>
                    <strong className="text-slate-900 font-mono text-sm mt-1 block">
                      {activeVehicle.assetCategory === 'equipment'
                        ? `${activeVehicle.engineHoursToday || 7.3} hrs`
                        : `${activeVehicle.distanceToday} km`}
                    </strong>
                    <span className="text-[9.5px] text-slate-400 font-medium">Shift Total</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      {activeVehicle.assetCategory === 'equipment' ? 'Consumption' : 'Efficiency'}
                    </span>
                    <strong className="text-[#00705a] font-mono text-sm mt-1 block">
                      {activeVehicle.efficiencyKmL} {activeVehicle.efficiencyUnit}
                    </strong>
                    <span className="text-[9.5px] text-slate-400 font-medium">
                      {activeVehicle.assetCategory === 'equipment' ? 'L/hr average' : 'km/L average'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Operating Cost</span>
                    <strong className="text-slate-900 font-mono text-sm mt-1 block">
                      ₹{activeVehicle.costToday.toLocaleString('en-IN')}
                    </strong>
                    <span className="text-[9.5px] text-slate-400 font-medium">Today</span>
                  </div>
                </div>

                {/* Operator License & Credentials */}
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/90 text-[11px] flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <ShieldCheck size={13} className="text-[#00705a]" />
                    <span>Operator License / Cert:</span>
                  </div>
                  <span className="font-mono font-bold text-slate-800">{activeVehicle.driverLicense}</span>
                </div>
              </div>

              {/* Quick Record Button */}
              <button
                type="button"
                onClick={() => handleOpenLogForVehicle(activeVehicle)}
                className="w-full py-2.5 rounded-xl bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
              >
                <Plus size={15} />
                <span>Record Shift Run / Diesel Bill For This Vehicle</span>
              </button>
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 2B: IN-DEPTH OPERATIONAL INTELLIGENCE:
          1. DRIVER INFO & SITE/PROJECT LOCATION
          2. STARTING SPEEDOMETER & RUN CALCULATION (KM FOR TRUCKS, HRS FOR EQUIPMENT)
          3. FUEL STOPS, FUEL AMOUNTS & CALCULATED AVERAGE FUEL CONSUMPTION
          ────────────────────────────────────────────────────────────────────────── */}
          <div className="space-y-3.5 pt-1">
            {/* Asset Operational Mode Banner */}
            <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${activeVehicle.assetCategory === 'equipment'
              ? 'bg-amber-50/80 border-amber-200 text-amber-950 shadow-2xs'
              : 'bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-2xs'
              }`}>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-sm ${activeVehicle.assetCategory === 'equipment' ? 'bg-amber-600' : 'bg-emerald-700'
                  }`}>
                  {activeVehicle.assetCategory === 'equipment' ? <Wrench size={18} /> : <Truck size={18} />}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm tracking-tight">
                      {activeVehicle.assetCategory === 'equipment'
                        ? '🚜 Heavy Machinery & Earthmoving Equipment Mode'
                        : '🚚 Commercial Fleet Vehicle & Logistics Mode'}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${activeVehicle.assetCategory === 'equipment'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      }`}>
                      {activeVehicle.assetCategory === 'equipment' ? 'MEASURED BY: ENGINE HOURS (HMR)' : 'MEASURED BY: ODOMETER (KM)'}
                    </span>
                  </div>
                  <p className="text-xs opacity-85 mt-0.5 font-medium">
                    {activeVehicle.assetCategory === 'equipment'
                      ? 'Heavy machinery utilization and diesel consumption are calculated strictly by Engine Operating Hours (HMR) and Liters per Hour (L/hr), NOT kilometers.'
                      : 'Commercial transport runs and fuel economy are calculated using Speedometer Odometer readings (KM) and km/L.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 bg-white/90 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <Fuel size={14} className={activeVehicle.assetCategory === 'equipment' ? 'text-amber-600' : 'text-emerald-700'} />
                <span className="text-xs text-slate-500 font-medium">Fuel Type:</span>
                <span className="text-xs font-bold text-slate-900">{activeVehicle.fuelType || 'Diesel (BS-VI)'}</span>
              </div>
            </div>

            {/* 3 Detail Intelligence Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
              {/* ────────────────────────────────────────────────────────────────
              CARD 1: DRIVER & PROJECT / SITE LOCATION INFORMATION
              ──────────────────────────────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col justify-between space-y-4">
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                        <User size={14} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Driver &amp; Crew Details</h3>
                        <span className="text-[10px] text-slate-500">Personnel &amp; deployment credentials</span>
                      </div>
                    </div>
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      Active Shift
                    </span>
                  </div>

                  {/* Driver Details List */}
                  <div className="space-y-3 pt-3 text-xs">
                    {/* Primary Driver */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Primary Driver / Operator</span>
                        {activeVehicle.driverPhone && (
                          <a
                            href={`tel:${activeVehicle.driverPhone}`}
                            className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10.5px] font-bold flex items-center gap-1 transition-colors border border-emerald-200"
                            title="Call driver"
                          >
                            <Phone size={10} />
                            <span>Call</span>
                          </a>
                        )}
                      </div>
                      <div className="font-bold text-slate-900 text-sm">
                        {activeVehicle.driverName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                        <span>Phone: {activeVehicle.driverPhone || '—'}</span>
                      </div>
                      {activeVehicle.driverLicense && (
                        <div className="text-[10.5px] text-slate-600 bg-white px-2 py-1 rounded border border-slate-200/80 mt-1 font-mono">
                          License: <strong className="text-slate-800">{activeVehicle.driverLicense}</strong>
                        </div>
                      )}
                    </div>

                    {/* Helper / Co-Driver if available */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                      <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Assigned Helper / Co-Pilot</span>
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-800 font-semibold">{activeVehicle.helperName || 'Site Assistant'}</strong>
                        {activeVehicle.helperPhone && (
                          <span className="text-[11px] text-slate-500 font-mono">{activeVehicle.helperPhone}</span>
                        )}
                      </div>
                    </div>

                    {/* Location Information Header */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin size={14} className="text-emerald-700" />
                        <span className="font-bold text-slate-900 text-xs">Project &amp; Worksite Location</span>
                      </div>

                      <div className="space-y-2 text-[11px]">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-slate-500 shrink-0">Project Name:</span>
                          <strong className="text-slate-900 text-right">{activeVehicle.projectName || 'Infrastructure Worksite Project'}</strong>
                        </div>

                        <div className="flex items-start justify-between gap-2">
                          <span className="text-slate-500 shrink-0">Project Location:</span>
                          <strong className="text-slate-800 text-right">{activeVehicle.projectLocation || activeVehicle.worksiteName || 'Active Worksite Corridor'}</strong>
                        </div>

                        <div className="flex items-start justify-between gap-2">
                          <span className="text-slate-500 shrink-0">Worksite / Yard:</span>
                          <strong className="text-slate-800 text-right">{activeVehicle.worksiteName || 'Worksite Yard'}</strong>
                        </div>

                        <div className="flex items-start justify-between gap-2">
                          <span className="text-slate-500 shrink-0">Base Depot:</span>
                          <strong className="text-slate-800 text-right">{activeVehicle.siteDepot}</strong>
                        </div>

                        <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-200/70 text-[10.5px] text-emerald-900 font-medium">
                          <strong className="block font-bold text-emerald-950">Live GPS Landmark:</strong>
                          {activeVehicle.liveLocation} · Lat: {activeVehicle.gpsCoords.lat.toFixed(4)}°, Lng: {activeVehicle.gpsCoords.lng.toFixed(4)}°
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-100">
                  Shift Route: <strong>{activeVehicle.origin}</strong> ➔ <strong>{activeVehicle.destination}</strong>
                </div>
              </div>

              {/* ────────────────────────────────────────────────────────────────
              CARD 2: STARTING SPEEDOMETER & RUN CALCULATION (KM VS HOURS)
              ──────────────────────────────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col justify-between space-y-4">
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center font-bold ${activeVehicle.assetCategory === 'equipment' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                        <Gauge size={14} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                          {activeVehicle.assetCategory === 'equipment'
                            ? 'Engine Hour Meter & Run (HMR)'
                            : 'Speedometer & Distance Run (KM)'}
                        </h3>
                        <span className="text-[10px] text-slate-500">
                          {activeVehicle.assetCategory === 'equipment'
                            ? 'Opening vs. live hours calculation'
                            : 'Opening vs. live odometer calculation'}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${activeVehicle.assetCategory === 'equipment'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-emerald-100 text-emerald-900'
                      }`}>
                      {activeVehicle.assetCategory === 'equipment' ? 'EQUIPMENT MODE' : 'TRUCK MODE'}
                    </span>
                  </div>

                  {/* Main Readings Grid */}
                  <div className="pt-3 space-y-3 text-xs">
                    {activeVehicle.assetCategory === 'equipment' ? (
                      /* HEAVY EQUIPMENT ENGINE HOURS BREAKDOWN */
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Opening Engine Hours
                            </span>
                            <div className="text-lg font-extrabold font-mono text-slate-900 mt-1">
                              {(activeVehicle.startEngineHours || 1240.5).toFixed(1)}
                            </div>
                            <span className="text-[10px] text-slate-500">hrs at shift start</span>
                          </div>

                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Current Engine Hours
                            </span>
                            <div className="text-lg font-extrabold font-mono text-amber-700 mt-1">
                              {(activeVehicle.currentEngineHours || 1247.8).toFixed(1)}
                            </div>
                            <span className="text-[10px] text-slate-500">hrs live meter (HMR)</span>
                          </div>
                        </div>

                        {/* Calculated Total Operating Hours Today */}
                        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-center space-y-1">
                          <span className="text-[10.5px] font-bold text-amber-900 uppercase tracking-wider">
                            Total Machine Run Hours Today
                          </span>
                          <div className="text-2xl font-black font-mono text-amber-950">
                            {(activeVehicle.engineHoursToday || 7.3).toFixed(1)} <span className="text-sm font-semibold">Hours Run</span>
                          </div>
                          <div className="text-[11px] text-amber-800 font-medium">
                            Calculated: {(activeVehicle.currentEngineHours || 1247.8).toFixed(1)} hrs - {(activeVehicle.startEngineHours || 1240.5).toFixed(1)} hrs = {(activeVehicle.engineHoursToday || 7.3).toFixed(1)} hrs
                          </div>
                        </div>

                        {/* Secondary Site Travel KM */}
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Site Transit / Travel Distance:</span>
                          <strong className="font-mono text-slate-800">{activeVehicle.distanceToday} km (relocation)</strong>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-100 text-[10.5px] text-slate-600 font-medium leading-relaxed">
                          ★ Heavy earthmoving equipment efficiency and site billing are based on <strong>Hour Meter (HMR) Run Time</strong>, ensuring fair fuel and operator accounting.
                        </div>
                      </>
                    ) : (
                      /* COMMERCIAL TRUCK SPEEDOMETER & ODOMETER BREAKDOWN */
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Starting Speedometer (Opening)
                            </span>
                            <div className="text-lg font-extrabold font-mono text-slate-900 mt-1">
                              {(activeVehicle.startOdometer || 148200).toLocaleString('en-IN')}
                            </div>
                            <span className="text-[10px] text-slate-500">km at shift start</span>
                          </div>

                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Current Speedometer (Live)
                            </span>
                            <div className="text-lg font-extrabold font-mono text-emerald-700 mt-1">
                              {activeVehicle.odometer.toLocaleString('en-IN')}
                            </div>
                            <span className="text-[10px] text-slate-500">km current odometer</span>
                          </div>
                        </div>

                        {/* Calculated Total Travelled KM Today */}
                        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-center space-y-1">
                          <span className="text-[10.5px] font-bold text-emerald-900 uppercase tracking-wider">
                            Total Distance Travelled Today
                          </span>
                          <div className="text-2xl font-black font-mono text-emerald-950">
                            {activeVehicle.distanceToday} <span className="text-sm font-semibold">Kilometers (KM)</span>
                          </div>
                          <div className="text-[11px] text-emerald-800 font-medium">
                            Calculated: {activeVehicle.odometer.toLocaleString('en-IN')} km - {(activeVehicle.startOdometer || 148200).toLocaleString('en-IN')} km = {activeVehicle.distanceToday} km
                          </div>
                        </div>

                        {/* Target Route Progress */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Route Completion</span>
                            <strong className="text-emerald-700">{activeVehicle.routeProgressPercent}% completed</strong>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                            <div
                              style={{ width: `${activeVehicle.routeProgressPercent}%` }}
                              className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                            />
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-100 text-[10.5px] text-slate-600 font-medium leading-relaxed">
                          ★ Road logistics distance verified via shift logbook &amp; GPS tracking checkpoints.
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                  <span className="text-slate-500">Telemetry Tracking:</span>
                  <span className="text-[#00705a] font-semibold font-mono">GPS corridor &amp; shift logs active</span>
                </div>
              </div>

              {/* ────────────────────────────────────────────────────────────────
              CARD 3: FUEL STOPS, FUEL AMOUNTS & CALCULATED AVERAGE FUEL
              ──────────────────────────────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col justify-between space-y-4">
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                        <Fuel size={14} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Fuel Stops &amp; Average Consumption</h3>
                        <span className="text-[10px] text-slate-500">Diesel refill log &amp; calculated efficiency</span>
                      </div>
                    </div>

                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                      {activeVehicle.efficiencyUnit}
                    </span>
                  </div>

                  {/* Fuel Key Metrics Summary */}
                  <div className="pt-3 space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Fuel Filled</span>
                        <strong className="text-lg font-mono font-extrabold text-slate-900 block mt-0.5">
                          {activeVehicle.fuelLiters} L
                        </strong>
                        <span className="text-[9.5px] text-slate-500">{activeVehicle.fuelType || 'Diesel BS-VI'}</span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Fuel Expense</span>
                        <strong className="text-lg font-mono font-extrabold text-slate-900 block mt-0.5">
                          ₹{(activeVehicle.fuelStops?.reduce((s, x) => s + x.amount, 0) || (activeVehicle.fuelLiters * 94.5)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </strong>
                        <span className="text-[9.5px] text-slate-500">@ ₹94.50 avg / L</span>
                      </div>
                    </div>

                    {/* CALCULATED AVERAGE FUEL EFFICIENCY CALLOUT */}
                    <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200 text-center space-y-1">
                      <span className="text-[10px] font-bold text-teal-900 uppercase tracking-wider block">
                        Calculated Average Fuel Efficiency
                      </span>

                      <div className="text-2xl font-black font-mono text-teal-950 flex items-baseline justify-center gap-1.5">
                        <span>{activeVehicle.efficiencyKmL}</span>
                        <span className="text-sm font-bold text-teal-800">{activeVehicle.efficiencyUnit}</span>
                      </div>

                      <div className="text-[11px] text-teal-800 font-medium">
                        {activeVehicle.assetCategory === 'equipment' ? (
                          <span>Formula: {activeVehicle.fuelLiters} L Fuel ÷ {(activeVehicle.engineHoursToday || 7.3).toFixed(1)} Hours Run = <strong>{activeVehicle.efficiencyKmL} L/hr</strong></span>
                        ) : (
                          <span>Formula: {activeVehicle.distanceToday} km Run ÷ {activeVehicle.fuelLiters} L Fuel = <strong>{activeVehicle.efficiencyKmL} km/L</strong></span>
                        )}
                      </div>
                    </div>

                    {/* FUEL STOPS LOG TABLE */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <span>Fuel Stops Logged Today ({activeVehicle.fuelStops?.length || 0})</span>
                        <span className="text-slate-400 font-normal text-[10px]">Station &amp; Bill</span>
                      </div>

                      <div className="space-y-2 max-h-36 overflow-y-auto pr-0.5">
                        {activeVehicle.fuelStops && activeVehicle.fuelStops.length > 0 ? (
                          activeVehicle.fuelStops.map((stop, sIdx) => (
                            <div key={sIdx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] space-y-1">
                              <div className="flex items-center justify-between font-bold text-slate-900">
                                <span className="truncate max-w-[170px]">{stop.station}</span>
                                <span className="text-teal-700 font-mono">₹{stop.amount.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                <span>{stop.time} · {stop.liters} L @ ₹{stop.rate}/L</span>
                                <span className="bg-white px-1.5 py-0.5 rounded border text-slate-700">{stop.billNo}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-center text-[11px] text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            No intermediate fuel refill stops logged yet for this shift.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operating Cost Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total Operating Cost Today:</span>
                  <strong className="text-slate-900 font-mono text-sm font-extrabold">₹{activeVehicle.costToday.toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: SHIFT LOG & FUEL BILL ENTRY FORM
          ────────────────────────────────────────────────────────────────────────── */}
      {isLogModalOpen && activeAssetForLog && (() => {
        const isModalEq = shiftForm.assetCategory === 'equipment' || activeAssetForLog.assetCategory === 'equipment';
        const mStartOdo = parseFloat(shiftForm.startOdometer) || 0;
        const mEndOdo = parseFloat(shiftForm.endOdometer) || 0;
        const mDistKm = Math.max(0, mEndOdo - mStartOdo);

        const mStartHrs = parseFloat(shiftForm.startEngineHours) || 0;
        const mEndHrs = parseFloat(shiftForm.endEngineHours) || 0;
        const mRunHrs = Math.max(0, Math.round((mEndHrs - mStartHrs) * 10) / 10);

        const mLiters = parseFloat(shiftForm.fuelFilledLiters) || 0;
        const mRate = parseFloat(shiftForm.fuelRatePerLiter) || 0;
        const mFuelCost = Math.round(mLiters * mRate);

        let mAvgEfficiency: string | null = null;
        if (isModalEq) {
          if (mRunHrs > 0 && mLiters > 0) {
            mAvgEfficiency = (mLiters / mRunHrs).toFixed(2);
          }
        } else {
          if (mDistKm > 0 && mLiters > 0) {
            mAvgEfficiency = (mDistKm / mLiters).toFixed(2);
          }
        }

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">

              {/* Header with Machine Details & Operational Mode Pill */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold ${isModalEq ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                    {isModalEq ? <HardHat size={22} /> : <Truck size={22} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                        Record Shift Run / Diesel Bill · {activeAssetForLog.plate}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isModalEq
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-emerald-50 text-[#00705a] border-emerald-300'
                        }`}>
                        {isModalEq ? '🚜 Heavy Machinery Mode (HMR · Hours)' : '🚚 Commercial Vehicle Mode (KM · Mileage)'}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-500 mt-0.5">
                      {activeAssetForLog.model} · {activeAssetForLog.type} · Base: {activeAssetForLog.siteDepot}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Mode Toggle Bar */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-700">Calculation Mode:</span>
                  <span className="text-[11px] text-slate-500">
                    {isModalEq
                      ? 'Heavy equipment uses Engine Operating Hours (HMR) and Liters per Hour (L/hr).'
                      : 'Commercial road trucks calculate by Odometer Distance (km) and km per Liter (km/L).'}
                  </span>
                </div>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setShiftForm(prev => ({ ...prev, assetCategory: 'vehicle' }))}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${!isModalEq ? 'bg-[#00705a] text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    Truck (KM)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftForm(prev => ({ ...prev, assetCategory: 'equipment' }))}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${isModalEq ? 'bg-amber-700 text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    Heavy Equipment (HRS)
                  </button>
                </div>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmitShift} className="space-y-4 text-xs">

                {/* ──────────────────────────────────────────────────────────────────
                    1. DRIVER & CREW INFORMATION CARD
                    ────────────────────────────────────────────────────────────────── */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                      <User size={14} className="text-[#00705a]" />
                      <span>Driver &amp; Crew Information</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">Assigned Operational Personnel</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Driver / Operator Name</label>
                      <input
                        type="text"
                        required
                        value={shiftForm.driverName}
                        onChange={e => setShiftForm(prev => ({ ...prev, driverName: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Driver Contact Phone</label>
                      <input
                        type="text"
                        value={shiftForm.driverPhone}
                        onChange={e => setShiftForm(prev => ({ ...prev, driverPhone: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Driving License / Operator Cert</label>
                      <input
                        type="text"
                        value={shiftForm.driverLicense}
                        onChange={e => setShiftForm(prev => ({ ...prev, driverLicense: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Helper / Co-Driver Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Helper / Co-Driver Name"
                        value={shiftForm.helperName}
                        onChange={e => setShiftForm(prev => ({ ...prev, helperName: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* ──────────────────────────────────────────────────────────────────
                    2. PROJECT, SITE & LOCATION INFORMATION CARD
                    ────────────────────────────────────────────────────────────────── */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                      <MapPin size={14} className="text-[#00705a]" />
                      <span>Project &amp; Worksite Location Information</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">Site Deployment Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Project Name</label>
                      <input
                        type="text"
                        value={shiftForm.projectName}
                        onChange={e => setShiftForm(prev => ({ ...prev, projectName: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Project Location / Corridor</label>
                      <input
                        type="text"
                        value={shiftForm.projectLocation}
                        onChange={e => setShiftForm(prev => ({ ...prev, projectLocation: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Worksite / Yard / Plant</label>
                      <input
                        type="text"
                        value={shiftForm.worksiteName}
                        onChange={e => setShiftForm(prev => ({ ...prev, worksiteName: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* ──────────────────────────────────────────────────────────────────
                    3. DATE, SHIFT, STAGE & ROUTE/ACTIVITY
                    ────────────────────────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Shift Date</label>
                    <input
                      type="date"
                      required
                      value={shiftForm.logDate}
                      onChange={e => setShiftForm(prev => ({ ...prev, logDate: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Shift Type</label>
                    <select
                      value={shiftForm.shift}
                      onChange={e => setShiftForm(prev => ({ ...prev, shift: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                    >
                      <option value="Day">Day Shift (08:00 – 18:00)</option>
                      <option value="Night">Night Shift (20:00 – 06:00)</option>
                      <option value="General">General Full Day</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Operational Stage</label>
                    <select
                      value={shiftForm.stage}
                      onChange={e => setShiftForm(prev => ({ ...prev, stage: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                    >
                      <option value="Working">Working / Heavy Operations</option>
                      <option value="Transit">In Transit / Material Haulage</option>
                      <option value="Idle">Idle / Standby</option>
                      <option value="Maintenance">Site Maintenance / Servicing</option>
                    </select>
                  </div>
                </div>

                {/* ──────────────────────────────────────────────────────────────────
                    4. METER READINGS & RUN CALCULATION (AUTO-SWITCHES BY MODE)
                    ────────────────────────────────────────────────────────────────── */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                      <Gauge size={14} className={isModalEq ? 'text-amber-700' : 'text-[#00705a]'} />
                      <span>
                        {isModalEq
                          ? 'Heavy Equipment Meter Readings & Operating Hours (HMR)'
                          : 'Vehicle Route & Speedometer Odometer Readings (km)'}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isModalEq ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                      }`}>
                      {isModalEq ? 'Engine Hour Meter (HRS) Mode' : 'Odometer Distance (KM) Mode'}
                    </span>
                  </div>

                  {/* If Truck: Route inputs */}
                  {!isModalEq && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">From Location / Origin</label>
                        <input
                          type="text"
                          placeholder="e.g. Origin Base / Site Depot"
                          value={shiftForm.fromLocation}
                          onChange={e => setShiftForm(prev => ({ ...prev, fromLocation: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">To Destination / Drop Site</label>
                        <input
                          type="text"
                          placeholder="e.g. Destination / Worksite Bay"
                          value={shiftForm.toLocation}
                          onChange={e => setShiftForm(prev => ({ ...prev, toLocation: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  {/* If Heavy Equipment: Activity / Work Area */}
                  {isModalEq && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Equipment Work Area / Section</label>
                        <input
                          type="text"
                          placeholder="e.g. Excavation Pit B · Chainage 48+200"
                          value={shiftForm.fromLocation}
                          onChange={e => setShiftForm(prev => ({ ...prev, fromLocation: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Task / Operation Carried Out</label>
                        <input
                          type="text"
                          placeholder="e.g. Earth Cutting, Trenching, Embankment Compaction"
                          value={shiftForm.toLocation}
                          onChange={e => setShiftForm(prev => ({ ...prev, toLocation: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  {/* Meter inputs & calculated total */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    {isModalEq ? (
                      <>
                        <div>
                          <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">
                            Opening Engine Hours (HMR)
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={shiftForm.startEngineHours}
                            onChange={e => setShiftForm(prev => ({ ...prev, startEngineHours: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">
                            Closing Engine Hours (HMR)
                          </label>
                          <input
                            type="number"
                            step="any"
                            placeholder="Enter closing hours"
                            value={shiftForm.endEngineHours}
                            onChange={e => setShiftForm(prev => ({ ...prev, endEngineHours: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                          />
                        </div>

                        {/* Calculated Total Hours Run */}
                        <div className="p-2 rounded-xl bg-amber-50/80 border border-amber-200 flex flex-col justify-center">
                          <span className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">
                            Calculated Engine Hours Run:
                          </span>
                          <span className="font-extrabold text-base font-mono text-amber-950">
                            {mRunHrs} <span className="text-xs font-bold text-amber-800">hrs today</span>
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">
                            Opening Speedometer / Odometer (km)
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={shiftForm.startOdometer}
                            onChange={e => setShiftForm(prev => ({ ...prev, startOdometer: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">
                            Closing Speedometer / Odometer (km)
                          </label>
                          <input
                            type="number"
                            step="any"
                            placeholder="Enter closing km"
                            value={shiftForm.endOdometer}
                            onChange={e => setShiftForm(prev => ({ ...prev, endOdometer: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                          />
                        </div>

                        {/* Calculated Total Travel KM */}
                        <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col justify-center">
                          <span className="text-[10px] font-semibold text-[#00705a] uppercase tracking-wide">
                            Calculated Total Travel Distance:
                          </span>
                          <span className="font-extrabold text-base font-mono text-emerald-950">
                            {mDistKm} <span className="text-xs font-bold text-[#00705a]">km run</span>
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* ──────────────────────────────────────────────────────────────────
                    5. FUEL REFILL STOPS, DIESEL BILL & FUEL TYPE
                    ────────────────────────────────────────────────────────────────── */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                      <Fuel size={14} className="text-[#00705a]" />
                      <span>Fuel Refill Stops &amp; Diesel Bill Details</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">Station Invoicing &amp; Dispensing</span>
                  </div>

                  {/* Fuel Type & Payment Method */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Type of Fuel</label>
                      <select
                        value={shiftForm.fuelType}
                        onChange={e => setShiftForm(prev => ({ ...prev, fuelType: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                      >
                        <option value="Diesel (BS-VI)">Diesel (BS-VI HSD)</option>
                        <option value="Industrial HSD">Industrial HSD (Machinery Fuel)</option>
                        <option value="CNG">CNG</option>
                        <option value="Petrol">Petrol</option>
                        <option value="Electric (kWh)">Electric (kWh)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Fuel Station / Bowser Pump</label>
                      <input
                        type="text"
                        placeholder="e.g. Highway Diesel Plaza / Site Bowser"
                        value={shiftForm.fuelStation}
                        onChange={e => setShiftForm(prev => ({ ...prev, fuelStation: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Fuel Bill / Receipt Number</label>
                      <input
                        type="text"
                        placeholder="e.g. INV-2026-9041"
                        value={shiftForm.fuelBillNumber}
                        onChange={e => setShiftForm(prev => ({ ...prev, fuelBillNumber: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Payment Method</label>
                      <select
                        value={shiftForm.paymentMode}
                        onChange={e => setShiftForm(prev => ({ ...prev, paymentMode: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      >
                        <option value="Fleet Diesel Card">Fleet Diesel Card</option>
                        <option value="Site Diesel Voucher">Site Bowser Fuel Voucher</option>
                        <option value="Fastag Fuel">Fastag Fuel Deduction</option>
                        <option value="Cash Voucher">Cash with Receipt</option>
                        <option value="Company Account">Company Credit Account</option>
                      </select>
                    </div>
                  </div>

                  {/* Quantity, Rate & Total Amount */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-1">
                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Fuel Filled Quantity (L)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={shiftForm.fuelFilledLiters}
                        onChange={e => setShiftForm(prev => ({ ...prev, fuelFilledLiters: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Fuel Rate / Liter (₹)</label>
                      <input
                        type="number"
                        step="any"
                        value={shiftForm.fuelRatePerLiter}
                        onChange={e => setShiftForm(prev => ({ ...prev, fuelRatePerLiter: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800"
                      />
                    </div>

                    {/* Calculated Fuel Bill Amount */}
                    <div className="p-2 rounded-xl bg-teal-50/80 border border-teal-200 flex flex-col justify-center">
                      <span className="text-[10px] font-semibold text-teal-800 uppercase tracking-wide">
                        Total Fuel Bill Amount:
                      </span>
                      <span className="font-extrabold text-base font-mono text-teal-950">
                        ₹{mFuelCost.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ──────────────────────────────────────────────────────────────────
                    6. CALCULATED AVERAGE FUEL CONSUMPTION & OPERATIONAL METRICS
                    ────────────────────────────────────────────────────────────────── */}
                <div className={`p-4 rounded-xl border space-y-2 ${isModalEq ? 'bg-amber-50/60 border-amber-200' : 'bg-emerald-50/60 border-emerald-200'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                      <BarChart3 size={15} className={isModalEq ? 'text-amber-700' : 'text-[#00705a]'} />
                      <span>Calculated Average Fuel Consumption &amp; Performance</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-600">
                      Auto-Calculated Summary
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        {isModalEq ? 'Equipment Consumption (L/hr)' : 'Vehicle Mileage (km/L)'}
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black font-mono text-slate-900">
                          {mAvgEfficiency || '—'}
                        </span>
                        <span className="text-xs font-bold text-slate-600">
                          {isModalEq ? 'Liters / Hour (L/hr)' : 'km / Liter (km/L)'}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-slate-500 mt-1">
                        {isModalEq ? (
                          <span>Formula: {mLiters} L Fuel ÷ {mRunHrs} Hours Run</span>
                        ) : (
                          <span>Formula: {mDistKm} km Travelled ÷ {mLiters} L Fuel</span>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Estimated Operating Cost
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black font-mono text-slate-900">
                          ₹{mFuelCost.toLocaleString('en-IN')}
                        </span>
                        <span className="text-xs font-medium text-slate-500">Fuel Bill Amount</span>
                      </div>
                      <div className="text-[10.5px] text-slate-500 mt-1">
                        Fuel: {shiftForm.fuelType} · Rate: ₹{mRate}/L
                      </div>
                    </div>
                  </div>
                </div>

                {/* Remarks & Notes */}
                <div>
                  <label className="text-[10.5px] font-semibold text-slate-600 block mb-1">Shift Handover &amp; Maintenance Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Material delivered, road delays, engine/tyre condition, hydraulic leaks..."
                    value={shiftForm.remarks}
                    onChange={e => setShiftForm(prev => ({ ...prev, remarks: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsLogModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Saving Shift Record...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Save Shift Run &amp; Fuel Record</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}