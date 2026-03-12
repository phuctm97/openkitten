export interface OpenCode extends AsyncDisposable {
  readonly port: number;
  readonly exited: Promise<void>;
}
