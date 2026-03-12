export interface Exit extends Disposable {
  readonly exited: Promise<void>;
}
