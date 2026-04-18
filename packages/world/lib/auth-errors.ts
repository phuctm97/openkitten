import { toast } from "sonner";

type AuthErrorLike = {
  error?: {
    message?: string;
  };
  message?: string;
};

type QueryErrorLike = {
  error?: {
    message?: string;
  };
};

export function getAuthErrorMessage(error: AuthErrorLike) {
  return error.error?.message ?? error.message;
}

export function toastAuthError(error: AuthErrorLike) {
  const message = getAuthErrorMessage(error);

  if (message) {
    toast.error(message);
  }
}

export function toastQueryError(error: QueryErrorLike) {
  const message = error.error?.message;

  if (message) {
    toast.error(message);
  }

  return false;
}
