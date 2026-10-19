import {
  Check,
  AlertTriangle,
  FlaskConical,
  HelpCircle,
  LockKeyhole,
} from "lucide-react";
const icons = {
  demo: FlaskConical,
  confirmed: Check,
  caution: AlertTriangle,
  unknown: HelpCircle,
  private: LockKeyhole,
};
export function StatusBadge({
  kind = "demo",
  children,
}: {
  kind?: keyof typeof icons;
  children: React.ReactNode;
}) {
  const Icon = icons[kind];
  return (
    <span className={`status-badge ${kind}`}>
      <Icon size={12} strokeWidth={1.8} />
      {children}
    </span>
  );
}
