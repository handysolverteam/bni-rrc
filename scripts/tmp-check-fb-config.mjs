const { SignJWT, importPKCS8 } = await import("jose");
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\n/g, "\n");
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const key = await importPKCS8(privateKey, "RS256");
const now = Math.floor(Date.now() / 1000);
const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/cloud-platform" })
  .setProtectedHeader({ alg: "RS256" })
  .setIssuedAt(now).setExpirationTime(now + 3600)
  .setIssuer(clientEmail).setSubject(clientEmail)
  .setAudience("https://oauth2.googleapis.com/token")
  .sign(key);

const tr = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
});
const td = await tr.json();
if (!tr.ok) { console.error("token err", td); process.exit(1); }

const cfgRes = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`, {
  headers: { Authorization: `Bearer ${td.access_token}` },
});
const cfg = await cfgRes.json();
console.log("status:", cfgRes.status);
console.log("\nAUTHORIZED DOMAINS:", JSON.stringify(cfg.authorizedDomains, null, 2));
console.log("\nsignIn config:", JSON.stringify(cfg.signIn, null, 2));

const provRes = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/defaultSupportedIdpConfigs`, {
  headers: { Authorization: `Bearer ${td.access_token}` },
});
const prov = await provRes.json();
console.log("\nIDP PROVIDERS:", JSON.stringify(prov, null, 2));
