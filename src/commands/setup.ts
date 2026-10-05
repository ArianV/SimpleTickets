import {
  ChannelType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  channelMention,
  roleMention,
} from 'discord.js';
import { UserError } from '../errors.js';
import { BOT_PERMISSIONS, LOG_CHANNEL_PERMISSIONS } from '../tickets/permissions.js';
import { BRAND_COLOR } from '../tickets/ui.js';
import type { Command } from './types.js';

export const setupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Choose where tickets are created and who handles them.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((option) =>
      option
        .setName('category')
        .setDescription('Category that new ticket channels are created in')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true),
    )
    .addRoleOption((option) =>
      option
        .setName('support_role')
        .setDescription('Role that can see and manage every ticket')
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName('log_channel')
        .setDescription('Channel that closed tickets and their transcripts are posted to')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('max_open_tickets')
        .setDescription('How many tickets one member may have open at once (default 1)')
        .setMinValue(1)
        .setMaxValue(5),
    ),

  async execute(interaction, ctx) {
    const category = interaction.options.getChannel('category', true, [ChannelType.GuildCategory]);
    const supportRole = interaction.options.getRole('support_role', true);
    const logChannel = interaction.options.getChannel('log_channel', true, [ChannelType.GuildText]);
    const maxOpenTickets =
      interaction.options.getInteger('max_open_tickets') ??
      ctx.store.getSettings(interaction.guildId)?.maxOpenTickets ??
      1;

    if (supportRole.id === interaction.guild.roles.everyone.id) {
      throw new UserError('The support role cannot be @everyone, or every ticket would be public.');
    }

    ctx.store.saveSettings(interaction.guildId, {
      categoryId: category.id,
      supportRoleId: supportRole.id,
      logChannelId: logChannel.id,
      maxOpenTickets,
    });

    const me = await interaction.guild.members.fetchMe();
    const problems = [
      ...category
        .permissionsFor(me)
        .missing(BOT_PERMISSIONS)
        .map((permission) => `\`${permission}\` in ${channelMention(category.id)}`),
      ...logChannel
        .permissionsFor(me)
        .missing(LOG_CHANNEL_PERMISSIONS)
        .map((permission) => `\`${permission}\` in ${channelMention(logChannel.id)}`),
    ];

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('Tickets are set up')
      .setDescription('Run `/panel` in the channel where members should open tickets.')
      .addFields(
        { name: 'Category', value: channelMention(category.id), inline: true },
        { name: 'Support role', value: roleMention(supportRole.id), inline: true },
        { name: 'Log channel', value: channelMention(logChannel.id), inline: true },
        { name: 'Open tickets per member', value: String(maxOpenTickets), inline: true },
      );
    if (problems.length > 0) {
      embed.addFields({
        name: '⚠️ I am missing permissions',
        value: problems.map((problem) => `- ${problem}`).join('\n'),
      });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
