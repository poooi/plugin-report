module.exports = {
  '*.{es,js}': ['eslint --fix', 'git add'],
  '*.ts': ['prettier --write', 'git add'],
  '*.css': ['stylelint --config .stylelint.css.js'],
  '*.md': ['prettier --write', 'git add'],
}
