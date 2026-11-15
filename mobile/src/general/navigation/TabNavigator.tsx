import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TenantDashboardScreen from '../../tenant/dashboard/TenantDashboardScreen';
import ProjectsScreen from '../../tenant/project/ProjectsScreen';
import StockyardScreen from '../../tenant/stockyard/StockyardScreen';
import ProfileScreen from '../profile/ProfileScreen';
import TeamScreen from '../../tenant/team/TeamScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#0F172A', // Deep navy/black from mockup
        tabBarInactiveTintColor: '#94A3B8', // Slate-400
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.1,
          shadowRadius: 15,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontFamily: 'Geist',
          fontSize: 11,
          fontWeight: '700',
          marginTop: 4,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any = 'home';
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Projects') {
            iconName = focused ? 'briefcase' : 'briefcase-outline';
          } else if (route.name === 'Stockyard') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'Team') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={TenantDashboardScreen} 
      />
      <Tab.Screen 
        name="Projects" 
        component={ProjectsScreen} 
      />
      <Tab.Screen 
        name="Stockyard" 
        component={StockyardScreen} 
      />
      <Tab.Screen 
        name="Team" 
        component={TeamScreen} 
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
      />
    </Tab.Navigator>
  );
}
