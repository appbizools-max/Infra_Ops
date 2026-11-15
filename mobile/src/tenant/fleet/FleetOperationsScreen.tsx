import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  RefreshControl, Modal, ActivityIndicator, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { mobileApiFetch } from '../../services/api';

interface DailyLog {
  id: number;
  assetNumber: string;
  assetType: 'vehicle' | 'equipment';
  projectName: string;
  driverName: string;
  openingKm: number;
  closingKm: number;
  distanceKm: number;
  fuelQuantityLiters: number;
  fuelAmount: number;
  logDate: string;
  status: string;
}

const DEFAULT_LOGS: DailyLog[] = [
  {
    id: 1,
    assetNumber: 'OD-05-BB-8921',
    assetType: 'vehicle',
    projectName: 'Metro Station Extension Block-C',
    driverName: 'Rajesh Kumar Swain',
    openingKm: 42150,
    closingKm: 42390,
    distanceKm: 240,
    fuelQuantityLiters: 65,
    fuelAmount: 6175,
    logDate: new Date().toISOString().slice(0, 10),
    status: 'Verified'
  },
  {
    id: 2,
    assetNumber: 'DL-1M-4412',
    assetType: 'vehicle',
    projectName: 'Metro Station Extension Block-C',
    driverName: 'Gurpreet Singh',
    openingKm: 31200,
    closingKm: 31480,
    distanceKm: 280,
    fuelQuantityLiters: 75,
    fuelAmount: 7125,
    logDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    status: 'Verified'
  },
  {
    id: 3,
    assetNumber: 'EXC-CAT-336D',
    assetType: 'equipment',
    projectName: 'Delhi Metro Rail Project (Phase IV)',
    driverName: 'Dhananjay Singh',
    openingKm: 1850,
    closingKm: 1858,
    distanceKm: 8, // 8 operating hours
    fuelQuantityLiters: 110,
    fuelAmount: 10450,
    logDate: new Date().toISOString().slice(0, 10),
    status: 'Pending Verification'
  }
];

export default function FleetOperationsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<DailyLog[]>(DEFAULT_LOGS);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const [form, setForm] = useState({
    assetNumber: 'OD-05-BB-8921',
    driverName: 'Rajesh Kumar Swain',
    projectName: 'Metro Station Extension Block-C',
    openingKm: '42390',
    closingKm: '42590',
    fuelQuantityLiters: '60',
    fuelAmount: '5700',
    notes: 'Quarry to yard haulage shift completed'
  });

  const fetchLogs = async () => {
    try {
      const res = await mobileApiFetch('/api/tenant/fleet-daily-logs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setLogs(data);
        }
      }
    } catch (err) {
      console.warn('Error loading logs:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  const handleAddLog = () => {
    const op = parseFloat(form.openingKm) || 0;
    const cl = parseFloat(form.closingKm) || 0;
    const dist = cl > op ? cl - op : 0;
    const newLog: DailyLog = {
      id: Date.now(),
      assetNumber: form.assetNumber.toUpperCase(),
      assetType: 'vehicle',
      projectName: form.projectName,
      driverName: form.driverName,
      openingKm: op,
      closingKm: cl,
      distanceKm: dist,
      fuelQuantityLiters: parseFloat(form.fuelQuantityLiters) || 0,
      fuelAmount: parseFloat(form.fuelAmount) || 0,
      logDate: new Date().toISOString().slice(0, 10),
      status: 'Verified'
    };

    setLogs([newLog, ...logs]);
    setIsLogModalOpen(false);
    Alert.alert('Log Recorded', `Duty log for ${form.assetNumber} successfully saved!`);
  };

  const totalFuelLiters = logs.reduce((sum, l) => sum + (l.fuelQuantityLiters || 0), 0);
  const totalFuelCost = logs.reduce((sum, l) => sum + (l.fuelAmount || 0), 0);
  const totalKmRun = logs.reduce((sum, l) => sum + (l.distanceKm || 0), 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.toggleDrawer()} style={styles.iconBtn}>
            <Ionicons name="menu" size={24} color="#0F172A" />
          </TouchableOpacity>
          <View>
            <Text style={styles.appBarTitle}>Fuel & Running Logs</Text>
            <Text style={styles.appBarSubtitle}>Odometer, diesel entries & trip logs</Text>
          </View>
        </View>

        <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
          <Ionicons name="refresh" size={18} color="#00705a" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00705a']} />}
      >
        {/* Banner */}
        <LinearGradient
          colors={['#0F172A', '#0F766E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bannerCard}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialCommunityIcons name="gas-station" size={16} color="#2DD4BF" />
            <Text style={styles.bannerTag}>FLEET RUNNING & DIESEL LOGS</Text>
          </View>
          <Text style={styles.bannerTitle}>Fuel Consumption & Trip Performance</Text>
          <Text style={styles.bannerSubtitle}>
            Daily trip logs, opening/closing meter readings, fuel disbursements and running efficiency.
          </Text>

          <View style={styles.bannerStatsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatVal}>{totalKmRun.toLocaleString()} KM</Text>
              <Text style={styles.bannerStatLabel}>TOTAL DISTANCE</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatVal}>{totalFuelLiters} L</Text>
              <Text style={styles.bannerStatLabel}>DIESEL FILLED</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatVal}>₹{totalFuelCost.toLocaleString()}</Text>
              <Text style={styles.bannerStatLabel}>FUEL COST</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Action Button & Search */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <View style={[styles.searchBox, { flex: 1 }]}>
            <Ionicons name="search" size={16} color="#94A3B8" />
            <TextInput
              placeholder="Search vehicle, driver or project..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            activeOpacity={0.85}
            onPress={() => setIsLogModalOpen(true)}
          >
            <Feather name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.addBtnText}>+ Log Duty</Text>
          </TouchableOpacity>
        </View>

        {/* Logs List */}
        <Text style={styles.sectionLabel}>DAILY DUTY LOGS ({logs.length})</Text>

        {logs
          .filter(l => {
            const q = searchQuery.toLowerCase();
            return !q || l.assetNumber.toLowerCase().includes(q) || l.driverName.toLowerCase().includes(q) || l.projectName.toLowerCase().includes(q);
          })
          .map(item => (
            <View key={item.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={styles.plateBox}>
                    <Feather name="truck" size={11} color="#FDE047" />
                    <Text style={styles.plateText}>{item.assetNumber}</Text>
                  </View>
                  <Text style={styles.dateTag}>{item.logDate}</Text>
                </View>

                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>

              <Text style={styles.projTitle}>{item.projectName}</Text>
              <Text style={styles.driverText}>Pilot: {item.driverName}</Text>

              {/* Metrics Grid */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricBox}>
                  <Text style={styles.mLabel}>Opening Meter</Text>
                  <Text style={styles.mVal}>{item.openingKm} KM</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.mLabel}>Closing Meter</Text>
                  <Text style={styles.mVal}>{item.closingKm} KM</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.mLabel}>Distance Run</Text>
                  <Text style={[styles.mVal, { color: '#00705a', fontWeight: '900' }]}>{item.distanceKm} KM</Text>
                </View>
              </View>

              <View style={styles.fuelRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialCommunityIcons name="gas-station" size={14} color="#00705a" />
                  <Text style={styles.fuelText}>Diesel: <Text style={{ fontWeight: '800' }}>{item.fuelQuantityLiters} L</Text></Text>
                </View>
                <Text style={styles.fuelCostText}>₹{item.fuelAmount.toLocaleString()}</Text>
              </View>
            </View>
          ))}
      </ScrollView>

      {/* Add Log Modal */}
      <Modal
        visible={isLogModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsLogModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalSheetHeader}>
              <View>
                <Text style={styles.modalTitle}>Log Daily Fleet Shift</Text>
                <Text style={styles.modalSubtitle}>Meter readings & diesel disbursement</Text>
              </View>
              <TouchableOpacity onPress={() => setIsLogModalOpen(false)} style={styles.iconBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }} contentContainerStyle={{ gap: 12 }}>
              <View>
                <Text style={styles.inputLabel}>Vehicle Number</Text>
                <TextInput
                  value={form.assetNumber}
                  onChangeText={val => setForm({ ...form, assetNumber: val.toUpperCase() })}
                  style={styles.modalInput}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Driver / Operator</Text>
                <TextInput
                  value={form.driverName}
                  onChangeText={val => setForm({ ...form, driverName: val })}
                  style={styles.modalInput}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Opening Meter (KM)</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={form.openingKm}
                    onChangeText={val => setForm({ ...form, openingKm: val })}
                    style={styles.modalInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Closing Meter (KM)</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={form.closingKm}
                    onChangeText={val => setForm({ ...form, closingKm: val })}
                    style={styles.modalInput}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Diesel Filled (L)</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={form.fuelQuantityLiters}
                    onChangeText={val => setForm({ ...form, fuelQuantityLiters: val })}
                    style={styles.modalInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Fuel Cost (₹)</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={form.fuelAmount}
                    onChangeText={val => setForm({ ...form, fuelAmount: val })}
                    style={styles.modalInput}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.submitBtn}
                activeOpacity={0.85}
                onPress={handleAddLog}
              >
                <Feather name="check" size={16} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>Save Fleet Log</Text>
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
  bannerCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 4,
  },
  bannerTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#5EEAD4',
    letterSpacing: 0.8,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 3,
    lineHeight: 16,
  },
  bannerStatsRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  bannerStatVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  bannerStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#5EEAD4',
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00705a',
    paddingHorizontal: 14,
    borderRadius: 14,
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  plateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  plateText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FDE047',
    fontFamily: 'Courier',
  },
  dateTag: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
  },
  projTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6,
  },
  driverText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  metricBox: {
    alignItems: 'center',
  },
  mLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  mVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  fuelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  fuelText: {
    fontSize: 11,
    color: '#334155',
  },
  fuelCostText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#00705a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalSheetHeader: {
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
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00705a',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 10,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
});
