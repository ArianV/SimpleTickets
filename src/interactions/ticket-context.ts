import {
  ChannelType,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type TextChannel,
} from 'discord.js';
import type { AppContext } from '../context.js';
import { UserError } from '../errors.js';
import type { GuildSettings, Ticket } from '../tickets/store.js';

export interface TicketContext {
  channel: TextChannel;
  ticket: Ticket;
  settings: GuildSettings;
}

export function requireTicketContext(
  interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
  ctx: AppContext,
): TicketContext {
  const channel = interaction.channel;
  const ticket = ctx.store.getTicket(interaction.channelId);
  const settings = ctx.store.getSettings(interaction.guildId);

  if (!channel || channel.type !== ChannelType.GuildText || !ticket || !settings) {
    throw new UserError('This only works inside an open ticket.');
  }
  return { channel, ticket, settings };
}
