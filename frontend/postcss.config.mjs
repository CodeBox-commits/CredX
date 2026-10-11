import { fileURLToPath } from "node:url";

// Resolve the Tailwind config from this file, not the working directory, so builds work from any cwd.
const config = { plugins: { tailwindcss: { config: fileURLToPath(new URL("./tailwind.config.ts", import.meta.url)) }, autoprefixer: {} } };

export default config;
