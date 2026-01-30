#!/usr/bin/env node
/**
 * Convert SVG logo to PNG for PWA asset generation
 *
 * Usage: node scripts/convert-logo.mjs
 *
 * Converts static/logo-v1.svg to static/images/logo-1024.png
 */

import sharp from 'sharp'
import { readFileSync, mkdirSync, copyFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

const inputPath = join(projectRoot, 'static/logo-v1.svg')
const outputPath = join(projectRoot, 'static/images/logo-1024.png')

// Ensure output directory exists
mkdirSync(dirname(outputPath), { recursive: true })

// Read SVG and convert to 1024x1024 PNG
const svgBuffer = readFileSync(inputPath)

await sharp(svgBuffer)
  .resize(1024, 1024, {
    fit: 'contain',
    background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparent background
  })
  .png()
  .toFile(outputPath)

console.log('✓ Converted SVG to PNG: static/images/logo-1024.png')

// Also create a favicon.svg from the logo
const faviconSvgPath = join(projectRoot, 'static/favicon.svg')
copyFileSync(inputPath, faviconSvgPath)
console.log('✓ Copied logo to favicon.svg')
