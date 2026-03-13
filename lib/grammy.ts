export interface Grammy extends AsyncDisposable {
  readonly stopped: Promise<void>;
}
