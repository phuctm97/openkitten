export class UpgradeOpenkittenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpgradeOpenkittenError";
  }
}
