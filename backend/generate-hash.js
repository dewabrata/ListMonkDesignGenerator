/**
 * Script untuk generate bcrypt hash dari password.
 * Usage: node generate-hash.js <password>
 * Contoh: node generate-hash.js mySecretPassword123
 * Salin output ke AUTH_PASSWORD_HASH di file .env
 */
const bcrypt = require('bcrypt');

const password = process.argv[2];

if (!password) {
  console.error('Usage: node generate-hash.js <password>');
  process.exit(1);
}

bcrypt.hash(password, 10).then((hash) => {
  console.log('\n=== Bcrypt Hash Generated ===');
  console.log('Password :', password);
  console.log('Hash     :', hash);
  console.log('\nSalin baris berikut ke file .env Anda:');
  console.log(`AUTH_PASSWORD_HASH=${hash}`);
  console.log('');
});
