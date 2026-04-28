const value = process.env.OPENKITTEN_LOCAL;

export const isLocal = value === "1" || value === "true";
