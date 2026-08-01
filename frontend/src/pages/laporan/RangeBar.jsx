import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RangeBar({ range, setRange, children }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-4 flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
      <div><Label className="mb-1.5 block">Dari</Label><Input data-testid="rep-start" type="date" value={range.start} onChange={(e) => setRange((p) => ({ ...p, start: e.target.value }))} className="w-44" /></div>
      <div><Label className="mb-1.5 block">Sampai</Label><Input data-testid="rep-end" type="date" value={range.end} onChange={(e) => setRange((p) => ({ ...p, end: e.target.value }))} className="w-44" /></div>
      <div className="flex-1" />{children}
    </div>
  );
}
