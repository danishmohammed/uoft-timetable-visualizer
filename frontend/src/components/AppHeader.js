import React, { useState } from "react";

const AppHeader = ({ onSelectedViewChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState("Timetable");

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleViewChange = (view) => {
    setSelected(view);
    onSelectedViewChange(view);
  };

  return (
    <header className="bg-primary text-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <h1 className="text-xl md:text-2xl font-bold">
            UofT Timetable Visualizer
          </h1>
          <div className="ml-4 hidden md:flex">
            <button
              className={`px-4 py-2 border border-black rounded-l ${
                selected === "Timetable"
                  ? "bg-secondary text-white"
                  : "bg-white text-primary"
              }`}
              onClick={() => handleViewChange("Timetable")}
            >
              Timetable
            </button>
            <button
              className={`px-4 py-2 border border-black rounded-r ${
                selected === "Exams"
                  ? "bg-secondary text-white"
                  : "bg-white text-primary"
              }`}
              onClick={() => handleViewChange("Exams")}
            >
              Exams
            </button>
          </div>
        </div>
        <div className="flex md:hidden">
          <button
            className="text-white focus:outline-none"
            onClick={toggleMenu}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              ></path>
            </svg>
          </button>
        </div>
        <nav className="hidden md:flex space-x-4 ml-auto">
          <a
            href="https://github.com/danishmohammed/uoft-timetable-visualizer"
            className="hover:text-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a
            href="https://danishmohammed57.medium.com/how-i-created-the-uoft-timetable-visualizer-96c0ef0eb6ad"
            className="hover:text-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            App Creation Process
          </a>
          <a
            href="https://danishmohammed.ca/#contact"
            className="hover:text-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact Me
          </a>
        </nav>
      </div>
      {isOpen && (
        <nav className="mt-4 flex flex-col space-y-2 md:hidden justify-center items-center">
          <a
            href="https://github.com/danishmohammed/uoft-timetable-visualizer"
            className="hover:text-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a
            href="https://danishmohammed57.medium.com/how-i-created-the-uoft-timetable-visualizer-96c0ef0eb6ad"
            className="hover:text-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            App Creation Process
          </a>
          <a
            href="https://danishmohammed.ca/#contact"
            className="hover:text-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact Me
          </a>
        </nav>
      )}
      <div className="md:hidden mt-2">
        <button
          className={`px-4 py-2 border border-black rounded-l ${
            selected === "Timetable"
              ? "bg-secondary text-white"
              : "bg-white text-primary"
          }`}
          onClick={() => handleViewChange("Timetable")}
        >
          Timetable
        </button>
        <button
          className={`px-4 py-2 border border-black rounded-r ${
            selected === "Exams"
              ? "bg-secondary text-white"
              : "bg-white text-primary"
          }`}
          onClick={() => handleViewChange("Exams")}
        >
          Exams
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
