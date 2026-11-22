import type { Run } from "@/lib/api";

export default function RunStatus({ run }: { run: Run }) {
  if (run.status === "completed")
    return <span className={`badge ${run.summary?.failed ? "bad" : "ok"}`}>{run.summary?.failed ? `${run.summary.failed} failed` : "All passed"}</span>;
  if (run.status === "failed") return <span className="badge bad">Couldn&apos;t finish</span>;
  return <span className="badge warn live">{run.status === "queued" ? "Queued" : "Running"}</span>;
}
