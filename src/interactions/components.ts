import {
  MessageFlags,
  channelMention,
  userMention,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import type { AppContext } from '../context.js';
import { assertCanClaim, assertCanClose } from '../tickets/permissions.js';
import { CustomId, ModalField, closeConfirmation, notice, openTicketModal } from '../tickets/ui.js';
import { requireTicketContext } from './ticket-context.js';

export async function handleButton(
  interaction: ButtonInteraction<'cached'>,
  ctx: AppContext,
): Promise<void> {
  switch (interaction.customId) {
    case CustomId.OpenTicket: {
      // check first so they don't fill in the form for nothing
      ctx.tickets.assertCanOpen(interaction.guild, interaction.user.id);
      await interaction.showModal(openTicketModal());
      return;
    }
    case CustomId.Claim: {
      const { ticket, settings } = requireTicketContext(interaction, ctx);
      assertCanClaim(interaction.member, settings);
      ctx.tickets.claim(ticket, interaction.user.id);
      await interaction.reply({
        embeds: [notice(`🙋 ${userMention(interaction.user.id)} is now handling this ticket.`)],
      });
      return;
    }
    case CustomId.Close: {
      const { ticket, settings } = requireTicketContext(interaction, ctx);
      assertCanClose(interaction.member, ticket, settings);
      await interaction.reply({ ...closeConfirmation(), flags: MessageFlags.Ephemeral });
      return;
    }
    case CustomId.CloseConfirm: {
      const { channel, ticket, settings } = requireTicketContext(interaction, ctx);
      assertCanClose(interaction.member, ticket, settings);
      await interaction.update({ content: 'Closing this ticket...', components: [] });
      await ctx.tickets.close(channel, ticket, settings, interaction.user, null);
      return;
    }
    case CustomId.CloseCancel: {
      await interaction.update({ content: 'Okay, the ticket stays open.', components: [] });
      return;
    }
  }
}

export async function handleModal(
  interaction: ModalSubmitInteraction<'cached'>,
  ctx: AppContext,
): Promise<void> {
  if (interaction.customId !== CustomId.OpenTicketModal) return;

  // making the channel can take longer than the 3 seconds discord gives us to reply
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const channel = await ctx.tickets.open(interaction.guild, interaction.user, {
    subject: interaction.fields.getTextInputValue(ModalField.Subject).trim(),
    description: interaction.fields.getTextInputValue(ModalField.Description).trim(),
  });
  await interaction.editReply(`Your ticket is ready: ${channelMention(channel.id)}`);
}
