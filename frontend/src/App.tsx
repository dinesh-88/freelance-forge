import { Navigate, Route, Routes } from "react-router-dom";
import Auth from "./routes/Auth";
import Dashboard from "./routes/Dashboard";
import NotFound from "./routes/NotFound";
import Templates from "./routes/Templates";
import Invoices from "./routes/Invoices";
import Reports from "./routes/Reports";
import Expenses from "./routes/Expenses";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Auth />} />
      <Route path="/app" element={<Dashboard />} />
      <Route path="/app/invoices" element={<Invoices />} />
      <Route path="/app/reports" element={<Reports />} />
      <Route path="/app/expenses" element={<Expenses />} />
      <Route path="/app/templates" element={<Templates />} />
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
