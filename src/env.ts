import { isLogLevel, type LogLevel } from './logger.js';

export interface Env {
  token: string;
  devGuildId: string | undefined;
  dataFile: string;
  logLevel: LogLevel;
}

const SNOWFLAKE = /^\d{17,20}$/;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const token = source.DISCORD_TOKEN?.trim();
  if (!token) {
    throw new Error('DISCORD_TOKEN is not set. Copy .env.example to .env and add your bot token.');
  }

  const devGuildId = source.DEV_GUILD_ID?.trim() || undefined;
  if (devGuildId !== undefined && !SNOWFLAKE.test(devGuildId)) {
    throw new Error(`DEV_GUILD_ID must be a Discord server ID, got "${devGuildId}".`);
  }

  const logLevel = source.LOG_LEVEL?.trim().toLowerCase() || 'info';
  if (!isLogLevel(logLevel)) {
    throw new Error(`LOG_LEVEL must be one of debug, info, warn or error, got "${logLevel}".`);
  }

  return {
    token,
    devGuildId,
    dataFile: source.DATA_FILE?.trim() || 'data/tickets.json',
    logLevel,
  };
}

export function loadEnvOrExit(): Env {
  try {
    process.loadEnvFile();
  } catch (error) {
    // no .env is fine, the vars might already be set in the environment
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  try {
    return parseEnv(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
