import React, { createContext, useState, useEffect } from "react";
import axios from "axios";

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [reformattedData, setReformattedData] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchResultsData, setSearchResultsData] = useState({});
  const [hasFetchedData, setHasFetchedData] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [loadingSearchResults, setLoadingSearchResults] = useState(true);

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/lastUpdated`)
      .then((response) => {
        const { last_updated } = response.data;
        setLastUpdated(last_updated);
      })
      .catch((error) => {
        console.error("Error fetching last updated date:", error);
      });

    axios
      .get(`${process.env.REACT_APP_API_BASE_URL}/api/filterData`)
      .then((response) => {
        const data = response.data;
        const reformatted = reformatData(data);
        setReformattedData(reformatted);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        setLoading(false);
      });
  }, []);

  const reformatData = (data) => {
    const reformatted = {};
    Object.keys(data).forEach((session) => {
      Object.keys(data[session]).forEach((faculty) => {
        Object.keys(data[session][faculty]).forEach((semester) => {
          if (!reformatted[semester]) {
            reformatted[semester] = {};
          }
          if (!reformatted[semester][faculty]) {
            reformatted[semester][faculty] = {};
          }
          const departments = data[session][faculty][semester];
          Object.keys(departments).forEach((department) => {
            if (!reformatted[semester][faculty][department]) {
              reformatted[semester][faculty][department] = {
                buildings: [],
                instructors: [],
              };
            }
            reformatted[semester][faculty][department].buildings.push(
              ...departments[department].buildings
            );
            reformatted[semester][faculty][department].instructors.push(
              ...departments[department].instructors
            );
          });
        });
      });
    });
    return reformatted;
  };

  return (
    <DataContext.Provider
      value={{
        reformattedData,
        loading,
        searchResultsData,
        setSearchResultsData,
        hasFetchedData,
        setHasFetchedData,
        lastUpdated,
        loadingSearchResults,
        setLoadingSearchResults,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
