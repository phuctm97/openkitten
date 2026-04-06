import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import Component from "~/app/routes/index";

type MockSceneProps = {
  onShowCabinet: () => void;
  onShowCat: (catId: string) => void;
  onShowInbox: () => void;
  onShowThread: (threadId: string) => void;
  onShowWhiteboard: () => void;
  reactionMessage: string | null;
  unreadNoticeCount: number;
};

const routeMocks = vi.hoisted(() => ({
  houseScene: vi.fn((props: MockSceneProps) => {
    return (
      <section data-testid="mock-scene">
        <p>{`Scene unread: ${props.unreadNoticeCount}`}</p>
        <p>{`Scene reaction: ${props.reactionMessage ?? "quiet"}`}</p>
        <button onClick={() => props.onShowInbox()} type="button">
          Scene inbox
        </button>
        <button onClick={() => props.onShowCat("cat-mochi")} type="button">
          Scene Mochi
        </button>
        <button onClick={() => props.onShowCat("cat-pepper")} type="button">
          Scene Pepper
        </button>
        <button
          onClick={() => props.onShowThread("thread-pricing")}
          type="button"
        >
          Scene thread
        </button>
        <button onClick={() => props.onShowWhiteboard()} type="button">
          Scene whiteboard
        </button>
        <button onClick={() => props.onShowCabinet()} type="button">
          Scene cabinet
        </button>
      </section>
    );
  }),
}));

vi.mock("~/app/world/house-scene", () => ({
  HouseScene: routeMocks.houseScene,
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

test("renders the Lantern House overview and quick actions", () => {
  render(<Component />);

  expect(screen.getByText("Lantern House")).toBeInTheDocument();
  expect(
    screen.getByText("A warm study where serious async work feels alive."),
  ).toBeInTheDocument();
  expect(screen.getByText("House overview")).toBeInTheDocument();
  expect(screen.getByText("Scene unread: 2")).toBeInTheDocument();
  expect(screen.getByText("Ship a human pricing review")).toBeInTheDocument();

  const inboxButtons = screen.getAllByRole("button", { name: "Inbox" });
  const inboxButton =
    inboxButtons[1] ?? screen.getByRole("button", { name: "Inbox" });

  fireEvent.click(inboxButton);

  expect(
    screen.getByText(
      "Notices are the House's calm way of surfacing what deserves human attention.",
    ),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  fireEvent.click(screen.getByRole("button", { name: "Current thread" }));

  expect(screen.getByText("Thread view")).toBeInTheDocument();
  expect(
    screen.getByText("Pricing review for launch page"),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Open linked session" }));
  expect(screen.getByText("Mochi's active session")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Open cat" }));
  expect(screen.getByText("Mochi")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  fireEvent.click(screen.getByRole("button", { name: "Watch session" }));
  expect(screen.getByText("Session view")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  fireEvent.click(screen.getByRole("button", { name: "Active session" }));
  expect(screen.getByText("Mochi's active session")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  fireEvent.click(screen.getByRole("button", { name: "Open Mochi" }));
  expect(screen.getByText("Cat detail")).toBeInTheDocument();
});

test("navigates through the MVP flow, streams the session, and reacts to a new comment", () => {
  render(<Component />);

  fireEvent.click(screen.getByRole("button", { name: "Scene Mochi" }));

  expect(screen.getByText("Cat detail")).toBeInTheDocument();
  expect(screen.getByText("Research cat")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Open active session" }));

  expect(screen.getByText("Session view")).toBeInTheDocument();
  expect(screen.getByText("Live transcript")).toBeInTheDocument();
  expect(
    screen.getByText("More transcript lines are still arriving..."),
  ).toBeInTheDocument();

  act(() => {
    vi.advanceTimersByTime(3_600);
  });

  expect(
    screen.getByText(
      "Preparing a recommendation that explains the tradeoff in plain language for Mina.",
    ),
  ).toBeInTheDocument();

  act(() => {
    vi.advanceTimersByTime(1_200);
  });

  expect(
    screen.queryByText("More transcript lines are still arriving..."),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Open thread" }));

  expect(screen.getByText("Thread view")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
  expect(screen.queryByText("just now")).not.toBeInTheDocument();

  fireEvent.change(
    screen.getByLabelText("Leave one steering note for the House"),
    {
      target: {
        value: "Keep the recommendation plain and welcoming.",
      },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Add comment" }));

  expect(
    screen.getByText("Keep the recommendation plain and welcoming."),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "Scene reaction: Pricing review for launch page stirred the room.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByDisplayValue("")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  fireEvent.click(screen.getByRole("button", { name: "Scene whiteboard" }));
  expect(screen.getByText("Whiteboard")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  fireEvent.click(screen.getByRole("button", { name: "Scene cabinet" }));
  expect(screen.getByText("Cabinet")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  fireEvent.click(screen.getByRole("button", { name: "Scene inbox" }));
  const relatedWorkButtons = screen.getAllByRole("button", {
    name: "Open related work",
  });
  fireEvent.click(
    relatedWorkButtons[0] ??
      screen.getByRole("button", { name: "Open related work" }),
  );
  expect(
    screen.getByText("Pricing review for launch page"),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  fireEvent.click(screen.getByRole("button", { name: "Scene Pepper" }));
  expect(
    screen.getByText(
      "Pepper is present in the room but not actively running a session right now.",
    ),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "First-run house onboarding Open" }),
  );
  expect(screen.getByText("No live session")).toBeInTheDocument();
});

test("shows the closed thread comment guardrail", () => {
  render(<Component />);

  fireEvent.click(screen.getByRole("button", { name: "Scene Mochi" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Post-launch check-in rhythm Closed" }),
  );

  expect(
    screen.getByText("Closed threads cannot take new notes in the MVP."),
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText("Leave one steering note for the House"),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "Add comment" })).toBeDisabled();
});
