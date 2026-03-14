import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { getConfig } from "./index.js";
import { getDb, users, eq } from "@codepad/database";

export function configurePassport() {
  const config = getConfig();

  if (config.googleClientId && config.googleClientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.googleClientId,
          clientSecret: config.googleClientSecret,
          callbackURL: `${config.apiUrl}/api/v1/auth/google/callback`,
        },
        async (_accessToken: any, _refreshToken: any, profile, done) => {
          try {
            const db = getDb();
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error("No email found in Google profile"));

            let user = await db.query.users.findFirst({
              where: eq(users.email, email.toLowerCase()),
            });

            if (!user) {
              [user] = await db
                .insert(users)
                .values({
                  email: email.toLowerCase(),
                  name: profile.displayName,
                  avatarUrl: profile.photos?.[0]?.value,
                })
                .returning();
            }

            return done(null, user);
          } catch (err) {
            return done(err as Error);
          }
        },
      ),
    );
  }

  if (config.githubClientId && config.githubClientSecret) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: config.githubClientId,
          clientSecret: config.githubClientSecret,
          callbackURL: `${config.apiUrl}/api/v1/auth/github/callback`,
        },
        async (_accessToken: any, _refreshToken: any, profile: any, done: any) => {
          try {
            const db = getDb();
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error("No email found in GitHub profile"));

            let user = await db.query.users.findFirst({
              where: eq(users.email, email.toLowerCase()),
            });

            if (!user) {
              [user] = await db
                .insert(users)
                .values({
                  email: email.toLowerCase(),
                  name: profile.displayName || profile.username,
                  avatarUrl: profile.photos?.[0]?.value,
                })
                .returning();
            }

            return done(null, user);
          } catch (err) {
            return done(err as Error);
          }
        },
      ),
    );
  }

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const db = getDb();
      const user = await db.query.users.findFirst({
        where: eq(users.id, id),
      });
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}
