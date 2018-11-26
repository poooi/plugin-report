module.exports = {
  '*.{es,js}': ['eslint --fix', 'git add'],
  '*.css': ['stylelint --config .stylelint.css.js'],
  '*.md': ['prettier --write', 'git add'],
}
