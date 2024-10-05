import React, { FC, useCallback, useEffect, useState } from "react"
import { observer } from "mobx-react-lite"
import { Alert, Linking, StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native"
import { AppStackScreenProps } from "app/navigators"
import { Button, Icon, Screen, Text } from "app/components"
import { spacing } from "app/theme"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  Camera,
  CameraPermissionStatus,
  useCameraDevice,
  useCodeScanner,
} from "react-native-vision-camera"

interface CameraScreenProps extends AppStackScreenProps<"Camera"> {}

export const CameraScreen: FC<CameraScreenProps> = observer(function CameraScreen() {
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionStatus>()
  const [isActive, setIsActive] = useState(true)
  const [scannedCodes, setScannedCodes] = useState<string[]>([])

  useEffect(() => {
    checkCameraPermission()
  }, [])

  const checkCameraPermission = async () => {
    const status = await Camera.getCameraPermissionStatus()
    setCameraPermission(status)
  }

  const promptForCameraPermissions = useCallback(async () => {
    const permission = await Camera.requestCameraPermission()
    setCameraPermission(permission)

    if (permission === "denied") await Linking.openSettings()
  }, [])

  const codeScanner = useCodeScanner({
    codeTypes: ["qr", "ean-13"],
    onCodeScanned: (codes) => {
      setIsActive(false)

      codes.forEach((code) => {
        if (code.value && typeof code.value === "string") {
          setScannedCodes((prevCodes) => [...prevCodes, code.value as string])
        }
      })

      Alert.alert("Code scanned!")
    },
  })

  const device = useCameraDevice("back")

  const { bottom } = useSafeAreaInsets()

  if (cameraPermission == null) {
    // still loading
    return null
  }

  if (cameraPermission !== "granted") {
    return (
      <Screen contentContainerStyle={$container} preset="scroll">
        <Text text={`Camera Permission: ${cameraPermission}`} />
        <Button onPress={promptForCameraPermissions} text="Request Camera Permission" />
      </Screen>
    )
  }

  return (
    <View style={$cameraContainer}>
      {device && (
        <Camera
          isActive={isActive}
          device={device}
          codeScanner={codeScanner}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[$buttonContainer, { bottom: bottom + spacing.md }]}>
        <Button
          style={$button}
          onPress={() => setIsActive((prev) => !prev)}
          text={isActive ? "Pause" : "Resume"}
        />
        <Button
          style={$button}
          onPress={() =>
            scannedCodes.length > 0 && Alert.alert(`Scanned Codes: ${scannedCodes.join(", ")}`)
          }
          text={`View Scans (${scannedCodes.length})`}
        />
      </View>
    </View>
  )
})

const $container: ViewStyle = {
  flex: 1,
  padding: 20,
  justifyContent: "center",
  alignItems: "center",
}

const $cameraContainer: ViewStyle = {
  flex: 1,
}

const $buttonContainer: ViewStyle = {
  position: "absolute",
  left: 0,
  right: 0,
  flexDirection: "row",
  justifyContent: "space-around",
  paddingHorizontal: spacing.md,
}

const $button: ViewStyle = {
  minWidth: 120,
}
