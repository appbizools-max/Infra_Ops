import React, { useState, useEffect, useMemo } from 'react';
import {
  Route, Milestone, MapPin, Truck, Train, Box, Plus, Search,
  RefreshCw, CheckCircle2, ArrowRight, ArrowRightLeft, Users, HardHat,
  ChevronRight, Calendar, AlertCircle, Info, X, ShieldCheck, Gauge,
  Activity, Layers, Building2, Package, Sparkles, Trash2, UserCheck,
  Fuel, Navigation, Compass, Sliders, Settings2, ArrowUpRight, Check,
  Maximize2
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';

interface CorridorLeg {
  id: number;
  corridorId: number;
  legSequence: number;
  legName: string;
  originName: string;
  originType: string;
  destinationName: string;
  destinationType: string;
  transportMode: 'Road' | 'Rail' | 'Conveyor' | 'Waterway';
  distanceKm: number;
  estimatedTatHours: number;
  transshipmentRequired: boolean;
  leadTransporter?: string;
  allowedShrinkagePercent?: number;
}

interface CorridorAsset {
  id: number;
  corridorId: number;
  legId?: number;
  assetType: 'vehicle' | 'heavy_equipment';
  assetId: string;
  assetNumber: string;
  assetTitle: string;
  assignedPersonName: string;
  assignedPersonPhone: string;
  assignedPersonRole: string;
  shift: string;
  operatingStatus: string;
}

interface OperationsCorridor {
  id: number;
  corridorCode: string;
  name: string;
  projectId: string;
  projectName: string;
  projectHead?: string;
  siteManager?: string;
  topologyType: 'RELAY_MULTIMODAL' | 'MULTI_LOAD_SINGLE_UNLOAD' | 'SINGLE_LOAD_MULTI_UNLOAD';
  description: string;
  originSummary: string;
  destinationSummary: string;
  transshipmentHub: string;
  totalDistanceKm: number;
  estimatedCycleTimeHours: number;
  status: string;
  createdAt: string;
  legsCount?: number;
  assetsCount?: number;
  legs?: CorridorLeg[];
  assets?: CorridorAsset[];
}

interface IntermediateStop {
  id: string;
  name: string;
  type: string;
  transportMode: 'Road' | 'Rail';
  distanceKm: number;
  estimatedTatHours: number;
  transshipmentRequired: boolean;
  leadTransporter: string;
}

interface AssignedFleetItem {
  id: string;
  assetType: 'vehicle' | 'heavy_equipment';
  assetId: string;
  assetNumber: string;
  assetTitle: string;
  assignedPersonName: string;
  assignedPersonPhone: string;
  assignedPersonRole: string;
  shift: string;
  operatingStatus: string;
}

export default function OperationsCorridorsPage() {
  const { currentUser } = useAuth();
  const [corridors, setCorridors] = useState<OperationsCorridor[]>([]);
  const [selectedCorridor, setSelectedCorridor] = useState<OperationsCorridor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeLegIndex, setActiveLegIndex] = useState<number | null>(null);

  // Modals
  const [isCreateCorridorOpen, setIsCreateCorridorOpen] = useState(false);
  const [isAssignAssetOpen, setIsAssignAssetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Studio Lists for Dropdowns
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [worksitesList, setWorksitesList] = useState<any[]>([]);
  const [stockyardsList, setStockyardsList] = useState<any[]>([]);
  const [teamList, setTeamList] = useState<any[]>([]);
  const [vehiclesList, setVehiclesList] = useState<any[]>([]);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [submittingBlueprint, setSubmittingBlueprint] = useState(false);

  // Studio Form State
  const [selectedProjectId, setSelectedProjectId] = useState('PRJ-001');
  const [selectedProjectName, setSelectedProjectName] = useState('Delhi Metro Rail Project (Phase IV)');
  const [corridorName, setCorridorName] = useState('');
  const [corridorCode, setCorridorCode] = useState('CORR-BIZA-0001-280');
  const [topologyType, setTopologyType] = useState<'RELAY_MULTIMODAL' | 'MULTI_LOAD_SINGLE_UNLOAD' | 'SINGLE_LOAD_MULTI_UNLOAD'>('RELAY_MULTIMODAL');

  // Transport Methods & Dynamic Project Sync State
  const [projectTransportModes, setProjectTransportModes] = useState<string[]>(['Road']);
  const [selectedTransportModes, setSelectedTransportModes] = useState<string[]>(['Road', 'Rail']);
  const [modePromptModal, setModePromptModal] = useState<{ isOpen: boolean; mode: string } | null>(null);
  const [syncProjectTransportModes, setSyncProjectTransportModes] = useState(false);

  // Loading Point (Origin) & Unloading Station (Destination)
  const [originWorksite, setOriginWorksite] = useState('Rewa Quarry Face (Loading Pit)');
  const [originType, setOriginType] = useState('Loading Pit');
  const [destinationWorksite, setDestinationWorksite] = useState('Noida Sector-62 Metro Depot Site');
  const [destinationType, setDestinationType] = useState('Delivery Site');
  const [originLegMode, setOriginLegMode] = useState<'Road' | 'Rail'>('Road');
  const [originLegDistance, setOriginLegDistance] = useState<number>(48.5);
  const [originLegTat, setOriginLegTat] = useState<number>(2.5);

  // Dynamic Intermediate Stops
  const [stops, setStops] = useState<IntermediateStop[]>([
    {
      id: 'stop-1',
      name: 'Satna Rail Siding & Freight Hub',
      type: 'Rail Siding',
      transportMode: 'Rail',
      distanceKm: 680,
      estimatedTatHours: 18,
      transshipmentRequired: true,
      leadTransporter: 'Indian Railways / DFCC'
    }
  ]);

  // Project Leadership & Site Supervision
  const [projectHead, setProjectHead] = useState('');
  const [siteManager, setSiteManager] = useState('');

  // Fleet & Heavy Equipment Assignments inside Studio
  const [assignedFleet, setAssignedFleet] = useState<AssignedFleetItem[]>([]);
  const [studioAssetType, setStudioAssetType] = useState<'vehicle' | 'heavy_equipment'>('vehicle');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedShift, setSelectedShift] = useState('Day Shift');
  const [driverNameInput, setDriverNameInput] = useState('');
  const [driverPhoneInput, setDriverPhoneInput] = useState('');

  // Assign Asset Modal (Existing secondary modal)
  const [assetForm, setAssetForm] = useState({
    legId: '',
    assetType: 'vehicle' as 'vehicle' | 'heavy_equipment',
    assetNumber: '',
    assetTitle: '',
    assignedPersonName: '',
    assignedPersonPhone: '',
    assignedPersonRole: 'Driver',
    shift: 'Day Shift'
  });

  // Extract transport modes defined on a project
  const extractProjectModes = (p: any): string[] => {
    if (!p) return ['Road'];
    if (p.transport_modes) {
      return p.transport_modes.split(',').map((m: string) => m.trim()).filter(Boolean);
    }
    if (p.transportModes) {
      return p.transportModes.split(',').map((m: string) => m.trim()).filter(Boolean);
    }
    if (p.other_data) {
      try {
        const parsed = typeof p.other_data === 'string' ? JSON.parse(p.other_data) : p.other_data;
        if (parsed.transportModes) {
          return parsed.transportModes.split(',').map((m: string) => m.trim()).filter(Boolean);
        }
      } catch (_) { }
    }
    return ['Road'];
  };

  // Filter worksites to only those tied to the selected project
  const projectWorksites = useMemo(() => {
    if (!selectedProjectId) return worksitesList;
    const filtered = worksitesList.filter(w => {
      const wPid = String(w.project_id || w.projectId || '');
      const sPid = String(selectedProjectId || '');
      const wPName = String(w.projectName || w.project_name || '').toLowerCase();
      const sPName = String(selectedProjectName || '').toLowerCase();
      return (wPid && wPid === sPid) || (wPName && sPName && wPName === sPName);
    });
    return filtered.length > 0 ? filtered : worksitesList;
  }, [worksitesList, selectedProjectId, selectedProjectName]);

  // Strict Filter: Only vehicles with an assigned driver can be selected
  const assignedDriverVehicles = useMemo(() => {
    return vehiclesList.filter(v => {
      const dName = (v.assignedDriverName || v.assigned_driver_name || v.driverName || v.driver_name || '').trim();
      return dName.length > 0;
    });
  }, [vehiclesList]);

  // Strict Filter: Only heavy equipment with an assigned operator can be selected
  const assignedOperatorEquipment = useMemo(() => {
    return equipmentList.filter(e => {
      const opName = (e.assignedOperatorName || e.assigned_operator_name || e.operatorName || '').trim();
      return opName.length > 0;
    });
  }, [equipmentList]);

  const loadStudioData = async () => {
    try {
      const uid = currentUser?.uid || '1';
      const [pRes, wRes, sRes, tRes, vRes, eRes] = await Promise.all([
        apiFetch(`/api/tenant/projects/${uid}`).catch(() => null),
        apiFetch(`/api/tenant/worksites/${uid}`).catch(() => null),
        apiFetch(`/api/tenant/stockyards`).catch(() => null),
        apiFetch(`/api/tenant/team`).catch(() => null),
        apiFetch(`/api/tenant/vehicles`).catch(() => null),
        apiFetch(`/api/tenant/heavy-equipment`).catch(() => null)
      ]);

      let pData: any[] = [];
      let wData: any[] = [];
      let sData: any[] = [];
      let tData: any[] = [];
      let vData: any[] = [];
      let eData: any[] = [];

      if (pRes && pRes.ok) pData = await pRes.json();
      if (wRes && wRes.ok) wData = await wRes.json();
      if (sRes && sRes.ok) sData = await sRes.json();
      if (tRes && tRes.ok) tData = await tRes.json();
      if (vRes && vRes.ok) vData = await vRes.json();
      if (eRes && eRes.ok) eData = await eRes.json();

      setProjectsList(Array.isArray(pData) ? pData : []);
      setWorksitesList(Array.isArray(wData) ? wData : []);
      setStockyardsList(Array.isArray(sData) ? sData : []);
      setTeamList(Array.isArray(tData) ? tData : []);
      setVehiclesList(Array.isArray(vData) ? vData : []);
      setEquipmentList(Array.isArray(eData) ? eData : []);

      // If initial states not set, initialize with first fetched records
      if (pData.length > 0 && (!selectedProjectId || selectedProjectId === 'PRJ-001')) {
        const firstPrj = pData[0];
        setSelectedProjectId(firstPrj.project_id || firstPrj.id.toString());
        setSelectedProjectName(firstPrj.name);
        if (!corridorName) setCorridorName(firstPrj.name);
        const pCode = ((firstPrj.project_id || 'BIZA').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'BIZA').toUpperCase().padEnd(4, 'A');
        setCorridorCode(`CORR-${pCode}-0001-280`);
        const pModes = extractProjectModes(firstPrj);
        setProjectTransportModes(pModes);
        setSelectedTransportModes(pModes);
      }
      if (wData.length > 0 && !originWorksite) {
        setOriginWorksite(wData[0].name);
        setDestinationWorksite(wData.length > 1 ? wData[1].name : wData[0].name);
      }
    } catch (err) {
      console.error('Failed to load studio auxiliary data:', err);
    }
  };

  const openDesignStudio = async () => {
    setIsCreateCorridorOpen(true);
    await loadStudioData();
  };

  const handleProjectSelect = (projId: string) => {
    const found = projectsList.find(p => (p.project_id || p.id.toString()) === projId);
    if (found) {
      setSelectedProjectId(found.project_id || found.id.toString());
      setSelectedProjectName(found.name);
      // Non-mandatory: default corridor name automatically to project name
      if (!corridorName || corridorName === selectedProjectName || corridorName.includes('Corridor') || corridorName.includes('Route')) {
        setCorridorName(found.name);
      }
      const pCode = ((found.project_id || 'BIZA').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'BIZA').toUpperCase().padEnd(4, 'A');
      setCorridorCode(`CORR-${pCode}-0001-280`);

      const pModes = extractProjectModes(found);
      setProjectTransportModes(pModes);
      setSelectedTransportModes(pModes.length > 0 ? pModes : ['Road']);
    } else {
      setSelectedProjectId(projId);
    }
  };

  // Toggle or add transport mode with Project Master synchronization prompt
  const handleToggleTransportMode = (mode: string) => {
    if (selectedTransportModes.includes(mode)) {
      if (selectedTransportModes.length > 1) {
        setSelectedTransportModes(selectedTransportModes.filter(m => m !== mode));
      }
    } else {
      const isProjectMode = projectTransportModes.some(m => m.toLowerCase() === mode.toLowerCase());
      if (!isProjectMode) {
        // Mode not yet registered in project -> Show confirmation prompt!
        setModePromptModal({ isOpen: true, mode });
      } else {
        setSelectedTransportModes([...selectedTransportModes, mode]);
      }
    }
  };

  const handleConfirmModeSync = (action: 'update_project' | 'corridor_only') => {
    if (!modePromptModal) return;
    const { mode } = modePromptModal;
    if (action === 'update_project') {
      setProjectTransportModes(prev => [...new Set([...prev, mode])]);
      setSelectedTransportModes(prev => [...new Set([...prev, mode])]);
      setSyncProjectTransportModes(true);
      showToast(`Updated Project Master & enabled ${mode} transport.`);
    } else {
      setSelectedTransportModes(prev => [...new Set([...prev, mode])]);
      showToast(`Added ${mode} to this corridor blueprint only.`);
    }
    setModePromptModal(null);
  };

  const handleAddStop = () => {
    const newIdx = stops.length + 1;
    const defaultStopName = `Transit Siding / Transshipment Hub ${newIdx}`;

    const newStop: IntermediateStop = {
      id: 'stop-' + Date.now(),
      name: defaultStopName,
      type: newIdx % 2 === 1 ? 'Transshipment Hub' : 'Rail Siding',
      transportMode: newIdx % 2 === 1 ? 'Rail' : 'Road',
      distanceKm: 45.0,
      estimatedTatHours: 3.0,
      transshipmentRequired: true,
      leadTransporter: newIdx % 2 === 1 ? 'Indian Railways / DFCC' : 'InfraOps Dedicated Fleet'
    };
    setStops([...stops, newStop]);
  };

  const handleRemoveStop = (id: string) => {
    setStops(stops.filter(s => s.id !== id));
  };

  const handleUpdateStop = (id: string, updates: Partial<IntermediateStop>) => {
    setStops(stops.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleAssetSelectInStudio = (assetId: string) => {
    setSelectedAssetId(assetId);
    if (studioAssetType === 'vehicle') {
      const v = assignedDriverVehicles.find(item => item.id.toString() === assetId || item.vehicleNumber === assetId);
      if (v) {
        setDriverNameInput(v.assignedDriverName || v.assigned_driver_name || '');
        setDriverPhoneInput(v.assignedDriverPhone || v.assigned_driver_phone || '');
      }
    } else {
      const e = assignedOperatorEquipment.find(item => item.id.toString() === assetId || item.machineId === assetId);
      if (e) {
        setDriverNameInput(e.assignedOperatorName || e.assigned_operator_name || '');
        setDriverPhoneInput(e.assignedOperatorPhone || e.assigned_operator_phone || '');
      }
    }
  };

  const handleAddFleetToStudio = () => {
    if (!selectedAssetId) return;

    let num = '';
    let title = '';
    let role = studioAssetType === 'vehicle' ? 'Driver' : 'Heavy Operator';

    if (studioAssetType === 'vehicle') {
      const v = assignedDriverVehicles.find(item => item.id.toString() === selectedAssetId || item.vehicleNumber === selectedAssetId);
      num = v?.vehicleNumber || selectedAssetId;
      title = `${v?.make || ''} ${v?.model || 'Commercial Tipper'} (${v?.tonCapacity || 35}T)`.trim();
    } else {
      const e = assignedOperatorEquipment.find(item => item.id.toString() === selectedAssetId || item.machineId === selectedAssetId);
      num = e?.machineId || selectedAssetId;
      title = e?.equipmentName || 'Heavy Earthmoving Machine';
    }

    const newItem: AssignedFleetItem = {
      id: 'fleet-' + Date.now(),
      assetType: studioAssetType,
      assetId: selectedAssetId,
      assetNumber: num,
      assetTitle: title,
      assignedPersonName: driverNameInput || (studioAssetType === 'vehicle' ? 'Designated Driver' : 'Certified Operator'),
      assignedPersonPhone: driverPhoneInput || '+91 98000 00000',
      assignedPersonRole: role,
      shift: selectedShift,
      operatingStatus: 'Ready'
    };

    setAssignedFleet([...assignedFleet, newItem]);
    setSelectedAssetId('');
    setDriverNameInput('');
    setDriverPhoneInput('');
  };

  const handleRemoveFleetFromStudio = (id: string) => {
    setAssignedFleet(assignedFleet.filter(f => f.id !== id));
  };

  const fetchCorridors = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiFetch('/api/tenant/operations-corridors');
      if (res.ok) {
        const data = await res.json();
        const list: OperationsCorridor[] = Array.isArray(data) ? data : [];
        setCorridors(list);
        if (list.length > 0) {
          const firstId = selectedCorridor ? selectedCorridor.id : list[0].id;
          const detailRes = await apiFetch(`/api/tenant/operations-corridors/${firstId}`);
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            const single = Array.isArray(detailData) ? detailData[0] : detailData;
            setSelectedCorridor(single || null);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load corridors:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const selectCorridor = async (c: OperationsCorridor) => {
    try {
      const detailRes = await apiFetch(`/api/tenant/operations-corridors/${c.id}`);
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        const single = Array.isArray(detailData) ? detailData[0] : detailData;
        setSelectedCorridor(single || null);
        setActiveLegIndex(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCorridors();
    loadStudioData();
  }, []);

  const handlePublishBlueprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !originWorksite || !destinationWorksite) {
      alert('Please select project, loading origin point and destination unloading station.');
      return;
    }

    setSubmittingBlueprint(true);
    try {
      // Assemble Sequential Legs
      const generatedLegs: any[] = [];
      let totalDist = 0;
      let totalTat = 0;

      if (stops.length === 0) {
        // Direct Origin ➔ Destination
        generatedLegs.push({
          legSequence: 1,
          legName: `Leg 1: Direct Haulage (${originWorksite} to ${destinationWorksite})`,
          originName: originWorksite,
          originType: originType,
          destinationName: destinationWorksite,
          destinationType: destinationType,
          transportMode: originLegMode,
          distanceKm: originLegDistance,
          estimatedTatHours: originLegTat,
          transshipmentRequired: false,
          leadTransporter: originLegMode === 'Rail' ? 'Indian Railways / DFCC' : 'InfraOps Logistics Fleet'
        });
        totalDist += originLegDistance;
        totalTat += originLegTat;
      } else {
        // Leg 1: Origin ➔ Stop 1
        generatedLegs.push({
          legSequence: 1,
          legName: `Leg 1: Haulage to ${stops[0].name}`,
          originName: originWorksite,
          originType: originType,
          destinationName: stops[0].name,
          destinationType: stops[0].type,
          transportMode: originLegMode,
          distanceKm: originLegDistance,
          estimatedTatHours: originLegTat,
          transshipmentRequired: stops[0].transshipmentRequired,
          leadTransporter: originLegMode === 'Rail' ? 'Indian Railways / DFCC' : 'InfraOps Road Fleet'
        });
        totalDist += originLegDistance;
        totalTat += originLegTat;

        // Intermediate Legs: Stop i ➔ Stop i+1
        for (let i = 0; i < stops.length - 1; i++) {
          const curr = stops[i];
          const next = stops[i + 1];
          generatedLegs.push({
            legSequence: i + 2,
            legName: `Leg ${i + 2}: ${curr.name} to ${next.name}`,
            originName: curr.name,
            originType: curr.type,
            destinationName: next.name,
            destinationType: next.type,
            transportMode: curr.transportMode,
            distanceKm: curr.distanceKm,
            estimatedTatHours: curr.estimatedTatHours,
            transshipmentRequired: next.transshipmentRequired,
            leadTransporter: curr.leadTransporter || (curr.transportMode === 'Rail' ? 'Indian Railways / DFCC' : 'InfraOps Logistics')
          });
          totalDist += curr.distanceKm;
          totalTat += curr.estimatedTatHours;
        }

        // Final Leg: Last Stop ➔ Destination
        const lastStop = stops[stops.length - 1];
        const lastSeq = generatedLegs.length + 1;
        generatedLegs.push({
          legSequence: lastSeq,
          legName: `Leg ${lastSeq}: Final Delivery to ${destinationWorksite}`,
          originName: lastStop.name,
          originType: lastStop.type,
          destinationName: destinationWorksite,
          destinationType: destinationType,
          transportMode: lastStop.transportMode,
          distanceKm: lastStop.distanceKm,
          estimatedTatHours: lastStop.estimatedTatHours,
          transshipmentRequired: false,
          leadTransporter: lastStop.leadTransporter || (lastStop.transportMode === 'Rail' ? 'Indian Railways / DFCC' : 'InfraOps Road Fleet')
        });
        totalDist += lastStop.distanceKm;
        totalTat += lastStop.estimatedTatHours;
      }

      const finalCorridorName = (corridorName || '').trim() || selectedProjectName || 'Project Operations Corridor';

      const res = await apiFetch('/api/tenant/operations-corridors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corridorCode: corridorCode || `CORR-BIZ-${Date.now().toString().slice(-4)}`,
          name: finalCorridorName,
          projectId: selectedProjectId,
          projectName: selectedProjectName,
          projectHead: projectHead,
          siteManager: siteManager,
          topologyType: topologyType,
          originSummary: originWorksite,
          destinationSummary: destinationWorksite,
          transshipmentHub: stops.map(s => s.name).join(' ➔ ') || 'Direct Dispatch Route',
          totalDistanceKm: parseFloat(totalDist.toFixed(1)),
          estimatedCycleTimeHours: parseFloat(totalTat.toFixed(1)),
          firebaseUid: currentUser?.uid,
          legs: generatedLegs,
          assets: assignedFleet,
          syncProjectTransportModes: syncProjectTransportModes,
          transportModes: selectedTransportModes
        })
      });

      if (res.ok) {
        showToast('Operations Sketch & Corridor Blueprint successfully published!');
        setIsCreateCorridorOpen(false);
        fetchCorridors(true);
      } else {
        const errData = await res.json();
        alert('Failed to publish corridor blueprint: ' + (errData.error || 'Server error'));
      }
    } catch (err: any) {
      console.error(err);
      alert('Error saving corridor: ' + err.message);
    } finally {
      setSubmittingBlueprint(false);
    }
  };

  const handleAssignAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCorridor || !assetForm.assetNumber) return;
    try {
      const res = await apiFetch(`/api/tenant/operations-corridors/${selectedCorridor.id}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...assetForm,
          assetId: assetForm.assetNumber
        })
      });
      if (res.ok) {
        showToast('Asset & crew successfully assigned to corridor leg!');
        setIsAssignAssetOpen(false);
        setAssetForm({
          legId: '', assetType: 'vehicle', assetNumber: '', assetTitle: '',
          assignedPersonName: '', assignedPersonPhone: '', assignedPersonRole: 'Driver',
          shift: 'Day Shift'
        });
        selectCorridor(selectedCorridor);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const legs = selectedCorridor?.legs || [];
  const assets = selectedCorridor?.assets || [];

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-xl border border-slate-700 animate-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* CORRIDORS DIRECTORY & VISUAL INSPECTOR (WHEN STUDIO CLOSED) */}
      {!isCreateCorridorOpen && (
        <>
          {/* Header Banner */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#00705a] flex items-center justify-center font-bold shadow-sm">
                    <Route size={22} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Operations Sketch & Corridors</h1>
                    <p className="text-xs text-slate-500 font-medium">Multi-modal route blueprints, loading-unloading topologies & FMS asset bindings</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => fetchCorridors(true)}
                  className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                  title="Refresh corridors"
                >
                  <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={openDesignStudio}
                  className="flex items-center gap-2 bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-sm transition-all"
                >
                  <Plus size={16} />
                  <span>Design Operations Sketch</span>
                </button>
              </div>
            </div>

            {/* Topology Explainer Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/60 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700 shrink-0 mt-0.5">
                  <ArrowRightLeft size={16} />
                </div>
                <div>
                  <div className="font-black text-slate-900">Multi-Modal Relay</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Point A ➔ Rail ➔ Point B (Transshipment Hub) ➔ Road ➔ Point C (Site).</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/60 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 text-[#00705a] shrink-0 mt-0.5">
                  <Layers size={16} />
                </div>
                <div>
                  <div className="font-black text-slate-900">Multi-Loading ➔ Single Unload</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Multiple Quarry Pits & Borrow Areas feeding 1 Central Crushing Plant.</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/60 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-700 shrink-0 mt-0.5">
                  <Building2 size={16} />
                </div>
                <div>
                  <div className="font-black text-slate-900">Single Load ➔ Multi-Delivery</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">1 Port / Central Rail Terminal feeding 4 Highway Construction Sectors.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Corridor Selection Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {corridors.map(c => {
              const isSelected = selectedCorridor?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => selectCorridor(c)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left border transition-all shrink-0 ${isSelected
                    ? 'bg-white border-[#00705a] shadow-sm ring-1 ring-[#00705a]'
                    : 'bg-white/80 border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-emerald-50 text-[#00705a]' : 'bg-slate-100 text-slate-600'
                    }`}>
                    <Route size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">{c.name}</div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium mt-0.5">
                      <span className="font-bold text-slate-700">{c.corridorCode}</span>
                      <span>·</span>
                      <span>{c.projectName}</span>
                      <span>·</span>
                      <span>{c.totalDistanceKm} KM</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Corridor Blueprint Display */}
          {selectedCorridor && (
            <div className="space-y-6">

              {/* Corridor Profile Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-[#00705a] border border-emerald-200">
                        {selectedCorridor.corridorCode}
                      </span>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                        Project: {selectedCorridor.projectName}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Topology: {(selectedCorridor.topologyType || 'RELAY_MULTIMODAL').replace(/_/g, ' ')}
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-slate-900 mt-1.5">{selectedCorridor.name}</h2>
                    <p className="text-xs text-slate-500 mt-1">{selectedCorridor.description}</p>

                    {(selectedCorridor.projectHead || selectedCorridor.siteManager) && (
                      <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-xs">
                        {selectedCorridor.projectHead && (
                          <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                            <Users size={13} className="text-[#00705a]" />
                            <span className="font-semibold text-slate-400 text-[10px] uppercase">Project Head:</span>
                            <span className="font-bold text-slate-900">{selectedCorridor.projectHead}</span>
                          </div>
                        )}
                        {selectedCorridor.siteManager && (
                          <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                            <HardHat size={13} className="text-amber-600" />
                            <span className="font-semibold text-slate-400 text-[10px] uppercase">Site In-Charge:</span>
                            <span className="font-bold text-slate-900">{selectedCorridor.siteManager}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Total Distance & Cycle Time</div>
                      <div className="text-sm font-black text-slate-900">
                        {selectedCorridor.totalDistanceKm} KM · ~{selectedCorridor.estimatedCycleTimeHours} Hrs TAT
                      </div>
                    </div>
                    <button
                      onClick={() => setIsAssignAssetOpen(true)}
                      className="flex items-center gap-1.5 bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors shadow-sm"
                    >
                      <Plus size={14} />
                      <span>Assign Fleet / Equipment</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* VISUAL OPERATIONS SKETCH CANVAS (Interactive Pipeline) */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[#00705a]" />
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Interactive Operations Sketch</h3>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Click any leg to filter assigned vehicles & machinery
                  </span>
                </div>

                {/* Visual Vector Route Pipeline */}
                <div className="relative overflow-x-auto pb-4 pt-2">
                  <div className="min-w-[780px] flex items-center justify-between gap-2">
                    {legs.map((leg, idx) => {
                      const isLegActive = activeLegIndex === idx;
                      const isRail = leg.transportMode === 'Rail';
                      const legAssets = assets.filter(a => a.legId === leg.id);
                      const oType = leg.originType || '';

                      return (
                        <React.Fragment key={leg.id}>
                          {/* Station Node (Origin) */}
                          <div className="flex flex-col items-center shrink-0 w-44 text-center">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold transition-all shadow-xs ${oType.includes('Pit')
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : oType.includes('Siding') || oType.includes('Rail')
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-[#00705a] border border-emerald-200'
                              }`}>
                              {oType.includes('Rail') ? <Train size={22} /> : <MapPin size={22} />}
                            </div>
                            <div className="text-xs font-black text-slate-900 mt-2 line-clamp-1">{leg.originName}</div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                              {leg.originType}
                            </span>
                          </div>

                          {/* Corridor Vector Connector (Leg Segment) */}
                          <div
                            onClick={() => setActiveLegIndex(isLegActive ? null : idx)}
                            className={`flex-1 flex flex-col items-center cursor-pointer px-2 py-2 rounded-2xl border transition-all ${isLegActive
                              ? 'bg-emerald-50/60 border-[#00705a] shadow-xs'
                              : 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
                              }`}
                          >
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider mb-1">
                              {isRail ? (
                                <span className="flex items-center gap-1 text-blue-700">
                                  <Train size={12} /> DFCC Rail
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-emerald-800">
                                  <Truck size={12} /> Road Logistics
                                </span>
                              )}
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-600">{leg.distanceKm} KM</span>
                            </div>

                            {/* Arrow Link Vector with Mode Badge */}
                            <div className="w-full relative flex items-center justify-center my-1">
                              <div className={`w-full h-1.5 rounded-full ${isRail
                                ? 'bg-blue-500'
                                : 'bg-[#00705a]'
                                }`} />
                              <div className="absolute bg-white px-2 py-0.5 rounded-full text-[9px] font-black border border-slate-200 shadow-xs">
                                {leg.estimatedTatHours}h TAT
                              </div>
                            </div>

                            {/* Transshipment Indicator & Assigned Assets Badge */}
                            <div className="flex items-center gap-2 mt-1">
                              {leg.transshipmentRequired && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                  Transload Hub
                                </span>
                              )}
                              <span className="text-[9px] font-bold text-slate-600 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                {legAssets.length} Assets Assigned
                              </span>
                            </div>
                          </div>

                          {/* Final Destination Node on last leg */}
                          {idx === legs.length - 1 && (
                            <div className="flex flex-col items-center shrink-0 w-44 text-center">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold shadow-xs">
                                <Building2 size={22} />
                              </div>
                              <div className="text-xs font-black text-slate-900 mt-2 line-clamp-1">{leg.destinationName}</div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                                {leg.destinationType}
                              </span>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ASSIGNED FLEET & HEAVY MACHINERY MATRIX */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {activeLegIndex !== null
                        ? `Assigned Fleet & Operators for ${legs[activeLegIndex]?.legName}`
                        : `Corridor Fleet & Heavy Machinery Roster (${assets.length} Active Assets)`}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Commercial tippers, trailers, excavators & cranes deployed along this corridor</p>
                  </div>

                  {activeLegIndex !== null && (
                    <button
                      onClick={() => setActiveLegIndex(null)}
                      className="text-xs font-bold text-[#00705a] hover:underline"
                    >
                      Show All Corridor Assets
                    </button>
                  )}
                </div>

                {/* Asset Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(activeLegIndex !== null
                    ? assets.filter(a => a.legId === legs[activeLegIndex]?.id)
                    : assets
                  ).map(asset => {
                    const isVehicle = asset.assetType === 'vehicle';
                    return (
                      <div
                        key={asset.id}
                        className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 hover:border-slate-300 transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isVehicle
                            ? 'bg-emerald-50 text-[#00705a] border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                            {isVehicle ? <Truck size={11} /> : <HardHat size={11} />}
                            {isVehicle ? 'Haulage Truck' : 'Heavy Equipment'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">{asset.shift}</span>
                        </div>

                        <div>
                          <div className="text-sm font-black text-slate-900 font-mono">{asset.assetNumber}</div>
                          <div className="text-xs text-slate-500 font-medium">{asset.assetTitle}</div>
                        </div>

                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                          <div>
                            <div className="text-[10px] font-bold uppercase text-slate-400">{asset.assignedPersonRole}</div>
                            <div className="font-bold text-slate-800">{asset.assignedPersonName}</div>
                          </div>
                          <div className="text-right">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              {asset.operatingStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </>
      )}

      {/* MODAL 1: TRUE FULL SCREEN OPERATIONS SKETCH STUDIO */}
      {isCreateCorridorOpen && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col w-full animate-in fade-in duration-150">

          {/* STUDIO TOP COMMAND BAR (WHITE THEME) */}
          <div className="bg-white text-slate-900 px-6 py-4 flex flex-wrap items-center justify-between border-b border-slate-200 gap-4 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#00705a] border border-emerald-200 flex items-center justify-center font-bold shadow-xs">
                <Route size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-[#00705a] border border-emerald-200">
                    Operations Sketch Studio
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    {corridorCode || 'CORR-BIZA-0001-280'}
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                  Design Operations Sketch / Multi-Modal Corridor
                </h2>
              </div>
            </div>

            {/* Quick Metrics & Actions */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-3 text-xs text-slate-500 border-r border-slate-200 pr-4">
                <span>Project: <strong className="text-slate-800">{selectedProjectName}</strong></span>
                <span>·</span>
                <span>Distance: <strong className="text-slate-800">{originLegDistance + stops.reduce((a, b) => a + (b.distanceKm || 0), 0)} KM</strong></span>
                <span>·</span>
                <span>Fleet: <strong className="text-[#00705a]">{assignedFleet.length} Active</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateCorridorOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all border border-slate-200"
                >
                  Back to Directory
                </button>
                <button
                  type="button"
                  onClick={handlePublishBlueprint}
                  disabled={submittingBlueprint}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm hover:shadow disabled:opacity-50"
                >
                  {submittingBlueprint ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Publishing Blueprint...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Publish Corridor Blueprint</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* STUDIO WORKSPACE (Scrollable Grid in White Theme) */}
          <div className="p-4 sm:p-6 bg-slate-50/70 border-b border-slate-200">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* ─────────────────────────────────────────────────────────── */}
              {/* LEFT COLUMN: PROJECT, TRANSPORT METHODS & ROUTE (7 Cols)   */}
              {/* ─────────────────────────────────────────────────────────── */}
              <div className="lg:col-span-7 space-y-5">

                {/* SECTION 1: PROJECT REFERENCE & OPTIONAL CORRIDOR NAME */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900">
                      <Building2 size={16} className="text-[#00705a]" />
                      <span>1. Project Reference & Corridor Identity</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">Step 1 of 3</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Project Dropdown */}
                    <div>
                      <label className="font-bold text-slate-700 mb-1 block">
                        Project Reference <span className="text-emerald-600">*</span>
                      </label>
                      <select
                        value={selectedProjectId}
                        onChange={e => handleProjectSelect(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00705a]/20 focus:border-[#00705a] font-semibold text-slate-900"
                      >
                        {projectsList.map(p => (
                          <option key={p.id} value={p.project_id || p.id.toString()}>
                            {p.project_id ? `[${p.project_id}] ` : ''}{p.name}
                          </option>
                        ))}
                        {projectsList.length === 0 && (
                          <option value="PRJ-001">Delhi Metro Rail Project (Phase IV)</option>
                        )}
                      </select>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Loads project worksites, transport capabilities, and team.
                      </span>
                    </div>

                    {/* Corridor Name (Non-Mandatory / Defaults to Project Name) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700 block">
                          Corridor Name
                        </label>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          Optional
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder={`Defaults to "${selectedProjectName || 'Project Name'}"`}
                        value={corridorName}
                        onChange={e => setCorridorName(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00705a]/20 focus:border-[#00705a] font-medium text-slate-900 placeholder-slate-400"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Leave blank to automatically use project name.
                      </span>
                    </div>

                    {/* Corridor Blueprint Code */}
                    <div>
                      <label className="font-bold text-slate-700 mb-1 block">Corridor Blueprint Code</label>
                      <input
                        type="text"
                        placeholder="e.g., CORR-BIZA-0001-280"
                        value={corridorCode}
                        onChange={e => setCorridorCode(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00705a]/20 focus:border-[#00705a] font-mono text-[#00705a] font-bold"
                      />
                    </div>

                    {/* Topology Type */}
                    <div>
                      <label className="font-bold text-slate-700 mb-1 block">Route Topology Style</label>
                      <select
                        value={topologyType}
                        onChange={e => setTopologyType(e.target.value as any)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00705a]/20 focus:border-[#00705a] font-medium text-slate-900"
                      >
                        <option value="RELAY_MULTIMODAL">Multi-Modal Relay (Road ➔ Rail ➔ Road)</option>
                        <option value="MULTI_LOAD_SINGLE_UNLOAD">Multi-Loading ➔ Single Unload (Pits to Siding)</option>
                        <option value="SINGLE_LOAD_MULTI_UNLOAD">Single Load ➔ Multi-Delivery (Siding to Sites)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: METHODS OF TRANSPORT INVOLVED (DEDICATED SECTION) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900">
                        <Layers size={16} className="text-blue-600" />
                        <span>2. Methods of Transport Involved</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Select transport modes for this corridor. Adding modes not yet in the project prompts an automatic project sync.
                      </p>
                    </div>
                    {syncProjectTransportModes && (
                      <span className="text-[10px] font-bold text-[#00705a] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Project Sync Enabled
                      </span>
                    )}
                  </div>

                  {/* Mode Selector Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: 'Road', label: 'Road Haulage', desc: 'Tippers, Dumpers & Multi-Axle Trucks', icon: Truck },
                      { id: 'Rail', label: 'DFCC Rail', desc: 'Goods Rakes, Flat Wagons & Sidings', icon: Train },
                      { id: 'Waterway', label: 'Barge / Waterway', desc: 'Inland River Cargo & Coastal Barges', icon: Navigation },
                      { id: 'Conveyor', label: 'Conveyor Belt', desc: 'Overland Continuous Pipe Conveyor', icon: ArrowRightLeft }
                    ].map(mode => {
                      const isSelected = selectedTransportModes.includes(mode.id);
                      const isProjectDefault = projectTransportModes.some(m => m.toLowerCase() === mode.id.toLowerCase());
                      const Icon = mode.icon;

                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => handleToggleTransportMode(mode.id)}
                          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${isSelected
                              ? 'bg-emerald-50/80 border-[#00705a] text-slate-900 shadow-xs'
                              : 'bg-slate-50/80 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                            }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${isSelected ? 'bg-[#00705a] text-white' : 'bg-slate-200 text-slate-600'
                                }`}>
                                <Icon size={14} />
                              </div>
                              {isSelected && (
                                <span className="w-4 h-4 rounded-full bg-[#00705a] text-white flex items-center justify-center text-[10px]">
                                  ✓
                                </span>
                              )}
                            </div>
                            <div className="font-bold text-xs text-slate-900">{mode.label}</div>
                            <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{mode.desc}</div>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-200/80">
                            {isProjectDefault ? (
                              <span className="text-[9px] font-bold text-slate-500">
                                In Project Master
                              </span>
                            ) : (
                              <span className={`text-[9px] font-bold ${isSelected ? 'text-amber-600' : 'text-slate-400'}`}>
                                {isSelected ? '+ Added to Corridor' : 'Not in Project'}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SECTION 3: WORKSITE STATIONS & DYNAMIC INTERMEDIATE STOPS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900">
                        <Compass size={16} className="text-[#00705a]" />
                        <span>3. Worksite Stations & Intermediate Stops</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Origin & Destination select strictly from project worksites. Intermediate stops are lightweight waypoints.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddStop}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#00705a] border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
                    >
                      <Plus size={14} />
                      <span>Add Stop</span>
                    </button>
                  </div>

                  {/* STATION A: ORIGIN (LOADING POINT) - PROJECT WORKSITES ONLY */}
                  <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black text-xs">
                          A
                        </div>
                        <span className="text-xs font-black text-amber-900 uppercase tracking-wider">
                          Loading Point (Origin Station)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                        Project Worksite Origin
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Origin Worksite Dropdown (Filtered strictly by Project) */}
                      <div>
                        <label className="font-bold text-slate-700 mb-1 block">Worksite / Loading Bay</label>
                        <select
                          value={originWorksite}
                          onChange={e => setOriginWorksite(e.target.value)}
                          className="w-full p-2.5 bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-semibold text-slate-900"
                        >
                          {projectWorksites.map(w => (
                            <option key={w.id} value={w.name}>
                              {w.name} {w.location ? `(${w.location})` : ''}
                            </option>
                          ))}
                          {stockyardsList.map(y => (
                            <option key={y.id} value={y.yardName}>
                              {y.yardName} [Stockyard]
                            </option>
                          ))}
                          {projectWorksites.length === 0 && (
                            <option value="Rewa Quarry Face (Loading Pit)">Rewa Quarry Face (Loading Pit)</option>
                          )}
                        </select>
                      </div>

                      {/* Origin Type */}
                      <div>
                        <label className="font-bold text-slate-700 mb-1 block">Worksite Classification</label>
                        <select
                          value={originType}
                          onChange={e => setOriginType(e.target.value)}
                          className="w-full p-2.5 bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-medium text-slate-900"
                        >
                          <option value="Loading Pit">Quarry Loading Pit / Mine Face</option>
                          <option value="Stockyard">Raw Material Stockyard</option>
                          <option value="Crushing Plant">Crushing & Screening Plant</option>
                          <option value="Rail Siding">Private Rail Siding</option>
                        </select>
                      </div>
                    </div>

                    {/* Mode to next stop & distance */}
                    <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-600">Mode to next station:</span>
                        <button
                          type="button"
                          onClick={() => setOriginLegMode('Road')}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${originLegMode === 'Road'
                              ? 'bg-[#00705a] text-white font-black shadow-xs'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                          <Truck size={12} /> Road
                        </button>
                        <button
                          type="button"
                          onClick={() => setOriginLegMode('Rail')}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${originLegMode === 'Rail'
                              ? 'bg-blue-600 text-white font-black shadow-xs'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                          <Train size={12} /> Rail
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-600 font-semibold text-[11px]">Distance:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={originLegDistance}
                            onChange={e => setOriginLegDistance(parseFloat(e.target.value) || 0)}
                            className="w-16 p-1 bg-white border border-amber-200 rounded-lg text-center font-bold text-slate-900"
                          />
                          <span className="text-slate-500 font-bold text-[10px]">KM</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-600 font-semibold text-[11px]">TAT:</span>
                          <input
                            type="number"
                            step="0.5"
                            value={originLegTat}
                            onChange={e => setOriginLegTat(parseFloat(e.target.value) || 0)}
                            className="w-14 p-1 bg-white border border-amber-200 rounded-lg text-center font-bold text-slate-900"
                          />
                          <span className="text-slate-500 font-bold text-[10px]">Hrs</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DYNAMIC INTERMEDIATE STOPS (WAYPOINTS / SIDINGS) */}
                  {stops.map((stop, sIdx) => (
                    <div
                      key={stop.id}
                      className="p-4 rounded-2xl bg-blue-50/40 border border-blue-200/90 space-y-3 animate-in fade-in duration-150"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                            {sIdx + 1}
                          </div>
                          <span className="text-xs font-black text-blue-900 uppercase tracking-wider">
                            Intermediate Stop {sIdx + 1}: {stop.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-md border border-blue-200">
                            {stop.type}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveStop(stop.id)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                            title="Remove stop"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {/* Stop Location Name / Waypoint */}
                        <div>
                          <label className="font-bold text-slate-700 mb-1 block">Stop Name / Waypoint</label>
                          <input
                            type="text"
                            value={stop.name}
                            onChange={e => handleUpdateStop(stop.id, { name: e.target.value })}
                            placeholder="e.g., Satna Rail Siding / Buffer Depot..."
                            className="w-full p-2.5 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold text-slate-900"
                          />
                        </div>

                        {/* Stop Classification */}
                        <div>
                          <label className="font-bold text-slate-700 mb-1 block">Stop Classification</label>
                          <select
                            value={stop.type}
                            onChange={e => handleUpdateStop(stop.id, { type: e.target.value })}
                            className="w-full p-2.5 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-900"
                          >
                            <option value="Transshipment Hub">Transshipment Hub (Mode Transfer)</option>
                            <option value="Rail Siding">Dedicated DFCC Rail Siding</option>
                            <option value="Weighbridge Hub">Weighbridge & Quality Inspection Hub</option>
                            <option value="Fuel / Safety Bay">Midway Fuel & Safety Bay</option>
                          </select>
                        </div>
                      </div>

                      {/* Mode & Leg Parameters */}
                      <div className="pt-2 border-t border-blue-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-600">Mode leading to this stop:</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateStop(stop.id, { transportMode: 'Road' })}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${stop.transportMode === 'Road'
                                ? 'bg-[#00705a] text-white font-black shadow-xs'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                              }`}
                          >
                            <Truck size={12} /> Road
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStop(stop.id, { transportMode: 'Rail' })}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${stop.transportMode === 'Rail'
                                ? 'bg-blue-600 text-white font-black shadow-xs'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                              }`}
                          >
                            <Train size={12} /> DFCC Rail
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600 font-semibold text-[11px]">Distance:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={stop.distanceKm}
                              onChange={e => handleUpdateStop(stop.id, { distanceKm: parseFloat(e.target.value) || 0 })}
                              className="w-16 p-1 bg-white border border-blue-200 rounded-lg text-center font-bold text-slate-900"
                            />
                            <span className="text-slate-500 font-bold text-[10px]">KM</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600 font-semibold text-[11px]">TAT:</span>
                            <input
                              type="number"
                              step="0.5"
                              value={stop.estimatedTatHours}
                              onChange={e => handleUpdateStop(stop.id, { estimatedTatHours: parseFloat(e.target.value) || 0 })}
                              className="w-14 p-1 bg-white border border-blue-200 rounded-lg text-center font-bold text-slate-900"
                            />
                            <span className="text-slate-500 font-bold text-[10px]">Hrs</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* STATION B: DESTINATION (UNLOADING STATION) - PROJECT WORKSITES ONLY */}
                  <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                          B
                        </div>
                        <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">
                          Unloading Station (Destination Delivery Site)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100/80 px-2 py-0.5 rounded-md border border-indigo-200">
                        Project Worksite Destination
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Destination Worksite Dropdown (Filtered by Project) */}
                      <div>
                        <label className="font-bold text-slate-700 mb-1 block">Worksite / Unloading Station</label>
                        <select
                          value={destinationWorksite}
                          onChange={e => setDestinationWorksite(e.target.value)}
                          className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold text-slate-900"
                        >
                          {projectWorksites.map(w => (
                            <option key={w.id} value={w.name}>
                              {w.name} {w.location ? `(${w.location})` : ''}
                            </option>
                          ))}
                          {stockyardsList.map(y => (
                            <option key={y.id} value={y.yardName}>
                              {y.yardName} [Stockyard]
                            </option>
                          ))}
                          {projectWorksites.length === 0 && (
                            <option value="Noida Sector-62 Metro Depot Site">Noida Sector-62 Metro Depot Site</option>
                          )}
                        </select>
                      </div>

                      {/* Destination Classification */}
                      <div>
                        <label className="font-bold text-slate-700 mb-1 block">Station Classification</label>
                        <select
                          value={destinationType}
                          onChange={e => setDestinationType(e.target.value)}
                          className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-900"
                        >
                          <option value="Delivery Site">Delivery Project Worksites</option>
                          <option value="Depot Site">Central Metro / Construction Depot</option>
                          <option value="Batching Plant">Ready-Mix Concrete / Batching Plant</option>
                          <option value="Stockyard Pile">Central Finished Stockpile Bay</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* LIVE VECTOR PIPELINE RIBBON (WHITE THEME) */}
                  <div className="bg-slate-100/90 text-slate-900 rounded-2xl p-4 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span className="flex items-center gap-1.5 text-[#00705a]">
                        <Sparkles size={13} /> Visual Operations Corridor Blueprint
                      </span>
                      <span>
                        {originLegDistance + stops.reduce((a, b) => a + (b.distanceKm || 0), 0)} KM Total · ~
                        {(originLegTat + stops.reduce((a, b) => a + (b.estimatedTatHours || 0), 0)).toFixed(1)}h Turnaround
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
                      <span className="bg-amber-100 text-amber-900 px-3 py-1.5 rounded-xl border border-amber-200 shrink-0 font-bold flex items-center gap-1.5">
                        <MapPin size={12} className="text-amber-600" />
                        {originWorksite || 'Origin'}
                      </span>
                      <ArrowRight size={14} className="text-slate-400 shrink-0" />
                      {stops.map(s => (
                        <React.Fragment key={s.id}>
                          <span className="bg-blue-100 text-blue-900 px-3 py-1.5 rounded-xl border border-blue-200 shrink-0 flex items-center gap-1.5 font-bold">
                            {s.transportMode === 'Rail' ? <Train size={12} className="text-blue-600" /> : <Truck size={12} className="text-emerald-600" />}
                            {s.name}
                          </span>
                          <ArrowRight size={14} className="text-slate-400 shrink-0" />
                        </React.Fragment>
                      ))}
                      <span className="bg-indigo-100 text-indigo-900 px-3 py-1.5 rounded-xl border border-indigo-200 shrink-0 font-bold flex items-center gap-1.5">
                        <Building2 size={12} className="text-indigo-600" />
                        {destinationWorksite || 'Destination'}
                      </span>
                    </div>
                  </div>

                </div>

              </div>

              {/* ─────────────────────────────────────────────────────────── */}
              {/* RIGHT COLUMN: LEADERSHIP & FLEET COMMITMENT (5 Cols)         */}
              {/* ─────────────────────────────────────────────────────────── */}
              <div className="lg:col-span-5 space-y-6">

                {/* Panel 3: Project Head & Site In-Charge Assignment */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900">
                      <Users size={16} className="text-[#00705a]" />
                      <span>Project Leadership & Site Supervision</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">Key Personnel</span>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    {/* Project Head Dropdown */}
                    <div>
                      <label className="font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <Users size={13} className="text-[#00705a]" />
                        <span>Project Head / Director</span>
                      </label>
                      <input
                        type="text"
                        list="team-heads-list"
                        value={projectHead}
                        onChange={e => setProjectHead(e.target.value)}
                        placeholder="Select or enter Project Head..."
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00705a]/20 focus:border-[#00705a] font-medium text-slate-900 placeholder-slate-400"
                      />
                      <datalist id="team-heads-list">
                        {teamList.map(t => (
                          <option key={t.id} value={t.name}>{t.role ? `${t.name} (${t.role})` : t.name}</option>
                        ))}
                        <option value="Rajesh Kumar (Project Director)" />
                        <option value="Col. Vikram Rathore (Head of Operations)" />
                      </datalist>
                    </div>

                    {/* Site Manager Dropdown */}
                    <div>
                      <label className="font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <HardHat size={13} className="text-amber-600" />
                        <span>Site Manager / In-Charge</span>
                      </label>
                      <input
                        type="text"
                        list="team-managers-list"
                        value={siteManager}
                        onChange={e => setSiteManager(e.target.value)}
                        placeholder="Select or enter Site In-Charge..."
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00705a]/20 focus:border-[#00705a] font-medium text-slate-900 placeholder-slate-400"
                      />
                      <datalist id="team-managers-list">
                        {teamList.map(t => (
                          <option key={t.id} value={t.name}>{t.role ? `${t.name} (${t.role})` : t.name}</option>
                        ))}
                        <option value="Amit Sharma (Site Engineer & In-Charge)" />
                        <option value="Sunil Verma (Quarry & Haulage Manager)" />
                      </datalist>
                    </div>
                  </div>
                </div>

                {/* Panel 4: Fleet & Heavy Machinery Roster Assignment */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900">
                        <Truck size={16} className="text-[#00705a]" />
                        <span>Assign Fleet & Heavy Machinery</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Only vehicles with active drivers in FMS can be bound to this corridor
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#00705a] border border-emerald-200">
                      {assignedFleet.length} Committed
                    </span>
                  </div>

                  {/* Quick Asset Add Controls */}
                  <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3 text-xs">
                    {/* Asset Category Toggle */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStudioAssetType('vehicle');
                          setSelectedAssetId('');
                          setDriverNameInput('');
                          setDriverPhoneInput('');
                        }}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold transition-all ${studioAssetType === 'vehicle'
                            ? 'bg-[#00705a] text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                      >
                        <Truck size={13} />
                        <span>Commercial Truck</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setStudioAssetType('heavy_equipment');
                          setSelectedAssetId('');
                          setDriverNameInput('');
                          setDriverPhoneInput('');
                        }}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold transition-all ${studioAssetType === 'heavy_equipment'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                      >
                        <HardHat size={13} />
                        <span>Heavy Machinery</span>
                      </button>
                    </div>

                    {/* Asset Dropdown - STRICTLY FILTERED TO VEHICLES WITH ASSIGNED DRIVERS */}
                    <div>
                      <label className="font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>
                          {studioAssetType === 'vehicle' ? 'FMS Vehicle (Assigned Drivers Only)' : 'Heavy Machinery & Excavators'}
                        </span>
                        {studioAssetType === 'vehicle' && (
                          <span className="text-[10px] text-emerald-700 font-semibold">
                            {assignedDriverVehicles.length} available
                          </span>
                        )}
                      </label>
                      <select
                        value={selectedAssetId}
                        onChange={e => handleAssetSelectInStudio(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00705a]/20 focus:border-[#00705a] font-medium text-slate-900"
                      >
                        <option value="">-- Choose Asset from Fleet --</option>
                        {studioAssetType === 'vehicle' ? (
                          assignedDriverVehicles.length > 0 ? (
                            assignedDriverVehicles.map(v => (
                              <option key={v.id} value={v.id.toString()}>
                                {v.vehicleNumber} · {v.model || v.make || 'Commercial Tipper'} (Driver: {v.assignedDriverName || v.assigned_driver_name})
                              </option>
                            ))
                          ) : (
                            <option value="" disabled>
                              No vehicles with assigned drivers in FMS (driver required)
                            </option>
                          )
                        ) : (
                          (assignedOperatorEquipment.length > 0 ? assignedOperatorEquipment : equipmentList).map(e => (
                            <option key={e.id} value={e.id.toString()}>
                              {e.machineId} · {e.equipmentName} ({e.assignedOperatorName ? `Operator: ${e.assignedOperatorName}` : 'Designated Operator'})
                            </option>
                          ))
                        )}
                      </select>
                      {studioAssetType === 'vehicle' && assignedDriverVehicles.length === 0 && (
                        <p className="text-[10px] text-amber-700 font-medium mt-1">
                          * Only vehicles with an assigned driver can be selected. Update driver in Fleet Management first.
                        </p>
                      )}
                    </div>

                    {/* Driver & Operator Inputs */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-bold text-slate-700 mb-1 block">
                          {studioAssetType === 'vehicle' ? 'Assigned Driver' : 'Assigned Operator'}
                        </label>
                        <input
                          type="text"
                          placeholder="Name..."
                          value={driverNameInput}
                          onChange={e => setDriverNameInput(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00705a]/20 text-slate-900 placeholder-slate-400"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 mb-1 block">Shift</label>
                        <select
                          value={selectedShift}
                          onChange={e => setSelectedShift(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00705a]/20 text-slate-900 font-medium"
                        >
                          <option value="Day Shift">Day Shift</option>
                          <option value="Night Shift">Night Shift</option>
                          <option value="24x7 Continuous">24x7 Continuous</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddFleetToStudio}
                      disabled={!selectedAssetId}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#00705a] hover:bg-[#005a48] text-white rounded-xl font-bold transition-all shadow-xs disabled:opacity-40"
                    >
                      <Plus size={14} />
                      <span>Commit Asset to Corridor</span>
                    </button>
                  </div>

                  {/* Assigned Fleet List Cards */}
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {assignedFleet.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500 bg-slate-50/50">
                        No vehicles or machinery committed yet. Choose an asset with driver above.
                      </div>
                    ) : (
                      assignedFleet.map(f => (
                        <div
                          key={f.id}
                          className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded-lg ${f.assetType === 'vehicle' ? 'bg-emerald-50 text-[#00705a] border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                              {f.assetType === 'vehicle' ? <Truck size={14} /> : <HardHat size={14} />}
                            </div>
                            <div>
                              <div className="font-black text-slate-900 font-mono">{f.assetNumber}</div>
                              <div className="text-[10px] text-slate-500 font-medium">
                                {f.assignedPersonName} · <span className="text-[#00705a] font-bold">{f.shift}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFleetFromStudio(f.id)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded-md transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                </div>

              </div>

            </div>
          </div>

          {/* STUDIO FOOTER BAR (WHITE THEME) */}
          <div className="bg-white px-8 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs shrink-0 gap-4">
            <div className="flex flex-wrap items-center gap-4 text-slate-500">
              <span className="font-semibold">
                Stations: <strong className="text-slate-800">{stops.length + 2}</strong>
              </span>
              <span>·</span>
              <span className="font-semibold">
                Committed Fleet: <strong className="text-[#00705a]">{assignedFleet.length}</strong>
              </span>
              <span>·</span>
              <span className="font-semibold">
                Total Distance: <strong className="text-slate-800">{originLegDistance + stops.reduce((a, b) => a + (b.distanceKm || 0), 0)} KM</strong>
              </span>
              <span>·</span>
              <span className="font-semibold">
                Total TAT: <strong className="text-slate-800">~{(originLegTat + stops.reduce((a, b) => a + (b.estimatedTatHours || 0), 0)).toFixed(1)}h</strong>
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsCreateCorridorOpen(false)}
                className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
              >
                Discard Blueprint
              </button>
              <button
                type="button"
                onClick={handlePublishBlueprint}
                disabled={submittingBlueprint}
                className="px-6 py-2.5 bg-[#00705a] hover:bg-[#005a48] text-white font-black uppercase tracking-wider rounded-xl transition-all shadow-sm hover:shadow disabled:opacity-50"
              >
                {submittingBlueprint ? 'Publishing Blueprint...' : 'Publish Corridor Blueprint'}
              </button>
            </div>
          </div>

        </div>
      )}

      {/* MODAL 1B: TRANSPORT MODE PROJECT SYNC CONFIRMATION (WHITE THEME) */}
      {modePromptModal && modePromptModal.isOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 text-slate-900 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <AlertCircle size={24} />
              <h3 className="font-bold text-base">Add Transport Mode to Project?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              You selected <strong className="text-slate-900 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{modePromptModal.mode}</strong> for this corridor.
              This mode is not currently listed under <strong className="text-[#00705a] font-bold">{selectedProjectName}</strong> master scope.
            </p>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 mb-5 leading-relaxed">
              Updating will register <strong className="text-slate-900 font-bold">{modePromptModal.mode}</strong> in the Project Master so transport methods remain synchronized across Project Management, Work Orders, and Haulage Operations.
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setModePromptModal(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg transition-colors border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmModeSync('corridor_only')}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Corridor Only
              </button>
              <button
                type="button"
                onClick={() => handleConfirmModeSync('update_project')}
                className="px-4 py-2 text-xs font-bold text-white bg-[#00705a] hover:bg-[#005a48] rounded-lg transition-colors shadow-xs"
              >
                Yes, Update Project Master
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ASSIGN FLEET OR EQUIPMENT */}
      {isAssignAssetOpen && selectedCorridor && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Assign Asset & Crew to Leg</h3>
                <p className="text-[11px] text-slate-500 font-medium">{selectedCorridor.name}</p>
              </div>
              <button onClick={() => setIsAssignAssetOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignAsset} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Corridor Leg</label>
                  <select
                    value={assetForm.legId}
                    onChange={e => setAssetForm({ ...assetForm, legId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  >
                    <option value="">Whole Corridor (All Legs)</option>
                    {legs.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.legName} ({l.transportMode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Asset Type</label>
                  <select
                    value={assetForm.assetType}
                    onChange={e => setAssetForm({ ...assetForm, assetType: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  >
                    <option value="vehicle">Haulage Truck / Tipper</option>
                    <option value="heavy_equipment">Heavy Machinery (Excavator/Crane/Loader)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Plate / Equipment Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., UP-14-BT-9021 or EXC-CAT-320"
                    value={assetForm.assetNumber}
                    onChange={e => setAssetForm({ ...assetForm, assetNumber: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Make & Model Description</label>
                  <input
                    type="text"
                    placeholder="e.g., Tata Prima 2830.K 16 CUM"
                    value={assetForm.assetTitle}
                    onChange={e => setAssetForm({ ...assetForm, assetTitle: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Assigned Driver / Operator</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Rajesh Kumar"
                    value={assetForm.assignedPersonName}
                    onChange={e => setAssetForm({ ...assetForm, assignedPersonName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Driver Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g., +91 98765 43210"
                    value={assetForm.assignedPersonPhone}
                    onChange={e => setAssetForm({ ...assetForm, assignedPersonPhone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Role Designation</label>
                  <input
                    type="text"
                    value={assetForm.assignedPersonRole}
                    onChange={e => setAssetForm({ ...assetForm, assignedPersonRole: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Shift Assignment</label>
                  <select
                    value={assetForm.shift}
                    onChange={e => setAssetForm({ ...assetForm, shift: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  >
                    <option value="Day Shift">Day Shift (08:00 - 18:00)</option>
                    <option value="Night Shift">Night Shift (20:00 - 06:00)</option>
                    <option value="Rotational Shift">Rotational 24x7</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignAssetOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00705a] hover:bg-[#005a48] text-white font-black uppercase tracking-wider rounded-xl shadow-sm"
                >
                  Bind Asset to Leg
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
