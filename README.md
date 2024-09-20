# UofT Timetable Visualizer

The [UofT Timetable Visualizer](ttv.danishmohammed.ca) is a full-stack web application that helps students and event organizers at the University of Toronto view and analyze campus traffic for course enrolments. By displaying up-to-date data in bar charts and heatmaps, users can avoid scheduling conflicts by identifying the busiest days and times on campus.

## Features

- Clear visualizations of weekly student enrolment through bar charts and heatmaps
- Detailed drill-down functionality to view time-specific traffic for a given day of the week
- Flexible and dynamic filtering options for semester, campuses, delivery modes, faculties, departments, buildings, and instructors

## Technologies Used

- **Frontend**: React.js, ApexCharts.js, Tailwind CSS, MUI (Material UI)
- **Backend**: Node.js, Express.js, Axios, MongoDB
- **Web Scraping**: Python (Selenium WebDriver)
- **Hosting**: Oracle OCI

## Contributing

As of now, the Exams visualization feature has not been implemented yet, so we welcome contributions for this! Follow the steps below to set up the project and contribute:

### Getting Started

1. **Fork the repository**: Start by forking the repository to your own GitHub account.
2. **Clone the repository**: Clone the forked repository to your local machine using:
   ```bash
   git clone https://github.com/your-username/uoft-timetable-visualizer.git
   ```
3. **Set up MongoDB**:
   - Create a MongoDB database using [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) or your preferred method.
   - Copy the connection string and link it in a `.env` file in the backend and web-scraping dir under `MONGO_URI`.
   ```bash
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/<dbname>?retryWrites=true&w=majority
   ```
4. **Run the web scraping script**:
   - Optionally, set up a virtual environment if you're experiencing issues with dependencies or package conflicts:
     - Create and activate a virtual environment:

       ```bash
       # For macOS/Linux
       python3 -m venv venv
       source venv/bin/activate

       # For Windows
       python -m venv venv
       .\venv\Scripts\activate
       ```
   - Install the required dependencies using:
     ```bash
     pip install -r requirements.txt
     ```
   - Then, run the script to scrape the data:
   ```bash
   python scraper.py
   ```
   Note: It will take a few hours for the data to populate into the database.
5. **Install backend dependencies**: Navigate to the backend directory and run:
   ```bash
   npm install
   ```
6. **Start the backend server**: Start the backend using:
   ```bash
   npm start
   ```
7. **Install frontend dependencies**: Navigate to the frontend directory and run:
   ```bash
   npm install
   ```
8. **Start the frontend server**: Launch the frontend using:
   ```bash
   npm start
   ```

### Making Contributions

Once you've set up the project, follow these steps to contribute:

1. **Create a new branch**: Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature-branch
   ```
2. **Make your changes**: Implement your changes or new features.
3. **Commit your changes**: Commit your changes with a descriptive message:
   ```bash
   git commit -m 'Add new feature'
   ```
4. **Push to GitHub**: Push your branch to your forked repository:
   ```bash
   git push origin feature-branch
   ```
5. **Open a pull request**: Submit a pull request to the main repository for review.

## Contact

For questions or inquiries, you can contact me through my [personal website](danishmohammed.ca/#contact).

## Acknowledgements

- The University of Toronto for timetable data via [ttb.utoronto.ca](ttb.utoronto.ca).
- [**UofT Index**](uoftindex.ca) for their support and guidance during the initial stages of project development.
