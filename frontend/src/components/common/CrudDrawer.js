import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Navigation, Loader2 } from "lucide-react";
import { toast } from "sonner";

function GeoField({ form, onChange }) {
  const [loading, setLoading] = useState(false);
  const lat = form?.latitude ?? "";
  const lng = form?.longitude ?? "";
  const hasCoords = lat !== "" && lng !== "" && lat != null && lng != null;
  const ambilLokasi = () => {
    if (!navigator.geolocation) return toast.error("Perangkat tidak mendukung layanan lokasi");
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange("latitude", Number(pos.coords.latitude.toFixed(6)));
        onChange("longitude", Number(pos.coords.longitude.toFixed(6)));
        setLoading(false);
        toast.success("Lokasi berhasil diambil");
      },
      (err) => {
        setLoading(false);
        toast.error(err.code === 1 ? "Izin lokasi ditolak. Aktifkan izin lokasi di HP." : "Gagal mengambil lokasi, coba lagi");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Input data-testid="field-latitude" type="number" step="any" placeholder="Latitude" value={lat} onChange={(e) => onChange("latitude", e.target.value === "" ? "" : Number(e.target.value))} />
        <Input data-testid="field-longitude" type="number" step="any" placeholder="Longitude" value={lng} onChange={(e) => onChange("longitude", e.target.value === "" ? "" : Number(e.target.value))} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" data-testid="btn-ambil-lokasi" onClick={ambilLokasi} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <MapPin className="h-4 w-4 mr-1.5 text-emerald-600" />}
          {loading ? "Mengambil lokasi..." : "Ambil Lokasi Sekarang"}
        </Button>
        {hasCoords && (
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noreferrer" data-testid="link-maps" className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            <Navigation className="h-3.5 w-3.5" /> Buka Arah (Google Maps)
          </a>
        )}
      </div>
      <p className="text-xs text-slate-400">Ambil saat berada di toko pelanggan (butuh izin lokasi HP & koneksi HTTPS). Untuk penunjuk arah nanti.</p>
    </div>
  );
}

function Field({ f, value, onChange, options }) {
  const common = { id: f.name, "data-testid": `field-${f.name}` };
  if (f.type === "textarea")
    return <Textarea {...common} value={value ?? ""} onChange={(e) => onChange(f.name, e.target.value)} placeholder={f.placeholder} />;
  if (f.type === "switch")
    return (
      <div className="flex items-center gap-2 h-10">
        <Switch id={f.name} data-testid={`field-${f.name}`} checked={!!value} onCheckedChange={(v) => onChange(f.name, v)} />
        <span className="text-sm text-slate-500">{value ? "Ya" : "Tidak"}</span>
      </div>
    );
  if (f.type === "select") {
    const opts = f.options || options?.[f.source] || [];
    return (
      <Select value={value ? String(value) : ""} onValueChange={(v) => onChange(f.name, v)}>
        <SelectTrigger data-testid={`field-${f.name}`} className="bg-white">
          <SelectValue placeholder={f.placeholder || "Pilih..."} />
        </SelectTrigger>
        <SelectContent className="bg-white">
          {opts.map((o) => (
            <SelectItem key={o.value ?? o.id} value={String(o.value ?? o.id)}>
              {o.label ?? o.nama}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      {...common}
      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
      value={value ?? ""}
      onChange={(e) => onChange(f.name, f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
      placeholder={f.placeholder}
    />
  );
}

export default function CrudDrawer({ open, onClose, title, fields, initial, onSubmit, options, submitting }) {
  const [form, setForm] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      const base = {};
      fields.forEach((f) => {
        if (f.type === "geo") {
          base.latitude = initial?.latitude ?? "";
          base.longitude = initial?.longitude ?? "";
        } else {
          base[f.name] = initial?.[f.name] ?? (f.type === "switch" ? true : "");
        }
      });
      if (initial?.is_active !== undefined) base.is_active = initial.is_active;
      else base.is_active = true;
      setForm(base);
      setError("");
    }
  }, [open, initial]); // eslint-disable-line

  const change = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    for (const f of fields) {
      if (f.required && (form[f.name] === "" || form[f.name] == null)) {
        setError(`${f.label} wajib diisi`);
        return;
      }
    }
    try {
      setError("");
      const payload = { ...form };
      if (payload.latitude === "") payload.latitude = null;
      if (payload.longitude === "") payload.longitude = null;
      await onSubmit(payload);
    } catch (e) {
      setError(e);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="bg-white w-full sm:max-w-md overflow-y-auto" data-testid="crud-drawer">
        <SheetHeader>
          <SheetTitle className="font-heading">{title}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          {fields.map((f) => (
            <div key={f.name}>
              <Label htmlFor={f.name} className="text-sm font-medium text-slate-700 mb-1.5 block">
                {f.label} {f.required && <span className="text-rose-500">*</span>}
              </Label>
              {f.type === "geo"
                ? <GeoField form={form} onChange={change} />
                : <Field f={f} value={form[f.name]} onChange={change} options={options} />}
            </div>
          ))}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Status Aktif</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch data-testid="field-is_active" checked={form.is_active !== false} onCheckedChange={(v) => change("is_active", v)} />
              <span className="text-sm text-slate-500">{form.is_active !== false ? "Aktif" : "Nonaktif"}</span>
            </div>
          </div>
          {error && <p className="text-sm text-rose-600" data-testid="drawer-error">{error}</p>}
        </div>
        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="drawer-cancel">Batal</Button>
          <Button onClick={submit} disabled={submitting} data-testid="drawer-submit" className="bg-emerald-600 hover:bg-emerald-700">
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
