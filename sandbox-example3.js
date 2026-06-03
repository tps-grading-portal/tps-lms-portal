/**
 * B-25 Mission Presentation Grading System - Google Apps Script
 * 
 * This script handles:
 * 1. Automatic transfer of grades to topic-specific tabs after 3 minutes
 * 2. Grade calculation based on weighted categories
 * 3. Data validation dropdowns for grade entries
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  MAIN_SHEET_NAME: 'Form Responses 2', // Change this to your main input sheet name
  TIMESTAMP_COL: 1, // Column A
  TOPIC_COL: 2, // Column B (Presentation Topic - acts as group name)
  FIRST_GRADE_COL: 3, // Column C (first grading column)
  LAST_GRADE_COL: 7, // Column G (last grading column)
  COMMENTS_COL: 8, // Column H
  CALCULATED_GRADE_COL: 9, // Column I (where calculated grade goes)
  TRANSFER_DELAY_MINUTES: 3,
  
  // Grade mapping: score -> percentage
  GRADE_PERCENTAGES: {
    1: 100,
    2: 95,
    3: 90,
    4: 85,
    5: 80,
    6: 75,
    7: 70,
    8: 69
  },
  
  // Column weights (in order from column C to G)
  // Eval Scenario (10%), BLUF (10%), Test Item (10%), Results/Analysis (60%), Overall Conclusion (10%)
  WEIGHTS: [10, 10, 10, 60, 10],
  
  // Grade labels for dropdowns
  GRADE_LABELS: [
    '1 - Well Above Average',
    '2 - Above Average',
    '3 - Slightly Above Average',
    '4 - Average',
    '5 - Slightly Below Average',
    '6 - Below Average',
    '7 - Well Below Average',
    '8 - Fail'
  ]
};

// ============================================================================
// MENU FUNCTIONS
// ============================================================================

/**
 * Creates custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📊 Grading System')
    .addItem('🔄 Process Grades Now', 'manualProcessGrades')
    .addItem('✅ Setup Data Validation', 'setupDataValidation')
    .addItem('⚙️ Install Triggers', 'installTriggers')
    .addItem('🗑️ Remove Triggers', 'removeTriggers')
    .addToUi();
}

/**
 * Manual trigger to process grades immediately
 */
function manualProcessGrades() {
  processGrades();
  SpreadsheetApp.getUi().alert('✅ Grade processing complete!');
}

// ============================================================================
// MAIN PROCESSING FUNCTIONS
// ============================================================================

/**
 * Main function to process grades - called by triggers
 */
function processGrades() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mainSheet = ss.getSheetByName(CONFIG.MAIN_SHEET_NAME);
  
  if (!mainSheet) {
    Logger.log('Main sheet not found: ' + CONFIG.MAIN_SHEET_NAME);
    return;
  }
  
  const dataRange = mainSheet.getDataRange();
  const values = dataRange.getValues();
  
  // Skip header row, process from bottom to top
  for (let i = values.length - 1; i > 0; i--) {
    const row = values[i];
    const timestamp = row[CONFIG.TIMESTAMP_COL - 1];
    const topicName = row[CONFIG.TOPIC_COL - 1];
    
    // Skip if no timestamp or no topic name
    if (!timestamp || !topicName) continue;
    
    // Check if timestamp is more than 3 minutes old
    if (isOlderThan(timestamp, CONFIG.TRANSFER_DELAY_MINUTES)) {
      // Calculate grade if not already calculated
      if (!row[CONFIG.CALCULATED_GRADE_COL - 1]) {
        const calculatedGrade = calculateGrade(row);
        mainSheet.getRange(i + 1, CONFIG.CALCULATED_GRADE_COL).setValue(calculatedGrade);
        row[CONFIG.CALCULATED_GRADE_COL - 1] = calculatedGrade;
      }
      
      // Transfer to topic sheet
      transferToTopicSheet(ss, mainSheet, row, i + 1, topicName);
    } else {
      // Still calculate grade for rows that haven't been transferred yet
      if (!row[CONFIG.CALCULATED_GRADE_COL - 1]) {
        const calculatedGrade = calculateGrade(row);
        mainSheet.getRange(i + 1, CONFIG.CALCULATED_GRADE_COL).setValue(calculatedGrade);
      }
    }
  }
}

/**
 * Checks if timestamp is older than specified minutes
 */
function isOlderThan(timestamp, minutes) {
  const now = new Date();
  const timestampDate = new Date(timestamp);
  const diffMinutes = (now - timestampDate) / (1000 * 60);
  return diffMinutes > minutes;
}

/**
 * Calculates the weighted grade for a row
 */
function calculateGrade(row) {
  let totalWeightedScore = 0;
  let totalWeight = 0;
  
  for (let i = 0; i < CONFIG.WEIGHTS.length; i++) {
    const colIndex = CONFIG.FIRST_GRADE_COL - 1 + i;
    const gradeValue = row[colIndex];
    
    // Skip if no grade entered
    if (!gradeValue || gradeValue === '') continue;
    
    // Extract numeric value (in case it's stored as "1 - Well Above Average")
    const numericGrade = extractNumericGrade(gradeValue);
    
    if (numericGrade && CONFIG.GRADE_PERCENTAGES[numericGrade]) {
      const percentage = CONFIG.GRADE_PERCENTAGES[numericGrade];
      const weight = CONFIG.WEIGHTS[i];
      
      totalWeightedScore += (percentage * weight);
      totalWeight += weight;
    }
  }
  
  // Calculate final grade
  if (totalWeight === 0) return '';
  
  const finalGrade = totalWeightedScore / totalWeight;
  return Math.round(finalGrade * 100) / 100; // Round to 2 decimal places
}

/**
 * Extracts numeric grade from value (handles both numbers and labeled strings)
 */
function extractNumericGrade(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const match = value.match(/^(\d+)/);
    if (match) return parseInt(match[1]);
  }
  return null;
}

/**
 * Transfers a row to the appropriate topic sheet
 */
function transferToTopicSheet(ss, mainSheet, row, rowIndex, topicName) {
  // Get or create topic sheet
  let topicSheet = ss.getSheetByName(topicName);
  
  if (!topicSheet) {
    topicSheet = ss.insertSheet(topicName);
    
    // Copy header row from main sheet
    const headerRange = mainSheet.getRange(1, 1, 1, CONFIG.CALCULATED_GRADE_COL);
    const headerValues = headerRange.getValues();
    topicSheet.getRange(1, 1, 1, CONFIG.CALCULATED_GRADE_COL).setValues(headerValues);
    
    // Format header
    topicSheet.getRange(1, 1, 1, CONFIG.CALCULATED_GRADE_COL)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');
    
    // Freeze header row
    topicSheet.setFrozenRows(1);
    
    // Setup data validation on topic sheet
    setupDataValidationForSheet(topicSheet);
  }
  
  // Append row to topic sheet
  const lastRow = topicSheet.getLastRow() + 1;
  topicSheet.getRange(lastRow, 1, 1, CONFIG.CALCULATED_GRADE_COL)
    .setValues([row.slice(0, CONFIG.CALCULATED_GRADE_COL)]);
  
  // Delete row from main sheet
  mainSheet.deleteRow(rowIndex);
  
  Logger.log('Transferred row to ' + topicName);
}

// ============================================================================
// DATA VALIDATION SETUP
// ============================================================================

/**
 * Sets up data validation dropdowns for all grade columns
 */
function setupDataValidation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mainSheet = ss.getSheetByName(CONFIG.MAIN_SHEET_NAME);
  
  if (mainSheet) {
    setupDataValidationForSheet(mainSheet);
  }
  
  // Also setup for existing topic sheets
  const sheets = ss.getSheets();
  for (const sheet of sheets) {
    if (sheet.getName() !== CONFIG.MAIN_SHEET_NAME) {
      setupDataValidationForSheet(sheet);
    }
  }
  
  SpreadsheetApp.getUi().alert('✅ Data validation dropdowns have been set up!');
}

/**
 * Sets up data validation for a specific sheet
 */
function setupDataValidationForSheet(sheet) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.GRADE_LABELS, true)
    .setAllowInvalid(false)
    .build();
  
  // Apply to all grade columns (from first to last grade column)
  const numRows = Math.max(sheet.getMaxRows(), 1000); // Ensure enough rows
  const numCols = CONFIG.LAST_GRADE_COL - CONFIG.FIRST_GRADE_COL + 1;
  
  const range = sheet.getRange(2, CONFIG.FIRST_GRADE_COL, numRows - 1, numCols);
  range.setDataValidation(rule);
  
  Logger.log('Data validation set up for sheet: ' + sheet.getName());
}

// ============================================================================
// TRIGGER MANAGEMENT
// ============================================================================

/**
 * Installs all necessary triggers
 */
function installTriggers() {
  // Remove existing triggers first
  removeTriggers();
  
  // Time-based trigger: every 60 seconds
  ScriptApp.newTrigger('processGrades')
    .timeBased()
    .everyMinutes(1)
    .create();
  
  // On edit trigger
  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  
  SpreadsheetApp.getUi().alert('✅ Triggers installed successfully!\n\n' +
    '• Time-based: Every 60 seconds\n' +
    '• On edit: After each spreadsheet edit');
}

/**
 * Removes all triggers for this script
 */
function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }
  
  Logger.log('All triggers removed');
}

/**
 * Trigger function that runs on edit
 */
function onEditTrigger(e) {
  // Only process if edit was in a grade column
  if (e && e.range) {
    const col = e.range.getColumn();
    if (col >= CONFIG.FIRST_GRADE_COL && col <= CONFIG.LAST_GRADE_COL) {
      processGrades();
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * One-time setup function - run this first!
 */
function initialSetup() {
  setupDataValidation();
  installTriggers();
  
  SpreadsheetApp.getUi().alert('🎉 Initial setup complete!\n\n' +
    'The grading system is now active:\n' +
    '• Dropdowns are set up for grade entries\n' +
    '• Automatic processing every 60 seconds\n' +
    '• Processing on each edit\n' +
    '• Manual processing available in menu');
}