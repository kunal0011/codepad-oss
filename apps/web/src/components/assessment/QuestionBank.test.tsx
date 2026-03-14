import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QuestionBank } from "./QuestionBank";
import { api } from "@/lib/api";

// Mock API
vi.mock("@/lib/api", () => ({
  api: {
    listQuestions: vi.fn(),
  },
}));

describe("QuestionBank", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", async () => {
    vi.mocked(api.listQuestions).mockResolvedValue({ success: true, data: [] });
    render(<QuestionBank />);
    // Pulse divs are shown during loading
    expect(document.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("renders questions from API", async () => {
    const mockQuestions = [
      {
        id: "q-1",
        title: "Two Sum",
        description: "Find two numbers",
        difficulty: "easy",
        tags: ["array"],
        language: "python",
      },
    ];

    vi.mocked(api.listQuestions).mockResolvedValue({ success: true, data: mockQuestions });
    
    render(<QuestionBank />);

    await waitFor(() => {
      expect(screen.getByText("Two Sum")).toBeDefined();
      expect(screen.getByText("python")).toBeDefined();
    });
  });

  it("shows empty state when no questions returned", async () => {
    vi.mocked(api.listQuestions).mockResolvedValue({ success: true, data: [] });
    
    render(<QuestionBank />);

    await waitFor(() => {
      expect(screen.getByText(/No questions found/i)).toBeDefined();
    });
  });
});
