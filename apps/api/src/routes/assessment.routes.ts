import { Router } from "express";
import { z } from "zod";
import { Language, Difficulty } from "@codepad/shared";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { assessmentService } from "../services/assessment.service.js";

const router = Router();
router.use(authenticate);

// ─── Questions ──────────────────────────────────────────────
const createQuestionSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1),
  difficulty: z.nativeEnum(Difficulty),
  tags: z.array(z.string()).default([]),
  language: z.nativeEnum(Language),
  starterCode: z.string().default(""),
  solutionCode: z.string().optional(),
  testCases: z.array(
    z.object({
      input: z.string(),
      expectedOutput: z.string(),
      isHidden: z.boolean().default(false),
    }),
  ).default([]),
  timeLimitMinutes: z.number().min(1).max(120).optional(),
});

router.post("/questions", validate(createQuestionSchema), async (req, res, next) => {
  try {
    const question = await assessmentService.createQuestion({
      ...req.body,
      createdBy: req.userPayload!.sub,
      orgId: req.userPayload!.orgId,
    });
    res.status(201).json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
});

router.get("/questions", async (req, res, next) => {
  try {
    const filters = {
      difficulty: req.query.difficulty as Difficulty | undefined,
      language: req.query.language as Language | undefined,
      search: req.query.search as string | undefined,
      orgId: req.userPayload!.orgId,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20,
    };
    const result = await assessmentService.listQuestions(filters);
    res.json({
      success: true,
      data: result.questions,
      meta: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / filters.pageSize),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/questions/:id", async (req, res, next) => {
  try {
    const question = await assessmentService.getQuestion(req.params.id!);
    res.json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
});

// ─── Assessments ────────────────────────────────────────────
const createAssessmentSchema = z.object({
  title: z.string().min(1).max(500),
  questionIds: z.array(z.string().uuid()).min(1).max(5),
  totalTimeLimitMinutes: z.number().min(5).max(480),
});

router.post("/assessments", validate(createAssessmentSchema), async (req, res, next) => {
  try {
    const assessment = await assessmentService.createAssessment({
      ...req.body,
      createdBy: req.userPayload!.sub,
      orgId: req.userPayload!.orgId,
    });
    res.status(201).json({ success: true, data: assessment });
  } catch (err) {
    next(err);
  }
});

router.get("/assessments/:id", async (req, res, next) => {
  try {
    const assessment = await assessmentService.getAssessment(req.params.id!);
    res.json({ success: true, data: assessment });
  } catch (err) {
    next(err);
  }
});

// ─── Evaluations ────────────────────────────────────────────
const createEvaluationSchema = z.object({
  sessionId: z.string().uuid(),
  candidateId: z.string().uuid(),
  rubricScores: z.array(
    z.object({
      dimension: z.string(),
      score: z.number().min(1).max(5),
      comment: z.string().optional(),
    }),
  ),
  notes: z.string().default(""),
  overallScore: z.number().min(1).max(5),
});

router.post("/evaluations", validate(createEvaluationSchema), async (req, res, next) => {
  try {
    const evaluation = await assessmentService.createEvaluation({
      ...req.body,
      evaluatorId: req.userPayload!.sub,
    });
    res.status(201).json({ success: true, data: evaluation });
  } catch (err) {
    next(err);
  }
});

router.get("/evaluations/session/:sessionId", async (req, res, next) => {
  try {
    const evaluations = await assessmentService.getEvaluationsForSession(req.params.sessionId!);
    res.json({ success: true, data: evaluations });
  } catch (err) {
    next(err);
  }
});

export { router as assessmentRoutes };
