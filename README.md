# Alliance Jobs Backend

This is the backend for the Alliance Jobs portal, a platform for connecting job seekers with employers.

## Features

*   **User Management:** User registration, login, and profile management.
*   **Job Posting:** Employers can post new job openings.
*   **Job Application:** Job seekers can apply for jobs.
*   **Resume Management:** Users can create and manage their resumes.
*   **AI-Powered Features:** The application uses generative AI for various tasks.
*   **Search and Filtering:** Advanced search and filtering options for jobs.
*   **Admin Panel:** An admin panel to manage the platform.

## Technologies Used

*   **Backend:** Node.js, Express.js, TypeScript
*   **Database:** PostgreSQL
*   **ORM:** Drizzle ORM
*   **Authentication:** JSON Web Tokens (JWT)
*   **File Uploads:** Multer
*   **AI:** Google Generative AI

## Database Schema

The database schema is defined using Drizzle ORM in the `src/db/schema.ts` file. The main tables are:

*   `tbl_users`: Stores user information.
*   `tbl_job_post`: Stores job postings.
*   `tbl_job_apply`: Stores job applications.
*   `tbl_resume`: Stores user resumes.
*   `tbl_admin`: Stores admin user information.
*   `attribute`: Stores attributes for jobs and users.
*   `blog`: Stores blog posts.
*   `tbl_cat_sector`: Stores job categories and sectors.
*   `tbl_contact`: Stores contact form submissions.
*   `tbl_notification`: Stores user notifications.
*   `tbl_saved`: Stores saved jobs for users.
*   `tbl_ai_response`: Stores responses from the AI model.

## Available Scripts

In the project directory, you can run:

*   `npm run dev`: Runs the app in development mode.
*   `npm run build`: Builds the app for production.
*   `npm run start`: Starts the production server.
*   `npm run db:studio`: Opens the Drizzle Studio to manage the database.

## API Endpoints

The API routes are defined in the `src/routes` directory. The main routes are:

*   `/api/users`: User-related endpoints.
*   `/api/jobs`: Job-related endpoints.
*   `/api/attributes`: Attribute-related endpoints.

## Environment Variables

Create a `.env` file in the root directory and add the following environment variables:

```
PORT=
DB_URL=
JWT_SECRET=
GOOGLE_API_KEY=
```

## Project Structure
```
├───.env.example
├───.gitignore
├───drizzle.config.ts
├───package-lock.json
├───package.json
├───tsconfig.json
├───.git/...
├───Drizzle/
│   └───Migrations/
├───node_modules/...
├───src/
│   ├───constants/
│   ├───controller/
│   ├───db/
│   ├───lib/
│   ├───middleware/
│   ├───routes/
│   ├───services/
│   ├───util/
│   └───validations/
└───uploads/
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
