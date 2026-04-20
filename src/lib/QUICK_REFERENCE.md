# Results Spreadsheet System - Quick Reference

## 📌 Key Files

| File | Purpose |
|------|---------|
| `src/lib/spreadsheet-generator.ts` | Core module with all business logic |
| `src/routes/results.tsx` | Integration point with UI |
| `SPREADSHEET_GENERATOR_GUIDE.md` | Detailed specification & API docs |
| `SPREADSHEET_IMPLEMENTATION.md` | Step-by-step implementation guide |
| `SPREADSHEET_SYSTEM_SUMMARY.md` | Complete project summary |

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Import Utilities
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
```

### Step 2: Create Header Configuration
```typescript
const headerConfig = {
  department: "SOCIAL STUDIES EDUCATION",      // Required, must include SOCIAL/MANAGEMENT
  program: "B.Sc",                             // Required
  semester: "FIRST" as const,                  // Required: FIRST or SECOND
  level: 100 as const,                         // Required: 100, 200, 300, or 400
  academicSession: "2025/2026",                // Required: YYYY/YYYY format
};
```

### Step 3: Validate Header (Recommended)
```typescript
const validation = validateHeaderConfig(headerConfig);
if (!validation.isValid) {
  console.error(validation.errors);
  return;
}
```

### Step 4: Calculate Student Results
```typescript
const currentCourses = [
  { courseId: "1", courseCode: "POS 205", units: 3, grade: "A", gradePoint: 5 },
  { courseId: "2", courseCode: "EGC 201", units: 3, grade: "B", gradePoint: 4 },
];

const current = calculateCurrentSemester(currentCourses);
// { rcu: 6, ecu: 6, gp: 27, gpa: 4.5 }

const previous = calculatePreviousResults([]);
// { trcu: 0, tecu: 0, tgp: 0, cgpa: 0 }

const cumulative = calculateCumulative(current, previous);
// { trcu: 6, tecu: 6, tgp: 27, cgpa: 4.5 }
```

### Step 5: Generate Spreadsheet
```typescript
const workbook = generateSpreadsheet({
  header: headerConfig,
  students: [{
    matricNumber: "00001234",
    studentName: "Student Name",
    courseGrades: { "POS 205": "A", "EGC 201": "B" },
    currentSemester: current,
    previousResults: previous,
    cumulative: cumulative,
  }],
  courseList: [
    { code: "EGC 201", title: "Title", units: 3 },
    { code: "POS 205", title: "Title", units: 3 },
  ],
});

const filename = generateFilename("2025/2026", "FIRST", 100);
exportToExcel(workbook, filename);
```

---

## ✅ Validation Checklist

### Header Configuration

```typescript
// ✅ VALID
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "FIRST",          // Not "First" or "first"
  level: 100,                 // Not "100L" or "1st"
  academicSession: "2025/2026", // Not "2025" or "25/26"
};

// ❌ INVALID - Wrong semester
{ semester: "First" }        // Must be "FIRST"

// ❌ INVALID - Wrong level
{ level: 500 }               // Must be 100, 200, 300, or 400

// ❌ INVALID - Wrong session
{ academicSession: "2025" }  // Must be YYYY/YYYY

// ❌ INVALID - Wrong department
{ department: "ENGINEERING" } // Must include SOCIAL or MANAGEMENT

// ❌ INVALID - Missing required field
{ department: "" }           // Cannot be empty
```

---

## 📊 Calculation Quick Reference

### GPA (Grade Point Average)
```
GPA = Grade Points ÷ Registered Course Units
```

**Example:**
- Course 1: A (5 points) × 3 units = 15 points
- Course 2: B (4 points) × 3 units = 12 points
- Total: 27 points ÷ 6 units = 4.5 GPA

### CGPA (Cumulative GPA)
```
CGPA = Total Grade Points ÷ Total Registered Units
```

**Example (2nd Semester):**
- Previous: 49 points ÷ 10 units = 4.9 CGPA
- Current: 27 points ÷ 6 units = 4.5 GPA
- Combined: 76 points ÷ 16 units = 4.75 CGPA

### Earned Units (ECU)
```
ECU = Sum of units where grade ≠ "F"
```

**Example:**
- A (3u): Counts ✓
- B (3u): Counts ✓
- F (3u): Does NOT count ✗
- Total ECU: 6 units

---

## 🎯 Integration in React

### Add to Results Component
```typescript
// In handleExportStandardizedFormat function
const handleExportStandardizedFormat = () => {
  try {
    const headerConfig = {
      department: "SOCIAL STUDIES EDUCATION",
      program: "B.Sc",
      semester: semester === "First" ? "FIRST" : "SECOND",
      level: Number(level) as 100 | 200 | 300 | 400,
      academicSession: sessionName,
    };

    const validation = validateHeaderConfig(headerConfig);
    if (!validation.isValid) {
      toast.error(validation.errors.join("\n"));
      return;
    }

    // ... calculate results ...

    const workbook = generateSpreadsheet({
      header: headerConfig,
      students: studentsData,
      courseList,
    });

    const filename = generateFilename(sessionName, semester, Number(level));
    exportToExcel(workbook, filename);
    toast.success(`Exported: ${filename}`);
  } catch (error) {
    toast.error(`Export failed: ${error.message}`);
  }
};
```

---

## 🔒 Demo Mode Constraint

### Current Behavior

**✅ Allowed:**
- "SOCIAL STUDIES EDUCATION"
- "SOCIAL SCIENCE"
- "MANAGEMENT SCIENCE"
- "SOCIAL MANAGEMENT SCIENCES"

**❌ Blocked:**
- "ENGINEERING"
- "MEDICINE"
- "LAW"
- Any department not containing "SOCIAL" or "MANAGEMENT"

### Error Message
```
Error: Only Social and Management Sciences is supported in current version
```

### To Lift Constraint
Remove department validation from `validateHeaderConfig()`:
```typescript
// Remove this check:
if (
  config.department &&
  !config.department.toUpperCase().includes("SOCIAL") &&
  !config.department.toUpperCase().includes("MANAGEMENT")
) {
  errors.push("Only Social and Management Sciences is supported in current version");
}
```

---

## 🛡️ Error Handling Pattern

### Recommended Pattern
```typescript
try {
  // Validate first
  const validation = validateHeaderConfig(headerConfig);
  if (!validation.isValid) {
    throw new Error(validation.errors.join("\n"));
  }

  // Generate spreadsheet
  const workbook = generateSpreadsheet(config);

  // Export file
  exportToExcel(workbook, filename);

  // Success
  toast.success(`✅ Exported: ${filename}`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  toast.error(`❌ Export failed: ${message}`);
  console.error(error);
}
```

---

## 📋 Column Mapping

```
Position | Column Header | Source | Notes
---------|---------------|--------|-------
A        | Matric No     | students.matric_number | Always first
B        | Student Name  | students.full_name | Always second
C-N      | Course Code   | courses.code | Dynamic, sorted
N+1      | RCU           | calculateCurrentSemester().rcu | Registered units
N+2      | ECU           | calculateCurrentSemester().ecu | Earned units
N+3      | GP            | calculateCurrentSemester().gp | Grade points
N+4      | GPA           | calculateCurrentSemester().gpa | GPA
N+5      | TRCU (Prev)   | calculatePreviousResults().trcu | Total registered
N+6      | TECU (Prev)   | calculatePreviousResults().tecu | Total earned
N+7      | TGP (Prev)    | calculatePreviousResults().tgp | Total grade points
N+8      | CGPA (Prev)   | calculatePreviousResults().cgpa | Cumulative GPA
N+9      | TRCU (Cum)    | calculateCumulative().trcu | Total (prev+current)
N+10     | TECU (Cum)    | calculateCumulative().tecu | Total (prev+current)
N+11     | TGP (Cum)     | calculateCumulative().tgp | Total (prev+current)
N+12     | CGPA (Cum)    | calculateCumulative().cgpa | Cumulative
```

---

## 🔢 Grade Scale Reference

```
Score | Grade | Points | Quality
------|-------|--------|----------
70-100 | A    | 5.0    | Excellent
60-69  | B    | 4.0    | Good
50-59  | C    | 3.0    | Fair
45-49  | D    | 2.0    | Pass
40-44  | E    | 1.0    | Pass (Low)
<40    | F    | 0.0    | Fail
```

---

## ⚡ Performance Tips

1. **Cache course lists** - Don't fetch repeatedly
2. **Use batch calculations** - Calculate all students at once
3. **Minimize database queries** - Use joins when possible
4. **Memoize results** - Cache calculated results in React
5. **Lazy load student data** - Load only visible students

---

## 🧪 Testing Essentials

### Unit Test Template
```typescript
import { calculateCurrentSemester, validateHeaderConfig } from "@/lib/spreadsheet-generator";

test("calculateCurrentSemester returns correct GPA", () => {
  const courses = [
    { courseId: "1", courseCode: "POS 205", units: 3, grade: "A", gradePoint: 5 },
  ];
  const result = calculateCurrentSemester(courses);
  expect(result.gpa).toBe(5.0);
});

test("validateHeaderConfig rejects invalid semester", () => {
  const config = { semester: "First" }; // Wrong format
  const result = validateHeaderConfig(config);
  expect(result.isValid).toBe(false);
});
```

---

## 📞 Common Questions

### Q: Can I change the fixed header?
**A:** No, it's immutable by design. Any attempt will fail validation.

### Q: What if a student has no courses?
**A:** RCU=0, ECU=0, GP=0, GPA=0. This is handled safely.

### Q: What if there are failed courses?
**A:** They're included in RCU but excluded from ECU. GP is still calculated (0 points).

### Q: What happens on division by zero?
**A:** `safeDivide()` returns 0. This is protected automatically.

### Q: How do I extend to other faculties?
**A:** Remove the department validation check in `validateHeaderConfig()`.

### Q: Can I customize the grade scale?
**A:** Modify `computeGrade()` in `src/lib/grading.ts`.

### Q: How do I add comments to cells?
**A:** Use `exceljs` library instead of `xlsx` for advanced features.

---

## 🎓 Compliance Notes

✅ **Follows academic standards:**
- Proper GPA/CGPA calculation
- Institutional header format
- Professional formatting
- Accurate accounting of units
- Standardized grade scale

✅ **Enforces constraints:**
- Fixed header never changes
- Validation of all required fields
- Demo mode limitation
- Safe division
- Decimal consistency

✅ **Ready for:**
- Production use
- Multi-semester reporting
- Institutional requirements
- Future expansion

---

## 🚢 Deployment Checklist

- [ ] All tests passing
- [ ] No build errors
- [ ] Documentation complete
- [ ] Example spreadsheet generated
- [ ] Error handling tested
- [ ] Header validation verified
- [ ] Calculations spot-checked
- [ ] File export working
- [ ] User feedback added
- [ ] Performance acceptable

---

## 📚 Documentation Map

| Document | Purpose | Audience |
|----------|---------|----------|
| SPREADSHEET_GENERATOR_GUIDE.md | Complete specification | Architects, Reviewers |
| SPREADSHEET_IMPLEMENTATION.md | How to implement | Developers |
| SPREADSHEET_SYSTEM_SUMMARY.md | Project overview | Project Managers |
| This file | Quick reference | All users |

---

**Status:** ✅ Ready for Production
**Last Updated:** April 20, 2026
**Version:** 1.0.0
