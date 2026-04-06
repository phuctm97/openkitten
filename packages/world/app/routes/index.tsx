import { WorldSidebar } from "~/app/panels/world-sidebar";
import { useWorldController } from "~/app/use-world-controller";
import { HouseScene } from "~/app/world/house-scene";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export default function Component() {
  const controller = useWorldController();

  return (
    <section className="house-grid">
      <article className="house-shell">
        <header className="house-shell__header">
          <div className="house-shell__title-wrap">
            <Badge variant="secondary">
              {controller.state.world.house.mood}
            </Badge>
            <h2 className="house-shell__title">
              {controller.state.world.house.name}
            </h2>
            <p className="house-shell__summary">
              {controller.state.world.house.tagline}
            </p>
          </div>

          <div className="house-shell__actions">
            <Button onClick={controller.showInbox} size="sm" variant="outline">
              Inbox
            </Button>
            <Button
              onClick={() => {
                controller.showSession(controller.activeSession.id);
              }}
              size="sm"
              variant="secondary"
            >
              Watch session
            </Button>
          </div>
        </header>

        <HouseScene
          onShowCabinet={controller.showCabinet}
          onShowCat={controller.showCat}
          onShowInbox={controller.showInbox}
          onShowThread={controller.showThread}
          onShowWhiteboard={controller.showWhiteboard}
          reactionMessage={controller.activeReaction?.message ?? null}
          spotlightCatId={controller.spotlightCatId}
          spotlightThreadId={controller.spotlightThreadId}
          unreadNoticeCount={controller.unreadNoticeCount}
          world={controller.state.world}
          worldClock={controller.state.worldClock}
        />
      </article>

      <WorldSidebar controller={controller} />
    </section>
  );
}
