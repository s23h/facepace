import React, { FC, useCallback } from "react"
import { observer } from "mobx-react-lite"
import { Image, ImageStyle, View, ViewStyle, Platform } from "react-native"
import { AppStackScreenProps } from "app/navigators"
import { Button, Screen } from "app/components"
import { useAuth } from "app/services/auth/useAuth"
import { colors, spacing } from "app/theme"
import { AntDesign } from "@expo/vector-icons"
import * as AppleAuthentication from "expo-apple-authentication"

const logo = require("../../assets/images/logo.png")

interface SignInScreenProps extends AppStackScreenProps<"SignIn"> {}

export const SignInScreen: FC<SignInScreenProps> = observer(function SignInScreen() {
  const { signInWithProvider } = useAuth()

  const onSignInWithGoogle = useCallback(async () => {
    try {
      await signInWithProvider("google")
    } catch (error) {
      console.error("Error signing in with Google:", error)
      // TODO: Implement proper error handling
    }
  }, [signInWithProvider])

  const onSignInWithApple = useCallback(async () => {
    try {
      await signInWithProvider("apple")
    } catch (error) {
      console.error("Error signing in with Apple:", error)
      // TODO: Implement proper error handling
    }
  }, [signInWithProvider])

  return (
    <Screen contentContainerStyle={$root} preset="scroll" safeAreaEdges={["top", "bottom"]}>
      <View style={$container}>
        <View style={$topContainer}>
          <Image style={$logo} source={logo} resizeMode="contain" />
        </View>
        <View style={$bottomContainer}>
          <Button
            testID="google-signin-button"
            tx="signInScreen.googleSignIn"
            style={$googleButton}
            preset="default"
            onPress={onSignInWithGoogle}
            LeftAccessory={() => (
              <AntDesign
                name="google"
                size={20}
                color={colors.palette.neutral800}
                style={$buttonIcon}
              />
            )}
          />
          {Platform.OS === "ios" && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={5}
              style={$appleButton}
              onPress={onSignInWithApple}
            />
          )}
        </View>
      </View>
    </Screen>
  )
})

const $root: ViewStyle = {
  flex: 1,
  backgroundColor: colors.background,
}

const $container: ViewStyle = {
  flex: 1,
  paddingHorizontal: spacing.lg,
}

const $topContainer: ViewStyle = {
  flexShrink: 1,
  flexGrow: 1,
  justifyContent: "center",
  alignItems: "center",
}

const $bottomContainer: ViewStyle = {
  flexShrink: 0,
}

const $logo: ImageStyle = {
  height: 100,
  width: 200,
  marginBottom: spacing.xxl,
}

const $googleButton: ViewStyle = {
  marginBottom: spacing.md,
  backgroundColor: colors.palette.neutral100,
  borderColor: colors.palette.neutral300,
  borderWidth: 1,
}

const $appleButton: ViewStyle = {
  width: "100%",
  height: 44,
  marginTop: spacing.md,
}

// const $appleButtonText: TextStyle = {
//   color: colors.palette.neutral100,
// }

const $buttonIcon: ViewStyle = {
  marginRight: spacing.sm,
}
