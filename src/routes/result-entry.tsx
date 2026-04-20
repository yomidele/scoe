import { createFileRoute } from "@tanstack/react-router";
import { ProtectedAdmin } from "@/components/ProtectedAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeGrade, effectiveTotal } from "@/lib/grading";
import { canSubmitResult } from "@/lib/validation";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/result-entry")({
  head: () => ({ meta: [{ title: "Result Entry — SCOE" }] }),
  component: () => <ProtectedAdmin><ResultEntryPage /></ProtectedAdmin>,
});

const LEVELS = [100, 200, 300, 400] as const;
const SEMESTERS = ["First", "Second"] as const;

interface ResultRecord {
  id: string;
  student_id: string;
  course_id: string;
  ca_score: number;
  exam_score: number;
  students: { matric_number: string; full_name: string } | null;
  courses: { code: string; title: string; unit: number } | null;
}

interface FormState {
  sessionId: string;
  semester: string;
  level: string;
  studentId: string;
  courseId: string;
  caScore: string;
  examScore: string;
}

function ResultEntryPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>({
    sessionId: "",
    semester: "First",
    level: "100",
    studentId: "",
    courseId: "",
    caScore: "",
    examScore: "",
  });

  // Queries - clean dependency arrays to prevent loops
  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_sessions")
        .select("*")
        .order("name", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("matric_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Derived state: current level students (MEMOIZED, not useState)
  const levelStudents = useMemo(() => {
    return students.filter((s) => s.level === Number(form.level));
  }, [students, form.level]);

  // Derived state: current level courses (MEMOIZED, not useState)
  const levelCourses = useMemo(() => {
    return courses.filter((c) => c.level === Number(form.level));
  }, [courses, form.level]);

  // Computed total: pure function, not useState
  const currentTotal = useMemo(() => {
    if (!form.caScore || !form.examScore) return null;
    const ca = Number(form.caScore) || 0;
    const exam = Number(form.examScore) || 0;
    return Math.min(ca + exam, 100);
  }, [form.caScore, form.examScore]);

  // Computed grade: derived from total
  const currentGrade = useMemo(() => {
    if (currentTotal === null) return null;
    return computeGrade(currentTotal);
  }, [currentTotal]);

  // Fetch existing results for this scope (triggered by form changes)
  const { data: results = [] } = useQuery({
    queryKey: ["results-entry", form.sessionId, form.semester, form.level],
    enabled: !!form.sessionId && !!form.level,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("results")
        .select(
          "id, student_id, course_id, ca_score, exam_score, students(matric_number, full_name), courses(code, title, unit)"
        )
        .eq("session_id", form.sessionId)
        .eq("semester", form.semester)
        .eq("level", Number(form.level));
      if (error) throw error;
      return (data ?? []) as unknown as ResultRecord[];
    },
  });

  // Validation state
  const selectedCourse = useMemo(() => {
    return levelCourses.find((c) => c.id === form.courseId);
  }, [levelCourses, form.courseId]);

  const formValidation = useMemo(() => {
    if (!form.caScore || !form.examScore || !selectedCourse) return null;
    const ca = Number(form.caScore);
    const exam = Number(form.examScore);
    return canSubmitResult(ca, exam, selectedCourse.unit);
  }, [form.caScore, form.examScore, selectedCourse]);

  // Callback: handle form field changes (no circular updates)
  const handleFormChange = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Mutation: insert result (only on explicit submit)
  const addResultMut = useMutation({
    mutationFn: async () => {
      if (!form.sessionId || !form.studentId || !form.courseId || form.caScore === "" || form.examScore === "") {
        throw new Error("Fill all fields");
      }

      const ca = Number(form.caScore);
      const exam = Number(form.examScore);

      if (ca < 0 || ca > 40 || exam < 0 || exam > 70) {
        throw new Error("CA: 0-40, Exam: 0-70");
      }

      // Check for duplicate
      const existing = results.find((r) => r.student_id === form.studentId && r.course_id === form.courseId);
      if (existing) {
        throw new Error("Result already exists for this student-course pair");
      }

      const { error } = await supabase.from("results").insert({
        session_id: form.sessionId,
        student_id: form.studentId,
        course_id: form.courseId,
        semester: form.semester,
        level: Number(form.level),
        ca_score: ca,
        exam_score: exam,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Result recorded");
      setForm((prev) => ({ ...prev, studentId: "", courseId: "", caScore: "", examScore: "" }));
      qc.invalidateQueries({ queryKey: ["results-entry"] });
      qc.invalidateQueries({ queryKey: ["results"] });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutation: update result
  const updateResultMut = useMutation({
    mutationFn: async (resultId: string) => {
      if (form.caScore === "" || form.examScore === "") {
        throw new Error("Fill all fields");
      }

      const ca = Number(form.caScore);
      const exam = Number(form.examScore);

      if (ca < 0 || ca > 40 || exam < 0 || exam > 70) {
        throw new Error("CA: 0-40, Exam: 0-70");
      }

      const { error } = await supabase
        .from("results")
        .update({ ca_score: ca, exam_score: exam })
        .eq("id", resultId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Result updated");
      setForm((prev) => ({ ...prev, studentId: "", courseId: "", caScore: "", examScore: "" }));
      qc.invalidateQueries({ queryKey: ["results-entry"] });
      qc.invalidateQueries({ queryKey: ["results"] });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutation: delete result
  const delResultMut = useMutation({
    mutationFn: async (resultId: string) => {
      const { error } = await supabase.from("results").delete().eq("id", resultId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Result deleted");
      qc.invalidateQueries({ queryKey: ["results-entry"] });
      qc.invalidateQueries({ queryKey: ["results"] });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Handle edit: load result into form
  const handleEdit = useCallback((result: ResultRecord) => {
    setForm({
      sessionId: form.sessionId,
      semester: form.semester,
      level: form.level,
      studentId: result.student_id,
      courseId: result.course_id,
      caScore: String(result.ca_score),
      examScore: String(result.exam_score),
    });
  }, [form.sessionId, form.semester, form.level]);

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const existing = results.find((r) => r.student_id === form.studentId && r.course_id === form.courseId);
    if (existing) {
      updateResultMut.mutate(existing.id);
    } else {
      addResultMut.mutate();
    }
  };

  console.log("ResultEntry render"); // DEBUG: confirm loop is gone

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Result Entry</h2>
        <p className="text-sm text-muted-foreground">Record CA and Exam scores for selected students and courses.</p>
      </div>

      <Card className="tsu-shadow">
        <CardHeader>
          <CardTitle className="text-base">Scope Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Session</Label>
            <Select value={form.sessionId} onValueChange={(value) => handleFormChange("sessionId", value)}>
              <SelectTrigger>
                <SelectValue placeholder={sessions.length ? "Select session" : "Create first"} />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Semester</Label>
            <Select value={form.semester} onValueChange={(value) => handleFormChange("semester", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEMESTERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Level</Label>
            <Select value={form.level} onValueChange={(value) => handleFormChange("level", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={String(l)}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!form.sessionId && (
        <Card className="tsu-shadow">
          <CardContent className="py-10 text-center text-muted-foreground">Select a session to start.</CardContent>
        </Card>
      )}

      {form.sessionId && (
        <>
          <Card className="tsu-shadow">
            <CardHeader>
              <CardTitle className="text-base">Enter Result</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-6">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Student</Label>
                  <Select value={form.studentId} onValueChange={(value) => handleFormChange("studentId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {levelStudents.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.matric_number} — {s.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label>Course</Label>
                  <Select value={form.courseId} onValueChange={(value) => handleFormChange("courseId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      {levelCourses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.code} — {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>CA (0-40)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="40"
                    step="0.5"
                    placeholder="CA"
                    value={form.caScore}
                    onChange={(e) => handleFormChange("caScore", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Exam (0-70)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="70"
                    step="0.5"
                    placeholder="Exam"
                    value={form.examScore}
                    onChange={(e) => handleFormChange("examScore", e.target.value)}
                  />
                </div>

                <div className="md:col-span-6">
                  <Button 
                    type="submit" 
                    disabled={
                      addResultMut.isPending || 
                      updateResultMut.isPending ||
                      (formValidation ? !formValidation.canSubmit : false)
                    } 
                    className="w-full md:w-auto"
                  >
                    {addResultMut.isPending || updateResultMut.isPending ? "Saving…" : "Save Score"}
                  </Button>
                </div>
              </form>

              {formValidation && !formValidation.canSubmit && (
                <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm">
                  <div className="flex gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive mb-1">Validation Errors:</p>
                      <ul className="list-disc list-inside text-destructive space-y-0.5">
                        {formValidation.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {currentTotal !== null && (
                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="font-medium">Total:</span>
                      <span className="ml-2 font-mono text-lg">{currentTotal}</span>
                    </div>
                    {currentGrade && (
                      <>
                        <div>
                          <span className="font-medium">Grade:</span>
                          <span className="ml-2 rounded-full bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
                            {currentGrade.grade}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Point Value:</span>
                          <span className="ml-2 font-mono">{currentGrade.point}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {selectedCourse && (
                    <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-900">
                      <div className="flex gap-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Contribution to GPA:</p>
                          <p>
                            This course will contribute <span className="font-mono">{currentGrade?.point || 0}</span> × <span className="font-mono">{selectedCourse.unit}</span> = 
                            <span className="font-mono font-medium ml-1">{((currentGrade?.point || 0) * selectedCourse.unit).toFixed(2)}</span> grade points
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {results.length > 0 && (
            <Card className="tsu-shadow">
              <CardHeader>
                <CardTitle className="text-base">
                  Recorded Results ({results.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Matric</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead className="text-center">CA</TableHead>
                        <TableHead className="text-center">Exam</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((r) => {
                        const total = effectiveTotal(r);
                        const g = computeGrade(total);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-xs">{r.students?.matric_number}</TableCell>
                            <TableCell className="text-sm">{r.students?.full_name}</TableCell>
                            <TableCell className="text-sm">{r.courses?.code}</TableCell>
                            <TableCell className="text-center text-sm">{r.ca_score}</TableCell>
                            <TableCell className="text-center text-sm">{r.exam_score}</TableCell>
                            <TableCell className="text-center font-medium text-sm">{total}</TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                  g.grade === "F" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
                                }`}
                              >
                                {g.grade}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(r)}
                                disabled={updateResultMut.isPending}
                                className="text-xs"
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm(`Delete result for ${r.students?.full_name}?`)) {
                                    delResultMut.mutate(r.id);
                                  }
                                }}
                                disabled={delResultMut.isPending}
                                className="ml-1 text-xs"
                              >
                                Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
