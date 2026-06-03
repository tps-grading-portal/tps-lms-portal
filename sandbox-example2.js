function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('TMP Analysis')
    .addItem('Run Scatter Plot Analysis', 'runScatterAnalysis')
    .addItem('Generate LLM Report Prompt', 'generateLLMPrompt')
    .addToUi();
}

function runScatterAnalysis() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Get raw data
  var rawDataSheet = ss.getSheetByName('Raw Data');
  if (!rawDataSheet) {
    SpreadsheetApp.getUi().alert('Error: Could not find "Raw Data" sheet.');
    return;
  }
  
  var data = rawDataSheet.getDataRange().getValues();
  if (data.length <= 1) {
    SpreadsheetApp.getUi().alert('No survey data found.');
    return;
  }
  
  // Process data
  var projectData = processProjectData(data);
  
  // Create or clear Analysis sheet
  var analysisSheet = ss.getSheetByName('Scatter Analysis');
  if (analysisSheet) {
    ss.deleteSheet(analysisSheet);
  }
  analysisSheet = ss.insertSheet('Scatter Analysis');
  
  // Create summary table
  createSummaryTable(analysisSheet, projectData);
  
  // Create scatter plot WITH CUTOFF LINE
  createScatterPlotWithCutoff(analysisSheet, projectData);
  
  SpreadsheetApp.getUi().alert('Scatter plot analysis complete! Check "Scatter Analysis" tab.');
}

function processProjectData(data) {
  var projectMap = {};
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var projectName = row[1];
    
    if (!projectName) continue;
    
    var riskScores = [
      parseFloat(row[2]) || 0,  // Scope
      parseFloat(row[4]) || 0,  // Schedule  
      parseFloat(row[6]) || 0,  // Maturity
      parseFloat(row[8]) || 0   // Resources
    ];
    
    var valueScores = [
      parseFloat(row[10]) || 0, // Test Community
      parseFloat(row[12]) || 0, // TPS
      parseFloat(row[14]) || 0  // Warfighter
    ];
    
    if (!projectMap[projectName]) {
      projectMap[projectName] = {
        name: projectName,
        riskScores: [],
        valueScores: [],
        responseCount: 0
      };
    }
    
    projectMap[projectName].riskScores.push(riskScores);
    projectMap[projectName].valueScores.push(valueScores);
    projectMap[projectName].responseCount++;
  }
  
  // Calculate averages
  var projectResults = [];
  for (var projectName in projectMap) {
    var project = projectMap[projectName];
    
    var totalRiskSum = 0;
    var totalRiskCount = 0;
    for (var r = 0; r < project.riskScores.length; r++) {
      for (var c = 0; c < project.riskScores[r].length; c++) {
        totalRiskSum += project.riskScores[r][c];
        totalRiskCount++;
      }
    }
    var avgRisk = totalRiskCount > 0 ? totalRiskSum / totalRiskCount : 0;
    
    var totalValueSum = 0;
    var totalValueCount = 0;
    for (var r = 0; r < project.valueScores.length; r++) {
      for (var c = 0; c < project.valueScores[r].length; c++) {
        totalValueSum += project.valueScores[r][c];
        totalValueCount++;
      }
    }
    var avgValue = totalValueCount > 0 ? totalValueSum / totalValueCount : 0;
    
    projectResults.push({
      name: projectName,
      avgRisk: Math.round(avgRisk * 100) / 100,
      avgValue: Math.round(avgValue * 100) / 100,
      responseCount: project.responseCount
    });
  }
  
  return projectResults;
}

function createSummaryTable(sheet, projectData) {
  var headers = [['Project Name', 'Avg Risk Score', 'Avg Value Score', 'Response Count']];
  
  var tableData = headers.concat(projectData.map(function(project) {
    return [project.name, project.avgRisk, project.avgValue, project.responseCount];
  }));
  
  var range = sheet.getRange(1, 1, tableData.length, 4);
  range.setValues(tableData);
  
  // Format headers
  var headerRange = sheet.getRange(1, 1, 1, 4);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('white');
  
  sheet.autoResizeColumns(1, 4);
}

function createScatterPlotWithCutoff(sheet, projectData) {
  // Clear chart area
  sheet.getRange('F:P').clear();
  
  // Calculate desirability scores and rank projects
  var projectsWithScores = [];
  for (var i = 0; i < projectData.length; i++) {
    var desirabilityScore = projectData[i].avgValue/projectData[i].avgRisk;
    projectsWithScores.push({
      name: projectData[i].name,
      avgRisk: projectData[i].avgRisk,
      avgValue: projectData[i].avgValue,
      desirabilityScore: Math.round(desirabilityScore * 100) / 100,
      responseCount: projectData[i].responseCount
    });
  }
  
  // Sort by desirability score (highest first)
  projectsWithScores.sort(function(a, b) { return b.desirabilityScore - a.desirabilityScore; });
  
  // Create ranking table
  sheet.getRange(1, 6).setValue('PROJECT RANKINGS');
  sheet.getRange(1, 6).setFontWeight('bold');
  sheet.getRange(2, 6).setValue('Rank');
  sheet.getRange(2, 7).setValue('Project Name');
  sheet.getRange(2, 8).setValue('Risk');
  sheet.getRange(2, 9).setValue('Value');
  sheet.getRange(2, 10).setValue('Desirability Score');
  sheet.getRange(2, 11).setValue('Status');
  sheet.getRange(2, 6, 1, 6).setFontWeight('bold');
  
  for (var i = 0; i < projectsWithScores.length; i++) {
    var row = i + 3;
    var project = projectsWithScores[i];
    var rank = i + 1;
    
    // Determine status and color
    var status = '';
    var backgroundColor = '';
    var fontColor = '';
    
    if (rank <= 5) {
      // Top 5 projects
      status = '★ TOP 5';
      backgroundColor = '#d4edda'; // Light green
      fontColor = '#155724';       // Dark green
    } else if (project.desirabilityScore >= 0) {
      // Positive but not top 5
      status = '◐ MIDDLE';
      backgroundColor = '#fff3cd'; // Light yellow
      fontColor = '#856404';       // Dark yellow
    } else {
      // Negative desirability score
      status = '✗ POOR';
      backgroundColor = '#f8d7da'; // Light red
      fontColor = '#721c24';       // Dark red
    }
    
    sheet.getRange(row, 6).setValue(rank);
    sheet.getRange(row, 7).setValue(project.name);
    sheet.getRange(row, 8).setValue(project.avgRisk);
    sheet.getRange(row, 9).setValue(project.avgValue);
    sheet.getRange(row, 10).setValue(project.desirabilityScore);
    sheet.getRange(row, 11).setValue(status);
    
    // Apply color coding to the entire row
    sheet.getRange(row, 6, 1, 6).setBackground(backgroundColor);
    sheet.getRange(row, 6, 1, 6).setFontColor(fontColor);
  }
  
  // Instructions
  var explanationRow = projectsWithScores.length + 5;
  sheet.getRange(explanationRow, 1).setValue('RANKING SYSTEM:');
  sheet.getRange(explanationRow, 1).setFontWeight('bold');
  sheet.getRange(explanationRow + 1, 1).setValue('• GREEN (★ TOP 5) = Best 5 projects by desirability score');
  sheet.getRange(explanationRow + 2, 1).setValue('• YELLOW (◐ MIDDLE) = Positive desirability score, not top 5');
  sheet.getRange(explanationRow + 3, 1).setValue('• RED (✗ POOR) = Negative desirability score (risk > value)');
  sheet.getRange(explanationRow + 4, 1).setValue('• Desirability Score = Average Value/Average Risk');
  sheet.getRange(explanationRow + 5, 1).setValue('• Higher desirability score = Better project');
  
  sheet.autoResizeColumns(6, 6);
}

function generateLLMPrompt() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var rawDataSheet = ss.getSheetByName('Raw Data');
  if (!rawDataSheet) {
    SpreadsheetApp.getUi().alert('Error: Could not find "Raw Data" sheet.');
    return;
  }
  
  var rawData = rawDataSheet.getDataRange().getValues();
  
  var promptSheet = ss.getSheetByName('LLM Prompt');
  if (promptSheet) {
    promptSheet.clear();
  } else {
    promptSheet = ss.insertSheet('LLM Prompt');
  }
  
  var promptText = createLLMPromptText(rawData);
  
  var instructions = [
    'INSTRUCTIONS: Copy everything below the line and paste into Claude/Gemini/ChatGPT',
    '=====================================',
    ''
  ];
  
  for (var i = 0; i < instructions.length; i++) {
    promptSheet.getRange(i + 1, 1).setValue(instructions[i]);
  }
  
  var promptLines = promptText.split('\n');
  for (var i = 0; i < promptLines.length; i++) {
    promptSheet.getRange(instructions.length + 1 + i, 1).setValue(promptLines[i]);
  }
  
  promptSheet.autoResizeColumns(1, 1);
  
  SpreadsheetApp.getUi().alert('LLM Prompt generated! Check "LLM Prompt" tab.');
}

function createLLMPromptText(rawData) {
  var prompt = 'ANALYZE TMP SURVEY DATA FOR EXECUTIVE REPORT\n\n';
  prompt += 'Survey uses 1-5 scale: RISK (1=Low, 5=High), VALUE (1=Low, 5=High)\n\n';
  prompt += 'ANALYSIS REQUIREMENTS:\n';
  prompt += '1. Top 5 project recommendations with brief justification\n';
  prompt += '2. OVERALL PROJECT RANKING: Rank ALL projects from best to worst, factoring BOTH:\n';
  prompt += '   - Quantitative desirability scores (Value/Risk)\n';
  prompt += '   - Qualitative insights from comments (concerns, enthusiasm, specific issues)\n';
  prompt += '3. Major themes from comments across all projects\n';
  prompt += '4. Individual component analysis (where specific categories vary from overall scores)\n';
  prompt += '5. Contradictions between numerical scores and written comments\n';
  prompt += '6. Projects where comments suggest the numerical scores may not tell the full story\n\n';
  prompt += 'IMPORTANT: Your overall ranking may differ from the pure numerical ranking if comments reveal significant concerns or enthusiasm not captured in scores.\n\n';
  
  // Add raw data
  prompt += 'RAW DATA:\n';
  for (var i = 1; i < rawData.length; i++) {
    var row = rawData[i];
    if (row[1]) {  // If project name exists
      prompt += 'Project: ' + row[1] + '\n';
      prompt += 'Risk: Scope(' + row[2] + '), Schedule(' + row[4] + '), Maturity(' + row[6] + '), Resources(' + row[8] + ')\n';
      prompt += 'Value: TestCommunity(' + row[10] + '), TPS(' + row[12] + '), Warfighter(' + row[14] + ')\n';
      
      // Calculate and include desirability score for LLM reference
      var avgRisk = (parseFloat(row[2]) + parseFloat(row[4]) + parseFloat(row[6]) + parseFloat(row[8])) / 4;
      var avgValue = (parseFloat(row[10]) + parseFloat(row[12]) + parseFloat(row[14])) / 3;
      var desirabilityScore = Math.round((avgValue/avgRisk)) ;
      prompt += 'Calculated Desirability Score: ' + desirabilityScore + ' (Value/Risk)\n';
      
      if (row[3] || row[5] || row[7] || row[9] || row[11] || row[13] || row[15] || row[16]) {
        prompt += 'Comments: ';
        if (row[3]) prompt += 'Scope: ' + row[3] + '; ';
        if (row[5]) prompt += 'Schedule: ' + row[5] + '; ';
        if (row[7]) prompt += 'Maturity: ' + row[7] + '; ';
        if (row[9]) prompt += 'Resources: ' + row[9] + '; ';
        if (row[11]) prompt += 'TestCommunity: ' + row[11] + '; ';
        if (row[13]) prompt += 'TPS: ' + row[13] + '; ';
        if (row[15]) prompt += 'Warfighter: ' + row[15] + '; ';
        if (row[16]) prompt += 'Additional: ' + row[16] + '; ';
        prompt += '\n';
      }
      prompt += '\n';
    }
  }
  
  prompt += 'DELIVERABLE: Provide an executive report with your recommended project ranking that balances numerical scores with qualitative insights from comments.';
  
  return prompt;
}