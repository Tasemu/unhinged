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

export class RegearApprovalHandler extends InteractionHandler {
	public constructor(context: InteractionHandler.LoaderContext) {
		super(context, {
			interactionHandlerType: InteractionHandlerTypes.Button
		});
	}

	public override async parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('regear-')) return this.none();
		this.container.logger.debug(`Parsing regear approval interaction with custom ID ${interaction.customId}`);

		const [action, regearRequestId] = interaction.customId.split(':');
		if (!['regear-approve-100', 'regear-approve-70', 'regear-reject'].includes(action)) return this.none();

		if (!interaction.member) {
			this.container.logger.error('Interaction member not found');
			return this.none();
		}

		return this.some({ action, regearRequestId, member: interaction.member });
	}

	public async run(interaction: ButtonInteraction, data: { action: string; regearRequestId: string; member: GuildMember }) {
		this.container.logger.debug(`Attempting to handle regear request: ${data.regearRequestId}`);

		// Get lootsplit modifier from configuration
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

		const regearRequest = await prisma.regearRequest.findUnique({
			where: { id: data.regearRequestId }
		});

		if (!regearRequest) {
			this.container.logger.error('Regear request not found:', data.regearRequestId);
			return interaction.reply({
				content: '❌ Regear request not found',
				flags: [MessageFlags.Ephemeral]
			});
		}

		const { userId, silver: totalCost } = regearRequest;
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

		this.container.logger.debug(`Handling regear with action ${data.action}`);

		if (data.action === 'regear-approve-100') {
			// Update user's balance
			await prisma.payoutAccount.upsert({
				where: { userId: userId },
				update: { balance: { increment: totalCost } },
				create: { userId: userId, balance: totalCost, guildId: data.member.guild.id }
			});

			// Update the regear request status
			await prisma.regearRequest.update({
				where: { id: data.regearRequestId },
				data: { approved: true }
			});
		} else if (data.action === 'regear-approve-70') {
			// Update user's balance with 70% of the total cost
			const seventyPercent = Math.floor(totalCost * 0.7);
			await prisma.payoutAccount.upsert({
				where: { userId: userId },
				update: { balance: { increment: seventyPercent } },
				create: { userId: userId, balance: seventyPercent, guildId: data.member.guild.id }
			});

			// Update the regear request status
			await prisma.regearRequest.update({
				where: { id: data.regearRequestId },
				data: { approved: true, reduced: true }
			});
		}

		return interaction.update({
			components: updatedComponents
		});
	}
}
