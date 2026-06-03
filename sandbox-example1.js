// ===========================
// CONFIGURATION
// ===========================

const CONFIG = {
  MAIN_SHEET_NAME: 'Grade Inputs',
  MASTER_SUMMARY_NAME: 'Student Final Grades',
  TRANSFER_DELAY_MINUTES: 3,

  COLS: {
    TIMESTAMP: 1,
    EVALUATOR: 2,
    GROUP_NAME: 3,
    DATE: 4,
    FIRST_GRADE: 5,       // Column E (1.1 Overview/BLUF)
    LAST_GROUP_GRADE: 17, // Column Q (4.3 Synergy + Q&A)
    FIRST_STUDENT: 18,    // Column R (Select Student Name - Student 1)
  },

  // Grade conversion: 1-8 scale to percentages
  GRADE_TO_PERCENT: {
    1: 100, 2: 95, 3: 90, 4: 85, 5: 80, 6: 75, 7: 70, 8: 69
  },

  // Weights for each grading category (columns E through Q). Must sum to 80.
  WEIGHTS: [
    1,  // 1.1 Overview/BLUF
    2,  // 1.2 Background & Chronology
    2,  // 1.3 Test Objectives / Limitations
    5,  // 1.4 Test Item Description
    5,  // 2.1 Procedure
    15, // 2.2 Results, Analyses, Evaluation
    5,  // 2.3 Statistical Rigor
    15, // 2.4 Data Presentation
    5,  // 2.5 Mission Suitability
    5,  // 3.1 Key Results
    5,  // 3.2 C&R Restated
    10, // 4.2 Production Quality
    5   // 4.3 Synergy + Q&A
  ],

  INDIVIDUAL_WEIGHT: 20, // Must sum with group weights to 100

  GRADE_LABELS: [
    "1 - Well Above Average",
    "2 - Above Average",
    "3 - Slightly Above Average",
    "4 - Average",
    "5 - Slightly Below Average",
    "6 - Below Average",
    "7 - Well Below Average",
    "8 - Fail"
  ]
};

// ===========================
// MAIN MENU
// ===========================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Grade Processing')
    .addItem('Process Grades Now', 'manualProcessGrades')
    .addItem('Setup Data Validation', 'setupDataValidation')
    .addItem('Setup Auto-Run Triggers', 'setupTriggers')
    .addToUi();
}

// ===========================
// TRIGGER SETUP
// ===========================

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('autoProcessGrades')
    .timeBased()
    .everyMinutes(1)
    .create();

  ScriptApp.newTrigger('onEditProcessGrades')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert(
    'Triggers set up successfully!\n\n- Time-based: Every 60 seconds\n- On Edit: After each spreadsheet edit'
  );
}

// ===========================
// TRIGGER ENTRY POINTS
// ===========================

function autoProcessGrades()   { processGrades(); }
function onEditProcessGrades() { processGrades(); }
function manualProcessGrades() { processGrades(); SpreadsheetApp.getUi().alert('Grade processing completed!'); }

// ===========================
// HELPERS: Form structure detection
//
// Student columns in the form follow the pattern:
//   [Select Student Name] | [5.0 Individual Score] | [Action (skip)]
// repeated every 3 columns starting at FIRST_STUDENT.
//
// Any columns after the last student's Action column (e.g. "Comments about
// the Presentation") are called "trailing columns" and are carried through
// to the group sheet unchanged.
//
// Group sheet student columns store raw data only:
//   [Student N Name] | [Student N Raw Score]   (2 cols, no calculations)
//
// ALL grade calculations happen exclusively in updateMasterSummary so
// the group tabs serve purely as audit/archive records.
// ===========================

/**
 * Returns 0-based indices of each "Select Student Name" column in the form.
 */
function getStudentSlots(headers) {
  const slots = [];
  for (let i = CONFIG.COLS.FIRST_STUDENT - 1; i < headers.length; i += 3) {
    if (headers[i] && headers[i].toString().includes('Select Student Name')) {
      slots.push(i);
    }
  }
  return slots;
}

/**
 * Returns the 0-based index where trailing (non-student) columns begin.
 * For 10 students: last Action is at index 46, so trailing starts at 47.
 * Returns headers.length if there are no trailing columns.
 */
function getTrailingColumnsStart(headers, studentSlots) {
  if (studentSlots.length === 0) return headers.length;
  const lastNameIdx   = studentSlots[studentSlots.length - 1];
  const lastActionIdx = lastNameIdx + 2; // Name | Score | Action
  return lastActionIdx + 1;
}

// ===========================
// MAIN PROCESSING FUNCTION
// ===========================

function processGrades() {
  // Prevent the time-based and onEdit triggers from running simultaneously
  // and duplicating rows into the group sheets.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // wait up to 10 s; throws if lock is already held
  } catch (e) {
    Logger.log('processGrades: could not acquire lock, skipping this execution.');
    return;
  }

  try {
    const ss        = SpreadsheetApp.getActiveSpreadsheet();
    const mainSheet = ss.getSheetByName(CONFIG.MAIN_SHEET_NAME);
    if (!mainSheet) { Logger.log('Main sheet not found: ' + CONFIG.MAIN_SHEET_NAME); return; }

    const data = mainSheet.getDataRange().getValues();
    if (data.length < 2) return;

    const headers = data[0];
    const now     = new Date();

    // Ensure the live-preview "Group Grade (80%)" column exists on the main
    // sheet. Track whether it's newly created so we can build clean form-only
    // headers to pass to transferRowToGroupSheet.
    const GROUP_GRADE_HEADER = 'Group Grade (80%)';
    let   previewColIdx      = headers.indexOf(GROUP_GRADE_HEADER); // 0-based
    const previewIsNew       = (previewColIdx === -1);
    if (previewIsNew) {
      previewColIdx = headers.length; // will be the next column
      mainSheet.getRange(1, previewColIdx + 1).setValue(GROUP_GRADE_HEADER);
      mainSheet.getRange(1, previewColIdx + 1).setFontWeight('bold');
    }

    // formOnlyHeaders excludes the preview column so it is never accidentally
    // written into a group tab as a trailing column.
    //   - If the preview was just created: headers[] is still the original
    //     form headers (the sheet write hasn't refreshed our local array).
    //   - If the preview already existed: slice off everything from it onward.
    const formOnlyHeaders = previewIsNew
      ? headers
      : headers.slice(0, previewColIdx);

    const rowsToTransfer = [];

    for (let i = 1; i < data.length; i++) {
      const row       = data[i];
      const timestamp = row[CONFIG.COLS.TIMESTAMP - 1];
      if (!timestamp) continue;

      const ageMins = (now - new Date(timestamp)) / (1000 * 60);

      if (ageMins > CONFIG.TRANSFER_DELAY_MINUTES) {
        rowsToTransfer.push({ rowIndex: i + 1, data: row }); // 1-based sheet row
      } else {
        // Show a live group-grade preview while the row is in the holding period.
        // This is the only calculation that touches the main input sheet.
        const groupGrade = calculateGroupGrade(row);
        mainSheet.getRange(i + 1, previewColIdx + 1).setValue(groupGrade);
        mainSheet.getRange(i + 1, previewColIdx + 1).setNumberFormat('0.00"%"');
      }
    }

    // Transfer in reverse order so row deletions don't shift pending indices.
    rowsToTransfer.reverse().forEach(item => {
      transferRowToGroupSheet(ss, mainSheet, item.rowIndex, item.data, formOnlyHeaders);
    });

    updateMasterSummary(ss);

  } finally {
    lock.releaseLock();
  }
}

// ===========================
// GRADE CALCULATION HELPERS
// (called only from updateMasterSummary; group tabs store raw values only)
// ===========================

/**
 * Calculates the group component of the final grade (0–80 range).
 * Works on any row that preserves the original form column positions,
 * which both the main sheet and group sheet rows do.
 */
function calculateGroupGrade(row) {
  let totalWeightedScore = 0;
  let totalWeight        = 0;

  for (let i = 0; i < CONFIG.WEIGHTS.length; i++) {
    const gradeValue = row[CONFIG.COLS.FIRST_GRADE - 1 + i];
    if (!gradeValue || gradeValue === '') continue;

    // parseInt handles both plain numbers and dropdown strings like "4 - Average"
    const gradeNum = parseInt(gradeValue);
    if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 8) continue;

    totalWeightedScore += (CONFIG.GRADE_TO_PERCENT[gradeNum] * CONFIG.WEIGHTS[i] / 100);
    totalWeight        += CONFIG.WEIGHTS[i];
  }

  return totalWeight > 0 ? totalWeightedScore : 0;
}

/**
 * Adds the individual component (0–20) to the group component (0–80).
 * rawScore is the 1–8 value (or "4 - Average" string) from the form.
 * Returns null if the score is missing or invalid.
 */
function calculateIndividualGrade(groupGrade, rawScore) {
  if (!rawScore || rawScore === '') return null;

  const scoreNum = parseInt(rawScore);
  if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 8) return null;

  return groupGrade + (CONFIG.GRADE_TO_PERCENT[scoreNum] * CONFIG.INDIVIDUAL_WEIGHT / 100);
}

// ===========================
// ROW TRANSFER  (raw data only — no calculations)
// ===========================

function transferRowToGroupSheet(ss, mainSheet, rowIndex, row, formHeaders) {
  const groupName = row[CONFIG.COLS.GROUP_NAME - 1];
  if (!groupName || groupName === '') {
    Logger.log('No group name in row ' + rowIndex + ', skipping.');
    return;
  }

  const studentSlots  = getStudentSlots(formHeaders);
  const trailingStart = getTrailingColumnsStart(formHeaders, studentSlots);

  // Group tab row layout (raw values, no calculations):
  //
  //   [Timestamp … 4.3 Synergy+Q&A]   cols 1–17, indices 0–16
  //   [Student N Name | Student N Raw Score]  ×  N students
  //   [Comments about the Presentation …]     trailing form cols
  //
  // The "Action:" columns from the form and the main-sheet preview column
  // are both intentionally excluded.
  const transferRow = [...row.slice(0, CONFIG.COLS.LAST_GROUP_GRADE)]; // indices 0–16

  studentSlots.forEach(nameIdx => {
    transferRow.push(row[nameIdx], row[nameIdx + 1]); // name | raw score (1–8)
  });

  // Upper bound is formHeaders.length, NOT row.length, so the preview grade
  // column appended by this script to the main sheet is never included.
  for (let i = trailingStart; i < formHeaders.length; i++) {
    transferRow.push(row[i]);
  }

  // Create the group sheet if it doesn't exist yet
  let groupSheet = ss.getSheetByName(groupName);
  if (!groupSheet) {
    groupSheet = ss.insertSheet(groupName);

    const groupSheetHeaders = [...formHeaders.slice(0, CONFIG.COLS.LAST_GROUP_GRADE)];

    studentSlots.forEach((_, idx) => {
      const n = idx + 1;
      groupSheetHeaders.push(`Student ${n} Name`, `Student ${n} Raw Score`);
    });

    for (let i = trailingStart; i < formHeaders.length; i++) {
      groupSheetHeaders.push(formHeaders[i]);
    }

    groupSheet.getRange(1, 1, 1, groupSheetHeaders.length).setValues([groupSheetHeaders]);
    groupSheet.getRange(1, 1, 1, groupSheetHeaders.length).setFontWeight('bold');
  }

  // Append the raw data row — no number formatting needed since values are
  // stored as the original 1-8 dropdown strings.
  groupSheet.getRange(groupSheet.getLastRow() + 1, 1, 1, transferRow.length)
            .setValues([transferRow]);

  // Remove the processed row from the main input sheet
  mainSheet.deleteRow(rowIndex);
}

// ===========================
// MASTER SUMMARY  (all grade calculations live here)
//
// For every row in every group sheet this function:
//   1. Recalculates the group grade (0–80) from the raw 1-8 category scores.
//   2. For each student in that row, combines the group grade with the
//      student's raw individual score to produce a total grade (0–100).
//   3. Collects all total grades per student by NAME (not by slot column),
//      so the slot order used by different evaluators doesn't matter.
//   4. Averages each student's grades for the final summary.
// ===========================

function updateMasterSummary(ss) {
  let summarySheet = ss.getSheetByName(CONFIG.MASTER_SUMMARY_NAME);

  if (!summarySheet) {
    summarySheet = ss.insertSheet(CONFIG.MASTER_SUMMARY_NAME);
    summarySheet.getRange(1, 1, 1, 7).setValues([[
      'Student Name', 'Group', 'Final Average Grade (100%)', '',
      'Group Name', 'Avg Group Grade (80%)', 'Avg Overall Grade (100%)'
    ]]);
    summarySheet.getRange(1, 1, 1, 7).setFontWeight('bold');
  } else {
    if (summarySheet.getLastRow() > 1) {
      summarySheet.getRange(2, 1, summarySheet.getLastRow() - 1, 7).clear();
    }
  }

  const allStudents = {}; // { studentName -> { group: string, grades: number[] } }
  const allGroups   = {}; // { groupName   -> { groupGrades: number[], studentGrades: number[] } }

  ss.getSheets().forEach(sheet => {
    const sheetName = sheet.getName();
    if (sheetName === CONFIG.MAIN_SHEET_NAME || sheetName === CONFIG.MASTER_SUMMARY_NAME) return;

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return;

    const headers = data[0];

    if (!allGroups[sheetName]) {
      allGroups[sheetName] = { groupGrades: [], studentGrades: [] };
    }

    // Locate student name/raw-score column pairs using the header pattern
    // set by transferRowToGroupSheet ("Student N Name" / "Student N Raw Score").
    const studentColPairs = [];
    for (let c = 0; c < headers.length; c++) {
      if (/^Student \d+ Name$/.test(headers[c].toString())) {
        studentColPairs.push({ nameCol: c, scoreCol: c + 1 });
      }
    }

    for (let r = 1; r < data.length; r++) {
      const row = data[r];

      // Recalculate group grade from the preserved raw category scores in
      // cols 1-17 (same positions as the original form — unchanged on transfer).
      const groupGrade = calculateGroupGrade(row);
      if (groupGrade > 0) {
        allGroups[sheetName].groupGrades.push(groupGrade);
      }

      // For each student slot in this evaluation row, calculate the total
      // grade and record it under the student's name.
      studentColPairs.forEach(({ nameCol, scoreCol }) => {
        const name     = row[nameCol];
        const rawScore = row[scoreCol];

        if (!name || !rawScore || rawScore === '') return;

        const totalGrade = calculateIndividualGrade(groupGrade, rawScore);
        if (totalGrade === null) return;

        if (!allStudents[name]) {
          allStudents[name] = { group: sheetName, grades: [] };
        }
        allStudents[name].grades.push(totalGrade);
        allGroups[sheetName].studentGrades.push(totalGrade);
      });
    }
  });

  // --- Per-student rows (columns A–C) ---
  // Final grade = mean of all total-grade values collected for that student
  // across every evaluator and every evaluation session.
  const summaryData = Object.keys(allStudents).sort().map(name => {
    const { group, grades } = allStudents[name];
    const avg = grades.reduce((a, b) => a + b, 0) / grades.length;
    return [name, group, avg];
  });

  if (summaryData.length > 0) {
    summarySheet.getRange(2, 1, summaryData.length, 3).setValues(summaryData);
    summarySheet.getRange(2, 3, summaryData.length, 1).setNumberFormat('0.00"%"');
  }

  // --- Per-group rows (columns E–G) ---
  const groupData = Object.keys(allGroups).sort().map(groupName => {
    const { groupGrades, studentGrades } = allGroups[groupName];
    const avgGroupGrade   = groupGrades.length   > 0
      ? groupGrades.reduce((a, b)   => a + b, 0) / groupGrades.length   : 0;
    const avgOverallGrade = studentGrades.length > 0
      ? studentGrades.reduce((a, b) => a + b, 0) / studentGrades.length : 0;
    return [groupName, avgGroupGrade, avgOverallGrade];
  });

  if (groupData.length > 0) {
    summarySheet.getRange(2, 5, groupData.length, 3).setValues(groupData);
    summarySheet.getRange(2, 6, groupData.length, 2).setNumberFormat('0.00"%"');
  }
}

// ===========================
// DATA VALIDATION SETUP
// ===========================

function setupDataValidation() {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const mainSheet = ss.getSheetByName(CONFIG.MAIN_SHEET_NAME);

  if (!mainSheet) {
    SpreadsheetApp.getUi().alert('Main sheet not found: ' + CONFIG.MAIN_SHEET_NAME);
    return;
  }

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.GRADE_LABELS, true)
    .setAllowInvalid(false)
    .build();

  const lastRow = Math.max(mainSheet.getLastRow(), 100);

  // Group grade columns: E through Q
  mainSheet
    .getRange(2, CONFIG.COLS.FIRST_GRADE, lastRow,
              CONFIG.COLS.LAST_GROUP_GRADE - CONFIG.COLS.FIRST_GRADE + 1)
    .setDataValidation(rule);

  // Individual score columns: one per student slot, detected from headers
  const headers      = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues()[0];
  const studentSlots = getStudentSlots(headers);

  studentSlots.forEach(nameIdx => {
    // nameIdx is 0-based; score is nameIdx+1 (0-based) = nameIdx+2 (1-based)
    mainSheet.getRange(2, nameIdx + 2, lastRow, 1).setDataValidation(rule);
  });

  SpreadsheetApp.getUi().alert('Data validation set up successfully for all grade columns!');
}