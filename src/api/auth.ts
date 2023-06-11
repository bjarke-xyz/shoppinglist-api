import { Context, Hono, Next } from "hono";
import { Env } from "../types";
import { AsyncLocalStorage } from "node:async_hooks";
import { DecodedJwt, FirebaseAuth } from "../lib/firebase";
import { getLogger } from "../util/logger";
import { demoUserIds } from "../util/demo-users";

export const authApi = new Hono<{ Bindings: Env }>();

export const userInfoStore = new AsyncLocalStorage<DecodedJwt | null>();

const logger = getLogger("api.auth");

export const authProtectedRoutes = ["/api/admin", "/api/items", "/api/lists"];

export async function authMiddleware(
  request: Request,
  env: Env,
  next: () => Promise<Response>
): Promise<Response> {
  let doAuthCheck = authProtectedRoutes.some((url) => {
    const requestUrl = new URL(request.url);
    return requestUrl.pathname.startsWith(url);
  });
  if (doAuthCheck && request.method === "OPTIONS") {
    doAuthCheck = false;
  }
  if (!doAuthCheck) {
    return userInfoStore.run(null, next);
  } else {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response("No token provided", {
        status: 401,
      });
    }
    const idToken = authHeader.split("Bearer ")[1];
    if (!idToken) {
      return new Response("No id token found in Authorization header", {
        status: 401,
      });
    }

    const firebaseAuth = FirebaseAuth.New(env);
    try {
      await firebaseAuth.validateIdToken(idToken);
    } catch (error) {
      logger.error("failed to verify id token", error);
      return new Response("error validating token", { status: 401 });
    }

    const decodedJwt = firebaseAuth.decodeIdToken(idToken);
    return userInfoStore.run(decodedJwt, next);
  }
}

export const getUserInfo = (c: Context): DecodedJwt => {
  const userInfo = userInfoStore.getStore();
  if (!userInfo) {
    throw new Error("Failed to get user info");
  }
  return userInfo;
};

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
  if (!decodedToken.email_verified && !demoUserIds.includes(decodedToken.sub)) {
    return c.json(
      {
        error: {
          message: "Email not yet verified",
        },
      },
      400
    );
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
  const signupsEnabled = await firebaseAuth.signUpsEnabled();
  if (!signupsEnabled) {
    c.status(418);
    return c.text("Registration is temporarily disabled");
  }
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
