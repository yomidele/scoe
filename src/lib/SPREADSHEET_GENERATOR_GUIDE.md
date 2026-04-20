# Results Spreadsheet Generation System

## Overview

This system enforces standardized academic result spreadsheet generation with strict header formatting, validation rules, and accurate GPA/CGPA calculations. Built to maintain institutional consistency and compliance with academic standards.

---

## Header System (STRICT COMPLIANCE)

### Fixed Header (IMMUTABLE)

The following lines appear at the top of every spreadsheet, centered, bold, and uppercase:

```
SHALOM COLLEGE OF EDUCATION PAMBULA MICHIKA
AN AFFILIATE OF TARABA STATE UNIVERSITY, JALINGO
FACULTY OF SOCIAL AND MANAGEMENT SCIENCES
```

**These lines CANNOT be modified or replaced dynamically.**

### Dynamic Header Section

Below the fixed header, the following information is inserted:

- **Department Name** (UPPERCASE) - e.g., "SOCIAL STUDIES EDUCATION"
- **Program Type** (UPPERCASE) - e.g., "B.Sc"
- **Academic Level** - e.g., "FIRST 100 LEVEL 2025/2026 ACADEMIC SESSION"

Format: `{SEMESTER} {LEVEL} LEVEL {SESSION} ACADEMIC SESSION`

### Header Formatting Rules

✅ **MUST**:
- Center-align all header text across full sheet width (merged cells)
- Apply bold formatting
- Use UPPERCASE
- Maintain proper spacing between sections
- Use font hierarchy (school name largest, details progressively smaller)

❌ **MUST NOT**:
- Change the fixed header lines
- Allow modifications to fixed header content
- Omit any required dynamic field
- Use lowercase or mixed case

---

## Validation Rules

### Required Fields (BLOCKING)

Do NOT generate results if any of these is missing:

1. **Department** - e.g., "Social Studies Education"
2. **Semester** - Must be "FIRST" or "SECOND"
3. **Level** - Must be one of: 100, 200, 300, 400
4. **Academic Session** - Must match format YYYY/YYYY

### Field Format Validation

| Field | Valid Format | Example | Invalid |
|-------|--------------|---------|---------|
| Semester | FIRST \| SECOND | FIRST | First, first, 1st |
| Level | 100, 200, 300, 400 | 200 | 2, Second, 200L |
| Session | YYYY/YYYY | 2025/2026 | 2025, 25/26, 2025-2026 |

### Validation Response

If validation fails, the system throws an error:

```
Error: Header validation failed:
- Department is required
- Level must be one of: 100, 200, 300, 400
- Academic Session must be in format YYYY/YYYY (e.g., 2025/2026)
```

---

## Demo Mode Constraint

### Current Limitation

Only **Social and Management Sciences** is supported in the current version.

### Enforcement

If any attempt is made to use a different faculty/department:

```
Error: Header validation failed:
- Only Social and Management Sciences is supported in current version
```

This is a hardcoded constraint that must be maintained until the system is explicitly extended.

---

## Spreadsheet Structure

### Column Organization

```
| STUDENT INFO | COURSE GRADES | CURRENT SEMESTER | PREVIOUS RESULTS | CUMULATIVE RESULTS |
```

#### A. Student Information (2 columns)
- **Matric No** - e.g., "00001234"
- **Student Name** - e.g., "Adekunle Taiwo"

#### B. Course Columns (Dynamic)
- One column per course
- Format: `CODE (units)` - e.g., "POS 205 (3u)"
- Value: Grade - e.g., "A", "B", "F"

#### C. Current Semester (4 columns)
- **RCU** - Registered Course Units
- **ECU** - Earned Course Units (excludes "F" grades)
- **GP** - Grade Points (sum of gradePoint × units)
- **GPA** - Grade Point Average (GP ÷ RCU)

#### D. Previous Results (4 columns)
- **TRCU (Prev)** - Total Registered Units (all previous semesters)
- **TECU (Prev)** - Total Earned Units (all previous semesters)
- **TGP (Prev)** - Total Grade Points (all previous semesters)
- **CGPA (Prev)** - Cumulative GPA (TGP ÷ TRCU)

If no previous semester: all values = 0

#### E. Cumulative Results (4 columns)
- **TRCU (Cum)** - Previous + Current
- **TECU (Cum)** - Previous + Current
- **TGP (Cum)** - Previous + Current
- **CGPA (Cum)** - Total GPA (TGP ÷ TRCU)

---

## Calculation Rules

### Grade Scale

```javascript
70-100: A (5 points)
60-69:  B (4 points)
50-59:  C (3 points)
45-49:  D (2 points)
40-44:  E (1 point)
<40:    F (0 points)
```

### GPA Calculation

```
GPA = (Sum of Grade Points × Units) ÷ Total Registered Units
GPA = GP ÷ RCU
```

### CGPA Calculation

```
CGPA = (Total Grade Points across all semesters) ÷ (Total Registered Units across all semesters)
CGPA = TGP ÷ TRCU
```

### Earned Units

ECU excludes courses with "F" grade:
```javascript
ECU = Sum of units where grade !== "F"
```

### Division by Zero Protection

All divisions are protected:
```javascript
if (denominator === 0) return 0
```

### Decimal Rounding

All GPA/CGPA values are rounded to 2 decimal places:
```javascript
value.toFixed(2)  // e.g., 3.567 → 3.57
```

---

## Edge Cases

### First Semester (No Previous Results)

```
Previous Results: TRCU=0, TECU=0, TGP=0, CGPA=0
Cumulative Results = Current Semester Results
```

### Subsequent Semesters

```
Cumulative = Previous + Current
Previous = Last semester's cumulative results
```

### No Courses

If a student has no courses for a semester:
```
RCU=0, ECU=0, GP=0, GPA=0
```

### All Fails

If all courses are "F":
```
ECU = 0 (no units earned)
CGPA still calculated, may be 0.00 if first semester
```

---

## File Output Format

### Excel Format (.xlsx)

- Professional spreadsheet application compatibility
- Merged cells for header organization
- Optimized column widths
- Automatic section grouping

### Filename Convention

```
SCOE_Results_{SESSION}_{SEMESTER}_{LEVEL}L.xlsx

Example:
SCOE_Results_2025-2026_FIRST_100L.xlsx
```

---

## Usage Example

### Basic Usage

```typescript
import {
  generateSpreadsheet,
  validateHeaderConfig,
  generateFilename,
  exportToExcel,
} from "@/lib/spreadsheet-generator";

// 1. Define header configuration
const headerConfig = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "FIRST" as const,
  level: 100,
  academicSession: "2025/2026",
};

// 2. Validate (optional, but recommended)
const validation = validateHeaderConfig(headerConfig);
if (!validation.isValid) {
  console.error(validation.errors);
  return;
}

// 3. Prepare student data
const studentsData = [
  {
    matricNumber: "00001234",
    studentName: "Adekunle Taiwo",
    courseGrades: { "POS 205": "A", "EGC 201": "B" },
    currentSemester: { rcu: 6, ecu: 6, gp: 27.0, gpa: 4.5 },
    previousResults: { trcu: 0, tecu: 0, tgp: 0, cgpa: 0 },
    cumulative: { trcu: 6, tecu: 6, tgp: 27.0, cgpa: 4.5 },
  },
];

// 4. Create course list
const courseList = [
  { code: "EGC 201", title: "Educational Psychology I", units: 3 },
  { code: "POS 205", title: "Local Government", units: 3 },
];

// 5. Generate workbook
const workbook = generateSpreadsheet({
  header: headerConfig,
  students: studentsData,
  courseList,
});

// 6. Export to file
const filename = generateFilename("2025/2026", "FIRST", 100);
exportToExcel(workbook, filename);
```

### With Calculation Helpers

```typescript
import {
  calculateCurrentSemester,
  calculatePreviousResults,
  calculateCumulative,
} from "@/lib/spreadsheet-generator";

// Define courses for current semester
const currentCourses = [
  { courseId: "1", courseCode: "POS 205", units: 3, grade: "A", gradePoint: 5 },
  { courseId: "2", courseCode: "EGC 201", units: 3, grade: "B", gradePoint: 4 },
];

// Define courses from previous semesters
const previousCourses = [
  { courseId: "3", courseCode: "PSY 101", units: 4, grade: "C", gradePoint: 3 },
];

// Calculate
const current = calculateCurrentSemester(currentCourses);
// { rcu: 6, ecu: 6, gp: 27, gpa: 4.5 }

const previous = calculatePreviousResults(previousCourses);
// { trcu: 4, tecu: 4, tgp: 12, cgpa: 3.0 }

const cumulative = calculateCumulative(current, previous);
// { trcu: 10, tecu: 10, tgp: 39, cgpa: 3.9 }
```

---

## API Reference

### Core Functions

#### `generateSpreadsheet(config: SpreadsheetConfig): XLSX.WorkBook`

Generates a standardized academic spreadsheet.

**Parameters:**
- `config.header` - Header configuration (required, validated)
- `config.students` - Array of student result data
- `config.courseList` - Array of courses

**Returns:** Excel workbook object

**Throws:** Error if header validation fails or data is invalid

---

#### `validateHeaderConfig(config: HeaderConfig): { isValid: boolean; errors: string[] }`

Validates header configuration against all rules.

**Parameters:**
- `config.department` - Required, non-empty string
- `config.program` - Required, non-empty string
- `config.semester` - Required, "FIRST" or "SECOND"
- `config.level` - Required, 100, 200, 300, or 400
- `config.academicSession` - Required, YYYY/YYYY format

**Returns:** Object with validation status and error list

---

#### `calculateCurrentSemester(courses: CourseResult[]): CurrentSemesterResult`

Calculates current semester statistics.

**Parameters:**
- `courses` - Array of course results

**Returns:**
```typescript
{
  rcu: number;      // Registered course units
  ecu: number;      // Earned course units
  gp: number;       // Grade points
  gpa: number;      // GPA (0-5.0)
}
```

---

#### `calculatePreviousResults(courses: CourseResult[]): PreviousResults`

Calculates cumulative previous semester statistics.

**Parameters:**
- `courses` - Array of previous course results

**Returns:**
```typescript
{
  trcu: number;     // Total registered units
  tecu: number;     // Total earned units
  tgp: number;      // Total grade points
  cgpa: number;     // CGPA (0-5.0)
}
```

---

#### `calculateCumulative(current, previous): CumulativeResult`

Calculates cumulative result combining current and previous.

**Parameters:**
- `current` - Result from `calculateCurrentSemester`
- `previous` - Result from `calculatePreviousResults`

**Returns:**
```typescript
{
  trcu: number;     // Total registered units
  tecu: number;     // Total earned units
  tgp: number;      // Total grade points
  cgpa: number;     // CGPA (0-5.0)
}
```

---

#### `safeDivide(numerator: number, denominator: number, fallback?: number): number`

Divides with zero-division protection.

**Parameters:**
- `numerator` - Dividend
- `denominator` - Divisor
- `fallback` - Value if denominator is 0 (default: 0)

**Returns:** Result rounded to 2 decimal places

---

#### `formatDecimal(value: number, fallback?: number): number`

Formats number to 2 decimal places.

**Parameters:**
- `value` - Number to format
- `fallback` - Value if input is invalid (default: 0)

**Returns:** Number with 2 decimal places

---

#### `generateFilename(sessionName: string, semester: string, level: number): string`

Generates standardized filename.

**Parameters:**
- `sessionName` - e.g., "2025/2026"
- `semester` - "FIRST" or "SECOND"
- `level` - 100, 200, 300, or 400

**Returns:** Filename - e.g., "SCOE_Results_2025-2026_FIRST_100L.xlsx"

---

#### `exportToExcel(workbook: XLSX.WorkBook, filename: string): void`

Exports workbook to Excel file.

**Parameters:**
- `workbook` - Generated workbook object
- `filename` - Output filename

---

## Error Handling

### Validation Errors

```typescript
try {
  const validation = validateHeaderConfig(headerConfig);
  if (!validation.isValid) {
    throw new Error(`Invalid header: ${validation.errors.join(", ")}`);
  }
} catch (error) {
  console.error(error.message);
  // Display user-friendly error message
  toast.error(`Configuration error: ${error.message}`);
}
```

### Export Errors

```typescript
try {
  const workbook = generateSpreadsheet(config);
  exportToExcel(workbook, filename);
} catch (error) {
  const msg = error instanceof Error ? error.message : "Unknown error";
  toast.error(`Export failed: ${msg}`);
}
```

---

## Future Extensions

### Planned Enhancements (Post-Demo)

1. **Faculty Selection** - Allow switching between faculties
2. **Department Customization** - Dynamic department selection from database
3. **Custom Formatting** - Cell colors, fonts, borders
4. **Multi-Semester Export** - Combine multiple semesters in one file
5. **Grade Scale Customization** - Different grading schemes
6. **Comments & Notes** - Add instructor remarks

### Extension Points

1. **Header Configuration** - Add faculty/department tables to database
2. **Course List** - Load from database instead of hardcoding
3. **Styling** - Use exceljs for advanced formatting
4. **Validation** - Add custom validation rules
5. **Calculations** - Add custom GPA formulas

---

## Compliance Checklist

- ✅ Fixed header never changes
- ✅ Dynamic header properly formatted
- ✅ All required fields validated
- ✅ Semester format enforced (FIRST/SECOND)
- ✅ Level format enforced (100, 200, 300, 400)
- ✅ Session format enforced (YYYY/YYYY)
- ✅ GPA calculation accurate
- ✅ CGPA calculation accurate
- ✅ Division by zero protected
- ✅ Decimal rounding to 2 places
- ✅ Earned units exclude F grades
- ✅ Demo mode constraint active
- ✅ Excel output format
- ✅ Standardized filename
- ✅ Proper cell merging
- ✅ Column width optimization

---

## Support & Troubleshooting

### Common Issues

**Q: "Only Social and Management Sciences is supported"**
A: The system is in demo mode. This constraint will be removed when department selection is implemented.

**Q: Division by zero errors**
A: All calculations use `safeDivide()`. If errors occur, report them with specific data.

**Q: Decimal rounding issues**
A: All GPA/CGPA values use `.toFixed(2)`. If precision matters, use `safeDivide()` directly.

**Q: Header formatting incorrect**
A: Ensure header config matches validation rules exactly (case-sensitive for FIRST/SECOND).

---

## References

- [Grade Scale Documentation](#grade-scale)
- [Calculation Rules](#calculation-rules)
- [API Reference](#api-reference)
- [Validation Rules](#validation-rules)
