// lint-staged.config.js
export default {
  '*.{md,html,json,cts,cjs,mjs,js,yml,yaml,liquid}': 'prettier -w',
  '**/pre-commit': 'prettier -w',
  '*.dockerfile': 'prettier -w',
  '*.ts': ['eslint --cache --fix', 'prettier -w', () => 'tsc -p tsconfig.json --pretty --noEmit'],
};
