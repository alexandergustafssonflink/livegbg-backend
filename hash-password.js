const bcrypt = require("bcrypt");

async function hashPassword() {
  const password = "hejhej"; // ditt lösenord här
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log("Hashat lösenord:", hashedPassword);
}

hashPassword();
