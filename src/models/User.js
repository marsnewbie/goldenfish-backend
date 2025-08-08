// User model with validation and security
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase-client');

class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.firstName = data.first_name || data.firstName;
    this.lastName = data.last_name || data.lastName;
    this.phone = data.phone;
    this.passwordHash = data.password_hash || data.passwordHash;
    this.status = data.status || 'active';
    this.createdAt = data.created_at || data.createdAt;
    this.lastLoginAt = data.last_login_at || data.lastLoginAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  // Create new user
  static async create(userData) {
    const { firstName, lastName, email, phone, password } = userData;
    
    // Validate input
    this.validateCreateInput({ firstName, lastName, email, phone, password });
    
    // Check if user already exists
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    
    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Insert into database
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        password_hash: passwordHash,
        status: 'active'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Database error creating user:', error);
      throw new Error('Failed to create user account');
    }
    
    return new User(data);
  }

  // Find user by email
  static async findByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('status', 'active')
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      console.error('Database error finding user by email:', error);
      throw new Error('Database error');
    }
    
    return data ? new User(data) : null;
  }

  // Find user by ID
  static async findById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('status', 'active')
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Database error finding user by ID:', error);
      throw new Error('Database error');
    }
    
    return data ? new User(data) : null;
  }

  // Verify password
  async verifyPassword(plainPassword) {
    return bcrypt.compare(plainPassword, this.passwordHash);
  }

  // Update last login time
  async updateLastLogin() {
    const { error } = await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', this.id);
    
    if (error) {
      console.error('Error updating last login:', error);
    } else {
      this.lastLoginAt = new Date();
    }
  }

  // Get user's addresses
  async getAddresses() {
    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', this.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error getting user addresses:', error);
      return [];
    }
    
    return data || [];
  }

  // Get user's orders
  async getOrders(limit = 50, offset = 0) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', this.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('Error getting user orders:', error);
      return [];
    }
    
    return data || [];
  }

  // Convert to safe object for API responses (no password hash)
  toSafeObject() {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      phone: this.phone,
      status: this.status,
      createdAt: this.createdAt,
      lastLoginAt: this.lastLoginAt
    };
  }

  // Validation methods
  static validateCreateInput(data) {
    const errors = [];
    const { firstName, lastName, email, phone, password } = data;
    
    // Required fields
    if (!firstName || firstName.trim().length === 0) {
      errors.push('First name is required');
    } else if (firstName.trim().length > 50) {
      errors.push('First name must be less than 50 characters');
    }
    
    if (!lastName || lastName.trim().length === 0) {
      errors.push('Last name is required');
    } else if (lastName.trim().length > 50) {
      errors.push('Last name must be less than 50 characters');
    }
    
    // Email validation
    if (!email || !this.isValidEmail(email)) {
      errors.push('Valid email address is required');
    }
    
    // Phone validation
    if (!phone || !this.isValidPhone(phone)) {
      errors.push('Valid UK phone number is required');
    }
    
    // Password validation
    if (!password || password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }
    
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }

  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPhone(phone) {
    // UK phone number validation
    const phoneRegex = /^(\+44|0)[1-9]\d{8,10}$/;
    const cleanPhone = phone.replace(/\s/g, '');
    return phoneRegex.test(cleanPhone);
  }

  // Check if user is admin (you can extend this logic)
  isAdmin() {
    return this.email === 'admin@goldenfish.co.uk';
  }
}

module.exports = User;