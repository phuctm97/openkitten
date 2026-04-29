import {
  index,
  layout,
  type RouteConfig,
  route,
} from "@react-router/dev/routes";

export default [
  layout("layouts/authenticated.tsx", [
    index("routes/index.tsx"),
    route("app", "routes/app.tsx", [
      index("routes/app/overview.tsx"),
      route("cats", "routes/app/cats.tsx"),
      route("goals", "routes/app/goals.tsx"),
      route("threads", "routes/app/threads.tsx"),
      route("inbox", "routes/app/inbox.tsx"),
      route("memos", "routes/app/memos.tsx"),
      route("rules", "routes/app/rules.tsx"),
    ]),
    route("game", "routes/game.tsx"),
    route("workspace", "routes/workspace.tsx", [
      route("members", "routes/workspace/members.tsx"),
      route("settings", "routes/workspace/settings.tsx"),
    ]),
    route("settings", "routes/settings.tsx", [
      route("account", "routes/settings/account.tsx"),
      route("security", "routes/settings/security.tsx"),
    ]),
    route("accept-invitation", "routes/accept-invitation.tsx"),
  ]),
  route("auth/:path", "routes/auth.tsx"),
  route("auth-callback", "routes/auth-callback.tsx"),
] satisfies RouteConfig;
