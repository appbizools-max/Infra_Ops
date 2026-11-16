import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Modal, ActivityIndicator, Alert, RefreshControl, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { mobileApiFetch } from '../../services/api';
import { getAuth } from '@react-native-firebase/auth';

interface Stockyard {
  id: number;
  yardCode: string;
  yardName: string;
  location: string;
  divisionId?: number;
  divisionName?: string;
  status: 'Active' | 'Inactive' | 'Maintenance';
  totalCapacityTons: number;
  currentOccupancyTons: number;
  supervisorName?: string;
  supervisorPhone?: string;
  weighbridgeInstalled?: boolean;
  weighbridgeCapacityTons?: number;
  projectsCount?: number;
  materialsCount?: number;
  capacityUtilizationPct?: number;
}

interface ProjectInventory {
  projectId: string;
  projectName: string;
  materialName: string;
  unit: string;
  totalReceived: number;
  totalIssued: number;
  currentAvailable: number;
  plannedQuantity?: number;
  lastVehicleNumber?: string;
  lastWeighbridgeSlip?: string;
}

interface StockTransaction {
  id: number;
  stockyardId: number;
  materialName: string;
  unit: string;
  transactionType: 'INWARD' | 'OUTWARD' | 'LOSS' | 'ADJUSTMENT' | 'INTERNAL_SHIFT';
  quantity: number;
  projectId: string;
  projectName: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  weighbridgeSlipNumber?: string;
  grossWeight?: number;
  tareWeight?: number;
  netWeight?: number;
  sourceLocation?: string;
  transportMode?: string;
  supplierName?: string;
  rackName?: string;
  grnNumber?: string;
  gateInTime?: string;
  createdAt: string;
  dwellMinutes?: number;
}

const DEFAULT_ROAD_VEHICLES = [
  { vehicleNumber: 'OD-05-BB-8921', vehicleType: 'BharatBenz 3528C Tipper (35T)', payloadCapacity: 35.0, driverName: 'Rajesh Kumar Swain', driverPhone: '+91 94371 88921' },
  { vehicleNumber: 'OD-05-AA-7712', vehicleType: 'Tata Prima 2830.K Tipper (28T)', payloadCapacity: 28.0, driverName: 'Sunil Pradhan', driverPhone: '+91 98610 22134' },
  { vehicleNumber: 'OD-14-CC-4019', vehicleType: 'Ashok Leyland 2820 Tipper (28T)', payloadCapacity: 28.0, driverName: 'Dhananjay Singh', driverPhone: '+91 97780 44551' },
  { vehicleNumber: 'UP-65-AR-5531', vehicleType: 'Volvo FMX 460 Heavy Tipper (40T)', payloadCapacity: 40.0, driverName: 'Mohammad Rafiq', driverPhone: '+91 91250 88901' },
  { vehicleNumber: 'MP-17-TG-1290', vehicleType: 'BharatBenz 2823R Haulage (28T)', payloadCapacity: 28.0, driverName: 'Rameshwar Yadav', driverPhone: '+91 94251 33412' },
  { vehicleNumber: 'DL-1M-4412', vehicleType: 'Tata Signa 3523.TK Tipper (35T)', payloadCapacity: 35.0, driverName: 'Gurpreet Singh', driverPhone: '+91 98100 77889' },
  { vehicleNumber: 'UP-14-BT-9021', vehicleType: 'Ashok Leyland 3520 Tipper (35T)', payloadCapacity: 35.0, driverName: 'Rajesh Kumar', driverPhone: '+91 98765 43210' },
];

const DEFAULT_RAIL_WAGONS = [
  { vehicleNumber: 'BOXN-94102', vehicleType: 'BOXN Open Freight Wagon', payloadCapacity: 58.5, driverName: 'Loco Pilot K. K. Verma', driverPhone: '+91 97524 10021' },
  { vehicleNumber: 'BOXNHL-63211', vehicleType: 'BOXNHL High-Capacity Wagon', payloadCapacity: 61.0, driverName: 'Loco Pilot V. N. Sharma', driverPhone: '+91 97524 10022' },
  { vehicleNumber: 'BCNHL-88219', vehicleType: 'BCNHL Covered Bulk Wagon', payloadCapacity: 63.5, driverName: 'Loco Pilot S. Dasgupta', driverPhone: '+91 97524 10023' },
  { vehicleNumber: 'BOBYN-41008', vehicleType: 'BOBYN Hopper Ballast Wagon', payloadCapacity: 55.0, driverName: 'Loco Pilot Anup Mishra', driverPhone: '+91 97524 10024' },
];

export default function StockyardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [viewMode, setViewMode] = useState<'list' | 'yard-detail' | 'project-detail'>('list');
  const [selectedYard, setSelectedYard] = useState<Stockyard | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const [stockyards, setStockyards] = useState<Stockyard[]>([]);
  const [projectInventory, setProjectInventory] = useState<ProjectInventory[]>([]);
  const [inwardReceipts, setInwardReceipts] = useState<StockTransaction[]>([]);
  const [racks, setRacks] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [yardTab, setYardTab] = useState<'stockpoints' | 'portals'>('stockpoints');
  const [expandedPointId, setExpandedPointId] = useState<string | null>(null);
  const [pointFilterTab, setPointFilterTab] = useState<'ALL' | 'INWARD' | 'OUTWARD' | 'INTERNAL_SHIFT'>('ALL');
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tripSearch, setTripSearch] = useState('');

  // Receive Vehicle Modal State
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [carrierMode, setCarrierMode] = useState<'TRUCK' | 'RAIL_RAKE'>('TRUCK');
  const [vehicleSearch, setVehicleSearch] = useState('');

  const [receiveForm, setReceiveForm] = useState({
    vehicleNumber: '',
    vehicleType: '',
    driverName: '',
    driverPhone: '',
    projectId: '',
    projectName: '',
    materialName: '',
    unit: 'MT',
    rackName: '',
    rackId: '',
    sourceLocation: '',
    supplierName: '',
    challanNumber: '',
    weighbridgeSlipNumber: '',
    grossWeight: '52.40',
    tareWeight: '17.20',
    netWeight: '35.20',
    remarks: 'Delivered & verified at stockyard weighbridge'
  });

  // Fetch Master Stockyards
  const fetchStockyards = async () => {
    try {
      const res = await mobileApiFetch('/api/tenant/stockyards');
      if (res.ok) {
        const data = await res.json();
        setStockyards(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Error fetching stockyards:', err);
    }
  };

  // Fetch Yard Details
  const fetchYardDetails = async (yardId: number) => {
    try {
      const [invRes, txRes, rRes, pRes, vRes] = await Promise.all([
        mobileApiFetch(`/api/tenant/stockyards/${yardId}/inventory`),
        mobileApiFetch(`/api/tenant/stockyard-transactions?stockyardId=${yardId}`),
        mobileApiFetch(`/api/tenant/stockyards/${yardId}/racks`),
        mobileApiFetch('/api/tenant/projects'),
        mobileApiFetch('/api/tenant/vehicles')
      ]);

      if (invRes.ok) {
        const invData = await invRes.json();
        setProjectInventory(Array.isArray(invData) ? invData : []);
      }
      if (txRes.ok) {
        const txData = await txRes.json();
        const txList = Array.isArray(txData) ? txData : [];
        setAllTransactions(txList);
        const inOnly = txList.filter((t: any) => t.transactionType === 'INWARD');
        setInwardReceipts(inOnly);
      }
      if (rRes.ok) {
        const rData = await rRes.json();
        setRacks(Array.isArray(rData) ? rData : []);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setProjectsList(Array.isArray(pData) ? pData : []);
      }
      if (vRes.ok) {
        const vData = await vRes.json();
        setAvailableVehicles(Array.isArray(vData) ? vData : []);
      }
    } catch (err) {
      console.warn('Error loading yard details:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await fetchStockyards();
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (viewMode === 'list') {
      await fetchStockyards();
    } else if (selectedYard) {
      await fetchYardDetails(selectedYard.id);
    }
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectYard = async (yard: Stockyard) => {
    setSelectedYard(yard);
    await fetchYardDetails(yard.id);
    setViewMode('yard-detail');
  };

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setViewMode('project-detail');
  };

  // Balance Calculations for Selected Project
  const activeProjectInventory = useMemo(() => {
    return projectInventory.find(p => p.projectId === selectedProjectId);
  }, [projectInventory, selectedProjectId]);

  const activeProjectMeta = useMemo(() => {
    return projectsList.find(p => p.projectId === selectedProjectId || p.id === selectedProjectId);
  }, [projectsList, selectedProjectId]);

  const projectScopeWeight = useMemo(() => {
    if (activeProjectMeta?.contractQuantity && Number(activeProjectMeta.contractQuantity) > 0) {
      return Number(activeProjectMeta.contractQuantity);
    }
    if (activeProjectInventory?.plannedQuantity && Number(activeProjectInventory.plannedQuantity) > 0) {
      return Number(activeProjectInventory.plannedQuantity);
    }
    return 50000; // Baseline 50,000 MT target scope
  }, [activeProjectMeta, activeProjectInventory]);

  const projectInwardList = useMemo(() => {
    if (!selectedProjectId) return [];
    return inwardReceipts.filter(r => r.projectId === selectedProjectId);
  }, [inwardReceipts, selectedProjectId]);

  const totalReceiptsWeight = useMemo(() => {
    return projectInwardList.reduce((sum, r) => sum + (parseFloat(String(r.quantity || r.netWeight || 0)) || 0), 0);
  }, [projectInwardList]);

  const remainingProjectBalance = useMemo(() => {
    return Math.max(0, parseFloat((projectScopeWeight - totalReceiptsWeight).toFixed(2)));
  }, [projectScopeWeight, totalReceiptsWeight]);

  const projectProgressPct = useMemo(() => {
    if (projectScopeWeight <= 0) return 0;
    return Math.min(100, parseFloat(((totalReceiptsWeight / projectScopeWeight) * 100).toFixed(1)));
  }, [totalReceiptsWeight, projectScopeWeight]);

  // Chronological receipt balances map
  const receiptBalancesMap = useMemo(() => {
    const sorted = [...projectInwardList].sort(
      (a, b) => new Date(a.gateInTime || a.createdAt).getTime() - new Date(b.gateInTime || b.createdAt).getTime()
    );
    let running = 0;
    const map = new Map<number, { delivered: number; remaining: number }>();
    for (const r of sorted) {
      const q = parseFloat(String(r.quantity || r.netWeight || 0)) || 0;
      running += q;
      const rem = Math.max(0, parseFloat((projectScopeWeight - running).toFixed(2)));
      map.set(r.id, {
        delivered: parseFloat(running.toFixed(2)),
        remaining: rem
      });
    }
    return map;
  }, [projectInwardList, projectScopeWeight]);

  // Effective Stock Points (Racks) with default fallback
  const effectiveRacks = useMemo(() => {
    if (racks && racks.length > 0) return racks;
    return [
      { id: 'sp-1', rackCode: 'SP-01', rackName: 'Ballast Bay A', locationType: 'Bay', capacityTons: 10000, currentOccupancyTons: 3450, totalCame: 4200, totalLeft: 750, materialName: 'Track Ballast 40mm (RDSO)', projectName: 'RVNL Package 3' },
      { id: 'sp-2', rackCode: 'SP-02', rackName: 'Ballast Bay B', locationType: 'Bay', capacityTons: 10000, currentOccupancyTons: 2180, totalCame: 2900, totalLeft: 720, materialName: 'Track Ballast 40mm (RDSO)', projectName: 'RVNL Package 3' },
      { id: 'sp-3', rackCode: 'SP-03', rackName: 'Aggregate Silo 1', locationType: 'Silo', capacityTons: 5000, currentOccupancyTons: 1850, totalCame: 2400, totalLeft: 550, materialName: 'Coarse Sand 20mm', projectName: 'Metro Phase II' },
      { id: 'sp-4', rackCode: 'SP-04', rackName: 'Stockpile C', locationType: 'Open Stockpile', capacityTons: 15000, currentOccupancyTons: 4920, totalCame: 6100, totalLeft: 1180, materialName: 'Granular Sub-Base (GSB)', projectName: 'Highway Corridor 7' }
    ];
  }, [racks]);

  // Open Receive Vehicle Modal
  const handleOpenReceiveModal = () => {
    const defaultVehicle = DEFAULT_ROAD_VEHICLES[0];
    const defaultRack = racks[0];
    const defaultMat = activeProjectInventory?.materialName || activeProjectMeta?.commodity || 'Track Ballast 40mm (RDSO)';

    setCarrierMode('TRUCK');
    setVehicleSearch('');
    setReceiveForm({
      vehicleNumber: defaultVehicle.vehicleNumber,
      vehicleType: defaultVehicle.vehicleType,
      driverName: defaultVehicle.driverName,
      driverPhone: defaultVehicle.driverPhone,
      projectId: selectedProjectId || projectInventory[0]?.projectId || '',
      projectName: activeProjectInventory?.projectName || activeProjectMeta?.name || 'Central Corridor Project',
      materialName: defaultMat,
      unit: 'MT',
      rackName: defaultRack ? defaultRack.rackName : 'Rack A',
      rackId: defaultRack ? String(defaultRack.id) : '',
      sourceLocation: 'Rewa Quarry Pit 04 Face',
      supplierName: 'National Mineral Quarry Division',
      challanNumber: `DC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      weighbridgeSlipNumber: `WB-REC-${Math.floor(10000 + Math.random() * 90000)}`,
      grossWeight: '52.40',
      tareWeight: '17.20',
      netWeight: '35.20',
      remarks: 'Delivered & verified at stockyard weighbridge'
    });
    setIsReceiveModalOpen(true);
  };

  // Submit Receive Vehicle
  const handleSubmitReceive = async () => {
    if (!selectedYard) return;
    const grossNum = parseFloat(receiveForm.grossWeight) || 0;
    const tareNum = parseFloat(receiveForm.tareWeight) || 0;
    let netNum = parseFloat(receiveForm.netWeight) || 0;
    if (grossNum > 0 && tareNum > 0 && grossNum > tareNum) {
      netNum = parseFloat((grossNum - tareNum).toFixed(2));
    }

    if (!receiveForm.vehicleNumber.trim()) {
      Alert.alert('Validation Error', 'Please select or enter a vehicle / wagon number');
      return;
    }
    if (netNum <= 0) {
      Alert.alert('Validation Error', 'Gross weight must be greater than Tare weight to produce valid net weight');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = getAuth().currentUser;
      const payload = {
        firebaseUid: user?.uid,
        transportMode: carrierMode,
        projectId: receiveForm.projectId,
        projectName: receiveForm.projectName,
        materialName: receiveForm.materialName,
        unit: receiveForm.unit || 'MT',
        vehicleNumber: receiveForm.vehicleNumber.trim().toUpperCase(),
        driverName: receiveForm.driverName,
        driverPhone: receiveForm.driverPhone,
        sourceLocation: receiveForm.sourceLocation,
        supplierName: receiveForm.supplierName,
        challanNumber: receiveForm.challanNumber,
        weighbridgeSlipNumber: receiveForm.weighbridgeSlipNumber,
        grossWeight: grossNum,
        tareWeight: tareNum,
        netWeight: netNum,
        quantity: netNum,
        dispatchQuantity: netNum,
        rackId: receiveForm.rackId || null,
        rackName: receiveForm.rackName || null,
        remarks: receiveForm.remarks
      };

      const res = await mobileApiFetch(`/api/tenant/stockyards/${selectedYard.id}/receipt`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        Alert.alert(
          'Receipt Recorded',
          `${carrierMode === 'RAIL_RAKE' ? 'Rail Wagon' : 'Vehicle'} ${receiveForm.vehicleNumber} successfully logged!\n\nNet Stock Added: ${netNum} MT\nGRN Slip: ${data.grn_number || data.grnNumber || 'Generated'}`
        );
        setIsReceiveModalOpen(false);
        await fetchYardDetails(selectedYard.id);
      } else {
        const err = await res.json();
        Alert.alert('Submission Error', err.error || 'Failed to record inward vehicle receipt');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Network error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Top App Bar */}
      <View style={styles.appBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {viewMode !== 'list' ? (
            <TouchableOpacity
              onPress={() => {
                if (viewMode === 'project-detail') setViewMode('yard-detail');
                else setViewMode('list');
              }}
              style={styles.iconBtn}
            >
              <Feather name="arrow-left" size={20} color="#0F172A" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => navigation.toggleDrawer()} style={styles.iconBtn}>
              <Ionicons name="menu" size={24} color="#0F172A" />
            </TouchableOpacity>
          )}

          <View>
            <Text style={styles.appBarTitle}>
              {viewMode === 'project-detail'
                ? activeProjectInventory?.projectName || 'Project Stock Console'
                : viewMode === 'yard-detail'
                ? selectedYard?.yardName || 'Stockyard Hub'
                : 'Stockyard Management'}
            </Text>
            <Text style={styles.appBarSubtitle}>
              {viewMode === 'project-detail'
                ? 'Vehicle Turnaround & Contract Balance'
                : viewMode === 'yard-detail'
                ? `${selectedYard?.yardCode || ''} • ${selectedYard?.location || ''}`
                : 'Spatial digital twins, weighbridge & portals'}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
          <Ionicons name="refresh" size={18} color="#00705a" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#00705a" />
          <Text style={styles.loadingText}>Loading stockyard operations...</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00705a']} />}
        >
          {/* ==================================================== */}
          {/* VIEW MODE 1: STOCKYARDS LIST                         */}
          {/* ==================================================== */}
          {viewMode === 'list' && (
            <View style={{ gap: 14 }}>
              {/* Summary Banner */}
              <LinearGradient
                colors={['#0F172A', '#03261F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bannerCard}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="scale-bathroom" size={18} color="#34D399" />
                  <Text style={styles.bannerTag}>STOCKYARD & WEIGHBRIDGE NETWORK</Text>
                </View>
                <Text style={styles.bannerTitle}>Centrally Managed Material Depots</Text>
                <Text style={styles.bannerSubtitle}>
                  Real-time storage capacities, automated weighbridge integration, rail siding & tipper logs.
                </Text>

                <View style={styles.bannerStatsRow}>
                  <View style={styles.bannerStatCol}>
                    <Text style={styles.bannerStatValue}>{stockyards.length}</Text>
                    <Text style={styles.bannerStatLabel}>ACTIVE HUBS</Text>
                  </View>
                  <View style={styles.bannerStatCol}>
                    <Text style={styles.bannerStatValue}>
                      {stockyards.reduce((sum, y) => sum + (parseFloat(String(y.totalCapacityTons || 0))), 0).toLocaleString()} MT
                    </Text>
                    <Text style={styles.bannerStatLabel}>TOTAL CAPACITY</Text>
                  </View>
                </View>
              </LinearGradient>

              {/* Search Bar */}
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color="#94A3B8" />
                <TextInput
                  placeholder="Search stockyard name, code or location..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchInput}
                />
              </View>

              {/* Stockyard Cards */}
              <Text style={styles.sectionHeaderLabel}>REGIONAL STOCKYARDS ({stockyards.length})</Text>

              {stockyards
                .filter(y => {
                  const q = searchQuery.toLowerCase();
                  return !q || y.yardName.toLowerCase().includes(q) || y.yardCode.toLowerCase().includes(q) || y.location.toLowerCase().includes(q);
                })
                .map(yard => {
                  const total = yard.totalCapacityTons || 50000;
                  const current = yard.currentOccupancyTons || 0;
                  const utilPct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

                  return (
                    <TouchableOpacity
                      key={yard.id}
                      style={styles.card}
                      activeOpacity={0.85}
                      onPress={() => handleSelectYard(yard)}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.codeBadge}>{yard.yardCode}</Text>
                            <Text style={styles.divisionBadge}>{yard.divisionName || 'Corporate HQ'}</Text>
                          </View>
                          <Text style={styles.cardTitle}>{yard.yardName}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <Ionicons name="location-outline" size={13} color="#64748B" />
                            <Text style={styles.cardLocation}>{yard.location}</Text>
                          </View>
                        </View>

                        <View style={styles.wbBadge}>
                          <MaterialCommunityIcons name="scale" size={12} color="#00705a" />
                          <Text style={styles.wbBadgeText}>{yard.weighbridgeInstalled ? `${yard.weighbridgeCapacityTons || 100}T WB` : 'No WB'}</Text>
                        </View>
                      </View>

                      {/* Capacity Bar */}
                      <View style={{ marginTop: 14 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={styles.progressLabel}>Capacity Utilization</Text>
                          <Text style={styles.progressValue}>
                            {current.toLocaleString()} / {total.toLocaleString()} MT ({utilPct}%)
                          </Text>
                        </View>
                        <View style={styles.progressBarTrack}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${utilPct}%`,
                                backgroundColor: utilPct > 85 ? '#EF4444' : utilPct > 60 ? '#F59E0B' : '#10B981'
                              }
                            ]}
                          />
                        </View>
                      </View>

                      <View style={styles.cardFooter}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Feather name="user" size={12} color="#64748B" />
                          <Text style={styles.footerText}>{yard.supervisorName || 'Site In-Charge'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={styles.viewDetailsText}>Open Hub Console</Text>
                          <Feather name="chevron-right" size={14} color="#00705a" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </View>
          )}

          {/* ==================================================== */}
          {/* VIEW MODE 2: YARD DETAIL HUB (PROJECT PORTALS)       */}
          {/* ==================================================== */}
          {viewMode === 'yard-detail' && selectedYard && (
            <View style={{ gap: 16 }}>
              {/* Hub Header Card */}
              <View style={styles.hubHeaderCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hubCodeBadge}>{selectedYard.yardCode}</Text>
                    <Text style={styles.hubTitle}>{selectedYard.yardName}</Text>
                    <Text style={styles.hubLocation}>{selectedYard.location}</Text>
                  </View>
                  <View style={styles.hubStatusBadge}>
                    <Text style={styles.hubStatusText}>ACTIVE DEPOT</Text>
                  </View>
                </View>

                <View style={styles.hubMetricsGrid}>
                  <View style={styles.hubMetricBox}>
                    <Text style={styles.hubMetricLabel}>CURRENT OCCUPANCY</Text>
                    <Text style={styles.hubMetricVal}>
                      {(selectedYard.currentOccupancyTons || 0).toLocaleString()} MT
                    </Text>
                  </View>
                  <View style={styles.hubMetricBox}>
                    <Text style={styles.hubMetricLabel}>TOTAL CAPACITY</Text>
                    <Text style={styles.hubMetricVal}>
                      {(selectedYard.totalCapacityTons || 50000).toLocaleString()} MT
                    </Text>
                  </View>
                  <View style={styles.hubMetricBox}>
                    <Text style={styles.hubMetricLabel}>LINKED PROJECTS</Text>
                    <Text style={styles.hubMetricVal}>{projectInventory.length}</Text>
                  </View>
                  <View style={styles.hubMetricBox}>
                    <Text style={styles.hubMetricLabel}>STORAGE RACKS</Text>
                    <Text style={styles.hubMetricVal}>{racks.length || 4}</Text>
                  </View>
                </View>
              </View>

              {/* Yard Mode Sub-Tabs: Stock Points vs Portals */}
              <View style={styles.segmentContainer}>
                <TouchableOpacity
                  style={[styles.segmentBtn, yardTab === 'stockpoints' && styles.segmentBtnActive]}
                  onPress={() => setYardTab('stockpoints')}
                >
                  <MaterialCommunityIcons name="cube-outline" size={16} color={yardTab === 'stockpoints' ? '#00705a' : '#64748B'} />
                  <Text style={[styles.segmentBtnText, yardTab === 'stockpoints' && styles.segmentBtnTextActive]}>
                    Stock Points ({effectiveRacks.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.segmentBtn, yardTab === 'portals' && styles.segmentBtnActive]}
                  onPress={() => setYardTab('portals')}
                >
                  <Feather name="folder" size={15} color={yardTab === 'portals' ? '#00705a' : '#64748B'} />
                  <Text style={[styles.segmentBtnText, yardTab === 'portals' && styles.segmentBtnTextActive]}>
                    Project Portals ({projectInventory.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* TAB 1: STOCK POINTS LIST & INLINE AUDIT LEDGER */}
              {yardTab === 'stockpoints' && (
                <View style={{ gap: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.sectionHeaderLabel}>PHYSICAL STOCK POINTS & CAPACITIES</Text>
                    <Text style={styles.subtextCount}>{effectiveRacks.length} Points Defined</Text>
                  </View>

                  {effectiveRacks.map((sp, idx) => {
                    const spName = sp.rackName || sp.stockPointName || `Point ${idx + 1}`;
                    const spCode = sp.rackCode || sp.stockPointCode || `SP-0${idx + 1}`;
                    const cap = parseFloat(String(sp.capacityTons || 10000));
                    const occ = parseFloat(String(sp.currentOccupancyTons ?? sp.currentAvailableStock ?? 0));
                    const occPct = cap > 0 ? Math.min(100, Math.round((occ / cap) * 100)) : 0;
                    const freeCap = Math.max(0, cap - occ);

                    const totalCame = parseFloat(String(sp.totalCame ?? sp.totalReceived ?? 0)) || occ;
                    const totalLeft = parseFloat(String(sp.totalLeft ?? sp.totalIssued ?? 0)) || 0;

                    const isExpanded = expandedPointId === sp.id;
                    const pointTx = allTransactions.filter((t: any) =>
                      t.rackId === sp.id ||
                      t.destinationRackId === sp.id ||
                      (t.rackName && t.rackName.toLowerCase() === spName.toLowerCase()) ||
                      (t.destinationRackName && t.destinationRackName.toLowerCase() === spName.toLowerCase())
                    );
                    const filteredPointTx = pointTx.filter((t: any) => {
                      if (pointFilterTab === 'INWARD' && t.transactionType !== 'INWARD') return false;
                      if (pointFilterTab === 'OUTWARD' && t.transactionType !== 'OUTWARD') return false;
                      if (pointFilterTab === 'INTERNAL_SHIFT' && t.transactionType !== 'INTERNAL_SHIFT') return false;
                      return true;
                    });

                    return (
                      <TouchableOpacity
                        key={sp.id || idx}
                        style={[
                          styles.stockPointCard,
                          isExpanded && { borderColor: '#00705a', borderWidth: 2, backgroundColor: '#FFFFFF' }
                        ]}
                        activeOpacity={0.92}
                        onPress={() => setExpandedPointId(isExpanded ? null : sp.id)}
                      >
                        {/* Header: Code + Name + Type */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <View style={styles.spCodeBadge}>
                                <Text style={styles.spCodeBadgeText}>{spCode}</Text>
                              </View>
                              <Text style={styles.spNameText}>{spName}</Text>
                            </View>
                            <Text style={styles.spDescText}>
                              {sp.materialName || 'Track Ballast 40mm'} • {sp.projectName || 'RVNL Package 3'}
                            </Text>
                          </View>

                          <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <View style={styles.spTypeBadge}>
                              <Text style={styles.spTypeBadgeText}>{(sp.locationType || 'Bay').toUpperCase()}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                              <Text style={{ fontSize: 9, fontWeight: '800', color: isExpanded ? '#00705a' : '#4F46E5' }}>
                                {isExpanded ? 'Hide Ledger' : 'Tap for Ledger'}
                              </Text>
                              <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={10} color={isExpanded ? '#00705a' : '#4F46E5'} />
                            </View>
                          </View>
                        </View>

                        {/* Capacity Meter */}
                        <View style={{ marginTop: 8 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={styles.spCapLabel}>Capacity Utilization</Text>
                            <Text style={styles.spCapValue}>
                              {occ.toLocaleString()} / {cap.toLocaleString()} MT ({occPct}%)
                            </Text>
                          </View>
                          <View style={styles.progressBarTrack}>
                            <View
                              style={[
                                styles.progressBarFill,
                                {
                                  width: `${occPct}%`,
                                  backgroundColor: occPct > 85 ? '#EF4444' : occPct > 60 ? '#F59E0B' : '#00705a'
                                }
                              ]}
                            />
                          </View>
                        </View>

                        {/* 3-Box Flow Summary: Came | Left | Current Stock */}
                        <View style={styles.spFlowGrid}>
                          <View style={styles.spFlowBox}>
                            <Text style={styles.spFlowLabel}>📥 CAME</Text>
                            <Text style={[styles.spFlowVal, { color: '#00705a' }]}>
                              +{totalCame.toLocaleString()} MT
                            </Text>
                          </View>
                          <View style={styles.spFlowBox}>
                            <Text style={styles.spFlowLabel}>📤 LEFT</Text>
                            <Text style={[styles.spFlowVal, { color: '#DC2626' }]}>
                              -{totalLeft.toLocaleString()} MT
                            </Text>
                          </View>
                          <View style={[styles.spFlowBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                            <Text style={[styles.spFlowLabel, { color: '#00705a' }]}>📦 ON HAND</Text>
                            <Text style={[styles.spFlowVal, { color: '#00705a', fontWeight: '900' }]}>
                              {occ.toLocaleString()} MT
                            </Text>
                          </View>
                        </View>

                        {/* Action Footer: No edit, No delete! */}
                        <View style={styles.spCardFooter}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Feather name="check" size={12} color="#10B981" />
                            <Text style={styles.spStatusText}>{sp.status || 'Active'}</Text>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                              style={[styles.spHistoryBtn, isExpanded && { backgroundColor: '#ECFDF5', borderColor: '#00705a' }]}
                              activeOpacity={0.8}
                              onPress={() => setExpandedPointId(isExpanded ? null : sp.id)}
                            >
                              <Feather name={isExpanded ? "chevron-up" : "list"} size={12} color={isExpanded ? "#00705a" : "#4F46E5"} />
                              <Text style={[styles.spHistoryBtnText, isExpanded && { color: '#00705a' }]}>
                                {isExpanded ? 'Hide Ledger' : 'Audit Ledger'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.spShiftBtn}
                              activeOpacity={0.8}
                              onPress={() => {
                                setReceiveForm(prev => ({
                                  ...prev,
                                  rackName: spName,
                                  rackId: String(sp.id),
                                  materialName: sp.materialName || prev.materialName,
                                  projectName: sp.projectName || prev.projectName
                                }));
                                setIsReceiveModalOpen(true);
                              }}
                            >
                              <Feather name="arrow-down-left" size={12} color="#00705a" />
                              <Text style={styles.spShiftBtnText}>Receive In</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* INLINE AUDIT LEDGER (NO POPUP) */}
                        {isExpanded && (
                          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 10 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={[styles.sectionHeaderLabel, { color: '#0F172A', fontSize: 11 }]}>
                                LIVE AUDIT & TRIP LEDGER
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                                <Text style={{ fontSize: 10, color: '#00705a', fontWeight: '800' }}>In-Page Audit</Text>
                              </View>
                            </View>

                            {/* 6-Metric Mini Grid */}
                            <View style={styles.spFlowGrid}>
                              <View style={styles.spFlowBox}>
                                <Text style={styles.spFlowLabel}>CAPACITY</Text>
                                <Text style={[styles.spFlowVal, { color: '#0F172A' }]}>{cap.toLocaleString()} MT</Text>
                              </View>
                              <View style={[styles.spFlowBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                                <Text style={[styles.spFlowLabel, { color: '#00705a' }]}>ON HAND</Text>
                                <Text style={[styles.spFlowVal, { color: '#00705a', fontWeight: '900' }]}>{occ.toLocaleString()} MT</Text>
                              </View>
                              <View style={styles.spFlowBox}>
                                <Text style={styles.spFlowLabel}>FREE SPACE</Text>
                                <Text style={[styles.spFlowVal, { color: '#059669' }]}>{freeCap.toLocaleString()} MT</Text>
                              </View>
                            </View>

                            {/* Filter Tabs */}
                            <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
                              {[
                                { key: 'ALL', label: `All (${pointTx.length})` },
                                { key: 'INWARD', label: `📥 In (${pointTx.filter((t: any) => t.transactionType === 'INWARD').length})` },
                                { key: 'OUTWARD', label: `📤 Out (${pointTx.filter((t: any) => t.transactionType === 'OUTWARD').length})` },
                                { key: 'INTERNAL_SHIFT', label: `↔️ Shifts (${pointTx.filter((t: any) => t.transactionType === 'INTERNAL_SHIFT').length})` }
                              ].map(tab => (
                                <TouchableOpacity
                                  key={tab.key}
                                  style={[
                                    styles.segmentedTabBtn,
                                    pointFilterTab === tab.key && styles.segmentedTabBtnActive,
                                    { paddingHorizontal: 9, paddingVertical: 4 }
                                  ]}
                                  onPress={() => setPointFilterTab(tab.key as any)}
                                >
                                  <Text style={[styles.segmentedTabText, pointFilterTab === tab.key && styles.segmentedTabTextActive, { fontSize: 10 }]}>
                                    {tab.label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>

                            {/* Trip Movements */}
                            <View style={{ gap: 7 }}>
                              {filteredPointTx.length === 0 ? (
                                <View style={[styles.emptyCard, { paddingVertical: 14 }]}>
                                  <Feather name="clock" size={20} color="#94A3B8" />
                                  <Text style={[styles.emptyTitle, { fontSize: 12 }]}>No Movements Yet</Text>
                                  <Text style={[styles.emptyDesc, { fontSize: 10 }]}>No trips logged for this filter in {spName}.</Text>
                                </View>
                              ) : (
                                filteredPointTx.map((tx: any, tIdx: number) => {
                                  const isInward = tx.transactionType === 'INWARD';
                                  const isOutward = tx.transactionType === 'OUTWARD';
                                  return (
                                    <View key={tx.id || tIdx} style={[styles.shiftCard, { backgroundColor: '#F8FAFC' }]}>
                                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                          <View style={[styles.shiftTypeBadge, { backgroundColor: isInward ? '#ECFDF5' : isOutward ? '#FEF2F2' : '#EEF2FF' }]}>
                                            <Text style={[styles.shiftTypeBadgeText, { color: isInward ? '#00705a' : isOutward ? '#DC2626' : '#4F46E5', fontSize: 9 }]}>
                                              {tx.transactionType.replace('_', ' ')}
                                            </Text>
                                          </View>
                                          <Text style={[styles.shiftCardTitle, { fontSize: 12 }]}>{tx.materialName}</Text>
                                        </View>
                                        <Text style={[styles.shiftCardQty, { color: isInward ? '#00705a' : isOutward ? '#DC2626' : '#4F46E5', fontSize: 12 }]}>
                                          {isInward ? '+' : isOutward ? '-' : '↔ '}{Number(tx.quantity).toLocaleString()} {tx.unit || 'MT'}
                                        </Text>
                                      </View>

                                      <View style={{ marginTop: 4, gap: 2 }}>
                                        <Text style={[styles.shiftRouteText, { fontSize: 11 }]}>
                                          {tx.vehicleNumber ? `Vehicle: ${tx.vehicleNumber}` : 'Internal Relocation'}
                                          {tx.driverName ? ` • ${tx.driverName}` : ''}
                                        </Text>
                                        <Text style={[styles.shiftRouteText, { fontSize: 10, color: '#64748B' }]}>
                                          Project: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{tx.projectName}</Text>
                                        </Text>
                                        {isInward && tx.sourceLocation && (
                                          <Text style={[styles.shiftRouteText, { fontSize: 10, color: '#64748B' }]}>
                                            From: {tx.sourceLocation} {tx.supplierName ? `(${tx.supplierName})` : ''}
                                          </Text>
                                        )}
                                        {tx.transactionType === 'INTERNAL_SHIFT' && (
                                          <Text style={[styles.shiftRouteText, { fontSize: 10, color: '#64748B' }]}>
                                            Route: {tx.sourceLocation || tx.rackName || spName} ➔ {tx.destinationLocation || tx.destinationRackName}
                                          </Text>
                                        )}
                                        {tx.grossWeight && (
                                          <Text style={[styles.shiftRouteText, { fontSize: 9, color: '#94A3B8' }]}>
                                            Gross: {tx.grossWeight} MT • Tare: {tx.tareWeight} MT
                                          </Text>
                                        )}
                                      </View>
                                    </View>
                                  );
                                })
                              )}
                            </View>

                            {/* Quick In-Page Action */}
                            <View style={{ marginTop: 4 }}>
                              <TouchableOpacity
                                style={[styles.modalSubmitBtn, { backgroundColor: '#00705a', paddingVertical: 10 }]}
                                onPress={() => {
                                  setReceiveForm(f => ({
                                    ...f,
                                    rackName: spName,
                                    rackId: String(sp.id),
                                    materialName: sp.materialName || f.materialName,
                                    projectName: sp.projectName || f.projectName
                                  }));
                                  setIsReceiveModalOpen(true);
                                }}
                              >
                                <Feather name="arrow-down-left" size={14} color="#FFFFFF" />
                                <Text style={[styles.modalSubmitText, { fontSize: 12 }]}>Receive Vehicle Into {spName}</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* TAB 2: PROJECT PORTALS LIST */}
              {yardTab === 'portals' && (
                <View style={{ gap: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.sectionHeaderLabel}>PROJECT-WISE MATERIAL PORTALS</Text>
                    <Text style={styles.subtextCount}>{projectInventory.length} Projects Deployed</Text>
                  </View>

                  {projectInventory.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Feather name="box" size={32} color="#94A3B8" />
                      <Text style={styles.emptyTitle}>No Material Portals Active</Text>
                      <Text style={styles.emptyDesc}>No project materials have been stacked in this stockyard yet.</Text>
                    </View>
                  ) : (
                    projectInventory.map((item, idx) => {
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={styles.projectPortalCard}
                          activeOpacity={0.85}
                          onPress={() => handleSelectProject(item.projectId)}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <Text style={styles.portalProjectName}>{item.projectName}</Text>
                              <Text style={styles.portalCommodity}>{item.materialName}</Text>
                            </View>
                            <View style={styles.portalAvailableBadge}>
                              <Text style={styles.portalAvailableText}>
                                {item.currentAvailable.toLocaleString()} {item.unit || 'MT'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.portalStatsRow}>
                            <View>
                              <Text style={styles.portalStatLabel}>Total Received</Text>
                              <Text style={styles.portalStatVal}>{item.totalReceived.toLocaleString()} MT</Text>
                            </View>
                            <View>
                              <Text style={styles.portalStatLabel}>Total Dispatched</Text>
                              <Text style={styles.portalStatVal}>{item.totalIssued.toLocaleString()} MT</Text>
                            </View>
                            <View>
                              <Text style={styles.portalStatLabel}>Last Carrier</Text>
                              <Text style={styles.portalStatVal}>{item.lastVehicleNumber || 'OD-05-BB-8921'}</Text>
                            </View>
                          </View>

                          <View style={styles.portalCardFooter}>
                            <Text style={styles.portalFooterLink}>Open Inward Turnaround & Balance</Text>
                        <Feather name="arrow-right" size={14} color="#00705a" />
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </View>
      )}

          {/* ==================================================== */}
          {/* VIEW MODE 3: PROJECT-DETAIL (SECTION 1 & BALANCE)    */}
          {/* ==================================================== */}
          {viewMode === 'project-detail' && (
            <View style={{ gap: 16 }}>
              {/* LIVE PROJECT TARGET SCOPE & BALANCE COUNTDOWN BANNER */}
              <LinearGradient
                colors={['#0F172A', '#03261F', '#0F172A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.balanceBanner}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name="scale-balance" size={16} color="#34D399" />
                  <Text style={styles.balanceBannerTag}>PROJECT CONTRACT SCOPE & BALANCE</Text>
                </View>

                <Text style={styles.balanceProjectTitle}>
                  {activeProjectInventory?.projectName || selectedProjectId}
                </Text>
                <Text style={styles.balanceCommodityText}>
                  {activeProjectInventory?.materialName || activeProjectMeta?.commodity || 'All Aggregates & Ballast'}
                </Text>

                {/* 4 Metric Boxes */}
                <View style={styles.balanceGrid}>
                  <View style={styles.balanceBox}>
                    <Text style={styles.balanceBoxLabel}>TARGET SCOPE</Text>
                    <Text style={styles.balanceBoxVal}>{projectScopeWeight.toLocaleString()} MT</Text>
                  </View>
                  <View style={[styles.balanceBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                    <Text style={[styles.balanceBoxLabel, { color: '#6EE7B7' }]}>TOTAL RECEIVED</Text>
                    <Text style={[styles.balanceBoxVal, { color: '#34D399' }]}>
                      {totalReceiptsWeight.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MT
                    </Text>
                  </View>
                  <View style={[styles.balanceBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                    <Text style={[styles.balanceBoxLabel, { color: '#FCD34D' }]}>YET TO RECEIVE</Text>
                    <Text style={[styles.balanceBoxVal, { color: '#FBBF24' }]}>
                      {remainingProjectBalance.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MT
                    </Text>
                  </View>
                  <View style={styles.balanceBox}>
                    <Text style={styles.balanceBoxLabel}>DELIVERIES</Text>
                    <Text style={styles.balanceBoxVal}>{projectInwardList.length} Units</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#CBD5E1' }}>
                      Delivery Fulfilled: <Text style={{ color: '#34D399', fontWeight: '900' }}>{projectProgressPct}%</Text>
                    </Text>
                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                      {remainingProjectBalance === 0 ? 'Target 100% Met' : `${remainingProjectBalance.toLocaleString()} MT remaining`}
                    </Text>
                  </View>
                  <View style={styles.balanceProgressBarTrack}>
                    <View style={[styles.balanceProgressBarFill, { width: `${projectProgressPct}%` }]} />
                  </View>
                </View>
              </LinearGradient>

              {/* Section 1 Header & Action */}
              <View style={styles.sectionHeaderCard}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Feather name="clock" size={15} color="#00705a" />
                    <Text style={styles.sectionTitle}>1. Vehicle Turnaround & In-Time History</Text>
                  </View>
                  <Text style={styles.sectionDesc}>
                    Truck & wagon in-time, scale dwell, gross/tare verification & balance
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.receiveBtn}
                  activeOpacity={0.85}
                  onPress={handleOpenReceiveModal}
                >
                  <Feather name="plus" size={15} color="#FFFFFF" />
                  <Text style={styles.receiveBtnText}>+ Receive</Text>
                </TouchableOpacity>
              </View>

              {/* Trip Search Input */}
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color="#94A3B8" />
                <TextInput
                  placeholder="Search vehicle plate, driver, origin..."
                  placeholderTextColor="#94A3B8"
                  value={tripSearch}
                  onChangeText={setTripSearch}
                  style={styles.searchInput}
                />
              </View>

              {/* Inward Deliveries List */}
              {projectInwardList.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Feather name="truck" size={32} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No Deliveries Logged Yet</Text>
                  <Text style={styles.emptyDesc}>Tap "+ Receive" above to record the first vehicle or rail wagon weighment.</Text>
                </View>
              ) : (
                projectInwardList
                  .filter(r => {
                    const q = tripSearch.toLowerCase();
                    return !q || (r.vehicleNumber || '').toLowerCase().includes(q) || (r.driverName || '').toLowerCase().includes(q) || (r.sourceLocation || '').toLowerCase().includes(q);
                  })
                  .map(rec => {
                    const isRail = rec.transportMode === 'RAIL_RAKE' || rec.vehicleNumber?.startsWith('BOX') || rec.vehicleNumber?.startsWith('BCN');
                    const dwell = rec.dwellMinutes || 25;
                    const balance = receiptBalancesMap.get(rec.id);

                    return (
                      <View key={rec.id} style={styles.tripCard}>
                        {/* Trip Top Row */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={[styles.carrierBadge, isRail ? styles.railBadge : styles.truckBadge]}>
                              {isRail ? (
                                <MaterialCommunityIcons name="train" size={13} color="#22D3EE" />
                              ) : (
                                <Feather name="truck" size={12} color="#FDE047" />
                              )}
                              <Text style={[styles.carrierText, isRail ? { color: '#67E8F9' } : { color: '#FDE047' }]}>
                                {rec.vehicleNumber}
                              </Text>
                            </View>
                            <Text style={styles.carrierTypeLabel}>{isRail ? 'Rail Wagon' : 'Road Truck'}</Text>
                          </View>

                          <View style={styles.dwellBadge}>
                            <View style={[styles.dwellDot, { backgroundColor: dwell > 60 ? '#EF4444' : dwell > 30 ? '#F59E0B' : '#10B981' }]} />
                            <Text style={styles.dwellText}>{dwell}m dwell</Text>
                          </View>
                        </View>

                        {/* Origin & Pilot */}
                        <View style={{ marginTop: 8, gap: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="location-outline" size={13} color="#64748B" />
                            <Text style={styles.tripOrigin}>{rec.sourceLocation || 'Quarry Pit Face 04'}</Text>
                          </View>
                          <Text style={styles.tripConsignor}>
                            Consignor: <Text style={{ color: '#0F172A', fontWeight: '700' }}>{rec.supplierName || 'National Mineral Corp'}</Text>
                          </Text>
                          <Text style={styles.tripDriver}>
                            Pilot: {rec.driverName || 'Primary Pilot'} {rec.driverPhone ? `(${rec.driverPhone})` : ''}
                          </Text>
                        </View>

                        {/* Weights Row */}
                        <View style={styles.tripWeightsRow}>
                          <View style={styles.weightItem}>
                            <Text style={styles.weightLabel}>Gross / Tare</Text>
                            <Text style={styles.weightVal}>
                              {rec.grossWeight ? rec.grossWeight.toFixed(1) : '—'} / {rec.tareWeight ? rec.tareWeight.toFixed(1) : '—'} MT
                            </Text>
                          </View>

                          <View style={styles.weightItem}>
                            <Text style={styles.weightLabel}>Net Delivered</Text>
                            <Text style={[styles.weightVal, { color: '#00705a', fontWeight: '900', fontSize: 14 }]}>
                              {rec.quantity.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MT
                            </Text>
                          </View>

                          <View style={[styles.weightItem, { backgroundColor: '#ECFDF5', paddingHorizontal: 6, borderRadius: 8 }]}>
                            <Text style={[styles.weightLabel, { color: '#047857' }]}>Total Recv.</Text>
                            <Text style={[styles.weightVal, { color: '#047857' }]}>
                              {(balance?.delivered ?? rec.quantity).toLocaleString()} MT
                            </Text>
                          </View>

                          <View style={[styles.weightItem, { backgroundColor: '#FFFBEB', paddingHorizontal: 6, borderRadius: 8 }]}>
                            <Text style={[styles.weightLabel, { color: '#B45309' }]}>Balance Rem.</Text>
                            <Text style={[styles.weightVal, { color: '#B45309' }]}>
                              {(balance?.remaining ?? 0).toLocaleString()} MT
                            </Text>
                          </View>
                        </View>

                        {/* Trip Footer */}
                        <View style={styles.tripFooter}>
                          <Text style={styles.tripDate}>
                            {new Date(rec.gateInTime || rec.createdAt).toLocaleDateString()} • {new Date(rec.gateInTime || rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <View style={styles.grnBadge}>
                            <Text style={styles.grnText}>{rec.grnNumber || 'GRN-VERIFIED'}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* ==================================================== */}
      {/* MODAL: RECEIVE VEHICLE & RAIL WAGON                  */}
      {/* ==================================================== */}
      <Modal
        visible={isReceiveModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsReceiveModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Receive Vehicle / Rail Wagon</Text>
                <Text style={styles.modalSubtitle}>Inward weighbridge gate entry & stock addition</Text>
              </View>
              <TouchableOpacity onPress={() => setIsReceiveModalOpen(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }} contentContainerStyle={{ gap: 14 }}>
              {/* 1. Mode Selector */}
              <View>
                <Text style={styles.fieldLabel}>1. CARRIER TRANSPORT MODE</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.modeBtn, carrierMode === 'TRUCK' && styles.modeBtnActive]}
                    onPress={() => {
                      setCarrierMode('TRUCK');
                      setReceiveForm(prev => ({
                        ...prev,
                        vehicleNumber: DEFAULT_ROAD_VEHICLES[0].vehicleNumber,
                        vehicleType: DEFAULT_ROAD_VEHICLES[0].vehicleType,
                        driverName: DEFAULT_ROAD_VEHICLES[0].driverName,
                        driverPhone: DEFAULT_ROAD_VEHICLES[0].driverPhone,
                        grossWeight: '52.40',
                        tareWeight: '17.20',
                        netWeight: '35.20'
                      }));
                    }}
                  >
                    <Feather name="truck" size={18} color={carrierMode === 'TRUCK' ? '#00705a' : '#64748B'} />
                    <Text style={[styles.modeBtnText, carrierMode === 'TRUCK' && styles.modeBtnTextActive]}>
                      Road Truck
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modeBtn, carrierMode === 'RAIL_RAKE' && styles.modeBtnActive]}
                    onPress={() => {
                      setCarrierMode('RAIL_RAKE');
                      setReceiveForm(prev => ({
                        ...prev,
                        vehicleNumber: DEFAULT_RAIL_WAGONS[0].vehicleNumber,
                        vehicleType: DEFAULT_RAIL_WAGONS[0].vehicleType,
                        driverName: DEFAULT_RAIL_WAGONS[0].driverName,
                        driverPhone: DEFAULT_RAIL_WAGONS[0].driverPhone,
                        grossWeight: '88.50',
                        tareWeight: '27.50',
                        netWeight: '61.00'
                      }));
                    }}
                  >
                    <MaterialCommunityIcons name="train" size={20} color={carrierMode === 'RAIL_RAKE' ? '#00705a' : '#64748B'} />
                    <Text style={[styles.modeBtnText, carrierMode === 'RAIL_RAKE' && styles.modeBtnTextActive]}>
                      Rail Wagon
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 2. Fast Carrier Quick Select Chips */}
              <View>
                <Text style={styles.fieldLabel}>2. SELECT FROM ROSTER</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {(carrierMode === 'RAIL_RAKE' ? DEFAULT_RAIL_WAGONS : [...DEFAULT_ROAD_VEHICLES, ...availableVehicles]).slice(0, 6).map((item, idx) => {
                    const isSel = receiveForm.vehicleNumber.toUpperCase() === item.vehicleNumber.toUpperCase();
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.rosterChip, isSel && styles.rosterChipActive]}
                        onPress={() => {
                          const estTare = carrierMode === 'RAIL_RAKE' ? 27.5 : 17.2;
                          const estNet = item.payloadCapacity || (carrierMode === 'RAIL_RAKE' ? 61.0 : 35.2);
                          setReceiveForm(prev => ({
                            ...prev,
                            vehicleNumber: item.vehicleNumber,
                            vehicleType: item.vehicleType,
                            driverName: item.driverName || prev.driverName,
                            driverPhone: item.driverPhone || prev.driverPhone,
                            grossWeight: String((estTare + estNet).toFixed(2)),
                            tareWeight: String(estTare),
                            netWeight: String(estNet)
                          }));
                        }}
                      >
                        <Text style={[styles.rosterChipNum, isSel && styles.rosterChipNumActive]}>
                          {item.vehicleNumber}
                        </Text>
                        <Text style={styles.rosterChipType}>~{item.payloadCapacity || 35}T</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Vehicle Number & Type */}
              <View>
                <Text style={styles.inputLabel}>Carrier Registration / Wagon No.</Text>
                <TextInput
                  placeholder="e.g. OD-05-BB-8921 or BOXN-94102"
                  placeholderTextColor="#94A3B8"
                  value={receiveForm.vehicleNumber}
                  onChangeText={val => setReceiveForm({ ...receiveForm, vehicleNumber: val.toUpperCase() })}
                  style={styles.modalInput}
                />
              </View>

              {/* Driver & Phone */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Driver / Pilot</Text>
                  <TextInput
                    placeholder="e.g. Rajesh Swain"
                    placeholderTextColor="#94A3B8"
                    value={receiveForm.driverName}
                    onChangeText={val => setReceiveForm({ ...receiveForm, driverName: val })}
                    style={styles.modalInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Driver Phone</Text>
                  <TextInput
                    placeholder="e.g. +91 94371 88921"
                    placeholderTextColor="#94A3B8"
                    value={receiveForm.driverPhone}
                    onChangeText={val => setReceiveForm({ ...receiveForm, driverPhone: val })}
                    style={styles.modalInput}
                  />
                </View>
              </View>

              {/* Weighbridge Weights: Gross, Tare, Net */}
              <View style={styles.wbInputCard}>
                <Text style={styles.wbCardTitle}>Weighbridge Weights (MT)</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Gross (MT)</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={receiveForm.grossWeight}
                      onChangeText={val => {
                        const g = parseFloat(val) || 0;
                        const t = parseFloat(receiveForm.tareWeight) || 0;
                        setReceiveForm({
                          ...receiveForm,
                          grossWeight: val,
                          netWeight: g > t ? (g - t).toFixed(2) : '0.00'
                        });
                      }}
                      style={styles.modalInput}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Tare (MT)</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={receiveForm.tareWeight}
                      onChangeText={val => {
                        const t = parseFloat(val) || 0;
                        const g = parseFloat(receiveForm.grossWeight) || 0;
                        setReceiveForm({
                          ...receiveForm,
                          tareWeight: val,
                          netWeight: g > t ? (g - t).toFixed(2) : '0.00'
                        });
                      }}
                      style={styles.modalInput}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: '#00705a', fontWeight: '900' }]}>Net (MT)</Text>
                    <View style={styles.netDisplayBox}>
                      <Text style={styles.netDisplayText}>{receiveForm.netWeight || '0.00'}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* LIVE BALANCE IMPACT PREVIEW */}
              {(() => {
                const addNet = parseFloat(receiveForm.netWeight) || 0;
                const newRecv = totalReceiptsWeight + addNet;
                const newRem = Math.max(0, parseFloat((projectScopeWeight - newRecv).toFixed(2)));
                const newPct = projectScopeWeight > 0 ? Math.min(100, Math.round((newRecv / projectScopeWeight) * 100)) : 0;

                return (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewTitle}>Balance Impact Preview</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={styles.previewText}>Contract Scope: {projectScopeWeight.toLocaleString()} MT</Text>
                      <Text style={styles.previewText}>This Delivery: +{addNet} MT</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text style={[styles.previewText, { color: '#34D399', fontWeight: '900' }]}>New Total: {newRecv.toFixed(1)} MT</Text>
                      <Text style={[styles.previewText, { color: '#FBBF24', fontWeight: '900' }]}>Remaining: {newRem.toFixed(1)} MT</Text>
                    </View>
                  </View>
                );
              })()}

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                activeOpacity={0.85}
                disabled={isSubmitting}
                onPress={handleSubmitReceive}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check" size={18} color="#FFFFFF" />
                    <Text style={styles.modalSubmitText}>Confirm Weighment & Receive</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  appBarTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  appBarSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  bannerCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 4,
  },
  bannerTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#34D399',
    letterSpacing: 0.8,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 6,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 18,
  },
  bannerStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  bannerStatCol: {
    flex: 1,
  },
  bannerStatValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  bannerStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  sectionHeaderLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  codeBadge: {
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: '#0F172A',
    color: '#FDE047',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  divisionBadge: {
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: '#F1F5F9',
    color: '#475569',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6,
  },
  cardLocation: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  wbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  wbBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00705a',
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  progressValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  viewDetailsText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00705a',
  },
  hubHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hubCodeBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#00705a',
  },
  hubTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  hubLocation: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  hubStatusBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  hubStatusText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#00705a',
  },
  hubMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  hubMetricBox: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hubMetricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
  },
  hubMetricVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  subtextCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  projectPortalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  portalProjectName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  portalCommodity: {
    fontSize: 11,
    fontWeight: '600',
    color: '#00705a',
    marginTop: 2,
  },
  portalAvailableBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  portalAvailableText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#00705a',
  },
  portalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  portalStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  portalStatVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  portalCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  portalFooterLink: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00705a',
  },
  balanceBanner: {
    borderRadius: 20,
    padding: 16,
  },
  balanceBannerTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#34D399',
    letterSpacing: 0.8,
  },
  balanceProjectTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },
  balanceCommodityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6EE7B7',
    marginTop: 1,
  },
  balanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  balanceBox: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  balanceBoxLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94A3B8',
  },
  balanceBoxVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  balanceProgressBarTrack: {
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    overflow: 'hidden',
  },
  balanceProgressBarFill: {
    height: 8,
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  sectionHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  sectionDesc: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  receiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00705a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  receiveBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  carrierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  truckBadge: {
    backgroundColor: '#0F172A',
  },
  railBadge: {
    backgroundColor: '#1E1B4B',
  },
  carrierText: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'Courier',
  },
  carrierTypeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  dwellBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dwellDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dwellText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
  },
  tripOrigin: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  tripConsignor: {
    fontSize: 10,
    color: '#64748B',
  },
  tripDriver: {
    fontSize: 10,
    color: '#64748B',
  },
  tripWeightsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
  },
  weightItem: {
    alignItems: 'center',
  },
  weightLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
  },
  weightVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tripDate: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  grnBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  grnText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#00705a',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  modeBtnActive: {
    borderColor: '#00705a',
    backgroundColor: '#ECFDF5',
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  modeBtnTextActive: {
    color: '#00705a',
    fontWeight: '900',
  },
  rosterChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rosterChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#00705a',
  },
  rosterChipNum: {
    fontSize: 11,
    fontWeight: '900',
    color: '#334155',
  },
  rosterChipNumActive: {
    color: '#00705a',
  },
  rosterChipType: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 1,
  },
  wbInputCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  wbCardTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#00705a',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  netDisplayBox: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  netDisplayText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#00705a',
  },
  previewBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
  },
  previewTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#34D399',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewText: {
    fontSize: 11,
    color: '#E2E8F0',
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00705a',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 10,
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#00705a',
    fontWeight: '900',
  },
  stockPointCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
  },
  spCodeBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  spCodeBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#34D399',
    fontFamily: 'monospace',
  },
  spNameText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  spDescText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  spTypeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  spTypeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  spCapLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  spCapValue: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  spFlowGrid: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  spFlowBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  spFlowLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  spFlowVal: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },
  spCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  spStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  spHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  spHistoryBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
  },
  spShiftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
  },
  spShiftBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00705a',
  },
  segmentedTabBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentedTabBtnActive: {
    backgroundColor: '#00705a',
    borderColor: '#00705a',
  },
  segmentedTabText: {
    fontWeight: '700',
    color: '#64748B',
  },
  segmentedTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  shiftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  shiftTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  shiftTypeBadgeText: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  shiftCardTitle: {
    fontWeight: '800',
    color: '#0F172A',
  },
  shiftCardQty: {
    fontWeight: '900',
  },
  shiftRouteText: {
    color: '#475569',
    fontWeight: '600',
  },
});
