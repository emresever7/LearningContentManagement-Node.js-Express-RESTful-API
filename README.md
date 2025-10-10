# Learning Content Management API

A Node.js + Express REST API for managing categories, activities, subtopics, and users in a learning content system.

## Features

- User authentication with JWT
- Protected admin routes for managing users, categories, activities, and subtopics
- Public read-only routes for categories, activities, and subtopics
- Search endpoint for querying content
- MongoDB persistence with Mongoose
- File upload support via multer and AWS S3 SDK

## Tech Stack

- Node.js
- Express
- MongoDB + Mongoose
- JWT authentication
- Multer / multer-s3
- AWS SDK v3
- dotenv
- cors

## Project Structure

- `server.js` - application entry point
- `config/` - configuration helpers (e.g. Multer)
- `middleware/` - custom middleware (authentication)
- `models/` - Mongoose data models
- `routes/` - API route handlers
- `public/` - static assets and frontend content

## Installation

1. Clone the repository

```bash
git clone <repo-url>
cd learning-content-management-api
```

2. Install dependencies

```bash
npm install
```

3. Create a `.env` file in the project root and define the required environment variables:

```env
PORT=5000
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<your-jwt-secret>
FRONTEND_URL=<frontend-origin>
AWS_ACCESS_KEY_ID=<your-aws-access-key-id>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-access-key>
AWS_REGION=<your-aws-region>
S3_BUCKET_NAME=<your-s3-bucket-name>
```

> Note: Add only the variables required by your application and S3 upload configuration.

## Running the Server

Start the server in production mode:

```bash
npm start
```

Start the server in development mode with auto-reload:

```bash
npm run dev
```

The API listens on the port configured in `PORT` or defaults to `5000`.

## API Endpoints

### Authentication

- `POST /api/auth/login` - login and receive JWT
- `POST /api/auth/register` - register a new user

### Public Routes

- `GET /api/public/categories` - list categories
- `GET /api/public/activities` - list activities
- `GET /api/public/subtopics` - list subtopics
- `GET /api/search` - search content

### Admin Routes (protected)

- `GET /api/admin/users` - manage users
- `GET /api/admin/categories` - manage categories
- `GET /api/admin/activities` - manage activities
- `GET /api/admin/subtopics` - manage subtopics

> Protected routes require a valid JWT and are guarded by the `protect` middleware.

## Notes

- `server.js` serves static files from the `public/` directory
- If `JWT_SECRET` is not defined, the application logs a warning and may use a fallback secret

