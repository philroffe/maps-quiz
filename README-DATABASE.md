CREATE ROLE mapsdbrole;
ALTER ROLE mapsdbrole WITH LOGIN PASSWORD 'mapsdbrole' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE maps OWNER mapsdbrole;
REVOKE ALL ON DATABASE maps FROM PUBLIC;
GRANT CONNECT ON DATABASE maps TO mapsdbrole;
GRANT ALL ON DATABASE maps TO mapsdbrole;


CREATE TABLE games (
     id          serial PRIMARY KEY,
     gameid      char(10),
     created_at  TIMESTAMP DEFAULT NOW(),
     locations   jsonb NOT NULL
);

CREATE TABLE gameresults (
     resultid    varchar(512) PRIMARY KEY,
     gameid      char(10),
     created_at  TIMESTAMP DEFAULT NOW(),
     resultuser  varchar(256) NOT NULL,
     resultlocationname varchar(256) NOT NULL,
     resultcoordinates varchar(256) NOT NULL
);

