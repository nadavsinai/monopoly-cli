import {BaseCommand, CliTool, AuthHandler, Logger} from '@monopoly/core';
import * as clortho from 'clortho';
import * as username from 'username';
import {gitHub} from './git-handler';

export interface Credentials {
	username: string;
	password: string;
}

export const SERVICE_NAME = 'monopoly-CLI';
const loginPrompt = clortho.forService(SERVICE_NAME);

const usernameFromOS = process.env.MP_USER ? process.env.MP_USER as string : (username.sync() || '').toLowerCase();

export class GithubAuthHandler extends BaseCommand implements AuthHandler {
	protected inProgress: boolean = false;

	async doLogin(): Promise<any> {
		let credentials: Credentials = {username: '', password: ''};
		try {
			if (process.env.MP_USER && process.env.MP_PASSWORD) {
				credentials = {username: process.env.MP_USER as string, password: process.env.MP_PASSWORD as string};
				console.warn('Using environment credentials!')
			} else {
				credentials = await loginPrompt.getFromKeychain(usernameFromOS);
			}
		} catch (e) {
			this.debug('did not get credentials from OS');
		}
		const {username, password} = credentials;
		if (username && password) {
			this.debug('username:' + username, 'password:' + password);
			return gitHub.authenticate({
				type: 'token',
				token: password
			});
		} else {
			throw new Error('Not logged in to monopoly, please run login command')
		}


	}

	getHandler<ARGS = any, OPTS = any>(...args: any[]) {
		return async (p1: ARGS, p2: OPTS, p3: Logger) => {
			this.inProgress = true;
			const credentials = await loginPrompt.prompt(usernameFromOS, `Hi, To use Monopoly cli we need to get a way to access your github information \nthe easiest way is for you to create a personal token - you can make one at http://github.com/settings/tokens , we need repo permissions only.\nPlease enter it here`, true);
			const {username, password} = credentials;
			try {
				const success = await loginPrompt.saveToKeychain(username, password);
				if (!success) {
					throw new Error('could not save credentials to OS keychain');
				} else {
					this.info('credentials saved successfully!');
				}
			} catch (e) {
				this.debug(e);
				this.warn(e.message);
			}
		}
	};

	logout() {
		return loginPrompt.removeFromKeychain(usernameFromOS);
	}
}

export function LoginCommandFactory(cli: CliTool, authHandler: AuthHandler) {
	cli.command('logout', 'removes username and password storage').action(authHandler.logout);
	cli.command('login', 'Handle user login for monopoly').action(authHandler.getHandler());
	return authHandler;
}
