export interface GradeInfo {
  grade: string;
  point: number;
}

export function computeGrade(total: number): GradeInfo {
  if (total >= 70) return { grade: "A", point: 5 };
  if (total >= 60) return { grade: "B", point: 4 };
  if (total >= 50) return { grade: "C", point: 3 };
  if (total >= 45) return { grade: "D", point: 2 };
  if (total >= 40) return { grade: "E", point: 1 };
  return { grade: "F", point: 0 };
}

export interface ResultRow {
  ca: number;
  exam: number;
  unit: number;
  total?: number | null;
}

/** Returns the effective total score for a result: prefers explicit total_score, else ca+exam. */
export function effectiveTotal(r: { ca_score?: number | string | null; exam_score?: number | string | null; total_score?: number | string | null }): number {
  if (r.total_score !== null && r.total_score !== undefined && r.total_score !== "") {
    return Number(r.total_score);
  }
  return Number(r.ca_score ?? 0) + Number(r.exam_score ?? 0);
}

export function computeGPA(rows: ResultRow[]): number {
  if (rows.length === 0) return 0;
  let totalPoints = 0;
  let totalUnits = 0;
  for (const r of rows) {
    const total = Number(r.ca) + Number(r.exam);
    const { point } = computeGrade(total);
    totalPoints += point * r.unit;
    totalUnits += r.unit;
  }
  return totalUnits === 0 ? 0 : totalPoints / totalUnits;
}

export function classOfDegree(cgpa: number): string {
  if (cgpa >= 4.5) return "First Class";
  if (cgpa >= 3.5) return "Second Class Upper";
  if (cgpa >= 2.4) return "Second Class Lower";
  if (cgpa >= 1.5) return "Third Class";
  if (cgpa >= 1.0) return "Pass";
  return "Fail";
}
