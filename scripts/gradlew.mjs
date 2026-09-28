// Runs the Gradle wrapper inside android/ on any OS: `node scripts/gradlew.mjs assembleDebug`.
// Windows needs gradlew.bat (through a shell); macOS/Linux use ./gradlew.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const androidDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'android')
if (!existsSync(androidDir)) {
  console.error('android/ does not exist. Run `npx cap add android` first.')
  process.exit(1)
}

const args = process.argv.slice(2)
const isWindows = process.platform === 'win32'
// Windows caveat: cmd.exe does not resolve a bare `gradlew.bat` from the working
// directory here ("not recognized"), and this repo's path contains a space, so
// the wrapper is called by its absolute, quoted path.
const result = isWindows
  ? spawnSync(`"${path.join(androidDir, 'gradlew.bat')}" ${args.join(' ')}`, { cwd: androidDir, stdio: 'inherit', shell: true })
  : spawnSync(path.join(androidDir, 'gradlew'), args, { cwd: androidDir, stdio: 'inherit' })
process.exit(result.status ?? 1)
