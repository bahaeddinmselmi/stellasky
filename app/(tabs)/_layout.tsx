import { Tabs } from 'expo-router';
import { Hop as Home, Sparkles, MessageCircle, Settings, CalendarRange } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(10, 10, 42, 0.95)',
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="constellation"
        options={{
          title: 'Constellation',
          tabBarIcon: ({ size, color }) => <Sparkles size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ size, color }) => <MessageCircle size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="moods"
        options={{
          title: 'Mood History',
          tabBarIcon: ({ size, color }) => <CalendarRange size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ size, color }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
