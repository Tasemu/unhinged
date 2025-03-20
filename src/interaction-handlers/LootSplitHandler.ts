// src/interaction-handlers/LootSplitHandler.ts
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, MessageFlags } from 'discord.js';
import { prisma } from '../client';

export class LootSplitHandler extends InteractionHandler {
	public constructor(context: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
		super(context, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button
		});
	}

	public override parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('lootsplit-confirm:')) return this.none();
		return this.some(interaction.customId.split(':')[1]);
	}

	public async run(interaction: ButtonInteraction, sessionId: string) {
		// Get session from database
		const session = await prisma.lootSplitSession.findUnique({
			where: { id: sessionId }
		});

		if (!session) {
			return interaction.reply({
				content: 'Lootsplit does not exist',
				flags: [MessageFlags.Ephemeral]
			});
		}

		if (!session.participants) {
			return interaction.reply({
				content: 'No participants found',
				flags: [MessageFlags.Ephemeral]
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
		const participants = session.participants.split(',');
		const silverForGuild = Math.floor(session.silver * configuration.lootSplitPercentModifier);
		const individualShare = silverForGuild / participants.length + session.donated / participants.length;

		// Create approval buttons
		const approvalRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId(`lootsplit-approve:${sessionId}`).setLabel('Approve').setStyle(ButtonStyle.Success).setEmoji('✅'),
			new ButtonBuilder().setCustomId(`lootsplit-reject:${sessionId}`).setLabel('Deny').setStyle(ButtonStyle.Secondary).setEmoji('❌')
		);

		// Update response
		return interaction.reply({
			content: [
				`**Loot Split Results: <@${interaction.user.id}>**`,
				`- Session ID: ${sessionId}`,
				`- Total Silver: ${session.silver.toLocaleString()}`,
				`- Silver Bags: ${session.donated.toLocaleString()}`,
				`- Participants: ${participants.length}`,
				`- members:`,
				participants.map((id) => `- <@${id}>`).join('\n'),
				`- Individual Share: ${individualShare.toLocaleString()} silver`,
				`[View Screenshot](${session.screenshotUrl})`
			].join('\n'),
			components: [approvalRow]
		});
	}
}
