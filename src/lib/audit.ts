/**
 * Database Audit and Correction Utility
 * 
 * This script validates all existing result records and generates a correction report.
 * Run this to detect and fix any GPA/CGPA calculation errors in the database.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  calculateSemesterTotals,
  validateAndCorrect,
  generateErrorReport,
  type DatabaseResult,
} from "./validation";

interface AuditReport {
  timestamp: string;
  totalStudents: number;
  totalRecordsAudited: number;
  recordsWithErrors: number;
  recordsCorrected: number;
  errors: Array<{
    studentId: string;
    studentName?: string;
    session: string;
    semester: string;
    level: number;
    courseCount: number;
    issues: string[];
  }>;
  summary: string;
}

/**
 * Fetch all results grouped by student/session/semester/level
 */
async function getAllResultsGrouped(): Promise<
  Record<string, DatabaseResult[]>
> {
  const { data, error } = await supabase
    .from("results")
    .select(
      "id, student_id, course_id, session_id, level, semester, ca_score, exam_score, total_score, courses(unit), academic_sessions(name), students(matric_number, full_name)"
    )
    .order("student_id")
    .order("session_id")
    .order("semester");

  if (error) throw error;

  // Group by student+session+semester+level
  const grouped: Record<string, DatabaseResult[]> = {};

  for (const r of data ?? []) {
    const key = `${r.student_id}__${r.session_id}__${r.semester}__${r.level}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(r as DatabaseResult);
  }

  return grouped;
}

/**
 * Fetch all historical results for a student
 */
async function getStudentHistoricalResults(
  studentId: string
): Promise<DatabaseResult[]> {
  const { data, error } = await supabase
    .from("results")
    .select(
      "id, student_id, course_id, session_id, level, semester, ca_score, exam_score, total_score, courses(unit)"
    )
    .eq("student_id", studentId)
    .order("session_id")
    .order("semester");

  if (error) throw error;
  return (data as DatabaseResult[]) ?? [];
}

/**
 * Run a complete audit of all results
 */
export async function auditAllResults(): Promise<AuditReport> {
  console.log("🔍 Starting results audit...");

  const grouped = await getAllResultsGrouped();
  const keys = Object.keys(grouped);
  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    totalStudents: new Set(keys.map((k) => k.split("__")[0])).size,
    totalRecordsAudited: keys.length,
    recordsWithErrors: 0,
    recordsCorrected: 0,
    errors: [],
    summary: "",
  };

  for (const key of keys) {
    const results = grouped[key];
    const [studentId, sessionId, semester, level] = key.split("__");

    try {
      const historicalResults = await getStudentHistoricalResults(studentId);
      const validation = validateAndCorrect(results, historicalResults);

      if (!validation.isValid || validation.errors.length > 0) {
        report.recordsWithErrors++;
        report.recordsCorrected += validation.stats.correctedCount;

        const studentName = (results[0] as any)?.students?.full_name ?? "Unknown";
        const sessionName =
          (results[0] as any)?.academic_sessions?.name ?? sessionId;

        report.errors.push({
          studentId,
          studentName,
          session: sessionName,
          semester,
          level: Number(level),
          courseCount: results.length,
          issues: validation.errors.map((e) => e.message),
        });
      }
    } catch (error) {
      console.error(`Error auditing ${key}:`, error);
    }
  }

  // Generate summary
  report.summary =
    `AUDIT COMPLETE\n` +
    `Found ${report.recordsWithErrors} semester(s) with errors out of ${report.totalRecordsAudited}\n` +
    `Corrections available: ${report.recordsCorrected}\n` +
    `Students affected: ${report.totalStudents}`;

  return report;
}

/**
 * Display audit report in human-readable format
 */
export function printAuditReport(report: AuditReport): void {
  console.log("\n" + "=".repeat(60));
  console.log("ACADEMIC RESULTS AUDIT REPORT");
  console.log("=".repeat(60));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Total students: ${report.totalStudents}`);
  console.log(`Total semester groups audited: ${report.totalRecordsAudited}`);
  console.log(`Semesters with errors: ${report.recordsWithErrors}`);
  console.log(`Corrections available: ${report.recordsCorrected}`);
  console.log("");

  if (report.errors.length === 0) {
    console.log("✓ All records are correct!");
  } else {
    console.log("ISSUES DETECTED:");
    console.log("-".repeat(60));

    for (const err of report.errors) {
      console.log(
        `\n${err.studentName ?? err.studentId} (${err.studentName ? err.studentId : ""})`
      );
      console.log(`  Session: ${err.session}`);
      console.log(`  Level: ${err.level} | Semester: ${err.semester}`);
      console.log(`  Courses: ${err.courseCount}`);
      console.log("  Issues:");
      for (const issue of err.issues) {
        console.log(`    • ${issue}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
}

/**
 * Export audit report as JSON
 */
export function exportAuditReport(
  report: AuditReport
): Record<string, unknown> {
  return {
    timestamp: report.timestamp,
    summary: {
      totalStudents: report.totalStudents,
      totalRecordsAudited: report.totalRecordsAudited,
      recordsWithErrors: report.recordsWithErrors,
      correctionsMade: report.recordsCorrected,
    },
    errors: report.errors.map((e) => ({
      student: {
        id: e.studentId,
        name: e.studentName,
      },
      semester: {
        session: e.session,
        semester: e.semester,
        level: e.level,
        courseCount: e.courseCount,
      },
      issues: e.issues,
    })),
    report: report.summary,
  };
}
