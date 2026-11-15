import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { getAuth } from '@react-native-firebase/auth';
import { mobileApiFetch } from '../../services/api';

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
  rateType: string;
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
  shift: string;
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

export default function TemporaryVehiclesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();

  const [vehicles, setVehicles] = useState<TemporaryVehicle[]>([]);
  const [summary, setSummary] = useState<any>({
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

  // Log Shift Form State
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

  // Live Auto-Calculation for Running Time & Cost in Modal
  const modalCalculations = useMemo(() => {
    if (!selectedVehicle) return { runningHoursFormatted: '0h 00m', idleMinutes: 0, cost: 0 };
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

      const res = await mobileApiFetch(`/api/tenant/temporary-vehicles?${params.toString()}`);
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
    const user = getAuth().currentUser;
    if (!user) return;
    try {
      const res = await mobileApiFetch(`/api/tenant/projects/${user.uid}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setProjectsList(data.map((p: any) => ({ id: p.id || p.project_id, name: p.name })));
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
  }, []);

  const handleCreateVehicle = async () => {
    if (!newVehicle.vehicleNumber.trim() || !newVehicle.vendorName.trim()) {
      Alert.alert('Required Fields', 'Please enter Vehicle Number and Vendor Name.');
      return;
    }
    try {
      const res = await mobileApiFetch('/api/tenant/temporary-vehicles', {
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
        Alert.alert('Success', 'Temporary vehicle added successfully.');
      } else {
        const err = await res.json();
        Alert.alert('Error', err.error || 'Failed to add vehicle');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
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

  const handleSaveLog = async () => {
    if (!selectedVehicle) return;
    try {
      const res = await mobileApiFetch(`/api/tenant/temporary-vehicles/${selectedVehicle.id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logForm)
      });
      if (res.ok) {
        setIsLogModalOpen(false);
        fetchVehicles();
        Alert.alert('Success', 'Shift running time logged successfully.');
      } else {
        const err = await res.json();
        Alert.alert('Error', err.error || 'Failed to save log');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleOpenHistory = async (v: TemporaryVehicle) => {
    setSelectedVehicle(v);
    setIsHistoryModalOpen(true);
    setLogsLoading(true);
    try {
      const res = await mobileApiFetch(`/api/tenant/temporary-vehicles/${v.id}/logs`);
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

  const handleDeleteVehicle = (id: number) => {
    Alert.alert(
      'Remove Temporary Vehicle',
      'Are you sure you want to remove this vehicle from the roster?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await mobileApiFetch(`/api/tenant/temporary-vehicles/${id}`, {
                method: 'DELETE'
              });
              if (res.ok) {
                fetchVehicles();
              }
            } catch (err) {
              console.error('Failed to delete vehicle:', err);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      {/* ── HEADER BAR ────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuBtn}>
            <Ionicons name="menu-outline" size={26} color="#0F172A" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Temporary Fleet</Text>
            <Text style={styles.headerSubtitle}>Live Running Time & Rental Costs</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setIsAddModalOpen(true)}
          style={styles.headerAddBtn}
        >
          <Feather name="plus" size={16} color="#FFFFFF" />
          <Text style={styles.headerAddBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchVehicles} tintColor="#00705a" />
        }
      >
        {/* ── 4 CALCULATION TILES ──────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tilesScroll}>
          {/* Tile 1: Total Fleet */}
          <View style={styles.calcTile}>
            <View style={styles.calcTileHeader}>
              <Text style={styles.calcTileLabel}>Hired Assets</Text>
              <View style={[styles.tileIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Feather name="truck" size={14} color="#00705a" />
              </View>
            </View>
            <Text style={styles.calcTileValue}>{summary.totalVehicles}</Text>
            <View style={styles.calcTileBadgeRow}>
              <Text style={styles.activePill}>{summary.activeVehicles} Active</Text>
              <Text style={styles.standbyPill}>{summary.standbyVehicles} Standby</Text>
            </View>
          </View>

          {/* Tile 2: Total Running Time */}
          <View style={styles.calcTile}>
            <View style={styles.calcTileHeader}>
              <Text style={styles.calcTileLabel}>Running Time</Text>
              <View style={[styles.tileIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Feather name="clock" size={14} color="#00705a" />
              </View>
            </View>
            <Text style={[styles.calcTileValue, { color: '#00705a' }]}>
              {summary.totalRunningHoursFormatted}
            </Text>
            <Text style={styles.calcTileSubtext}>
              {summary.totalRunningHours} hrs productive
            </Text>
          </View>

          {/* Tile 3: Idle Standby Time */}
          <View style={styles.calcTile}>
            <View style={styles.calcTileHeader}>
              <Text style={styles.calcTileLabel}>Standby Idle</Text>
              <View style={[styles.tileIconBox, { backgroundColor: '#FFFBEB' }]}>
                <Feather name="pause-circle" size={14} color="#D97706" />
              </View>
            </View>
            <Text style={[styles.calcTileValue, { color: '#D97706' }]}>
              {summary.totalIdleHoursFormatted}
            </Text>
            <Text style={styles.calcTileSubtext}>
              {summary.totalIdleHours} hrs standby
            </Text>
          </View>

          {/* Tile 4: Total Rental Cost */}
          <View style={styles.calcTile}>
            <View style={styles.calcTileHeader}>
              <Text style={styles.calcTileLabel}>Total Rental Cost</Text>
              <View style={[styles.tileIconBox, { backgroundColor: '#0F172A' }]}>
                <MaterialCommunityIcons name="currency-inr" size={14} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.calcTileValue}>
              ₹ {summary.totalCost.toLocaleString('en-IN')}
            </Text>
            <Text style={[styles.calcTileSubtext, { color: '#00705a', fontWeight: '700' }]}>
              Auto-calculated
            </Text>
          </View>
        </ScrollView>

        {/* ── PROJECT ROLLUP BREAKDOWN BANNER ──────────────────────── */}
        {summary.projectRollup && summary.projectRollup.length > 0 && (
          <LinearGradient
            colors={['#0F172A', '#03261F']}
            style={styles.projectRollupCard}
          >
            <View style={styles.rollupHeader}>
              <Feather name="briefcase" size={14} color="#10B981" />
              <Text style={styles.rollupTitle}>Project Running Time Allocation</Text>
            </View>
            {summary.projectRollup.map((proj: any, idx: number) => (
              <View key={idx} style={styles.rollupItem}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.rollupProjectName} numberOfLines={1}>
                    {proj.projectName}
                  </Text>
                  <Text style={styles.rollupVehicleCount}>
                    {proj.vehicleCount} vehicle{proj.vehicleCount > 1 ? 's' : ''} deployed
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.rollupHours}>
                    ⏱ {proj.runningHoursFormatted}
                  </Text>
                  <Text style={styles.rollupCost}>
                    ₹ {proj.totalCost.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            ))}
          </LinearGradient>
        )}

        {/* ── SEARCH & FILTER ROW ──────────────────────────────────── */}
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search vehicle, vendor, driver, project..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={(txt) => {
              setSearchQuery(txt);
              fetchVehicles();
            }}
            style={styles.searchInput}
          />
        </View>

        {/* Status Filter Chips */}
        <View style={styles.chipsRow}>
          {['ALL', 'Active', 'Standby', 'Released'].map((st) => (
            <TouchableOpacity
              key={st}
              onPress={() => setSelectedStatus(st)}
              style={[
                styles.chipBtn,
                selectedStatus === st && styles.chipBtnActive
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedStatus === st && styles.chipTextActive
                ]}
              >
                {st === 'ALL' ? 'All Status' : st}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── VEHICLES LIST ────────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Temporary Vehicles ({vehicles.length})
          </Text>
          <TouchableOpacity onPress={fetchVehicles} style={styles.refreshBtn}>
            <Feather name="refresh-cw" size={13} color="#64748B" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#00705a" />
            <Text style={styles.loadingText}>Loading temporary fleet...</Text>
          </View>
        ) : vehicles.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="truck" size={36} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Temporary Vehicles</Text>
            <Text style={styles.emptySub}>
              Tap '+ Add' to register hired commercial vehicles and calculate project running time.
            </Text>
          </View>
        ) : (
          vehicles.map((v) => {
            const rMins = v.totalRunningMinutes || 0;
            const formattedTime = `${Math.floor(rMins / 60)}h ${rMins % 60}m`;
            return (
              <View key={v.id} style={styles.vehicleCard}>
                {/* Card Top */}
                <View style={styles.cardTop}>
                  <View style={styles.vehicleIconCircle}>
                    <Feather name="truck" size={18} color="#00705a" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.vehicleNumber}>{v.vehicleNumber}</Text>
                    <Text style={styles.vehicleType}>{v.vehicleType}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      v.status === 'Active'
                        ? styles.statusActive
                        : v.status === 'Standby'
                        ? styles.statusStandby
                        : styles.statusReleased
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        v.status === 'Active'
                          ? { color: '#059669' }
                          : v.status === 'Standby'
                          ? { color: '#D97706' }
                          : { color: '#64748B' }
                      ]}
                    >
                      {v.status}
                    </Text>
                  </View>
                </View>

                {/* Details Grid */}
                <View style={styles.cardDetailsGrid}>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>VENDOR / AGENCY</Text>
                    <Text style={styles.detailValue} numberOfLines={1}>
                      {v.vendorName}
                    </Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>DRIVER / OPERATOR</Text>
                    <Text style={styles.detailValue} numberOfLines={1}>
                      {v.driverName || 'Unassigned'}
                    </Text>
                  </View>
                </View>

                {/* Project Assignment */}
                <View style={styles.projectStrip}>
                  <Feather name="map-pin" size={12} color="#00705a" style={{ marginRight: 6 }} />
                  <Text style={styles.projectStripText} numberOfLines={1}>
                    {v.projectName} • {v.worksiteName || 'Site Yard'}
                  </Text>
                </View>

                {/* Running Time & Cost Metric Box */}
                <View style={styles.metricsBox}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>AGREED RATE</Text>
                    <Text style={styles.metricItemVal}>
                      ₹ {Number(v.agreedRate).toLocaleString('en-IN')}/hr
                    </Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>RUNNING TIME</Text>
                    <Text style={[styles.metricItemVal, { color: '#00705a' }]}>
                      ⏱ {formattedTime}
                    </Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>RENTAL COST</Text>
                    <Text style={styles.metricItemVal}>
                      ₹ {Number(v.totalCalculatedCost || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>

                {/* Card Actions */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    onPress={() => handleOpenLogModal(v)}
                    style={styles.actionBtnPrimary}
                  >
                    <Feather name="play-circle" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnPrimaryText}>Log Time</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleOpenHistory(v)}
                    style={styles.actionBtnSecondary}
                  >
                    <Feather name="file-text" size={14} color="#334155" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnSecondaryText}>
                      Logs ({v.logsCount || 0})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDeleteVehicle(v.id)}
                    style={styles.actionBtnIcon}
                  >
                    <Feather name="trash-2" size={15} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── MODAL 1: ADD TEMPORARY VEHICLE ────────────────────────── */}
      <Modal visible={isAddModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Temporary Vehicle</Text>
                <Text style={styles.modalSubtitle}>Register hired commercial vehicle</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <Text style={styles.inputLabel}>Vehicle Number *</Text>
              <TextInput
                placeholder="e.g. UP-16-BT-9900"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                value={newVehicle.vehicleNumber}
                onChangeText={(t) => setNewVehicle({ ...newVehicle, vehicleNumber: t.toUpperCase() })}
                style={styles.textInput}
              />

              <Text style={styles.inputLabel}>Vehicle Type *</Text>
              <TextInput
                placeholder="e.g. Tipper (16 Ton), Transit Mixer"
                placeholderTextColor="#94A3B8"
                value={newVehicle.vehicleType}
                onChangeText={(t) => setNewVehicle({ ...newVehicle, vehicleType: t })}
                style={styles.textInput}
              />

              <Text style={styles.inputLabel}>Vendor / Agency Name *</Text>
              <TextInput
                placeholder="e.g. Balaji Roadlines"
                placeholderTextColor="#94A3B8"
                value={newVehicle.vendorName}
                onChangeText={(t) => setNewVehicle({ ...newVehicle, vendorName: t })}
                style={styles.textInput}
              />

              <Text style={styles.inputLabel}>Vendor Phone</Text>
              <TextInput
                placeholder="+91 98765 00000"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={newVehicle.vendorPhone}
                onChangeText={(t) => setNewVehicle({ ...newVehicle, vendorPhone: t })}
                style={styles.textInput}
              />

              <Text style={styles.inputLabel}>Driver / Operator</Text>
              <TextInput
                placeholder="Driver name"
                placeholderTextColor="#94A3B8"
                value={newVehicle.driverName}
                onChangeText={(t) => setNewVehicle({ ...newVehicle, driverName: t })}
                style={styles.textInput}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Hourly Rate (₹) *</Text>
                  <TextInput
                    placeholder="1200"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={newVehicle.agreedRate}
                    onChangeText={(t) => setNewVehicle({ ...newVehicle, agreedRate: t })}
                    style={styles.textInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Standby Rate (₹)</Text>
                  <TextInput
                    placeholder="350"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={newVehicle.standbyRate}
                    onChangeText={(t) => setNewVehicle({ ...newVehicle, standbyRate: t })}
                    style={styles.textInput}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Worksite / Yard</Text>
              <TextInput
                placeholder="e.g. Casting Yard 2"
                placeholderTextColor="#94A3B8"
                value={newVehicle.worksiteName}
                onChangeText={(t) => setNewVehicle({ ...newVehicle, worksiteName: t })}
                style={styles.textInput}
              />
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                onPress={() => setIsAddModalOpen(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateVehicle}
                style={styles.modalSubmitBtn}
              >
                <Text style={styles.modalSubmitBtnText}>Add Vehicle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 2: LOG RUNNING TIME (WITH LIVE AUTO-CALCULATION) ──── */}
      <Modal visible={isLogModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Log Shift Running Time</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedVehicle?.vehicleNumber} • ₹{selectedVehicle?.agreedRate}/hr
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsLogModalOpen(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {/* Timespan Row */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Time (In)</Text>
                  <TextInput
                    placeholder="08:00"
                    placeholderTextColor="#94A3B8"
                    value={logForm.startTime}
                    onChangeText={(t) => setLogForm({ ...logForm, startTime: t })}
                    style={styles.textInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>End Time (Out)</Text>
                  <TextInput
                    placeholder="17:30"
                    placeholderTextColor="#94A3B8"
                    value={logForm.endTime}
                    onChangeText={(t) => setLogForm({ ...logForm, endTime: t })}
                    style={styles.textInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Break (mins)</Text>
                  <TextInput
                    placeholder="60"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={logForm.idleBreakMinutes}
                    onChangeText={(t) => setLogForm({ ...logForm, idleBreakMinutes: t })}
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* LIVE CALCULATION STRIP */}
              <View style={styles.liveCalcBanner}>
                <View style={styles.liveCalcItem}>
                  <Text style={styles.liveCalcLabel}>RUNNING TIME</Text>
                  <Text style={styles.liveCalcValEmerald}>
                    {modalCalculations.runningHoursFormatted}
                  </Text>
                </View>
                <View style={styles.liveCalcDivider} />
                <View style={styles.liveCalcItem}>
                  <Text style={styles.liveCalcLabel}>STANDBY</Text>
                  <Text style={styles.liveCalcValAmber}>
                    {modalCalculations.idleMinutes}m
                  </Text>
                </View>
                <View style={styles.liveCalcDivider} />
                <View style={styles.liveCalcItem}>
                  <Text style={styles.liveCalcLabel}>CALCULATED COST</Text>
                  <Text style={styles.liveCalcValCost}>
                    ₹ {modalCalculations.cost.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              {/* Meter readings */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Meter</Text>
                  <TextInput
                    placeholder="1420.0"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={logForm.startMeter}
                    onChangeText={(t) => setLogForm({ ...logForm, startMeter: t })}
                    style={styles.textInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>End Meter</Text>
                  <TextInput
                    placeholder="1515.0"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={logForm.endMeter}
                    onChangeText={(t) => setLogForm({ ...logForm, endMeter: t })}
                    style={styles.textInput}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Work Description</Text>
              <TextInput
                placeholder="e.g. Earth excavation and dumping"
                placeholderTextColor="#94A3B8"
                value={logForm.workDescription}
                onChangeText={(t) => setLogForm({ ...logForm, workDescription: t })}
                style={styles.textInput}
              />
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                onPress={() => setIsLogModalOpen(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveLog}
                style={styles.modalSubmitBtn}
              >
                <Text style={styles.modalSubmitBtnText}>Save Log</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 3: RUNNING TIME HISTORY ─────────────────────────── */}
      <Modal visible={isHistoryModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Running Logs History</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedVehicle?.vehicleNumber} • {selectedVehicle?.vendorName}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsHistoryModalOpen(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {logsLoading ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#00705a" />
                </View>
              ) : vehicleLogs.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700' }}>
                    No running logs recorded yet.
                  </Text>
                </View>
              ) : (
                vehicleLogs.map((log) => {
                  const rHrs = Math.floor(log.runningMinutes / 60);
                  const rMins = log.runningMinutes % 60;
                  return (
                    <View key={log.id} style={styles.historyLogCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                          {log.logDate} • {log.shift} Shift
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: '#0F172A' }}>
                          ₹ {Number(log.calculatedCost).toLocaleString('en-IN')}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                        <Text style={{ fontSize: 11, color: '#00705a', fontWeight: '800' }}>
                          ⏱ {rHrs}h {rMins}m running ({log.idleMinutes}m idle)
                        </Text>
                        <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>
                          {log.startTime} - {log.endTime}
                        </Text>
                      </View>
                      {log.workDescription && (
                        <Text style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                          {log.workDescription}
                        </Text>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                onPress={() => setIsHistoryModalOpen(false)}
                style={[styles.modalSubmitBtn, { flex: 1 }]}
              >
                <Text style={styles.modalSubmitBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00705a',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
  },
  headerAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tilesScroll: {
    marginBottom: 16,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  calcTile: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  calcTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calcTileLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  tileIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcTileValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 6,
  },
  calcTileBadgeRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  activePill: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  standbyPill: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  calcTileSubtext: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 6,
  },
  projectRollupCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  rollupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  rollupTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rollupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  rollupProjectName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  rollupVehicleCount: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  rollupHours: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
  },
  rollupCost: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  chipBtnActive: {
    backgroundColor: '#00705a',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  refreshBtn: {
    padding: 4,
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  vehicleIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  vehicleNumber: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  vehicleType: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#ECFDF5',
  },
  statusStandby: {
    backgroundColor: '#FFFBEB',
  },
  statusReleased: {
    backgroundColor: '#F1F5F9',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardDetailsGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  detailCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginTop: 1,
  },
  projectStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  projectStripText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00705a',
    flex: 1,
  },
  metricsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricItemLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  metricItemVal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CBD5E1',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00705a',
    borderRadius: 10,
    paddingVertical: 8,
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 8,
  },
  actionBtnSecondaryText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnIcon: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 4,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  liveCalcBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginVertical: 12,
  },
  liveCalcItem: {
    flex: 1,
    alignItems: 'center',
  },
  liveCalcLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#047857',
    textTransform: 'uppercase',
  },
  liveCalcValEmerald: {
    fontSize: 13,
    fontWeight: '900',
    color: '#065F46',
    marginTop: 2,
  },
  liveCalcValAmber: {
    fontSize: 13,
    fontWeight: '900',
    color: '#B45309',
    marginTop: 2,
  },
  liveCalcValCost: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  liveCalcDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#6EE7B7',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#00705a',
    alignItems: 'center',
  },
  modalSubmitBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  historyLogCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
});
