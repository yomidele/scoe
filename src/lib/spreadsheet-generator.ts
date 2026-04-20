import * as XLSX from "xlsx";

/**
 * Standardized academic spreadsheet generator for SCOE
 * Enforces strict header formatting and validates all required fields
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface HeaderConfig {
  department: string; // e.g., "SOCIAL STUDIES EDUCATION"
  program: string; // e.g., "B.Sc"
  semester: "FIRST" | "SECOND";
  level: 100 | 200 | 300 | 400;
  academicSession: string; // e.g., "2025/2026"
}

export interface StudentResultData {
  matricNumber: string;
  studentName: string;
  courseGrades: Record<string, string>; // courseCode -> grade
  currentSemester: {
    rcu: number; // Registered Course Units
    ecu: number; // Earned Course Units
    gp: number; // Grade Points
    gpa: number;
  };
  previousResults: {
    trcu: number;
    tecu: number;
    tgp: number;
    cgpa: number;
  };
  cumulative: {
    trcu: number;
    tecu: number;
    tgp: number;
    cgpa: number;
  };
}

export interface SpreadsheetConfig {
  header: HeaderConfig;
  students: StudentResultData[];
  courseList: Array<{ code: string; title: string; units: number }>;
}

// ============================================================================
// CONSTANTS & VALIDATION
// ============================================================================

// Fixed header (MUST NEVER CHANGE)
const FIXED_HEADER = [
  "SHALOM COLLEGE OF EDUCATION PAMBULA MICHIKA",
  "AN AFFILIATE OF TARABA STATE UNIVERSITY, JALINGO",
  "FACULTY OF SOCIAL AND MANAGEMENT SCIENCES",
];

// Demo mode constraint - only Social and Management Sciences supported
const SUPPORTED_FACULTY = "FACULTY OF SOCIAL AND MANAGEMENT SCIENCES";

// Semester format mapping
const SEMESTER_FORMAT: Record<"FIRST" | "SECOND", string> = {
  FIRST: "FIRST",
  SECOND: "SECOND",
};

// Level validation
const VALID_LEVELS = [100, 200, 300, 400] as const;

/**
 * Validates header configuration against strict rules
 */
export function validateHeaderConfig(config: HeaderConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate required fields
  if (!config.department || !config.department.trim()) {
    errors.push("Department is required");
  }

  if (!config.program || !config.program.trim()) {
    errors.push("Program type is required");
  }

  if (!config.semester || !["FIRST", "SECOND"].includes(config.semester)) {
    errors.push(
      "Semester must be FIRST or SECOND"
    );
  }

  if (!VALID_LEVELS.includes(config.level)) {
    errors.push("Level must be one of: 100, 200, 300, 400");
  }

  // Validate academic session format (YYYY/YYYY)
  const sessionRegex = /^\d{4}\/\d{4}$/;
  if (!config.academicSession || !sessionRegex.test(config.academicSession)) {
    errors.push(
      "Academic Session must be in format YYYY/YYYY (e.g., 2025/2026)"
    );
  }

  // Demo mode constraint: Only Social and Management Sciences
  if (
    config.department &&
    !config.department
      .toUpperCase()
      .includes("SOCIAL") &&
    !config.department
      .toUpperCase()
      .includes("MANAGEMENT")
  ) {
    errors.push(
      "Only Social and Management Sciences is supported in current version"
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Formats a number to 2 decimal places, handling division by zero
 */
export function formatDecimal(
  value: number,
  fallback: number = 0
): number {
  if (!Number.isFinite(value)) return fallback;
  return Number(value.toFixed(2));
}

/**
 * Divides with zero-division protection
 */
export function safeDivide(
  numerator: number,
  denominator: number,
  fallback: number = 0
): number {
  if (denominator === 0 || !Number.isFinite(denominator)) return fallback;
  const result = numerator / denominator;
  return formatDecimal(result, fallback);
}

// ============================================================================
// SPREADSHEET GENERATION
// ============================================================================

/**
 * Generates a standardized academic results spreadsheet
 * Throws error if header validation fails
 */
export function generateSpreadsheet(
  config: SpreadsheetConfig
): XLSX.WorkBook {
  // Validate header
  const validation = validateHeaderConfig(config.header);
  if (!validation.isValid) {
    throw new Error(`Header validation failed:\n${validation.errors.join("\n")}`);
  }

  if (config.students.length === 0) {
    throw new Error("No student data to generate spreadsheet");
  }

  if (config.courseList.length === 0) {
    throw new Error("No course list provided");
  }

  const wb = XLSX.utils.book_new();
  const ws = createResultSheet(config);

  XLSX.utils.book_append_sheet(
    wb,
    ws,
    `${config.header.level}L ${config.header.semester.charAt(0) + config.header.semester.slice(1).toLowerCase()} Sem`
  );

  return wb;
}

/**
 * Creates the main result sheet with header and data
 */
function createResultSheet(config: SpreadsheetConfig): XLSX.WorkSheet {
  const courseList = config.courseList.sort((a, b) =>
    a.code.localeCompare(b.code)
  );

  // Build header rows
  const headerRows = buildHeaderRows(config.header);

  // Column headers
  const studentInfoCols = ["Matric No", "Student Name"];
  const courseHeaders = courseList.map((c) => `${c.code} (${c.units}u)`);
  const currentHeaders = ["RCU", "ECU", "GP", "GPA"];
  const previousHeaders = ["TRCU (Prev)", "TECU (Prev)", "TGP (Prev)", "CGPA (Prev)"];
  const cumulativeHeaders = ["TRCU (Cum)", "TECU (Cum)", "TGP (Cum)", "CGPA (Cum)"];

  // Banner row for grouping
  const bannerRow = [
    ...studentInfoCols.map(() => ""),
    ...courseHeaders.map((_, i) =>
      i === 0 ? "COURSE GRADES" : ""
    ),
    ...currentHeaders.map((_, i) =>
      i === 0 ? "CURRENT SEMESTER" : ""
    ),
    ...previousHeaders.map((_, i) =>
      i === 0 ? "PREVIOUS RESULTS" : ""
    ),
    ...cumulativeHeaders.map((_, i) =>
      i === 0 ? "CUMULATIVE RESULTS" : ""
    ),
  ];

  // Column header row
  const headerRow = [
    ...studentInfoCols,
    ...courseHeaders,
    ...currentHeaders,
    ...previousHeaders,
    ...cumulativeHeaders,
  ];

  // Data rows
  const dataRows = config.students.map((student) => {
    const courseCells = courseList.map(
      (c) => student.courseGrades[c.code] ?? ""
    );

    return [
      student.matricNumber,
      student.studentName,
      ...courseCells,
      student.currentSemester.rcu,
      student.currentSemester.ecu,
      student.currentSemester.gp,
      student.currentSemester.gpa,
      student.previousResults.trcu,
      student.previousResults.tecu,
      student.previousResults.tgp,
      student.previousResults.cgpa,
      student.cumulative.trcu,
      student.cumulative.tecu,
      student.cumulative.tgp,
      student.cumulative.cgpa,
    ];
  });

  // Combine all rows
  const aoa = [
    ...headerRows,
    bannerRow,
    headerRow,
    ...dataRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Apply formatting
  formatSpreadsheet(
    ws,
    headerRows.length,
    studentInfoCols.length,
    courseHeaders.length,
    currentHeaders.length,
    previousHeaders.length,
    cumulativeHeaders.length
  );

  return ws;
}

/**
 * Builds the fixed + dynamic header rows
 */
function buildHeaderRows(header: HeaderConfig): string[][] {
  const headerRows: string[][] = [];

  // Fixed header - 3 lines, centered and bold
  FIXED_HEADER.forEach((line) => {
    headerRows.push([line]);
  });

  // Empty line for spacing
  headerRows.push([""]);

  // Dynamic header section
  const dynamicHeader = [
    header.department.toUpperCase(),
    header.program.toUpperCase(),
    `${header.semester} ${header.level} LEVEL ${header.academicSession} ACADEMIC SESSION`,
  ];

  dynamicHeader.forEach((line) => {
    headerRows.push([line]);
  });

  // Empty line before data
  headerRows.push([""]);

  return headerRows;
}

/**
 * Applies formatting to the worksheet (merges, styles, column widths)
 */
function formatSpreadsheet(
  ws: XLSX.WorkSheet,
  headerRowCount: number,
  studentColCount: number,
  courseColCount: number,
  currentColCount: number,
  prevColCount: number,
  cumColCount: number
): void {
  // Set column widths
  ws["!cols"] = [
    { wch: 22 }, // Matric No
    { wch: 28 }, // Student Name
    ...Array(courseColCount).fill({ wch: 12 }), // Course columns
    ...Array(currentColCount).fill({ wch: 10 }), // Current columns
    ...Array(prevColCount).fill({ wch: 12 }), // Previous columns
    ...Array(cumColCount).fill({ wch: 12 }), // Cumulative columns
  ];

  // Merge cells for fixed header (each line spans all columns)
  const totalCols =
    studentColCount +
    courseColCount +
    currentColCount +
    prevColCount +
    cumColCount;

  ws["!merges"] = [];

  // Merge fixed header lines
  for (let i = 0; i < 3; i++) {
    ws["!merges"]!.push({
      s: { r: i, c: 0 },
      e: { r: i, c: totalCols - 1 },
    });
  }

  // Merge dynamic header lines (starting after the 3 fixed lines + 1 empty line)
  const dynStart = 4;
  for (let i = 0; i < 3; i++) {
    ws["!merges"]!.push({
      s: { r: dynStart + i, c: 0 },
      e: { r: dynStart + i, c: totalCols - 1 },
    });
  }

  // Merge section headers in banner row
  const bannerRowIdx = headerRowCount - 1;
  const courseStart = studentColCount;
  const courseEnd = courseStart + courseColCount - 1;
  const currentStart = courseEnd + 1;
  const currentEnd = currentStart + currentColCount - 1;
  const prevStart = currentEnd + 1;
  const prevEnd = prevStart + prevColCount - 1;
  const cumStart = prevEnd + 1;
  const cumEnd = cumStart + cumColCount - 1;

  if (courseColCount > 1) {
    ws["!merges"]!.push({
      s: { r: bannerRowIdx, c: courseStart },
      e: { r: bannerRowIdx, c: courseEnd },
    });
  }

  ws["!merges"]!.push({
    s: { r: bannerRowIdx, c: currentStart },
    e: { r: bannerRowIdx, c: currentEnd },
  });

  ws["!merges"]!.push({
    s: { r: bannerRowIdx, c: prevStart },
    e: { r: bannerRowIdx, c: prevEnd },
  });

  ws["!merges"]!.push({
    s: { r: bannerRowIdx, c: cumStart },
    e: { r: bannerRowIdx, c: cumEnd },
  });

  // Apply styles (bold, center alignment)
  // Note: xlsx library has limited styling. For production, consider xlsx-style or exceljs
  // For now, we'll rely on the data structure to be clear
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

export interface CourseResult {
  courseId: string;
  courseCode: string;
  units: number;
  grade: string;
  gradePoint: number;
}

export interface StudentGradeCalculation {
  currentCourses: CourseResult[];
  previousCourses: CourseResult[];
}

/**
 * Calculates current semester GPA and RCU/ECU/GP
 */
export function calculateCurrentSemester(courses: CourseResult[]): {
  rcu: number;
  ecu: number;
  gp: number;
  gpa: number;
} {
  let rcu = 0;
  let ecu = 0;
  let gp = 0;

  for (const course of courses) {
    rcu += course.units;
    if (course.grade !== "F") {
      ecu += course.units;
    }
    gp += course.gradePoint * course.units;
  }

  const gpa = safeDivide(gp, rcu);

  return {
    rcu,
    ecu,
    gp: formatDecimal(gp),
    gpa,
  };
}

/**
 * Calculates previous semester totals
 */
export function calculatePreviousResults(courses: CourseResult[]): {
  trcu: number;
  tecu: number;
  tgp: number;
  cgpa: number;
} {
  if (courses.length === 0) {
    return { trcu: 0, tecu: 0, tgp: 0, cgpa: 0 };
  }

  let trcu = 0;
  let tecu = 0;
  let tgp = 0;

  for (const course of courses) {
    trcu += course.units;
    if (course.grade !== "F") {
      tecu += course.units;
    }
    tgp += course.gradePoint * course.units;
  }

  const cgpa = safeDivide(tgp, trcu);

  return {
    trcu,
    tecu,
    tgp: formatDecimal(tgp),
    cgpa,
  };
}

/**
 * Calculates cumulative results
 */
export function calculateCumulative(
  current: ReturnType<typeof calculateCurrentSemester>,
  previous: ReturnType<typeof calculatePreviousResults>
): {
  trcu: number;
  tecu: number;
  tgp: number;
  cgpa: number;
} {
  const trcu = previous.trcu + current.rcu;
  const tecu = previous.tecu + current.ecu;
  const tgp = previous.tgp + current.gp;

  const cgpa = safeDivide(tgp, trcu);

  return {
    trcu,
    tecu,
    tgp: formatDecimal(tgp),
    cgpa,
  };
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

/**
 * Exports workbook to file
 */
export function exportToExcel(
  workbook: XLSX.WorkBook,
  filename: string
): void {
  XLSX.writeFile(workbook, filename);
}

/**
 * Generates standardized filename
 */
export function generateFilename(
  sessionName: string,
  semester: string,
  level: number
): string {
  const cleanSession = sessionName.replace(/\//g, "-");
  return `SCOE_Results_${cleanSession}_${semester}_${level}L.xlsx`;
}
