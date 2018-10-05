#!/usr/bin/env node

import monopoly from "@monopoly/core";
import {GitHandler} from "./git-handler";

const {version} = require('../package.json');

(async function () {
	const cli = await monopoly(new GitHandler(), {name: 'mp', description: 'Monopoly (Github) workspace CLI', version});
	cli.parse(process.argv) // run the monopoly cli;
}());
