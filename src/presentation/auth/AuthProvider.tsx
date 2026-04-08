import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User
} from "firebase/auth";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import { firebaseServices } from "../../infrastructure/firebase/client";
import {
  buildFirebaseAppHandoffUrl,
  HANDOFF_MARKER_KEY,
  INIT_TIMEOUT_MS,
  navigateToUrl,
  needsFirebaseAppDomainHandoff,
  readSessionFlag,
  REDIRECT_MARKER_KEY,
  shouldPreferPopupAuth,
  stripAutoStartParamFromUrl,
  toAuthErrorMessage,
  writeSessionFlag
} from "./authFlow";

type AuthStatus = "disabled" | "loading" | "signed-out" | "signed-in";

interface AuthContextValue {
  status: AuthStatus;
  isConfigured: boolean;
  isAuthenticating: boolean;
  user: User | null;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutFromWorkspace: () => Promise<void>;
}

type AuthErrorWithCode = {
  code?: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getAuthErrorCode(caught: unknown) {
  return typeof caught === "object" && caught !== null
    ? (caught as AuthErrorWithCode).code ?? null
    : null;
}

function clearAuthMarkers() {
  writeSessionFlag(REDIRECT_MARKER_KEY, false);
  writeSessionFlag(HANDOFF_MARKER_KEY, false);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>(
    firebaseServices.isConfigured ? "loading" : "disabled"
  );
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(readSessionFlag(REDIRECT_MARKER_KEY));
  const authFlowInProgressRef = useRef(readSessionFlag(REDIRECT_MARKER_KEY));

  useEffect(() => {
    if (!firebaseServices.isConfigured || !firebaseServices.auth) {
      return;
    }

    let isMounted = true;
    const hadPendingRedirect = readSessionFlag(REDIRECT_MARKER_KEY);

    authFlowInProgressRef.current = hadPendingRedirect;
    if (hadPendingRedirect) {
      setStatus("loading");
      setIsAuthenticating(true);
    }

    const startRedirectSignIn = async (fallbackMessage: string) => {
      if (!firebaseServices.auth || !firebaseServices.googleProvider) {
        return;
      }

      writeSessionFlag(REDIRECT_MARKER_KEY, true);
      writeSessionFlag(HANDOFF_MARKER_KEY, false);

      try {
        await setPersistence(firebaseServices.auth, browserLocalPersistence);
        await signInWithRedirect(firebaseServices.auth, firebaseServices.googleProvider);
      } catch (caught) {
        clearAuthMarkers();
        authFlowInProgressRef.current = false;
        if (!isMounted) return;
        setError(toAuthErrorMessage(caught, fallbackMessage));
        setStatus("signed-out");
        setIsAuthenticating(false);
      }
    };

    const didStripAutoStartParam = stripAutoStartParamFromUrl();
    if (didStripAutoStartParam && !hadPendingRedirect) {
      setStatus("loading");
      setIsAuthenticating(true);
      authFlowInProgressRef.current = true;
      writeSessionFlag(HANDOFF_MARKER_KEY, false);
      void startRedirectSignIn("Google redirect sign-in failed");
    }

    void setPersistence(firebaseServices.auth, browserLocalPersistence).catch((caught) => {
      if (!isMounted) return;
      setError(toAuthErrorMessage(caught, "Failed to configure local auth persistence"));
    });

    const unsubscribe = onAuthStateChanged(
      firebaseServices.auth,
      (nextUser) => {
        if (!isMounted) return;

        if (!nextUser && readSessionFlag(REDIRECT_MARKER_KEY)) {
          setStatus("loading");
          setIsAuthenticating(true);
          authFlowInProgressRef.current = true;
          return;
        }

        clearAuthMarkers();
        setUser(nextUser);
        setStatus(nextUser ? "signed-in" : "signed-out");
        setIsAuthenticating(false);
        authFlowInProgressRef.current = false;
      },
      (caught) => {
        if (!isMounted) return;
        clearAuthMarkers();
        setError(toAuthErrorMessage(caught, "Auth state error"));
        setStatus("signed-out");
        setIsAuthenticating(false);
        authFlowInProgressRef.current = false;
      }
    );

    const timeoutId = window.setTimeout(() => {
      if (!isMounted || !authFlowInProgressRef.current) {
        return;
      }

      clearAuthMarkers();
      setStatus("signed-out");
      setIsAuthenticating(false);
      authFlowInProgressRef.current = false;
    }, INIT_TIMEOUT_MS);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    if (!firebaseServices.auth || !firebaseServices.googleProvider) {
      setError("Firebase auth is not configured");
      return;
    }

    if (
      isAuthenticating ||
      authFlowInProgressRef.current ||
      readSessionFlag(REDIRECT_MARKER_KEY)
    ) {
      return;
    }

    setError(null);
    authFlowInProgressRef.current = true;
    setIsAuthenticating(true);
    let keepPendingAuth = false;

    try {
      await setPersistence(firebaseServices.auth, browserLocalPersistence);

      if (needsFirebaseAppDomainHandoff()) {
        const handoffUrl = buildFirebaseAppHandoffUrl();
        if (!handoffUrl) {
          throw new Error("Could not build the Firebase authentication URL");
        }

        writeSessionFlag(HANDOFF_MARKER_KEY, true);
        navigateToUrl(handoffUrl);
        keepPendingAuth = true;
        return;
      }

      if (shouldPreferPopupAuth()) {
        try {
          const result = await signInWithPopup(
            firebaseServices.auth,
            firebaseServices.googleProvider
          );
          clearAuthMarkers();
          setUser(result.user);
          setStatus("signed-in");
          return;
        } catch (caught) {
          if (getAuthErrorCode(caught) === "auth/popup-blocked") {
            writeSessionFlag(REDIRECT_MARKER_KEY, true);
            writeSessionFlag(HANDOFF_MARKER_KEY, false);
            keepPendingAuth = true;
            await signInWithRedirect(
              firebaseServices.auth,
              firebaseServices.googleProvider
            );
            return;
          }

          throw caught;
        }
      }

      writeSessionFlag(REDIRECT_MARKER_KEY, true);
      writeSessionFlag(HANDOFF_MARKER_KEY, false);
      keepPendingAuth = true;
      await signInWithRedirect(
        firebaseServices.auth,
        firebaseServices.googleProvider
      );
    } catch (caught) {
      const code = getAuthErrorCode(caught);
      clearAuthMarkers();
      keepPendingAuth = false;

      // Пользователь сам закрыл попап — не ошибка
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setStatus("signed-out");
      } else {
        setError(toAuthErrorMessage(caught, "Google sign-in failed"));
        setStatus("signed-out");
      }
    } finally {
      authFlowInProgressRef.current = keepPendingAuth;
      setIsAuthenticating(keepPendingAuth);
    }
  }

  async function signOutFromWorkspace() {
    if (!firebaseServices.auth) return;
    setError(null);
    clearAuthMarkers();
    authFlowInProgressRef.current = false;
    setIsAuthenticating(false);
    await signOut(firebaseServices.auth);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isConfigured: firebaseServices.isConfigured,
      isAuthenticating,
      user,
      error,
      signInWithGoogle,
      signOutFromWorkspace
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [error, isAuthenticating, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthSession must be used inside AuthProvider");
  }

  return context;
}
