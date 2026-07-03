module.exports = {
  '*.{js,cjs,mjs,ts}': ['eslint --fix', 'git add'],
  '*.css': ['stylelint --config .stylelint.css.js'],
  '*.md': ['prettier --write', 'git add'],
}
