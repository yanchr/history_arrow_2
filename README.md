# History Arrow - Interactive Chronological Explorer

https://history-arrow-2.yanick-christen.com/

A full-stack web application for visualizing historical events along a dynamic timeline. Users can explore point events (specific dates) and time spans (ranges) through an intuitive hover-based interface.

## Features

- **Dynamic Arrow Timeline**: Interactive horizontal timeline that scales based on the time range
- **Hybrid Event Markers**: 
  - **Points**: Precise markers for specific dates (e.g., "Oct 21, 1879")
  - **Spans**: Boundary-defined blocks for eras (e.g., "Renaissance Period")
- **Hover Exploration**: Rich tooltips with event details on hover
- **Admin Dashboard**: Protected CRUD interface for managing events
- **Authentication**: Secure JWT-based auth via Supabase
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: React 18, Vite, Framer Motion, React Router
- **Backend**: Node.js, Express
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: CSS with custom properties

## Project Structure

```
history-arrow/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page components
│   │   ├── styles/         # Global styles
│   │   └── utils/          # Utility functions
│   ├── package.json
│   └── vite.config.js
├── server/                 # Express backend
│   ├── src/
│   │   ├── config/         # Configuration
│   │   ├── middleware/     # Express middleware
│   │   └── routes/         # API routes
│   └── package.json
├── supabase-schema.sql     # Database schema
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier works)

### 1. Clone and Install Dependencies

```bash
# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to the SQL Editor and run the contents of `supabase-schema.sql`
3. Get your project URL and keys from Settings > API

### 3. Configure Environment Variables

**Client** (`client/.env`):
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:5000
```

**Server** (`server/.env`):
```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

### 4. Run the Application

**Start the server:**
```bash
cd server
npm run dev
```

**Start the client (in a new terminal):**
```bash
cd client
npm run dev
```

The app will be available at `http://localhost:3000`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | Get all events |
| GET | `/api/events/:id` | Get single event |
| POST | `/api/events` | Create new event |
| PUT | `/api/events/:id` | Update event |
| DELETE | `/api/events/:id` | Delete event |
| GET | `/health` | Health check |

## Usage

### Public Timeline
- Visit the home page to view the interactive timeline
- Use zoom and pan controls to navigate
- Hover over events to see detailed information
- Filter by event type (points vs spans)

### Admin Dashboard
1. Click "Admin Login" in the header
2. Sign in with your Supabase credentials (or create an account)
3. Add, edit, or delete historical events
4. Toggle between point events and time spans

## Event Data Structure

```typescript
{
  id: string;
  title: string;
  description?: string;
  start_date: string;    // ISO date format
  end_date?: string;     // Optional - if null, it's a point event
  created_at: string;
  updated_at: string;
}
```

## Development Notes

### Without Supabase
The server includes mock data and will work without Supabase configured. This is useful for:
- Local development
- Testing UI components
- Demonstrations

### Handling Ancient Dates
The application supports ancient dates (BCE/BC) through special formatting:
- Dates display as "X BCE" for negative years
- Very ancient dates show in millions/billions of years format

## Deployment

### Frontend (Netlify)
1. Connect your GitHub repository
2. Set build command: `cd client && npm run build`
3. Set publish directory: `client/dist`
4. Add environment variables in Netlify dashboard

### Backend (Railway/Render)
1. Deploy the `server` directory
2. Set `NODE_ENV=production`
3. Configure environment variables

## License

MIT License - feel free to use this project for learning and personal projects.
