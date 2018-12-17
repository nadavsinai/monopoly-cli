#!/usr/bin/env node

import monopoly from "@monopoly/core";
import {GitHandler} from "./git-handler";
import {LoginCommandFactory, GithubAuthHandler} from './github-auth.handler';

const {version} = require('../package.json');

(async function () {
	const authHandler = new GithubAuthHandler();
	const cli = await monopoly(new GitHandler(authHandler), {name: 'mp', description: 'Monopoly (Github) workspace CLI', version}, authHandler);
	LoginCommandFactory(cli, authHandler);
	cli.parse(process.argv) // run the monopoly cli;
}());
