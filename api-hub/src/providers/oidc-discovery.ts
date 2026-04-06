export type OidcMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  end_session_endpoint?: string;
  jwks_uri?: string;
};

let cache: { issuer: string; meta: OidcMetadata; at: number } | null = null;
const TTL_MS = 60 * 60 * 1000;

export async function fetchOidcMetadata(issuerRaw: string): Promise<OidcMetadata> {
  const issuer = issuerRaw.replace(/\/$/, "");
  if (cache && cache.issuer === issuer && Date.now() - cache.at < TTL_MS) {
    return cache.meta;
  }
  const url = `${issuer}/.well-known/openid-configuration`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed ${res.status} for ${url}`);
  }
  const meta = (await res.json()) as OidcMetadata;
  cache = { issuer, meta, at: Date.now() };
  return meta;
}
