import { ErrorState } from "~/components/error-state";
import { Button } from "~/components/ui/button";

export default function NotFound() {
  return (
    <ErrorState
      badge="404"
      message="Not Found"
      details="The page you are looking for does not exist or may have moved."
      reload={
        <form className="contents">
          <Button type="submit">Reload Page</Button>
        </form>
      }
    />
  );
}
