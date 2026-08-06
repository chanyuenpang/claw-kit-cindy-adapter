# Releasing the Cindy adapter

This repository is the Cindy-only marketplace source for claw-kit.

1. Resolve the CLI base version before editing. For a multi-artifact release,
   use its authorized CLI candidate; for a Cindy-only release, use the current
   published `@veewo/claw` version. Set `package.json` and `plugin/ghost.json`
   to `<cli-base>.<next-fourth-segment>`. The independent marketplace
   repository owns distribution, not a separate three-segment version line:
   never derive the first three segments from an older `vcindy-*` tag.
2. Run the focused adapter tests:
   `node --test test/cindy-skill-surface.test.mjs test/claw-worker.test.mjs test/plugin-main.test.mjs`.
3. Commit and push `main`, then tag that commit as `vcindy-<version>`.
4. In Cindy, refresh the custom marketplace source, review permissions, install or update plugin id `claw-kit`, and verify it is enabled and running at the tagged manifest version.

The marketplace payload is `plugin/`; do not publish a `.cindy` archive for marketplace installation.
