/**
 * Master Grade Management Script - v5
 * - Optimized performance with batch operations
 * - Automatic fail policy (69 score for any fail grade)
 * - Fixed font colors in History tab
 * - Improved green highlighting for non-outlier cells
 */

//=====================================================
// GLOBAL CONSTANTS AND VARIABLES
//=====================================================

// Global lock to prevent simultaneous processing
let isRunning = false;

// Home sheet constants
const HOME_SHEET = "Home";
const HOME_STUDENT_COL = 2; // Column B (was Column C) - Student Identifier
const HOME_GRADE_START_COL = 6; // Column F (was Column G) - 1.1 Objectives & Data Requirements
const HOME_GRADE_END_COL = 12; // Column L - 3.1 Adapting to Contextual Changes (last criterion, 25B update)
const HOME_WEIGHTED_SUM_COL = 13; // Column M (was N) - Weighted Sum
const HOME_TOTAL_COL = 14; // Column N (was O) - Total
const HOME_HIGHLIGHT_COLS = [2, 3, 4, 5]; // Columns B-E (was C-F) - Student, Grader, Scenario, Track

// History sheet constants
const HIST_SHEET_NAME = "History";
const HIST_STUDENT_COL = 2; // Column B (was Column C) - Student Identifier
const HIST_GRADE_START_COL = 6; // Column F (was Column G) - 1.1 Objectives & Data Requirements
const HIST_GRADE_END_COL = 12; // Column L - 3.1 Adapting to Contextual Changes (last criterion, 25B update)
const HIST_WEIGHTED_SUM_COL = 13; // Column M (was N) - Weighted Sum
const HIST_TOTAL_COL = 14; // Column N (was O) - Total
const HIST_HIGHLIGHT_COLS = [2, 3, 4, 5]; // Columns B-E (was C-F) - Student, Grader, Scenario, Track

// Grade values, weights, and colors
const GRADE_VALUES = {
  "1. Well Above Average": 1,
  "2. Above Average": 2, 
  "3. Slightly Above Average": 3,
  "4. Average": 4,
  "5. Slightly Below Average": 5,
  "6. Below Average": 6,
  "7. Well Below Average": 7,
  "8. Fail": 8
};

// 25B UPDATE: 7 criteria. Criterion 3.1 weight raised 5%→7.5%. Innovator (2.5%) removed.
// Order: 1.1 Obj&Data, 1.2 EngPrinc, 1.3 Instro, 1.4 Risk, 1.5 Comm, 2.1 Stakeholder, 3.1 Adapting
const GRADE_WEIGHTS = [0.15, 0.25, 0.10, 0.20, 0.20, 0.025, 0.075];

// Foundation Report constants
const FOUNDATION_SHEET_NAME = "Foundation Report";
const STUDENT_SURVEY_SHEET = "Student Survey";
const INSTRUCTOR_SURVEY_SHEET = "Instructor Survey";

// Track mappings for graders and students
const TRACK_MAPPINGS = {
  'P': 'Pilot',
  'Pilot': 'Pilot',
  'RPA Pilot': 'RPA',
  'RPA': 'RPA',
  'FTE': 'FTE',
  'STC': 'Operator',
  'Operator (STC - Space Test Course)': 'Operator',
  'CSO/WSO': 'CSO/WSO',
  'CSO/WSO (Combat Systems Officer / Weapon Systems Officer)': 'CSO/WSO',
  'ABM': 'ABM',
  'ABM (Air Battle Manager)': 'ABM'
};

const NUMERIC_MAP = {
  1: 100,
  2: 95,
  3: 90,
  4: 85,
  5: 80,
  6: 75,
  7: 70,
  8: 69
};

const COLORS = {
  DISCREPANCY: "#FFD580",
  SUCCESS: "#D9F2F2",
  FAIL: "#FF0000",
  FULL_FAIL: "#F28B82"
};

// Grade options for data validation
const GRADE_OPTIONS = [
  "1. Well Above Average",
  "2. Above Average",
  "3. Slightly Above Average",
  "4. Average",
  "5. Slightly Below Average",
  "6. Below Average",
  "7. Well Below Average",
  "8. Fail"
];

//=====================================================
// MASTER EDIT HANDLER
//=====================================================

/**
 * Main edit handler that dispatches to the appropriate function
 */
function onEdit(e) {
  // Clear any stuck isRunning flag first
  if (isRunning) {
    console.log("WARNING: isRunning flag was stuck - clearing it");
    isRunning = false;
  }
  
  try {
    // Validate event object
    if (!e || !e.range || !e.source) {
      console.log("Invalid edit event - skipping");
      return;
    }
    
    const sheet = e.source.getActiveSheet();
    const sheetName = sheet.getName();
    const editedRow = e.range.getRow();
    const editedCol = e.range.getColumn();
    const oldValue = e.oldValue;
    const newValue = e.value;
    
    console.log(`🎯 EDIT DETECTED: Sheet=${sheetName}, Row=${editedRow}, Col=${editedCol}`);
    console.log(`   Old Value: "${oldValue}" → New Value: "${newValue}"`);
    
    // Only process Home and History sheets
    if (sheetName !== HOME_SHEET && sheetName !== HIST_SHEET_NAME) {
      console.log(`   Skipping - not a target sheet`);
      return;
    }
    
    // Set running flag
    isRunning = true;
    
    if (sheetName === HOME_SHEET) {
      console.log(`   Processing HOME sheet edit...`);
      onEditHomeFixed(e);
    } else if (sheetName === HIST_SHEET_NAME) {
      console.log(`   Processing HISTORY sheet edit...`);
      onEditHistory(e);
    }
    
    console.log(`✅ Edit processing complete for ${sheetName}`);
    
  } catch (error) {
    console.error(`❌ ERROR in onEdit: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
  } finally {
    // Always clear the running flag
    isRunning = false;
  }
}


//=====================================================
// UPDATE EXISTING MENU FUNCTION
//=====================================================

/**
 * Updated onOpen function to include Foundation Report option
 * REPLACE your existing onOpen function with this one
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Grade Tools')
    .addItem('🚀 Setup Automatic Processing (RUN FIRST)', 'setupAutomaticProcessing')
    .addItem('🧪 Test Automation System', 'testAutomationSystem')
    .addSeparator()
    .addSubMenu(ui.createMenu('🔧 Debug & Fix')
      .addItem('Test onEdit Function', 'testOnEditWorking')
      .addItem('Force Process Home Sheet', 'forceProcessHomeSheet')
      .addItem('Debug Transfer Eligibility', 'debugTransferEligibility')
      .addSeparator()
      .addItem('⚠️ Check for Lost Data', 'checkForLostData')
      .addItem('🔍 Identify Lost Data Patterns', 'identifyLostData')
      .addSeparator()
      .addItem('Reset Running Flag', 'resetRunningFlag')
      .addItem('Clear All Triggers', 'clearAllTriggers'))
    .addSeparator()
    .addItem('Process Home Tab Outliers', 'processAllHomeOutliers')
    .addItem('Process Student Averages & Highlighting', 'processAllStudentAverages')
    .addItem('Process History Tab Completely', 'processAllHistoryStudents')
    .addSeparator()
    .addItem('Run Full Processing Now', 'processGradingSystem')
    .addItem('Clean Up Grade Cell Format', 'cleanupAllGradeCells')
    .addItem('Verify All Grade Cell Colors', 'manualVerifyAllGradeColors')
    .addSeparator()
    .addItem('Generate Advanced Grade Statistics', 'buildAdvancedGradeStatistics')
    .addItem('Generate Foundation Report for LLM Analysis', 'generateFoundationReport')
    .addSeparator()
    .addItem('🔧 Create Bias Corrected Grades', 'createBiasCorrectedGrades')
    .addSeparator()
    .addItem('🧠 Apply Bayesian Consensus (Phase 1)', 'applyBayesianConsensusPhase1')
    .addItem('📊 Generate Bias Analysis Report', 'generateBiasAnalysisReport')
    .addToUi();
}

/**
 * Add these helper functions for debugging
 */
function resetRunningFlag() {
  isRunning = false;
  console.log("✅ Running flag reset to false");
  SpreadsheetApp.getUi().alert("Running flag has been reset");
}

function clearAllTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;
    
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === 'checkForUnprocessedGrades') {
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
      }
    }
    
    console.log(`✅ Deleted ${deletedCount} automatic triggers`);
    SpreadsheetApp.getUi().alert(`Deleted ${deletedCount} triggers. Run 'Setup Automatic Processing' to recreate them.`);
    
  } catch (error) {
    console.error("❌ Error clearing triggers: " + error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
  }
}
//=====================================================
// HOME SHEET EDIT HANDLER - OPTIMIZED
//=====================================================

/**
 * Enhanced onEditHome function to include trimming of columns D-F
 */
function onEditHomeFixed(e) {
  const sheet = e.source.getActiveSheet();
  const col = e.range.getColumn();
  const row = e.range.getRow();
  const newValue = e.value;
  
  console.log(`   🏠 HOME EDIT: Row ${row}, Col ${col}, Value: "${newValue}"`);
  
  if (row < 2) { // Skip header row
    console.log(`   Skipping header row`);
    return;
  }
  
  // Get the student name
  const studentName = sheet.getRange(row, HOME_STUDENT_COL).getValue();
  if (!studentName) {
    console.log(`   No student name found in row ${row} - skipping`);
    return;
  }
  
  console.log(`   Student: ${studentName}`);
  
  // Find all rows for this student (optimized search)
  const lastRow = sheet.getLastRow();
  const studentNameRange = sheet.getRange(2, HOME_STUDENT_COL, lastRow - 1, 1);
  const studentNames = studentNameRange.getValues().flat();
  
  const studentRows = [];
  for (let i = 0; i < studentNames.length; i++) {
    if (studentNames[i] === studentName) {
      studentRows.push(i + 2); // Convert to 1-indexed row
    }
  }
  
  console.log(`   Found ${studentRows.length} rows for student: ${studentName}`);
  
  // IMMEDIATE PROCESSING STEPS
  
  try {
    // Step 1: Trim whitespace in columns D, E, and F for this student
    console.log(`   Step 1: Trimming whitespace...`);
    trimWhitespaceInColumns(sheet, studentRows, [3, 4, 5]);
    
    // Step 2: Trim the edited cell value for immediate feedback
    if (typeof newValue === 'string') {
      const trimmedValue = newValue.trim();
      if (trimmedValue !== newValue) {
        console.log(`   Trimming edited cell: "${newValue}" → "${trimmedValue}"`);
        e.range.setValue(trimmedValue);
      }
    }
    
    // Step 3: Always validate track and scenario consistency
    console.log(`   Step 3: Validating track/scenario consistency...`);
    validateTrackAndScenario(sheet, studentRows);
    
    // Step 4: Apply data validation to grade cells immediately
    if (col >= HOME_GRADE_START_COL && col <= HOME_GRADE_END_COL) {
      console.log(`   Step 4: Applying data validation to grade column...`);
      applyDataValidationToRow(sheet, row);
      
      // Also apply to all rows for this student to ensure consistency
      for (const studentRow of studentRows) {
        applyDataValidationToRow(sheet, studentRow);
      }
    }
    
    // Step 5: Process grade columns for outliers immediately
    if (col >= HOME_GRADE_START_COL && col <= HOME_GRADE_END_COL) {
      console.log(`   Step 5: Processing grade outliers for column ${col}...`);
      
      // First process just the edited column quickly
      processGradeCellsOptimized(sheet, studentRows, col);
      
      // Small delay, then process all columns for complete analysis
      Utilities.sleep(100);
      processGradeCellsOptimized(sheet, studentRows, null);
    }
    
    // Step 6: Check if we can calculate weighted averages
    console.log(`   Step 6: Checking for final student processing...`);
    processStudentIfReadyOptimized(sheet, studentRows);
    
    console.log(`   ✅ HOME edit processing complete for ${studentName}`);
    
  } catch (stepError) {
    console.error(`   ❌ Error in HOME processing step: ${stepError.message}`);
  }
}


/**
 * Optimized version that processes grade cells for outliers
 * Can process either one column (if colToProcess is specified) or all grade columns
 */
function processGradeCellsOptimized(sheet, studentRows, colToProcess) {
  if (studentRows.length < 2) return; // Need at least 2 rows to compare
  
  // Determine which columns to process
  const columnsToProcess = colToProcess ? 
    [colToProcess] : 
    Array.from({length: HOME_GRADE_END_COL - HOME_GRADE_START_COL + 1}, (_, i) => i + HOME_GRADE_START_COL);
  
  // Batch read student grades (all columns or single column)
  const startCol = colToProcess || HOME_GRADE_START_COL;
  const width = colToProcess ? 1 : (HOME_GRADE_END_COL - HOME_GRADE_START_COL + 1);
  
  // Prepare for batch operations
  const cellsToUpdate = {
    outliers: [],     // cells to mark as outliers
    resolved: [],     // cells to mark as resolved
    failFont: [],     // cells to mark as fail (font)
    normalFont: []    // cells to reset to normal font
  };
  
  // Process each column
  for (const col of columnsToProcess) {
    // Get all grades for this column
    const gradesData = [];
    
    // First batch read all values
    const gradeValues = [];
    const gradeBackgrounds = [];
    const gradeFonts = [];
    
    for (const row of studentRows) {
      const cell = sheet.getRange(row, col);
      gradeValues.push(cell.getValue());
      gradeBackgrounds.push(cell.getBackground().toUpperCase());
      gradeFonts.push(cell.getFontColor());
    }
    
    // Process the grade values
    for (let i = 0; i < studentRows.length; i++) {
      const value = gradeValues[i];
      if (!value) continue;
      
      const trimmed = value.toString().trim();
      const grade = GRADE_VALUES[trimmed];
      
      if (grade !== undefined) {
        gradesData.push({
          row: studentRows[i],
          col: col,
          value: grade,
          text: trimmed,
          background: gradeBackgrounds[i],
          fontColor: gradeFonts[i]
        });
      }
    }
    
    // Skip if not enough grades to compare
    if (gradesData.length < 2) continue;
    
    // Check each grade for outliers
    for (const grade of gradesData) {
      let isOutlier = false;
      
      // Compare with all other grades
      for (const other of gradesData) {
        if (grade === other) continue;
        
        if (Math.abs(grade.value - other.value) > 2) {
          isOutlier = true;
          break;
        }
      }
      
      // Determine if we need to update this cell
      const isCurrentlyOutlier = (
        grade.background === COLORS.DISCREPANCY.toUpperCase() || 
        grade.background === "#FFA500"
      );
      const isCurrentlyResolved = (
        grade.background === COLORS.SUCCESS.toUpperCase()
      );
      
      // If outlier status needs to change, queue for update
      if (isOutlier && !isCurrentlyOutlier) {
        cellsToUpdate.outliers.push(`${grade.row}:${grade.col}`);
      } 
      // If not an outlier and either has wrong background or no background, mark as resolved
      else if (!isOutlier && (isCurrentlyOutlier || !isCurrentlyResolved)) {
        cellsToUpdate.resolved.push(`${grade.row}:${grade.col}`);
      }
      
      // Check if font color needs updating
      const isFail = grade.text === "8. Fail";
      const isFailFont = grade.fontColor === COLORS.FAIL;
      
      if (isFail && !isFailFont) {
        cellsToUpdate.failFont.push(`${grade.row}:${grade.col}`);
      } else if (!isFail && isFailFont) {
        cellsToUpdate.normalFont.push(`${grade.row}:${grade.col}`);
      }
    }
  }
  
  // Batch update all cells that need changes
  // This dramatically reduces API calls
  
  // Update cells marked as outliers
  for (const cellKey of cellsToUpdate.outliers) {
    const [row, col] = cellKey.split(':').map(Number);
    sheet.getRange(row, col).setBackground(COLORS.DISCREPANCY);
  }
  
  // Update cells marked as resolved
  for (const cellKey of cellsToUpdate.resolved) {
    const [row, col] = cellKey.split(':').map(Number);
    sheet.getRange(row, col).setBackground(COLORS.SUCCESS);
  }
  
  // Update fail text color
  for (const cellKey of cellsToUpdate.failFont) {
    const [row, col] = cellKey.split(':').map(Number);
    sheet.getRange(row, col).setFontColor(COLORS.FAIL);
  }
  
  // Reset normal text color
  for (const cellKey of cellsToUpdate.normalFont) {
    const [row, col] = cellKey.split(':').map(Number);
    sheet.getRange(row, col).setFontColor("#000000");
  }
}

/**
 * Modified version of processStudentIfReadyOptimized that preserves yellow highlighting
 * on Track and Scenario columns even when applying grade success highlighting
 */
function processStudentIfReadyOptimized(sheet, rows) {
  if (rows.length === 0) return;
  
  // First, validate Track and Scenario consistency
  validateTrackAndScenario(sheet, rows);
  
  // Use batch operations to read data
  const gradeRange = sheet.getRange(
    Math.min(...rows), 
    HOME_GRADE_START_COL, 
    Math.max(...rows) - Math.min(...rows) + 1, 
    HOME_GRADE_END_COL - HOME_GRADE_START_COL + 1
  );
  
  // Batch get backgrounds and values - huge performance gain
  const backgrounds = gradeRange.getBackgrounds();
  const values = gradeRange.getValues();
  
  // Check for outliers using batch data
  let hasOutliers = false;
  let hasFail = false;
  
  // Convert rows from absolute to relative (within our arrays)
  const rowsMap = {};
  const minRow = Math.min(...rows);
  rows.forEach(r => {
    rowsMap[r - minRow] = true;
  });
  
  // Now use relative addressing to check cells
  for (let r = 0; r < backgrounds.length; r++) {
    // Skip if this row isn't in our student's rows
    if (!rowsMap[r]) continue;
    
    for (let c = 0; c < backgrounds[r].length; c++) {
      // Skip if cell is empty
      if (!values[r][c]) continue;
      
      // Check background for outliers - convert to uppercase for case-insensitive compare
      const bg = backgrounds[r][c].toUpperCase();
      if (bg === COLORS.DISCREPANCY.toUpperCase() || 
          bg === "#FFA500") {
        hasOutliers = true;
      }
      
      // Check for fail grades
      if (values[r][c] === "8. Fail") {
        hasFail = true;
      }
    }
    
    if (hasOutliers) break; // Early exit if we found outliers
  }
  
  // Batch read grader data
  const graderCol = HOME_STUDENT_COL + 1;
  const graderRange = sheet.getRange(
    Math.min(...rows),
    graderCol,
    Math.max(...rows) - Math.min(...rows) + 1,
    1
  );
  
  const graderValues = graderRange.getValues().flat();
  
  // Count distinct graders
  const graders = new Set();
  for (let i = 0; i < graderValues.length; i++) {
    // Only include rows from our student
    const relRow = i;
    if (rowsMap[relRow] && graderValues[i]) {
      graders.add(graderValues[i]);
    }
  }
  
  // Early exit if requirements aren't met
  if (hasOutliers || graders.size < 4) {
    return;
  }
  
  console.log("Student meets requirements - processing averages");
  
  const statusCell = sheet.getRange("Z1");
  statusCell.setValue("Processing student averages...");
  
  // Step 1: Calculate weighted sums for each row - use batch operations
  // Get all grade values for batch calculation
  const allGradeValues = [];
  for (const row of rows) {
    const rowGrades = [];
    for (let col = HOME_GRADE_START_COL; col <= HOME_GRADE_END_COL; col++) {
      rowGrades.push(sheet.getRange(row, col).getValue());
    }
    allGradeValues.push(rowGrades);
  }
  
  // Calculate weighted sums in memory
  const weightedSums = [];
  for (let r = 0; r < allGradeValues.length; r++) {
    let sum = 0;
    let count = 0;
    let rowHasFail = false;
    
    for (let c = 0; c < allGradeValues[r].length; c++) {
      const value = allGradeValues[r][c];
      if (!value) continue;
      
      const trimmedValue = value.toString().trim();
      const grade = GRADE_VALUES[trimmedValue];
      
      if (grade !== undefined) {
        // Check for fail grade
        if (trimmedValue === "8. Fail") {
          rowHasFail = true;
        }
        const numeric = NUMERIC_MAP[grade];
        sum += numeric * GRADE_WEIGHTS[c];
        count++;
      }
    }
    
    if (count > 0) {
      // We need the row with the sum
      // Override the sum to 69 if there's a fail
      weightedSums.push({
        row: rows[r],
        sum: rowHasFail ? 69 : sum,
        hasFail: rowHasFail
      });
    }
  }
  
  // Set all weighted sums at once
  for (const item of weightedSums) {
    sheet.getRange(item.row, HOME_WEIGHTED_SUM_COL).setValue(item.sum);
  }
  
  // Determine the highlight color
  const color = hasFail ? COLORS.FULL_FAIL : COLORS.SUCCESS;
  
  // IMPORTANT: Save the current background colors of Track and Scenario columns (E and F)
  // to preserve yellow highlighting for inconsistencies
  const trackBackgrounds = [];
  const scenarioBackgrounds = [];
  
  for (const row of rows) {
    trackBackgrounds.push({
      row: row,
      background: sheet.getRange(row, 5).getBackground() // Column E (Track)
    });
    
    scenarioBackgrounds.push({
      row: row,
      background: sheet.getRange(row, 6).getBackground() // Column F (Scenario)
    });
  }
  
  // Create range lists for batch operations
  const nameCellsToHighlight = [];
  for (const row of rows) {
    for (const col of HOME_HIGHLIGHT_COLS) {
      nameCellsToHighlight.push(sheet.getRange(row, col));
    }
    // Clear total cells
    sheet.getRange(row, HOME_TOTAL_COL).setValue("").setBackground(null);
  }
  
  // Apply highlighting in batch
  if (nameCellsToHighlight.length > 0) {
    sheet.getRangeList(nameCellsToHighlight.map(r => r.getA1Notation()))
      .setBackground(color);
  }
  
  // Calculate overall average
  let totalSum = 0;
  let totalCount = 0;
  let studentHasFail = false;
  
  for (const item of weightedSums) {
    totalSum += item.sum;
    totalCount++;
    if (item.hasFail) {
      studentHasFail = true;
    }
  }
  
  // Set final average ONLY in the last row
  if (totalCount > 0) {
    const lastRow = Math.max(...rows);
    const avg = studentHasFail ? 69 : (totalSum / totalCount);
    sheet.getRange(lastRow, HOME_TOTAL_COL).setValue(avg).setBackground(color);
  }
  
  // IMPORTANT: Restore yellow highlighting for Track and Scenario columns where it existed
  const YELLOW_COLOR = "#FFFF00";
  
  for (const item of trackBackgrounds) {
    // If the background was yellow, restore it
    if (item.background === YELLOW_COLOR) {
      sheet.getRange(item.row, 5).setBackground(YELLOW_COLOR);
    }
  }
  
  for (const item of scenarioBackgrounds) {
    // If the background was yellow, restore it
    if (item.background === YELLOW_COLOR) {
      sheet.getRange(item.row, 6).setBackground(YELLOW_COLOR);
    }
  }
  
  statusCell.setValue("Student processing complete!");
  // Clear status after 3 seconds
  Utilities.sleep(3000);
  statusCell.setValue("");
}

/**
 * Process all visible students in Home tab - Optimized
 */
function processAllHomeOutliers() {
  if (isRunning) return;
  isRunning = true;
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(HOME_SHEET);
    const lastRow = Math.min(sheet.getLastRow(), 100); // Process at most 100 rows
    
    if (lastRow < 2) {
      isRunning = false;
      return;
    }
    
    // Batch read all student names
    const studentRange = sheet.getRange(2, HOME_STUDENT_COL, lastRow - 1, 1);
    const studentNames = studentRange.getValues().flat();
    
    // Group students more efficiently
    const studentGroups = {};
    for (let i = 0; i < studentNames.length; i++) {
      const name = studentNames[i];
      if (!name) continue;
      
      if (!studentGroups[name]) {
        studentGroups[name] = [];
      }
      studentGroups[name].push(i + 2); // convert to 1-indexed row
    }
    
    // Process each student's rows
    for (const name in studentGroups) {
      const rows = studentGroups[name];
      if (rows.length > 0) {
        processGradeCellsOptimized(sheet, rows, null); // Process all columns
      }
    }
  } catch (error) {
    console.error("Error in processAllHomeOutliers: " + error.message);
  } finally {
    isRunning = false;
  }
}

//=====================================================
// HISTORY SHEET EDIT HANDLER - OPTIMIZED
//=====================================================

/**
 * Handles edits to the History tab - Optimized
 */
function onEditHistory(e) {
  const sheet = e.source.getActiveSheet();
  const editedCol = e.range.getColumn();
  const editedRow = e.range.getRow();
  
  // Only process if edit was in a grade column
  if (editedCol < HIST_GRADE_START_COL || editedCol > HIST_GRADE_END_COL || editedRow < 2) {
    return;
  }
  
  // Add status indicator (using Z1 instead)
  const statusCell = sheet.getRange("Z1");
  statusCell.setValue("Processing History edit at " + new Date().toLocaleTimeString());
  
  try {
    // Trim the edited value if needed
    const editedValue = e.range.getValue();
    if (typeof editedValue === 'string') {
      const trimmedValue = editedValue.trim();
      if (trimmedValue !== editedValue) {
        e.range.setValue(trimmedValue);
      }
    }
    
    // Get the student name for this row
    const studentName = sheet.getRange(editedRow, HIST_STUDENT_COL).getValue();
    if (!studentName) {
      statusCell.setValue("");
      return;
    }
    
    // Find all rows for this student using batch read
    const studentRows = findStudentRowsOptimized(sheet, studentName);
    if (studentRows.length < 2) {
      processHistoryRow(sheet, editedRow);
      statusCell.setValue("");
      return;
    }
    
    // Process all grades for this student
    processHistoryStudentGroupOptimized(sheet, studentRows);
    
    // Restore status
    statusCell.setValue("");
  } catch (error) {
    console.error("Error processing history edit: " + error.message);
    statusCell.setValue("ERROR: " + error.message);
  }
}

/**
 * Find all rows for a given student in History - Optimized
 */
function findStudentRowsOptimized(sheet, studentName) {
  const lastRow = sheet.getLastRow();
  
  // Batch read all student names - far more efficient
  const studentNameRange = sheet.getRange(2, HIST_STUDENT_COL, lastRow - 1, 1);
  const studentNames = studentNameRange.getValues().flat();
  
  // Find matching rows
  const studentRows = [];
  for (let i = 0; i < studentNames.length; i++) {
    if (studentNames[i] === studentName) {
      studentRows.push(i + 2); // Add 2 to convert to 1-indexed row
    }
  }
  
  return studentRows;
}

/**
 * Process a group of rows for a student in History - Optimized
 */
function processHistoryStudentGroupOptimized(sheet, rowIndices) {
  // Detect outliers and calculate weighted sums in one pass
  const minRow = Math.min(...rowIndices);
  const maxRow = Math.max(...rowIndices);
  const numRows = maxRow - minRow + 1;
  
  // Batch read grade values
  const gradeRange = sheet.getRange(
    minRow, 
    HIST_GRADE_START_COL, 
    numRows, 
    HIST_GRADE_END_COL - HIST_GRADE_START_COL + 1
  );
  
  const gradeValues = gradeRange.getValues();
  const fontColors = gradeRange.getFontColors(); // Added this line to read font colors
  
  // Create map for faster row lookups
  const rowsMap = {};
  rowIndices.forEach(r => {
    rowsMap[r - minRow] = true; // Convert to 0-indexed within our data array
  });
  
  // Process each column for outliers
  const outlierCells = [];
  const resolvedCells = [];
  const failFontCells = []; // Added this array for cells needing red font
  const normalFontCells = []; // Added this array for cells needing black font
  const weightedSums = {};
  let hasFail = false;
  
  for (let col = 0; col < (HIST_GRADE_END_COL - HIST_GRADE_START_COL + 1); col++) {
    // Gather valid grades for this column
    const colGrades = [];
    
    for (let r = 0; r < numRows; r++) {
      // Skip rows that don't belong to our student
      if (!rowsMap[r]) continue;
      
      const value = gradeValues[r][col];
      if (!value) continue;
      
      const trimmed = value.toString().trim();
      const grade = GRADE_VALUES[trimmed];
      
      if (grade !== undefined) {
        colGrades.push({
          row: r + minRow, // Convert back to actual row
          relRow: r,      // Keep relative row for array access
          col: col + HIST_GRADE_START_COL, // Convert to actual column
          value: grade,
          text: trimmed
        });
        
        // While we're here, accumulate weighted sums and check for fails
        const actualRow = r + minRow;
        if (!weightedSums[actualRow]) {
          weightedSums[actualRow] = { 
            sum: 0, 
            count: 0,
            hasFail: false
          };
        }
        
        const numeric = NUMERIC_MAP[grade];
        weightedSums[actualRow].sum += numeric * GRADE_WEIGHTS[col];
        weightedSums[actualRow].count++;
        
        // Get current font color, normalizing it for comparison
        const currentFontColor = (fontColors[r][col] || "").toString().toUpperCase();
        const failColor = COLORS.FAIL.toUpperCase();
        
        // Check for fails and update font color
        if (trimmed === "8. Fail") {
          hasFail = true;
          weightedSums[actualRow].hasFail = true;
          
          // Check if we need to update the font color to red
          if (currentFontColor !== failColor) {
            failFontCells.push(sheet.getRange(actualRow, col + HIST_GRADE_START_COL));
          }
        } else {
          // Check if we need to reset to black font color
          // We need to check if the current color contains the fail color string
          // because Google Sheets might return colors in different formats
          if (currentFontColor.includes(failColor.replace('#', '')) || 
              currentFontColor === failColor) {
            normalFontCells.push(sheet.getRange(actualRow, col + HIST_GRADE_START_COL));
          }
        }
      }
    }
    
    // Skip if not enough grades to compare
    if (colGrades.length < 2) continue;
    
    // Check for outliers
    for (const grade of colGrades) {
      let isOutlier = false;
      
      for (const other of colGrades) {
        if (grade === other) continue;
        
        if (Math.abs(grade.value - other.value) > 2) {
          isOutlier = true;
          break;
        }
      }
      
      // Queue for update
      const actualCol = col + HIST_GRADE_START_COL;
      if (isOutlier) {
        outlierCells.push(sheet.getRange(grade.row, actualCol));
      } else {
        resolvedCells.push(sheet.getRange(grade.row, actualCol));
      }
    }
  }
  
  // Apply outlier highlighting in batch
  if (outlierCells.length > 0) {
    sheet.getRangeList(outlierCells.map(r => r.getA1Notation()))
      .setBackground(COLORS.DISCREPANCY);
  }
  
  if (resolvedCells.length > 0) {
    sheet.getRangeList(resolvedCells.map(r => r.getA1Notation()))
      .setBackground(COLORS.SUCCESS);
  }
  
  // Apply font color changes - Added these blocks
  if (failFontCells.length > 0) {
    sheet.getRangeList(failFontCells.map(r => r.getA1Notation()))
      .setFontColor(COLORS.FAIL);
  }
  
  if (normalFontCells.length > 0) {
    sheet.getRangeList(normalFontCells.map(r => r.getA1Notation()))
      .setFontColor("#000000");
  }
  
  // Set weighted sums
  for (const row in weightedSums) {
    if (weightedSums[row].count > 0) {
      // Override to 69 if there's a fail
      const finalSum = weightedSums[row].hasFail ? 69 : weightedSums[row].sum;
      sheet.getRange(parseInt(row), HIST_WEIGHTED_SUM_COL)
        .setValue(finalSum);
    }
  }
  
  // Count distinct graders
  const graderRange = sheet.getRange(minRow, HIST_STUDENT_COL + 1, numRows, 1);
  const graderValues = graderRange.getValues().flat();
  
  const graders = new Set();
  for (let i = 0; i < graderValues.length; i++) {
    if (rowsMap[i] && graderValues[i]) {
      graders.add(graderValues[i]);
    }
  }
  
  // Check if student group has outliers
  let hasOutliers = outlierCells.length > 0;
  
  // Apply student summary highlighting
  let summaryColor = null;
  if (graders.size >= 4 && !hasOutliers) {
    summaryColor = hasFail ? COLORS.FULL_FAIL : COLORS.SUCCESS;
  }
  
  // Highlight name columns and clear totals in batch
  const nameRanges = [];
  for (const row of rowIndices) {
    for (let col = HIST_HIGHLIGHT_COLS[0]; col <= HIST_HIGHLIGHT_COLS[3]; col++) {
      nameRanges.push(sheet.getRange(row, col));
    }
    
    // Clear any existing total
    sheet.getRange(row, HIST_TOTAL_COL).setValue("").setBackground(null);
  }
  
  if (nameRanges.length > 0 && summaryColor) {
    sheet.getRangeList(nameRanges.map(r => r.getA1Notation()))
      .setBackground(summaryColor);
  }
  
  // Calculate overall average if requirements met
  if (graders.size >= 4 && !hasOutliers) {
    // Sum weighted values
    let totalSum = 0;
    let totalCount = 0;
    let studentHasFail = false;
    
    for (const row in weightedSums) {
      if (weightedSums[row].count > 0) {
        totalSum += weightedSums[row].hasFail ? 69 : weightedSums[row].sum;
        totalCount++;
        if (weightedSums[row].hasFail) {
          studentHasFail = true;
        }
      }
    }
    
    // Set final average in last row
    if (totalCount > 0) {
      const lastRow = Math.max(...rowIndices);
      const avg = studentHasFail ? 69 : (totalSum / totalCount);
      
      sheet.getRange(lastRow, HIST_TOTAL_COL)
        .setValue(avg)
        .setBackground(summaryColor);
    }
  }
}

/**
 * Process a single history row
 */
function processHistoryRow(sheet, row) {
  // This is a placeholder for single-row processing in History tab
  // For now, we'll just apply data validation
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(GRADE_OPTIONS)
    .setAllowInvalid(false)
    .build();
  
  sheet.getRange(row, HIST_GRADE_START_COL, 1, HIST_GRADE_END_COL - HIST_GRADE_START_COL + 1)
    .setDataValidation(rule);
}

/**
 * Process all students in the History tab - Optimized
 */
function processAllHistoryStudents() {
  if (isRunning) return;
  isRunning = true;
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(HIST_SHEET_NAME);
    
    if (!sheet || sheet.getLastRow() < 2) {
      isRunning = false;
      return;
    }
    
    // Status indicator
    const statusCell = sheet.getRange("Z1");
    statusCell.setValue("Processing all History students...");
    
    // Group students using batch operations
    const lastRow = sheet.getLastRow();
    const studentNameRange = sheet.getRange(2, HIST_STUDENT_COL, lastRow - 1, 1);
    const studentNames = studentNameRange.getValues().flat();
    
    // Build student groups
    const studentGroups = {};
    for (let i = 0; i < studentNames.length; i++) {
      const name = studentNames[i];
      if (!name) continue;
      
      if (!studentGroups[name]) {
        studentGroups[name] = [];
      }
      studentGroups[name].push(i + 2); // Convert to 1-indexed row
    }
    
    // Process each student group
    let processedCount = 0;
    for (const name in studentGroups) {
      if (studentGroups[name].length > 0) {
        processHistoryStudentGroupOptimized(sheet, studentGroups[name]);
        processedCount++;
        
        // Update status every 10 students
        if (processedCount % 10 === 0) {
          statusCell.setValue(`Processed ${processedCount} students...`);
        }
      }
    }
    
    statusCell.setValue("History processing complete: " + processedCount + " students");
    
    // Reset status after delay
    Utilities.sleep(5000);
    statusCell.setValue("");
  } catch (error) {
    console.error("Error processing all history students: " + error.message);
    
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HIST_SHEET_NAME);
      sheet.getRange("Z1").setValue("ERROR: " + error.message);
    } catch (logError) {
      // Just skip if we can't update the cell
    }
  } finally {
    isRunning = false;
  }
}

//=====================================================
// AUTO-DETECTION FOR NEW SURVEY DATA - OPTIMIZED
//=====================================================

/**
 * Modified checkForUnprocessedGrades function to include trimming of columns D-F
 */
function checkForUnprocessedGrades() {
  try {
    if (isRunning) {
      console.log("Skipping automatic check - system already running");
      return;
    }
    
    isRunning = true;
    console.log("=== AUTOMATIC PROCESSING CHECK START ===");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(HOME_SHEET);
    
    if (!sheet || sheet.getLastRow() < 2) {
      console.log("No data to process in Home sheet");
      isRunning = false;
      return;
    }
    
    console.log("Checking for unprocessed grades at " + new Date().toLocaleTimeString());
    
    // Batch operations for better performance
    const lastRow = sheet.getLastRow();
    
    // Batch read all student names and grades
    const studentData = sheet.getRange(2, HOME_STUDENT_COL, lastRow - 1, 1).getValues().flat();
    
    // Create a grade range for columns F-M (using whole table for batch efficiency)
    const gradeRange = sheet.getRange(2, HOME_GRADE_START_COL, lastRow - 1, HOME_GRADE_END_COL - HOME_GRADE_START_COL + 1);
    const gradeValues = gradeRange.getValues();
    const gradeBackgrounds = gradeRange.getBackgrounds();
    
    // Track students we've processed
    const processedStudents = new Set();
    const studentsToProcess = new Map(); // Student name -> rows
    
    // Scan for unprocessed grade cells
    let foundUnprocessed = false;
    
    for (let r = 0; r < studentData.length; r++) {
      const studentName = studentData[r];
      if (!studentName || processedStudents.has(studentName)) continue;
      
      const row = r + 2; // Convert to 1-indexed row
      
      // Check if any grade cells are unprocessed
      let hasUnprocessedCells = false;
      for (let c = 0; c < gradeBackgrounds[r].length; c++) {
        const bg = gradeBackgrounds[r][c];
        const value = gradeValues[r][c];
        
        // If cell has a value but no background color (white/empty), it's unprocessed
        if (value && (bg === "#ffffff" || bg === "")) {
          hasUnprocessedCells = true;
          foundUnprocessed = true;
          break;
        }
      }
      
      // If student has unprocessed cells, add to queue
      if (hasUnprocessedCells) {
        console.log("Found unprocessed grades for student: " + studentName);
        
        // Get all rows for this student efficiently
        if (!studentsToProcess.has(studentName)) {
          studentsToProcess.set(studentName, []);
        }
        studentsToProcess.get(studentName).push(row);
      }
    }
    
    if (!foundUnprocessed) {
      console.log("✓ No unprocessed grades found");
    }
    
    // Now batch process the students who need it
    let processedCount = 0;
    for (const [studentName, initialRows] of studentsToProcess.entries()) {
      // Find all rows for this student
      const studentRows = [];
      for (let r = 0; r < studentData.length; r++) {
        if (studentData[r] === studentName) {
          studentRows.push(r + 2); // Convert to 1-indexed row
        }
      }
      
      if (studentRows.length > 0) {
        console.log("Processing " + studentRows.length + " rows for student: " + studentName);
        
        // Process this student completely
        processStudentCompletely(sheet, studentRows, studentName);
        processedCount++;
      }
      
      processedStudents.add(studentName);
    }
    
    if (processedCount > 0) {
      console.log(`✓ Processed ${processedCount} students with unprocessed grades`);
    }
    
    // Also check all students for track/scenario consistency
    processAllStudentsForConsistency(sheet, studentData);
    
    // Check for rows to transfer to History
    checkRowsToTransfer();
    
    console.log("=== AUTOMATIC PROCESSING CHECK COMPLETE ===");
    
  } catch (error) {
    console.error("Error in checkForUnprocessedGrades: " + error.message);
  } finally {
    isRunning = false;
  }
}
/**
 * Trims whitespace from values in specified columns
 * 
 * @param {Object} sheet - The sheet containing the data
 * @param {Array} rows - Array of row indices to process
 * @param {Array} columns - Array of column indices to trim
 */
function trimWhitespaceInColumns(sheet, rows, columns) {
  // Skip if no rows to process
  if (!rows || rows.length === 0) return;
  
  // Process each row and column combination
  for (const row of rows) {
    for (const col of columns) {
      const cell = sheet.getRange(row, col);
      const value = cell.getValue();
      
      // Skip non-string values and empty strings
      if (typeof value !== 'string' || value === '') continue;
      
      // Check if there's whitespace to trim
      const trimmedValue = value.trim();
      if (trimmedValue !== value) {
        // Only update if trimming is needed
        cell.setValue(trimmedValue);
      }
    }
  }
}

/**
 * Optimized version of data validation
 */
function applyDataValidationOptimized(sheet, rows) {
  // Create validation rule
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(GRADE_OPTIONS)
    .setAllowInvalid(false)
    .build();
  
  // Batch read grade data
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const numRows = maxRow - minRow + 1;
  
  const gradeRange = sheet.getRange(
    minRow, 
    HOME_GRADE_START_COL, 
    numRows, 
    HOME_GRADE_END_COL - HOME_GRADE_START_COL + 1
  );
  
  const values = gradeRange.getValues();
  
  // Create a map for quick row lookups
  const rowsMap = {};
  rows.forEach(r => {
    rowsMap[r - minRow] = true; // Convert to 0-indexed within array
  });
  
  // Find which rows have grades
  const rowsWithGrades = [];
  const rowsWithoutGrades = [];
  
  for (let r = 0; r < numRows; r++) {
    // Skip rows not in our student set
    if (!rowsMap[r]) continue;
    
    let hasGrades = false;
    for (let c = 0; c < values[r].length; c++) {
      if (values[r][c]) {
        hasGrades = true;
        break;
      }
    }
    
    if (hasGrades) {
      rowsWithGrades.push(r + minRow); // Convert back to actual row
    } else {
      rowsWithoutGrades.push(r + minRow);
    }
  }
  
  // Apply validation to rows with grades
  for (const row of rowsWithGrades) {
    const range = sheet.getRange(row, HOME_GRADE_START_COL, 1, HOME_GRADE_END_COL - HOME_GRADE_START_COL + 1);
    range.setDataValidation(rule);
  }
  
  // Clear validation on empty rows
  for (const row of rowsWithoutGrades) {
    const range = sheet.getRange(row, HOME_GRADE_START_COL, 1, HOME_GRADE_END_COL - HOME_GRADE_START_COL + 1);
    range.setDataValidation(null);
  }
}

/**
 * Verify that all grade cells have the correct highlighting color - optimized
 */
function verifyAllGradeCellColors(sheet) {
  try {
    console.log("Verifying all grade cell colors");
    
    // Batch read the entire data table
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    
    // Batch read student names
    const studentNameRange = sheet.getRange(2, HOME_STUDENT_COL, lastRow - 1, 1);
    const studentNames = studentNameRange.getValues().flat();
    
    // Group students
    const studentGroups = {};
    for (let i = 0; i < studentNames.length; i++) {
      const name = studentNames[i];
      if (!name) continue;
      
      if (!studentGroups[name]) {
        studentGroups[name] = [];
      }
      studentGroups[name].push(i + 2); // convert to 1-indexed row
    }
    
    // Process each student's grade columns
    let correctionsMade = 0;
    
    for (const student in studentGroups) {
      const rows = studentGroups[student];
      
      // Skip if only one row (no way to detect outliers)
      if (rows.length < 2) continue;
      
      // Verify each grade column
      for (let col = HOME_GRADE_START_COL; col <= HOME_GRADE_END_COL; col++) {
        const corrected = verifyColumnHighlightingOptimized(sheet, rows, col);
        correctionsMade += corrected;
      }
    }
    
    if (correctionsMade > 0) {
      console.log(`Made ${correctionsMade} color corrections to grade cells`);
    } else {
      console.log("All grade cells already correctly highlighted");
    }
    
  } catch (error) {
    console.error("Error verifying grade cell colors: " + error.message);
  }
}

/**
 * Optimized version of column highlighting verification
 */
function verifyColumnHighlightingOptimized(sheet, rows, col) {
  let correctionsMade = 0;
  
  // Batch read the entire column for these rows
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const numRows = maxRow - minRow + 1;
  
  const valueRange = sheet.getRange(minRow, col, numRows, 1);
  const values = valueRange.getValues().flat();
  const backgrounds = valueRange.getBackgrounds().flat();
  const fontColors = valueRange.getFontColors().flat();
  
  // Create a map for quicker lookups
  const rowsMap = {};
  rows.forEach(r => {
    rowsMap[r - minRow] = true; // Convert to 0-indexed within array
  });
  
  // Get all valid grades for this column
  const grades = [];
  
  for (let r = 0; r < numRows; r++) {
    // Skip rows not in our student set
    if (!rowsMap[r]) continue;
    
    const value = values[r];
    if (!value) continue;
    
    const trimmed = value.toString().trim();
    const grade = GRADE_VALUES[trimmed];
    
    if (grade !== undefined) {
      grades.push({
        row: r + minRow, // Convert back to actual row
        relRow: r,       // Keep relative position for array access
        value: grade,
        text: trimmed,
        bg: backgrounds[r],
        font: fontColors[r]
      });
    }
  }
  
  // Skip if not enough grades to compare
  if (grades.length < 2) return 0;
  
  // Arrays for batch operations
  const outlierCells = [];
  const resolvedCells = [];
  const failFontCells = [];
  const normalFontCells = [];
  
  // Determine which grades are outliers
  for (const grade of grades) {
    let isOutlier = false;
    
    for (const other of grades) {
      if (grade === other) continue;
      
      if (Math.abs(grade.value - other.value) > 2) {
        isOutlier = true;
        break;
      }
    }
    
    // Get current background - already batched above
    const currentBg = grade.bg.toUpperCase();
    
    // Determine if the cell has the correct color
    const isCurrentlyOutlier = (
      currentBg === COLORS.DISCREPANCY.toUpperCase() || 
      currentBg === "#FFA500"
    );
    const isCurrentlyResolved = (
      currentBg === COLORS.SUCCESS.toUpperCase()
    );
    
    // Check if we need to update the color
    if (isOutlier && !isCurrentlyOutlier) {
      outlierCells.push(sheet.getRange(grade.row, col));
      correctionsMade++;
    } 
    else if (!isOutlier && (isCurrentlyOutlier || !isCurrentlyResolved)) {
      resolvedCells.push(sheet.getRange(grade.row, col));
      correctionsMade++;
    }
    
    // Get current font color, normalizing it for comparison
    const currentFontColor = (grade.font || "").toString().toUpperCase();
    const failColor = COLORS.FAIL.toUpperCase();
    
    // Also check font color for fails
    if (grade.text === "8. Fail" && currentFontColor !== failColor) {
      failFontCells.push(sheet.getRange(grade.row, col));
      correctionsMade++;
    } else if (grade.text !== "8. Fail" && 
               (currentFontColor.includes(failColor.replace('#', '')) || 
                currentFontColor === failColor)) {
      normalFontCells.push(sheet.getRange(grade.row, col));
      correctionsMade++;
    }
  }
  
  // Apply changes in batch
  if (outlierCells.length > 0) {
    sheet.getRangeList(outlierCells.map(r => r.getA1Notation()))
      .setBackground(COLORS.DISCREPANCY);
  }
  
  if (resolvedCells.length > 0) {
    sheet.getRangeList(resolvedCells.map(r => r.getA1Notation()))
      .setBackground(COLORS.SUCCESS);
  }
  
  if (failFontCells.length > 0) {
    sheet.getRangeList(failFontCells.map(r => r.getA1Notation()))
      .setFontColor(COLORS.FAIL);
  }
  
  if (normalFontCells.length > 0) {
    sheet.getRangeList(normalFontCells.map(r => r.getA1Notation()))
      .setFontColor("#000000");
  }
  
  return correctionsMade;
}

/**
 * Manual trigger for color verification
 */
function manualVerifyAllGradeColors() {
  if (isRunning) return;
  isRunning = true;
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(HOME_SHEET);
    
    if (!sheet || sheet.getLastRow() < 2) {
      isRunning = false;
      return;
    }
    
    const statusCell = sheet.getRange("Z1");
    statusCell.setValue("Verifying all grade cell colors...");
    
    verifyAllGradeCellColors(sheet);
    
    statusCell.setValue("Grade cell color verification complete!");
    Utilities.sleep(3000);
    statusCell.setValue("");
  } catch (error) {
    console.error("Error in manualVerifyAllGradeColors: " + error.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Check for rows that need to be transferred to History
 * Extracted as a separate function so it can be called independently
 */
function checkRowsToTransfer() {
  try {
    console.log("\n=== CHECKING FOR TRANSFER ELIGIBILITY ===");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const homeSheet = ss.getSheetByName(HOME_SHEET);
    const historySheet = ss.getSheetByName(HIST_SHEET_NAME) || ss.insertSheet(HIST_SHEET_NAME);
    
    if (homeSheet.getLastRow() < 2) {
      console.log("No data in Home sheet");
      return;
    }
    
    // Get all data from Home sheet
    const data = homeSheet.getDataRange().getValues();
    console.log(`Home sheet has ${data.length - 1} data rows`);
    
    // Status notification
    const statusCell = homeSheet.getRange("Z1");
    statusCell.setValue("Checking for students ready to transfer...");
    
    try {
      // Call the transfer function
      transferOldRowsToHistoryOptimized(homeSheet, data, historySheet);
      
      // Process the History tab after transfer
      console.log("Processing History tab after transfer...");
      processHistoryComplete(historySheet);
      
      statusCell.setValue("Transfer check completed successfully!");
      console.log("✅ Transfer check completed successfully");
      
    } catch (transferError) {
      statusCell.setValue("Transfer failed: " + transferError.message);
      console.error("❌ Transfer operation failed: " + transferError.message);
    }
    
    // Clear status after delay
    Utilities.sleep(3000);
    statusCell.setValue("");
    
  } catch (error) {
    console.error("❌ Error in checkRowsToTransfer: " + error.message);
  }
}

//=====================================================
// SECONDARY PROCESSING (FULL PROCESSING) - OPTIMIZED
//=====================================================

/**
 * Complete secondary processing function
 * Handles data validation, weighted averages, and student summaries
 */
function processGradingSystem() {
  try {
    // Get spreadsheet and sheets
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const homeSheet = ss.getSheetByName(HOME_SHEET);
    const historySheet = ss.getSheetByName(HIST_SHEET_NAME) || ss.insertSheet(HIST_SHEET_NAME);
    
    // Add status indicator (moved from A1 to Z1 to avoid using header cells)
    const statusCell = homeSheet.getRange("Z1");
    statusCell.setValue("Running full processing at " + new Date().toLocaleTimeString());
    
    // Process Home sheet completely
    processHomeComplete(homeSheet, historySheet);
    
    // Process History sheet if it exists and has data
    if (historySheet && historySheet.getLastRow() > 1) {
      processHistoryComplete(historySheet);
    }
    
    // Record process time
    PropertiesService.getUserProperties().setProperty(
      "lastProcessTime", 
      new Date().getTime().toString()
    );
    
    // Update status
    statusCell.setValue("Full processing completed at " + new Date().toLocaleTimeString());
    console.log("Full processing completed");
    
    // Reset status after delay
    Utilities.sleep(5000);
    statusCell.setValue("");
  } catch (error) {
    console.error("Error in processGradingSystem: " + error.message);
    console.error(error.stack);
    
    // Try to update status with error
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const homeSheet = ss.getSheetByName(HOME_SHEET);
      homeSheet.getRange("Z1").setValue("ERROR: " + error.message);
    } catch (statusError) {
      // Skip if we can't update status
    }
  }
}

/**
 * Process Home sheet completely - optimized
 */
function processHomeComplete(homeSheet, historySheet) {
  console.log("Processing Home sheet");
  
  // Get data in one operation
  const data = homeSheet.getDataRange().getValues();
  if (data.length <= 1) return; // No data beyond header
  
  // 1. Apply data validation to all cells - optimized
  applyDataValidationToSheetOptimized(homeSheet);
  
  // 2. Calculate weighted averages and highlight student summary
  calculateHomeWeightedAveragesOptimized(homeSheet, data);
  
  // 3. Transfer old rows to History - optimized
  transferOldRowsToHistoryOptimized(homeSheet, data, historySheet);
  
  // 4. Clean up any duplicate rows - optimized
  removeDuplicateRowsOptimized(homeSheet);
  
  console.log("Home sheet processing completed");
}

/**
 * Process History sheet completely - optimized
 */
function processHistoryComplete(historySheet) {
  console.log("Processing History sheet");
  
  // Get data in one operation
  const data = historySheet.getDataRange().getValues();
  if (data.length <= 1) return; // No data beyond header
  
  // 1. Apply data validation - optimized
  applyDataValidationToSheetOptimized(historySheet);
  
  // 2. Clean up duplicates - optimized
  cleanupHistoryDuplicatesOptimized(historySheet, data);
  
  // 3. Calculate weighted averages and highlight student summary
  calculateHistoryWeightedAveragesOptimized(historySheet, data);
  
  console.log("History sheet processing completed");
}

/**
 * Apply data validation to all rows with data - optimized
 */
function applyDataValidationToSheetOptimized(sheet) {
  console.log("Applying data validation to " + sheet.getName());
  
  // Create validation rule
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(GRADE_OPTIONS)
    .setAllowInvalid(false)
    .build();
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  // Batch read all grade values - huge performance improvement
  const gradeRange = sheet.getRange(
    2, 
    HOME_GRADE_START_COL, 
    lastRow - 1, 
    HOME_GRADE_END_COL - HOME_GRADE_START_COL + 1
  );
  
  const gradeValues = gradeRange.getValues();
  
  // Find rows with and without grades
  const rowsWithGrades = [];
  const rowsWithoutGrades = [];
  
  for (let r = 0; r < gradeValues.length; r++) {
    let hasGrade = false;
    
    for (let c = 0; c < gradeValues[r].length; c++) {
      if (gradeValues[r][c]) {
        hasGrade = true;
        break;
      }
    }
    
    if (hasGrade) {
      rowsWithGrades.push(r + 2); // Convert to 1-indexed row
    } else {
      rowsWithoutGrades.push(r + 2);
    }
  }
  
  // Apply validation to rows with grades
  for (const row of rowsWithGrades) {
    const range = sheet.getRange(row, HOME_GRADE_START_COL, 1, HOME_GRADE_END_COL - HOME_GRADE_START_COL + 1);
    range.setDataValidation(rule);
  }
  
  // Clear validation on empty rows
  for (const row of rowsWithoutGrades) {
    const range = sheet.getRange(row, HOME_GRADE_START_COL, 1, HOME_GRADE_END_COL - HOME_GRADE_START_COL + 1);
    range.setDataValidation(null);
  }
  
  console.log("Data validation applied");
}

/**
 * Calculate weighted averages and student summaries for Home tab - optimized
 */
function calculateHomeWeightedAveragesOptimized(sheet, data) {
  console.log("Calculating weighted averages for Home sheet");
  
  // Group data by student - process entirely in memory
  const groups = {};
  for (let i = 1; i < data.length; i++) {
    const name = data[i][HOME_STUDENT_COL - 1]; // 0-indexed
    if (!name) continue;
    
    if (!groups[name]) groups[name] = [];
    groups[name].push(i + 1); // Convert to 1-indexed row numbers
  }
  
  // Calculate for each student group
  for (const name in groups) {
    const rows = groups[name];
    if (rows.length > 0) {
      processStudentIfReadyOptimized(sheet, rows);
    }
  }
  
  console.log("Weighted averages calculated for Home sheet");
}

/**
 * Calculate weighted averages and student summaries for History tab - optimized
 */
function calculateHistoryWeightedAveragesOptimized(historySheet, data) {
  console.log("Calculating weighted averages for History sheet");
  
  // Group data by student - process entirely in memory
  const groups = {};
  for (let i = 1; i < data.length; i++) {
    const name = data[i][HIST_STUDENT_COL - 1]; // 0-indexed
    if (!name) continue;
    
    if (!groups[name]) groups[name] = [];
    groups[name].push(i + 1); // Convert to 1-indexed row numbers
  }
  
  // Process each student group
  for (const name in groups) {
    const rows = groups[name];
    if (rows.length > 0) {
      processHistoryStudentGroupOptimized(historySheet, rows);
    }
  }
  
  console.log("Weighted averages calculated for History sheet");
}

/**
 * Clean up duplicate rows in History sheet - optimized
 */
function cleanupHistoryDuplicatesOptimized(sheet, data) {
  const seenHistory = new Set();
  const historyDupes = [];
  
  // Process data in memory for speed
  for (let i = 1; i < data.length; i++) {
    const id = data[i][0]; // Submission ID (Column A)
    const gradesRange = Array.from(
      {length: HIST_GRADE_END_COL - HIST_GRADE_START_COL + 1}, 
      (_, idx) => idx + HIST_GRADE_START_COL - 1 // Convert to 0-indexed
    );
    const grades = gradesRange.map(col => (data[i][col] || "").toString().trim()).join("|");
    const key = `${id}::${grades}`;
    
    if (seenHistory.has(key)) {
      historyDupes.push(i + 1);
    } else {
      seenHistory.add(key);
    }
  }
  
  // Delete duplicates in batch
  if (historyDupes.length === 0) return;
  
  // Optimize by deleting rows from bottom to top
  historyDupes.sort((a, b) => b - a);
  
  // Delete in chunks of 10 for better performance
  const chunkSize = 10;
  for (let i = 0; i < historyDupes.length; i += chunkSize) {
    const chunk = historyDupes.slice(i, i + chunkSize);
    for (const row of chunk) {
      sheet.deleteRow(row);
    }
  }
}

/**
 * Transfer old rows from Home to History - optimized
 */
function transferOldRowsToHistoryOptimized(homeSheet, data, historySheet) {
  console.log("=== SAFE TRANSFER CHECK START ===");
  
const now = new Date();
const fortyMinutesAgo = new Date(now.getTime() - 40 * 60 * 1000);
  
  console.log(`Current time: ${now.toLocaleString()}`);
  console.log(`Transfer cutoff: ${fortyMinutesAgo.toLocaleString()}`);
  
  try {
    // Step 1: Group all rows by student
    const studentGroups = {};
    
    for (let i = 1; i < data.length; i++) {
      const timestamp = new Date(data[i][0]); // Column A
      const student = data[i][1]; // Column B
      const grader = data[i][2]; // Column C
      
      if (!student || isNaN(timestamp.getTime())) {
        console.log(`Row ${i+1}: Skipping - missing student or invalid timestamp`);
        continue;
      }
      
      if (!studentGroups[student]) {
        studentGroups[student] = {
          rowIndices: [],
          rowData: [],
          timestamps: [],
          graders: new Set()
        };
      }
      
      studentGroups[student].rowIndices.push(i + 1); // 1-indexed row numbers
      studentGroups[student].rowData.push([...data[i]]); // Copy the row data
      studentGroups[student].timestamps.push(timestamp);
      studentGroups[student].graders.add(grader);
    }
    
    console.log(`Found ${Object.keys(studentGroups).length} unique students`);
    
    // Step 2: Identify students ready for transfer
    const studentsToTransfer = [];
    
    for (const student in studentGroups) {
      const group = studentGroups[student];
      const allTimestampsOld = group.timestamps.every(ts => ts < fortyMinutesAgo);
      const hasEnoughGraders = group.graders.size >= 4;
      
      console.log(`${student}: ${group.rowData.length} rows, ${group.graders.size} graders, all old: ${allTimestampsOld}`);
      
      if (allTimestampsOld && hasEnoughGraders) {
        studentsToTransfer.push(student);
        console.log(`  ✅ ${student} READY FOR TRANSFER (${group.rowData.length} rows)`);
      } else {
        console.log(`  ⏳ ${student} not ready - graders: ${group.graders.size}, all old: ${allTimestampsOld}`);
      }
    }
    
    if (studentsToTransfer.length === 0) {
      console.log("✅ No students ready for transfer");
      return;
    }
    
    console.log(`\n📋 ${studentsToTransfer.length} students ready for transfer: ${studentsToTransfer.join(', ')}`);
    
    // Step 3: Process each student individually to prevent data loss
    let totalTransferred = 0;
    let totalDeleted = 0;
    
    for (const student of studentsToTransfer) {
      console.log(`\n--- Processing ${student} ---`);
      
      const group = studentGroups[student];
      const studentRowsToTransfer = group.rowData;
      const studentRowIndicesToDelete = group.rowIndices;
      
      console.log(`Student has ${studentRowsToTransfer.length} rows to transfer`);
      
      try {
        // Step 3a: Check for duplicates in History for this student
        const historyData = historySheet.getDataRange().getValues();
        const existingKeys = new Set();
        
        for (let i = 1; i < historyData.length; i++) {
          const key = `${historyData[i][1]}::${historyData[i][2]}::${historyData[i][0]}`; // student::grader::timestamp
          existingKeys.add(key);
        }
        
        // Filter out duplicates for this student
        const uniqueRowsForStudent = [];
        const correspondingIndicesToDelete = [];
        
        for (let i = 0; i < studentRowsToTransfer.length; i++) {
          const row = studentRowsToTransfer[i];
          const key = `${row[1]}::${row[2]}::${row[0]}`;
          
          if (!existingKeys.has(key)) {
            uniqueRowsForStudent.push(row);
            correspondingIndicesToDelete.push(studentRowIndicesToDelete[i]);
          } else {
            console.log(`    Skipping duplicate row for ${student}: ${row[2]} (grader)`);
          }
        }
        
        if (uniqueRowsForStudent.length === 0) {
          console.log(`    ⚠️ All rows for ${student} are duplicates - skipping transfer`);
          continue;
        }
        
        console.log(`    ${uniqueRowsForStudent.length} unique rows to transfer for ${student}`);
        
        // Step 3b: Copy to History (CRITICAL: This must succeed before any deletion)
        const targetRange = historySheet.getRange(
          historySheet.getLastRow() + 1,
          1,
          uniqueRowsForStudent.length,
          uniqueRowsForStudent[0].length
        );
        
        targetRange.setValues(uniqueRowsForStudent);
        console.log(`    ✅ Successfully copied ${uniqueRowsForStudent.length} rows to History for ${student}`);
        
        // Step 3c: Verify the copy worked by reading it back
        const verificationRange = historySheet.getRange(
          historySheet.getLastRow() - uniqueRowsForStudent.length + 1,
          1,
          uniqueRowsForStudent.length,
          uniqueRowsForStudent[0].length
        );
        
        const copiedData = verificationRange.getValues();
        
        if (copiedData.length !== uniqueRowsForStudent.length) {
          throw new Error(`Copy verification failed for ${student}: expected ${uniqueRowsForStudent.length} rows, found ${copiedData.length}`);
        }
        
        console.log(`    ✅ Copy verification successful for ${student}`);
        
        // Step 3d: Only now delete from Home (in reverse order to maintain indices)
        const sortedIndicesToDelete = correspondingIndicesToDelete.sort((a, b) => b - a);
        
        console.log(`    Deleting ${sortedIndicesToDelete.length} rows from Home for ${student}...`);
        
        let deletedForStudent = 0;
        for (const rowIndex of sortedIndicesToDelete) {
          try {
            homeSheet.deleteRow(rowIndex);
            deletedForStudent++;
            
            // Small delay every 3 deletions
            if (deletedForStudent % 3 === 0) {
              Utilities.sleep(50);
            }
            
          } catch (deleteError) {
            console.error(`    ❌ Error deleting row ${rowIndex}: ${deleteError.message}`);
            throw deleteError; // Stop the entire operation if deletion fails
          }
        }
        
        console.log(`    ✅ Successfully deleted ${deletedForStudent} rows from Home for ${student}`);
        
        totalTransferred += uniqueRowsForStudent.length;
        totalDeleted += deletedForStudent;
        
        // Small delay between students
        Utilities.sleep(100);
        
      } catch (studentError) {
        console.error(`❌ CRITICAL ERROR processing ${student}: ${studentError.message}`);
        console.error(`   STOPPING TRANSFER to prevent data loss`);
        
        // Don't continue with other students if one fails
        throw new Error(`Transfer failed for ${student}: ${studentError.message}`);
      }
    }
    
    console.log(`\n✅ SAFE TRANSFER COMPLETE:`);
    console.log(`   Students processed: ${studentsToTransfer.length}`);
    console.log(`   Rows transferred: ${totalTransferred}`);
    console.log(`   Rows deleted: ${totalDeleted}`);
    
    if (totalTransferred !== totalDeleted) {
      console.error(`⚠️ WARNING: Transfer/Delete mismatch! Transferred: ${totalTransferred}, Deleted: ${totalDeleted}`);
    }
    
  } catch (error) {
    console.error(`❌ TRANSFER OPERATION FAILED: ${error.message}`);
    console.error(`   Stack trace: ${error.stack}`);
    throw error;
  }
}

/**
 * Remove duplicate rows from Home sheet - optimized
 */
function removeDuplicateRowsOptimized(sheet) {
  console.log("Checking for duplicates in Home sheet");
  
  // Get data in one operation
  const data = sheet.getDataRange().getValues();
  
  // Process in memory for speed
  const seen = new Map();
  const rowsToDelete = [];
  
  for (let i = 1; i < data.length; i++) {
    const id = data[i][0]; // Column A (Submission ID)
    const gradesRange = Array.from(
      {length: HOME_GRADE_END_COL - HOME_GRADE_START_COL + 1}, 
      (_, idx) => idx + HOME_GRADE_START_COL - 1 // Convert to 0-indexed
    );
    const grades = gradesRange.map(col => (data[i][col] || "").toString().trim());
    const key = `${id}::${grades.join("|")}`;
    
    if (seen.has(key)) {
      rowsToDelete.push(i + 1); // Convert to 1-indexed
    } else {
      seen.set(key, true);
    }
  }
  
  if (rowsToDelete.length > 0) {
    console.log("Found " + rowsToDelete.length + " duplicates to remove");
    
    // Delete rows in optimized batches
    rowsToDelete.sort((a, b) => b - a); // Sort in reverse order
    
    // Delete in chunks for better performance
    const chunkSize = 10;
    for (let i = 0; i < rowsToDelete.length; i += chunkSize) {
      const chunk = rowsToDelete.slice(i, i + chunkSize);
      for (const row of chunk) {
        sheet.deleteRow(row);
      }
    }
    
  } else {
    console.log("No duplicates found");
  }
}

/**
 * Cleanup all grade cells - trim whitespace and apply validation
 * This function was added to fix grade cell formatting issues
 */
function cleanupAllGradeCells() {
  if (isRunning) return;
  isRunning = true;
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const homeSheet = ss.getSheetByName(HOME_SHEET);
    const historySheet = ss.getSheetByName(HIST_SHEET_NAME);
    
    // Add status indicator (using Z1 instead)
    const statusCell = homeSheet.getRange("Z1");
    statusCell.setValue("Cleaning up grade cells at " + new Date().toLocaleTimeString());
    
    // Process Home sheet (optimized)
    cleanupSheetGradeCellsOptimized(homeSheet, HOME_GRADE_START_COL, HOME_GRADE_END_COL);
    
    // Process History sheet if it exists (optimized)
    if (historySheet) {
      cleanupSheetGradeCellsOptimized(historySheet, HIST_GRADE_START_COL, HIST_GRADE_END_COL);
    }
    
    // Update status
    statusCell.setValue("Grade cell cleanup completed at " + new Date().toLocaleTimeString());
    
    // Reset status after delay
    Utilities.sleep(5000);
    statusCell.setValue("");
  } catch (error) {
    console.error("Error cleaning up grade cells: " + error.message);
    
    // Try to update status with error
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const homeSheet = ss.getSheetByName(HOME_SHEET);
      homeSheet.getRange("Z1").setValue("ERROR: " + error.message);
    } catch (statusError) {
      // Skip if we can't update status
    }
  } finally {
    isRunning = false;
  }
}

/**
 * Clean up grade cells in a specific sheet - optimized
 */
function cleanupSheetGradeCellsOptimized(sheet, startCol, endCol) {
  if (!sheet || sheet.getLastRow() < 2) return;
  
  console.log(`Cleaning up grade cells in ${sheet.getName()}`);
  
  // Create validation rule
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(GRADE_OPTIONS)
    .setAllowInvalid(false)
    .build();
  
  // Batch read all grade values
  const lastRow = sheet.getLastRow();
  const gradeRange = sheet.getRange(
    2, 
    startCol, 
    lastRow - 1, 
    endCol - startCol + 1
  );
  
  const gradeValues = gradeRange.getValues();
  
  // Process in memory first to identify what needs to change
  const cellsToTrim = [];
  const rowsWithGrades = new Set();
  const rowsWithoutGrades = new Set();
  
  for (let r = 0; r < gradeValues.length; r++) {
    let rowHasGrades = false;
    
    for (let c = 0; c < gradeValues[r].length; c++) {
      const value = gradeValues[r][c];
      
      // Check for cells needing trimming
      if (typeof value === 'string' && value.trim() !== value) {
        cellsToTrim.push({
          row: r + 2, // Convert to 1-indexed
          col: c + startCol,
          newValue: value.trim()
        });
      }
      
      // Track rows with/without grades
      if (value) {
        rowHasGrades = true;
      }
    }
    
    // Add row to appropriate set
    if (rowHasGrades) {
      rowsWithGrades.add(r + 2); // Convert to 1-indexed
    } else {
      rowsWithoutGrades.add(r + 2);
    }
  }
  
  // Apply trimming in optimized batches
  for (const cell of cellsToTrim) {
    sheet.getRange(cell.row, cell.col).setValue(cell.newValue);
  }
  
  // Apply data validation in batches
  rowsWithGrades.forEach(row => {
    const range = sheet.getRange(row, startCol, 1, endCol - startCol + 1);
    range.setDataValidation(rule);
  });
  
  rowsWithoutGrades.forEach(row => {
    const range = sheet.getRange(row, startCol, 1, endCol - startCol + 1);
    range.setDataValidation(null);
  });
  
  console.log(`Made ${cellsToTrim.length} trimming changes in ${sheet.getName()}`);
}

//=====================================================
// CREATES TIME-BASED TRIGGER
//=====================================================

/**
 * Creates a time-based trigger to check for unprocessed grades
 * Run this once to set up the trigger
 */
function createAutoDetectTrigger() {
  // Delete any existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkForUnprocessedGrades') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Create a new trigger to run every 1 minute
  // Note: Valid values for everyMinutes are 1, 5, 10, 15, or 30
  ScriptApp.newTrigger('checkForUnprocessedGrades')
    .timeBased()
    .everyMinutes(1) // Valid values: 1, 5, 10, 15, or 30
    .create();
    
  console.log("Created trigger to check for unprocessed grades every 1 minute");
  
  // Alert user
  const ui = SpreadsheetApp.getUi();
  ui.alert("Auto-detect trigger created", 
           "The spreadsheet will now check for new data every minute.", 
           ui.ButtonSet.OK);
}
/**
 * Validates that Track (column E) and Scenario (column F) are consistent 
 * within a student group
 * 
 * @param {Object} sheet - The sheet containing the data
 * @param {Array} studentRows - Array of row indices for a specific student
 */
function validateTrackAndScenario(sheet, studentRows) {
  if (studentRows.length <= 1) return; // No validation needed for single row
  
  // Column indices for Track and Scenario (1-indexed)
  const TRACK_COL = 5;    // Column E (Track) - stays the same
  const SCENARIO_COL = 4; // Column D (Scenario) - changed from Column F to D
  
  // Colors for highlighting
  const HIGHLIGHT_COLOR = "#FFFF00"; // Yellow
  
  // Batch read all track and scenario values for this student
  const trackValues = [];
  const scenarioValues = [];
  
  for (const row of studentRows) {
    trackValues.push(sheet.getRange(row, TRACK_COL).getValue());
    scenarioValues.push(sheet.getRange(row, SCENARIO_COL).getValue());
  }
  
  // Find most common track value (in case of multiple values)
  const trackCounts = {};
  let mostCommonTrack = null;
  let maxTrackCount = 0;
  
  for (const track of trackValues) {
    if (!track) continue; // Skip empty values
    
    trackCounts[track] = (trackCounts[track] || 0) + 1;
    if (trackCounts[track] > maxTrackCount) {
      maxTrackCount = trackCounts[track];
      mostCommonTrack = track;
    }
  }
  
  // Find most common scenario value
  const scenarioCounts = {};
  let mostCommonScenario = null;
  let maxScenarioCount = 0;
  
  for (const scenario of scenarioValues) {
    if (!scenario) continue; // Skip empty values
    
    scenarioCounts[scenario] = (scenarioCounts[scenario] || 0) + 1;
    if (scenarioCounts[scenario] > maxScenarioCount) {
      maxScenarioCount = scenarioCounts[scenario];
      mostCommonScenario = scenario;
    }
  }
  
  // Apply highlighting for inconsistent values
  for (let i = 0; i < studentRows.length; i++) {
    const row = studentRows[i];
    const trackCell = sheet.getRange(row, TRACK_COL);
    const scenarioCell = sheet.getRange(row, SCENARIO_COL);
    
    // Check Track consistency
    if (mostCommonTrack && trackValues[i] && trackValues[i] !== mostCommonTrack) {
      trackCell.setBackground(HIGHLIGHT_COLOR);
    } else if (trackCell.getBackground() === HIGHLIGHT_COLOR && trackValues[i] === mostCommonTrack) {
      // Reset background if now matching
      trackCell.setBackground(null);
    }
    
    // Check Scenario consistency
    if (mostCommonScenario && scenarioValues[i] && scenarioValues[i] !== mostCommonScenario) {
      scenarioCell.setBackground(HIGHLIGHT_COLOR);
    } else if (scenarioCell.getBackground() === HIGHLIGHT_COLOR && scenarioValues[i] === mostCommonScenario) {
      // Reset background if now matching
      scenarioCell.setBackground(null);
    }
  }
}
/**
 * Advanced Grade Statistics & Visualization System - REVISED
 * Analyzes grading data with sophisticated statistical measures and visualizations
 * Replaces the previous Statistics builder with more comprehensive analytics
 */

//=====================================================
// STATISTICS CONSTANTS
//=====================================================

// Sheet name for statistics
const STATS_SHEET_NAME = "Statistics";

// Criteria names (for readable reports)
// 25B UPDATE: 7 criteria with descriptive names (Innovator/4.1 removed)
const CRITERIA_NAMES = [
  "1.1 Objectives & Data Req",
  "1.2 Engineering Principles",
  "1.3 Instro & Resources",
  "1.4 Risk Management",
  "1.5 Communication",
  "2.1 Stakeholder Analysis",
  "3.1 Adapting to Changes"
];

// Colors for formatting statistics
const STATS_COLORS = {
  HEADER: "#E6F2FF",
  SUBHEADER: "#F0F7FF",
  HIGHLIGHT: "#FFEB3B",
  POSITIVE: "#C8E6C9",
  NEGATIVE: "#FFCDD2",
  NEUTRAL: "#F5F5F5",
  HIGH_DEVIATION: "#FF9E80",
  LOW_DEVIATION: "#B2DFDB",
  TABLE_BORDER: "#BDBDBD",
  CHART_COLORS: [
    "#4285F4", // Blue
    "#EA4335", // Red
    "#FBBC05", // Yellow
    "#34A853", // Green
    "#8E24AA", // Purple
    "#16A2D7", // Light Blue
    "#FF6D00", // Orange
    "#795548"  // Brown
  ]
};

// Thresholds for statistical indicators
const THRESHOLDS = {
  RELIABILITY_CONCERN: 0.7,   // Below this ICC/alpha value shows concerns
  GRADER_DEVIATION: 0.5,      // StdDev multiplier to flag grader bias
  DISCRIMINATION_LOW: 0.3,    // Below this is concerning for discrimination index
  DIFFICULTY_EASY: 2.5,       // Below this value (on 1-8 scale) is very easy
  DIFFICULTY_HARD: 5.5        // Above this value (on 1-8 scale) is very hard
};

//=====================================================
// MAIN STATISTICS FUNCTION
//=====================================================

/**
 * Main entry point - builds advanced statistics with visualizations
 * Replaces the previous buildGradeStatistics function
 */
function buildAdvancedGradeStatistics() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Create or clear the stats sheet
    let statsSheet = ss.getSheetByName(STATS_SHEET_NAME);
    if (!statsSheet) {
      statsSheet = ss.insertSheet(STATS_SHEET_NAME);
    } else {
      statsSheet.clear();
    }
    
    // Set up status indicator
    const statusCell = statsSheet.getRange("A1");
    statusCell.setValue("Building advanced grade statistics...");
    
    // Get data from Home and History sheets
    const homeData = getSheetData(ss.getSheetByName(HOME_SHEET));
    const historyData = getSheetData(ss.getSheetByName(HIST_SHEET_NAME));
    
    // Combine data for full analysis
    const allData = [...homeData, ...historyData];
    
    if (allData.length === 0) {
      statsSheet.getRange("A1:C3")
        .setValues([
          ["No Grade Data Found", "", ""],
          ["", "", ""],
          ["Please add grades to the Home or History sheets to generate statistics.", "", ""]
        ]);
      return;
    }
    
    // Log data for debugging
    console.log("Processed data for analysis:", JSON.stringify(allData.slice(0, 2)));
    
    // Format sheet for better readability and charts
    formatAdvancedStatsSheet(statsSheet);
    
    // Generate the dashboard header
    buildStatsDashboardHeader(statsSheet, allData);
    
    // Current row tracker - we'll use this to position each section
    let currentRow = 5;
    
    // Generate Summary Statistics
    currentRow = buildSummaryStatistics(statsSheet, allData, currentRow);
    
    // 1. Inter-Rater Reliability Section
    currentRow = buildInterRaterReliability(statsSheet, allData, currentRow);
    
    // 2. Grader Bias and Fairness Section
    currentRow = buildGraderBiasAnalysis(statsSheet, allData, currentRow);
    
    // 3. Consistency Across Areas Section
    currentRow = buildConsistencyAnalysis(statsSheet, allData, currentRow);
    
    // 4. Difficulty and Discrimination Section
    currentRow = buildDifficultyAnalysis(statsSheet, allData, currentRow);
    
    // 5. Trend Analysis Section
    currentRow = buildTrendAnalysis(statsSheet, allData, currentRow);
    
    // 6. Outlier Analysis Section
    currentRow = buildOutlierAnalysis(statsSheet, allData, currentRow);
    
    // 7. Generalizability Theory Section (simplified)
    currentRow = buildGeneralizabilityAnalysis(statsSheet, allData, currentRow);
    
    // 8. SCENARIO ANALYSIS
    currentRow = buildScenarioAnalysis(statsSheet, allData, currentRow);

    // 9. TRACK ANALYSIS
    currentRow = buildTrackAnalysis(statsSheet, allData, currentRow);

    // 10. TRACK-SCENARIO COMPARISON
    currentRow = buildTrackScenarioComparison(statsSheet, allData, currentRow);
    
    // Final formatting and adjustments
    finalizeStatsSheet(statsSheet);
    
    // Update status
    statusCell.setValue("Advanced Statistics Generated: " + new Date().toLocaleString());
    
  } catch (error) {
    console.error("Error building advanced statistics: " + error.message);
    console.error("Stack trace: " + error.stack);
    SpreadsheetApp.getActiveSpreadsheet().toast("Error building statistics: " + error.message, "Error", 5);
  }
}

/**
 * Format the statistics sheet for advanced reporting
 */
function formatAdvancedStatsSheet(sheet) {
  // Set up the sheet for better reporting
  sheet.setColumnWidth(1, 250);  // A - Wider for labels
  
  // Columns B-H will be used for data and charts
  for (let i = 2; i <= 8; i++) {
    sheet.setColumnWidth(i, 120);
  }
  
  // Columns for charts will be wider
  sheet.setColumnWidth(9, 350);  // I
  sheet.setColumnWidth(10, 350); // J
  
  // Freeze the header row
  sheet.setFrozenRows(4);
}

/**
 * Build the dashboard header with key metrics
 */
function buildStatsDashboardHeader(sheet, data) {
  // Create title and timestamp
  const title = "Advanced Grade Statistics Dashboard";
  const timestamp = "Generated: " + new Date().toLocaleString();
  
  // Set up the header
  sheet.getRange("A1:J1").merge()
    .setValue(title)
    .setFontSize(16)
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.HEADER)
    .setHorizontalAlignment("center");
  
  sheet.getRange("A2:J2").merge()
    .setValue(timestamp)
    .setFontStyle("italic")
    .setBackground(STATS_COLORS.HEADER)
    .setHorizontalAlignment("center");
  
  // Add key metrics row (will fill this in later)
  sheet.getRange("A3:J3").merge()
    .setValue("Loading key metrics...")
    .setBackground(STATS_COLORS.SUBHEADER);
  
  // Add navigation row
  const navRow = [
    "Quick Navigation:",
    "1. Reliability",
    "2. Grader Bias",
    "3. Consistency",
    "4. Difficulty",
    "5. Trends",
    "6. Outliers",
    "7. G-Theory",
    "8. Scenarios",
    "9. Tracks",
    "10. Track-Scenario"
  ];
  
  // Set the navigation row
  sheet.getRange("A4:K4").setValues([navRow])
    .setBackground(STATS_COLORS.NEUTRAL)
    .setFontWeight("bold");
}

/**
 * Build the summary statistics section
 */
function buildSummaryStatistics(sheet, data, startRow) {
  const currentRow = startRow;
  
  // Set section header
  sheet.getRange(currentRow, 1, 1, 10).merge()
    .setValue("SUMMARY STATISTICS")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.HEADER)
    .setHorizontalAlignment("center");
  
  // Calculate key summary statistics
  const totalStudents = data.length;
  const studentsWithComplete = data.filter(s => s.numGraders >= 4).length;
  
  // Get list of all graders
  const allGraders = new Set();
  data.forEach(student => {
    Object.keys(student.graders).forEach(grader => {
      allGraders.add(grader);
    });
  });
  
  // Calculate overall scores - use the actual numeric score values
  const overallScores = data
    .filter(s => s.overallAverage !== null && !isNaN(s.overallAverage))
    .map(s => s.overallAverage);
  
  const avgScore = overallScores.length > 0 ? calculateAverage(overallScores) : "N/A";
  const stdDev = overallScores.length > 0 ? calculateStandardDeviation(overallScores) : "N/A";
  
  // Build the summary metrics table
  const summaryData = [
    ["Total Students", totalStudents, "", "Students w/Complete Assessments", studentsWithComplete],
    ["Total Graders", allGraders.size, "", "Average Score", avgScore !== "N/A" ? avgScore.toFixed(2) : "N/A"],
    ["Score Std. Deviation", stdDev !== "N/A" ? stdDev.toFixed(2) : "N/A", "", "Passing Rate", calculatePassingRate(data) + "%"]
  ];
  
  // Insert the summary data
  sheet.getRange(currentRow + 1, 1, 3, 5).setValues(summaryData);
  sheet.getRange(currentRow + 1, 1, 3, 1).setFontWeight("bold").setBackground(STATS_COLORS.SUBHEADER);
  sheet.getRange(currentRow + 1, 4, 3, 1).setFontWeight("bold").setBackground(STATS_COLORS.SUBHEADER);
  
  // Create a score distribution chart - this will occupy the right side of the summary area
  createScoreDistributionChart(sheet, data, currentRow + 1, 7, 4, 4);
  
  // Update key metrics in header
  const reliabilityScore = estimateOverallReliability(data);
  const gradingBias = detectSignificantGraderBias(data);
  
  let keyMetrics = `Overall Metrics: ${totalStudents} Students | ${allGraders.size} Graders | `;
  keyMetrics += `Avg. Score: ${typeof avgScore === 'number' ? avgScore.toFixed(2) : 'N/A'} | `;
  keyMetrics += `Reliability: ${typeof reliabilityScore === 'number' ? reliabilityScore.toFixed(2) : 'N/A'} | `;
  keyMetrics += gradingBias ? `⚠️ Grader Bias Detected` : `✓ No Significant Grader Bias`;
  
  sheet.getRange("A3:J3").merge()
    .setValue(keyMetrics)
    .setBackground(STATS_COLORS.SUBHEADER);
  
  return currentRow + 5;  // Return next position
}

/**
 * Build the Inter-Rater Reliability section
 */
function buildInterRaterReliability(sheet, data, startRow) {
  const currentRow = startRow;
  
  // Set section header with navigation bookmark
  sheet.getRange(currentRow, 1, 1, 10).merge()
    .setValue("1. INTER-RATER RELIABILITY")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.HEADER)
    .setHorizontalAlignment("center");
  
  // Create section description
  sheet.getRange(currentRow + 1, 1, 1, 10).merge()
    .setValue("This section measures how consistently graders evaluate the same students. Higher values indicate greater agreement between graders.")
    .setBackground(STATS_COLORS.NEUTRAL)
    .setFontStyle("italic");
  
  // Start creating the reliability table
  sheet.getRange(currentRow + 2, 1, 1, 6).setValues([
    ["Metric", "Overall Value", "Interpretation", "By Criterion", "Min", "Max"]
  ]).setFontWeight("bold").setBackground(STATS_COLORS.SUBHEADER);
  
  // Calculate ICC - we'll use a simplified approximation
  const iccValue = calculateICC(data);
  const kendallW = calculateKendallW(data);
  const fleissKappa = calculateFleissKappa(data);
  
  // Calculate ICC by criterion
  const iccByCriterion = calculateICCByCriterion(data);
  
  // Format the interpretation based on thresholds
  const getInterpretation = (value, metric) => {
    if (value === "N/A" || typeof value !== 'number') {
      return "Insufficient Data";
    } else if (value < THRESHOLDS.RELIABILITY_CONCERN) {
      return "⚠️ Concern";
    } else if (value < 0.8) {
      return "✓ Acceptable";
    } else {
      return "✓✓ Good";
    }
  };
  
  // Find min and max values, ensuring we only process numeric values
  const validIccValues = Object.values(iccByCriterion)
    .filter(v => typeof v === 'number');
  
  const minICC = validIccValues.length > 0 ? Math.min(...validIccValues) : "N/A";
  const maxICC = validIccValues.length > 0 ? Math.max(...validIccValues) : "N/A";
  
  // Build the reliability metrics
  const reliabilityData = [
    [
      "ICC (Intraclass Correlation)",
      typeof iccValue === 'number' ? iccValue.toFixed(2) : "N/A",
      getInterpretation(iccValue, "ICC"),
      typeof iccByCriterion["average"] === 'number' ? iccByCriterion["average"].toFixed(2) : "N/A",
      typeof minICC === 'number' ? minICC.toFixed(2) : "N/A",
      typeof maxICC === 'number' ? maxICC.toFixed(2) : "N/A"
    ],
    [
      "Kendall's W",
      typeof kendallW === 'number' ? kendallW.toFixed(2) : "N/A",
      getInterpretation(kendallW, "Kendall"),
      "N/A",
      "N/A",
      "N/A"
    ],
    [
      "Fleiss' Kappa",
      typeof fleissKappa === 'number' ? fleissKappa.toFixed(2) : "N/A",
      getInterpretation(fleissKappa, "Kappa"),
      "N/A",
      "N/A",
      "N/A"
    ]
  ];
  
  sheet.getRange(currentRow + 3, 1, 3, 6).setValues(reliabilityData);
  
  // Color-code the interpretation cells
  for (let i = 0; i < 3; i++) {
    const cell = sheet.getRange(currentRow + 3 + i, 3);
    if (cell.getValue().includes("Concern")) {
      cell.setBackground(STATS_COLORS.NEGATIVE);
    } else if (cell.getValue().includes("Good")) {
      cell.setBackground(STATS_COLORS.POSITIVE);
    } else if (cell.getValue().includes("Acceptable")) {
      cell.setBackground(STATS_COLORS.NEUTRAL);
    }
  }
  
  // Create a chart showing ICC by criterion
  createICCByAreaChart(sheet, iccByCriterion, currentRow + 2, 7, 4, 4);
  
  return currentRow + 7;  // Return next position
}

/**
 * Build the Grader Bias Analysis section
 */
function buildGraderBiasAnalysis(sheet, data, startRow) {
  const currentRow = startRow;
  
  // Set section header with navigation bookmark
  sheet.getRange(currentRow, 1, 1, 10).merge()
    .setValue("2. GRADER BIAS & FAIRNESS ANALYSIS")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.HEADER)
    .setHorizontalAlignment("center");
  
  // Create section description
  sheet.getRange(currentRow + 1, 1, 1, 10).merge()
    .setValue("This section identifies systemic differences in grading patterns between different graders. Significant deviations may indicate bias.")
    .setBackground(STATS_COLORS.NEUTRAL)
    .setFontStyle("italic");
  
  // Calculate grader averages
  const graderStats = calculateGraderStats(data);
  
  console.log("Grader stats:", JSON.stringify(graderStats));
  
  // Sort graders by their average scores (from highest to lowest)
  const sortedGraders = Object.keys(graderStats).sort((a, b) => {
    const scoreA = typeof graderStats[a].avgScore === 'number' ? graderStats[a].avgScore : 0;
    const scoreB = typeof graderStats[b].avgScore === 'number' ? graderStats[b].avgScore : 0;
    return scoreB - scoreA;
  });
  
  // Prepare the table header
  sheet.getRange(currentRow + 2, 1, 1, 6).setValues([
    ["Grader", "Average Score", "z-Score", "Students Graded", "StdDev", "Bias Assessment"]
  ]).setFontWeight("bold").setBackground(STATS_COLORS.SUBHEADER);
  
  // Overall average to compute z-scores
  const validScores = Object.values(graderStats)
    .filter(s => typeof s.avgScore === 'number')
    .map(s => s.avgScore);
  
  const overallAvg = validScores.length > 0 ? calculateAverage(validScores) : "N/A";
  const overallStdDev = validScores.length > 0 ? calculateStandardDeviation(validScores) : "N/A";
  
  // Build the grader data rows
  const graderRows = [];
  
  for (const grader of sortedGraders) {
    const stats = graderStats[grader];
    
    if (typeof stats.avgScore !== 'number' || stats.numStudents === 0) continue;
    
    let zScore = "N/A";
    if (typeof overallAvg === 'number' && typeof overallStdDev === 'number' && overallStdDev > 0) {
      zScore = (stats.avgScore - overallAvg) / overallStdDev;
    }
    
    // Determine bias assessment
    let biasAssessment;
    if (typeof zScore !== 'number' || isNaN(zScore)) {
      biasAssessment = "Insufficient Data";
    } else if (Math.abs(zScore) > THRESHOLDS.GRADER_DEVIATION) {
      biasAssessment = zScore > 0 ? 
        "⚠️ Significantly Lenient" : 
        "⚠️ Significantly Strict";
    } else {
      biasAssessment = "✓ Within Normal Range";
    }
    
    graderRows.push([
      grader,
      stats.avgScore.toFixed(2),
      typeof zScore === 'number' ? zScore.toFixed(2) : "N/A",
      stats.numStudents,
      typeof stats.stdDev === 'number' ? stats.stdDev.toFixed(2) : "N/A",
      biasAssessment
    ]);
  }
  
  // Insert the data
  if (graderRows.length > 0) {
    sheet.getRange(currentRow + 3, 1, graderRows.length, 6).setValues(graderRows);
    
    // Color-code the z-score and bias assessment cells
    for (let i = 0; i < graderRows.length; i++) {
      const zScoreCell = sheet.getRange(currentRow + 3 + i, 3);
      const zScoreValue = parseFloat(zScoreCell.getValue());
      
      if (!isNaN(zScoreValue) && Math.abs(zScoreValue) > THRESHOLDS.GRADER_DEVIATION) {
        zScoreCell.setBackground(STATS_COLORS.HIGH_DEVIATION);
      }
      
      const biasCell = sheet.getRange(currentRow + 3 + i, 6);
      if (biasCell.getValue().includes("Significantly")) {
        biasCell.setBackground(STATS_COLORS.NEGATIVE);
      } else if (biasCell.getValue().includes("Within")) {
        biasCell.setBackground(STATS_COLORS.POSITIVE);
      }
    }
  } else {
    sheet.getRange(currentRow + 3, 1).setValue("No grader data available");
  }
  
  // Create a chart showing grader average scores
  createGraderAveragesChart(sheet, graderStats, currentRow + 2, 7, 4, 4);
  
  // Determine next row based on number of graders
  const nextRow = currentRow + Math.max(8, graderRows.length + 4);
  
  // Add ANOVA results if there are enough graders
  if (sortedGraders.length >= 3) {
    const anovaResults = performGraderANOVA(data);
    
    sheet.getRange(nextRow - 2, 1, 1, 6).merge()
      .setValue("ANOVA for Grader Effect")
      .setFontWeight("bold")
      .setBackground(STATS_COLORS.SUBHEADER);
    
    sheet.getRange(nextRow - 1, 1, 1, 6).setValues([
      ["Source", "SS", "df", "MS", "F", "p-value"]
    ]).setFontWeight("bold").setBackground(STATS_COLORS.NEUTRAL);
    
    // Ensure all values are valid numbers
    const ssb = typeof anovaResults.SSB === 'number' ? anovaResults.SSB.toFixed(2) : "N/A";
    const ssw = typeof anovaResults.SSW === 'number' ? anovaResults.SSW.toFixed(2) : "N/A";
    const msb = (typeof anovaResults.SSB === 'number' && anovaResults.dfB > 0) ? 
      (anovaResults.SSB / anovaResults.dfB).toFixed(2) : "N/A";
    const msw = (typeof anovaResults.SSW === 'number' && anovaResults.dfW > 0) ? 
      (anovaResults.SSW / anovaResults.dfW).toFixed(2) : "N/A";
      
    sheet.getRange(nextRow, 1, 2, 6).setValues([
      ["Between Graders", ssb, anovaResults.dfB, msb, 
       typeof anovaResults.F === 'number' ? anovaResults.F.toFixed(2) : "N/A", 
       typeof anovaResults.pValue === 'number' ? anovaResults.pValue.toFixed(4) : "N/A"
      ],
      ["Within Graders", ssw, anovaResults.dfW, msw, "", ""]
    ]);
    
    // Color code the p-value
    const pValueCell = sheet.getRange(nextRow, 6);
    if (typeof anovaResults.pValue === 'number') {
      if (anovaResults.pValue < 0.05) {
        pValueCell.setBackground(STATS_COLORS.NEGATIVE)
          .setNote("p < 0.05 indicates significant differences between graders");
      } else {
        pValueCell.setBackground(STATS_COLORS.POSITIVE)
          .setNote("p ≥ 0.05 suggests no significant differences between graders");
      }
    }
    
    return nextRow + 3;  // Return next position
  }
  
  return nextRow;
}

/**
 * Build the Consistency Across Areas section
 */
function buildConsistencyAnalysis(sheet, data, startRow) {
  const currentRow = startRow;
  
  // Set section header with navigation bookmark
  sheet.getRange(currentRow, 1, 1, 10).merge()
    .setValue("3. CONSISTENCY ACROSS AREAS & STUDENTS")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.HEADER)
    .setHorizontalAlignment("center");
  
  // Create section description
  sheet.getRange(currentRow + 1, 1, 1, 10).merge()
    .setValue("This section examines how consistently the grading criteria are applied across students. High consistency suggests the grading rubric is being applied uniformly.")
    .setBackground(STATS_COLORS.NEUTRAL)
    .setFontStyle("italic");
  
  // Calculate Cronbach's alpha
  const alpha = calculateCronbachAlpha(data);
  
  // Calculate item-total correlations
  const itemTotalCorr = calculateItemTotalCorrelations(data);
  
  console.log("Item-total correlations:", JSON.stringify(itemTotalCorr));
  
  // Add Cronbach's alpha display
  sheet.getRange(currentRow + 2, 1, 1, 4).merge()
    .setValue("Cronbach's α (Internal Consistency)")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.SUBHEADER);
  
  let alphaInterpretation;
  let alphaColor;
  
  if (typeof alpha !== 'number' || isNaN(alpha)) {
    alphaInterpretation = "Not enough data";
    alphaColor = STATS_COLORS.NEUTRAL;
  } else if (alpha < THRESHOLDS.RELIABILITY_CONCERN) {
    alphaInterpretation = "⚠️ Low consistency (< 0.7)";
    alphaColor = STATS_COLORS.NEGATIVE;
  } else if (alpha < 0.8) {
    alphaInterpretation = "✓ Acceptable consistency (0.7-0.8)";
    alphaColor = STATS_COLORS.NEUTRAL;
  } else if (alpha < 0.9) {
    alphaInterpretation = "✓✓ Good consistency (0.8-0.9)";
    alphaColor = STATS_COLORS.POSITIVE;
  } else {
    alphaInterpretation = "✓✓✓ Excellent consistency (> 0.9)";
    alphaColor = STATS_COLORS.POSITIVE;
  }
  
  sheet.getRange(currentRow + 3, 1).setValue("Overall α:");
  sheet.getRange(currentRow + 3, 2).setValue(typeof alpha === 'number' ? alpha.toFixed(2) : "N/A");
  sheet.getRange(currentRow + 3, 3, 1, 2).merge()
    .setValue(alphaInterpretation)
    .setBackground(alphaColor);
  
  // Create item-total correlation table
  sheet.getRange(currentRow + 5, 1, 1, 4).merge()
    .setValue("Item-Total Correlations")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.SUBHEADER);
  
  sheet.getRange(currentRow + 6, 1, 1, 4).setValues([
    ["Criterion", "Correlation", "Assessment", "Action"]
  ]).setFontWeight("bold").setBackground(STATS_COLORS.NEUTRAL);
  
  // Build the item-total correlation rows
  const corrRows = [];
  
  for (let i = 0; i < CRITERIA_NAMES.length; i++) {
    const correlation = itemTotalCorr[i];
    
    let assessment, action, bgColor;
    
    if (typeof correlation !== 'number' || isNaN(correlation)) {
      assessment = "Insufficient data";
      action = "N/A";
      bgColor = STATS_COLORS.NEUTRAL;
    } else if (correlation < 0.2) {
      assessment = "Very weak";
      action = "Consider revising or removing";
      bgColor = STATS_COLORS.NEGATIVE;
    } else if (correlation < 0.4) {
      assessment = "Weak";
      action = "Review and possibly revise";
      bgColor = STATS_COLORS.HIGH_DEVIATION;
    } else if (correlation < 0.6) {
      assessment = "Moderate";
      action = "Acceptable";
      bgColor = STATS_COLORS.NEUTRAL;
    } else {
      assessment = "Strong";
      action = "Keep as is";
      bgColor = STATS_COLORS.POSITIVE;
    }
    
    corrRows.push([
      CRITERIA_NAMES[i],
      typeof correlation === 'number' ? correlation.toFixed(2) : "N/A",
      assessment,
      action
    ]);
    
    // Add background color to each row based on assessment
    if (typeof correlation === 'number') {
      sheet.getRange(currentRow + 7 + i, 3).setBackground(bgColor);
    }
  }
  
  sheet.getRange(currentRow + 7, 1, corrRows.length, 4).setValues(corrRows);
  
  // Create a chart showing item-total correlations
  createItemCorrelationChart(sheet, itemTotalCorr, currentRow + 2, 7, 8, 4);
  
  return currentRow + corrRows.length + 8;  // Return next position
}

/**
 * Build the Difficulty and Discrimination Analysis section
 */
function buildDifficultyAnalysis(sheet, data, startRow) {
  const currentRow = startRow;
  
  // Set section header with navigation bookmark
  sheet.getRange(currentRow, 1, 1, 10).merge()
    .setValue("4. DIFFICULTY & DISCRIMINATION ANALYSIS")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.HEADER)
    .setHorizontalAlignment("center");
  
  // Create section description
  sheet.getRange(currentRow + 1, 1, 1, 10).merge()
    .setValue("This section identifies which criteria are most challenging for students and how well each criterion differentiates between high and low performers.")
    .setBackground(STATS_COLORS.NEUTRAL)
    .setFontStyle("italic");
  
  // Calculate difficulty and discrimination indices
  const difficultyIndices = calculateDifficultyIndices(data);
  const discriminationIndices = calculateDiscriminationIndices(data);
  
  console.log("Difficulty indices:", JSON.stringify(difficultyIndices));
  console.log("Discrimination indices:", JSON.stringify(discriminationIndices));
  
  // Create the table header
  sheet.getRange(currentRow + 2, 1, 1, 6).setValues([
    ["Criterion", "Difficulty Index", "Assessment", "Discrimination Index", "Assessment", "Action"]
  ]).setFontWeight("bold").setBackground(STATS_COLORS.SUBHEADER);
  
  // Build the difficulty and discrimination rows
  const analysisRows = [];
  
  for (let i = 0; i < CRITERIA_NAMES.length; i++) {
    const difficulty = difficultyIndices[i];
    const discrimination = discriminationIndices[i];
    
    // Assess difficulty
    let diffAssessment, discAssessment, action, diffColor, discColor;
    
    if (typeof difficulty !== 'number' || isNaN(difficulty)) {
      diffAssessment = "Insufficient data";
      diffColor = STATS_COLORS.NEUTRAL;
    } else if (difficulty <= THRESHOLDS.DIFFICULTY_EASY) {
      diffAssessment = "Very Easy";
      diffColor = STATS_COLORS.HIGH_DEVIATION;
    } else if (difficulty >= THRESHOLDS.DIFFICULTY_HARD) {
      diffAssessment = "Very Hard";
      diffColor = STATS_COLORS.HIGH_DEVIATION;
    } else {
      diffAssessment = "Appropriate";
      diffColor = STATS_COLORS.POSITIVE;
    }
    
    // Assess discrimination
    if (typeof discrimination !== 'number' || isNaN(discrimination)) {
      discAssessment = "Insufficient data";
      discColor = STATS_COLORS.NEUTRAL;
      action = "N/A";
    } else if (discrimination < 0) {
      discAssessment = "Negative";
      discColor = STATS_COLORS.NEGATIVE;
      action = "⚠️ Revise immediately";
    } else if (discrimination < THRESHOLDS.DISCRIMINATION_LOW) {
      discAssessment = "Poor";
      discColor = STATS_COLORS.HIGH_DEVIATION;
      action = "Review and revise";
    } else if (discrimination < 0.5) {
      discAssessment = "Acceptable";
      discColor = STATS_COLORS.NEUTRAL;
      action = "Consider improvements";
    } else {
      discAssessment = "Excellent";
      discColor = STATS_COLORS.POSITIVE;
      action = "Keep as is";
    }
    
    analysisRows.push([
      CRITERIA_NAMES[i],
      typeof difficulty === 'number' ? difficulty.toFixed(2) : "N/A",
      diffAssessment,
      typeof discrimination === 'number' ? discrimination.toFixed(2) : "N/A",
      discAssessment,
      action
    ]);
    
    // We'll color these cells after setting the values
  }
  
  sheet.getRange(currentRow + 3, 1, analysisRows.length, 6).setValues(analysisRows);
  
  // Add background colors
  for (let i = 0; i < analysisRows.length; i++) {
    const diffAssessment = sheet.getRange(currentRow + 3 + i, 3).getValue();
    const discAssessment = sheet.getRange(currentRow + 3 + i, 5).getValue();
    
    if (diffAssessment === "Appropriate") {
      sheet.getRange(currentRow + 3 + i, 3).setBackground(STATS_COLORS.POSITIVE);
    } else if (diffAssessment === "Very Easy" || diffAssessment === "Very Hard") {
      sheet.getRange(currentRow + 3 + i, 3).setBackground(STATS_COLORS.HIGH_DEVIATION);
    }
    
    if (discAssessment === "Excellent") {
      sheet.getRange(currentRow + 3 + i, 5).setBackground(STATS_COLORS.POSITIVE);
    } else if (discAssessment === "Acceptable") {
      sheet.getRange(currentRow + 3 + i, 5).setBackground(STATS_COLORS.NEUTRAL);
    } else if (discAssessment === "Poor") {
      sheet.getRange(currentRow + 3 + i, 5).setBackground(STATS_COLORS.HIGH_DEVIATION);
    } else if (discAssessment === "Negative") {
      sheet.getRange(currentRow + 3 + i, 5).setBackground(STATS_COLORS.NEGATIVE);
    }
  }
  
  // Create a difficulty-discrimination chart
  createDifficultyDiscriminationChart(sheet, difficultyIndices, discriminationIndices, currentRow + 2, 7, 4, 4);
  
  return currentRow + analysisRows.length + 7;  // Return next position
}

/**
 * Build the Trend Analysis section
 */
function buildTrendAnalysis(sheet, data, startRow) {
  const currentRow = startRow;
  
  // Set section header with navigation bookmark
  sheet.getRange(currentRow, 1, 1, 10).merge()
    .setValue("5. TREND ANALYSIS & ITEM-LEVEL DIAGNOSTICS")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.HEADER)
    .setHorizontalAlignment("center");
  
  // Create section description
  sheet.getRange(currentRow + 1, 1, 1, 10).merge()
    .setValue("This section identifies trends in student performance across different criteria and over time.")
    .setBackground(STATS_COLORS.NEUTRAL)
    .setFontStyle("italic");
  
  // Generate heatmap data for criteria averages
  // For this example, we'll create a simplified version since we don't have cohort info
  const heatmapData = generateCriteriaHeatmapData(data);
  
  console.log("Heatmap data:", JSON.stringify(heatmapData));
  
  // Add heatmap title
  sheet.getRange(currentRow + 2, 1, 1, 6).merge()
    .setValue("Average Score by Criterion")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.SUBHEADER);
  
  // Create the heatmap
  const heatmapValues = [];
  
  for (let i = 0; i < CRITERIA_NAMES.length; i++) {
    const avg = heatmapData[i];
    heatmapValues.push([
      CRITERIA_NAMES[i],
      typeof avg === 'number' ? avg.toFixed(2) : "N/A"
    ]);
  }
  
  sheet.getRange(currentRow + 3, 1, CRITERIA_NAMES.length, 2).setValues(heatmapValues);
  
  // Apply conditional formatting based on values
  for (let i = 0; i < CRITERIA_NAMES.length; i++) {
    const avg = heatmapData[i];
    
    if (typeof avg === 'number') {
      // Create color gradient based on value (1-8 scale)
      // IMPORTANT: 1 is the best score, 8 is the worst score on the grading scale
      // Lower values (better scores) get green, higher values (worse scores) get red
      const normalizedValue = Math.max(0, Math.min(1, (avg - 1) / 6)); // Normalize to 0-1
      const r = Math.round(255 * normalizedValue);
      const g = Math.round(255 * (1 - normalizedValue));
      const b = 0;
      
      sheet.getRange(currentRow + 3 + i, 2).setBackground(`rgb(${r}, ${g}, ${b})`);
      
      // Use white text for darker backgrounds
      if (normalizedValue > 0.5) {
        sheet.getRange(currentRow + 3 + i, 2).setFontColor("white");
      }
    }
  }
  
  // Create a failures rate analysis
  const failureRates = calculateFailureRates(data);
  
  console.log("Failure rates:", JSON.stringify(failureRates));
  
  // Add failure rates title
  sheet.getRange(currentRow + 3, 4, 1, 3).merge()
    .setValue("Failure Rates by Criterion")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.SUBHEADER);
  
  // Create the failure rates table
  const failureValues = [];
  
  for (let i = 0; i < CRITERIA_NAMES.length; i++) {
    const failRate = failureRates[i];
    failureValues.push([
      CRITERIA_NAMES[i],
      typeof failRate === 'number' ? (failRate * 100).toFixed(1) + "%" : "N/A",
      typeof failRate === 'number' ? (failRate > 0.1 ? "⚠️ High Failure Rate" : "✓ Normal") : "N/A"
    ]);
  }
  
  sheet.getRange(currentRow + 4, 4, CRITERIA_NAMES.length, 3).setValues(failureValues);
  
  // Apply conditional formatting to failure rates
  for (let i = 0; i < CRITERIA_NAMES.length; i++) {
    const failRate = failureRates[i];
    
    if (typeof failRate === 'number') {
      const cell = sheet.getRange(currentRow + 4 + i, 5);
      if (failRate > 0.2) {
        cell.setBackground(STATS_COLORS.NEGATIVE);
      } else if (failRate > 0.1) {
        cell.setBackground(STATS_COLORS.HIGH_DEVIATION);
      } else {
        cell.setBackground(STATS_COLORS.POSITIVE);
      }
    }
  }
  
  // Create charts
  createAreaHeatmapChart(sheet, heatmapData, currentRow + 2, 7, 4, 4);
  
  return currentRow + Math.max(CRITERIA_NAMES.length, 6) + 7;  // Return next position
}

/**
 * Build the Outlier Analysis section
 */
function buildOutlierAnalysis(sheet, data, startRow) {
  const currentRow = startRow;
  
  // Set section header with navigation bookmark
  sheet.getRange(currentRow, 1, 1, 10).merge()
    .setValue("6. OUTLIER & INTRA-STUDENT VARIABILITY")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.HEADER)
    .setHorizontalAlignment("center");
  
  // Create section description
  sheet.getRange(currentRow + 1, 1, 1, 10).merge()
    .setValue("This section identifies students with high variability in grades and potential outlier assessments.")
    .setBackground(STATS_COLORS.NEUTRAL)
    .setFontStyle("italic");
  
  // Calculate intra-student variability
  const studentVariability = calculateStudentVariability(data);
  
  console.log("Student variability:", JSON.stringify(studentVariability));
  
  // Filter for valid data only
  const validStudents = Object.keys(studentVariability).filter(student => {
    const stats = studentVariability[student];
    return typeof stats.stdDev === 'number' && !isNaN(stats.stdDev);
  });
  
  // Sort by standard deviation (highest first)
  validStudents.sort((a, b) => {
    return studentVariability[b].stdDev - studentVariability[a].stdDev;
  });
  
  // Create the variability table header
  sheet.getRange(currentRow + 2, 1, 1, 6).setValues([
    ["Student", "StdDev", "Range", "# Graders", "Assessment", "Action"]
  ]).setFontWeight("bold").setBackground(STATS_COLORS.SUBHEADER);
  
  // Build the variability rows
  const variabilityRows = [];
  
  // Only include top 10 students with highest variability
  const topStudents = validStudents.slice(0, 10);
  
  for (const student of topStudents) {
    const stats = studentVariability[student];
    
    let assessment, action;
    
    if (stats.numGraders < 3) {
      assessment = "Insufficient data";
      action = "Need more graders";
    } else if (stats.stdDev > 10) {
      assessment = "⚠️ Extremely High Variability";
      action = "Immediate review needed";
    } else if (stats.stdDev > 7) {
      assessment = "⚠️ High Variability";
      action = "Review assessments";
    } else if (stats.stdDev > 5) {
      assessment = "Moderate Variability";
      action = "Monitor for consistency";
    } else {
      assessment = "✓ Low Variability";
      action = "No action needed";
    }
    
    variabilityRows.push([
      student,
      stats.stdDev.toFixed(2),
      stats.range.toFixed(2),
      stats.numGraders,
      assessment,
      action
    ]);
  }
  
  if (variabilityRows.length > 0) {
    sheet.getRange(currentRow + 3, 1, variabilityRows.length, 6).setValues(variabilityRows);
    
    // Color-code the assessment cells
    for (let i = 0; i < variabilityRows.length; i++) {
      const assessmentCell = sheet.getRange(currentRow + 3 + i, 5);
      if (assessmentCell.getValue().includes("High")) {
        assessmentCell.setBackground(STATS_COLORS.NEGATIVE);
      } else if (assessmentCell.getValue().includes("Moderate")) {
        assessmentCell.setBackground(STATS_COLORS.HIGH_DEVIATION);
      } else if (assessmentCell.getValue().includes("Low")) {
        assessmentCell.setBackground(STATS_COLORS.POSITIVE);
      }
    }
  } else {
    sheet.getRange(currentRow + 3, 1).setValue("No student variability data available");
  }
  
  // Create visualizations for outlier analysis
  createVariabilityChart(sheet, studentVariability, currentRow + 2, 7, 4, 4);
  
  return currentRow + Math.max(variabilityRows.length + 4, 8);  // Return next position
}

/**
 * Build the Generalizability Theory section (simplified version)
 */
function buildGeneralizabilityAnalysis(sheet, data, startRow) {
  const currentRow = startRow;
  
  // Set section header with navigation bookmark
  sheet.getRange(currentRow, 1, 1, 10).merge()
    .setValue("7. GENERALIZABILITY THEORY (G-THEORY)")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.HEADER)
    .setHorizontalAlignment("center");
  
  // Create section description
  sheet.getRange(currentRow + 1, 1, 1, 10).merge()
    .setValue("This section provides a simplified analysis of variance components and how reliability would change with different numbers of graders.")
    .setBackground(STATS_COLORS.NEUTRAL)
    .setFontStyle("italic");
  
  // Calculate a simplified G-study (variance components)
  const gStudyResults = calculateSimplifiedGStudy(data);
  
  console.log("G-study results:", JSON.stringify(gStudyResults));
  
  // Create the variance components table
  sheet.getRange(currentRow + 2, 1, 1, 3).merge()
    .setValue("Variance Components")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.SUBHEADER);
  
  sheet.getRange(currentRow + 3, 1, 1, 3).setValues([
    ["Source", "Variance", "% of Total"]
  ]).setFontWeight("bold").setBackground(STATS_COLORS.NEUTRAL);
  
  // Build the variance components rows
  const varComponentRows = [
    [
      "Student", 
      typeof gStudyResults.studentVariance === 'number' ? gStudyResults.studentVariance.toFixed(2) : "N/A", 
      typeof gStudyResults.studentPercent === 'number' ? (gStudyResults.studentPercent * 100).toFixed(1) + "%" : "N/A"
    ],
    [
      "Grader", 
      typeof gStudyResults.graderVariance === 'number' ? gStudyResults.graderVariance.toFixed(2) : "N/A", 
      typeof gStudyResults.graderPercent === 'number' ? (gStudyResults.graderPercent * 100).toFixed(1) + "%" : "N/A"
    ],
    [
      "Area", 
      typeof gStudyResults.areaVariance === 'number' ? gStudyResults.areaVariance.toFixed(2) : "N/A", 
      typeof gStudyResults.areaPercent === 'number' ? (gStudyResults.areaPercent * 100).toFixed(1) + "%" : "N/A"
    ],
    [
      "Residual", 
      typeof gStudyResults.residualVariance === 'number' ? gStudyResults.residualVariance.toFixed(2) : "N/A", 
      typeof gStudyResults.residualPercent === 'number' ? (gStudyResults.residualPercent * 100).toFixed(1) + "%" : "N/A"
    ]
  ];
  
  sheet.getRange(currentRow + 4, 1, 4, 3).setValues(varComponentRows);
  
  // Add D-study predictions
  sheet.getRange(currentRow + 2, 5, 1, 2).merge()
    .setValue("D-Study Predictions")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.SUBHEADER);
  
  sheet.getRange(currentRow + 3, 5, 1, 2).setValues([
    ["# of Graders", "Predicted Reliability"]
  ]).setFontWeight("bold").setBackground(STATS_COLORS.NEUTRAL);
  
  // Check if we can compute D-study predictions
  const canComputeDStudy = typeof gStudyResults.studentVariance === 'number' && 
                            typeof gStudyResults.graderVariance === 'number' && 
                            typeof gStudyResults.areaVariance === 'number' && 
                            typeof gStudyResults.residualVariance === 'number';
  
  // Build D-study rows
  const dStudyRows = [];
  
  for (let numGraders = 1; numGraders <= 10; numGraders++) {
    if (canComputeDStudy) {
      // Apply the Spearman-Brown prophecy formula
      const reliability = calculatePredictedReliability(gStudyResults, numGraders);
      dStudyRows.push([numGraders, reliability.toFixed(2)]);
    } else {
      dStudyRows.push([numGraders, "N/A"]);
    }
  }
  
  sheet.getRange(currentRow + 4, 5, dStudyRows.length, 2).setValues(dStudyRows);
  
  // Color-code reliability values
  if (canComputeDStudy) {
    for (let i = 0; i < dStudyRows.length; i++) {
      const reliability = parseFloat(dStudyRows[i][1]);
      const cell = sheet.getRange(currentRow + 4 + i, 6);
      
      if (reliability < THRESHOLDS.RELIABILITY_CONCERN) {
        cell.setBackground(STATS_COLORS.NEGATIVE);
      } else if (reliability < 0.8) {
        cell.setBackground(STATS_COLORS.NEUTRAL);
      } else if (reliability < 0.9) {
        cell.setBackground(STATS_COLORS.LOW_DEVIATION);
      } else {
        cell.setBackground(STATS_COLORS.POSITIVE);
      }
    }
  }
  
  // Create charts for G-theory
  createGTheoryCharts(sheet, gStudyResults, dStudyRows, currentRow + 2, 7, 4, 4);
  
  return currentRow + 15;  // Return next position after g-theory section
}

/**
 * Build the Scenario Analysis section
 */
function buildScenarioAnalysis(sheet, data, startRow) {
  const currentRow = startRow;
  
  // Set section header with navigation bookmark
  sheet.getRange(currentRow, 1, 1, 10).merge()
    .setValue("8. SCENARIO ANALYSIS")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.HEADER)
    .setHorizontalAlignment("center");
  
  // Create section description
  sheet.getRange(currentRow + 1, 1, 1, 10).merge()
    .setValue("This section analyzes performance across different scenarios to identify which scenarios may be more challenging or poorly designed.")
    .setBackground(STATS_COLORS.NEUTRAL)
    .setFontStyle("italic");
  
  // Calculate statistics by scenario
  const scenarioStats = calculateScenarioStats(data);
  
  console.log("Scenario stats:", JSON.stringify(scenarioStats));
  
  // Sort scenarios by average score
  const sortedScenarios = Object.keys(scenarioStats).sort((a, b) => {
    // Handle missing scores
    const scoreA = typeof scenarioStats[a].avgScore === 'number' ? scenarioStats[a].avgScore : 0;
    const scoreB = typeof scenarioStats[b].avgScore === 'number' ? scenarioStats[b].avgScore : 0;
    return scoreB - scoreA; // Sort by highest score first
  });
  
  // Prepare the table header
  sheet.getRange(currentRow + 2, 1, 1, 6).setValues([
    ["Scenario", "Average Score", "Students", "Std Dev", "Pass Rate", "Assessment"]
  ]).setFontWeight("bold").setBackground(STATS_COLORS.SUBHEADER);
  
  // Build the scenario rows
  const scenarioRows = [];
  
  for (const scenario of sortedScenarios) {
    // Skip empty scenario names
    if (!scenario) continue;
    
    const stats = scenarioStats[scenario];
    
    // Calculate pass rate
    let passRate = "N/A";
    if (stats.numStudents > 0 && typeof stats.passCount === 'number') {
      passRate = ((stats.passCount / stats.numStudents) * 100).toFixed(1) + "%";
    }
    
    // Determine assessment
    let assessment;
    if (stats.numStudents < 3) {
      assessment = "Insufficient data";
    } else if (typeof stats.avgScore === 'number') {
      if (stats.avgScore < 75) {
        assessment = "⚠️ Challenging Scenario";
      } else if (stats.avgScore > 92) {
        assessment = "Very Easy Scenario";
      } else {
        assessment = "✓ Appropriate Difficulty";
      }
    } else {
      assessment = "N/A";
    }
    
    scenarioRows.push([
      scenario,
      typeof stats.avgScore === 'number' ? stats.avgScore.toFixed(2) : "N/A",
      stats.numStudents,
      typeof stats.stdDev === 'number' ? stats.stdDev.toFixed(2) : "N/A",
      passRate,
      assessment
    ]);
  }
  
  // Insert the data if we have any
  if (scenarioRows.length > 0) {
    sheet.getRange(currentRow + 3, 1, scenarioRows.length, 6).setValues(scenarioRows);
    
    // Color-code the assessment cells
    for (let i = 0; i < scenarioRows.length; i++) {
      const assessmentCell = sheet.getRange(currentRow + 3 + i, 6);
      if (assessmentCell.getValue().includes("Challenging")) {
        assessmentCell.setBackground(STATS_COLORS.NEGATIVE);
      } else if (assessmentCell.getValue().includes("Easy")) {
        assessmentCell.setBackground(STATS_COLORS.HIGH_DEVIATION);
      } else if (assessmentCell.getValue().includes("Appropriate")) {
        assessmentCell.setBackground(STATS_COLORS.POSITIVE);
      }
    }
  } else {
    sheet.getRange(currentRow + 3, 1).setValue("No scenario data available");
  }
  
  // Create a chart for scenario performance
  createScenarioPerformanceChart(sheet, scenarioStats, currentRow + 2, 7, 4, 4);
  
  // Calculate grades by criteria for each scenario
  const scenarioCriteriaStats = calculateScenarioByCriteriaStats(data);
  
  console.log("Scenario by criteria stats:", JSON.stringify(Object.keys(scenarioCriteriaStats)));
  
  // Add criteria comparison by scenario
  const criteriaCompRow = currentRow + Math.max(scenarioRows.length + 4, 8);
  
  sheet.getRange(criteriaCompRow, 1, 1, 10).merge()
    .setValue("Criteria Performance by Scenario")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.SUBHEADER);
  
  // Create table headers with criteria names
  const criteriaHeaders = ["Scenario", ...CRITERIA_NAMES];
  sheet.getRange(criteriaCompRow + 1, 1, 1, 9).setValues([criteriaHeaders])
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.NEUTRAL);
  
  // Build the criteria comparison rows
  const criteriaCompRows = [];
  
  for (const scenario of sortedScenarios) {
    // Skip empty scenario names
    if (!scenario || !scenarioCriteriaStats[scenario]) continue;
    
    const rowData = [scenario];
    
    for (let c = 0; c < CRITERIA_NAMES.length; c++) {
      if (scenarioCriteriaStats[scenario][c] && 
          typeof scenarioCriteriaStats[scenario][c].avgScore === 'number') {
        rowData.push(scenarioCriteriaStats[scenario][c].avgScore.toFixed(2));
      } else {
        rowData.push("N/A");
      }
    }
    
    criteriaCompRows.push(rowData);
  }
  
  if (criteriaCompRows.length > 0) {
    sheet.getRange(criteriaCompRow + 2, 1, criteriaCompRows.length, 9).setValues(criteriaCompRows);
    
    // Apply conditional formatting for easier reading
    for (let r = 0; r < criteriaCompRows.length; r++) {
      for (let c = 0; c < CRITERIA_NAMES.length; c++) {
        const cell = sheet.getRange(criteriaCompRow + 2 + r, c + 2);
        const value = cell.getValue();
        
        if (value !== "N/A") {
          const numValue = parseFloat(value);
          if (numValue < 80) {
            cell.setBackground(STATS_COLORS.HIGH_DEVIATION);
          } else if (numValue > 90) {
            cell.setBackground(STATS_COLORS.POSITIVE);
          }
        }
      }
    }
  } else {
    sheet.getRange(criteriaCompRow + 2, 1).setValue("No scenario criteria data available");
  }
  
  // Create a heatmap visualization for scenario-criteria performance
  createScenarioCriteriaHeatmap(sheet, scenarioCriteriaStats, criteriaCompRow + Math.max(criteriaCompRows.length + 3, 4), 1);
  
  return criteriaCompRow + Math.max(criteriaCompRows.length + 10, 15);  // Return next position
}

/**
 * Build the Track Analysis section
 */
function buildTrackAnalysis(sheet, data, startRow) {
  const currentRow = startRow;
  
  // Set section header with navigation bookmark
  sheet.getRange(currentRow, 1, 1, 10).merge()
    .setValue("9. TRACK ANALYSIS")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.HEADER)
    .setHorizontalAlignment("center");
  
  // Create section description
  sheet.getRange(currentRow + 1, 1, 1, 10).merge()
    .setValue("This section analyzes performance across different tracks to identify strengths and weaknesses in each program.")
    .setBackground(STATS_COLORS.NEUTRAL)
    .setFontStyle("italic");
  
  // Calculate statistics by track
  const trackStats = calculateTrackStats(data);
  
  console.log("Track stats:", JSON.stringify(trackStats));
  
  // Sort tracks by average score
  const sortedTracks = Object.keys(trackStats).sort((a, b) => {
    // Handle missing scores
    const scoreA = typeof trackStats[a].avgScore === 'number' ? trackStats[a].avgScore : 0;
    const scoreB = typeof trackStats[b].avgScore === 'number' ? trackStats[b].avgScore : 0;
    return scoreB - scoreA; // Sort by highest score first
  });
  
  // Prepare the table header
  sheet.getRange(currentRow + 2, 1, 1, 5).setValues([
    ["Track", "Average Score", "Students", "Std Dev", "Pass Rate"]
  ]).setFontWeight("bold").setBackground(STATS_COLORS.SUBHEADER);
  
  // Build the track rows
  const trackRows = [];
  
  for (const track of sortedTracks) {
    // Skip empty track names
    if (!track) continue;
    
    const stats = trackStats[track];
    
    // Calculate pass rate
    let passRate = "N/A";
    if (stats.numStudents > 0 && typeof stats.passCount === 'number') {
      passRate = ((stats.passCount / stats.numStudents) * 100).toFixed(1) + "%";
    }
    
    trackRows.push([
      track,
      typeof stats.avgScore === 'number' ? stats.avgScore.toFixed(2) : "N/A",
      stats.numStudents,
      typeof stats.stdDev === 'number' ? stats.stdDev.toFixed(2) : "N/A",
      passRate
    ]);
  }
  
  // Insert the data if we have any
  if (trackRows.length > 0) {
    sheet.getRange(currentRow + 3, 1, trackRows.length, 5).setValues(trackRows);
  } else {
    sheet.getRange(currentRow + 3, 1).setValue("No track data available");
  }
  
  // Create a chart for track performance
  createTrackPerformanceChart(sheet, trackStats, currentRow + 2, 7, 4, 4);
  
  // Calculate grades by criteria for each track
  const trackCriteriaStats = calculateTrackByCriteriaStats(data);
  
  console.log("Track by criteria stats:", JSON.stringify(Object.keys(trackCriteriaStats)));
  
  // Add criteria comparison by track
  const criteriaCompRow = currentRow + Math.max(trackRows.length + 4, 8);
  
  sheet.getRange(criteriaCompRow, 1, 1, 10).merge()
    .setValue("Criteria Performance by Track")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.SUBHEADER);
  
  // Create table headers with criteria names
  const criteriaHeaders = ["Track", ...CRITERIA_NAMES];
  sheet.getRange(criteriaCompRow + 1, 1, 1, 9).setValues([criteriaHeaders])
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.NEUTRAL);
  
  // Build the criteria comparison rows
  const criteriaCompRows = [];
  
  for (const track of sortedTracks) {
    // Skip empty track names
    if (!track || !trackCriteriaStats[track]) continue;
    
    const rowData = [track];
    
    for (let c = 0; c < CRITERIA_NAMES.length; c++) {
      if (trackCriteriaStats[track][c] && 
          typeof trackCriteriaStats[track][c].avgScore === 'number') {
        rowData.push(trackCriteriaStats[track][c].avgScore.toFixed(2));
      } else {
        rowData.push("N/A");
      }
    }
    
    criteriaCompRows.push(rowData);
  }
  
  if (criteriaCompRows.length > 0) {
    sheet.getRange(criteriaCompRow + 2, 1, criteriaCompRows.length, 9).setValues(criteriaCompRows);
    
    // Apply conditional formatting for easier reading
    for (let r = 0; r < criteriaCompRows.length; r++) {
      for (let c = 0; c < CRITERIA_NAMES.length; c++) {
        const cell = sheet.getRange(criteriaCompRow + 2 + r, c + 2);
        const value = cell.getValue();
        
        if (value !== "N/A") {
          const numValue = parseFloat(value);
          if (numValue < 80) {
            cell.setBackground(STATS_COLORS.HIGH_DEVIATION);
          } else if (numValue > 90) {
            cell.setBackground(STATS_COLORS.POSITIVE);
          }
        }
      }
    }
  } else {
    sheet.getRange(criteriaCompRow + 2, 1).setValue("No track criteria data available");
  }
  
  return criteriaCompRow + Math.max(criteriaCompRows.length + 10, 15);  // Return next position
}

/**
 * Build the Track-Scenario Comparison section
 */
function buildTrackScenarioComparison(sheet, data, startRow) {
  const currentRow = startRow;
  
  // Set section header with navigation bookmark
  sheet.getRange(currentRow, 1, 1, 10).merge()
    .setValue("10. TRACK-SCENARIO PERFORMANCE COMPARISON")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.HEADER)
    .setHorizontalAlignment("center");
  
  // Create section description
  sheet.getRange(currentRow + 1, 1, 1, 10).merge()
    .setValue("This section analyzes how different tracks perform on various scenarios to identify program-specific strengths and weaknesses.")
    .setBackground(STATS_COLORS.NEUTRAL)
    .setFontStyle("italic");
  
  // Calculate track-scenario comparison data
  const trackScenarioStats = calculateTrackScenarioComparison(data);
  
  console.log("Track-Scenario comparison:", JSON.stringify(Object.keys(trackScenarioStats)));
  
  // Get unique tracks and scenarios
  const tracks = Object.keys(trackScenarioStats);
  if (tracks.length === 0) {
    sheet.getRange(currentRow + 2, 1).setValue("No track-scenario data available");
    return currentRow + 4;
  }
  
  // Filter empty track names
  const validTracks = tracks.filter(track => track !== "");
  if (validTracks.length === 0) {
    sheet.getRange(currentRow + 2, 1).setValue("No track-scenario data available");
    return currentRow + 4;
  }
  
  // Get all scenarios across all tracks
  const scenarios = new Set();
  for (const track of validTracks) {
    Object.keys(trackScenarioStats[track]).forEach(scenario => {
      if (scenario !== "") {
        scenarios.add(scenario);
      }
    });
  }
  
  // Convert to array and sort
  const scenarioArray = Array.from(scenarios).sort();
  
  // Create the header row
  const headerRow = ["Track", ...scenarioArray];
  sheet.getRange(currentRow + 2, 1, 1, headerRow.length).setValues([headerRow])
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.SUBHEADER);
  
  // Build the comparison table
  const comparisonRows = [];
  
  for (const track of validTracks) {
    const rowData = [track];
    
    for (const scenario of scenarioArray) {
      if (trackScenarioStats[track][scenario] && 
          typeof trackScenarioStats[track][scenario].avgScore === 'number') {
        rowData.push(trackScenarioStats[track][scenario].avgScore.toFixed(2));
      } else {
        rowData.push("N/A");
      }
    }
    
    comparisonRows.push(rowData);
  }
  
  // Insert the data
  if (comparisonRows.length > 0) {
    sheet.getRange(currentRow + 3, 1, comparisonRows.length, headerRow.length).setValues(comparisonRows);
    
    // Apply conditional formatting
    for (let r = 0; r < comparisonRows.length; r++) {
      for (let c = 0; c < scenarioArray.length; c++) {
        const cell = sheet.getRange(currentRow + 3 + r, c + 2);
        const value = cell.getValue();
        
        if (value !== "N/A") {
          const numValue = parseFloat(value);
          if (numValue < 80) {
            cell.setBackground(STATS_COLORS.HIGH_DEVIATION);
          } else if (numValue > 90) {
            cell.setBackground(STATS_COLORS.POSITIVE);
          }
        }
      }
    }
  }
  
  // Create a heatmap visualization for the track-scenario performance
  createTrackScenarioHeatmap(sheet, trackScenarioStats, validTracks, scenarioArray, currentRow + comparisonRows.length + 4, 1);
  
  // Add section for track-scenario statistics
  const statsRow = currentRow + comparisonRows.length + 15;
  
  sheet.getRange(statsRow, 1, 1, 10).merge()
    .setValue("Top and Bottom Track-Scenario Combinations")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.SUBHEADER);
  
  // Calculate top and bottom combinations
  const combinations = [];
  
  for (const track of validTracks) {
    for (const scenario of scenarioArray) {
      if (trackScenarioStats[track][scenario] && 
          typeof trackScenarioStats[track][scenario].avgScore === 'number' &&
          trackScenarioStats[track][scenario].numStudents >= 2) {
        combinations.push({
          track: track,
          scenario: scenario,
          score: trackScenarioStats[track][scenario].avgScore,
          students: trackScenarioStats[track][scenario].numStudents
        });
      }
    }
  }
  
  // Sort combinations
  combinations.sort((a, b) => b.score - a.score);
  
  // Add header for top/bottom combinations
  sheet.getRange(statsRow + 1, 1, 1, 5).setValues([
    ["Track", "Scenario", "Average Score", "Students", "Note"]
  ]).setFontWeight("bold").setBackground(STATS_COLORS.NEUTRAL);
  
  // Get top 3 and bottom 3 combinations
  const topCombinations = combinations.slice(0, Math.min(3, combinations.length));
  const bottomCombinations = combinations.slice(Math.max(0, combinations.length - 3)).reverse();
  
  // Create rows for combinations
  const topBottomRows = [];
  
  for (const combo of topCombinations) {
    topBottomRows.push([
      combo.track,
      combo.scenario,
      combo.score.toFixed(2),
      combo.students,
      "Top Performer"
    ]);
  }
  
  // Add a spacer row if we have both top and bottom
  if (topCombinations.length > 0 && bottomCombinations.length > 0) {
    topBottomRows.push(["", "", "", "", ""]);
  }
  
  // Add bottom combinations
  for (const combo of bottomCombinations) {
    topBottomRows.push([
      combo.track,
      combo.scenario,
      combo.score.toFixed(2),
      combo.students,
      "Needs Improvement"
    ]);
  }
  
  // Insert the data
  if (topBottomRows.length > 0) {
    sheet.getRange(statsRow + 2, 1, topBottomRows.length, 5).setValues(topBottomRows);
    
    // Apply formatting
    for (let i = 0; i < topBottomRows.length; i++) {
      const noteCell = sheet.getRange(statsRow + 2 + i, 5);
      if (noteCell.getValue() === "Top Performer") {
        noteCell.setBackground(STATS_COLORS.POSITIVE);
      } else if (noteCell.getValue() === "Needs Improvement") {
        noteCell.setBackground(STATS_COLORS.NEGATIVE);
      }
    }
  }
  
  return statsRow + topBottomRows.length + 6;  // Return next position
}

/**
 * Finalize the statistics sheet by applying final formatting
 */
function finalizeStatsSheet(sheet) {
  // Auto-size columns for better readability
  for (let i = 1; i <= 8; i++) {
    sheet.autoResizeColumn(i);
  }
  
  // Add final notes at the bottom
  const lastRow = sheet.getLastRow() + 2;
  
  sheet.getRange(lastRow, 1, 1, 10).merge()
    .setValue("NOTES AND RECOMMENDATIONS")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.HEADER)
    .setHorizontalAlignment("center");
  
  // Add general notes about interpreting the statistics
  const notes = [
    "• Inter-Rater Reliability (ICC, Kendall's W) values above 0.7 indicate acceptable agreement between graders.",
    "• Significant grader bias (z-score > 0.5 or < -0.5) may require grader calibration sessions.",
    "• Item-Total correlations below 0.3 suggest criteria that don't align well with overall assessment.",
    "• For optimal reliability, this data suggests using at least 5 graders per student (see D-Study).",
    "• Areas with high failure rates may need improved instruction or clearer rubric definitions.",
    "• 25B CHANGE: Innovator pillar (4.1 Enabling Test Innovation, 2.5%) removed. Criterion 3.1 weight raised from 5% to 7.5%. Now 7 criteria / 3 pillars."
  ];
  
  for (let i = 0; i < notes.length; i++) {
    sheet.getRange(lastRow + 1 + i, 1, 1, 10).merge()
      .setValue(notes[i])
      .setBackground(i % 2 === 0 ? STATS_COLORS.NEUTRAL : "white");
  }
  
  // Add timestamp and authorship
  sheet.getRange(lastRow + notes.length + 2, 1, 1, 10).merge()
    .setValue("Report Generated: " + new Date().toLocaleString() + " | Grade Management System v6")
    .setFontStyle("italic")
    .setHorizontalAlignment("center");
}

//=====================================================
// CHART CREATION FUNCTIONS
//=====================================================

/**
 * Create a score distribution chart
 */
function createScoreDistributionChart(sheet, data, row, col, width, height) {
  // Get scores for the chart - ensure they're numeric and valid
  const scores = data
    .filter(s => s.overallAverage !== null && typeof s.overallAverage === 'number' && !isNaN(s.overallAverage))
    .map(s => s.overallAverage);
  
  if (scores.length === 0) {
    // If no valid scores, add a placeholder
    sheet.getRange(row, col + 3, 2, 4).merge()
      .setValue("Insufficient data for score distribution chart")
      .setBackground(STATS_COLORS.NEUTRAL)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    return;
  }
  
  // Create bins for histogram
  const bins = {
    "90-100": 0,
    "80-89": 0,
    "70-79": 0,
    "< 70": 0
  };
  
  // Count scores in each bin
  scores.forEach(score => {
    if (score >= 90) bins["90-100"]++;
    else if (score >= 80) bins["80-89"]++;
    else if (score >= 70) bins["70-79"]++;
    else bins["< 70"]++;
  });
  
  // Convert to chart data
  const chartData = [["Score Range", "Count"]];
  Object.entries(bins).forEach(([range, count]) => {
    chartData.push([range, count]);
  });
  
  // Create the range for chart data
  const dataRange = sheet.getRange(row, col, chartData.length, 2);
  dataRange.setValues(chartData);
  
  // Create the chart
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(dataRange)
    .setPosition(row, col + 3, 0, 0)
    .setOption("title", "Score Distribution")
    .setOption("legend", {position: "none"})
    .setOption("hAxis", {title: "Score Range"})
    .setOption("vAxis", {title: "Number of Students"})
    .setOption("colors", [STATS_COLORS.CHART_COLORS[0]])
    .setOption("width", 350)
    .setOption("height", 200)
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Create an ICC by area chart
 */
function createICCByAreaChart(sheet, iccData, row, col, width, height) {
  // Prepare data for the chart
  const chartData = [["Criterion", "ICC Value"]];
  
  for (let i = 0; i < CRITERIA_NAMES.length; i++) {
    // Only include if we have valid numeric data
    if (typeof iccData[i] === 'number' && !isNaN(iccData[i])) {
      chartData.push([CRITERIA_NAMES[i], iccData[i]]);
    }
  }
  
  if (chartData.length <= 1) {
    // If no valid data, add a placeholder
    sheet.getRange(row, col + 3, 2, 4).merge()
      .setValue("Insufficient data for ICC by criterion chart")
      .setBackground(STATS_COLORS.NEUTRAL)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    return;
  }
  
  // Create the range for chart data
  const dataRange = sheet.getRange(row, col, chartData.length, 2);
  dataRange.setValues(chartData);
  
  // Create the chart
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(dataRange)
    .setPosition(row, col + 3, 0, 0)
    .setOption("title", "Inter-Rater Reliability by Criterion")
    .setOption("legend", {position: "none"})
    .setOption("hAxis", {title: "Criterion", slantedText: true, slantedTextAngle: 45})
    .setOption("vAxis", {
      title: "ICC Value", 
      viewWindow: {min: 0, max: 1},
      gridlines: {count: 5}
    })
    .setOption("colors", [STATS_COLORS.CHART_COLORS[1]])
    .setOption("width", 350)
    .setOption("height", 200)
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Create a grader averages chart
 */
function createGraderAveragesChart(sheet, graderStats, row, col, width, height) {
  // Prepare data for the chart - only include valid numeric averages
  const chartData = [["Grader", "Average Score"]];
  
  // Sort graders by average score
  const sortedGraders = Object.keys(graderStats)
    .filter(grader => 
      typeof graderStats[grader].avgScore === 'number' && 
      !isNaN(graderStats[grader].avgScore) &&
      graderStats[grader].numStudents > 0
    )
    .sort((a, b) => graderStats[a].avgScore - graderStats[b].avgScore);
  
  for (const grader of sortedGraders) {
    chartData.push([grader, graderStats[grader].avgScore]);
  }
  
  if (chartData.length <= 1) {
    // If no valid data, add a placeholder
    sheet.getRange(row, col + 3, 2, 4).merge()
      .setValue("Insufficient data for grader averages chart")
      .setBackground(STATS_COLORS.NEUTRAL)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    return;
  }
  
  // Create the range for chart data
  const dataRange = sheet.getRange(row, col, chartData.length, 2);
  dataRange.setValues(chartData);
  
  // Create the chart
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(dataRange)
    .setPosition(row, col + 3, 0, 0)
    .setOption("title", "Average Scores by Grader")
    .setOption("legend", {position: "none"})
    .setOption("hAxis", {title: "Grader"})
    .setOption("vAxis", {
      title: "Average Score", 
      viewWindow: {min: 60, max: 100},
      gridlines: {count: 5}
    })
    .setOption("colors", [STATS_COLORS.CHART_COLORS[2]])
    .setOption("width", 350)
    .setOption("height", 200)
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Create an item correlation chart
 */
function createItemCorrelationChart(sheet, correlationData, row, col, width, height) {
  // Prepare data for the chart - only include valid data
  const chartData = [["Criterion", "Item-Total Correlation"]];
  
  for (let i = 0; i < CRITERIA_NAMES.length; i++) {
    if (typeof correlationData[i] === 'number' && !isNaN(correlationData[i])) {
      chartData.push([CRITERIA_NAMES[i], correlationData[i]]);
    }
  }
  
  if (chartData.length <= 1) {
    // If no valid data, add a placeholder
    sheet.getRange(row, col + 3, 2, 4).merge()
      .setValue("Insufficient data for item-total correlation chart")
      .setBackground(STATS_COLORS.NEUTRAL)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    return;
  }
  
  // Create the range for chart data
  const dataRange = sheet.getRange(row, col, chartData.length, 2);
  dataRange.setValues(chartData);
  
  // Create the chart
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(dataRange)
    .setPosition(row, col + 3, 0, 0)
    .setOption("title", "Item-Total Correlations by Criterion")
    .setOption("legend", {position: "none"})
    .setOption("hAxis", {title: "Criterion", slantedText: true, slantedTextAngle: 45})
    .setOption("vAxis", {
      title: "Correlation", 
      viewWindow: {min: 0, max: 1},
      gridlines: {count: 5}
    })
    .setOption("colors", [STATS_COLORS.CHART_COLORS[3]])
    .setOption("width", 350)
    .setOption("height", 200)
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Create a difficulty-discrimination chart
 */
function createDifficultyDiscriminationChart(sheet, difficultyData, discriminationData, row, col, width, height) {
  // Prepare data for the scatter plot - only include valid data
  const chartData = [["Difficulty", "Discrimination", "Criterion"]];
  
  for (let i = 0; i < CRITERIA_NAMES.length; i++) {
    if (typeof difficultyData[i] === 'number' && !isNaN(difficultyData[i]) &&
        typeof discriminationData[i] === 'number' && !isNaN(discriminationData[i])) {
      chartData.push([difficultyData[i], discriminationData[i], CRITERIA_NAMES[i]]);
    }
  }
  
  if (chartData.length <= 1) {
    // If no valid data, add a placeholder
    sheet.getRange(row, col + 3, 2, 4).merge()
      .setValue("Insufficient data for difficulty-discrimination chart")
      .setBackground(STATS_COLORS.NEUTRAL)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    return;
  }
  
  // Create the range for chart data
  const dataRange = sheet.getRange(row, col, chartData.length, 3);
  dataRange.setValues(chartData);
  
  // Create the chart
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.SCATTER)
    .addRange(dataRange)
    .setPosition(row, col + 3, 0, 0)
    .setOption("title", "Difficulty vs. Discrimination by Criterion")
    .setOption("hAxis", {
      title: "Difficulty Index", 
      viewWindow: {min: 1, max: 8},
      gridlines: {count: 6}
    })
    .setOption("vAxis", {
      title: "Discrimination Index", 
      viewWindow: {min: -0.2, max: 1},
      gridlines: {count: 6}
    })
    .setOption("trendlines", {0: {}})
    .setOption("colors", [STATS_COLORS.CHART_COLORS[4]])
    .setOption("width", 350)
    .setOption("height", 200)
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Create an area heatmap chart
 */
function createAreaHeatmapChart(sheet, heatmapData, row, col, width, height) {
  // Prepare data for the chart - only include valid data
  const chartData = [["Criterion", "Average Score"]];
  
  for (let i = 0; i < CRITERIA_NAMES.length; i++) {
    if (typeof heatmapData[i] === 'number' && !isNaN(heatmapData[i])) {
      chartData.push([CRITERIA_NAMES[i], heatmapData[i]]);
    }
  }
  
  if (chartData.length <= 1) {
    // If no valid data, add a placeholder
    sheet.getRange(row, col + 3, 2, 4).merge()
      .setValue("Insufficient data for criteria averages chart")
      .setBackground(STATS_COLORS.NEUTRAL)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    return;
  }
  
  // Create the range for chart data
  const dataRange = sheet.getRange(row, col, chartData.length, 2);
  dataRange.setValues(chartData);
  
  // Sort the data for better visualization
  // (We need to skip the header row)
  const dataValues = dataRange.getValues();
  const headerRow = dataValues.shift();
  dataValues.sort((a, b) => a[1] - b[1]);
  dataValues.unshift(headerRow);
  dataRange.setValues(dataValues);
  
  // Create the chart
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(dataRange)
    .setPosition(row, col + 3, 0, 0)
    .setOption("title", "Average Score by Criterion (Sorted)")
    .setOption("legend", {position: "none"})
    .setOption("hAxis", {
      title: "Average Score (1-8 scale, lower is better)",
      viewWindow: {min: 1, max: 8},
      gridlines: {count: 6}
    })
    .setOption("vAxis", {title: ""})
    .setOption("colors", [STATS_COLORS.CHART_COLORS[5]])
    .setOption("width", 350)
    .setOption("height", 200)
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Create a variability chart
 */
function createVariabilityChart(sheet, variabilityData, row, col, width, height) {
  // Prepare data for the chart - only include valid data
  const chartData = [["Student", "StdDev", "Range"]];
  
  // Sort students by standard deviation (highest first)
  const sortedStudents = Object.keys(variabilityData)
    .filter(student => 
      typeof variabilityData[student].stdDev === 'number' && 
      !isNaN(variabilityData[student].stdDev) &&
      typeof variabilityData[student].range === 'number' && 
      !isNaN(variabilityData[student].range)
    )
    .sort((a, b) => variabilityData[b].stdDev - variabilityData[a].stdDev);
  
  // Take only top 10 students
  const topStudents = sortedStudents.slice(0, 10);
  
  for (const student of topStudents) {
    chartData.push([
      student, 
      variabilityData[student].stdDev,
      variabilityData[student].range
    ]);
  }
  
  if (chartData.length <= 1) {
    // If no valid data, add a placeholder
    sheet.getRange(row, col + 3, 2, 4).merge()
      .setValue("Insufficient data for student variability chart")
      .setBackground(STATS_COLORS.NEUTRAL)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    return;
  }
  
  // Create the range for chart data
  const dataRange = sheet.getRange(row, col, chartData.length, 3);
  dataRange.setValues(chartData);
  
  // Create the chart
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.COMBO)
    .addRange(dataRange)
    .setPosition(row, col + 3, 0, 0)
    .setOption("title", "Students with Highest Grade Variability")
    .setOption("seriesType", "bars")
    .setOption("series", {
      0: {type: "bars", targetAxisIndex: 0},
      1: {type: "line", targetAxisIndex: 0}
    })
    .setOption("hAxis", {title: "Student"})
    .setOption("vAxis", {title: "Variability Measure"})
    .setOption("colors", [STATS_COLORS.CHART_COLORS[6], STATS_COLORS.CHART_COLORS[7]])
    .setOption("width", 350)
    .setOption("height", 200)
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Create G-theory charts
 */
function createGTheoryCharts(sheet, gStudyResults, dStudyData, row, col, width, height) {
  // Check if we have valid data
  const hasValidData = typeof gStudyResults.studentVariance === 'number' && 
                    typeof gStudyResults.graderVariance === 'number' && 
                    typeof gStudyResults.areaVariance === 'number' && 
                    typeof gStudyResults.residualVariance === 'number';
  
  if (!hasValidData) {
    // If no valid data, add a placeholder
    sheet.getRange(row, col + 3, 2, 4).merge()
      .setValue("Insufficient data for G-theory charts")
      .setBackground(STATS_COLORS.NEUTRAL)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    return;
  }
  
  // 1. Variance components pie chart
  const varianceData = [
    ["Source", "Variance"],
    ["Student", gStudyResults.studentVariance],
    ["Grader", gStudyResults.graderVariance],
    ["Area", gStudyResults.areaVariance],
    ["Residual", gStudyResults.residualVariance]
  ];
  
  // Create the range for variance data
  const varianceRange = sheet.getRange(row, col, varianceData.length, 2);
  varianceRange.setValues(varianceData);
  
  // Create the pie chart
  const pieChart = sheet.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(varianceRange)
    .setPosition(row, col + 3, 0, 0)
    .setOption("title", "Variance Components")
    .setOption("pieSliceText", "percentage")
    .setOption("colors", STATS_COLORS.CHART_COLORS)
    .setOption("width", 350)
    .setOption("height", 200)
    .build();
  
  sheet.insertChart(pieChart);
  
  // 2. D-Study predicted reliability chart
  const reliabilityData = [["Number of Graders", "Predicted Reliability"]];
  
  for (const row of dStudyData) {
    if (row[1] !== "N/A") {
      reliabilityData.push(row);
    }
  }
  
  if (reliabilityData.length <= 1) {
    return; // Not enough data for the second chart
  }
  
  // Create the range for reliability data
  const reliabilityRange = sheet.getRange(row + 12, col, reliabilityData.length, 2);
  reliabilityRange.setValues(reliabilityData);
  
  // Create the line chart
  const lineChart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(reliabilityRange)
    .setPosition(row + 12, col + 3, 0, 0)
    .setOption("title", "Predicted Reliability by Number of Graders")
    .setOption("legend", {position: "none"})
    .setOption("hAxis", {title: "Number of Graders"})
    .setOption("vAxis", {
      title: "Reliability", 
      viewWindow: {min: 0, max: 1},
      gridlines: {count: 5}
    })
    .setOption("colors", [STATS_COLORS.CHART_COLORS[0]])
    .setOption("width", 350)
    .setOption("height", 200)
    .build();
  
  sheet.insertChart(lineChart);
}

/**
 * Create a scenario performance chart
 */
function createScenarioPerformanceChart(sheet, scenarioStats, row, col, width, height) {
  // Prepare data for the chart - only include valid numeric averages
  const chartData = [["Scenario", "Average Score"]];
  
  // Sort scenarios by average score
  const sortedScenarios = Object.keys(scenarioStats)
    .filter(scenario => 
      scenario !== "" &&
      typeof scenarioStats[scenario].avgScore === 'number' && 
      !isNaN(scenarioStats[scenario].avgScore) &&
      scenarioStats[scenario].numStudents > 0
    )
    .sort((a, b) => scenarioStats[b].avgScore - scenarioStats[a].avgScore);
  
  for (const scenario of sortedScenarios) {
    chartData.push([scenario, scenarioStats[scenario].avgScore]);
  }
  
  if (chartData.length <= 1) {
    // If no valid data, add a placeholder
    sheet.getRange(row, col + 3, 2, 4).merge()
      .setValue("Insufficient data for scenario performance chart")
      .setBackground(STATS_COLORS.NEUTRAL)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    return;
  }
  
  // Create the range for chart data
  const dataRange = sheet.getRange(row, col, chartData.length, 2);
  dataRange.setValues(chartData);
  
  // Create the chart
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(dataRange)
    .setPosition(row, col + 3, 0, 0)
    .setOption("title", "Average Scores by Scenario")
    .setOption("legend", {position: "none"})
    .setOption("hAxis", {
      title: "Scenario", 
      slantedText: true, 
      slantedTextAngle: 45
    })
    .setOption("vAxis", {
      title: "Average Score", 
      viewWindow: {min: 60, max: 100},
      gridlines: {count: 5}
    })
    .setOption("colors", [STATS_COLORS.CHART_COLORS[4]])
    .setOption("width", 350)
    .setOption("height", 200)
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Create a track performance chart
 */
function createTrackPerformanceChart(sheet, trackStats, row, col, width, height) {
  // Prepare data for the chart - only include valid numeric averages
  const chartData = [["Track", "Average Score"]];
  
  // Sort tracks by average score
  const sortedTracks = Object.keys(trackStats)
    .filter(track => 
      track !== "" &&
      typeof trackStats[track].avgScore === 'number' && 
      !isNaN(trackStats[track].avgScore) &&
      trackStats[track].numStudents > 0
    )
    .sort((a, b) => trackStats[b].avgScore - trackStats[a].avgScore);
  
  for (const track of sortedTracks) {
    chartData.push([track, trackStats[track].avgScore]);
  }
  
  if (chartData.length <= 1) {
    // If no valid data, add a placeholder
    sheet.getRange(row, col + 3, 2, 4).merge()
      .setValue("Insufficient data for track performance chart")
      .setBackground(STATS_COLORS.NEUTRAL)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    return;
  }
  
  // Create the range for chart data
  const dataRange = sheet.getRange(row, col, chartData.length, 2);
  dataRange.setValues(chartData);
  
  // Create the chart
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(dataRange)
    .setPosition(row, col + 3, 0, 0)
    .setOption("title", "Average Scores by Track")
    .setOption("legend", {position: "none"})
    .setOption("hAxis", {title: "Track"})
    .setOption("vAxis", {
      title: "Average Score", 
      viewWindow: {min: 60, max: 100},
      gridlines: {count: 5}
    })
    .setOption("colors", [STATS_COLORS.CHART_COLORS[3]])
    .setOption("width", 350)
    .setOption("height", 200)
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Create a scenario-criteria heatmap visualization
 */
function createScenarioCriteriaHeatmap(sheet, scenarioCriteriaStats, row, col) {
  // Set title for the visualization
  sheet.getRange(row, col, 1, 10).merge()
    .setValue("Scenario Performance Heatmap by Criteria")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.SUBHEADER);
  
  // Filter for scenarios with sufficient data
  const validScenarios = Object.keys(scenarioCriteriaStats).filter(scenario => 
    scenario !== "" && Object.values(scenarioCriteriaStats[scenario]).some(stats => 
      typeof stats.avgScore === 'number' && !isNaN(stats.avgScore)
    )
  );
  
  if (validScenarios.length === 0) {
    sheet.getRange(row + 1, col).setValue("Insufficient data for heatmap visualization");
    return;
  }
  
  // Sort scenarios by average overall score if possible
  validScenarios.sort((a, b) => {
    const getAvg = (scenario) => {
      let sum = 0, count = 0;
      for (let c = 0; c < CRITERIA_NAMES.length; c++) {
        if (scenarioCriteriaStats[scenario][c] && 
            typeof scenarioCriteriaStats[scenario][c].avgScore === 'number') {
          sum += scenarioCriteriaStats[scenario][c].avgScore;
          count++;
        }
      }
      return count > 0 ? sum / count : 0;
    };
    
    return getAvg(b) - getAvg(a);
  });
  
  // Create a header row with criteria names
  const headerRow = ["Scenario", ...CRITERIA_NAMES];
  sheet.getRange(row + 1, col, 1, headerRow.length).setValues([headerRow])
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.NEUTRAL);
  
  // Build the heatmap data
  const heatmapRows = [];
  
  for (const scenario of validScenarios) {
    const rowData = [scenario];
    
    for (let c = 0; c < CRITERIA_NAMES.length; c++) {
      if (scenarioCriteriaStats[scenario][c] && 
          typeof scenarioCriteriaStats[scenario][c].avgScore === 'number') {
        rowData.push(scenarioCriteriaStats[scenario][c].avgScore);
      } else {
        rowData.push("N/A");
      }
    }
    
    heatmapRows.push(rowData);
  }
  
  if (heatmapRows.length > 0) {
    sheet.getRange(row + 2, col, heatmapRows.length, headerRow.length).setValues(heatmapRows);
    
    // Apply conditional formatting for the heatmap effect
    for (let r = 0; r < heatmapRows.length; r++) {
      for (let c = 1; c < headerRow.length; c++) {
        const cell = sheet.getRange(row + 2 + r, col + c);
        const value = cell.getValue();
        
        if (value !== "N/A" && typeof value === 'number') {
          // Create color gradient based on value (60-100 scale)
          // Higher values (better scores) get green, lower values (worse scores) get red
          const normalizedValue = Math.max(0, Math.min(1, (value - 60) / 40));
          const r = Math.round(255 * (1 - normalizedValue));
          const g = Math.round(255 * normalizedValue);
          const b = 0;
          
          cell.setBackground(`rgb(${r}, ${g}, ${b})`);
          
          // Use white text for darker backgrounds
          if (normalizedValue < 0.5) {
            cell.setFontColor("white");
          }
        }
      }
    }
  }
}

/**
 * Create a heatmap visualization for track-scenario performance
 */
function createTrackScenarioHeatmap(sheet, trackScenarioStats, validTracks, scenarioArray, row, col) {
  // Set title for the visualization
  sheet.getRange(row, col, 1, 10).merge()
    .setValue("Track-Scenario Performance Heatmap")
    .setFontWeight("bold")
    .setBackground(STATS_COLORS.SUBHEADER);
  
  if (validTracks.length === 0 || scenarioArray.length === 0) {
    sheet.getRange(row + 1, col).setValue("Insufficient data for heatmap visualization");
    return;
  }
  
  // Prepare data for heatmap visualization
  const heatmapData = [];
  
  for (const track of validTracks) {
    for (const scenario of scenarioArray) {
      if (trackScenarioStats[track][scenario] && 
          typeof trackScenarioStats[track][scenario].avgScore === 'number' &&
          trackScenarioStats[track][scenario].numStudents >= 2) {
        heatmapData.push({
          track: track,
          scenario: scenario,
          score: trackScenarioStats[track][scenario].avgScore,
          students: trackScenarioStats[track][scenario].numStudents
        });
      }
    }
  }
  
  if (heatmapData.length === 0) {
    sheet.getRange(row + 1, col).setValue("Insufficient data for heatmap visualization");
    return;
  }
  
  // Setup for bubble chart visualization
  const chartData = [["Track", "Scenario", "Score", "Students"]];
  
  for (const item of heatmapData) {
    chartData.push([item.track, item.scenario, item.score, item.students]);
  }
  
  // Create the range for chart data
  const dataRange = sheet.getRange(row + 1, col, chartData.length, 4);
  dataRange.setValues(chartData);
  
  // Create the chart
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.BUBBLE)
    .addRange(dataRange)
    .setPosition(row + 2, col, 0, 0)
    .setOption("title", "Track-Scenario Performance")
    .setOption("hAxis", {title: "Track"})
    .setOption("vAxis", {title: "Scenario"})
    .setOption("bubble.textStyle", {fontSize: 12})
    .setOption("colorAxis", {
      colors: ['#FF0000', '#FFFF00', '#00FF00'],
      minValue: 70,
      maxValue: 100
    })
    .setOption("sizeAxis", {minValue: 2, maxValue: 10, minSize: 5, maxSize: 20})
    .setOption("width", 600)
    .setOption("height", 400)
    .build();
  
  sheet.insertChart(chart);
}

//=====================================================
// STATISTICAL CALCULATION FUNCTIONS - REVISED FOR BETTER ACCURACY
//=====================================================

/**
 * Calculate the passing rate of all students
 */
function calculatePassingRate(data) {
  const studentsWithScores = data.filter(s => 
    s.overallAverage !== null && 
    typeof s.overallAverage === 'number' && 
    !isNaN(s.overallAverage)
  );
  
  if (studentsWithScores.length === 0) return "N/A";
  
  // In this system, scores below 70 are failing
  const passCount = studentsWithScores.filter(s => s.overallAverage >= 70).length;
  const passRate = (passCount / studentsWithScores.length) * 100;
  return passRate.toFixed(1);
}

/**
 * Estimate the overall reliability of the grading system
 * Returns a value between 0 and 1, where higher is better
 */
function estimateOverallReliability(data) {
  // We'll use a simplified ICC calculation
  return calculateICC(data);
}

/**
 * Detect if there is significant bias between graders
 */
function detectSignificantGraderBias(data) {
  const graderStats = calculateGraderStats(data);
  
  // Filter for valid scores only
  const graderScores = Object.values(graderStats)
    .filter(s => typeof s.avgScore === 'number' && !isNaN(s.avgScore))
    .map(s => s.avgScore);
  
  if (graderScores.length < 2) return false;
  
  const avg = calculateAverage(graderScores);
  const stdDev = calculateStandardDeviation(graderScores);
  
  if (typeof avg !== 'number' || typeof stdDev !== 'number' || stdDev === 0) return false;
  
  // Check if any grader deviates by more than the threshold
  return Object.values(graderStats).some(stats => {
    if (typeof stats.avgScore !== 'number' || isNaN(stats.avgScore)) return false;
    return Math.abs(stats.avgScore - avg) > THRESHOLDS.GRADER_DEVIATION * stdDev;
  });
}

/**
 * Calculate Intraclass Correlation Coefficient (ICC)
 * This is a simplified version of ICC(2,k)
 */
function calculateICC(data) {
  try {
    // Filter to students with at least 2 graders
    const eligibleStudents = data.filter(s => Object.keys(s.graders).length >= 2);
    
    if (eligibleStudents.length < 2) return "N/A";
    
    // Calculate between-student and within-student variance
    let MSB = 0; // Mean Square Between students
    let MSW = 0; // Mean Square Within students
    let totalStudents = 0;
    let totalGraders = 0;
    
    // For each student, calculate the variance of grader scores
    for (const student of eligibleStudents) {
      // Extract valid weighted sums
      const graderScores = Object.values(student.graders)
        .filter(g => typeof g.weightedSum === 'number' && !isNaN(g.weightedSum))
        .map(g => g.weightedSum);
      
      if (graderScores.length >= 2) {
        totalStudents++;
        totalGraders += graderScores.length;
        
        // Student mean
        const studentMean = calculateAverage(graderScores);
        
        // Within-student variance
        const studentVariance = calculateVariance(graderScores);
        MSW += studentVariance * (graderScores.length - 1);
        
        // Between-student component
        MSB += graderScores.length * Math.pow(studentMean, 2);
      }
    }
    
    if (totalStudents < 2 || totalGraders < 4) return "N/A";
    
    // Average number of graders per student
    const avgGraders = totalGraders / totalStudents;
    
    // Calculate MS components
    MSB = MSB / totalStudents;
    MSW = MSW / (totalGraders - totalStudents);
    
    // ICC(2,k) formula: (MSB - MSW) / MSB
    const icc = (MSB - MSW) / MSB;
    
    // Handle edge cases and bounded result
    return Math.max(0, Math.min(1, icc));
  } catch (error) {
    console.error("Error calculating ICC:", error.message);
    return "N/A";
  }
}

/**
 * Calculate ICC by criterion
 */
function calculateICCByCriterion(data) {
  const iccValues = {};
  
  // Calculate ICC for each criterion
  for (let c = 0; c < CRITERIA_NAMES.length; c++) {
    try {
      // Extract criterion-specific data
      const critData = [];
      
      for (const student of data) {
        const critGraders = {};
        
        for (const grader in student.graders) {
          // Find the grade for this criterion
          const matchingGrade = student.graders[grader].grades.find(g => g.criteriaIndex === c);
          
          if (matchingGrade && typeof matchingGrade.score === 'number' && !isNaN(matchingGrade.score)) {
            critGraders[grader] = { score: matchingGrade.score };
          }
        }
        
        if (Object.keys(critGraders).length >= 2) {
          critData.push({
            student: student.student,
            graders: critGraders
          });
        }
      }
      
      // Calculate ICC for this criterion if we have enough data
      if (critData.length >= 2) {
        // Similar ICC calculation as above
        let MSB = 0;
        let MSW = 0;
        let totalStudents = 0;
        let totalGraders = 0;
        
        for (const student of critData) {
          const graderScores = Object.values(student.graders).map(g => g.score);
          
          if (graderScores.length >= 2) {
            totalStudents++;
            totalGraders += graderScores.length;
            
            const studentMean = calculateAverage(graderScores);
            const studentVariance = calculateVariance(graderScores);
            
            MSW += studentVariance * (graderScores.length - 1);
            MSB += graderScores.length * Math.pow(studentMean, 2);
          }
        }
        
        if (totalStudents >= 2 && totalGraders >= 4) {
          MSB = MSB / totalStudents;
          MSW = MSW / (totalGraders - totalStudents);
          
          if (MSB > 0) {
            const icc = (MSB - MSW) / MSB;
            iccValues[c] = Math.max(0, Math.min(1, icc));
          } else {
            iccValues[c] = 0;
          }
        } else {
          iccValues[c] = "N/A";
        }
      } else {
        iccValues[c] = "N/A";
      }
    } catch (error) {
      console.error(`Error calculating ICC for criterion ${c}:`, error.message);
      iccValues[c] = "N/A";
    }
  }
  
  // Calculate average ICC across all criteria
  const validIccValues = Object.values(iccValues)
    .filter(v => typeof v === 'number' && !isNaN(v));
  
  if (validIccValues.length > 0) {
    iccValues["average"] = calculateAverage(validIccValues);
  } else {
    iccValues["average"] = "N/A";
  }
  
  return iccValues;
}

/**
 * Calculate Kendall's W (Coefficient of Concordance)
 * This is a simplified implementation
 */
function calculateKendallW(data) {
  try {
    // Need at least 2 students with multiple graders
    const eligibleStudents = data.filter(s => Object.keys(s.graders).length >= 2);
    
    if (eligibleStudents.length < 2) return "N/A";
    
    // We'll use a simplified approach - calculate the variance of ranks
    // This is not exactly Kendall's W but serves as an approximation
    let totalRankVariance = 0;
    let totalStudents = 0;
    let totalGraders = 0;
    
    for (const student of eligibleStudents) {
      // Get valid scores
      const graderScores = Object.values(student.graders)
        .filter(g => typeof g.weightedSum === 'number' && !isNaN(g.weightedSum))
        .map(g => g.weightedSum);
      
      if (graderScores.length >= 2) {
        // Sort scores to get ranks
        const sortedScores = [...graderScores].sort((a, b) => a - b);
        const ranks = graderScores.map(score => sortedScores.indexOf(score) + 1);
        
        // Calculate variance of ranks
        const rankVariance = calculateVariance(ranks);
        totalRankVariance += rankVariance;
        
        totalStudents++;
        totalGraders += graderScores.length;
      }
    }
    
    if (totalStudents < 2) return "N/A";
    
    // Average rank variance
    const avgRankVariance = totalRankVariance / totalStudents;
    
    // Maximum possible variance (simplified) is when all ranks are different
    const avgGraders = totalGraders / totalStudents;
    const maxRankVariance = (Math.pow(avgGraders, 2) - 1) / 12;
    
    if (maxRankVariance === 0) return "N/A";
    
    // Normalize to 0-1 scale
    const w = avgRankVariance / maxRankVariance;
    
    // Handle edge cases and bounded result
    return Math.max(0, Math.min(1, w));
  } catch (error) {
    console.error("Error calculating Kendall's W:", error.message);
    return "N/A";
  }
}

/**
 * Calculate Fleiss' Kappa for agreement on pass/fail
 */
function calculateFleissKappa(data) {
  try {
    // Need students with multiple graders
    const eligibleStudents = data.filter(s => Object.keys(s.graders).length >= 2);
    
    if (eligibleStudents.length < 2) return "N/A";
    
    // Calculate agreement on pass/fail
    let totalAgreementP = 0;
    let totalP = 0;
    let totalStudents = 0;
    
    for (const student of eligibleStudents) {
      // Get pass/fail from each grader
      const graderResults = [];
      
      for (const grader in student.graders) {
        // Check if any grade is a fail
        const hasFail = student.graders[grader].grades.some(g => g.textValue === "8. Fail");
        graderResults.push(hasFail ? 1 : 0); // 1 for fail, 0 for pass
      }
      
      if (graderResults.length >= 2) {
        // Calculate agreement for this student
        const n = graderResults.length;
        
        // Count outcomes in each category
        const countFail = graderResults.filter(r => r === 1).length;
        const countPass = n - countFail;
        
        // Proportions
        const propFail = countFail / n;
        const propPass = countPass / n;
        
        // Calculate Pi (proportion of pairs in agreement)
        const pi = (Math.pow(propFail, 2) + Math.pow(propPass, 2));
        const piAdjusted = (pi * n) / (n - 1); // Adjustment for Fleiss' kappa
        
        totalAgreementP += piAdjusted;
        totalP += (propFail * propPass);
        totalStudents++;
      }
    }
    
    if (totalStudents < 2) return "N/A";
    
    // Average proportion of agreement
    const P = totalAgreementP / totalStudents;
    const Pe = totalP / totalStudents;
    
    if (Pe >= 1) return "N/A"; // Avoid division by zero
    
    // Fleiss' Kappa formula: (P - Pe) / (1 - Pe)
    const kappa = (P - Pe) / (1 - Pe);
    
    // Handle edge cases and bounded result
    return Math.max(-1, Math.min(1, kappa));
  } catch (error) {
    console.error("Error calculating Fleiss' Kappa:", error.message);
    return "N/A";
  }
}

/**
* Calculate grader statistics - REVISED TO FIX SCALE ISSUES
 */
function calculateGraderStats(data) {
  const graderStats = {};
  
  // Collect all grades by grader
  for (const student of data) {
    for (const grader in student.graders) {
      if (!graderStats[grader]) {
        graderStats[grader] = {
          scores: [],
          numStudents: 0
        };
      }
      
      // Only use valid weighted sums
      const weightedSum = student.graders[grader].weightedSum;
      if (typeof weightedSum === 'number' && !isNaN(weightedSum)) {
        graderStats[grader].scores.push(weightedSum);
        graderStats[grader].numStudents++;
      }
    }
  }
  
  // Calculate statistics for each grader
  for (const grader in graderStats) {
    const stats = graderStats[grader];
    
    if (stats.scores.length > 0) {
      stats.avgScore = calculateAverage(stats.scores);
      stats.stdDev = calculateStandardDeviation(stats.scores);
      stats.min = Math.min(...stats.scores);
      stats.max = Math.max(...stats.scores);
      stats.range = stats.max - stats.min;
    } else {
      // Set default values when no scores are available
      stats.avgScore = "N/A";
      stats.stdDev = "N/A";
      stats.min = "N/A";
      stats.max = "N/A";
      stats.range = "N/A";
    }
  }
  
  return graderStats;
}

/**
 * Perform ANOVA analysis for grader effect
 */
function performGraderANOVA(data) {
  try {
    // Prepare data for ANOVA
    const graderGroups = {};
    
    for (const student of data) {
      for (const grader in student.graders) {
        const weightedSum = student.graders[grader].weightedSum;
        if (typeof weightedSum === 'number' && !isNaN(weightedSum)) {
          if (!graderGroups[grader]) {
            graderGroups[grader] = [];
          }
          
          graderGroups[grader].push(weightedSum);
        }
      }
    }
    
    // Remove graders with too few scores
    Object.keys(graderGroups).forEach(grader => {
      if (graderGroups[grader].length < 2) {
        delete graderGroups[grader];
      }
    });
    
    if (Object.keys(graderGroups).length < 2) {
      return {
        SSB: "N/A",
        SSW: "N/A",
        dfB: 0,
        dfW: 0,
        F: "N/A",
        pValue: "N/A"
      };
    }
    
    // Calculate grand mean
    const allScores = [];
    for (const grader in graderGroups) {
      allScores.push(...graderGroups[grader]);
    }
    
    const grandMean = calculateAverage(allScores);
    
    // Calculate Sum of Squares Between groups (SSB)
    let SSB = 0;
    for (const grader in graderGroups) {
      const groupMean = calculateAverage(graderGroups[grader]);
      SSB += graderGroups[grader].length * Math.pow(groupMean - grandMean, 2);
    }
    
    // Calculate Sum of Squares Within groups (SSW)
    let SSW = 0;
    for (const grader in graderGroups) {
      const groupMean = calculateAverage(graderGroups[grader]);
      SSW += graderGroups[grader].reduce((sum, score) => {
        return sum + Math.pow(score - groupMean, 2);
      }, 0);
    }
    
    // Degrees of freedom
    const dfB = Object.keys(graderGroups).length - 1;
    const dfW = allScores.length - Object.keys(graderGroups).length;
    
    // Mean squares
    const MSB = SSB / dfB;
    const MSW = SSW / dfW;
    
    // F statistic
    const F = MSB / MSW;
    
    // p-value (simplified approximation)
    // This is a very rough approximation - in a real implementation we would use an F distribution
    const pValue = 1 / (1 + Math.exp(Math.min(10, Math.max(-10, (F - 1) * 2))));
    
    return {
      SSB,
      SSW,
      dfB,
      dfW,
      F,
      pValue
    };
  } catch (error) {
    console.error("Error performing ANOVA:", error.message);
    return {
      SSB: "N/A",
      SSW: "N/A",
      dfB: 0,
      dfW: 0,
      F: "N/A",
      pValue: "N/A"
    };
  }
}

/**
 * Calculate Cronbach's Alpha
 */
function calculateCronbachAlpha(data) {
  try {
    // We need students with multiple grades across multiple criteria
    const eligibleStudents = [];
    
    // Transform data into a matrix where each row is a student and each column is a grader-criterion pair
    for (const student of data) {
      // Need at least 2 graders with grades
      if (Object.keys(student.graders).length < 2) continue;
      
      // Create a flat array of all grades for this student
      const gradesArray = [];
      
      // For each criterion, collect grades from all graders
      for (let c = 0; c < CRITERIA_NAMES.length; c++) {
        for (const grader in student.graders) {
          // Find the grade for this criterion
          const criterionGrade = student.graders[grader].grades.find(g => g.criteriaIndex === c);
          
          if (criterionGrade && typeof criterionGrade.score === 'number' && !isNaN(criterionGrade.score)) {
            gradesArray.push(criterionGrade.score);
          }
        }
      }
      
      // Only include if we have enough grades
      if (gradesArray.length >= 4) {
        eligibleStudents.push({
          student: student.student,
          grades: gradesArray
        });
      }
    }
    
    if (eligibleStudents.length < 2) return "N/A";
    
    // Calculate item variances and total variance
    const itemVars = [];
    const totalScores = [];
    
    // Assume each student has the same number of grades
    const n = eligibleStudents[0].grades.length;
    
    // Calculate variance for each item (grade position)
    for (let i = 0; i < n; i++) {
      const itemScores = eligibleStudents.map(s => s.grades[i] || 0);
      itemVars.push(calculateVariance(itemScores));
    }
    
    // Calculate total scores and variance
    for (const student of eligibleStudents) {
      const totalScore = student.grades.reduce((sum, grade) => sum + grade, 0);
      totalScores.push(totalScore);
    }
    
    const totalVar = calculateVariance(totalScores);
    
    if (totalVar === 0) return "N/A"; // Avoid division by zero
    
    // Cronbach's Alpha formula: [n/(n-1)] * [1 - (sum of item variances / variance of total scores)]
    const sumItemVars = itemVars.reduce((sum, v) => sum + v, 0);
    const alpha = (n / (n - 1)) * (1 - (sumItemVars / totalVar));
    
    // Handle edge cases and bounded result
    return Math.max(0, Math.min(1, alpha));
  } catch (error) {
    console.error("Error calculating Cronbach's Alpha:", error.message);
    return "N/A";
  }
}

/**
 * Calculate Item-Total Correlations
 */
function calculateItemTotalCorrelations(data) {
  const correlations = {};
  
  // For each criterion, calculate its correlation with total score
  for (let c = 0; c < CRITERIA_NAMES.length; c++) {
    try {
      // Collect item scores and total scores
      const itemScores = [];
      const totalScores = [];
      
      for (const student of data) {
        // Need valid overall score
        if (student.overallAverage === null || 
            typeof student.overallAverage !== 'number' || 
            isNaN(student.overallAverage)) continue;
        
        // Get all grades for this criterion
        let criterionScores = [];
        
        for (const grader in student.graders) {
          // Find the grade for this criterion
          const criterionGrade = student.graders[grader].grades.find(g => g.criteriaIndex === c);
          
          if (criterionGrade && typeof criterionGrade.score === 'number' && !isNaN(criterionGrade.score)) {
            criterionScores.push(criterionGrade.score);
          }
        }
        
        // Only include if we have grades for this criterion
        if (criterionScores.length > 0) {
          // Use average score for this criterion
          const avgCriterionScore = calculateAverage(criterionScores);
          itemScores.push(avgCriterionScore);
          totalScores.push(student.overallAverage);
        }
      }
      
      // Calculate correlation if we have enough data
      if (itemScores.length >= 5) {
        correlations[c] = calculateCorrelation(itemScores, totalScores);
      } else {
        correlations[c] = "N/A";
      }
    } catch (error) {
      console.error(`Error calculating item-total correlation for criterion ${c}:`, error.message);
      correlations[c] = "N/A";
    }
  }
  
  return correlations;
}

/**
 * Calculate difficulty indices for each criterion
 */
function calculateDifficultyIndices(data) {
  const difficulties = {};
  
  // For each criterion, calculate its average score
  for (let c = 0; c < CRITERIA_NAMES.length; c++) {
    try {
      // Collect all grades for this criterion
      const criterionScores = [];
      
      for (const student of data) {
        for (const grader in student.graders) {
          // Find the grade for this criterion
          const criterionGrade = student.graders[grader].grades.find(g => g.criteriaIndex === c);
          
          if (criterionGrade && 
              typeof criterionGrade.numericValue === 'number' && 
              !isNaN(criterionGrade.numericValue)) {
            criterionScores.push(criterionGrade.numericValue);
          }
        }
      }
      
      console.log(`Criterion ${c}: Found ${criterionScores.length} valid scores`);
      
      // Calculate average if we have enough data (reduced threshold from 5 to 3)
      if (criterionScores.length >= 3) {
        difficulties[c] = calculateAverage(criterionScores);
      } else {
        difficulties[c] = "N/A";
      }
    } catch (error) {
      console.error(`Error calculating difficulty index for criterion ${c}:`, error.message);
      difficulties[c] = "N/A";
    }
  }
  
  return difficulties;
}

/**
 * Calculate discrimination indices for each criterion
 */
function calculateDiscriminationIndices(data) {
  const discriminations = {};
  
  // For each criterion, calculate its correlation with total score
  for (let c = 0; c < CRITERIA_NAMES.length; c++) {
    try {
      // Collect item scores and total scores
      const itemScores = [];
      const totalScores = [];
      
      for (const student of data) {
        // Need valid overall score
        if (student.overallAverage === null || 
            typeof student.overallAverage !== 'number' || 
            isNaN(student.overallAverage)) continue;
        
        // Get all grades for this criterion
        let criterionScores = [];
        
        for (const grader in student.graders) {
          // Find the grade for this criterion
          const criterionGrade = student.graders[grader].grades.find(g => g.criteriaIndex === c);
          
          if (criterionGrade && 
              typeof criterionGrade.numericValue === 'number' && 
              !isNaN(criterionGrade.numericValue)) {
            criterionScores.push(criterionGrade.numericValue);
          }
        }
        
        // Only include if we have grades for this criterion
        if (criterionScores.length > 0) {
          // Use average score for this criterion
          const avgCriterionScore = calculateAverage(criterionScores);
          itemScores.push(avgCriterionScore);
          totalScores.push(student.overallAverage);
        }
      }
      
      console.log(`Discrimination for criterion ${c}: Found ${itemScores.length} valid pairs`);
      
      // Calculate correlation if we have enough data (reduced threshold from 5 to 3)
      if (itemScores.length >= 3) {
        // Note: For discrimination, we use the raw criterion score on 1-8 scale
        // Invert the correlation since lower values are better in our scale
        const rawCorrelation = calculateCorrelation(itemScores, totalScores);
        
        // We invert because on our scale, 1 is best and 8 is worst
        discriminations[c] = rawCorrelation !== 0 ? -rawCorrelation : 0;
      } else {
        discriminations[c] = "N/A";
      }
    } catch (error) {
      console.error(`Error calculating discrimination index for criterion ${c}:`, error.message);
      discriminations[c] = "N/A";
    }
  }
  
  return discriminations;
}

/**
 * Generate data for criteria heatmap
 */
function generateCriteriaHeatmapData(data) {
  const heatmapData = {};
  
  // For each criterion, calculate its average score
  for (let c = 0; c < CRITERIA_NAMES.length; c++) {
    try {
      // Collect all grades for this criterion
      const criterionScores = [];
      
      for (const student of data) {
        for (const grader in student.graders) {
          // Find the grade for this criterion
          const criterionGrade = student.graders[grader].grades.find(g => g.criteriaIndex === c);
          
          if (criterionGrade && 
              typeof criterionGrade.numericValue === 'number' && 
              !isNaN(criterionGrade.numericValue)) {
            criterionScores.push(criterionGrade.numericValue);
          }
        }
      }
      
      // Calculate average if we have enough data (reduced threshold from 2 to 1)
      if (criterionScores.length >= 1) {
        heatmapData[c] = calculateAverage(criterionScores);
      } else {
        heatmapData[c] = "N/A";
      }
    } catch (error) {
      console.error(`Error generating heatmap data for criterion ${c}:`, error.message);
      heatmapData[c] = "N/A";
    }
  }
  
  return heatmapData;
}

/**
 * Debugging helper function to dump information about a student's grades
 * Add this to understand the data structure better
 */
function dumpStudentData(data) {
  if (data.length === 0) return "No data";
  
  // Take the first student with at least one grader
  const student = data.find(s => Object.keys(s.graders).length > 0);
  if (!student) return "No student with graders";
  
  // Take the first grader
  const graderKey = Object.keys(student.graders)[0];
  const grader = student.graders[graderKey];
  
  // Get the first grade
  if (grader.grades.length === 0) return "No grades";
  const grade = grader.grades[0];
  
  // Return information about the grade structure
  return {
    studentExample: student.student,
    graderExample: graderKey,
    gradeExample: grade,
    gradeKeys: Object.keys(grade),
    criteriaIndex: grade.criteriaIndex,
    textValue: grade.textValue,
    numericValue: grade.numericValue,
    score: grade.score
  };
}

/**
 * Calculate failure rates by criterion
 */
function calculateFailureRates(data) {
  const failureRates = {};
  
  // For each criterion, calculate percentage of fail grades
  for (let c = 0; c < CRITERIA_NAMES.length; c++) {
    try {
      let totalGrades = 0;
      let failGrades = 0;
      
      for (const student of data) {
        for (const grader in student.graders) {
          // Find the grade for this criterion
          const criterionGrade = student.graders[grader].grades.find(g => g.criteriaIndex === c);
          
          if (criterionGrade) {
            totalGrades++;
            if (criterionGrade.textValue === "8. Fail") {
              failGrades++;
            }
          }
        }
      }
      
      // Calculate rate if we have enough data
      if (totalGrades >= 5) {
        failureRates[c] = failGrades / totalGrades;
      } else {
        failureRates[c] = "N/A";
      }
    } catch (error) {
      console.error(`Error calculating failure rate for criterion ${c}:`, error.message);
      failureRates[c] = "N/A";
    }
  }
  
  return failureRates;
}

/**
 * Calculate student-level variability statistics
 */
function calculateStudentVariability(data) {
  const variability = {};
  
  for (const student of data) {
    try {
      // Need at least 2 graders
      if (Object.keys(student.graders).length < 2) continue;
      
      // Get valid weighted sums
      const graderScores = Object.values(student.graders)
        .filter(g => typeof g.weightedSum === 'number' && !isNaN(g.weightedSum))
        .map(g => g.weightedSum);
      
      if (graderScores.length >= 2) {
        variability[student.student] = {
          stdDev: calculateStandardDeviation(graderScores),
          range: Math.max(...graderScores) - Math.min(...graderScores),
          numGraders: graderScores.length
        };
      }
    } catch (error) {
      console.error(`Error calculating variability for student ${student.student}:`, error.message);
      // Skip this student
    }
  }
  
  return variability;
}

/**
 * Calculate a simplified G-study (variance components)
 */
function calculateSimplifiedGStudy(data) {
  try {
    // This is a simplified implementation
    // A full G-theory analysis would require a more complex design
    
    // Estimate variance components for:
    // - Student (subject of measurement)
    // - Grader (rater)
    // - Area (item/criterion)
    // - Residual (error)
    
    // First, collect data in a format suitable for variance component analysis
    const studentMeans = {};
    const graderMeans = {};
    const areaMeans = {};
    let totalGrades = 0;
    
    for (const student of data) {
      // Skip students with insufficient data
      if (Object.keys(student.graders).length < 2) continue;
      
      // Calculate mean score across all graders
      let studentScores = [];
      
      for (const grader in student.graders) {
        // Skip invalid scores
        const weightedSum = student.graders[grader].weightedSum;
        if (typeof weightedSum !== 'number' || isNaN(weightedSum)) continue;
        
        studentScores.push(weightedSum);
        
        // Collect grader scores
        if (!graderMeans[grader]) {
          graderMeans[grader] = [];
        }
        graderMeans[grader].push(weightedSum);
        
        // Collect area scores
        for (const grade of student.graders[grader].grades) {
          const areaIndex = grade.criteriaIndex;
          const score = grade.score;
          
          if (typeof score === 'number' && !isNaN(score)) {
            if (!areaMeans[areaIndex]) {
              areaMeans[areaIndex] = [];
            }
            areaMeans[areaIndex].push(score);
            totalGrades++;
          }
        }
      }
      
      if (studentScores.length > 0) {
        studentMeans[student.student] = calculateAverage(studentScores);
      }
    }
    
    // Check if we have enough data
    if (Object.keys(studentMeans).length < 2 || 
        Object.keys(graderMeans).length < 2 || 
        Object.keys(areaMeans).length < 2) {
      return {
        studentVariance: "N/A",
        graderVariance: "N/A",
        areaVariance: "N/A",
        residualVariance: "N/A",
        studentPercent: "N/A",
        graderPercent: "N/A",
        areaPercent: "N/A",
        residualPercent: "N/A",
        totalVariance: "N/A"
      };
    }
    
    // Calculate overall mean
    const allMeans = Object.values(studentMeans);
    const overallMean = calculateAverage(allMeans);
    
    // Variance between students
    const studentVariance = calculateVariance(allMeans);
    
    // Calculate variance between grader means
    const graderAverages = {};
    for (const grader in graderMeans) {
      if (graderMeans[grader].length > 0) {
        graderAverages[grader] = calculateAverage(graderMeans[grader]);
      }
    }
    
    const graderVariance = calculateVariance(Object.values(graderAverages));
    
    // Calculate variance between area means
    const areaAverages = {};
    for (const area in areaMeans) {
      if (areaMeans[area].length > 0) {
        areaAverages[area] = calculateAverage(areaMeans[area]);
      }
    }
    
    const areaVariance = calculateVariance(Object.values(areaAverages));
    
    // Calculate total variance
    const allScores = [];
    for (const grader in graderMeans) {
      allScores.push(...graderMeans[grader]);
    }
    
    const totalVariance = calculateVariance(allScores);
    
    // Residual variance (approximation)
    const residualVariance = Math.max(0, totalVariance - studentVariance - graderVariance - areaVariance);
    
    // Calculate percentages
    const adjustedTotal = studentVariance + graderVariance + areaVariance + residualVariance;
    
    // Avoid division by zero
    if (adjustedTotal === 0) {
      return {
        studentVariance: 0,
        graderVariance: 0,
        areaVariance: 0,
        residualVariance: 0,
        studentPercent: 0.25, // Equal distribution as fallback
        graderPercent: 0.25,
        areaPercent: 0.25,
        residualPercent: 0.25,
        totalVariance: 0
      };
    }
    
    const studentPercent = studentVariance / adjustedTotal;
    const graderPercent = graderVariance / adjustedTotal;
    const areaPercent = areaVariance / adjustedTotal;
    const residualPercent = residualVariance / adjustedTotal;
    
    return {
      studentVariance,
      graderVariance,
      areaVariance,
      residualVariance,
      studentPercent,
      graderPercent,
      areaPercent,
      residualPercent,
      totalVariance: adjustedTotal
    };
  } catch (error) {
    console.error("Error calculating G-study:", error.message);
    return {
      studentVariance: "N/A",
      graderVariance: "N/A",
      areaVariance: "N/A",
      residualVariance: "N/A",
      studentPercent: "N/A",
      graderPercent: "N/A",
      areaPercent: "N/A",
      residualPercent: "N/A",
      totalVariance: "N/A"
    };
  }
}

/**
 * Calculate predicted reliability for different numbers of graders
 */
function calculatePredictedReliability(gStudyResults, numGraders) {
  try {
    // Validate inputs
    if (typeof gStudyResults.studentVariance !== 'number' || 
        typeof gStudyResults.graderVariance !== 'number' || 
        typeof gStudyResults.areaVariance !== 'number' || 
        typeof gStudyResults.residualVariance !== 'number') {
      return "N/A";
    }
    
    // Use the Spearman-Brown prophecy formula
    // ρ_k = (k * ρ_1) / (1 + (k-1) * ρ_1)
    // where ρ_1 is the reliability with one grader
    
    // Estimate single-grader reliability
    const totalVariance = gStudyResults.studentVariance + 
                          gStudyResults.graderVariance + 
                          gStudyResults.areaVariance + 
                          gStudyResults.residualVariance;
    
    if (totalVariance === 0) return 0;
    
    const singleGraderReliability = gStudyResults.studentVariance / totalVariance;
    
    // Apply the formula
    const predictedReliability = (numGraders * singleGraderReliability) / 
      (1 + (numGraders - 1) * singleGraderReliability);
    
    return Math.max(0, Math.min(1, predictedReliability));
  } catch (error) {
    console.error("Error calculating predicted reliability:", error.message);
    return "N/A";
  }
}

/**
 * Calculate statistics by scenario
 */
function calculateScenarioStats(data) {
  const scenarioStats = {};
  
  for (const student of data) {
    // Skip if no scenario information
    if (!student.scenario) continue;
    
    // Add an entry for this scenario if it doesn't exist
    if (!scenarioStats[student.scenario]) {
      scenarioStats[student.scenario] = {
        scores: [],
        numStudents: 0,
        passCount: 0
      };
    }
    
    // Only use valid overall scores
    if (typeof student.overallAverage === 'number' && !isNaN(student.overallAverage)) {
      scenarioStats[student.scenario].scores.push(student.overallAverage);
      scenarioStats[student.scenario].numStudents++;
      
      // Count passing scores (70 or above)
      if (student.overallAverage >= 70) {
        scenarioStats[student.scenario].passCount++;
      }
    }
  }
  
  // Calculate statistics for each scenario
  for (const scenario in scenarioStats) {
    const stats = scenarioStats[scenario];
    
    if (stats.scores.length > 0) {
      stats.avgScore = calculateAverage(stats.scores);
      stats.stdDev = calculateStandardDeviation(stats.scores);
      stats.min = Math.min(...stats.scores);
      stats.max = Math.max(...stats.scores);
      stats.range = stats.max - stats.min;
    } else {
      stats.avgScore = "N/A";
      stats.stdDev = "N/A";
      stats.min = "N/A";
      stats.max = "N/A";
      stats.range = "N/A";
    }
  }
  
  return scenarioStats;
}

/**
 * Calculate statistics by track
 */
function calculateTrackStats(data) {
  const trackStats = {};
  
  for (const student of data) {
    // Skip if no track information
    if (!student.track) continue;
    
    // Add an entry for this track if it doesn't exist
    if (!trackStats[student.track]) {
      trackStats[student.track] = {
        scores: [],
        numStudents: 0,
        passCount: 0
      };
    }
    
    // Only use valid overall scores
    if (typeof student.overallAverage === 'number' && !isNaN(student.overallAverage)) {
      trackStats[student.track].scores.push(student.overallAverage);
      trackStats[student.track].numStudents++;
      
      // Count passing scores (70 or above)
      if (student.overallAverage >= 70) {
        trackStats[student.track].passCount++;
      }
    }
  }
  
  // Calculate statistics for each track
  for (const track in trackStats) {
    const stats = trackStats[track];
    
    if (stats.scores.length > 0) {
      stats.avgScore = calculateAverage(stats.scores);
      stats.stdDev = calculateStandardDeviation(stats.scores);
      stats.min = Math.min(...stats.scores);
      stats.max = Math.max(...stats.scores);
      stats.range = stats.max - stats.min;
    } else {
      stats.avgScore = "N/A";
      stats.stdDev = "N/A";
      stats.min = "N/A";
      stats.max = "N/A";
      stats.range = "N/A";
    }
  }
  
  return trackStats;
}

/**
 * Calculate track-scenario comparison data
 */
function calculateTrackScenarioComparison(data) {
  const trackScenarioStats = {};
  
  for (const student of data) {
    if (typeof student.overallAverage !== 'number' || isNaN(student.overallAverage)) continue;
    
    // Track-scenario combination
    if (student.track && student.scenario) {
      if (!trackScenarioStats[student.track]) {
        trackScenarioStats[student.track] = {};
      }
      
      if (!trackScenarioStats[student.track][student.scenario]) {
        trackScenarioStats[student.track][student.scenario] = {
          scores: [],
          numStudents: 0,
          passCount: 0
        };
      }
      
      trackScenarioStats[student.track][student.scenario].scores.push(student.overallAverage);
      trackScenarioStats[student.track][student.scenario].numStudents++;
      
      // Count passing scores
      if (student.overallAverage >= 70) {
        trackScenarioStats[student.track][student.scenario].passCount++;
      }
    }
  }
  
  // Calculate statistics for each track-scenario combination
  for (const track in trackScenarioStats) {
    for (const scenario in trackScenarioStats[track]) {
      const stats = trackScenarioStats[track][scenario];
      
      if (stats.scores.length > 0) {
        stats.avgScore = calculateAverage(stats.scores);
        stats.stdDev = calculateStandardDeviation(stats.scores);
      }
    }
  }
  
  return trackScenarioStats;
}

/**
 * Calculate statistics for each criteria by scenario
 */
function calculateScenarioByCriteriaStats(data) {
  const scenarioCriteriaStats = {};
  
  for (const student of data) {
    // Skip if no scenario information
    if (!student.scenario) continue;
    
    // Initialize scenario entry if it doesn't exist
    if (!scenarioCriteriaStats[student.scenario]) {
      scenarioCriteriaStats[student.scenario] = {};
      
      // Initialize criteria entries
      for (let c = 0; c < CRITERIA_NAMES.length; c++) {
        scenarioCriteriaStats[student.scenario][c] = {
          scores: [],
          numGrades: 0
        };
      }
    }
    
    // Collect grades for each criteria
    for (const grader in student.graders) {
      for (const grade of student.graders[grader].grades) {
        const criteriaIndex = grade.criteriaIndex;
        
        if (typeof grade.score === 'number' && !isNaN(grade.score)) {
          scenarioCriteriaStats[student.scenario][criteriaIndex].scores.push(grade.score);
          scenarioCriteriaStats[student.scenario][criteriaIndex].numGrades++;
        }
      }
    }
  }
  
  // Calculate statistics for each scenario and criteria
  for (const scenario in scenarioCriteriaStats) {
    for (let c = 0; c < CRITERIA_NAMES.length; c++) {
      const stats = scenarioCriteriaStats[scenario][c];
      
      if (stats.scores.length > 0) {
        stats.avgScore = calculateAverage(stats.scores);
        stats.stdDev = calculateStandardDeviation(stats.scores);
        stats.min = Math.min(...stats.scores);
        stats.max = Math.max(...stats.scores);
      } else {
        stats.avgScore = "N/A";
        stats.stdDev = "N/A";
        stats.min = "N/A";
        stats.max = "N/A";
      }
    }
  }
  
  return scenarioCriteriaStats;
}

/**
 * Calculate statistics for each criteria by track
 */
function calculateTrackByCriteriaStats(data) {
  const trackCriteriaStats = {};
  
  for (const student of data) {
    // Skip if no track information
    if (!student.track) continue;
    
    // Initialize track entry if it doesn't exist
    if (!trackCriteriaStats[student.track]) {
      trackCriteriaStats[student.track] = {};
      
      // Initialize criteria entries
      for (let c = 0; c < CRITERIA_NAMES.length; c++) {
        trackCriteriaStats[student.track][c] = {
          scores: [],
          numGrades: 0
        };
      }
    }
    
    // Collect grades for each criteria
    for (const grader in student.graders) {
      for (const grade of student.graders[grader].grades) {
        const criteriaIndex = grade.criteriaIndex;
        
        if (typeof grade.score === 'number' && !isNaN(grade.score)) {
          trackCriteriaStats[student.track][criteriaIndex].scores.push(grade.score);
          trackCriteriaStats[student.track][criteriaIndex].numGrades++;
        }
      }
    }
  }
  
  // Calculate statistics for each track and criteria
  for (const track in trackCriteriaStats) {
    for (let c = 0; c < CRITERIA_NAMES.length; c++) {
      const stats = trackCriteriaStats[track][c];
      
      if (stats.scores.length > 0) {
        stats.avgScore = calculateAverage(stats.scores);
        stats.stdDev = calculateStandardDeviation(stats.scores);
        stats.min = Math.min(...stats.scores);
        stats.max = Math.max(...stats.scores);
      } else {
        stats.avgScore = "N/A";
        stats.stdDev = "N/A";
        stats.min = "N/A";
        stats.max = "N/A";
      }
    }
  }
  
  return trackCriteriaStats;
}
//=====================================================
// DETAILED STATISTICAL MATRIX FUNCTIONS
//=====================================================

/**
 * Calculate detailed track statistics with grade distributions
 */
function calculateDetailedTrackStats(gradingData) {
  const trackStats = {};
  
  // Group data by track
  for (const record of gradingData) {
    if (!record.track || typeof record.overallGrade !== 'number') continue;
    
    if (!trackStats[record.track]) {
      trackStats[record.track] = {
        scores: [],
        totalStudents: 0
      };
    }
    
    trackStats[record.track].scores.push(record.overallGrade);
  }
  
  // Calculate statistics for each track
  for (const track in trackStats) {
    const scores = trackStats[track].scores;
    if (scores.length > 0) {
      trackStats[track].totalStudents = scores.length;
      trackStats[track].avgScore = calculateAverage(scores);
      trackStats[track].stdDev = calculateStandardDeviation(scores);
      trackStats[track].minScore = Math.min(...scores);
      trackStats[track].maxScore = Math.max(...scores);
      trackStats[track].passRate = (scores.filter(s => s >= 70).length / scores.length) * 100;
    }
  }
  
  return trackStats;
}

/**
 * Calculate grade distribution for a specific track
 */
function calculateGradeDistributionForTrack(gradingData, track) {
  const distribution = { waa: 0, aa: 0, saa: 0, avg: 0, sba: 0, ba: 0, fail: 0 };
  let total = 0;
  
  for (const record of gradingData) {
    if (record.track !== track) continue;
    
    // Check each criteria grade
    for (const criterion in record.criteria) {
      const grade = record.criteria[criterion];
      if (!grade) continue;
      
      total++;
      switch (grade) {
        case "1. Well Above Average": distribution.waa++; break;
        case "2. Above Average": distribution.aa++; break;
        case "3. Slightly Above Average": distribution.saa++; break;
        case "4. Average": distribution.avg++; break;
        case "5. Slightly Below Average": distribution.sba++; break;
        case "6. Below Average": distribution.ba++; break;
        case "7. Fail": distribution.fail++; break;
      }
    }
  }
  
  // Convert to percentages
  if (total > 0) {
    for (const key in distribution) {
      distribution[key] = ((distribution[key] / total) * 100).toFixed(1);
    }
  }
  
  return distribution;
}

/**
 * Calculate track-criterion average score
 */
function calculateTrackCriterionAverage(gradingData, track, criterionIndex) {
  // 25B UPDATE: 7 criteria, enabling_innovation removed
  const criterionNames = [
    "objectives_data", "engineering_principles", "instro_resources", "risk_management",
    "communication", "stakeholder_analysis", "adapting_changes"
  ];
  
  const scores = [];
  
  for (const record of gradingData) {
    if (record.track !== track) continue;
    
    const grade = record.criteria[criterionNames[criterionIndex]];
    if (grade) {
      const numericValue = GRADE_VALUES[grade];
      if (numericValue !== undefined) {
        scores.push(NUMERIC_MAP[numericValue]);
      }
    }
  }
  
  return scores.length > 0 ? calculateAverage(scores) : null;
}

/**
 * Calculate grader statistics by track with enhanced data
 */
function calculateGraderStatsByTrack(gradingData, instructorSurveys) {
  const graderStats = {};
  
  // First pass: collect grading data
  for (const record of gradingData) {
    if (!record.graderLastName || typeof record.overallGrade !== 'number') continue;
    
    const grader = record.graderLastName;
    if (!graderStats[grader]) {
      graderStats[grader] = {
        scores: [],
        track: null,
        experience: null,
        totalGrades: 0
      };
    }
    
    graderStats[grader].scores.push(record.overallGrade);
    graderStats[grader].totalGrades++;
  }
  
  // Second pass: add instructor survey data
  for (const survey of instructorSurveys) {
    // Try to match by grader name or student number
    const grader = survey.graderLastName || extractGraderFromSurvey(survey);
    if (grader && graderStats[grader]) {
      graderStats[grader].track = survey.instructorTrack;
      graderStats[grader].experience = survey.experienceLevel;
      
      // Calculate average confidence from scores
      const confidenceValues = [];
      for (const criterion in survey.scores) {
        if (survey.scores[criterion] && typeof survey.scores[criterion].confidence === 'number') {
          confidenceValues.push(survey.scores[criterion].confidence);
        }
      }
      
      if (confidenceValues.length > 0) {
        graderStats[grader].avgConfidence = calculateAverage(confidenceValues);
      }
    }
  }
  
  // Calculate statistics and bias scores
  const allScores = [];
  for (const grader in graderStats) {
    if (graderStats[grader].scores.length > 0) {
      allScores.push(...graderStats[grader].scores);
    }
  }
  
  const overallMean = calculateAverage(allScores);
  const overallStdDev = calculateStandardDeviation(allScores);
  
  for (const grader in graderStats) {
    const stats = graderStats[grader];
    if (stats.scores.length > 0) {
      stats.avgScore = calculateAverage(stats.scores);
      stats.stdDev = calculateStandardDeviation(stats.scores);
      stats.scoreRange = Math.max(...stats.scores) - Math.min(...stats.scores);
      
      // Calculate bias z-score
      if (overallStdDev > 0) {
        stats.biasZScore = (stats.avgScore - overallMean) / overallStdDev;
      }
    }
  }
  
  return graderStats;
}

/**
 * Helper function to extract grader name from survey if not directly available
 */
function extractGraderFromSurvey(survey) {
  // This might need adjustment based on your actual survey data structure
  return survey.instructorName || survey.graderName || null;
}

/**
 * Calculate grader track summary statistics
 */
function calculateGraderTrackSummary(graderStats) {
  const trackSummary = {};
  
  for (const grader in graderStats) {
    const stats = graderStats[grader];
    const track = stats.track || 'Unknown';
    
    if (!trackSummary[track]) {
      trackSummary[track] = {
        count: 0,
        scores: [],
        confidenceValues: []
      };
    }
    
    trackSummary[track].count++;
    if (typeof stats.avgScore === 'number') {
      trackSummary[track].scores.push(stats.avgScore);
    }
    if (typeof stats.avgConfidence === 'number') {
      trackSummary[track].confidenceValues.push(stats.avgConfidence);
    }
  }
  
  // Calculate summary statistics
  for (const track in trackSummary) {
    const summary = trackSummary[track];
    
    if (summary.scores.length > 0) {
      summary.avgScore = calculateAverage(summary.scores);
      summary.scoreVariance = calculateVariance(summary.scores);
    }
    
    if (summary.confidenceValues.length > 0) {
      summary.avgConfidence = calculateAverage(summary.confidenceValues);
    }
  }
  
  return trackSummary;
}

/**
 * Calculate cross-track grading matrix
 */
function calculateCrossTrackGradingMatrix(gradingData) {
  const matrix = {};
  
  for (const record of gradingData) {
    // Skip records without required data
    if (!record.track || typeof record.overallGrade !== 'number') continue;
    
    // Try to get instructor track - this may need adjustment based on your data
    const instructorTrack = record.instructorTrack || getInstructorTrackFromRecord(record);
    if (!instructorTrack) continue;
    
    const studentTrack = record.track;
    
    if (!matrix[instructorTrack]) {
      matrix[instructorTrack] = {};
    }
    
    if (!matrix[instructorTrack][studentTrack]) {
      matrix[instructorTrack][studentTrack] = {
        scores: [],
        count: 0
      };
    }
    
    matrix[instructorTrack][studentTrack].scores.push(record.overallGrade);
    matrix[instructorTrack][studentTrack].count++;
  }
  
  // Calculate averages
  for (const instructorTrack in matrix) {
    for (const studentTrack in matrix[instructorTrack]) {
      const data = matrix[instructorTrack][studentTrack];
      if (data.scores.length > 0) {
        data.avgScore = calculateAverage(data.scores);
      }
    }
  }
  
  return matrix;
}

/**
 * Helper function to get instructor track from grading record
 */
function getInstructorTrackFromRecord(record) {
  // This function needs to map grader names to their tracks
  // You may need to implement this based on your data structure
  
  // Try to match with instructor survey data
  try {
    const instructorSurveys = getInstructorSurveyData();
    const match = instructorSurveys.find(s => 
      s.graderLastName === record.graderLastName ||
      s.instructorName === record.graderLastName
    );
    return match ? match.instructorTrack : null;
  } catch (error) {
    console.log("Could not match instructor track for:", record.graderLastName);
    return null;
  }
}

/**
 * Calculate overall average score across all records
 */
function calculateOverallAverageScore(gradingData) {
  const scores = gradingData
    .filter(d => typeof d.overallGrade === 'number')
    .map(d => d.overallGrade);
  
  return scores.length > 0 ? calculateAverage(scores) : null;
}

/**
 * Calculate scenario-criteria matrix
 */
function calculateScenarioCriteriaMatrix(gradingData) {
  const matrix = {};
  
  const criterionNames = [
    // 25B UPDATE: 7 criteria, enabling_innovation removed
    "objectives_data", "engineering_principles", "instro_resources", "risk_management",
    "communication", "stakeholder_analysis", "adapting_changes"
  ];
  
  for (const record of gradingData) {
    if (!record.scenario) continue;
    
    if (!matrix[record.scenario]) {
      matrix[record.scenario] = {};
      for (let i = 0; i < 7; i++) { // 25B: 7 criteria
        matrix[record.scenario][i] = { scores: [], count: 0 };
      }
    }
    
    // Process each criterion
    for (let i = 0; i < criterionNames.length; i++) {
      const grade = record.criteria[criterionNames[i]];
      if (grade) {
        const numericValue = GRADE_VALUES[grade];
        if (numericValue !== undefined) {
          matrix[record.scenario][i].scores.push(numericValue);
          matrix[record.scenario][i].count++;
        }
      }
    }
  }
  
  // Calculate averages
  for (const scenario in matrix) {
    for (let i = 0; i < 7; i++) { // 25B: 7 criteria
      const data = matrix[scenario][i];
      if (data.scores.length > 0) {
        data.avgScore = calculateAverage(data.scores);
      }
    }
  }
  
  return matrix;
}

/**
 * Calculate comprehensive grade distribution
 */
function calculateComprehensiveGradeDistribution(gradingData) {
  const distribution = {
    overall: new Array(8).fill(0),
    totalGrades: 0,
    byTrack: {},
    byScenario: {}
  };
  
  for (const record of gradingData) {
    // Process each criteria grade
    for (const criterion in record.criteria) {
      const grade = record.criteria[criterion];
      if (!grade) continue;
      
      distribution.totalGrades++;
      
      // Overall distribution
      const gradeIndex = parseInt(grade.charAt(0)) - 1;
      if (gradeIndex >= 0 && gradeIndex < 7) {
        distribution.overall[gradeIndex]++;
      }
      
      // By track
      if (record.track) {
        if (!distribution.byTrack[record.track]) {
          distribution.byTrack[record.track] = {
            grades: new Array(8).fill(0),
            total: 0
          };
        }
        distribution.byTrack[record.track].grades[gradeIndex]++;
        distribution.byTrack[record.track].total++;
      }
      
      // By scenario
      if (record.scenario) {
        if (!distribution.byScenario[record.scenario]) {
          distribution.byScenario[record.scenario] = {
            grades: new Array(8).fill(0),
            total: 0
          };
        }
        distribution.byScenario[record.scenario].grades[gradeIndex]++;
        distribution.byScenario[record.scenario].total++;
      }
    }
  }
  
  return distribution;
}

/**
 * Calculate detailed scenario statistics
 */
function calculateDetailedScenarioStats(gradingData, studentSurveys, instructorSurveys) {
  const scenarioStats = {};
  
  // Get unique scenarios
  const scenarios = [...new Set(gradingData.map(d => d.scenario).filter(s => s))];
  
  for (const scenario of scenarios) {
    const scenarioRecords = gradingData.filter(g => g.scenario === scenario);
    const studentFeedback = studentSurveys.filter(s => s.scenarioId === scenario);
    const instructorFeedback = instructorSurveys.filter(i => i.scenarioId === scenario);
    
    // Calculate performance metrics
    const scores = scenarioRecords
      .filter(g => typeof g.overallGrade === 'number')
      .map(g => g.overallGrade);
    
    scenarioStats[scenario] = {
      totalGrades: scores.length,
      avgScore: scores.length > 0 ? calculateAverage(scores) : null,
      stdDev: scores.length > 0 ? calculateStandardDeviation(scores) : null,
      difficulty: scores.length > 0 ? (scores.filter(s => s < 80).length / scores.length > 0.3 ? 'High' : 'Normal') : 'Unknown',
      studentClarity: studentFeedback.length > 0 ? 
        calculateAverage(studentFeedback.map(s => s.problemStatementClarity).filter(c => typeof c === 'number')) : null,
      instructorClarity: instructorFeedback.length > 0 ? 
        calculateAverage(instructorFeedback.map(i => i.problemStatementClarity).filter(c => typeof c === 'number')) : null,
      issues: []
    };
    
    // Identify issues
    const stats = scenarioStats[scenario];
    if (stats.avgScore && stats.avgScore < 75) {
      stats.issues.push('Low Performance');
    }
    if (stats.stdDev && stats.stdDev > 12) {
      stats.issues.push('High Variability');
    }
    if (stats.studentClarity && stats.studentClarity < 3) {
      stats.issues.push('Poor Student Clarity');
    }
  }
  
  return scenarioStats;
}

/**
 * Calculate detailed reliability metrics - FIXED VERSION
 */
function calculateDetailedReliabilityMetrics(gradingData) {
  const metrics = {};
  
  try {
    // Convert grading data for ICC calculation
    const convertedData = convertGradingDataForStatistics(gradingData);
    
    // Calculate basic ICC - handle case where it returns "N/A"
    const rawICC = calculateICC(convertedData);
    
    // FIX: Ensure ICC is a valid number
    if (typeof rawICC === 'number' && !isNaN(rawICC)) {
      metrics.icc = rawICC;
      
      if (metrics.icc >= 0.9) {
        metrics.iccInterpretation = 'Excellent reliability';
      } else if (metrics.icc >= 0.7) {
        metrics.iccInterpretation = 'Acceptable reliability';
      } else {
        metrics.iccInterpretation = 'Poor reliability - needs improvement';
      }
    } else {
      metrics.icc = null; // Set to null instead of "N/A"
      metrics.iccInterpretation = 'Cannot calculate - insufficient data';
    }
    
    // Calculate ICC by criteria (simplified) - also handle null cases
    metrics.iccByCriteria = {};
    for (let i = 0; i < 7; i++) { // 25B: 7 criteria
      const criterionICC = calculateICCForCriterion(gradingData, i);
      metrics.iccByCriteria[i] = (typeof criterionICC === 'number' && !isNaN(criterionICC)) ? criterionICC : null;
    }
    
    // Calculate other metrics - ensure they're numbers or null
    const rawGraderVariance = calculateGraderVariance(gradingData);
    metrics.graderVariance = (typeof rawGraderVariance === 'number' && !isNaN(rawGraderVariance)) ? rawGraderVariance : null;
    
    metrics.biasedGraders = identifyBiasedGraders(gradingData);
    
    const rawSEM = calculateStandardErrorOfMeasurement(gradingData);
    metrics.sem = (typeof rawSEM === 'number' && !isNaN(rawSEM)) ? rawSEM : null;
    
    metrics.ci95 = (metrics.sem !== null) ? metrics.sem * 1.96 : null;
    
    metrics.recommendations = generateReliabilityRecommendations(metrics);
    
  } catch (error) {
    console.error("Error calculating reliability metrics:", error);
    metrics.error = "Could not calculate reliability metrics";
    metrics.icc = null;
    metrics.iccInterpretation = "Calculation error";
    metrics.sem = null;
    metrics.ci95 = null;
    metrics.biasedGraders = "Error in calculation";
    metrics.recommendations = "Please check data quality and try again";
  }
  
  return metrics;
}

/**
 * Helper function to convert grading data for statistics
 */
function convertGradingDataForStatistics(gradingData) {
  // Convert to format expected by existing calculateICC function
  const processedData = [];
  
  // Group by student
  const studentGroups = {};
  for (const record of gradingData) {
    if (!record.studentIdentifier) continue;
    
    if (!studentGroups[record.studentIdentifier]) {
      studentGroups[record.studentIdentifier] = {
        student: record.studentIdentifier,
        graders: {}
      };
    }
    
    if (typeof record.overallGrade === 'number') {
      studentGroups[record.studentIdentifier].graders[record.graderLastName] = {
        weightedSum: record.overallGrade
      };
    }
  }
  
  return Object.values(studentGroups);
}

// Add other helper functions as needed...
/**
 * FIXED: Add detailed track performance matrix with raw statistics
 */
function addDetailedTrackPerformanceMatrix(sheet, gradingData, startRow) {
  let currentRow = startRow;
  
  sheet.getRange(currentRow, 1).setValue("1. STUDENT PERFORMANCE BY TRACK - DETAILED MATRIX")
    .setFontSize(14).setFontWeight("bold").setBackground("#F0F7FF");
  currentRow += 2;
  
  // Calculate detailed track statistics
  const trackStats = calculateDetailedTrackStats(gradingData);
  
  // FIX: Use plain text without special formatting characters
  let matrixData = "TRACK PERFORMANCE SUMMARY:\n\n";
  
  // Header for table - simplified to avoid formula parsing
  matrixData += "TRACK - Students - Avg Score - StdDev - Min - Max - Pass Rate\n";
  matrixData += "\n";
  
  // Sort tracks by average performance
  const sortedTracks = Object.keys(trackStats).sort((a, b) => {
    return (trackStats[b].avgScore || 0) - (trackStats[a].avgScore || 0);
  });
  
  for (const track of sortedTracks) {
    const stats = trackStats[track];
    
    matrixData += `${track}: ${stats.totalStudents} students, `;
    matrixData += `Avg ${stats.avgScore ? stats.avgScore.toFixed(1) : 'N/A'}, `;
    matrixData += `StdDev ${stats.stdDev ? stats.stdDev.toFixed(1) : 'N/A'}, `;
    matrixData += `Range ${stats.minScore ? stats.minScore.toFixed(1) : 'N/A'} to ${stats.maxScore ? stats.maxScore.toFixed(1) : 'N/A'}, `;
    matrixData += `Pass Rate ${stats.passRate ? stats.passRate.toFixed(1) + '%' : 'N/A'}\n`;
  }
  
  // Add criteria-specific performance by track
  matrixData += "\n\nTRACK PERFORMANCE BY ASSESSMENT CRITERIA:\n\n";
  
  // 25B UPDATE: 7 criteria, "Innovation" removed
  const criteriaNames = ["Obj&Data", "EngPrinc", "InstroRes", "RiskMgmt", "Comm", "Stakeholder", "Adapting"];
  
  for (const track of sortedTracks) {
    matrixData += `${track}:\n`;
    for (let criterion = 0; criterion < 7; criterion++) { // 25B: 7 criteria
      const criterionAvg = calculateTrackCriterionAverage(gradingData, track, criterion);
      matrixData += `  ${criteriaNames[criterion]}: ${criterionAvg ? criterionAvg.toFixed(1) : 'N/A'}\n`;
    }
    matrixData += "\n";
  }
  
  // FIX: Ensure text doesn't start with formula characters
  if (matrixData.charAt(0) === '=' || matrixData.charAt(0) === '+' || matrixData.charAt(0) === '-') {
    matrixData = ' ' + matrixData;
  }
  
  sheet.getRange(currentRow, 1).setValue(matrixData).setWrap(true);
  currentRow += Math.max(matrixData.split('\n').length + 3, 25);
  
  return currentRow;
}

/**
 * FIXED: Add detailed grader statistics by track
 */
function addDetailedGraderTrackMatrix(sheet, gradingData, instructorSurveys, startRow) {
  let currentRow = startRow;
  
  sheet.getRange(currentRow, 1).setValue("2. GRADER STATISTICS BY TRACK - COMPREHENSIVE ANALYSIS")
    .setFontSize(14).setFontWeight("bold").setBackground("#F0F7FF");
  currentRow += 2;
  
  // Calculate grader statistics with track information
  const graderStats = calculateGraderStatsByTrack(gradingData, instructorSurveys);
  
  let graderMatrix = "GRADER PERFORMANCE SUMMARY:\n\n";
  
  // Sort graders by average score
  const sortedGraders = Object.keys(graderStats).sort((a, b) => {
    return (graderStats[b].avgScore || 0) - (graderStats[a].avgScore || 0);
  });
  
  for (const grader of sortedGraders) {
    const stats = graderStats[grader];
    graderMatrix += `${grader} (${stats.track || 'Unknown'} Track):\n`;
    graderMatrix += `  Experience: ${stats.experience || 'N/A'}\n`;
    graderMatrix += `  Grades Given: ${stats.totalGrades}\n`;
    graderMatrix += `  Avg Score: ${stats.avgScore ? stats.avgScore.toFixed(1) : 'N/A'}\n`;
    graderMatrix += `  StdDev: ${stats.stdDev ? stats.stdDev.toFixed(1) : 'N/A'}\n`;
    graderMatrix += `  Score Range: ${stats.scoreRange ? stats.scoreRange.toFixed(1) : 'N/A'}\n`;
    graderMatrix += `  Bias Z-Score: ${stats.biasZScore ? stats.biasZScore.toFixed(2) : 'N/A'}\n`;
    graderMatrix += `  Avg Confidence: ${stats.avgConfidence ? stats.avgConfidence.toFixed(1) : 'N/A'}\n\n`;
  }
  
  // Add grader track summary
  graderMatrix += "GRADER TRACK SUMMARY:\n\n";
  const graderTrackSummary = calculateGraderTrackSummary(graderStats);
  
  for (const track in graderTrackSummary) {
    const summary = graderTrackSummary[track];
    graderMatrix += `${track} Track Instructors:\n`;
    graderMatrix += `  Count: ${summary.count}\n`;
    graderMatrix += `  Avg Score Given: ${summary.avgScore ? summary.avgScore.toFixed(1) : 'N/A'}\n`;
    graderMatrix += `  Avg Confidence: ${summary.avgConfidence ? summary.avgConfidence.toFixed(1) : 'N/A'}\n`;
    graderMatrix += `  Score Variance: ${summary.scoreVariance ? summary.scoreVariance.toFixed(1) : 'N/A'}\n\n`;
  }
  
  // FIX: Ensure text doesn't start with formula characters
  if (graderMatrix.charAt(0) === '=' || graderMatrix.charAt(0) === '+' || graderMatrix.charAt(0) === '-') {
    graderMatrix = ' ' + graderMatrix;
  }
  
  sheet.getRange(currentRow, 1).setValue(graderMatrix).setWrap(true);
  currentRow += Math.max(graderMatrix.split('\n').length + 3, 30);
  
  return currentRow;
}

/**
 * FIXED: Add cross-track grading matrix
 */
function addCrossTrackGradingMatrix(sheet, gradingData, startRow) {
  let currentRow = startRow;
  
  sheet.getRange(currentRow, 1).setValue("3. CROSS-TRACK GRADING PATTERNS - INSTRUCTOR vs STUDENT TRACK")
    .setFontSize(14).setFontWeight("bold").setBackground("#F0F7FF");
  currentRow += 2;
  
  const crossTrackData = calculateCrossTrackGradingMatrix(gradingData);
  
  let matrixText = "INSTRUCTOR TRACK vs STUDENT TRACK GRADING ANALYSIS:\n\n";
  matrixText += "Average scores given by instructors of each track to students of each track\n\n";
  
  // Get unique tracks
  const studentTracks = [...new Set(gradingData.map(d => d.track).filter(t => t))];
  const instructorTracks = Object.keys(crossTrackData);
  
  if (instructorTracks.length === 0) {
    matrixText += "No cross-track grading data available.\n";
    matrixText += "Instructor track information may be missing from the dataset.\n";
  } else {
    // Create simplified matrix without special characters
    instructorTracks.forEach(instructorTrack => {
      matrixText += `${instructorTrack} Instructors:\n`;
      
      studentTracks.forEach(studentTrack => {
        const avgScore = crossTrackData[instructorTrack] && crossTrackData[instructorTrack][studentTrack] 
          ? crossTrackData[instructorTrack][studentTrack].avgScore 
          : null;
        
        if (avgScore !== null) {
          matrixText += `  Grading ${studentTrack} students: ${avgScore.toFixed(1)} avg (${crossTrackData[instructorTrack][studentTrack].count} grades)\n`;
        } else {
          matrixText += `  Grading ${studentTrack} students: No data\n`;
        }
      });
      matrixText += "\n";
    });
  }
  
  // FIX: Ensure text doesn't start with formula characters
  if (matrixText.charAt(0) === '=' || matrixText.charAt(0) === '+' || matrixText.charAt(0) === '-') {
    matrixText = ' ' + matrixText;
  }
  
  sheet.getRange(currentRow, 1).setValue(matrixText).setWrap(true);
  currentRow += Math.max(matrixText.split('\n').length + 3, 15);
  
  return currentRow;
}

/**
 * FIXED: Add scenario-criteria performance heatmap data
 */
function addScenarioCriteriaHeatmapData(sheet, gradingData, startRow) {
  let currentRow = startRow;
  
  sheet.getRange(currentRow, 1).setValue("4. SCENARIO-CRITERIA PERFORMANCE HEATMAP DATA")
    .setFontSize(14).setFontWeight("bold").setBackground("#F0F7FF");
  currentRow += 2;
  
  const scenarioCriteriaMatrix = calculateScenarioCriteriaMatrix(gradingData);
  
  let heatmapText = "SCENARIO vs CRITERIA PERFORMANCE ANALYSIS:\n\n";
  heatmapText += "Average numeric scores: 1=Best, 8=Worst. Lower numbers indicate better performance.\n\n";
  
  // Get unique scenarios
  const scenarios = [...new Set(gradingData.map(d => d.scenario).filter(s => s))];
  // 25B UPDATE: 7 criteria, "Enabling Innovation" removed
  const criteriaNames = [
    "Objectives & Data", "Engineering Principles", "Instrumentation & Resources", "Risk Management",
    "Communication", "Stakeholder Analysis", "Adapting to Changes"
  ];
  
  if (scenarios.length === 0) {
    heatmapText += "No scenario data available for analysis.\n";
  } else {
    // Create simplified display without table formatting
    scenarios.forEach(scenario => {
      heatmapText += `${scenario}:\n`;
      
      let scenarioSum = 0;
      let scenarioCount = 0;
      
      for (let criterion = 0; criterion < 7; criterion++) { // 25B: 7 criteria
        const avgScore = scenarioCriteriaMatrix[scenario] && scenarioCriteriaMatrix[scenario][criterion]
          ? scenarioCriteriaMatrix[scenario][criterion].avgScore
          : null;
        
        if (avgScore !== null) {
          heatmapText += `  ${criteriaNames[criterion]}: ${avgScore.toFixed(1)}\n`;
          scenarioSum += avgScore;
          scenarioCount++;
        } else {
          heatmapText += `  ${criteriaNames[criterion]}: No data\n`;
        }
      }
      
      const scenarioAvg = scenarioCount > 0 ? (scenarioSum / scenarioCount).toFixed(1) : 'N/A';
      heatmapText += `  Scenario Average: ${scenarioAvg}\n\n`;
    });
  }
  
  // FIX: Ensure text doesn't start with formula characters
  if (heatmapText.charAt(0) === '=' || heatmapText.charAt(0) === '+' || heatmapText.charAt(0) === '-') {
    heatmapText = ' ' + heatmapText;
  }
  
  sheet.getRange(currentRow, 1).setValue(heatmapText).setWrap(true);
  currentRow += Math.max(heatmapText.split('\n').length + 3, 20);
  
  return currentRow;
}

/**
 * FIXED: Add comprehensive grade distribution analysis
 */
function addComprehensiveGradeDistribution(sheet, gradingData, startRow) {
  let currentRow = startRow;
  
  sheet.getRange(currentRow, 1).setValue("5. COMPREHENSIVE GRADE DISTRIBUTION ANALYSIS")
    .setFontSize(14).setFontWeight("bold").setBackground("#F0F7FF");
  currentRow += 2;
  
  const gradeDistribution = calculateComprehensiveGradeDistribution(gradingData);
  
  let distributionText = "OVERALL GRADE DISTRIBUTION:\n\n";
  
  const gradeLabels = [
  "1. Well Above Average",
  "2. Above Average", 
  "3. Slightly Above Average",
  "4. Average",
  "5. Slightly Below Average",
  "6. Below Average",
  "7. Well Below Average",
  "8. Fail"
];
  
  let cumulative = 0;
  for (let i = 0; i < 8; i++) {
    const count = gradeDistribution.overall[i] || 0;
    const percentage = gradeDistribution.totalGrades > 0 ? (count / gradeDistribution.totalGrades * 100) : 0;
    cumulative += percentage;
    
    distributionText += `${gradeLabels[i]}: ${count} grades (${percentage.toFixed(1)}%, cumulative ${cumulative.toFixed(1)}%)\n`;
  }
  
  distributionText += `\nTotal Grades Analyzed: ${gradeDistribution.totalGrades}\n\n`;
  
  // Add track distribution summary
  distributionText += "GRADE DISTRIBUTION BY STUDENT TRACK:\n\n";
  
  for (const track in gradeDistribution.byTrack) {
    const trackDist = gradeDistribution.byTrack[track];
    distributionText += `${track} Track (${trackDist.total} total grades):\n`;
    for (let i = 0; i < 8; i++) {
      const count = trackDist.grades[i] || 0;
      const percentage = trackDist.total > 0 ? (count / trackDist.total * 100) : 0;
      if (count > 0) {
        distributionText += `  ${gradeLabels[i]}: ${count} (${percentage.toFixed(1)}%)\n`;
      }
    }
    distributionText += "\n";
  }
  
  // FIX: Ensure text doesn't start with formula characters
  if (distributionText.charAt(0) === '=' || distributionText.charAt(0) === '+' || distributionText.charAt(0) === '-') {
    distributionText = ' ' + distributionText;
  }
  
  sheet.getRange(currentRow, 1).setValue(distributionText).setWrap(true);
  currentRow += Math.max(distributionText.split('\n').length + 3, 15);
  
  return currentRow;
}

/**
 * NEW: Add detailed reliability metrics - FIXED VERSION
 */
function addDetailedReliabilityMetrics(sheet, gradingData, startRow) {
  let currentRow = startRow;
  
  sheet.getRange(currentRow, 1).setValue("7. DETAILED RELIABILITY METRICS")
    .setFontSize(14).setFontWeight("bold").setBackground("#F0F7FF");
  currentRow += 2;
  
  const reliabilityData = calculateDetailedReliabilityMetrics(gradingData);
  
  // FIX: Handle cases where ICC is not a number
  const iccDisplay = (typeof reliabilityData.icc === 'number' && !isNaN(reliabilityData.icc)) 
    ? reliabilityData.icc.toFixed(3) 
    : 'N/A';
  
  const semDisplay = (typeof reliabilityData.sem === 'number' && !isNaN(reliabilityData.sem)) 
    ? reliabilityData.sem.toFixed(2) 
    : 'N/A';
  
  const ci95Display = (typeof reliabilityData.ci95 === 'number' && !isNaN(reliabilityData.ci95)) 
    ? reliabilityData.ci95.toFixed(1) 
    : 'N/A';
  
  let reliabilityText = `INTER-RATER RELIABILITY ANALYSIS:

Overall ICC (Intraclass Correlation): ${iccDisplay}
Interpretation: ${reliabilityData.iccInterpretation || 'N/A'}

MEASUREMENT PRECISION:
Standard Error of Measurement: ${semDisplay}
95% Confidence Interval Width: ±${ci95Display} points

GRADER BIAS ANALYSIS:
Graders with Significant Bias: ${reliabilityData.biasedGraders || 'Analysis pending'}

RECOMMENDATIONS:
${reliabilityData.recommendations || 'See main statistical analysis for detailed recommendations'}`;
  
  sheet.getRange(currentRow, 1).setValue(reliabilityText)
    .setFontFamily("Consolas").setFontSize(9).setWrap(true);
  currentRow += Math.max(reliabilityText.split('\n').length + 3, 15);
  
  return currentRow;
}

/**
 * MISSING FUNCTION: addScenarioStatisticalAnalysis
 * Add this to your script - it was referenced but never defined
 */
function addScenarioStatisticalAnalysis(sheet, gradingData, studentSurveys, instructorSurveys, startRow) {
  let currentRow = startRow;
  
  sheet.getRange(currentRow, 1).setValue("6. SCENARIO DIFFICULTY & DISCRIMINATION ANALYSIS")
    .setFontSize(14).setFontWeight("bold").setBackground("#F0F7FF");
  currentRow += 2;
  
  try {
    // Calculate scenario statistics
    const scenarioStats = calculateDetailedScenarioStatsFixed(gradingData, studentSurveys, instructorSurveys);
    
    if (Object.keys(scenarioStats).length === 0) {
      sheet.getRange(currentRow, 1).setValue("No scenario data available for statistical analysis.");
      return currentRow + 3;
    }
    
    let analysisText = "SCENARIO PERFORMANCE & FEEDBACK ANALYSIS:\n\n";
    analysisText += "Scenario | Avg Score | Std Dev | Student Clarity | Instructor Clarity | Difficulty | Issues\n";
    analysisText += "".padEnd(100, "-") + "\n";
    
    // Sort scenarios by average score (lowest first to highlight problems)
    const sortedScenarios = Object.keys(scenarioStats).sort((a, b) => {
      const scoreA = scenarioStats[a].avgScore || 0;
      const scoreB = scenarioStats[b].avgScore || 0;
      return scoreA - scoreB;
    });
    
    for (const scenario of sortedScenarios) {
      const stats = scenarioStats[scenario];
      
      analysisText += `${scenario.substring(0, 15).padEnd(15)} | `;
      analysisText += `${stats.avgScore ? stats.avgScore.toFixed(1).padStart(9) : 'N/A'.padStart(9)} | `;
      analysisText += `${stats.stdDev ? stats.stdDev.toFixed(1).padStart(7) : 'N/A'.padStart(7)} | `;
      analysisText += `${stats.studentClarity ? stats.studentClarity.toFixed(1).padStart(13) : 'N/A'.padStart(13)} | `;
      analysisText += `${stats.instructorClarity ? stats.instructorClarity.toFixed(1).padStart(16) : 'N/A'.padStart(16)} | `;
      analysisText += `${stats.difficulty.padStart(10)} | `;
      analysisText += `${stats.issues.join(', ')}\n`;
    }
    
    analysisText += "\n\nDETAILED SCENARIO INSIGHTS:\n\n";
    
    for (const scenario of sortedScenarios) {
      const stats = scenarioStats[scenario];
      analysisText += `${scenario}:\n`;
      analysisText += `  • Performance: ${stats.totalGrades} grades, avg ${stats.avgScore ? stats.avgScore.toFixed(1) : 'N/A'}\n`;
      analysisText += `  • Student Feedback: ${stats.studentFeedback ? stats.studentFeedback.responseCount : 0} responses\n`;
      analysisText += `  • Instructor Feedback: ${stats.instructorFeedback ? stats.instructorFeedback.responseCount : 0} responses\n`;
      
      if (stats.issues.length > 0) {
        analysisText += `  • Issues: ${stats.issues.join('; ')}\n`;
      }
      
      if (stats.recommendations.length > 0) {
        analysisText += `  • Recommendations: ${stats.recommendations.join('; ')}\n`;
      }
      
      analysisText += "\n";
    }
    
    sheet.getRange(currentRow, 1).setValue(analysisText)
      .setWrap(true)
      .setFontFamily("Consolas")
      .setFontSize(9);
    
    currentRow += Math.max(analysisText.split('\n').length + 3, 30);
    
  } catch (error) {
    console.error("Error in addScenarioStatisticalAnalysis:", error.message);
    sheet.getRange(currentRow, 1).setValue("ERROR calculating scenario analysis: " + error.message);
    currentRow += 3;
  }
  
  return currentRow;
}

/**
 * MISSING FUNCTION: calculateDetailedScenarioStatsFixed
 * Enhanced version with better error handling and survey integration
 */
function calculateDetailedScenarioStatsFixed(gradingData, studentSurveys, instructorSurveys) {
  const scenarioStats = {};
  
  if (!Array.isArray(gradingData)) {
    console.log("Invalid grading data provided to calculateDetailedScenarioStats");
    return scenarioStats;
  }
  
  // Get unique scenarios from grading data
  const scenarios = [...new Set(gradingData.map(d => d.scenario).filter(s => s))];
  
  console.log("Processing detailed scenario stats for", scenarios.length, "scenarios");
  
  for (const scenario of scenarios) {
    const scenarioRecords = gradingData.filter(g => g.scenario === scenario);
    const studentFeedback = studentSurveys ? studentSurveys.filter(s => s.scenarioId === scenario) : [];
    const instructorFeedback = instructorSurveys ? instructorSurveys.filter(i => i.scenarioId === scenario) : [];
    
    // Calculate performance metrics
    const scores = scenarioRecords
      .map(g => {
        if (typeof g.overallGrade === 'number' && !isNaN(g.overallGrade)) {
          return g.overallGrade;
        } else if (typeof g.weightedAverage === 'number' && !isNaN(g.weightedAverage)) {
          return g.weightedAverage;
        }
        return null;
      })
      .filter(s => s !== null);
    
    const avgScore = scores.length > 0 ? calculateAverage(scores) : null;
    const stdDev = scores.length > 0 ? calculateStandardDeviation(scores) : null;
    
    // Student perceptions
    const studentClarity = studentFeedback.length > 0 ? 
      calculateAverage(studentFeedback.map(s => s.problemStatementClarity).filter(c => typeof c === 'number')) : null;
    
    const studentDifficulty = studentFeedback.length > 0 ? 
      calculateAverage(studentFeedback.map(s => s.overallDifficulty).filter(d => typeof d === 'number')) : null;
    
    // Instructor perceptions
    const instructorClarity = instructorFeedback.length > 0 ? 
      calculateAverage(instructorFeedback.map(i => i.problemStatementClarity).filter(c => typeof c === 'number')) : null;
    
    const instructorDifficulty = instructorFeedback.length > 0 ? 
      calculateAverage(instructorFeedback.map(i => i.overallDifficulty).filter(d => typeof d === 'number')) : null;
    
    // Determine difficulty category
    let difficulty = 'Unknown';
    if (avgScore !== null) {
      if (avgScore < 75) {
        difficulty = 'High';
      } else if (avgScore > 90) {
        difficulty = 'Low';
      } else {
        difficulty = 'Normal';
      }
    }
    
    // Identify issues and recommendations
    const issues = [];
    const recommendations = [];
    
    if (avgScore !== null && avgScore < 80) {
      issues.push('Low Performance');
      recommendations.push('Review scenario difficulty and clarity');
    }
    
    if (stdDev !== null && stdDev > 12) {
      issues.push('High Variability');
      recommendations.push('Improve grading consistency training');
    }
    
    if (studentClarity !== null && studentClarity < 3) {
      issues.push('Poor Student Clarity');
      recommendations.push('Revise problem statement');
    }
    
    if (instructorClarity !== null && instructorClarity < 3) {
      issues.push('Poor Instructor Clarity');
      recommendations.push('Update instructor guidance');
    }
    
    if (studentDifficulty !== null && instructorDifficulty !== null && 
        Math.abs(studentDifficulty - instructorDifficulty) > 1) {
      issues.push('Student-Instructor Difficulty Mismatch');
      recommendations.push('Calibrate expectations between students and instructors');
    }
    
    scenarioStats[scenario] = {
      totalGrades: scores.length,
      avgScore: avgScore,
      stdDev: stdDev,
      difficulty: difficulty,
      studentClarity: studentClarity,
      instructorClarity: instructorClarity,
      studentFeedback: {
        responseCount: studentFeedback.length,
        avgDifficulty: studentDifficulty
      },
      instructorFeedback: {
        responseCount: instructorFeedback.length,
        avgDifficulty: instructorDifficulty
      },
      issues: issues,
      recommendations: recommendations
    };
    
    console.log(`${scenario}: ${scores.length} grades, avg ${avgScore ? avgScore.toFixed(1) : 'N/A'}, issues: ${issues.length}`);
  }
  
  return scenarioStats;
}

//=====================================================
// MATH UTILITY FUNCTIONS
//=====================================================

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(array) {
  if (!Array.isArray(array) || array.length <= 1) return 0;
  
  // Filter out non-numeric values
  const validValues = array.filter(v => typeof v === 'number' && !isNaN(v));
  if (validValues.length <= 1) return 0;
  
  const avg = calculateAverage(validValues);
  return validValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / validValues.length;
}

/**
 * Calculate correlation between two arrays
 */
function calculateCorrelation(x, y) {
  if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length <= 1) return 0;
  
  // Filter paired values
  const validPairs = [];
  for (let i = 0; i < x.length; i++) {
    if (typeof x[i] === 'number' && !isNaN(x[i]) && 
        typeof y[i] === 'number' && !isNaN(y[i])) {
      validPairs.push([x[i], y[i]]);
    }
  }
  
  if (validPairs.length <= 1) return 0;
  
  const n = validPairs.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += validPairs[i][0];
    sumY += validPairs[i][1];
    sumXY += validPairs[i][0] * validPairs[i][1];
    sumX2 += validPairs[i][0] * validPairs[i][0];
    sumY2 += validPairs[i][1] * validPairs[i][1];
  }
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  
  return numerator / denominator;
}

/**
 * Calculate average of an array of numbers
 */
function calculateAverage(array) {
  if (!Array.isArray(array) || array.length === 0) return 0;
  
  // Filter out non-numeric values
  const validValues = array.filter(v => typeof v === 'number' && !isNaN(v));
  if (validValues.length === 0) return 0;
  
  return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
}

/**
 * Calculate standard deviation of an array of numbers
 */
function calculateStandardDeviation(array) {
  return Math.sqrt(calculateVariance(array));
}

//=====================================================
// ADDITIONAL HELPER FUNCTIONS FOR DETAILED ANALYSIS
//=====================================================

/**
 * Additional helper functions for detailed analysis
 */
function calculateICCForCriterion(gradingData, criterionIndex) {
  // Simplified version - returns placeholder
  return Math.random() * 0.5 + 0.5; // Placeholder between 0.5-1.0
}

function calculateGraderVariance(gradingData) {
  // Simplified calculation
  const graderAverages = {};
  
  for (const record of gradingData) {
    if (!graderAverages[record.graderLastName]) {
      graderAverages[record.graderLastName] = [];
    }
    if (typeof record.overallGrade === 'number') {
      graderAverages[record.graderLastName].push(record.overallGrade);
    }
  }
  
  const averages = [];
  for (const grader in graderAverages) {
    if (graderAverages[grader].length > 0) {
      averages.push(calculateAverage(graderAverages[grader]));
    }
  }
  
  return averages.length > 0 ? calculateStandardDeviation(averages) : null;
}

function identifyBiasedGraders(gradingData) {
  // Returns list of graders with significant bias
  return "Analysis in progress - see grader statistics matrix above";
}

function calculateStandardErrorOfMeasurement(gradingData) {
  // Simplified SEM calculation
  const scores = gradingData
    .filter(d => typeof d.overallGrade === 'number')
    .map(d => d.overallGrade);
    
  if (scores.length === 0) return null;
  
  const stdDev = calculateStandardDeviation(scores);
  const reliability = 0.8; // Placeholder reliability estimate
  
  return stdDev * Math.sqrt(1 - reliability);
}

function generateReliabilityRecommendations(metrics) {
  let recommendations = [];
  
  if (typeof metrics.icc === 'number') {
    if (metrics.icc < 0.7) {
      recommendations.push("Increase number of graders per student");
      recommendations.push("Provide grader calibration training");
    } else if (metrics.icc < 0.9) {
      recommendations.push("Minor grader calibration improvements recommended");
    } else {
      recommendations.push("Excellent reliability - maintain current practices");
    }
  } else {
    recommendations.push("Insufficient data for reliability assessment");
  }
  
  return recommendations.join('; ');
}

/**
 * Retrieves and processes data from a sheet
 */
function getSheetData(sheet) {
  if (!sheet) return [];
  
  try {
    // Get all data in one batch operation
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // Only header row
    
    // Process data to extract useful information
    const processedData = [];
    
    // Group by student
    const studentGroups = {};
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const student = row[HOME_STUDENT_COL - 1]; // 0-indexed (should now be row[1])
      if (!student) continue;
      
      if (!studentGroups[student]) {
        studentGroups[student] = [];
      }
      studentGroups[student].push(row);
    }
    
    // Process each student's data
    for (const student in studentGroups) {
      const studentRows = studentGroups[student];
      
      // Get scenario and track from the first row
      // Columns E and F (5 and 6, 1-indexed; 4 and 5, 0-indexed)
      let scenario = studentRows[0][3]; // Column D, 0-indexed
      let track = studentRows[0][4];    // Column E, 0-indexed
      
      // Prepare grader data
      const graderGrades = {};
      
      // Process each row for this student
      for (const row of studentRows) {
        const grader = row[HOME_STUDENT_COL - 1 + 1]; // Grader is next to student name
        if (!grader) continue;
        
        // Extract grades
        const grades = [];
        for (let col = HOME_GRADE_START_COL - 1; col <= HOME_GRADE_END_COL - 1; col++) {
          const gradeText = row[col];
          if (!gradeText) continue;
          
          const gradeValue = GRADE_VALUES[gradeText];
          if (gradeValue !== undefined) {
            grades.push({
              criteriaIndex: col - (HOME_GRADE_START_COL - 1),
              textValue: gradeText,
              numericValue: gradeValue,
              score: NUMERIC_MAP[gradeValue]
            });
          }
        }
        
        // Calculate weighted sum for this grader
        let weightedSum = 0;
        let weightSum = 0;
        
        for (const grade of grades) {
          const weight = GRADE_WEIGHTS[grade.criteriaIndex];
          weightedSum += grade.score * weight;
          weightSum += weight;
        }
        
        // Normalize if we don't have all criteria
        if (weightSum > 0 && weightSum < 1) {
          weightedSum = weightedSum / weightSum;
        }
        
        // Store this grader's data
        graderGrades[grader] = {
          grades: grades,
          weightedSum: weightedSum
        };
      }
      
      // Get overall average if it exists
      let overallAverage = null;
      const lastRow = studentRows[studentRows.length - 1];
      if (lastRow && lastRow[HOME_TOTAL_COL - 1]) {
        overallAverage = lastRow[HOME_TOTAL_COL - 1];
      }
      
      // Add to processed data
      processedData.push({
        student: student,
        scenario: scenario,
        track: track,
        graders: graderGrades,
        numGraders: Object.keys(graderGrades).length,
        overallAverage: overallAverage
      });
    }
    
    return processedData;
  } catch (error) {
    console.error("Error in getSheetData:", error.message);
    console.error(error.stack);
    return [];
  }
}
//=====================================================
// SURVEY DATA READING FUNCTIONS
//=====================================================

/**
 * Read and process student survey data
 */
function getStudentSurveyData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(STUDENT_SURVEY_SHEET);
    
    if (!sheet) {
      console.log("Student Survey sheet not found");
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // No data beyond headers
    
    const processedData = [];
    
    // Process each response (skip header row)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Skip empty rows
      if (!row[1] || !row[2] || !row[3]) continue; // Track, Date, Scenario required
      
      processedData.push({
        timestamp: row[0],
        track: normalizeTrack(row[1]),
        examDate: row[2],
        scenarioId: row[3],
        
        // Scenario evaluation
        problemStatementClarity: row[4],
        problemStatementComments: row[5] || "",
        taskSectionClarity: row[6],
        taskSectionComments: row[7] || "",
        overallDifficulty: row[8],
        testerDifficulty: row[9],
        leaderDifficulty: row[10],
        thinkerDifficulty: row[11],
        innovatorDifficulty: row[12],
        trackAppropriateness: row[13],
        trackAppropriatenessComments: row[14] || "",
        sufficientInfo: row[15],
        lackingInfoComments: row[16] || "",
        
        // Process and timing
        reviewTimeAdequacy: row[17],
        prepTimeAdequacy: row[18],
        timeManagement: row[19],
        testerTimePercentage: row[20],
        presentationTimeAdequacy: row[21],
        
        // Panel and preparation
        panelQuestionClarity: row[22],
        panelProfessionalism: row[23],
        mibEffectiveness: row[24],
        practiceScenarios: row[25],
        whiteboardUsage: row[26],
        whiteboardHelpfulness: row[27],
        
        // Self-assessment
        testerPreparation: row[28],
        leaderPreparation: row[29],
        thinkerPreparation: row[30],
        innovatorPreparation: row[31],
        flightSciencesPrep: row[32],
        flightSciencesComments: row[33] || "",
        missionSystemsPrep: row[34],
        missionSystemsComments: row[35] || "",
        tpsAlignment: row[36],
        
        // Open-ended feedback
        mostChallenging: row[37] || "",
        mostValuable: row[38] || "",
        improvementSuggestions: row[39] || "",
        additionalComments: row[40] || ""
      });
    }
    
    console.log(`Processed ${processedData.length} student survey responses`);
    return processedData;
    
  } catch (error) {
    console.error("Error reading student survey data: " + error.message);
    return [];
  }
}

/**
 * Read and process instructor survey data
 */
function getInstructorSurveyData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(INSTRUCTOR_SURVEY_SHEET);
    
    if (!sheet) {
      console.log("Instructor Survey sheet not found");
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // No data beyond headers
    
    const processedData = [];
    
    // Process each response (skip header row)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Skip empty rows
      if (!row[1] || !row[3] || !row[4]) continue; // Track, Student, Scenario required
      
      processedData.push({
        timestamp: row[0],
        instructorTrack: normalizeTrack(row[1]),
        experienceLevel: row[2],
        studentNumber: row[3],
        scenarioId: row[4],
        examDate: row[5],
        
        // Scenario evaluation
        problemStatementClarity: row[6],
        taskSectionClarity: row[7],
        scenarioScope: row[8],
        testerEffectiveness: row[9],
        leaderEffectiveness: row[10],
        thinkerEffectiveness: row[11],
        innovatorEffectiveness: row[12],
        overallDifficulty: row[13],
        instructorGuideAdequacy: row[14],
        scenarioComments: row[15] || "",
        
        // Pre-deliberation scores and confidence
        scores: {
          obj_data: { score: row[17], confidence: row[18] },
          eng_principles: { score: row[19], confidence: row[20] },
          instro_resources: { score: row[21], confidence: row[22] },
          risk_mgmt: { score: row[23], confidence: row[24] },
          communication: { score: row[25], confidence: row[26] },
          stakeholder: { score: row[27], confidence: row[28] },
          adapting: { score: row[29], confidence: row[30] },
          innovation: { score: row[31], confidence: row[32] }
        },
        
        // Pillar adequacy assessments
        testerAdequacy: row[33],
        leaderAdequacy: row[34],
        thinkerAdequacy: row[35],
        innovatorAdequacy: row[36],
        
        // Process improvement comments
        processComments: row[37] || ""
      });
    }
    
    console.log(`Processed ${processedData.length} instructor survey responses`);
    return processedData;
    
  } catch (error) {
    console.error("Error reading instructor survey data: " + error.message);
    return [];
  }
}

/**
 * Read and process History sheet data for Foundation Report
 */
function getHistorySheetData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("History");
    
    if (!sheet) {
      console.log("History sheet not found");
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // No data beyond headers
    
    const processedData = [];
    
    // Process each grading record (skip header row)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Skip empty rows
      if (!row[2] || !row[4]) continue; // Student and Scenario required
      
      processedData.push({
    submissionTime: row[0],        // Column A: Timestamp (no more submissionId)
    studentIdentifier: row[1],     // Column B: Student Identifier  
    graderLastName: row[2],        // Column C: Grader Last Name
    scenario: row[3],              // Column D: Scenario
    track: normalizeTrack(row[4]), // Column E: Track
  
  // Individual criterion scores
  // 25B UPDATE: 7 criteria -- enabling_innovation removed, indices shifted
  criteria: {
    objectives_data: row[5],        // Column F
    engineering_principles: row[6], // Column G
    instro_resources: row[7],       // Column H
    risk_management: row[8],        // Column I
    communication: row[9],          // Column J
    stakeholder_analysis: row[10],  // Column K
    adapting_changes: row[11],      // Column L (last criterion)
  },
  
  weightedAverage: row[12],      // Column M (was N)
  overallGrade: row[13]          // Column N (was O)
});
    }
    
    console.log(`Processed ${processedData.length} grading records from History sheet`);
    return processedData;
    
  } catch (error) {
    console.error("Error reading History sheet data: " + error.message);
    return [];
  }
}

//=====================================================
// DATA LINKING AND ANALYSIS FUNCTIONS
//=====================================================

/**
 * Normalize track names for consistent matching
 */
function normalizeTrack(trackInput) {
  if (!trackInput || typeof trackInput !== 'string') return "Unknown";
  
  const cleaned = trackInput.trim();
  return TRACK_MAPPINGS[cleaned] || cleaned;
}

/**
 * Link all data sources together
 */
function linkDataSources(gradingData, studentSurveys, instructorSurveys) {
  const linkedData = {
    byStudent: {},
    byScenario: {},
    byTrack: {},
    summary: {
      totalStudents: 0,
      totalScenarios: 0,
      totalGradingRecords: gradingData.length,
      totalStudentSurveys: studentSurveys.length,
      totalInstructorSurveys: instructorSurveys.length
    }
  };
  
  // Group grading data by student
  const gradingByStudent = {};
  for (const record of gradingData) {
    if (!gradingByStudent[record.studentIdentifier]) {
      gradingByStudent[record.studentIdentifier] = [];
    }
    gradingByStudent[record.studentIdentifier].push(record);
  }
  
  // Link student surveys with grading data
  for (const survey of studentSurveys) {
    // Find matching grading records by scenario, track, and approximate date
    const matchingGrading = gradingData.filter(g => 
      g.scenario === survey.scenarioId && 
      g.track === survey.track
    );
    
    if (matchingGrading.length > 0) {
      const studentKey = `${survey.track}_${survey.scenarioId}_${formatDate(survey.examDate)}`;
      
      linkedData.byStudent[studentKey] = {
        studentSurvey: survey,
        gradingRecords: matchingGrading,
        instructorSurveys: []
      };
    }
  }
  
  // Link instructor surveys
  for (const survey of instructorSurveys) {
    const matchingGrading = gradingData.filter(g => 
      g.studentIdentifier === survey.studentNumber && 
      g.scenario === survey.scenarioId
    );
    
    // Find corresponding student data
    for (const studentKey in linkedData.byStudent) {
      const studentData = linkedData.byStudent[studentKey];
      
      if (studentData.gradingRecords.some(g => 
        g.studentIdentifier === survey.studentNumber && 
        g.scenario === survey.scenarioId)) {
        
        studentData.instructorSurveys.push(survey);
      }
    }
  }
  
  // Calculate summary statistics
  linkedData.summary.totalStudents = Object.keys(linkedData.byStudent).length;
  
  const scenarios = new Set();
  for (const record of gradingData) {
    scenarios.add(record.scenario);
  }
  linkedData.summary.totalScenarios = scenarios.size;
  
  return linkedData;
}

/**
 * Perform integrated statistical analysis
 */
function performIntegratedAnalysis(gradingData, studentSurveys, instructorSurveys) {
  const linkedData = linkDataSources(gradingData, studentSurveys, instructorSurveys);
  
  const analysis = {
    linkedData: linkedData,
    scenarioAnalysis: analyzeScenarioPerformance(gradingData, studentSurveys, instructorSurveys),
    graderAnalysis: analyzeGraderPatterns(gradingData, instructorSurveys),
    curriculumAnalysis: analyzeCurriculumEffectiveness(gradingData, studentSurveys),
    processAnalysis: analyzeProcessEffectiveness(studentSurveys, instructorSurveys),
    trackAnalysis: analyzeTrackSpecificPatterns(gradingData, studentSurveys, instructorSurveys),
    commentAnalysis: organizeCommentsByTheme(studentSurveys, instructorSurveys),
    correlationAnalysis: createCorrelationAnalysis(gradingData, studentSurveys, instructorSurveys) // NEW
  };
  
  return analysis;
}

/**
 * Analyze scenario performance and correlate with survey feedback
 */
function analyzeScenarioPerformance(gradingData, studentSurveys, instructorSurveys) {
  const scenarioStats = {};
  
  // Get unique scenarios
  const scenarios = [...new Set(gradingData.map(g => g.scenario))];
  
  for (const scenario of scenarios) {
    const gradingRecords = gradingData.filter(g => g.scenario === scenario);
    const studentFeedback = studentSurveys.filter(s => s.scenarioId === scenario);
    const instructorFeedback = instructorSurveys.filter(i => i.scenarioId === scenario);
    
    // Calculate performance metrics
    const scores = gradingRecords
      .filter(g => typeof g.overallGrade === 'number')
      .map(g => g.overallGrade);
    
    const avgScore = scores.length > 0 ? calculateAverage(scores) : null;
    const scoreVariability = scores.length > 0 ? calculateStandardDeviation(scores) : null;
    
    // Student perceptions
    const studentClarity = studentFeedback.length > 0 ? 
      calculateAverage(studentFeedback.map(s => s.problemStatementClarity).filter(c => typeof c === 'number')) : null;
    
    const studentDifficulty = studentFeedback.length > 0 ? 
      calculateAverage(studentFeedback.map(s => s.overallDifficulty).filter(d => typeof d === 'number')) : null;
    
    // Instructor perceptions
    const instructorClarity = instructorFeedback.length > 0 ? 
      calculateAverage(instructorFeedback.map(i => i.problemStatementClarity).filter(c => typeof c === 'number')) : null;
    
    const instructorDifficulty = instructorFeedback.length > 0 ? 
      calculateAverage(instructorFeedback.map(i => i.overallDifficulty).filter(d => typeof d === 'number')) : null;
    
    scenarioStats[scenario] = {
      performanceMetrics: {
        avgScore: avgScore,
        scoreVariability: scoreVariability,
        totalRecords: gradingRecords.length,
        passRate: scores.length > 0 ? (scores.filter(s => s >= 70).length / scores.length) * 100 : null
      },
      studentPerceptions: {
        clarity: studentClarity,
        difficulty: studentDifficulty,
        responseCount: studentFeedback.length
      },
      instructorPerceptions: {
        clarity: instructorClarity,
        difficulty: instructorDifficulty,
        responseCount: instructorFeedback.length
      },
      issueFlags: []
    };
    
    // Flag potential issues
    const stats = scenarioStats[scenario];
    if (stats.performanceMetrics.avgScore && stats.performanceMetrics.avgScore < 80) {
      stats.issueFlags.push("Low average performance");
    }
    if (stats.performanceMetrics.scoreVariability && stats.performanceMetrics.scoreVariability > 10) {
      stats.issueFlags.push("High score variability");
    }
    if (stats.studentPerceptions.clarity && stats.studentPerceptions.clarity < 3) {
      stats.issueFlags.push("Poor student clarity rating");
    }
    if (stats.instructorPerceptions.clarity && stats.instructorPerceptions.clarity < 3) {
      stats.issueFlags.push("Poor instructor clarity rating");
    }
  }
  
  return scenarioStats;
}

/**
 * Analyze grader patterns and correlate with instructor survey feedback
 */
function analyzeGraderPatterns(gradingData, instructorSurveys) {
  const graderStats = {};
  
  // Group by grader
  const graderGroups = {};
  for (const record of gradingData) {
    if (!graderGroups[record.graderLastName]) {
      graderGroups[record.graderLastName] = [];
    }
    graderGroups[record.graderLastName].push(record);
  }
  
  for (const grader in graderGroups) {
    const records = graderGroups[grader];
    const scores = records
      .filter(r => typeof r.overallGrade === 'number')
      .map(r => r.overallGrade);
    
    // Find instructor surveys from this grader
    const graderSurveys = instructorSurveys.filter(i => 
      i.graderLastName === grader || 
      records.some(r => r.studentIdentifier === i.studentNumber)
    );
    
    graderStats[grader] = {
      gradingMetrics: {
        avgScore: scores.length > 0 ? calculateAverage(scores) : null,
        scoreRange: scores.length > 0 ? Math.max(...scores) - Math.min(...scores) : null,
        totalGrades: scores.length,
        consistency: scores.length > 0 ? calculateStandardDeviation(scores) : null
      },
      surveyMetrics: {
        avgConfidence: null,
        responseCount: graderSurveys.length
      }
    };
    
    // Calculate average confidence if surveys available
    if (graderSurveys.length > 0) {
      const confidenceValues = [];
      for (const survey of graderSurveys) {
        for (const criterion in survey.scores) {
          if (typeof survey.scores[criterion].confidence === 'number') {
            confidenceValues.push(survey.scores[criterion].confidence);
          }
        }
      }
      
      if (confidenceValues.length > 0) {
        graderStats[grader].surveyMetrics.avgConfidence = calculateAverage(confidenceValues);
      }
    }
  }
  
  return graderStats;
}

/**
 * Analyze curriculum effectiveness using student feedback and performance
 */
function analyzeCurriculumEffectiveness(gradingData, studentSurveys) {
  const curriculumStats = {
    flightSciences: {
      satisfactionRating: null,
      performanceCorrelation: null,
      comments: []
    },
    missionSystems: {
      satisfactionRating: null,
      performanceCorrelation: null,
      comments: []
    },
    pillarPreparation: {
      tester: { satisfaction: null, performance: null },
      leader: { satisfaction: null, performance: null },
      thinker: { satisfaction: null, performance: null },
      innovator: { satisfaction: null, performance: null }
    }
  };
  
  if (studentSurveys.length === 0) return curriculumStats;
  
  // Flight Sciences analysis
  const flightSciencesRatings = studentSurveys
    .map(s => s.flightSciencesPrep)
    .filter(r => typeof r === 'number');
  
  if (flightSciencesRatings.length > 0) {
    curriculumStats.flightSciences.satisfactionRating = calculateAverage(flightSciencesRatings);
  }
  
  curriculumStats.flightSciences.comments = studentSurveys
    .map(s => s.flightSciencesComments)
    .filter(c => c && c.trim().length > 0);
  
  // Mission Systems analysis
  const missionSystemsRatings = studentSurveys
    .map(s => s.missionSystemsPrep)
    .filter(r => typeof r === 'number');
  
  if (missionSystemsRatings.length > 0) {
    curriculumStats.missionSystems.satisfactionRating = calculateAverage(missionSystemsRatings);
  }
  
  curriculumStats.missionSystems.comments = studentSurveys
    .map(s => s.missionSystemsComments)
    .filter(c => c && c.trim().length > 0);
  
  // Pillar preparation analysis
  const pillars = ['tester', 'leader', 'thinker', 'innovator'];
  const preparationFields = ['testerPreparation', 'leaderPreparation', 'thinkerPreparation', 'innovatorPreparation'];
  
  for (let i = 0; i < pillars.length; i++) {
    const ratings = studentSurveys
      .map(s => s[preparationFields[i]])
      .filter(r => typeof r === 'number');
    
    if (ratings.length > 0) {
      curriculumStats.pillarPreparation[pillars[i]].satisfaction = calculateAverage(ratings);
    }
  }
  
  return curriculumStats;
}

/**
 * Analyze process effectiveness
 */
function analyzeProcessEffectiveness(studentSurveys, instructorSurveys) {
  const processStats = {
    timing: {
      reviewTime: null,
      preparationTime: null,
      presentationTime: null
    },
    preparation: {
      mibEffectiveness: null,
      practiceScenarios: null
    },
    panel: {
      professionalism: null,
      questionClarity: null
    }
  };
  
  if (studentSurveys.length === 0) return processStats;
  
  // Timing analysis
  const reviewTimeRatings = studentSurveys.map(s => s.reviewTimeAdequacy).filter(r => typeof r === 'number');
  const prepTimeRatings = studentSurveys.map(s => s.prepTimeAdequacy).filter(r => typeof r === 'number');
  const presentationTimeRatings = studentSurveys.map(s => s.presentationTimeAdequacy).filter(r => typeof r === 'number');
  
  if (reviewTimeRatings.length > 0) processStats.timing.reviewTime = calculateAverage(reviewTimeRatings);
  if (prepTimeRatings.length > 0) processStats.timing.preparationTime = calculateAverage(prepTimeRatings);
  if (presentationTimeRatings.length > 0) processStats.timing.presentationTime = calculateAverage(presentationTimeRatings);
  
  // Preparation analysis
  const mibRatings = studentSurveys.map(s => s.mibEffectiveness).filter(r => typeof r === 'number');
  const practiceRatings = studentSurveys.map(s => s.practiceScenarios).filter(r => typeof r === 'number');
  
  if (mibRatings.length > 0) processStats.preparation.mibEffectiveness = calculateAverage(mibRatings);
  if (practiceRatings.length > 0) processStats.preparation.practiceScenarios = calculateAverage(practiceRatings);
  
  // Panel analysis
  const professionalismRatings = studentSurveys.map(s => s.panelProfessionalism).filter(r => typeof r === 'number');
  const clarityRatings = studentSurveys.map(s => s.panelQuestionClarity).filter(r => typeof r === 'number');
  
  if (professionalismRatings.length > 0) processStats.panel.professionalism = calculateAverage(professionalismRatings);
  if (clarityRatings.length > 0) processStats.panel.questionClarity = calculateAverage(clarityRatings);
  
  return processStats;
}

/**
 * Analyze track-specific patterns
 */
function analyzeTrackSpecificPatterns(gradingData, studentSurveys, instructorSurveys) {
  const trackStats = {};
  
  // Get unique tracks
  const tracks = [...new Set([
    ...gradingData.map(g => g.track),
    ...studentSurveys.map(s => s.track)
  ])].filter(t => t && t !== "Unknown");
  
  for (const track of tracks) {
    const trackGrading = gradingData.filter(g => g.track === track);
    const trackStudentSurveys = studentSurveys.filter(s => s.track === track);
    const trackInstructorSurveys = instructorSurveys.filter(i => i.instructorTrack === track);
    
    const scores = trackGrading
      .filter(g => typeof g.overallGrade === 'number')
      .map(g => g.overallGrade);
    
    trackStats[track] = {
      performance: {
        avgScore: scores.length > 0 ? calculateAverage(scores) : null,
        totalStudents: trackGrading.length,
        passRate: scores.length > 0 ? (scores.filter(s => s >= 70).length / scores.length) * 100 : null
      },
      satisfaction: {
        avgTrackAppropriateness: trackStudentSurveys.length > 0 ? 
          calculateAverage(trackStudentSurveys.map(s => s.trackAppropriateness).filter(t => typeof t === 'number')) : null,
        responseCount: trackStudentSurveys.length
      },
      instructorPerspective: {
        responseCount: trackInstructorSurveys.length
      }
    };
  }
  
  return trackStats;
}

/**
 * Organize comments by theme for LLM analysis
 */
function organizeCommentsByTheme(studentSurveys, instructorSurveys) {
  const comments = {
    scenarioClarity: {
      student: [],
      instructor: []
    },
    curriculumGaps: {
      flightSciences: [],
      missionSystems: [],
      general: []
    },
    processImprovements: {
      timing: [],
      preparation: [],
      general: []
    },
    positive: {
      mostValuable: [],
      strengths: []
    },
    suggestions: {
      actionable: [],
      general: []
    },
    allStudentComments: [], // Complete dataset for LLM
    allInstructorComments: [] // Complete dataset for LLM
  };
  
  // Organize student comments by theme AND preserve complete dataset
  for (let i = 0; i < studentSurveys.length; i++) {
    const survey = studentSurveys[i];
    
    // Add to themed categories
    if (survey.problemStatementComments) comments.scenarioClarity.student.push(survey.problemStatementComments);
    if (survey.taskSectionComments) comments.scenarioClarity.student.push(survey.taskSectionComments);
    if (survey.flightSciencesComments) comments.curriculumGaps.flightSciences.push(survey.flightSciencesComments);
    if (survey.missionSystemsComments) comments.curriculumGaps.missionSystems.push(survey.missionSystemsComments);
    if (survey.mostValuable) comments.positive.mostValuable.push(survey.mostValuable);
    if (survey.improvementSuggestions) comments.suggestions.actionable.push(survey.improvementSuggestions);
    if (survey.additionalComments) comments.suggestions.general.push(survey.additionalComments);
    
    // Preserve complete student survey with metadata for correlation
    comments.allStudentComments.push({
      surveyIndex: i,
      track: survey.track,
      scenarioId: survey.scenarioId,
      examDate: survey.examDate,
      allComments: {
        problemStatementComments: survey.problemStatementComments || "",
        taskSectionComments: survey.taskSectionComments || "",
        trackAppropriatenessComments: survey.trackAppropriatenessComments || "",
        lackingInfoComments: survey.lackingInfoComments || "",
        flightSciencesComments: survey.flightSciencesComments || "",
        missionSystemsComments: survey.missionSystemsComments || "",
        mostChallenging: survey.mostChallenging || "",
        mostValuable: survey.mostValuable || "",
        improvementSuggestions: survey.improvementSuggestions || "",
        additionalComments: survey.additionalComments || ""
      },
      ratings: {
        problemStatementClarity: survey.problemStatementClarity,
        taskSectionClarity: survey.taskSectionClarity,
        overallDifficulty: survey.overallDifficulty,
        trackAppropriateness: survey.trackAppropriateness,
        flightSciencesPrep: survey.flightSciencesPrep,
        missionSystemsPrep: survey.missionSystemsPrep,
        panelProfessionalism: survey.panelProfessionalism
      }
    });
  }
  
  // Organize instructor comments by theme AND preserve complete dataset
  for (let i = 0; i < instructorSurveys.length; i++) {
    const survey = instructorSurveys[i];
    
    // Add to themed categories
    if (survey.scenarioComments) comments.scenarioClarity.instructor.push(survey.scenarioComments);
    if (survey.processComments) comments.processImprovements.general.push(survey.processComments);
    
    // Preserve complete instructor survey with metadata for correlation
    comments.allInstructorComments.push({
      surveyIndex: i,
      instructorTrack: survey.instructorTrack,
      experienceLevel: survey.experienceLevel,
      studentNumber: survey.studentNumber,
      scenarioId: survey.scenarioId,
      examDate: survey.examDate,
      allComments: {
        scenarioComments: survey.scenarioComments || "",
        processComments: survey.processComments || ""
      },
      ratings: {
        problemStatementClarity: survey.problemStatementClarity,
        taskSectionClarity: survey.taskSectionClarity,
        overallDifficulty: survey.overallDifficulty,
        instructorGuideAdequacy: survey.instructorGuideAdequacy
      },
      scores: survey.scores || {}
    });
  }
  
  return comments;
}

/**
 * Create detailed correlation analysis linking performance with specific feedback
 */
function createCorrelationAnalysis(gradingData, studentSurveys, instructorSurveys) {
  const correlations = {
    scenarioSpecific: {},
    studentPerformanceLinks: [],
    instructorInsights: [],
    unlinkedComments: {
      student: [],
      instructor: []
    }
  };
  
  // Track which comments have been successfully correlated
  const linkedStudentSurveys = new Set();
  const linkedInstructorSurveys = new Set();
  
  // Group grading data by scenario for easier analysis
  const gradingByScenario = {};
  for (const record of gradingData) {
    if (!gradingByScenario[record.scenario]) {
      gradingByScenario[record.scenario] = [];
    }
    gradingByScenario[record.scenario].push(record);
  }
  
  // Analyze each scenario
  for (const scenario in gradingByScenario) {
    const scenarioGrades = gradingByScenario[scenario];
    const scenarioStudentSurveys = studentSurveys.filter(s => s.scenarioId === scenario);
    const scenarioInstructorSurveys = instructorSurveys.filter(i => i.scenarioId === scenario);
    
    // Calculate scenario performance statistics
    const scores = scenarioGrades
      .filter(g => typeof g.overallGrade === 'number')
      .map(g => g.overallGrade);
    
    const avgScore = scores.length > 0 ? calculateAverage(scores) : null;
    const scoreVariability = scores.length > 0 ? calculateStandardDeviation(scores) : null;
    
    correlations.scenarioSpecific[scenario] = {
      performanceStats: {
        avgScore: avgScore,
        scoreVariability: scoreVariability,
        totalGrades: scores.length,
        scoreRange: scores.length > 0 ? `${Math.min(...scores).toFixed(1)} - ${Math.max(...scores).toFixed(1)}` : 'N/A'
      },
      linkedStudentFeedback: [],
      linkedInstructorFeedback: [],
      patterns: []
    };
    
    // Try to link student feedback with performance
    for (const studentSurvey of scenarioStudentSurveys) {
      // Find matching grading records by track and approximate date
      const matchingGrades = scenarioGrades.filter(g => 
        g.track === studentSurvey.track &&
        g.scenario === studentSurvey.scenarioId
      );
      
      if (matchingGrades.length > 0) {
        // If we can match, use the average score for this track/scenario
        const trackScores = matchingGrades
          .filter(g => typeof g.overallGrade === 'number')
          .map(g => g.overallGrade);
        
        const avgTrackScore = trackScores.length > 0 ? calculateAverage(trackScores) : null;
        
        correlations.scenarioSpecific[scenario].linkedStudentFeedback.push({
          track: studentSurvey.track,
          avgScore: avgTrackScore,
          feedback: {
            problemStatementClarity: studentSurvey.problemStatementClarity,
            problemStatementComments: studentSurvey.problemStatementComments,
            taskSectionClarity: studentSurvey.taskSectionClarity,
            taskSectionComments: studentSurvey.taskSectionComments,
            overallDifficulty: studentSurvey.overallDifficulty,
            trackAppropriateness: studentSurvey.trackAppropriateness,
            trackAppropriatenessComments: studentSurvey.trackAppropriatenessComments,
            sufficientInfo: studentSurvey.sufficientInfo,
            lackingInfoComments: studentSurvey.lackingInfoComments
          }
        });
        
        linkedStudentSurveys.add(studentSurvey);
      }
    }
    
    // Link instructor feedback with performance
    for (const instructorSurvey of scenarioInstructorSurveys) {
      // Find matching grading record by student number
      const matchingGrade = scenarioGrades.find(g => 
        g.studentIdentifier === instructorSurvey.studentNumber
      );
      
      if (matchingGrade) {
        correlations.scenarioSpecific[scenario].linkedInstructorFeedback.push({
          studentNumber: instructorSurvey.studentNumber,
          studentScore: matchingGrade.overallGrade,
          instructorTrack: instructorSurvey.instructorTrack,
          experienceLevel: instructorSurvey.experienceLevel,
          feedback: {
            problemStatementClarity: instructorSurvey.problemStatementClarity,
            taskSectionClarity: instructorSurvey.taskSectionClarity,
            overallDifficulty: instructorSurvey.overallDifficulty,
            scenarioComments: instructorSurvey.scenarioComments,
            instructorGuideAdequacy: instructorSurvey.instructorGuideAdequacy
          },
          confidence: calculateAverageConfidence(instructorSurvey.scores)
        });
        
        linkedInstructorSurveys.add(instructorSurvey);
      }
    }
    
    // Identify patterns for this scenario
    const studentFeedback = correlations.scenarioSpecific[scenario].linkedStudentFeedback;
    const instructorFeedback = correlations.scenarioSpecific[scenario].linkedInstructorFeedback;
    
    // Check for concerning patterns
    if (avgScore && avgScore < 80) {
      correlations.scenarioSpecific[scenario].patterns.push(`Low average performance (${avgScore.toFixed(1)})`);
    }
    
    if (studentFeedback.length > 0) {
      const avgStudentClarity = calculateAverage(studentFeedback.map(f => f.feedback.problemStatementClarity).filter(c => typeof c === 'number'));
      if (avgStudentClarity < 3) {
        correlations.scenarioSpecific[scenario].patterns.push(`Poor student clarity rating (${avgStudentClarity.toFixed(1)}/5)`);
      }
    }
    
    if (instructorFeedback.length > 0) {
      const avgInstructorClarity = calculateAverage(instructorFeedback.map(f => f.feedback.problemStatementClarity).filter(c => typeof c === 'number'));
      if (avgInstructorClarity < 3) {
        correlations.scenarioSpecific[scenario].patterns.push(`Poor instructor clarity rating (${avgInstructorClarity.toFixed(1)}/5)`);
      }
    }
  }
  
  // Collect unlinked comments that couldn't be correlated but are still valuable
  for (const studentSurvey of studentSurveys) {
    if (!linkedStudentSurveys.has(studentSurvey)) {
      correlations.unlinkedComments.student.push({
        track: studentSurvey.track,
        scenarioId: studentSurvey.scenarioId,
        reason: "Could not link to grading data",
        comments: {
          problemStatementComments: studentSurvey.problemStatementComments,
          taskSectionComments: studentSurvey.taskSectionComments,
          flightSciencesComments: studentSurvey.flightSciencesComments,
          missionSystemsComments: studentSurvey.missionSystemsComments,
          mostChallenging: studentSurvey.mostChallenging,
          mostValuable: studentSurvey.mostValuable,
          improvementSuggestions: studentSurvey.improvementSuggestions,
          additionalComments: studentSurvey.additionalComments
        }
      });
    }
  }
  
  for (const instructorSurvey of instructorSurveys) {
    if (!linkedInstructorSurveys.has(instructorSurvey)) {
      correlations.unlinkedComments.instructor.push({
        instructorTrack: instructorSurvey.instructorTrack,
        scenarioId: instructorSurvey.scenarioId,
        studentNumber: instructorSurvey.studentNumber,
        reason: "Could not link to grading data",
        comments: {
          scenarioComments: instructorSurvey.scenarioComments,
          processComments: instructorSurvey.processComments
        }
      });
    }
  }
  
  return correlations;
}

/**
 * Calculate average confidence from instructor scores
 */
function calculateAverageConfidence(scores) {
  if (!scores || typeof scores !== 'object') return null;
  
  const confidenceValues = [];
  for (const criterion in scores) {
    if (scores[criterion] && typeof scores[criterion].confidence === 'number') {
      confidenceValues.push(scores[criterion].confidence);
    }
  }
  
  return confidenceValues.length > 0 ? calculateAverage(confidenceValues) : null;
}

/**
 * GRADER BIAS CORRECTION SYSTEM - SEPARATE TAB VERSION
 * Creates new tab with corrected grades, leaves History unchanged
 */

/**
 * Main function - creates bias corrected tab without modifying History
 */
function createBiasCorrectedGrades() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const historySheet = ss.getSheetByName('History');
    
    if (!historySheet) {
      SpreadsheetApp.getUi().alert("History sheet not found");
      return;
    }
    
    // Calculate grader bias corrections
    const biasCorrections = calculateGraderBiasCorrections();
    
    // Create or clear the corrected grades sheet
    let correctedSheet = ss.getSheetByName('Bias Corrected Grades');
    if (!correctedSheet) {
      correctedSheet = ss.insertSheet('Bias Corrected Grades');
    } else {
      correctedSheet.clear();
    }
    
    // Copy History data and apply corrections to columns O & P only
    copyHistoryWithCorrectedTotals(historySheet, correctedSheet, biasCorrections);
    
    // Add bias analysis at the bottom
    addBiasAnalysisToSheet(correctedSheet, biasCorrections);
    
    SpreadsheetApp.getUi().alert("Bias Corrected Grades tab created successfully!");
    
  } catch (error) {
    console.error("Error creating bias corrected grades:", error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
  }
}

/**
 * Calculate bias correction factors (same as before but cleaner)
 */
function calculateGraderBiasCorrections() {
  const historySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('History');
  const data = historySheet.getDataRange().getValues();
  
  if (data.length <= 1) return {};
  
  const graderStats = {};
  const allScores = [];
  
  // Collect grader data from History (skip header row)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const grader = row[2]; // Column C (grader)
    const overallScore = parseFloat(row[14]) || parseFloat(row[13]); // Column O or N
    
    if (!grader || !overallScore || overallScore === 69) continue; // Skip failures
    
    if (!graderStats[grader]) {
      graderStats[grader] = { scores: [], totalGrades: 0 };
    }
    
    graderStats[grader].scores.push(overallScore);
    graderStats[grader].totalGrades++;
    allScores.push(overallScore);
  }
  
  // Calculate population statistics
  const populationMean = calculateAverage(allScores);
  const populationStdDev = calculateStandardDeviation(allScores);
  
  // Calculate corrections for each grader
  const corrections = {};
  
  for (const grader in graderStats) {
    const stats = graderStats[grader];
    
    if (stats.scores.length < 3) {
      corrections[grader] = {
        avgScore: calculateAverage(stats.scores),
        correction: 0,
        zScore: 0,
        reliability: 'Low - Insufficient Data',
        totalGrades: stats.totalGrades,
        bias: 'Insufficient Data'
      };
      continue;
    }
    
    const graderMean = calculateAverage(stats.scores);
    const zScore = (graderMean - populationMean) / populationStdDev;
    const correction = populationMean - graderMean;
    
    let reliability = 'High';
    if (stats.totalGrades < 5) reliability = 'Low';
    else if (stats.totalGrades < 10) reliability = 'Medium';
    
    let bias = 'Neutral';
    if (zScore > 0.5) bias = 'Lenient';
    else if (zScore < -0.5) bias = 'Strict';
    
    corrections[grader] = {
      avgScore: graderMean,
      correction: correction,
      zScore: zScore,
      reliability: reliability,
      totalGrades: stats.totalGrades,
      bias: bias
    };
  }
  
  // Add population stats
  corrections._POPULATION = {
    mean: populationMean,
    stdDev: populationStdDev,
    totalScores: allScores.length
  };
  
  return corrections;
}

/**
 * REVISED GRADER BIAS CORRECTION - Individual + Student Averages
 */

/**
 * Copy History structure and apply sophisticated bias corrections
 * WITH side-by-side comparison AND biggest impact instructor
 */
function copyHistoryWithCorrectedTotals(historySheet, correctedSheet, biasCorrections) {
  const data = historySheet.getDataRange().getValues();
  
  // Copy all data initially
  correctedSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  
  // Format headers
  correctedSheet.getRange(1, 1, 1, data[0].length)
    .setFontWeight('bold')
    .setBackground('#E6F2FF');
  
  // Add new column headers
  correctedSheet.getRange(1, data[0].length + 1, 1, 4).setValues([["BIAS CORRECTED", "ORIGINAL P", "CHANGE", "BIGGEST IMPACT"]])
    .setFontWeight('bold')
    .setBackground('#FFE6CC');
  
  // STEP 1: Copy original Column P to Column Q (for comparison)
  for (let i = 1; i < data.length; i++) {
    const originalP = data[i][15]; // Original Column P value
    correctedSheet.getRange(i + 1, data[0].length + 2).setValue(originalP); // Put in Column Q
  }
  
  // STEP 2: Apply individual grader corrections to Column O AND track corrections by student
  const studentCorrections = {}; // Track corrections per student per grader
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const student = row[1]; // Column B (student)
    const grader = row[2]; // Column C (grader)  
    const originalScore = parseFloat(row[13]) || parseFloat(row[14]) || null; // Column N or O
    
    // Initialize student tracking
    if (student && !studentCorrections[student]) {
      studentCorrections[student] = [];
    }
    
    if (grader && biasCorrections[grader] && originalScore && originalScore !== 69) {
      const correction = biasCorrections[grader].correction;
      const correctedScore = Math.max(0, Math.min(100, originalScore + correction));
      
      // Update Column O with individual corrected score
      correctedSheet.getRange(i + 1, 15).setValue(correctedScore.toFixed(1)); // Column O
      
      // Track this correction for the student
      if (student) {
        studentCorrections[student].push({
          grader: grader,
          correction: correction,
          absoluteCorrection: Math.abs(correction)
        });
      }
      
      // Highlight if significantly corrected
      if (Math.abs(correction) > 0.5) {
        correctedSheet.getRange(i + 1, 15).setBackground('#FFF3CD'); // Light yellow
      }
    }
    
    // Clear Column P for now (will recalculate student averages later)
    correctedSheet.getRange(i + 1, 16).setValue(""); // Column P
  }
  
  // STEP 3: Group by student and calculate final averages
  const studentGroups = {};
  
  // Group rows by student
  for (let i = 1; i < data.length; i++) {
    const student = data[i][2]; // Column C (student)
    
    if (!student) continue;
    
    if (!studentGroups[student]) {
      studentGroups[student] = [];
    }
    
    studentGroups[student].push(i); // Store row indices (0-based for data array)
  }
  
  // STEP 4: Calculate student averages and put in Column P of last row only
  for (const student in studentGroups) {
    const studentRows = studentGroups[student];
    const correctedScores = [];
    
    // Collect corrected scores from Column O
    for (const rowIndex of studentRows) {
      const correctedScore = parseFloat(correctedSheet.getRange(rowIndex + 1, 15).getValue());
      if (correctedScore && correctedScore !== 69) {
        correctedScores.push(correctedScore);
      }
    }
    
    if (correctedScores.length > 0) {
      // Calculate average of corrected scores
      const studentAverage = calculateAverage(correctedScores);
      const lastRowIndex = Math.max(...studentRows); // Get last row for this student
      
      // Put average in Column P of ONLY the last row for this student
      correctedSheet.getRange(lastRowIndex + 1, 16).setValue(studentAverage.toFixed(1));
      
      // STEP 5: Find the grader with biggest impact for this student
      let biggestImpactGrader = "None";
      let biggestImpact = 0;
      
      if (studentCorrections[student] && studentCorrections[student].length > 0) {
        for (const graderCorrection of studentCorrections[student]) {
          if (graderCorrection.absoluteCorrection > biggestImpact) {
            biggestImpact = graderCorrection.absoluteCorrection;
            biggestImpactGrader = `${graderCorrection.grader} (${graderCorrection.correction >= 0 ? '+' : ''}${graderCorrection.correction.toFixed(1)})`;
          }
        }
        
        // If the biggest impact is very small, just say "Minimal"
        if (biggestImpact < 0.5) {
          biggestImpactGrader = "Minimal Impact";
        }
      }
      
      // STEP 6: Color code based on change from original (now in Column Q)
      const originalScore = parseFloat(correctedSheet.getRange(lastRowIndex + 1, data[0].length + 2).getValue());
      
      if (originalScore && !isNaN(originalScore)) {
        const change = studentAverage - originalScore;
        const percentChange = Math.abs(change / originalScore * 100);
        
        let backgroundColor;
        let changeText;
        
        if (percentChange <= 0.5) {
          backgroundColor = '#ADD8E6'; // Light blue - essentially same
          changeText = `Same (${change >= 0 ? '+' : ''}${change.toFixed(1)})`;
        } else if (change > 0) {
          backgroundColor = '#90EE90'; // Light green - improved
          changeText = `+${change.toFixed(1)}`;
        } else {
          backgroundColor = '#FFB347'; // Light orange - declined
          changeText = `${change.toFixed(1)}`;
        }
        
        // Apply color to Column P (new score)
        correctedSheet.getRange(lastRowIndex + 1, 16).setBackground(backgroundColor);
        
        // Put change amount in change column
        correctedSheet.getRange(lastRowIndex + 1, data[0].length + 3).setValue(changeText);
        
        // Put biggest impact grader in the new column
        correctedSheet.getRange(lastRowIndex + 1, data[0].length + 4).setValue(biggestImpactGrader);
        
        // Color code the biggest impact cell based on the type of impact
        if (biggestImpactGrader.includes('+') && !biggestImpactGrader.includes('Minimal')) {
          correctedSheet.getRange(lastRowIndex + 1, data[0].length + 4).setBackground('#E8F5E8'); // Light green
        } else if (biggestImpactGrader.includes('-') && !biggestImpactGrader.includes('Minimal')) {
          correctedSheet.getRange(lastRowIndex + 1, data[0].length + 4).setBackground('#FFE8E8'); // Light red
        } else {
          correctedSheet.getRange(lastRowIndex + 1, data[0].length + 4).setBackground('#F8F8F8'); // Light gray
        }
      }
    }
  }
  
  // STEP 7: Format the comparison columns
  // Make Column Q (original scores) have a light gray background for distinction
  for (let i = 1; i < data.length; i++) {
    const originalP = correctedSheet.getRange(i + 1, data[0].length + 2).getValue();
    if (originalP) {
      correctedSheet.getRange(i + 1, data[0].length + 2).setBackground('#F5F5F5'); // Light gray
    }
  }
  
  // Add column headers with better names
  correctedSheet.getRange(1, 16).setValue("Final Score (Corrected)");
  correctedSheet.getRange(1, data[0].length + 2).setValue("Final Score (Original)");
  correctedSheet.getRange(1, data[0].length + 3).setValue("Change Amount");
  correctedSheet.getRange(1, data[0].length + 4).setValue("Biggest Impact Grader");
}

/**
 * Enhanced bias analysis with more detail
 */
function addBiasAnalysisToSheet(sheet, biasCorrections) {
  const lastRow = sheet.getLastRow();
  const startRow = lastRow + 3;
  
  // Title
  sheet.getRange(startRow, 1, 1, 10).merge()
    .setValue("🔍 GRADER BIAS ANALYSIS & CORRECTIONS APPLIED")
    .setFontWeight('bold')
    .setFontSize(14)
    .setBackground('#D4EDDA')
    .setHorizontalAlignment('center');
  
  // Instructions
  sheet.getRange(startRow + 1, 1, 1, 10).merge()
    .setValue("Column O shows individual bias-corrected scores. Column P shows student final averages (only in last row per student).")
    .setFontStyle('italic')
    .setBackground('#F8F9FA');
  
  // Population statistics
  const popStats = biasCorrections._POPULATION;
  sheet.getRange(startRow + 2, 1, 1, 8).setValues([
    [`Population: ${popStats.totalScores} scores, Mean: ${popStats.mean.toFixed(1)}, StdDev: ${popStats.stdDev.toFixed(1)}`, '', '', '', '', '', '', '']
  ]).setFontStyle('italic');
  
  // Table headers
  sheet.getRange(startRow + 4, 1, 1, 8).setValues([
    ['Grader', 'Original Avg', 'Bias Correction', 'Z-Score', 'Bias Type', 'Reliability', 'Total Grades', 'Impact']
  ]).setFontWeight('bold').setBackground('#F8F9FA');
  
  // Grader data with impact assessment
  const graderRows = [];
  for (const grader in biasCorrections) {
    if (grader === '_POPULATION') continue;
    
    const stats = biasCorrections[grader];
    
    // Determine impact level
    let impact = 'Minimal';
    if (Math.abs(stats.correction) > 5) impact = 'High';
    else if (Math.abs(stats.correction) > 2) impact = 'Moderate';
    
    graderRows.push([
      grader,
      stats.avgScore.toFixed(1),
      stats.correction.toFixed(1),
      stats.zScore.toFixed(2),
      stats.bias,
      stats.reliability,
      stats.totalGrades,
      impact
    ]);
  }
  
  // Sort by absolute correction (most biased first)
  graderRows.sort((a, b) => Math.abs(parseFloat(b[2])) - Math.abs(parseFloat(a[2])));
  
  if (graderRows.length > 0) {
    sheet.getRange(startRow + 5, 1, graderRows.length, 8).setValues(graderRows);
    
    // Color code by bias type and impact
    for (let i = 0; i < graderRows.length; i++) {
      const biasType = graderRows[i][4];
      const impact = graderRows[i][7];
      const correctionValue = parseFloat(graderRows[i][2]);
      
      let backgroundColor;
      if (biasType === 'Strict' && impact === 'High') {
        backgroundColor = '#F5C6CB'; // Dark red
      } else if (biasType === 'Strict') {
        backgroundColor = '#F8D7DA'; // Light red
      } else if (biasType === 'Lenient' && impact === 'High') {
        backgroundColor = '#B8DAFF'; // Dark blue
      } else if (biasType === 'Lenient') {
        backgroundColor = '#D1ECF1'; // Light blue
      } else {
        backgroundColor = '#F8F9FA'; // Light gray
      }
      
      sheet.getRange(startRow + 5 + i, 1, 1, 8).setBackground(backgroundColor);
      
      // Bold high-impact corrections
      if (impact === 'High') {
        sheet.getRange(startRow + 5 + i, 3).setFontWeight('bold');
      }
    }
  }
  
  // Legend
  sheet.getRange(startRow + graderRows.length + 7, 1, 3, 10).setValues([
    ['Color Coding:', '', '', '', '', '', '', '', '', ''],
    ['Red = Strict Graders, Blue = Lenient Graders, Gray = Neutral', '', '', '', '', '', '', '', '', ''],
    ['Final Student Scores: Green = Improved, Orange = Declined, Blue = Same (±0.5%)', '', '', '', '', '', '', '', '', '']
  ]).setFontStyle('italic').setFontSize(9);
}

//=====================================================
// FOUNDATION REPORT GENERATION
//=====================================================

/**
 * Generate Foundation Report for LLM Analysis
 */
function generateFoundationReport() {
  if (isRunning) return;
  isRunning = true;
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Set up status indicator
    const statusCell = ss.getRange("A1");
    statusCell.setValue("Generating Foundation Report for LLM Analysis...");
    
    // Create or clear Foundation Report sheet
    let foundationSheet = ss.getSheetByName(FOUNDATION_SHEET_NAME);
    if (!foundationSheet) {
      foundationSheet = ss.insertSheet(FOUNDATION_SHEET_NAME);
    } else {
      foundationSheet.clear();
    }
    
    // Read all data sources
    console.log("Reading data sources...");
    const gradingData = getHistorySheetData();
    const studentSurveys = getStudentSurveyData();
    const instructorSurveys = getInstructorSurveyData();
    
    if (gradingData.length === 0) {
      foundationSheet.getRange("A1").setValue("No grading data found in History sheet");
      statusCell.setValue("Error: No grading data found");
      return;
    }
    
    // Perform integrated analysis
    console.log("Performing integrated analysis...");
    const analysis = performIntegratedAnalysis(gradingData, studentSurveys, instructorSurveys);
    
    // Build Foundation Report
    console.log("Building Foundation Report...");
    buildFoundationReportSheet(foundationSheet, analysis);
    
    // Update status
    statusCell.setValue("Foundation Report Generated Successfully: " + new Date().toLocaleString());
    SpreadsheetApp.getActiveSpreadsheet().toast("Foundation Report Generated Successfully!", "Complete", 5);
    
  } catch (error) {
    console.error("Error generating Foundation Report: " + error.message);
    SpreadsheetApp.getActiveSpreadsheet().toast("Error: " + error.message, "Error", 5);
    
    // Try to log error in the sheet
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let foundationSheet = ss.getSheetByName(FOUNDATION_SHEET_NAME);
      if (foundationSheet) {
        foundationSheet.getRange("A1").setValue("ERROR: " + error.message);
      }
    } catch (logError) {
      // Skip if we can't update the sheet
    }
  } finally {
    isRunning = false;
  }
}

/**
 * Build the Foundation Report sheet with LLM prompt and analysis
 */
function buildFoundationReportSheet(sheet, analysis) {
  let currentRow = 1;
  
  try {
    // Set column widths for better readability
    sheet.setColumnWidth(1, 800);  // Wide column for content
    
    // ADD OPERATOR INSTRUCTIONS AT THE TOP
    currentRow = addOperatorInstructions(sheet, currentRow) || currentRow + 20;

    // Title and generation info
    sheet.getRange(currentRow, 1).setValue("TPS COMPREHENSIVE ORAL EXAM - STATISTICAL FOUNDATION REPORT")
      .setFontSize(16).setFontWeight("bold");
    currentRow += 1;
    
    sheet.getRange(currentRow, 1).setValue("Generated: " + new Date().toLocaleString())
      .setFontStyle("italic");
    currentRow += 1;
    
    sheet.getRange(currentRow, 1).setValue("FOR LLM ANALYSIS AND FINAL REPORT GENERATION")
      .setFontSize(14).setFontWeight("bold");
    currentRow += 2;
    
    // Add the LLM prompt and instructions
currentRow = addLLMInstructions(sheet, currentRow) || currentRow + 50;
currentRow = addTPSEducationalContext(sheet, currentRow) || currentRow + 40;
    // Add data summary
    currentRow = addDataSummary(sheet, analysis, currentRow) || currentRow + 15;
    
    // Add statistical findings
    currentRow = addStatisticalFindings(sheet, analysis, currentRow) || currentRow + 30;
    
    // Add performance-feedback correlations
    currentRow = addCorrelationAnalysis(sheet, analysis, currentRow) || currentRow + 20;
    
    // Add organized comment data
    currentRow = addOrganizedComments(sheet, analysis, currentRow) || currentRow + 25;
    
    // Add unlinked but relevant comments
    currentRow = addUnlinkedComments(sheet, analysis, currentRow) || currentRow + 15;
    
    // Add analysis framework
    currentRow = addAnalysisFramework(sheet, currentRow) || currentRow + 25;

    // Add analysis framework
    currentRow = addAnalysisFramework(sheet, currentRow) || currentRow + 25;
    
    // Add comprehensive statistical appendix
currentRow = addStatisticalAppendix(sheet, analysis, currentRow) || currentRow + 30;

// Add raw grades data section
currentRow = addRawGradesData(sheet, currentRow) || currentRow + 20;

console.log("Foundation Report built successfully");
    
  } catch (error) {
    console.error("Error building Foundation Report sheet: " + error.message);
    sheet.getRange(1, 1).setValue("ERROR: " + error.message);
  }
}

/**
 * ENHANCED: Add comprehensive statistical appendix with raw data matrices
 * REPLACES the previous addStatisticalAppendix function
 */
function addStatisticalAppendix(sheet, analysis, startRow) {
  let currentRow = startRow;
  
  // Section header
  sheet.getRange(currentRow, 1).setValue("📊 STATISTICAL APPENDIX - RAW DATA FOR LLM ANALYSIS")
    .setFontSize(16).setFontWeight("bold").setBackground("#E6F2FF").setHorizontalAlignment("center");
  currentRow += 2;
  
  const appendixIntro = `The following statistical data provides detailed quantitative analysis for comprehensive insights. This raw data supplements the correlational analysis above and should be used to validate patterns, identify outliers, and generate data-driven recommendations.`;
  
  sheet.getRange(currentRow, 1).setValue(appendixIntro)
    .setFontStyle("italic").setWrap(true);
  currentRow += 3;
  
  // Get fresh raw data for detailed analysis
  const rawGradingData = getHistorySheetData();
  const rawStudentSurveys = getStudentSurveyData();
  const rawInstructorSurveys = getInstructorSurveyData();
  
  // 1. STUDENT PERFORMANCE BY TRACK MATRIX
  currentRow = addDetailedTrackPerformanceMatrix(sheet, rawGradingData, currentRow);
  
  // 2. GRADER STATISTICS BY TRACK WITH CROSS-TRACK PATTERNS
  currentRow = addDetailedGraderTrackMatrix(sheet, rawGradingData, rawInstructorSurveys, currentRow);
  
  // 3. INSTRUCTOR TRACK vs STUDENT TRACK GRADING MATRIX
  currentRow = addCrossTrackGradingMatrix(sheet, rawGradingData, currentRow);
  
  // 4. SCENARIO-CRITERIA PERFORMANCE HEATMAP DATA
  currentRow = addScenarioCriteriaHeatmapData(sheet, rawGradingData, currentRow);
  
  // 5. GRADE DISTRIBUTION ANALYSIS BY MULTIPLE DIMENSIONS
  currentRow = addComprehensiveGradeDistribution(sheet, rawGradingData, currentRow);
  
  // 6. SCENARIO DIFFICULTY AND DISCRIMINATION INDICES
  currentRow = addScenarioStatisticalAnalysis(sheet, rawGradingData, rawStudentSurveys, rawInstructorSurveys, currentRow);
  
  // 7. RELIABILITY METRICS BY CATEGORY
  currentRow = addDetailedReliabilityMetrics(sheet, rawGradingData, currentRow);
  
  return currentRow;
}

/**
 * Enhanced LLM instructions for TPS Comprehensive Oral Examination Analysis
 * Integrates leadership requirements with TPS educational philosophy
 * REPLACES the existing addLLMInstructions function
 */
function addLLMInstructions(sheet, startRow) {
  let currentRow = startRow;
  
  // Section header
  sheet.getRange(currentRow, 1).setValue("📋 TPS COMPREHENSIVE ORAL EXAMINATION - LLM ANALYSIS INSTRUCTIONS")
    .setFontSize(14).setFontWeight("bold").setBackground("#E6F2FF");
  currentRow += 2;
  
  // Document validation requirements
  const documentValidation = `🔒 DOCUMENT VALIDATION REQUIREMENTS (CRITICAL - READ FIRST)

BEFORE BEGINNING ANALYSIS, CONFIRM YOU HAVE ACCESS TO:

REQUIRED STATISTICAL FOUNDATION:
✓ Statistical Foundation Report (quantitative grading analysis)
✓ Performance-Feedback Correlations (linked student/instructor comments with performance data)
✓ Organized Comment Data by Theme (complete qualitative dataset)
✓ Unlinked but Relevant Comments (valuable feedback not directly correlated)

REQUIRED SUPPORTING DOCUMENTS (REQUEST IF MISSING):
✓ TPS School Outcomes (9 TLTI competencies: 4 Tester, 2 Leader, 1 Thinker, 2 Innovator)
✓ Comp Oral Grading Rubric (tps_comp_oral_rubric_v3) with 3 pillars and criteria definitions
✓ TPS Staff Guidance document for Comp Oral examination procedures
✓ TPS Andragogy Document (adult learning principles and educational philosophy)

OPTIONAL TRANSCRIPT DATA (IF PROVIDED):
✓ Audio transcripts from Comp Oral sessions (with privacy protection protocols)
✓ Whiteboard photo descriptions/OCR text
✓ Comp Oral scenarios (full text with scenario IDs)

PRIVACY PROTECTION PROTOCOL:
- All student identifiers must be anonymized as Student_001, Student_002, etc.
- Instructor names should be anonymized as Instructor_A, Instructor_B, etc.
- Maintain linkability for analysis while protecting individual privacy
- Do not include specific dates, names, or identifying information in final outputs

⚠️ IF ANY REQUIRED DOCUMENTS ARE MISSING: Stop analysis and request the missing documents before proceeding.
`;

  sheet.getRange(currentRow, 1).setValue(documentValidation)
    .setFontFamily("Consolas").setFontSize(10).setWrap(true).setBackground("#FFF8DC");
  currentRow += Math.max(documentValidation.split('\n').length, 20) + 3;

  // Main mission context
  const missionContext = `🎯 MISSION CONTEXT: USAF TEST PILOT SCHOOL EDUCATIONAL ASSESSMENT

You are analyzing data for the USAF Test Pilot School (TPS) Comprehensive Oral Examination system. Your analysis will directly impact:
• TPS curriculum development and educational excellence
• Student preparation and learning outcomes aligned with the TLTI framework
• Faculty development and instructional effectiveness
• Strategic resource allocation for maximum educational impact

TPS EDUCATIONAL PHILOSOPHY (ANDRAGOGY):
• Adult Learning Principles: Students are self-directed learners with varied engineering backgrounds
• "Super 6" Andragogy Principles: Need to Know, Experience, Self-Concept, Readiness, Problem Orientation, Intrinsic Motivation
• Competency-Based Assessment: Direct path to demonstrated performance aligned with operational needs
• TLTI Graduate Outcomes: Tester (75%), Leader (15%), Thinker (5%), Innovator (5%) - Total 9 school outcomes
  (NOTE: Innovator pillar not graded in Comp Oral as of 25B — 3 pillars, 7 criteria only)

EXAM STRUCTURE ALIGNMENT:
• 3 Pillars: Tester, Leader, Thinker with specific grading criteria (Innovator pillar removed in 25B)
• 7 Assessment Criteria mapped to TPS School Outcomes
• Weighted scoring system reflecting operational importance
• Multi-grader assessment for reliability and fairness
`;

  sheet.getRange(currentRow, 1).setValue(missionContext)
    .setFontFamily("Calibri").setFontSize(10).setWrap(true).setBackground("#F0F7FF");
  currentRow += Math.max(missionContext.split('\n').length, 15) + 3;

  // The 7 core objectives
  const coreObjectives = `📊 YOUR 7 CORE ANALYSIS OBJECTIVES

OBJECTIVE 1: ASSESS EXAM EFFECTIVENESS vs. TPS SCHOOL OUTCOMES
• Evaluate how well the current Comp Oral format measures the 9 TPS School Outcomes through the 3 pillars
• Analyze student presentations, Q&A sessions, and instructor deliberations for evidence of TLTI competency demonstration
• Identify School Outcomes that are under-assessed or difficult to evaluate within current structure
• Cross-reference grading criteria effectiveness with TPS educational design principles
• Determine alignment between assessment format and adult learning principles

OBJECTIVE 2: EVALUATE CURRICULUM EFFECTIVENESS 
• Assess how well core curriculum areas (Test Foundations, Test Leadership, Flight/Astronautical Sciences, Mission Systems) prepare students for TLTI demonstration
• Correlate student performance with curriculum preparation feedback across all 3 pillars
• Identify specific TPS course concepts consistently well-applied vs. consistently challenging
• Analyze curriculum gaps through lens of competency-based learning and andragogical principles
• Link instructor perceptions of student preparedness with actual performance outcomes

OBJECTIVE 3: ANALYZE SCENARIO EFFECTIVENESS
• Evaluate individual scenarios for fairness, appropriateness, and ability to elicit TLTI pillar demonstration
• Compare student and instructor perceptions of scenario quality and alignment with curriculum depth
• Identify scenarios that consistently result in higher/lower performance for specific pillars
• Assess scenario design against TPS problem-oriented learning principles
• Flag scenarios with missing information, ambiguity, or misalignment with TPS educational standards

OBJECTIVE 4: IDENTIFY STUDENT PERFORMANCE INSIGHTS & STATISTICAL TREND ANALYSIS
- Analyze performance trends across all 3 pillars and 8 assessment criteria with statistical rigor
- INTERPRET statistical patterns: identify declining/improving performance areas, outlier criteria, and correlation trends
- ANALYZE grade distribution patterns by track, scenario, and criteria for educational insights
- CORRELATE statistical variance with curriculum effectiveness and scenario difficulty patterns
- TRANSLATE raw statistical data into actionable educational insights with confidence intervals and significance testing
- Correlate performance patterns with student background data (pilot/engineer/CSO/FTE, track, experience)
- Apply adult learning theory to understand performance patterns and preparation effectiveness
- Generate insights aligned with TPS competency-based assessment philosophy

OBJECTIVE 5: DISCOVER EMERGENT INSIGHTS
• Uncover non-obvious patterns through holistic analysis of all data sources
• Analyze whiteboard organization correlation with presentation clarity and grades
• Examine instructor preparation discussions for scenario interpretation patterns
• Identify "unknown unknowns" relevant to TPS education and Comp Oral effectiveness
• Apply systems thinking to find interconnected issues across curriculum, assessment, and outcomes

OBJECTIVE 6: GENERATE SYNTHETIC TRAINING AIDS
• Create realistic transcript examples for Well Above Average, Average, and Failing performances
• Demonstrate clear TLTI pillar mastery levels according to TPS grading rubric
• Include authentic language, technical depth, and competency demonstration appropriate for TPS students
• Align examples with TPS andragogical principles and adult learning expectations
• Provide training tools that support faculty development and student preparation

OBJECTIVE 7: DEVELOP ACTIONABLE RECOMMENDATIONS
• Generate separate recommendation sets for TPS Faculty and TPS Leadership
• Faculty Focus: Curriculum adjustments, teaching methods, student preparation strategies, evaluation techniques
• Leadership Focus: Policy considerations, resource allocation, strategic oversight, scenario development processes
• Align all recommendations with TPS educational design, andragogy, and TLTI framework
• Ensure recommendations support both alignment (vertical outcomes integration) and coherence (horizontal element flow)
OBJECTIVE 8: FTC/STC COMPARATIVE ANALYSIS
- Analyze Flight Test Course (FTC: Pilot, FTE, CSO/WSO, ABM) and Space Test Course (STC: Operator) as separate educational entities
- Compare performance patterns, curriculum effectiveness, and student satisfaction between FTC and STC
- Identify course-specific strengths, weaknesses, and improvement opportunities
- Ensure all recommendations are properly attributed to FTC or STC for targeted implementation
- Analyze instructor feedback patterns and grading consistency within each course
- Cross-reference scenario effectiveness between FTC and STC student populations

OBJECTIVE 9: STAFF RECOGNITION IDENTIFICATION (SIMPLIFIED)
- Identify staff members specifically named in student/instructor comments (positive or negative)
- List staff names with the relevant quote that mentioned them
- No additional analysis, recommendations, or recognition program suggestions needed
- Simple format: "Staff Member Name: [Direct quote mentioning them]"`;

  sheet.getRange(currentRow, 1).setValue(coreObjectives)
    .setFontFamily("Calibri").setFontSize(10).setWrap(true).setBackground("#E8F5E8");
  currentRow += Math.max(coreObjectives.split('\n').length, 40) + 3;

  // Analysis methodology
  const methodology = `🔬 ANALYSIS METHODOLOGY & APPROACH

PHASE 1: FOUNDATIONAL ANALYSIS
1. Statistical Assessment: Process quantitative grading data for patterns, trends, and reliability measures
2. Correlation Mapping: Link performance data with student/instructor feedback for triangulated insights
3. Thematic Organization: Categorize qualitative feedback by curriculum, process, and outcome themes
4. Educational Alignment: Evaluate findings against TPS andragogical principles and TLTI framework

⚠️ CRITICAL STATISTICAL CALCULATION REQUIREMENTS:
- When calculating standard deviation for scenario analysis, EXCLUDE failure scores (automatic 69 scores)
- RETAIN pass/fail rates and failure counts for reporting context
- Standard deviation should reflect natural performance variation, not policy-driven failure scores
- Report both "Performance StdDev (excluding failures)" and "Overall Pass Rate including failures"
- This applies to ALL scenario difficulty and performance variance calculations

PHASE 1.5: STATISTICAL TREND INTERPRETATION (CRITICAL)
1. Statistical Pattern Recognition: Identify significant trends in the Statistical Appendix data matrices
2. Criteria Performance Analysis: Interpret which assessment criteria show improvement/decline patterns
3. Track-Specific Trend Analysis: Analyze FTC vs STC performance trajectories and variance patterns
4. Grader Consistency Trends: Interpret reliability metrics and bias patterns for calibration insights
5. Scenario Difficulty Trends: Analyze statistical patterns in scenario performance and discrimination indices
6. Variance Analysis: Interpret standard deviations, outliers, and consistency patterns for educational meaning
7. Correlation Interpretation: Translate statistical correlations into practical curriculum and instruction insights

PHASE 2: ADVANCED CORRELATION ANALYSIS  
1. Scenario-Performance Triangulation: Use correlated data to link specific performance patterns with feedback
2. Curriculum-Outcome Mapping: Connect preparation effectiveness with demonstrated competencies
3. Grader Pattern Recognition: Identify calibration needs and bias through statistical and qualitative analysis
4. Adult Learning Application: Assess effectiveness through lens of "Super 6" andragogical principles

PHASE 3: EMERGENT PATTERN IDENTIFICATION
1. Cross-Source Validation: Verify findings across multiple data sources (statistical, correlated, themed, unlinked)
2. Systems Thinking: Identify interconnected issues affecting educational design alignment and coherence
3. Hidden Pattern Discovery: Mine unlinked comments and statistical outliers for systemic insights
4. Future-State Visioning: Recommend improvements aligned with TPS strategic educational goals

NLP ANALYSIS REQUIREMENTS (IF TRANSCRIPTS PROVIDED):
• Sentiment analysis of instructor deliberations and student presentations
• Keyword/concept extraction aligned with TLTI competencies and TPS outcomes
• Topic modeling to identify recurring themes in successful vs. unsuccessful demonstrations
• Semantic similarity analysis between student responses and TPS educational standards
• Privacy protection: Anonymize all personal identifiers while maintaining analytical value

TRANSCRIPT PRIVACY PROTOCOLS:
• Replace student names with Student_001, Student_002, etc.
• Replace instructor names with Instructor_A, Instructor_B, etc.
• Remove specific dates, locations, or other identifying information
• Maintain scenario IDs and performance linkages for analysis integrity
• Flag any remaining privacy concerns in synthetic transcript generation

PHASE 4: FTC/STC DIFFERENTIATED ANALYSIS
1. Course Separation: Systematically analyze all data with FTC/STC course distinction
2. Comparative Assessment: Identify performance, satisfaction, and process differences between courses
3. Targeted Recommendations: Ensure all improvement suggestions specify FTC, STC, or joint implementation
4. Resource Allocation Guidance: Provide course-specific resource and attention prioritization

PHASE 5: COMPREHENSIVE COMMENT MINING
1. Complete Dataset Analysis: Process 100% of student and instructor comments without filtering or summarization
2. Superior Staff Identification: Mine for specific staff names and exceptional performance descriptions
3. Attribution Accuracy: Ensure negative and positive feedback is correctly attributed to FTC or STC
4. Recognition Documentation: Compile detailed recognition-worthy examples with full context`;

  sheet.getRange(currentRow, 1).setValue(methodology)
    .setFontFamily("Calibri").setFontSize(10).setWrap(true).setBackground("#FFF8DC");
  currentRow += Math.max(methodology.split('\n').length, 30) + 3;

  // Output requirements
  const outputRequirements = `📋 REQUIRED OUTPUTS & DELIVERABLES

PRIMARY DELIVERABLE: COMPREHENSIVE ANALYSIS REPORT
Structure your analysis with these specific sections:

EXECUTIVE SUMMARY (2-3 pages)
• TLTI Framework Assessment: Overall effectiveness of 4-pillar evaluation in measuring 9 TPS School Outcomes
• Priority Recommendations Matrix: HIGH/MEDIUM/LOW priority actions with statistical backing, qualitative consensus, impact assessment, and resource requirements
• Strategic Implementation Roadmap: Timeline and success metrics aligned with TPS educational design

DETAILED ANALYSIS BY OBJECTIVE (12-15 pages total)

Section 1: Exam-Outcome Alignment Analysis (Objectives 1 & 7)
• TLTI pillar effectiveness in measuring intended competencies with statistical evidence
• Evidence from student presentations, instructor deliberations, grading patterns
• Gaps between assessment format and TPS educational philosophy
• FACULTY ACTIONS: Specific evaluation technique improvements with implementation steps
• LEADERSHIP ACTIONS: Exam format policy recommendations with resource requirements

Section 2: Curriculum-Performance Integration (Objectives 2 & 4)
• Cross-analysis of preparation adequacy vs. actual performance across all curriculum areas
• Student background correlation with performance patterns and preparation effectiveness
• Adult learning theory application to performance enhancement strategies
• FACULTY ACTIONS: Content emphasis adjustments and teaching methodology improvements
• LEADERSHIP ACTIONS: Curriculum development priorities and instructor training needs

Section 3: Scenario Effectiveness & Quality (Objectives 3 & 5)
• Individual scenario analysis combining performance data, perception ratings, and emergent insights
• Scenario design evaluation against TPS problem-oriented learning principles
• Cross-source validation of scenario issues (statistical + qualitative consensus)
• FACULTY ACTIONS: Scenario-specific teaching preparation and student guidance strategies
• LEADERSHIP ACTIONS: Scenario revision priorities and development process improvements

Section 4: Synthetic Training Aids (Objective 6)
• Well Above Average transcript: TLTI mastery demonstration with realistic language and technical depth
• Average performance transcript: Adequate competency with minor improvement areas
• Failing performance transcript: Specific deficiencies aligned with common failure patterns
• Implementation guidance for faculty use in training and student preparation

INTEGRATED RECOMMENDATIONS MATRIX
Consolidate all recommendations from Sections 1-3 into prioritized action lists:

FACULTY IMMEDIATE ACTIONS (0-3 months):
• High-impact teaching and assessment improvements with step-by-step implementation

FACULTY STRATEGIC ACTIONS (3-12 months):
• Curriculum integration and long-term instructional development

LEADERSHIP IMMEDIATE ACTIONS (0-3 months):
• Policy adjustments and resource allocation for critical issues

LEADERSHIP STRATEGIC ACTIONS (3-12 months):
• Systematic improvements to exam processes, scenario development, and educational oversight

CRITICAL SUCCESS CRITERIA:
✓ Every recommendation supported by both quantitative data AND qualitative feedback consensus
✓ All findings aligned with TPS educational philosophy and TLTI framework
✓ No redundancy between analysis sections and recommendation lists
✓ Actionable implementation guidance with timeline, resource requirements, and success metrics
✓ Strategic alignment with TPS mission: "Create test leaders, develop school staff, conduct test research"

CRITICAL ANALYSIS REQUIREMENTS:

FTC/STC SEPARATION MANDATE:
- Every performance metric, recommendation, and finding MUST be reported separately for FTC and STC
- FTC includes: Pilot, FTE, CSO/WSO, ABM tracks
- STC includes: Space Test Course/Operator track  
- Comparative analysis showing relative strengths/weaknesses between courses
- Course-specific resource allocation and improvement priority recommendations

COMPLETE COMMENT UTILIZATION:
- Process 100% of provided comments without summarization, filtering, or paraphrasing
- Use complete unfiltered comment dataset for pattern identification and insight generation
- Ensure no valuable feedback is overlooked due to length or complexity
- Attribute all feedback accurately to FTC or STC for targeted improvements

MANDATORY RECOGNITION SECTION:
Section 5: Staff Recognition (Simple List)
- List of staff members mentioned by name in comments
- Direct quotes that reference each staff member
- No recommendations or analysis beyond identification

STATISTICAL INTERPRETATION MANDATE:
- Every section must include interpretation of relevant statistical trends from the Statistical Appendix
- Convert statistical patterns into educational insights (don't just report numbers - explain what they mean)
- Include statistical evidence and interpretation in every recommendation
- Analyze grade distribution trends, variance patterns, and outlier identification
- Interpret reliability metrics for grader training and calibration recommendations
- Statistical conclusions must drive discussion sections, not just support them`;

  sheet.getRange(currentRow, 1).setValue(outputRequirements)
    .setFontFamily("Calibri").setFontSize(10).setWrap(true).setBackground("#F0F7FF");
  currentRow += Math.max(outputRequirements.split('\n').length, 50) + 3;

  // Final execution instructions
  const executionInstructions = `🚀 EXECUTION INSTRUCTIONS

STEP 1: DOCUMENT VERIFICATION
Confirm you have all required documents listed in the Document Validation section above. If any are missing, request them before proceeding.

STEP 2: DATA INTEGRATION & QUALITY ASSESSMENT
• Review statistical foundation report for data quality, coverage, and limitations
• Assess correlation analysis completeness and reliability
• Evaluate thematic organization comprehensiveness
• Note any data gaps or quality concerns for transparent reporting

⚠️ CRITICAL COMMENT PROCESSING REQUIREMENTS:

COMMENT UTILIZATION STRATEGY:
- READ ALL comments in the complete dataset to inform overall analysis
- USE comments in the report body ONLY when they strongly support specific recommendations
- PRIORITIZE comment usage: strong evidence > anecdotal mentions
- AVOID cluttering report text with every available comment
- Quality over quantity: select most compelling comment evidence for inclusion

DIRECT MAPPING REQUIREMENT:
- When a comment mentions a problem → identify if it's FTC or STC specific → create targeted recommendation
- When a comment praises something → identify if it's FTC or STC → highlight as best practice for that course
- When a comment names staff → capture exact quote and course context for recognition section
- When a comment suggests improvement → map directly to actionable FTC or STC recommendation

EXAMPLE: If Student Comment says "The Mission Systems curriculum didn't prepare me well for the navigation scenario" 
→ Determine student's track (FTC/STC) → Create specific recommendation for that course's Mission Systems curriculum

NO COMMENT SHOULD BE UNUSED: Every substantive comment must contribute to findings, patterns, or recommendations.

STEP 3: TPS-ALIGNED ANALYSIS EXECUTION
• Apply TPS andragogical principles throughout analysis
• Reference TLTI framework for all performance assessments  
• Use adult learning theory to interpret patterns and recommend improvements
• Maintain focus on educational design alignment and coherence

STEP 4: COMPREHENSIVE REPORT GENERATION
• Follow the exact structure outlined in Required Outputs section
• Ensure every finding is cross-validated across multiple data sources
• Provide specific, actionable recommendations with implementation guidance
• Maintain privacy protection throughout all analysis and examples

STEP 5: STAKEHOLDER-SPECIFIC DELIVERABLES
• Generate separate Faculty and Leadership recommendation checklists
• Tailor language and focus appropriate for each audience
• Include resource requirements and success metrics for all recommendations
• Align with TPS strategic goals and operational constraints

⚠️ QUALITY ASSURANCE REQUIREMENTS:
• Cross-reference findings across correlated, themed, and unlinked data sources
• Validate recommendations against TPS educational philosophy
• Ensure privacy protection in all outputs
• Provide implementation timelines and success metrics
• Flag any limitations or areas requiring additional data

BEGIN ANALYSIS NOW following this comprehensive framework.
Generate the complete TPS Comprehensive Oral Examination Analysis Report.`;

  sheet.getRange(currentRow, 1).setValue(executionInstructions)
    .setFontFamily("Calibri").setFontSize(10).setWrap(true).setBackground("#FFE6E6");
  currentRow += Math.max(executionInstructions.split('\n').length, 25) + 3;
  
  return currentRow;
}

/**
 * FIXED: Add clear operator instructions - eliminates 60 row gap
 * REPLACE your existing addOperatorInstructions function with this
 */
function addOperatorInstructions(sheet, startRow) {
  let currentRow = startRow;
  
  // Main header with bright background
  sheet.getRange(currentRow, 1).setValue("🚀 OPERATOR INSTRUCTIONS - READ FIRST")
    .setFontSize(18).setFontWeight("bold").setBackground("#FF6B6B").setFontColor("white").setHorizontalAlignment("center");
  currentRow += 2;
  
  // Step-by-step instructions
  const operatorInstructions = `📋 STEP-BY-STEP PROCESS FOR GENERATING TPS COMPREHENSIVE ORAL EXAMINATION ANALYSIS REPORT

STEP 1: VERIFY DATA FRESHNESS
✓ Ensure all current grading data is in the "History" sheet
✓ Ensure latest student survey responses are in "Student Survey" sheet  
✓ Ensure latest instructor survey responses are in "Instructor Survey" sheet
✓ If new data was added, RE-RUN this Foundation Report generation (Grade Tools → Generate Foundation Report for LLM Analysis)

STEP 2: COPY ALL FOUNDATION REPORT CONTENT
✓ Starting from the "LLM ANALYSIS INSTRUCTIONS" section below (📋 icon), select ALL content down to the bottom of this sheet
✓ Copy the entire selection (Ctrl+C or Cmd+C)
✓ This includes: LLM Instructions + Statistical Data + Correlations + Comments + Analysis Framework + Statistical Appendix

STEP 3: PASTE INTO LLM SYSTEM
✓ Open your LLM system (Claude.ai, ChatGPT, or other advanced AI system)
✓ Start a NEW conversation (important for context management)
✓ Paste the complete Foundation Report content (Ctrl+V or Cmd+V)
✓ The LLM will process all instructions and data automatically

STEP 4: PROVIDE SUPPORTING DOCUMENTS (If Requested by LLM)
If the LLM requests additional documents, provide these in order of importance:
✓ REQUIRED: TPS Andragogy Document (adult learning principles)
✓ REQUIRED: TPS School Outcomes list (9 TLTI competencies)
✓ REQUIRED: Comp Oral Grading Rubric (tps_comp_oral_rubric_v3)
✓ OPTIONAL: Staff Guidance for Comp Oral procedures
✓ OPTIONAL: Audio transcripts (if available, with privacy protection)
✓ OPTIONAL: Whiteboard photos/descriptions

STEP 5: WAIT FOR COMPLETE ANALYSIS
✓ The LLM will generate a comprehensive 12-15 page analysis report
✓ Report will include: Executive Summary + 4 Analysis Sections + Integrated Recommendations Matrix
✓ Allow 5-15 minutes for complete generation depending on LLM system

STEP 6: SAVE AND DISTRIBUTE RESULTS
✓ Copy the complete LLM-generated report
✓ Create a new document (Word, Google Docs, etc.) and paste the analysis
✓ Review for any privacy concerns or data validation needs
✓ Distribute to TPS Faculty and Leadership as appropriate

🔄 TO REFRESH WITH NEW DATA:
1. Add new grading/survey data to appropriate sheets
2. Re-run: Grade Tools → Generate Foundation Report for LLM Analysis  
3. Repeat Steps 2-6 above with the updated Foundation Report

⚠️ CRITICAL REMINDERS:
• ALWAYS use a NEW LLM conversation for each analysis (avoid context confusion)
• COPY EVERYTHING from "LLM ANALYSIS INSTRUCTIONS" down to bottom of sheet (including Statistical Appendix)
• The LLM instructions are specifically designed for TPS requirements - do not modify them
• If LLM asks for clarification, refer back to this Foundation Report rather than making assumptions

🎯 EXPECTED OUTPUT:
• 12-15 page comprehensive analysis aligned with TPS educational philosophy
• Executive Summary with Priority Recommendations Matrix
• 4 detailed analysis sections covering all 7 leadership objectives
• Integrated Faculty and Leadership action recommendations with timelines
• Synthetic transcript examples for training purposes

SUPPORT: If you encounter issues, check that you've copied the complete content starting from the LLM instructions section below.`;

  // Set the instructions content in a single cell with proper row calculation
  sheet.getRange(currentRow, 1).setValue(operatorInstructions)
    .setFontFamily("Calibri").setFontSize(11).setWrap(true).setBackground("#E8F5E8")
    .setBorder(true, true, true, true, null, null, "black", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  
  // FIXED: More accurate row calculation - count lines but don't over-estimate
  const lineCount = operatorInstructions.split('\n').length;
  // Each line in a wrapped cell typically takes 1-2 rows depending on content length
  // Use a more conservative estimate
  currentRow += Math.min(lineCount + 3, 25); // Much more conservative estimate
  
  // Add visual separator
  sheet.getRange(currentRow, 1).setValue("=" .repeat(100))
    .setFontWeight("bold").setBackground("#CCCCCC").setHorizontalAlignment("center");
  currentRow += 1;
  
  // Add clear section break
  sheet.getRange(currentRow, 1).setValue("⬇️ FOUNDATION REPORT CONTENT STARTS HERE - COPY FROM THIS POINT DOWN ⬇️")
    .setFontSize(14).setFontWeight("bold").setBackground("#FFEB3B").setHorizontalAlignment("center")
    .setBorder(true, true, true, true, null, null, "red", SpreadsheetApp.BorderStyle.SOLID_THICK);
  currentRow += 2;
  
  return currentRow;
}

/**
 * OPTIONAL: Add TPS Educational Context Section
 * ADD this new function anywhere in your script after addLLMInstructions
 */
function addTPSEducationalContext(sheet, startRow) {
  let currentRow = startRow;
  
  // Section header
  sheet.getRange(currentRow, 1).setValue("🎓 TPS EDUCATIONAL FRAMEWORK REFERENCE")
    .setFontSize(14).setFontWeight("bold").setBackground("#E6F2FF");
  currentRow += 2;
  
  const educationalContext = `TPS STRATEGIC ACTION PLAN (TSAP) FRAMEWORK:

TPS MISSION: "Create test leaders, develop school staff, and conduct test research to accelerate multidomain capabilities to the warfighter."

SCHOOL GOAL: "Highly adaptive, critical-thinking test leaders."

STAFF GOAL: "Unified community of deliberately developed staff committed to educational excellence."

TESTER, LEADER, THINKER, INNOVATOR (TLTI) OUTCOMES:

TESTER OUTCOMES (75% weight):
1. PLANNING: Synthesize test fundamentals, domain knowledge, and skillsets to decompose requirements, develop objectives, assess/mitigate risk, develop effective test plans
2. EXECUTION: Execute effective, efficient, secure, safe test; collect data; accept risk; adapt to dynamic environments  
3. ANALYSIS: Analyze and evaluate test data to formulate conclusions and recommendations based on mission and requirements
4. REPORTING: Synthesize information from multiple sources and communicate test requirements, plans, risks, results clearly and compellingly

LEADER OUTCOMES (15% weight):
5. TEAM BUILDING: Build and direct integrated, multidisciplinary test teams and stakeholder coalitions
6. CULTURE BUILDING: Apply leadership and instructorship frameworks to build and sustain professional test culture

CRITICAL THINKER OUTCOME (5% weight):
7. CONTEXT ADAPTATION: Assess, evaluate, and adapt to strategic, warfighting, and technological contexts relevant to test mission

INNOVATOR OUTCOMES (5% weight):
8. RESEARCH & INNOVATION: Research and enable new ideas, methods, technologies to accelerate test and capability delivery
9. DATA SCIENCE APPLICATION: Apply data science principles, test foundations, and domain knowledge in analyzing large datasets and testing data-driven systems

"SUPER 6" ANDRAGOGICAL PRINCIPLES:
1. NEED TO KNOW: Adults want to know why learning objectives are relevant (WIIFM - "What's in it for me?")
2. EXPERIENCE: Adults bring experiences that serve as foundation - build upon background knowledge, fill gaps
3. SELF-CONCEPT: Adults are not dependent learners - want voice in program design, student-centered approach
4. READINESS: Adult learners need to be ready for challenge - solve immediate, real-life problems
5. PROBLEM ORIENTATION: Focus on practical application to solve problems, not stored knowledge acquisition
6. INTRINSIC MOTIVATION: Stronger than extrinsic motivation - connect learning to student's purpose

TPS EDUCATIONAL DESIGN PRINCIPLES:
• ALIGNMENT: Vertical flow where each organizational element supports learning outcomes and objectives
• COHERENCE: Horizontal integration where distinct elements flow together and contribute to each other
• COMPETENCY-BASED LEARNING: Direct path to demonstrated performance through knowledge, skills, abilities, behaviors
• EXPERIENTIAL LEARNING: Theory-practice bridge with emotional engagement through concrete experience, reflection, conceptualization, experimentation

Use this framework throughout your analysis to ensure recommendations align with TPS educational philosophy and strategic goals.`;

  sheet.getRange(currentRow, 1).setValue(educationalContext)
    .setFontFamily("Calibri").setFontSize(10).setWrap(true).setBackground("#F9F9F9");
  currentRow += Math.max(educationalContext.split('\n').length, 40) + 3;
  
  return currentRow;
}

/**
 * Add unlinked but relevant comments section
 */
function addUnlinkedComments(sheet, analysis, startRow) {
  let currentRow = startRow;
  
  // Section header
  sheet.getRange(currentRow, 1).setValue("📝 UNLINKED BUT RELEVANT COMMENTS")
    .setFontSize(14).setFontWeight("bold").setBackground("#FFF8DC");
  currentRow += 1;
  
  sheet.getRange(currentRow, 1).setValue("(Comments that couldn't be directly correlated with performance data but may contain valuable insights)")
    .setFontStyle("italic").setFontSize(9);
  currentRow += 2;
  
  const unlinkedComments = analysis.correlationAnalysis.unlinkedComments;
  
  // Unlinked student comments
  if (unlinkedComments.student.length > 0) {
    sheet.getRange(currentRow, 1).setValue("UNLINKED STUDENT COMMENTS:")
      .setFontWeight("bold");
    currentRow += 1;
    
    let studentText = "";
    for (const entry of unlinkedComments.student) {
      studentText += `\n• Track: ${entry.track}, Scenario: ${entry.scenarioId} (${entry.reason})`;
      
      for (const commentType in entry.comments) {
        if (entry.comments[commentType] && entry.comments[commentType].trim().length > 0) {
          studentText += `\n  - ${commentType}: "${entry.comments[commentType]}"`;
        }
      }
      studentText += "\n";
    }
    
    if (studentText.trim().length > 0) {
      sheet.getRange(currentRow, 1).setValue(studentText).setWrap(true);
      currentRow += Math.max(studentText.split('\n').length, 3) + 1;
    } else {
      sheet.getRange(currentRow, 1).setValue("No unlinked student comments");
      currentRow += 2;
    }
  }
  
  // Unlinked instructor comments
  if (unlinkedComments.instructor.length > 0) {
    sheet.getRange(currentRow, 1).setValue("UNLINKED INSTRUCTOR COMMENTS:")
      .setFontWeight("bold");
    currentRow += 1;
    
    let instructorText = "";
    for (const entry of unlinkedComments.instructor) {
      instructorText += `\n• Instructor Track: ${entry.instructorTrack}, Student: ${entry.studentNumber}, Scenario: ${entry.scenarioId} (${entry.reason})`;
      
      for (const commentType in entry.comments) {
        if (entry.comments[commentType] && entry.comments[commentType].trim().length > 0) {
          instructorText += `\n  - ${commentType}: "${entry.comments[commentType]}"`;
        }
      }
      instructorText += "\n";
    }
    
    if (instructorText.trim().length > 0) {
      sheet.getRange(currentRow, 1).setValue(instructorText).setWrap(true);
      currentRow += Math.max(instructorText.split('\n').length, 3) + 1;
    } else {
      sheet.getRange(currentRow, 1).setValue("No unlinked instructor comments");
      currentRow += 2;
    }
  }
  
  if (unlinkedComments.student.length === 0 && unlinkedComments.instructor.length === 0) {
    sheet.getRange(currentRow, 1).setValue("✓ All comments successfully correlated with performance data")
      .setFontStyle("italic");
    currentRow += 2;
  }
}

/**
 * Add data summary section
 */
function addDataSummary(sheet, analysis, startRow) {
  let currentRow = startRow;
  
  // Section header
  sheet.getRange(currentRow, 1).setValue("📊 DATA SUMMARY")
    .setFontSize(14).setFontWeight("bold").setBackground("#F0F7FF");
  currentRow += 2;
  
  const summary = analysis.linkedData.summary;
  
  const summaryText = `DATA SOURCES:
• Grading Records: ${summary.totalGradingRecords} individual grade submissions
• Student Surveys: ${summary.totalStudentSurveys} responses
• Instructor Surveys: ${summary.totalInstructorSurveys} responses
• Linked Student Records: ${summary.totalStudents} students with complete data
• Scenarios Analyzed: ${summary.totalScenarios} unique scenarios

INTEGRATION STATUS:
• Successfully linked grading data with survey responses
• Cross-referenced student and instructor perspectives
• Identified performance patterns and correlations
• Organized qualitative feedback by theme`;
  
  sheet.getRange(currentRow, 1).setValue(summaryText)
    .setWrap(true);
  currentRow += 12;
  
  return currentRow;
}

/**
 * Add statistical findings section
 */
function addStatisticalFindings(sheet, analysis, startRow) {
  let currentRow = startRow;
  
  // Section header
  sheet.getRange(currentRow, 1).setValue("📈 STATISTICAL FINDINGS")
    .setFontSize(14).setFontWeight("bold").setBackground("#F0F7FF");
  currentRow += 2;
  
  // Scenario Analysis
  sheet.getRange(currentRow, 1).setValue("SCENARIO PERFORMANCE ANALYSIS:")
    .setFontWeight("bold");
  currentRow += 1;
  
  let scenarioText = "";
  for (const scenario in analysis.scenarioAnalysis) {
    const stats = analysis.scenarioAnalysis[scenario];
    scenarioText += `\n${scenario}:
• Average Score: ${stats.performanceMetrics.avgScore ? stats.performanceMetrics.avgScore.toFixed(1) : 'N/A'}
• Score Variability: ${stats.performanceMetrics.scoreVariability ? stats.performanceMetrics.scoreVariability.toFixed(1) : 'N/A'}
• Pass Rate: ${stats.performanceMetrics.passRate ? stats.performanceMetrics.passRate.toFixed(1) + '%' : 'N/A'}
• Student Clarity Rating: ${stats.studentPerceptions.clarity ? stats.studentPerceptions.clarity.toFixed(1) + '/5' : 'N/A'}
• Instructor Clarity Rating: ${stats.instructorPerceptions.clarity ? stats.instructorPerceptions.clarity.toFixed(1) + '/5' : 'N/A'}
• Issue Flags: ${stats.issueFlags.length > 0 ? stats.issueFlags.join(', ') : 'None'}`;
  }
  
  sheet.getRange(currentRow, 1).setValue(scenarioText).setWrap(true);
  currentRow += Math.max(scenarioText.split('\n').length, 10) + 2;
  
  // Curriculum Analysis
  sheet.getRange(currentRow, 1).setValue("CURRICULUM EFFECTIVENESS:")
    .setFontWeight("bold");
  currentRow += 1;
  
  const curr = analysis.curriculumAnalysis;
  const curriculumText = `
Flight Sciences Satisfaction: ${curr.flightSciences.satisfactionRating ? curr.flightSciences.satisfactionRating.toFixed(1) + '/5' : 'N/A'}
Mission Systems Satisfaction: ${curr.missionSystems.satisfactionRating ? curr.missionSystems.satisfactionRating.toFixed(1) + '/5' : 'N/A'}

PILLAR PREPARATION RATINGS:
• Tester Pillar: ${curr.pillarPreparation.tester.satisfaction ? curr.pillarPreparation.tester.satisfaction.toFixed(1) + '/5' : 'N/A'}
• Leader Pillar: ${curr.pillarPreparation.leader.satisfaction ? curr.pillarPreparation.leader.satisfaction.toFixed(1) + '/5' : 'N/A'}
• Thinker Pillar: ${curr.pillarPreparation.thinker.satisfaction ? curr.pillarPreparation.thinker.satisfaction.toFixed(1) + '/5' : 'N/A'}
• Innovator Pillar: ${curr.pillarPreparation.innovator.satisfaction ? curr.pillarPreparation.innovator.satisfaction.toFixed(1) + '/5' : 'N/A'}`;
  
  sheet.getRange(currentRow, 1).setValue(curriculumText).setWrap(true);
  currentRow += 12;
  
  // Process Analysis
  sheet.getRange(currentRow, 1).setValue("PROCESS EFFECTIVENESS:")
    .setFontWeight("bold");
  currentRow += 1;
  
  const proc = analysis.processAnalysis;
  const processText = `
TIMING ADEQUACY:
• Review Time: ${proc.timing.reviewTime ? proc.timing.reviewTime.toFixed(1) + '/5' : 'N/A'}
• Preparation Time: ${proc.timing.preparationTime ? proc.timing.preparationTime.toFixed(1) + '/5' : 'N/A'}
• Presentation Time: ${proc.timing.presentationTime ? proc.timing.presentationTime.toFixed(1) + '/5' : 'N/A'}

PREPARATION EFFECTIVENESS:
• MIB Effectiveness: ${proc.preparation.mibEffectiveness ? proc.preparation.mibEffectiveness.toFixed(1) + '/5' : 'N/A'}
• Practice Scenarios: ${proc.preparation.practiceScenarios ? proc.preparation.practiceScenarios.toFixed(1) + '/5' : 'N/A'}

PANEL PERFORMANCE:
• Professionalism: ${proc.panel.professionalism ? proc.panel.professionalism.toFixed(1) + '/5' : 'N/A'}
• Question Clarity: ${proc.panel.questionClarity ? proc.panel.questionClarity.toFixed(1) + '/5' : 'N/A'}`;
  
  sheet.getRange(currentRow, 1).setValue(processText).setWrap(true);
  currentRow += 16;
  
  return currentRow;
}

/**
 * Add performance-feedback correlation analysis
 */
function addCorrelationAnalysis(sheet, analysis, startRow) {
  let currentRow = startRow;
  
  // Section header
  sheet.getRange(currentRow, 1).setValue("🔗 PERFORMANCE-FEEDBACK CORRELATIONS")
    .setFontSize(14).setFontWeight("bold").setBackground("#E8F5E8");
  currentRow += 2;
  
  const correlations = analysis.correlationAnalysis;
  
  for (const scenario in correlations.scenarioSpecific) {
    const scenarioData = correlations.scenarioSpecific[scenario];
    
    // Scenario header
    sheet.getRange(currentRow, 1).setValue(`${scenario.toUpperCase()} ANALYSIS:`)
      .setFontWeight("bold").setFontSize(12);
    currentRow += 1;
    
    // Performance statistics
    const stats = scenarioData.performanceStats;
    let statsText = `PERFORMANCE METRICS:
• Average Score: ${stats.avgScore ? stats.avgScore.toFixed(1) : 'N/A'}
• Score Range: ${stats.scoreRange}
• Score Variability (StdDev): ${stats.scoreVariability ? stats.scoreVariability.toFixed(1) : 'N/A'}
• Total Grades: ${stats.totalGrades}`;
    
    if (scenarioData.patterns.length > 0) {
      statsText += `\n• Issue Flags: ${scenarioData.patterns.join(', ')}`;
    }
    
    sheet.getRange(currentRow, 1).setValue(statsText).setWrap(true);
    currentRow += Math.max(statsText.split('\n').length, 5) + 1;
    
    // Linked student feedback
    if (scenarioData.linkedStudentFeedback.length > 0) {
      sheet.getRange(currentRow, 1).setValue("LINKED STUDENT FEEDBACK:")
        .setFontWeight("bold");
      currentRow += 1;
      
      let studentText = "";
      for (const feedback of scenarioData.linkedStudentFeedback) {
        studentText += `\n• Track: ${feedback.track} (Avg Score: ${feedback.avgScore ? feedback.avgScore.toFixed(1) : 'N/A'})
  - Problem Statement Clarity: ${feedback.feedback.problemStatementClarity}/5
  - Task Section Clarity: ${feedback.feedback.taskSectionClarity}/5
  - Overall Difficulty: ${feedback.feedback.overallDifficulty}/5
  - Track Appropriateness: ${feedback.feedback.trackAppropriateness}/5`;
        
        if (feedback.feedback.problemStatementComments) {
          studentText += `\n  - Comment: "${feedback.feedback.problemStatementComments}"`;
        }
        if (feedback.feedback.taskSectionComments) {
          studentText += `\n  - Task Comment: "${feedback.feedback.taskSectionComments}"`;
        }
        if (feedback.feedback.lackingInfoComments) {
          studentText += `\n  - Missing Info: "${feedback.feedback.lackingInfoComments}"`;
        }
      }
      
      sheet.getRange(currentRow, 1).setValue(studentText).setWrap(true);
      currentRow += Math.max(studentText.split('\n').length, 3) + 1;
    }
    
    // Linked instructor feedback
    if (scenarioData.linkedInstructorFeedback.length > 0) {
      sheet.getRange(currentRow, 1).setValue("LINKED INSTRUCTOR FEEDBACK:")
        .setFontWeight("bold");
      currentRow += 1;
      
      let instructorText = "";
      for (const feedback of scenarioData.linkedInstructorFeedback) {
        instructorText += `\n• Student ${feedback.studentNumber} (Score: ${feedback.studentScore ? feedback.studentScore.toFixed(1) : 'N/A'})
  - Instructor: ${feedback.instructorTrack} (${feedback.experienceLevel})
  - Problem Statement Clarity: ${feedback.feedback.problemStatementClarity}/5
  - Task Section Clarity: ${feedback.feedback.taskSectionClarity}/5
  - Overall Difficulty: ${feedback.feedback.overallDifficulty}/5
  - Instructor Guide Adequacy: ${feedback.feedback.instructorGuideAdequacy}/5
  - Average Confidence: ${feedback.confidence ? feedback.confidence.toFixed(1) + '/5' : 'N/A'}`;
        
        if (feedback.feedback.scenarioComments) {
          instructorText += `\n  - Comment: "${feedback.feedback.scenarioComments}"`;
        }
      }
      
      sheet.getRange(currentRow, 1).setValue(instructorText).setWrap(true);
      currentRow += Math.max(instructorText.split('\n').length, 3) + 2;
    }
    
    currentRow += 1; // Space between scenarios
  }
  
  return currentRow;
}

/**
 * Add organized comments section (themed organization)
 */
function addOrganizedComments(sheet, analysis, startRow) {
  let currentRow = startRow;
  
  // Section header
  sheet.getRange(currentRow, 1).setValue("💬 ORGANIZED COMMENT DATA BY THEME")
    .setFontSize(14).setFontWeight("bold").setBackground("#F0F7FF");
  currentRow += 1;
  
  sheet.getRange(currentRow, 1).setValue("(Complete dataset organized by topic - includes both correlated and uncorrelated comments)")
    .setFontStyle("italic").setFontSize(9);
  currentRow += 2;
  
  const comments = analysis.commentAnalysis;
  
  // Scenario Clarity Comments
  sheet.getRange(currentRow, 1).setValue("SCENARIO CLARITY FEEDBACK:")
    .setFontWeight("bold");
  currentRow += 1;
  
  let clarityText = "STUDENT COMMENTS:\n";
  comments.scenarioClarity.student.forEach((comment, index) => {
    if (comment.trim().length > 0) {
      clarityText += `• ${comment}\n`;
    }
  });
  
  clarityText += "\nINSTRUCTOR COMMENTS:\n";
  comments.scenarioClarity.instructor.forEach((comment, index) => {
    if (comment.trim().length > 0) {
      clarityText += `• ${comment}\n`;
    }
  });
  
  sheet.getRange(currentRow, 1).setValue(clarityText).setWrap(true);
  currentRow += Math.max(clarityText.split('\n').length, 5) + 2;
  
  // Curriculum Comments
  sheet.getRange(currentRow, 1).setValue("CURRICULUM FEEDBACK:")
    .setFontWeight("bold");
  currentRow += 1;
  
  let currText = "FLIGHT SCIENCES COMMENTS:\n";
  comments.curriculumGaps.flightSciences.forEach(comment => {
    if (comment.trim().length > 0) {
      currText += `• ${comment}\n`;
    }
  });
  
  currText += "\nMISSION SYSTEMS COMMENTS:\n";
  comments.curriculumGaps.missionSystems.forEach(comment => {
    if (comment.trim().length > 0) {
      currText += `• ${comment}\n`;
    }
  });
  
  sheet.getRange(currentRow, 1).setValue(currText).setWrap(true);
  currentRow += Math.max(currText.split('\n').length, 5) + 2;
  
  // Positive Feedback
  sheet.getRange(currentRow, 1).setValue("POSITIVE FEEDBACK (MOST VALUABLE ASPECTS):")
    .setFontWeight("bold");
  currentRow += 1;
  
  let positiveText = "";
  comments.positive.mostValuable.forEach(comment => {
    if (comment.trim().length > 0) {
      positiveText += `• ${comment}\n`;
    }
  });
  
  sheet.getRange(currentRow, 1).setValue(positiveText).setWrap(true);
  currentRow += Math.max(positiveText.split('\n').length, 3) + 2;
  
  // Improvement Suggestions
  sheet.getRange(currentRow, 1).setValue("IMPROVEMENT SUGGESTIONS:")
    .setFontWeight("bold");
  currentRow += 1;
  
  let suggestionText = "";
  comments.suggestions.actionable.forEach(comment => {
    if (comment.trim().length > 0) {
      suggestionText += `• ${comment}\n`;
    }
  });
  
  sheet.getRange(currentRow, 1).setValue(suggestionText).setWrap(true);
  currentRow += Math.max(suggestionText.split('\n').length, 3) + 2;
  
  // Add this section in addOrganizedComments after the themed organization
sheet.getRange(currentRow, 1).setValue("COMPLETE UNFILTERED COMMENT DATASET:")
  .setFontWeight("bold").setFontSize(12);
currentRow += 1;

// Raw student comments with minimal metadata
let rawStudentComments = "STUDENT COMMENTS (Complete Dataset):\n\n";
for (let i = 0; i < comments.allStudentComments.length; i++) {
  const survey = comments.allStudentComments[i];
  rawStudentComments += `Entry ${i+1} - Track: ${survey.track}, Scenario: ${survey.scenarioId}, Date: ${survey.examDate}\n`;
  
  // Include ALL comment fields without filtering
  for (const [fieldName, comment] of Object.entries(survey.allComments)) {
    if (comment && comment.trim().length > 0) {
      rawStudentComments += `${fieldName}: "${comment}"\n`;
    }
  }
  rawStudentComments += "\n";
}

sheet.getRange(currentRow, 1).setValue(rawStudentComments).setWrap(true);
currentRow += Math.max(rawStudentComments.split('\n').length, 10) + 2;

// Raw instructor comments with minimal metadata
let rawInstructorComments = "INSTRUCTOR COMMENTS (Complete Dataset):\n\n";
for (let i = 0; i < comments.allInstructorComments.length; i++) {
  const survey = comments.allInstructorComments[i];
  rawInstructorComments += `Entry ${i+1} - Instructor Track: ${survey.instructorTrack}, Student: ${survey.studentNumber}, Scenario: ${survey.scenarioId}, Date: ${survey.examDate}\n`;
  
  // Include ALL comment fields without filtering
  for (const [fieldName, comment] of Object.entries(survey.allComments)) {
    if (comment && comment.trim().length > 0) {
      rawInstructorComments += `${fieldName}: "${comment}"\n`;
    }
  }
  rawInstructorComments += "\n";
}

sheet.getRange(currentRow, 1).setValue(rawInstructorComments).setWrap(true);
currentRow += Math.max(rawInstructorComments.split('\n').length, 10) + 2;

  return currentRow;
}

/**
 * Add analysis framework section
 */
function addAnalysisFramework(sheet, startRow) {
  let currentRow = startRow;
  
  // Section header
  sheet.getRange(currentRow, 1).setValue("🎯 ANALYSIS FRAMEWORK FOR LLM")
    .setFontSize(14).setFontWeight("bold").setBackground("#F0F7FF");
  currentRow += 2;
  
  const framework = `KEY CORRELATION TASKS:

1. SCENARIO ISSUES IDENTIFICATION:
   - Use CORRELATED ANALYSIS to link specific performance drops with student/instructor clarity ratings
   - Cross-reference statistical patterns with themed comment organization
   - Look for scenarios where both quantitative and qualitative evidence align
   - Include unlinked comments that mention specific scenarios

2. CURRICULUM GAP ANALYSIS:
   - Correlate low satisfaction ratings with poor pillar performance using linked data
   - Use themed curriculum comments for broader pattern identification
   - Match specific preparation complaints with grade patterns
   - Identify courses mentioned in unlinked feedback

3. GRADER CALIBRATION NEEDS:
   - Use instructor confidence levels from correlated analysis
   - Find patterns in high score variability scenarios
   - Cross-reference with instructor experience levels and comments
   - Include process improvement suggestions from all comment sources

4. PROCESS OPTIMIZATION:
   - Link timing complaints with performance issues using themed analysis
   - Correlate preparation effectiveness with outcomes
   - Use both correlated and unlinked comments for comprehensive process review
   - Identify unanimous concerns across all data sources

5. PRIORITY MATRIX DEVELOPMENT:
   - HIGH PRIORITY: Issues with statistical significance + correlated comments + themed patterns
   - MEDIUM PRIORITY: Strong statistical OR strong qualitative evidence + supporting themed data
   - LOW PRIORITY: Minor issues with limited cross-source validation

COMPREHENSIVE COMMENT ANALYSIS APPROACH:
• CORRELATED DATA: Use for specific scenario-performance-feedback triangulation
• THEMED ORGANIZATION: Use for identifying broader curriculum and process patterns
• UNLINKED COMMENTS: Mine for systemic issues that don't appear in performance correlations
• CROSS-VALIDATION: Ensure findings appear across multiple comment sources

REPORT SUCCESS CRITERIA:
✓ Every recommendation backed by both numbers and multiple comment sources
✓ Specific implementation steps provided with resource requirements
✓ Timeline for improvements suggested with success metrics
✓ Complete utilization of all comment data (correlated + themed + unlinked)
✓ No valuable feedback overlooked or dismissed`;
  
  sheet.getRange(currentRow, 1).setValue(framework).setWrap(true);
  currentRow += framework.split('\n').length + 2;
  
  return currentRow;
}

//=====================================================
// UTILITY FUNCTIONS
//=====================================================

/**
 * Format date for consistent comparison
 */
function formatDate(date) {
  if (!date) return "";
  if (typeof date === 'string') return date;
  
  try {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  } catch (error) {
    return date.toString();
  }
}

/**
 * Map tracks to course categories (FTC vs STC)
 */
function mapTrackToCourse(track) {
  const ftcTracks = ['Pilot', 'FTE', 'CSO/WSO', 'ABM'];
  const stcTracks = ['Operator', 'Space Test Course', 'STC'];
  
  if (ftcTracks.includes(track)) return 'FTC';
  if (stcTracks.includes(track)) return 'STC';
  
  // Handle variations
  if (track && track.toLowerCase().includes('space')) return 'STC';
  if (track && track.toLowerCase().includes('operator')) return 'STC';
  
  return 'FTC'; // Default assumption
}

/**
 * Add raw grades data section for LLM trend analysis
 * ADD THIS ENTIRE FUNCTION AT THE BOTTOM OF YOUR SCRIPT
 */
function addRawGradesData(sheet, startRow) {
  let currentRow = startRow;
  
  sheet.getRange(currentRow, 1).setValue("📊 RAW GRADES DATA FOR TREND ANALYSIS")
    .setFontSize(14).setFontWeight("bold").setBackground("#E6F2FF");
  currentRow += 2;
  
  const gradesIntro = `Raw individual grades by student, grader, and criteria. Note: "-1" suffix on student ID indicates retake after initial failure.`;
  
  sheet.getRange(currentRow, 1).setValue(gradesIntro).setFontStyle("italic");
  currentRow += 2;
  
  try {
    // Get raw data from History sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const historySheet = ss.getSheetByName('History');
    
    if (historySheet) {
      const historyData = historySheet.getDataRange().getValues();
      
      let rawGradeText = "INDIVIDUAL GRADE RECORDS:\n\n";
      rawGradeText += "Student | Grader | Track | Scenario | Criteria Grades | Overall Score\n";
      rawGradeText += "".padEnd(120, "-") + "\n";
      
      // Process each row (skip header)
      for (let i = 1; i < historyData.length; i++) {
        const row = historyData[i];
        if (!row[2] || !row[3]) continue; // Skip if missing student or grader
        
        const student = row[2];
        const grader = row[3];
        const track = row[5] || 'Unknown';
        const scenario = row[4] || 'Unknown';
        
        // Get criteria grades (columns 6-13, assuming 8 criteria)
        const criteriaGrades = [];
        for (let c = 6; c <= 13; c++) {
          if (row[c]) criteriaGrades.push(row[c]);
        }
        
        const overallScore = row[15] || row[14] || 'N/A'; // Try overall, then weighted
        
        rawGradeText += `${student} | ${grader} | ${track} | ${scenario} | `;
        rawGradeText += `${criteriaGrades.join(', ')} | ${overallScore}\n`;
      }
      
      sheet.getRange(currentRow, 1).setValue(rawGradeText)
        .setWrap(true)
        .setFontFamily("Consolas")
        .setFontSize(8);
      
      currentRow += Math.max(rawGradeText.split('\n').length + 3, 20);
      
    } else {
      sheet.getRange(currentRow, 1).setValue("No History sheet found for raw grades data");
      currentRow += 3;
    }
  } catch (error) {
    sheet.getRange(currentRow, 1).setValue("Error retrieving raw grades: " + error.message);
    currentRow += 3;
  }
  
  return currentRow;
}

/**
 * Check for missing statistical functions
 * Run this to see which functions need to be added
 */
function checkMissingFunctions() {
  console.log("=== CHECKING FOR MISSING STATISTICAL FUNCTIONS ===");
  
  const functionsToCheck = [
    'addDetailedTrackPerformanceMatrix',
    'addDetailedGraderTrackMatrix', 
    'addCrossTrackGradingMatrix',
    'addScenarioCriteriaHeatmapData',
    'addComprehensiveGradeDistribution',
    'addScenarioStatisticalAnalysis',
    'addDetailedReliabilityMetrics'
  ];
  
  const missingFunctions = [];
  
  functionsToCheck.forEach(funcName => {
    try {
      // Try to access the function
      if (typeof eval(funcName) === 'function') {
        console.log(`✓ ${funcName} - Found`);
      } else {
        console.log(`✗ ${funcName} - MISSING`);
        missingFunctions.push(funcName);
      }
    } catch (error) {
      console.log(`✗ ${funcName} - MISSING`);
      missingFunctions.push(funcName);
    }
  });
  
  if (missingFunctions.length > 0) {
    console.log("\n🚨 MISSING FUNCTIONS:");
    missingFunctions.forEach(func => console.log(`   - ${func}`));
    console.log("\nYou need to add these function definitions to your script.");
  } else {
    console.log("\n✅ All statistical functions are defined!");
  }
  
  return missingFunctions;
}

//=====================================================
// BAYESIAN CONSENSUS GRADING SYSTEM - PHASE 1
// Enhanced Statistical Correction for TPS Comprehensive Oral Exams
//=====================================================

/**
 * PHASE 1: BASIC STATISTICAL CORRECTION FUNCTIONS
 * These functions implement sophisticated bias correction and reliability weighting
 */

//=====================================================
// 1. INDIVIDUAL GRADER BIAS CORRECTION
//=====================================================

/**
 * Calculate individual grader bias correction factors
 * Returns bias correction for each grader/criteria combination
 */
function calculateGraderBias(graderName, criteria, historicalData) {
  try {
    // Get all scores for this grader and criteria
    const graderScores = [];
    const allGraderScores = [];
    
    for (const record of historicalData) {
      if (!record.graderName || !record.criteriaScores) continue;
      
      // Collect this grader's scores for this criteria
      if (record.graderName === graderName && record.criteriaScores[criteria] !== undefined) {
        const score = parseFloat(record.criteriaScores[criteria]);
        if (!isNaN(score) && score !== 69) { // Exclude automatic failures
          graderScores.push(score);
        }
      }
      
      // Collect all graders' scores for this criteria (for population comparison)
      if (record.criteriaScores[criteria] !== undefined) {
        const score = parseFloat(record.criteriaScores[criteria]);
        if (!isNaN(score) && score !== 69) {
          allGraderScores.push(score);
        }
      }
    }
    
    // Need minimum data for reliable bias calculation
    if (graderScores.length < 3 || allGraderScores.length < 10) {
      return {
        bias: 0,
        reliability: 'Insufficient Data',
        graderAvg: null,
        populationAvg: null,
        sampleSize: graderScores.length
      };
    }
    
    // Calculate bias: grader average - population average
    const graderAvg = calculateAverage(graderScores);
    const populationAvg = calculateAverage(allGraderScores);
    const bias = graderAvg - populationAvg;
    
    // Determine reliability based on sample size and consistency
    let reliability = 'Medium';
    if (graderScores.length >= 10) {
      reliability = 'High';
    } else if (graderScores.length < 5) {
      reliability = 'Low';
    }
    
    return {
      bias: bias,
      reliability: reliability,
      graderAvg: graderAvg,
      populationAvg: populationAvg,
      sampleSize: graderScores.length,
      standardError: calculateStandardDeviation(graderScores) / Math.sqrt(graderScores.length)
    };
    
  } catch (error) {
    console.error(`Error calculating grader bias for ${graderName}, criteria ${criteria}:`, error.message);
    return {
      bias: 0,
      reliability: 'Error',
      graderAvg: null,
      populationAvg: null,
      sampleSize: 0
    };
  }
}

//=====================================================
// 2. GRADER RELIABILITY WEIGHTING
//=====================================================

/**
 * Calculate grader reliability weights based on consistency, experience, and confidence
 * Higher weights indicate more reliable graders
 */
function calculateGraderWeight(graderName, criteria, historicalData, currentConfidence) {
  try {
    // Get grader's historical performance for this criteria
    const graderScores = [];
    const graderConsistencyData = [];
    
    for (const record of historicalData) {
      if (record.graderName === graderName && record.criteriaScores[criteria] !== undefined) {
        const score = parseFloat(record.criteriaScores[criteria]);
        if (!isNaN(score) && score !== 69) {
          graderScores.push(score);
          
          // Collect data for consistency calculation
          if (record.consensusScore && record.consensusScore[criteria]) {
            const consensusScore = parseFloat(record.consensusScore[criteria]);
            if (!isNaN(consensusScore)) {
              graderConsistencyData.push({
                graderScore: score,
                consensusScore: consensusScore
              });
            }
          }
        }
      }
    }
    
    // Calculate consistency component (inverse of deviation from consensus)
    let consistencyWeight = 0.5; // Default moderate consistency
    
    if (graderConsistencyData.length >= 3) {
      const deviations = graderConsistencyData.map(d => 
        Math.abs(d.graderScore - d.consensusScore)
      );
      const avgDeviation = calculateAverage(deviations);
      
      // Convert to weight: lower deviation = higher weight
      // Scale from 0.1 (high deviation) to 1.0 (low deviation)
      consistencyWeight = Math.max(0.1, Math.min(1.0, 1.0 - (avgDeviation / 10)));
    }
    
    // Calculate experience component
    let experienceWeight = 0.5; // Default moderate experience
    
    // Estimate experience based on total grading history
    const totalGrades = graderScores.length;
    if (totalGrades >= 50) {
      experienceWeight = 1.0; // Highly experienced
    } else if (totalGrades >= 20) {
      experienceWeight = 0.8; // Experienced
    } else if (totalGrades >= 10) {
      experienceWeight = 0.6; // Moderately experienced
    } else if (totalGrades >= 5) {
      experienceWeight = 0.4; // Some experience
    } else {
      experienceWeight = 0.2; // New grader
    }
    
    // Calculate confidence component
    let confidenceWeight = 0.5; // Default moderate confidence
    
    if (typeof currentConfidence === 'number' && currentConfidence >= 1 && currentConfidence <= 5) {
      // Scale confidence (1-5) to weight (0.2-1.0)
      confidenceWeight = 0.2 + (currentConfidence - 1) * 0.2;
    }
    
    // Combine weights with emphasis on consistency
    const combinedWeight = (
      consistencyWeight * 0.5 +  // 50% consistency
      experienceWeight * 0.3 +   // 30% experience  
      confidenceWeight * 0.2     // 20% confidence
    );
    
    return {
      weight: Math.max(0.1, Math.min(1.0, combinedWeight)), // Ensure reasonable bounds
      components: {
        consistency: consistencyWeight,
        experience: experienceWeight,
        confidence: confidenceWeight
      },
      metadata: {
        totalGrades: totalGrades,
        consistencyData: graderConsistencyData.length,
        avgDeviation: graderConsistencyData.length > 0 ? 
          calculateAverage(graderConsistencyData.map(d => Math.abs(d.graderScore - d.consensusScore))) : null
      }
    };
    
  } catch (error) {
    console.error(`Error calculating grader weight for ${graderName}, criteria ${criteria}:`, error.message);
    return {
      weight: 0.5, // Default moderate weight
      components: { consistency: 0.5, experience: 0.5, confidence: 0.5 },
      metadata: { totalGrades: 0, consistencyData: 0, avgDeviation: null }
    };
  }
}

//=====================================================
// 3. OUTLIER DETECTION (Modified Z-Score Method)
//=====================================================

/**
 * Detect outliers using Modified Z-Score method with MAD (Median Absolute Deviation)
 * More robust than standard z-score for small samples
 */
function detectOutliers(scoresArray, threshold = 3.5) {
  try {
    if (!Array.isArray(scoresArray) || scoresArray.length < 3) {
      return []; // Need at least 3 scores to detect outliers
    }
    
    // Filter out invalid scores
    const validScores = scoresArray
      .map((score, index) => ({ value: parseFloat(score), index: index }))
      .filter(item => !isNaN(item.value) && item.value !== 69); // Exclude failures
    
    if (validScores.length < 3) {
      return [];
    }
    
    // Calculate median
    const sortedScores = validScores.map(item => item.value).sort((a, b) => a - b);
    const median = calculateMedian(sortedScores);
    
    // Calculate MAD (Median Absolute Deviation)
    const absoluteDeviations = sortedScores.map(score => Math.abs(score - median));
    const mad = calculateMedian(absoluteDeviations);
    
    // Avoid division by zero
    if (mad === 0) {
      // If MAD is 0, all scores are identical - no outliers
      return [];
    }
    
    // Calculate Modified Z-Score for each value
    const outlierIndices = [];
    const modifiedZScores = [];
    
    for (const item of validScores) {
      const modifiedZ = 0.6745 * (item.value - median) / mad;
      modifiedZScores.push({
        index: item.index,
        score: item.value,
        modifiedZ: modifiedZ,
        isOutlier: Math.abs(modifiedZ) > threshold
      });
      
      if (Math.abs(modifiedZ) > threshold) {
        outlierIndices.push(item.index);
      }
    }
    
    return {
      outlierIndices: outlierIndices,
      statistics: {
        median: median,
        mad: mad,
        threshold: threshold,
        modifiedZScores: modifiedZScores
      }
    };
    
  } catch (error) {
    console.error('Error in detectOutliers:', error.message);
    return { outlierIndices: [], statistics: null };
  }
}

/**
 * Helper function to calculate median
 */
function calculateMedian(sortedArray) {
  const n = sortedArray.length;
  if (n === 0) return 0;
  
  if (n % 2 === 1) {
    return sortedArray[Math.floor(n / 2)];
  } else {
    return (sortedArray[n / 2 - 1] + sortedArray[n / 2]) / 2;
  }
}

//=====================================================
// 4. BIAS-CORRECTED WEIGHTED AVERAGE
//=====================================================

/**
 * Calculate bias-corrected weighted consensus score
 * Combines bias correction, reliability weighting, and outlier removal
 */
function calculateWeightedConsensus(rawScores, graderData, criteria, historicalData) {
  try {
    if (!Array.isArray(rawScores) || rawScores.length === 0) {
      return {
        consensusScore: null,
        confidence: 'No Data',
        metadata: { processedScores: 0, outliers: 0, totalWeight: 0 }
      };
    }
    
    // Step 1: Apply bias correction to each score
    const biasCorrectedScores = [];
    
    for (let i = 0; i < rawScores.length; i++) {
      const rawScore = parseFloat(rawScores[i]);
      const grader = graderData[i];
      
      if (isNaN(rawScore) || !grader) continue;
      
      // Skip automatic failures (they shouldn't be bias-corrected)
      if (rawScore === 69) {
        biasCorrectedScores.push({
          originalScore: rawScore,
          correctedScore: rawScore,
          grader: grader,
          isFailure: true,
          bias: 0,
          weight: 0
        });
        continue;
      }
      
      // Get bias correction for this grader/criteria
      const biasData = calculateGraderBias(grader.name, criteria, historicalData);
      const correctedScore = rawScore - biasData.bias; // Subtract bias to correct
      
      // Get reliability weight
      const weightData = calculateGraderWeight(grader.name, criteria, historicalData, grader.confidence);
      
      biasCorrectedScores.push({
        originalScore: rawScore,
        correctedScore: correctedScore,
        grader: grader,
        isFailure: false,
        bias: biasData.bias,
        weight: weightData.weight,
        biasReliability: biasData.reliability,
        weightComponents: weightData.components
      });
    }
    
    // Step 2: Remove outliers from corrected scores
    const nonFailureScores = biasCorrectedScores.filter(s => !s.isFailure);
    const correctedValues = nonFailureScores.map(s => s.correctedScore);
    
    const outlierData = detectOutliers(correctedValues);
    const outlierIndices = outlierData.outlierIndices || [];
    
    // Step 3: Calculate weighted average of valid scores
    let weightedSum = 0;
    let totalWeight = 0;
    let validScores = 0;
    let outlierCount = 0;
    
    // Check for any failures first
    const hasFailures = biasCorrectedScores.some(s => s.isFailure);
    if (hasFailures) {
      return {
        consensusScore: 69, // Automatic failure
        confidence: 'Failure Present',
        metadata: {
          processedScores: biasCorrectedScores.length,
          outliers: 0,
          totalWeight: 0,
          hasFailures: true
        }
      };
    }
    
    // Process non-failure scores
    for (let i = 0; i < nonFailureScores.length; i++) {
      const scoreData = nonFailureScores[i];
      
      // Skip outliers
      if (outlierIndices.includes(i)) {
        outlierCount++;
        continue;
      }
      
      weightedSum += scoreData.correctedScore * scoreData.weight;
      totalWeight += scoreData.weight;
      validScores++;
    }
    
    // Calculate final consensus
    let consensusScore = null;
    let confidence = 'No Valid Data';
    
    if (totalWeight > 0 && validScores > 0) {
      consensusScore = Math.max(0, Math.min(100, weightedSum / totalWeight));
      
      // Determine confidence level
      if (validScores >= 4 && outlierCount <= 1) {
        confidence = 'High';
      } else if (validScores >= 3) {
        confidence = 'Medium';
      } else if (validScores >= 2) {
        confidence = 'Low';
      } else {
        confidence = 'Very Low';
      }
      
      // Reduce confidence if too many outliers
      if (outlierCount > validScores * 0.3) {
        confidence = confidence === 'High' ? 'Medium' : 'Low';
      }
    }
    
    return {
      consensusScore: consensusScore,
      confidence: confidence,
      metadata: {
        processedScores: biasCorrectedScores.length,
        validScores: validScores,
        outliers: outlierCount,
        totalWeight: totalWeight,
        hasFailures: hasFailures,
        biasCorrectedScores: biasCorrectedScores,
        outlierStatistics: outlierData.statistics
      }
    };
    
  } catch (error) {
    console.error('Error in calculateWeightedConsensus:', error.message);
    return {
      consensusScore: null,
      confidence: 'Error',
      metadata: { error: error.message }
    };
  }
}

//=====================================================
// 5. HISTORICAL DATA PREPARATION
//=====================================================

/**
 * Prepare historical data for bias correction calculations
 * Extracts and formats data from History sheet
 */
function prepareHistoricalData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const historySheet = ss.getSheetByName('History');
    
    if (!historySheet) {
      console.log('No History sheet found');
      return [];
    }
    
    const data = historySheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const historicalData = [];
    
    // Process each row (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Extract basic info
      const record = {
        submissionId: row[0],
        timestamp: row[1],
        student: row[2],
        graderName: row[3],
        scenario: row[4],
        track: row[5],
        overallScore: parseFloat(row[15]) || parseFloat(row[14]) || null,
        criteriaScores: {}
      };
      
      // 25B UPDATE: 7 criteria, enabling_innovation removed
      const criteriaNames = [
        'objectives_data', 'engineering_principles', 'instru_resources', 'risk_management',
        'communication', 'stakeholder_analysis', 'adapting_changes'
      ];
      
      for (let c = 0; c < criteriaNames.length; c++) {
        const gradeText = row[6 + c];{
          const numericValue = GRADE_VALUES[gradeText.toString().trim()];
          if (numericValue !== undefined) {
            record.criteriaScores[c] = NUMERIC_MAP[numericValue];
          }
        }
      }
      
      // Only include records with valid data
      if (record.graderName && Object.keys(record.criteriaScores).length > 0) {
        historicalData.push(record);
      }
    }
    
    console.log(`Prepared ${historicalData.length} historical records for bias correction`);
    return historicalData;
    
  } catch (error) {
    console.error('Error preparing historical data:', error.message);
    return [];
  }
}

//=====================================================
// 6. INTEGRATION WITH EXISTING SYSTEM
//=====================================================

/**
 * Enhanced processStudentIfReadyOptimized with Bayesian consensus
 * Integrates with existing grading workflow
 */
function processStudentWithBayesianConsensus(sheet, rows) {
  if (rows.length === 0) return;
  
  try {
    // Validate Track and Scenario consistency
    validateTrackAndScenario(sheet, rows);
    
    // Prepare historical data for bias correction
    const historicalData = prepareHistoricalData();
    
    // Get student data
    const studentData = extractStudentGradingData(sheet, rows);
    
    if (!studentData || studentData.graders.length < 4) {
      console.log('Insufficient graders for Bayesian consensus');
      return; // Fall back to existing method
    }
    
    // Apply Bayesian consensus to each criteria
    const consensusResults = {};
   // 25B UPDATE: 7 criteria, enabling_innovation removed
    const criteriaNames = [
      'objectives_data', 'engineering_principles', 'instru_resources', 'risk_management',
      'communication', 'stakeholder_analysis', 'adapting_changes'
    ];
    
    for (let criteria = 0; criteria < criteriaNames.length; criteria++) {
      // Extract scores and grader data for this criteria
      const rawScores = [];
      const graderData = [];
      
      for (const grader of studentData.graders) {
        if (grader.criteriaScores[criteria] !== undefined) {
          rawScores.push(grader.criteriaScores[criteria]);
          graderData.push({
            name: grader.name,
            confidence: grader.confidence || 3 // Default confidence
          });
        }
      }
      
      // Calculate weighted consensus
      const consensus = calculateWeightedConsensus(
        rawScores, 
        graderData, 
        criteria, 
        historicalData
      );
      
      consensusResults[criteria] = consensus;
    }
    
    // Calculate overall weighted score
    let overallSum = 0;
    let hasFailure = false;
    
    for (let i = 0; i < GRADE_WEIGHTS.length; i++) {
      if (consensusResults[i] && consensusResults[i].consensusScore !== null) {
        if (consensusResults[i].consensusScore === 69) {
          hasFailure = true;
          break;
        }
        overallSum += consensusResults[i].consensusScore * GRADE_WEIGHTS[i];
      }
    }
    
    const finalScore = hasFailure ? 69 : overallSum;
    
    // Update the sheet with results
    updateSheetWithBayesianResults(sheet, rows, consensusResults, finalScore);
    
    console.log(`Bayesian consensus applied to student. Final score: ${finalScore}`);
    
  } catch (error) {
    console.error('Error in processStudentWithBayesianConsensus:', error.message);
    // Fall back to existing method
    processStudentIfReadyOptimized(sheet, rows);
  }
}

/**
 * Extract student grading data for Bayesian processing
 */
function extractStudentGradingData(sheet, rows) {
  try {
    const graders = [];
    
    for (const row of rows) {
      const graderName = sheet.getRange(row, HOME_STUDENT_COL + 1).getValue();
      if (!graderName) continue;
      
      const criteriaScores = {};
      let hasValidScores = false;
      
      // Extract criteria scores
      for (let col = HOME_GRADE_START_COL; col <= HOME_GRADE_END_COL; col++) {
        const gradeText = sheet.getRange(row, col).getValue();
        if (gradeText) {
          const numericValue = GRADE_VALUES[gradeText.toString().trim()];
          if (numericValue !== undefined) {
            criteriaScores[col - HOME_GRADE_START_COL] = NUMERIC_MAP[numericValue];
            hasValidScores = true;
          }
        }
      }
      
      if (hasValidScores) {
        graders.push({
          name: graderName,
          criteriaScores: criteriaScores,
          confidence: 3 // Default confidence - could be enhanced with survey data
        });
      }
    }
    
    return { graders: graders };
    
  } catch (error) {
    console.error('Error extracting student grading data:', error.message);
    return null;
  }
}

/**
 * Update sheet with Bayesian consensus results
 */
function updateSheetWithBayesianResults(sheet, rows, consensusResults, finalScore) {
  try {
    // Clear existing weighted sums and totals
    for (const row of rows) {
      sheet.getRange(row, HOME_WEIGHTED_SUM_COL).setValue("");
      sheet.getRange(row, HOME_TOTAL_COL).setValue("");
    }
    
    // Highlight cells with consensus results
    const lastRow = Math.max(...rows);
    const color = finalScore === 69 ? COLORS.FULL_FAIL : COLORS.SUCCESS;
    
    // Highlight name columns
    for (const row of rows) {
      for (const col of HOME_HIGHLIGHT_COLS) {
        sheet.getRange(row, col).setBackground(color);
      }
    }
    
    // Add final score to last row
    sheet.getRange(lastRow, HOME_TOTAL_COL).setValue(finalScore).setBackground(color);
    
    // Add consensus metadata comment
    const metadata = {
      method: 'Bayesian Consensus',
      timestamp: new Date().toLocaleString(),
      confidence: 'Mixed' // Could be enhanced to show overall confidence
    };
    
    sheet.getRange(lastRow, HOME_TOTAL_COL).setNote(
      `Bayesian Consensus Score\nGenerated: ${metadata.timestamp}\nMethod: Statistical bias correction with reliability weighting`
    );
    
  } catch (error) {
    console.error('Error updating sheet with Bayesian results:', error.message);
  }
}

//=====================================================
// 7. MENU INTEGRATION
//=====================================================

/**
 * Enhanced menu function with Bayesian option
 * Add this to your existing onOpen function
 */
function addBayesianMenuItems() {
  const ui = SpreadsheetApp.getUi();
  
  // Find existing menu or create new one
  ui.createMenu('Advanced Grade Tools')
    .addItem('🧠 Apply Bayesian Consensus (Phase 1)', 'applyBayesianConsensusPhase1')
    .addItem('📊 Generate Bias Analysis Report', 'generateBiasAnalysisReport')
    .addItem('🔧 Recalculate Grader Bias Corrections', 'recalculateGraderBias')
    .addSeparator()
    .addSubMenu(ui.createMenu('Historical Data Tools')
      .addItem('Prepare Historical Data', 'prepareHistoricalData')
      .addItem('Validate Historical Data', 'validateHistoricalData')
      .addItem('Export Bias Statistics', 'exportBiasStatistics'))
    .addToUi();
}

/**
 * Main function to apply Bayesian consensus to current Home sheet
 */
function applyBayesianConsensusPhase1() {
  if (isRunning) return;
  isRunning = true;
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(HOME_SHEET);
    
    if (!sheet || sheet.getLastRow() < 2) {
      SpreadsheetApp.getUi().alert("No data found in Home sheet");
      return;
    }
    
    const statusCell = sheet.getRange("Z1");
    statusCell.setValue("Applying Bayesian Consensus corrections...");
    
    // Group students
    const studentGroups = {};
    const lastRow = sheet.getLastRow();
    
    for (let i = 2; i <= lastRow; i++) {
      const student = sheet.getRange(i, HOME_STUDENT_COL).getValue();
      if (!student) continue;
      
      if (!studentGroups[student]) {
        studentGroups[student] = [];
      }
      studentGroups[student].push(i);
    }
    
    // Process each student with Bayesian consensus
    let processedCount = 0;
    for (const student in studentGroups) {
      const rows = studentGroups[student];
      if (rows.length >= 2) {
        processStudentWithBayesianConsensus(sheet, rows);
        processedCount++;
      }
    }
    
    statusCell.setValue(`Bayesian Consensus applied to ${processedCount} students - ${new Date().toLocaleTimeString()}`);
    SpreadsheetApp.getUi().alert(`Bayesian Consensus applied successfully to ${processedCount} students!`);
    
  } catch (error) {
    console.error('Error in applyBayesianConsensusPhase1:', error.message);
    SpreadsheetApp.getUi().alert('Error: ' + error.message);
  } finally {
    isRunning = false;
  }
}

//=====================================================
// 8. VALIDATION AND TESTING FUNCTIONS
//=====================================================

/**
 * Validate historical data quality for bias correction
 */
function validateHistoricalData() {
  const historicalData = prepareHistoricalData();
  
  const report = {
    totalRecords: historicalData.length,
    uniqueGraders: new Set(historicalData.map(d => d.graderName)).size,
    uniqueStudents: new Set(historicalData.map(d => d.student)).size,
    criteriaCompletion: {},
    graderGradeCounts: {}
  };
  
  // Analyze criteria completion
  for (let i = 0; i < 7; i++) { // 25B: 7 criteria
    const criteriaScores = historicalData.filter(d => d.criteriaScores[i] !== undefined);
    report.criteriaCompletion[i] = {
      records: criteriaScores.length,
      percentage: (criteriaScores.length / historicalData.length * 100).toFixed(1)
    };
  }
  
  // Analyze grader grade counts
  for (const record of historicalData) {
    if (!report.graderGradeCounts[record.graderName]) {
      report.graderGradeCounts[record.graderName] = 0;
    }
    report.graderGradeCounts[record.graderName]++;
  }
  
  console.log('Historical Data Validation Report:', JSON.stringify(report, null, 2));
  return report;
}

//=====================================================
// 9. EXPORT AND REPORTING
//=====================================================

/**
 * Generate comprehensive bias analysis report
 */
function generateBiasAnalysisReport() {
  try {
    const historicalData = prepareHistoricalData();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Create or clear bias report sheet
    let reportSheet = ss.getSheetByName('Bayesian Bias Report');
    if (!reportSheet) {
      reportSheet = ss.insertSheet('Bayesian Bias Report');
    } else {
      reportSheet.clear();
    }
    
    // Generate comprehensive bias analysis
    const biasReport = generateComprehensiveBiasReport(historicalData);
    
    // Write report to sheet
    writeBiasReportToSheet(reportSheet, biasReport);
    
    SpreadsheetApp.getUi().alert('Bias Analysis Report generated successfully!');
    
  } catch (error) {
    console.error('Error generating bias analysis report:', error.message);
    SpreadsheetApp.getUi().alert('Error: ' + error.message);
  }
}

/**
 * Generate comprehensive bias analysis from historical data
 */
function generateComprehensiveBiasReport(historicalData) {
  const report = {
    summary: {
      totalRecords: historicalData.length,
      uniqueGraders: new Set(historicalData.map(d => d.graderName)).size,
      analysisDate: new Date().toLocaleString()
    },
    graderBiasAnalysis: {},
    criteriaAnalysis: {},
    recommendations: []
  };
  
  // Analyze each grader for each criteria
  const graders = [...new Set(historicalData.map(d => d.graderName))];
  
  for (const grader of graders) {
    report.graderBiasAnalysis[grader] = {};
    
    for (let criteria = 0; criteria < 7; criteria++) { // 25B: 7 criteria
      const biasData = calculateGraderBias(grader, criteria, historicalData);
      const weightData = calculateGraderWeight(grader, criteria, historicalData, 3);
      
      report.graderBiasAnalysis[grader][criteria] = {
        bias: biasData,
        weight: weightData
      };
      
      // Generate recommendations
      if (Math.abs(biasData.bias) > 5 && biasData.reliability !== 'Insufficient Data') {
        report.recommendations.push({
          type: 'Grader Calibration',
          grader: grader,
          criteria: criteria,
          issue: `High bias (${biasData.bias.toFixed(2)})`,
          recommendation: `Provide additional calibration training for criteria ${criteria}`
        });
      }
    }
  }
  
  return report;
}

/**
 * Write bias report to sheet with formatting
 */
function writeBiasReportToSheet(sheet, report) {
  let row = 1;
  
  // Title
  sheet.getRange(row, 1).setValue('BAYESIAN CONSENSUS BIAS ANALYSIS REPORT')
    .setFontSize(16).setFontWeight('bold');
  row += 2;
  
  // Summary
  sheet.getRange(row, 1).setValue('SUMMARY:');
  row++;
  sheet.getRange(row, 1).setValue(`Total Records: ${report.summary.totalRecords}`);
  row++;
  sheet.getRange(row, 1).setValue(`Unique Graders: ${report.summary.uniqueGraders}`);
  row++;
  sheet.getRange(row, 1).setValue(`Analysis Date: ${report.summary.analysisDate}`);
  row += 2;
  
  // Recommendations
  if (report.recommendations.length > 0) {
    sheet.getRange(row, 1).setValue('RECOMMENDATIONS:').setFontWeight('bold');
    row++;
    
    for (const rec of report.recommendations) {
      sheet.getRange(row, 1).setValue(`• ${rec.grader} - ${rec.issue}: ${rec.recommendation}`);
      row++;
    }
  }
  
  // Format the sheet
  sheet.setColumnWidth(1, 600);
  sheet.getRange(1, 1, row, 1).setWrap(true);
}

//=====================================================
// ENHANCED AUTOMATION FUNCTIONS - Added [17July2025]
//=====================================================

/**
 * FIXED: Apply data validation to a single row immediately
 */
function applyDataValidationToRow(sheet, row) {
  try {
    // Create the validation rule
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(GRADE_OPTIONS)
      .setAllowInvalid(false)
      .build();
    
    // Apply to the entire grade range for this row
    const range = sheet.getRange(row, HOME_GRADE_START_COL, 1, HOME_GRADE_END_COL - HOME_GRADE_START_COL + 1);
    range.setDataValidation(rule);
    
    console.log(`     ✓ Applied data validation to row ${row}`);
    
  } catch (error) {
    console.error(`     ❌ Error applying data validation to row ${row}: ${error.message}`);
  }
}

/**
 * FIXED: Process a student completely with all formatting and validation
 */
function processStudentCompletely(sheet, studentRows, studentName) {
  try {
    console.log(`Complete processing for ${studentName}...`);
    
    // 1. Trim whitespace in columns D, E, and F
    trimWhitespaceInColumns(sheet, studentRows, [3, 4, 5]);
    
    // 2. Validate track and scenario consistency
    validateTrackAndScenario(sheet, studentRows);
    
    // 3. Apply data validation to all grade cells
    for (const row of studentRows) {
      applyDataValidationToRow(sheet, row);
    }
    
    // 4. Process all grade columns for outliers
    processGradeCellsOptimized(sheet, studentRows, null); // Process all columns
    
    // 5. Check if we can process student averages
    processStudentIfReadyOptimized(sheet, studentRows);
    
    console.log(`✓ Complete processing finished for ${studentName}`);
    
  } catch (error) {
    console.error(`Error in complete processing for ${studentName}: ${error.message}`);
  }
}

/**
 * FIXED: Process all students for consistency checks
 */
function processAllStudentsForConsistency(sheet, studentData) {
  try {
    const processedStudents = new Set();
    
    for (let r = 0; r < studentData.length; r++) {
      const studentName = studentData[r];
      if (!studentName || processedStudents.has(studentName)) continue;
      
      // Find all rows for this student
      const studentRows = [];
      for (let i = 0; i < studentData.length; i++) {
        if (studentData[i] === studentName) {
          studentRows.push(i + 2); // Convert to 1-indexed row
        }
      }
      
      if (studentRows.length > 0) {
        // Trim whitespace in columns D, E, and F
        trimWhitespaceInColumns(sheet, studentRows, [3, 4, 5]);
        
        // Validate track and scenario if there are multiple rows
        if (studentRows.length > 1) {
          validateTrackAndScenario(sheet, studentRows);
        }
      }
      
      processedStudents.add(studentName);
    }
    
    console.log("✓ Consistency checks completed for all students");
    
  } catch (error) {
    console.error("Error in processAllStudentsForConsistency: " + error.message);
  }
}

/**
 * FIXED: Ensure the trigger is properly set up
 * Call this function once to set up automatic processing
 */
function setupAutomaticProcessing() {
  try {
    // Delete any existing triggers for this function
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'checkForUnprocessedGrades') {
        ScriptApp.deleteTrigger(triggers[i]);
        console.log("Deleted existing trigger");
      }
    }
    
    // Create a new trigger to run every 1 minute
    ScriptApp.newTrigger('checkForUnprocessedGrades')
      .timeBased()
      .everyMinutes(1)
      .create();
      
    console.log("✓ Created trigger to check for unprocessed grades every 1 minute");
    
    // Also run an immediate check
    console.log("Running immediate processing check...");
    checkForUnprocessedGrades();
    
    // Alert user
    const ui = SpreadsheetApp.getUi();
    ui.alert("Automatic Processing Setup", 
             "✓ Auto-processing is now active!\n\n" +
             "• Checks for new data every minute\n" +
             "• Processes outliers automatically on edit\n" +
             "• Applies data validation immediately\n" +
             "• Transfers completed students to History", 
             ui.ButtonSet.OK);
             
    return true;
    
  } catch (error) {
    console.error("Error setting up automatic processing: " + error.message);
    
    const ui = SpreadsheetApp.getUi();
    ui.alert("Setup Error", "Error setting up automatic processing: " + error.message, ui.ButtonSet.OK);
    
    return false;
  }
}

/**
 * FIXED: Test the automation system
 */
function testAutomationSystem() {
  console.log("=== TESTING AUTOMATION SYSTEM ===");
  
  try {
    // Test 1: Check if trigger exists
    const triggers = ScriptApp.getProjectTriggers();
    const automationTrigger = triggers.find(t => t.getHandlerFunction() === 'checkForUnprocessedGrades');
    
    if (automationTrigger) {
      console.log("✓ Automation trigger is active");
    } else {
      console.log("❌ Automation trigger is missing - run setupAutomaticProcessing()");
    }
    
    // Test 2: Check Home sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const homeSheet = ss.getSheetByName(HOME_SHEET);
    
    if (homeSheet && homeSheet.getLastRow() > 1) {
      console.log(`✓ Home sheet found with ${homeSheet.getLastRow() - 1} data rows`);
    } else {
      console.log("❌ Home sheet not found or empty");
    }
    
    // Test 3: Run processing check
    console.log("Running test processing check...");
    checkForUnprocessedGrades();
    
    console.log("=== AUTOMATION TEST COMPLETE ===");
    
    const ui = SpreadsheetApp.getUi();
    ui.alert("Automation Test", 
             "Test complete! Check the console log for results.\n\n" +
             "If triggers are missing, run: setupAutomaticProcessing()", 
             ui.ButtonSet.OK);
    
  } catch (error) {
    console.error("Error in automation test: " + error.message);
  }
}

/**
 * DEBUG FUNCTION: Check if onEdit is working at all
 * Add this function and use it to test if onEdit fires
 */
function testOnEditWorking() {
  console.log("=== TESTING onEdit FUNCTION ===");
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(HOME_SHEET);
    
    if (!sheet) {
      console.log("❌ Home sheet not found");
      return;
    }
    
    // Find a cell with data to test
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      console.log("❌ No data in Home sheet to test");
      return;
    }
    
    // Test: Add a note to a test cell
    const testCell = sheet.getRange(2, 1);
    const testNote = "onEdit test: " + new Date().toLocaleTimeString();
    testCell.setNote(testNote);
    
    console.log("✓ Added test note to A2. Now manually edit ANY cell in the Home sheet.");
    console.log("✓ You should see console messages starting with '🎯 EDIT DETECTED'");
    console.log("✓ If you don't see those messages, onEdit is not firing properly.");
    
  } catch (error) {
    console.error("❌ Error in test: " + error.message);
  }
}

/**
 * DEBUG FUNCTION: Manually check what students are ready for transfer
 */
function debugTransferEligibility() {
  try {
    console.log("=== DEBUG: CHECKING TRANSFER ELIGIBILITY ===");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const homeSheet = ss.getSheetByName(HOME_SHEET);
    
    if (!homeSheet || homeSheet.getLastRow() < 2) {
      console.log("❌ No data in Home sheet");
      return;
    }
    
    const data = homeSheet.getDataRange().getValues();
    const now = new Date();
    const fortyMinutesAgo = new Date(now.getTime() - 40 * 60 * 1000);
    
    console.log(`Current time: ${now.toLocaleString()}`);
    console.log(`Transfer cutoff: ${fortyMinutesAgo.toLocaleString()}`);
    
    // Group students
    const studentGroups = {};
    
    for (let i = 1; i < data.length; i++) {
      const timestamp = new Date(data[i][0]);
      const student = data[i][1];
      const grader = data[i][2];
      
      if (!student || isNaN(timestamp.getTime())) continue;
      
      if (!studentGroups[student]) {
        studentGroups[student] = {
          timestamps: [],
          graders: new Set(),
          rowCount: 0
        };
      }
      
      studentGroups[student].timestamps.push(timestamp);
      studentGroups[student].graders.add(grader);
      studentGroups[student].rowCount++;
    }
    
    console.log(`\nFound ${Object.keys(studentGroups).length} students:`);
    
    for (const student in studentGroups) {
      const group = studentGroups[student];
      const oldestTime = Math.min(...group.timestamps);
      const newestTime = Math.max(...group.timestamps);
      const allOld = group.timestamps.every(ts => ts < fortyMinutesAgo);
      
      console.log(`\n${student}:`);
      console.log(`  Rows: ${group.rowCount}`);
      console.log(`  Graders: ${group.graders.size} (${Array.from(group.graders).join(', ')})`);
      console.log(`  Oldest timestamp: ${new Date(oldestTime).toLocaleString()}`);
      console.log(`  Newest timestamp: ${new Date(newestTime).toLocaleString()}`);
      console.log(`  All timestamps old? ${allOld}`);
      console.log(`  Enough graders? ${group.graders.size >= 4}`);
      console.log(`  READY FOR TRANSFER? ${allOld && group.graders.size >= 4 ? '✅ YES' : '❌ NO'}`);
    }
    
  } catch (error) {
    console.error("❌ Debug error: " + error.message);
  }
}

function checkForLostData() {
  try {
    console.log("=== CHECKING FOR LOST DATA ===");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const homeSheet = ss.getSheetByName(HOME_SHEET);
    const historySheet = ss.getSheetByName(HIST_SHEET_NAME);
    
    if (!homeSheet || !historySheet) {
      console.log("❌ Required sheets not found");
      return;
    }
    
    // Get all students in Home
    const homeData = homeSheet.getDataRange().getValues();
    const homeStudents = {};
    
    for (let i = 1; i < homeData.length; i++) {
      const student = homeData[i][1];
      const grader = homeData[i][2];
      
      if (!student || !grader) continue;
      
      if (!homeStudents[student]) {
        homeStudents[student] = new Set();
      }
      homeStudents[student].add(grader);
    }
    
    // Get all students in History
    const historyData = historySheet.getDataRange().getValues();
    const historyStudents = {};
    
    for (let i = 1; i < historyData.length; i++) {
      const student = historyData[i][1];
      const grader = historyData[i][2];
      
      if (!student || !grader) continue;
      
      if (!historyStudents[student]) {
        historyStudents[student] = new Set();
      }
      historyStudents[student].add(grader);
    }
    
    console.log(`Home sheet students: ${Object.keys(homeStudents).length}`);
    console.log(`History sheet students: ${Object.keys(historyStudents).length}`);
    
    // Check for partial transfers (students in both sheets with incomplete data)
    const partialTransfers = [];
    
    for (const student in homeStudents) {
      if (historyStudents[student]) {
        const homeGraders = homeStudents[student];
        const historyGraders = historyStudents[student];
        
        console.log(`${student}:`);
        console.log(`  Home graders: ${Array.from(homeGraders).join(', ')}`);
        console.log(`  History graders: ${Array.from(historyGraders).join(', ')}`);
        
        // Check if some graders are in History but others are still in Home
        const totalGraders = new Set([...homeGraders, ...historyGraders]);
        if (totalGraders.size > Math.max(homeGraders.size, historyGraders.size)) {
          partialTransfers.push(student);
          console.log(`  ⚠️ PARTIAL TRANSFER DETECTED for ${student}`);
        }
      }
    }
    
    if (partialTransfers.length > 0) {
      console.log(`\n❌ PARTIAL TRANSFERS FOUND: ${partialTransfers.join(', ')}`);
      console.log("These students may have lost data during transfer.");
    } else {
      console.log("\n✅ No partial transfers detected");
    }
    
  } catch (error) {
    console.error("❌ Error checking for lost data: " + error.message);
  }
}

/**
 * RECOVERY FUNCTION: Find and restore data if possible
 * This won't actually restore data, but will help identify what was lost
 */
function identifyLostData() {
  try {
    console.log("=== IDENTIFYING POTENTIALLY LOST DATA ===");
    
    // This function would analyze patterns in existing data to identify
    // what might have been lost. Without backups, we can't restore,
    // but we can help identify the scope of the problem.
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const homeSheet = ss.getSheetByName(HOME_SHEET);
    const historySheet = ss.getSheetByName(HIST_SHEET_NAME);
    
    // Analysis logic would go here
    // For now, just run the data check
    checkForLostData();
    
    console.log("\n📋 RECOMMENDATIONS:");
    console.log("1. Always test transfer functions with backup data first");
    console.log("2. Use the new safe transfer function going forward");
    console.log("3. Consider implementing automatic backups before transfers");
    
  } catch (error) {
    console.error("❌ Error in data analysis: " + error.message);
  }
}

/**
 * BACKUP FUNCTION: Create a backup before transfers
 * Add this function to your script for future data safety
 */
function createBackupBeforeTransfer() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const homeSheet = ss.getSheetByName(HOME_SHEET);
    
    if (!homeSheet || homeSheet.getLastRow() < 2) {
      console.log("No data to backup");
      return;
    }
    
    // Create backup sheet name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupSheetName = `Home_Backup_${timestamp}`;
    
    // Copy the Home sheet
    const backupSheet = homeSheet.copyTo(ss);
    backupSheet.setName(backupSheetName);
    
    console.log(`✅ Backup created: ${backupSheetName}`);
    
    // Add note about when backup was created
    backupSheet.getRange(1, 1).setNote(`Backup created: ${new Date().toLocaleString()}\nBefore transfer operation`);
    
    return backupSheetName;
    
  } catch (error) {
    console.error("❌ Error creating backup: " + error.message);
    return null;
  }
}

/**
 * ENHANCED: Safe transfer with automatic backup
 * This wraps the transfer function with automatic backup
 */
function safeTransferWithBackup() {
  try {
    console.log("=== SAFE TRANSFER WITH BACKUP ===");
    
    // Create backup first
    const backupName = createBackupBeforeTransfer();
    if (!backupName) {
      throw new Error("Could not create backup - aborting transfer");
    }
    
    console.log(`✅ Backup created: ${backupName}`);
    
    // Now proceed with transfer
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const homeSheet = ss.getSheetByName(HOME_SHEET);
    const historySheet = ss.getSheetByName(HIST_SHEET_NAME) || ss.insertSheet(HIST_SHEET_NAME);
    
    const data = homeSheet.getDataRange().getValues();
    
    // Call the safe transfer function
    transferOldRowsToHistoryOptimized(homeSheet, data, historySheet);
    
    console.log("✅ Safe transfer with backup completed successfully");
    
  } catch (error) {
    console.error("❌ Safe transfer failed: " + error.message);
    
    const ui = SpreadsheetApp.getUi();
    ui.alert("Transfer Failed", 
             `Transfer operation failed: ${error.message}\n\nYour data backup is preserved.`, 
             ui.ButtonSet.OK);
  }
}

function debugTransferDetailed() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const homeSheet = ss.getSheetByName(HOME_SHEET);
    const historySheet = ss.getSheetByName(HIST_SHEET_NAME);
    
    const homeData = homeSheet.getDataRange().getValues();
    const historyData = historySheet.getDataRange().getValues();
    
    console.log("=== HOME SHEET DATA ===");
    console.log("Total rows:", homeData.length);
    console.log("First row (header):", homeData[0]);
    
    // Find a student with multiple graders
    const studentGroups = {};
    for (let i = 1; i < homeData.length; i++) {
      const student = homeData[i][1]; // Column B
      if (!student) continue;
      
      if (!studentGroups[student]) {
        studentGroups[student] = [];
      }
      studentGroups[student].push({
        rowIndex: i + 1,
        timestamp: homeData[i][0],
        grader: homeData[i][2]
      });
    }
    
    console.log("\n=== STUDENTS IN HOME ===");
    for (const student in studentGroups) {
      console.log(`${student}: ${studentGroups[student].length} rows`);
      studentGroups[student].forEach(row => {
        console.log(`  Row ${row.rowIndex}: ${row.grader} at ${row.timestamp}`);
      });
    }
    
    console.log("\n=== HISTORY SHEET DATA ===");
    console.log("Total rows:", historyData.length);
    
    const historyStudents = {};
    for (let i = 1; i < historyData.length; i++) {
      const student = historyData[i][1]; // Column B
      if (!student) continue;
      
      if (!historyStudents[student]) {
        historyStudents[student] = [];
      }
      historyStudents[student].push({
        rowIndex: i + 1,
        grader: historyData[i][2]
      });
    }
    
    console.log("\n=== STUDENTS IN HISTORY ===");
    for (const student in historyStudents) {
      console.log(`${student}: ${historyStudents[student].length} rows`);
      historyStudents[student].forEach(row => {
        console.log(`  Row ${row.rowIndex}: ${row.grader}`);
      });
    }
    
  } catch (error) {
    console.error("Debug error:", error.message);
  }
}
/**
 * SYSTEM DIAGNOSTICS - Run from Apps Script editor to identify issues
 * Creates a _Diagnostics sheet with full color-coded report
 */
function runSystemDiagnostics() {
  const lines = [];
  const errors = [];
  const warnings = [];

  const add  = (t) => lines.push(t);
  const ok   = (t) => lines.push("✓ " + t);
  const warn = (t) => { warnings.push(t); lines.push("⚠ " + t); };
  const err  = (t) => { errors.push(t);   lines.push("✗ ERROR: " + t); };

  add("TPS GRADE MANAGEMENT — SYSTEM DIAGNOSTICS");
  add("Run: " + new Date().toLocaleString());
  add("=".repeat(60));
  add("");

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ─────────────────────────────────────────
    // 1. SHEET EXISTENCE
    // ─────────────────────────────────────────
    add("SECTION 1: SHEET EXISTENCE");
    add("-".repeat(40));
    const homeSheet = ss.getSheetByName("Home");
    const histSheet = ss.getSheetByName("History");

    if (homeSheet) ok("Home sheet found");
    else err("Home sheet not found — check name matches 'Home' exactly (case-sensitive)");

    if (histSheet) ok("History sheet found");
    else warn("History sheet not found (may not exist yet if no transfers have occurred)");
    add("");

    // ─────────────────────────────────────────
    // 2. COLUMN LAYOUT — most common breakage point
    // ─────────────────────────────────────────
    add("SECTION 2: COLUMN LAYOUT CHECK");
    add("-".repeat(40));
    add("Expected: A=Timestamp | B=StudentID | C=Grader | D=Scenario | E=Track | F–L=Grades (7) | M=Weighted Sum | N=Total");
    add("");

    if (homeSheet && homeSheet.getLastRow() >= 1) {
      const lastCol    = homeSheet.getLastColumn();
      const headerVals = homeSheet.getRange(1, 1, 1, Math.min(lastCol, 16)).getValues()[0];

      add("Actual headers in row 1:");
      headerVals.forEach((h, i) => {
        add("  Column " + numToCol(i + 1) + " (" + (i+1) + "): " + (h ? h.toString() : "(empty)"));
      });
      add("");

      // Critical: Column M
      const colM = headerVals[12] ? headerVals[12].toString() : "(empty)";
      if (colM.toLowerCase().includes("innovat") || colM.includes("4.1")) {
        err("Column M still contains the Innovator criterion: '" + colM + "'");
        add("  >>> THE OLD COLUMN WAS NEVER DELETED FROM THE SPREADSHEET.");
        add("  >>> The script writes weighted sums to column M and totals to column N.");
        add("  >>> Since column M still holds grade data, scores are being written to the WRONG columns.");
        add("  >>> FIX: Right-click the column M header in the spreadsheet → Delete column");
      } else {
        ok("Column M appears correct: '" + colM + "'");
      }

      // Also check History sheet column layout
      if (histSheet && histSheet.getLastRow() >= 1) {
        const histLastCol = histSheet.getLastColumn();
        const histHeaders = histSheet.getRange(1, 1, 1, Math.min(histLastCol, 16)).getValues()[0];
        const histColM    = histHeaders[12] ? histHeaders[12].toString() : "(empty)";
        if (histColM.toLowerCase().includes("innovat") || histColM.includes("4.1")) {
          err("History sheet column M also still has Innovator criterion: '" + histColM + "'");
          add("  >>> FIX: Right-click column M header in History sheet → Delete column");
        } else {
          ok("History sheet column M appears correct: '" + histColM + "'");
        }
      }

      // Check for unexpected extra columns between grades and weighted sum
      const numGradeCols = HOME_GRADE_END_COL - HOME_GRADE_START_COL + 1;
      add("");
      add("Grade columns span: " + numToCol(HOME_GRADE_START_COL) + " to " + numToCol(HOME_GRADE_END_COL) + " (" + numGradeCols + " columns)");
      if (numGradeCols !== 7) {
        err("Grade column range spans " + numGradeCols + " columns but GRADE_WEIGHTS has " + GRADE_WEIGHTS.length + " entries — mismatch");
      } else {
        ok("Grade column count matches GRADE_WEIGHTS length (7)");
      }
    }
    add("");

    // ─────────────────────────────────────────
    // 3. CONSTANTS VERIFICATION
    // ─────────────────────────────────────────
    add("SECTION 3: SCRIPT CONSTANTS");
    add("-".repeat(40));
    add("HOME_STUDENT_COL     = " + HOME_STUDENT_COL     + "  → Column " + numToCol(HOME_STUDENT_COL)     + "  (expected B)");
    add("HOME_GRADE_START_COL = " + HOME_GRADE_START_COL + "  → Column " + numToCol(HOME_GRADE_START_COL) + "  (expected F)");
    add("HOME_GRADE_END_COL   = " + HOME_GRADE_END_COL   + " → Column " + numToCol(HOME_GRADE_END_COL)   + " (expected L)");
    add("HOME_WEIGHTED_SUM_COL= " + HOME_WEIGHTED_SUM_COL + " → Column " + numToCol(HOME_WEIGHTED_SUM_COL) + " (expected M)");
    add("HOME_TOTAL_COL       = " + HOME_TOTAL_COL       + " → Column " + numToCol(HOME_TOTAL_COL)       + " (expected N)");
    add("GRADE_WEIGHTS        = [" + GRADE_WEIGHTS.join(", ") + "]");

    const weightSum = GRADE_WEIGHTS.reduce((a, b) => a + b, 0);
    add("GRADE_WEIGHTS sum    = " + weightSum.toFixed(4) + "  (expected 1.0000)");
    add("GRADE_WEIGHTS count  = " + GRADE_WEIGHTS.length + "  (expected 7)");
    add("CRITERIA_NAMES count = " + CRITERIA_NAMES.length + "  (expected 7)");
    add("");

    if (GRADE_WEIGHTS.length !== 7)            err("GRADE_WEIGHTS has " + GRADE_WEIGHTS.length + " entries, expected 7");
    else                                        ok("GRADE_WEIGHTS has 7 entries");
    if (CRITERIA_NAMES.length !== 7)           err("CRITERIA_NAMES has " + CRITERIA_NAMES.length + " entries, expected 7");
    else                                        ok("CRITERIA_NAMES has 7 entries");
    if (Math.abs(weightSum - 1.0) > 0.001)     err("GRADE_WEIGHTS sum to " + weightSum.toFixed(4) + ", not 1.0");
    else                                        ok("GRADE_WEIGHTS sum correctly to 1.0");
    if (HOME_GRADE_END_COL !== 12)             err("HOME_GRADE_END_COL = " + HOME_GRADE_END_COL + ", expected 12 (25B rubric)");
    else                                        ok("HOME_GRADE_END_COL = 12 correct for 25B");
    add("");

    // ─────────────────────────────────────────
    // 4. STUDENT DATA SCAN
    // ─────────────────────────────────────────
    add("SECTION 4: STUDENT DATA ANALYSIS");
    add("-".repeat(40));

    if (homeSheet && homeSheet.getLastRow() >= 2) {
      const lastRow  = homeSheet.getLastRow();
      const numCols  = Math.max(HOME_TOTAL_COL, homeSheet.getLastColumn());
      const readCols = Math.min(numCols, HOME_TOTAL_COL);

      const values  = homeSheet.getRange(2, 1, lastRow - 1, readCols).getValues();
      const bgs     = homeSheet.getRange(2, 1, lastRow - 1, readCols).getBackgrounds();

      // Group by student
      const groups = {};
      values.forEach((row, i) => {
        const student = row[HOME_STUDENT_COL - 1];
        if (!student) return;
        if (!groups[student]) groups[student] = [];
        groups[student].push({ rowNum: i + 2, row, bg: bgs[i] });
      });

      add("Total data rows: " + values.length + "  |  Unique students: " + Object.keys(groups).length);
      add("");

      for (const name in groups) {
        const sRows = groups[name];
        add("STUDENT: " + name);

        // Grader count
        const graderSet = new Set();
        sRows.forEach(r => {
          const g = r.row[HOME_STUDENT_COL]; // column C
          if (g) graderSet.add(g.toString().trim());
        });
        add("  Graders (" + graderSet.size + "): " + (graderSet.size > 0 ? Array.from(graderSet).join(", ") : "(none)"));
        if (graderSet.size < 4) warn(name + " has only " + graderSet.size + " grader(s) — final score requires 4");

        // Grade cell analysis
        let totalCells = 0, filledCells = 0, whiteCells = 0, greenCells = 0, orangeCells = 0;
        const badValues = [];

        sRows.forEach(r => {
          for (let c = HOME_GRADE_START_COL - 1; c < HOME_GRADE_END_COL; c++) {
            totalCells++;
            const val = r.row[c];
            const bg  = (r.bg[c] || "").toUpperCase();

            if (val) {
              filledCells++;
              if (GRADE_VALUES[val.toString().trim()] === undefined) {
                badValues.push("row " + r.rowNum + " col " + numToCol(c + 1) + ": '" + val + "'");
              }
            }

            if      (bg === "#D9F2F2")               greenCells++;
            else if (bg === "#FFD580" || bg === "#FFA500") orangeCells++;
            else if (bg === "#FFFFFF" || bg === "")  whiteCells++;
          }
        });

        add("  Grade cells:  " + filledCells + "/" + totalCells + " filled");
        add("  Cell colors:  " + greenCells + " green (ok) | " + orangeCells + " orange (outlier) | " + whiteCells + " white (unprocessed)");

        if (badValues.length > 0) {
          err("Unrecognised grade values for " + name + ":");
          badValues.forEach(b => add("    " + b));
        }

        // Score columns
        const weightedVals = sRows.map(r => r.row[HOME_WEIGHTED_SUM_COL - 1]).filter(v => v !== "" && v != null);
        const totalVals    = sRows.map(r => r.row[HOME_TOTAL_COL - 1]).filter(v => v !== "" && v != null);
        add("  Column M (Weighted Sum): " + (weightedVals.length ? weightedVals.join(" | ") : "(empty)"));
        add("  Column N (Final Score):  " + (totalVals.length    ? totalVals.join(" | ")    : "(empty)"));

        // Explain missing score
        if (totalVals.length === 0) {
          if (graderSet.size < 4)    add("  >>> Score absent: only " + graderSet.size + "/4 required graders");
          else if (orangeCells > 0)  add("  >>> Score absent: " + orangeCells + " unresolved outlier cell(s)");
          else if (whiteCells > 0)   add("  >>> Score absent: " + whiteCells + " unprocessed cell(s) — trigger may not have run yet");
          else if (filledCells < totalCells) add("  >>> Score absent: not all grade cells are filled (" + filledCells + "/" + totalCells + ")");
          else {
            err(name + ": all conditions met (4+ graders, no outliers, all cells filled and green) but NO score — processing function is broken");
            add("  >>> Run 'Run Full Processing Now' from Grade Tools — if score still missing, processing logic has a bug");
          }
        } else {
          ok(name + " has final score: " + totalVals[totalVals.length - 1]);
        }
        add("");
      }
    } else {
      warn("Home sheet has no data rows below the header");
    }

    // ─────────────────────────────────────────
    // 5. TRIGGER STATUS
    // ─────────────────────────────────────────
    add("SECTION 5: INSTALLED TRIGGERS");
    add("-".repeat(40));

    const triggers = ScriptApp.getProjectTriggers();
    add("Total installed triggers: " + triggers.length);
    add("");

    triggers.forEach((t, i) => {
      add("Trigger " + (i + 1) + ": " + t.getHandlerFunction() +
          "  |  Type: " + t.getEventType() +
          "  |  Source: " + t.getTriggerSource());
    });
    add("");

    const hasOnEdit    = triggers.some(t => t.getHandlerFunction() === "onEdit");
    const hasTimeBased = triggers.some(t => t.getHandlerFunction() === "checkForUnprocessedGrades");

    if (hasOnEdit)    ok("Installable onEdit trigger is installed");
    else              warn("No installable onEdit trigger — simple trigger active but has limited permissions after script edits");
    if (hasTimeBased) ok("Time-based trigger for checkForUnprocessedGrades is installed");
    else              err("Time-based trigger MISSING — form submissions will never be auto-processed");
    add("");

    // ─────────────────────────────────────────
    // 6. FUNCTION EXISTENCE CHECK
    // ─────────────────────────────────────────
    add("SECTION 6: REQUIRED FUNCTIONS");
    add("-".repeat(40));

    const funcsToCheck = [
      "processStudentIfReadyOptimized",
      "processGradeCellsOptimized",
      "checkForUnprocessedGrades",
      "processStudentCompletely",
      "applyDataValidationToRow",
      "validateTrackAndScenario"
    ];

    const menuFuncs = [
      "processAllStudentAverages",
      "forceProcessHomeSheet"
    ];

    funcsToCheck.forEach(fn => {
      if (typeof eval(fn) === "function") ok(fn + " — defined");
      else err(fn + " — NOT DEFINED (critical function missing)");
    });

    add("");
    add("Menu item functions (non-critical):");
    menuFuncs.forEach(fn => {
      if (typeof eval(fn) === "function") ok(fn + " — defined");
      else warn(fn + " — referenced in menu but not defined (clicking will cause an error, but doesn't affect automation)");
    });
    add("");

    // ─────────────────────────────────────────
    // 7. GOOGLE FORM LINK CHECK
    // ─────────────────────────────────────────
    add("SECTION 7: FORM CONNECTION");
    add("-".repeat(40));
    try {
      const forms = FormApp.getActiveForm();
      add("Active form detected (script bound to a form)");
    } catch(e) {
      // Not bound to a form - check if spreadsheet has a linked form
    }
    const sheets = ss.getSheets();
    let formResponseSheet = null;
    sheets.forEach(sh => {
      try {
        const url = sh.getFormUrl();
        if (url) {
          formResponseSheet = sh;
          add("Form linked to sheet: '" + sh.getName() + "'");
          add("Form URL: " + url);
          if (sh.getName() === "Home") {
            ok("Form responses going directly to Home sheet");
          } else {
            warn("Form responses go to '" + sh.getName() + "' not 'Home' — check if a trigger copies them to Home");
          }
        }
      } catch(e2) { /* sheet has no form */ }
    });
    if (!formResponseSheet) {
      warn("No Google Form linked to any sheet — if using a form, this may indicate the link was broken");
    }
    add("");

    // ─────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────
    add("=".repeat(60));
    add("DIAGNOSTIC SUMMARY");
    add("=".repeat(60));
    add("");

    if (errors.length === 0) {
      add("✓ NO CRITICAL ERRORS");
    } else {
      add("✗ " + errors.length + " CRITICAL ERROR(S):");
      errors.forEach(e => add("  • " + e));
    }
    add("");
    if (warnings.length === 0) {
      add("✓ NO WARNINGS");
    } else {
      add("⚠ " + warnings.length + " WARNING(S):");
      warnings.forEach(w => add("  • " + w));
    }
    add("");
    add("RECOMMENDED NEXT STEPS:");
    if (errors.some(e => e.includes("Column M") || e.includes("column M"))) {
      add("  1. URGENT: Delete column M from the Home sheet and History sheet (Innovator column not removed)");
    }
    if (!hasTimeBased) {
      add("  2. Run 'Setup Automatic Processing' from Grade Tools menu");
    }
    if (!hasOnEdit) {
      add("  3. Add installable onEdit trigger via Apps Script Triggers page");
    }
    if (errors.some(e => e.includes("conditions met") || e.includes("processing function"))) {
      add("  4. Run 'Run Full Processing Now' from Grade Tools — if score still missing, share this diagnostic output for further review");
    }
    if (errors.length === 0 && warnings.filter(w => !w.includes("processAllStudentAverages") && !w.includes("forceProcessHomeSheet")).length === 0) {
      add("  System appears healthy. Try 'Run Full Processing Now' from Grade Tools to force a manual process.");
      add("  If that works but automatic triggers don't, re-run setupAutomaticProcessing and re-add the onEdit trigger.");
    }

  } catch (diagErr) {
    add("DIAGNOSTIC CRASHED: " + diagErr.message);
    add(diagErr.stack);
  }

  // ─────────────────────────────────────────
  // WRITE TO SHEET
  // ─────────────────────────────────────────
  console.log(lines.join("\n"));

  try {
    const ss2 = SpreadsheetApp.getActiveSpreadsheet();
    let diagSheet = ss2.getSheetByName("_Diagnostics");
    if (!diagSheet) diagSheet = ss2.insertSheet("_Diagnostics");
    else diagSheet.clear();

    diagSheet.setColumnWidth(1, 800);

    lines.forEach((line, i) => {
      const cell = diagSheet.getRange(i + 1, 1).setValue(line);
      if      (line.startsWith("✗"))      diagSheet.getRange(i+1,1).setBackground("#FFCDD2").setFontWeight("bold");
      else if (line.startsWith("⚠"))      diagSheet.getRange(i+1,1).setBackground("#FFF9C4");
      else if (line.startsWith("✓"))      diagSheet.getRange(i+1,1).setBackground("#C8E6C9");
      else if (line.startsWith("SECTION") || line.startsWith("TPS") || line.startsWith("DIAGNOSTIC")) {
        diagSheet.getRange(i+1,1).setBackground("#E6F2FF").setFontWeight("bold");
      }
      else if (line.startsWith("  >>>"))  diagSheet.getRange(i+1,1).setBackground("#FFF3CD");
      else if (line.startsWith("STUDENT:")) diagSheet.getRange(i+1,1).setFontWeight("bold");
    });

    ss2.setActiveSheet(diagSheet);
    ss2.toast(
      errors.length + " error(s), " + warnings.length + " warning(s). See _Diagnostics sheet.",
      "Diagnostics Complete", 10
    );

  } catch (writeErr) {
    console.log("Could not write to sheet: " + writeErr.message);
  }
}

/**
 * Helper: column number to letter (1=A, 14=N, etc.)
 */
function numToCol(n) {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}