export interface OpenCodeProcess extends AsyncDisposable {
  readonly port: number;
  readonly exited: Promise<void>;
}
