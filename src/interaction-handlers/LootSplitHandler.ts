// src/interaction-handlers/LootSplitHandler.ts
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type UserSelectMenuInteraction } from 'discord.js';
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

		// Get lootsplit modifier from configuration
		const configuration = await prisma.configuration.findUnique({
			where: { guildId: session.guildId }
		});

		if (!configuration || !configuration.lootSplitPercentModifier) {
			this.container.logger.error('No configuration found for guild:', session.guildId);
			return;
		}

		// Calculate split
		const participants = interaction.users.size;
		const silverForGuild = Math.floor(session.silver * configuration.lootSplitPercentModifier);
		const individualShare = silverForGuild / participants + session.donated / participants;

		await prisma.lootSplitSession.update({
			where: { id: sessionId },
			data: {
				participants: interaction.users.map((user) => user.id).join(',')
			}
		});

		// Create approval buttons
		const approvalRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId(`lootsplit-approve:${sessionId}`).setLabel('Approve').setStyle(ButtonStyle.Success).setEmoji('✅'),
			new ButtonBuilder().setCustomId(`lootsplit-reject:${sessionId}`).setLabel('Deny').setStyle(ButtonStyle.Secondary).setEmoji('❌')
		);

		// Update response
		return interaction.reply({
			content: [
				`**Loot Split Results: <@${interaction.user.id}>**`,
				`- Total Silver: ${session.silver.toLocaleString()}`,
				`- Silver Bags: ${session.donated.toLocaleString()}`,
				`- Participants: ${participants} members:`,
				interaction.users.map((user) => `- <@${user.id}>`).join('\n'),
				`- Individual Share: ${individualShare.toLocaleString()} silver`,
				`[View Screenshot](${session.screenshotUrl})`
			].join('\n'),
			components: [approvalRow]
		});
	}
}
