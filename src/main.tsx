import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { AppProviders } from "./app/AppProviders";
import {
  isFirebaseAuthHelperPath,
  isLikelyFirebaseAuthPopupWindow,
  recoverFirebaseAuthHelperNavigation
} from "./app/firebaseAuthRecovery";
import "./styles/global.css";

async function bootstrap() {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Root element was not found");
  }

  if (isFirebaseAuthHelperPath() || isLikelyFirebaseAuthPopupWindow()) {
    root.textContent = "Completing Google sign-in...";
    const recoveryStarted = await recoverFirebaseAuthHelperNavigation();
    if (recoveryStarted) {
      return;
    }
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <BrowserRouter>
        <AppProviders>
          <App />
        </AppProviders>
      </BrowserRouter>
    </React.StrictMode>
  );
}

void bootstrap();
