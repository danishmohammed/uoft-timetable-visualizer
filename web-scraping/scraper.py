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
import re

load_dotenv()
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

options = webdriver.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--disable-gpu")
options.add_argument("--disable-extensions")
driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)

error_courses = set()
error_messages = []
skipped_sections = []
stop_scraping = False
MAX_ERROR_TOLERANCE = 30
faculty_metadata = {}

def class_xpath(class_name):
    return f"contains(concat(' ', normalize-space(@class), ' '), ' {class_name} ')"

TERM_LABELS = {
    "fall": "Fall",
    "winter": "Winter",
    "summer_first": "Summer First Sub-Session",
    "summer_second": "Summer Second Sub-Session",
}

def get_target_database_name(session_name):
    return session_name.replace(" ", "_")

def normalize_session_labels(session_name):
    if "Summer" in session_name:
        year_match = re.search(r"\b(20\d{2})\b", session_name)
        year = year_match.group(1) if year_match else ""
        first_label = f"{TERM_LABELS['summer_first']} {year} (F)".strip()
        second_label = f"{TERM_LABELS['summer_second']} {year} (S)".strip()

        if "(Y)" in session_name or (
            "(F)" not in session_name and "(S)" not in session_name and "Sub-Session" not in session_name
        ):
            return [first_label, second_label]
        if "(S)" in session_name or "Second Sub-Session" in session_name:
            return [second_label]
        return [first_label]

    if "Fall-Winter" in session_name:
        years_match = re.search(r"\b(20\d{2})-(20\d{2})\b", session_name)
        fall_year = years_match.group(1) if years_match else ""
        winter_year = years_match.group(2) if years_match else ""
        fall_label = f"{TERM_LABELS['fall']} {fall_year} (F)".strip()
        winter_label = f"{TERM_LABELS['winter']} {winter_year} (S)".strip()

        if "(Y)" in session_name or ("(F)" not in session_name and "(S)" not in session_name):
            return [fall_label, winter_label]
        if "(S)" in session_name or "Winter" in session_name:
            return [winter_label]
        return [fall_label]

    if "Winter" in session_name:
        return [TERM_LABELS["winter"]]
    if "Fall" in session_name:
        return [TERM_LABELS["fall"]]

    return [session_name]

# Dummy class to represent a WebElement with a text attribute
class DummyWebElement:
    def __init__(self, text):
        self.text = text

def normalize_tba_text(text):
    value = text.strip() if text else ""
    return value or "TBA"

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
    global error_courses, error_messages, skipped_sections, stop_scraping, faculty_metadata
    entry_course_timings = []

    # Extracting Instructors (Index 2)
    try:
        instructors_elements = WebDriverWait(section_items[2], 10).until(
            EC.visibility_of_all_elements_located((By.XPATH, ".//span"))
        )
        instructors = [normalize_tba_text(elem.text) for elem in instructors_elements]
        if not instructors:
            instructors = ["TBA"]
    except Exception as e:
        skipped_sections.append(f"{course_name} {section_title}: Using TBA instructor because Instructor(s) text was unavailable: {e}")
        instructors = ["TBA"]

    # Extracting Availability (Index 3)
    try:
        availability = WebDriverWait(section_items[3], 10).until(
            EC.visibility_of_element_located((By.XPATH, ".//span"))
        ).text
        if ' of ' not in availability:
            skipped_sections.append(
                f"{course_name} {section_title}: Skipping section because availability text is not capacity-formatted: '{availability}'"
            )
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

    if day_time_spans and not location_elements:
        location_elements = [DummyWebElement("TBA") for _ in day_time_spans]

    while len(location_elements) < len(day_time_spans):
        location_elements.append(DummyWebElement(location_elements[0].text))

    sub_semesters = normalize_session_labels(session)

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
            location = normalize_tba_text(location_element.text.strip('-'))
        except Exception as e:
            skipped_sections.append(f"{course_name} {section_title}: Using TBA location because Location text was unavailable: {e}")
            location = "TBA"

        for sub_semester in sub_semesters:
            timing_entry = {
                "course_name": course_name,
                "section_title": section_title,
                "day": day,
                "start_time": start_time,
                "end_time": end_time,
                "campus": campus,
                "session": sub_semester,
                "source_session": session,
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
    global error_courses, error_messages, skipped_sections, stop_scraping
    entry_course_timings = []

    # Extracting Instructors (Index 4)
    try:
        instructors_elements = WebDriverWait(section_items[4], 10).until(
            EC.visibility_of_all_elements_located((By.XPATH, ".//span"))
        )
        instructors = [normalize_tba_text(elem.text) for elem in instructors_elements]
        if not instructors:
            instructors = ["TBA"]
    except Exception as e:
        skipped_sections.append(f"{course_name} {section_title}: Using TBA instructor because Instructor(s) text was unavailable: {e}")
        instructors = ["TBA"]

    # Extracting Availability (Index 5)
    try:
        availability = WebDriverWait(section_items[5], 10).until(
            EC.visibility_of_element_located((By.XPATH, ".//span"))
        ).text
        if ' of ' not in availability:
            skipped_sections.append(
                f"{course_name} {section_title}: Skipping section because availability text is not capacity-formatted: '{availability}'"
            )
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

    if "Summer" in session:
        labels = normalize_session_labels(f"Summer Full Session {session.split()[-2]} (Y)")
        first_session_label = labels[0]
        second_session_label = labels[1]
    else:
        labels = normalize_session_labels(f"Fall-Winter {session.split()[-2]} (Y)")
        first_session_label = labels[0]
        second_session_label = labels[1]
    
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

        if day_time_spans and not location_elements:
            location_elements = [DummyWebElement("TBA") for _ in day_time_spans]

        while len(location_elements) < len(day_time_spans):
            location_elements.append(DummyWebElement(location_elements[0].text))

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
                location = normalize_tba_text(location_element.text.strip('-'))
            except Exception as e:
                skipped_sections.append(f"{course_name} {section_title}: Using TBA location because Location text was unavailable: {e}")
                location = "TBA"

            timing_entry = {
                "course_name": course_name,
                "section_title": section_title,
                "day": day,
                "start_time": start_time,
                "end_time": end_time,
                "campus": campus,
                "session": session_label,
                "source_session": session,
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
            EC.visibility_of_element_located((By.XPATH, f".//button[{class_xpath('accordion-button')}]/span"))
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
            EC.element_to_be_clickable((By.XPATH, f".//button[{class_xpath('toggle-class')}]"))
        )
        more_info_button.click()

        # Wait for the course details section to be visible
        WebDriverWait(course_element, 10).until(
            EC.visibility_of_element_located((By.XPATH, f".//div[{class_xpath('course-details')}]"))
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
            EC.visibility_of_all_elements_located((By.XPATH, f".//div[{class_xpath('course-sections')}]"))
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
                EC.visibility_of_all_elements_located((By.XPATH, f".//div[{class_xpath('course-section')}]"))
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
                    EC.visibility_of_all_elements_located((By.XPATH, f".//div[{class_xpath('section-item')}]"))
                )

                if len(section_items) == 7:
                    entry_course_timings = process_regular_entry(section_items, course_name, section_title, campus, session, department, faculty)
                elif len(section_items) == 9: # Y (Two Terms) entry with 2 day/times and 2 locations
                    entry_course_timings = process_y_two_terms_entry(section_items, course_name, section_title, campus, session, department, faculty)
                else:
                    entry_text = entry.text.replace("\n", " | ")
                    error_messages.append(
                        f"{course_name} {section_title}: Unexpected section-item count {len(section_items)}: {entry_text[:500]}"
                    )
                    error_courses.add(course_name)
                    continue
                    
                course_timings.extend(entry_course_timings)

            except Exception as e:
                error_messages.append(f"Error extracting section entries for {course_name} {section_title}: {e}")
                error_courses.add(course_name)
                continue

    return course_timings

# Helper function to save the course timings to a JSON file
def save_course_timings_to_json(course_timings, session_name, division_name):
    target_db_name = get_target_database_name(session_name)
    data_dir = os.path.join(SCRIPT_DIR, "data", target_db_name)
    os.makedirs(data_dir, exist_ok=True)

    filename = f"{division_name.replace(' ', '_')}.json"
    file_path = os.path.join(data_dir, filename)
    
    data_to_save = {
        "faculty_metadata": faculty_metadata,
        "timings": course_timings
    }

    with open(file_path, 'w') as json_file:
        json.dump(data_to_save, json_file, indent=4)
    
    print(f"Saved {len(course_timings)} records to {file_path} for source session '{session_name}'.")

# Helper function to save the course timings to a MongoDB collection
def save_to_mongodb(course_timings, session_name, division_name):
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        print("Error: MONGO_URI not found in environment variables.")
        return

    # Use stable database names so each run replaces old years instead of creating new selectable years.
    db_name = get_target_database_name(session_name)
    collection_name = division_name.replace(' ', '_')

    # Connect to MongoDB
    client = MongoClient(mongo_uri)
    db = client[db_name]
    collection = db[collection_name]

    collection.delete_many({})
    
    collection.insert_one(faculty_metadata)
    if course_timings:
        collection.insert_many(course_timings)
    print(
        f"Replaced MongoDB collection {db_name}.{collection_name} with "
        f"1 metadata document and {len(course_timings)} timing records from source session '{session_name}'."
    )
    
    client.close()

def print_error_report(max_messages=200):
    global error_courses, error_messages
    print("\n" + "=" * 80)
    print("SCRAPER ERROR REPORT")
    print("=" * 80)
    print(f"Stopped early: {stop_scraping}")
    print(f"Courses with errors: {len(error_courses)}")
    if error_courses:
        print("Course list:")
        for course_name in sorted(error_courses):
            print(f"  - {course_name}")
    print(f"Detailed messages: {len(error_messages)}")
    for index, msg in enumerate(error_messages[:max_messages], start=1):
        print(f"{index}. {msg}")
    if len(error_messages) > max_messages:
        print(f"... {len(error_messages) - max_messages} more error messages omitted")
    print("=" * 80 + "\n")

def print_skip_report(max_examples=50):
    global skipped_sections
    print("\n" + "=" * 80)
    print("SCRAPER SKIP SUMMARY")
    print("=" * 80)
    print(f"Skipped sections without capacity data: {len(skipped_sections)}")
    if skipped_sections:
        print(f"Examples, first {min(len(skipped_sections), max_examples)}:")
        for index, msg in enumerate(skipped_sections[:max_examples], start=1):
            print(f"{index}. {msg}")
    if len(skipped_sections) > max_examples:
        print(f"... {len(skipped_sections) - max_examples} more skipped sections omitted")
    print("=" * 80 + "\n")

# Main function to scrape the timetable data
def scrape_timetable_data():
    global error_courses, error_messages, stop_scraping, MAX_ERROR_TOLERANCE, faculty_metadata
    url = 'https://ttb.utoronto.ca'

    print(f"Starting scraper for {url}")

    try:
        driver.get(url)
        time.sleep(5)

        try:
            WebDriverWait(driver, 20).until_not(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".loading-overlay, .spinner, .loader"))
            )
        except TimeoutException:
            pass

        division_combo = WebDriverWait(driver, 20).until(
            EC.element_to_be_clickable((By.ID, 'division-combo-top-container'))
        )
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", division_combo)
        time.sleep(2)
        driver.execute_script("arguments[0].click();", division_combo)

        division_container = WebDriverWait(driver, 20).until(
            EC.visibility_of_element_located((By.ID, 'division-combo-bottom-container'))
        )
        divisions = WebDriverWait(division_container, 20).until(
            EC.visibility_of_all_elements_located((By.XPATH, ".//app-ttb-option"))
        )

        session_combo = WebDriverWait(driver, 20).until(
            EC.element_to_be_clickable((By.ID, 'session-combo-top-container'))
        )
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", session_combo)
        time.sleep(2)
        driver.execute_script("arguments[0].click();", session_combo)

        session_container = WebDriverWait(driver, 20).until(
            EC.visibility_of_element_located((By.ID, 'session-combo-bottom-container'))
        )
    except Exception as e:
        error_messages.append(f"Failed to load initial timetable filters: {e}")
        stop_scraping = True
        return

    try:
        sessions = WebDriverWait(session_container, 5).until(
            EC.visibility_of_all_elements_located((By.XPATH, ".//app-ttb-optiongroup"))
        )
        session_names = [session.get_attribute('aria-label') for session in sessions]
        more_than_one_session = True
    except TimeoutException:
        fallback_option = WebDriverWait(session_container, 5).until(
            EC.visibility_of_element_located((By.XPATH, ".//app-ttb-option"))
        )
        session_label = fallback_option.get_attribute('aria-label')
        session_label = (session_label.split(",")[0]).strip()
        session_names = [session_label]
        more_than_one_session = False

    print(f"Found {len(divisions)} divisions and {len(session_names)} sessions")

    for i, division in enumerate(divisions):
        division_name = division.get_attribute('aria-label')
        print(f"\nProcessing division {i+1}/{len(divisions)}: {division_name}")

        try:
            division_combo = WebDriverWait(driver, 20).until(
                EC.element_to_be_clickable((By.ID, 'division-combo-top-container'))
            )
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", division_combo)
            time.sleep(2)
            driver.execute_script("arguments[0].click();", division_combo)

            division_container = WebDriverWait(driver, 20).until(
                EC.visibility_of_element_located((By.ID, 'division-combo-bottom-container'))
            )
            division_option = WebDriverWait(division_container, 20).until(
                EC.element_to_be_clickable((By.XPATH, f"//app-ttb-option[@aria-label='{division_name}']"))
            )
            driver.execute_script("arguments[0].click();", division_option)
        except Exception as e:
            error_messages.append(f"Error selecting division {division_name}: {e}")
            stop_scraping = True
            break

        for j, session_name in enumerate(session_names):
            print(f"  Processing session {j+1}/{len(session_names)}: {session_name}")

            try:
                session_combo = WebDriverWait(driver, 20).until(
                    EC.element_to_be_clickable((By.ID, 'session-combo-top-container'))
                )
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", session_combo)
                time.sleep(2)
                driver.execute_script("arguments[0].click();", session_combo)

                if more_than_one_session:
                    session_container = WebDriverWait(driver, 20).until(
                        EC.visibility_of_element_located((By.ID, 'session-combo-bottom-container'))
                    )
                    session_option = WebDriverWait(session_container, 20).until(
                        EC.element_to_be_clickable((By.XPATH, f"//app-ttb-optiongroup[@aria-label='{session_name}']"))
                    )
                    driver.execute_script("arguments[0].click();", session_option)

                existing_courses = driver.find_elements(By.XPATH, "//app-course")
                search_button = WebDriverWait(driver, 20).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[contains(@class, 'btn-primary') and contains(., 'Search')]"))
                )
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", search_button)
                time.sleep(2)
                driver.execute_script("arguments[0].click();", search_button)

                if existing_courses:
                    WebDriverWait(driver, 20).until(EC.staleness_of(existing_courses[0]))

                faculty_metadata = {
                    "faculty_name": division_name,
                    "source_session": session_name,
                    "database_name": get_target_database_name(session_name),
                    "term_options": normalize_session_labels(session_name),
                    "semesters": {}
                }
                all_timings_data = []
            except Exception as e:
                error_messages.append(f"Error selecting session {session_name} for division {division_name}: {e}")
                stop_scraping = True
                break

            page_count = 0
            while True:
                page_count += 1

                try:
                    WebDriverWait(driver, 15).until(
                        EC.presence_of_element_located((By.CLASS_NAME, 'courses-section'))
                    )
                except TimeoutException:
                    page_text = driver.find_element(By.TAG_NAME, "body").text.lower()
                    if any(phrase in page_text for phrase in ["no courses", "no results", "not available", "coming soon"]):
                        break
                    error_messages.append(f"Could not find courses section after search for {division_name} - {session_name}")
                    break
                except Exception as e:
                    error_messages.append(f"Error loading courses section for {division_name} - {session_name}: {e}")
                    stop_scraping = True
                    break

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
                        WebDriverWait(course, 10).until(
                            EC.element_to_be_clickable((By.XPATH, f".//button[{class_xpath('accordion-button')}]"))
                        ).click()

                        WebDriverWait(course, 10).until(
                            EC.visibility_of_element_located((By.XPATH, f".//div[{class_xpath('course-sections')}]"))
                        )

                        course_timings = extract_course_timings(course)
                        all_timings_data.extend(course_timings)
                    except Exception as e:
                        error_messages.append(f"Error clicking caret button or waiting for course sections: {e}")
                        stop_scraping = True
                        break

                    if stop_scraping:
                        break

                if stop_scraping or len(error_courses) >= MAX_ERROR_TOLERANCE:
                    stop_scraping = True
                    break

                try:
                    next_button_container = driver.find_element(By.CLASS_NAME, 'pagination')
                    next_button = next_button_container.find_element(By.XPATH, "//a[@aria-label='Next']")
                    if 'disabled' in next_button.find_element(By.XPATH, "..").get_attribute('class'):
                        break

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
                break

        if stop_scraping:
            break

        try:
            if more_than_one_session:
                reset_button = WebDriverWait(driver, 15).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[contains(@class, 'btn-primary') and contains(., 'Reset Filters')]"))
                )
                driver.execute_script("arguments[0].scrollIntoView(true);", reset_button)
                time.sleep(1)
                driver.execute_script("arguments[0].click();", reset_button)
            else:
                division_combo = WebDriverWait(driver, 15).until(
                    EC.element_to_be_clickable((By.ID, 'division-combo-top-container'))
                )
                driver.execute_script("arguments[0].scrollIntoView(true);", division_combo)
                time.sleep(1)
                driver.execute_script("arguments[0].click();", division_combo)

                division_container = WebDriverWait(driver, 15).until(
                    EC.visibility_of_element_located((By.ID, 'division-combo-bottom-container'))
                )
                division_option = WebDriverWait(division_container, 15).until(
                    EC.element_to_be_clickable((By.XPATH, f"//app-ttb-option[@aria-label='{division_name}']"))
                )
                driver.execute_script("arguments[0].click();", division_option)

                division_combo = WebDriverWait(driver, 15).until(
                    EC.element_to_be_clickable((By.ID, 'division-combo-top-container'))
                )
                driver.execute_script("arguments[0].click();", division_combo)
        except Exception as e:
            error_messages.append(f"Error resetting filters: {e}")
            stop_scraping = True
            break
    
if __name__ == '__main__':
    scrape_timetable_data()
    if stop_scraping or len(error_courses) >= MAX_ERROR_TOLERANCE:
        print_error_report()
    else:
        if error_messages:
            print_error_report()
        if skipped_sections:
            print_skip_report()
        print("Scraping completed successfully")
    driver.quit()
