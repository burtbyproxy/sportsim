# devops audit — naboo reporting

commit: f3472a1 `[devops] add husky pre-commit hook with lint-staged; fix .gitignore`

---

## done

**pre-commit hooks** — were missing entirely. installed husky + lint-staged. on every commit, staged `src/**/*.{js,vue}` files now get eslint --fix and prettier --write. staged scss gets prettier. sorted.

**gitignore** — had `node_modules` and `vendor`. that is all. added dist, coverage, \*.local, .DS_Store. sorted.

**audit fixes** — ran `npm audit fix`. fixed brace-expansion (low) and ini (high). clean on the non-breaking ones.

---

## things i am not touching without your word

**duplicate test config** — `vite.config.js` has a `test:` block (jsdom environment, globals, environmentMatchGlobs). `vitest.config.js` also has a `test:` block (node environment, coverage). they contradict each other. vitest uses its own config file when called directly so vitest.config.js wins — but the vite.config.js block is a trap for anyone trying to understand the setup. recommend removing the `test:` block from vite.config.js entirely and keeping everything in vitest.config.js. i can do it. say the word.

**legacy php/webpack corpses** — these files are still in the repo and should not be:

- `webpack.config.js` — vue 2 webpack config. dead.
- `composer.json` + `composer.lock` — slim 3 php framework. dead.
- `index.php` — php entry point. dead.
- `.htaccess` — apache rewrites for api.php and console.php. dead.
  none of these affect the js build. they just make the repo look like it does not know what it is. flag them for deletion if you agree.

**esbuild/vite vulnerability** — moderate severity, but the fix (`npm audit fix --force`) installs vite@8 which is a breaking change. not doing that without a plan. worth scheduling a vite upgrade properly.

---

## coverage report — worth your attention

507 tests, 20 files, all pass.

| metric     | result |
| ---------- | ------ |
| statements | 86.02% |
| branches   | 88.9%  |
| functions  | 97.72% |
| lines      | 86.02% |

**useNarrative.js** — 323 lines, 0% coverage across the board. zero tests. the coverage threshold is set to 80% across the board. this file is pulling the average down significantly. either it needs tests or it needs to be excluded from the coverage config.

**below-threshold files:**

- `unlocks.js` branches: 74.28%
- `stats.js` branches: 78.04%

both are below the 80% branch threshold in vitest.config.js. the run still passed which suggests thresholds are not hard-failing currently — but they will if anyone enables strict mode.

---

naboo
