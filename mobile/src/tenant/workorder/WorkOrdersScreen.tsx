import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { mobileApiFetch } from '../../services/api';

interface WorkOrder {
  id: number;
  orderNumber: string;
  title: string;
  projectId: string;
  projectName: string;
  contractorName: string;
  scopeSummary: string;
  targetQuantity: string;
  unit: string;
  status: 'In Progress' | 'Pending Approval' | 'Completed';
  priority: 'High' | 'Medium' | 'Low';
  startDate: string;
  dueDate: string;
}

const DEFAULT_WORK_ORDERS: WorkOrder[] = [
  {
    id: 1,
    orderNumber: 'WO-2026-0081',
    title: 'Ballast Stacking & Siding Track Bed Preparation',
    projectId: 'PRJ-001',
    projectName: 'Metro Station Extension Block-C',
    contractorName: 'Eastern Infrastructure Projects Ltd',
    scopeSummary: 'Execution of 40mm RDSO ballast spreading, vibratory compaction & side slope dressing at siding yard.',
    targetQuantity: '15,000',
    unit: 'MT',
    status: 'In Progress',
    priority: 'High',
    startDate: '2026-10-15',
    dueDate: '2026-12-31'
  },
  {
    id: 2,
    orderNumber: 'WO-2026-0082',
    title: 'Pier Cap Structural Concreting & Bar Bending',
    projectId: 'PRJ-002',
    projectName: 'Delhi Metro Rail Project (Phase IV)',
    contractorName: 'Bridge & Roof Engineering Co.',
    scopeSummary: 'Reinforcement bar fabrication, shuttering and M45 grade transit mix pouring for Pier 104 to Pier 110.',
    targetQuantity: '3,200',
    unit: 'Cu.M',
    status: 'In Progress',
    priority: 'High',
    startDate: '2026-11-01',
    dueDate: '2027-01-20'
  },
  {
    id: 3,
    orderNumber: 'WO-2026-0083',
    title: 'Quarry Face Blasting & GSB Aggregates Crushing',
    projectId: 'PRJ-001',
    projectName: 'Metro Station Extension Block-C',
    contractorName: 'Rewa Mining & Quarry Consortium',
    scopeSummary: 'Secondary hydraulic breaking and delivery of graded crushed rock sub-base to yard stockpile.',
    targetQuantity: '25,000',
    unit: 'MT',
    status: 'Pending Approval',
    priority: 'Medium',
    startDate: '2026-11-10',
    dueDate: '2027-02-28'
  }
];

export default function WorkOrdersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(DEFAULT_WORK_ORDERS);
  const [activeTab, setActiveTab] = useState<'ALL' | 'IN_PROGRESS' | 'PENDING' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchWorkOrders = async () => {
    try {
      const res = await mobileApiFetch('/api/tenant/work-orders');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setWorkOrders(data);
        }
      }
    } catch (err) {
      console.warn('Error loading work orders:', err);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWorkOrders();
    setRefreshing(false);
  };

  const filtered = workOrders.filter(wo => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || wo.orderNumber.toLowerCase().includes(q) || wo.title.toLowerCase().includes(q) || wo.contractorName.toLowerCase().includes(q) || wo.projectName.toLowerCase().includes(q);
    const matchTab =
      activeTab === 'ALL' ||
      (activeTab === 'IN_PROGRESS' && wo.status === 'In Progress') ||
      (activeTab === 'PENDING' && wo.status === 'Pending Approval') ||
      (activeTab === 'COMPLETED' && wo.status === 'Completed');
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
            <Text style={styles.appBarTitle}>Work Orders & Contracts</Text>
            <Text style={styles.appBarSubtitle}>Site contractor packages & task milestones</Text>
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
          colors={['#0F172A', '#134E4A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bannerCard}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name="clipboard" size={16} color="#2DD4BF" />
            <Text style={styles.bannerTag}>CONTRACTS & FIELD EXECUTION</Text>
          </View>
          <Text style={styles.bannerTitle}>Project Work Orders</Text>
          <Text style={styles.bannerSubtitle}>
            Monitor sub-contractor allocations, target scope quantities, deadlines & site milestones.
          </Text>

          <View style={styles.bannerStatsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatVal}>{workOrders.length}</Text>
              <Text style={styles.bannerStatLabel}>ISSUED ORDERS</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatVal}>{workOrders.filter(w => w.status === 'In Progress').length}</Text>
              <Text style={styles.bannerStatLabel}>IN PROGRESS</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatVal}>{workOrders.filter(w => w.priority === 'High').length}</Text>
              <Text style={styles.bannerStatLabel}>HIGH PRIORITY</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.filterTab, activeTab === 'ALL' && styles.filterTabActive]}
            onPress={() => setActiveTab('ALL')}
          >
            <Text style={[styles.filterTabText, activeTab === 'ALL' && styles.filterTabTextActive]}>All ({workOrders.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeTab === 'IN_PROGRESS' && styles.filterTabActive]}
            onPress={() => setActiveTab('IN_PROGRESS')}
          >
            <Text style={[styles.filterTabText, activeTab === 'IN_PROGRESS' && styles.filterTabTextActive]}>In Progress</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeTab === 'PENDING' && styles.filterTabActive]}
            onPress={() => setActiveTab('PENDING')}
          >
            <Text style={[styles.filterTabText, activeTab === 'PENDING' && styles.filterTabTextActive]}>Pending</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#94A3B8" />
          <TextInput
            placeholder="Search order number, title, contractor..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* Work Orders List */}
        <Text style={styles.sectionLabel}>ACTIVE PACKAGES ({filtered.length})</Text>

        {filtered.map(wo => {
          const isHigh = wo.priority === 'High';

          return (
            <View key={wo.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.woCode}>{wo.orderNumber}</Text>
                    <View style={[styles.priorityBadge, isHigh ? styles.priorityHigh : styles.priorityMed]}>
                      <Text style={[styles.priorityText, isHigh ? { color: '#B91C1C' } : { color: '#B45309' }]}>
                        {wo.priority.toUpperCase()} PRIORITY
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.woTitle}>{wo.title}</Text>
                </View>

                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{wo.status}</Text>
                </View>
              </View>

              <Text style={styles.projectName}>{wo.projectName}</Text>
              <Text style={styles.scopeText} numberOfLines={2}>{wo.scopeSummary}</Text>

              {/* Scope & Contractor Grid */}
              <View style={styles.detailsGrid}>
                <View>
                  <Text style={styles.detLabel}>Contractor</Text>
                  <Text style={styles.detVal} numberOfLines={1}>{wo.contractorName}</Text>
                </View>
                <View>
                  <Text style={styles.detLabel}>Target Scope</Text>
                  <Text style={[styles.detVal, { color: '#00705a', fontWeight: '900' }]}>
                    {wo.targetQuantity} {wo.unit}
                  </Text>
                </View>
                <View>
                  <Text style={styles.detLabel}>Target Due Date</Text>
                  <Text style={styles.detVal}>{wo.dueDate}</Text>
                </View>
              </View>

              {/* Footer */}
              <View style={styles.cardFooter}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Feather name="calendar" size={12} color="#64748B" />
                  <Text style={styles.footerDate}>Started: {wo.startDate}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#00705a' }}>View Package</Text>
                  <Feather name="chevron-right" size={14} color="#00705a" />
                </View>
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
  woCode: {
    fontSize: 11,
    fontWeight: '900',
    color: '#00705a',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityHigh: {
    backgroundColor: '#FEF2F2',
  },
  priorityMed: {
    backgroundColor: '#FFFBEB',
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '900',
  },
  woTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#00705a',
  },
  projectName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 6,
  },
  scopeText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },
  detailsGrid: {
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
    maxWidth: 110,
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
  footerDate: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
