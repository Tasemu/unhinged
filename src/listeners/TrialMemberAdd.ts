import { Listener, Events } from '@sapphire/framework';
import type { GuildMember } from 'discord.js';
import { prisma } from '../client';

export class TrialMemberAddListener extends Listener<typeof Events.GuildMemberUpdate> {
	public constructor(context: Listener.LoaderContext, options: Listener.Options) {
		super(context, {
			...options,
			event: Events.GuildMemberUpdate
		});
	}

	public async run(oldMember: GuildMember, newMember: GuildMember) {
		this.container.logger.debug('TrialMemberAddListener');
		// Configure your trial role ID here
		const TRIAL_ROLE_ID = '1345011843059683328';

		// Check if trial role was added
		const newRoles = newMember.roles.cache;
		const oldRoles = oldMember.roles.cache;

		this.container.logger.debug('Old roles:', oldRoles);
		this.container.logger.debug('New roles:', newRoles);

		if (!oldRoles.has(TRIAL_ROLE_ID) && newRoles.has(TRIAL_ROLE_ID)) {
			try {
				// Store in database
				await prisma.trialStart.create({
					data: {
						userId: newMember.id,
						guildId: newMember.guild.id
					}
				});

				this.container.logger.info(`Trial start recorded for ${newMember.user.tag}`);
			} catch (error) {
				this.container.logger.error('Error recording trial start:', error);
			}
		}
	}
}
