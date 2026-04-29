import { getErrorMessage } from "@openkitten/world-util";
import { toast } from "sonner";

export function toastError(error: unknown) {
  toast.error(getErrorMessage(error));
}
