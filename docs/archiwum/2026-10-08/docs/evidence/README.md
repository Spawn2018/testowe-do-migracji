# Evidence recovery

## Recovered

- The full `/workspace/watch-tower/` tree was copied to `docs/watch-tower/`, preserving its directory structure and excluding only any `node_modules/` directories.
- `qa-start/` remains inside `docs/watch-tower/qa-start/` as part of that preserved tree.
- No separate evidence files were duplicated into `docs/evidence/` because the durable gate material found under the source is already inside the preserved `docs/watch-tower/` tree.

## Lost / unavailable

- No `/tmp/wt-*.png` files were present when recovery ran (count 0); see `UTRACONE.md`. Do not recreate them.
