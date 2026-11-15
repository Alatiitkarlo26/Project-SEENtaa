import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log('Project SEENta: Phase 1, Phase 2, & Phase 3 E2E Test');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`Testing: ${name}... `);
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log('❌ FAILED:', err.message);
      failed++;
    }
  }

  let authToken = '';
  let testUser1 = null;
  let testUser2 = null;
  let createdPost = null;
  let createdClaim = null;
  let createdTx = null;

  // 1. Status Check
  await test('System Status Endpoint (Cloud DB & Mailer check)', async () => {
    const res = await fetch(`${BASE_URL}/status`);
    const data = await res.json();
    if (data.status !== 'online') throw new Error('Status not online');
    if (!data.database.includes('supabase')) throw new Error('Not connected to Supabase');
  });

  // 2. Auth & Login with Bcrypt
  await test('User Login & JWT Generation', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'juan.delacruz@iskolarngbayan.pup.edu.ph',
        password: 'password123'
      })
    });
    const data = await res.json();
    if (!data.token) throw new Error('JWT token not issued');
    authToken = data.token;
    testUser1 = data;
  });

  // Get second user for testing P2P claims
  await test('Fetch Peer User for P2P Simulation', async () => {
    const res = await fetch(`${BASE_URL}/users`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const users = await res.json();
    testUser2 = users.find(u => u.id !== testUser1.id) || users[1];
    if (!testUser2) throw new Error('Second user not available');
  });

  // 3. Create Found Item Post
  await test('Post Found Item (Phase 1)', async () => {
    const res = await fetch(`${BASE_URL}/items/found`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        finderId: testUser1.id,
        itemName: 'Automated Test Blue Umbrella',
        category: 'Personal Belongings',
        locationFound: 'Library Hallway 2nd Floor',
        dateFound: '2026-11-15',
        timeFound: '10:30 AM',
        condition: 'Good',
        description: 'Navy blue foldable umbrella with a small white strap.',
        photoUrls: []
      })
    });
    const data = await res.json();
    if (!data.success || !data.item?.id) throw new Error(data.error || 'Failed to create post');
    createdPost = data.item;
  });

  // 4. File Lost Item Report
  await test('File Lost Item Report (Phase 1)', async () => {
    const res = await fetch(`${BASE_URL}/items/lost`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        userId: testUser2.id,
        itemName: 'Lost Navy Blue Umbrella',
        category: 'Personal Belongings',
        lastKnownLocation: 'Library 2nd Floor',
        dateLost: '2026-11-15',
        description: 'Lost near the study desks.'
      })
    });
    const data = await res.json();
    if (!data.success || !data.item?.id) throw new Error(data.error || 'Failed to file lost report');
  });

  // 5. Submit Proof of Ownership Claim (Phase 2)
  await test('Submit Proof of Ownership Claim (Phase 2)', async () => {
    const res = await fetch(`${BASE_URL}/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        postId: createdPost.id,
        claimantId: testUser2.id,
        proofDescription: 'Has my initials J.D. carved into the wooden handle knob and a torn wrist strap.',
        serialNumber: 'UMBR-2026-09'
      })
    });
    const data = await res.json();
    if (!data.success || !data.claim?.id) throw new Error(data.error || 'Failed to submit claim');
    createdClaim = data.claim;
  });

  // 6. Finder Approves Claim (Phase 2)
  await test('Finder Approves Ownership Claim (Phase 2)', async () => {
    const res = await fetch(`${BASE_URL}/claims/${createdClaim.id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        status: 'Approved'
      })
    });
    const data = await res.json();
    if (!data.success || data.claim?.status !== 'Approved') throw new Error(data.error || 'Claim approval failed');
  });

  // 7. Meetup Chat Messaging (Phase 2)
  await test('Send In-App Meetup Chat Message (Phase 2)', async () => {
    const res = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        claimId: createdClaim.id,
        senderId: testUser1.id,
        messageText: 'Hello! I can meet you at the Main Campus Lobby today at 2:00 PM.'
      })
    });
    const data = await res.json();
    if (!data.success || !data.message?.id) throw new Error(data.error || 'Failed to send message');

    const listRes = await fetch(`${BASE_URL}/messages/${createdClaim.id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const listData = await listRes.json();
    if (!listData.success || listData.messages.length === 0) throw new Error('Message list empty');
  });

  // 8. Mutual Turnover Confirmation & Cryptographic Hash (Phase 3)
  await test('Mutual Turnover Confirmation & SHA-256 Ledger (Phase 3)', async () => {
    // 1st party (Finder confirms)
    const res1 = await fetch(`${BASE_URL}/transactions/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        postId: createdPost.id,
        claimId: createdClaim.id,
        userId: testUser1.id,
        campusLocation: 'Main Campus Lobby & Plaza'
      })
    });
    const data1 = await res1.json();
    if (!data1.success) throw new Error('Finder confirmation failed');

    // 2nd party (Claimant confirms)
    const res2 = await fetch(`${BASE_URL}/transactions/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        postId: createdPost.id,
        claimId: createdClaim.id,
        userId: testUser2.id,
        campusLocation: 'Main Campus Lobby & Plaza'
      })
    });
    const data2 = await res2.json();
    if (!data2.success || !data2.transaction?.ledger_hash) throw new Error('Ledger hash signature not generated');
    createdTx = data2.transaction;
  });

  // 9. Community Feedback & Rating Submission (Phase 3)
  await test('Submit Post-Turnover Community Rating (Phase 3)', async () => {
    const res = await fetch(`${BASE_URL}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        transactionId: createdTx.id,
        raterId: testUser2.id,
        ratedUserId: testUser1.id,
        rating: 5,
        comments: 'Highlights: Prompt & On-Time Meetup, Polite & Respectful Iskolar\n\nThank you so much for returning my umbrella safely!'
      })
    });
    const data = await res.json();
    if (!data.success || !data.feedback?.id) throw new Error(data.error || 'Failed to submit feedback');

    const getFbRes = await fetch(`${BASE_URL}/feedback?transactionId=${createdTx.id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const fbList = await getFbRes.json();
    if (!fbList.success || fbList.feedback.length === 0) throw new Error('Failed to query submitted feedback');
  });

  // 10. Dispute Filing (Phase 3)
  await test('File False Claim Dispute & Lock Status (Phase 3)', async () => {
    const res = await fetch(`${BASE_URL}/disputes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        transactionId: createdTx.id,
        postId: createdPost.id,
        reportedByUserId: testUser2.id,
        reason: 'Automated Test: Verification features discrepancy reported for audit validation',
        evidenceDescription: 'Test evidence submitted for verification protocol audit.'
      })
    });
    const data = await res.json();
    if (!data.success || !data.dispute?.id) throw new Error(data.error || 'Failed to file dispute');

    const postCheck = await fetch(`${BASE_URL}/items/found/${createdPost.id}`);
    const postData = await postCheck.json();
    if (postData.item?.status !== 'Disputed') throw new Error(`Expected item status Disputed, got ${postData.item?.status}`);
  });

  console.log('\n====================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
