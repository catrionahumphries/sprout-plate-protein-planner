import { cn } from "@/lib/utils";
import type { Status } from "@/lib/recipe-engine";

const styles: Record<Status, string> = {
  pass: "bg-success text-success-foreground",
  warn: "bg-warning text-warning-foreground",
  fail: "bg-destructive text-destructive-foreground",
};
const icon: Record<Status, string> = { pass: "✅", warn: "⚠️", fail: "❌" };

export function StatusBadge({ status, big }: { status: Status; big?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide", styles[status], big ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs")}>
      {big ? status : icon[status] + " " + status}
    </span>
  );
}
