import redis from '../../src/redis';

async function main() {
  if (!redis) throw new Error('Redis is not configured (missing REDIS_URL)');
  await redis.set('ping', 'pong', 'EX', 10);
  console.log(await redis.get('ping'));
  await redis.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
