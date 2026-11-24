import React from "react";

export function Card({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`bg-card text-card-foreground border border-border rounded-2xl shadow-sm ${className}`} {...props} />;
}
