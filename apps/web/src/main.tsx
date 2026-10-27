import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.tsx"
import { AuthGate } from "./components/auth/AuthGate.tsx"
import { ThemeProvider } from "./components/theme/ThemeProvider.tsx"
import { AuthProvider } from "./context/AuthProvider.tsx"
import { DataProvider } from "./context/DataProvider.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      {/* Sign-in exists only in api mode; the static build passes straight through. */}
      <AuthProvider>
        <AuthGate>
          <DataProvider>
            <App />
          </DataProvider>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
