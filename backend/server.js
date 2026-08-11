const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { testConnection } = require('./config/db');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const auditRoutes = require('./routes/auditRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notFoundMiddleware = require('./middleware/notFoundMiddleware');
const errorMiddleware = require('./middleware/errorMiddleware');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration (Configurable frontend origin, no wildcard)
const corsOptions = {
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json());

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/reports', reportRoutes);

// 404 Handler for unknown routes
app.use(notFoundMiddleware);

// Centralized Error Handling Middleware
app.use(errorMiddleware);

// Verify database connection and start server
const startServer = async () => {
  try {
    await testConnection();
    console.log('✅ MySQL connection pool established successfully.');
  } catch (error) {
    console.error('❌ Failed to connect to MySQL database:');
    console.error(`   Error Code: ${error.code || 'UNKNOWN'}`);
    console.error(`   Message:    ${error.message}`);
    console.error('   Please ensure MySQL is running and database configuration in .env is correct.');
  }

  app.listen(PORT, () => {
    console.log(`🚀 Employee Leave Management Server listening on port ${PORT}`);
    console.log(`👉 Health check URL: http://localhost:${PORT}/api/health`);
  });
};

startServer();
