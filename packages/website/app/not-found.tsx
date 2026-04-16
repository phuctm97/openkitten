import { ErrorState } from "~/components/error-state";

export default function NotFound() {
  return (
    <ErrorState
      badge="404"
      message="Not Found"
      details="The page you are looking for does not exist or may have moved."
    />
  );
}
