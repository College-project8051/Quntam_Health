# Quantum-Secured Medical Document Management System

## Prerequisites

- **Node.js** (version 20 or higher recommended)
- **npm** (comes with Node.js)
- **MongoDB** (local installation or MongoDB Atlas connection string)

## Quick Start

### 1. Install Dependencies

Navigate to the project directory and install all required packages:

```bash
cd quantum
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the `quantum` directory (if it doesn't exist) and configure the following:

```env
# MongoDB Connection String
# For local MongoDB:
MONGODB_URI=mongodb://localhost:27017/medical_docs

# OR for MongoDB Atlas (cloud):
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/medical_docs

# Server Port (optional, defaults to 5000)
PORT=5000

# Database URL (for PostgreSQL/Drizzle, if using that instead of MongoDB)
# DATABASE_URL=postgresql://user:password@localhost:5432/medical_docs
```

**Note:** The current setup uses MongoDB (see `server/db.js`). If you want to use PostgreSQL instead, you'll need to update the database configuration.

### 3. Start MongoDB (if using local MongoDB)

If you're using a local MongoDB installation:

**Windows:**
```powershell
# Check if MongoDB service is running
Get-Service MongoDB

# Start MongoDB service (if not running)
Start-Service MongoDB

# Or use Services GUI: Press Win+R, type "services.msc", find "MongoDB" and start it
```

**For detailed MongoDB setup instructions, see [MONGODB_SETUP.md](MONGODB_SETUP.md)**

**macOS (with Homebrew):**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongod
```

### 4. Run the Development Server

Start the development server with hot-reload:

```bash
npm run dev
```

The application will be available at:
- **Frontend & API**: http://localhost:5000

### 5. (Optional) Push Database Schema

If using PostgreSQL with Drizzle ORM, you can push the schema to your database:

```bash
npm run db:push
```

## Available Scripts

- `npm run dev` - Start the development server with hot-reload
- `npm run build` - Build the application for production
- `npm run start` - Run the production build (requires running `npm run build` first)
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push database schema changes to PostgreSQL (if using Drizzle)

## Project Structure

```
quantum/
├── client/          # React frontend application
│   ├── src/
│   │   ├── pages/   # Application pages
│   │   ├── components/  # React components
│   │   └── ...
├── server/          # Express.js backend
│   ├── index.js     # Server entry point
│   ├── routes.js    # API routes
│   ├── db.js        # Database connection (MongoDB)
│   └── ...
├── shared/          # Shared TypeScript schemas
└── package.json     # Project dependencies and scripts
```

## Troubleshooting

### Port Already in Use

If port 5000 is already in use, you can change it by setting the `PORT` environment variable:

```bash
# Windows PowerShell
$env:PORT=3000; npm run dev

# Windows Command Prompt
set PORT=3000 && npm run dev

# macOS/Linux
PORT=3000 npm run dev
```

### MongoDB Connection Issues

- Ensure MongoDB is running (if using local installation)
- Verify your `MONGODB_URI` is correct in the `.env` file
- Check firewall settings if connecting to a remote MongoDB instance

### Database URL Required Error

If you see an error about `DATABASE_URL`, this is expected if you're using MongoDB. The error comes from `drizzle.config.ts` which is for PostgreSQL. You can ignore it if you're using MongoDB, or set a dummy `DATABASE_URL` if you want to suppress the error.

## Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Set `NODE_ENV=production` and start the server:
   ```bash
   npm run start
   ```

Make sure to set all required environment variables in your production environment.

## Additional Information

For more details about the system architecture, features, and dependencies, see `replit.md`.

