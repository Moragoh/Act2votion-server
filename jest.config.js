/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
          types: ["node", "jest"],
          noUncheckedIndexedAccess: true,
          verbatimModuleSyntax: false,
          esModuleInterop: true,
        },
      },
    ],
  },
  testTimeout: 120000,
};
