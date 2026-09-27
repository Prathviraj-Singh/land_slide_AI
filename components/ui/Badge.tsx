import React from "react";

export interface BadgeProps {
  level?: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "Safe" | "Watch" | "Warning" | "Critical" | string;
  children?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ level = "LOW", children, className = "" }) => {
  const normLevel = String(level).toUpperCase();

  let style = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  let dotColor = "bg-emerald-400";
  let label = children || level;

  if (normLevel === "MODERATE" || normLevel === "WATCH") {
    style = "bg-amber-500/10 text-amber-400 border-amber-500/30";
    dotColor = "bg-amber-400";
  } else if (normLevel === "HIGH" || normLevel === "WARNING") {
    style = "bg-orange-500/10 text-orange-400 border-orange-500/30";
    dotColor = "bg-orange-400";
  } else if (normLevel === "CRITICAL") {
    style = "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse";
    dotColor = "bg-rose-500";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm transition-all ${style} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
};
