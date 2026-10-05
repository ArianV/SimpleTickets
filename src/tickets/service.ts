import {
  AttachmentBuilder,
  ChannelType,
  DiscordAPIError,
  OverwriteType,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  RateLimitError,
  TimestampStyles,
  channelMention,
  escapeMarkdown,
  time,
  userMention,
  type Guild,
  type GuildMember,
  type MessageCreateOptions,
  type TextChannel,
  type User,
} from 'discord.js';
import { UserError } from '../errors.js';
import type { Logger } from '../logger.js';
import { collectMessages } from './history.js';
import { formatTicketNumber, renamedChannelName, ticketChannelName } from './naming.js';
import { TICKET_ACCESS, TICKET_ACCESS_OVERWRITE, isStaff } from './permissions.js';
import type { GuildSettings, Ticket, TicketStore } from './store.js';
import { renderTranscript } from './transcript.js';
import { closedEmbed, ticketLabel, welcomeMessage } from './ui.js';

export interface TicketDetails {
  subject: string;
  description: string;
}

const MAX_TOPIC_LENGTH = 1024;

function isMissingPermissions(error: unknown): boolean {
  return (
    error instanceof DiscordAPIError &&
    (error.code === RESTJSONErrorCodes.MissingPermissions ||
      error.code === RESTJSONErrorCodes.MissingAccess)
  );
}

export class TicketService {
  // guildId:userId of tickets being created right now (stops double submits)
  private readonly opening = new Set<string>();
  private readonly store: TicketStore;
  private readonly logger: Logger;

  constructor(store: TicketStore, logger: Logger) {
    this.store = store;
    this.logger = logger;
  }

  requireSettings(guildId: string): GuildSettings {
    const settings = this.store.getSettings(guildId);
    if (!settings) {
      throw new UserError(
        'Tickets are not set up on this server yet. An admin needs to run `/setup` first.',
      );
    }
    return settings;
  }

  assertCanOpen(guild: Guild, userId: string): GuildSettings {
    const settings = this.requireSettings(guild.id);

    const open: Ticket[] = [];
    for (const ticket of this.store.openTicketsFor(guild.id, userId)) {
      if (guild.channels.cache.has(ticket.channelId)) {
        open.push(ticket);
      } else {
        // channel got deleted while the bot was offline
        this.store.removeTicket(ticket.channelId);
      }
    }

    if (open.length >= settings.maxOpenTickets) {
      const channels = open.map((ticket) => channelMention(ticket.channelId)).join(', ');
      throw new UserError(
        settings.maxOpenTickets === 1
          ? `You already have an open ticket: ${channels}`
          : `You can have up to ${settings.maxOpenTickets} tickets open at once: ${channels}`,
      );
    }
    return settings;
  }

  async open(guild: Guild, opener: User, details: TicketDetails): Promise<TextChannel> {
    const lock = `${guild.id}:${opener.id}`;
    if (this.opening.has(lock)) {
      throw new UserError('Your ticket is already being created.');
    }
    this.opening.add(lock);

    try {
      const settings = this.assertCanOpen(guild, opener.id);
      if (guild.channels.cache.get(settings.categoryId)?.type !== ChannelType.GuildCategory) {
        throw new UserError(
          'The ticket category no longer exists. An admin needs to run `/setup` again.',
        );
      }

      const subject = details.subject || 'No subject';
      const number = this.store.nextTicketNumber(guild.id);
      const me = await guild.members.fetchMe();

      let channel: TextChannel;
      try {
        channel = await guild.channels.create({
          name: ticketChannelName(number),
          type: ChannelType.GuildText,
          parent: settings.categoryId,
          topic:
            `Ticket #${formatTicketNumber(number)} | ${userMention(opener.id)} | ${subject}`.slice(
              0,
              MAX_TOPIC_LENGTH,
            ),
          reason: `Ticket opened by ${opener.tag}`,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              type: OverwriteType.Role,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            { id: settings.supportRoleId, type: OverwriteType.Role, allow: TICKET_ACCESS },
            { id: opener.id, type: OverwriteType.Member, allow: TICKET_ACCESS },
            { id: me.id, type: OverwriteType.Member, allow: TICKET_ACCESS },
          ],
        });
      } catch (error) {
        if (isMissingPermissions(error)) {
          throw new UserError(
            'I am missing permissions in the ticket category. An admin can run `/setup` to see which.',
          );
        }
        throw error;
      }

      const ticket = this.store.addTicket({
        channelId: channel.id,
        guildId: guild.id,
        number,
        openerId: opener.id,
        subject,
        createdAt: Date.now(),
      });

      try {
        await channel.send(welcomeMessage(ticket, settings, details.description));
      } catch (error) {
        // no welcome message means no buttons, so clean up instead of leaving a broken ticket
        this.store.removeTicket(channel.id);
        await channel.delete('Ticket setup failed').catch(() => undefined);
        throw error;
      }

      this.logger.info(`${ticketLabel(ticket)} opened by ${opener.tag} in ${guild.name}`);
      return channel;
    } finally {
      this.opening.delete(lock);
    }
  }

  claim(ticket: Ticket, staffId: string): void {
    if (this.store.claim(ticket.channelId, staffId)) return;

    const claimedBy = this.store.getTicket(ticket.channelId)?.claimedBy;
    if (!claimedBy) throw new UserError('This ticket no longer exists.');
    throw new UserError(
      claimedBy === staffId
        ? 'You have already claimed this ticket.'
        : `This ticket is already claimed by ${userMention(claimedBy)}.`,
    );
  }

  async addMember(channel: TextChannel, member: GuildMember, actor: User): Promise<void> {
    if (channel.permissionsFor(member).has(PermissionFlagsBits.ViewChannel)) {
      throw new UserError(`${userMention(member.id)} can already see this ticket.`);
    }
    await channel.permissionOverwrites.edit(member, TICKET_ACCESS_OVERWRITE, {
      reason: `Added to ticket by ${actor.tag}`,
    });
  }

  async removeMember(
    channel: TextChannel,
    ticket: Ticket,
    settings: GuildSettings,
    member: GuildMember,
    actor: User,
  ): Promise<void> {
    if (member.id === ticket.openerId) {
      throw new UserError('The person who opened the ticket cannot be removed. Close it instead.');
    }
    if (member.id === channel.client.user.id) {
      throw new UserError('I have to stay in the ticket to manage it.');
    }
    if (isStaff(member, settings)) {
      throw new UserError(
        `${userMention(member.id)} is on the support team and sees every ticket through their role.`,
      );
    }
    if (!channel.permissionOverwrites.cache.has(member.id)) {
      throw new UserError(`${userMention(member.id)} was never added to this ticket.`);
    }
    await channel.permissionOverwrites.delete(member, `Removed from ticket by ${actor.tag}`);
  }

  async rename(channel: TextChannel, requestedName: string, actor: User): Promise<string> {
    const name = renamedChannelName(requestedName);
    if (name === channel.name) throw new UserError('This ticket already has that name.');

    try {
      await channel.setName(name, `Renamed by ${actor.tag}`);
    } catch (error) {
      // see rejectOnRateLimit in index.ts
      if (error instanceof RateLimitError) {
        const retryAt = new Date(Date.now() + error.retryAfter);
        throw new UserError(
          `Discord only allows a channel to be renamed twice every 10 minutes. Try again ${time(retryAt, TimestampStyles.RelativeTime)}.`,
        );
      }
      throw error;
    }
    return name;
  }

  async close(
    channel: TextChannel,
    ticket: Ticket,
    settings: GuildSettings,
    closedBy: User,
    reason: string | null,
  ): Promise<void> {
    if (!this.store.beginClose(channel.id)) {
      throw new UserError('This ticket is already being closed.');
    }

    try {
      const closedAt = new Date();
      const transcript = await this.buildTranscript(channel, ticket, closedBy, closedAt, reason);
      const files = () =>
        transcript
          ? [
              new AttachmentBuilder(transcript, {
                name: `transcript-${formatTicketNumber(ticket.number)}.html`,
              }),
            ]
          : [];

      await this.postToLogChannel(channel, settings, {
        embeds: [closedEmbed(ticket, closedBy.id, closedAt, reason)],
        files: files(),
      });
      await this.notifyOpener(channel, ticket, {
        embeds: [
          closedEmbed(ticket, closedBy.id, closedAt, reason).setDescription(
            `Your ticket in **${escapeMarkdown(channel.guild.name)}** was closed.`,
          ),
        ],
        files: files(),
      });

      await channel.delete(`Ticket closed by ${closedBy.tag}`);
      this.store.removeTicket(channel.id);
      this.logger.info(`${ticketLabel(ticket)} closed by ${closedBy.tag} in ${channel.guild.name}`);
    } catch (error) {
      this.store.abortClose(channel.id);
      throw error;
    }
  }

  // if the transcript fails we still want the ticket to close, so this never throws
  private async buildTranscript(
    channel: TextChannel,
    ticket: Ticket,
    closedBy: User,
    closedAt: Date,
    reason: string | null,
  ): Promise<Buffer | null> {
    try {
      const [messages, opener] = await Promise.all([
        collectMessages(channel),
        channel.client.users.fetch(ticket.openerId).catch(() => null),
      ]);
      const html = renderTranscript(
        {
          guildName: channel.guild.name,
          ticketLabel: ticketLabel(ticket),
          subject: ticket.subject,
          openedBy: opener?.tag ?? ticket.openerId,
          closedBy: closedBy.tag,
          closedAt,
          reason,
        },
        messages,
      );
      return Buffer.from(html, 'utf8');
    } catch (error) {
      this.logger.warn(`Could not build a transcript for #${channel.name}`, error);
      return null;
    }
  }

  private async postToLogChannel(
    channel: TextChannel,
    settings: GuildSettings,
    message: MessageCreateOptions,
  ): Promise<void> {
    const logChannel = channel.guild.channels.cache.get(settings.logChannelId);
    if (!logChannel || logChannel.type !== ChannelType.GuildText) {
      this.logger.warn(`Log channel is missing in ${channel.guild.name}; run /setup again.`);
      return;
    }
    try {
      await logChannel.send(message);
    } catch (error) {
      this.logger.warn(`Could not post to the log channel in ${channel.guild.name}`, error);
    }
  }

  private async notifyOpener(
    channel: TextChannel,
    ticket: Ticket,
    message: MessageCreateOptions,
  ): Promise<void> {
    try {
      await channel.client.users.send(ticket.openerId, message);
    } catch {
      // they probably have DMs turned off, nothing we can do
      this.logger.debug(`Could not DM the opener of ${ticketLabel(ticket)}`);
    }
  }
}
