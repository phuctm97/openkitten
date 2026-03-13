export interface Shutdown extends Disposable {
  readonly signaled: Promise<void>;
}
