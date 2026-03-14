import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ParticipantsSidebar } from "./ParticipantsSidebar";
import { useSessionStore } from "@/stores/session";
import { ParticipantRole } from "@codepad/shared";

describe("ParticipantsSidebar", () => {
  it("renders participants list", () => {
    useSessionStore.setState({
      participants: [
        {
          userId: "user-1",
          name: "Alice",
          color: "#FF0000",
          role: ParticipantRole.OWNER,
          isConnected: true,
        },
        {
          userId: "user-2",
          name: "Bob",
          color: "#00FF00",
          role: ParticipantRole.EDITOR,
          isConnected: false,
        },
      ],
    });

    render(<ParticipantsSidebar />);

    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("Bob")).toBeDefined();
    expect(screen.getByText("owner")).toBeDefined();
    expect(screen.getByText("editor")).toBeDefined();
  });

  it("renders empty state", () => {
    useSessionStore.setState({ participants: [] });
    render(<ParticipantsSidebar />);
    expect(screen.getByText(/Participants \(0\)/i)).toBeDefined();
  });
});
