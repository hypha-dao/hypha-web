#!/bin/bash
# afterFileEdit hook — runs format:fix and lint:fix in parallel

pnpm run format:fix &
pnpm run lint:fix &
wait
