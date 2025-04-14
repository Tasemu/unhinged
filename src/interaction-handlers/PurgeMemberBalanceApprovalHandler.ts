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

export class PurgeMemberBalanceApprovalHandler extends InteractionHandler {
	public constructor(context: InteractionHandler.LoaderContext) {
		super(context, {
			interactionHandlerType: InteractionHandlerTypes.Button
		});
	}

	public override async parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('purge-balance-')) return this.none();
		this.container.logger.debug(`Parsing purge member balance interaction with custom ID ${interaction.customId}`);

		const [action, userId] = interaction.customId.split(':');
		if (!['purge-balance-approve', 'purge-balance-deny'].includes(action)) return this.none();

		if (!interaction.member) {
			this.container.logger.error('Interaction member not found');
			return this.none();
		}

		return this.some({ action, userId, member: interaction.member });
	}

	public async run(interaction: ButtonInteraction, data: { action: string; userId: string; member: GuildMember }) {
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

		this.container.logger.debug(`Handling balance purge with action ${data.action}`);

		if (data.action === 'purge-balance-approve') {
			// Update user's balance
			await prisma.payoutAccount.delete({
				where: {
					userId: data.userId,
					guildId: data.member.guild.id
				}
			});
		}

		return interaction.update({
			components: updatedComponents
		});
	}
}
