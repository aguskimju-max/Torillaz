import React, { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Users, Navigation, MapPin } from "lucide-react";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";

const ICON_CDN = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${ICON_CDN}/marker-icon-2x.png`,
  iconUrl: `${ICON_CDN}/marker-icon.png`,
  shadowUrl: `${ICON_CDN}/marker-shadow.png`,
});

const DEFAULT_CENTER = [-2.5, 118.0];
const hasGeo = (c) => c.latitude != null && c.longitude != null && c.latitude !== "" && c.longitude !== "";
const dirUrl = (c) => `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`;

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 14);
    else if (points.length > 1) map.fitBounds(points, { padding: [50, 50] });
  }, [points, map]);
  return null;
}

export default function PelangganMapPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["pelanggan-map"],
    queryFn: async () => (await api.get("/master/pelanggan", { params: { limit: 1000 } })).data,
  });
  const all = useMemo(() => data?.items || [], [data]);
  const withGeo = useMemo(() => all.filter(hasGeo), [all]);
  const points = useMemo(() => withGeo.map((c) => [Number(c.latitude), Number(c.longitude)]), [withGeo]);

  return (
    <div>
      <PageHeader title="Peta Pelanggan" subtitle="Sebaran toko pelanggan untuk merencanakan rute kunjungan">
        <div className="flex items-center gap-2 text-sm text-slate-500" data-testid="map-count">
          <Users className="h-4 w-4 text-emerald-600" /> {withGeo.length} dari {all.length} pelanggan berkoordinat
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 rounded-lg overflow-hidden border border-slate-200 shadow-sm" style={{ height: "72vh" }} data-testid="pelanggan-map">
          <MapContainer center={DEFAULT_CENTER} zoom={5} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {withGeo.map((c) => (
              <Marker key={c.id} position={[Number(c.latitude), Number(c.longitude)]}>
                <Popup>
                  <div className="text-sm min-w-[160px]">
                    <div className="font-semibold text-slate-800">{c.nama_toko || c.nama}</div>
                    {c.nama_toko && <div className="text-slate-500">{c.nama}</div>}
                    {c.telepon && <div className="text-slate-500">{c.telepon}</div>}
                    {c.alamat && <div className="text-slate-400 text-xs mt-0.5">{c.alamat}</div>}
                    <a href={dirUrl(c)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium mt-1.5">
                      <Navigation className="h-3.5 w-3.5" /> Buka Arah
                    </a>
                  </div>
                </Popup>
              </Marker>
            ))}
            <FitBounds points={points} />
          </MapContainer>
        </div>

        <div className="lg:col-span-1 bg-white rounded-lg border border-slate-200 shadow-sm p-3 overflow-y-auto" style={{ maxHeight: "72vh" }}>
          <h3 className="font-heading font-semibold text-slate-800 text-sm mb-2 px-1">Daftar Toko</h3>
          <div className="space-y-1.5" data-testid="map-list">
            {withGeo.map((c) => (
              <div key={c.id} className="p-2 rounded-md border border-slate-100 hover:bg-slate-50" data-testid={`map-list-item-${c.id}`}>
                <div className="font-medium text-slate-800 text-sm truncate">{c.nama_toko || c.nama}</div>
                {c.nama_toko && <div className="text-xs text-slate-400 truncate">{c.nama}</div>}
                <a href={dirUrl(c)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-1">
                  <Navigation className="h-3 w-3" /> Arah
                </a>
              </div>
            ))}
            {!isLoading && withGeo.length === 0 && (
              <div className="text-center text-slate-400 text-sm py-8 px-2">
                <MapPin className="h-6 w-6 mx-auto mb-2 opacity-50" />
                Belum ada pelanggan dengan koordinat. Tambahkan lokasi GPS di menu Pelanggan.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
