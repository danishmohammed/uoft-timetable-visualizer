from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.common.exceptions import TimeoutException
from webdriver_manager.chrome import ChromeDriverManager
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import time
import json
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import sys

load_dotenv() # Load variables in .env file

# Setup Selenium WebDriver
options = webdriver.ChromeOptions()
options.add_argument("--headless")  # Run headless Chrome, so the browser window doesn't open
driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)

# Global variables for kill switch and error handling
error_courses = set()
error_messages = []
stop_scraping = False
MAX_ERROR_TOLERANCE = 30
faculty_metadata = {}

# Dummy class to represent a WebElement with a text attribute
class DummyWebElement:
    def __init__(self, text):
        self.text = text

# Helper function to convert 12-hour time to 24-hour time
def convert_to_24hr(time_str):
    try:
        in_time = time.strptime(time_str, "%I:%M %p")
        out_time = time.strftime("%H:%M", in_time)
        return out_time
    except Exception as e:
        return None

# Helper function to convert time object to 12-hour time
def convert_to_12hr(time_obj):
    try:
        return time_obj.strftime("%I:%M %p").lstrip('0')
    except:
        return None

# Helper function to process regular entry that has 7 section-item elements
def process_regular_entry(section_items, course_name, section_title, campus, session, department, faculty):
    global error_courses, error_messages, stop_scraping, faculty_metadata
    entry_course_timings = []

    # Extracting Instructors (Index 2)
    try:
        instructors_elements = WebDriverWait(section_items[2], 10).until(
            EC.visibility_of_all_elements_located((By.XPATH, ".//span"))
        )
        instructors = [elem.text for elem in instructors_elements]
    except Exception as e:
        error_messages.append(f"{course_name} {section_title}: Error extracting Instructor(s): {e}")
        error_courses.add(course_name)
        return []

    # Extracting Availability (Index 3)
    try:
        availability = WebDriverWait(section_items[3], 10).until(
            EC.visibility_of_element_located((By.XPATH, ".//span"))
        ).text
        if ' of ' not in availability:
            return []
        available, capacity = availability.split(' of ')
        capacity = int(capacity)
        current_enrolment = capacity - int(available)
    except Exception as e:
        error_messages.append(f"{course_name} {section_title}: Error extracting Availability: {e}")
        error_courses.add(course_name)
        return []
    
    # Extracting Delivery Mode (Index 6)
    try:
        delivery_mode = WebDriverWait(section_items[6], 10).until(
            EC.visibility_of_all_elements_located((By.XPATH, ".//span"))
        )[1].text
    except Exception as e:
        error_messages.append(f"{course_name} {section_title}: Error extracting Delivery Mode: {e}")
        error_courses.add(course_name)
        return []

    # Extracting Day/Time and Location (Index 0 and 1)
    try:
        day_time_spans = WebDriverWait(section_items[0], 10).until(
            EC.visibility_of_all_elements_located((By.XPATH, ".//span"))
        )[1:]
        location_elements = WebDriverWait(section_items[1], 10).until(
            EC.visibility_of_all_elements_located((By.XPATH, ".//span | .//a"))
        )[1:]
    except Exception as e:
        error_messages.append(f"{course_name} {section_title}: Error extracting Day/time spans or Location elements: {e}")
        error_courses.add(course_name)
        return []

    while len(location_elements) < len(day_time_spans):
        location_elements.append(DummyWebElement(location_elements[0].text))

    if "Summer" in session and "(Y)" in session:
        year = session.split()[-2]
        first_session_label = f"Summer First Sub-Session {year} (F)"
        second_session_label = f"Summer Second Sub-Session {year} (S)"
        sub_semesters = [first_session_label, second_session_label]
    elif "Fall-Winter" in session and "(Y)" in session:
        years = session.split()[-2] 
        year_fall, year_winter = years.split("-")
        first_session_label = f"Fall {year_fall} (F)"
        second_session_label = f"Winter {year_winter} (S)"
        sub_semesters = [first_session_label, second_session_label]
    else:
        sub_semesters = [session]

    for day_time_span, location_element in zip(day_time_spans, location_elements):
        try:
            day_time_text = day_time_span.text
            if day_time_text == "TBA" or day_time_text == "Asynchronous":
                day = day_time_text
                start_time = day_time_text
                end_time = day_time_text
            else:
                day, time_range = day_time_text.split(' ', 1)
                start_time, end_time = time_range.split(' - ')
                start_time = convert_to_24hr(start_time)
                end_time = convert_to_24hr(end_time)

                if start_time is None or end_time is None:
                    error_messages.append(f"{course_name} {section_title}: Failed to convert time to 24-hour format")
                    error_courses.add(course_name)
                    continue
        except Exception as e:
            error_messages.append(f"{course_name} {section_title}: Error extracting Day/Time text: {e}")
            error_courses.add(course_name)
            continue
            
        try:
            location = location_element.text.strip('-')
        except Exception as e:
            error_messages.append(f"{course_name} {section_title}: Error extracting Location text: {e}")
            error_courses.add(course_name)
            continue

        for sub_semester in sub_semesters:
            timing_entry = {
                "course_name": course_name,
                "section_title": section_title,
                "day": day,
                "start_time": start_time,
                "end_time": end_time,
                "campus": campus,
                "session": sub_semester,
                "department": department,
                "faculty": faculty,
                "location": location,
                "instructors": instructors,
                "capacity": capacity,
                "current_enrolment": current_enrolment,
                "delivery_mode": delivery_mode
            }

            entry_course_timings.append(timing_entry)

            if sub_semester not in faculty_metadata["semesters"]:
                faculty_metadata["semesters"][sub_semester] = {"departments": {}}

            if department not in faculty_metadata["semesters"][sub_semester]["departments"]:
                faculty_metadata["semesters"][sub_semester]["departments"][department] = {
                    "buildings": set(),
                    "instructors": set()
                }

            faculty_metadata["semesters"][sub_semester]["departments"][department]["buildings"].add(location)        
            for instructor in instructors:
                faculty_metadata["semesters"][sub_semester]["departments"][department]["instructors"].add(instructor)

    return entry_course_timings

# Helper function to process Y (Two Terms) entry that has 9 section-item elements
def process_y_two_terms_entry(section_items, course_name, section_title, campus, session, department, faculty):
    global error_courses, error_messages, stop_scraping
    entry_course_timings = []

    # Extracting Instructors (Index 4)
    try:
        instructors_elements = WebDriverWait(section_items[4], 10).until(
            EC.visibility_of_all_elements_located((By.XPATH, ".//span"))
        )
        instructors = [elem.text for elem in instructors_elements]
    except Exception as e:
        error_messages.append(f"{course_name} {section_title}: Error extracting Instructor(s): {e}")
        error_courses.add(course_name)
        return []

    # Extracting Availability (Index 5)
    try:
        availability = WebDriverWait(section_items[5], 10).until(
            EC.visibility_of_element_located((By.XPATH, ".//span"))
        ).text
        if ' of ' not in availability:
            return []
        available, capacity = availability.split(' of ')
        capacity = int(capacity)
        current_enrolment = capacity - int(available)
    except Exception as e:
        error_messages.append(f"{course_name} {section_title}: Error extracting Availability: {e}")
        error_courses.add(course_name)
        return []
    
    # Extracting Delivery Mode (Index 8)
    try:
        delivery_mode = WebDriverWait(section_items[8], 10).until(
            EC.visibility_of_all_elements_located((By.XPATH, ".//span"))
        )[1].text
    except Exception as e:
        error_messages.append(f"{course_name} {section_title}: Error extracting Delivery Mode: {e}")
        error_courses.add(course_name)
        return []

    # Only 2 possible sessions with exact format:  
    # 1) "Summer Full Session {year} (Y)"
    # 2) "Fall-Winter {year-year+1} (Y)"
    if "Summer" in session:
        year = session.split()[-2]
        first_session_label = f"Summer First Sub-Session {year} (F)"
        second_session_label = f"Summer Second Sub-Session {year} (S)"
    else:
        years = session.split()[-2] 
        year_fall, year_winter = years.split("-")
        first_session_label = f"Fall {year_fall} (F)"
        second_session_label = f"Winter {year_winter} (S)"
    
    # Extracting Day/Time and Location for both terms (Index 0,1 and 2,3)
    for term_index, session_label in [(0, first_session_label), (2, second_session_label)]:
        try:
            day_time_spans = WebDriverWait(section_items[term_index], 10).until(
                EC.visibility_of_all_elements_located((By.XPATH, ".//span"))
            )[2:]
            location_elements = WebDriverWait(section_items[term_index + 1], 10).until(
                EC.visibility_of_all_elements_located((By.XPATH, ".//span | .//a"))
            )[2:]
        except Exception as e:
            error_messages.append(f"{course_name} {section_title}: Error extracting Day/time spans or Location elements: {e}")
            error_courses.add(course_name)
            continue

        while len(location_elements) < len(day_time_spans):
            location_elements.append(DummyWebElement(location_elements[0].text))

        for day_time_span, location_element in zip(day_time_spans, location_elements):
            try:
                day_time_text = day_time_span.text
                if day_time_text == "TBA" or day_time_text == "Asynchronous":
                    day = None
                    start_time = None
                    end_time = None
                else:
                    day, time_range = day_time_text.split(' ', 1)
                    start_time, end_time = time_range.split(' - ')
                    start_time = convert_to_24hr(start_time)
                    end_time = convert_to_24hr(end_time)

                    if start_time is None or end_time is None:
                        error_messages.append(f"{course_name} {section_title}: Failed to convert time to 24-hour format")
                        error_courses.add(course_name)
                        continue
            except Exception as e:
                error_messages.append(f"{course_name} {section_title}: Error extracting Day/Time text: {e}")
                error_courses.add(course_name)
                continue
                
            try:
                location = location_element.text.strip('-')
            except Exception as e:
                error_messages.append(f"{course_name} {section_title}: Error extracting Location text: {e}")
                error_courses.add(course_name)
                continue

            timing_entry = {
                "course_name": course_name,
                "section_title": section_title,
                "day": day,
                "start_time": start_time,
                "end_time": end_time,
                "campus": campus,
                "session": session_label,
                "department": department,
                "faculty": faculty,
                "location": location,
                "instructors": instructors,
                "capacity": capacity,
                "current_enrolment": current_enrolment,
                "delivery_mode": delivery_mode
            }

            entry_course_timings.append(timing_entry)

            if session_label not in faculty_metadata["semesters"]:
                faculty_metadata["semesters"][session_label] = {"departments": {}}

            if department not in faculty_metadata["semesters"][session_label]["departments"]:
                faculty_metadata["semesters"][session_label]["departments"][department] = {
                    "buildings": set(),
                    "instructors": set()
                }

            faculty_metadata["semesters"][session_label]["departments"][department]["buildings"].add(location)        
            for instructor in instructors:
                faculty_metadata["semesters"][session_label]["departments"][department]["instructors"].add(instructor)

    return entry_course_timings

# Helper function to extract all the course timings from a course element
def extract_course_timings(course_element):
    global error_courses, error_messages, stop_scraping
    course_timings = []
    
    # Extract course name, campus, session, department, faculty
    try:
        course_name = WebDriverWait(course_element, 10).until(
            EC.visibility_of_element_located((By.XPATH, ".//button[contains(@class, 'accordion-button')]/span"))
        ).text
    except Exception as e:
        error_messages.append(f"Error extracting Course Name: {e}")
        return [] 

    try:
        campus = WebDriverWait(course_element, 10).until(
            EC.visibility_of_element_located((By.XPATH, ".//label[text()='Campus']/following-sibling::span"))
        ).text
    except Exception as e:
        error_messages.append(f"Error extracting Campus for course {course_name}: {e}")
        error_courses.add(course_name)
        return [] 

    try:
        session = WebDriverWait(course_element, 10).until(
            EC.visibility_of_element_located((By.XPATH, ".//label[text()='Session']/following-sibling::span"))
        ).text
    except Exception as e:
        error_messages.append(f"Error extracting Session for course {course_name}: {e}")
        error_courses.add(course_name)
        return [] 

    try:
        more_info_button = WebDriverWait(course_element, 10).until(
            EC.element_to_be_clickable((By.XPATH, ".//button[contains(@class, 'toggle-class')]"))
        )
        more_info_button.click()

        # Wait for the course details section to be visible
        WebDriverWait(course_element, 10).until(
            EC.visibility_of_element_located((By.XPATH, ".//div[@class='course-details']"))
        )

        department = WebDriverWait(course_element, 10).until(
            EC.visibility_of_element_located((By.XPATH, ".//label[text()='Department:']/following-sibling::span"))
        ).text

        faculty = WebDriverWait(course_element, 10).until(
            EC.visibility_of_element_located((By.XPATH, ".//label[text()='Faculty / Division:']/following-sibling::span"))
        ).text
    except Exception as e:
        error_messages.append(f"Error extracting Department or Faculty for course {course_name}: {e}")
        error_courses.add(course_name)
        return []
    
    # Error check, because for some reason Faculty of Information puts "" as the department
    if department == "":
        department = faculty

    try:
        course_sections = WebDriverWait(course_element, 10).until(
            EC.visibility_of_all_elements_located((By.XPATH, ".//div[contains(@class, 'course-sections')]"))
        )
    except Exception as e:
        error_messages.append(f"Error extracting Course Sections for course {course_name}: {e}")
        error_courses.add(course_name)
        return []
    
    for section in course_sections:
        if stop_scraping:
            break

        # Extracting Section Title
        try:
            section_title = WebDriverWait(section, 10).until(
                EC.visibility_of_element_located((By.XPATH, ".//h4"))
            ).text
        except Exception as e:
            error_messages.append(f"{course_name}: Error extracting Section Title for course {course_name}: {e}")
            error_courses.add(course_name)
            continue
        
        # Extracting Section Entries
        try:
            section_entries = WebDriverWait(section, 10).until(
                EC.visibility_of_all_elements_located((By.XPATH, ".//div[contains(@class, 'course-section')]"))
            )
        except Exception as e:
            error_messages.append(f"{course_name}: Error extracting Section Entries for course {course_name}: {e}")
            error_courses.add(course_name)
            continue
        
        for entry in section_entries:
            if stop_scraping:
                break

            try:
                section_items = WebDriverWait(entry, 10).until(
                    EC.visibility_of_all_elements_located((By.XPATH, ".//div[contains(@class, 'section-item')]"))
                )

                if len(section_items) == 7:
                    entry_course_timings = process_regular_entry(section_items, course_name, section_title, campus, session, department, faculty)
                else: # len(section_items) == 9 and it's a Y (Two Terms) entry with 2 day/times and 2 locations
                    entry_course_timings = process_y_two_terms_entry(section_items, course_name, section_title, campus, session, department, faculty)
                    
                course_timings.extend(entry_course_timings)

            except Exception as e:
                error_messages.append(f"Error extracting section entries for {course_name} {section_title}: {e}")
                error_courses.add(course_name)
                continue

    return course_timings

# Helper function to save the course timings to a JSON file
def save_course_timings_to_json(course_timings, session_name, division_name):
    data_dir = os.path.join("data", session_name.replace(" ", "_"))
    os.makedirs(data_dir, exist_ok=True)

    filename = f"{division_name.replace(' ', '_')}.json"
    file_path = os.path.join(data_dir, filename)
    
    data_to_save = {
        "faculty_metadata": faculty_metadata,
        "timings": course_timings
    }

    with open(file_path, 'w') as json_file:
        json.dump(data_to_save, json_file, indent=4)
    
    print(f"Data has been saved to {file_path} successfully.")

# Helper function to save the course timings to a MongoDB collection
def save_to_mongodb(course_timings, session_name, division_name):
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        print("Error: MONGO_URI not found in environment variables.")
        return

    # Use the session as the database name and faculty_division as the collection name
    db_name = session_name.replace(' ', '_')
    collection_name = division_name.replace(' ', '_')

    # Connect to MongoDB
    client = MongoClient(mongo_uri)
    db = client[db_name]
    collection = db[collection_name]

    collection.delete_many({})
    
    collection.insert_one(faculty_metadata)
    if course_timings:
        collection.insert_many(course_timings)
    print(f"Inserted {len(course_timings)} records into the collection {collection_name} in database {db_name}.")
    
    client.close()

def send_email():
    global error_courses, error_messages
    print("Several errors occurred while scraping the timetable data. Sending email to admin...")
    subject = "Error scraping timetable data for Uoft Timetable Visualizer App"
    body = ", ".join(error_courses) + "\n" + "\n".join(error_messages)
    try:
        sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
        message = Mail(
            from_email=os.getenv('ADMIN_EMAIL'),
            to_emails=os.getenv('ADMIN_EMAIL'),
            subject=subject,
            html_content=body
        )
        response = sg.send(message)
        print(f"Email sent: Status {response.status_code}")
    except Exception as e:
        print(f"Failed to send email: {e}")

# Main function to scrape the timetable data
def scrape_timetable_data():
    global error_courses, error_messages, stop_scraping, MAX_ERROR_TOLERANCE, faculty_metadata
    url = 'https://ttb.utoronto.ca'
    driver.get(url)

     # Collect all divisions
    try:
        WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.ID, 'division-combo-top-container'))
        ).click()
        division_container = WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.ID, 'division-combo-bottom-container'))
        )
        divisions = WebDriverWait(division_container, 10).until(
            EC.visibility_of_all_elements_located((By.XPATH, ".//app-ttb-option"))
        )

        # Collect all sessions
        WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.ID, 'session-combo-top-container'))
        ).click()
        session_container = WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.ID, 'session-combo-bottom-container'))
        )
    except Exception as e:
        error_messages.append(f"Error collecting divisions or sessions: {e}")
        stop_scraping = True
        return

    try:
        sessions = WebDriverWait(session_container, 5).until(
            EC.visibility_of_all_elements_located((By.XPATH, ".//app-ttb-optiongroup"))
        )
        session_names = [session.get_attribute('aria-label') for session in sessions]
        more_than_one_session = True

    except TimeoutException: # Its possible that there is only one session available so no radio buttons are present
        fallback_option = WebDriverWait(session_container, 5).until(
            EC.visibility_of_element_located((By.XPATH, ".//app-ttb-option"))
        )
        session_label = fallback_option.get_attribute('aria-label')
        session_label = (session_label.split(",")[0]).strip()
        session_names = [session_label]
        more_than_one_session = False

    for division in divisions:
        division_name = division.get_attribute('aria-label')

        try:
            WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.ID, 'division-combo-top-container'))
            ).click()
            division_container = WebDriverWait(driver, 10).until(
                EC.visibility_of_element_located((By.ID, 'division-combo-bottom-container'))
            )
            WebDriverWait(division_container, 10).until(
                EC.element_to_be_clickable((By.XPATH, f"//app-ttb-option[@aria-label='{division_name}']"))
            ).click()
        except Exception as e:
            error_messages.append(f"Error selecting division: {e}")
            stop_scraping = True
            break

        for session_name in session_names:
            
            try:
                WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.ID, 'session-combo-top-container'))
                ).click()
                
                if more_than_one_session:
                    session_container = WebDriverWait(driver, 10).until(
                        EC.visibility_of_element_located((By.ID, 'session-combo-bottom-container'))
                    )
                    WebDriverWait(session_container, 10).until(
                        EC.element_to_be_clickable((By.XPATH, f"//app-ttb-optiongroup[@aria-label='{session_name}']"))
                    ).click()

                existing_courses = driver.find_elements(By.XPATH, "//app-course")

                # Click the search button
                WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[contains(@class, 'btn-primary') and contains(., 'Search')]"))
                ).click()

                # If there are existing courses, wait for them to go stale
                if existing_courses:
                    WebDriverWait(driver, 10).until(EC.staleness_of(existing_courses[0]))

                faculty_metadata = {
                    "faculty_name": division_name,
                    "semesters": {}
                }
                all_timings_data = []
            
            except Exception as e:
                error_messages.append(f"Error selecting session or searching for courses: {e}")
                stop_scraping = True
                break

            # Loop through all pages for the selected campus and session
            while True:
                
                try:
                    WebDriverWait(driver, 10).until(
                        EC.visibility_of_element_located((By.CLASS_NAME, 'courses-section'))
                    )
                except Exception as e:
                    error_messages.append(f"Error loading courses section: {e}")
                    stop_scraping = True
                    break

                # Try to get all course elements. If there are none, then break the loop
                try:
                    courses = WebDriverWait(driver, 10).until(
                        EC.visibility_of_all_elements_located((By.XPATH, "//app-course"))
                    )
                except TimeoutException:
                    courses = []
                
                if not courses:
                    break

                for course in courses:
                    try:
                        # Click the caret button to expand the course section details
                        WebDriverWait(course, 10).until(
                            EC.element_to_be_clickable((By.XPATH, ".//button[contains(@class, 'accordion-button')]"))
                        ).click()
                        
                        WebDriverWait(course, 10).until(
                            EC.visibility_of_element_located((By.XPATH, ".//div[contains(@class, 'course-sections')]"))
                        )

                        course_timings = extract_course_timings(course)
                        all_timings_data.extend(course_timings)
                    
                    except Exception as e:
                        error_messages.append(f"Error clicking caret button or waiting for course sections: {e}")
                        stop_scraping = True # Stop scraping if you can't click a course caret, even if it only happens once
                        break
                    
                    if stop_scraping: # Something inside the extract_course_timings function went wrong
                            break 
                    
                    # break # Only scrape the first course on the page
                
                # break # Only scrape the first page
                
                # Check if we need to stop scraping after each page
                if stop_scraping or len(error_courses) >= MAX_ERROR_TOLERANCE:
                    stop_scraping = True
                    break
                
                # Check if the "Next" button is available and click it
                try:
                    next_button_container = driver.find_element(By.CLASS_NAME, 'pagination')
                    next_button = next_button_container.find_element(By.XPATH, "//a[@aria-label='Next']")
                    if 'disabled' in next_button.find_element(By.XPATH, "..").get_attribute('class'):
                        break

                    # Scroll the next button into view and click using JavaScript
                    driver.execute_script("arguments[0].scrollIntoView(true);", next_button)
                    driver.execute_script("arguments[0].click();", next_button)

                    WebDriverWait(driver, 10).until(
                        EC.staleness_of(courses[0])
                    )

                except Exception as e:
                    error_messages.append(f"Error clicking next button: {e}")
                    stop_scraping = True
                    break

            if stop_scraping or len(error_courses) >= MAX_ERROR_TOLERANCE:
                stop_scraping = True
                break
                
            else:
                for semester in faculty_metadata["semesters"]:
                    for department in faculty_metadata["semesters"][semester]["departments"]:
                        faculty_metadata["semesters"][semester]["departments"][department]["buildings"] = list(faculty_metadata["semesters"][semester]["departments"][department]["buildings"])
                        faculty_metadata["semesters"][semester]["departments"][department]["instructors"] = list(faculty_metadata["semesters"][semester]["departments"][department]["instructors"])
                
                now = datetime.now()
                last_updated = f"{now.strftime('%B %d, %Y')} at {convert_to_12hr(now)}"
                faculty_metadata["last_updated"] = last_updated
                try:
                    save_course_timings_to_json(all_timings_data, session_name, division_name)
                    save_to_mongodb(all_timings_data, session_name, division_name)
                except Exception as e:
                    error_messages.append(f"Error saving data to file or MongoDB: {e}")
                    stop_scraping = True
                    break # This will break the session loop

        if stop_scraping:
            break
        
        # Reset filters
        try:
            if more_than_one_session:
                WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[contains(@class, 'btn-primary') and contains(., 'Reset Filters')]"))
                ).click()
            else:
                WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.ID, 'division-combo-top-container'))
                ).click()
                division_container = WebDriverWait(driver, 10).until(
                    EC.visibility_of_element_located((By.ID, 'division-combo-bottom-container'))
                )
                WebDriverWait(division_container, 10).until(
                    EC.element_to_be_clickable((By.XPATH, f"//app-ttb-option[@aria-label='{division_name}']"))
                ).click()
                WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.ID, 'division-combo-top-container'))
                ).click()
        except Exception as e:
            error_messages.append(f"Error resetting filters: {e}")
            stop_scraping = True
            break
    
    for error_message in error_messages:
        print(error_message)

if __name__ == '__main__':
    scrape_timetable_data()
    if stop_scraping or len(error_courses) >= MAX_ERROR_TOLERANCE:
        send_email()
    else:
        print("Scraping completed successfully")
    driver.quit()