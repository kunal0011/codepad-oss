import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CodeEditor } from "./CodeEditor";
import { useSessionStore } from "@/stores/session";

// Mock Monaco Editor
vi.mock("@monaco-editor/react", () => ({
  default: vi.fn(() => <div data-testid="monaco-editor" />),
}));

// Mock Yjs and providers
vi.mock("yjs", () => ({
  Doc: vi.fn(() => ({
    getText: vi.fn(() => ({
      observe: vi.fn(),
    })),
    destroy: vi.fn(),
  })),
}));

vi.mock("y-websocket", () => ({
  WebsocketProvider: vi.fn(() => ({
    on: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    awareness: {
      on: vi.fn(),
    },
  })),
}));

vi.mock("y-monaco", () => ({
  MonacoBinding: vi.fn(() => ({
    destroy: vi.fn(),
  })),
}));

describe("CodeEditor", () => {
  it("renders loading state when disconnected", () => {
    // Force disconnected state in store
    useSessionStore.setState({ isConnected: false, files: [{ path: "main.py", content: "", isEntryPoint: true }] });
    
    render(<CodeEditor sessionId="test" language="python" token="test-token" />);
    
    expect(screen.getByText(/Connecting to session/i)).toBeDefined();
  });

  it("renders editor when connected", () => {
    useSessionStore.setState({ isConnected: true, files: [{ path: "main.py", content: "", isEntryPoint: true }] });
    
    render(<CodeEditor sessionId="test" language="python" token="test-token" />);
    
    expect(screen.getByTestId("monaco-editor")).toBeDefined();
    expect(screen.queryByText(/Connecting to session/i)).toBeNull();
  });
});
