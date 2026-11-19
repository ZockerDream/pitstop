// Kommandozeile im Container: `docker compose exec app pitstop reset-password <email>`
import { generatePassword, hashPassword } from './auth/password';
import { deleteUserSessions } from './auth/sessions';
import { ConfigError, loadConfig } from './config';
import { closePool, db, initPool } from './db/pool';
import { getUserWithHashByEmail, setPassword, updateUser } from './repo/users';

const USAGE = 'Verwendung: pitstop reset-password <email>';

async function main(): Promise<number> {
  const [command, email] = process.argv.slice(2);
  if (command !== 'reset-password' || !email) {
    console.error(USAGE);
    return 2;
  }
  try {
    initPool(loadConfig());
  } catch (err) {
    console.error(err instanceof ConfigError ? err.message : (err as Error).message);
    return 1;
  }
  try {
    const user = await getUserWithHashByEmail(db(), email);
    if (!user) {
      console.error(`Kein Benutzer mit der E-Mail-Adresse ${email}.`);
      return 1;
    }
    const password = generatePassword();
    await setPassword(db(), user.id, await hashPassword(password), true);
    if (!user.active) await updateUser(db(), user.id, { active: true });
    await deleteUserSessions(user.id);
    console.log(`Neues Startpasswort für ${user.email}: ${password}`);
    console.log('Beim nächsten Anmelden muss ein eigenes Passwort festgelegt werden.');
    if (!user.active) console.log('Der Zugang war gesperrt und wurde wieder aktiviert.');
    return 0;
  } catch (err) {
    console.error(`Fehler: ${(err as Error).message}`);
    return 1;
  } finally {
    await closePool();
  }
}

main().then((code) => process.exit(code));
