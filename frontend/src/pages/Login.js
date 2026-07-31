import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Factory, Loader2, Lock, Mail } from "lucide-react";
import { useAuth, apiError } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const BG = "https://images.unsplash.com/photo-1652211955967-99c892925469?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDB8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBmb29kJTIwbWFudWZhY3R1cmluZyUyMGZhY2lsaXR5fGVufDB8fHx8MTc4NTUwMDI2N3ww&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("aguskimju@gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate("/");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-11 w-11 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Factory className="h-6 w-6 text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="font-heading font-bold text-lg text-slate-900">ERP Terpadu</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Manajemen Usaha</div>
            </div>
          </div>

          <h1 className="font-heading text-2xl font-semibold text-slate-900">Selamat Datang</h1>
          <p className="text-sm text-slate-500 mt-1 mb-8">Masuk untuk mengelola bisnis Anda dalam satu sistem.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  data-testid="login-email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} className="pl-9" placeholder="email@perusahaan.com" required
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  data-testid="login-password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)} className="pl-9" placeholder="••••••••" required
                />
              </div>
            </div>
            {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2" data-testid="login-error">{error}</p>}
            <Button data-testid="login-submit" type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 h-11">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses...</> : "Masuk"}
            </Button>
          </form>
        </div>
      </div>

      {/* Right: image */}
      <div className="hidden lg:block relative flex-1">
        <img src={BG} alt="Fasilitas produksi" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-emerald-950/70" />
        <div className="relative h-full flex flex-col justify-end p-12 text-white">
          <h2 className="font-heading text-3xl font-bold leading-tight max-w-md">
            Kendalikan seluruh usaha dari satu pintu.
          </h2>
          <p className="text-emerald-100 mt-3 max-w-md">
            Dari bahan baku, gudang, produksi, hingga laporan keuangan — terintegrasi dan real-time.
          </p>
        </div>
      </div>
    </div>
  );
}
