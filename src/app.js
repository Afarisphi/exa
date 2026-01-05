import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import authRoutes from './routes/auth.routes.js';
import { errorMiddleware } from './middlewares/error.middleware.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', routes);
app.use('/api/auth', authRoutes);

app.use(errorMiddleware);

export default app;
