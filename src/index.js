const fs = require('fs');
const path = require('path');
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

const setupReviewdog = async (version) => {
    core.debug(`Installing reviewdog ${version}`);

    // get the os information
    let platform = process.platform.toString();
    let ext = '';
    switch (platform) {
        case 'darwin':
            platform = 'Darwin';
            break;
        case 'linux':
            platform = 'Linux';
            break;
        case 'win32':
            platform = 'Windows';
            ext = '.exe';
            break;
        default:
            throw new Error(`unsupported platform: ${platform}`);
    }

    // get the arch information
    let arch = process.arch;
    switch (arch) {
        case 'x64':
            arch = 'x86_64';
            break;
        case 'arm64':
            break;
        case 'x32':
            arch = 'i386';
            break;
        default:
            throw new Error(`unsupported arch: ${arch}`);
    }

    const url = `https://github.com/reviewdog/reviewdog/releases/download/v${version}/reviewdog_${version}_${platform}_${arch}.tar.gz`;
    const archivePath = await tc.downloadTool(url);
    const extractedDir = await tc.extractTar(archivePath);

    core.info(`reviewdog version ${version} installed`);

    return path.join(extractedDir, `reviewdog${ext}`);
};

const lintArgs = (file) => {
    const args = [
        '--reporter',
        'json',
        '--stdin-filepath',
        file,
    ];

    if (core.getInput('exclude') !== '') {
        args.push('--exclude', core.getInput('exclude'));
    }

    return args;
};

const reviewdogArgs = () => {
    return [
        '-f', 'rdjson',
        '-name', 'squawk',
        '-reporter', core.getInput('reporter'),
    ];
};

// See https://github.com/reviewdog/reviewdog/tree/master/proto/rdf#rdjson
const squawkViolationToRDF = (violation) => {
    return {
        'location': {
            'path': violation.file,
            'range': {
                'start': { 'line': violation.line, 'column': violation.column },
            },
        },
        'severity': violation.level.toUpperCase(),
        'code': {
            'value': violation.rule_name,
            'url': 'https://squawkhq.com/docs/rules',
        },
        'message': violation.messages.map(message => {
            return message.Note ? message.Note : message.Help;
        }).join(' '),
    };
};

const main = async () => {
    const squawkVersion = core.getInput('squawk_version');
    const reviewdogVersion = core.getInput('reviewdog_version');
    const octokit = github.getOctokit(core.getInput('github_token'));
    const { pull_request } = github.context.payload;

    process.env['REVIEWDOG_GITHUB_API_TOKEN'] = core.getInput('github_token');

    const shouldLintFile = (file) => {
        return minimatch(file, core.getInput('targets'));
    };

    try {
        const squawkBin = await core.group('🦉 Installing squawk…', async () => {
            return await setupSquawk(squawkVersion);
        });

        const reviewdogBin = await core.group('🐕 Installing reviewdog', async () => {
            return await setupReviewdog(reviewdogVersion);
        });

        core.info('🕵️ Linting modified migration files…');

        core.debug(`Listing files for PR ${github.context.repo.owner}/${github.context.repo.repo}#${pull_request.number}`)
        const { data: changedFiles } = await octokit.rest.pulls.listFiles({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: pull_request.number,
        });

        // list of RDF-compatible violations
        // see https://github.com/reviewdog/reviewdog/tree/master/proto/rdf#rdjson
        const reviewdogViolations = {
            'source': {
                'name': 'squawk',
                'url': 'https://github.com/sbdchd/squawk',
            },
            'severity': 'WARNING',
            'diagnostics': [],
        };

        core.debug('Filtering changed migration files')
        for (const changedFile of changedFiles) {
            if (changedFile.additions === 0 && changedFile.changes === 0) {
                continue
            }

            if (!shouldLintFile(changedFile.filename)) {
                continue;
            }

            core.info(`Linting '${changedFile.filename}'…`);

            let output = '';
            await exec.exec(squawkBin, lintArgs(changedFile.filename), {
                input: fs.readFileSync(changedFile.filename),
                ignoreReturnCode: true,
                listeners: {
                    stdout: (data) => {
                        output += data.toString();
                    },
                },
            });

            if (output === '') {
                continue;
            }

            const squawkReport = JSON.parse(output);

            squawkReport.forEach(violation => {
                reviewdogViolations.diagnostics.push(
                    squawkViolationToRDF(violation)
                );
            });
        }

        core.info('📡 Submitting results…');

        await exec.exec(reviewdogBin, reviewdogArgs(), {
            input: JSON.stringify(reviewdogViolations),
        });
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