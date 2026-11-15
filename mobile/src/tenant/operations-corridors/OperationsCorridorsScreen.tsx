import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Modal, ActivityIndicator, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { mobileApiFetch } from '../../services/api';

interface CorridorLeg {
  id: string;
  name: string;
  mode: 'ROAD' | 'RAIL' | 'INLAND_WATER';
  fromPoint: string;
  toPoint: string;
  distanceKm: number;
  tatHours: number;
  assignedAssetsCount: number;
}

interface Corridor {
  id: string;
  code: string;
  name: string;
  projectId: string;
  projectName: string;
  topology: 'RELAY MULTIMODAL' | 'SINGLE LOAD TO MULTI DELIVERY' | 'MULTI LOADING TO SINGLE UNLOAD';
  totalDistanceKm: number;
  cycleTimeHours: number;
  status: 'Active' | 'Under Review' | 'Planning';
  activeAssetsCount: number;
  projectHead?: string;
  siteInCharge?: string;
  legs: CorridorLeg[];
}

const DEFAULT_CORRIDORS: Corridor[] = [
  {
    id: 'corr-01',
    code: 'CORR-TEST-VERIFY',
    name: 'Full Studio Test Corridor',
    projectId: 'PRJ-001',
    projectName: 'Metro Station Extension Block-C',
    topology: 'RELAY MULTIMODAL',
    totalDistanceKm: 752.70,
    cycleTimeHours: 22.0,
    status: 'Active',
    activeAssetsCount: 12,
    projectHead: 'Rajesh Kumar Swain',
    siteInCharge: 'Amit Sharma',
    legs: [
      { id: 'l1', name: 'Rewa Quarry Face (Loading Pit)', mode: 'ROAD', fromPoint: 'Pit 04', toPoint: 'Satna Siding', distanceKm: 48.5, tatHours: 2.5, assignedAssetsCount: 4 },
      { id: 'l2', name: 'Satna Rail Siding (Transshipment Hub)', mode: 'RAIL', fromPoint: 'Satna Siding', toPoint: 'Metro Siding', distanceKm: 672.2, tatHours: 17.0, assignedAssetsCount: 6 },
      { id: 'l3', name: 'Metro Terminal to Block-C Worksite', mode: 'ROAD', fromPoint: 'Metro Siding', toPoint: 'Block-C Worksite', distanceKm: 32.0, tatHours: 2.5, assignedAssetsCount: 2 }
    ]
  },
  {
    id: 'corr-02',
    code: 'CORR-TEST-STUDIO-01',
    name: 'Sector 62 Metro Multi-Modal Relay Corridor',
    projectId: 'PRJ-001',
    projectName: 'Metro Station Extension Block-C',
    topology: 'RELAY MULTIMODAL',
    totalDistanceKm: 752.70,
    cycleTimeHours: 22.0,
    status: 'Active',
    activeAssetsCount: 8,
    projectHead: 'Sunil Pradhan',
    siteInCharge: 'Vikas Gupta',
    legs: [
      { id: 'l1', name: 'Quarry Pit 02 to Rail Terminal', mode: 'ROAD', fromPoint: 'Pit 02', toPoint: 'Rewa Terminal', distanceKm: 55.0, tatHours: 3.0, assignedAssetsCount: 3 },
      { id: 'l2', name: 'Rewa Terminal to Siding', mode: 'RAIL', fromPoint: 'Rewa Terminal', toPoint: 'Siding 01', distanceKm: 650.0, tatHours: 16.0, assignedAssetsCount: 4 },
      { id: 'l3', name: 'Siding to Sector 62 Site', mode: 'ROAD', fromPoint: 'Siding 01', toPoint: 'Sector 62 Site', distanceKm: 47.7, tatHours: 3.0, assignedAssetsCount: 1 }
    ]
  },
  {
    id: 'corr-03',
    code: 'CORR-DMRC-01',
    name: 'Western DFCC Rail-to-Road Metro Siding Corridor',
    projectId: 'PRJ-002',
    projectName: 'Delhi Metro Rail Project (Phase IV)',
    topology: 'SINGLE LOAD TO MULTI DELIVERY',
    totalDistanceKm: 752.70,
    cycleTimeHours: 22.0,
    status: 'Active',
    activeAssetsCount: 15,
    projectHead: 'Dhananjay Singh',
    siteInCharge: 'R. K. Meena',
    legs: [
      { id: 'l1', name: 'DFCC Central Rail Terminal', mode: 'RAIL', fromPoint: 'DFCC Hub', toPoint: 'Delhi Siding', distanceKm: 710.0, tatHours: 18.0, assignedAssetsCount: 8 },
      { id: 'l2', name: 'Delhi Siding to Line 8 Pier 104', mode: 'ROAD', fromPoint: 'Delhi Siding', toPoint: 'Line 8 Pier', distanceKm: 42.7, tatHours: 4.0, assignedAssetsCount: 7 }
    ]
  }
];

export default function OperationsCorridorsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [corridors, setCorridors] = useState<Corridor[]>(DEFAULT_CORRIDORS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCorridor, setSelectedCorridor] = useState<Corridor | null>(null);
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);

  const fetchCorridors = async () => {
    try {
      const res = await mobileApiFetch('/api/tenant/operations-corridors');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCorridors(data);
        }
      }
    } catch (err) {
      console.warn('Error fetching corridors:', err);
    }
  };

  useEffect(() => {
    fetchCorridors();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCorridors();
    setRefreshing(false);
  };

  const handleOpenBlueprint = (c: Corridor) => {
    setSelectedCorridor(c);
    setIsBlueprintModalOpen(true);
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
            <Text style={styles.appBarTitle}>Operations Sketch & Corridors</Text>
            <Text style={styles.appBarSubtitle}>Multi-modal blueprints & route topologies</Text>
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
          colors={['#0F172A', '#064E3B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bannerCard}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name="git-merge" size={16} color="#34D399" />
            <Text style={styles.bannerTag}>MULTI-MODAL LOGISTICS SKETCH</Text>
          </View>
          <Text style={styles.bannerTitle}>Corridor Topologies & Transshipment</Text>
          <Text style={styles.bannerSubtitle}>
            Point A ➔ Rail ➔ Point B (Transshipment Hub) ➔ Road ➔ Worksite. Monitor route sequences and TAT.
          </Text>

          <View style={styles.bannerStatsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatVal}>{corridors.length}</Text>
              <Text style={styles.bannerStatLabel}>TOTAL CORRIDORS</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatVal}>752.7 KM</Text>
              <Text style={styles.bannerStatLabel}>AVG DISTANCE</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatVal}>~22.0 Hrs</Text>
              <Text style={styles.bannerStatLabel}>CYCLE TAT</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#94A3B8" />
          <TextInput
            placeholder="Search corridor code, project or route..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* Corridors Roster */}
        <Text style={styles.sectionLabel}>ACTIVE CORRIDORS ({corridors.length})</Text>

        {corridors
          .filter(c => {
            const q = searchQuery.toLowerCase();
            return !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.projectName.toLowerCase().includes(q);
          })
          .map(c => {
            return (
              <View key={c.id} style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.corridorCode}>{c.code}</Text>
                      <View style={styles.topologyBadge}>
                        <Text style={styles.topologyText}>{c.topology}</Text>
                      </View>
                    </View>
                    <Text style={styles.corridorTitle}>{c.name}</Text>
                  </View>

                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{c.status}</Text>
                  </View>
                </View>

                {/* Project Reference Link */}
                <TouchableOpacity
                  style={styles.projectRefBox}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('Project Management')}
                >
                  <Feather name="briefcase" size={13} color="#00705a" />
                  <Text style={styles.projectRefText}>{c.projectName}</Text>
                  <Feather name="external-link" size={11} color="#64748B" />
                </TouchableOpacity>

                {/* Distance & TAT Row */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Total Distance</Text>
                    <Text style={styles.metricVal}>{c.totalDistanceKm} KM</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Cycle TAT</Text>
                    <Text style={styles.metricVal}>~{c.cycleTimeHours.toFixed(1)} Hrs</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Active Fleet</Text>
                    <Text style={styles.metricVal}>{c.activeAssetsCount} Assets</Text>
                  </View>
                </View>

                {/* Route Sequence Pills */}
                <View style={styles.legsRow}>
                  {c.legs.map((l, lIdx) => (
                    <View key={lIdx} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.legChip, l.mode === 'RAIL' ? styles.legRail : styles.legRoad]}>
                        {l.mode === 'RAIL' ? (
                          <MaterialCommunityIcons name="train" size={11} color="#4F46E5" />
                        ) : (
                          <Feather name="truck" size={10} color="#00705a" />
                        )}
                        <Text style={styles.legChipText}>{l.name.split('(')[0].trim()}</Text>
                      </View>
                      {lIdx < c.legs.length - 1 && (
                        <Feather name="arrow-right" size={10} color="#94A3B8" style={{ marginHorizontal: 3 }} />
                      )}
                    </View>
                  ))}
                </View>

                {/* Card Footer with Blueprint trigger */}
                <View style={styles.cardFooter}>
                  <Text style={styles.siteInChargeText}>Site: {c.siteInCharge || 'Amit Sharma'}</Text>
                  <TouchableOpacity
                    style={styles.blueprintBtn}
                    onPress={() => handleOpenBlueprint(c)}
                  >
                    <Feather name="map" size={13} color="#FFFFFF" />
                    <Text style={styles.blueprintBtnText}>View Blueprint</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
      </ScrollView>

      {/* Blueprint Drawer / Modal */}
      <Modal
        visible={isBlueprintModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsBlueprintModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            {selectedCorridor && (
              <>
                <View style={styles.modalSheetHeader}>
                  <View>
                    <Text style={styles.modalSheetCode}>{selectedCorridor.code}</Text>
                    <Text style={styles.modalSheetTitle}>{selectedCorridor.name}</Text>
                    <Text style={styles.modalSheetSub}>{selectedCorridor.projectName}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setIsBlueprintModalOpen(false)} style={styles.iconBtn}>
                    <Ionicons name="close" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ padding: 16 }} contentContainerStyle={{ gap: 14 }}>
                  <Text style={styles.sheetSectionLabel}>ROUTE SEQUENCE BLUEPRINT</Text>

                  {selectedCorridor.legs.map((leg, idx) => (
                    <View key={leg.id} style={styles.blueprintLegCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={styles.stepCircle}>
                            <Text style={styles.stepNum}>{idx + 1}</Text>
                          </View>
                          <Text style={styles.legCardTitle}>{leg.name}</Text>
                        </View>
                        <View style={[styles.legModeBadge, leg.mode === 'RAIL' ? { backgroundColor: '#EEF2FF' } : { backgroundColor: '#ECFDF5' }]}>
                          <Text style={[styles.legModeText, leg.mode === 'RAIL' ? { color: '#4F46E5' } : { color: '#00705a' }]}>
                            {leg.mode}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.blueprintLegDetails}>
                        <Text style={styles.bpPointText}>From: <Text style={{ color: '#0F172A', fontWeight: '700' }}>{leg.fromPoint}</Text></Text>
                        <Text style={styles.bpPointText}>To: <Text style={{ color: '#0F172A', fontWeight: '700' }}>{leg.toPoint}</Text></Text>
                      </View>

                      <View style={styles.blueprintMetricsRow}>
                        <Text style={styles.bpMetricText}>Distance: <Text style={{ fontWeight: '800' }}>{leg.distanceKm} KM</Text></Text>
                        <Text style={styles.bpMetricText}>TAT: <Text style={{ fontWeight: '800' }}>{leg.tatHours}h</Text></Text>
                        <Text style={styles.bpMetricText}>Assets: <Text style={{ fontWeight: '800', color: '#00705a' }}>{leg.assignedAssetsCount} units</Text></Text>
                      </View>
                    </View>
                  ))}

                  {/* Corridor Fleet Summary */}
                  <Text style={styles.sheetSectionLabel}>DEPLOYED COMMERCIAL ASSETS</Text>
                  <View style={styles.fleetSummaryCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={styles.fleetIconBox}>
                        <Feather name="truck" size={18} color="#00705a" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fleetPlate}>OD-05-BB-8921</Text>
                        <Text style={styles.fleetDesc}>BharatBenz 3528C Tipper • Day Shift</Text>
                        <Text style={styles.fleetPilot}>Pilot: Rajesh Kumar Swain</Text>
                      </View>
                      <View style={styles.fleetRunningBadge}>
                        <Text style={styles.fleetRunningText}>RUNNING</Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>
              </>
            )}
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
    color: '#34D399',
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
    color: '#94A3B8',
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
  corridorCode: {
    fontSize: 11,
    fontWeight: '900',
    color: '#00705a',
  },
  topologyBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  topologyText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#4F46E5',
  },
  corridorTitle: {
    fontSize: 15,
    fontWeight: '900',
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
    fontSize: 10,
    fontWeight: '900',
    color: '#00705a',
  },
  projectRefBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  projectRefText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#00705a',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  legsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  legChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  legRoad: {
    backgroundColor: '#ECFDF5',
  },
  legRail: {
    backgroundColor: '#EEF2FF',
  },
  legChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
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
  siteInChargeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  blueprintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00705a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  blueprintBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
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
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalSheetCode: {
    fontSize: 11,
    fontWeight: '900',
    color: '#00705a',
  },
  modalSheetTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  modalSheetSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  sheetSectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  blueprintLegCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00705a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  legCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  legModeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  legModeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  blueprintLegDetails: {
    marginTop: 8,
    gap: 2,
  },
  bpPointText: {
    fontSize: 11,
    color: '#64748B',
  },
  blueprintMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  bpMetricText: {
    fontSize: 11,
    color: '#64748B',
  },
  fleetSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fleetIconBox: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
  },
  fleetPlate: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    fontFamily: 'Courier',
  },
  fleetDesc: {
    fontSize: 11,
    color: '#64748B',
  },
  fleetPilot: {
    fontSize: 10,
    color: '#94A3B8',
  },
  fleetRunningBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  fleetRunningText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#00705a',
  },
});
