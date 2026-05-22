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
        if (typeof window !== "undefined") {
          localStorage.setItem("codepad_refresh_token", data.data.refreshToken);
        }
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
      if (typeof window !== "undefined") {
        localStorage.setItem("codepad_refresh_token", response.data.refreshToken);
      }
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
      if (typeof window !== "undefined") {
        localStorage.setItem("codepad_refresh_token", response.data.refreshToken);
      }
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

  async leaveSession(sessionId: string) {
    return this.request<never>(`/api/v1/sessions/${sessionId}/leave`, {
      method: "POST",
    });
  }

  async getLiveKitToken(sessionId: string) {
    return this.request<{ token: string; url: string }>(`/api/v1/sessions/${sessionId}/livekit-token`, {
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

  async createFile(sessionId: string, path: string, content = "") {
    return this.request<FileEntry>(`/api/v1/sessions/${sessionId}/files`, {
      method: "POST",
      body: JSON.stringify({ path, content }),
    });
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

  async executeCodeStream(
    data: {
      sessionId: string;
      language: string;
      files: FileEntry[];
      stdin?: string;
    },
    onEvent: (event: string, parsedData: any) => void
  ) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/api/v1/executions/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      if (response.status === 401) {
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          headers["Authorization"] = `Bearer ${this.accessToken}`;
          const retryResponse = await fetch(`${API_URL}/api/v1/executions/stream`, {
            method: "POST",
            headers,
            body: JSON.stringify(data),
          });
          return this.readStream(retryResponse, onEvent);
        }
        this.clearToken();
      }
      throw new Error(`Execution returned status ${response.status}`);
    }

    return this.readStream(response, onEvent);
  }

  private async readStream(
    response: Response,
    onEvent: (event: string, parsedData: any) => void
  ) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response body is not readable");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const lines = block.split("\n");
        let event = "message";
        let data = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            event = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            data = line.slice(6).trim();
          }
        }

        if (!data) continue;

        try {
          const parsed = JSON.parse(data);
          onEvent(event, parsed);
        } catch (e) {
          console.error("Failed to parse stream event", e);
        }
      }
    }
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
