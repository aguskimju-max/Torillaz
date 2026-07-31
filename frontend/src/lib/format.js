export const rupiah = (n) =>
  "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(Number(n) || 0));

export const angka = (n) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(n) || 0);

export const tanggal = (iso) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";

export const tanggalWaktu = (iso) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "-";
