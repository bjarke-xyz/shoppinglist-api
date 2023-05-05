import { Context, Hono, Next } from "hono";
import { Env } from "../types";
import { DecodedJwt, FirebaseAuth } from "../lib/firebase";
import { getLogger } from "../util/logger";

export const authApi = new Hono<{ Bindings: Env }>();

const logger = getLogger("api.auth");

export function authMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    logger.info("auth start");
    const authorizationHeader = c.req.header("Authorization");
    if (!authorizationHeader) {
      return c.text("no token provided", 401);
    }
    const idToken = authorizationHeader.split("Bearer ")[1];
    if (!idToken) {
      return c.text("no token provided", 401);
    }
    const firebaseAuth = FirebaseAuth.New(c.env);
    try {
      await firebaseAuth.validateIdToken(idToken);
    } catch (error) {
      logger.error("failed to verify id token", error);
      return c.text("error validating token", 401);
    }

    const decodedJwt = firebaseAuth.decodeIdToken(idToken);
    setUserInfo(c, decodedJwt);

    logger.info("auth stop");
    await next();
  };
}

const idTokenContextKey = "auth-id-token-key";
const setUserInfo = (c: Context, idToken: DecodedJwt) =>
  c.set(idTokenContextKey, idToken);
export const getUserInfo = (c: Context): DecodedJwt => {
  const userInfo = getUserInfoOptional(c);
  if (!userInfo) {
    throw new Error("Failed to get user info");
  }
  return userInfo;
};
export const getUserInfoOptional = (c: Context): DecodedJwt | null =>
  c.get(idTokenContextKey);

authApi.post("/login", async (c) => {
  const firebaseAuth = FirebaseAuth.New(c.env);
  const loginInfo = await c.req.json<{ email: string; password: string }>();
  const signInResponse = await firebaseAuth.signIn(
    loginInfo.email,
    loginInfo.password
  );
  if (signInResponse.error) {
    c.status(500);
    return c.json(signInResponse);
  }

  const decodedToken = firebaseAuth.decodeIdToken(signInResponse.idToken);
  if (!decodedToken.email_verified) {
    c.status(400);
    return c.json({
      error: {
        message: "Email not yet verified",
      },
    });
  }
  return c.json(signInResponse);
});

authApi.post("/resend-email-verification", async (c) => {
  const firebaseAuth = FirebaseAuth.New(c.env);
  const loginInfo = await c.req.json<{ email: string; password: string }>();
  const signInResponse = await firebaseAuth.signIn(
    loginInfo.email,
    loginInfo.password
  );
  if (signInResponse.error) {
    c.status(500);
    return c.json(signInResponse);
  }
  const decodedToken = firebaseAuth.decodeIdToken(signInResponse.idToken);
  if (decodedToken.email_verified) {
    logger.info(`email ${loginInfo.email} already verified`);
    return c.text("");
  } else {
    const emailResp = await firebaseAuth.sendConfirmEmail(
      signInResponse.idToken
    );
    if (emailResp.error) {
      logger.error("failed to send confirm email", emailResp.error);
    }
    return c.text("");
  }
});

authApi.post("/register", async (c) => {
  const firebaseAuth = FirebaseAuth.New(c.env);
  const loginInfo = await c.req.json<{ email: string; password: string }>();
  const signUpResponse = await firebaseAuth.signUp(
    loginInfo.email,
    loginInfo.password
  );
  if (signUpResponse.error) {
    c.status(500);
    return c.json(signUpResponse);
  } else {
    const emailResp = await firebaseAuth.sendConfirmEmail(
      signUpResponse.idToken
    );
    if (emailResp.error) {
      logger.error("failed to send confirm email", emailResp.error);
    }
    return c.json(signUpResponse);
  }
});

authApi.post("/refresh", async (c) => {
  const firebaseAuth = FirebaseAuth.New(c.env);
  const refreshTokenInfo = await c.req.json<{ refreshToken: string }>();
  const idTokenResponse = await firebaseAuth.getIdToken(
    refreshTokenInfo.refreshToken
  );
  if (idTokenResponse.error) {
    return c.json(idTokenResponse.error);
  }
  return c.json(idTokenResponse);
});
