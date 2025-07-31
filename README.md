# Shift Distributor

A Next.js application for managing doctor shifts and schedules. Built with shadcn/ui components and Drizzle ORM with SQLite.

## Features

- **Calendar View**: Interactive calendar to view and assign shifts for specific dates
- **Shift Management**: Assign doctors to 17-shift and 20-shift slots
- **Doctor Management**: Add and manage doctors with their unavailable dates
- **Responsive Design**: Works on both desktop and mobile devices

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **UI Components**: shadcn/ui with Tailwind CSS
- **Database**: SQLite with Drizzle ORM
- **Date Handling**: date-fns
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd shift-distributor
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
# Generate the database schema
npm run db:generate

# Run migrations
npm run db:migrate
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Adding Doctors

1. Navigate to the "Doctors" page
2. Click "Add Doctor"
3. Enter the doctor's name
4. Click "Add Doctor" to save

### Managing Unavailable Dates

1. On the "Doctors" page, click "Manage Unavailable Dates" for any doctor
2. Select the dates when the doctor cannot work
3. Click "Save Changes"

### Assigning Shifts

1. Go to the "Calendar" page
2. Click on any date in the calendar
3. For each shift type (17-shift or 20-shift):
   - Click "Assign" or "Change"
   - Select a doctor from the dropdown
   - The assignment will be saved automatically

## Database Schema

The application uses three main tables:

- **doctors**: Stores doctor information (id, name, created_at)
- **shifts**: Stores shift assignments (id, date, shift_type, doctor_id, created_at)
- **unavailable_dates**: Stores dates when doctors cannot work (id, doctor_id, date, created_at)

## API Endpoints

- `GET /api/doctors` - Get all doctors
- `POST /api/doctors` - Create a new doctor
- `GET /api/doctors/[id]/unavailable-dates` - Get unavailable dates for a doctor
- `POST /api/doctors/[id]/unavailable-dates` - Update unavailable dates for a doctor
- `GET /api/shifts` - Get shifts (optionally filtered by date)
- `POST /api/shifts` - Create or update a shift assignment

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Drizzle Studio

### Project Structure

```
src/
├── app/
│   ├── api/           # API routes
│   ├── doctors/       # Doctors management page
│   ├── globals.css    # Global styles
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Calendar page
├── components/
│   └── ui/            # shadcn/ui components
└── lib/
    ├── db/            # Database configuration
    └── utils.ts       # Utility functions
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.
