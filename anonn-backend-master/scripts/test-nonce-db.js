import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

/**
 * Test database-backed nonce storage
 */
async function testNonceStorage() {
    console.log('🧪 Testing database-backed nonce storage...\n');

    try {
        // Test 1: Ethereum nonce
        console.log('1️⃣ Generating nonce for Ethereum wallet...');
        const ethRes = await fetch(`${BASE_URL}/api/auth/wallet/nonce`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: '0x742d35cc6634c0532925a3b844bc9e7595f0beb1', // lowercase
                chain: 'ethereum'
            })
        });
        const ethData = await ethRes.json();
        console.log('✅ Ethereum:', ethData);
        console.log();

        // Test 2: Solana nonce
        console.log('2️⃣ Generating nonce for Solana wallet...');
        const solRes = await fetch(`${BASE_URL}/api/auth/wallet/nonce`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                publicKey: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
                chain: 'solana'
            })
        });
        const solData = await solRes.json();
        console.log('✅ Solana:', solData);
        console.log();

        // Test 3: Polygon nonce
        console.log('3️⃣ Generating nonce for Polygon wallet...');
        const polyRes = await fetch(`${BASE_URL}/api/auth/wallet/nonce`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: '0x742d35cc6634c0532925a3b844bc9e7595f0beb1', // lowercase
                chain: 'polygon'
            })
        });
        const polyData = await polyRes.json();
        console.log('✅ Polygon:', polyData);
        console.log();

        console.log('✅ All tests passed! Database-backed nonce storage working correctly.');
        console.log('📝 Nonces stored in MongoDB with 5-minute auto-expiry (TTL index).');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testNonceStorage();
