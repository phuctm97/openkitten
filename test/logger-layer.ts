import { Logger } from "effect";

export const loggerLayer = Logger.replace(Logger.defaultLogger, Logger.none);
