import { randomBytes } from "node:crypto";

/**
 * Generates a secure random token.
 * @param length Length of the token.
 * @returns A secure random token.
 */
function generateSecretToken(length = 32): string {
	return randomBytes(length).toString("hex");
}

// Generate a secure token of 32 bytes (64 hex characters)
const secretToken = generateSecretToken(32);
console.log(`Your secure Telegram secret token: ${secretToken}`);
