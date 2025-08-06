import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { db } from '../config/database';
import { standardLimiter } from '../middleware/rateLimiter';

const router = Router();

// Validation schemas
const signinSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const signupSchema = Joi.object({
  firstName: Joi.string().required().min(1).max(50),
  lastName: Joi.string().required().min(1).max(50),
  email: Joi.string().email().required(),
  phone: Joi.string().required().pattern(/^(\+44|0)[1-9]\d{8,10}$/),
  password: Joi.string().required().min(6)
});

// Sign In endpoint
router.post('/signin', standardLimiter, async (req: Request, res: Response) => {
  try {
    console.log('🔐 Sign in attempt:', { email: req.body.email, timestamp: new Date().toISOString() });

    // Validate request body
    const { error, value } = signinSchema.validate(req.body);
    if (error) {
      console.log('❌ Sign in validation error:', error.details);
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    const { email, password } = value;

    // Find user by email
    const userResult = await db.query(
      `SELECT 
         id, email, first_name, last_name, phone, password_hash, 
         created_at, last_login, status
       FROM users 
       WHERE email = $1 AND status = 'active'`,
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ Sign in failed - user not found:', email);
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    const user = userResult.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      console.log('❌ Sign in failed - invalid password for user:', email);
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    // Update last login time
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        type: 'user'
      },
      process.env.JWT_SECRET || 'goldenfish_jwt_secret_2025',
      { expiresIn: '30d' }
    );

    // Get user's saved addresses
    const addressesResult = await db.query(
      `SELECT id, street, city, postcode, instructions, is_default
       FROM user_addresses 
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [user.id]
    );

    const userData = {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
      createdAt: user.created_at,
      lastLoginAt: user.last_login,
      savedAddresses: addressesResult.rows.map(addr => ({
        id: addr.id,
        street: addr.street,
        city: addr.city,
        postcode: addr.postcode,
        instructions: addr.instructions,
        isDefault: addr.is_default
      }))
    };

    console.log('✅ Sign in successful:', { 
      userId: user.id, 
      email: user.email, 
      name: `${user.first_name} ${user.last_name}`,
      addressCount: userData.savedAddresses.length
    });

    return res.json({
      success: true,
      message: 'Sign in successful',
      data: {
        user: userData,
        token,
        expiresIn: '30d'
      }
    });

  } catch (error) {
    console.error('❌ Sign in error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Authentication service temporarily unavailable'
    });
  }
});

// Sign Up endpoint (for Create Account)
router.post('/signup', standardLimiter, async (req: Request, res: Response) => {
  try {
    console.log('📝 Sign up attempt:', { email: req.body.email, timestamp: new Date().toISOString() });

    // Validate request body
    const { error, value } = signupSchema.validate(req.body);
    if (error) {
      console.log('❌ Sign up validation error:', error.details);
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    const { firstName, lastName, email, phone, password } = value;

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      console.log('❌ Sign up failed - user already exists:', email);
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        message: 'An account with this email already exists. Please sign in instead.'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUserResult = await db.query(
      `INSERT INTO users (email, first_name, last_name, phone, password_hash, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'active', NOW())
       RETURNING id, email, first_name, last_name, phone, created_at`,
      [email.toLowerCase(), firstName, lastName, phone, passwordHash]
    );

    const newUser = newUserResult.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        email: newUser.email,
        type: 'user'
      },
      process.env.JWT_SECRET || 'goldenfish_jwt_secret_2025',
      { expiresIn: '30d' }
    );

    const userData = {
      id: newUser.id,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      email: newUser.email,
      phone: newUser.phone,
      createdAt: newUser.created_at,
      savedAddresses: []
    };

    console.log('✅ Sign up successful:', { 
      userId: newUser.id, 
      email: newUser.email, 
      name: `${newUser.first_name} ${newUser.last_name}`
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: userData,
        token,
        expiresIn: '30d'
      }
    });

  } catch (error) {
    console.error('❌ Sign up error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Account creation service temporarily unavailable'
    });
  }
});

// Verify token endpoint
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'goldenfish_jwt_secret_2025') as any;
    
    // Get fresh user data
    const userResult = await db.query(
      `SELECT id, email, first_name, last_name, phone, created_at, last_login
       FROM users WHERE id = $1 AND status = 'active'`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    const user = userResult.rows[0];
    return res.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone
      }
    });

  } catch (error) {
    console.error('❌ Token verification error:', error);
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
});

export default router;