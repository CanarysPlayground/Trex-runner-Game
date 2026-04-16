const assert = require('node:assert/strict');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const REQUEST_COUNT = 100;

const randomScore = () => Math.floor(Math.random() * 10000) + 1;

async function postScore(score) {
  const response = await fetch(`${API_BASE_URL}/score/${score}`, { method: 'POST' });
  assert.equal(response.ok, true, `POST /score/${score} failed with status ${response.status}`);
  return response.json();
}

async function getHighScore() {
  const response = await fetch(`${API_BASE_URL}/score`);
  assert.equal(response.ok, true, `GET /score failed with status ${response.status}`);
  return response.json();
}

async function run() {
  const scores = Array.from({ length: REQUEST_COUNT }, randomScore);
  await Promise.all(scores.map((score) => postScore(score)));

  const expectedHighScore = Math.max(...scores);
  const { highScore } = await getHighScore();

  assert.equal(
    highScore,
    expectedHighScore,
    `Expected highScore ${expectedHighScore}, but got ${highScore}`
  );

  console.log(`Success: highScore ${highScore} matches max posted score ${expectedHighScore}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
