import {
  PermissionFlagsBits,
  type PermissionOverwriteOptions,
  type PermissionsBitField,
  type PermissionsString,
} from 'discord.js';
import { UserError } from '../errors.js';
import type { GuildSettings, Ticket } from './store.js';

export const TICKET_ACCESS_OVERWRITE: PermissionOverwriteOptions = {
  ViewChannel: true,
  SendMessages: true,
  ReadMessageHistory: true,
  AttachFiles: true,
  EmbedLinks: true,
};

export const TICKET_ACCESS = Object.keys(TICKET_ACCESS_OVERWRITE) as PermissionsString[];

// what the bot itself needs in the ticket category
export const BOT_PERMISSIONS = [
  'ViewChannel',
  'ManageChannels',
  'ManageRoles',
  'SendMessages',
  'EmbedLinks',
  'AttachFiles',
  'ReadMessageHistory',
] as const satisfies readonly PermissionsString[];

export const LOG_CHANNEL_PERMISSIONS = [
  'ViewChannel',
  'SendMessages',
  'EmbedLinks',
  'AttachFiles',
] as const satisfies readonly PermissionsString[];

// only the parts of GuildMember we actually use, makes these easy to test
export interface MemberLike {
  id: string;
  permissions: Readonly<PermissionsBitField>;
  roles: { cache: { has(roleId: string): boolean } };
}

export function isStaff(member: MemberLike, settings: GuildSettings): boolean {
  return (
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.roles.cache.has(settings.supportRoleId)
  );
}

export function assertStaff(member: MemberLike, settings: GuildSettings): void {
  if (!isStaff(member, settings)) {
    throw new UserError('Only the support team can do that.');
  }
}

// claiming needs the actual support role, having Manage Server isn't enough
export function assertCanClaim(member: MemberLike, settings: GuildSettings): void {
  if (!member.roles.cache.has(settings.supportRoleId)) {
    throw new UserError('Only members with the support role can claim a ticket.');
  }
}

export function assertCanClose(member: MemberLike, ticket: Ticket, settings: GuildSettings): void {
  if (member.id !== ticket.openerId && !isStaff(member, settings)) {
    throw new UserError('Only the person who opened this ticket or the support team can close it.');
  }
}
