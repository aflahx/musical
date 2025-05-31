# Music Player Web Application

A web-based music player application that allows users to play, share, and manage audio files. The application features a public interface for listening to music and an admin interface for managing the audio library.

## Features

- **Public Interface**
  - Browse and play audio files
  - Create and manage playlists
  - Mark songs as favorites
  - Share songs via social media
  - Search and sort functionality
  - Dark/Light theme support
  - Keyboard shortcuts

- **Admin Interface**
  - Upload audio files
  - Delete files
  - Rename files
  - Secure login system

## Tech Stack

- Backend: Node.js with Express
- Database: SQLite
- Frontend: HTML, CSS, JavaScript
- File Upload: express-fileupload
- Icons: Font Awesome

## Prerequisites

- Node.js (v12 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/music-player.git
cd music-player
```

2. Install dependencies:
```bash
cd backend
npm install
```

3. Create required directories:
```bash
mkdir uploads
```

4. Start the server:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Admin Access

- Username: aflah
- Password: neenu

## Deployment

1. Create a new repository on GitHub
2. Push your code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/music-player.git
git push -u origin main
```

3. Deploy to a hosting service (e.g., Heroku, Railway, or Render)

## Environment Variables

Create a `.env` file in the backend directory with the following variables:
```
PORT=3000
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 