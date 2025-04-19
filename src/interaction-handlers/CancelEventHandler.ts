// src/interaction-handlers/LeaveEventHandler.ts
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ButtonInteraction, MessageFlags } from 'discord.js';
import { prisma } from '../client';

export class CancelEventHandler extends InteractionHandler {
	public constructor(context: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
		super(context, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button
		});
	}

	public override parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('event-cancel')) return this.none();
		return this.some(interaction.customId.split(':')[1]);
	}

	public async run(interaction: ButtonInteraction, eventId: string) {
		if (!interaction.guild || !interaction.channel) return;

		try {
			// Check if the person who created the event is the one trying to cancel it
			const event = await prisma.event.findUnique({
				where: { id: eventId }
			});

			if (!event) {
				this.container.logger.error('Event not found:', eventId);
				return interaction.reply({
					content: '❌ Event not found.',
					flags: MessageFlags.Ephemeral
				});
			}

			if (event.userId !== interaction.user.id) {
				return interaction.reply({
					content: '❌ Only the creator of this event can cancel it',
					flags: MessageFlags.Ephemeral
				});
			}

			// Delete the event
			await prisma.event.delete({
				where: { id: eventId }
			});

			// If the event has a messageId in the database, delete the message
			if (event.messageId) {
				const message = await interaction.channel.messages.fetch(event.messageId);
				if (message) {
					await message.delete();
				}
			}

			return interaction.reply({
				content: '✅ Successfully canceled the event!',
				flags: MessageFlags.Ephemeral
			});
		} catch (error) {
			this.container.logger.error('Cancel event error:', error);
			return interaction.reply({
				content: '❌ Failed to cancel the event! contact an officer (Tasemu)',
				flags: MessageFlags.Ephemeral
			});
		}
	}
}
