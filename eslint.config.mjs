import powerbiVisualsConfigs from "eslint-plugin-powerbi-visuals";

export default [
    powerbiVisualsConfigs.configs.recommended,
    {
        ignores: ["node_modules/**", "dist/**", ".npm-cache/**", ".vscode/**", ".tmp/**", "sample-data/generated/**"],
    },
];
