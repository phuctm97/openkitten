export interface ExitHook extends Disposable {
  readonly exited: Promise<void>;
}
