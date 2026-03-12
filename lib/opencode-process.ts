export interface OpenCodeProcess extends AsyncDisposable {
  readonly port: number;
  readonly username: string;
  readonly password: string;
  readonly exited: Promise<void>;
}
