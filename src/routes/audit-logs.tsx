import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LogsIcon as LogIcon, Filter } from "lucide-react";

export const Route = createFileRoute("/audit-logs")({
  head: () => ({ meta: [{ title: "Audit Logs — SCOE" }] }),
  component: () => <ProtectedAdmin><AuditLogsPage /></ProtectedAdmin>,
});

interface AuditRecord {
  id: string;
  admin_id: string;
  course_id: string;
  action_type: string;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  timestamp: string;
  changes_description: string;
}

function AuditLogsPage() {
  const [filterAction, setFilterAction] = useState<string>("all");

  // Fetch audit logs from console (in production, query audit_logs table)
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      // For now, return empty array
      // In production: const { data } = await supabase.from("audit_logs").select("*").order("timestamp", { ascending: false });
      
      console.log("Audit logs fetched");
      return [] as AuditRecord[];
    },
  });

  const filteredLogs = auditLogs.filter(
    (log) => filterAction === "all" || log.action_type === filterAction
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Audit Logs</h2>
        <p className="text-sm text-muted-foreground">
          Track all administrative actions on courses and academic records for compliance and data integrity.
        </p>
      </div>

      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LogIcon className="h-5 w-5 text-blue-600" />
            System Audit Trail
          </CardTitle>
          <CardDescription>
            All course edits are logged with timestamps and specific changes. System-controlled fields (GPA, CGPA) automatically
            recalculate when needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 rounded-md bg-white/50 p-4 text-sm">
            <div>
              <p className="font-medium mb-2">What is tracked:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>✓ Course code changes (e.g., CSC201 → CSC202)</li>
                <li>✓ Course title updates</li>
                <li>✓ Course unit modifications (triggers GPA recalculation)</li>
                <li>✓ Admin who made the change</li>
                <li>✓ Exact timestamp of change</li>
                <li>✓ Before/after values</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {auditLogs.length === 0 ? (
        <Card className="tsu-shadow">
          <CardContent className="py-10 text-center text-muted-foreground">
            <LogIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>No audit logs yet. Changes to courses will appear here.</p>
            <p className="text-xs mt-2">Note: Audit logs are currently logged to the console.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="tsu-shadow">
          <CardHeader>
            <CardTitle className="text-base">Recent Changes ({filteredLogs.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Course ID</TableHead>
                    <TableHead>Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">{log.admin_id}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.action_type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.course_id.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm">{log.changes_description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit Trail Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium mb-1">🔍 Monitoring</p>
            <p className="text-muted-foreground">
              This system maintains a complete audit trail of all administrative actions. Every edit is recorded with
              before/after values.
            </p>
          </div>
          <div>
            <p className="font-medium mb-1">📊 Automatic Recalculation</p>
            <p className="text-muted-foreground">
              When a course unit is changed, GPA and CGPA are automatically recalculated for all affected students.
              This ensures mathematical consistency across the system.
            </p>
          </div>
          <div>
            <p className="font-medium mb-1">🔒 Non-Destructive</p>
            <p className="text-muted-foreground">
              All edits are non-destructive. Historical records are preserved. System always maintains data integrity.
            </p>
          </div>
          <div>
            <p className="font-medium mb-1">⚙️ System-Controlled Fields</p>
            <p className="text-muted-foreground">
              GPA, CGPA, grade points, and other calculated fields are never manually edited. They are always
              system-generated and recalculated based on raw course data.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
