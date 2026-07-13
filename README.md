# Food App Backend API

A production-ready Node.js Express backend for the **Food App**, featuring secure user authentication, BMI reports, community progress feed sharing, and AI-powered food image analysis using the Google Gemini API.

---

## 🚀 Key Features

* **User Authentication & Profiles**: Register, secure login, JWT-based route protection, session refreshes, and secure password reset workflows.
* **AI Food Recognition & Nutrition**: Upload food images to analyze them via Gemini AI, extracting ingredients, estimated portion sizes, nutrition values (calories, protein, carbs, fat, sugar), and health verdicts.
* **BMI & Calorie Calculators**: Automates Body Mass Index reports, weight classifications, and dynamic daily calorie budget estimates based on user metrics.
* **Community Transformations Feed**: Allows users to post "Before & After" diet/exercise transformation metrics and photos, like posts, and write comments.
* **Harden Security Systems**: Implements global rate limiting, security headers (Helmet), CORS access control, and dynamic DB SSL for production environments.

---

## 🛠️ Tech Stack

* **Runtime & Framework**: Node.js, Express (v5.2.1-beta)
* **Database**: PostgreSQL (relational storage with client pooling)
* **AI Integration**: `@google/genai` (Gemini 2.5 Flash model)
* **Image Processing**: `sharp` (optimizes uploaded images before AI processing)
* **File Uploads**: `multer` (multipart form handling)
* **Security & JWT**: `bcrypt` (password hashing), `jsonwebtoken` (auth tokens), `helmet`, `cors`, `express-rate-limit`

---

## ⚙️ Setup & Installation

### 1. Prerequisites
Ensure you have the following installed on your machine:
* [Node.js](https://nodejs.org/) (v16+)
* [PostgreSQL](https://www.postgresql.org/) database

### 2. Configure Environment Variables
Create a `.env` file in the root directory and define the following variables:

```env
# Database Credentials
DB_NAME=food-app
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here
DB_HOST=localhost
DB_PORT=5432

# Server Port & IP Configuration
PORT=3000
IP=127.0.0.1

# Security & Tokens
NODE_ENV=development
JWT=your_super_secure_jwt_secret_key_here
ALLOWED_ORIGINS=http://localhost:3000

# AI Model Keys
GEMINI_API_KEY=your_gemini_api_key_here

# SMTP Email Configuration (For Password Reset)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
EMAIL_FROM=noreply@foodapp.com
```

### 3. Run the Server Locally

```bash
# Install dependencies
npm install

# Start the application
npm start
```
Once started, the application will automatically create all required database tables (`users`, `food_analyses`, `posts`, `post_likes`, and `post_comments`) if they do not exist.

---

## 📖 API Documentation

The API includes interactive Swagger documentation which can be accessed once the server is running:

* **Swagger UI Docs**: `http://localhost:3000/api-docs`
* **Health Check**: `http://localhost:3000/api/health` (queries PostgreSQL connectivity)

### Primary Endpoint Routes

| Route | Method | Description | Access |
|---|---|---|---|
| `/api/auth/register` | `POST` | Registers a new user | Public |
| `/api/auth/login` | `POST` | Logs in and returns access/refresh tokens | Public |
| `/api/auth/forgot-password`| `POST` | Dispatches reset password links | Public |
| `/api/auth/reset-password` | `POST` | Resets password using valid token | Public |
| `/api/user` | `GET` | Retrieves profile, BMI report, & calorie budget| Protected (JWT) |
| `/api/user` | `PUT` | Edits profile metrics and recalculates BMI | Protected (JWT) |
| `/api/food/analyze` | `POST` | Analyzes uploaded food photo via Gemini AI | Protected (JWT) |
| `/api/food/history` | `GET` | Retrieves user food analysis logs | Protected (JWT) |
| `/api/community` | `GET` | Retrieves transformation posts feed | Protected (JWT) |
| `/api/community` | `POST` | Publishes a before/after progress post | Protected (JWT) |

---

## ☁️ Deployment Guide (Render)

When deploying to [Render](https://render.com/):

1. **Database SSL**: The backend dynamically enables `rejectUnauthorized: false` SSL configurations when `NODE_ENV=production` is detected.
2. **Environment Variables**: Add your Render service URL to the `ALLOWED_ORIGINS` variable in Render environment settings to authorize requests:
   ```text
   ALLOWED_ORIGINS=https://your-food-app.onrender.com,http://localhost:3000
   ```
3. **CORS Safe Blocking**: Rejected origins are blocked safely without crashing the backend server.
