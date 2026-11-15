import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  RefreshControl, ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { mobileApiFetch } from '../../services/api';

interface VehicleAsset {
  id: number;
  vehicleNumber: string;
  fleetCode?: string;
  vehicleType: string;
  make?: string;
  model?: string;
  capacity?: number;
  category: 'HAULAGE_TRUCK' | 'HEAVY_MACHINERY' | 'RAIL_WAGON';
  status: 'Active' | 'Under Maintenance' | 'Idle';
  assignedDriverName?: string;
  assignedDriverPhone?: string;
  currentWorksite?: string;
  insuranceExpiryDate?: string;
  fitnessExpiryDate?: string;
}

const DEFAULT_FLEET: VehicleAsset[] = [
  {
    id: 1,
    vehicleNumber: 'OD-05-BB-8921',
    fleetCode: 'FLT-TRK-01',
    vehicleType: 'BharatBenz 3528C Tipper (35T)',
    make: 'BharatBenz',
    model: '3528C',
    capacity: 35.0,
    category: 'HAULAGE_TRUCK',
    status: 'Active',
    assignedDriverName: 'Rajesh Kumar Swain',
    assignedDriverPhone: '+91 94371 88921',
    currentWorksite: 'Rewa Quarry Pit 04',
    insuranceExpiryDate: '2027-03-31',
    fitnessExpiryDate: '2027-04-15'
  },
  {
    id: 2,
    vehicleNumber: 'OD-05-AA-7712',
    fleetCode: 'FLT-TRK-02',
    vehicleType: 'Tata Prima 2830.K Tipper (28T)',
    make: 'Tata Motors',
    model: 'Prima 2830.K',
    capacity: 28.0,
    category: 'HAULAGE_TRUCK',
    status: 'Active',
    assignedDriverName: 'Sunil Pradhan',
    assignedDriverPhone: '+91 98610 22134',
    currentWorksite: 'Satna Transshipment Siding',
    insuranceExpiryDate: '2027-05-20',
    fitnessExpiryDate: '2027-06-10'
  },
  {
    id: 3,
    vehicleNumber: 'EXC-CAT-336D',
    fleetCode: 'EQP-EXC-01',
    vehicleType: 'CAT 336D Hydraulic Excavator',
    make: 'Caterpillar',
    model: '336D',
    capacity: 45.0,
    category: 'HEAVY_MACHINERY',
    status: 'Active',
    assignedDriverName: 'Dhananjay Singh (Operator)',
    assignedDriverPhone: '+91 97780 44551',
    currentWorksite: 'Rewa Quarry Face',
    insuranceExpiryDate: '2027-08-30',
    fitnessExpiryDate: '2027-09-12'
  },
  {
    id: 4,
    vehicleNumber: 'BOXN-94102',
    fleetCode: 'FLT-RAIL-01',
    vehicleType: 'BOXN Open Freight Wagon',
    make: 'Indian Railways / Titagarh',
    model: 'BOXN High Side',
    capacity: 58.5,
    category: 'RAIL_WAGON',
    status: 'Active',
    assignedDriverName: 'Loco Pilot K. K. Verma',
    assignedDriverPhone: '+91 97524 10021',
    currentWorksite: 'Western DFCC Corridor',
    insuranceExpiryDate: '2028-01-01',
    fitnessExpiryDate: '2028-01-01'
  },
  {
    id: 5,
    vehicleNumber: 'WBL-KOM-WA380',
    fleetCode: 'EQP-LDR-02',
    vehicleType: 'Komatsu WA380-6 Wheel Loader',
    make: 'Komatsu',
    model: 'WA380-6',
    capacity: 30.0,
    category: 'HEAVY_MACHINERY',
    status: 'Under Maintenance',
    assignedDriverName: 'Mohammad Rafiq',
    assignedDriverPhone: '+91 91250 88901',
    currentWorksite: 'Central Yard Workshop',
    insuranceExpiryDate: '2027-02-28',
    fitnessExpiryDate: '2027-03-15'
  }
];

export default function FleetHubScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [fleet, setFleet] = useState<VehicleAsset[]>(DEFAULT_FLEET);
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'TRUCKS' | 'MACHINERY' | 'RAIL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchFleet = async () => {
    try {
      const res = await mobileApiFetch('/api/tenant/vehicles');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setFleet(data);
        }
      }
    } catch (err) {
      console.warn('Error fetching fleet:', err);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFleet();
    setRefreshing(false);
  };

  const filtered = fleet.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || item.vehicleNumber.toLowerCase().includes(q) || item.vehicleType.toLowerCase().includes(q) || (item.assignedDriverName || '').toLowerCase().includes(q);
    const matchCat =
      activeCategory === 'ALL' ||
      (activeCategory === 'TRUCKS' && item.category === 'HAULAGE_TRUCK') ||
      (activeCategory === 'MACHINERY' && item.category === 'HEAVY_MACHINERY') ||
      (activeCategory === 'RAIL' && item.category === 'RAIL_WAGON');
    return matchSearch && matchCat;
  });

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
            <Text style={styles.appBarTitle}>Fleet & Machinery Hub</Text>
            <Text style={styles.appBarSubtitle}>Tippers, rail wagons & heavy equipment roster</Text>
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
          colors={['#0F172A', '#1E293B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bannerCard}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name="truck" size={16} color="#FBBF24" />
            <Text style={styles.bannerTag}>EQUIPMENT & ASSET INVENTORY</Text>
          </View>
          <Text style={styles.bannerTitle}>Commercial Fleet & Heavy Machinery</Text>
          <Text style={styles.bannerSubtitle}>
            Track payload capacities, operating locations, maintenance schedules & certified operators.
          </Text>

          <View style={styles.bannerStatsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatVal}>{fleet.length}</Text>
              <Text style={styles.bannerStatLabel}>TOTAL ASSETS</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatVal}>{fleet.filter(f => f.status === 'Active').length}</Text>
              <Text style={styles.bannerStatLabel}>ACTIVE ON DUTY</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatVal}>
                {fleet.filter(f => f.status === 'Under Maintenance').length}
              </Text>
              <Text style={styles.bannerStatLabel}>IN WORKSHOP</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Filter Category Chips */}
        <View style={styles.catChipsRow}>
          <TouchableOpacity
            style={[styles.catChip, activeCategory === 'ALL' && styles.catChipActive]}
            onPress={() => setActiveCategory('ALL')}
          >
            <Text style={[styles.catChipText, activeCategory === 'ALL' && styles.catChipTextActive]}>All ({fleet.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.catChip, activeCategory === 'TRUCKS' && styles.catChipActive]}
            onPress={() => setActiveCategory('TRUCKS')}
          >
            <Text style={[styles.catChipText, activeCategory === 'TRUCKS' && styles.catChipTextActive]}>Tippers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.catChip, activeCategory === 'MACHINERY' && styles.catChipActive]}
            onPress={() => setActiveCategory('MACHINERY')}
          >
            <Text style={[styles.catChipText, activeCategory === 'MACHINERY' && styles.catChipTextActive]}>Heavy Equipment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.catChip, activeCategory === 'RAIL' && styles.catChipActive]}
            onPress={() => setActiveCategory('RAIL')}
          >
            <Text style={[styles.catChipText, activeCategory === 'RAIL' && styles.catChipTextActive]}>Rail Wagons</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#94A3B8" />
          <TextInput
            placeholder="Search vehicle number, make or pilot..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* Assets List */}
        <Text style={styles.sectionLabel}>FLEET ASSETS ({filtered.length})</Text>

        {filtered.map(item => {
          const isMaint = item.status === 'Under Maintenance';
          const isRail = item.category === 'RAIL_WAGON';
          const isMach = item.category === 'HEAVY_MACHINERY';

          return (
            <View key={item.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.plateBox, isRail ? styles.plateRail : isMach ? styles.plateMach : styles.plateTruck]}>
                      {isRail ? (
                        <MaterialCommunityIcons name="train" size={12} color="#22D3EE" />
                      ) : isMach ? (
                        <MaterialCommunityIcons name="crane" size={12} color="#FBBF24" />
                      ) : (
                        <Feather name="truck" size={11} color="#FDE047" />
                      )}
                      <Text style={[styles.plateText, isRail ? { color: '#67E8F9' } : isMach ? { color: '#FCD34D' } : { color: '#FDE047' }]}>
                        {item.vehicleNumber}
                      </Text>
                    </View>
                    <Text style={styles.codeText}>{item.fleetCode || 'FLT-00'}</Text>
                  </View>

                  <Text style={styles.assetTitle}>{item.vehicleType}</Text>
                </View>

                <View style={[styles.statusBadge, isMaint ? styles.statusMaint : styles.statusActive]}>
                  <Text style={[styles.statusText, isMaint ? { color: '#B91C1C' } : { color: '#047857' }]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Specs & Driver */}
              <View style={styles.assetDetailsGrid}>
                <View>
                  <Text style={styles.detLabel}>Payload / Cap</Text>
                  <Text style={styles.detVal}>{item.capacity || 35} MT</Text>
                </View>
                <View>
                  <Text style={styles.detLabel}>Current Worksite</Text>
                  <Text style={styles.detVal} numberOfLines={1}>{item.currentWorksite || 'Central Depot'}</Text>
                </View>
                <View>
                  <Text style={styles.detLabel}>Operator / Driver</Text>
                  <Text style={styles.detVal} numberOfLines={1}>{item.assignedDriverName || 'Designated Driver'}</Text>
                </View>
              </View>

              {/* Compliance & Contact Footer */}
              <View style={styles.cardFooter}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Feather name="shield" size={12} color="#10B981" />
                  <Text style={styles.footerCompliance}>Insurance: {item.insuranceExpiryDate || 'Valid 2027'}</Text>
                </View>
                <Text style={styles.footerPhone}>{item.assignedDriverPhone || '+91 94371 88921'}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
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
    color: '#FCD34D',
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
    color: '#FCD34D',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  catChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catChipActive: {
    backgroundColor: '#00705a',
    borderColor: '#00705a',
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  catChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
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
    marginTop: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  plateTruck: {
    backgroundColor: '#0F172A',
  },
  plateRail: {
    backgroundColor: '#1E1B4B',
  },
  plateMach: {
    backgroundColor: '#451A03',
  },
  plateText: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'Courier',
  },
  codeText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  assetTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#ECFDF5',
  },
  statusMaint: {
    backgroundColor: '#FEF2F2',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
  },
  assetDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  detLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  detVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
    maxWidth: 100,
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
  footerCompliance: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '700',
  },
  footerPhone: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
});
