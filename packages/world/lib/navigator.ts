import type { NavigateOptions, To } from "react-router";

export interface Navigator {
  navigate: (to: To, options?: NavigateOptions) => void | Promise<void>;
}
