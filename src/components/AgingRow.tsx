import { fmtMoney } from "@/lib/format";

export default function AgingRow({
  label,
  val,
  total,
  color,
  amtClass = "",
}: {
  label: string;
  val: number;
  total: number;
  color: string;
  amtClass?: string;
}) {
  const pct = total > 0 ? Math.round((val / total) * 100) : 0;
  return (
    <div className="aging-row">
      <span className="aging-label">{label}</span>
      <div className="aging-bar-wrap">
        <div className="aging-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={`aging-amt ${amtClass}`}>{fmtMoney(val)}</span>
    </div>
  );
}
