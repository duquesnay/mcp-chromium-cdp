/**
 * Manual test for password redaction in extractForms()
 *
 * This test verifies that sensitive field values are redacted while
 * preserving the isFilled indicator.
 *
 * Usage:
 *   1. Start Chromium with CDP: ~/.claude-memories/scripts/launch-chromium-cdp.sh
 *   2. Navigate to a page with a login form (e.g., https://example.com/login)
 *   3. Fill in the password field with a test password
 *   4. Run: node test-password-redaction.js
 */

import { ChromeController } from './build/chrome-controller.js';

async function testPasswordRedaction() {
  console.log('🧪 Testing password redaction in extractForms()...\n');

  const controller = new ChromeController('127.0.0.1', 9222);

  try {
    // Connect to existing Chrome instance
    await controller.connect();
    console.log('✅ Connected to Chrome CDP');

    // Create a test page with a login form
    console.log('\n📝 Creating test page with login form...');
    await controller.navigate('data:text/html,' + encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head><title>Password Redaction Test</title></head>
      <body>
        <h1>Login Form Test</h1>
        <form id="login-form">
          <label for="username">Username:</label>
          <input type="text" id="username" name="username" value="testuser"><br><br>

          <label for="password">Password:</label>
          <input type="password" id="password" name="password" value="SuperSecret123!"><br><br>

          <label for="email">Email:</label>
          <input type="email" id="email" name="email" value="test@example.com"><br><br>

          <label for="ssn">SSN:</label>
          <input type="text" id="ssn" name="ssn" value="123-45-6789"><br><br>

          <label for="credit-card">Credit Card:</label>
          <input type="text" id="credit-card" name="credit-card" autocomplete="cc-number" value="4111111111111111"><br><br>

          <label for="cvv">CVV:</label>
          <input type="text" id="cvv" name="cvv" value="123"><br><br>

          <button type="submit">Login</button>
        </form>
      </body>
      </html>
    `));
    console.log('✅ Test page loaded');

    // Extract forms
    console.log('\n🔍 Extracting form data...');
    const result = await controller.extractForms();

    // Verify results
    console.log('\n📊 Test Results:\n');

    const form = result.forms[0];
    const fields = form.fields;

    let passed = 0;
    let failed = 0;

    // Test 1: Username should NOT be redacted
    const username = fields.find(f => f.name === 'username');
    if (username && username.value === 'testuser' && username.isFilled) {
      console.log('✅ Test 1 PASSED: Username value visible (testuser)');
      passed++;
    } else {
      console.log(`❌ Test 1 FAILED: Username value="${username?.value}", isFilled=${username?.isFilled}`);
      failed++;
    }

    // Test 2: Password should be redacted
    const password = fields.find(f => f.name === 'password');
    if (password && password.value === '[REDACTED]' && password.isFilled) {
      console.log('✅ Test 2 PASSED: Password redacted but isFilled=true');
      passed++;
    } else {
      console.log(`❌ Test 2 FAILED: Password value="${password?.value}", isFilled=${password?.isFilled}`);
      failed++;
    }

    // Test 3: Email should NOT be redacted
    const email = fields.find(f => f.name === 'email');
    if (email && email.value === 'test@example.com' && email.isFilled) {
      console.log('✅ Test 3 PASSED: Email value visible (test@example.com)');
      passed++;
    } else {
      console.log(`❌ Test 3 FAILED: Email value="${email?.value}", isFilled=${email?.isFilled}`);
      failed++;
    }

    // Test 4: SSN should be redacted (name contains 'ssn')
    const ssn = fields.find(f => f.name === 'ssn');
    if (ssn && ssn.value === '[REDACTED]' && ssn.isFilled) {
      console.log('✅ Test 4 PASSED: SSN redacted (name contains "ssn")');
      passed++;
    } else {
      console.log(`❌ Test 4 FAILED: SSN value="${ssn?.value}", isFilled=${ssn?.isFilled}`);
      failed++;
    }

    // Test 5: Credit card should be redacted (autocomplete="cc-number")
    const creditCard = fields.find(f => f.name === 'credit-card');
    if (creditCard && creditCard.value === '[REDACTED]' && creditCard.isFilled) {
      console.log('✅ Test 5 PASSED: Credit card redacted (autocomplete="cc-number")');
      passed++;
    } else {
      console.log(`❌ Test 5 FAILED: Credit card value="${creditCard?.value}", isFilled=${creditCard?.isFilled}`);
      failed++;
    }

    // Test 6: CVV should be redacted (name contains 'cvv')
    const cvv = fields.find(f => f.name === 'cvv');
    if (cvv && cvv.value === '[REDACTED]' && cvv.isFilled) {
      console.log('✅ Test 6 PASSED: CVV redacted (name contains "cvv")');
      passed++;
    } else {
      console.log(`❌ Test 6 FAILED: CVV value="${cvv?.value}", isFilled=${cvv?.isFilled}`);
      failed++;
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`📈 Summary: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));

    if (failed === 0) {
      console.log('\n🎉 All tests passed! Password redaction is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the implementation.');
    }

    // Display full form data for inspection
    console.log('\n📋 Full form data (for inspection):');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await controller.disconnect();
    console.log('\n👋 Disconnected from Chrome');
  }
}

// Run the test
testPasswordRedaction().catch(console.error);
