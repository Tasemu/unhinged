// src/interaction-handlers/LootSplitHandler.ts
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { prisma } from '../client';
import { updateEventEmbed } from '../utils';

export class EventRoleSelectHandler extends InteractionHandler {
	public constructor(context: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
		super(context, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.SelectMenu
		});
	}

	public override parse(interaction: StringSelectMenuInteraction) {
		if (!interaction.customId.startsWith('event-role-select:')) return this.none();
		return this.some({
			eventId: interaction.customId.split(':')[1],
			roleName: interaction.values[0].split(':')[0],
			roleIndex: interaction.values[0].split(':')[1]
		});
	}

	public async run(
		interaction: StringSelectMenuInteraction,
		{ eventId, roleName, roleIndex }: { eventId: string; roleName: string; roleIndex: string }
	) {
		try {
			const event = await prisma.event.findUnique({
				where: { id: eventId },
				include: { composition: true }
			});

			if (!event) {
				this.container.logger.error('Event not found:', eventId);
				return interaction.reply({
					content: '❌ Event not found.',
					flags: MessageFlags.Ephemeral
				});
			}

			// Check if the user is already signed up for the event
			const existingSignup = await prisma.eventParticipant.findFirst({
				where: {
					eventId: eventId,
					userId: interaction.user.id
				}
			});

			if (existingSignup) {
				return interaction.reply({
					content: '❌ You are already signed up for this event.',
					flags: MessageFlags.Ephemeral
				});
			}

			// Create a new event participant
			await prisma.eventParticipant.create({
				data: {
					eventId: eventId,
					userId: interaction.user.id,
					role: `${roleName}:${roleIndex}`
				}
			});

			await updateEventEmbed(eventId);

			// Update response
			return interaction.reply({
				content: `**Event Signup**\nYou have successfully signed up for the event with role ${interaction.values[0]}.`,
				flags: MessageFlags.Ephemeral
			});
		} catch (error) {
			this.container.logger.error('Error updating event participants:', error);
			return interaction.reply({
				content: '❌ Error updating event participants.',
				flags: MessageFlags.Ephemeral
			});
		}
	}
}
