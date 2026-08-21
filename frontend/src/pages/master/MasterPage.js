import React, { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { MASTER_CONFIGS } from "./masterConfigs";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import CrudDrawer from "@/components/common/CrudDrawer";
import StatusBadge from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { rupiah, tanggal } from "@/lib/format";

export default function MasterPage() {
  const { entity } = useParams();
  const config = MASTER_CONFIGS[entity];
  const { hasPerm } = useAuth();
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState({ open: false, initial: null });
  const [toDelete, setToDelete] = useState(null);

  const limit = 20;
  const listKey = ["master", entity, q, page];
  const { data, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: async () => (await api.get(`/master/${entity}`, { params: { q, page, limit } })).data,
    enabled: !!config,
  });

  // fetch options for ref columns + select fields
  const refSources = useMemo(() => {
    if (!config) return [];
    const s = new Set();
    config.columns.forEach((c) => c.fmt === "ref" && c.refSource && s.add(c.refSource));
    config.fields.forEach((f) => f.type === "select" && f.source && s.add(f.source));
    return [...s];
  }, [config]);

  const optionQueries = useQueries({
    queries: refSources.map((src) => ({
      queryKey: ["options", src],
      queryFn: async () => (await api.get(`/master/${src}/options`)).data,
    })),
  });
  const optionsMap = useMemo(() => {
    const m = {};
    refSources.forEach((src, i) => (m[src] = optionQueries[i]?.data || []));
    return m;
  }, [refSources, optionQueries]);

  const saveMut = useMutation({
    mutationFn: async (form) => {
      // attach satuan_nama for item entities
      const satField = config.fields.find((f) => f.satuanName);
      if (satField && form[satField.name]) {
        const sat = (optionsMap.satuan || []).find((o) => String(o.id) === String(form[satField.name]));
        if (sat) form.satuan_nama = sat.simbol || sat.nama;
      }
      if (drawer.initial?.id) return (await api.put(`/master/${entity}/${drawer.initial.id}`, form)).data;
      return (await api.post(`/master/${entity}`, form)).data;
    },
    onSuccess: () => {
      toast.success("Data berhasil disimpan");
      qc.invalidateQueries({ queryKey: ["master", entity] });
      setDrawer({ open: false, initial: null });
    },
    onError: (e) => { throw apiError(e); },
  });

  const delMut = useMutation({
    mutationFn: async (id) => (await api.delete(`/master/${entity}/${id}`)).data,
    onSuccess: () => {
      toast.success("Data berhasil dihapus");
      qc.invalidateQueries({ queryKey: ["master", entity] });
      setToDelete(null);
    },
    onError: (e) => { toast.error(apiError(e)); setToDelete(null); },
  });

  if (!config) return <div className="text-slate-500">Master data tidak ditemukan.</div>;

  const resolveRef = (src, id) => {
    const o = (optionsMap[src] || []).find((x) => String(x.id) === String(id));
    return o ? o.nama : "-";
  };

  const canEdit = hasPerm("master", "edit");
  const canDelete = hasPerm("master", "delete");

  const columns = [
    ...config.columns.map((c) => ({
      key: c.key,
      label: c.label,
      align: c.align,
      render: (row) => {
        const v = row[c.key];
        if (c.fmt === "money") return rupiah(v);
        if (c.fmt === "date") return tanggal(v);
        if (c.fmt === "bool") return row.is_active === false
          ? <StatusBadge variant="neutral">Nonaktif</StatusBadge>
          : <StatusBadge variant="success">Aktif</StatusBadge>;
        if (c.fmt === "ref") return resolveRef(c.refSource, v);
        if (c.fmt === "maps") return (row.latitude != null && row.longitude != null && row.latitude !== "" && row.longitude !== "")
          ? <a href={`https://www.google.com/maps/dir/?api=1&destination=${row.latitude},${row.longitude}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700"><MapPin className="h-3.5 w-3.5" /> Arah</a>
          : "-";
        return v ?? "-";
      },
    })),
    {
      key: "_aksi", label: "Aksi", align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`edit-${row.id}`} onClick={() => setDrawer({ open: true, initial: row })}>
              <Pencil className="h-4 w-4 text-slate-500" />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`delete-${row.id}`} onClick={() => setToDelete(row)}>
              <Trash2 className="h-4 w-4 text-rose-500" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={config.title} subtitle="Kelola data master yang terhubung ke seluruh modul">
        {hasPerm("master", "add") && (
          <Button data-testid="master-add-btn" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setDrawer({ open: true, initial: null })}>
            <Plus className="h-4 w-4 mr-1.5" /> Tambah
          </Button>
        )}
      </PageHeader>

      <DataTable
        testId="master-table"
        columns={columns}
        rows={data?.items || []}
        loading={isLoading}
        total={data?.total || 0}
        page={page}
        limit={limit}
        onPageChange={setPage}
        search={q}
        onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder={`Cari ${config.title.toLowerCase()}...`}
      />

      <CrudDrawer
        open={drawer.open}
        onClose={() => setDrawer({ open: false, initial: null })}
        title={`${drawer.initial ? "Ubah" : "Tambah"} ${config.title}`}
        fields={config.fields}
        initial={drawer.initial}
        options={optionsMap}
        submitting={saveMut.isPending}
        onSubmit={(form) => saveMut.mutateAsync(form)}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data?</AlertDialogTitle>
            <AlertDialogDescription>
              Data <b>{toDelete?.nama}</b> akan dinonaktifkan (soft delete). Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel">Batal</AlertDialogCancel>
            <AlertDialogAction data-testid="delete-confirm" className="bg-rose-600 hover:bg-rose-700" onClick={() => delMut.mutate(toDelete.id)}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
