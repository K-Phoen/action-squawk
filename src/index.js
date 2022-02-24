const fs = require('fs');
const minimatch = require('minimatch');
const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const tc = require('@actions/tool-cache');

const setupSquawk = async (version) => {
    core.debug(`Installing squawk ${version}`);

    const downloadUrl = `https://github.com/sbdchd/squawk/releases/download/${version}/squawk-linux-x86_64`;
    const pathToSquawk = await tc.downloadTool(downloadUrl);

    fs.chmodSync(pathToSquawk, '755');

    core.info(`Squawk version ${version} installed`);

    return pathToSquawk;
};

const lintArgs = (file) => {
    const args = [
        '--stdin-filepath',
        file,
    ];

    if (core.isDebug()) {
        args.push('--verbose');
    }

    if (core.getInput('exclude') !== '') {
        args.push('--exclude', core.getInput('exclude'));
    }

    return args;
};

const main = async () => {
    const squawkVersion = core.getInput('squawk_version');
    const octokit = github.getOctokit(core.getInput('github_token'));
    const { pull_request } = github.context.payload;

    const shouldLintFile = (file) => {
        return minimatch(file, core.getInput('targets'));
    };

    try {
        const squawkBin = await core.group('🦉 Installing squawk…', async () => {
            return await setupSquawk(squawkVersion);
        });

        core.info('🕵️ Linting modified migration files…');

        core.debug(`Listing files for PR ${github.context.repo.owner}/${github.context.repo.repo}#${pull_request.number}`)
        const { data: changedFiles } = await octokit.rest.pulls.listFiles({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: pull_request.number,
        });

        core.debug('Filtering changed migration files')
        for (const changedFile of changedFiles) {
            if (changedFile.additions === 0 && changedFile.changes === 0) {
                continue
            }

            if (!shouldLintFile(changedFile.filename)) {
                continue;
            }

            core.info(`Linting '${changedFile.filename}'…`);

            const exitCode = await exec.exec(squawkBin, lintArgs(changedFile.filename), {
                input: fs.readFileSync(changedFile.filename),
                ignoreReturnCode: true,
            });

            if (exitCode !== 0) {
                throw `Error(s) or warning(s) were detected while linting ${changedFile.filename}`;
            }
        }
    } catch (err) {
        if (err instanceof Error) {
            core.setFailed(err);
        } else {
            core.setFailed(`${err}`);
        }
    }
}

if (require.main === module) {
    main();
}