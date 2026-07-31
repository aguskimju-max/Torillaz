import React, { useState } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import CrudDrawer from "@/components/common/CrudDrawer";
import StatusBadge from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { tanggal } from "@/lib/format";

export default function UsersPage() {
  const { hasPerm } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState({ open: false, initial: null });
  const [toDelete, setToDelete] = useState(null);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["users", q, page],
    queryFn: async () => (await api.get("/users", { params: { q, page, limit } })).data,
  });
  const { data: rolesData } = useQuery({
    queryKey: ["roles-list"],
    queryFn: async () => (await api.get("/roles")).data,
  });
  const roleOptions = (rolesData?.roles || []).map((r) => ({ value: r.name, label: r.label }));

  const fields = [
    { name: "name", label: "Nama Lengkap", type: "text", required: true },
    { name: "email", label: "Email", type: "text", required: true },
    { name: "password", label: drawer.initial ? "Password (kosongkan jika tidak diubah)" : "Password", type: "text", required: !drawer.initial },
    { name: "role", label: "Role", type: "select", options: roleOptions, required: true },
  ];

  const saveMut = useMutation({
    mutationFn: async (form) => {
      const payload = { ...form };
      if (drawer.initial?.id) {
        if (!payload.password) delete payload.password;
        return (await api.put(`/users/${drawer.initial.id}`, payload)).data;
      }
      return (await api.post("/users", payload)).data;
    },
    onSuccess: () => { toast.success("Pengguna disimpan"); qc.invalidateQueries({ queryKey: ["users"] }); setDrawer({ open: false, initial: null }); },
    onError: (e) => { throw apiError(e); },
  });
  const delMut = useMutation({
    mutationFn: async (id) => (await api.delete(`/users/${id}`)).data,
    onSuccess: () => { toast.success("Pengguna dihapus"); qc.invalidateQueries({ queryKey: ["users"] }); setToDelete(null); },
    onError: (e) => { toast.error(apiError(e)); setToDelete(null); },
  });

  const columns = [
    { key: "name", label: "Nama" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role", render: (r) => <StatusBadge variant="info">{(roleOptions.find((o) => o.value === r.role)?.label) || r.role}</StatusBadge> },
    { key: "is_active", label: "Status", render: (r) => r.is_active === false ? <StatusBadge variant="neutral">Nonaktif</StatusBadge> : <StatusBadge variant="success">Aktif</StatusBadge> },
    { key: "created_at", label: "Dibuat", render: (r) => tanggal(r.created_at) },
    { key: "_aksi", label: "Aksi", align: "right", render: (r) => (
      <div className="flex items-center justify-end gap-1">
        {hasPerm("pengaturan", "edit") && <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`user-edit-${r.id}`} onClick={() => setDrawer({ open: true, initial: r })}><Pencil className="h-4 w-4 text-slate-500" /></Button>}
        {hasPerm("pengaturan", "delete") && <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`user-delete-${r.id}`} onClick={() => setToDelete(r)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Pengguna" subtitle="Kelola akun & role pengguna sistem">
        {hasPerm("pengaturan", "add") && (
          <Button data-testid="user-add-btn" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setDrawer({ open: true, initial: null })}>
            <Plus className="h-4 w-4 mr-1.5" /> Tambah Pengguna
          </Button>
        )}
      </PageHeader>

      <DataTable testId="users-table" columns={columns} rows={data?.items || []} loading={isLoading} total={data?.total || 0} page={page} limit={limit} onPageChange={setPage} search={q} onSearch={(v) => { setQ(v); setPage(1); }} searchPlaceholder="Cari pengguna..." />

      <CrudDrawer open={drawer.open} onClose={() => setDrawer({ open: false, initial: null })} title={`${drawer.initial ? "Ubah" : "Tambah"} Pengguna`} fields={fields} initial={drawer.initial} submitting={saveMut.isPending} onSubmit={(form) => saveMut.mutateAsync(form)} />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengguna?</AlertDialogTitle>
            <AlertDialogDescription>Akun <b>{toDelete?.email}</b> akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" data-testid="user-delete-confirm" onClick={() => delMut.mutate(toDelete.id)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
