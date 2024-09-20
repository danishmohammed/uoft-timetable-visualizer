import React, { useState } from "react";
import { DataProvider } from "./context/DataContext";
import AppHeader from "./components/AppHeader";
import AppFooter from "./components/AppFooter";
import TimetableFilters from "./components/TimetableFilters";
import TimetableWeeklyView from "./components/TimetableWeeklyView";
import ExamFilters from "./components/ExamFilters";
import ExamFullView from "./components/ExamFullView";

const App = () => {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedView, setSelectedView] = useState("Timetable");

  const handleViewChange = (view) => {
    setSelectedView(view);
    setShowFilters(false);
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  return (
    <DataProvider>
      <div className="flex flex-col min-h-screen">
        <AppHeader onSelectedViewChange={handleViewChange} />
        <div className="flex flex-grow">
          {/* Sidebar for Desktop */}
          <div className="hidden md:block h-[calc(100vh-8.2rem)] bg-gray-100">
            {selectedView === "Timetable" ? (
              <TimetableFilters onApplyFilters={() => {}} />
            ) : (
              <ExamFilters onApplyFilters={() => {}} />
            )}
          </div>
          {/* Main Content Area */}
          <main className="flex-grow p-4 h-[calc(100vh-8.2rem)] overflow-y-auto">
            <div className="flex justify-end md:hidden">
              {/* Button to show filters on mobile */}
              <button
                className="bg-primary text-white py-2 px-4 mb-4"
                onClick={toggleFilters}
              >
                {showFilters ? "Hide Filters" : "Show Filters"}
              </button>
            </div>

            {/* Filters for Mobile */}
            {showFilters && (
              <div className="md:hidden mb-4">
                {selectedView === "Timetable" ? (
                  <TimetableFilters onApplyFilters={toggleFilters} />
                ) : (
                  <ExamFilters onApplyFilters={toggleFilters} />
                )}
              </div>
            )}

            {/* View Content */}
            {!showFilters &&
              (selectedView === "Timetable" ? (
                <TimetableWeeklyView />
              ) : (
                <ExamFullView />
              ))}
          </main>
        </div>
        <AppFooter />
      </div>
    </DataProvider>
  );
};

export default App;
