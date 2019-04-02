import {
	AuthHandler,
	BranchListSearchResult,
	DependenciesSearchResult,
	Logger,
	RepoApiInterface,
	repoList,
	RepoListResults,
	repoResult
} from "@monopoly/core";
import GitHub, {AnyResponse, ReposGetResponse} from '@octokit/rest'
import groupBy from 'lodash/groupBy'
import transform from 'lodash/transform'

export const gitHub = new GitHub({
	baseUrl: process.env.GHE_URL || 'https://api.github.com',
});

export class GitHandler implements RepoApiInterface {
	constructor(protected authHandler: AuthHandler) {
	}

	connect() {
		return this.authHandler.doLogin();
	}

	async getRepo(logger: Logger, filter: { name: string; organization: string }): Promise<repoResult> {
		try {
			await this.connect();
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
		} catch (e) {
			return {status: 'ERROR', message: e.message};
		}
	}

	async getPackageJson(logger: Logger, owner: string, repo: string, branch?: string): Promise<any> {
		try {
			const info: GitHub.ReposGetContentsParams = {owner, repo, path: '/package.json'};
			if (branch) {
				info.ref = branch;
			}
			logger.debug('trying to get pjson for :' + JSON.stringify(info));
			const response = await gitHub.repos.getContents(info);
			const data = this.handleResponse(logger, response);
			const json = Buffer.from(data.content, 'base64').toString('utf8');
			return JSON.parse(json);
		} catch (e) {
			throw new Error(`could not get Package.json for repo ${repo} - ${e.message}`);
		}
	}

	async list(logger: Logger, filter: { name?: string; organization?: string }, branch: string | undefined, dependencies?: string | boolean): Promise<RepoListResults> {
		try {
			await this.connect();
			const result = await gitHub.repos.list({per_page: Number.MAX_SAFE_INTEGER});
			let repoRef = this.handleResponse(logger, result);
			if (filter) {
				repoRef = repoRef.filter((repo: ReposGetResponse) => {
					let passed = false;
					if (filter.name) {
						passed = repo.name.includes(filter.name);
					}
					if (filter.organization) {
						passed = repo.owner.login.includes(filter.organization);
					}
					return passed
				})
			}
			if (dependencies) {
				repoRef = await Promise.all(repoRef.map(async (repo: ReposGetResponse & { dependencies?: any }) => {
					repo.dependencies = await ((typeof dependencies === 'string') ? this.getDependencies(logger, repo.owner.login, repo.name, dependencies as string) : this.getDependencies(logger, repo.owner.login, repo.name));
					return repo;
				}))
			}
			const byOwner = groupBy(repoRef, (repo: ReposGetResponse) => {
				return repo.owner.login;
			});

			const ownerArr = transform(byOwner, (acc: repoList, gitHubRepos: Array<ReposGetResponse & { dependencies?: any }>, ownerName: string) => {
				const resRepos = gitHubRepos.map((gitRepo: ReposGetResponse & { dependencies?: any }) => {
					return (dependencies && gitRepo.dependencies) ? {
						name: gitRepo.name,
						project: gitRepo.owner.login,
						packageName: gitRepo.dependencies.packageName,
						deps: gitRepo.dependencies.dependencies,
						devDeps: gitRepo.dependencies.devDependencies,
						peerDeps: gitRepo.dependencies.peerDependencies
					} : {
						name: gitRepo.name,
						project: gitRepo.owner.login,
					};
				});
				acc.push({organization: ownerName, repos: resRepos});
				return acc;
			}, []);

			return {
				status: 'OK', repoList: ownerArr
			};
		} catch (e) {
			return {status: 'ERROR', message: e.message};
		}


	}

	private handleResponse(logger: Logger, response: AnyResponse) {
		if (response.status !== 200) {
			logger.debug(JSON.stringify(response.headers));
			throw new Error(`API response ${response.status}`);
		}
		return response.data;
	}

	async listBranches(logger: Logger, project: string, repoName: string, filter?: string): Promise<BranchListSearchResult> {
		return {status: "ERROR", message: 'not implemented yet'};
	}

	async listDependencies(logger: Logger, project: string, repoName: string, branch?: string, dependenciesFilter?: string): Promise<DependenciesSearchResult> {
		return {status: "ERROR", message: 'not implemented yet'};
	}

	private async getDependencies(logger: Logger, owner: string, name: string, branch?: string, dependencies?: string) {
		try {
			const pjson = await this.getPackageJson(logger, owner, name, branch);
			return {
				packageName: pjson.name,
				version: pjson.version,
				dependencies: pjson.dependencies || [],
				peerDependencies: pjson.peerDependencies || [],
				devDependencies: pjson.devDependencies || []
			}
		} catch (e) {
			logger.warn(e.message);
			return {};
		}
	}
}
