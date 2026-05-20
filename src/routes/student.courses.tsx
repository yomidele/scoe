import { createFileRoute } from "@tanstack/react-router";
import { ProtectedStudent } from "@/components/ProtectedStudent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/student/courses")({
  head: () => ({ meta: [{ title: "Course Registration — SCOE" }] }),
  component: () => <ProtectedStudent><CourseRegPage /></ProtectedStudent>,
});

function CourseRegPage() {
  const { session } = useAuthSession();
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState<string>("");
  const [semester, setSemester] = useState<"First" | "Second">("First");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: student } = useQuery({
    queryKey: ["s-reg", session?.user.id],
    enabled: !!session,
    queryFn: async () => (await supabase.from("students").select("id, level, faculty_id, department_id").eq("user_id", session!.user.id).maybeSingle()).data,
  });

  const { data: settings } = useQuery({
    queryKey: ["acad-settings"],
    queryFn: async () => (await supabase.from("academic_settings").select("*").maybeSingle()).data,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions-reg"],
    queryFn: async () => (await supabase.from("academic_sessions").select("*").order("name", { ascending: false })).data ?? [],
  });

  const { data: levelCourses = [] } = useQuery({
    queryKey: ["level-courses", student?.level, semester, student?.faculty_id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, code, title, unit, level, semester, course_type")
        .eq("level", student!.level)
        .eq("semester", semester)
        .eq("faculty_id", student!.faculty_id)
        .order("code");
      return data ?? [];
    },
  });

  const { data: carryovers = [] } = useQuery({
    queryKey: ["co-for-reg", student?.id, semester],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("carryovers")
        .select("id, course_id, courses(id, code, title, unit, semester)")
        .eq("student_id", student!.id)
        .eq("status", "pending");
      return (data ?? []).filter((c) => (c.courses as { semester?: string } | null)?.semester === semester);
    },
  });

  const lockedCourseIds = useMemo(() => new Set(carryovers.map((c) => c.course_id)), [carryovers]);
  const carryoverUnits = carryovers.reduce((s, c) => s + ((c.courses as { unit?: number } | null)?.unit ?? 0), 0);
  const selectedUnits = levelCourses.filter((c) => selected.has(c.id)).reduce((s, c) => s + c.unit, 0);
  const totalUnits = carryoverUnits + selectedUnits;

  const minUnits = settings?.min_units ?? 15;
  const maxUnits = settings?.max_units ?? 24;

  const toggle = (id: string) => {
    if (lockedCourseIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!student || !sessionId) throw new Error("Choose a session");
      if (totalUnits < minUnits) throw new Error(`Minimum ${minUnits} units required (you have ${totalUnits})`);
      if (totalUnits > maxUnits) throw new Error(`Maximum ${maxUnits} units allowed (you have ${totalUnits})`);

      const { data: reg, error: regErr } = await supabase
        .from("course_registrations")
        .insert({
          student_id: student.id,
          faculty_id: student.faculty_id,
          session_id: sessionId,
          level: student.level,
          semester,
          total_units: totalUnits,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (regErr) throw new Error(regErr.message);

      const items = [
        ...carryovers.map((c) => ({
          registration_id: reg.id,
          course_id: c.course_id,
          is_carryover: true,
          is_locked: true,
          carryover_id: c.id,
        })),
        ...Array.from(selected).map((cid) => ({
          registration_id: reg.id,
          course_id: cid,
          is_carryover: false,
          is_locked: false,
        })),
      ];
      const { error: itemsErr } = await supabase.from("course_registration_items").insert(items);
      if (itemsErr) throw new Error(itemsErr.message);
    },
    onSuccess: () => {
      toast.success("Course registration submitted");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["my-regs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isInvalid = totalUnits < minUnits || totalUnits > maxUnits || !sessionId;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Course Registration</h2>
        <p className="text-sm text-muted-foreground">Carryovers are locked and must be retaken. Total units must be {minUnits}–{maxUnits}.</p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader><CardTitle className="text-base">Session &amp; Semester</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Session</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
              <SelectContent>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Semester</Label>
            <Select value={semester} onValueChange={(v) => setSemester(v as "First" | "Second")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="First">First Semester</SelectItem>
                <SelectItem value="Second">Second Semester</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {carryovers.length > 0 && (
        <Card className="tsu-shadow border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Carryovers (locked, must retake)</CardTitle>
            <CardDescription>{carryoverUnits} unit{carryoverUnits === 1 ? "" : "s"}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {carryovers.map((c) => {
                  const course = c.courses as { code?: string; title?: string; unit?: number } | null;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-medium">{course?.code}</TableCell>
                      <TableCell>{course?.title}</TableCell>
                      <TableCell className="text-center">{course?.unit}u</TableCell>
                      <TableCell><Badge variant="destructive">Locked</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="text-base">Available courses ({student?.level}L, {semester} Semester)</CardTitle>
          <CardDescription>Tick the courses you want to register.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-center">Unit</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {levelCourses.filter((c) => !lockedCourseIds.has(c.id)).map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => toggle(c.id)}>
                  <TableCell><Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} /></TableCell>
                  <TableCell className="font-mono font-medium">{c.code}</TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell className="text-center">{c.unit}</TableCell>
                  <TableCell><Badge variant="outline">{c.course_type}</Badge></TableCell>
                </TableRow>
              ))}
              {levelCourses.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No courses available for this semester yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className={`tsu-shadow sticky bottom-2 ${isInvalid ? "border-destructive" : "border-primary"}`}>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm">
            <p>Total units: <span className="font-bold text-lg">{totalUnits}</span> <span className="text-muted-foreground">/ {minUnits}–{maxUnits}</span></p>
            <p className="text-xs text-muted-foreground">Carryovers: {carryoverUnits} • Selected: {selectedUnits}</p>
          </div>
          <Button onClick={() => submitMut.mutate()} disabled={isInvalid || submitMut.isPending}>
            {submitMut.isPending ? "Submitting…" : "Submit Registration"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
