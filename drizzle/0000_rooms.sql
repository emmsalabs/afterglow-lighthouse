CREATE TABLE rooms (code TEXT PRIMARY KEY NOT NULL, state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX rooms_expires_idx ON rooms(expires);
