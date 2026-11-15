import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  RefreshControl, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { mobileApiFetch } from '../../services/api';
import { getAuth } from '@react-native-firebase/auth';

export default function FmsEmployeeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [assignedVehicle, setAssignedVehicle] = useState({
    vehicleNumber: 'OD-05-BB-8921',
    vehicleType: 'BharatBenz 3528C Tipper (35T)',
    currentWorksite: 'Rewa Quarry Pit 04 Face',
    assignedProject: 'Metro Station Extension Block-C',
    shift: 'Day Shift (06:00 AM - 02:00 PM)',
    openingMeter: '42390 KM',
    closingMeter: '',
    fuelLevelPct: 82,
    todayTripsCount: 4,
    todayTonnageDelivered: 140.8
  });

  const fetchDriverData = async () => {
    try {
      const user = getAuth().currentUser;
      if (user) {
        const res = await mobileApiFetch(`/api/tenant/fms-employee/driver-portal/${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.assignedVehicle) {
            setAssignedVehicle(prev => ({ ...prev, ...data.assignedVehicle }));
          }
        }
      }
    } catch (err) {
      console.warn('Error loading driver data:', err);
    }
  };

  useEffect(() => {
    fetchDriverData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDriverData();
    setRefreshing(false);
  };

  const handleToggleDuty = () => {
    Alert.alert(
      isOnDuty ? 'End Duty Shift?' : 'Start Duty Shift?',
      isOnDuty ? 'Are you sure you want to clock out for today?' : 'Start your vehicle shift and log in-time?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isOnDuty ? 'Clock Out' : 'Start Shift',
          onPress: () => {
            setIsOnDuty(!isOnDuty);
            Alert.alert('Shift Updated', isOnDuty ? 'Duty ended successfully.' : 'You are now ON DUTY. Drive safely!');
          }
        }
      ]
    );
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
            <Text style={styles.appBarTitle}>My Vehicle & Shifts</Text>
            <Text style={styles.appBarSubtitle}>FMS driver and machinery operator portal</Text>
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
        {/* Banner with Duty Toggle */}
        <LinearGradient
          colors={isOnDuty ? ['#0F172A', '#064E3B'] : ['#0F172A', '#334155']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bannerCard}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.statusDot, { backgroundColor: isOnDuty ? '#34D399' : '#94A3B8' }]} />
              <Text style={[styles.bannerTag, { color: isOnDuty ? '#34D399' : '#CBD5E1' }]}>
                {isOnDuty ? 'ACTIVE SHIFT ON DUTY' : 'OFF DUTY'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.dutyToggleBtn, { backgroundColor: isOnDuty ? '#EF4444' : '#10B981' }]}
              activeOpacity={0.85}
              onPress={handleToggleDuty}
            >
              <Text style={styles.dutyToggleText}>{isOnDuty ? 'End Shift' : 'Start Duty'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.bannerPlate}>{assignedVehicle.vehicleNumber}</Text>
          <Text style={styles.bannerType}>{assignedVehicle.vehicleType}</Text>

          <View style={styles.bannerStatsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.statVal}>{assignedVehicle.todayTripsCount} Trips</Text>
              <Text style={styles.statLbl}>TODAY'S RUNS</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statVal}>{assignedVehicle.todayTonnageDelivered} MT</Text>
              <Text style={styles.statLbl}>DELIVERED</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statVal}>{assignedVehicle.fuelLevelPct}%</Text>
              <Text style={styles.statLbl}>DIESEL TANK</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Assigned Shift Card */}
        <Text style={styles.sectionLabel}>ASSIGNED WORK & PERIMETER</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLbl}>Target Project</Text>
            <Text style={styles.infoVal}>{assignedVehicle.assignedProject}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLbl}>Operating Worksite</Text>
            <Text style={styles.infoVal}>{assignedVehicle.currentWorksite}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLbl}>Shift Schedule</Text>
            <Text style={styles.infoVal}>{assignedVehicle.shift}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLbl}>Opening Odometer</Text>
            <Text style={[styles.infoVal, { color: '#00705a', fontWeight: '900' }]}>{assignedVehicle.openingMeter}</Text>
          </View>
        </View>

        {/* Quick Meter Entry */}
        <Text style={styles.sectionLabel}>UPDATE SHIFT ODOMETER & FUEL</Text>
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Closing Odometer Reading (KM)</Text>
          <TextInput
            keyboardType="numeric"
            placeholder="e.g. 42590"
            placeholderTextColor="#94A3B8"
            value={assignedVehicle.closingMeter}
            onChangeText={val => setAssignedVehicle({ ...assignedVehicle, closingMeter: val })}
            style={styles.input}
          />

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => {
              if (!assignedVehicle.closingMeter) {
                Alert.alert('Required', 'Please enter closing odometer reading');
                return;
              }
              Alert.alert('Meter Recorded', `Closing reading of ${assignedVehicle.closingMeter} KM saved.`);
            }}
          >
            <Feather name="save" size={15} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>Record Meter Reading</Text>
          </TouchableOpacity>
        </View>
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
    padding: 18,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bannerTag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  dutyToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dutyToggleText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  bannerPlate: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FDE047',
    fontFamily: 'Courier',
    marginTop: 10,
  },
  bannerType: {
    fontSize: 13,
    color: '#CBD5E1',
    marginTop: 2,
  },
  bannerStatsRow: {
    flexDirection: 'row',
    marginTop: 16,
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
    color: '#34D399',
    marginTop: 2,
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLbl: {
    fontSize: 12,
    color: '#64748B',
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00705a',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
});
