import type { Language, Difficulty } from "@codepad/shared";
import { getDb, questions, assessments, evaluations, eq, and, ilike, sql } from "@codepad/database";
import { NotFoundError } from "../utils/errors.js";

export class AssessmentService {
  private get db() {
    return getDb();
  }

  // ─── Questions ──────────────────────────────────────────
  async createQuestion(data: {
    title: string;
    description: string;
    difficulty: Difficulty;
    tags: string[];
    language: Language;
    starterCode: string;
    solutionCode?: string;
    testCases: { input: string; expectedOutput: string; isHidden: boolean }[];
    timeLimitMinutes?: number;
    createdBy: string;
    orgId?: string;
  }) {
    const [question] = await this.db
      .insert(questions)
      .values({
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        tags: data.tags,
        language: data.language,
        starterCode: data.starterCode,
        solutionCode: data.solutionCode,
        testCases: data.testCases,
        timeLimitMinutes: data.timeLimitMinutes,
        createdBy: data.createdBy,
        orgId: data.orgId,
      })
      .returning();
    return question!;
  }

  async getQuestion(id: string) {
    const question = await this.db.query.questions.findFirst({
      where: eq(questions.id, id),
    });
    if (!question) throw new NotFoundError("Question", id);
    return question;
  }

  async listQuestions(filters: {
    difficulty?: Difficulty;
    language?: Language;
    search?: string;
    orgId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (filters.difficulty) conditions.push(eq(questions.difficulty, filters.difficulty));
    if (filters.language) conditions.push(eq(questions.language, filters.language));
    if (filters.search) conditions.push(ilike(questions.title, `%${filters.search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await this.db.query.questions.findMany({
      where,
      limit: pageSize,
      offset,
      orderBy: (q, { desc }) => [desc(q.createdAt)],
    });

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .where(where);

    return { questions: results, total: Number(countResult?.count ?? 0) };
  }

  // ─── Assessments ────────────────────────────────────────
  async createAssessment(data: {
    title: string;
    questionIds: string[];
    totalTimeLimitMinutes: number;
    createdBy: string;
    orgId?: string;
  }) {
    const [assessment] = await this.db
      .insert(assessments)
      .values({
        title: data.title,
        questionIds: data.questionIds,
        totalTimeLimitMinutes: data.totalTimeLimitMinutes,
        createdBy: data.createdBy,
        orgId: data.orgId,
      })
      .returning();
    return assessment!;
  }

  async getAssessment(id: string) {
    const assessment = await this.db.query.assessments.findFirst({
      where: eq(assessments.id, id),
    });
    if (!assessment) throw new NotFoundError("Assessment", id);
    return assessment;
  }

  // ─── Evaluations ───────────────────────────────────────
  async createEvaluation(data: {
    sessionId: string;
    candidateId: string;
    evaluatorId: string;
    rubricScores: { dimension: string; score: number; comment?: string }[];
    notes: string;
    overallScore: number;
  }) {
    const [evaluation] = await this.db
      .insert(evaluations)
      .values({
        sessionId: data.sessionId,
        candidateId: data.candidateId,
        evaluatorId: data.evaluatorId,
        rubricScores: data.rubricScores,
        notes: data.notes,
        overallScore: data.overallScore,
      })
      .returning();
    return evaluation!;
  }

  async getEvaluationsForSession(sessionId: string) {
    return this.db.query.evaluations.findMany({
      where: eq(evaluations.sessionId, sessionId),
    });
  }

  async getEvaluationsForCandidate(candidateId: string) {
    return this.db.query.evaluations.findMany({
      where: eq(evaluations.candidateId, candidateId),
    });
  }
}

export const assessmentService = new AssessmentService();
