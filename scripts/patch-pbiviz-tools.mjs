import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const patches = [
  {
    file: "node_modules/powerbi-visuals-tools/lib/WebPackWrap.js",
    replacements: [
      {
        original: `        let listResults;\n        try {\n            listResults = (await exec('npm list powerbi-visuals-api version')).stdout;\n        }\n        catch (error) {\n            listResults = error.stdout;\n        }\n        const installedAPIVersion = listResults.match(regexFullVersion)?.[0] ?? "not found";`,
        patched: `        let listResults;\n        const npmListCommand = \`\${os.platform() === "win32" ? "npm.cmd" : "npm"} list powerbi-visuals-api version\`;\n        try {\n            listResults = (await exec(npmListCommand)).stdout ?? "";\n        }\n        catch (error) {\n            listResults = error?.stdout ?? "";\n        }\n        const installedAPIVersion = listResults.match(regexFullVersion)?.[0]\n            ?? (fs.pathExistsSync(path.join(process.cwd(), "node_modules", "powerbi-visuals-api")) ? this.pbiviz.apiVersion : "not found");`,
      },
      {
        original: `    async configureDevServer(visualPackage, port = 8080) {\n        const options = await resolveCertificate();`,
        patched: `    async configureDevServer(visualPackage, port = 8080) {\n        const options = {};`,
      },
      {
        original: `    async configureDevServer(visualPackage, port = 8080) {\n        let options = {};\n        try {\n            options = await resolveCertificate();\n        }\n        catch (error) {\n            ConsoleWriter.warning(\`Skipping certificate configuration: \${error}\`);\n        }`,
        patched: `    async configureDevServer(visualPackage, port = 8080) {\n        const options = {};`,
      },
    ],
  },
  {
    file: "node_modules/powerbi-visuals-tools/lib/CertificateTools.js",
    replacements: [
      {
        original: `const pathToCertFolder = path.join(os.homedir(), config.server.certificateFolder);`,
        patched: `const pathToCertFolder = path.join(process.cwd(), ".pbiviz-certs");`,
      },
    ],
  },
];

for (const patch of patches) {
  const filePath = resolve(patch.file);
  if (!existsSync(filePath)) {
    continue;
  }

  let content = readFileSync(filePath, "utf8");
  let updated = false;

  for (const replacement of patch.replacements) {
    if (content.includes(replacement.patched)) {
      continue;
    }

    if (!content.includes(replacement.original)) {
      continue;
    }

    content = content.replace(replacement.original, replacement.patched);
    updated = true;
  }

  if (updated) {
    writeFileSync(filePath, content, "utf8");
  }
}
