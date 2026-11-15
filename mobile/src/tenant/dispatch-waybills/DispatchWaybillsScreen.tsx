import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { mobileApiFetch } from '../../services/api';

interface Waybill {
  id: number;
  waybillNumber: string;
  originYardName: string;
  destinationYardName: string;
  projectId: string;
  projectName: string;
  materialName: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  status: 'In-Transit' | 'Delivered' | 'Cancelled';
  dispatchTime: string;
  deliveryTime?: string;
}

const DEFAULT_WAYBILLS: Waybill[] = [
  {
    id: 1,
    waybillNumber: 'WB-2026-1001',
    originYardName: 'Singrauli Rail Siding & Central Stockyard',
    destinationYardName: 'Noida Metro Extension Depot',
    projectId: 'PRJ-001',
    projectName: 'Metro Station Extension Block-C',
    materialName: 'Track Ballast 40mm (RDSO)',
    vehicleNumber: 'UP-14-BT-9021',
    driverName: 'Rajesh Kumar',
    driverPhone: '+91 98765 43210',
    grossWeight: 52.4,
    tareWeight: 17.2,
    netWeight: 35.2,
    status: 'In-Transit',
    dispatchTime: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 2,
    waybillNumber: 'WB-2026-1002',
    originYardName: 'Singrauli Rail Siding & Central Stockyard',
    destinationYardName: 'Noida Metro Extension Depot',
    projectId: 'PRJ-001',
    projectName: 'Metro Station Extension Block-C',
    materialName: 'Track Ballast 40mm (RDSO)',
    vehicleNumber: 'DL-1M-4412',
    driverName: 'Gurpreet Singh',
    driverPhone: '+91 98100 77889',
    grossWeight: 48.6,
    tareWeight: 16.8,
    netWeight: 31.8,
    status: 'Delivered',
    dispatchTime: new Date(Date.now() - 86400000).toISOString(),
    deliveryTime: new Date(Date.now() - 75000000).toISOString()
  },
  {
    id: 3,
    waybillNumber: 'WB-2026-1003',
    originYardName: 'Rewa Quarry Pit 04 Face',
    destinationYardName: 'Satna Transshipment Rail Siding',
    projectId: 'PRJ-002',
    projectName: 'Delhi Metro Rail Project (Phase IV)',
    materialName: 'Subgrade GSB Crushed Stone',
    vehicleNumber: 'OD-05-BB-8921',
    driverName: 'Rajesh Kumar Swain',
    driverPhone: '+91 94371 88921',
    grossWeight: 54.0,
    tareWeight: 18.0,
    netWeight: 36.0,
    status: 'In-Transit',
    dispatchTime: new Date(Date.now() - 3600000).toISOString()
  }
];

export default function DispatchWaybillsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [waybills, setWaybills] = useState<Waybill[]>(DEFAULT_WAYBILLS);
  const [activeTab, setActiveTab] = useState<'ALL' | 'IN_TRANSIT' | 'DELIVERED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const fetchWaybills = async () => {
    try {
      const res = await mobileApiFetch('/api/tenant/dispatch-waybills');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setWaybills(data);
        }
      }
    } catch (err) {
      console.warn('Error fetching waybills:', err);
    }
  };

  useEffect(() => {
    fetchWaybills();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWaybills();
    setRefreshing(false);
  };

  const handleConfirmDelivery = async (wb: Waybill) => {
    Alert.alert(
      'Confirm Delivery',
      `Confirm receipt of ${wb.netWeight} MT on vehicle ${wb.vehicleNumber} at ${wb.destinationYardName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Receipt',
          onPress: async () => {
            setConfirmingId(wb.id);
            try {
              const res = await mobileApiFetch(`/api/tenant/dispatch-waybills/${wb.id}/deliver`, {
                method: 'PATCH',
                body: JSON.stringify({ actualDeliveredWeight: wb.netWeight })
              });
              if (res.ok) {
                Alert.alert('Delivered', `Waybill ${wb.waybillNumber} marked Delivered! Stock successfully added.`);
                setWaybills(prev =>
                  prev.map(item => item.id === wb.id ? { ...item, status: 'Delivered', deliveryTime: new Date().toISOString() } : item)
                );
              } else {
                const err = await res.json();
                Alert.alert('Error', err.error || 'Failed to confirm delivery');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Network error');
            } finally {
              setConfirmingId(null);
            }
          }
        }
      ]
    );
  };

  const filtered = waybills.filter(w => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || w.waybillNumber.toLowerCase().includes(q) || w.vehicleNumber.toLowerCase().includes(q) || w.projectName.toLowerCase().includes(q) || w.driverName.toLowerCase().includes(q);
    const matchTab = activeTab === 'ALL' || (activeTab === 'IN_TRANSIT' && w.status === 'In-Transit') || (activeTab === 'DELIVERED' && w.status === 'Delivered');
    return matchSearch && matchTab;
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
            <Text style={styles.appBarTitle}>Dispatch Waybills & Slips</Text>
            <Text style={styles.appBarSubtitle}>Gate dispatch passes & delivery receipts</Text>
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
          colors={['#0F172A', '#1E3A8A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bannerCard}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialCommunityIcons name="file-document-outline" size={16} color="#60A5FA" />
            <Text style={styles.bannerTag}>GATE PASS & WEIGHBRIDGE SLIPS</Text>
          </View>
          <Text style={styles.bannerTitle}>Material Dispatch & Transit Waybills</Text>
          <Text style={styles.bannerSubtitle}>
            Verified gross/tare weighment slips, in-transit fleet passes, and atomic delivery confirmations.
          </Text>

          <View style={styles.bannerStatsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatVal}>{waybills.filter(w => w.status === 'In-Transit').length}</Text>
              <Text style={styles.bannerStatLabel}>IN-TRANSIT</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatVal}>{waybills.filter(w => w.status === 'Delivered').length}</Text>
              <Text style={styles.bannerStatLabel}>DELIVERED</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatVal}>
                {waybills.reduce((sum, w) => sum + (w.netWeight || 0), 0).toFixed(1)} MT
              </Text>
              <Text style={styles.bannerStatLabel}>TOTAL TONNAGE</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.filterTab, activeTab === 'ALL' && styles.filterTabActive]}
            onPress={() => setActiveTab('ALL')}
          >
            <Text style={[styles.filterTabText, activeTab === 'ALL' && styles.filterTabTextActive]}>All Slips</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeTab === 'IN_TRANSIT' && styles.filterTabActive]}
            onPress={() => setActiveTab('IN_TRANSIT')}
          >
            <Text style={[styles.filterTabText, activeTab === 'IN_TRANSIT' && styles.filterTabTextActive]}>In-Transit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeTab === 'DELIVERED' && styles.filterTabActive]}
            onPress={() => setActiveTab('DELIVERED')}
          >
            <Text style={[styles.filterTabText, activeTab === 'DELIVERED' && styles.filterTabTextActive]}>Delivered</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#94A3B8" />
          <TextInput
            placeholder="Search waybill no, plate, project or driver..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* Waybills List */}
        <Text style={styles.sectionLabel}>WAYBILLS & SLIPS ({filtered.length})</Text>

        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="file-text" size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Waybills Found</Text>
            <Text style={styles.emptyDesc}>No dispatch waybills match the active filter or search query.</Text>
          </View>
        ) : (
          filtered.map(wb => {
            const isDelivered = wb.status === 'Delivered';

            return (
              <View key={wb.id} style={styles.card}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.wbCode}>{wb.waybillNumber}</Text>
                    <View style={[styles.statusBadge, isDelivered ? styles.statusDelivered : styles.statusTransit]}>
                      <Text style={[styles.statusText, isDelivered ? { color: '#047857' } : { color: '#B45309' }]}>
                        {wb.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.vehiclePlate}>
                    <Feather name="truck" size={11} color="#FDE047" />
                    <Text style={styles.plateText}>{wb.vehicleNumber}</Text>
                  </View>
                </View>

                {/* Project & Material */}
                <Text style={styles.projectName}>{wb.projectName}</Text>
                <Text style={styles.materialText}>{wb.materialName}</Text>

                {/* Route: Origin to Destination */}
                <View style={styles.routeBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="radio-button-on" size={12} color="#10B981" />
                    <Text style={styles.routePoint} numberOfLines={1}>From: {wb.originYardName}</Text>
                  </View>
                  <View style={{ width: 1, height: 10, backgroundColor: '#CBD5E1', marginLeft: 5 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="location" size={12} color="#EF4444" />
                    <Text style={styles.routePoint} numberOfLines={1}>To: {wb.destinationYardName}</Text>
                  </View>
                </View>

                {/* Weights & Driver */}
                <View style={styles.detailsGrid}>
                  <View>
                    <Text style={styles.detLabel}>Driver</Text>
                    <Text style={styles.detVal}>{wb.driverName}</Text>
                    <Text style={styles.detSub}>{wb.driverPhone}</Text>
                  </View>
                  <View>
                    <Text style={styles.detLabel}>Gross / Tare</Text>
                    <Text style={styles.detVal}>{wb.grossWeight} / {wb.tareWeight} MT</Text>
                  </View>
                  <View>
                    <Text style={styles.detLabel}>Net Stock</Text>
                    <Text style={[styles.detVal, { color: '#00705a', fontWeight: '900', fontSize: 13 }]}>
                      {wb.netWeight} MT
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.cardFooter}>
                  <Text style={styles.dateText}>
                    Dispatched: {new Date(wb.dispatchTime).toLocaleDateString()}
                  </Text>

                  {!isDelivered ? (
                    <TouchableOpacity
                      style={styles.confirmBtn}
                      activeOpacity={0.85}
                      disabled={confirmingId === wb.id}
                      onPress={() => handleConfirmDelivery(wb)}
                    >
                      {confirmingId === wb.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Feather name="check-circle" size={13} color="#FFFFFF" />
                          <Text style={styles.confirmBtnText}>Confirm Delivery</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Feather name="check" size={13} color="#10B981" />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#10B981' }}>Delivered & Stacked</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
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
    color: '#93C5FD',
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
    color: '#93C5FD',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterTabActive: {
    backgroundColor: '#00705a',
    borderColor: '#00705a',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterTabTextActive: {
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
  wbCode: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusTransit: {
    backgroundColor: '#FEF3C7',
  },
  statusDelivered: {
    backgroundColor: '#ECFDF5',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
  },
  vehiclePlate: {
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
  projectName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  materialText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#00705a',
    marginTop: 2,
  },
  routeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  routePoint: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
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
  },
  detSub: {
    fontSize: 9,
    color: '#94A3B8',
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
  dateText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00705a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  confirmBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
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
});
