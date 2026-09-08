const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const env = require("../config/env");
const root = path.resolve(env.storage.documentRoot);
const signatures = { "application/pdf": Buffer.from("%PDF-"), "image/png": Buffer.from([0x89, 0x50, 0x4e, 0x47]), "image/jpeg": Buffer.from([0xff, 0xd8, 0xff]) };
async function store({ contentBase64, mimeType }) { const data = Buffer.from(contentBase64, "base64"); const signature = signatures[mimeType]; if (!signature || data.length === 0 || data.length > env.storage.uploadMaxBytes || !data.subarray(0, signature.length).equals(signature)) throw new Error("Invalid document content."); const key = `${crypto.randomUUID()}`; await fs.mkdir(root, { recursive: true }); await fs.writeFile(path.join(root, key), data, { mode: 0o600 }); return { key, sizeBytes: data.length }; }
async function read(key) { if (!/^[a-f0-9-]{36}$/i.test(String(key))) throw new Error("Invalid document key."); return fs.readFile(path.join(root, key)); }
module.exports = { store, read };
