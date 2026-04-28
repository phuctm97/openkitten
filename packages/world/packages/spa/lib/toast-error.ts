import { toast } from "sonner";
import { formatError } from "~/lib/format-error";

export function toastError(error: unknown) {
  toast.error(formatError(error));
}
