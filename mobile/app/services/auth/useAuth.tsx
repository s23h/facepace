import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import { Session, supabase } from "./supabase"
import { AuthResponse, AuthTokenResponsePassword, Provider } from "@supabase/supabase-js"
import { Platform } from "react-native"
import * as AppleAuthentication from "expo-apple-authentication"

type AuthState = {
  isAuthenticated: boolean
  token?: Session["access_token"]
}

type SignInProps = {
  email: string
  password: string
}

type SignUpProps = {
  email: string
  password: string
}

type AuthContextType = {
  signIn: (props: SignInProps) => Promise<AuthTokenResponsePassword>
  signUp: (props: SignUpProps) => Promise<AuthResponse>
  signOut: () => Promise<void>
  signInWithProvider: (provider: Provider) => Promise<void>
} & AuthState

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  token: undefined,
  signIn: () => Promise.resolve({} as AuthTokenResponsePassword),
  signUp: () => Promise.resolve({} as AuthResponse),
  signOut: () => Promise.resolve(),
  signInWithProvider: () => Promise.resolve(),
})

export function useAuth() {
  return useContext(AuthContext)
}

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [token, setToken] = useState<AuthState["token"]>(undefined)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      switch (event) {
        case "SIGNED_OUT":
          setToken(undefined)
          break
        case "INITIAL_SESSION":
        case "SIGNED_IN":
        case "TOKEN_REFRESHED":
          setToken(session?.access_token)
          break
        default:
        // no-op
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setToken(undefined)
  }, [])

  const signInWithApple = async () => {
    if (Platform.OS !== "ios") {
      throw new Error("Apple Sign-In is only available on iOS devices.")
    }

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })

      if (credential.identityToken) {
        const {
          error,
          data: { user, session },
        } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        })

        if (error) throw error
        if (session?.access_token) {
          setToken(session.access_token)
        }
        return user
      } else {
        throw new Error("No identityToken.")
      }
    } catch (e) {
      if (e instanceof Error && "code" in e && e.code === "ERR_REQUEST_CANCELED") {
        // User canceled the sign-in flow
        throw new Error("Sign-in canceled")
      } else {
        // Handle other errors
        throw e
      }
    }
  }

  const signInWithProvider = useCallback(async (provider: Provider) => {
    if (provider === "apple" && Platform.OS === "ios") {
      await signInWithApple()
    } else {
      const { error } = await supabase.auth.signInWithOAuth({ provider })
      if (error) throw error
    }
  }, [])

  const signIn = useCallback(
    async ({ email, password }: SignInProps) => {
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (result.data?.session?.access_token) {
        setToken(result.data.session.access_token)
      }

      return result
    },
    [supabase],
  )

  const signUp = useCallback(
    async ({ email, password }: SignUpProps) => {
      const result = await supabase.auth.signUp({
        email,
        password,
      })

      if (result.data?.session?.access_token) {
        setToken(result.data.session.access_token)
      }

      return result
    },
    [supabase],
  )

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!token,
        token,
        signIn,
        signUp,
        signOut,
        signInWithProvider,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
