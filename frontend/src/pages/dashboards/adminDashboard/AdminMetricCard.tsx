import React from "react";
import { ChevronRight } from "lucide-react";
import { CountUp } from "../../../components/ui/count-up";

interface AdminMetricCardProps {
  title: string;
  value: React.ReactNode;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  iconBg: string;
  onClick: () => void;
}

export const AdminMetricCard: React.FC<AdminMetricCardProps> = ({
  title,
  value,
  icon: Icon,
  iconBg,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="text-left bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group"
  >
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <p className="text-3xl font-extrabold text-foreground tracking-tight">{typeof value === "number" ? <CountUp value={value} /> : value}</p>
    </div>
    <div className={`p-3 ${iconBg} rounded-2xl shrink-0 relative`}>
      <Icon className="w-6 h-6" />
      <ChevronRight className="w-3 h-3 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  </button>
);
