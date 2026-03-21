import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
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
import { toAuthErrorMessage } from "./authFlow";

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

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>(
    firebaseServices.isConfigured ? "loading" : "disabled"
  );
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authFlowInProgressRef = useRef(false);

  useEffect(() => {
    if (!firebaseServices.isConfigured || !firebaseServices.auth) {
      return;
    }

    let isMounted = true;

    void setPersistence(firebaseServices.auth, browserLocalPersistence).catch((caught) => {
      if (!isMounted) return;
      setError(toAuthErrorMessage(caught, "Failed to configure local auth persistence"));
    });

    const unsubscribe = onAuthStateChanged(
      firebaseServices.auth,
      (nextUser) => {
        if (!isMounted) return;
        setUser(nextUser);
        setStatus(nextUser ? "signed-in" : "signed-out");
        setIsAuthenticating(false);
        authFlowInProgressRef.current = false;
      },
      (caught) => {
        if (!isMounted) return;
        setError(toAuthErrorMessage(caught, "Auth state error"));
        setStatus("signed-out");
        setIsAuthenticating(false);
        authFlowInProgressRef.current = false;
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    if (!firebaseServices.auth || !firebaseServices.googleProvider) {
      setError("Firebase auth is not configured");
      return;
    }

    if (isAuthenticating || authFlowInProgressRef.current) {
      return;
    }

    setError(null);
    authFlowInProgressRef.current = true;
    setIsAuthenticating(true);

    try {
      await setPersistence(firebaseServices.auth, browserLocalPersistence);
      const result = await signInWithPopup(
        firebaseServices.auth,
        firebaseServices.googleProvider
      );
      setUser(result.user);
      setStatus("signed-in");
    } catch (caught) {
      const code = getAuthErrorCode(caught);

      // Пользователь сам закрыл попап — не ошибка
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setStatus("signed-out");
      } else {
        setError(toAuthErrorMessage(caught, "Google sign-in failed"));
        setStatus("signed-out");
      }
    } finally {
      authFlowInProgressRef.current = false;
      setIsAuthenticating(false);
    }
  }

  async function signOutFromWorkspace() {
    if (!firebaseServices.auth) return;
    setError(null);
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
