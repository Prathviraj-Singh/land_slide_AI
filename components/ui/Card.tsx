import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = "", hoverable = false, ...props }) => {
  return (
    <div
      className={`bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-md transition-all duration-200 ${
        hoverable ? "hover:border-slate-700 hover:shadow-cyan-500/5 hover:-translate-y-0.5 cursor-pointer" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
