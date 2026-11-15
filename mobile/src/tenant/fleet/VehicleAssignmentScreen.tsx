import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  RefreshControl, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { mobileApiFetch } from '../../services/api';

interface Assignment {
  id: number;
  assetNumber: string;
  assetType: 'vehicle' | 'equipment';
  projectName: string;
  worksiteName: string;
  assignedDriverName: string;
  assignedDriverPhone: string;
  startDate: string;
  status: 'Active' | 'Completed' | 'Suspended';
}

const DEFAULT_ASSIGNMENTS: Assignment[] = [
  {
    id: 1,
    assetNumber: 'OD-05-BB-8921',
    assetType: 'vehicle',
    projectName: 'Metro Station Extension Block-C',
    worksiteName: 'Rewa Quarry Pit 04',
    assignedDriverName: 'Rajesh Kumar Swain',
    assignedDriverPhone: '+91 94371 88921',
    startDate: '2026-10-01',
    status: 'Active'
  },
  {
    id: 2,
    assetNumber: 'OD-05-AA-7712',
    assetType: 'vehicle',
    projectName: 'Metro Station Extension Block-C',
    worksiteName: 'Satna Siding Hub',
    assignedDriverName: 'Sunil Pradhan',
    assignedDriverPhone: '+91 98610 22134',
    startDate: '2026-10-10',
    status: 'Active'
  },
  {
    id: 3,
    assetNumber: 'EXC-CAT-336D',
    assetType: 'equipment',
    projectName: 'Delhi Metro Rail Project (Phase IV)',
    worksiteName: 'DFCC Central Rail Terminal',
    assignedDriverName: 'Dhananjay Singh',
    assignedDriverPhone: '+91 97780 44551',
    startDate: '2026-10-15',
    status: 'Active'
  }
];

export default function VehicleAssignmentScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [assignments, setAssignments] = useState<Assignment[]>(DEFAULT_ASSIGNMENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAssignments = async () => {
    try {
      const res = await mobileApiFetch('/api/tenant/vehicle-assignments');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setAssignments(data);
        }
      }
    } catch (err) {
      console.warn('Error loading assignments:', err);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAssignments();
    setRefreshing(false);
  };

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
            <Text style={styles.appBarTitle}>Vehicle & Asset Assignments</Text>
            <Text style={styles.appBarSubtitle}>Fleet duty rosters & site bindings</Text>
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
          colors={['#0F172A', '#1E1B4B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bannerCard}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name="link" size={16} color="#818CF8" />
            <Text style={styles.bannerTag}>FLEET ASSET BINDINGS</Text>
          </View>
          <Text style={styles.bannerTitle}>Active Fleet Deployments</Text>
          <Text style={styles.bannerSubtitle}>
            Dedicated bindings of commercial haulage trucks & heavy machinery to specific projects, worksites, and designated pilots.
          </Text>

          <View style={styles.bannerStatsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.statVal}>{assignments.length}</Text>
              <Text style={styles.statLbl}>TOTAL ASSIGNED</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statVal}>{assignments.filter(a => a.assetType === 'vehicle').length}</Text>
              <Text style={styles.statLbl}>TIPPERS / TRUCKS</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statVal}>{assignments.filter(a => a.assetType === 'equipment').length}</Text>
              <Text style={styles.statLbl}>HEAVY MACHINERY</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#94A3B8" />
          <TextInput
            placeholder="Search plate, project, driver or site..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* Assignments List */}
        <Text style={styles.sectionLabel}>ACTIVE ASSIGNMENTS ({assignments.length})</Text>

        {assignments
          .filter(a => {
            const q = searchQuery.toLowerCase();
            return !q || a.assetNumber.toLowerCase().includes(q) || a.projectName.toLowerCase().includes(q) || a.assignedDriverName.toLowerCase().includes(q) || a.worksiteName.toLowerCase().includes(q);
          })
          .map(item => (
            <View key={item.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={styles.plateBox}>
                  <Feather name={item.assetType === 'vehicle' ? 'truck' : 'tool'} size={12} color="#FDE047" />
                  <Text style={styles.plateText}>{item.assetNumber}</Text>
                </View>

                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>

              <Text style={styles.projTitle}>{item.projectName}</Text>

              <View style={styles.detailsGrid}>
                <View>
                  <Text style={styles.detLabel}>Worksite</Text>
                  <Text style={styles.detVal} numberOfLines={1}>{item.worksiteName}</Text>
                </View>
                <View>
                  <Text style={styles.detLabel}>Assigned Driver</Text>
                  <Text style={styles.detVal} numberOfLines={1}>{item.assignedDriverName}</Text>
                  <Text style={styles.detSub}>{item.assignedDriverPhone}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.footerDate}>Assigned: {item.startDate}</Text>
                <TouchableOpacity
                  onPress={() => Alert.alert('Asset Details', `Asset ${item.assetNumber} is actively bound to ${item.worksiteName}`)}
                >
                  <Text style={styles.viewLink}>View Binding</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
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
    color: '#A5B4FC',
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
  statVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statLbl: {
    fontSize: 9,
    fontWeight: '800',
    color: '#A5B4FC',
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
    marginTop: 12,
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
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
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
    maxWidth: 140,
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
  footerDate: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  viewLink: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00705a',
  },
});
