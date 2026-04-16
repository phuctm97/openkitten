import { ErrorState } from "~/components/error-state";
import { ThemeAnchor } from "~/components/theme-anchor";

export default function NotFound() {
  return (
    <>
      <ThemeAnchor />
      <ErrorState
        badge="404"
        message="Not Found"
        details="The page you are looking for does not exist or may have moved."
      />
    </>
  );
}
