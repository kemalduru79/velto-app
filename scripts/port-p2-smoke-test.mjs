import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const fail = (message) => {
  console.error(`PORT-P2 verification failed: ${message}`);
  process.exit(1);
};
const requireText = (file, text) => {
  if (!read(file).includes(text)) fail(`${file} is missing ${text}`);
};
const forbidText = (file, text) => {
  if (read(file).includes(text)) fail(`${file} still contains ${text}`);
};

const repositoryRoutes = [
  "app/api/projects/route.ts",
  "app/api/load-project/[projectId]/route.ts",
  "app/api/public-project/[shareId]/route.ts",
  "app/api/save-project/route.ts",
  "app/api/share-project/route.ts",
];

for (const file of repositoryRoutes) {
  requireText(file, "getPersistenceServices");
  forbidText(file, "createServerSupabaseClient");
  forbidText(file, '.from("velto_projects")');
}

for (const file of [
  "app/api/store-image/route.ts",
  "app/api/store-video/route.ts",
]) {
  requireText(file, "objectStorage.uploadPublic");
  forbidText(file, "@supabase/supabase-js");
  forbidText(file, ".storage.");
}

requireText("lib/persistence/factory.ts", "VELTO_DATABASE_DRIVER");
requireText("lib/persistence/factory.ts", "VELTO_STORAGE_DRIVER");
requireText("lib/persistence/factory.ts", "projectRepository");
requireText(
  "lib/persistence/projects/supabaseProjectRepository.ts",
  "VELTO_PORT_P2",
);
requireText("app/api/credits/route.ts", "getPersistenceServices");
forbidText("app/api/credits/route.ts", "SupabaseCreditRepository");

console.log("PORT-P2 smoke verification passed.");
