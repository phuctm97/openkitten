import { getErrorMessage } from "@openkitten/world-util";
import { TriangleAlertIcon } from "lucide-react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";

export interface QueryErrorAlertProps {
  error: unknown;
  isRefetching: boolean;
  onRetry: () => void;
  title?: string;
  className?: string;
}

export function QueryErrorAlert({
  error,
  isRefetching,
  onRetry,
  title = "Something went wrong",
  className,
}: QueryErrorAlertProps) {
  return (
    <Alert variant="destructive" className={className}>
      <TriangleAlertIcon className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{getErrorMessage(error)}</AlertDescription>
      <AlertAction>
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={isRefetching}
        >
          {isRefetching && <Spinner />}
          Retry
        </Button>
      </AlertAction>
    </Alert>
  );
}
