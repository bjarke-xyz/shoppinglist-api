import { getLogger } from "../util/logger";
import decodeJwt from "jwt-decode";
import { getUnixTime, parse, parseISO } from "date-fns";
import { Env } from "../types";
import * as jose from "jose";

export class FirebaseAuth {
  private readonly logger = getLogger("FirebaseAuth");
  constructor(
    private readonly webApiKey: string,
    private readonly firebaseProjectId: string,
    private readonly SHOPPINGLIST: KVNamespace
  ) {}

  public static New(env: Env) {
    return new FirebaseAuth(
      env.FIREBASE_WEB_API_KEY,
      env.FIREBASE_PROJECT_ID,
      env.SHOPPINGLIST
    );
  }

  public async signIn(
    email: string,
    password: string
  ): Promise<SignInResponse> {
    return this.sendAction<SignInResponse>("signInWithPassword", {
      email,
      password,
      returnSecureToken: true,
    });
  }

  public async signUp(
    email: string,
    password: string
  ): Promise<SignUpResponse> {
    return this.sendAction<SignUpResponse>("signUp", {
      email,
      password,
      returnSecureToken: true,
    });
  }

  public async sendConfirmEmail(idToken: string): Promise<EmailResponse> {
    return this.sendAction<EmailResponse>("sendOobCode", {
      requestType: "VERIFY_EMAIL",
      idToken,
    });
  }

  public async sendPasswordReset(email: string): Promise<EmailResponse> {
    return this.sendAction<EmailResponse>("sendOobCode", {
      requestType: "PASSWORD_RESET",
      email,
    });
  }

  public async getIdToken(refreshToken: string): Promise<IdTokenResponse> {
    return this.send(`/v1/token`, {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  public decodeIdToken(idToken: string): DecodedJwt {
    return decodeJwt(idToken) as DecodedJwt;
  }

  public decodeIdTokenHeader(idToken: string): JwtHeader {
    return decodeJwt(idToken, { header: true }) as JwtHeader;
  }

  public async validateIdToken(idToken: string): Promise<void> {
    // https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
    const issuer = `https://securetoken.google.com/${this.firebaseProjectId}`;
    const header = this.decodeIdTokenHeader(idToken);
    const decoded = this.decodeIdToken(idToken);
    if (!header || !decoded) throw new Error("Unable to decode id token ");
    if (header.alg !== "RS256") {
      throw new Error(`Incorrect alg, got ${header.alg}, expected RS256`);
    }
    const publicKeys = await this.getPublicKeys();
    const publicKeyKey = Object.keys(publicKeys).find((x) => x === header.kid);
    if (!publicKeyKey) {
      throw new Error(`No matching public key found for kid '${header.kid}'`);
    }
    const certificate = publicKeys[publicKeyKey];
    const publicKey = await jose.importX509(certificate, header.alg);
    await jose.jwtVerify(idToken, publicKey, {
      issuer,
      audience: this.firebaseProjectId,
    });

    const nowUnixEpoch = getUnixTime(Date.now());
    if (decoded.exp <= nowUnixEpoch) {
      throw new Error(`exp must be in the future. Value=${decoded.exp}`);
    }
    if (decoded.iat > nowUnixEpoch) {
      throw new Error(`iat must be in the past. Value=${decoded.iat}`);
    }
    if (decoded.aud !== this.firebaseProjectId) {
      throw new Error(`aud must be Firebase project ID. Value=${decoded.aud}`);
    }
    if (decoded.iss !== issuer) {
      throw new Error(
        `iss must be https://securetoken.google.com/<projectId>. Value=${decoded.iss}`
      );
    }
    if (!decoded.sub) {
      throw new Error(
        `sub must be non-empty and must be the uid of the user or device. Value=${decoded.sub}`
      );
    }
    if (decoded.auth_time > nowUnixEpoch) {
      throw new Error(
        `auth_time must be in the past. Value=${decoded.auth_time}`
      );
    }
  }

  private async getPublicKeys(): Promise<PublicKeysResponse> {
    const cacheKey = "GOOGLE:PUBLICKEYS";
    const cached = await this.SHOPPINGLIST.get<PublicKeysResponse>(
      cacheKey,
      "json"
    );
    if (cached) {
      return cached;
    }
    try {
      const resp = await fetch(
        "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
      );
      const respJson = (await resp.json()) as PublicKeysResponse;
      // Sat, 15 Apr 2023 23:12:20 GMT
      const expiresHeader = resp.headers.get("expires");
      if (!expiresHeader) {
        throw new Error("Missing expires header on response");
      }
      const expires = new Date(expiresHeader);
      await this.SHOPPINGLIST.put(cacheKey, JSON.stringify(respJson), {
        expiration: getUnixTime(expires),
      });
      return respJson;
    } catch (error) {
      this.logger.error("failed to get google public keys", error);
      throw error;
    }
  }

  private async send<T>(path: string, body: unknown): Promise<T> {
    try {
      if (path.startsWith("/")) path = path.substring(1);
      var resp = await fetch(
        `https://identitytoolkit.googleapis.com/${path}?key=${this.webApiKey}`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );
      var respJson = (await resp.json()) as any;
      if (isError(respJson)) {
        return {
          error: respJson,
        } as T;
      } else {
        return respJson as T;
      }
    } catch (error) {
      this.logger.error(`Error during ${path}`, error);
      throw error;
    }
  }

  private async sendAction<T>(action: string, body: unknown): Promise<T> {
    return this.send(`/v1/accounts:${action}`, body);
  }
}

export interface SignInResponse {
  error: FirebaseAuthError | undefined;
  idToken: string;
  email: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  registered: boolean;
}

export type SignUpResponse = Omit<SignInResponse, "registered">;

export interface FirebaseAuthError {
  error: {
    errors: {
      domain: string;
      reason: string;
      message: string;
    }[];
  };
  code: number;
  message: string;
}

export interface EmailResponse {
  error: FirebaseAuthError | undefined;
  email: string;
}

export interface IdTokenResponse {
  error: FirebaseAuthError | undefined;
  expires_in: string;
  token_type: string;
  refresh_token: string;
  id_token: string;
  user_id: string;
  project_id: string;
}

export interface DecodedJwt {
  iss: string;
  aud: string;
  auth_time: number;
  user_id: string;
  sub: string;
  iat: number;
  exp: number;
  email: string;
  email_verified: boolean;
  firebase: {
    identities: {
      email: string[];
    };
    sign_in_provider: string;
  };
}

export interface JwtHeader {
  alg: string;
  kid: string;
  typ: string;
}

export type PublicKeysResponse = Record<string, string>;

function isError(json: any): boolean {
  return json["message"] && json["code"] && json["error"];
}
