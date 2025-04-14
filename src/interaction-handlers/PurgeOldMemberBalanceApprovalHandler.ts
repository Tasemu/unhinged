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

export class PurgeOldMemberBalanceApprovalHandler extends InteractionHandler {
	public constructor(context: InteractionHandler.LoaderContext) {
		super(context, {
			interactionHandlerType: InteractionHandlerTypes.Button
		});
	}

	public override async parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('purge-all-')) return this.none();
		this.container.logger.debug(`Parsing purge old members accounts interaction with custom ID ${interaction.customId}`);

		const action = interaction.customId;
		if (!['purge-all-approve', 'purge-all-deny'].includes(action)) return this.none();

		if (!interaction.member) {
			this.container.logger.error('Interaction member not found');
			return this.none();
		}

		return this.some({ action, member: interaction.member });
	}

	public async run(interaction: ButtonInteraction, data: { action: string; member: GuildMember }) {
		const roles = (data.member.roles as GuildMemberRoleManager).cache;

		const configuration = await prisma.configuration.findUnique({
			where: { guildId: data.member.guild.id }
		});

		if (!configuration || !configuration.lootSplitAuthRoleId) {
			this.container.logger.error('No configuration found for guild:', data.member.guild.id);
			return interaction.reply({
				content: '❌ Lootsplit auth role not set',
				flags: [MessageFlags.Ephemeral]
			});
		}

		if (!roles.has(configuration.lootSplitAuthRoleId)) {
			return interaction.reply({
				content: '❌ Only officers can approve purges!',
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
						button.setLabel(originalLabel.replace('Purge', 'Purged').replace('Cancel', 'Canceled'));

						return button;
					})
			);
		});

		this.container.logger.debug(`Handling total purge of old accounts action ${data.action}`);

		if (data.action === 'purge-all-approve') {
			try {
				const activeMembers = await data.member.guild.members.fetch();
				const activeMemberIds = activeMembers.keys();

				await prisma.payoutAccount.deleteMany({
					where: {
						guildId: data.member.guild.id,
						userId: { notIn: Array.from(activeMemberIds) }
					}
				});
			} catch (error) {
				this.container.logger.error('Error purging accounts:', error);
				return interaction.reply({
					content: '❌ An error occurred while purging accounts.',
					flags: [MessageFlags.Ephemeral]
				});
			}
		}

		return interaction.update({
			components: updatedComponents
		});
	}
}
