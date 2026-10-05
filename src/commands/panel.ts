import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  channelMention,
} from 'discord.js';
import { UserError } from '../errors.js';
import { panelMessage } from '../tickets/ui.js';
import type { Command } from './types.js';

const DEFAULT_DESCRIPTION =
  'Need a hand? Press the button below to open a private ticket with the support team.';

export const panelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Post the message members use to open a ticket.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Where to post the panel (defaults to this channel)')
        .addChannelTypes(ChannelType.GuildText),
    )
    .addStringOption((option) =>
      option.setName('title').setDescription('Heading shown on the panel').setMaxLength(100),
    )
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('Text shown under the heading')
        .setMaxLength(1000),
    ),

  async execute(interaction, ctx) {
    ctx.tickets.requireSettings(interaction.guildId);

    const channel =
      interaction.options.getChannel('channel', false, [ChannelType.GuildText]) ??
      interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new UserError('Panels can only be posted in a regular text channel.');
    }

    const me = await interaction.guild.members.fetchMe();
    const missing = channel
      .permissionsFor(me)
      .missing([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
      ]);
    if (missing.length > 0) {
      throw new UserError(
        `I cannot post in ${channelMention(channel.id)}. Missing: ${missing.join(', ')}.`,
      );
    }

    await channel.send(
      panelMessage(
        interaction.options.getString('title') ?? `${interaction.guild.name} Support`,
        interaction.options.getString('description') ?? DEFAULT_DESCRIPTION,
      ),
    );
    await interaction.reply({
      content: `Panel posted in ${channelMention(channel.id)}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
