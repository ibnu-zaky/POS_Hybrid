// App.tsx
import { BrowserRouter } from "react-router-dom";
import { StoreProvider } from "./state/store";
import { ToastProvider } from "./components/ui/Toast";
import { AppRoutes } from "./routes";

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </StoreProvider>
  );
}
