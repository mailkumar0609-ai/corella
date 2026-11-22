export type RuleVerdict = { pack: string; id: string; rule: string; status: "passed" | "violated" | "not_tested";
  tested_by: string[]; violations: string[] };

const LABEL = { passed: ["ok", "No breach found"], violated: ["bad", "Breached"], not_tested: ["warn", "Not tested"] } as const;

export default function ComplianceTable({ rules }: { rules?: RuleVerdict[] }) {
  if (!rules?.length) return null;
  const broken = rules.filter((r) => r.status === "violated").length;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="spread">
        <h2 style={{ margin: 0 }}>Compliance checks</h2>
        <span className={`badge ${broken ? "bad" : "ok"}`}>{broken ? `${broken} of ${rules.length} rules breached` : `All ${rules.length} rules held`}</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ marginTop: 10 }}>
          <thead><tr><th>Rule</th><th>Requirement</th><th>Result</th></tr></thead>
          <tbody>{rules.map((r) => {
            const [cls, text] = LABEL[r.status];
            return (
              <tr key={r.id}>
                <td className="mono" style={{ whiteSpace: "nowrap", verticalAlign: "top" }}>{r.id}</td>
                <td style={{ verticalAlign: "top" }}>{r.rule}</td>
                <td style={{ verticalAlign: "top", minWidth: 150 }}><span className={`badge ${cls}`}>{text}</span>
                  {r.violations.length > 0 && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>in {r.violations.map((v) => v.replace(/_/g, " ")).join(", ")}</div>}
                </td>
              </tr>);
          })}</tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>Automated checks against public RBI and DPDP texts. They support, but don&apos;t replace, legal and compliance review.</p>
    </div>
  );
}
