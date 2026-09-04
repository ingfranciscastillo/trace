import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		nitro({
			rollupConfig: { external: [/^@sentry\//] },
			// jsdom is CommonJS and reads __dirname at runtime to resolve its own
			// assets (e.g. its default stylesheet) — bundling it into the ESM
			// output leaves __dirname undefined and crashes on every trace. Using
			// nitro's own trace (not rollupConfig.external, which would bypass
			// nitro's externals plugin and skip copying the real files) keeps it
			// as untouched CommonJS and ships its files with the function.
			traceDeps: ["jsdom*"],
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
});

export default config;
