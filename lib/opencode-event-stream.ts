export interface OpencodeEventStream extends AsyncDisposable {
  readonly ended: Promise<void>;
}
