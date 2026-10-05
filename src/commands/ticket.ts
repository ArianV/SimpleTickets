import { InteractionContextType, SlashCommandBuilder, userMention } from 'discord.js';
import { UserError } from '../errors.js';
import { requireTicketContext } from '../interactions/ticket-context.js';
import { assertCanClaim, assertCanClose, assertStaff } from '../tickets/permissions.js';
import { notice } from '../tickets/ui.js';
import type { Command } from './types.js';

export const ticketCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage the ticket you are in.')
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Give a member access to this ticket.')
        .addUserOption((option) =>
          option.setName('member').setDescription('Member to add').setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription("Take away a member's access to this ticket.")
        .addUserOption((option) =>
          option.setName('member').setDescription('Member to remove').setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('rename')
        .setDescription("Rename this ticket's channel.")
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('New name, for example "billing"')
            .setMaxLength(90)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('claim')
        .setDescription('Mark yourself as the person handling this ticket.'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('close')
        .setDescription('Close this ticket and save a transcript.')
        .addStringOption((option) =>
          option.setName('reason').setDescription('Why the ticket is closed').setMaxLength(500),
        ),
    ),

  async execute(interaction, ctx) {
    const { channel, ticket, settings } = requireTicketContext(interaction, ctx);
    const actor = interaction.user;

    const requireMemberOption = () => {
      const member = interaction.options.getMember('member');
      if (!member) throw new UserError('That user is not a member of this server.');
      return member;
    };

    switch (interaction.options.getSubcommand()) {
      case 'add': {
        assertStaff(interaction.member, settings);
        const member = requireMemberOption();
        await ctx.tickets.addMember(channel, member, actor);
        await interaction.reply({
          content: userMention(member.id),
          embeds: [notice(`${userMention(member.id)} was added by ${userMention(actor.id)}.`)],
          allowedMentions: { users: [member.id] },
        });
        return;
      }
      case 'remove': {
        assertStaff(interaction.member, settings);
        const member = requireMemberOption();
        await ctx.tickets.removeMember(channel, ticket, settings, member, actor);
        await interaction.reply({
          embeds: [notice(`${userMention(member.id)} was removed by ${userMention(actor.id)}.`)],
        });
        return;
      }
      case 'rename': {
        assertStaff(interaction.member, settings);
        const requested = interaction.options.getString('name', true);
        const name = await ctx.tickets.rename(channel, requested, actor);
        await interaction.reply({
          embeds: [notice(`Ticket renamed to **${name}** by ${userMention(actor.id)}.`)],
        });
        return;
      }
      case 'claim': {
        assertCanClaim(interaction.member, settings);
        ctx.tickets.claim(ticket, actor.id);
        await interaction.reply({
          embeds: [notice(`🙋 ${userMention(actor.id)} is now handling this ticket.`)],
        });
        return;
      }
      case 'close': {
        assertCanClose(interaction.member, ticket, settings);
        const reason = interaction.options.getString('reason');
        await interaction.reply({
          embeds: [notice(`🔒 Ticket closed by ${userMention(actor.id)}. Saving a transcript...`)],
        });
        await ctx.tickets.close(channel, ticket, settings, actor, reason);
        return;
      }
    }
  },
};
