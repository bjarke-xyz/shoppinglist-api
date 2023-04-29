-- Migration number: 0000 	 2023-03-21T19:31:30.145Z
CREATE TABLE IF NOT EXISTS items(
    id TEXT PRIMARY KEY,
    userId TEXT,
    name TEXT,
    createdAt DATETIME,
    UNIQUE(userId, name)
);