import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import crypto from 'crypto';
import dns from 'dns';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dns.setDefaultResultOrder('ipv4first');
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'seenta_jwt_pup_binan_super_secure_secret_2026';

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// -------------------------------------------------------------
// JWT Token Generation & Verification Middleware
// -------------------------------------------------------------

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      studentId: user.studentId || user.student_id || ''
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    req.user = null;
    return next();
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      req.user = null;
    } else {
      req.user = user;
    }
    next();
  });
}

app.use(authenticateToken);

// -------------------------------------------------------------
// Cryptographic Password Hashing & Verification (Bcrypt + Scrypt)
// -------------------------------------------------------------

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, storedPassword) {
  if (!storedPassword || typeof storedPassword !== 'string') return false;
  // 1. Bcrypt hash check (Standard secure mode)
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
    return bcrypt.compareSync(password, storedPassword);
  }
  // 2. Direct comparison for existing legacy plaintext records (auto-upgrades on login)
  if (password === storedPassword) return true;
  // 3. Fallback for legacy salt:key scrypt hashes during transition
  if (storedPassword.includes(':')) {
    try {
      const [salt, key] = storedPassword.split(':');
      const keyBuffer = Buffer.from(key, 'hex');
      const derivedKey = crypto.scryptSync(password, salt, 64);
      return crypto.timingSafeEqual(keyBuffer, derivedKey);
    } catch {
      return false;
    }
  }
  return false;
}

// -------------------------------------------------------------
// Server-Side OTP & Rate Limiting Storage
// -------------------------------------------------------------

const activeOTPs = new Map(); // email -> { code, expiresAt, attempts }
const emailRateLimits = new Map(); // email -> [timestamps]

function checkRateLimit(email) {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const maxAttempts = 10; // Relaxed for smoother testing

  const timestamps = (emailRateLimits.get(email) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxAttempts) {
    return false;
  }
  timestamps.push(now);
  emailRateLimits.set(email, timestamps);
  return true;
}

// -------------------------------------------------------------
// Configure Nodemailer Transporter
// -------------------------------------------------------------

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '');

  if (user && pass) {
    if ((user && user.endsWith('@gmail.com')) || (host && host.includes('gmail'))) {
      return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        family: 4, // Force IPv4 on Render containers (prevents ENETUNREACH IPv6)
        auth: { user, pass },
        connectionTimeout: 3500,
        greetingTimeout: 3500,
        socketTimeout: 5000
      });
    }

    if (
      (host && (host.includes('outlook') || host.includes('office365'))) ||
      (user && (user.endsWith('@pup.edu.ph') || user.endsWith('@iskolarngbayan.pup.edu.ph') || user.endsWith('@outlook.com') || user.endsWith('@hotmail.com')))
    ) {
      return nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user, pass },
        tls: {
          minVersion: 'TLSv1.2',
          ciphers: 'SSLv3'
        }
      });
    }

    return nodemailer.createTransport({
      host: host || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: { user, pass }
    });
  }

  return null;
}

// -------------------------------------------------------------
// Database & Authentication Endpoints
// -------------------------------------------------------------

// 1. Get all users (Safe view without passwords)
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.getUsers();
    const safeUsers = users.map((user) => {
      const { password: _p, ...safe } = user;
      return safe;
    });
    res.json(safeUsers);
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
});

// 2. Register a new user into the database
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, fullName, studentId, contactNumber, role, otp } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isStudent = cleanEmail.endsWith('@iskolarngbayan.pup.edu.ph');
    const isFacultyOrSecurity = cleanEmail.endsWith('@pup.edu.ph');

    if (!isStudent && !isFacultyOrSecurity) {
      return res.status(400).json({
        error: 'Registration is restricted strictly to official PUP Webmail accounts (@iskolarngbayan.pup.edu.ph or @pup.edu.ph).'
      });
    }

    // Server-Side OTP verification check if OTP was passed
    if (otp) {
      const record = activeOTPs.get(cleanEmail);
      if (!record || record.code !== otp.trim()) {
        return res.status(400).json({ error: 'Invalid or expired OTP verification code.' });
      }
      activeOTPs.delete(cleanEmail); // Consume OTP upon successful verification
    }

    const secureHash = hashPassword(password);

    const newUser = await db.createUser({
      email: cleanEmail,
      password: secureHash,
      firstName,
      lastName,
      fullName: fullName || `${lastName}, ${firstName}`,
      studentId,
      contactNumber,
      role
    });

    console.log(`[Database] User registered: ${newUser.email} (${newUser.role})`);

    const { password: _p, ...safeUser } = newUser;
    const token = generateToken(newUser);
    res.status(201).json({ ...safeUser, token });
  } catch (err) {
    console.error('[Registration Error]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// 3. Log in against the database
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({
        error: 'No account registered with this university email.',
        notRegistered: true
      });
    }

    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({
        error: 'Incorrect password for this university email.'
      });
    }

    // Auto-upgrade legacy plaintext password to secure bcrypt hash
    if (user.password && !user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
      try {
        const upgradedHash = hashPassword(password);
        await db.updateUser(user.id, { password: upgradedHash });
        console.log(`[Security] 🔒 Auto-upgraded password to bcrypt hash for user: ${user.email}`);
      } catch (upgradeErr) {
        console.warn('[Security] Password auto-upgrade warning:', upgradeErr.message);
      }
    }

    console.log(`[Database] User authenticated: ${user.email} (${user.role})`);

    const { password: _p, ...safeUser } = user;
    const token = generateToken(user);
    res.json({ ...safeUser, token });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server authentication error.' });
  }
});

// 3b. Check if an email is registered in the database
app.get('/api/auth/check-email', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res.status(400).json({ error: 'Email query parameter is required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(cleanEmail);
    res.json({ exists: !!user, role: user?.role || null });
  } catch (err) {
    console.error('Check email error:', err.message);
    res.status(500).json({ error: 'Failed to verify email existence.' });
  }
});

// 4. Verify OTP on server
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ valid: false, error: 'Email and OTP code are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const record = activeOTPs.get(cleanEmail);

  if (!record) {
    return res.status(400).json({ valid: false, error: 'No OTP code found. Please request a new code.' });
  }

  if (Date.now() > record.expiresAt) {
    activeOTPs.delete(cleanEmail);
    return res.status(400).json({ valid: false, error: 'OTP has expired. Please request a fresh code.' });
  }

  if (record.code !== code.trim()) {
    record.attempts += 1;
    if (record.attempts >= 5) {
      activeOTPs.delete(cleanEmail);
      return res.status(400).json({ valid: false, error: 'Maximum attempts reached. Please request a fresh code.' });
    }
    return res.status(400).json({ valid: false, error: `Invalid code. (${5 - record.attempts} attempts remaining)` });
  }

  // Code is verified
  res.json({ valid: true, message: 'OTP verified successfully.' });
});

// 5. Update a user in the database
app.put('/api/users/:id', async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.password) {
      updates.password = hashPassword(updates.password);
    }
    const updated = await db.updateUser(req.params.id, updates);
    const { password: _p, ...safeUser } = updated;
    res.json(safeUser);
  } catch (err) {
    console.error('Update error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// 6. Delete a user from the database
app.delete('/api/users/:id', async (req, res) => {
  try {
    await db.deleteUser(req.params.id);
    res.json({ success: true, message: 'User deleted from database.' });
  } catch (err) {
    console.error('Delete error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Status & OTP Sending Endpoints
// -------------------------------------------------------------

app.get('/api/status', async (req, res) => {
  const isSmtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  const isHttpsMailerConfigured = !!(process.env.GAS_MAILER_URL || process.env.BREVO_API_KEY);
  const isConfigured = isHttpsMailerConfigured || isSmtpConfigured;
  const isCloud = db.isCloud();
  const users = await db.getUsers();
  res.json({
    status: 'online',
    database: isCloud ? 'supabase_cloud' : 'local_json',
    databaseLocation: isCloud ? 'Supabase Cloud (PostgreSQL)' : 'server/data/users.json',
    totalUsers: users.length,
    smtpConfigured: isConfigured,
    mailerMode: process.env.GAS_MAILER_URL
      ? 'google_apps_script_https'
      : process.env.BREVO_API_KEY
        ? 'brevo_https'
        : isSmtpConfigured
          ? 'smtp'
          : 'simulated',
    senderEmail: isConfigured ? (process.env.SMTP_USER || 'HTTPS Mailer') : 'Not configured (Simulated mode active)',
    host: process.env.SMTP_HOST || 'default'
  });
});

app.post('/api/send-otp', async (req, res) => {
  const { email, otp, recipientName } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, error: 'Email and OTP are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Rate Limiting Check
  if (!checkRateLimit(cleanEmail)) {
    return res.status(429).json({
      success: false,
      error: 'Too many OTP requests. Please wait 5 minutes before trying again.'
    });
  }

  // Store OTP on server (5-minute TTL)
  activeOTPs.set(cleanEmail, {
    code: otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0
  });

  // Anti-Spam & Deliverability Optimization for Microsoft Outlook / Office 365:
  // 1. Generic sender name prevents Microsoft Anti-Phishing User Impersonation detection
  const fromSender = process.env.SMTP_FROM || `"SEENta Verification" <${process.env.SMTP_USER || 'noreply@seenta.app'}>`;

  // 2. Standard transactional subject line avoids Bayesian bulk filters
  const subject = `Your SEENta verification code is ${otp}`;

  // 3. Complete plain text alternative matching HTML structure
  const textBody = [
    `Mabuhay, ${recipientName || 'Iskolar'}!`,
    '',
    `Your 6-digit verification code for Project SEENta is: ${otp}`,
    '',
    'This code is valid for 5 minutes. Never share this code with anyone.',
    '',
    'If you did not request this registration, please disregard this email or report to the Campus Security Office.',
    '',
    'Politeknikong Unibersidad ng Pilipinas — Sangay ng Biñan',
    'Official Peer-to-Peer Lost & Found Clearinghouse'
  ].join('\n');

  // 4. Outlook Word-rendering engine table-based layout
  const htmlBody = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>SEENta Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #800000; padding: 18px 24px; text-align: left;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="42" valign="middle">
                    <div style="background-color: #ffffff; color: #800000; font-weight: 900; font-size: 16px; border-radius: 8px; width: 36px; height: 36px; line-height: 36px; text-align: center; font-family: monospace;">
                      ST
                    </div>
                  </td>
                  <td valign="middle" style="padding-left: 12px;">
                    <div style="color: #ffffff; font-size: 16px; font-weight: 800; letter-spacing: 0.5px;">Project SEENta</div>
                    <div style="color: #fef08a; font-size: 11px; font-weight: 500;">PUP Biñan Campus • P2P Lost &amp; Found</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px 24px 20px 24px; text-align: left;">
              <p style="margin: 0 0 12px 0; font-size: 15px; color: #1e293b; font-weight: 600;">
                Mabuhay, ${recipientName || 'Iskolar'}!
              </p>
              <p style="margin: 0 0 20px 0; font-size: 13px; line-height: 1.6; color: #475569;">
                You are verifying your account for the <strong>Project SEENta Peer-to-Peer Lost and Found Management System</strong>. Please enter the single-use verification code below:
              </p>

              <!-- OTP Code Display Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 10px;">
                <tr>
                  <td align="center" style="padding: 20px 16px;">
                    <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #64748b; margin-bottom: 6px;">
                      Single-Use Security Code
                    </div>
                    <div style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #800000; font-family: 'Courier New', Courier, monospace; padding-left: 10px;">
                      ${otp}
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 8px;">
                      ⏱️ Valid for <strong>5 minutes</strong> • Single use only
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Notice Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #fef2f2; border-left: 4px solid #800000; border-radius: 4px;">
                <tr>
                  <td style="padding: 10px 14px; font-size: 11px; color: #7f1d1d; line-height: 1.5;">
                    <strong>Security Reminder:</strong> Never share this code with anyone. Campus administrators and security staff will never ask for your code.
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                If you did not request this verification code, please ignore this email or report to the Campus Security Office.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; text-align: center;">
              <p style="margin: 0; font-size: 10px; color: #94a3b8; line-height: 1.4;">
                Politeknikong Unibersidad ng Pilipinas — Sangay ng Biñan<br/>
                Zapote, Biñan City, Laguna • Official Student Clearinghouse
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

  // 1. Google Apps Script HTTPS Mailer (Port 443 - Works on Render Free Tier & appears in Gmail Sent)
  if (process.env.GAS_MAILER_URL) {
    try {
      const gasRes = await fetch(process.env.GAS_MAILER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: cleanEmail,
          subject,
          text: textBody,
          html: htmlBody
        })
      });
      const gasData = await gasRes.json().catch(() => ({}));
      if (!gasRes.ok || gasData.success === false) {
        throw new Error(gasData.error || `GAS Mailer returned ${gasRes.status}`);
      }
      console.log(`[GAS HTTPS Live] Email delivered to: ${cleanEmail}`);
      return res.json({
        success: true,
        delivered: true,
        mode: 'live_gas_https',
        message: `Real email successfully sent to your Outlook address (${cleanEmail})!`
      });
    } catch (err) {
      console.error('[GAS HTTPS Error]', err.message);
      return res.status(502).json({
        success: false,
        delivered: false,
        error: `Failed to deliver verification email: ${err.message}. If 403, set 'Who has access' to 'Anyone' in Google Apps Script Deploy settings.`
      });
    }
  }

  // 2. Brevo HTTPS Email API (Port 443 - Works on Render Free Tier, 300 free emails/day)
  if (process.env.BREVO_API_KEY) {
    try {
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sender: {
            name: 'Project SEENta PUP Biñan',
            email: process.env.SMTP_USER || 'karloalatiit0@gmail.com'
          },
          to: [{ email: cleanEmail, name: recipientName || 'Iskolar' }],
          subject,
          htmlContent: htmlBody,
          textContent: textBody
        })
      });
      const brevoData = await brevoRes.json().catch(() => ({}));
      if (!brevoRes.ok) {
        throw new Error(brevoData.message || `Brevo returned ${brevoRes.status}`);
      }
      console.log(`[Brevo HTTPS Live] Email delivered to: ${cleanEmail} (MessageId: ${brevoData.messageId})`);
      return res.json({
        success: true,
        delivered: true,
        mode: 'live_brevo_https',
        message: `Real email successfully sent to your Outlook address (${cleanEmail})!`
      });
    } catch (err) {
      console.error('[Brevo HTTPS Error]', err.message);
      return res.status(502).json({
        success: false,
        delivered: false,
        error: `Brevo email delivery failed: ${err.message}`
      });
    }
  }

  // 3. Standard Nodemailer SMTP (For local development or paid servers with open SMTP ports)
  const transporter = createTransporter();

  if (transporter) {
    try {
      const sendPromise = transporter.sendMail({
        from: fromSender,
        replyTo: process.env.SMTP_USER,
        to: cleanEmail,
        subject,
        text: textBody,
        html: htmlBody,
        headers: {
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
          'Importance': 'Normal',
          'Auto-Submitted': 'auto-generated',
          'X-Auto-Response-Suppress': 'All',
          'X-Mailer': 'SEENta-Mailer/2.0'
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SMTP connection timed out. Outbound SMTP ports 465/587 blocked by cloud host.')), 4000)
      );

      const info = await Promise.race([sendPromise, timeoutPromise]);

      console.log(`[SMTP Live] Email delivered to: ${cleanEmail} (MessageId: ${info.messageId})`);
      return res.json({
        success: true,
        delivered: true,
        mode: 'live_smtp',
        message: `Real email successfully sent to your Outlook address (${cleanEmail})!`
      });
    } catch (err) {
      console.error('[SMTP Error]', err.message);
      return res.status(502).json({
        success: false,
        delivered: false,
        error: `Live email dispatch failed: ${err.message}. (Note: Render Free Tier blocks SMTP ports 465/587; configure GAS_MAILER_URL or BREVO_API_KEY).`
      });
    }
  }

  console.warn(`[No Mailer Configured] Cannot deliver real OTP to ${cleanEmail}`);
  return res.status(500).json({
    success: false,
    delivered: false,
    error: 'No live email service configured on the server. Please configure GAS_MAILER_URL or BREVO_API_KEY.'
  });
});

// -------------------------------------------------------------
// Transactional Event Email Dispatcher (SYS-SEEN-0002)
// -------------------------------------------------------------
async function sendNotificationEmail({ to, recipientName = 'Iskolar', subject, heading, bodyText, actionText, actionUrl }) {
  if (!to) return { success: false, error: 'Recipient email missing' };

  const cleanEmail = to.trim().toLowerCase();
  const fromSender = process.env.SMTP_FROM || `"Project SEENta" <${process.env.SMTP_USER || 'noreply@seenta.app'}>`;
  const appUrl = process.env.FRONTEND_URL || 'https://projectseenta.vercel.app';
  const resolvedActionUrl = actionUrl || appUrl;

  const textBody = [
    `Mabuhay, ${recipientName}!`,
    '',
    heading || subject,
    '--------------------------------------------------',
    bodyText,
    '',
    actionText ? `${actionText}: ${resolvedActionUrl}` : `Open SEENta Portal: ${appUrl}`,
    '',
    'Politeknikong Unibersidad ng Pilipinas — Sangay ng Biñan',
    'Official Peer-to-Peer Lost & Found Clearinghouse'
  ].join('\n');

  const htmlBody = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background-color: #800000; padding: 18px 24px; text-align: left;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="42" valign="middle">
                    <div style="background-color: #ffffff; color: #800000; font-weight: 900; font-size: 16px; border-radius: 8px; width: 36px; height: 36px; line-height: 36px; text-align: center; font-family: monospace;">
                      ST
                    </div>
                  </td>
                  <td valign="middle" style="padding-left: 12px;">
                    <div style="color: #ffffff; font-size: 16px; font-weight: 800; letter-spacing: 0.5px;">Project SEENta</div>
                    <div style="color: #fef08a; font-size: 11px; font-weight: 500;">PUP Biñan Campus • P2P Lost &amp; Found</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 24px 20px 24px; text-align: left;">
              <p style="margin: 0 0 12px 0; font-size: 15px; color: #1e293b; font-weight: 600;">
                Mabuhay, ${recipientName}!
              </p>
              <h2 style="margin: 0 0 16px 0; font-size: 17px; color: #800000; font-weight: 700;">
                ${heading || subject}
              </h2>
              <div style="margin: 0 0 20px 0; font-size: 13px; line-height: 1.6; color: #475569; white-space: pre-line;">
${bodyText}
              </div>
              ${actionText ? `
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #800000;">
                    <a href="${resolvedActionUrl}" target="_blank" style="font-size: 13px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; display: inline-block;">
                      ${actionText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
              <p style="margin: 24px 0 0 0; font-size: 11px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 12px;">
                This is an automated notification from Project SEENta. For safety, always complete item handoffs at official Campus Safe-Exchange Zones.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; text-align: center;">
              <p style="margin: 0; font-size: 10px; color: #94a3b8; line-height: 1.4;">
                Politeknikong Unibersidad ng Pilipinas — Sangay ng Biñan<br/>
                Zapote, Biñan City, Laguna • Official Student Clearinghouse
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    if (process.env.GAS_MAILER_URL) {
      const gasRes = await fetch(process.env.GAS_MAILER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: cleanEmail, subject, text: textBody, html: htmlBody })
      });
      if (gasRes.ok) {
        console.log(`[Event Email GAS] Sent to ${cleanEmail}: "${subject}"`);
        return { success: true, mode: 'gas_https' };
      }
    }

    if (process.env.BREVO_API_KEY) {
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Project SEENta PUP Biñan', email: process.env.SMTP_USER || 'karloalatiit0@gmail.com' },
          to: [{ email: cleanEmail, name: recipientName }],
          subject,
          htmlContent: htmlBody,
          textContent: textBody
        })
      });
      if (brevoRes.ok) {
        console.log(`[Event Email Brevo] Sent to ${cleanEmail}: "${subject}"`);
        return { success: true, mode: 'brevo_https' };
      }
    }

    const transporter = createTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: fromSender,
        to: cleanEmail,
        subject,
        text: textBody,
        html: htmlBody
      });
      console.log(`[Event Email SMTP] Sent to ${cleanEmail}: "${subject}"`);
      return { success: true, mode: 'smtp' };
    }

    console.log(`[Event Email Simulated] To: ${cleanEmail} | Subject: "${subject}"`);
    return { success: true, mode: 'simulated' };
  } catch (err) {
    console.error(`[Event Email Failed] Could not deliver to ${cleanEmail}:`, err.message);
    return { success: false, error: err.message };
  }
}

// =========================================================================
// FOUND ITEM POSTS ENDPOINTS (FR-SEEN-0003, UC-003)
// =========================================================================

// 1. Get all found item posts (with filters for search, category, status, finderId)
app.get('/api/items/found', async (req, res) => {
  try {
    const { category, search, status, finderId } = req.query;
    const posts = await db.getFoundPosts({ category, search, status, finderId });
    res.json({ success: true, count: posts.length, items: posts });
  } catch (err) {
    console.error('Error fetching found item posts:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve found item posts.' });
  }
});

// 2. Get single found post by ID
app.get('/api/items/found/:id', async (req, res) => {
  try {
    const post = await db.getFoundPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Found item post not found.' });
    }
    res.json({ success: true, item: post });
  } catch (err) {
    console.error('Error fetching found post details:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve post details.' });
  }
});

// 3. Create a new found item post (includes automated matching check)
app.post('/api/items/found', async (req, res) => {
  try {
    const {
      finderId,
      finder_id,
      itemName,
      item_name,
      category,
      description,
      color,
      size,
      locationFound,
      location_found,
      dateFound,
      date_found,
      timeFound,
      time_found,
      condition,
      photoUrls,
      photos
    } = req.body;

    const actualFinderId = finderId || finder_id;
    const actualItemName = itemName || item_name;
    const actualLocation = locationFound || location_found;
    const actualDate = dateFound || date_found;

    if (!actualFinderId || !actualItemName || !category || !actualLocation || !actualDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: finderId, itemName, category, locationFound, and dateFound are mandatory.'
      });
    }

    const postData = {
      finderId: actualFinderId,
      itemName: actualItemName,
      category,
      description,
      color,
      size,
      locationFound: actualLocation,
      dateFound: actualDate,
      timeFound: timeFound || time_found,
      condition: condition || 'Good'
    };

    const urls = Array.isArray(photoUrls) ? photoUrls : (Array.isArray(photos) ? photos : []);
    const createdPost = await db.createFoundPost(postData, urls);

    res.status(201).json({
      success: true,
      message: 'Found item posted successfully to SEENta campus feed!',
      item: createdPost
    });
  } catch (err) {
    console.error('Error creating found item post:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to create found item post.' });
  }
});

// =========================================================================
// LOST ITEM REPORTS ENDPOINTS (FR-SEEN-0002, UC-002)
// =========================================================================

// 1. Get all lost item reports (with filters for search, category, status, userId)
app.get('/api/items/lost', async (req, res) => {
  try {
    const { category, search, status, userId } = req.query;
    const reports = await db.getLostReports({ category, search, status, userId });
    res.json({ success: true, count: reports.length, items: reports });
  } catch (err) {
    console.error('Error fetching lost item reports:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve lost item reports.' });
  }
});

// 2. Get single lost item report by ID
app.get('/api/items/lost/:id', async (req, res) => {
  try {
    const report = await db.getLostReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Lost item report not found.' });
    }
    res.json({ success: true, item: report });
  } catch (err) {
    console.error('Error fetching lost report details:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve report details.' });
  }
});

// 3. Create a new lost item report (includes automated matching check)
app.post('/api/items/lost', async (req, res) => {
  try {
    const {
      userId,
      user_id,
      itemName,
      item_name,
      category,
      description,
      color,
      size,
      lastKnownLocation,
      last_known_location,
      dateLost,
      date_lost,
      photoUrl,
      photo_url
    } = req.body;

    const actualUserId = userId || user_id;
    const actualItemName = itemName || item_name;
    const actualLocation = lastKnownLocation || last_known_location;
    const actualDate = dateLost || date_lost;

    if (!actualUserId || !actualItemName || !category || !actualLocation || !actualDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, itemName, category, lastKnownLocation, and dateLost are mandatory.'
      });
    }

    const reportData = {
      userId: actualUserId,
      itemName: actualItemName,
      category,
      description,
      color,
      size,
      lastKnownLocation: actualLocation,
      dateLost: actualDate,
      photoUrl: photoUrl || photo_url
    };

    const createdReport = await db.createLostReport(reportData);

    res.status(201).json({
      success: true,
      message: 'Missing item report filed successfully on SEENta!',
      item: createdReport
    });
  } catch (err) {
    console.error('Error filing lost item report:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to file lost item report.' });
  }
});

// =========================================================================
// NOTIFICATIONS ENDPOINTS (SYS-SEEN-0002, Dual-Sided In-App Alerts)
// =========================================================================

// 1. Get user notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Query parameter userId is required.' });
    }
    const notifs = await db.getNotifications(userId);
    res.json({ success: true, count: notifs.length, notifications: notifs });
  } catch (err) {
    console.error('Error fetching notifications:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve notifications.' });
  }
});

// 2. Mark notification as read
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const updated = await db.markNotificationRead(req.params.id);
    res.json({ success: true, notification: updated });
  } catch (err) {
    console.error('Error marking notification read:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update notification.' });
  }
});

// 3. Mark all notifications as read for a user
app.put('/api/notifications/read-all', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Field userId is required.' });
    }
    await db.markAllNotificationsRead(userId);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Error marking all notifications read:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update notifications.' });
  }
});

// 4. Delete a specific notification
app.delete('/api/notifications/:id', async (req, res) => {
  try {
    await db.deleteNotification(req.params.id);
    res.json({ success: true, message: 'Notification deleted.' });
  } catch (err) {
    console.error('Error deleting notification:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete notification.' });
  }
});

// =========================================================================
// PROOF OF OWNERSHIP CLAIMS ENDPOINTS (FR-SEEN-0004, UC-004)
// =========================================================================

// 1. Get claims (filter by postId, claimantId, finderId, status)
app.get('/api/claims', async (req, res) => {
  try {
    const { postId, claimantId, finderId, status } = req.query;
    const claims = await db.getClaims({ postId, claimantId, finderId, status });
    res.json({ success: true, count: claims.length, claims });
  } catch (err) {
    console.error('Error fetching claims:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve claims.' });
  }
});

// 2. Get claim by ID
app.get('/api/claims/:id', async (req, res) => {
  try {
    const claim = await db.getClaimById(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim not found.' });
    }
    res.json({ success: true, claim });
  } catch (err) {
    console.error('Error fetching claim details:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve claim details.' });
  }
});

// 3. Submit proof of ownership claim
app.post('/api/claims', async (req, res) => {
  try {
    const { postId, post_id, claimantId, claimant_id, proofDescription, proof_description, serialNumber, serial_number } = req.body;
    const actualPostId = postId || post_id;
    const actualClaimantId = claimantId || claimant_id || req.user?.id;
    const actualProof = proofDescription || proof_description;

    if (!actualPostId || !actualClaimantId || !actualProof) {
      return res.status(400).json({
        success: false,
        error: 'Missing mandatory fields: postId, claimantId, and proofDescription are required.'
      });
    }

    const createdClaim = await db.createClaim({
      postId: actualPostId,
      claimantId: actualClaimantId,
      proofDescription: actualProof,
      serialNumber: serialNumber || serial_number
    });

    // Transactional Event Email: Notify Finder of New Ownership Claim (SYS-SEEN-0002)
    try {
      const post = await db.getFoundPostById(actualPostId);
      if (post && post.finder && post.finder.email) {
        sendNotificationEmail({
          to: post.finder.email,
          recipientName: post.finder.full_name || 'Finder',
          subject: `[Project SEENta] New Ownership Claim on "${post.item_name}"`,
          heading: `New Ownership Claim Awaiting Your Review`,
          bodyText: `A fellow Iskolar has submitted proof of ownership for "${post.item_name}".\n\nSubmitted Proof Details:\n"${actualProof}"\n${serialNumber ? `Serial / Identifying Number: ${serialNumber}\n` : ''}\nPlease review this claim in your SEENta Dashboard under "Claims & Meetups" to verify or decline.`,
          actionText: 'Review Claim in Dashboard',
          actionUrl: process.env.FRONTEND_URL || 'https://projectseenta.vercel.app'
        }).catch((e) => console.error('Background claim notification email error:', e.message));
      }
    } catch (emailErr) {
      console.error('Finder notification lookup failed:', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Proof of ownership claim submitted successfully. The finder has been notified.',
      claim: createdClaim
    });
  } catch (err) {
    console.error('Error submitting claim:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to submit ownership claim.' });
  }
});

// 4. Finder approves or rejects a claim
app.put('/api/claims/:id/status', async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!status || !['Approved', 'Rejected', 'Canceled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Valid status (Approved, Rejected, Canceled) is required.' });
    }

    const updated = await db.updateClaimStatus(req.params.id, status, rejectionReason);

    // Transactional Event Email: Notify Claimant of Approval or Rejection (SYS-SEEN-0002)
    try {
      const claim = await db.getClaimById(req.params.id);
      if (claim && claim.claimant && claim.claimant.email) {
        if (status === 'Approved') {
          sendNotificationEmail({
            to: claim.claimant.email,
            recipientName: claim.claimant.full_name || 'Claimant',
            subject: `[Project SEENta] Your Claim for "${claim.post?.item_name || 'your item'}" has been APPROVED! 🎉`,
            heading: `Claim Approved — Coordination Chat Active`,
            bodyText: `Congratulations! The finder has reviewed and approved your proof of ownership claim for "${claim.post?.item_name}".\n\nDirect in-app meetup coordination chat is now active in your dashboard. You may now agree on a meetup schedule at an official Campus Safe-Exchange Zone (Main Lobby, Library Entrance, or Guard Post).`,
            actionText: 'Open Meetup Chat',
            actionUrl: process.env.FRONTEND_URL || 'https://projectseenta.vercel.app'
          }).catch((e) => console.error('Background approval notification email error:', e.message));
        } else if (status === 'Rejected') {
          sendNotificationEmail({
            to: claim.claimant.email,
            recipientName: claim.claimant.full_name || 'Claimant',
            subject: `[Project SEENta] Ownership Claim Update — ${claim.post?.item_name || 'Item'}`,
            heading: `Claim Verification Update`,
            bodyText: `Your ownership claim for "${claim.post?.item_name}" was reviewed and declined by the finder.\n\nReason given: ${rejectionReason || 'Identifying details did not match physical item features.'}\n\nIf you believe this decision is in error, you may file a dispute with the Campus Security Office via Project SEENta.`,
            actionText: 'Open Dashboard',
            actionUrl: process.env.FRONTEND_URL || 'https://projectseenta.vercel.app'
          }).catch((e) => console.error('Background rejection notification email error:', e.message));
        }
      }
    } catch (emailErr) {
      console.error('Claimant notification lookup failed:', emailErr.message);
    }

    res.json({
      success: true,
      message: `Claim status updated to ${status}.`,
      claim: updated
    });
  } catch (err) {
    console.error('Error updating claim status:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to update claim status.' });
  }
});

// =========================================================================
// IN-APP MEETUP COORDINATION CHAT (FR-SEEN-0004)
// =========================================================================

// 1. Get messages for a claim
app.get('/api/messages/:claimId', async (req, res) => {
  try {
    const msgs = await db.getMessages(req.params.claimId);
    res.json({ success: true, count: msgs.length, messages: msgs });
  } catch (err) {
    console.error('Error fetching messages:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve messages.' });
  }
});

// 2. Post a message
app.post('/api/messages', async (req, res) => {
  try {
    const { claimId, claim_id, senderId, sender_id, messageText, message_text } = req.body;
    const actualClaimId = claimId || claim_id;
    const actualSenderId = senderId || sender_id || req.user?.id;
    const text = messageText || message_text;

    if (!actualClaimId || !actualSenderId || !text) {
      return res.status(400).json({ success: false, error: 'claimId, senderId, and messageText are required.' });
    }

    const msg = await db.createMessage({
      claimId: actualClaimId,
      senderId: actualSenderId,
      messageText: text
    });
    res.status(201).json({ success: true, message: msg });
  } catch (err) {
    console.error('Error sending message:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to send message.' });
  }
});

// =========================================================================
// TRANSACTION RECORDS & TURNOVER CONFIRMATION (FR-SEEN-0005, UC-005)
// =========================================================================

// 1. Get user transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const { userId } = req.query;
    const txs = await db.getTransactions(userId || req.user?.id);
    res.json({ success: true, count: txs.length, transactions: txs });
  } catch (err) {
    console.error('Error fetching transactions:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve transactions.' });
  }
});

// 2. Mutual turnover confirmation
app.post('/api/transactions/confirm', async (req, res) => {
  try {
    const { postId, post_id, claimId, claim_id, userId, user_id, campusLocation } = req.body;
    const actualPostId = postId || post_id;
    const actualClaimId = claimId || claim_id;
    const actualUserId = userId || user_id || req.user?.id;

    if (!actualPostId || !actualClaimId || !actualUserId) {
      return res.status(400).json({
        success: false,
        error: 'postId, claimId, and userId are required to confirm turnover.'
      });
    }

    const tx = await db.confirmTurnover({
      postId: actualPostId,
      claimId: actualClaimId,
      userId: actualUserId,
      campusLocation: campusLocation || 'Main Campus Lobby'
    });

    // Transactional Event Email: Dispatch Cryptographic Ledger Receipt on Mutual Finalization (SYS-SEEN-0002)
    if (tx.ledger_hash) {
      try {
        const claim = await db.getClaimById(actualClaimId);
        const users = await db.getUsers();
        const finder = users.find((u) => u.id === tx.finder_id);
        const claimant = users.find((u) => u.id === tx.claimant_id);
        const itemName = claim?.post?.item_name || 'Lost & Found Item';

        const receiptDetails = `Both parties have verified and finalized the physical turnover of "${itemName}" at ${tx.campus_location || 'Campus Safe Zone'}.\n\nOfficial Transaction ID: ${tx.id}\nCryptographic SHA-256 Ledger Signature:\n${tx.ledger_hash}\nTimestamp: ${tx.completed_at || new Date().toISOString()}\n\nThank you for upholding peer trust and integrity at PUP Biñan Campus! Please take a moment to leave community feedback in your dashboard.`;

        if (finder?.email) {
          sendNotificationEmail({
            to: finder.email,
            recipientName: finder.full_name || 'Finder',
            subject: `[Project SEENta] Official Handover Receipt — ${itemName}`,
            heading: `Turnover Finalized & Verified 🤝`,
            bodyText: receiptDetails,
            actionText: 'View Handover Record',
            actionUrl: process.env.FRONTEND_URL || 'https://projectseenta.vercel.app'
          }).catch((e) => console.error('Turnover receipt email to finder failed:', e.message));
        }

        if (claimant?.email) {
          sendNotificationEmail({
            to: claimant.email,
            recipientName: claimant.full_name || 'Claimant',
            subject: `[Project SEENta] Official Handover Receipt — ${itemName}`,
            heading: `Item Reunited Safely! 🎒`,
            bodyText: receiptDetails,
            actionText: 'View Handover Record',
            actionUrl: process.env.FRONTEND_URL || 'https://projectseenta.vercel.app'
          }).catch((e) => console.error('Turnover receipt email to claimant failed:', e.message));
        }
      } catch (receiptErr) {
        console.error('Turnover receipt dispatch failed:', receiptErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Turnover status recorded.',
      transaction: tx
    });
  } catch (err) {
    console.error('Error confirming turnover:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to confirm turnover.' });
  }
});

// =========================================================================
// DISPUTE REPORTS (FR-SEEN-0006, Report Falsely Claimed Item)
// =========================================================================

// 1. Get all disputes
app.get('/api/disputes', async (req, res) => {
  try {
    const disputes = await db.getDisputes();
    res.json({ success: true, count: disputes.length, disputes });
  } catch (err) {
    console.error('Error fetching disputes:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve disputes.' });
  }
});

// 2. Submit a false claim dispute
app.post('/api/disputes', async (req, res) => {
  try {
    const { transactionId, transaction_id, postId, post_id, reportedByUserId, reported_by_user_id, reason, evidenceDescription } = req.body;
    const actualTxId = transactionId || transaction_id;
    const actualPostId = postId || post_id;
    const actualReporterId = reportedByUserId || reported_by_user_id || req.user?.id;

    if (!actualPostId || !actualReporterId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'postId, reportedByUserId, and reason are required to file a dispute.'
      });
    }

    const dispute = await db.createDispute({
      transactionId: actualTxId,
      postId: actualPostId,
      reportedByUserId: actualReporterId,
      reason,
      evidenceDescription: evidenceDescription || ''
    });

    // Transactional Event Email: Alert Campus Security Office & Confirm to Student (SYS-SEEN-0002)
    try {
      const post = await db.getFoundPostById(actualPostId);
      const users = await db.getUsers();
      const reporter = users.find((u) => u.id === actualReporterId);
      const disputeDetails = `A formal dispute has been logged for item: "${post?.item_name || 'Item'}" (Post ID: ${actualPostId}).\n\nReported by: ${reporter?.full_name || 'Student'} (${reporter?.email || 'N/A'}, Student ID: ${reporter?.student_id || 'N/A'})\nReason: ${reason}\nEvidence: ${evidenceDescription || 'No additional evidence attached'}\n\nItem status in the SEENta catalog has been locked to "Disputed". Security administrators may inspect this case for administrative resolution.`;

      // Dispatch alert to Campus Security
      sendNotificationEmail({
        to: process.env.SECURITY_OFFICE_EMAIL || 'security.binan@pup.edu.ph',
        recipientName: 'Campus Security & Student Affairs',
        subject: `[SECURITY ALERT] Disputed Item Claim — ${post?.item_name || 'Property'}`,
        heading: `Escalation: Disputed Lost & Found Item`,
        bodyText: disputeDetails,
        actionText: 'Review System Logs',
        actionUrl: process.env.FRONTEND_URL || 'https://projectseenta.vercel.app'
      }).catch((e) => console.error('Security alert email error:', e.message));

      // Dispatch acknowledgment to reporting student
      if (reporter?.email) {
        sendNotificationEmail({
          to: reporter.email,
          recipientName: reporter.full_name || 'Student',
          subject: `[Project SEENta] Dispute Report Logged — ${post?.item_name || 'Item'}`,
          heading: `Dispute Logged with Campus Security`,
          bodyText: `Your dispute report for "${post?.item_name}" has been registered. The item status has been locked to "Disputed" to prevent unauthorized turnover.\n\nCampus Security and administrative staff have been alerted to review the case.`,
          actionText: 'Open Dashboard',
          actionUrl: process.env.FRONTEND_URL || 'https://projectseenta.vercel.app'
        }).catch((e) => console.error('Reporter dispute confirmation email error:', e.message));
      }
    } catch (disputeErr) {
      console.error('Dispute notification lookup failed:', disputeErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Dispute filed successfully. Campus authorities and item records have been flagged.',
      dispute
    });
  } catch (err) {
    console.error('Error filing dispute:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to file dispute.' });
  }
});

// 3. Admin updates dispute status (Arbitration & Resolution)
app.put('/api/disputes/:id/status', async (req, res) => {
  try {
    const { status, resolutionNotes, unlockPost } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required.' });
    }

    const updated = await db.updateDisputeStatus(req.params.id, status, resolutionNotes, unlockPost);

    // Notify the reporting user of arbitration update
    if (updated?.reported_by_user_id) {
      await db.createNotification({
        userId: updated.reported_by_user_id,
        title: `Dispute Case Update: ${status}`,
        message: `Your dispute report for "${updated.post?.item_name || 'an item'}" has been updated to "${status}". Notes: ${resolutionNotes || 'None'}.`,
        type: 'DISPUTE_UPDATE',
        referenceId: updated.id
      });
    }

    res.json({ success: true, message: `Dispute status updated to ${status}.`, dispute: updated });
  } catch (err) {
    console.error('Error updating dispute status:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to update dispute status.' });
  }
});

// =========================================================================
// ADMIN AUDIT & OVERSIGHT ENDPOINTS (FR-SEEN-0008)
// =========================================================================

// 1. Admin overview (All items, reports, transactions, disputes, users)
app.get('/api/admin/overview', async (req, res) => {
  try {
    const [foundPosts, lostReports, transactions, disputes, users] = await Promise.all([
      db.getFoundPosts(),
      db.getLostReports(),
      db.getTransactions(),
      db.getDisputes(),
      db.getUsers()
    ]);

    const safeUsers = (users || []).map((u) => {
      const { password: _p, ...safe } = u;
      return safe;
    });

    res.json({
      success: true,
      data: {
        foundPosts,
        lostReports,
        transactions,
        disputes,
        users: safeUsers,
        summary: {
          totalFound: foundPosts.length,
          totalLost: lostReports.length,
          totalTransactions: transactions.length,
          totalDisputes: disputes.length,
          totalUsers: safeUsers.length,
          reunitedCount: transactions.filter((t) => t.completed_at || t.ledger_hash).length,
          pendingDisputes: disputes.filter((d) => d.status === 'Disputed' || d.status === 'UnderReview').length
        }
      }
    });
  } catch (err) {
    console.error('Error fetching admin overview:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve administrative overview.' });
  }
});

// 2. Admin formal communication notice to student
app.post('/api/admin/contact-user', async (req, res) => {
  try {
    const { userId, subject, message, formalNoticeType, referenceItemId } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ success: false, error: 'userId and message are required.' });
    }

    const users = await db.getUsers();
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Target user not found.' });
    }

    const noticeTitle = subject || `Official Campus Security Notice: ${formalNoticeType || 'Administrative Inquiry'}`;

    // 1. Create in-system notification
    await db.createNotification({
      userId,
      title: `🏛️ ${noticeTitle}`,
      message: message,
      type: 'ADMIN_NOTICE',
      referenceId: referenceItemId || ''
    });

    // 2. Dispatch official transactional email
    if (targetUser.email) {
      sendNotificationEmail({
        to: targetUser.email,
        recipientName: targetUser.full_name || 'Iskolar',
        subject: `[PUP Biñan Campus Security] ${noticeTitle}`,
        heading: `Official Security & Administrative Notice`,
        bodyText: `${message}\n\nNotice Type: ${formalNoticeType || 'Administrative Inquiry'}\nIssued by: Campus Security Office & Student Affairs\nVenue: PUP Biñan Campus Security Office (Ground Floor)`,
        actionText: 'Open Project SEENta Portal',
        actionUrl: process.env.FRONTEND_URL || 'https://projectseenta.vercel.app'
      }).catch((e) => console.error('Admin contact email error:', e.message));
    }

    res.json({
      success: true,
      message: `Formal notice delivered to ${targetUser.full_name} (${targetUser.email}).`
    });
  } catch (err) {
    console.error('Admin contact user error:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to dispatch formal notice.' });
  }
});

// =========================================================================
// FEEDBACK & RATINGS (FR-SEEN-0007, Community Trust)
// =========================================================================

// 1. Get feedback (filter by transactionId, raterId, ratedUserId)
app.get('/api/feedback', async (req, res) => {
  try {
    const { transactionId, raterId, ratedUserId } = req.query;
    const feedbackList = await db.getFeedback({ transactionId, raterId, ratedUserId });
    res.json({ success: true, count: feedbackList.length, feedback: feedbackList });
  } catch (err) {
    console.error('Error fetching feedback:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve feedback.' });
  }
});

// 2. Submit feedback & rating
app.post('/api/feedback', async (req, res) => {
  try {
    const { transactionId, raterId, ratedUserId, rating, comments } = req.body;
    if (!transactionId || !raterId || !ratedUserId || !rating) {
      return res.status(400).json({ success: false, error: 'transactionId, raterId, ratedUserId, and rating are required.' });
    }

    const fb = await db.createFeedback({ transactionId, raterId, ratedUserId, rating, comments });
    res.status(201).json({ success: true, message: 'Feedback submitted.', feedback: fb });
  } catch (err) {
    console.error('Error submitting feedback:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to submit feedback.' });
  }
});

// -------------------------------------------------------------
// Production Static Serving for Monorepo / Single-Service Hosting
// (e.g. Render, Railway, Heroku, Docker)
// -------------------------------------------------------------
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(` SEENta Mailer & DB API listening on port ${PORT}`);
    console.log(` Database: ${db.isCloud() ? 'Supabase Cloud (PostgreSQL)' : 'server/data/users.json'}`);
    console.log(` Security: Bcrypt Password Hashing + JWT Sessions Active`);
    console.log(` OTP Security: Server-side enforced with rate limits`);
    console.log(` Check status at: http://localhost:${PORT}/api/status`);
    console.log(`===============================================`);
  });
}

export default app;
