import { lazy, Suspense } from "react";

const ReactQueryDevtools = lazy(() =>
  import("@tanstack/react-query-devtools").then((module) => ({
    default: module.ReactQueryDevtools,
  })),
);

export function Devtools() {
  return (
    <Suspense>
      <ReactQueryDevtools />
    </Suspense>
  );
}
