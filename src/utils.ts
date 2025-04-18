// src/utils/updateEventEmbed.ts
import { prisma } from './client';
import { EmbedBuilder } from 'discord.js';
import { container } from '@sapphire/framework';

export async function updateEventEmbed(eventId: string) {
	const event = await prisma.event.findUnique({
		where: { id: eventId },
		include: {
			composition: true,
			participants: true
		}
	});

	if (!event || !event.messageId || !event.channelId) return;

	const channel = await container.client.channels.fetch(event.channelId);
	if (!channel?.isTextBased()) return;

	try {
		const message = await channel.messages.fetch(event.messageId);
		const embed = new EmbedBuilder(message.embeds[0].data);

		// Get the role list as an array
		const roles = event.composition.roles.split(', ');

		// Clear existing role fields (keep first 3 base fields)
		embed.spliceFields(3, embed.data.fields?.length || 0);

		// Create a map of participants by role index
		const participantsMap = new Map<number, string>();
		for (const participant of event.participants) {
			const [_, index] = participant.role.split(':');
			participantsMap.set(Number(index), participant.userId);
		}

		// Add role fields with participant status
		roles.forEach((role, index) => {
			const userId = participantsMap.get(index);
			embed.addFields({
				name: `${userId ? '✅' : '⬜'} ${role}`,
				value: userId ? `<@${userId}>` : 'Empty',
				inline: false
			});
		});

		await message.edit({ embeds: [embed] });
	} catch (error) {
		container.logger.error('Embed update error:', error);
	}
}
