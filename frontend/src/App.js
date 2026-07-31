import "@/App.css";
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import MasterPage from "@/pages/master/MasterPage";
import StockOperationPage from "@/pages/stock/StockOperationPage";
import StokListPage from "@/pages/stock/StokListPage";
import KartuStokPage from "@/pages/stock/KartuStokPage";
import UsersPage from "@/pages/settings/UsersPage";
import RolesPage from "@/pages/settings/RolesPage";
import BackupPage from "@/pages/settings/BackupPage";
import AuditPage from "@/pages/AuditPage";

function FullLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) return <FullLoader />;
  if (user === false) return <Navigate to="/login" replace />;
  return children;
}

function Guard({ module, children }) {
  const { hasPerm } = useAuth();
  const location = useLocation();
  if (!hasPerm(module, "view")) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
        <h2 className="font-heading text-xl font-semibold text-slate-800">Akses Ditolak</h2>
        <p className="text-slate-500 mt-2">Anda tidak memiliki hak akses untuk halaman ini ({location.pathname}).</p>
      </div>
    );
  }
  return children;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading || user === null) return <FullLoader />;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route element={<Protected><AppLayout /></Protected>}>
            <Route path="/" element={<Guard module="dashboard"><Dashboard /></Guard>} />
            <Route path="/master/:entity" element={<Guard module="master"><MasterPage /></Guard>} />
            <Route path="/stok" element={<Guard module="gudang"><StokListPage /></Guard>} />
            <Route path="/stok/penerimaan" element={<Guard module="gudang"><StockOperationPage mode="penerimaan" /></Guard>} />
            <Route path="/stok/pengeluaran" element={<Guard module="gudang"><StockOperationPage mode="pengeluaran" /></Guard>} />
            <Route path="/stok/penyesuaian" element={<Guard module="gudang"><StockOperationPage mode="penyesuaian" /></Guard>} />
            <Route path="/stok/transfer" element={<Guard module="gudang"><StockOperationPage mode="transfer" /></Guard>} />
            <Route path="/stok/opname" element={<Guard module="gudang"><StockOperationPage mode="opname" /></Guard>} />
            <Route path="/stok/kartu" element={<Guard module="gudang"><KartuStokPage /></Guard>} />
            <Route path="/pengaturan/pengguna" element={<Guard module="pengaturan"><UsersPage /></Guard>} />
            <Route path="/pengaturan/role" element={<Guard module="pengaturan"><RolesPage /></Guard>} />
            <Route path="/pengaturan/backup" element={<Guard module="pengaturan"><BackupPage /></Guard>} />
            <Route path="/audit" element={<Guard module="audit"><AuditPage /></Guard>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}
