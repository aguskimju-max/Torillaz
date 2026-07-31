import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Menu, Bell, LogOut, AlertTriangle, Info } from "lucide-react";
import Sidebar from "./Sidebar";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function NotificationBell() {
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/notifications")).data,
    refetchInterval: 60_000,
  });
  const count = data?.count || 0;
  const alerts = data?.alerts || [];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button data-testid="notification-bell" className="relative p-2 rounded-md hover:bg-slate-100 transition-colors">
          <Bell className="h-5 w-5 text-slate-600" strokeWidth={1.75} />
          {count > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white animate-pulse">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-white" data-testid="notification-panel">
        <div className="px-4 py-3 border-b border-slate-100 font-heading font-semibold text-sm">
          Notifikasi & Peringatan
        </div>
        <div className="max-h-96 overflow-y-auto">
          {alerts.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Tidak ada peringatan</div>
          )}
          {alerts.map((a, i) => (
            <div key={i} className="flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50">
              <div className={cn("mt-0.5", a.level === "danger" ? "text-rose-600" : a.level === "warning" ? "text-amber-600" : "text-sky-600")}>
                {a.level === "info" ? <Info className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800">{a.title}</div>
                <div className="text-xs text-slate-500">{a.message}</div>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-40">
        <Sidebar />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 border-0 bg-slate-900">
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center gap-3 px-4 lg:px-6">
          <button
            data-testid="mobile-menu-btn"
            className="lg:hidden p-2 rounded-md hover:bg-slate-100"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5 text-slate-700" />
          </button>
          <img src="/tortillaz-logo.png" alt="Torillaz" className="lg:hidden h-9 w-auto object-contain" />
          <div className="flex-1" />
          <NotificationBell />
          <div className="hidden sm:flex flex-col items-end leading-tight mr-1">
            <span className="text-sm font-medium text-slate-800">{user?.name}</span>
            <span className="text-xs text-slate-500">{user?.role_label}</span>
          </div>
          <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 font-semibold flex items-center justify-center text-sm">
            {(user?.name || "?").charAt(0).toUpperCase()}
          </div>
          <Button variant="ghost" size="icon" data-testid="logout-btn" onClick={doLogout} title="Keluar">
            <LogOut className="h-4 w-4 text-slate-600" />
          </Button>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
