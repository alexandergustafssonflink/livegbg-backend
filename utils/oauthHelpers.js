const jwt = require("jsonwebtoken");
const User = require("../models/user");

/**
 * Hittar eller skapar en user baserat på OAuth-provider.
 * Om en user med samma email redan finns (t.ex. registrerade sig med
 * lösen och loggar nu in via Google) lägger vi till providern på dem.
 */
async function findOrCreateOAuthUser({
  provider, // "google" | "password"
  providerId, // unikt ID från provider
  email,
  name,
  avatarUrl,
}) {
  if (!provider || !providerId) {
    throw new Error("findOrCreateOAuthUser kräver provider + providerId");
  }

  // 1) Direkt match på (provider, providerId)
  let user = await User.findOne({
    "providers.provider": provider,
    "providers.providerId": providerId,
  });
  if (user) return user;

  // 2) Match på email - länka providern till befintlig user
  if (email) {
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      const exists = user.providers.some(
        (p) => p.provider === provider && p.providerId === providerId
      );
      if (!exists) {
        user.providers.push({ provider, providerId });
        await user.save();
      }
      return user;
    }
  }

  // 3) Skapa ny user
  user = await User.create({
    email: email ? email.toLowerCase() : `${providerId}@${provider}.local`,
    name: name || "",
    avatarUrl: avatarUrl || "",
    providers: [{ provider, providerId }],
    roles: ["user"],
  });
  return user;
}

/**
 * Skapar en signerad JWT-token för en user.
 */
function signToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      place: user.place,
      roles: user.roles || [],
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

module.exports = { findOrCreateOAuthUser, signToken };
