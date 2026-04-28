const value = process.env.OPENKITTEN_MAGIC_LINK_ENABLED;

export const isMagicLinkEnabled = value === "1" || value === "true";
