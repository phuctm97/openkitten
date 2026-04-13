import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("app", "routes/app.tsx"),
  route("game", "routes/game.tsx"),
] satisfies RouteConfig;
