import { Navigate, Route, Routes } from "react-router-dom";
import Auth from "./routes/Auth";
import Dashboard from "./routes/Dashboard";
import NotFound from "./routes/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Auth />} />
      <Route path="/app" element={<Dashboard />} />
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
