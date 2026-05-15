import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc"
import { defineConfig, type Plugin } from "vite"

// Injects the Strique live-editing overlay script only during `vite dev`.
// ctx.server is only present in dev mode, so the tag never appears in builds.
function striqueOverlay(): Plugin {
  return {
    name: "strique-overlay",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.server) return html
        return html.replace(
          "</body>",
          `<script src="/__strique__/overlay.js" defer></script></body>`
        )
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  cacheDir: "/app/.vite",
  plugins: [react(), tailwindcss(), jsxLocPlugin(), striqueOverlay()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    fs: {
      allow: [".."],
    },
  },
  preview: {
    port: 3000,
  },
})
