# Creative Brief Builder

A tool for creating and managing creative briefs for traditional and digital media campaigns.

## Features

- **Multi-channel support**: TV, Radio, Out of Home, Digital
- **Publisher spec database**: Pre-loaded specs for major publishers
- **Brief builder**: Filter by channel → state → publisher → add placements
- **Due date management**: Set individual or bulk due dates
- **Client portal**: Shareable link for clients to view specs and upload creative
- **Status tracking**: Briefed → Creative Received → Approved → Live
- **File uploads**: Clients can upload creative directly against each deliverable

## Setup

### 1. Create GitHub Repository

1. Go to GitHub and create a new repository (e.g., `creative-brief-tool`)
2. Clone it locally or use GitHub's "Upload files" feature

### 2. Upload Project Files

Upload all files from this project to your repository.

### 3. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Add environment variable:
   - `BLOB_READ_WRITE_TOKEN`: Get from Vercel Blob storage (see below)
5. Click "Deploy"

### 4. Set Up Vercel Blob Storage

1. In your Vercel project dashboard, go to "Storage"
2. Click "Create Database" → "Blob"
3. Name it (e.g., "creative-brief-storage")
4. Copy the `BLOB_READ_WRITE_TOKEN`
5. Add it to your project's environment variables

### 5. Add Sunny Logo

Upload `sunny-logo.png` to the `/public` folder (or update references to use your own branding).

## Usage

### Sunny (Admin) Flow
1. Visit the dashboard at `/`
2. Click "New Brief"
3. Enter client and campaign name
4. Select channel → state → publisher
5. Add placements to brief
6. Set due dates
7. Create brief and copy client link

### Client Flow
1. Client receives unique link (e.g., `/b/abc123`)
2. Views all required deliverables with specs
3. Expands each item to see detailed specifications
4. Uploads creative files against each deliverable
5. Progress tracked automatically

## Tech Stack

- Next.js 15 (App Router)
- React 19
- Tailwind CSS
- Vercel Blob Storage

## Customization

### Adding New Publishers/Specs
Edit `lib/specs.js` to add or modify:
- Channels
- Publishers
- Placements and their specifications

### Styling
- Colors defined in `tailwind.config.js`
- Global styles in `app/globals.css`
- Component-level Tailwind classes

## Support

Built by BRAIVE for Sunny Advertising.
