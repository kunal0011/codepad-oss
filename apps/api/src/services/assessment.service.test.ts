import { describe, it, expect, vi } from "vitest";
import { assessmentService } from "./assessment.service.js";
import { Language, Difficulty } from "@codepad/shared";

// Mock database
vi.mock("@codepad/database", () => ({
  getDb: vi.fn(() => ({
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "q-1", title: "Test Question" }]),
      })),
    })),
    query: {
      questions: {
        findFirst: vi.fn().mockResolvedValue({ id: "q-1", title: "Test Question" }),
        findMany: vi.fn().mockResolvedValue([{ id: "q-1", title: "Test Question" }]),
      },
      assessments: {
        findFirst: vi.fn().mockResolvedValue({ id: "a-1", title: "Test Assessment" }),
      },
      evaluations: {
        findMany: vi.fn().mockResolvedValue([{ id: "e-1", overallScore: 5 }]),
      }
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      })),
    })),
  })),
  questions: { id: "id", title: "title", createdAt: "createdAt", difficulty: "difficulty", language: "language" },
  assessments: { id: "id" },
  evaluations: { id: "id", sessionId: "sessionId", candidateId: "candidateId" },
  eq: vi.fn(),
  and: vi.fn(),
  ilike: vi.fn(),
  sql: vi.fn(),
}));

describe("AssessmentService", () => {
  it("should create a question", async () => {
    const question = await assessmentService.createQuestion({
      title: "Sum two numbers",
      description: "Return a+b",
      difficulty: Difficulty.EASY,
      tags: ["basic"],
      language: Language.JAVASCRIPT,
      starterCode: "function sum(a, b) {}",
      testCases: [{ input: "1,2", expectedOutput: "3", isHidden: false }],
      createdBy: "u-1",
    });

    expect(question).toBeDefined();
    expect(question.title).toBe("Test Question");
  });

  it("should get a question by id", async () => {
    const question = await assessmentService.getQuestion("q-1");
    expect(question.id).toBe("q-1");
  });

  it("should create an assessment", async () => {
    const assessment = await assessmentService.createAssessment({
      title: "Frontend Interview",
      questionIds: ["q-1"],
      totalTimeLimitMinutes: 60,
      createdBy: "u-1",
    });
    expect(assessment).toBeDefined();
  });

  it("should create an evaluation", async () => {
    const evaluation = await assessmentService.createEvaluation({
      sessionId: "s-1",
      candidateId: "c-1",
      evaluatorId: "e-1",
      rubricScores: [{ dimension: "problem-solving", score: 5 }],
      notes: "Great job",
      overallScore: 5,
    });
    expect(evaluation).toBeDefined();
  });
});
