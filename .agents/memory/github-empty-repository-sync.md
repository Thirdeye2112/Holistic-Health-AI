---
name: GitHub empty-repository sync
description: How to push a complete project into an empty GitHub repository through the Replit GitHub connector.
---

For an empty GitHub repository, initialize the default branch with the Contents API before using Git database endpoints. Prefer a batched Git tree request for text files and a small number of blob uploads for binary assets rather than making one blob request per file. If the connector returns an HTML Cloudflare 403 on Git tree writes, stop retrying that endpoint; the rejection is outside GitHub's normal API quota and may persist across both large and small batches.

**Why:** GitHub rejects blob creation before an initial commit, and the connector edge layer can rate-limit individual blob writes or block Git tree writes even when repository reads and normal API quotas remain healthy.

**How to apply:** Create a tracked starter file on the target branch, construct the full tree against that initial commit, create a single complete commit, and update the branch using the plural `/git/refs/{ref}` endpoint. On an HTML Cloudflare 403, wait for the connector edge block to clear or use a different supported write path rather than repeating Git tree requests.