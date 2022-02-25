# GitHub Action: Squawk

This action runs [squawk](https://github.com/sbdchd/squawk) on pull requests to lint PostgreSQL migrations.

## Usage

```yaml
name: Self test
on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2

      - name: squawk
        uses: K-Phoen/action-squawk@main
```

## Inputs

### `targets`

**Required**. [Glob pattern](https://github.com/isaacs/minimatch) describing what files to lint. Default is `migrations/*.sql`.

### `exclude`

Optional. Comma-separated checks to exclude (`--exclude` flag from [squawk](https://github.com/sbdchd/squawk)). Default is empty.

### `reporter`

Optional. Reporter of reviewdog command (`-reporter` flag from [reviewdog](https://github.com/reviewdog/reviewdog)). Default is `github-pr-review`.

### `squawk_version`

**Required**. The [squawk](https://github.com/sbdchd/squawk/tags) version to use. Default is `v0.8.2`.

### `reviewdog_version`

**Required**. The [reviewdog](https://github.com/reviewdog/reviewdog) version to use. Default is `0.14.0`.


## License

This action is released under the [MIT](LICENSE) license.
