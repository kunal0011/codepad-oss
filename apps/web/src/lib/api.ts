import type { ApiResponse, AuthTokens, Session, ExecutionResult, FileEntry } from "@codepad/shared";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8080";

class ApiClient {
  private accessToken: string | null = null;

  setToken(token: string) {
    this.accessToken = token;
    if (typeof window !== "undefined") {
      localStorage.setItem("codepad_token", token);
    }
  }

  getToken(): string | null {
    if (!this.accessToken && typeof window !== "undefined") {
      this.accessToken = localStorage.getItem("codepad_token");
    }
    return this.accessToken;
  }

  clearToken() {
    this.accessToken = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("codepad_token");
      localStorage.removeItem("codepad_refresh_token");
    }
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    };

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok && response.status === 401) {
      // Try refresh
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${this.accessToken}`;
        const retryResponse = await fetch(`${API_URL}${path}`, { ...options, headers });
        return retryResponse.json();
      }
      this.clearToken();
    }

    return data;
  }

  private async tryRefresh(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    const refreshToken = localStorage.getItem("codepad_refresh_token");
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return false;

      const data: ApiResponse<AuthTokens> = await response.json();
      if (data.success && data.data) {
        this.setToken(data.data.accessToken);
        localStorage.setItem("codepad_refresh_token", data.data.refreshToken);
        return true;
      }
    } catch {
      // Refresh failed
    }
    return false;
  }

  // Auth
  async register(email: string, password: string, name: string) {
    const response = await this.request<AuthTokens>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    if (response.success && response.data) {
      this.setToken(response.data.accessToken);
      localStorage.setItem("codepad_refresh_token", response.data.refreshToken);
    }
    return response;
  }

  async login(email: string, password: string) {
    const response = await this.request<AuthTokens>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (response.success && response.data) {
      this.setToken(response.data.accessToken);
      localStorage.setItem("codepad_refresh_token", response.data.refreshToken);
    }
    return response;
  }

  // Sessions
  async createSession(data: { title: string; language: string; type?: string }) {
    return this.request<Session>("/api/v1/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getSession(id: string) {
    return this.request<Session & { participants: unknown[]; files: FileEntry[] }>(
      `/api/v1/sessions/${id}`,
    );
  }

  async joinSession(code: string) {
    return this.request<{ session: Session }>(`/api/v1/sessions/join/${code}`, {
      method: "POST",
    });
  }

  async listSessions(page = 1, pageSize = 20) {
    return this.request<Session[]>(`/api/v1/sessions?page=${page}&pageSize=${pageSize}`);
  }

  async searchSessions(query: string) {
    return this.request<Session[]>(`/api/v1/sessions/search?q=${encodeURIComponent(query)}`);
  }

  async getSessionFiles(sessionId: string) {
    return this.request<FileEntry[]>(`/api/v1/sessions/${sessionId}/files`);
  }

  // Execution
  async executeCode(data: {
    sessionId: string;
    language: string;
    files: FileEntry[];
    stdin?: string;
  }) {
    return this.request<ExecutionResult>("/api/v1/executions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Assessments
  async listQuestions(filters: any = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request<any[]>(`/api/v1/assessments/questions?${params}`);
  }

  async getQuestion(id: string) {
    return this.request<any>(`/api/v1/assessments/questions/${id}`);
  }

  async createEvaluation(data: any) {
    return this.request<any>("/api/v1/assessments/evaluations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Recordings
  async getRecording(sessionId: string) {
    return this.request<any>(`/api/v1/recordings/session/${sessionId}`);
  }

  async getRecordingUrl(sessionId: string) {
    return this.request<{ url: string }>(`/api/v1/recordings/session/${sessionId}/url`);
  }
}

export const api = new ApiClient();
