import dataSource from '@server/datasource';
import { getSettings } from '@server/lib/settings';
import { seedTestDb } from '@server/utils/seedTestDb';
import type { Express } from 'express';
import fs from 'fs';
import path from 'path';

async function resetDemoData(): Promise<void> {
  // Drop all tables except users and sessions
  const dbConnection = dataSource.isInitialized
    ? dataSource
    : await dataSource.initialize();
  const entities = dbConnection.entityMetadatas;
  for (const entity of entities) {
    if (['discover_slider', 'user', 'session'].includes(entity.tableName)) {
      continue;
    }
    await dbConnection.getRepository(entity.name).clear();
  }
  // Add the default users
  await seedTestDb({
    preserveDb: true,
    withMigrations: false,
  });
}

export async function initDemoData(server: Express): Promise<void> {
  // Retrieve settings from Cypress tests
  fs.copyFileSync(
    path.join(__dirname, '../../cypress/config/settings.cypress.json'),
    path.join(__dirname, '../../config/settings.json')
  );
  const settings = getSettings();
  await settings.load();
  settings.main.mediaServerLogin = false;
  await settings.save();
  // Seed the database with demo data
  await resetDemoData();
  // Resets the database every hour
  setInterval(resetDemoData, 60 * 60 * 1000);

  // Disable password sign-in for non-demo users
  server.post('/api/v1/auth/local', async (req, res, next) => {
    if (req.body?.email !== 'demo@seerr.dev') {
      return res.status(500).json({ error: 'Password sign-in is disabled.' });
    }
    next();
  });
  // Disable password change for non-demo users
  server.post('/api/v1/user/:id/settings/password', async (_, res) => {
    return res.status(204).send();
  });
  // Disable test user modification
  server.post('/api/v1/user/:id/settings/main', async (_, res) => {
    return res.status(200).json({});
  });
  // Disable unlinking media servers
  server.post(
    '/api/v1/user/:id/settings/linked-accounts/plex',
    async (_, res) => {
      return res.status(204).send();
    }
  );
}
