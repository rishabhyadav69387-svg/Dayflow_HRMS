/**
 * Auth API tests (Jest + Supertest)
 *
 * How these tests work:
 * - The real auth router (routes/authRoutes.js + controllers/authController.js)
 *   is mounted on a small Express app.
 * - Supertest sends real HTTP requests to that app (no server needs to be started).
 * - The User model is mocked, so no MongoDB connection is needed.
 *
 * Run them with:  npm test
 */
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// Mock the User model BEFORE the router/controller load it.
// (jest.mock calls are automatically moved to the top of the file by Jest.)
jest.mock('../models/User', () => {
  const User = jest.fn();
  User.findOne = jest.fn();
  User.findById = jest.fn();
  User.findByIdAndUpdate = jest.fn();
  return User;
});

const User = require('../models/User');
const authRoutes = require('../routes/authRoutes');

// Small Express app that only contains the auth routes
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

// ----------------------------------------------------------------------------
// Test data and helpers
// ----------------------------------------------------------------------------
const TEST_EMAIL = 'rishabh.test@example.com';

const validRegistration = (overrides = {}) => ({
  employeeId: 'EMP001',
  fullName: 'Test User',
  email: TEST_EMAIL,
  password: 'Passw0rd!',
  confirmPassword: 'Passw0rd!',
  role: 'employee',
  ...overrides,
});

// Asks the API for an OTP and returns it (the API sends the OTP in the response)
const requestOtp = async (email) => {
  User.findOne.mockResolvedValue(null); // email is not registered yet
  const res = await request(app).post('/api/auth/send-otp').send({ email });
  return res.body.otp;
};

// Fake user document, as it would come back from MongoDB
const makeDbUser = (overrides = {}) => ({
  _id: 'user-id-1',
  email: TEST_EMAIL,
  role: 'employee',
  isActive: true,
  comparePassword: jest.fn().mockResolvedValue(true),
  save: jest.fn().mockResolvedValue(undefined),
  toSafeObject: () => ({ email: TEST_EMAIL, role: 'employee' }),
  ...overrides,
});

// Login does: User.findOne({ email }).select('+password')
const mockLoginLookup = (user) => {
  User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
};

beforeAll(() => {
  // Keep the test output clean (the controller logs OTPs and errors)
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  User.findOne.mockReset();
  User.mockReset();

  // `new User({...})` in the controller returns an object with save() and toSafeObject()
  User.mockImplementation(function MockUser(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(undefined);
    this.toSafeObject = () => ({ email: this.email, role: this.role });
  });

  process.env.JWT_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.JWT_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
});

// ----------------------------------------------------------------------------
// POST /api/auth/send-otp
// ----------------------------------------------------------------------------
describe('POST /api/auth/send-otp', () => {
  test('rejects an invalid email address', async () => {
    const res = await request(app).post('/api/auth/send-otp').send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
  });

  test('rejects an email that is already registered', async () => {
    User.findOne.mockResolvedValue({ _id: 'existing-user' });

    const res = await request(app).post('/api/auth/send-otp').send({ email: TEST_EMAIL });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already registered/i);
  });

  test('returns a 6 digit OTP that expires in 5 minutes', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app).post('/api/auth/send-otp').send({ email: TEST_EMAIL });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.otp).toMatch(/^\d{6}$/);
    expect(res.body.expiresIn).toBe(300);
  });
});

// ----------------------------------------------------------------------------
// POST /api/auth/register
// ----------------------------------------------------------------------------
describe('POST /api/auth/register', () => {
  test('fails when no OTP was requested for that email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegistration({ email: 'nootp@example.com', otp: '123456' }));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/OTP not found/i);
  });

  test('rejects a weak password (no special character)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegistration({ password: 'password1', confirmPassword: 'password1', otp: '123456' }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  test('rejects when password and confirm password do not match', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegistration({ confirmPassword: 'Different1!', otp: '123456' }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  test('rejects a wrong OTP', async () => {
    const email = 'wrongotp@example.com';
    const otp = await requestOtp(email);
    const wrongOtp = otp === '999999' ? '111111' : '999999';

    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegistration({ email, otp: wrongOtp }));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid OTP/i);
  });

  test('creates the account with the correct OTP', async () => {
    const email = 'goodotp@example.com';
    const otp = await requestOtp(email);

    User.findOne.mockResolvedValue(null); // no user with this email / employee ID yet
    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegistration({ email, otp }));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(User).toHaveBeenCalledTimes(1);
    // Employee ID is stored in upper case and the user is marked as verified
    expect(User.mock.calls[0][0]).toMatchObject({ employeeId: 'EMP001', isVerified: true });
  });

  test('an OTP can only be used once', async () => {
    const email = 'onceonly@example.com';
    const otp = await requestOtp(email);

    User.findOne.mockResolvedValue(null);
    const first = await request(app).post('/api/auth/register').send(validRegistration({ email, otp }));
    const second = await request(app).post('/api/auth/register').send(validRegistration({ email, otp }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/OTP not found/i);
  });

  test('returns 409 when the email or employee ID already exists', async () => {
    const email = 'duplicate@example.com';
    const otp = await requestOtp(email);

    User.findOne.mockResolvedValue({ email, employeeId: 'EMP001' });
    const res = await request(app).post('/api/auth/register').send(validRegistration({ email, otp }));

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });
});

// ----------------------------------------------------------------------------
// POST /api/auth/login
// ----------------------------------------------------------------------------
describe('POST /api/auth/login', () => {
  const credentials = { email: TEST_EMAIL, password: 'Passw0rd!' };

  test('returns 401 when no account exists for the email', async () => {
    mockLoginLookup(null);

    const res = await request(app).post('/api/auth/login').send(credentials);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/No account found/i);
  });

  test('returns 401 for a wrong password', async () => {
    mockLoginLookup(makeDbUser({ comparePassword: jest.fn().mockResolvedValue(false) }));

    const res = await request(app).post('/api/auth/login').send(credentials);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Incorrect password/i);
  });

  test('returns 403 for a deactivated account', async () => {
    mockLoginLookup(makeDbUser({ isActive: false }));

    const res = await request(app).post('/api/auth/login').send(credentials);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  test('logs in successfully and returns a valid JWT access token', async () => {
    mockLoginLookup(makeDbUser());

    const res = await request(app).post('/api/auth/login').send(credentials);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // The access token must be signed with JWT_SECRET and contain the user id and role
    const decoded = jwt.verify(res.body.accessToken, 'test-access-secret');
    expect(decoded).toMatchObject({ userId: 'user-id-1', role: 'employee' });

    // The refresh token is sent as an HTTP-only cookie
    const cookies = res.headers['set-cookie'].join(';');
    expect(cookies).toMatch(/refreshToken=/);
    expect(cookies).toMatch(/HttpOnly/i);
  });

  test('returns a clear configuration error when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;
    mockLoginLookup(makeDbUser());

    const res = await request(app).post('/api/auth/login').send(credentials);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Server configuration error/i);
  });

  test('rejects an empty password with a validation error', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });
});
