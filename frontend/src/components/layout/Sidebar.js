import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { NAV } from "./navigation";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

function Group({ group, onNavigate }) {
  const { hasPerm } = useAuth();
  const location = useLocation();
  const visibleItems = group.items.filter((it) => hasPerm(it.module, "view"));
  const isActive = (to) => (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to));
  const containsActive = visibleItems.some((it) => isActive(it.to));
  const [open, setOpen] = useState(containsActive || !group.label);

  if (visibleItems.length === 0) return null;

  // Single-item group (no header) -> render items directly
  if (!group.label) {
    return (
      <div className="mb-1">
        {visibleItems.map((it) => (
          <Item key={it.to} it={it} active={isActive(it.to)} onNavigate={onNavigate} />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-1">
      <button
        data-testid={`nav-group-${group.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
      >
        {group.icon && <group.icon className="h-3.5 w-3.5" strokeWidth={1.75} />}
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open ? "" : "-rotate-90")} />
      </button>
      {open && (
        <div className="mt-0.5">
          {visibleItems.map((it) => (
            <Item key={it.to} it={it} active={isActive(it.to)} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function Item({ it, active, onNavigate }) {
  return (
    <NavLink
      to={it.to}
      end={it.to === "/"}
      onClick={onNavigate}
      data-testid={`nav-${it.to === "/" ? "dashboard" : it.to.replace(/\//g, "-").replace(/^-/, "")}`}
      className={cn(
        "flex items-center gap-3 pl-6 pr-3 py-2 text-sm rounded-md mx-2 transition-colors",
        active
          ? "bg-emerald-600 text-white font-medium shadow-sm"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      )}
    >
      <it.icon className="h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
      <span className="truncate">{it.label}</span>
    </NavLink>
  );
}

export default function Sidebar({ onNavigate }) {
  const { user } = useAuth();
  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="bg-white rounded-lg px-3 py-2 flex items-center justify-center">
          <img src="/tortillaz-logo.png" alt="Torillaz Tortilla" className="mx-auto max-h-20 w-auto object-contain" />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((g, i) => (
          <Group key={i} group={g} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-400">
        <div className="text-slate-200 font-medium truncate">{user?.name}</div>
        <div className="truncate">{user?.role_label}</div>
      </div>
    </div>
  );
}
