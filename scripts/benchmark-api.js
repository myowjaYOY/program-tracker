#!/usr/bin/env node

/**
 * Simple API benchmark script
 * 
 * Usage:
 *   node scripts/benchmark-api.js /api/leads
 * 
 * Or set COOKIE env var for authenticated requests:
 *   COOKIE="your-session-cookie" node scripts/benchmark-api.js /api/leads
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const endpoint = process.argv[2] || '/api/leads';
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const cookie = process.env.COOKIE || '';
const iterations = parseInt(process.env.ITERATIONS || '10', 10);

const fullUrl = new URL(endpoint, baseUrl);
const isHttps = fullUrl.protocol === 'https:';
const client = isHttps ? https : http;

const times = [];

function makeRequest() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const options = {
      hostname: fullUrl.hostname,
      port: fullUrl.port || (isHttps ? 443 : 80),
      path: fullUrl.pathname + fullUrl.search,
      method: 'GET',
      headers: {
        'Cookie': cookie,
      },
    };

    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        resolve({
          duration,
          statusCode: res.statusCode,
          dataLength: data.length,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function runBenchmark() {
  console.log(`\n🚀 Benchmarking: ${fullUrl.toString()}`);
  console.log(`   Iterations: ${iterations}\n`);

  for (let i = 0; i < iterations; i++) {
    try {
      const result = await makeRequest();
      times.push(result.duration);
      
      const status = result.statusCode === 200 ? '✅' : '❌';
      console.log(`${status} Request ${i + 1}: ${result.duration}ms (${result.statusCode})`);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`❌ Request ${i + 1} failed:`, error.message);
    }
  }

  if (times.length === 0) {
    console.error('\n❌ No successful requests');
    process.exit(1);
  }

  // Calculate statistics
  const sorted = [...times].sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];

  console.log('\n📊 Statistics:');
  console.log(`   Min:     ${min}ms`);
  console.log(`   Max:     ${max}ms`);
  console.log(`   Median:  ${median}ms`);
  console.log(`   Average: ${avg.toFixed(2)}ms`);
  console.log(`   P95:     ${p95}ms`);
  console.log(`   P99:     ${p99}ms`);
  console.log(`   Success: ${times.length}/${iterations}`);

  // Performance assessment
  console.log('\n📈 Assessment:');
  if (avg < 400) {
    console.log('   ✅ Excellent: Average < 400ms');
  } else if (avg < 800) {
    console.log('   ⚠️  Good: Average < 800ms (could be better)');
  } else {
    console.log('   ❌ Needs improvement: Average > 800ms');
  }

  if (p95 < 600) {
    console.log('   ✅ Excellent: P95 < 600ms');
  } else if (p95 < 1200) {
    console.log('   ⚠️  Good: P95 < 1200ms');
  } else {
    console.log('   ❌ Needs improvement: P95 > 1200ms');
  }

  console.log('');
}

runBenchmark().catch(console.error);
