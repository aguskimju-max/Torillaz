import React from "react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function StatusBadge({ variant = "neutral", children }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", VARIANTS[variant])}>
      {children}
    </span>
  );
}
