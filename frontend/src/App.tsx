import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AnnouncementsProvider } from "./context/AnnouncementsContext";
import { ToastProvider } from "./context/ToastContext";
import { MainAppContent } from "./MainAppContent";
import { useEscapeClosesDialog } from "./hooks/useEscapeClosesDialog";

export function App() {
  useEscapeClosesDialog();
  return (
    <AuthProvider>
      <AnnouncementsProvider>
        <ToastProvider>
          <BrowserRouter>
            <MainAppContent />
          </BrowserRouter>
        </ToastProvider>
      </AnnouncementsProvider>
    </AuthProvider>
  );
}

export default App;
