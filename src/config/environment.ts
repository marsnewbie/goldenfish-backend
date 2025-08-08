import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  resendApiKey: string;
  emailFrom: string;
  jwtSecret: string;
  corsOrigins: string[];
  orderNumberPrefix: string;
  defaultPrepTimes: {
    delivery: number;
    collection: number;
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/goldenfish',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  resendApiKey: process.env.RESEND_API_KEY || 're_jTuYL41J_DpqE9iM23spyFRds7R8rua9x',
  emailFrom: process.env.EMAIL_FROM || 'onlineorder@ringorderai.com',
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
    'https://test-ordering-page.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  orderNumberPrefix: process.env.ORDER_NUMBER_PREFIX || 'GF',
  defaultPrepTimes: {
    delivery: parseInt(process.env.DEFAULT_PREP_TIME_DELIVERY || '30', 10),
    collection: parseInt(process.env.DEFAULT_PREP_TIME_COLLECTION || '20', 10)
  }
};

// Validate required environment variables
const requiredVars = ['DATABASE_URL', 'RESEND_API_KEY'];
requiredVars.forEach(varName => {
  if (!process.env[varName] && config.nodeEnv === 'production') {
    console.error(`❌ Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

export default config;