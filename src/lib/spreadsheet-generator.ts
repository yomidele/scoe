import ExcelJS from "exceljs";
import scoeLogoUrl from "@/assets/scoe-logo.png";
import tsuLogoUrl from "@/assets/tsu-logo.png";

/**
 * Standardized academic spreadsheet generator for SCOE.
 * Uses ExcelJS to embed both college logos into the header,
 * matching the official institutional result-sheet layout.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface HeaderConfig {
  department: string;
  program: string;
  semester: "FIRST" | "SECOND";
  level: 100 | 200 | 300 | 400;
  academicSession: string;
}

export interface CourseCellData {
  score: number | null;
  grade: string | null;
}

export interface StudentResultData {
  matricNumber: string;
  studentName: string;
  courseGrades: Record<string, CourseCellData | string>;
  currentSemester: { rcu: number; ecu: number; gp: number; gpa: number };
  previousResults: { trcu: number; tecu: number; tgp: number; cgpa: number };
  cumulative: { trcu: number; tecu: number; tgp: number; cgpa: number };
}

export interface SpreadsheetConfig {
  header: HeaderConfig;
  students: StudentResultData[];
  courseList: Array<{ code: string; title: string; units: number }>;
}

// ============================================================================
// CONSTANTS & VALIDATION
// ============================================================================

const FIXED_HEADER = [
  "SHALOM COLLEGE OF EDUCATION PAMBULA MICHIKA",
  "AN AFFILIATE OF TARABA STATE UNIVERSITY, JALINGO",
  "FACULTY OF SOCIAL AND MANAGEMENT SCIENCES",
];

const VALID_LEVELS = [100, 200, 300, 400] as const;

export function validateHeaderConfig(config: HeaderConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!config.department?.trim()) errors.push("Department is required");
  if (!config.program?.trim()) errors.push("Program type is required");
  if (!["FIRST", "SECOND"].includes(config.semester)) errors.push("Semester must be FIRST or SECOND");
  if (!VALID_LEVELS.includes(config.level)) errors.push("Level must be one of: 100, 200, 300, 400");
  if (!/^\d{4}\/\d{4}$/.test(config.academicSession ?? "")) {
    errors.push("Academic Session must be in format YYYY/YYYY (e.g., 2025/2026)");
  }
  return { isValid: errors.length === 0, errors };
}

export function formatDecimal(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Number(value.toFixed(2));
}

export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (denominator === 0 || !Number.isFinite(denominator)) return fallback;
  return formatDecimal(numerator / denominator, fallback);
}

// ============================================================================
// LOGO LOADING
// ============================================================================

async function fetchLogoBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load logo: ${url}`);
  return res.arrayBuffer();
}

// ============================================================================
// SPREADSHEET GENERATION
// ============================================================================

export async function generateSpreadsheet(config: SpreadsheetConfig): Promise<ExcelJS.Workbook> {
  const validation = validateHeaderConfig(config.header);
  if (!validation.isValid) {
    throw new Error(`Header validation failed:\n${validation.errors.join("\n")}`);
  }
  if (config.students.length === 0) throw new Error("No student data to generate spreadsheet");
  if (config.courseList.length === 0) throw new Error("No course list provided");

  const wb = new ExcelJS.Workbook();
  wb.creator = "SCOE Pambula Michika";
  wb.created = new Date();

  const sheetName = `${config.header.level}L ${
    config.header.semester.charAt(0) + config.header.semester.slice(1).toLowerCase()
  } Sem`;
  const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 9 }] });

  const courseList = [...config.courseList].sort((a, b) => a.code.localeCompare(b.code));

  // Column structure
  const studentInfoCols = ["Matric No", "Student Name"];
  const currentHeaders = ["RCU", "ECU", "GP", "GPA"];
  const previousHeaders = ["TRCU (Prev)", "TECU (Prev)", "TGP (Prev)", "CGPA (Prev)"];
  const cumulativeHeaders = ["TRCU (Cum)", "TECU (Cum)", "TGP (Cum)", "CGPA (Cum)"];
  const totalCols =
    studentInfoCols.length +
    courseList.length +
    currentHeaders.length +
    previousHeaders.length +
    cumulativeHeaders.length;

  // ------------------------------------------------------------------
  // HEADER BLOCK (rows 1-6) — logos on both sides + centered title block
  // ------------------------------------------------------------------
  const headerLines = [
    ...FIXED_HEADER,
    config.header.department.toUpperCase(),
    config.header.program.toUpperCase(),
    `${config.header.semester} SEMESTER ${config.header.level} LEVEL ${config.header.academicSession} ACADEMIC SESSION`,
  ];

  // Reserve column 1 for left logo and last column for right logo; merge centered title across the rest
  for (let i = 0; i < headerLines.length; i++) {
    const row = ws.getRow(i + 1);
    row.height = 22;
    const cell = row.getCell(2);
    cell.value = headerLines[i];
    cell.font = { name: "Calibri", size: i < 3 ? 12 : 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    ws.mergeCells(i + 1, 2, i + 1, totalCols - 1);
  }

  // Embed logos (left in col 1, right in last col), spanning all 6 header rows
  try {
    const [leftBuf, rightBuf] = await Promise.all([
      fetchLogoBuffer(scoeLogoUrl),
      fetchLogoBuffer(tsuLogoUrl),
    ]);
    const leftId = wb.addImage({ buffer: leftBuf as ExcelJS.Buffer, extension: "png" });
    const rightId = wb.addImage({ buffer: rightBuf as ExcelJS.Buffer, extension: "png" });
    ws.addImage(leftId, {
      tl: { col: 0.1, row: 0.1 },
      ext: { width: 90, height: 110 },
      editAs: "oneCell",
    });
    ws.addImage(rightId, {
      tl: { col: totalCols - 1 + 0.1, row: 0.1 },
      ext: { width: 90, height: 110 },
      editAs: "oneCell",
    });
  } catch (err) {
    console.warn("[spreadsheet-generator] Logo embed skipped:", err);
  }

  // Spacer row
  ws.getRow(7).height = 6;

  // ------------------------------------------------------------------
  // SECTION BANNER + TWO-TIER COLUMN HEADER (rows 8, 9, 10)
  // ------------------------------------------------------------------
  const bannerRowIdx = 8;
  const codesRowIdx = 9;
  const unitsRowIdx = 10;

  const courseStart = studentInfoCols.length + 1; // 1-indexed
  const courseEnd = courseStart + courseList.length - 1;
  const currentStart = courseEnd + 1;
  const currentEnd = currentStart + currentHeaders.length - 1;
  const prevStart = currentEnd + 1;
  const prevEnd = prevStart + previousHeaders.length - 1;
  const cumStart = prevEnd + 1;
  const cumEnd = cumStart + cumulativeHeaders.length - 1;

  // Banner row
  const bannerRow = ws.getRow(bannerRowIdx);
  bannerRow.height = 20;
  ws.mergeCells(bannerRowIdx, 1, unitsRowIdx, 1); // Matric No
  ws.mergeCells(bannerRowIdx, 2, unitsRowIdx, 2); // Student Name
  bannerRow.getCell(1).value = "Matric No";
  bannerRow.getCell(2).value = "Student Name";

  if (courseList.length > 0) {
    ws.mergeCells(bannerRowIdx, courseStart, bannerRowIdx, courseEnd);
    bannerRow.getCell(courseStart).value = "COURSE GRADES (Score|Grade)";
  }
  ws.mergeCells(bannerRowIdx, currentStart, bannerRowIdx, currentEnd);
  bannerRow.getCell(currentStart).value = "CURRENT SEMESTER";
  ws.mergeCells(bannerRowIdx, prevStart, bannerRowIdx, prevEnd);
  bannerRow.getCell(prevStart).value = "PREVIOUS RESULTS";
  ws.mergeCells(bannerRowIdx, cumStart, bannerRowIdx, cumEnd);
  bannerRow.getCell(cumStart).value = "CUMULATIVE RESULTS";

  // Course code (row 9) + units (row 10) for the course block; everything else stacks plain
  const codesRow = ws.getRow(codesRowIdx);
  const unitsRow = ws.getRow(unitsRowIdx);
  for (let i = 0; i < courseList.length; i++) {
    codesRow.getCell(courseStart + i).value = courseList[i].code;
    unitsRow.getCell(courseStart + i).value = courseList[i].units;
  }
  // For non-course sections, merge codes+units rows so the header block is a clean 3-row table
  for (let c = currentStart; c <= cumEnd; c++) {
    ws.mergeCells(codesRowIdx, c, unitsRowIdx, c);
  }
  const labels = [...currentHeaders, ...previousHeaders, ...cumulativeHeaders];
  for (let i = 0; i < labels.length; i++) {
    codesRow.getCell(currentStart + i).value = labels[i];
  }

  // Style banner + header rows
  for (const r of [bannerRowIdx, codesRowIdx, unitsRowIdx]) {
    const row = ws.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.font = { name: "Calibri", size: 10, bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8F0E5" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF999999" } },
        left: { style: "thin", color: { argb: "FF999999" } },
        bottom: { style: "thin", color: { argb: "FF999999" } },
        right: { style: "thin", color: { argb: "FF999999" } },
      };
    });
  }

  // ------------------------------------------------------------------
  // DATA ROWS (start at row 11)
  // ------------------------------------------------------------------
  const formatCell = (v: CourseCellData | string | undefined): string => {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (v.score === null || v.score === undefined || !v.grade) return "";
    return `${v.score}|${v.grade}`;
  };

  config.students.forEach((student, sIdx) => {
    const r = ws.getRow(unitsRowIdx + 1 + sIdx);
    r.getCell(1).value = student.matricNumber;
    r.getCell(2).value = student.studentName;
    courseList.forEach((c, ci) => {
      r.getCell(courseStart + ci).value = formatCell(student.courseGrades[c.code]);
    });
    r.getCell(currentStart).value = student.currentSemester.rcu;
    r.getCell(currentStart + 1).value = student.currentSemester.ecu;
    r.getCell(currentStart + 2).value = student.currentSemester.gp;
    r.getCell(currentStart + 3).value = student.currentSemester.gpa;
    r.getCell(prevStart).value = student.previousResults.trcu;
    r.getCell(prevStart + 1).value = student.previousResults.tecu;
    r.getCell(prevStart + 2).value = student.previousResults.tgp;
    r.getCell(prevStart + 3).value = student.previousResults.cgpa;
    r.getCell(cumStart).value = student.cumulative.trcu;
    r.getCell(cumStart + 1).value = student.cumulative.tecu;
    r.getCell(cumStart + 2).value = student.cumulative.tgp;
    r.getCell(cumStart + 3).value = student.cumulative.cgpa;

    r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: "Calibri", size: 10 };
      cell.alignment = {
        horizontal: colNumber <= 2 ? "left" : "center",
        vertical: "middle",
      };
      cell.border = {
        top: { style: "hair", color: { argb: "FFCCCCCC" } },
        left: { style: "hair", color: { argb: "FFCCCCCC" } },
        bottom: { style: "hair", color: { argb: "FFCCCCCC" } },
        right: { style: "hair", color: { argb: "FFCCCCCC" } },
      };
    });
  });

  // Column widths
  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 28;
  for (let i = 0; i < courseList.length; i++) ws.getColumn(courseStart + i).width = 12;
  for (let i = currentStart; i <= cumEnd; i++) ws.getColumn(i).width = 11;

  return wb;
}

// ============================================================================
// CALCULATIONS (unchanged)
// ============================================================================

export interface CourseResult {
  courseId: string;
  courseCode: string;
  units: number;
  grade: string;
  gradePoint: number;
}

export function calculateCurrentSemester(courses: CourseResult[]) {
  let rcu = 0, ecu = 0, gp = 0;
  for (const c of courses) {
    rcu += c.units;
    if (c.grade !== "F") ecu += c.units;
    gp += c.gradePoint * c.units;
  }
  return { rcu, ecu, gp: formatDecimal(gp), gpa: safeDivide(gp, rcu) };
}

export function calculatePreviousResults(courses: CourseResult[]) {
  if (courses.length === 0) return { trcu: 0, tecu: 0, tgp: 0, cgpa: 0 };
  let trcu = 0, tecu = 0, tgp = 0;
  for (const c of courses) {
    trcu += c.units;
    if (c.grade !== "F") tecu += c.units;
    tgp += c.gradePoint * c.units;
  }
  return { trcu, tecu, tgp: formatDecimal(tgp), cgpa: safeDivide(tgp, trcu) };
}

export function calculateCumulative(
  current: ReturnType<typeof calculateCurrentSemester>,
  previous: ReturnType<typeof calculatePreviousResults>
) {
  const trcu = previous.trcu + current.rcu;
  const tecu = previous.tecu + current.ecu;
  const tgp = previous.tgp + current.gp;
  return { trcu, tecu, tgp: formatDecimal(tgp), cgpa: safeDivide(tgp, trcu) };
}

// ============================================================================
// EXPORT
// ============================================================================

export async function exportToExcel(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateFilename(sessionName: string, semester: string, level: number): string {
  return `SCOE_Results_${sessionName.replace(/\//g, "-")}_${semester}_${level}L.xlsx`;
}
