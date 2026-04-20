# Spreadsheet Generator - Implementation Guide

## Quick Start

### 1. Import Required Functions

```typescript
import {
  generateSpreadsheet,
  validateHeaderConfig,
  calculateCurrentSemester,
  calculatePreviousResults,
  calculateCumulative,
  generateFilename,
  exportToExcel,
  safeDivide,
  formatDecimal,
} from "@/lib/spreadsheet-generator";
```

### 2. Define Header Configuration

```typescript
const headerConfig = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "FIRST" as const,  // FIRST or SECOND
  level: 100 as const,         // 100, 200, 300, or 400
  academicSession: "2025/2026", // YYYY/YYYY format
};
```

### 3. Validate Header

```typescript
const validation = validateHeaderConfig(headerConfig);
if (!validation.isValid) {
  validation.errors.forEach(error => console.error(error));
  return; // Stop processing
}
```

### 4. Calculate Student Results

```typescript
// For each student, determine their grades and units
const student1Courses = [
  {
    courseId: "course-1",
    courseCode: "POS 205",
    units: 3,
    grade: "A",
    gradePoint: 5,
  },
  {
    courseId: "course-2",
    courseCode: "EGC 201",
    units: 3,
    grade: "B",
    gradePoint: 4,
  },
];

// Calculate current semester
const current = calculateCurrentSemester(student1Courses);
// Result: { rcu: 6, ecu: 6, gp: 27, gpa: 4.5 }

// If there are previous courses (from other semesters)
const previousCourses = [
  {
    courseId: "course-3",
    courseCode: "PSY 101",
    units: 4,
    grade: "C",
    gradePoint: 3,
  },
];

const previous = calculatePreviousResults(previousCourses);
// Result: { trcu: 4, tecu: 4, tgp: 12, cgpa: 3.0 }

// Calculate cumulative
const cumulative = calculateCumulative(current, previous);
// Result: { trcu: 10, tecu: 10, tgp: 39, cgpa: 3.9 }
```

### 5. Build Student Data Array

```typescript
const studentsData = [
  {
    matricNumber: "00001234",
    studentName: "Adekunle Taiwo",
    courseGrades: {
      "POS 205": "A",
      "EGC 201": "B",
    },
    currentSemester: current,
    previousResults: previous,
    cumulative: cumulative,
  },
  // ... more students
];
```

### 6. Define Course List

```typescript
const courseList = [
  {
    code: "EGC 201",
    title: "Educational Psychology I",
    units: 3,
  },
  {
    code: "POS 205",
    title: "Local Government",
    units: 3,
  },
];
```

### 7. Generate Spreadsheet

```typescript
try {
  const workbook = generateSpreadsheet({
    header: headerConfig,
    students: studentsData,
    courseList: courseList,
  });

  const filename = generateFilename("2025/2026", "FIRST", 100);
  exportToExcel(workbook, filename);
  
  console.log(`✅ Exported: ${filename}`);
} catch (error) {
  console.error("Export failed:", error.message);
}
```

---

## Complete Real-World Example

```typescript
import {
  generateSpreadsheet,
  validateHeaderConfig,
  calculateCurrentSemester,
  calculatePreviousResults,
  calculateCumulative,
  generateFilename,
  exportToExcel,
} from "@/lib/spreadsheet-generator";

export async function exportStudentResults(
  sessionId: string,
  semester: "First" | "Second",
  level: number
) {
  // 1. VALIDATE HEADER
  const headerConfig = {
    department: "SOCIAL STUDIES EDUCATION",
    program: "B.Sc",
    semester: (semester === "First" ? "FIRST" : "SECOND") as const,
    level: level as 100 | 200 | 300 | 400,
    academicSession: "2025/2026", // In production, fetch from session
  };

  const validation = validateHeaderConfig(headerConfig);
  if (!validation.isValid) {
    throw new Error(validation.errors.join("\n"));
  }

  // 2. FETCH DATA FROM DATABASE
  const { data: results } = await supabase
    .from("results")
    .select(`
      *,
      students(matric_number, full_name),
      courses(code, title, unit)
    `)
    .eq("session_id", sessionId)
    .eq("semester", semester)
    .eq("level", level);

  if (!results || results.length === 0) {
    throw new Error("No results found for this scope");
  }

  // 3. FETCH STUDENT HISTORY FOR CGPA
  const studentIds = [...new Set(results.map(r => r.student_id))];
  
  const { data: allHistory } = await supabase
    .from("results")
    .select(`
      *,
      courses(code, title, unit)
    `)
    .in("student_id", studentIds);

  // 4. BUILD COURSE LIST
  const courseSet = new Map();
  results.forEach(r => {
    if (r.courses) {
      courseSet.set(r.course_id, {
        code: r.courses.code,
        title: r.courses.title,
        units: r.courses.unit,
      });
    }
  });

  const courseList = Array.from(courseSet.values())
    .sort((a, b) => a.code.localeCompare(b.code));

  // 5. BUILD STUDENT DATA
  const studentMap = new Map();
  
  // Group current results by student
  results.forEach(r => {
    if (!studentMap.has(r.student_id)) {
      studentMap.set(r.student_id, {
        matric: r.students.matric_number,
        name: r.students.full_name,
        courses: [],
      });
    }
    
    const { grade, point } = computeGrade(effectiveTotal(r));
    studentMap.get(r.student_id).courses.push({
      courseId: r.course_id,
      courseCode: r.courses.code,
      units: r.courses.unit,
      grade,
      gradePoint: point,
    });
  });

  const studentsData = Array.from(studentMap.entries()).map(([sid, info]) => {
    // Current semester
    const currentCourses = info.courses;
    const current = calculateCurrentSemester(currentCourses);

    // Previous semesters
    const previousResults = (allHistory || [])
      .filter(r => r.student_id === sid && !currentCourses.find(c => c.courseId === r.course_id))
      .map(r => {
        const { grade, point } = computeGrade(effectiveTotal(r));
        return {
          courseId: r.course_id,
          courseCode: r.courses.code,
          units: r.courses.unit,
          grade,
          gradePoint: point,
        };
      });

    const previous = calculatePreviousResults(previousResults);
    const cumulative = calculateCumulative(current, previous);

    // Course grades map
    const courseGrades = {};
    currentCourses.forEach(c => {
      courseGrades[c.courseCode] = c.grade;
    });

    return {
      matricNumber: info.matric,
      studentName: info.name,
      courseGrades,
      currentSemester: current,
      previousResults: previous,
      cumulative: cumulative,
    };
  });

  // 6. GENERATE AND EXPORT
  const workbook = generateSpreadsheet({
    header: headerConfig,
    students: studentsData,
    courseList,
  });

  const filename = generateFilename("2025/2026", semester, level);
  exportToExcel(workbook, filename);

  return { filename, studentCount: studentsData.length };
}
```

---

## Validation Examples

### Valid Configurations

```typescript
// ✅ VALID
const config1 = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "FIRST",
  level: 100,
  academicSession: "2025/2026",
};

// ✅ VALID
const config2 = {
  department: "SOCIAL SCIENCE",
  program: "B.Sc",
  semester: "SECOND",
  level: 300,
  academicSession: "2024/2025",
};
```

### Invalid Configurations

```typescript
// ❌ INVALID - Wrong semester format
const config1 = {
  department: "SOCIAL STUDIES",
  program: "B.Sc",
  semester: "First", // Should be "FIRST"
  level: 100,
  academicSession: "2025/2026",
};

// ❌ INVALID - Wrong level
const config2 = {
  department: "SOCIAL STUDIES",
  program: "B.Sc",
  semester: "FIRST",
  level: 500, // Must be 100, 200, 300, or 400
  academicSession: "2025/2026",
};

// ❌ INVALID - Wrong session format
const config3 = {
  department: "SOCIAL STUDIES",
  program: "B.Sc",
  semester: "FIRST",
  level: 100,
  academicSession: "25-26", // Must be YYYY/YYYY
};

// ❌ INVALID - Missing department (starts with different faculty)
const config4 = {
  department: "ENGINEERING",
  program: "B.Sc",
  semester: "FIRST",
  level: 100,
  academicSession: "2025/2026",
};
```

---

## Calculation Examples

### Example 1: First Semester Student

```typescript
// Student taking 3 courses in first semester
const courses = [
  { courseId: "1", courseCode: "POS 205", units: 3, grade: "A", gradePoint: 5 },
  { courseId: "2", courseCode: "EGC 201", units: 3, grade: "B", gradePoint: 4 },
  { courseId: "3", courseCode: "PSY 101", units: 4, grade: "C", gradePoint: 3 },
];

const current = calculateCurrentSemester(courses);
/*
  rcu: 10  (3 + 3 + 4)
  ecu: 10  (all passed)
  gp: 49   (5*3 + 4*3 + 3*4 = 15 + 12 + 12)
  gpa: 4.9 (49 ÷ 10 = 4.9)
*/

const previous = calculatePreviousResults([]);
/*
  trcu: 0
  tecu: 0
  tgp: 0
  cgpa: 0
*/

const cumulative = calculateCumulative(current, previous);
/*
  trcu: 10
  tecu: 10
  tgp: 49
  cgpa: 4.9
*/
```

### Example 2: Returning Student

```typescript
// Previous results from first semester
const previousCourses = [
  { courseId: "1", courseCode: "POS 205", units: 3, grade: "A", gradePoint: 5 },
  { courseId: "2", courseCode: "EGC 201", units: 3, grade: "B", gradePoint: 4 },
  { courseId: "3", courseCode: "PSY 101", units: 4, grade: "C", gradePoint: 3 },
];

const previous = calculatePreviousResults(previousCourses);
/*
  trcu: 10
  tecu: 10
  tgp: 49
  cgpa: 4.9
*/

// Current semester results
const currentCourses = [
  { courseId: "4", courseCode: "POS 206", units: 3, grade: "B", gradePoint: 4 },
  { courseId: "5", courseCode: "EGC 202", units: 3, grade: "A", gradePoint: 5 },
];

const current = calculateCurrentSemester(currentCourses);
/*
  rcu: 6
  ecu: 6
  gp: 27  (4*3 + 5*3 = 12 + 15)
  gpa: 4.5 (27 ÷ 6 = 4.5)
*/

const cumulative = calculateCumulative(current, previous);
/*
  trcu: 16 (10 + 6)
  tecu: 16 (10 + 6)
  tgp: 76  (49 + 27)
  cgpa: 4.75 (76 ÷ 16 = 4.75)
*/
```

### Example 3: Student with Failed Courses

```typescript
const courses = [
  { courseId: "1", courseCode: "POS 205", units: 3, grade: "A", gradePoint: 5 },
  { courseId: "2", courseCode: "EGC 201", units: 3, grade: "F", gradePoint: 0 }, // Failed!
  { courseId: "3", courseCode: "PSY 101", units: 4, grade: "B", gradePoint: 4 },
];

const result = calculateCurrentSemester(courses);
/*
  rcu: 10  (3 + 3 + 4)
  ecu: 7   (3 + 4, excluding the 3 units from F grade)
  gp: 31   (5*3 + 0*3 + 4*4 = 15 + 0 + 16)
  gpa: 3.1 (31 ÷ 10 = 3.1)
*/
```

---

## Error Handling

### Graceful Validation

```typescript
function tryGenerateSpreadsheet(headerConfig, students, courseList) {
  // Validate first
  const validation = validateHeaderConfig(headerConfig);
  
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.errors.join("\n"),
      data: null,
    };
  }

  try {
    const workbook = generateSpreadsheet({
      header: headerConfig,
      students,
      courseList,
    });

    return {
      success: true,
      error: null,
      data: workbook,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: null,
    };
  }
}
```

### User-Friendly Error Display

```typescript
export function exportResults(config, students, courseList) {
  const result = tryGenerateSpreadsheet(config, students, courseList);

  if (!result.success) {
    // Parse errors for user display
    const errorLines = result.error.split("\n");
    
    if (errorLines.length === 1) {
      toast.error(result.error);
    } else {
      toast.error("Configuration errors:");
      errorLines.forEach(line => console.error("  - " + line));
    }
    
    return;
  }

  const filename = generateFilename(
    config.academicSession,
    config.semester,
    config.level
  );
  
  exportToExcel(result.data, filename);
  toast.success(`✅ Exported: ${filename}`);
}
```

---

## Testing

### Unit Test Example

```typescript
import { describe, it, expect } from "vitest";
import {
  calculateCurrentSemester,
  safeDivide,
  formatDecimal,
  validateHeaderConfig,
} from "@/lib/spreadsheet-generator";

describe("Spreadsheet Generator", () => {
  describe("calculateCurrentSemester", () => {
    it("calculates GPA correctly", () => {
      const courses = [
        { courseId: "1", courseCode: "POS 205", units: 3, grade: "A", gradePoint: 5 },
        { courseId: "2", courseCode: "EGC 201", units: 3, grade: "B", gradePoint: 4 },
      ];

      const result = calculateCurrentSemester(courses);
      
      expect(result.rcu).toBe(6);
      expect(result.ecu).toBe(6);
      expect(result.gp).toBe(27);
      expect(result.gpa).toBe(4.5);
    });

    it("excludes F grades from ECU", () => {
      const courses = [
        { courseId: "1", courseCode: "POS 205", units: 3, grade: "A", gradePoint: 5 },
        { courseId: "2", courseCode: "EGC 201", units: 3, grade: "F", gradePoint: 0 },
      ];

      const result = calculateCurrentSemester(courses);
      
      expect(result.rcu).toBe(6);
      expect(result.ecu).toBe(3); // Excludes failed course
      expect(result.gp).toBe(15);
      expect(result.gpa).toBe(2.5);
    });
  });

  describe("validateHeaderConfig", () => {
    it("validates correct config", () => {
      const config = {
        department: "SOCIAL STUDIES EDUCATION",
        program: "B.Sc",
        semester: "FIRST",
        level: 100,
        academicSession: "2025/2026",
      };

      const result = validateHeaderConfig(config);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects invalid semester", () => {
      const config = {
        department: "SOCIAL STUDIES",
        program: "B.Sc",
        semester: "First", // Wrong format
        level: 100,
        academicSession: "2025/2026",
      };

      const result = validateHeaderConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Semester must be FIRST or SECOND");
    });
  });

  describe("safeDivide", () => {
    it("divides correctly", () => {
      expect(safeDivide(10, 2)).toBe(5);
    });

    it("returns fallback on division by zero", () => {
      expect(safeDivide(10, 0)).toBe(0);
      expect(safeDivide(10, 0, -1)).toBe(-1);
    });

    it("formats to 2 decimals", () => {
      expect(safeDivide(10, 3)).toBe(3.33);
    });
  });
});
```

---

## Integration with React

### React Hook Example

```typescript
export function useResultsExport() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportResults = useCallback(
    async (headerConfig, students, courseList) => {
      setIsLoading(true);
      setError(null);

      try {
        const validation = validateHeaderConfig(headerConfig);
        if (!validation.isValid) {
          throw new Error(validation.errors.join("\n"));
        }

        const workbook = generateSpreadsheet({
          header: headerConfig,
          students,
          courseList,
        });

        const filename = generateFilename(
          headerConfig.academicSession,
          headerConfig.semester,
          headerConfig.level
        );

        exportToExcel(workbook, filename);

        return { success: true, filename };
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { exportResults, isLoading, error };
}
```

---

## Best Practices

1. **Always validate** before generating spreadsheets
2. **Handle errors gracefully** with try-catch blocks
3. **Use safeDivide()** for all division operations
4. **Format decimals** consistently with formatDecimal()
5. **Sort courses** by code for consistency
6. **Group students** by matric number
7. **Test edge cases** (zero units, all F grades, etc.)
8. **Log generation** for audit trails
9. **Version filename** with session/semester/level
10. **Provide user feedback** on export status

---

## Common Patterns

### Pattern 1: Simple Export

```typescript
// Minimal setup for quick export
async function quickExport(sessionId, semester, level) {
  const headerConfig = {
    department: "SOCIAL STUDIES EDUCATION",
    program: "B.Sc",
    semester: semester === "First" ? "FIRST" : "SECOND",
    level: level,
    academicSession: "2025/2026",
  };

  // ... fetch and calculate ...

  generateSpreadsheet({ header: headerConfig, students, courseList });
}
```

### Pattern 2: With Caching

```typescript
// Cache generated spreadsheets to avoid regeneration
const exportCache = new Map();

function cachedExport(key, headerConfig, students, courseList) {
  if (exportCache.has(key)) {
    return exportCache.get(key);
  }

  const workbook = generateSpreadsheet({
    header: headerConfig,
    students,
    courseList,
  });

  exportCache.set(key, workbook);
  return workbook;
}
```

### Pattern 3: Batch Processing

```typescript
// Export multiple levels/semesters
async function batchExport(sessionId) {
  const results = [];

  for (const level of [100, 200, 300, 400]) {
    for (const semester of ["First", "Second"]) {
      try {
        const result = await exportSingleResult(sessionId, semester, level);
        results.push(result);
      } catch (error) {
        console.error(`Failed for ${semester} ${level}L:`, error);
      }
    }
  }

  return results;
}
```

---

## Troubleshooting

### Issue: "Header validation failed"
**Solution:** Check that semester is "FIRST" or "SECOND" (uppercase), level is valid, and session is YYYY/YYYY format.

### Issue: Division by zero warnings
**Solution:** Use `safeDivide()` instead of `/` operator.

### Issue: Decimal precision incorrect
**Solution:** Use `formatDecimal()` or ensure `safeDivide()` is used (it auto-formats).

### Issue: Demo mode constraint error
**Solution:** Department must include "SOCIAL" or "MANAGEMENT" in name.

---

This guide provides comprehensive documentation for integrating the spreadsheet generator into your application.
