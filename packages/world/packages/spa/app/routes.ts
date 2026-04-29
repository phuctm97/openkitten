import {
  index,
  layout,
  type RouteConfig,
  route,
} from "@react-router/dev/routes";

export default [
  layout("layouts/authenticated.tsx", [
    index("routes/index.tsx"),
    route("app", "routes/app.tsx"),
    route("game", "routes/game.tsx"),
    route("workspace", "routes/workspace.tsx", [
      route("members", "routes/workspace/members.tsx"),
      route("settings", "routes/workspace/settings.tsx"),
    ]),
    route("settings/account", "routes/settings/account.tsx"),
    route("settings/security", "routes/settings/security.tsx"),
    route("accept-invitation", "routes/accept-invitation.tsx"),
  ]),
  route("auth/:path", "routes/auth.tsx"),
  route("auth-callback", "routes/auth-callback.tsx"),
] satisfies RouteConfig;
