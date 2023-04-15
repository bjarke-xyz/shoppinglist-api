import { getLogger } from "../util/logger";
import decodeJwt from "jwt-decode";

export class FirebaseAuth {
  private readonly logger = getLogger("FirebaseAuth");
  constructor(private readonly webApiKey: string) {}

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

function isError(json: any): boolean {
  return json["message"] && json["code"] && json["error"];
}
