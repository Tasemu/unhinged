import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonComponent,
	ButtonInteraction,
	ComponentType,
	GuildMember,
	GuildMemberRoleManager,
	MessageFlags
} from 'discord.js';
import { prisma } from '../client';

export class LootSplitApprovalHandler extends InteractionHandler {
	public constructor(context: InteractionHandler.LoaderContext) {
		super(context, {
			interactionHandlerType: InteractionHandlerTypes.Button
		});
	}

	public override async parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('lootsplit-')) return this.none();
		this.container.logger.debug(`Parsing loot split approval interaction with custom ID ${interaction.customId}`);

		const [action, sessionId] = interaction.customId.split(':');
		if (!['lootsplit-approve', 'lootsplit-reject'].includes(action)) return this.none();

		if (!interaction.member) {
			this.container.logger.error('Member not found');
			return this.none();
		}

		return this.some({ action, sessionId, member: interaction.member });
	}

	public async run(interaction: ButtonInteraction, data: { action: string; sessionId: string; member: GuildMember }) {
		this.container.logger.debug(`Attempting to handle loot split session ${data.sessionId}`);

		const session = await prisma.lootSplitSession.findUnique({
			where: { id: data.sessionId }
		});

		if (!session) {
			return interaction.reply({
				content: '❌ Split no longer exists',
				flags: [MessageFlags.Ephemeral]
			});
		}

		// Get lootsplit modifier from configuration
		const configuration = await prisma.configuration.findUnique({
			where: { guildId: session.guildId }
		});

		if (!configuration || !configuration.lootSplitAuthRoleId || !configuration.lootSplitPercentModifier) {
			this.container.logger.error('No configuration found for guild:', session.guildId);
			return interaction.reply({
				content: '❌ Lootsplit auth role not set',
				flags: [MessageFlags.Ephemeral]
			});
		}

		const roles = (data.member.roles as GuildMemberRoleManager).cache;

		if (!roles.has(configuration.lootSplitAuthRoleId)) {
			return interaction.reply({
				content: '❌ Only officers can approve splits!',
				flags: [MessageFlags.Ephemeral]
			});
		}

		// Get the original message components
		const message = await interaction.channel?.messages.fetch(interaction.message.id);
		if (!message) return;

		// Update the component mapping with proper type guards
		const updatedComponents = message.components.map((row) => {
			return new ActionRowBuilder<ButtonBuilder>().addComponents(
				row.components
					.filter((component) => {
						const buttonComponent = component as ButtonComponent;
						return component.type === ComponentType.Button && buttonComponent.customId === interaction.customId;
					})
					.map((component) => {
						const buttonComponent = component as ButtonComponent;
						const button = ButtonBuilder.from(buttonComponent);

						// Disable the button
						button.setDisabled(true);

						// Handle potential null label
						const originalLabel = buttonComponent.label ?? 'Unknown Action';
						button.setLabel(originalLabel.replace('Approve', 'Approved').replace('Deny', 'Denied'));

						return button;
					})
			);
		});

		this.container.logger.debug(`Handling loot split session with action ${data.action}`);

		if (data.action === 'lootsplit-approve') {
			if (!session.participants) {
				return interaction.reply({
					content: '❌ No participants found',
					flags: [MessageFlags.Ephemeral]
				});
			}

			const participantIds = session.participants.split(',');

			const silverForGuild = Math.floor(session.silver * configuration.lootSplitPercentModifier);
			const individualShare = silverForGuild / participantIds.length + session.donated / participantIds.length;

			// Process payments
			await prisma.$transaction([
				prisma.lootSplitSession.update({
					where: { id: data.sessionId },
					data: { approved: true }
				}),
				...participantIds.map((userId: string) =>
					prisma.payoutAccount.upsert({
						where: { userId },
						update: { balance: { increment: individualShare } },
						create: { userId, balance: individualShare, guildId: session.guildId }
					})
				)
			]);
		}

		return interaction.update({
			components: updatedComponents
		});
	}
}
