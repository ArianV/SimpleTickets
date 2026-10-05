import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  TimestampStyles,
  roleMention,
  time,
  userMention,
} from 'discord.js';
import { formatTicketNumber } from './naming.js';
import type { GuildSettings, Ticket } from './store.js';

export const BRAND_COLOR = 0xe93020;

export const CustomId = {
  OpenTicket: 'ticket:open',
  OpenTicketModal: 'ticket:open:modal',
  Claim: 'ticket:claim',
  Close: 'ticket:close',
  CloseConfirm: 'ticket:close:confirm',
  CloseCancel: 'ticket:close:cancel',
} as const;

export const ModalField = {
  Subject: 'subject',
  Description: 'description',
} as const;

export function ticketLabel(ticket: Ticket): string {
  return `Ticket #${formatTicketNumber(ticket.number)}`;
}

export function notice(text: string): EmbedBuilder {
  return new EmbedBuilder().setColor(BRAND_COLOR).setDescription(text);
}

export function panelMessage(title: string, description: string) {
  const button = new ButtonBuilder()
    .setCustomId(CustomId.OpenTicket)
    .setLabel('Open a ticket')
    .setEmoji('🎫')
    .setStyle(ButtonStyle.Primary);

  return {
    embeds: [new EmbedBuilder().setColor(BRAND_COLOR).setTitle(title).setDescription(description)],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
  };
}

export function openTicketModal(): ModalBuilder {
  const subject = new TextInputBuilder()
    .setCustomId(ModalField.Subject)
    .setLabel('What do you need help with?')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(true);

  const description = new TextInputBuilder()
    .setCustomId(ModalField.Description)
    .setLabel('Details')
    .setPlaceholder('Anything that helps the team help you faster.')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setRequired(false);

  return new ModalBuilder()
    .setCustomId(CustomId.OpenTicketModal)
    .setTitle('Open a ticket')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(subject),
      new ActionRowBuilder<TextInputBuilder>().addComponents(description),
    );
}

export function welcomeMessage(ticket: Ticket, settings: GuildSettings, description: string) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`${ticketLabel(ticket)} - ${ticket.subject}`)
    .setDescription(description || '*No further details were given.*')
    .addFields({ name: 'Opened by', value: userMention(ticket.openerId), inline: true })
    .setFooter({ text: 'Someone from the support team will be with you shortly.' })
    .setTimestamp(ticket.createdAt);

  const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CustomId.Claim)
      .setLabel('Claim')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CustomId.Close)
      .setLabel('Close')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
  );

  return {
    content: `${userMention(ticket.openerId)} ${roleMention(settings.supportRoleId)}`,
    allowedMentions: { users: [ticket.openerId], roles: [settings.supportRoleId] },
    embeds: [embed],
    components: [controls],
  };
}

export function closeConfirmation() {
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CustomId.CloseConfirm)
      .setLabel('Close ticket')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(CustomId.CloseCancel)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );

  return {
    content: 'Close this ticket? The channel is deleted and a transcript is saved.',
    components: [buttons],
  };
}

export function closedEmbed(
  ticket: Ticket,
  closedById: string,
  closedAt: Date,
  reason: string | null,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`${ticketLabel(ticket)} closed`)
    .addFields(
      { name: 'Subject', value: ticket.subject },
      { name: 'Opened by', value: userMention(ticket.openerId), inline: true },
      { name: 'Closed by', value: userMention(closedById), inline: true },
      {
        name: 'Claimed by',
        value: ticket.claimedBy ? userMention(ticket.claimedBy) : 'Nobody',
        inline: true,
      },
      {
        name: 'Opened',
        value: time(new Date(ticket.createdAt), TimestampStyles.ShortDateTime),
        inline: true,
      },
      { name: 'Reason', value: reason ?? 'No reason given' },
    )
    .setTimestamp(closedAt);
}
