import { useState } from "react";
import type { useWorldController } from "~/app/use-world-controller";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";

type WorldSidebarProps = {
  controller: ReturnType<typeof useWorldController>;
};

function WorldSidebar({ controller }: WorldSidebarProps) {
  const [commentDraft, setCommentDraft] = useState("");
  const { state } = controller;
  const selectedCat = controller.selectedCat;
  const selectedThread = controller.selectedThread;
  const selectedCatSessionId = selectedCat?.activeSessionId ?? null;
  const selectedCatThreads =
    selectedCat === null
      ? []
      : state.world.threads.filter((thread) =>
          selectedCat.threadIds.includes(thread.id),
        );
  const selectedThreadSessionId = selectedThread?.sessionId ?? null;

  return (
    <aside className="panel-card">
      <header className="panel-card__header">
        <div>
          <p className="panel-card__eyebrow">OpenKitten World</p>
          <h2 className="panel-card__title">
            {state.focus.kind === "overview"
              ? "House overview"
              : getPanelTitle(state.focus.kind)}
          </h2>
        </div>
        <Button onClick={controller.showOverview} size="sm" variant="outline">
          Overview
        </Button>
      </header>

      {state.focus.kind === "overview" ? (
        <section className="panel-card__body">
          <Badge variant="secondary">Fixed demo slice</Badge>
          <p className="panel-card__lead">{state.world.house.summary}</p>
          <div className="panel-card__cluster">
            <Button onClick={controller.showInbox} size="sm">
              Inbox
            </Button>
            <Button
              onClick={() => {
                controller.showSession(state.world.session.id);
              }}
              size="sm"
              variant="secondary"
            >
              Active session
            </Button>
            <Button
              onClick={() => {
                controller.showThread(state.world.session.threadId);
              }}
              size="sm"
              variant="outline"
            >
              Current thread
            </Button>
          </div>
          <Separator />
          <section className="panel-card__stack">
            <h3 className="panel-card__section-title">Goals</h3>
            {state.world.goals.map((goal) => (
              <article className="panel-card__item" key={goal.id}>
                <div className="panel-card__item-header">
                  <strong>{goal.title}</strong>
                  <Badge variant="outline">{goal.status}</Badge>
                </div>
                <p>{goal.summary}</p>
              </article>
            ))}
          </section>
          <section className="panel-card__stack">
            <h3 className="panel-card__section-title">Cats in the room</h3>
            {state.world.cats.map((cat) => (
              <button
                aria-label={`Open ${cat.name}`}
                className="panel-card__link-card"
                key={cat.id}
                onClick={() => {
                  controller.showCat(cat.id);
                }}
                type="button"
              >
                <strong>{cat.name}</strong>
                <span>{cat.status}</span>
              </button>
            ))}
          </section>
        </section>
      ) : null}

      {state.focus.kind === "cat" && selectedCat ? (
        <section className="panel-card__body">
          <div className="panel-card__stack">
            <h3 className="panel-card__entity-title">{selectedCat.name}</h3>
            <p className="panel-card__lead">{selectedCat.flavor}</p>
          </div>
          <Badge variant="secondary">{selectedCat.role}</Badge>
          <div className="panel-card__meta">
            <div>
              <span>Status</span>
              <strong>{selectedCat.status}</strong>
            </div>
            <div>
              <span>Station</span>
              <strong>{selectedCat.stationLabel}</strong>
            </div>
          </div>
          <section className="panel-card__stack">
            <h3 className="panel-card__section-title">Assigned threads</h3>
            {selectedCatThreads.map((thread) => (
              <button
                aria-label={`${thread.title} ${thread.status}`}
                className="panel-card__link-card"
                key={thread.id}
                onClick={() => {
                  controller.showThread(thread.id);
                }}
                type="button"
              >
                <strong>{thread.title}</strong>
                <span>{thread.status}</span>
              </button>
            ))}
          </section>
          {selectedCatSessionId ? (
            <Button
              onClick={() => {
                controller.showSession(selectedCatSessionId);
              }}
            >
              Open active session
            </Button>
          ) : (
            <div className="panel-card__note">
              Pepper is present in the room but not actively running a session
              right now.
            </div>
          )}
        </section>
      ) : null}

      {state.focus.kind === "inbox" ? (
        <section className="panel-card__body">
          <Badge>{controller.unreadNoticeCount} unread</Badge>
          <p className="panel-card__lead">
            Notices are the House&apos;s calm way of surfacing what deserves
            human attention.
          </p>
          <div className="panel-card__stack">
            {state.world.notices.map((notice) => (
              <article className="panel-card__item" key={notice.id}>
                <div className="panel-card__item-header">
                  <strong>{notice.title}</strong>
                  <Badge variant={notice.isRead ? "outline" : "secondary"}>
                    {notice.isRead ? "Read" : "Unread"}
                  </Badge>
                </div>
                <p>{notice.body}</p>
                <div className="panel-card__inline-actions">
                  <span>{notice.createdAt}</span>
                  <Button
                    onClick={() => {
                      controller.openNotice(notice.id);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Open related work
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {state.focus.kind === "thread" && selectedThread ? (
        <section className="panel-card__body">
          <div className="panel-card__stack">
            <h3 className="panel-card__entity-title">{selectedThread.title}</h3>
            <p className="panel-card__lead">{selectedThread.summary}</p>
          </div>
          <div className="panel-card__item-header">
            <Badge variant="secondary">{selectedThread.status}</Badge>
            <span className="panel-card__fine-print">
              {selectedThread.goalId}
            </span>
          </div>
          <section className="panel-card__meta">
            <div>
              <span>Assignee</span>
              <strong>
                {
                  state.world.cats.find(
                    (cat) => cat.id === selectedThread.assigneeId,
                  )?.name
                }
              </strong>
            </div>
            <div>
              <span>Linked session</span>
              <strong>
                {selectedThread.sessionId ? "Active now" : "No live session"}
              </strong>
            </div>
          </section>
          {selectedThreadSessionId ? (
            <Button
              onClick={() => {
                controller.showSession(selectedThreadSessionId);
              }}
              size="sm"
              variant="outline"
            >
              Open linked session
            </Button>
          ) : null}
          <Separator />
          <section className="panel-card__stack">
            <h3 className="panel-card__section-title">Comments</h3>
            {selectedThread.comments.map((comment) => (
              <article className="panel-card__item" key={comment.id}>
                <div className="panel-card__item-header">
                  <strong>{comment.authorName}</strong>
                  <span className="panel-card__fine-print">
                    {comment.postedAt}
                  </span>
                </div>
                <p>{comment.body}</p>
                <span className="panel-card__fine-print">{comment.tone}</span>
              </article>
            ))}
          </section>
          <section className="panel-card__stack">
            <h3 className="panel-card__section-title">Activity</h3>
            {selectedThread.activities.map((activity) => (
              <article className="panel-card__item" key={activity.id}>
                <strong>{activity.description}</strong>
                <span className="panel-card__fine-print">
                  {activity.happenedAt}
                </span>
              </article>
            ))}
          </section>
          <section className="panel-card__stack">
            <h3 className="panel-card__section-title">Add a comment</h3>
            <label className="panel-card__label" htmlFor="thread-comment">
              Leave one steering note for the House
            </label>
            <textarea
              className="panel-card__textarea"
              disabled={selectedThread.status === "Closed"}
              id="thread-comment"
              onChange={(event) => {
                setCommentDraft(event.currentTarget.value);
              }}
              placeholder="Keep it practical, calm, and useful."
              rows={4}
              value={commentDraft}
            />
            <div className="panel-card__inline-actions">
              <span className="panel-card__fine-print">
                {selectedThread.status === "Closed"
                  ? "Closed threads cannot take new notes in the MVP."
                  : "A new note should visibly stir the room."}
              </span>
              <Button
                disabled={selectedThread.status === "Closed"}
                onClick={() => {
                  controller.addComment(selectedThread.id, commentDraft);

                  if (commentDraft.trim().length > 0) {
                    setCommentDraft("");
                  }
                }}
              >
                Add comment
              </Button>
            </div>
          </section>
        </section>
      ) : null}

      {state.focus.kind === "session" ? (
        <section className="panel-card__body">
          <div className="panel-card__stack">
            <h3 className="panel-card__entity-title">
              Mochi&apos;s active session
            </h3>
            <p className="panel-card__lead">
              {controller.activeSession.locationLabel}
            </p>
          </div>
          <Badge variant="secondary">{controller.activeSession.status}</Badge>
          <div className="panel-card__inline-actions">
            <Button
              onClick={() => {
                controller.showCat(controller.activeSession.catId);
              }}
              size="sm"
              variant="outline"
            >
              Open cat
            </Button>
            <Button
              onClick={() => {
                controller.showThread(controller.activeSession.threadId);
              }}
              size="sm"
              variant="outline"
            >
              Open thread
            </Button>
          </div>
          <section className="panel-card__stack">
            <h3 className="panel-card__section-title">Live transcript</h3>
            {controller.visibleTranscript.map((line) => (
              <article className="panel-card__transcript" key={line.id}>
                <div className="panel-card__item-header">
                  <strong>{line.speaker}</strong>
                  <Badge variant="outline">{line.kind}</Badge>
                </div>
                <p>{line.body}</p>
                <span className="panel-card__fine-print">{line.at}</span>
              </article>
            ))}
            {controller.visibleTranscript.length <
            controller.activeSession.transcript.length ? (
              <div className="panel-card__streaming">
                More transcript lines are still arriving...
              </div>
            ) : null}
          </section>
        </section>
      ) : null}

      {state.focus.kind === "whiteboard" ? (
        <section className="panel-card__body">
          <h3 className="panel-card__entity-title">
            {state.world.whiteboard.title}
          </h3>
          <Badge variant="secondary">Visible prop</Badge>
          <p className="panel-card__lead">
            The whiteboard is lightly inspectable in the MVP and keeps active
            house cues close by.
          </p>
          <section className="panel-card__stack">
            {state.world.whiteboard.cues.map((cue) => (
              <article className="panel-card__item" key={cue}>
                <strong>{cue}</strong>
              </article>
            ))}
          </section>
        </section>
      ) : null}

      {state.focus.kind === "cabinet" ? (
        <section className="panel-card__body">
          <h3 className="panel-card__entity-title">
            {state.world.cabinet.title}
          </h3>
          <Badge variant="secondary">Visible prop</Badge>
          <p className="panel-card__lead">
            The cabinet is lightly inspectable too, just enough to make the room
            feel like a real workspace.
          </p>
          <section className="panel-card__stack">
            {state.world.cabinet.files.map((file) => (
              <article className="panel-card__item" key={file.id}>
                <div className="panel-card__item-header">
                  <strong>{file.name}</strong>
                  <span className="panel-card__fine-print">File</span>
                </div>
                <p>{file.note}</p>
              </article>
            ))}
          </section>
        </section>
      ) : null}
    </aside>
  );
}

function getPanelTitle(
  kind: WorldSidebarProps["controller"]["state"]["focus"]["kind"],
) {
  if (kind === "cat") {
    return "Cat detail";
  }

  if (kind === "thread") {
    return "Thread view";
  }

  if (kind === "session") {
    return "Session view";
  }

  if (kind === "inbox") {
    return "Inbox";
  }

  if (kind === "whiteboard") {
    return "Whiteboard";
  }

  return "Cabinet";
}

export { WorldSidebar };
