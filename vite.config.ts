import path from "node:path"
import {defineConfig} from 'vite'

import vue from '@vitejs/plugin-vue'
import lezer from "unplugin-lezer/vite"
import dts from "vite-plugin-dts"

export default defineConfig({
    build: {
        lib: {
            name: "vue-config-editor",
            entry: path.relative(__dirname, "lib/index.ts"),
            fileName: (format) => `vue-config-editor.${format}.js`
        },
        rollupOptions: {
            external: ["vue"],
            output: {
                exports: "named",
                globals: {
                    vue: "Vue"
                }
            }
        }
    },
    plugins: [vue(), lezer(), dts({rollupTypes: true, tsconfigPath: "./tsconfig.lib.json"})]
})
