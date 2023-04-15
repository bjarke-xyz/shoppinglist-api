import { Hono } from "hono";
import { Env } from "../types";
import { FirebaseAuth } from "../lib/firebase";
import { getLogger } from "../util/logger";

export const authApi = new Hono<{ Bindings: Env }>();

const logger = getLogger("api.auth");

authApi.post("/login", async (c) => {
  const firebaseAuth = new FirebaseAuth(c.env.FIREBASE_WEB_API_KEY);
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
  const firebaseAuth = new FirebaseAuth(c.env.FIREBASE_WEB_API_KEY);
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
  const firebaseAuth = new FirebaseAuth(c.env.FIREBASE_WEB_API_KEY);
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
  const firebaseAuth = new FirebaseAuth(c.env.FIREBASE_WEB_API_KEY);
  const refreshTokenInfo = await c.req.json<{ refreshToken: string }>();
  const idTokenResponse = await firebaseAuth.getIdToken(
    refreshTokenInfo.refreshToken
  );
  if (idTokenResponse.error) {
    return c.json(idTokenResponse.error);
  }
  return c.json(idTokenResponse);
});
