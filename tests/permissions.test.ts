import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { UserError } from '../src/errors.js';
import {
  assertCanClaim,
  assertCanClose,
  assertStaff,
  isStaff,
  type MemberLike,
} from '../src/tickets/permissions.js';
import type { GuildSettings, Ticket } from '../src/tickets/store.js';

const settings: GuildSettings = {
  categoryId: 'category',
  supportRoleId: 'support-role',
  logChannelId: 'log',
  maxOpenTickets: 1,
};

const ticket: Ticket = {
  channelId: 'channel',
  guildId: 'guild',
  number: 1,
  openerId: 'opener',
  subject: 'Help',
  claimedBy: null,
  createdAt: 0,
  closing: false,
};

function member(id: string, roles: string[] = [], permissions: bigint[] = []): MemberLike {
  return {
    id,
    permissions: new PermissionsBitField(permissions),
    roles: { cache: new Set(roles) },
  };
}

describe('isStaff', () => {
  it('accepts members with the support role', () => {
    expect(isStaff(member('a', ['support-role']), settings)).toBe(true);
  });

  it('accepts members who can manage the server, even without the role', () => {
    expect(isStaff(member('a', [], [PermissionFlagsBits.ManageGuild]), settings)).toBe(true);
  });

  it('rejects everyone else', () => {
    expect(isStaff(member('a', ['some-other-role']), settings)).toBe(false);
    expect(() => assertStaff(member('a'), settings)).toThrow(UserError);
  });
});

describe('assertCanClaim', () => {
  it('lets members with the support role claim', () => {
    expect(() => assertCanClaim(member('a', ['support-role']), settings)).not.toThrow();
  });

  it('stops the person who opened the ticket', () => {
    expect(() => assertCanClaim(member('opener'), settings)).toThrow(UserError);
  });

  it('stops admins who do not have the support role', () => {
    const admin = member('a', [], [PermissionFlagsBits.ManageGuild]);
    expect(() => assertCanClaim(admin, settings)).toThrow(UserError);
  });
});

describe('assertCanClose', () => {
  it('lets the opener close their own ticket', () => {
    expect(() => assertCanClose(member('opener'), ticket, settings)).not.toThrow();
  });

  it('lets staff close any ticket', () => {
    expect(() => assertCanClose(member('a', ['support-role']), ticket, settings)).not.toThrow();
  });

  it('stops other members, such as someone added to the ticket', () => {
    expect(() => assertCanClose(member('guest'), ticket, settings)).toThrow(UserError);
  });
});
