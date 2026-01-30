#!/usr/bin/env node
/**
 * Copy generated PWA assets to static root
 *
 * Usage: node scripts/copy-pwa-assets.mjs
 *
 * Copies icons from static/images/ to static/ for the manifest
 */

import { copyFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

const imagesDir = join(projectRoot, 'static/images')
const staticDir = join(projectRoot, 'static')

// Files that need to be at static root for the manifest
const filesToCopy = [
  'favicon.ico',
  'pwa-64x64.png',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'maskable-icon-512x512.png',
  'apple-touch-icon-180x180.png',
]

let copied = 0
for (const file of filesToCopy) {
  const src = join(imagesDir, file)
  const dest = join(staticDir, file)

  if (existsSync(src)) {
    copyFileSync(src, dest)
    copied++
  } else {
    console.warn(`⚠ Missing: ${file}`)
  }
}

console.log(`✓ Copied ${copied} PWA assets to static/`)
