module.exports = {
  'env': {
    'browser': true,
    'es6': true,
    'node': true,
  },
  'extends': [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'poi-plugin',
    'prettier',
  ],
  'parser': 'babel-eslint',
  'plugins': [
    'import',
    'prettier',
  ],
  'rules': {
    'linebreak-style': ['error', 'unix'],
    'no-console': ['warn', {'allow': ['warn', 'error']}],
    'no-var': 'error',
    'no-unused-vars': ['warn', {'args': 'none'}],
    'unicode-bom': 'error',
    'react/prop-types': 'off',
    'prettier/prettier': 'error',
  },
}
