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

### `squawk_version`

**Required**. The squawk version to use. Default is `v0.8.2`.

### `exclude`

Optional. Comma-separated checks to exclude (`--exclude` flag from [squawk](https://github.com/sbdchd/squawk)). Default is empty.


## License

This action is released under the [MIT](LICENSE) license.
