import express from 'express';
import cors from 'cors';
import chatRoutes from './src/routes/chatRoutes.js';
import conversationRoutes from './src/routes/conversationRoutes.js';
import modelRoutes from './src/routes/modelRoutes.js';
import uploadRoutes from './src/routes/uploadRoutes.js';
import executeRoutes from './src/routes/executeRoutes.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { requestLogger } from './src/middleware/requestLogger.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use('/uploads', express.static('uploads'));

app.use('/api/chat', chatRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/execute', executeRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

export default app;
