import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import * as esbuild from 'esbuild'

// ESM shims so the bundled server can use require/__filename/__dirname
const ESM_BANNER = `import { createRequire as DeskThingCreateRequire } from 'module';
import { fileURLToPath as DeskThingFileURLToPath } from 'url';
import { dirname as DeskThingDirname } from 'node:path';

const require = DeskThingCreateRequire(import.meta.url);
const __filename = DeskThingFileURLToPath(import.meta.url);
const __dirname = DeskThingDirname(__filename);
`

if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true })
}

const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'))

console.log('Building client...')
execSync('npx vite build --outDir dist/client', { stdio: 'inherit' })

console.log('Building server...')
fs.mkdirSync('dist/server', { recursive: true })

await esbuild.build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  sourcemap: true,
  outfile: 'dist/server/index.js',
  banner: { js: ESM_BANNER }
})

fs.writeFileSync(
  path.resolve('dist/server/package.json'),
  JSON.stringify({ type: 'module' }, null, 2)
)

console.log('Copying assets...')
const manifestSource = fs.existsSync(path.resolve('manifest.json'))
  ? path.resolve('manifest.json')
  : path.resolve('public/manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestSource, 'utf8'))
manifest.version = packageJson.version
fs.writeFileSync(path.resolve('dist/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

for (const iconFile of ['icon.png', 'icon.svg']) {
  if (fs.existsSync(`public/${iconFile}`)) {
    fs.copyFileSync(path.resolve(`public/${iconFile}`), path.resolve(`dist/${iconFile}`))
  }
}

// DeskThing's app-list/release metadata lookup expects the primary app icon at
// `icons/{appId}.svg` (or `images/{appId}.svg`). Keep the root `icon.svg` for
// browser/favicon use, and also package the app-list path it actually scans.
const primaryIcon = path.resolve('public/icon.svg')
if (fs.existsSync(primaryIcon)) {
  fs.mkdirSync(path.resolve('dist/icons'), { recursive: true })
  fs.copyFileSync(primaryIcon, path.resolve('dist/icons', `${manifest.id}.svg`))
}

console.log('Zipping dist into ilystream.zip...')
const zip = new AdmZip()
zip.addLocalFolder(path.resolve('dist'))
zip.writeZip(path.resolve('ilystream.zip'))

console.log('Build complete! ilystream.zip is ready to install in DeskThing.')
