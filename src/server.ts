import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import agentsRoutes from './routes/agents.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/agents', agentsRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'heytam-agents-backend' });
});

app.listen(PORT, () => {
  console.log(`Heytam Agents Backend is running on port ${PORT}`);
});
