#!/usr/bin/env node
/**
 * Prints a random value suitable for PLATFORM_SETUP_SECRET (base64url, 32 bytes).
 * Copy the line into .env.local or your host's env; never commit real values.
 */
import crypto from "node:crypto";

console.log(crypto.randomBytes(32).toString("base64url"));
