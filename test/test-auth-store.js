import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AuthStore } from '../server/auth-store.js';

function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specula-elementae-auth-'));
  const store = new AuthStore({ dataDir: tempDir });

  const user = store.createUser('genitore', 'segreto');
  assert.ok(user.id, 'L\'utente deve essere creato');

  const authenticated = store.authenticateUser('genitore', 'segreto');
  assert.ok(authenticated, 'L\'utente deve autenticarsi');

  const session = store.createToken(authenticated.id);
  assert.ok(session.token, 'Il token deve essere generato');

  const userFromToken = store.getUserByToken(session.token);
  assert.strictEqual(userFromToken.username, 'genitore', 'Il token deve risolvere l\'utente');

  const recording = store.saveRecording(authenticated.id, 'game.start', Buffer.from('audio-di-prova'), 'audio/webm');
  assert.strictEqual(recording.prompt_id, 'game.start', 'La registrazione deve essere salvata');

  const status = store.listRecordingStatus(authenticated.id);
  assert.ok(status['game.start'].hasRecording, 'Lo stato deve segnare la registrazione');

  const deleted = store.deleteRecording(authenticated.id, 'game.start');
  assert.strictEqual(deleted, true, 'La registrazione deve essere eliminata');

  console.log('✅ test-auth-store.js passati');
}

run();
