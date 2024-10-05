import React, { FC } from "react"
import { View, ViewStyle, TextStyle } from "react-native"
import { AppStackScreenProps } from "app/navigators"
import { Button, Screen, Text } from "app/components"
import { useAuth } from "app/services/auth/useAuth"

interface WelcomeScreenProps extends AppStackScreenProps<"Welcome"> {}

export const WelcomeScreen: FC<WelcomeScreenProps> = function WelcomeScreen(_props) {
  const { signOut } = useAuth()

  return (
    <Screen style={$root} preset="scroll">
      <Text style={$title} text="Welcome" />
      <Text style={$subtitle} text="This is your profile screen" />
      <View style={$buttonContainer}>
        <Button style={$button} text="Sign Out" onPress={signOut} />
      </View>
    </Screen>
  )
}

const $root: ViewStyle = {
  flex: 1,
  paddingHorizontal: 24,
}

const $title: TextStyle = {
  fontSize: 32,
  fontWeight: "bold",
  marginBottom: 10,
}

const $subtitle: TextStyle = {
  fontSize: 18,
  marginBottom: 20,
}

const $buttonContainer: ViewStyle = {
  marginTop: 20,
}

const $button: ViewStyle = {
  marginBottom: 10,
}
