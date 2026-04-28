const value = process.env.OPENKITTEN_PASSKEY_ENABLED;

export const isPasskeyEnabled = value === "1" || value === "true";
