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
  ]),
  route("auth/:path", "routes/auth.tsx"),
  route("auth-callback", "routes/auth-callback.tsx"),
] satisfies RouteConfig;
