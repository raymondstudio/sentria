import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST as analyzePost } from '../src/app/api/incidents/analyze/route';
import { POST as savePost } from '../src/app/api/incidents/route';
import { incidentStore } from '../src/lib/data/store';

function requestWithForm(form: FormData): NextRequest {
  return new NextRequest('http://localhost/api/incidents/analyze', {
    method: 'POST',
    body: form,
  });
}

test('analyze returns a preview without saving it, then save persists it', async () => {
  const initialCount = await incidentStore.count();
  const form = new FormData();
  form.set('report', 'I received an email asking me to verify my portal password at http://portal-verification-example.com/login.');
  form.set('source', 'EMAIL');

  const analysisResponse = await analyzePost(requestWithForm(form));
  assert.equal(analysisResponse.status, 200);
  const preview = await analysisResponse.json();
  assert.equal(preview.incident.inputSource, 'TEXT');
  assert.equal(await incidentStore.count(), initialCount);

  const saveResponse = await savePost(new NextRequest('http://localhost/api/incidents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ incident: preview.incident, priorityScore: preview.priorityScore }),
  }));
  assert.equal(saveResponse.status, 201);
  const saved = await saveResponse.json();
  assert.equal(saved.incident.incidentId, preview.incident.incidentId);
  assert.equal(await incidentStore.count(), initialCount + 1);
});

test('analyze rejects an empty submission before invoking the pipeline', async () => {
  const response = await analyzePost(requestWithForm(new FormData()));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /report|screenshot/i);
});
