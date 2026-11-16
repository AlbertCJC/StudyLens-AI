import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AnnouncementsProvider } from "./context/AnnouncementsContext";
import { ToastProvider } from "./context/ToastContext";
import { MainAppContent } from "./MainAppContent";

export function App() {
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
