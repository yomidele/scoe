import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProtectedDeptAdmin } from "@/components/ProtectedDeptAdmin";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { deptAdminApproveResults, deptAdminPublishResults, deptAdminReturnResults } from "@/lib/result-workflow.functions";
import { useState } from "react";

export const Route = createFileRoute("/dept-admin/approvals")({
  head: () => ({ meta: [{ title: "Result Approvals — Department Admin" }] }),
  component: () => <ProtectedDeptAdmin><Page /></ProtectedDeptAdmin>,
});

function Page() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"submitted" | "approved" | "draft" | "published">("submitted");
  const approve = useServerFn(deptAdminApproveResults);
  const publish = useServerFn(deptAdminPublishResults);
  const ret = useServerFn(deptAdminReturnResults);

  const q = useQuery({
    queryKey: ["dept-results-by-status", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("results")
        .select("id, status, ca_score, exam_score, total_score, level, semester, students(full_name, matric_number), courses(code, title), academic_sessions(name)")
        .eq("status", tab)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  function makeMut(fn: typeof approve, label: string) {
    return useMutation({
      mutationFn: (ids: string[]) => fn({ data: { result_ids: ids } }),
      onSuccess: () => { toast.success(`${label} done`); qc.invalidateQueries({ queryKey: ["dept-results-by-status"] }); qc.invalidateQueries({ queryKey: ["dept-pending-count"] }); },
      onError: (e: Error) => toast.error(e.message),
    });
  }
  const approveMut = makeMut(approve, "Approve");
  const publishMut = makeMut(publish, "Publish");
  const returnMut = useMutation({
    mutationFn: (ids: string[]) => ret({ data: { result_ids: ids, reason: "Returned for revision" } }),
    onSuccess: () => { toast.success("Returned"); qc.invalidateQueries({ queryKey: ["dept-results-by-status"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  const ids = rows.map((r: any) => r.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Result Approvals</h2>
        <p className="text-sm text-muted-foreground">Approve, publish, or return submitted lecturer scores.</p>
      </div>
      <div className="flex gap-2">
        {(["submitted","approved","draft","published"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab===t?"default":"outline"} onClick={() => setTab(t)}>{t}</Button>
        ))}
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base capitalize">{tab} ({rows.length})</CardTitle>
          <div className="flex gap-2">
            {tab === "submitted" && <>
              <Button size="sm" disabled={!ids.length || approveMut.isPending} onClick={() => approveMut.mutate(ids)}>Approve all</Button>
              <Button size="sm" variant="secondary" disabled={!ids.length || publishMut.isPending} onClick={() => publishMut.mutate(ids)}>Publish all</Button>
              <Button size="sm" variant="outline" disabled={!ids.length} onClick={() => returnMut.mutate(ids)}>Return all</Button>
            </>}
            {tab === "approved" && <Button size="sm" disabled={!ids.length || publishMut.isPending} onClick={() => publishMut.mutate(ids)}>Publish all</Button>}
          </div>
        </CardHeader>
        <CardContent>
          {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Matric</th><th className="py-2 pr-3">Student</th><th className="py-2 pr-3">Course</th><th className="py-2 pr-3">Session</th><th className="py-2 pr-3">Sem</th><th className="py-2 pr-3">CA</th><th className="py-2 pr-3">Exam</th><th className="py-2 pr-3">Total</th></tr></thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2 pr-3">{r.students?.matric_number}</td>
                    <td className="py-2 pr-3">{r.students?.full_name}</td>
                    <td className="py-2 pr-3">{r.courses?.code}</td>
                    <td className="py-2 pr-3">{r.academic_sessions?.name}</td>
                    <td className="py-2 pr-3">{r.semester}</td>
                    <td className="py-2 pr-3">{r.ca_score}</td>
                    <td className="py-2 pr-3">{r.exam_score}</td>
                    <td className="py-2 pr-3 font-medium">{r.total_score ?? Number(r.ca_score)+Number(r.exam_score)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={8} className="py-4 text-center text-muted-foreground">Nothing here.</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
