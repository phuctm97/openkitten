import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toastError } from "~/lib/toast-error";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      toastError(error);
    },
  }),
  defaultOptions: {
    mutations: {
      onError: (error) => {
        toastError(error);
      },
    },
  },
});
