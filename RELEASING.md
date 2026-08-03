# Releasing the Cindy adapter

This repository is the Cindy-only marketplace source for claw-kit.

1. Update the fourth version segment consistently in `package.json` and `plugin/ghost.json`.
2. Run the focused adapter tests:
   `node --test test/cindy-skill-surface.test.mjs test/claw-worker.test.mjs test/plugin-main.test.mjs`.
3. Commit and push `main`, then tag that commit as `vcindy-<version>`.
4. In Cindy, refresh the custom marketplace source, review permissions, install or update plugin id `claw-kit`, and verify it is enabled and running at the tagged manifest version.

The marketplace payload is `plugin/`; do not publish a `.cindy` archive for marketplace installation.
