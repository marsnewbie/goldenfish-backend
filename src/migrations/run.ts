import { readFileSync } from 'fs';
import { join } from 'path';
import { db, connectDatabase } from '../config/database';
import config from '../config/environment';

/**
 * Database migration runner
 * Run with: npm run migrate
 */

interface Migration {
  id: string;
  filename: string;
  sql: string;
}

async function createMigrationsTable(): Promise<void> {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(50) UNIQUE NOT NULL,
      filename VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP DEFAULT NOW()
    );
  `;
  
  await db.query(createTableSql);
  console.log('✅ Migrations table ready');
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await db.query('SELECT version FROM schema_migrations ORDER BY executed_at');
  return result.rows.map(row => row.version);
}

async function executeMigration(migration: Migration): Promise<void> {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    // Execute migration SQL
    console.log(`📋 Executing migration: ${migration.filename}`);
    await client.query(migration.sql);
    
    // Record migration as executed
    await client.query(
      'INSERT INTO schema_migrations (version, filename) VALUES ($1, $2)',
      [migration.id, migration.filename]
    );
    
    await client.query('COMMIT');
    console.log(`✅ Migration completed: ${migration.filename}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration failed: ${migration.filename}`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations(): Promise<void> {
  try {
    console.log('🚀 Starting database migrations...');
    console.log(`📍 Database: ${config.databaseUrl.split('@')[1] || 'localhost'}`);
    
    // Connect to database
    await connectDatabase();
    
    // Create migrations tracking table
    await createMigrationsTable();
    
    // Get list of executed migrations
    const executedMigrations = await getExecutedMigrations();
    console.log(`📋 Previously executed migrations: ${executedMigrations.length}`);
    
    // Define available migrations
    const migrations: Migration[] = [
      {
        id: '001',
        filename: '001_initial_schema.sql',
        sql: readFileSync(join(__dirname, '001_initial_schema.sql'), 'utf8')
      }
      // Add new migrations here as needed
      // {
      //   id: '002',
      //   filename: '002_add_promotions_table.sql',
      //   sql: readFileSync(join(__dirname, '002_add_promotions_table.sql'), 'utf8')
      // }
    ];
    
    // Execute pending migrations
    let executedCount = 0;
    
    for (const migration of migrations) {
      if (!executedMigrations.includes(migration.id)) {
        await executeMigration(migration);
        executedCount++;
      } else {
        console.log(`⏭️  Skipping already executed migration: ${migration.filename}`);
      }
    }
    
    if (executedCount === 0) {
      console.log('✅ No new migrations to execute - database is up to date');
    } else {
      console.log(`✅ Successfully executed ${executedCount} new migration(s)`);
    }
    
    console.log('🎉 Database migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await db.end();
  }
}

// Utility function to check if database needs migration
export async function checkMigrationStatus(): Promise<{ upToDate: boolean; pendingCount: number }> {
  try {
    await connectDatabase();
    await createMigrationsTable();
    
    const executedMigrations = await getExecutedMigrations();
    const totalMigrations = 1; // Update this when adding new migrations
    
    return {
      upToDate: executedMigrations.length >= totalMigrations,
      pendingCount: totalMigrations - executedMigrations.length
    };
  } catch (error) {
    console.error('Error checking migration status:', error);
    return { upToDate: false, pendingCount: -1 };
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };