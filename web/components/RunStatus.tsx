import type { Run } from "@/lib/api";

export default function RunStatus({ run }: { run: Run }) {
  if (run.status === "completed")
    return <span className={`badge ${run.summary?.failed ? "bad" : "ok"}`}>{run.summary?.failed ? `${run.summary.failed} failed` : "All passed"}</span>;
  if (run.status === "failed") return <span className="badge bad">Error</span>;
  return <span className="badge warn">{run.status === "queued" ? "Queued" : "Running…"}</span>;
}
