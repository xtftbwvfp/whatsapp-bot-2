module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es6: true
  },
  parserOptions: {
    "ecmaVersion": 2018,
    "sourceType": 'module'
  },
  extends: [
    "eslint:recommended",
    "plugin:prettier/recommended"
  ],
  globals: {
    "Atomics": "readonly",
    "SharedArrayBuffer": "readonly"
  },
  rules: {
    "semi": [2, "never"],
    "no-console": process.env.NODE_ENV === "production" ? "error" : "off",
    "indent": ["error", 2, { "SwitchCase": 1 }],
    "quotes": ["error", "double"],
    "prettier/prettier": ["error", { "semi": false }]
  }
}
