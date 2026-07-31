import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RolesPage() {
  const { hasPerm, refreshUser } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState("");
  const [perms, setPerms] = useState({});

  const { data } = useQuery({
    queryKey: ["roles-full"],
    queryFn: async () => (await api.get("/roles")).data,
  });

  const roles = data?.roles || [];
  const modules = data?.modules || [];
  const actions = data?.actions || [];
  const labels = data?.module_labels || {};

  useEffect(() => {
    if (roles.length && !selected) setSelected(roles[0].name);
  }, [roles, selected]);

  useEffect(() => {
    const r = roles.find((x) => x.name === selected);
    setPerms(r ? JSON.parse(JSON.stringify(r.permissions || {})) : {});
  }, [selected, data]); // eslint-disable-line

  const toggle = (mod, act) => {
    setPerms((p) => {
      const cur = new Set(p[mod] || []);
      cur.has(act) ? cur.delete(act) : cur.add(act);
      return { ...p, [mod]: [...cur] };
    });
  };

  const saveMut = useMutation({
    mutationFn: async () => (await api.put(`/roles/${selected}`, { permissions: perms })).data,
    onSuccess: async () => {
      toast.success("Hak akses diperbarui");
      qc.invalidateQueries({ queryKey: ["roles-full"] });
      await refreshUser();
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const canEdit = hasPerm("pengaturan", "edit");

  return (
    <div>
      <PageHeader title="Role & Hak Akses" subtitle="Atur izin (view, add, edit, delete, approve, print, export) per modul">
        {canEdit && (
          <Button data-testid="role-save" className="bg-emerald-600 hover:bg-emerald-700" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
            <Save className="h-4 w-4 mr-1.5" /> Simpan Perubahan
          </Button>
        )}
      </PageHeader>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 mb-4 max-w-sm">
        <label className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Pilih Role</label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger data-testid="role-select" className="bg-white"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-white">
            {roles.map((r) => <SelectItem key={r.name} value={r.name}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-auto">
        <table className="w-full" data-testid="role-matrix">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left text-xs uppercase tracking-wider font-semibold text-slate-500 py-3 px-4">Modul</th>
              {actions.map((a) => (
                <th key={a} className="text-center text-xs uppercase tracking-wider font-semibold text-slate-500 py-3 px-3">{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((mod) => (
              <tr key={mod} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4 text-sm font-medium text-slate-700">{labels[mod] || mod}</td>
                {actions.map((a) => (
                  <td key={a} className="text-center py-3 px-3">
                    <Checkbox
                      data-testid={`perm-${mod}-${a}`}
                      checked={(perms[mod] || []).includes(a)}
                      disabled={!canEdit}
                      onCheckedChange={() => toggle(mod, a)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
