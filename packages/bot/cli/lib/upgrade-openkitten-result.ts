export type UpgradeOpenkittenResult =
  | { readonly kind: "up-to-date"; readonly sha: string }
  | {
      readonly kind: "restarting";
      readonly previousSha: string;
      readonly nextSha: string;
    };
