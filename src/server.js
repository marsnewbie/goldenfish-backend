// Server entry point for Golden Fish API
const { app, startServer } = require('./app');

// Start the server
startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});