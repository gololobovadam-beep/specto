import type { PropsWithChildren } from "react";
import { AuthProvider } from "../presentation/auth/AuthProvider";
import { WorkspaceProvider } from "../presentation/state/WorkspaceProvider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AuthProvider>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </AuthProvider>
  );
}
