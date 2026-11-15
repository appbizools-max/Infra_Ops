import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Route, Milestone, MapPin, Truck, Train, Box, Plus, Search,
  RefreshCw, CheckCircle2, ArrowRight, ArrowRightLeft, Users, HardHat,
  ChevronRight, Calendar, AlertCircle, Info, X, ShieldCheck, Gauge,
  Activity, Layers, Building2, Package, Sparkles, Trash2, UserCheck,
  Fuel, Navigation, Compass, Sliders, Settings2, ArrowUpRight, Check,
  Maximize2, Warehouse, ArrowUp, ArrowDown, Scale
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
  isStockyard?: boolean;
  stockyardId?: number;
  stockyardCode?: string;
  stockyardLocation?: string;
  divisionName?: string;
  plannedMaterial?: string;
  plannedQuantity?: number;
  plannedUnit?: string;
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
  activity?: 'LOADING' | 'UNLOADING' | 'TRANSIT';
  isStockyard?: boolean;
  stockyardId?: number;
  stockyardCode?: string;
  stockyardLocation?: string;
  divisionName?: string;
  plannedMaterial?: string;
  plannedQuantity?: number;
  plannedUnit?: string;
  actualReceived?: number;
  actualIssued?: number;
  actualAvailable?: number;
  transportMode: 'Road' | 'Rail' | 'Waterway' | 'Conveyor' | string;
  distanceKm: number;
  estimatedTatHours: number;
  transshipmentRequired: boolean;
  leadTransporter: string;
}

const MODE_META: Record<string, { icon: any; activeClass: string }> = {
  Road: { icon: Truck, activeClass: 'bg-[#00705a] text-white shadow-2xs' },
  Rail: { icon: Train, activeClass: 'bg-blue-600 text-white shadow-2xs' }
};

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
  const navigate = useNavigate();
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
  const [originActivity, setOriginActivity] = useState<'LOADING' | 'UNLOADING' | 'TRANSIT'>('LOADING');
  const [destinationWorksite, setDestinationWorksite] = useState('Noida Sector-62 Metro Depot Site');
  const [destinationType, setDestinationType] = useState('Delivery Site');
  const [destinationActivity, setDestinationActivity] = useState<'LOADING' | 'UNLOADING' | 'TRANSIT'>('UNLOADING');
  const [originLegMode, setOriginLegMode] = useState<string>('Road');
  const [originLegDistance, setOriginLegDistance] = useState<number>(48.5);
  const [originLegTat, setOriginLegTat] = useState<number>(2.5);

  // Dynamic Intermediate Stops
  const [stops, setStops] = useState<IntermediateStop[]>([
    {
      id: 'stop-1',
      name: 'Satna Rail Siding & Freight Hub',
      type: 'Rail Siding',
      activity: 'TRANSIT',
      transportMode: 'Rail',
      distanceKm: 680,
      estimatedTatHours: 18,
      transshipmentRequired: true,
      leadTransporter: 'Indian Railways / DFCC'
    }
  ]);

  // Synchronize Section 3 route leg transit modes with Section 2 selected transport modes
  useEffect(() => {
    if (selectedTransportModes.length === 0) return;
    if (!selectedTransportModes.some(m => m.toLowerCase() === originLegMode.toLowerCase())) {
      setOriginLegMode(selectedTransportModes[0]);
    }
    setStops(prev => prev.map(s => {
      if (!selectedTransportModes.some(m => m.toLowerCase() === (s.transportMode || '').toLowerCase())) {
        return { ...s, transportMode: selectedTransportModes[0] };
      }
      return s;
    }));
  }, [selectedTransportModes]);

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

  const [isSchematicExpanded, setIsSchematicExpanded] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Search & Filter State for Table View
  const [corridorSearch, setCorridorSearch] = useState('');
  const [corridorProjectFilter, setCorridorProjectFilter] = useState('ALL');

  const filteredCorridors = useMemo(() => {
    return corridors.filter(c => {
      const q = corridorSearch.toLowerCase().trim();
      const matchesSearch = !q ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.corridorCode || '').toLowerCase().includes(q) ||
        (c.projectName || '').toLowerCase().includes(q) ||
        (c.originSummary || '').toLowerCase().includes(q) ||
        (c.destinationSummary || '').toLowerCase().includes(q) ||
        (c.transshipmentHub || '').toLowerCase().includes(q);

      const matchesProject = corridorProjectFilter === 'ALL' || c.projectId === corridorProjectFilter || (c.projectName || '').toLowerCase() === corridorProjectFilter.toLowerCase();

      return matchesSearch && matchesProject;
    });
  }, [corridors, corridorSearch, corridorProjectFilter]);

  // Dynamic Route Sequence Schematic Nodes for Corridor Preview
  const previewNodes = useMemo(() => {
    // 1. If viewing a saved corridor from directory table:
    if (!isCreateCorridorOpen && selectedCorridor?.legs && selectedCorridor.legs.length > 0) {
      const list: Array<{
        id: string;
        label: string;
        title: string;
        subtitle: string;
        status: 'confirmed' | 'pending' | 'stockyard' | 'pending_yard' | 'waypoint';
        type: 'origin' | 'destination' | 'stockyard' | 'waypoint';
        x: number;
      }> = [];

      const cLegs = selectedCorridor.legs;
      list.push({
        id: 'origin',
        label: 'A',
        title: `Station A (${cLegs[0].originName})`,
        subtitle: `${cLegs[0].originType || 'Loading Point'} · ${cLegs[0].transportMode || 'Road'}`,
        status: 'confirmed',
        type: 'origin',
        x: 44
      });

      for (let i = 0; i < cLegs.length - 1; i++) {
        const leg = cLegs[i];
        const isIndented = i % 2 === 0;
        const isYard = leg.isStockyard || (leg.destinationType || '').toLowerCase().includes('yard');
        list.push({
          id: `stop-${leg.id || i}`,
          label: String(i + 1),
          title: leg.destinationName,
          subtitle: `${leg.destinationType || 'Transit Hub'} · ${leg.distanceKm || 0} KM (~${leg.estimatedTatHours || 0}h)`,
          status: isYard ? 'stockyard' : 'waypoint',
          type: isYard ? 'stockyard' : 'waypoint',
          x: isIndented ? 165 : 44
        });
      }

      const lastLeg = cLegs[cLegs.length - 1];
      list.push({
        id: 'destination',
        label: 'B',
        title: `Station B (${lastLeg.destinationName})`,
        subtitle: `${lastLeg.destinationType || 'Delivery Site'} · Final Delivery`,
        status: 'confirmed',
        type: 'destination',
        x: 44
      });

      return list;
    }

    // 2. Studio Draft Route:
    const list: Array<{
      id: string;
      label: string;
      title: string;
      subtitle: string;
      status: 'confirmed' | 'pending' | 'stockyard' | 'pending_yard' | 'waypoint';
      type: 'origin' | 'destination' | 'stockyard' | 'waypoint';
      x: number;
    }> = [];

    // 1. Origin Station
    const originActLabel = originActivity === 'LOADING' ? 'Loading In' : (originActivity === 'UNLOADING' ? 'Unload Out' : 'Transit Hub');
    list.push({
      id: 'origin',
      label: 'A',
      title: `Station A (${originActLabel})`,
      subtitle: originWorksite || 'Select project worksite',
      status: originWorksite ? 'confirmed' : 'pending',
      type: 'origin',
      x: 44
    });

    // 2. Intermediate Stops
    stops.forEach((s, idx) => {
      const isYard = s.isStockyard || s.type === 'Stockyard Hub';
      const isPendingYard = isYard && !s.stockyardId;
      // Alternate horizontal step offset: stop 0 (x=165), stop 1 (x=44), stop 2 (x=165), etc.
      const isIndented = idx % 2 === 0;
      const actLabel = s.activity === 'LOADING' ? 'Loading In' : (s.activity === 'UNLOADING' ? 'Unload Out' : 'Transit Hub');
      list.push({
        id: s.id,
        label: String(idx + 1),
        title: isPendingYard ? 'Stockyard pending' : `${s.name} (${actLabel})`,
        subtitle: isPendingYard
          ? 'No registered record selected'
          : (isYard ? `${s.stockyardCode || 'Stockyard'} · ${s.stockyardLocation || 'Buffer Hub'}` : (s.type || 'Transit Hub')),
        status: isPendingYard ? 'pending_yard' : (isYard ? 'stockyard' : 'waypoint'),
        type: isYard ? 'stockyard' : 'waypoint',
        x: isIndented ? 165 : 44
      });
    });

    // 3. Destination Station
    const destActLabel = destinationActivity === 'UNLOADING' ? 'Unload Out' : (destinationActivity === 'LOADING' ? 'Loading In' : 'Transit Hub');
    list.push({
      id: 'destination',
      label: 'B',
      title: `Station B (${destActLabel})`,
      subtitle: destinationWorksite || 'Select project worksite',
      status: destinationWorksite ? 'confirmed' : 'pending',
      type: 'destination',
      x: 44
    });

    return list;
  }, [isCreateCorridorOpen, selectedCorridor, originWorksite, destinationWorksite, stops, originActivity, destinationActivity]);

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

  const handleConfirmModeSync = async (action: 'update_project' | 'corridor_only') => {
    if (!modePromptModal) return;
    const { mode } = modePromptModal;
    if (action === 'update_project') {
      const updatedModes = [...new Set([...projectTransportModes, mode])];
      setProjectTransportModes(updatedModes);
      setSelectedTransportModes(prev => [...new Set([...prev, mode])]);
      setSyncProjectTransportModes(true);

      // 1. Immediately update in-memory projectsList cache
      setProjectsList(prev => prev.map(p => {
        if ((p.project_id || p.id?.toString()) === selectedProjectId) {
          let od: any = {};
          try {
            od = typeof p.other_data === 'string' ? JSON.parse(p.other_data) : (p.other_data || {});
          } catch (_) { od = {}; }
          od.transportModes = updatedModes.join(', ');
          return { ...p, other_data: od, transport_modes: updatedModes.join(', '), transportModes: updatedModes.join(', ') };
        }
        return p;
      }));

      // 2. Immediately persist to backend database (Project Master)
      try {
        const found = projectsList.find(p => (p.project_id || p.id?.toString()) === selectedProjectId);
        let od: any = {};
        if (found?.other_data) {
          try {
            od = typeof found.other_data === 'string' ? JSON.parse(found.other_data) : found.other_data;
          } catch (_) { od = {}; }
        }
        od.transportModes = updatedModes.join(', ');
        await apiFetch(`/api/tenant/projects/${selectedProjectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            otherData: JSON.stringify(od)
          })
        });
      } catch (err) {
        console.warn('Backend sync for Project Master transport modes encountered an error:', err);
      }

      showToast(`Updated Project Master in database & enabled ${mode} transport.`);
    } else {
      setSelectedTransportModes(prev => [...new Set([...prev, mode])]);
      showToast(`Added ${mode} to this corridor blueprint only.`);
    }
    setModePromptModal(null);
  };

  const handleAddStop = (asStockyard = false, insertAtIndex?: number) => {
    const newIdx = stops.length + 1;
    let newStop: IntermediateStop;
    if (asStockyard && stockyardsList.length > 0) {
      const firstYard = stockyardsList[0];
      const projMat = projectsList.find(p => (p.project_id || p.id?.toString()) === selectedProjectId)?.commodity || 'Track Ballast 40mm';
      newStop = {
        id: 'stop-' + Date.now(),
        name: firstYard.yardName,
        type: 'Stockyard Hub',
        activity: 'TRANSIT',
        isStockyard: true,
        stockyardId: firstYard.id,
        stockyardCode: firstYard.yardCode || `YRD-${firstYard.id}`,
        stockyardLocation: firstYard.location || 'Central Stockyard Hub',
        divisionName: firstYard.divisionName || firstYard.division_name || 'Infrastructure Division',
        plannedMaterial: projMat,
        plannedQuantity: 50,
        plannedUnit: 'MT',
        actualReceived: 0,
        actualIssued: 0,
        actualAvailable: 0,
        transportMode: 'Road',
        distanceKm: 35.0,
        estimatedTatHours: 2.5,
        transshipmentRequired: true,
        leadTransporter: 'InfraOps Dedicated Fleet'
      };
    } else {
      const defaultStopName = `Transit Siding / Transshipment Hub ${newIdx}`;
      newStop = {
        id: 'stop-' + Date.now(),
        name: defaultStopName,
        type: newIdx % 2 === 1 ? 'Transshipment Hub' : 'Rail Siding',
        activity: 'TRANSIT',
        isStockyard: false,
        transportMode: newIdx % 2 === 1 ? 'Rail' : 'Road',
        distanceKm: 45.0,
        estimatedTatHours: 3.0,
        transshipmentRequired: true,
        leadTransporter: newIdx % 2 === 1 ? 'Indian Railways / DFCC' : 'InfraOps Dedicated Fleet'
      };
    }

    setStops(prev => {
      if (insertAtIndex !== undefined && insertAtIndex >= 0 && insertAtIndex <= prev.length) {
        const copy = [...prev];
        copy.splice(insertAtIndex, 0, newStop);
        return copy;
      }
      return [...prev, newStop];
    });
  };

  const handleSwapOriginDestination = () => {
    const tempW = originWorksite;
    const tempT = originType;
    const tempA = originActivity;
    setOriginWorksite(destinationWorksite);
    setOriginType(destinationType);
    setOriginActivity(destinationActivity);
    setDestinationWorksite(tempW);
    setDestinationType(tempT);
    setDestinationActivity(tempA);
    showToast('Swapped Start and End Worksites & Activities.');
  };

  const handleMoveStopUp = (index: number) => {
    if (index <= 0) return;
    setStops(prev => {
      const nextStops = [...prev];
      const temp = nextStops[index];
      nextStops[index] = nextStops[index - 1];
      nextStops[index - 1] = temp;
      return nextStops;
    });
  };

  const handleMoveStopDown = (index: number) => {
    if (index >= stops.length - 1) return;
    setStops(prev => {
      const nextStops = [...prev];
      const temp = nextStops[index];
      nextStops[index] = nextStops[index + 1];
      nextStops[index + 1] = temp;
      return nextStops;
    });
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

  const handlePreviewCorridor = async (c: OperationsCorridor) => {
    await selectCorridor(c);
    setIsPreviewModalOpen(true);
  };

  const handleOpenAssignModal = async (c: OperationsCorridor) => {
    await selectCorridor(c);
    setIsAssignAssetOpen(true);
  };

  const handleDeleteCorridor = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete corridor "${name}"?`)) return;
    try {
      const res = await apiFetch(`/api/tenant/operations-corridors/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast(`Corridor "${name}" successfully deleted.`);
        fetchCorridors(true);
        if (selectedCorridor?.id === id) {
          setSelectedCorridor(null);
        }
      } else {
        alert('Failed to delete corridor.');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting corridor.');
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
        const s1 = stops[0];
        generatedLegs.push({
          legSequence: 1,
          legName: `Leg 1: Haulage to ${s1.name}`,
          originName: originWorksite,
          originType: originType,
          destinationName: s1.name,
          destinationType: s1.type,
          transportMode: originLegMode,
          distanceKm: originLegDistance,
          estimatedTatHours: originLegTat,
          transshipmentRequired: s1.transshipmentRequired,
          leadTransporter: originLegMode === 'Rail' ? 'Indian Railways / DFCC' : 'InfraOps Road Fleet',
          isStockyard: s1.isStockyard || s1.type === 'Stockyard Hub',
          stockyardId: s1.stockyardId || null,
          stockyardCode: s1.stockyardCode || null,
          stockyardLocation: s1.stockyardLocation || null,
          divisionName: s1.divisionName || null,
          plannedMaterial: s1.plannedMaterial || null,
          plannedQuantity: s1.plannedQuantity || null,
          plannedUnit: s1.plannedUnit || 'MT'
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
            leadTransporter: curr.leadTransporter || (curr.transportMode === 'Rail' ? 'Indian Railways / DFCC' : 'InfraOps Logistics'),
            isStockyard: next.isStockyard || next.type === 'Stockyard Hub',
            stockyardId: next.stockyardId || null,
            stockyardCode: next.stockyardCode || null,
            stockyardLocation: next.stockyardLocation || null,
            divisionName: next.divisionName || null,
            plannedMaterial: next.plannedMaterial || null,
            plannedQuantity: next.plannedQuantity || null,
            plannedUnit: next.plannedUnit || 'MT'
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
          transportModes: selectedTransportModes,
          stops: stops,
          stockyardStops: stops.filter(s => s.isStockyard || s.stockyardId)
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

      {/* CORRIDORS DIRECTORY - CLEAN ENTERPRISE TABLE VIEW */}
      {!isCreateCorridorOpen && (
        <div className="space-y-4">

          {/* Table Header Controls */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#00705a] border border-emerald-200/80 flex items-center justify-center font-bold shadow-2xs shrink-0">
                  <Route size={22} />
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    Operations Corridors & Sketches
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                      {corridors.length} Total
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Multi-modal route blueprints, loading-unloading topologies & logistics fleet allocations
                  </p>
                </div>
              </div>

              {/* Action Controls & Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search */}
                <div className="relative min-w-[220px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={corridorSearch}
                    onChange={e => setCorridorSearch(e.target.value)}
                    placeholder="Search corridor, code, project..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                  />
                </div>

                {/* Project Filter */}
                <select
                  value={corridorProjectFilter}
                  onChange={e => setCorridorProjectFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#00705a]"
                >
                  <option value="ALL">All Projects ({corridors.length})</option>
                  {projectsList.map(p => (
                    <option key={p.id} value={p.project_id || p.id.toString()}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {/* Refresh */}
                <button
                  type="button"
                  onClick={() => fetchCorridors(true)}
                  className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                  title="Refresh corridors"
                >
                  <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                </button>

                {/* Design Blueprint */}
                <button
                  type="button"
                  onClick={openDesignStudio}
                  className="flex items-center gap-2 bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Design Operations Sketch</span>
                </button>
              </div>
            </div>
          </div>

          {/* Corridors Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-16 text-center">
                <RefreshCw size={24} className="animate-spin text-[#00705a] mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-600">Loading corridors from master database...</p>
              </div>
            ) : filteredCorridors.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <Route size={22} />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No Corridors Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {corridorSearch || corridorProjectFilter !== 'ALL'
                    ? 'No corridors match your search and filter criteria.'
                    : 'Get started by creating your first multi-modal corridor blueprint.'}
                </p>
                <button
                  type="button"
                  onClick={openDesignStudio}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Design Operations Sketch</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-3 text-center w-12">#</th>
                      <th className="py-3 px-4 w-44">Corridor Code</th>
                      <th className="py-3 px-4 min-w-[220px]">Corridor Name</th>
                      <th className="py-3 px-4 min-w-[200px]">Project Reference</th>
                      <th className="py-3 px-3 w-28 text-center">Fleet</th>
                      <th className="py-3 px-4 text-center w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredCorridors.map((c, idx) => (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Index */}
                        <td className="py-3.5 px-3 text-center text-slate-400 font-bold text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Corridor Code */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-[11px] text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 tracking-wider inline-block">
                            {c.corridorCode}
                          </span>
                        </td>

                        {/* Corridor Name */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {c.name}
                          </div>
                          {c.description && (
                            <p className="text-[11px] text-slate-500 truncate max-w-sm mt-0.5">
                              {c.description}
                            </p>
                          )}
                        </td>

                        {/* Project Reference */}
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              if (c.projectId) {
                                navigate(`/tenant/project-management/${c.projectId}`);
                              }
                            }}
                            className="flex items-center gap-1.5 font-semibold text-slate-800 hover:text-[#00705a] text-left group/proj transition-colors cursor-pointer"
                            title="View Project Management Console"
                          >
                            <Building2 size={13} className="text-[#00705a] shrink-0 group-hover/proj:scale-110 transition-transform" />
                            <span className="truncate max-w-[220px] hover:underline decoration-[#00705a] underline-offset-2">
                              {c.projectName || 'Infrastructure Project'}
                            </span>
                            <ArrowUpRight size={11} className="text-slate-400 opacity-60 group-hover/proj:opacity-100 group-hover/proj:text-[#00705a] transition-all shrink-0" />
                          </button>
                          {(c.projectHead || c.siteManager) && (
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5 truncate max-w-[220px] pl-5">
                              {c.projectHead ? `Lead: ${c.projectHead}` : (c.siteManager ? `Site: ${c.siteManager}` : '')}
                            </div>
                          )}
                        </td>

                        {/* Committed Fleet */}
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#00705a] border border-emerald-200">
                            <Truck size={11} />
                            <span>{c.assetsCount ?? c.assets?.length ?? 0} Assets</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handlePreviewCorridor(c)}
                              className="p-1.5 text-slate-500 hover:text-[#00705a] hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Open Corridor Blueprint in Sidebar"
                            >
                              <Route size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAssignModal(c)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Assign Fleet / Equipment"
                            >
                              <HardHat size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCorridor(c.id, c.name)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Corridor"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Footer info */}
            {filteredCorridors.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
                <span>Showing <strong>{filteredCorridors.length}</strong> of <strong>{corridors.length}</strong> corridors</span>
              </div>
            )}
          </div>

        </div>
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

            {/* Studio Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Route size={14} className="text-emerald-400" />
                <span>Corridor Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCreateCorridorOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 cursor-pointer"
              >
                Back to Directory
              </button>
              <button
                type="button"
                onClick={handlePublishBlueprint}
                disabled={submittingBlueprint}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#00705a] hover:bg-[#005a48] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm hover:shadow disabled:opacity-50 cursor-pointer"
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

          {/* STUDIO WORKSPACE (Full-Width Streamlined Route Builder) */}
          <div className="p-4 sm:p-6 bg-slate-50/70 border-b border-slate-200">
            <div className="max-w-4xl mx-auto space-y-5">

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

                {/* SECTION 2: METHODS OF TRANSPORT INVOLVED (MINIMALIST) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900">
                      <Layers size={15} className="text-[#00705a]" />
                      <span>2. Methods of Transport Involved</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Select active modes</span>
                  </div>

                  {/* Sleek Minimalist Toggle Buttons */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      {
                        id: 'Road',
                        label: 'Road Haulage',
                        icon: Truck,
                        activeBorder: 'border-[#00705a] bg-emerald-50/60',
                        activeIconBg: 'bg-[#00705a] text-white',
                        activeBadge: 'bg-[#00705a] text-white'
                      },
                      {
                        id: 'Rail',
                        label: 'DFCC Rail',
                        icon: Train,
                        activeBorder: 'border-blue-600 bg-blue-50/60',
                        activeIconBg: 'bg-blue-600 text-white',
                        activeBadge: 'bg-blue-600 text-white'
                      }
                    ].map(mode => {
                      const isSelected = selectedTransportModes.includes(mode.id);
                      const Icon = mode.icon;

                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => handleToggleTransportMode(mode.id)}
                          className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? `${mode.activeBorder} shadow-2xs`
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                              isSelected ? mode.activeIconBg : 'bg-slate-200 text-slate-500'
                            }`}>
                              <Icon size={14} />
                            </div>
                            <span className="text-slate-900 font-bold">{mode.label}</span>
                          </div>

                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                            isSelected ? mode.activeBadge : 'border border-slate-300 text-transparent'
                          }`}>
                            ✓
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SECTION 3: WORKSITE STATIONS & INTERMEDIATE STOPS (MINIMAL & STREAMLINED) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900">
                        <Compass size={16} className="text-[#00705a]" />
                        <span>3. Route Stations & Intermediate Stops</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Sequential route: Loading Origin (A) ➔ Midway Stops ➔ Unloading Destination (B)
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsPreviewModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                        title="Corridor Preview"
                      >
                        <Route size={13} className="text-emerald-400" />
                        <span>Preview</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSwapOriginDestination}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        title="Swap Origin and Destination"
                      >
                        <ArrowRightLeft size={13} />
                        <span>Swap</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddStop(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00705a] hover:bg-[#005a48] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                        title="Add Stockyard Hub"
                      >
                        <Warehouse size={13} />
                        <span>+ Stockyard</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddStop(false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        title="Add Transit Siding or Waypoint"
                      >
                        <Plus size={13} />
                        <span>+ Siding</span>
                      </button>
                    </div>
                  </div>

                  {/* TIMELINE STEPPER WRAPPER */}
                  <div className="relative pl-6 space-y-4 before:absolute before:left-3 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200">

                    {/* ── STATION A: ORIGIN (LOADING POINT) ── */}
                    <div className="relative">
                      <div className={`absolute -left-6 top-3 w-6 h-6 rounded-full text-white font-black text-xs flex items-center justify-center ring-4 ring-white shadow-xs ${
                        originActivity === 'LOADING' ? 'bg-amber-500' : (originActivity === 'UNLOADING' ? 'bg-indigo-600' : 'bg-[#00705a]')
                      }`}>
                        A
                      </div>

                      <div className="bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-3 transition-all">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">Station A</span>
                            <span className="text-[10px] text-slate-400 font-medium">(Start Point)</span>
                          </div>

                          {/* Flexible Activity Toggle */}
                          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                            <button
                              type="button"
                              onClick={() => setOriginActivity('LOADING')}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                originActivity === 'LOADING'
                                  ? 'bg-amber-500 text-white shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Loading In
                            </button>
                            <button
                              type="button"
                              onClick={() => setOriginActivity('UNLOADING')}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                originActivity === 'UNLOADING'
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Unload Out
                            </button>
                            <button
                              type="button"
                              onClick={() => setOriginActivity('TRANSIT')}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                originActivity === 'TRANSIT'
                                  ? 'bg-[#00705a] text-white shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Transit Hub
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs items-center">
                          <div className="sm:col-span-8">
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Worksite / Pit</label>
                            <select
                              value={originWorksite}
                              onChange={e => setOriginWorksite(e.target.value)}
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-[#00705a] text-xs"
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

                          <div className="sm:col-span-4">
                            <span className="text-[11px] font-semibold text-slate-600 mb-1 block">Next Leg Transit:</span>
                            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 w-full">
                              {selectedTransportModes.map(mName => {
                                const meta = MODE_META[mName] || { icon: Truck, activeClass: 'bg-[#00705a] text-white shadow-2xs' };
                                const Icon = meta.icon;
                                const isSelected = originLegMode.toLowerCase() === mName.toLowerCase();
                                return (
                                  <button
                                    key={mName}
                                    type="button"
                                    onClick={() => setOriginLegMode(mName)}
                                    className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                      isSelected
                                        ? meta.activeClass
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    <Icon size={12} />
                                    <span>{mName}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── INTERMEDIATE STOPS (DYNAMIC) ── */}
                    {stops.length === 0 ? (
                      <div className="relative">
                        <div className="border border-dashed border-slate-200 rounded-xl p-3 text-center bg-slate-50/40 text-xs text-slate-400 flex items-center justify-between">
                          <span className="text-[11px]">Direct corridor leg (no intermediate stops)</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAddStop(true)}
                              className="text-[11px] font-bold text-[#00705a] hover:underline cursor-pointer"
                            >
                              + Add Stockyard
                            </button>
                            <span>·</span>
                            <button
                              type="button"
                              onClick={() => handleAddStop(false)}
                              className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                            >
                              + Add Siding
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      stops.map((stop, sIdx) => {
                        const isYard = stop.isStockyard || stop.type === 'Stockyard Hub';
                        const currentActivity = stop.activity || 'TRANSIT';
                        let nodeBg = 'bg-[#00705a]';
                        if (currentActivity === 'LOADING') nodeBg = 'bg-amber-500';
                        else if (currentActivity === 'UNLOADING') nodeBg = 'bg-indigo-600';

                        return (
                          <div key={stop.id} className="relative">
                            <div
                              className={`absolute -left-6 top-3 w-6 h-6 rounded-full text-white font-black text-xs flex items-center justify-center ring-4 ring-white shadow-xs ${nodeBg}`}
                            >
                              {sIdx + 1}
                            </div>

                            <div className="bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-3 transition-all">
                              {/* Header Row */}
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900">
                                    Stop {sIdx + 1}: {stop.name || (isYard ? 'Stockyard Hub' : 'Transit Siding')}
                                  </span>

                                  {/* Flexible Activity Toggle */}
                                  <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateStop(stop.id, { activity: 'LOADING' })}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                        currentActivity === 'LOADING'
                                          ? 'bg-amber-500 text-white shadow-2xs'
                                          : 'text-slate-500 hover:text-slate-800'
                                      }`}
                                    >
                                      Loading In
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateStop(stop.id, { activity: 'UNLOADING' })}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                        currentActivity === 'UNLOADING'
                                          ? 'bg-indigo-600 text-white shadow-2xs'
                                          : 'text-slate-500 hover:text-slate-800'
                                      }`}
                                    >
                                      Unload Out
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateStop(stop.id, { activity: 'TRANSIT' })}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                        currentActivity === 'TRANSIT'
                                          ? 'bg-[#00705a] text-white shadow-2xs'
                                          : 'text-slate-500 hover:text-slate-800'
                                      }`}
                                    >
                                      Transit Hub
                                    </button>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveStopUp(sIdx)}
                                    disabled={sIdx === 0}
                                    title="Move Up"
                                    className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-200 disabled:opacity-20 cursor-pointer"
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveStopDown(sIdx)}
                                    disabled={sIdx === stops.length - 1}
                                    title="Move Down"
                                    className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-200 disabled:opacity-20 cursor-pointer"
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStop(stop.id)}
                                    title="Remove Stop"
                                    className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer ml-1"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>

                              {/* Form Controls Row */}
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs items-center">
                                <div className="sm:col-span-8">
                                  {isYard ? (
                                    <div>
                                      <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Registered Stockyard</label>
                                      <select
                                        value={stop.stockyardId || ''}
                                        onChange={e => {
                                          const chosenId = parseInt(e.target.value, 10);
                                          const y = stockyardsList.find(item => item.id === chosenId);
                                          if (y) {
                                            handleUpdateStop(stop.id, {
                                              name: y.yardName,
                                              type: 'Stockyard Hub',
                                              isStockyard: true,
                                              stockyardId: y.id,
                                              stockyardCode: y.yardCode || `YRD-${y.id}`,
                                              stockyardLocation: y.location || 'Central Stockyard Hub',
                                              divisionName: y.divisionName || y.division_name || 'Infrastructure Division'
                                            });
                                          }
                                        }}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-[#00705a] text-xs"
                                      >
                                        <option value="">-- Choose Stockyard --</option>
                                        {stockyardsList.map(y => (
                                          <option key={y.id} value={y.id}>
                                            {y.yardName} ({y.yardCode || 'YRD-' + y.id})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : (
                                    <div>
                                      <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Siding / Stop Name</label>
                                      <input
                                        type="text"
                                        value={stop.name}
                                        onChange={e => handleUpdateStop(stop.id, { name: e.target.value })}
                                        placeholder="e.g. Satna Rail Siding"
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                                      />
                                    </div>
                                  )}
                                </div>

                                <div className="sm:col-span-4">
                                  <span className="text-[11px] font-semibold text-slate-600 mb-1 block">Next Leg Transit:</span>
                                  <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 w-full">
                                    {selectedTransportModes.map(mName => {
                                      const meta = MODE_META[mName] || { icon: Truck, activeClass: 'bg-[#00705a] text-white shadow-2xs' };
                                      const Icon = meta.icon;
                                      const isSelected = (stop.transportMode || 'Road').toLowerCase() === mName.toLowerCase();
                                      return (
                                        <button
                                          key={mName}
                                          type="button"
                                          onClick={() => handleUpdateStop(stop.id, { transportMode: mName as any })}
                                          className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                            isSelected
                                              ? meta.activeClass
                                              : 'text-slate-600 hover:text-slate-900'
                                          }`}
                                        >
                                          <Icon size={12} />
                                          <span>{mName}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* ── STATION B: DESTINATION (UNLOADING POINT) ── */}
                    <div className="relative">
                      <div className={`absolute -left-6 top-3 w-6 h-6 rounded-full text-white font-black text-xs flex items-center justify-center ring-4 ring-white shadow-xs ${
                        destinationActivity === 'UNLOADING' ? 'bg-indigo-600' : (destinationActivity === 'LOADING' ? 'bg-amber-500' : 'bg-[#00705a]')
                      }`}>
                        B
                      </div>

                      <div className="bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-3 transition-all">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">Station B</span>
                            <span className="text-[10px] text-slate-400 font-medium">(End Point)</span>
                          </div>

                          {/* Flexible Activity Toggle */}
                          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                            <button
                              type="button"
                              onClick={() => setDestinationActivity('LOADING')}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                destinationActivity === 'LOADING'
                                  ? 'bg-amber-500 text-white shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Loading In
                            </button>
                            <button
                              type="button"
                              onClick={() => setDestinationActivity('UNLOADING')}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                destinationActivity === 'UNLOADING'
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Unload Out
                            </button>
                            <button
                              type="button"
                              onClick={() => setDestinationActivity('TRANSIT')}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                destinationActivity === 'TRANSIT'
                                  ? 'bg-[#00705a] text-white shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Transit Hub
                            </button>
                          </div>
                        </div>

                        <div className="text-xs">
                          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Delivery Worksite</label>
                          <select
                            value={destinationWorksite}
                            onChange={e => setDestinationWorksite(e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
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
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </div>

            {/* STUDIO FOOTER BAR (WHITE THEME - STREAMLINED ACTION BAR) */}
            <div className="bg-white px-8 py-4 border-t border-slate-200 flex items-center justify-between text-xs shrink-0 gap-4">
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer"
              >
                <Route size={14} className="text-[#00705a]" />
                <span>Corridor Preview</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateCorridorOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer"
                >
                  Discard Blueprint
                </button>
                <button
                  type="button"
                  onClick={handlePublishBlueprint}
                  disabled={submittingBlueprint}
                  className="px-6 py-2.5 bg-[#00705a] hover:bg-[#005a48] text-white font-black uppercase tracking-wider rounded-xl transition-all shadow-sm hover:shadow disabled:opacity-50 cursor-pointer"
                >
                  {submittingBlueprint ? 'Publishing Blueprint...' : 'Publish Corridor Blueprint'}
                </button>
              </div>
            </div>

          </div>
        )}

        {/* RIGHT SIDEBAR DRAWER: CORRIDOR PREVIEW */}
        {isPreviewModalOpen && (
          <div className="fixed inset-0 z-60 overflow-hidden">
            {/* Backdrop */}
            <div
              onClick={() => setIsPreviewModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            />

            {/* Slide-over Right Sidebar Panel */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10 z-10">
              <div className="w-screen max-w-md sm:max-w-lg bg-[#0a1822] text-white shadow-2xl flex flex-col border-l border-slate-800 animate-in slide-in-from-right duration-250">
                {/* Sidebar Header */}
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#0e1f2c] shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                      <Route size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white tracking-tight truncate max-w-[200px]">
                          {!isCreateCorridorOpen && selectedCorridor ? selectedCorridor.name : 'Corridor Preview'}
                        </h3>
                        <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 rounded-md border border-emerald-500/30">
                          {!isCreateCorridorOpen && selectedCorridor ? selectedCorridor.corridorCode : 'Route Blueprint'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[240px]">
                        {!isCreateCorridorOpen && selectedCorridor
                          ? `${selectedCorridor.projectName} · ${selectedCorridor.totalDistanceKm} KM`
                          : `${selectedProjectName ? `${selectedProjectName} · ` : ''}${corridorName || 'Custom Route Sequence'}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPreviewModalOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    title="Close sidebar"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Sidebar Blueprint Grid Canvas */}
                <div
                  className="flex-1 p-5 sm:p-6 bg-[#0a1822] text-white overflow-y-auto select-none"
                  style={{
                    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                  }}
                >
                  {/* Header inside schematic */}
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold tracking-widest text-slate-400 mb-4 pb-2 border-b border-slate-800/80">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      ROUTE SEQUENCE / SCHEMATIC
                    </span>
                    <span>{previewNodes.length} STOPS</span>
                  </div>

                  {/* Stepped Blueprint Schematic */}
                  <div
                    className="relative my-3 transition-all"
                    style={{ height: `${previewNodes.length * 76 + 10}px` }}
                  >
                    {/* SVG Dashed Step Connectors */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: '100%' }}>
                      {previewNodes.slice(0, -1).map((curr, idx) => {
                        const next = previewNodes[idx + 1];
                        const startX = curr.x;
                        const startY = 28 + idx * 76;
                        const endX = next.x;
                        const endY = 28 + (idx + 1) * 76;

                        let pathD = '';
                        if (startX === endX) {
                          pathD = `M ${startX} ${startY + 15} V ${endY - 15}`;
                        } else {
                          const midY = (startY + endY) / 2;
                          pathD = `M ${startX} ${startY + 15} V ${midY} H ${endX} V ${endY - 15}`;
                        }

                        const isPending = next.status === 'pending_yard';
                        return (
                          <path
                            key={`sidebar-link-${idx}`}
                            d={pathD}
                            fill="none"
                            stroke={isPending ? '#f59e0b' : '#34d399'}
                            strokeWidth="2.5"
                            strokeDasharray="4 4"
                            strokeOpacity={isPending ? 0.9 : 0.8}
                          />
                        );
                      })}
                    </svg>

                    {/* Nodes with Badges and Labels */}
                    {previewNodes.map((node, idx) => {
                      const centerY = 28 + idx * 76;
                      const isPending = node.status === 'pending_yard';
                      const isYard = node.status === 'stockyard';
                      const isOriginOrDest = node.type === 'origin' || node.type === 'destination';

                      let circleClass = 'bg-[#182635] border-2 border-slate-500 text-slate-200';
                      if (isOriginOrDest) {
                        circleClass = 'bg-[#064e3b] border-2 border-emerald-400 text-emerald-300';
                      } else if (isPending) {
                        circleClass = 'bg-[#451a03] border-2 border-amber-500 text-amber-300';
                      } else if (isYard) {
                        circleClass = 'bg-[#064e3b] border-2 border-emerald-400 text-emerald-300';
                      }

                      return (
                        <div
                          key={`sidebar-node-${node.id}`}
                          className="absolute flex items-center gap-3 transition-all"
                          style={{
                            top: `${centerY - 16}px`,
                            left: `${node.x - 16}px`
                          }}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-md ${circleClass}`}>
                            {node.label}
                          </div>
                          <div className="leading-tight pr-3 bg-[#0a1822]/90 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-slate-800 max-w-[240px] sm:max-w-[280px]">
                            <div className={`font-bold text-xs truncate ${isPending ? 'text-amber-300' : 'text-white'}`}>
                              {node.title}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                              {node.subtitle}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend Notice */}
                  <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-0.5 bg-emerald-400 inline-block shrink-0"></span>
                      <span>Dashed green lines = connected route</span>
                    </div>
                  </div>
                </div>

                {/* Sidebar Footer */}
                <div className="p-4 bg-[#0e1f2c] border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
                  <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                    <span>{previewNodes.length} Stops</span>
                    <span>·</span>
                    <span>
                      {!isCreateCorridorOpen && selectedCorridor
                        ? `${selectedCorridor.totalDistanceKm} KM (~${selectedCorridor.estimatedCycleTimeHours}h)`
                        : `${originLegDistance + stops.reduce((a, b) => a + (b.distanceKm || 0), 0)} KM`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPreviewModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-700"
                  >
                    Close Sidebar
                  </button>
                </div>
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
