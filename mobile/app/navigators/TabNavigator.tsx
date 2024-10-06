import React from "react"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { CameraScreen, WelcomeScreen } from "app/screens"
import { Icon } from "app/components"

export type TabNavigatorParamList = {
  Camera: undefined
  Welcome: undefined
}

const Tab = createBottomTabNavigator<TabNavigatorParamList>()

export const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "tomato",
        tabBarInactiveTintColor: "gray",
      }}
    >
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          tabBarLabel: "Scan",
          tabBarIcon: ({ color, size }) => <Icon icon="ladybug" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => <Icon icon="bell" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  )
}
