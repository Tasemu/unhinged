// src/interaction-handlers/LootSplitHandler.ts
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ActionRowBuilder, ButtonInteraction, MessageFlags, StringSelectMenuBuilder } from 'discord.js';
import { prisma } from '../client';

export class EventSignupHandler extends InteractionHandler {
	public constructor(context: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
		super(context, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button
		});
	}

	public override parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('event-signup:')) return this.none();
		return this.some(interaction.customId.split(':')[1]);
	}

	public async run(interaction: ButtonInteraction, eventId: string) {
		const event = await prisma.event.findUnique({
			where: { id: eventId },
			include: { composition: true, participants: true }
		});

		if (!event) {
			this.container.logger.error('Event not found:', eventId);
			return interaction.reply({
				content: '❌ Event not found.',
				flags: MessageFlags.Ephemeral
			});
		}

		if (!event.composition) {
			this.container.logger.error('Composition not found for event:', eventId);
			return interaction.reply({
				content: '❌ Composition not found for this event.',
				flags: MessageFlags.Ephemeral
			});
		}

		// In your signup interaction handler
		const roles = event.composition.roles.split(', ');
		const availableSlots = roles
			.map((role, index) => ({ role, index }))
			.filter(({ role, index }) => !event.participants.some((p) => p.role === `${role}:${index}`));

		// Create select menu options for available roles
		const options = availableSlots.map(({ role, index }) => ({
			label: role,
			description: `Slot ${index + 1}`,
			value: `${role}:${index}`
		}));

		// Create role selection menu
		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId(`event-role-select:${eventId}`)
			.setOptions(options)
			.setPlaceholder('Select role');

		const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

		// Update response
		return interaction.reply({
			content: `**Event Signup**\nSelect your role:`,
			components: [actionRow],
			flags: MessageFlags.Ephemeral
		});
	}
}
