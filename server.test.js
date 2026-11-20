import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import pg from 'pg';

for (const { name, query, ca, expectedSSL } of [
  {
    name: 'native Postgres uses the injected CA with certificate verification',
    query: '?sslmode=require&application_name=chat',
    ca: 'test CA',
    expectedSSL: { ca: 'test CA', rejectUnauthorized: true }
  },
  {
    name: 'local Postgres retains URL SSL settings without an injected CA',
    query: '?sslmode=disable&application_name=chat',
    expectedSSL: false
  }
]) {
  test(name, async t => {
    const dbURL = `postgresql://starter:password%40local@localhost:5432/starter${query}`;
    const originalPool = pg.Pool;
    let connectionParameters;
    t.mock.method(pg, 'Pool', function (options) {
      const pool = new originalPool(options);
      connectionParameters = new pg.Client(pool.options).connectionParameters;
      return pool;
    });
    t.mock.method(express.application, 'listen', () => {});
    const originalListeners = new Set(process.listeners('SIGTERM'));
    const originalURL = process.env.DB_URL;
    const originalCA = process.env.DB_CA;
    t.after(() => {
      for (const listener of process.listeners('SIGTERM')) {
        if (!originalListeners.has(listener)) process.removeListener('SIGTERM', listener);
      }
      if (originalURL === undefined) delete process.env.DB_URL;
      else process.env.DB_URL = originalURL;
      if (originalCA === undefined) delete process.env.DB_CA;
      else process.env.DB_CA = originalCA;
    });
    process.env.DB_URL = dbURL;
    if (ca === undefined) delete process.env.DB_CA;
    else process.env.DB_CA = ca;

    await import(`./server.js?${encodeURIComponent(name)}`);

    assert.deepEqual(connectionParameters.ssl, expectedSSL);
    assert.equal(connectionParameters.application_name, 'chat');
    assert.equal(connectionParameters.password, 'password@local');
  });
}
