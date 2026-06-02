/**
 * Database seed — run with: npm run db:seed
 * Seeds: rubric criteria, default admin user, survey question templates
 */
import { PrismaClient, Pillar, SurveyType, QuestionType, Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ============================================================
// RUBRIC CRITERIA
// Source: rubric.csv + legacy-apps-script.js constants
// Weights must sum to 1.0: 0.15+0.25+0.10+0.20+0.20+0.025+0.075 = 1.0
// ============================================================
const CRITERIA = [
  {
    code: '1.1',
    pillar: Pillar.TESTER,
    name: 'Objectives & Data Requirements',
    weight: 0.15,
    outcomesRefs: '1',
    description:
      'Decompose requirements; formulate clear, comprehensive, traceable test objectives explicitly linked to specific data requirements.',
    waaDescriptor:
      'Demonstrates mastery in decomposing requirements and formulating clear, comprehensive, traceable test objectives explicitly linked to specific data requirements.',
    avgDescriptor:
      'Develops reasonably effective objectives linked to major data requirements; some objectives may lack clarity/traceability or minor data needs might be missed.',
    failDescriptor:
      'Struggles to develop effective objectives or identify necessary data; objectives are unclear, untestable, or disconnected from requirements/data, preventing effective test planning.',
    sortOrder: 1,
  },
  {
    code: '1.2',
    pillar: Pillar.TESTER,
    name: 'Engineering Principles & Test Techniques',
    weight: 0.25,
    outcomesRefs: '1',
    description:
      'Apply engineering principles; translate objectives/data needs into specific, appropriate, and effective test techniques and procedures.',
    waaDescriptor:
      'Demonstrates mastery of relevant engineering principles and expertly translates objectives/data needs into specific, appropriate, and effective test techniques/procedures.',
    avgDescriptor:
      'Applies engineering principles adequately; translates objectives/data into generally appropriate test techniques/procedures, though some choices may be suboptimal or lack clear justification.',
    failDescriptor:
      'Fails to apply fundamental principles or select appropriate test techniques/procedures; chosen techniques would not yield required data or meet objectives, indicating a critical gap in understanding.',
    sortOrder: 2,
  },
  {
    code: '1.3',
    pillar: Pillar.TESTER,
    name: 'Instrumentation & Resources',
    weight: 0.10,
    outcomesRefs: '1,2',
    description:
      'Translate test techniques into specific, correct, and sufficient instrumentation and resource plans (personnel, assets, time).',
    waaDescriptor:
      'Demonstrates mastery in translating test techniques into specific, correct, and sufficient instrumentation and resource plans (personnel, assets, time); plan is efficient and well-justified.',
    avgDescriptor:
      'Adequately identifies major instrumentation/resource requirements, but plan may lack some detail, efficiency, or justification; minor omissions might cause manageable impact.',
    failDescriptor:
      'Struggles to identify critical instrumentation/resources; plan has major omissions or errors that would prevent test execution or objective attainment.',
    sortOrder: 3,
  },
  {
    code: '1.4',
    pillar: Pillar.TESTER,
    name: 'Risk Management & Test Judgment',
    weight: 0.20,
    outcomesRefs: '1,2',
    description:
      'Identify risks (safety, security, technical, programmatic); develop tailored mitigations; apply sound test judgment (build-up, predict-test-validate).',
    waaDescriptor:
      'Demonstrates mastery in identifying risks (safety, security, technical, programmatic), developing tailored mitigations, and applying excellent test judgment (e.g., robust build-up, predict-test-validate mindset).',
    avgDescriptor:
      'Identifies major risks and provides adequate, standard mitigations; applies a reasonable build-up approach and judgment, though perhaps formulaic or overly conservative.',
    failDescriptor:
      'Struggles to identify/mitigate significant risks; demonstrates poor test judgment, insufficient build-up, or unacceptable risk posture, making program failure or mishap likely.',
    sortOrder: 4,
  },
  {
    code: '1.5',
    pillar: Pillar.TESTER,
    name: 'Communication of Test Plan',
    weight: 0.20,
    outcomesRefs: '4',
    description:
      'Communicate a complex plan clearly, concisely, logically, and persuasively under questioning.',
    waaDescriptor:
      'Demonstrates mastery in communicating a complex plan clearly, concisely, logically, and persuasively; presentation is professional and easy to follow.',
    avgDescriptor:
      'Communicates plan adequately, though presentation may lack clarity, flow, or persuasiveness in places; core concepts are understandable with minor clarification.',
    failDescriptor:
      "Struggles to communicate plan effectively; presentation is disorganized, unclear, or confusing, hindering the panel's understanding after questioning.",
    sortOrder: 5,
  },
  {
    code: '2.1',
    pillar: Pillar.LEADER,
    name: 'Stakeholder Identification & Analysis',
    weight: 0.025,
    outcomesRefs: '5',
    description:
      'Identify the comprehensive range of key stakeholders; analyze roles, perspectives, priorities, and potential conflicts relevant to the scenario.',
    waaDescriptor:
      'Demonstrates mastery by identifying a comprehensive range of key stakeholders and providing insightful analysis of roles, perspectives, priorities, and potential conflicts relevant to the specific scenario.',
    avgDescriptor:
      'Identifies major stakeholders adequately and provides a basic analysis of their primary interests; analysis may lack depth or fail to anticipate less obvious conflicts or perspectives.',
    failDescriptor:
      'Struggles to identify key stakeholders or provides inaccurate/superficial analysis of their interests/roles; demonstrates little understanding of the stakeholder landscape relevant to the program.',
    sortOrder: 6,
  },
  {
    code: '3.1',
    pillar: Pillar.THINKER,
    name: 'Adapting to Contextual Changes',
    weight: 0.075,
    outcomesRefs: '7',
    description:
      'Adapt test strategy to significant context changes; analyze impacts on scope, risk, resources, and stakeholder dynamics; defend the adapted plan.',
    waaDescriptor:
      'Demonstrates mastery by rapidly and effectively adapting the test strategy to significant context changes, providing insightful analysis of impacts (scope, risk, resources) and stakeholder dynamics; defends the adapted plan well.',
    avgDescriptor:
      'Adapts the plan adequately to context changes, identifying necessary adjustments to scope/resources and acknowledging risks/stakeholder impacts, though analysis may lack depth or require some prompting.',
    failDescriptor:
      'Struggles to adapt the plan effectively or logically; fails to identify critical impacts, articulate trade-offs, or defend the adapted approach, indicating difficulty with strategic adjustment.',
    sortOrder: 7,
  },
]

// ============================================================
// STUDENT SURVEY QUESTIONS
// Source: student-survey.txt (Google Forms HTML export)
// ============================================================
const STUDENT_SURVEY_QUESTIONS = [
  // Section 1: About You
  {
    sortOrder: 1,
    questionKey: 'track',
    questionText: 'What is your primary academic track at USAF TPS?',
    questionType: QuestionType.MULTIPLE_CHOICE,
    options: ['Pilot', 'RPA', 'FTE', 'CSO/WSO (Combat Systems Officer / Weapon Systems Officer)', 'Operator (STC - Space Test Course)', 'ABM (Air Battle Manager)'],
    isRequired: true,
  },
  {
    sortOrder: 2,
    questionKey: 'exam_date',
    questionText: 'What was the date of your Comprehensive Oral Exam?',
    questionType: QuestionType.DATE,
    options: null,
    isRequired: true,
  },
  // Section 2: Scenario
  {
    sortOrder: 3,
    questionKey: 'problem_statement_clarity',
    questionText:
      'Clarity of the "Problem Statement" (Background, System Description, Existing Data/Status, Mission, Customer, Need Date, Key Requirements): How clear and understandable did you find this part of your scenario?',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Unclear', '2', '3', '4', '5 – Very Clear'],
    isRequired: true,
  },
  {
    sortOrder: 4,
    questionKey: 'problem_statement_clarity_comments',
    questionText:
      'If the Problem Statement was unclear in any way, please briefly specify which part(s) or why: (Optional)',
    questionType: QuestionType.TEXT,
    options: null,
    isRequired: false,
  },
  {
    sortOrder: 5,
    questionKey: 'task_section_clarity',
    questionText:
      'Clarity of the "Task" section (Tester, Leader, Thinker pillars): How clear and understandable did you find the specific tasks for each pillar?',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Unclear', '2', '3', '4', '5 – Very Clear'],
    isRequired: true,
  },
  {
    sortOrder: 6,
    questionKey: 'task_section_clarity_comments',
    questionText:
      'If the Task section was unclear in any way, please briefly specify which pillar(s) or part(s): (Optional)',
    questionType: QuestionType.TEXT,
    options: null,
    isRequired: false,
  },
  {
    sortOrder: 7,
    questionKey: 'overall_difficulty',
    questionText: 'Overall Difficulty of Your Scenario: How would you rate the overall difficulty of the scenario you received?',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Easy', '2', '3', '4', '5 – Very Difficult'],
    isRequired: true,
  },
  {
    sortOrder: 8,
    questionKey: 'tester_pillar_difficulty',
    questionText: 'Difficulty of Addressing the Tester Pillar (main test plan):',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Easy', '2', '3', '4', '5 – Very Difficult'],
    isRequired: true,
  },
  {
    sortOrder: 9,
    questionKey: 'leader_pillar_difficulty',
    questionText: 'Difficulty of Addressing the Leader Pillar (stakeholders):',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Easy', '2', '3', '4', '5 – Very Difficult'],
    isRequired: true,
  },
  {
    sortOrder: 10,
    questionKey: 'scenario_track_appropriate',
    questionText: 'Did you feel the scenario was appropriate for your specific academic track?',
    questionType: QuestionType.MULTIPLE_CHOICE,
    options: ['Yes', 'No', 'Somewhat'],
    isRequired: true,
  },
  {
    sortOrder: 11,
    questionKey: 'scenario_track_appropriate_comments',
    questionText: 'If you felt the scenario was not appropriate for your track, please briefly explain why: (Optional)',
    questionType: QuestionType.TEXT,
    options: null,
    isRequired: false,
  },
  {
    sortOrder: 12,
    questionKey: 'scenario_sufficient_info',
    questionText: 'Did you feel the scenario provided sufficient information to adequately address all three pillar tasks?',
    questionType: QuestionType.MULTIPLE_CHOICE,
    options: ['Yes', 'No', 'Partially'],
    isRequired: true,
  },
  {
    sortOrder: 13,
    questionKey: 'scenario_sufficient_info_comments',
    questionText: 'If not, what information felt lacking or unclear? (Optional)',
    questionType: QuestionType.TEXT,
    options: null,
    isRequired: false,
  },
  // Section 3: Exam Process & Preparation
  {
    sortOrder: 14,
    questionKey: 'scenario_review_time_adequacy',
    questionText:
      'Time for Scenario Review & Questions (10 min / 15 min Int\'l): How adequate was this time for you to understand the scenario and formulate initial questions?',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Inadequate', '2', '3', '4', '5 – Very Adequate'],
    isRequired: true,
  },
  {
    sortOrder: 15,
    questionKey: 'prep_time_adequacy',
    questionText: 'Time for Preparation (35 minutes): How adequate was this time for you to prepare your full response across all three pillars?',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Inadequate', '2', '3', '4', '5 – Very Adequate'],
    isRequired: true,
  },
  {
    sortOrder: 16,
    questionKey: 'time_management_quality',
    questionText:
      'Time Management During Preparation: How well did you feel you could manage your 35-minute preparation time across the three pillars (Tester, Leader, Thinker)?',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Poorly', '2', '3', '4', '5 – Very Well'],
    isRequired: true,
  },
  {
    sortOrder: 17,
    questionKey: 'tester_prep_time_percent',
    questionText: 'Approximate percentage of your 35-minute preparation time spent on the Tester Pillar?',
    questionType: QuestionType.MULTIPLE_CHOICE,
    options: ['< 50%', '50–60%', '60–70%', '70–80%', '> 80%'],
    isRequired: true,
  },
  {
    sortOrder: 18,
    questionKey: 'presentation_time_adequacy',
    questionText: 'Time for Presentation (25±5 minutes): How adequate was this time for you to present your plan and address all pillars?',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Inadequate', '2', '3', '4', '5 – Very Adequate'],
    isRequired: true,
  },
  {
    sortOrder: 19,
    questionKey: 'panel_question_clarity',
    questionText:
      'Clarity and Relevance of Panel Questions: Overall, how clear and relevant were the questions asked by the panel members during the Q&A session?',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Unclear/Irrelevant', '2', '3', '4', '5 – Very Clear/Relevant'],
    isRequired: true,
  },
  {
    sortOrder: 20,
    questionKey: 'panel_professionalism',
    questionText: 'Professionalism of the Panel: Please rate the professionalism of the panel members during your exam.',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Unprofessional', '2', '3', '4', '5 – Very Professional'],
    isRequired: true,
  },
  {
    sortOrder: 21,
    questionKey: 'mib_effectiveness',
    questionText:
      'Comp Oral MIB (Mass Information Briefing): The MIB effectively prepared me for the format, expectations, and grading of the Comp Oral Exam.',
    questionType: QuestionType.LIKERT,
    options: ['1 – Strongly Disagree', '2', '3', '4', '5 – Strongly Agree'],
    isRequired: true,
  },
  {
    sortOrder: 22,
    questionKey: 'practice_scenario_quality',
    questionText:
      'Practice Scenarios: The practice scenarios provided during the course were representative of the actual exam scenario in terms of scope and complexity.',
    questionType: QuestionType.LIKERT,
    options: ['1 – Strongly Disagree', '2', '3', '4', '5 – Strongly Agree'],
    isRequired: true,
  },
  {
    sortOrder: 23,
    questionKey: 'whiteboard_used',
    questionText: 'Whiteboard Usage: Did you utilize the whiteboard during your preparation and presentation?',
    questionType: QuestionType.MULTIPLE_CHOICE,
    options: ['Yes', 'No, I did not use the whiteboard'],
    isRequired: true,
  },
  {
    sortOrder: 24,
    questionKey: 'whiteboard_helpfulness',
    questionText:
      'How helpful was the whiteboard in organizing and presenting your thoughts? (If you did not use the whiteboard, please select 1)',
    questionType: QuestionType.LIKERT,
    options: ['1 – Not at all Helpful / Did not use', '2', '3', '4', '5 – Extremely Helpful'],
    isRequired: true,
  },
  // Section 4: Self-Assessment
  {
    sortOrder: 25,
    questionKey: 'tester_preparation',
    questionText:
      'How well prepared did you feel your TPS education made you for the Tester Pillar (developing the core test plan, objectives, data, techniques, resources, risk)?',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Unprepared', '2', '3', '4', '5 – Very Well Prepared'],
    isRequired: true,
  },
  {
    sortOrder: 26,
    questionKey: 'leader_preparation',
    questionText:
      'How well prepared did you feel your TPS education made you for the Leader Pillar (identifying stakeholders, analyzing perspectives/conflicts)?',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Unprepared', '2', '3', '4', '5 – Very Well Prepared'],
    isRequired: true,
  },
  {
    sortOrder: 27,
    questionKey: 'thinker_preparation',
    questionText:
      'How well prepared did you feel your TPS education made you for the Thinker Pillar (adapting a test plan to significant contextual changes)?',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Unprepared', '2', '3', '4', '5 – Very Well Prepared'],
    isRequired: true,
  },
  {
    sortOrder: 28,
    questionKey: 'flight_astro_preparation',
    questionText:
      'How well did Flight Sciences/Astronautical Sciences prepare you for the technical aspects of the Tester pillar related to your scenario?',
    questionType: QuestionType.LIKERT,
    options: ['1 – Not at all', '2', '3', '4', '5 – Extremely Well'],
    isRequired: true,
  },
  {
    sortOrder: 29,
    questionKey: 'flight_astro_preparation_comments',
    questionText: 'Specific strengths or weaknesses in Flight/Astro Sciences preparation for the exam (Optional):',
    questionType: QuestionType.TEXT,
    options: null,
    isRequired: false,
  },
  {
    sortOrder: 30,
    questionKey: 'mission_systems_preparation',
    questionText:
      'How well did Mission Systems prepare you for the technical aspects of the Tester pillar related to your scenario?',
    questionType: QuestionType.LIKERT,
    options: ['1 – Not at all', '2', '3', '4', '5 – Extremely Well'],
    isRequired: true,
  },
  {
    sortOrder: 31,
    questionKey: 'mission_systems_preparation_comments',
    questionText: 'Specific strengths or weaknesses in Mission Systems preparation for the exam (Optional):',
    questionType: QuestionType.TEXT,
    options: null,
    isRequired: false,
  },
  {
    sortOrder: 32,
    questionKey: 'outcome_alignment',
    questionText:
      'To what extent did the Comprehensive Oral Exam, as you experienced it, align with the TPS School Outcomes (developing Testers, Leaders, Thinkers, and Innovators)?',
    questionType: QuestionType.LIKERT,
    options: ['1 – Not at all aligned', '2', '3', '4', '5 – Fully aligned'],
    isRequired: true,
  },
  {
    sortOrder: 33,
    questionKey: 'most_challenging_aspect',
    questionText: 'What was the most challenging aspect of the Comprehensive Oral Exam format for you?',
    questionType: QuestionType.TEXT,
    options: null,
    isRequired: false,
  },
  {
    sortOrder: 34,
    questionKey: 'most_valuable_aspect',
    questionText: 'What single aspect of the exam or your preparation do you feel was most valuable?',
    questionType: QuestionType.TEXT,
    options: null,
    isRequired: false,
  },
  {
    sortOrder: 35,
    questionKey: 'improvement_suggestions',
    questionText:
      'Do you have any specific, actionable suggestions for improving the Comprehensive Oral Exam (content, conduct, preparation materials, etc.)?',
    questionType: QuestionType.TEXT,
    options: null,
    isRequired: false,
  },
  {
    sortOrder: 36,
    questionKey: 'additional_comments',
    questionText:
      'Are there any other aspects of andragogy, educational design, academic/hands-on instruction, or exam content/conduct that you would like to comment on in relation to this exam?',
    questionType: QuestionType.TEXT,
    options: null,
    isRequired: false,
  },
]

// ============================================================
// INSTRUCTOR SURVEY QUESTIONS
// Source: instructor-survey.txt (Google Forms HTML export)
// ============================================================
const INSTRUCTOR_SURVEY_QUESTIONS = [
  // Section 1: Examination Details
  {
    sortOrder: 1,
    questionKey: 'scenario_id',
    questionText: 'Which scenario was used for this examination?',
    questionType: QuestionType.TEXT,
    options: null,
    isRequired: true,
  },
  {
    sortOrder: 2,
    questionKey: 'experience_level',
    questionText: 'Your Experience Level on Comp Oral Panels:',
    questionType: QuestionType.MULTIPLE_CHOICE,
    options: ['First time', '2–3 times', '4–6 times', '7+ times'],
    isRequired: true,
  },
  {
    sortOrder: 3,
    questionKey: 'panel_role',
    questionText: 'Your role on this panel:',
    questionType: QuestionType.MULTIPLE_CHOICE,
    options: ['Panel Chair', 'Panel Member', 'Observer'],
    isRequired: true,
  },
  // Section 2: Scenario Evaluation
  {
    sortOrder: 4,
    questionKey: 'problem_statement_clarity',
    questionText: "Clarity of this Scenario's \"Problem Statement\":",
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Unclear', '2', '3', '4', '5 – Very Clear'],
    isRequired: true,
  },
  {
    sortOrder: 5,
    questionKey: 'task_section_clarity',
    questionText: "Clarity of this Scenario's \"Task\" section (for all pillars):",
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Unclear', '2', '3', '4', '5 – Very Clear'],
    isRequired: true,
  },
  {
    sortOrder: 6,
    questionKey: 'scope_appropriateness',
    questionText:
      "Appropriateness of this Scenario's Scope for the Allotted Time (35 min prep, 25±5 min presentation):",
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Inappropriate', '2', '3', '4', '5 – Very Appropriate'],
    isRequired: true,
  },
  {
    sortOrder: 7,
    questionKey: 'tester_pillar_effectiveness',
    questionText: "This Scenario's Effectiveness in Allowing Assessment of the Tester Pillar skills:",
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Ineffective', '2', '3', '4', '5 – Very Effective'],
    isRequired: true,
  },
  {
    sortOrder: 8,
    questionKey: 'leader_pillar_effectiveness',
    questionText: "This Scenario's Effectiveness in Allowing Assessment of the Leader Pillar skills:",
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Ineffective', '2', '3', '4', '5 – Very Effective'],
    isRequired: true,
  },
  {
    sortOrder: 9,
    questionKey: 'thinker_pillar_effectiveness',
    questionText: "This Scenario's Effectiveness in Allowing Assessment of the Thinker Pillar task:",
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Ineffective', '2', '3', '4', '5 – Very Effective'],
    isRequired: true,
  },
  {
    sortOrder: 10,
    questionKey: 'innovator_pillar_effectiveness',
    questionText: "This Scenario's Effectiveness in Allowing Assessment of the Innovator Pillar task:",
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Ineffective', '2', '3', '4', '5 – Very Effective'],
    isRequired: true,
  },
  {
    sortOrder: 11,
    questionKey: 'perceived_difficulty',
    questionText: 'Perceived Overall Difficulty of this Scenario for a typical TPS student:',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Easy', '2', '3', '4', '5 – Very Difficult'],
    isRequired: true,
  },
  {
    sortOrder: 12,
    questionKey: 'instructor_guide_adequacy',
    questionText:
      'Adequacy of the Instructor Guide provided for this specific scenario (for evaluation guidance):',
    questionType: QuestionType.LIKERT,
    options: ['1 – Very Inadequate', '2', '3', '4', '5 – Very Adequate'],
    isRequired: true,
  },
  {
    sortOrder: 13,
    questionKey: 'additional_comments',
    questionText:
      'Specific comments on this scenario, its Instructor Guide, or the Comp Oral Process as a whole? Thanks!',
    questionType: QuestionType.TEXT,
    options: null,
    isRequired: false,
  },
]

// ============================================================
// MAIN SEED FUNCTION
// ============================================================
async function main() {
  console.log('🌱 Starting database seed...')

  // 1. Criteria
  console.log('  → Seeding rubric criteria...')
  for (const criterion of CRITERIA) {
    await prisma.criterion.upsert({
      where: { code: criterion.code },
      update: criterion,
      create: criterion,
    })
  }
  console.log(`     ✓ ${CRITERIA.length} criteria seeded`)

  // 2. Default admin user (change password immediately after first login)
  console.log('  → Seeding default admin user...')
  const defaultPassword = 'ChangeMe123!'
  const passwordHash = await bcrypt.hash(defaultPassword, 12)
  await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
    },
  })
  console.log(`     ✓ Admin user created (username: admin, password: ${defaultPassword})`)
  console.log('     ⚠️  IMPORTANT: Change the admin password immediately after first login!')

  // 3. Student survey question templates (global — classId null)
  console.log('  → Seeding student survey question templates...')
  for (const q of STUDENT_SURVEY_QUESTIONS) {
    // Use sortOrder as a stable identifier for upsert
    const existing = await prisma.surveyQuestionTemplate.findFirst({
      where: {
        surveyType: SurveyType.STUDENT,
        classId: null,
        questionKey: q.questionKey,
      },
    })
    // Prisma nullable JSON fields require Prisma.JsonNull (not JS null) to explicitly set null
    const optionsValue = q.options === null ? Prisma.JsonNull : q.options
    if (existing) {
      await prisma.surveyQuestionTemplate.update({
        where: { id: existing.id },
        data: { ...q, options: optionsValue, surveyType: SurveyType.STUDENT, classId: null },
      })
    } else {
      await prisma.surveyQuestionTemplate.create({
        data: { ...q, options: optionsValue, surveyType: SurveyType.STUDENT, classId: null },
      })
    }
  }
  console.log(`     ✓ ${STUDENT_SURVEY_QUESTIONS.length} student survey questions seeded`)

  // 4. Instructor survey question templates
  console.log('  → Seeding instructor survey question templates...')
  for (const q of INSTRUCTOR_SURVEY_QUESTIONS) {
    const existing = await prisma.surveyQuestionTemplate.findFirst({
      where: {
        surveyType: SurveyType.INSTRUCTOR,
        classId: null,
        questionKey: q.questionKey,
      },
    })
    const optionsValue = q.options === null ? Prisma.JsonNull : q.options
    if (existing) {
      await prisma.surveyQuestionTemplate.update({
        where: { id: existing.id },
        data: { ...q, options: optionsValue, surveyType: SurveyType.INSTRUCTOR, classId: null },
      })
    } else {
      await prisma.surveyQuestionTemplate.create({
        data: { ...q, options: optionsValue, surveyType: SurveyType.INSTRUCTOR, classId: null },
      })
    }
  }
  console.log(`     ✓ ${INSTRUCTOR_SURVEY_QUESTIONS.length} instructor survey questions seeded`)

  console.log('\n✅ Database seed complete.')
  console.log('\nDefault credentials:')
  console.log('  Admin   → username: admin  |  password: ChangeMe123!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
