# Spreadsheet Generator - Validation Examples

## Configuration Validation Scenarios

### ✅ PASSING CONFIGURATIONS

#### Example 1: Basic Valid Config (100 Level, First Semester)
```typescript
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "FIRST",
  level: 100,
  academicSession: "2025/2026",
};

// Result: ✅ VALID
```

#### Example 2: 200 Level Second Semester
```typescript
const config = {
  department: "SOCIAL SCIENCE",
  program: "B.Sc",
  semester: "SECOND",
  level: 200,
  academicSession: "2024/2025",
};

// Result: ✅ VALID
```

#### Example 3: 300 Level, Longer Department Name
```typescript
const config = {
  department: "SOCIAL STUDIES EDUCATION AND DEVELOPMENT",
  program: "B.Sc",
  semester: "FIRST",
  level: 300,
  academicSession: "2023/2024",
};

// Result: ✅ VALID
```

#### Example 4: Management Department
```typescript
const config = {
  department: "MANAGEMENT SCIENCE",
  program: "B.Sc",
  semester: "SECOND",
  level: 400,
  academicSession: "2025/2026",
};

// Result: ✅ VALID
```

#### Example 5: Mixed Case Department (Auto-Uppercase)
```typescript
const config = {
  department: "SoCiAl StUdIeS Education", // Will be uppercased
  program: "B.Sc",
  semester: "FIRST",
  level: 100,
  academicSession: "2025/2026",
};

// Result: ✅ VALID
```

#### Example 6: Alternative Programs
```typescript
const config1 = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.A",  // Different program type
  semester: "FIRST",
  level: 100,
  academicSession: "2025/2026",
};

const config2 = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "HND",  // Different program type
  semester: "FIRST",
  level: 100,
  academicSession: "2025/2026",
};

// Result: ✅ BOTH VALID
```

---

### ❌ FAILING CONFIGURATIONS

#### Error 1: Missing Department
```typescript
const config = {
  department: "",  // Empty string
  program: "B.Sc",
  semester: "FIRST",
  level: 100,
  academicSession: "2025/2026",
};

// Error: "Department is required"
```

#### Error 2: Missing Program
```typescript
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "",  // Empty string
  semester: "FIRST",
  level: 100,
  academicSession: "2025/2026",
};

// Error: "Program type is required"
```

#### Error 3: Wrong Semester Format - Lowercase
```typescript
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "first",  // Wrong: should be FIRST
  level: 100,
  academicSession: "2025/2026",
};

// Error: "Semester must be FIRST or SECOND"
```

#### Error 4: Wrong Semester Format - Mixed Case
```typescript
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "First",  // Wrong: should be FIRST
  level: 100,
  academicSession: "2025/2026",
};

// Error: "Semester must be FIRST or SECOND"
```

#### Error 5: Invalid Semester Value
```typescript
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "Third",  // No third semester
  level: 100,
  academicSession: "2025/2026",
};

// Error: "Semester must be FIRST or SECOND"
```

#### Error 6: Missing Level
```typescript
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "FIRST",
  level: undefined,  // Missing
  academicSession: "2025/2026",
};

// Error: "Level must be one of: 100, 200, 300, 400"
```

#### Error 7: Invalid Level - String
```typescript
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "FIRST",
  level: "100",  // String instead of number
  academicSession: "2025/2026",
};

// Error: "Level must be one of: 100, 200, 300, 400"
```

#### Error 8: Invalid Level - 500
```typescript
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "FIRST",
  level: 500,  // Not valid
  academicSession: "2025/2026",
};

// Error: "Level must be one of: 100, 200, 300, 400"
```

#### Error 9: Invalid Level - 150
```typescript
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "FIRST",
  level: 150,  // Between valid levels
  academicSession: "2025/2026",
};

// Error: "Level must be one of: 100, 200, 300, 400"
```

#### Error 10: Missing Session
```typescript
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "FIRST",
  level: 100,
  academicSession: "",  // Empty
};

// Error: "Academic Session must be in format YYYY/YYYY (e.g., 2025/2026)"
```

#### Error 11: Session Format - Wrong Separator (Dash)
```typescript
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "FIRST",
  level: 100,
  academicSession: "2025-2026",  // Should use /
};

// Error: "Academic Session must be in format YYYY/YYYY (e.g., 2025/2026)"
```

#### Error 12: Session Format - Wrong Separator (Space)
```typescript
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "FIRST",
  level: 100,
  academicSession: "2025 2026",  // Should use /
};

// Error: "Academic Session must be in format YYYY/YYYY (e.g., 2025/2026)"
```

#### Error 13: Session Format - Two Digit Year
```typescript
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "FIRST",
  level: 100,
  academicSession: "25/26",  // Should be YYYY
};

// Error: "Academic Session must be in format YYYY/YYYY (e.g., 2025/2026)"
```

#### Error 14: Session Format - Only Year
```typescript
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "FIRST",
  level: 100,
  academicSession: "2025",  // Missing second year
};

// Error: "Academic Session must be in format YYYY/YYYY (e.g., 2025/2026)"
```

#### Error 15: Faculty Constraint - Engineering
```typescript
const config = {
  department: "ENGINEERING",
  program: "B.Sc",
  semester: "FIRST",
  level: 100,
  academicSession: "2025/2026",
};

// Error: "Only Social and Management Sciences is supported in current version"
```

#### Error 16: Faculty Constraint - Law
```typescript
const config = {
  department: "LAW",
  program: "LL.B",
  semester: "FIRST",
  level: 100,
  academicSession: "2025/2026",
};

// Error: "Only Social and Management Sciences is supported in current version"
```

#### Error 17: Faculty Constraint - Medicine
```typescript
const config = {
  department: "MEDICINE",
  program: "M.B.B.S",
  semester: "FIRST",
  level: 100,
  academicSession: "2025/2026",
};

// Error: "Only Social and Management Sciences is supported in current version"
```

#### Error 18: Multiple Errors at Once
```typescript
const config = {
  department: "ENGINEERING",  // Wrong faculty
  program: "",  // Empty
  semester: "first",  // Wrong format
  level: 500,  // Invalid level
  academicSession: "25/26",  // Wrong format
};

// Errors:
// 1. "Program type is required"
// 2. "Semester must be FIRST or SECOND"
// 3. "Level must be one of: 100, 200, 300, 400"
// 4. "Academic Session must be in format YYYY/YYYY (e.g., 2025/2026)"
// 5. "Only Social and Management Sciences is supported in current version"
```

---

## Calculation Validation Examples

### GPA Calculation

#### Scenario 1: All A's
```typescript
const courses = [
  { courseId: "1", courseCode: "POS 205", units: 3, grade: "A", gradePoint: 5 },
  { courseId: "2", courseCode: "EGC 201", units: 3, grade: "A", gradePoint: 5 },
];

const result = calculateCurrentSemester(courses);

// Expected:
// rcu: 6 (3 + 3)
// ecu: 6 (both passed)
// gp: 30 (5*3 + 5*3 = 15 + 15)
// gpa: 5.0 (30 ÷ 6 = 5.0)

// Actual matches ✅
```

#### Scenario 2: Mixed Grades
```typescript
const courses = [
  { courseId: "1", courseCode: "POS 205", units: 3, grade: "A", gradePoint: 5 },
  { courseId: "2", courseCode: "EGC 201", units: 3, grade: "B", gradePoint: 4 },
  { courseId: "3", courseCode: "PSY 101", units: 4, grade: "C", gradePoint: 3 },
];

const result = calculateCurrentSemester(courses);

// Expected:
// rcu: 10 (3 + 3 + 4)
// ecu: 10 (all passed)
// gp: 39 (5*3 + 4*3 + 3*4 = 15 + 12 + 12)
// gpa: 3.9 (39 ÷ 10 = 3.9)

// Actual matches ✅
```

#### Scenario 3: With Failed Course
```typescript
const courses = [
  { courseId: "1", courseCode: "POS 205", units: 3, grade: "A", gradePoint: 5 },
  { courseId: "2", courseCode: "EGC 201", units: 3, grade: "F", gradePoint: 0 },
  { courseId: "3", courseCode: "PSY 101", units: 4, grade: "B", gradePoint: 4 },
];

const result = calculateCurrentSemester(courses);

// Expected:
// rcu: 10 (3 + 3 + 4)
// ecu: 7 (excludes the 3 units from F grade)
// gp: 31 (5*3 + 0*3 + 4*4 = 15 + 0 + 16)
// gpa: 3.1 (31 ÷ 10 = 3.1)

// Note: GPA uses RCU (includes F) not ECU

// Actual matches ✅
```

#### Scenario 4: Single Course
```typescript
const courses = [
  { courseId: "1", courseCode: "POS 205", units: 3, grade: "B", gradePoint: 4 },
];

const result = calculateCurrentSemester(courses);

// Expected:
// rcu: 3
// ecu: 3
// gp: 12 (4 * 3)
// gpa: 4.0 (12 ÷ 3)

// Actual matches ✅
```

#### Scenario 5: No Courses
```typescript
const courses = [];

const result = calculateCurrentSemester(courses);

// Expected:
// rcu: 0
// ecu: 0
// gp: 0
// gpa: 0 (0 ÷ 0 = 0 via safeDivide)

// Actual matches ✅
```

### CGPA Calculation

#### Scenario 1: First Semester (No Previous)
```typescript
const current = {
  rcu: 10,
  ecu: 10,
  gp: 39,
  gpa: 3.9,
};

const previous = {
  trcu: 0,
  tecu: 0,
  tgp: 0,
  cgpa: 0,
};

const cumulative = calculateCumulative(current, previous);

// Expected:
// trcu: 10 (0 + 10)
// tecu: 10 (0 + 10)
// tgp: 39 (0 + 39)
// cgpa: 3.9 (39 ÷ 10)

// Actual matches ✅
```

#### Scenario 2: Returning Student
```typescript
const current = {
  rcu: 6,
  ecu: 6,
  gp: 27,
  gpa: 4.5,
};

const previous = {
  trcu: 10,
  tecu: 10,
  tgp: 39,
  cgpa: 3.9,
};

const cumulative = calculateCumulative(current, previous);

// Expected:
// trcu: 16 (10 + 6)
// tecu: 16 (10 + 6)
// tgp: 66 (39 + 27)
// cgpa: 4.125 → 4.13 (formatted to 2 decimals)

// Actual matches ✅
```

#### Scenario 3: Cumulative with Failed Course
```typescript
const current = {
  rcu: 10,
  ecu: 7,  // One course failed
  gp: 31,
  gpa: 3.1,
};

const previous = {
  trcu: 10,
  tecu: 10,
  tgp: 50,
  cgpa: 5.0,
};

const cumulative = calculateCumulative(current, previous);

// Expected:
// trcu: 20 (10 + 10)
// tecu: 17 (10 + 7)
// tgp: 81 (50 + 31)
// cgpa: 4.05 (81 ÷ 20 = 4.05)

// Note: CGPA uses total RCU (includes failed courses)

// Actual matches ✅
```

---

## Decimal Precision Examples

### Rounding to 2 Decimals

```typescript
// Cases where formatting matters:

safeDivide(10, 3)           // 3.333... → 3.33 ✅
safeDivide(10, 3, 0)        // 3.333... → 3.33 ✅
safeDivide(7, 2)            // 3.5 → 3.5 ✅
safeDivide(1, 3)            // 0.333... → 0.33 ✅
safeDivide(2, 3)            // 0.666... → 0.67 ✅
safeDivide(100, 3)          // 33.333... → 33.33 ✅

formatDecimal(3.14159)      // 3.14 ✅
formatDecimal(3.1)          // 3.1 ✅
formatDecimal(3)            // 3 ✅
formatDecimal(3.999)        // 4 ✅
```

---

## Edge Cases

### No Units
```typescript
const courses = [
  { courseId: "1", courseCode: "POS 205", units: 0, grade: "A", gradePoint: 5 },
];

const result = calculateCurrentSemester(courses);

// Expected:
// rcu: 0
// gpa: 0 (safeguarded against division by zero)
```

### All Failures
```typescript
const courses = [
  { courseId: "1", courseCode: "POS 205", units: 3, grade: "F", gradePoint: 0 },
  { courseId: "2", courseCode: "EGC 201", units: 3, grade: "F", gradePoint: 0 },
];

const result = calculateCurrentSemester(courses);

// Expected:
// rcu: 6 (includes failed units)
// ecu: 0 (no units earned)
// gp: 0
// gpa: 0 (0 ÷ 6)
```

### Very High Grade Points
```typescript
const courses = [
  { courseId: "1", courseCode: "POS 205", units: 6, grade: "A", gradePoint: 5 },
  { courseId: "2", courseCode: "EGC 201", units: 6, grade: "A", gradePoint: 5 },
];

const result = calculateCurrentSemester(courses);

// Expected:
// rcu: 12
// gp: 60 (5*6 + 5*6)
// gpa: 5.0 (60 ÷ 12 = 5.0)
```

---

## Integration Test Scenarios

### Full Workflow
```typescript
// 1. Define config
const config = {
  department: "SOCIAL STUDIES EDUCATION",
  program: "B.Sc",
  semester: "FIRST",
  level: 100,
  academicSession: "2025/2026",
};

// 2. Validate ✅
const validation = validateHeaderConfig(config);
assert(validation.isValid === true);

// 3. Calculate results ✅
const courses = [
  { courseId: "1", courseCode: "POS 205", units: 3, grade: "A", gradePoint: 5 },
];
const current = calculateCurrentSemester(courses);
assert(current.gpa === 5.0);

// 4. Generate spreadsheet ✅
const workbook = generateSpreadsheet({
  header: config,
  students: [{
    matricNumber: "00001234",
    studentName: "Test Student",
    courseGrades: { "POS 205": "A" },
    currentSemester: current,
    previousResults: { trcu: 0, tecu: 0, tgp: 0, cgpa: 0 },
    cumulative: current,
  }],
  courseList: [{ code: "POS 205", title: "Local Government", units: 3 }],
});

// 5. Export file ✅
exportToExcel(workbook, "SCOE_Results_2025-2026_FIRST_100L.xlsx");
```

---

## Validation Testing Script

```typescript
// Run all validation scenarios
function testAllValidations() {
  const testCases = [
    // Valid cases
    { config: validConfig1, shouldPass: true },
    { config: validConfig2, shouldPass: true },
    // Invalid cases
    { config: invalidSemester, shouldPass: false },
    { config: invalidLevel, shouldPass: false },
    { config: invalidSession, shouldPass: false },
    { config: invalidFaculty, shouldPass: false },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    const result = validateHeaderConfig(test.config);
    const isValid = result.isValid;
    
    if (isValid === test.shouldPass) {
      console.log(`✅ PASS: ${JSON.stringify(test.config)}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${JSON.stringify(test.config)}`);
      console.log(`  Expected: ${test.shouldPass}, Got: ${isValid}`);
      if (!isValid) console.log(`  Errors: ${result.errors.join(", ")}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
}

testAllValidations();
```

---

This document provides comprehensive validation scenarios for testing the spreadsheet generation system.
