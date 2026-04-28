import type { HandleErrorFunction } from "react-router";
import { isRouteErrorResponse } from "react-router";

export {
  handleRequest as default,
  streamTimeout,
} from "@vercel/react-router/entry.server";

export const handleError: HandleErrorFunction = (error, { request }) => {
  if (
    request.signal.aborted ||
    (isRouteErrorResponse(error) && error.status === 404)
  ) {
    return;
  }
  console.error(error);
};
