// src/interaction-handlers/LeaveEventHandler.ts
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ButtonInteraction, MessageFlags } from 'discord.js';
import { prisma } from '../client';
import { updateEventEmbed } from '../utils';

export class LeaveEventHandler extends InteractionHandler {
	public constructor(context: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
		super(context, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button
		});
	}

	public override parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('event-leave')) return this.none();
		return this.some(interaction.customId.split(':')[1]);
	}

	public async run(interaction: ButtonInteraction, eventId: string) {
		if (!interaction.guild || !interaction.channel) return;

		try {
			// Check if user is signed up
			const participation = await prisma.eventParticipant.findFirst({
				where: {
					eventId: eventId,
					userId: interaction.user.id
				}
			});

			if (!participation) {
				return interaction.reply({
					content: '❌ You are not signed up for this event!',
					flags: MessageFlags.Ephemeral
				});
			}

			// Remove participant
			await prisma.eventParticipant.delete({
				where: { id: participation.id }
			});

			// Update the embed
			await updateEventEmbed(eventId);

			return interaction.reply({
				content: '✅ Successfully removed you from the event!',
				flags: MessageFlags.Ephemeral
			});
		} catch (error) {
			this.container.logger.error('Leave event error:', error);
			return interaction.reply({
				content: '❌ Failed to remove you from the event!',
				flags: MessageFlags.Ephemeral
			});
		}
	}
}
