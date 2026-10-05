import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/env.js';

describe('parseEnv', () => {
  it('applies defaults when only the token is given', () => {
    expect(parseEnv({ DISCORD_TOKEN: ' token ' })).toEqual({
      token: 'token',
      devGuildId: undefined,
      dataFile: 'data/tickets.json',
      logLevel: 'info',
    });
  });

  it('requires a token', () => {
    expect(() => parseEnv({})).toThrow(/DISCORD_TOKEN is not set/);
    expect(() => parseEnv({ DISCORD_TOKEN: '   ' })).toThrow(/DISCORD_TOKEN is not set/);
  });

  it('treats an empty DEV_GUILD_ID as unset and rejects a malformed one', () => {
    expect(parseEnv({ DISCORD_TOKEN: 't', DEV_GUILD_ID: '' }).devGuildId).toBeUndefined();
    expect(parseEnv({ DISCORD_TOKEN: 't', DEV_GUILD_ID: '123456789012345678' }).devGuildId).toBe(
      '123456789012345678',
    );
    expect(() => parseEnv({ DISCORD_TOKEN: 't', DEV_GUILD_ID: 'my-server' })).toThrow(
      /DEV_GUILD_ID/,
    );
  });

  it('accepts log levels in any case and rejects unknown ones', () => {
    expect(parseEnv({ DISCORD_TOKEN: 't', LOG_LEVEL: 'DEBUG' }).logLevel).toBe('debug');
    expect(() => parseEnv({ DISCORD_TOKEN: 't', LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });
});
