import { badgeClass, labelize } from "@/lib/format";

export default function StatusBadge({ status }: { status: string | null | undefined }) {
  return <span className={badgeClass(status)}>{labelize(status)}</span>;
}
