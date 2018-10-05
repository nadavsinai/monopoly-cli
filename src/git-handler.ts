import {
	BranchListSearchResult, DependenciesSearchResult, Logger, RepoApiInterface, repoList, RepoListResults, repoResult
} from "@monopoly/core";
import GitHub from '@octokit/rest'
import get from 'lodash/get'
import groupBy from 'lodash/groupBy'
import transform from 'lodash/transform'
import {ReposGetResponse} from "@octokit/rest";

const gitHub = new GitHub({
	baseUrl: process.env.GHE_URL || 'https://api.github.com',
});

export class GitHandler implements RepoApiInterface {
	async connect(): Promise<boolean> {
		const result = await gitHub.misc.getRateLimit({});
		const limit = get(result.data, ["resources", "core", "remaining"]);
		return limit > 0;
	}

	async getRepo(logger: Logger, filter: { name: string; organization: string }): Promise<repoResult> {
		try {
			const result = await gitHub.repos.get({owner: filter.organization, repo: filter.name});
			if (result.status !== 200) {
				logger.debug(JSON.stringify(result.headers));
				throw new Error(`API response ${result.status}`);
			}
			const repoRef = result.data;
			return {
				status: 'OK', repo: {
					name: repoRef.full_name,
					id: repoRef.name,
					organization: filter.organization,
					url: repoRef.clone_url,
					defaultBranch: repoRef.default_branch
				}
			};
		}
		catch (e) {
			return {status: 'ERROR', message: e.message};
		}
	}

	async list(logger: Logger, filter: { name?: string; organization?: string }, branch: string | undefined, dependencies?: string | boolean): Promise<RepoListResults> {
		try {
			const result = await gitHub.repos.getAll({per_page: 100});
			if (result.status !== 200) {
				logger.debug(JSON.stringify(result.headers));
				throw new Error(`API response ${result.status}`);
			}
			const repoRef = result.data;
			const byOwner = groupBy(repoRef, (repo: ReposGetResponse) => {
				return repo.owner.login;
			});

			const ownerArr = transform(byOwner, (acc: repoList, gitGubRepos: ReposGetResponse[], ownerName: string) => {
				const resRepos = gitGubRepos.map((gitRepo: ReposGetResponse) => {
					return {
						name: gitRepo.name,
						project: gitRepo.owner.login,
						// packageName?: string,
						// deps?: DepInfo
						// devDeps?: DepInfo
						// peerDeps?: DepInfo}
					};
				});
				acc.push({organization: ownerName, repos: resRepos});
				return acc;
			}, []);

			return {
				status: 'OK', repoList: ownerArr
			};
		}
		catch (e) {
			return {status: 'ERROR', message: e.message};
		}


	}

	async listBranches(logger: Logger, project: string, repoName: string, filter?: string): Promise<BranchListSearchResult> {
		return {status: "ERROR", message: 'not implemented yet'};
	}

	async listDependencies(logger: Logger, project: string, repoName: string, branch?: string, dependenciesFilter?: string): Promise<DependenciesSearchResult> {
		return {status: "ERROR", message: 'not implemented yet'};
	}

	setCredentials(username: string, password: string): void {
		gitHub.authenticate({
			type: 'basic',
			username: username,
			password: password
		})
	}
}