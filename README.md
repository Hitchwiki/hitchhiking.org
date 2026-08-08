# hitchhiking.org

Source for [hitchhiking.org](https://hitchhiking.org/), a home for free,
moneyless projects that help hitchhikers share knowledge and meet in real life.

This directory is prepared to become the standalone public repository
[`hitchwiki/hitchhiking.org`](https://github.com/hitchwiki/hitchhiking.org).

## Development

Requirements: a current Node.js release and Python 3.

```sh
npm ci
npm test
npm run dev
```

Vite serves the site at `http://127.0.0.1:5173`. The landing page and Nostr
identity features work without private configuration. The authenticated chat
timeline calls same-origin `/chat/auth/*` endpoints; those require the separately
operated production backend and are not part of this repository.

## Generated map

`index.html` and `assets/heatmap.js` are checked-in runtime files generated from
`index_template.html` by `heatmap.py`. They are retained in source releases
because the static site serves them directly.

Install the Python dependencies in an isolated environment, then regenerate:

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python heatmap.py
```

Review both generated files before committing them.

## Release snapshot

Create a clean, source-only snapshot in a new destination and verify it:

```sh
scripts/export-release.sh /tmp/hitchhiking.org-release
scripts/check-release.sh --release /tmp/hitchhiking.org-release
```

The export excludes Git metadata, local dependencies, caches, conventional build
output, private agent metadata, and environment files. Production Caddy, Compose,
credentials, and backend configuration remain in Hitchwiki's private operations
repository. Always manually review a release in addition to running the checker.

## Contributing

Please keep the site usable without a build step, update tests with behavior
changes, preserve map and asset attribution, and run `npm test` plus
`scripts/check-release.sh` before opening a pull request.

GitHub Actions runs the same checks for pull requests and pushes to `main`,
then creates and validates a clean release snapshot. CI has read-only repository
access, receives no production secrets, and never deploys or commits changes.

## License

Original software in this repository is licensed under the
[GNU Affero General Public License, version 3 or later](LICENSE)
(`AGPL-3.0-or-later`):

> (c) 2025–2026 guaka and till

Images, map data, project marks, and other third-party material can have different
terms. See [NOTICE.md](NOTICE.md) for their sources, licenses, and attribution.
