import React, { useState, useEffect, useContext } from "react";
import {
  Checkbox,
  FormControlLabel,
  Radio,
  RadioGroup,
  Button,
  FormControl,
  InputLabel,
  OutlinedInput,
  Autocomplete,
  TextField,
  Select,
  MenuItem,
  CircularProgress,
  Typography,
} from "@mui/material";
import axios from "axios";
import { DataContext } from "../context/DataContext";

const TimetableFilters = ({ onApplyFilters }) => {
  const {
    reformattedData,
    loading,
    setSearchResultsData,
    hasFetchedData,
    setHasFetchedData,
    setLoadingSearchResults,
  } = useContext(DataContext);

  const [semesterOptions, setSemesters] = useState([]);
  const campusOptions = ["UTSC", "UTSG", "UTM"];
  const deliveryOptions = ["In Person", "Online Synchronous"];
  const [facultyOptions, setFaculties] = useState([]);
  const [departmentOptions, setDepartments] = useState([]);
  const [buildingOptions, setBuildings] = useState([]);
  const [instructorOptions, setInstructors] = useState([]);

  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedCampuses, setSelectedCampuses] = useState(["UTSC"]);
  const [selectedDeliveryModes, setDeliveryModes] = useState(["In Person"]);
  const [selectedFaculties, setSelectedFaculties] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [selectedBuildings, setSelectedBuildings] = useState([]);
  const [selectedInstructors, setSelectedInstructors] = useState([]);
  const [startTime, setStartTime] = useState("8:00 AM");
  const [endTime, setEndTime] = useState("10:00 PM");

  const [facultyRadioOption, setFacultyRadioOption] = useState("All");
  const [departmentRadioOption, setDepartmentRadioOption] = useState("All");
  const [buildingRadioOption, setBuildingRadioOption] = useState("All");
  const [instructorRadioOption, setInstructorRadioOption] = useState("All");

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  // Generate time options for start time (8:00 AM to 9:00 PM)
  const startTimeOptions = Array.from({ length: 27 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const minute = i % 2 === 0 ? "00" : "30";
    const suffix = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour === 12 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${formattedHour}:${minute} ${suffix}`;
  });
  // Generate time options for end time (9:00 AM to 10:00 PM)
  const endTimeOptions = Array.from({ length: 27 }, (_, i) => {
    const hour = Math.floor(i / 2) + 9;
    const minute = i % 2 === 0 ? "00" : "30";
    const suffix = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour === 12 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${formattedHour}:${minute} ${suffix}`;
  });

  const convert12HourToMinutes = (timeStr) => {
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":");

    if (hours === "12") {
      hours = modifier === "AM" ? "00" : "12";
    } else if (modifier === "PM") {
      hours = String(parseInt(hours, 10) + 12);
    }

    return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
  };
  const convert24HourToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(":");
    return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
  };
  const convertMinutesTo12Hour = (minutes) => {
    const hours24 = Math.floor(minutes / 60);
    const mins = minutes % 60;

    const suffix = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

    return `${hours12}:${mins.toString().padStart(2, "0")} ${suffix}`;
  };

  // Helper function just to see the occurrences of each field in the search results data (not actually used)
  // const processSearchResultsData = (searchResultsData) => {
  //   const occurrenceData = {
  //     section_title: {},
  //     day: {},
  //     start_time: {},
  //     end_time: {},
  //     campus: {},
  //     session: {},
  //     department: {},
  //     faculty: {},
  //     location: {},
  //     delivery_mode: {},
  //   };

  //   searchResultsData.forEach((entry) => {
  //     // Increment the count for section_title
  //     if (occurrenceData.section_title[entry.section_title]) {
  //       occurrenceData.section_title[entry.section_title]++;
  //     } else {
  //       occurrenceData.section_title[entry.section_title] = 1;
  //     }

  //     // Increment the count for day
  //     if (occurrenceData.day[entry.day]) {
  //       occurrenceData.day[entry.day]++;
  //     } else {
  //       occurrenceData.day[entry.day] = 1;
  //     }

  //     // Increment the count for start_time
  //     if (occurrenceData.start_time[entry.start_time]) {
  //       occurrenceData.start_time[entry.start_time]++;
  //     } else {
  //       occurrenceData.start_time[entry.start_time] = 1;
  //     }

  //     // Increment the count for end_time
  //     if (occurrenceData.end_time[entry.end_time]) {
  //       occurrenceData.end_time[entry.end_time]++;
  //     } else {
  //       occurrenceData.end_time[entry.end_time] = 1;
  //     }

  //     // Increment the count for campus
  //     if (occurrenceData.campus[entry.campus]) {
  //       occurrenceData.campus[entry.campus]++;
  //     } else {
  //       occurrenceData.campus[entry.campus] = 1;
  //     }

  //     // Increment the count for session
  //     if (occurrenceData.session[entry.session]) {
  //       occurrenceData.session[entry.session]++;
  //     } else {
  //       occurrenceData.session[entry.session] = 1;
  //     }

  //     // Increment the count for department
  //     if (occurrenceData.department[entry.department]) {
  //       occurrenceData.department[entry.department]++;
  //     } else {
  //       occurrenceData.department[entry.department] = 1;
  //     }

  //     // Increment the count for faculty
  //     if (occurrenceData.faculty[entry.faculty]) {
  //       occurrenceData.faculty[entry.faculty]++;
  //     } else {
  //       occurrenceData.faculty[entry.faculty] = 1;
  //     }

  //     // Increment the count for location
  //     if (occurrenceData.location[entry.location]) {
  //       occurrenceData.location[entry.location]++;
  //     } else {
  //       occurrenceData.location[entry.location] = 1;
  //     }

  //     // Increment the count for delivery_mode
  //     if (occurrenceData.delivery_mode[entry.delivery_mode]) {
  //       occurrenceData.delivery_mode[entry.delivery_mode]++;
  //     } else {
  //       occurrenceData.delivery_mode[entry.delivery_mode] = 1;
  //     }
  //   });

  //   return occurrenceData;
  // };

  const processChartData = (searchResultsData) => {
    const startTimeInMinutes = convert12HourToMinutes(startTime);
    const endTimeInMinutes = convert12HourToMinutes(endTime);

    let chartFormattedData = {};

    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    daysOfWeek.forEach((day) => {
      chartFormattedData[day] = {};

      for (let time = startTimeInMinutes; time < endTimeInMinutes; time += 30) {
        const timeStr = convertMinutesTo12Hour(time);
        chartFormattedData[day][timeStr] = 0;
      }
    });

    searchResultsData.forEach((classData) => {
      const { day, start_time, end_time, current_enrolment } = classData;

      if (!daysOfWeek.includes(day)) {
        return; // This might happen because UTM has some Saturday classes, but we do not consider those
      }
      const classStartInMinutes = convert24HourToMinutes(start_time);
      const classEndInMinutes = convert24HourToMinutes(end_time);

      for (
        let time = classStartInMinutes;
        time < classEndInMinutes;
        time += 30
      ) {
        if (time >= startTimeInMinutes && time < endTimeInMinutes) {
          const timeStr = convertMinutesTo12Hour(time);
          chartFormattedData[day][timeStr] += current_enrolment;
        }
      }
    });

    return chartFormattedData;
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!loading && reformattedData) {
      const semesters = Object.keys(reformattedData);
      setSemesters(semesters);

      const defaultSemester = determineDefaultSemester(semesters);
      setSelectedSemester(defaultSemester);
      handleSemesterOrCampusChange(defaultSemester, selectedCampuses);
    }
  }, [loading, reformattedData]);
  /* eslint-disable react-hooks/exhaustive-deps */

  // This only runs once when the app first mounts
  useEffect(() => {
    if (selectedSemester && !hasFetchedData) {
      handleApplyFilters();
      setHasFetchedData(true);
    }
  }, [selectedSemester]);

  const determineDefaultSemester = (semesters) => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentDay = currentDate.getDate();

    if (
      (currentMonth === 11 && currentDay >= 16) ||
      (currentMonth <= 3 && !(currentMonth === 3 && currentDay > 15))
    ) {
      return semesters.find((sem) => sem.includes("Winter")) || semesters[0];
    } else if (
      (currentMonth === 3 && currentDay >= 16) ||
      (currentMonth === 4 && currentDay <= 15)
    ) {
      return (
        semesters.find((sem) => sem.includes("Summer First Sub-Session")) ||
        semesters[0]
      );
    } else if (
      (currentMonth === 4 && currentDay >= 16) ||
      (currentMonth === 5 && currentDay <= 15) ||
      (currentMonth === 6 && currentDay <= 15)
    ) {
      return (
        semesters.find((sem) => sem.includes("Summer Second Sub-Session")) ||
        semesters[0]
      );
    } else if (
      (currentMonth === 7 && currentDay >= 16) ||
      (currentMonth >= 8 && currentDay <= 15)
    ) {
      return semesters.find((sem) => sem.includes("Fall")) || semesters[0];
    } else {
      return semesters[0];
    }
  };

  const handleApplyFilters = async () => {
    setLoadingSearchResults("true");

    try {
      const payload = {
        semester: selectedSemester,
        campuses: selectedCampuses,
        delivery:
          selectedDeliveryModes.length > 0
            ? selectedDeliveryModes
            : deliveryOptions,
        faculties: selectedFaculties,
        departments: selectedDepartments,
        buildings: selectedBuildings,
        instructorsList: selectedInstructors,
        startTime,
        endTime,
      };

      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/api/searchResults`,
        payload
      );
      const searchResultsData = response.data;

      //const occurrenceData = processSearchResultsData(searchResultsData);
      //console.log("Occurrences of fields in the data:", occurrenceData);

      const chartData = processChartData(searchResultsData);
      //console.log("Chart data:", chartData);

      setSearchResultsData(chartData);
    } catch (error) {
      console.error("Error applying filters:", error);
    }

    setLoadingSearchResults(false);
  };

  const handleSemesterOrCampusChange = (semester, campuses) => {
    const availableFaculties = new Set();
    const availableDepartments = new Set();
    const availableBuildings = new Set();
    const availableInstructors = new Set();

    if (campuses.length === 0) {
      campuses = campusOptions;
    }

    campuses.forEach((campus) => {
      Object.keys(reformattedData[semester]).forEach((faculty) => {
        if (
          (campus === "UTSC" &&
            faculty === "University of Toronto Scarborough") ||
          (campus === "UTM" &&
            faculty === "University of Toronto Mississauga") ||
          (campus === "UTSG" &&
            !faculty.includes("Scarborough") &&
            !faculty.includes("Mississauga"))
        ) {
          availableFaculties.add(faculty);
          Object.keys(reformattedData[semester][faculty]).forEach(
            (department) => {
              availableDepartments.add(department);
              reformattedData[semester][faculty][department].buildings.forEach(
                (building) => availableBuildings.add(building)
              );
              reformattedData[semester][faculty][
                department
              ].instructors.forEach((instructor) =>
                availableInstructors.add(instructor)
              );
            }
          );
        }
      });
    });

    setFaculties([...availableFaculties]);
    setDepartments([...availableDepartments]);
    setBuildings([...availableBuildings]);
    setInstructors([...availableInstructors]);

    setSelectedFaculties([]);
    setSelectedDepartments([]);
    setSelectedBuildings([]);
    setSelectedInstructors([]);
  };

  const handleFacultyChange = (selectedFaculties, semester) => {
    const availableDepartments = new Set();
    const availableBuildings = new Set();
    const availableInstructors = new Set();

    selectedFaculties.forEach((faculty) => {
      Object.keys(reformattedData[semester][faculty]).forEach((department) => {
        availableDepartments.add(department);
        reformattedData[semester][faculty][department].buildings.forEach(
          (building) => availableBuildings.add(building)
        );
        reformattedData[semester][faculty][department].instructors.forEach(
          (instructor) => availableInstructors.add(instructor)
        );
      });
    });

    setDepartments([...availableDepartments]);
    setBuildings([...availableBuildings]);
    setInstructors([...availableInstructors]);

    setSelectedDepartments([]);
    setSelectedBuildings([]);
    setSelectedInstructors([]);
  };

  const handleDepartmentChange = (
    selectedDepartments,
    selectedFaculties,
    semester
  ) => {
    const availableBuildings = new Set();
    const availableInstructors = new Set();

    selectedFaculties.forEach((faculty) => {
      selectedDepartments.forEach((department) => {
        const departmentData =
          reformattedData[semester]?.[faculty]?.[department];
        if (departmentData) {
          departmentData.buildings.forEach((building) =>
            availableBuildings.add(building)
          );
          departmentData.instructors.forEach((instructor) =>
            availableInstructors.add(instructor)
          );
        }
      });
    });

    setBuildings([...availableBuildings]);
    setInstructors([...availableInstructors]);

    setSelectedBuildings([]);
    setSelectedInstructors([]);
  };

  const handleSemesterSelectChange = (event) => {
    const newSemester = event.target.value;
    setSelectedSemester(newSemester);
    handleSemesterOrCampusChange(newSemester, selectedCampuses);
  };

  const handleCampusSelectChange = (event, newValue) => {
    setSelectedCampuses(newValue);
    handleSemesterOrCampusChange(selectedSemester, newValue);
  };

  const handleDeliverySelectChange = (event) => {
    const value = event.target.value;
    setDeliveryModes((prevState) =>
      prevState.includes(value)
        ? prevState.filter((mode) => mode !== value)
        : [...prevState, value]
    );
  };

  const toggleAdvancedFilters = () => {
    setShowAdvancedFilters(!showAdvancedFilters);
  };

  const handleFacultySelectChange = (event, newValue) => {
    setSelectedFaculties(newValue);
    handleFacultyChange(
      newValue.length === 0 ? facultyOptions : newValue,
      selectedSemester
    );
  };

  const handleDepartmentSelectChange = (event, newValue) => {
    setSelectedDepartments(newValue);
    handleDepartmentChange(
      newValue.length === 0 ? departmentOptions : newValue,
      selectedFaculties.length === 0 ? facultyOptions : selectedFaculties,
      selectedSemester
    );
  };

  const handleBuildingSelectChange = (event, newValue) => {
    setSelectedBuildings(newValue);
  };

  const handleInstructorSelectChange = (event, newValue) => {
    setSelectedInstructors(newValue);
  };

  const toggleFacultyOption = (event, newValue) => {
    setFacultyRadioOption(newValue);
    setSelectedFaculties([]);
    handleFacultyChange(facultyOptions, selectedSemester);
  };

  const toggleDepartmentOption = (event, newValue) => {
    setDepartmentRadioOption(newValue);
    setSelectedDepartments([]);
    handleDepartmentChange(
      departmentOptions,
      selectedFaculties.length === 0 ? facultyOptions : selectedFaculties,
      selectedSemester
    );
  };

  const toggleBuildingOption = (event, newValue) => {
    setBuildingRadioOption(newValue);
    setSelectedBuildings([]);
  };

  const toggleInstructorOption = (event, newValue) => {
    setInstructorRadioOption(newValue);
    setSelectedInstructors([]);
  };

  const handleStartTimeChange = (event) => {
    const newStartTime = event.target.value;
    setStartTime(newStartTime);

    const startRank = endTimeOptions.indexOf(newStartTime);
    if (startRank !== -1 && startRank >= endTimeOptions.indexOf(endTime)) {
      setEndTime("10:00 PM");
    }
  };

  const handleEndTimeChange = (event) => {
    const newEndTime = event.target.value;
    setEndTime(newEndTime);

    const endRank = startTimeOptions.indexOf(newEndTime);
    if (endRank !== -1 && endRank <= startTimeOptions.indexOf(startTime)) {
      setStartTime("8:00 AM");
    }
  };

  return (
    <div className="bg-offwhite shadow-md rounded-lg p-6 w-full md:w-80 h-full flex flex-col justify-between overflow-y-auto">
      {loading ? (
        <div
          className="flex justify-center items-center h-full"
          style={{ height: "100vh" }}
        >
          <div className="flex flex-col justify-center items-center">
            <CircularProgress />
            <Typography
              variant="h6"
              className="mt-4"
              sx={{ marginTop: "16px" }}
            >
              Filters Loading...
            </Typography>
          </div>
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Filters</h2>

            <FormControl fullWidth margin="normal">
              <InputLabel
                shrink={true}
                id="semester-label"
                style={{
                  paddingLeft: "4px",
                  background: "white",
                  paddingRight: "4px",
                  color: "#25355A",
                }}
              >
                Semester
              </InputLabel>
              <Select
                value={selectedSemester}
                onChange={handleSemesterSelectChange}
                labelId="semester-label"
              >
                {semesterOptions.map((semester, index) => (
                  <MenuItem key={index} value={semester}>
                    {semester}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <div className="mt-4">
              <Autocomplete
                multiple
                id="campus-autocomplete"
                options={campusOptions}
                value={selectedCampuses}
                onChange={handleCampusSelectChange}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Campus(es)"
                    placeholder="Select Campus"
                    variant="outlined"
                  />
                )}
              />
            </div>

            <div className="mt-4">
              <div className="text-lg font-semibold mb-2 text-primary">
                Delivery Mode
              </div>
              {deliveryOptions.map((option) => (
                <FormControlLabel
                  key={option}
                  control={
                    <Checkbox
                      checked={selectedDeliveryModes.includes(option)}
                      onChange={handleDeliverySelectChange}
                      value={option}
                      sx={{ color: "#25355A" }}
                    />
                  }
                  label={option}
                />
              ))}
            </div>

            <div className="mt-4">
              <button
                onClick={toggleAdvancedFilters}
                className="text-secondary text-sm hover:underline bg-transparent border-none cursor-pointer"
              >
                {showAdvancedFilters
                  ? "Hide Advanced Filters"
                  : "Show Advanced Filters"}
              </button>

              {showAdvancedFilters && (
                <div className="mt-4">
                  <div className="mt-4">
                    <div className="text-lg font-semibold mb-2 text-primary">
                      Faculty(s)
                    </div>
                    <RadioGroup
                      value={facultyRadioOption}
                      onChange={toggleFacultyOption}
                    >
                      <FormControlLabel
                        value="All"
                        control={<Radio sx={{ color: "#25355A" }} />}
                        label="All"
                      />
                      <FormControlLabel
                        value="Select"
                        control={<Radio sx={{ color: "#25355A" }} />}
                        label="Select"
                      />
                    </RadioGroup>

                    {facultyRadioOption === "Select" && (
                      <Autocomplete
                        multiple
                        id="faculty-autocomplete"
                        options={facultyOptions}
                        value={selectedFaculties}
                        onChange={handleFacultySelectChange}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Select Faculty(s)"
                            placeholder="Select Faculty(s)"
                            variant="outlined"
                          />
                        )}
                      />
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="text-lg font-semibold mb-2 text-primary">
                      Department(s)
                    </div>
                    <RadioGroup
                      value={departmentRadioOption}
                      onChange={toggleDepartmentOption}
                    >
                      <FormControlLabel
                        value="All"
                        control={<Radio sx={{ color: "#25355A" }} />}
                        label="All"
                      />
                      <FormControlLabel
                        value="Select"
                        control={<Radio sx={{ color: "#25355A" }} />}
                        label="Select"
                      />
                    </RadioGroup>

                    {departmentRadioOption === "Select" && (
                      <Autocomplete
                        multiple
                        id="department-autocomplete"
                        options={departmentOptions}
                        value={selectedDepartments}
                        onChange={handleDepartmentSelectChange}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Select Department(s)"
                            placeholder="Select Department(s)"
                            variant="outlined"
                          />
                        )}
                      />
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="text-lg font-semibold mb-2 text-primary">
                      Building(s)
                    </div>
                    <RadioGroup
                      value={buildingRadioOption}
                      onChange={toggleBuildingOption}
                    >
                      <FormControlLabel
                        value="All"
                        control={<Radio sx={{ color: "#25355A" }} />}
                        label="All"
                      />
                      <FormControlLabel
                        value="Select"
                        control={<Radio sx={{ color: "#25355A" }} />}
                        label="Select"
                      />
                    </RadioGroup>

                    {buildingRadioOption === "Select" && (
                      <Autocomplete
                        multiple
                        id="building-autocomplete"
                        options={buildingOptions}
                        value={selectedBuildings}
                        onChange={handleBuildingSelectChange}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Select Building(s)"
                            placeholder="Select Building(s)"
                            variant="outlined"
                          />
                        )}
                      />
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="text-lg font-semibold mb-2 text-primary">
                      Instructor(s)
                    </div>
                    <RadioGroup
                      value={instructorRadioOption}
                      onChange={toggleInstructorOption}
                    >
                      <FormControlLabel
                        value="All"
                        control={<Radio sx={{ color: "#25355A" }} />}
                        label="All"
                      />
                      <FormControlLabel
                        value="Select"
                        control={<Radio sx={{ color: "#25355A" }} />}
                        label="Select"
                      />
                    </RadioGroup>

                    {instructorRadioOption === "Select" && (
                      <Autocomplete
                        multiple
                        id="instructor-autocomplete"
                        options={instructorOptions}
                        value={selectedInstructors}
                        onChange={handleInstructorSelectChange}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Select Instructor(s)"
                            placeholder="Select Instructor(s)"
                            variant="outlined"
                          />
                        )}
                      />
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="text-lg font-semibold mb-2 text-primary">
                      Time Range Start
                    </div>
                    <FormControl fullWidth>
                      <InputLabel id="time-range-start-label">
                        Start Time
                      </InputLabel>
                      <Select
                        labelId="time-range-start-label"
                        id="time-range-start"
                        value={startTime}
                        onChange={handleStartTimeChange}
                        input={<OutlinedInput label="Start Time" />}
                      >
                        {startTimeOptions.map((time) => (
                          <MenuItem key={time} value={time}>
                            {time}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </div>

                  <div className="mt-4">
                    <div className="text-lg font-semibold mb-2 text-primary">
                      Time Range End
                    </div>
                    <FormControl fullWidth>
                      <InputLabel id="time-range-end-label">
                        End Time
                      </InputLabel>
                      <Select
                        labelId="time-range-end-label"
                        id="time-range-end"
                        value={endTime}
                        onChange={handleEndTimeChange}
                        input={<OutlinedInput label="End Time" />}
                      >
                        {endTimeOptions.map((time) => (
                          <MenuItem key={time} value={time}>
                            {time}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={() => {
                onApplyFilters();
                handleApplyFilters();
              }}
              style={{
                backgroundColor: "#25355A",
                color: "white",
                padding: "8px 24px",
                borderRadius: "4px",
                width: "100%",
                transition:
                  "background-color 0.3s ease, box-shadow 0.3s ease, transform 0.1s ease",
              }}
              className="apply-filters-button"
              sx={{
                "&:hover": {
                  backgroundColor: "#007FA3",
                  boxShadow: "0px 4px 15px rgba(0, 0, 0, 0.2)",
                },
                "&:active": {
                  transform: "scale(0.98)",
                },
              }}
            >
              Apply Filters
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default TimetableFilters;
