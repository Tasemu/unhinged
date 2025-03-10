// src/interaction-handlers/LootSplitHandler.ts
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { UserSelectMenuInteraction } from 'discord.js';
import { prisma } from '../client';

export class LootSplitHandler extends InteractionHandler {
	public constructor(context: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
		super(context, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.SelectMenu
		});
	}

	public override parse(interaction: UserSelectMenuInteraction) {
		if (!interaction.customId.startsWith('lootsplit:')) return this.none();
		return this.some(interaction.customId.split(':')[1]);
	}

	public async run(interaction: UserSelectMenuInteraction, sessionId: string) {
		// Get session from database
		const session = await prisma.lootSplitSession.findUnique({
			where: { id: sessionId }
		});

		if (!session || session.expiresAt < new Date()) {
			return interaction.reply({
				content: 'Session expired. Please start over.',
				ephemeral: true
			});
		}

		// Calculate split
		const participants = interaction.users.size;
		const individualShare = session.silver / participants;

		// TODO: Distribute silver to participants

		// Cleanup session
		await prisma.lootSplitSession.delete({
			where: { id: sessionId }
		});

		// Update response
		return interaction.reply({
			content: [
				`**Loot Split Results**`,
				`- Total Silver: ${session.silver.toLocaleString()}`,
				`- Guild Donation: ${session.donated.toLocaleString()}`,
				`- Participants: ${participants} members:`,
				interaction.users.map((user) => `- <@${user.id}>`).join('\n'),
				`- Individual Share: ${individualShare.toLocaleString()} silver`,
				`[View Screenshot](${session.screenshotUrl})`
			].join('\n'),
			components: []
		});
	}
}
