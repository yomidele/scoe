/** 
 * Academic Results Validation and Correction Engine
 * 
 * CORE RULES (NON-NEGOTIABLE):
 * - GPA = TotalGP ÷ ECU (Earned Credit Units)
 * - CGPA = CumulativeGP ÷ TECU (Total Earned Credit Units)
 * - GPA and CGPA must NEVER be manually entered - SYSTEM GENERATED ONLY
 * - ±0.01 tolerance for floating-point comparison
 */

import { computeGrade, effectiveTotal } from "./grading";

export const VALIDATION_TOLERANCE = 0.01;

/**
 * Grade Point value: A=5, B=4, C=3, D=2, E=1, F=0
 */
export function getGradePoint(score: number): number {
  const { point } = computeGrade(score);
  return point;
}

/**
 * Result record from database
 */
export interface DatabaseResult {
  id: string;
  student_id: string;
  course_id: string;
  session_id: string;
  level: number;
  semester: string;
  ca_score: number | string;
  exam_score: number | string;
  total_score?: number | string | null;
  courses: { unit: number } | null;
}

/**
 * Semester summary with all calculations
 */
export interface SemesterSummary {
  studentId: string;
  sessionId: string;
  level: number;
  semester: string;
  courses: Array<{
    courseId: string;
    code?: string;
    unit: number;
    caScore: number;
    examScore: number;
    total: number;
    gradePoint: number;
  }>;
  // Current semester totals
  ecu: number; // Earned Credit Units (sum of units for non-F grades)
  rcu: number; // Registered Credit Units (sum of all units)
  gp: number; // Total Grade Points this semester
  gpa: number; // GPA this semester (GP / ECU)
  // Cumulative (including all previous semesters)
  tecu: number; // Total Earned Credit Units
  trcu: number; // Total Registered Credit Units
  tgp: number; // Total Grade Points
  cgpa: number; // CGPA (TGP / TECU)
}

/**
 * Validation error report
 */
export interface ValidationError {
  studentId: string;
  errorType:
    | "GPA_MISMATCH"
    | "CGPA_MISMATCH"
    | "GP_INCONSISTENCY"
    | "ECU_INCONSISTENCY"
    | "RCU_MISMATCH"
    | "ZERO_UNITS"
    | "DATA_INCONSISTENCY";
  field: string;
  storedValue: number | null;
  computedValue: number;
  severity: "error" | "warning";
  corrected: boolean;
  message: string;
}

/**
 * Validation result with corrected data
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  correctedSummary?: SemesterSummary;
  stats: {
    totalRecordsChecked: number;
    errorCount: number;
    warningCount: number;
    correctedCount: number;
  };
}

/**
 * Calculate semester totals from raw course results
 * DOES NOT depend on any stored GPA/CGPA values
 */
export function calculateSemesterTotals(
  studentId: string,
  results: DatabaseResult[],
  allHistoricalResults: DatabaseResult[] = []
): SemesterSummary | null {
  if (results.length === 0) {
    return null;
  }

  // Use first result for session/level/semester info
  const ref = results[0];
  const sessionId = ref.session_id;
  const level = ref.level || 0;
  const semester = ref.semester || "";

  // Calculate CURRENT SEMESTER totals
  let ecu = 0; // Earned Credit Units (for GPA denominator)
  let rcu = 0; // Total registered units
  let gp = 0; // Grade Points this semester

  const courseDetails: SemesterSummary["courses"] = [];

  for (const r of results) {
    const unit = r.courses?.unit ?? 0;
    const caScore = Number(r.ca_score) || 0;
    const examScore = Number(r.exam_score) || 0;
    const total = effectiveTotal(r);
    const gradePoint = getGradePoint(total);

    rcu += unit;
    gp += gradePoint * unit;

    // ECU: only count non-F grades
    if (gradePoint > 0) {
      ecu += unit;
    }

    courseDetails.push({
      courseId: r.course_id,
      unit,
      caScore,
      examScore,
      total,
      gradePoint,
    });
  }

  const gpa = ecu > 0 ? gp / ecu : 0;

  // Calculate CUMULATIVE totals including ALL historical results
  let tecu = ecu; // Total Earned Credit Units
  let trcu = rcu; // Total Registered Credit Units
  let tgp = gp; // Total Grade Points

  // Add previous semesters' data
  for (const h of allHistoricalResults) {
    // Skip current semester (already counted)
    if (
      h.session_id === sessionId &&
      h.semester === semester &&
      results.find((r) => r.id === h.id)
    ) {
      continue;
    }

    const unit = h.courses?.unit ?? 0;
    const total = effectiveTotal(h);
    const gradePoint = getGradePoint(total);

    trcu += unit;
    tgp += gradePoint * unit;

    if (gradePoint > 0) {
      tecu += unit;
    }
  }

  const cgpa = tecu > 0 ? tgp / tecu : 0;

  return {
    studentId,
    sessionId,
    level,
    semester,
    courses: courseDetails,
    ecu,
    rcu,
    gp: Math.round(gp * 100) / 100,
    gpa: Math.round(gpa * 100) / 100,
    tecu,
    trcu,
    tgp: Math.round(tgp * 100) / 100,
    cgpa: Math.round(cgpa * 100) / 100,
  };
}

/**
 * Validate a single semester's calculations
 * Checks against ±0.01 tolerance
 */
export function validateSemester(
  current: SemesterSummary,
  stored: {
    gpa?: number | null;
    cgpa?: number | null;
    ecu?: number | null;
    gp?: number | null;
  } = {}
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate GPA (current semester only)
  if (
    stored.gpa !== undefined &&
    stored.gpa !== null &&
    Math.abs(stored.gpa - current.gpa) > VALIDATION_TOLERANCE
  ) {
    errors.push({
      studentId: current.studentId,
      errorType: "GPA_MISMATCH",
      field: "gpa",
      storedValue: stored.gpa,
      computedValue: current.gpa,
      severity: "error",
      corrected: true,
      message: `GPA mismatch: stored ${stored.gpa.toFixed(2)} vs computed ${current.gpa.toFixed(2)}`,
    });
  }

  // Validate CGPA (cumulative)
  if (
    stored.cgpa !== undefined &&
    stored.cgpa !== null &&
    Math.abs(stored.cgpa - current.cgpa) > VALIDATION_TOLERANCE
  ) {
    errors.push({
      studentId: current.studentId,
      errorType: "CGPA_MISMATCH",
      field: "cgpa",
      storedValue: stored.cgpa,
      computedValue: current.cgpa,
      severity: "error",
      corrected: true,
      message: `CGPA mismatch: stored ${stored.cgpa.toFixed(2)} vs computed ${current.cgpa.toFixed(2)}`,
    });
  }

  // Validate GP (sum of grade points)
  if (
    stored.gp !== undefined &&
    stored.gp !== null &&
    Math.abs(stored.gp - current.gp) > VALIDATION_TOLERANCE
  ) {
    errors.push({
      studentId: current.studentId,
      errorType: "GP_INCONSISTENCY",
      field: "gp",
      storedValue: stored.gp,
      computedValue: current.gp,
      severity: "error",
      corrected: true,
      message: `GP inconsistency: stored ${stored.gp.toFixed(2)} vs computed ${current.gp.toFixed(2)}`,
    });
  }

  // Validate ECU (earned credit units for GPA denominator)
  if (
    stored.ecu !== undefined &&
    stored.ecu !== null &&
    stored.ecu !== current.ecu
  ) {
    errors.push({
      studentId: current.studentId,
      errorType: "ECU_INCONSISTENCY",
      field: "ecu",
      storedValue: stored.ecu,
      computedValue: current.ecu,
      severity: "error",
      corrected: true,
      message: `ECU mismatch: stored ${stored.ecu} vs computed ${current.ecu}`,
    });
  }

  // Check for zero units (critical error)
  if (current.rcu === 0) {
    errors.push({
      studentId: current.studentId,
      errorType: "ZERO_UNITS",
      field: "rcu",
      storedValue: 0,
      computedValue: 0,
      severity: "error",
      corrected: false,
      message: "No courses found for this record",
    });
  }

  // Check for impossible GPA calculation
  if (current.ecu === 0 && current.rcu > 0) {
    errors.push({
      studentId: current.studentId,
      errorType: "DATA_INCONSISTENCY",
      field: "ecu",
      storedValue: current.ecu,
      computedValue: 0,
      severity: "warning",
      corrected: true,
      message: "All courses failed (F grade) - GPA is 0",
    });
  }

  return errors;
}

/**
 * BLOCK submission validation
 * Returns true if record is SAFE to save
 */
export function canSubmitResult(
  caScore: number,
  examScore: number,
  courseUnit: number
): {
  canSubmit: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate score ranges
  if (caScore < 0 || caScore > 40) {
    errors.push("CA score must be 0-40");
  }
  if (examScore < 0 || examScore > 70) {
    errors.push("Exam score must be 0-70");
  }

  // Validate unit
  if (courseUnit <= 0 || courseUnit > 10) {
    errors.push("Course unit must be 1-10");
  }

  return {
    canSubmit: errors.length === 0,
    errors,
  };
}

/**
 * Full validation and correction pipeline
 * Returns validated/corrected semester summary
 */
export function validateAndCorrect(
  currentResults: DatabaseResult[],
  allHistoricalResults: DatabaseResult[] = []
): ValidationResult {
  const stats = {
    totalRecordsChecked: currentResults.length,
    errorCount: 0,
    warningCount: 0,
    correctedCount: 0,
  };

  if (currentResults.length === 0) {
    return {
      isValid: true,
      errors: [],
      stats,
    };
  }

  // Calculate correct values from raw data
  const corrected = calculateSemesterTotals(
    currentResults[0].student_id,
    currentResults,
    allHistoricalResults
  );

  if (!corrected) {
    return {
      isValid: false,
      errors: [
        {
          studentId: currentResults[0].student_id,
          errorType: "DATA_INCONSISTENCY",
          field: "all",
          storedValue: null,
          computedValue: 0,
          severity: "error",
          corrected: false,
          message: "Unable to calculate semester totals",
        },
      ],
      stats,
    };
  }

  // Check for any validation issues
  // (Note: we don't have stored GPA/CGPA to compare against, so this is anticipatory)
  const validationErrors = validateSemester(corrected, {});

  stats.errorCount = validationErrors.filter((e) => e.severity === "error")
    .length;
  stats.warningCount = validationErrors.filter((e) => e.severity === "warning")
    .length;
  stats.correctedCount = validationErrors.filter((e) => e.corrected).length;

  return {
    isValid: validationErrors.length === 0,
    errors: validationErrors,
    correctedSummary: corrected,
    stats,
  };
}

/**
 * Generate human-readable error report
 */
export function generateErrorReport(result: ValidationResult): string {
  if (result.isValid && result.errors.length === 0) {
    return "✓ All records validated successfully";
  }

  let report = `VALIDATION REPORT\n`;
  report += `================\n`;
  report += `Records checked: ${result.stats.totalRecordsChecked}\n`;
  report += `Errors: ${result.stats.errorCount}\n`;
  report += `Warnings: ${result.stats.warningCount}\n`;
  report += `Corrected: ${result.stats.correctedCount}\n\n`;

  if (result.errors.length > 0) {
    report += `ISSUES DETECTED:\n`;
    report += `----------------\n`;
    for (const err of result.errors) {
      report += `[${err.severity.toUpperCase()}] ${err.errorType}\n`;
      report += `  Field: ${err.field}\n`;
      report += `  ${err.message}\n`;
      if (err.storedValue !== null) {
        report += `  Stored: ${err.storedValue} → Corrected: ${err.computedValue}\n`;
      }
      report += `\n`;
    }
  }

  if (result.correctedSummary) {
    report += `CORRECTED VALUES:\n`;
    report += `-----------------\n`;
    report += `GPA: ${result.correctedSummary.gpa.toFixed(2)} (${result.correctedSummary.ecu}/${result.correctedSummary.rcu} units)\n`;
    report += `CGPA: ${result.correctedSummary.cgpa.toFixed(2)} (${result.correctedSummary.tecu}/${result.correctedSummary.trcu} units)\n`;
  }

  return report;
}
