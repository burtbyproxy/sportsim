# audit findings — 2026-03-14

## vite.config.js

- clean. `@` alias, scss silenceDeprecations, worker format ES. fine.
- NOTE: test config lives in BOTH vite.config.js AND vitest.config.js
  vite.config.js has `test: { environment: 'jsdom', globals: true, environmentMatchGlobs }`
  vitest.config.js has different env (node) plus coverage config
  vitest.config.js WINS when you run vitest directly — but having both is confusing
  flagged to howard, not touching without instruction

## lint / hooks

- no pre-commit hook existed. well out of order.
- installed husky 9.1.7 + lint-staged 16.4.0
- .husky/pre-commit runs `npx lint-staged`
- lint-staged config in package.json: eslint --fix + prettier --write on src/\*_/_.{js,vue}
- prepare script added to package.json by husky init

## dead config — LEGACY CORPSES

- webpack.config.js — references vue 2 (vue.esm.js), old loaders, TerserPlugin, OptimizeCSSAssetsPlugin. dead. flagged.
- composer.json — slim 3, medoo, tuupola basic auth. php era. dead. flagged.
- composer.lock — same. dead.
- index.php — old php entry point. dead.
- .htaccess — apache rewrites for api.php, console.php. dead.
- FLAGGED TO HOWARD. not deleting without word from lead.

## build

- dev: boots in 230ms. clean.
- build: 117 modules, 1.34s. clean. no warnings.

## coverage

507 tests, 20 files, all pass.

- overall: 86.02% stmts / 88.9% branches / 97.72% funcs
- PROBLEM: useNarrative.js = 0% everything. 323 lines. zero tests.
  threshold is 80% — currently FAILING this threshold if useNarrative is included
  actually it runs... threshold enforcement may be soft
- unlocks.js branches: 74.28% — below threshold
- stats.js branches: 78.04% — below threshold
- flagged to howard

## audit vulnerabilities

- brace-expansion + ini: fixed with `npm audit fix`
- esbuild/vite moderate: fix requires vite@8 (breaking). not touching without instruction.
  flagged to howard.

## .gitignore

- was: `node_modules` + `vendor`. embarrassingly sparse.
- added: dist, coverage, \*.local, .DS_Store
