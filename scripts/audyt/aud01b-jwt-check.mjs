import { createRemoteJWKSet, jwtVerify, SignJWT, generateKeyPair } from 'jose';
const U='https://nglnnrmzmhusvxslousq.supabase.co';
const J=createRemoteJWKSet(new URL(`${U}/auth/v1/.well-known/jwks.json`));
const { privateKey } = await generateKeyPair('ES256');
const forged = await new SignJWT({role:'authenticated',sub:'x'}).setProtectedHeader({alg:'ES256',kid:'e441fcb3-a11a-4462-9af9-b858f4e1cd4b'}).setIssuer(`${U}/auth/v1`).setAudience('authenticated').setExpirationTime('1h').sign(privateKey);
const hs = await new SignJWT({role:'authenticated'}).setProtectedHeader({alg:'HS256'}).sign(new TextEncoder().encode('k'.repeat(32)));
for (const [n,t] of [['forged-ES256-same-kid',forged],['HS256',hs],['garbage','a.b.c']]) {
  try { await jwtVerify(t,J,{issuer:`${U}/auth/v1`,audience:'authenticated'}); console.log(n,'ACCEPTED!'); } catch(e){ console.log(n,'->',e.code); }
}
