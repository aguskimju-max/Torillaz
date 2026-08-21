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
import PelangganMapPage from "@/pages/master/PelangganMapPage";
import StockOperationPage from "@/pages/stock/StockOperationPage";
import StokListPage from "@/pages/stock/StokListPage";
import StokInputPage from "@/pages/stock/StokInputPage";
import KartuStokPage from "@/pages/stock/KartuStokPage";
import UsersPage from "@/pages/settings/UsersPage";
import RolesPage from "@/pages/settings/RolesPage";
import BackupPage from "@/pages/settings/BackupPage";
import ResetDataPage from "@/pages/settings/ResetDataPage";
import AuditPage from "@/pages/AuditPage";
import BomPage from "@/pages/produksi/BomPage";
import ProductionPage from "@/pages/produksi/ProductionPage";
import SalesPage from "@/pages/penjualan/SalesPage";
import PiutangPage from "@/pages/penjualan/PiutangPage";
import KasBankPage from "@/pages/keuangan/KasBankPage";
import LabaRugiPage from "@/pages/keuangan/LabaRugiPage";
import AbsensiPage from "@/pages/hr/AbsensiPage";
import RekapAbsensiPage from "@/pages/hr/RekapAbsensiPage";
import KasbonPage from "@/pages/hr/KasbonPage";
import PayrollPage from "@/pages/hr/PayrollPage";
import LaporanPage from "@/pages/LaporanPage";

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
            <Route path="/peta-pelanggan" element={<Guard module="master"><PelangganMapPage /></Guard>} />
            <Route path="/stok" element={<Guard module="gudang"><StokListPage /></Guard>} />
            <Route path="/stok/input" element={<Guard module="gudang"><StokInputPage /></Guard>} />
            <Route path="/stok/penerimaan" element={<Guard module="gudang"><StockOperationPage mode="penerimaan" /></Guard>} />
            <Route path="/stok/pengeluaran" element={<Guard module="gudang"><StockOperationPage mode="pengeluaran" /></Guard>} />
            <Route path="/stok/penyesuaian" element={<Guard module="gudang"><StockOperationPage mode="penyesuaian" /></Guard>} />
            <Route path="/stok/transfer" element={<Guard module="gudang"><StockOperationPage mode="transfer" /></Guard>} />
            <Route path="/stok/opname" element={<Guard module="gudang"><StockOperationPage mode="opname" /></Guard>} />
            <Route path="/stok/kartu" element={<Guard module="gudang"><KartuStokPage /></Guard>} />
            <Route path="/produksi/bom" element={<Guard module="produksi"><BomPage /></Guard>} />
            <Route path="/produksi/order" element={<Guard module="produksi"><ProductionPage /></Guard>} />
            <Route path="/penjualan" element={<Guard module="penjualan"><SalesPage /></Guard>} />
            <Route path="/penjualan/piutang" element={<Guard module="penjualan"><PiutangPage /></Guard>} />
            <Route path="/keuangan/kas-bank" element={<Guard module="keuangan"><KasBankPage /></Guard>} />
            <Route path="/keuangan/laba-rugi" element={<Guard module="keuangan"><LabaRugiPage /></Guard>} />
            <Route path="/hr/absensi" element={<Guard module="hr"><AbsensiPage /></Guard>} />
            <Route path="/hr/rekap-absensi" element={<Guard module="hr"><RekapAbsensiPage /></Guard>} />
            <Route path="/hr/kasbon" element={<Guard module="hr"><KasbonPage /></Guard>} />
            <Route path="/hr/payroll" element={<Guard module="hr"><PayrollPage /></Guard>} />
            <Route path="/laporan" element={<Guard module="laporan"><LaporanPage /></Guard>} />
            <Route path="/pengaturan/pengguna" element={<Guard module="pengaturan"><UsersPage /></Guard>} />
            <Route path="/pengaturan/role" element={<Guard module="pengaturan"><RolesPage /></Guard>} />
            <Route path="/pengaturan/backup" element={<Guard module="pengaturan"><BackupPage /></Guard>} />
            <Route path="/pengaturan/reset" element={<Guard module="pengaturan"><ResetDataPage /></Guard>} />
            <Route path="/audit" element={<Guard module="audit"><AuditPage /></Guard>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}
