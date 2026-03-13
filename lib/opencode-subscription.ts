export interface OpencodeSubscription extends AsyncDisposable {
  readonly ended: Promise<void>;
}
