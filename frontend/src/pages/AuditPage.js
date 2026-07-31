import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/common/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tanggalWaktu } from "@/lib/format";

const ACTION_VARIANT = { create: "success", update: "info", delete: "danger", login: "neutral" };

export default function AuditPage() {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const params = { q, page, limit };
  if (action !== "all") params.action = action;

  const { data, isLoading } = useQuery({
    queryKey: ["audit", q, action, page],
    queryFn: async () => (await api.get("/audit", { params })).data,
  });

  const columns = [
    { key: "created_at", label: "Waktu", render: (r) => tanggalWaktu(r.created_at) },
    { key: "user_name", label: "Pengguna" },
    { key: "action", label: "Aksi", render: (r) => <StatusBadge variant={ACTION_VARIANT[r.action] || "neutral"}>{r.action}</StatusBadge> },
    { key: "module", label: "Modul" },
    { key: "description", label: "Keterangan" },
  ];

  return (
    <div>
      <PageHeader title="Audit Trail" subtitle="Riwayat aktivitas & perubahan data seluruh pengguna" />
      <DataTable
        testId="audit-table"
        columns={columns}
        rows={data?.items || []}
        loading={isLoading}
        total={data?.total || 0}
        page={page}
        limit={limit}
        onPageChange={setPage}
        search={q}
        onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Cari aktivitas..."
        toolbar={
          <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
            <SelectTrigger data-testid="audit-filter" className="w-40 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Semua Aksi</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="login">Login</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </div>
  );
}
