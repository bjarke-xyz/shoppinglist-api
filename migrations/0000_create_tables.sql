-- Migration number: 0000 	 2023-03-21T19:31:30.145Z
CREATE TABLE IF NOT EXISTS items(
    id TEXT PRIMARY KEY,
    userId TEXT,
    name TEXT,
    createdAt DATETIME,
    UNIQUE(userId, name)
);

CREATE TABLE IF NOT EXISTS lists(
    id TEXT PRIMARY KEY,
    userId TEXT,
    name TEXT,
    createdAt DATETIME,
    UNIQUE(userId, name)
);

CREATE TABLE IF NOT EXISTS list_items(
    listId TEXT,
    itemId TEXT,
    count INT,
    createdAt DATETIME,
    updatedAt DATETIME,
    UNIQUE(listId, itemId),
    CONSTRAINT fk_lists FOREIGN KEY (listId) REFERENCES lists(id) ON DELETE CASCADE,
    CONSTRAINT fk_items FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE
);