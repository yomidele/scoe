import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCw, Download } from "lucide-react";
import { auditAllResults, printAuditReport, exportAuditReport } from "@/lib/audit";

export const Route = createFileRoute("/validation-audit")({
  head: () => ({ meta: [{ title: "Validation Audit — SCOE" }] }),
  component: () => <ProtectedAdmin><ValidationAuditPage /></ProtectedAdmin>,
});

function ValidationAuditPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [auditReport, setAuditReport] = useState<Awaited<
    ReturnType<typeof auditAllResults>
  > | null>(null);

  const handleRunAudit = async () => {
    setIsRunning(true);
    try {
      const report = await auditAllResults();
      setAuditReport(report);
      printAuditReport(report);
      
      if (report.recordsWithErrors === 0) {
        toast.success("✓ All records validated successfully!");
      } else {
        toast.warning(
          `⚠ Found ${report.recordsWithErrors} semester(s) with potential issues`
        );
      }
    } catch (error) {
      console.error("Audit failed:", error);
      toast.error("Audit failed - check console for details");
    } finally {
      setIsRunning(false);
    }
  };

  const handleExportReport = () => {
    if (!auditReport) return;
    
    const exported = exportAuditReport(auditReport);
    const blob = new Blob([JSON.stringify(exported, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-report-${auditReport.timestamp.split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Report exported");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Results Validation Audit</h2>
        <p className="text-sm text-muted-foreground">
          Scan entire database for GPA/CGPA calculation errors and data inconsistencies.
        </p>
      </div>

      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
            Academic Integrity Check
          </CardTitle>
          <CardDescription>
            This audit validates all GPA and CGPA calculations against the system-generated values.
            Any discrepancies will be flagged for review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 rounded-md bg-white/50 p-4 text-sm">
            <div>
              <p className="font-medium mb-2">Validation Checks:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>✓ GPA = Grade Points ÷ Earned Credit Units (±0.01 tolerance)</li>
                <li>✓ CGPA = Total Grade Points ÷ Total Earned Credit Units</li>
                <li>✓ Grade Points calculated correctly from course scores</li>
                <li>✓ Credit units match course configuration</li>
                <li>✓ No missing or orphaned records</li>
              </ul>
            </div>
          </div>

          <Button
            onClick={handleRunAudit}
            disabled={isRunning}
            className="gap-2"
            size="lg"
          >
            <RefreshCw className={`h-4 w-4 ${isRunning ? "animate-spin" : ""}`} />
            {isRunning ? "Running Audit..." : "Run Full Audit"}
          </Button>
        </CardContent>
      </Card>

      {auditReport && (
        <>
          <Card className={auditReport.recordsWithErrors === 0 ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {auditReport.recordsWithErrors === 0 ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    All Records Valid
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    Issues Detected
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-2xl font-bold">{auditReport.totalRecordsAudited}</p>
                  <p className="text-sm text-muted-foreground">Semester Groups Checked</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{auditReport.totalStudents}</p>
                  <p className="text-sm text-muted-foreground">Students</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {auditReport.recordsWithErrors}
                  </p>
                  <p className="text-sm text-muted-foreground">With Issues</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {auditReport.recordsCorrected}
                  </p>
                  <p className="text-sm text-muted-foreground">Corrections Available</p>
                </div>
              </div>

              {auditReport.recordsWithErrors === 0 && (
                <Alert className="mt-4 border-green-300 bg-green-100">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    ✓ Excellent! All records passed validation. No corrections needed.
                  </AlertDescription>
                </Alert>
              )}

              {auditReport.recordsWithErrors > 0 && (
                <div className="mt-4 space-y-3">
                  <Alert className="border-yellow-300 bg-yellow-100">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      {auditReport.recordsWithErrors} semester group(s) have validation issues.
                      Review details below.
                    </AlertDescription>
                  </Alert>

                  <div className="max-h-96 overflow-y-auto rounded-md border border-yellow-200 bg-white">
                    {auditReport.errors.map((err, idx) => (
                      <div key={idx} className="border-b border-yellow-100 p-3 last:border-b-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">
                              {err.studentName} ({err.studentId.slice(0, 8)})
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {err.session} • {err.level}L • {err.semester} Sem •{" "}
                              {err.courseCount} course{err.courseCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        </div>
                        <ul className="mt-1 ml-4 space-y-0.5">
                          {err.issues.map((issue, i) => (
                            <li key={i} className="text-xs text-muted-foreground">
                              • {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  onClick={handleExportReport}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export Report
                </Button>
                <Button
                  onClick={handleRunAudit}
                  disabled={isRunning}
                  variant="outline"
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Re-run Audit
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">How to Interpret Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium mb-1">✓ All Records Valid</p>
                <p className="text-muted-foreground">
                  All GPA and CGPA calculations are correct and consistent with the raw course data.
                </p>
              </div>
              <div>
                <p className="font-medium mb-1">⚠ Issues Detected</p>
                <p className="text-muted-foreground">
                  One or more records show calculation mismatches. The system has identified corrections that should be applied.
                </p>
              </div>
              <div>
                <p className="font-medium mb-1">GPA Mismatch</p>
                <p className="text-muted-foreground">
                  The stored GPA differs from the calculated value. This could happen due to data entry errors or manual adjustments.
                </p>
              </div>
              <div>
                <p className="font-medium mb-1">ECU Inconsistency</p>
                <p className="text-muted-foreground">
                  The Earned Credit Units (non-F courses) don't match the expected total based on course data.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
